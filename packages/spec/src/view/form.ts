/**
 * View layer — forms (ADR-0002): "a form is the Model's fields, minus these,
 * in these steps, with these overrides — not N full specs".
 *
 * JSON shape the engine reads (`forms.js`, spec-driven form builder):
 *   form: { steps: { <Step>: { "step-order", "step-description" } } | null,
 *           fields: { <Label>: { "field-type", attribute, tooltip, step, check, "field-rule" } },
 *           "subitem-tables"?: … }          — or true / false / null (3 tables)
 * Report filters reuse the field shape, keyed by attribute name, plus `default`.
 */

import type { Json, JsonObject } from "../types.js";
import type { Entity } from "../model/types.js";
import { parseCheck, renderCheck, type Check } from "../behavior/check.js";
import { emitFieldRule, parseFieldRule, type FieldRule } from "../behavior/fieldRule.js";
import { defaultWidgetFor, emitWidget, parseWidget, widget as mkWidget, type Widget } from "./widget.js";

export interface FormField {
  /** Bound Model field; absent on report-filter fields (keyed by attribute). */
  attribute?: string;
  widget: Widget;
  tooltip: string | null;
  step: string | null;
  check: Check | null;
  rule: FieldRule | null;
  /** Report filters only. */
  default?: Json;
}

export interface FormStep {
  order: number;
  description: string | null;
}

export interface FormSpec {
  steps: Record<string, FormStep> | null;
  fields: Record<string, FormField>;
  /** A few forms carry their own subitem-tables block; passed through. */
  subitemTables?: Json;
}

/** `form` as found in the JSON: a spec, a boolean, or null. */
export type FormValue = FormSpec | boolean | null;

// ---------- lift ----------

export function liftFormField(f: JsonObject, opts: { report?: boolean } = {}): FormField {
  const out: FormField = {
    widget: parseWidget(f["field-type"]),
    tooltip: f["tooltip"] == null ? null : String(f["tooltip"]),
    step: f["step"] == null ? null : String(f["step"]),
    check: parseCheck(f["check"]),
    rule: parseFieldRule(f["field-rule"]).rule,
  };
  if (f["attribute"] != null) out.attribute = String(f["attribute"]);
  if (opts.report || "default" in f) out.default = (f["default"] ?? null) as Json;
  return out;
}

export function liftForm(v: Json): FormValue {
  if (v === null || typeof v === "boolean") return v;
  const o = v as JsonObject;
  const stepsJson = o["steps"] as JsonObject | null;
  const steps: Record<string, FormStep> | null = stepsJson
    ? Object.fromEntries(
        Object.entries(stepsJson).map(([name, s]) => [
          name,
          { order: Number((s as JsonObject)["step-order"]), description: ((s as JsonObject)["step-description"] ?? null) as string | null },
        ]),
      )
    : null;
  const fields = Object.fromEntries(
    Object.entries((o["fields"] as JsonObject) ?? {}).map(([label, f]) => [label, liftFormField(f as JsonObject)]),
  );
  const spec: FormSpec = { steps, fields };
  if ("subitem-tables" in o) spec.subitemTables = o["subitem-tables"] as Json;
  return spec;
}

// ---------- emit ----------

export function emitFormField(f: FormField, opts: { report?: boolean } = {}): JsonObject {
  const out: JsonObject = { "field-type": emitWidget(f.widget) };
  if (!opts.report && f.attribute !== undefined) out["attribute"] = f.attribute;
  out["tooltip"] = f.tooltip;
  if (opts.report) out["default"] = f.default ?? null;
  else out["step"] = f.step;
  out["check"] = f.check ? renderCheck(f.check) : null;
  out["field-rule"] = f.rule ? emitFieldRule(f.rule) : null;
  return out;
}

export function emitForm(v: FormValue): Json {
  if (v === null || typeof v === "boolean") return v;
  const out: JsonObject = {
    steps: v.steps
      ? Object.fromEntries(
          Object.entries(v.steps).map(([name, s]) => [name, { "step-order": s.order, "step-description": s.description }]),
        )
      : null,
    fields: Object.fromEntries(Object.entries(v.fields).map(([label, f]) => [label, emitFormField(f)])),
  };
  if (v.subitemTables !== undefined) out["subitem-tables"] = v.subitemTables;
  return out;
}

// ---------- authoring: derive, don't repeat ----------

export interface FormFieldDecl {
  attribute: string;
  /** Override the derived control (key or full widget). */
  widget?: Widget | string;
  tooltip?: string | null;
  step?: string | null;
  check?: Check | null;
  rule?: FieldRule | null;
}

export interface FormDecl {
  steps?: Record<string, FormStep> | null;
  fields: Record<string, FormFieldDecl>;
  subitemTables?: Json;
}

/**
 * Build a form from the Model: every declared field binds to an attribute of
 * `entity` (checked at build time), gets its control derived from the Model
 * unless overridden, and carries only the exceptions the form states.
 */
export function formFor(entity: Entity, decl: FormDecl): FormSpec {
  const byName = new Map(entity.fields.map((f) => [f.name, f]));
  const fields: Record<string, FormField> = {};
  for (const [label, d] of Object.entries(decl.fields)) {
    const field = byName.get(d.attribute);
    if (!field) throw new Error(`${entity.name} form "${label}": attribute "${d.attribute}" is not a field of ${entity.name}`);
    if (d.step && decl.steps && !(d.step in decl.steps)) throw new Error(`${entity.name} form "${label}": unknown step "${d.step}"`);
    fields[label] = {
      attribute: d.attribute,
      widget: d.widget === undefined ? defaultWidgetFor(field) : typeof d.widget === "string" ? mkWidget(d.widget) : d.widget,
      tooltip: d.tooltip ?? null,
      step: d.step ?? null,
      check: d.check ?? null,
      rule: d.rule ?? null,
    };
  }
  const spec: FormSpec = { steps: decl.steps ?? null, fields };
  if (decl.subitemTables !== undefined) spec.subitemTables = decl.subitemTables;
  return spec;
}
