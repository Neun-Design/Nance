import { describe, expect, it } from "vitest";
import { compile, loadPassthrough, serialize } from "../src/index.js";
import type { Json, JsonObject, MigratedModules, ModuleName } from "../src/index.js";
import { liftTable } from "../src/model/lift.js";
import { diffPaths } from "../src/semantic.js";
import { defaultWidgetFor, emitWidget, parseWidget } from "../src/view/widget.js";
import { formFor, liftForm } from "../src/view/form.js";
import { emitTable, liftTableView } from "../src/view/table.js";
import { emitModule, liftModule } from "../src/view/module.js";
import { isKnownMalformedPath } from "./known-malformed.js";

/** Attribute name at index i of a table — to map diff paths back to the allowlist. */
const attrNameAt = (module: string, table: string, i: number): string | undefined => {
  const t = ((loadPassthrough().modules as JsonObject)[module] as JsonObject | undefined)?.["tables"] as JsonObject | undefined;
  const attrs = (t?.[table] as JsonObject | undefined)?.["attributes"] as JsonObject[] | undefined;
  return attrs?.[i]?.["name"] as string | undefined;
};
const notKnownMalformed = (paths: string[]) => paths.filter((p) => !isKnownMalformedPath(p, attrNameAt));

const ART = loadPassthrough();
const MODULES = ART.modules as JsonObject;
const MODULE_NAMES = Object.keys(MODULES) as ModuleName[];

describe("widget — field-type as the engine reads it", () => {
  it("law over every authored field-type: same lowercased key after emit", () => {
    let n = 0;
    const walk = (fields: JsonObject | undefined, where: string) => {
      for (const [label, f] of Object.entries(fields ?? {})) {
        const ft = (f as JsonObject)["field-type"];
        if (ft === undefined) continue;
        n++;
        const w = parseWidget(ft);
        expect(parseWidget(emitWidget(w)).key, `${where}.${label}`).toBe(w.key);
      }
    };
    for (const [mn, m] of Object.entries(MODULES)) {
      for (const [tn, t] of Object.entries((m as JsonObject)["tables"] as JsonObject)) {
        const table = t as JsonObject;
        const form = table["form"];
        if (form && typeof form === "object") walk((form as JsonObject)["fields"] as JsonObject, `${mn}/${tn}.form`);
        const reports = table["reports"];
        if (reports && typeof reports === "object" && !Array.isArray(reports)) {
          for (const [rn, r] of Object.entries(reports as JsonObject)) {
            walk(((r as JsonObject | null)?.["filters"] as JsonObject | undefined)?.["fields"] as JsonObject, `${mn}/${tn}.reports.${rn}`);
          }
        }
      }
    }
    expect(n).toBeGreaterThan(241);
  });

  it("casing drift is the same widget", () => {
    expect(parseWidget({ Select: "shadcn-select" }).key).toBe("select");
    expect(parseWidget({ Input: "shadcn-Input" })).toEqual({ key: "input", hint: "shadcn-Input" });
    expect(parseWidget(null)).toEqual({ key: "input", hint: null });
  });
});

describe("whole-table and whole-module equivalence — the proof Phase 3 can start", () => {
  it("emitTable(liftTable) is the same table to the engine, for all 42 tables", () => {
    let n = 0;
    for (const [mn, m] of Object.entries(MODULES)) {
      for (const [tn, t] of Object.entries((m as JsonObject)["tables"] as JsonObject)) {
        n++;
        const { entity, display, view } = liftTable(tn, t as JsonObject);
        const emitted = emitTable({ entity, display, view: liftTableView(view) }) as Json;
        const out: string[] = [];
        diffPaths(t as Json, emitted, `${mn}/${tn}`, out, 10);
        expect(notKnownMalformed(out), `${mn}/${tn}`).toEqual([]);
      }
    }
    expect(n).toBe(42);
  });

  it("emitModule(liftModule) ≡ the hand-written module, for all 7 modules", () => {
    for (const name of MODULE_NAMES) {
      const emitted = emitModule(liftModule(name, MODULES[name] as JsonObject)) as Json;
      const out: string[] = [];
      diffPaths(MODULES[name] as Json, emitted, `${name}/`, out, 10);
      // module-level paths look like "Workspace/.tables.Jobs.attributes[9].rule" — normalize for the allowlist
      expect(notKnownMalformed(out.map((p) => p.replace(/^([^/]+)\/\.tables\./, "$1/"))), name).toEqual([]);
    }
  });

  it("compile() with every module migrated ≡ the passthrough artifact (semantically)", () => {
    const migrated: MigratedModules = {};
    for (const name of MODULE_NAMES) migrated[name] = emitModule(liftModule(name, MODULES[name] as JsonObject));
    const all = compile(ART, migrated);
    const out: string[] = [];
    diffPaths(ART as unknown as Json, all as unknown as Json, "$", out, 20);
    const residual = out.filter((p) => !isKnownMalformedPath(p.replace(/^\$\.modules\.([^.]+)\.tables\./, "$1/"), attrNameAt));
    expect(residual).toEqual([]);
    // and it still serializes to a valid, complete artifact
    expect(Object.keys(JSON.parse(serialize(all)).modules)).toEqual(MODULE_NAMES);
  });
});

describe("formFor — derive, don't repeat", () => {
  it("derives the authored widget for most fields (coverage measured on the data)", () => {
    let total = 0;
    let derived = 0;
    for (const m of Object.values(MODULES)) {
      for (const [tn, t] of Object.entries((m as JsonObject)["tables"] as JsonObject)) {
        const { entity } = liftTable(tn, t as JsonObject);
        const form = liftForm(((t as JsonObject)["form"] ?? null) as Json);
        if (!form || typeof form !== "object") continue;
        const byName = new Map(entity.fields.map((f) => [f.name, f]));
        for (const f of Object.values(form.fields)) {
          const field = f.attribute ? byName.get(f.attribute) : undefined;
          if (!field) continue;
          total++;
          if (defaultWidgetFor(field).key === f.widget.key) derived++;
        }
      }
    }
    const coverage = derived / total;
    expect(total).toBeGreaterThan(200);
    expect(coverage).toBeGreaterThan(0.7); // the rest are the exceptions a form declares
  });

  it("a form declares only exceptions; references are checked at build time", () => {
    const { entity } = liftTable("Business Units", ((MODULES["Organization"] as JsonObject)["tables"] as JsonObject)["Business Units"] as JsonObject);
    const form = formFor(entity, {
      fields: {
        Segment: { attribute: "businessSegmentID" }, // FK → select, derived
        Name: { attribute: "businessUnitName", tooltip: "Short name" }, // VARCHAR → input, derived
        Code: { attribute: "businessUnitCode", widget: "readonly" }, // exception
      },
    });
    expect(form.fields["Segment"]!.widget.key).toBe("select");
    expect(form.fields["Name"]!.widget.key).toBe("input");
    expect(form.fields["Code"]!.widget.key).toBe("readonly");
    expect(() => formFor(entity, { fields: { X: { attribute: "nope" } } })).toThrow(/not a field of Business Units/);
    expect(() => formFor(entity, { steps: { A: { order: 1, description: null } }, fields: { X: { attribute: "businessUnitName", step: "B" } } })).toThrow(/unknown step "B"/);
  });
});
