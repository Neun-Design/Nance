import { describe, expect, it } from "vitest";
import { loadPassthrough } from "../src/index.js";
import type { Json, JsonObject } from "../src/index.js";
import { parseCheck, renderCheck, requires, requiresValue } from "../src/behavior/check.js";
import { filteredBy, groupedBy, multivalued, parseFieldRule, renderFieldRule } from "../src/behavior/fieldRule.js";

/** Every form field and report-filter field in the datamodel. */
function allFormFields(): { where: string; f: JsonObject }[] {
  const out: { where: string; f: JsonObject }[] = [];
  const modules = loadPassthrough().modules as JsonObject;
  for (const [mn, m] of Object.entries(modules)) {
    for (const [tn, t] of Object.entries((m as JsonObject)["tables"] as JsonObject)) {
      const table = t as JsonObject;
      const form = table["form"];
      if (form && typeof form === "object") {
        for (const [label, f] of Object.entries(((form as JsonObject)["fields"] as JsonObject) ?? {})) {
          out.push({ where: `${mn}/${tn}.form.${label}`, f: f as JsonObject });
        }
      }
      const reports = table["reports"];
      if (reports && typeof reports === "object" && !Array.isArray(reports)) {
        for (const [rn, r] of Object.entries(reports as JsonObject)) {
          const fields = ((r as JsonObject | null)?.["filters"] as JsonObject | undefined)?.["fields"] as JsonObject | undefined;
          for (const [fn, f] of Object.entries(fields ?? {})) out.push({ where: `${mn}/${tn}.reports.${rn}.${fn}`, f: f as JsonObject });
        }
      }
    }
  }
  return out;
}

const FIELDS = allFormFields();

describe("check — cascades as objects (engine grammar)", () => {
  it("covers the real form fields", () => {
    expect(FIELDS.length).toBeGreaterThan(241);
  });

  it("round-trip law over every non-empty check", () => {
    let parsed = 0;
    const unparsed: string[] = [];
    for (const { where, f } of FIELDS) {
      const raw = f["check"] as Json;
      if (raw == null || raw === "") continue;
      const c = parseCheck(raw);
      if (!c) { unparsed.push(`${where}: ${String(raw)}`); continue; }
      parsed++;
      expect(parseCheck(renderCheck(c)), where).toEqual(c);
    }
    expect(parsed).toBeGreaterThanOrEqual(90);
    // every authored check is one the engine gates on
    expect(unparsed).toEqual([]);
  });

  it("builders render the canonical forms", () => {
    expect(renderCheck(requires("Business Unit"))).toBe("Business Unit IS NOT NULL");
    expect(renderCheck(requires("A", "B"))).toBe("A && B IS NOT NULL");
    expect(renderCheck(requiresValue("Type", "Risk", "Opportunity"))).toBe("Type = Risk|Opportunity");
    expect(parseCheck("Active = 'Yes'")).toEqual({ kind: "equals", dep: "Active", values: ["Yes"] });
  });
});

describe("field-rule — option filters as objects (engine grammar)", () => {
  it("round-trip law over every non-empty field-rule; ignored text inventoried", () => {
    let parsed = 0;
    const residuals: string[] = [];
    for (const { where, f } of FIELDS) {
      const raw = f["field-rule"] as Json;
      if (raw == null || raw === "") continue;
      const { rule, residual } = parseFieldRule(raw);
      if (residual.length) residuals.push(`${where}: ${residual.join(" | ")}`);
      if (!rule) continue;
      parsed++;
      // the law includes `note`: ignored text survives the round trip verbatim
      expect(parseFieldRule(renderFieldRule(rule)).rule, where).toEqual(rule);
    }
    expect(parsed).toBeGreaterThanOrEqual(100);
    // Informational: text the engine ignores (a migration must decide what to do with it).
    // Keep the count visible; it is reported by spec:lint.
    expect(residuals.length).toBeLessThan(FIELDS.length);
  });

  it("arrays are read like the engine (joined with '; ')", () => {
    expect(parseFieldRule(["multivalued", "filtered by Unit selected"]).rule).toEqual({ multi: true, filteredBy: "Unit" });
  });

  it("builders compose and render canonically (enum last)", () => {
    const r = filteredBy("Business Unit", multivalued(groupedBy("functionName", { enum: ["A", "B"] })));
    expect(renderFieldRule(r)).toBe("Allow multiple values; filtered by Business Unit selected; SelectLabel = functionName; enum: A, B");
    expect(parseFieldRule(renderFieldRule(r)).rule).toEqual(r);
  });
});
