import { describe, expect, it } from "vitest";
import { KNOWN_MALFORMED } from "./known-malformed.js";
import { loadPassthrough } from "../src/index.js";
import type { JsonObject } from "../src/index.js";
import {
  emitAttribute,
  liftAll,
  liftAttribute,
  parseRule,
  relationFromRule,
  renderRule,
  validateModel,
} from "../src/model/index.js";

/** Every attribute of the current datamodel, with its address. */
function allAttributes(): { where: string; attr: JsonObject }[] {
  const out: { where: string; attr: JsonObject }[] = [];
  const modules = loadPassthrough().modules as JsonObject;
  for (const [mn, m] of Object.entries(modules)) {
    const tables = (m as JsonObject)["tables"] as JsonObject;
    for (const [tn, t] of Object.entries(tables)) {
      for (const a of (t as JsonObject)["attributes"] as JsonObject[]) {
        out.push({ where: `${mn}/${tn}.${a["name"]}`, attr: a });
      }
    }
  }
  return out;
}

const ATTRS = allAttributes();
const omitRule = (o: JsonObject): JsonObject => {
  const { rule: _r, ...rest } = o;
  return rest;
};

describe("Model layer over the real datamodel (498 attributes)", () => {
  it("covers every attribute", () => {
    expect(ATTRS.length).toBe(498);
  });

  it("round-trip law: parseRule(renderRule(parseRule(r))) ≡ parseRule(r), for every well-formed rule", () => {
    const failures: Record<string, string> = {};
    for (const { where, attr } of ATTRS) {
      const original = parseRule(attr["rule"]);
      if (!original) continue; // plain field or "user input" — covered below
      const again = parseRule(renderRule(original));
      if (JSON.stringify(again) !== JSON.stringify(original)) failures[where] = String(attr["rule"]);
    }
    expect(failures).toEqual(KNOWN_MALFORMED);
  });

  it("every known-malformed rule is flagged as an error by the invariants", () => {
    const lifted = liftAll(loadPassthrough().modules as JsonObject);
    const modules = [...lifted].map(([name, tables]) => ({ name, entities: tables.map((t) => t.entity) }));
    const errors = validateModel(modules).filter((f) => f.severity === "error");
    for (const where of Object.keys(KNOWN_MALFORMED)) {
      const [modEntity, field] = where.split(".");
      const [module, entity] = modEntity!.split("/");
      expect(errors.some((f) => f.module === module && f.entity === entity && f.field === field), where).toBe(true);
    }
  });

  it("every rule is representable: parsed by the engine, or exactly 'user input'", () => {
    for (const { where, attr } of ATTRS) {
      expect(() => relationFromRule(attr["rule"]), where).not.toThrow();
    }
    const userInput = ATTRS.filter((x) => relationFromRule(x.attr["rule"])?.kind === "userInput");
    expect(userInput.length).toBe(4);
  });

  it("lift → emit reproduces every attribute (non-rule keys byte-equal, rule parse-equivalent, canonical order)", () => {
    let byteEqual = 0;
    for (const { where, attr } of ATTRS) {
      const { field, display } = liftAttribute(attr, where);
      const emitted = emitAttribute(field, display);
      expect(omitRule(emitted), where).toEqual(omitRule(attr));
      if (!(where in KNOWN_MALFORMED)) {
        expect(JSON.stringify(parseRule(emitted["rule"])), where).toBe(JSON.stringify(parseRule(attr["rule"])));
      }
      if (JSON.stringify(emitted) === JSON.stringify(attr)) byteEqual++;
    }
    // Informational: how many attributes are already in canonical spelling+order.
    expect(byteEqual).toBeGreaterThan(300);
  });

  it("liftAll walks all 7 modules / 42 tables and keeps the View keys aside", () => {
    const lifted = liftAll(loadPassthrough().modules as JsonObject);
    expect([...lifted.keys()]).toEqual(["Organization", "CRM", "Operation", "Portfolio", "Workspace", "Control", "Talent"]);
    const tables = [...lifted.values()].flat();
    expect(tables.length).toBe(42);
    for (const t of tables) {
      expect(t.entity.fields.length).toBeGreaterThan(0);
      expect(Object.keys(t.view)).not.toContain("attributes");
      expect(Object.keys(t.view)).not.toContain("description");
      expect(t.view).toHaveProperty("form");
    }
  });
});
