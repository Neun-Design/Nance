/**
 * lift — decode the hand-written JSON into Model-layer values.
 *
 * Used by `spec:lint` (inventory the migration debt), by the tests (the
 * lift → emit round trip over the real datamodel), and by each Phase 3 slice
 * as the starting point for authoring a module in TypeScript.
 *
 * A table node mixes Model keys (`attributes`, `description`,
 * `system-registry`) with View keys (`form`, `cards`, `reports`,
 * `table-filters`, `subitem-tables`, `dashboard-order`, `visibility`). Lift
 * returns the Model part as an `Entity` and hands the View part back verbatim
 * so nothing is lost before P2-B gives it a typed home.
 */

import type { JsonObject } from "../types.js";
import { relationFromRule } from "./relation.js";
import {
  CONSTRAINTS,
  ENGINE_TYPES,
  type Constraint,
  type EngineType,
  type Entity,
  type Field,
  type FieldDisplay,
} from "./types.js";

/** Table-level keys that belong to the Model layer. */
export const MODEL_TABLE_KEYS = new Set(["attributes", "description", "system-registry"]);

/** Attribute-level keys that belong to the View overlay. */
const DISPLAY_KEYS = new Set(["table-display", "subitem-display"]);

export function parseConstraints(raw: unknown): Constraint[] {
  if (raw == null || raw === "") return [];
  const tokens = String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const t of tokens) {
    if (!(CONSTRAINTS as readonly string[]).includes(t)) {
      throw new Error(`Unknown constraint token ${JSON.stringify(t)} in ${JSON.stringify(raw)}`);
    }
  }
  return tokens as Constraint[];
}

export interface LiftedAttribute {
  field: Field;
  display: FieldDisplay;
}

export function liftAttribute(a: JsonObject, where = "?"): LiftedAttribute {
  const name = String(a["name"]);
  const type = a["type"] as string;
  if (!(ENGINE_TYPES as readonly string[]).includes(type)) {
    throw new Error(`${where}.${name}: unknown type ${JSON.stringify(type)}`);
  }
  const notes = a["notes"];
  const field: Field = {
    name,
    type: type as EngineType,
    notes: notes == null ? null : Array.isArray(notes) ? notes.map(String) : String(notes),
    constraints: parseConstraints(a["constraints"]),
  };
  const relation = relationFromRule(a["rule"]);
  if (relation) field.relation = relation;
  if (a["display-name"] != null) field.displayName = String(a["display-name"]);
  if (a["gap-tag"] != null) field.gapTag = Boolean(a["gap-tag"]);

  for (const k of Object.keys(a)) {
    if (!KNOWN_ATTR_KEYS.has(k)) throw new Error(`${where}.${name}: unknown attribute key ${JSON.stringify(k)}`);
  }
  return {
    field,
    display: {
      tableDisplay: Boolean(a["table-display"]),
      subitemDisplay: Boolean(a["subitem-display"]),
    },
  };
}

const KNOWN_ATTR_KEYS = new Set([
  "name",
  "type",
  "rule",
  "notes",
  "constraints",
  "display-name",
  "gap-tag",
  ...DISPLAY_KEYS,
]);

export interface LiftedTable {
  entity: Entity;
  /** Per-field column visibility, keyed by field name. */
  display: Record<string, FieldDisplay>;
  /** The View-layer keys of the table node, untouched (P2-B). */
  view: JsonObject;
}

export function liftTable(name: string, t: JsonObject): LiftedTable {
  const attrs = t["attributes"];
  if (!Array.isArray(attrs)) throw new Error(`${name}: attributes must be a list`);
  const fields: Field[] = [];
  const display: Record<string, FieldDisplay> = {};
  for (const a of attrs) {
    const lifted = liftAttribute(a as JsonObject, name);
    fields.push(lifted.field);
    display[lifted.field.name] = lifted.display;
  }
  const entity: Entity = { name, description: String(t["description"] ?? ""), fields };
  if ("system-registry" in t) entity.systemRegistry = t["system-registry"];

  const view: JsonObject = {};
  for (const [k, v] of Object.entries(t)) if (!MODEL_TABLE_KEYS.has(k)) view[k] = v;
  return { entity, display, view };
}

/** Lift every table of every module of a datamodel artifact. */
export function liftAll(modules: JsonObject): Map<string, LiftedTable[]> {
  const out = new Map<string, LiftedTable[]>();
  for (const [moduleName, m] of Object.entries(modules)) {
    const tables = (m as JsonObject)["tables"] as JsonObject;
    out.set(
      moduleName,
      Object.entries(tables).map(([tn, t]) => liftTable(tn, t as JsonObject)),
    );
  }
  return out;
}
