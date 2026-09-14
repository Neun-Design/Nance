/**
 * The build gate for authored modules (ADR-0002: "the documented drift bugs
 * become impossible").
 *
 * Every module is validated against the Model invariants with the whole
 * entity set in scope. An error that is not explicitly suppressed — with the
 * issue that will fix it — fails `spec:build`.
 */

import type { ModuleArtifact, ModuleName } from "./types.js";
import type { ModelModule } from "./model/types.js";
import { validateModel, type Finding } from "./model/invariants.js";
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

const key = (f: Finding) => (f.field ? `${f.entity}.${f.field}` : f.entity);

/** Errors in the authored modules that are not suppressed. */
export function unsuppressedErrors(authored: AuthoredModule[]): Finding[] {
  const scope: ModelModule[] = authored.map((m) => ({ name: m.name, entities: m.tables.map((t) => t.entity) }));
  const suppress = new Map<string, Record<string, string>>(authored.map((m) => [m.name, m.suppress]));
  const findings = [...validateModel(scope), ...authored.flatMap((m) => lintForms(m.name, m.tables))];
  return findings.filter((f) => f.severity === "error" && !(key(f) in (suppress.get(f.module) ?? {})));
}

/** Validate, then compile every authored module. */
export function compiledModules(authored: AuthoredModule[]): Record<ModuleName, ModuleArtifact> {
  const errors = unsuppressedErrors(authored);
  if (errors.length) throw new SpecBuildError(errors);
  const out = {} as Record<ModuleName, ModuleArtifact>;
  for (const m of authored) out[m.name] = emitModule(m);
  return out;
}
