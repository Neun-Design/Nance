/**
 * @nance/spec — the datamodel as config-as-code (ADR-0002).
 *
 * Entry point used by `scripts/build.ts` and `scripts/diff.ts`.
 *
 *   src/modules/*.ts (TypeScript)  ──compile──▶  prototype/data/datamodel.json  ──▶  prototype engine (unchanged)
 *
 * Since the cutover (P4-A) every module is compiled from the spec; the
 * artifact is a generated, committed file guarded by CI (`spec:build` +
 * `git diff --exit-code`). Never hand-edit it.
 */

import { compile, serialize } from "./compile.js";
import { loadArtifact } from "./passthrough.js";
import { compiledModules } from "./build.js";
import { META } from "./meta.js";
import type { AuthoredModule } from "./authoring.js";
import { organization } from "./modules/organization.js";
import { portfolio } from "./modules/portfolio.js";
import { operation } from "./modules/operation.js";
import { talent } from "./modules/talent.js";
import { crm } from "./modules/crm.js";
import { workspace } from "./modules/workspace.js";
import { control } from "./modules/control.js";
import type { DatamodelArtifact, ModuleName } from "./types.js";

/** The seven modules, authored in TypeScript. */
export const AUTHORED: AuthoredModule[] = [organization, portfolio, operation, talent, crm, workspace, control];

/** Module order in the artifact — the order the prototype declares them (byte-stable output). */
export const MODULE_ORDER: readonly ModuleName[] = ["Organization", "CRM", "Operation", "Portfolio", "Workspace", "Control", "Talent"];

/** Build the artifact from the spec: validated modules + `_meta`, in MODULE_ORDER. */
export function buildArtifact(): DatamodelArtifact {
  return compile(META, compiledModules(AUTHORED), MODULE_ORDER);
}

export { compile, serialize, loadArtifact, META };
export { loadPassthrough } from "./passthrough.js";
export * from "./model/index.js";
export * from "./behavior/index.js";
export * from "./view/index.js";
export { semanticEqual, diffPaths } from "./semantic.js";
export * from "./authoring.js";
export { SpecBuildError, unsuppressedErrors, compiledModules } from "./build.js";
export { ARTIFACT_PATH } from "./passthrough.js";
export type * from "./types.js";
