import { describe, expect, it } from "vitest";
import { AUTHORED, SpecBuildError, loadPassthrough, migratedFrom, unsuppressedErrors } from "../src/index.js";
import { portfolio } from "../src/modules/portfolio.js";
import { organization } from "../src/modules/organization.js";
import { operation } from "../src/modules/operation.js";
import { talent } from "../src/modules/talent.js";
import { crm } from "../src/modules/crm.js";
import { workspace } from "../src/modules/workspace.js";
import { control } from "../src/modules/control.js";

describe("build gate — unsuppressed Model errors fail spec:build", () => {
  const passthrough = loadPassthrough();

  it("the authored modules build (their carried-over errors are suppressed with an issue)", () => {
    expect(unsuppressedErrors(AUTHORED, passthrough)).toEqual([]);
    expect(Object.keys(migratedFrom(AUTHORED, passthrough))).toEqual(["Organization", "Portfolio", "Operation", "Talent", "CRM", "Workspace", "Control"]);
    expect(Object.keys(workspace.suppress).length).toBe(9);
    expect(Object.keys(crm.suppress).length).toBe(4);
    expect(Object.keys(control.suppress).length).toBe(1);
    for (const m of AUTHORED) for (const v of Object.values(m.suppress)) expect(v).toMatch(/^#\d+: /);
    expect(Object.keys(operation.suppress)).toEqual(["Tasks.roles"]);
    expect(Object.keys(talent.suppress).sort()).toEqual(["Competence.channelName", "Roles.taskName"]);
  });

  it("removing a suppression surfaces the error and fails the build", () => {
    const unsuppressed = { ...portfolio, suppress: {} };
    const errors = unsuppressedErrors([organization, unsuppressed, operation, talent, crm, workspace, control], passthrough);
    expect(errors.map((e) => `${e.entity}.${e.field}`).sort()).toEqual(["Product Groups.productID", "Scopes.productScopeID"]);
    expect(() => migratedFrom([organization, unsuppressed, operation, talent, crm, workspace, control], passthrough)).toThrow(SpecBuildError);
  });

  it("a fresh drift bug in an authored module fails the build", () => {
    const broken = structuredClone(organization);
    const bu = broken.tables.find((t) => t.entity.name === "Business Units")!;
    bu.entity.fields.push({ ...bu.entity.fields[0]!, name: "secondID" }); // a second PK
    const errors = unsuppressedErrors([broken, portfolio, operation, talent, crm, workspace, control], passthrough);
    expect(errors.some((e) => e.entity === "Business Units" && /exactly one PK/.test(e.message))).toBe(true);
  });
});
