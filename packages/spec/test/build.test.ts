import { describe, expect, it } from "vitest";
import { AUTHORED, SpecBuildError, compiledModules, unsuppressedErrors } from "../src/index.js";
import { organization } from "../src/modules/organization.js";
import { portfolio } from "../src/modules/portfolio.js";
import { operation } from "../src/modules/operation.js";
import { talent } from "../src/modules/talent.js";
import { crm } from "../src/modules/crm.js";
import { workspace } from "../src/modules/workspace.js";
import { control } from "../src/modules/control.js";

const others = [organization, operation, talent, crm, workspace, control];

describe("build gate — unsuppressed Model errors fail spec:build", () => {
  it("the authored modules build (their carried-over errors are suppressed with an issue)", () => {
    expect(unsuppressedErrors(AUTHORED)).toEqual([]);
    expect(Object.keys(compiledModules(AUTHORED)).sort()).toEqual(AUTHORED.map((m) => m.name).sort());
    for (const m of AUTHORED) for (const v of Object.values(m.suppress)) expect(v).toMatch(/^#\d+: /);
    expect(Object.keys(portfolio.suppress).length).toBe(2); // #412
    expect(Object.keys(operation.suppress).length + Object.keys(talent.suppress).length).toBe(3); // #414
    expect(Object.keys(crm.suppress).length + Object.keys(workspace.suppress).length + Object.keys(control.suppress).length).toBe(14); // #417
  });

  it("removing a suppression surfaces the error and fails the build", () => {
    const unsuppressed = { ...portfolio, suppress: {} };
    const errors = unsuppressedErrors([...others, unsuppressed]);
    expect(errors.map((e) => `${e.entity}.${e.field}`).sort()).toEqual(["Product Groups.productID", "Scopes.productScopeID"]);
    expect(() => compiledModules([...others, unsuppressed])).toThrow(SpecBuildError);
  });

  it("a fresh drift bug in an authored module fails the build", () => {
    const broken = structuredClone(organization);
    const bu = broken.tables.find((t) => t.entity.name === "Business Units")!;
    bu.entity.fields.push({ ...bu.entity.fields[0]!, name: "secondID" }); // a second PK
    const errors = unsuppressedErrors([broken, portfolio, operation, talent, crm, workspace, control]);
    expect(errors.some((e) => e.entity === "Business Units" && /exactly one PK/.test(e.message))).toBe(true);
  });
});
