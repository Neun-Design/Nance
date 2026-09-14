import { describe, expect, it } from "vitest";
import { AUTHORED, SpecBuildError, loadPassthrough, migratedFrom, unsuppressedErrors } from "../src/index.js";
import { portfolio } from "../src/modules/portfolio.js";
import { organization } from "../src/modules/organization.js";

describe("build gate — unsuppressed Model errors fail spec:build", () => {
  const passthrough = loadPassthrough();

  it("the authored modules build (their carried-over errors are suppressed with an issue)", () => {
    expect(unsuppressedErrors(AUTHORED, passthrough)).toEqual([]);
    expect(Object.keys(migratedFrom(AUTHORED, passthrough))).toEqual(["Organization", "Portfolio"]);
    for (const v of Object.values(portfolio.suppress)) expect(v).toMatch(/^#\d+: /);
  });

  it("removing a suppression surfaces the error and fails the build", () => {
    const unsuppressed = { ...portfolio, suppress: {} };
    const errors = unsuppressedErrors([organization, unsuppressed], passthrough);
    expect(errors.map((e) => `${e.entity}.${e.field}`).sort()).toEqual(["Product Groups.productID", "Scopes.productScopeID"]);
    expect(() => migratedFrom([organization, unsuppressed], passthrough)).toThrow(SpecBuildError);
  });

  it("a fresh drift bug in an authored module fails the build", () => {
    const broken = structuredClone(organization);
    const bu = broken.tables.find((t) => t.entity.name === "Business Units")!;
    bu.entity.fields.push({ ...bu.entity.fields[0]!, name: "secondID" }); // a second PK
    const errors = unsuppressedErrors([broken, portfolio], passthrough);
    expect(errors.some((e) => e.entity === "Business Units" && /exactly one PK/.test(e.message))).toBe(true);
  });
});
