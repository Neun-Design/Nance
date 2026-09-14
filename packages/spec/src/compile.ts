import type {
  DatamodelArtifact,
  MigratedModules,
  ModuleArtifact,
  ModuleName,
} from "./types.js";

/**
 * Merge the modules authored in the spec with the passthrough copy of the
 * ones not migrated yet, producing the artifact the engine consumes.
 *
 * Rules that keep the output byte-stable and the migration incremental:
 *  - Module order is the *passthrough's* order (the order the prototype
 *    declares), never the order of the migrated map. This is what makes an
 *    all-passthrough build reproduce the committed file byte for byte.
 *  - A migrated module fully replaces its passthrough counterpart — no deep
 *    merge — so the spec is the single source of truth for that module.
 *  - A migrated module that does not exist in the passthrough is appended
 *    at the end (a brand-new module authored only in the spec).
 *  - `_meta` and any other top-level key are passed through untouched.
 */
export function compile(
  passthrough: DatamodelArtifact,
  migrated: MigratedModules = {},
): DatamodelArtifact {
  const out: DatamodelArtifact = { ...passthrough, modules: {} };

  for (const name of Object.keys(passthrough.modules) as ModuleName[]) {
    const fromSpec = migrated[name];
    const fromJson = passthrough.modules[name];
    out.modules[name] = (fromSpec ?? fromJson) as ModuleArtifact;
  }

  for (const name of Object.keys(migrated) as ModuleName[]) {
    if (!(name in out.modules)) {
      out.modules[name] = migrated[name] as ModuleArtifact;
    }
  }

  return out;
}

/**
 * Serialize exactly like the committed file: 2-space indent, no ASCII
 * escaping (JSON.stringify never escapes non-ASCII), trailing newline.
 * Verified byte-equal against `prototype/data/datamodel.json` on `main`.
 */
export function serialize(artifact: DatamodelArtifact): string {
  return JSON.stringify(artifact, null, 2) + "\n";
}

/** Names of the modules the artifact declares, in order. */
export function moduleNames(artifact: DatamodelArtifact): ModuleName[] {
  return Object.keys(artifact.modules) as ModuleName[];
}
