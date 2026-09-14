/**
 * Form-level findings (View + Behavior), reported by `spec:lint` next to the
 * Model invariants. Resolution mirrors the engine's `findDep`: a dependency
 * names a field label (exact or substring, case-insensitive) or the bound
 * attribute.
 */

import type { Finding } from "../model/invariants.js";
import type { TableSpec } from "./table.js";
import type { FormSpec } from "./form.js";

/** Control keys the engine dispatches on (forms.js); anything else renders as a plain input. */
export const KNOWN_WIDGETS = new Set([
  "select", "selectgroups", "combobox", "comboboxgroups", "radio",
  "dynamic-specs", "certified-responsible", "readonly", "switch",
  "datetime", "date", "date picker", "month", "field", "input", "textarea",
  "range-picker", "basic",
]);

function resolves(name: string, form: FormSpec): boolean {
  const n = name.trim().toLowerCase();
  for (const [label, f] of Object.entries(form.fields)) {
    const l = label.toLowerCase();
    if (l === n || l.includes(n) || n.includes(l)) return true;
    if (f.attribute && f.attribute.toLowerCase() === n) return true;
  }
  return false;
}

export function lintForms(moduleName: string, tables: TableSpec[]): Finding[] {
  const out: Finding[] = [];
  for (const t of tables) {
    const form = t.view.form;
    if (!form || typeof form !== "object") continue;
    const at = (field: string) => ({ module: moduleName, entity: t.entity.name, field });
    for (const [label, f] of Object.entries(form.fields)) {
      if (!KNOWN_WIDGETS.has(f.widget.key)) {
        out.push({ severity: "warn", ...at(`form.${label}`), message: `widget "${f.widget.key}" is not a control the engine knows (renders as input)` });
      }
      if (f.check) {
        const deps = f.check.kind === "notNull" ? f.check.deps : [f.check.dep];
        for (const d of deps) if (!resolves(d, form)) out.push({ severity: "error", ...at(`form.${label}`), message: `check depends on "${d}", which is neither a field label nor an attribute of this form` });
      }
      if (f.rule?.filteredBy && !resolves(f.rule.filteredBy, form)) {
        out.push({ severity: "error", ...at(`form.${label}`), message: `field-rule "filtered by ${f.rule.filteredBy}" names no field of this form` });
      }
      if (f.rule?.note) {
        out.push({ severity: "warn", ...at(`form.${label}`), message: `field-rule text the engine ignores: "${f.rule.note}"` });
      }
    }
  }
  return out;
}
