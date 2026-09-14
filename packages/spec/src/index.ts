/**
 * @nance/spec — the datamodel as config-as-code (ADR-0002).
 *
 * Entry point used by `scripts/build.ts` and `scripts/diff.ts`.
 *
 *   spec (TypeScript)  ──compile──▶  prototype/data/datamodel.json  ──▶  prototype engine (unchanged)
 *
 * Modules listed in AUTHORED are compiled from TypeScript; the rest pass
 * through from the committed JSON until their slice lands. Each slice is
 * accepted only when `spec:diff` is empty for those modules and the engine
 * test battery is green.
 */

import { compile, serialize } from "./compile.js";
import { loadPassthrough } from "./passthrough.js";
import { migratedFrom } from "./build.js";
import type { AuthoredModule } from "./authoring.js";
import { organization } from "./modules/organization.js";
import { portfolio } from "./modules/portfolio.js";
import { operation } from "./modules/operation.js";
import { talent } from "./modules/talent.js";
import { crm } from "./modules/crm.js";
import { workspace } from "./modules/workspace.js";
import { control } from "./modules/control.js";
import type { DatamodelArtifact, MigratedModules } from "./types.js";

/**
 * Modules authored in the spec (Phase 3, one slice at a time). Each is
 * validated at build time (see build.ts); the compiled module replaces its
 * passthrough copy in the artifact.
 *
 *   P3-A  Organization, Portfolio
 *   P3-B  Operation, Talent
 *   P3-C  CRM, Workspace, Control      — every module is now compiled; the
 *         cutover (P4-A) removes the passthrough.
 */
export const AUTHORED: AuthoredModule[] = [organization, portfolio, operation, talent, crm, workspace, control];

/** The migrated map `compile()` merges — validated; throws SpecBuildError on drift. */
export function migrated(passthrough: DatamodelArtifact = loadPassthrough()): MigratedModules {
  return migratedFrom(AUTHORED, passthrough);
}

/** Build the artifact: authored modules from the spec + passthrough for the rest. */
export function buildArtifact(): DatamodelArtifact {
  const passthrough = loadPassthrough();
  return compile(passthrough, migrated(passthrough));
}

export { compile, serialize, loadPassthrough };
export * from "./model/index.js";
export * from "./behavior/index.js";
export * from "./view/index.js";
export { semanticEqual, diffPaths } from "./semantic.js";
export * from "./authoring.js";
export { SpecBuildError, unsuppressedErrors, migratedFrom } from "./build.js";
export { ARTIFACT_PATH } from "./passthrough.js";
export type * from "./types.js";
