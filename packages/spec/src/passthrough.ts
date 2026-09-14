import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { DatamodelArtifact } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Absolute path of the runtime artifact. It is both the *output* of
 * `spec:build` and — during the incremental migration — the *passthrough
 * source* for modules not yet authored in TypeScript.
 *
 * Why read the committed file rather than a frozen snapshot: while the MVP
 * keeps evolving, modules that are not migrated yet are still edited in this
 * JSON, exactly as today. Reading it live means those edits pass straight
 * through. Modules that *have* been migrated are overwritten from the spec,
 * so a hand edit to a migrated module is rejected by the CI drift guard
 * (`spec:build` + `git diff --exit-code`). The passthrough disappears at the
 * cutover (Phase 4), when the artifact becomes 100 % compiled.
 */
export const ARTIFACT_PATH = resolve(
  here,
  "../../../prototype/data/datamodel.json",
);

/** Load the committed artifact (the hand-written JSON) as the passthrough source. */
export function loadPassthrough(path: string = ARTIFACT_PATH): DatamodelArtifact {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as DatamodelArtifact;
}
