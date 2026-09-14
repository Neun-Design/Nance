/**
 * spec:build — compile the spec and write prototype/data/datamodel.json.
 *
 * Idempotent and byte-stable: running it on a clean tree produces no diff.
 * CI runs it followed by `git diff --exit-code prototype/data/datamodel.json`
 * as the drift guard.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { ARTIFACT_PATH, buildArtifact, serialize } from "../src/index.js";

const before = readFileSync(ARTIFACT_PATH, "utf8");
const after = serialize(buildArtifact());
const rel = relative(process.cwd(), ARTIFACT_PATH);
const bytes = (s: string): number => Buffer.byteLength(s, "utf8");

if (before === after) {
  console.log(`spec:build — ${rel} unchanged (${bytes(after)} bytes)`);
} else {
  writeFileSync(ARTIFACT_PATH, after, "utf8");
  console.log(
    `spec:build — wrote ${rel} (${bytes(before)} → ${bytes(after)} bytes)`,
  );
}
