/**
 * @nance/spec — the datamodel as config-as-code (ADR-0002).
 *
 * Entry point used by `scripts/build.ts` and `scripts/diff.ts`.
 *
 *   spec (TypeScript)  ──compile──▶  prototype/data/datamodel.json  ──▶  prototype engine (unchanged)
 *
 * Phase 1: everything is passthrough — the build reproduces the committed
 * artifact exactly and proves the harness. Migration slices (Phase 3) add
 * modules to `MIGRATED` one group at a time; each slice is accepted only when
 * `spec:diff` is empty for those modules and the engine test battery is green.
 */

import { compile, serialize } from "./compile.js";
import { loadPassthrough } from "./passthrough.js";
import type { DatamodelArtifact, MigratedModules } from "./types.js";

/**
 * Modules authored in the spec. Empty in Phase 1.
 *
 * Phase 3 will register them here, e.g.
 *   Organization: organizationModule,
 *   Portfolio: portfolioModule,
 * making the spec the source of truth for those modules.
 */
export const MIGRATED: MigratedModules = {};

/** Build the artifact: migrated modules from the spec + passthrough for the rest. */
export function buildArtifact(): DatamodelArtifact {
  return compile(loadPassthrough(), MIGRATED);
}

export { compile, serialize, loadPassthrough };
export * from "./model/index.js";
export * from "./behavior/index.js";
export * from "./view/index.js";
export { semanticEqual, diffPaths } from "./semantic.js";
export { ARTIFACT_PATH } from "./passthrough.js";
export type * from "./types.js";
