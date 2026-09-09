#!/usr/bin/env node
// test_engine_ticket_wizard.mjs — proof suite for the Tickets wizard
// (sv93, second adopter of the form-steps convention — approved by Rafael
// from the staged preview, 2026-09-08): the ten-field Tickets form splits
// into three steps — Parties (who: unit, applicant, customer, project,
// supplier) / Request (what: event + product scope, the #350
// applicant-supplier contract pair) / Details (description, target date,
// status). Pure datamodel authoring (sv91 convention): zero engine, zero
// data change — every gate and cascade spelling of the #350 round is
// asserted UNCHANGED (cross-step cascades are the engine's proven path).
// Run from prototype/:  node tools/test_engine_ticket_wizard.mjs

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
  eq(model.getSchemaVersion() >= 93, true, `schemaVersion ${model.getSchemaVersion()} >= 93`);
  const spec = catalog['Tickets'].form;
  eq(Object.keys(spec.steps || {}), ['Parties', 'Request', 'Details'],
    'three wizard steps in flow order (who → what → details)');
  eq(Object.values(spec.steps).map((s) => s['step-order']), [1, 2, 3],
    'unique integer step-orders (validate_mockup §1d contract)');
  const stepOf = {};
  for (const [label, f] of Object.entries(spec.fields)) stepOf[label] = f.step;
  eq(Object.values(stepOf).every((s) => s != null), true, 'every field carries a step key');
  eq(['Business Unit', 'Applicant', 'Customer', 'Project', 'Supplier']
    .map((l) => stepOf[l]), Array(5).fill('Parties'), 'Parties step fields');
  eq(['Event', 'Product Scope'].map((l) => stepOf[l]), ['Request', 'Request'],
    'Request step fields (the #350 contract pair gets its own screen)');
  eq(['Details', 'Target Date', 'Status'].map((l) => stepOf[l]), Array(3).fill('Details'),
    'Details step fields');
}

console.log('== #350 gates and cascade spellings survive the split unchanged ==');
{
  const f = catalog['Tickets'].form.fields;
  eq(f.Customer.check, 'Business Unit IS NOT NULL', 'Customer gated on the Unit');
  eq(f.Project.check, 'Customer IS NOT NULL', 'Project gated on the Customer');
  eq(f.Supplier.check, 'Business Unit IS NOT NULL', 'Supplier gated on the Unit');
  eq(f.Event.check, 'Project IS NOT NULL', 'Event gated on the Project (cross-step gate)');
  eq(f['Product Scope'].check, 'Event IS NOT NULL', 'Product Scope gated on the Event');
  eq(/filtered by Applicant \+ Supplier \+ Branch selected/i.test(String(f.Event['field-rule'])), true,
    'Event cascade names the Applicant + Supplier + Branch chain (#350 pair + the sv110 output branch)');
  eq(/filtered by Event \+ Applicant \+ Supplier \+ Branch \+ Constraints selected/i
    .test(String(f['Product Scope']['field-rule'])), true,
  'Product Scope cascade carries the Constraints layer on top of the sv110 SLA chain');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
