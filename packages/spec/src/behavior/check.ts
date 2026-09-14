/**
 * Behavior layer — `check`: a cascade gate on a form field (ADR-0002).
 *
 * The engine (`prototype/js/forms.js`, "check conditions") accepts two forms:
 *   "<Label> IS NOT NULL"            presence; "A && B" allowed
 *   "<Label> = Value"                equality; "V1|V2" alternatives
 * Dependencies are resolved by field label or by the bound attribute name.
 * The regexes below are the engine's, verbatim.
 */

export type Check =
  | { kind: "notNull"; deps: string[] }
  | { kind: "equals"; dep: string; values: string[] };

const NOT_NULL = /^(.+?)\s+IS NOT NULL$/i;
const EQUALS = /^(.+?)\s*=\s*'?([^']+?)'?\s*$/;

/** Parse the raw `check` text; null when empty or not a form the engine gates on. */
export function parseCheck(raw: unknown): Check | null {
  if (raw == null) return null;
  const txt = String(raw).trim();
  if (!txt) return null;
  const chk = txt.match(NOT_NULL);
  if (chk) {
    const deps = chk[1]!.split(/\s*&&\s*/).map((s) => s.trim()).filter(Boolean);
    return deps.length ? { kind: "notNull", deps } : null;
  }
  const eq = txt.match(EQUALS);
  if (eq) {
    const dep = eq[1]!.split(/\s*&&\s*/)[0]!.trim();
    const values = eq[2]!.split("|").map((s) => s.trim()).filter(Boolean);
    return dep && values.length ? { kind: "equals", dep, values } : null;
  }
  return null;
}

/** Canonical text — parse-equivalent to any spelling the engine accepts. */
export function renderCheck(c: Check): string {
  return c.kind === "notNull"
    ? `${c.deps.join(" && ")} IS NOT NULL`
    : `${c.dep} = ${c.values.join("|")}`;
}

/** Builders for authoring. */
export const requires = (...deps: string[]): Check => ({ kind: "notNull", deps });
export const requiresValue = (dep: string, ...values: string[]): Check => ({ kind: "equals", dep, values });
