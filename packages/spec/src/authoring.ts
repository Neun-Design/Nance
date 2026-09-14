/**
 * Authoring API — the compact vocabulary a module file is written in.
 *
 * Everything here builds the plain Model / View / Behavior values defined in
 * the layer modules; nothing is interpreted at runtime. A module file reads:
 *
 *   export const organization = defineModule("Organization", 1, [
 *     table(
 *       entity("Business Units", "…", [
 *         attr("businessUnitID", "INT", { constraints: ["PK"], show: [false, false] }),
 *         attr("businessSegmentID", "FK", { rel: fk("Business Segments", { display: "businessSegmentCode" }), show: [true, false] }),
 *       ]),
 *       { visibility: "show", dashboardOrder: 3, form: formFor(…), … },
 *     ),
 *   ]);
 */

import type { Json, ModuleName } from "./types.js";
import type { Constraint, EngineType, Entity, Field, FieldDisplay } from "./model/types.js";
import type {
  ConcatPart,
  EnumRelation,
  FkRelation,
  LinkRelation,
  Relation,
  RuleFilter,
  UserInputRelation,
} from "./model/relation.js";
import type { TableSpec, TableView } from "./view/table.js";
import type { ModuleSpec } from "./view/module.js";

// ---------- relations (exact parseRule shapes) ----------

export interface FkOpts {
  display?: string | null;
  via?: string | null;
  filter?: RuleFilter | null;
  concat?: ConcatPart[] | null;
}
export const fk = (target: string, o: FkOpts = {}): FkRelation => ({
  kind: "fk",
  target,
  display: o.display ?? null,
  concat: o.concat ?? null,
  via: o.via ?? null,
  filter: o.filter ?? null,
});

export interface LinkOpts {
  via?: string | null;
  viaList?: string[] | null;
  display?: string | null;
  concat?: ConcatPart[] | null;
  filter?: RuleFilter | null;
}
const link = (kind: LinkRelation["kind"], target: string | null, o: LinkOpts): LinkRelation => ({
  kind,
  target,
  via: o.via ?? (o.viaList?.[0] ?? null),
  viaList: o.viaList ?? null,
  display: o.display ?? null,
  concat: o.concat ?? null,
  filter: o.filter ?? null,
});
export const mirror = (target: string, via: string, o: Omit<LinkOpts, "via"> = {}): LinkRelation => link("mirror", target, { ...o, via });
export const rollup = (target: string, via: string | null = null, o: Omit<LinkOpts, "via"> = {}): LinkRelation => link("rollup", target, { ...o, via });
export const computed = (target: string | null, o: LinkOpts = {}): LinkRelation => link("computed", target, o);
/**
 * `computed: CONCAT(a,'-',b)` — parts are field names or `{ lit }`.
 * The engine's parseRule reads the canonical text back with target "CONCAT"
 * (an artifact of its target regex), so the builder produces exactly that.
 */
export const concat = (...parts: (string | { lit: string })[]): LinkRelation =>
  link("computed", "CONCAT", { concat: parts.map((p) => (typeof p === "string" ? { field: p } : p)) });
export const enumOf = (...values: string[]): EnumRelation => ({ kind: "enum", values });
export const userInput = (): UserInputRelation => ({ kind: "userInput" });

// ---------- fields / entities ----------

export interface AttrOpts {
  rel?: Relation;
  notes?: string | string[] | null;
  constraints?: Constraint[];
  displayName?: string;
  gapTag?: boolean;
  /** [table-display, subitem-display]; default [true, false]. */
  show?: [boolean, boolean];
}

export interface Attr {
  field: Field;
  display: FieldDisplay;
}

export function attr(name: string, type: EngineType, o: AttrOpts = {}): Attr {
  const field: Field = { name, type, notes: o.notes ?? null, constraints: o.constraints ?? [] };
  if (o.rel) field.relation = o.rel;
  if (o.displayName !== undefined) field.displayName = o.displayName;
  if (o.gapTag !== undefined) field.gapTag = o.gapTag;
  const [tableDisplay, subitemDisplay] = o.show ?? [true, false];
  return { field, display: { tableDisplay, subitemDisplay } };
}

export interface EntityDef {
  entity: Entity;
  display: Record<string, FieldDisplay>;
}

export function entity(name: string, description: string, attrs: Attr[], o: { systemRegistry?: Json } = {}): EntityDef {
  const e: Entity = { name, description, fields: attrs.map((a) => a.field) };
  if (o.systemRegistry !== undefined) e.systemRegistry = o.systemRegistry;
  return { entity: e, display: Object.fromEntries(attrs.map((a) => [a.field.name, a.display])) };
}

// ---------- tables / modules ----------

export const table = (def: EntityDef, view: TableView): TableSpec => ({ entity: def.entity, display: def.display, view });

export interface ModuleOpts {
  /**
   * Model errors carried over from the hand-written JSON on purpose, each
   * tied to the issue that will fix it. `spec:build` fails on any error not
   * listed here. Format: "<Entity>.<field>" or "<Entity>".
   */
  suppress?: Record<string, string>;
}

export interface AuthoredModule extends ModuleSpec {
  suppress: Record<string, string>;
}

export function defineModule(name: ModuleName, sidebarPosition: number, tables: TableSpec[], o: ModuleOpts = {}): AuthoredModule {
  return { name, sidebarPosition, tables, suppress: o.suppress ?? {} };
}
