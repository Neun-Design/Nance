/**
 * Behavior layer — `field-rule`: option filters and input modifiers on a form
 * field (ADR-0002).
 *
 * In the engine (`prototype/js/forms.js`) a field-rule is free text (or a list
 * joined with "; ") that several independent regexes *search*. Each regex is a
 * clause; order does not matter to the engine, and anything the regexes do
 * not match is ignored. We model the clauses as a structured object, render
 * them in one canonical order, and report ignored text (`residual`) so a
 * migration never drops meaning silently.
 */

import { parseRule } from "../model/relation.js";

export interface FieldRule {
  /** "filtered by <X> selected" — X is a field label or attribute name. */
  filteredBy?: string;
  /** "Allow multiple values" / "multivalued". */
  multi?: boolean;
  /** "SelectLabel = <field>" — optgroups by that field (dotted → last segment at use). */
  groupBy?: string;
  /** "enum: A, B" — inline option override (delegated to parseRule by the engine). */
  enum?: string[];
  /** "disabled". */
  disabled?: boolean;
  /** "WHERE <field> >= current month". */
  whereCurrentMonth?: string;
  /** "only Active". */
  onlyActive?: boolean;
  /** "specs of <X>". */
  specsOf?: string;
  /** "default: Yes|No" — boolean select preselection on new records. */
  default?: "Yes" | "No";
  /**
   * Text the engine ignores (no clause regex matches it), kept verbatim so
   * authored intent survives the round trip — e.g. "jobs of the same ticket".
   * Reported by `spec:lint`; a migration may move it to `tooltip`.
   */
  note?: string;
  /**
   * The JSON carries this rule as a list of clauses (20 of 127 do). The
   * engine joins lists with "; ", so the shape is cosmetic — but tests and
   * authors rely on it, so it is preserved: `emitFieldRule` writes one clause
   * per element.
   */
  list?: true;
}

// The engine's regexes, verbatim.
const RX = {
  disabled: /(^|;)\s*disabled\s*(;|$)/i,
  groupBy: /SelectLabel\s*={1,2}\s*([A-Za-z.]+)/,
  whereCurrentMonth: /WHERE\s+([A-Za-z_.]+)\s*>=\s*current month/i,
  multi: /allow multiple|multivalued/i,
  enum: /enum:\s*(.+)$/i,
  filteredBy: /filtered by (?:the )?([A-Za-z .+&,]+?)(?: selected| field|$)/i,
  onlyActive: /only active/i,
  specsOf: /specs of (?:the )?([A-Za-z ]+?)(?: selected| field|$)/i,
  default: /default:\s*(yes|true|no|false)\b/i,
};

export interface ParsedFieldRule {
  rule: FieldRule | null;
  /** Segments of the text no engine regex consumed — meaning the engine ignores. */
  residual: string[];
}

/** Normalize the raw value the way the engine does (arrays are joined with "; "). */
export function fieldRuleText(raw: unknown): string {
  if (raw == null) return "";
  return Array.isArray(raw) ? raw.map(String).join("; ") : String(raw);
}

export function parseFieldRule(raw: unknown): ParsedFieldRule {
  const txt = fieldRuleText(raw).trim();
  if (!txt) return { rule: null, residual: [] };
  const r: FieldRule = {};
  if (Array.isArray(raw)) r.list = true;
  let m: RegExpMatchArray | null;

  if (RX.disabled.test(txt)) r.disabled = true;
  if ((m = txt.match(RX.groupBy))) r.groupBy = m[1]!;
  if ((m = txt.match(RX.whereCurrentMonth))) r.whereCurrentMonth = m[1]!;
  if (RX.multi.test(txt)) r.multi = true;
  if ((m = txt.match(RX.enum))) {
    const parsed = parseRule(`enum: ${m[1]!}`);
    if (parsed && parsed.kind === "enum") r.enum = parsed.values;
  }
  if ((m = txt.match(RX.filteredBy))) r.filteredBy = m[1]!.trim();
  if (RX.onlyActive.test(txt)) r.onlyActive = true;
  if ((m = txt.match(RX.specsOf))) r.specsOf = m[1]!.trim();
  if ((m = txt.match(RX.default))) r.default = /^(yes|true)$/i.test(m[1]!) ? "Yes" : "No";

  // Residual: split on ";" and keep the segments no clause regex matches.
  const residual = txt
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((seg) => !Object.values(RX).some((rx) => rx.test(seg)));

  if (residual.length) r.note = residual.join("; ");
  return { rule: Object.keys(r).length ? r : null, residual };
}

/**
 * Canonical clauses. Order follows the authored convention in the datamodel
 * (modifiers first, then "filtered by"); `note` before `enum`, whose regex
 * runs to the end of the line.
 */
export function fieldRuleClauses(r: FieldRule): string[] {
  const parts: string[] = [];
  if (r.disabled) parts.push("disabled");
  if (r.multi) parts.push("Allow multiple values");
  if (r.groupBy) parts.push(`SelectLabel = ${r.groupBy}`);
  if (r.whereCurrentMonth) parts.push(`WHERE ${r.whereCurrentMonth} >= current month`);
  if (r.onlyActive) parts.push("only Active");
  if (r.specsOf) parts.push(`specs of ${r.specsOf} selected`);
  if (r.default) parts.push(`default: ${r.default}`);
  if (r.filteredBy) parts.push(`filtered by ${r.filteredBy} selected`);
  if (r.note) parts.push(r.note);
  if (r.enum) parts.push(`enum: ${r.enum.join(", ")}`);
  return parts;
}

/** Canonical text, one clause per "; ". */
export function renderFieldRule(r: FieldRule): string {
  return fieldRuleClauses(r).join("; ");
}

/** The JSON value: a list of clauses when authored as a list, else the joined text. */
export function emitFieldRule(r: FieldRule): string | string[] {
  return r.list ? fieldRuleClauses(r) : renderFieldRule(r);
}

/** Builders for authoring. */
export const filteredBy = (x: string, extra: FieldRule = {}): FieldRule => ({ filteredBy: x, ...extra });
export const multivalued = (extra: FieldRule = {}): FieldRule => ({ multi: true, ...extra });
export const groupedBy = (field: string, extra: FieldRule = {}): FieldRule => ({ groupBy: field, ...extra });
