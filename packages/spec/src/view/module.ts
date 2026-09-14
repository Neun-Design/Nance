/**
 * A module authored in the spec, and its emit into the artifact shape
 * `{ "sidebar-position": n, tables: { <Table>: … } }`.
 *
 * `liftModule` decodes a hand-written module into the same TypeScript shape
 * — the starting point of every Phase 3 slice — and `emitModule` is what a
 * migrated module registers in `MIGRATED` (src/index.ts).
 */

import type { JsonObject } from "../types.js";
import type { ModuleArtifact, ModuleName } from "../types.js";
import { liftTable } from "../model/lift.js";
import { emitTable, liftTableView, type TableSpec } from "./table.js";

export interface ModuleSpec {
  name: ModuleName;
  sidebarPosition: number;
  tables: TableSpec[];
}

export function liftModule(name: ModuleName, m: JsonObject): ModuleSpec {
  const tables = Object.entries(m["tables"] as JsonObject).map(([tn, t]) => {
    const { entity, display, view } = liftTable(tn, t as JsonObject);
    return { entity, display, view: liftTableView(view) } satisfies TableSpec;
  });
  return { name, sidebarPosition: Number(m["sidebar-position"]), tables };
}

export function emitModule(m: ModuleSpec): ModuleArtifact {
  const tables: JsonObject = {};
  for (const t of m.tables) tables[t.entity.name] = emitTable(t);
  return { "sidebar-position": m.sidebarPosition, tables };
}
