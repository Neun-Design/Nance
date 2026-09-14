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
    // the debt only shrinks (settled: #412 → Portfolio has none left)
    expect(Object.keys(portfolio.suppress)).toEqual([]);
    const total = AUTHORED.reduce((n, m) => n + Object.keys(m.suppress).length, 0);
    expect(total).toBeLessThanOrEqual(17);
  });

  it("removing a suppression surfaces the error and fails the build", () => {
    const unsuppressed = { ...workspace, suppress: {} };
    const rest = AUTHORED.filter((m) => m.name !== "Workspace");
    const errors = unsuppressedErrors([...rest, unsuppressed]);
    expect(errors.length).toBe(Object.keys(workspace.suppress).length);
    expect(errors.every((e) => `${e.entity}${e.field ? `.${e.field}` : ""}` in workspace.suppress)).toBe(true);
    expect(() => compiledModules([...rest, unsuppressed])).toThrow(SpecBuildError);
  });

  it("a fresh drift bug in an authored module fails the build", () => {
    const broken = structuredClone(organization);
    const bu = broken.tables.find((t) => t.entity.name === "Business Units")!;
    bu.entity.fields.push({ ...bu.entity.fields[0]!, name: "secondID" }); // a second PK
    const errors = unsuppressedErrors([broken, portfolio, operation, talent, crm, workspace, control]);
    expect(errors.some((e) => e.entity === "Business Units" && /exactly one PK/.test(e.message))).toBe(true);
  });
});
