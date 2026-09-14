import type { DatamodelArtifact, JsonObject, ModuleArtifact, ModuleName } from "./types.js";

/**
 * Assemble the artifact the engine consumes from `_meta` and the compiled
 * modules, in the order given — the order the prototype declares its
 * modules (`MODULE_ORDER`), which keeps the output byte-stable.
 *
 * Since the cutover (ADR-0002 P4-A) there is no passthrough: every module
 * comes from the spec.
 */
export function compile(meta: JsonObject, modules: Record<ModuleName, ModuleArtifact>, order: readonly ModuleName[]): DatamodelArtifact {
  const out: DatamodelArtifact = { _meta: { ...meta }, modules: {} };
  for (const name of order) {
    const m = modules[name];
    if (!m) throw new Error(`compile: module "${name}" is in MODULE_ORDER but was not authored`);
    out.modules[name] = m;
  }
  for (const name of Object.keys(modules) as ModuleName[]) {
    if (!(name in out.modules)) throw new Error(`compile: module "${name}" is authored but missing from MODULE_ORDER`);
  }
  return out;
}

/**
 * Serialize exactly like the committed file: 2-space indent, no ASCII
 * escaping (JSON.stringify never escapes non-ASCII), trailing newline.
 */
export function serialize(artifact: DatamodelArtifact): string {
  return JSON.stringify(artifact, null, 2) + "\n";
}

/** Names of the modules the artifact declares, in order. */
export function moduleNames(artifact: DatamodelArtifact): ModuleName[] {
  return Object.keys(artifact.modules) as ModuleName[];
}
