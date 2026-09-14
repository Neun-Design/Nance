/**
 * View layer — the form control of a field (`field-type`).
 *
 * The engine (`forms.js` firstTypeKey) reads ONLY the first key of the
 * `field-type` object, lowercased; the value ("shadcn-select", "html",
 * "custom") is an informational component hint. So two specs are the same
 * widget when their lowercased first keys match — which makes the casing
 * drift in the JSON (`Select`/`select`, `Input`/`input`) harmless to
 * normalize.
 *
 * "Derive, don't repeat": `defaultWidgetFor(field)` picks the control from
 * the Model, so a form only states exceptions.
 */

import type { JsonObject } from "../types.js";
import type { Field } from "../model/types.js";

export interface Widget {
  /** Lowercased control key as the engine dispatches on it. */
  key: string;
  /** Component hint kept verbatim (not read by the engine). */
  hint: string | null;
}

/** Same semantics as the engine's firstTypeKey, plus the hint. */
export function parseWidget(ft: unknown): Widget {
  let obj: unknown = ft;
  if (Array.isArray(obj)) obj = obj.find((x) => x && typeof x === "object") ?? {};
  if (obj && typeof obj === "object") {
    const k = Object.keys(obj as object)[0];
    if (!k) return { key: "input", hint: null };
    const v = (obj as Record<string, unknown>)[k];
    return { key: k.toLowerCase(), hint: v == null ? null : String(v) };
  }
  return { key: "input", hint: null };
}

/** `{ [key]: hint }` — the engine's shape, canonical (lowercased) key. */
export function emitWidget(w: Widget): JsonObject {
  return { [w.key]: w.hint ?? DEFAULT_HINT[w.key] ?? "shadcn-input" };
}

const DEFAULT_HINT: Record<string, string> = {
  select: "shadcn-select",
  selectgroups: "shadcn-select",
  combobox: "shadcn-combobox",
  comboboxgroups: "shadcn-combobox",
  input: "shadcn-input",
  field: "shadcn-input",
  textarea: "shadcn-textarea",
  "date picker": "shadcn-date",
  date: "shadcn-date",
  month: "html",
  datetime: "html",
  switch: "shadcn-switch",
  readonly: "shadcn-input",
  "dynamic-specs": "custom",
};

export const widget = (key: string, hint: string | null = null): Widget => ({
  key: key.toLowerCase(),
  hint: hint ?? DEFAULT_HINT[key.toLowerCase()] ?? null,
});

/**
 * The control a field gets unless the form says otherwise. Chosen to match
 * the dominant choice in the current datamodel for each Model shape.
 */
export function defaultWidgetFor(field: Field): Widget {
  const rel = field.relation?.kind;
  if (rel === "fk" || rel === "enum" || rel === "mirror" || rel === "rollup" || rel === "computed") return widget("select");
  switch (field.type) {
    case "BOOLEAN":
    case "ENUM":
      return widget("select");
    case "DATE":
      return widget("date picker");
    case "DATETIME":
      return widget("datetime");
    case "JSON":
      return widget("dynamic-specs");
    default:
      return widget("input");
  }
}

/** Two widgets are the same to the engine when their keys match. */
export const sameWidget = (a: Widget, b: Widget): boolean => a.key === b.key;
