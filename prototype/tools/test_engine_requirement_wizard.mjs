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
  eq(/dimensions you DECLARE constrain/i.test(String(spec.steps.Applicability['step-description'])), true,
    'the Applicability strip teaches the declared-constrains doctrine (sv106 refinement)');
  const stepOf = {};
  for (const [label, f] of Object.entries(spec.fields)) stepOf[label] = f.step;
  eq(Object.values(stepOf).every((s) => s != null), true, 'every field carries a step key');
  eq(['Name', 'Description', 'Type', 'Business Unit'].map((l) => stepOf[l]), Array(4).fill('Registry'),
    'Registry step fields (incl. the sv107 pre-RBAC unit filter)');
  eq(['Region', 'Business Units', 'Branch', 'Customer', 'Scope', 'Product Group', 'Product Scope']
    .map((l) => stepOf[l]), Array(7).fill('Applicability'),
  'Applicability step carries the full seven-dimension cascade');
  eq(['Regulatory Reference', 'Reference Link', 'Activate'].map((l) => stepOf[l]),
    Array(3).fill('Compliance'), 'Compliance step fields (Activate last)');
  eq(Object.keys(spec.fields).indexOf('Activate'), Object.keys(spec.fields).length - 1,
    'Activate is the final field (lifecycle flag closes the form)');
}

console.log('== gates and cascades after the sv107 Registry-unit split ==');
{
  // the #292 Region→Unit gate is SUPERSEDED: the Registry unit (step 1)
  // gates and filters the whole Applicability step
  const f = catalog['Requirements'].form.fields;
  eq(f['Business Units'].check, 'Business Unit IS NOT NULL',
    'applicability Business Units gated on the Registry unit (sv107)');
  eq(f.Branch.check, 'Business Unit IS NOT NULL', 'Branch gated on the Registry unit');
  eq(f.Customer.check, 'Business Unit IS NOT NULL', 'Customer gated on the Registry unit');
  for (const l of ['Region', 'Business Units', 'Branch', 'Customer', 'Scope', 'Product Group', 'Product Scope']) {
    eq(/filtered by registryUnitID selected/i.test(String(f[l]['field-rule'])), true,
      `${l} cascade names registryUnitID (the sv107 filter — #274 spelling)`);
  }
  eq(/Allow multiple values/i.test(String(f['Product Scope']['field-rule'])), true,
    'Product Scope stays the multivalued #294 picker');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
