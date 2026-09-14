/**
 * spec:lint — the invariant report for the authored modules (the spec is the
 * source now; the JSON is its output). Informational by default (exit 0);
 * `--strict` exits 1 on unsuppressed errors. Suppressed errors are listed
 * separately with their fix issue.
 */
import { AUTHORED, unsuppressedErrors } from "../src/index.js";
import { validateModel, type Finding } from "../src/model/index.js";
import { lintForms } from "../src/view/index.js";

const strict = process.argv.includes("--strict");
const scope = AUTHORED.map((m) => ({ name: m.name, entities: m.tables.map((t) => t.entity) }));
const findings = [...validateModel(scope), ...AUTHORED.flatMap((m) => lintForms(m.name, m.tables))];
const suppressed = new Map(AUTHORED.flatMap((m) => Object.entries(m.suppress).map(([k, v]) => [`${m.name}/${k}`, v])));
const keyOf = (f: Finding) => `${f.module}/${f.entity}${f.field ? `.${f.field}` : ""}`;

const errors = findings.filter((f) => f.severity === "error");
const live = unsuppressedErrors(AUTHORED);
const quiet = errors.filter((f) => suppressed.has(keyOf(f)));
const warns = findings.filter((f) => f.severity === "warn");
const fmt = (f: Finding) => `  ${keyOf(f)}: ${f.message}`;
const entities = scope.reduce((n, m) => n + m.entities.length, 0);
const fields = scope.reduce((n, m) => n + m.entities.reduce((k, e) => k + e.fields.length, 0), 0);

console.log(`spec:lint — ${scope.length} modules, ${entities} entities, ${fields} fields`);
console.log(`\n${live.length} unsuppressed error(s):`);
live.forEach((f) => console.log(fmt(f)));
console.log(`\n${quiet.length} suppressed error(s) (fix issues in the module files):`);
quiet.forEach((f) => console.log(`${fmt(f)}  ← ${suppressed.get(keyOf(f))!.split(":")[0]}`));
console.log(`\n${warns.length} warning(s):`);
warns.forEach((f) => console.log(fmt(f)));

if (strict && live.length) process.exit(1);
