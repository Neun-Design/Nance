/**
 * spec:diff — semantic diff between the spec's output and the committed
 * prototype/data/datamodel.json. Exit 1 when they differ.
 *
 * This is the acceptance tool for every migration slice: a migrated module is
 * done when it no longer appears here (its compiled form equals the
 * hand-written one) and the engine test battery is green.
 */
import { readFileSync } from "node:fs";
import { ARTIFACT_PATH, buildArtifact } from "../src/index.js";
import { moduleNames } from "../src/compile.js";
import { parseRule } from "../src/model/relation.js";
import type { DatamodelArtifact, Json } from "../src/index.js";

const MAX_PATHS = 25;

function isObject(v: Json): v is { [k: string]: Json } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Two `rule` strings are the same rule when the engine parses them to the
 * same object — a migrated module renders the canonical spelling, and that
 * must not count as a difference.
 */
function sameRule(a: Json, b: Json): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  return JSON.stringify(parseRule(a)) === JSON.stringify(parseRule(b));
}

/** Collect the JSON paths where `a` and `b` differ (first MAX_PATHS). */
function diffPaths(a: Json, b: Json, path: string, out: string[]): void {
  if (out.length >= MAX_PATHS) return;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      out.push(`${path} (array length ${a.length} → ${b.length})`);
      return;
    }
    a.forEach((v, i) => diffPaths(v, b[i] as Json, `${path}[${i}]`, out));
    return;
  }
  if (isObject(a) && isObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (!(k in a)) out.push(`${path}.${k} (added)`);
      else if (!(k in b)) out.push(`${path}.${k} (removed)`);
      else diffPaths(a[k] as Json, b[k] as Json, `${path}.${k}`, out);
      if (out.length >= MAX_PATHS) return;
    }
    return;
  }
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (path.endsWith(".rule") && sameRule(a, b)) return; // canonical spelling, same rule
  out.push(path);
}

const committed = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")) as Json;
const artifact: DatamodelArtifact = buildArtifact();
const compiled = artifact as unknown as Json;

const differing: string[] = [];
diffPaths(committed, compiled, "$", differing);

if (differing.length === 0) {
  console.log(
    `spec:diff — no differences (${moduleNames(artifact).length} modules)`,
  );
  process.exit(0);
}

// Group by module for a readable report.
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
