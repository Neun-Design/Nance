#!/usr/bin/env node
// test_engine_requirement_wizard.mjs — proof suite for the Requirements
// wizard (sv94, third adopter of the form-steps convention — approved by
// Rafael from the staged preview, 2026-09-08): the thirteen-field form
// splits into three steps — Registry (identity: name, description, type) /
// Applicability (the system's longest cascade: Region → Business Unit →
// Branch → Customer → Scope → Product Group → Product Scope, with the Q1
// doctrine in the step description) / Compliance (regulatory reference +
// link, Activate last). Pure datamodel authoring (sv91 convention): zero
// engine, zero data change — every existing gate and cascade spelling is
// asserted UNCHANGED (incl. the #292 Region gate and the #353-activated
// Branch dimension).
// Run from prototype/:  node tools/test_engine_requirement_wizard.mjs

import fs from 'fs';
globalThis.fetch = async (p) => new Response(fs.readFileSync(p));

const model = await import('../js/model.js');
const data = await import('../js/data.js');
const { catalog } = await model.loadModel();
data.initMeta(catalog);
await data.loadData();

let fails = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails += 1; console.log(`  ✗ ${m}`); };
const eq = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));

console.log('== steps spec: three steps, every field mapped ==');
{
  eq(model.getSchemaVersion() >= 94, true, `schemaVersion ${model.getSchemaVersion()} >= 94`);
  const spec = catalog['Requirements'].form;
  eq(Object.keys(spec.steps || {}), ['Registry', 'Applicability', 'Compliance'],
    'three wizard steps in flow order (identity → where it applies → compliance)');
  eq(Object.values(spec.steps).map((s) => s['step-order']), [1, 2, 3],
    'unique integer step-orders (validate_mockup §1d contract)');
  eq(/applies to all \(Q1\)/i.test(String(spec.steps.Applicability['step-description'])), true,
    'the Applicability strip teaches the Q1 doctrine (empty dimension = applies to all)');
  const stepOf = {};
  for (const [label, f] of Object.entries(spec.fields)) stepOf[label] = f.step;
  eq(Object.values(stepOf).every((s) => s != null), true, 'every field carries a step key');
  eq(['Name', 'Description', 'Type'].map((l) => stepOf[l]), Array(3).fill('Registry'),
    'Registry step fields');
  eq(['Region', 'Business Unit', 'Branch', 'Customer', 'Scope', 'Product Group', 'Product Scope']
    .map((l) => stepOf[l]), Array(7).fill('Applicability'),
  'Applicability step carries the full seven-dimension cascade');
  eq(['Regulatory Reference', 'Reference Link', 'Activate'].map((l) => stepOf[l]),
    Array(3).fill('Compliance'), 'Compliance step fields (Activate last)');
  eq(Object.keys(spec.fields).indexOf('Activate'), Object.keys(spec.fields).length - 1,
    'Activate is the final field (lifecycle flag closes the form)');
}

console.log('== existing gates and cascade spellings survive the split unchanged ==');
{
  const f = catalog['Requirements'].form.fields;
  eq(f['Business Unit'].check, 'Region IS NOT NULL',
    'Business Unit still gated on Region (#292 — cross-field gate inside the step)');
  eq(f.Branch.check, 'Business Unit IS NOT NULL', 'Branch gated on the Unit (#353 dimension)');
  eq(f.Customer.check, 'Business Unit IS NOT NULL', 'Customer gated on the Unit (#180/#212)');
  eq(/filtered by Region selected/i.test(String(f['Business Unit']['field-rule'])), true,
    'Business Unit cascade names Region (two-hop join, sv61 spelling)');
  for (const l of ['Branch', 'Customer', 'Scope', 'Product Group', 'Product Scope']) {
    eq(/filtered by businessUnitID selected/i.test(String(f[l]['field-rule'])), true,
      `${l} cascade names businessUnitID (attr-name spelling, unchanged)`);
  }
  eq(/Allow multiple values/i.test(String(f['Product Scope']['field-rule'])), true,
    'Product Scope stays the multivalued #294 picker');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
