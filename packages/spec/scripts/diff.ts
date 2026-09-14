/**
 * spec:diff — semantic diff between the spec's output and the committed
 * prototype/data/datamodel.json. Exit 1 when they differ.
 *
 * "Semantic" = same to the engine (see src/semantic.ts): canonical spellings
 * of rules, checks, field-rules, widgets and subitem entries are not
 * differences. This is the acceptance tool for every migration slice.
 */
import { readFileSync } from "node:fs";
import { ARTIFACT_PATH, buildArtifact } from "../src/index.js";
import { moduleNames } from "../src/compile.js";
import { diffPaths } from "../src/semantic.js";
import type { DatamodelArtifact, Json } from "../src/index.js";

const MAX_PATHS = 25;

const committed = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")) as Json;
const artifact: DatamodelArtifact = buildArtifact();
const compiled = artifact as unknown as Json;

const differing: string[] = [];
diffPaths(committed, compiled, "$", differing, MAX_PATHS);

if (differing.length === 0) {
  console.log(`spec:diff — no differences (${moduleNames(artifact).length} modules)`);
  process.exit(0);
}

const byModule = new Map<string, number>();
for (const p of differing) {
  const m = /^\$\.modules\.([^.[]+)/.exec(p);
  const key = m?.[1] ?? "(top-level)";
  byModule.set(key, (byModule.get(key) ?? 0) + 1);
}
console.error("spec:diff — committed artifact differs from the spec output:");
for (const [mod, n] of byModule) console.error(`  ${mod}: ${n} path(s)`);
console.error("first paths:");
for (const p of differing) console.error(`  ${p}`);
if (differing.length >= MAX_PATHS) console.error(`  … (truncated at ${MAX_PATHS})`);
process.exit(1);
