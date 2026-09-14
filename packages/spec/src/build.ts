/**
 * The build gate for authored modules (ADR-0002: "the documented drift bugs
 * become impossible").
 *
 * Every module authored in the spec is validated against the Model
 * invariants with the *whole* entity set in scope (relation targets may live
 * in modules that are still passthrough). An error that is not explicitly
 * suppressed — with the issue that will fix it — fails `spec:build`.
 */

import type { DatamodelArtifact, JsonObject, MigratedModules, ModuleName } from "./types.js";
import { liftAll } from "./model/lift.js";
import { validateModel, type Finding } from "./model/invariants.js";
import type { ModelModule } from "./model/types.js";
import { lintForms } from "./view/lintForms.js";
import { emitModule } from "./view/module.js";
import type { AuthoredModule } from "./authoring.js";

export class SpecBuildError extends Error {
  constructor(public readonly findings: Finding[]) {
    super(
      `spec: ${findings.length} unsuppressed error(s) in authored modules:\n` +
        findings.map((f) => `  ${f.module} / ${f.entity}${f.field ? `.${f.field}` : ""}: ${f.message}`).join("\n"),
    );
  }
}

/** All Model modules in scope: authored ones win over their passthrough copy. */
function modelScope(authored: AuthoredModule[], passthrough: DatamodelArtifact): ModelModule[] {
  const byName = new Map<string, ModelModule>();
  for (const [name, tables] of liftAll(passthrough.modules as JsonObject)) {
    byName.set(name, { name, entities: tables.map((t) => t.entity) });
  }
  for (const m of authored) byName.set(m.name, { name: m.name, entities: m.tables.map((t) => t.entity) });
  return [...byName.values()];
}

const key = (f: Finding) => (f.field ? `${f.entity}.${f.field}` : f.entity);

/** Errors in authored modules that are not suppressed. */
export function unsuppressedErrors(authored: AuthoredModule[], passthrough: DatamodelArtifact): Finding[] {
  const names = new Set<string>(authored.map((m) => m.name));
  const suppress = new Map<string, Record<string, string>>(authored.map((m) => [m.name, m.suppress]));
  const findings = [
    ...validateModel(modelScope(authored, passthrough)),
    ...authored.flatMap((m) => lintForms(m.name, m.tables)),
  ];
  return findings.filter((f) => {
    if (f.severity !== "error" || !names.has(f.module)) return false;
    const s = suppress.get(f.module) ?? {};
    return !(key(f) in s) && !(f.field && f.field.startsWith("form.") && key(f) in s);
  });
}

/** Validate, then turn the authored modules into the map `compile()` merges. */
export function migratedFrom(authored: AuthoredModule[], passthrough: DatamodelArtifact): MigratedModules {
  const errors = unsuppressedErrors(authored, passthrough);
  if (errors.length) throw new SpecBuildError(errors);
  const out: MigratedModules = {};
  for (const m of authored) out[m.name as ModuleName] = emitModule(m);
  return out;
}
