/**
 * spec:scaffold-module <ModuleName> [--issue N]
 *
 * Generates src/modules/<module>.ts from the hand-written JSON: the starting
 * point of a migration slice. Forms are written with formFor (derived widgets
 * omitted), relations with the typed builders, everything else as literals.
 * The file is hand-maintained from then on. Model errors the JSON already has
 * are pre-listed in `suppress` (tied to --issue) so the build stays green
 * until their fix PR.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPassthrough } from "../src/index.js";
import type { Json, JsonObject, ModuleName } from "../src/index.js";
import { liftModule } from "../src/view/module.js";
import { validateModel } from "../src/model/invariants.js";
import { liftAll } from "../src/model/lift.js";
import { defaultWidgetFor, widget as mkWidget } from "../src/view/widget.js";
import { computed, concat, enumOf, fk, mirror, rollup, userInput } from "../src/authoring.js";
import type { Relation } from "../src/model/relation.js";
import type { Field } from "../src/model/types.js";
import type { FormField, FormSpec } from "../src/view/form.js";
import type { TableSpec } from "../src/view/table.js";

const [moduleName, ...rest] = process.argv.slice(2) as [ModuleName, ...string[]];
if (!moduleName) { console.error("usage: spec:scaffold-module <ModuleName> [--issue N]"); process.exit(2); }
const issueFlag = rest.indexOf("--issue");
const issue = issueFlag >= 0 ? `#${rest[issueFlag + 1]}` : "#TBD";

const art = loadPassthrough();
const mod = liftModule(moduleName, (art.modules as JsonObject)[moduleName] as JsonObject);

// ---------- helpers ----------
const S = (v: unknown) => JSON.stringify(v);
const J = (v: Json, indent: string) => JSON.stringify(v, null, 2).split("\n").join(`\n${indent}`);
const camel = (s: string) => s.replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string) => (c ? c.toUpperCase() : "")).replace(/^./, (c) => c.toLowerCase());
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const opts = (pairs: [string, string | undefined][]) => {
  const kept = pairs.filter((p): p is [string, string] => p[1] !== undefined);
  return kept.length ? `{ ${kept.map(([k, v]) => `${k}: ${v}`).join(", ")} }` : "";
};
const withOpts = (head: string, o: string) => (o ? `${head}, ${o})` : `${head})`);
/** TS object literal with identifier keys (for FieldRule and friends). */
const lit = (o: Record<string, unknown>) => `{ ${Object.entries(o).map(([k, v]) => `${k}: ${S(v)}`).join(", ")} }`;

function renderRelation(r: Relation): string {
  switch (r.kind) {
    case "userInput": return "userInput()";
    case "enum": return `enumOf(${r.values.map(S).join(", ")})`;
    case "fk": {
      const cand = fk(r.target ?? "", { display: r.display, via: r.via, filter: r.filter, concat: r.concat });
      if (same(cand, r)) return withOpts(`fk(${S(r.target)}`, opts([["display", r.display ? S(r.display) : undefined], ["via", r.via ? S(r.via) : undefined], ["filter", r.filter ? S(r.filter) : undefined], ["concat", r.concat ? S(r.concat) : undefined]]));
      break;
    }
    case "mirror": {
      if (r.via && !r.viaList) {
        const cand = mirror(r.target ?? "", r.via, { display: r.display, concat: r.concat, filter: r.filter });
        if (same(cand, r)) return withOpts(`mirror(${S(r.target)}, ${S(r.via)}`, opts([["display", r.display ? S(r.display) : undefined], ["concat", r.concat ? S(r.concat) : undefined], ["filter", r.filter ? S(r.filter) : undefined]]));
      }
      break;
    }
    case "rollup": {
      if (!r.viaList) {
        const cand = rollup(r.target ?? "", r.via, { display: r.display, concat: r.concat, filter: r.filter });
        if (same(cand, r)) return withOpts(`rollup(${S(r.target)}${r.via || r.display || r.concat || r.filter ? `, ${S(r.via)}` : ""}`, opts([["display", r.display ? S(r.display) : undefined], ["concat", r.concat ? S(r.concat) : undefined], ["filter", r.filter ? S(r.filter) : undefined]]));
      }
      break;
    }
    case "computed": {
      if (r.concat && (r.target == null || r.target === "CONCAT") && !r.via && !r.viaList && !r.display && !r.filter) {
        const parts = r.concat.map((p) => ("lit" in p ? { lit: p.lit } : p.field));
        const cand = concat(...parts);
        if (same(cand, r)) return `concat(${parts.map(S).join(", ")})`;
      }
      if (!r.viaList) {
        const cand = computed(r.target, { via: r.via, display: r.display, concat: r.concat, filter: r.filter });
        if (same(cand, r)) return withOpts(`computed(${S(r.target)}`, opts([["via", r.via ? S(r.via) : undefined], ["display", r.display ? S(r.display) : undefined], ["concat", r.concat ? S(r.concat) : undefined], ["filter", r.filter ? S(r.filter) : undefined]]));
      }
      break;
    }
    default: break;
  }
  return S(r); // exact literal for special / unusual shapes
}

function renderAttr(f: Field, display: { tableDisplay: boolean; subitemDisplay: boolean }): string {
  const o = opts([
    ["rel", f.relation ? renderRelation(f.relation) : undefined],
    ["notes", f.notes != null ? S(f.notes) : undefined],
    ["constraints", f.constraints.length ? S(f.constraints) : undefined],
    ["displayName", f.displayName !== undefined ? S(f.displayName) : undefined],
    ["gapTag", f.gapTag !== undefined ? S(f.gapTag) : undefined],
    ["show", display.tableDisplay === true && display.subitemDisplay === false ? undefined : `[${display.tableDisplay}, ${display.subitemDisplay}]`],
  ]);
  return withOpts(`attr(${S(f.name)}, ${S(f.type)}`, o);
}

function renderFormField(label: string, ff: FormField, field: Field | undefined, ind: string): string {
  const derived = field ? defaultWidgetFor(field) : null;
  const widget = derived && derived.key === ff.widget.key && (ff.widget.hint == null || ff.widget.hint === derived.hint)
    ? undefined
    : mkWidget(ff.widget.key).hint === ff.widget.hint ? S(ff.widget.key) : S(ff.widget);
  const check = ff.check
    ? ff.check.kind === "notNull" ? `requires(${ff.check.deps.map(S).join(", ")})` : `requiresValue(${S(ff.check.dep)}, ${ff.check.values.map(S).join(", ")})`
    : undefined;
  const o = opts([
    ["attribute", S(ff.attribute)],
    ["widget", widget],
    ["tooltip", ff.tooltip != null ? S(ff.tooltip) : undefined],
    ["step", ff.step != null ? S(ff.step) : undefined],
    ["check", check],
    ["rule", ff.rule ? lit(ff.rule as Record<string, unknown>) : undefined],
  ]);
  return `${ind}${S(label)}: ${o},`;
}

function renderForm(form: FormSpec | boolean | null, def: string, fields: Field[], ind: string): string {
  if (form === null || typeof form === "boolean") return String(form);
  const byName = new Map(fields.map((f) => [f.name, f]));
  const lines = Object.entries(form.fields).map(([label, ff]) => renderFormField(label, ff, ff.attribute ? byName.get(ff.attribute) : undefined, `${ind}    `));
  const steps = form.steps ? `steps: ${J(form.steps as unknown as Json, `${ind}  `)},\n${ind}  ` : "";
  const sub = form.subitemTables !== undefined ? `\n${ind}  subitemTables: ${J(form.subitemTables, `${ind}  `)},` : "";
  return `formFor(${def}.entity, {\n${ind}  ${steps}fields: {\n${lines.join("\n")}\n${ind}  },${sub}\n${ind}})`;
}

function renderTable(t: TableSpec, def: string): string {
  const v = t.view;
  const ind = "    ";
  const parts: string[] = [];
  if (v.visibility !== undefined) parts.push(`visibility: ${S(v.visibility)}`);
  parts.push(`dashboardOrder: ${v.dashboardOrder}`);
  if (v.reports !== undefined) parts.push(`reports: ${J(v.reports, ind)}`);
  parts.push(`form: ${renderForm(v.form, def, t.entity.fields, ind)}`);
  if (v.cards !== undefined) parts.push(`cards: ${J(v.cards, ind)}`);
  if (v.tableFilters !== undefined) parts.push(`tableFilters: ${S(v.tableFilters)}`);
  if (v.subitemTables !== undefined) parts.push(`subitemTables: ${J(v.subitemTables, ind)}`);
  return `  table(${def}, {\n${parts.map((p) => `${ind}${p},`).join("\n")}\n  }),`;
}

// ---------- suppressions: the Model errors this module already carries ----------
const allModules = [...liftAll(art.modules as JsonObject)].map(([name, tables]) => ({ name, entities: tables.map((t) => t.entity) }));
const errors = validateModel(allModules).filter((f) => f.severity === "error" && f.module === moduleName);
const suppress = Object.fromEntries(errors.map((e) => [e.field ? `${e.entity}.${e.field}` : e.entity, `${issue}: ${e.message}`]));

// ---------- emit ----------
const defs = mod.tables.map((t) => ({ t, def: camel(t.entity.name) }));
const out: string[] = [];
out.push(`/**`);
out.push(` * ${moduleName} module — authored in the spec (ADR-0002).`);
out.push(` *`);
out.push(` * Generated by \`spec:scaffold-module ${moduleName}\` from the hand-written`);
out.push(` * datamodel.json, then hand-maintained. Edit here and run \`npm run build\`;`);
out.push(` * never edit this module in the JSON (the CI drift guard rejects it).`);
out.push(` */`);
out.push(`import { attr, computed, concat, defineModule, entity, enumOf, fk, mirror, rollup, table, userInput } from "../authoring.js";`);
out.push(`import { requires, requiresValue } from "../behavior/check.js";`);
out.push(`import { formFor } from "../view/form.js";`);
out.push(``);
for (const { t, def } of defs) {
  const sys = t.entity.systemRegistry !== undefined ? `, { systemRegistry: ${S(t.entity.systemRegistry)} }` : "";
  out.push(`const ${def} = entity(${S(t.entity.name)}, ${S(t.entity.description)}, [`);
  for (const f of t.entity.fields) out.push(`  ${renderAttr(f, t.display[f.name]!)},`);
  out.push(`]${sys});`);
  out.push(``);
}
out.push(`export const ${camel(moduleName)} = defineModule(${S(moduleName)}, ${mod.sidebarPosition}, [`);
for (const { t, def } of defs) out.push(renderTable(t, def));
out.push(`]${Object.keys(suppress).length ? `, {\n  suppress: ${J(suppress, "  ")},\n}` : ""});`);
out.push(``);

const here = dirname(fileURLToPath(import.meta.url));
const file = resolve(here, `../src/modules/${camel(moduleName)}.ts`);
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, out.join("\n"), "utf8");
console.log(`spec:scaffold-module — wrote ${file} (${mod.tables.length} tables, ${errors.length} suppressed error(s))`);

// silence unused-import lint for builders referenced only in generated text
void computed; void concat; void enumOf; void fk; void mirror; void rollup; void userInput;
