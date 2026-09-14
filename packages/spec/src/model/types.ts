/**
 * Model layer types (ADR-0002): the data shape, independent of screens.
 *
 * Grounded in the current datamodel: every one of the 498 attributes carries
 * the same seven keys (`name type rule notes table-display subitem-display
 * constraints`); a handful add `display-name` / `gap-tag`. Of those,
 * `table-display` and `subitem-display` are *View* concerns (column
 * visibility) and are supplied as an overlay when emitting — see `emit.ts`.
 */

import type { Relation } from "./relation.js";
import type { Json } from "../types.js";

/** Storage / display types observed in the datamodel. */
export const STORAGE_TYPES = [
  "INT",
  "VARCHAR",
  "TEXT",
  "DECIMAL",
  "DATETIME",
  "DATE",
  "BOOLEAN",
  "ENUM",
  "LINK",
  "email",
  "JSON",
] as const;
export type StorageType = (typeof STORAGE_TYPES)[number];

/** Relation "types" the datamodel also writes into `type`. */
export const RELATION_TYPES = ["FK", "mirror", "rollup", "computed"] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

/** What `attr.type` may hold. The engine only dispatches on `ENUM`. */
export type EngineType = StorageType | RelationType;
export const ENGINE_TYPES: readonly EngineType[] = [...STORAGE_TYPES, ...RELATION_TYPES];

/** Constraint tokens; serialized as a comma-separated string (`"FK, NOT NULL"`). */
export const CONSTRAINTS = ["PK", "FK", "NOT NULL", "multivalued", "rollup"] as const;
export type Constraint = (typeof CONSTRAINTS)[number];

export interface Field {
  name: string;
  type: EngineType;
  /** Structured relation; undefined = plain stored field (`rule: null`). */
  relation?: Relation;
  /** Free text; a few attributes carry a list of notes. */
  notes: string | string[] | null;
  constraints: Constraint[];
  /** Rare: a label that differs from `name`. */
  displayName?: string;
  /** Rare: flag — an empty rollup renders the GAP caution tag. */
  gapTag?: boolean;
}

/** Column visibility — View-layer overlay carried per field when emitting. */
export interface FieldDisplay {
  tableDisplay: boolean;
  subitemDisplay: boolean;
}

export interface Entity {
  /** The table name as the engine and the JSON know it (e.g. "Business Units"). */
  name: string;
  description: string;
  fields: Field[];
  /** Rare table-level flag (Countries). Passed through verbatim. */
  systemRegistry?: Json;
}

/** Everything the Model layer knows about one module. */
export interface ModelModule {
  name: string;
  entities: Entity[];
}
