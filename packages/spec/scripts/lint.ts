/**
 * spec:lint — lift the current datamodel into the Model layer and report the
 * invariant findings. Informational by default (exit 0); `--strict` exits 1
 * on errors. This is the migration-debt inventory before each Phase 3 slice.
 */
import { loadPassthrough } from "../src/index.js";
import { hasErrors, liftAll, validateModel, type Finding, type ModelModule } from "../src/model/index.js";

const strict = process.argv.includes("--strict");
const lifted = liftAll(loadPassthrough().modules);
const modules: ModelModule[] = [...lifted].map(([name, tables]) => ({
  name,
  entities: tables.map((t) => t.entity),
}));

const findings = validateModel(modules);
const errors = findings.filter((f) => f.severity === "error");
const warns = findings.filter((f) => f.severity === "warn");

const fmt = (f: Finding) => `  ${f.module} / ${f.entity}${f.field ? `.${f.field}` : ""}: ${f.message}`;
const entities = modules.reduce((n, m) => n + m.entities.length, 0);
const fields = modules.reduce((n, m) => n + m.entities.reduce((k, e) => k + e.fields.length, 0), 0);

console.log(`spec:lint — ${modules.length} modules, ${entities} entities, ${fields} fields`);
console.log(`\n${errors.length} error(s):`);
errors.forEach((f) => console.log(fmt(f)));
console.log(`\n${warns.length} warning(s):`);
warns.forEach((f) => console.log(fmt(f)));

if (strict && hasErrors(findings)) process.exit(1);
