/**
 * View layer — everything a table node carries besides the Model
 * (ADR-0002). Canonical key order is the dominant one in the datamodel
 * (38 of 42 tables):
 *
 *   visibility · dashboard-order · description · attributes · reports ·
 *   form · cards · table-filters · subitem-tables · system-registry
 *
 * `cards`, `reports` and `subitem-tables` are kept as validated data: their
 * prose rules are hand-mapped inside the engine (`queries.js`), so giving
 * them an executable form belongs to the v1 engine, not to this scope.
 */

import type { Json, JsonObject } from "../types.js";
import type { Entity, FieldDisplay } from "../model/types.js";
import { emitAttributes } from "../model/emit.js";
import { emitForm, liftForm, type FormValue } from "./form.js";

export interface TableView {
  visibility?: string;
  dashboardOrder: number;
  reports?: Json;
  form: FormValue;
  cards?: Json;
  tableFilters?: boolean | null;
  subitemTables?: Json;
}

/** A whole table as the spec authors it. */
export interface TableSpec {
  entity: Entity;
  view: TableView;
  /** Per-field column visibility, keyed by field name. */
  display: Record<string, FieldDisplay>;
}

/** From the View-layer leftovers `liftTable` hands back (everything but the Model keys). */
export function liftTableView(view: JsonObject): TableView {
  const out: TableView = {
    dashboardOrder: Number(view["dashboard-order"]),
    form: liftForm((view["form"] ?? null) as Json),
  };
  if ("visibility" in view) out.visibility = String(view["visibility"]);
  if ("reports" in view) out.reports = view["reports"] as Json;
  if ("cards" in view) out.cards = view["cards"] as Json;
  if ("table-filters" in view) out.tableFilters = view["table-filters"] as boolean | null;
  if ("subitem-tables" in view) out.subitemTables = view["subitem-tables"] as Json;
  const known = new Set(["visibility", "dashboard-order", "reports", "form", "cards", "table-filters", "subitem-tables"]);
  for (const k of Object.keys(view)) if (!known.has(k)) throw new Error(`unknown table key ${JSON.stringify(k)}`);
  return out;
}

/** The full table node, canonical key order. */
export function emitTable({ entity, view, display }: TableSpec): JsonObject {
  const out: JsonObject = {};
  if (view.visibility !== undefined) out["visibility"] = view.visibility;
  out["dashboard-order"] = view.dashboardOrder;
  out["description"] = entity.description;
  out["attributes"] = emitAttributes(entity, display);
  if (view.reports !== undefined) out["reports"] = view.reports;
  out["form"] = emitForm(view.form);
  if (view.cards !== undefined) out["cards"] = view.cards;
  if (view.tableFilters !== undefined) out["table-filters"] = view.tableFilters;
  if (view.subitemTables !== undefined) out["subitem-tables"] = view.subitemTables;
  if (entity.systemRegistry !== undefined) out["system-registry"] = entity.systemRegistry;
  return out;
}
