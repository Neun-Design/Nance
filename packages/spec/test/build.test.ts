import { describe, expect, it } from "vitest";
import { AUTHORED, SpecBuildError, compiledModules, unsuppressedErrors } from "../src/index.js";
import { organization } from "../src/modules/organization.js";
import { portfolio } from "../src/modules/portfolio.js";
import { operation } from "../src/modules/operation.js";
import { talent } from "../src/modules/talent.js";
import { crm } from "../src/modules/crm.js";
import { workspace } from "../src/modules/workspace.js";
import { control } from "../src/modules/control.js";


describe("build gate — unsuppressed Model errors fail spec:build", () => {
  it("the authored modules build (their carried-over errors are suppressed with an issue)", () => {
    expect(unsuppressedErrors(AUTHORED)).toEqual([]);
    expect(Object.keys(compiledModules(AUTHORED)).sort()).toEqual(AUTHORED.map((m) => m.name).sort());
    for (const m of AUTHORED) for (const v of Object.values(m.suppress)) expect(v).toMatch(/^#\d+: /);
  });

  it("the debt is settled: no module carries a suppression", () => {
    for (const m of AUTHORED) expect(m.suppress, m.name).toEqual({});
  });

  it("a suppression must name its fix issue, and only hides the error it names", () => {
    const broken = structuredClone(workspace);
    const jobs = broken.tables.find((t) => t.entity.name === "Jobs")!;
    const f = jobs.entity.fields.find((x) => x.name === "jobName")!;
    f.relation = { kind: "mirror", target: "Taks", via: "taskID", viaList: null, display: "taskName", concat: null, filter: null }; // typo
    const rest = AUTHORED.filter((m) => m.name !== "Workspace");
    expect(unsuppressedErrors([...rest, broken]).map((e) => `${e.entity}.${e.field}`)).toEqual(["Jobs.jobName"]);
    expect(() => compiledModules([...rest, broken])).toThrow(SpecBuildError);
    const suppressed = { ...broken, suppress: { "Jobs.jobName": "#999: known typo, fix pending" } };
    expect(unsuppressedErrors([...rest, suppressed])).toEqual([]);
    expect(() => compiledModules([...rest, suppressed])).not.toThrow();
  });

  it("a fresh drift bug in an authored module fails the build", () => {
    const broken = structuredClone(organization);
    const bu = broken.tables.find((t) => t.entity.name === "Business Units")!;
    bu.entity.fields.push({ ...bu.entity.fields[0]!, name: "secondID" }); // a second PK
    const errors = unsuppressedErrors([broken, portfolio, operation, talent, crm, workspace, control]);
    expect(errors.some((e) => e.entity === "Business Units" && /exactly one PK/.test(e.message))).toBe(true);
  });
});
