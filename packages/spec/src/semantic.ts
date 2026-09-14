/**
 * Semantic comparison of two datamodel artifacts — "same to the engine".
 *
 * Structural JSON equality is too strict for the migration: a module authored
 * in the spec renders canonical spellings, while the hand-written JSON drifted.
 * Where the engine parses a value before using it, two values are equal when
 * they parse the same:
 *   attribute `rule`      → parseRule           (model.js)
 *   form `check`          → parseCheck          (forms.js grammar)
 *   form `field-rule`     → parseFieldRule      (forms.js grammar)
 *   form `field-type`     → first key, lowercased (forms.js firstTypeKey)
 *   subitem-tables entry  → normalizeSubitem    (model.js)
 * When neither side parses (plain prose the engine ignores), fall back to
 * string equality so unrelated text is never called equal.
 *
 * Shared by `spec:diff` and the tests.
 */

import { normalizeSubitem } from "../../../prototype/js/model.js";
import type { Json } from "./types.js";
import { parseRule } from "./model/relation.js";
import { parseCheck } from "./behavior/check.js";
import { parseFieldRule } from "./behavior/fieldRule.js";
import { parseWidget } from "./view/widget.js";

const isObject = (v: Json): v is { [k: string]: Json } =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function eqByParse<T>(a: Json, b: Json, parse: (v: Json) => T | null): boolean {
  const pa = parse(a);
  const pb = parse(b);
  if (pa == null && pb == null) return JSON.stringify(a) === JSON.stringify(b);
  return JSON.stringify(pa) === JSON.stringify(pb);
}

const SUBITEM_ENTRY = /subitem-tables\[\d+\]$/;

/**
 * Returns true when `a` and `b` are the same to the engine at `path`, or
 * undefined when no semantic rule applies (caller falls back to structure).
 */
export function semanticLeaf(a: Json, b: Json, path: string): boolean | undefined {
  if (path.endsWith(".rule") && typeof a === "string" && typeof b === "string") {
    return eqByParse(a, b, (v) => parseRule(v));
  }
  if (path.endsWith(".check") && typeof a === "string" && typeof b === "string") {
    return eqByParse(a, b, (v) => parseCheck(v));
  }
  if (path.endsWith(".field-rule") && a != null && b != null) {
    return eqByParse(a, b, (v) => parseFieldRule(v).rule);
  }
  if (path.endsWith(".field-type") && isObject(a) && isObject(b)) {
    return parseWidget(a).key === parseWidget(b).key;
  }
  if (SUBITEM_ENTRY.test(path) && a != null && b != null) {
    const norm = (v: Json) => normalizeSubitem(v as never) as unknown as Json;
    return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
  }
  return undefined;
}

/** Collect the JSON paths where `a` and `b` differ semantically (up to `max`). */
export function diffPaths(a: Json, b: Json, path: string, out: string[], max = Infinity): void {
  if (out.length >= max) return;
  const sem = semanticLeaf(a, b, path);
  if (sem !== undefined) {
    if (!sem) out.push(path);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      out.push(`${path} (array length ${a.length} → ${b.length})`);
      return;
    }
    a.forEach((v, i) => diffPaths(v, b[i] as Json, `${path}[${i}]`, out, max));
    return;
  }
  if (isObject(a) && isObject(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in a)) out.push(`${path}.${k} (added)`);
      else if (!(k in b)) out.push(`${path}.${k} (removed)`);
      else diffPaths(a[k] as Json, b[k] as Json, `${path}.${k}`, out, max);
      if (out.length >= max) return;
    }
    return;
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) out.push(path);
}

export function semanticEqual(a: Json, b: Json, path = "$"): boolean {
  const out: string[] = [];
  diffPaths(a, b, path, out, 1);
  return out.length === 0;
}
