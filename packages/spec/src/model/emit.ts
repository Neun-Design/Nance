/**
 * emit — Model values → the attribute JSON the prototype engine reads.
 *
 * Canonical key order (the JSON today is inconsistent about where the rare
 * keys go; the engine reads by key, so order is cosmetic — we pick one):
 *
 *   name · type · rule · display-name? · gap-tag? · notes ·
 *   table-display · subitem-display · constraints
 *
 * `rule` is rendered from the structured relation (`renderRule`), so the
 * output is the canonical spelling — parse-equivalent to whatever drifted
 * spelling the hand-written JSON used.
 */

import type { JsonObject } from "../types.js";
import { renderRule } from "./relation.js";
import type { Entity, Field, FieldDisplay } from "./types.js";

export function emitAttribute(field: Field, display: FieldDisplay): JsonObject {
  const out: JsonObject = {
    name: field.name,
    type: field.type,
    rule: field.relation ? renderRule(field.relation) : null,
  };
  if (field.displayName !== undefined) out["display-name"] = field.displayName;
  if (field.gapTag !== undefined) out["gap-tag"] = field.gapTag;
  out["notes"] = field.notes;
  out["table-display"] = display.tableDisplay;
  out["subitem-display"] = display.subitemDisplay;
  out["constraints"] = field.constraints.length ? field.constraints.join(", ") : null;
  return out;
}

/** The `attributes` list of a table, in field order. */
export function emitAttributes(
  entity: Entity,
  display: Record<string, FieldDisplay>,
): JsonObject[] {
  return entity.fields.map((f) => {
    const d = display[f.name];
    if (!d) throw new Error(`${entity.name}.${f.name}: missing display overlay`);
    return emitAttribute(f, d);
  });
}
