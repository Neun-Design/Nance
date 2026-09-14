import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { DatamodelArtifact } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Absolute path of the runtime artifact — the *output* of `spec:build`.
 *
 * Since the cutover (ADR-0002 P4-A) the build never reads it: every module
 * is compiled from `src/modules/`. It is still read by `spec:diff` (drift
 * guard) and by the tests, which use the committed artifact as a fixture to
 * check the layers against the real datamodel.
 */
export const ARTIFACT_PATH = resolve(here, "../../../prototype/data/datamodel.json");

/** Load the committed artifact (a fixture for diff and tests — not a build input). */
export function loadArtifact(path: string = ARTIFACT_PATH): DatamodelArtifact {
  return JSON.parse(readFileSync(path, "utf8")) as DatamodelArtifact;
}

/** @deprecated since the cutover — the build has no passthrough. Use `loadArtifact`. */
export const loadPassthrough = loadArtifact;
