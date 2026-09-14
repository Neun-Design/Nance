/**
 * Shape of the compiled artifact the prototype engine consumes
 * (`prototype/data/datamodel.json`).
 *
 * Phase 1 (ADR-0002 scaffold) keeps this deliberately loose: it only names the
 * top-level structure the compiler needs to merge modules. The typed
 * Model / View / Behavior layers — `Entity`, `Field`, `Relation`, presets,
 * `formFor` — arrive in the next packages (P2-A, P2-B) and will narrow
 * `ModuleArtifact` as modules migrate.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

export type JsonObject = { [key: string]: Json };

/** The seven module names, in the order the prototype declares them. */
export type ModuleName =
  | "Organization"
  | "CRM"
  | "Operation"
  | "Portfolio"
  | "Workspace"
  | "Control"
  | "Talent";

/**
 * One module as the engine sees it: a sidebar position and its tables.
 * Extra keys are tolerated so passthrough never loses anything.
 */
export interface ModuleArtifact extends JsonObject {
  "sidebar-position": Json;
  tables: JsonObject;
}

/** The whole artifact: `_meta` + the modules object (insertion order matters). */
export interface DatamodelArtifact extends JsonObject {
  _meta: JsonObject;
  modules: { [name in ModuleName]?: ModuleArtifact } & JsonObject;
}

/**
 * A module authored in the spec (TypeScript). Once a module has an entry
 * here it is the source of truth for that module and the passthrough copy
 * is ignored. Empty in Phase 1; filled slice by slice in Phase 3.
 */
export type MigratedModules = Partial<Record<ModuleName, ModuleArtifact>>;
