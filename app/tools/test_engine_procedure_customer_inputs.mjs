#!/usr/bin/env node
// test_engine_procedure_customer_inputs.mjs — proof suite for issue #324
// (sv77): the customer-input decision moves from the HANDOUT to the
// PROCEDURE. New stored Procedures.customerInputID[] (subset of taskInput;
// form multicheck offers exactly the chosen Inputs —
// customerInputsForSelection); Handouts.customerFlag and its form switch
// RETIRED; ticketInputHandouts reads the per-procedure set with a legacy
// fallback rung for pre-sv77 snapshots (frozen-testdata posture).
// Seeds are behavior-preserving: the Tickets Inputs census stays 137/160
// (proven in test_engine_ticket_input_flag.mjs).
// Run from prototype/:  node tools/test_engine_procedure_customer_inputs.mjs

import fs from 'fs';
globalThis.fetch = async (p) => new Response(fs.readFileSync(p));

const model = await import('../js/model.js');
const data = await import('../js/data.js');
const { catalog } = await model.loadModel();
data.initMeta(catalog);
await data.loadData();
const resolve = await import('../js/resolve.js');
const forms = await import('../js/forms.js');

let fails = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails += 1; console.log(`  ✗ ${m}`); };
const eq = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));
const asList = (v) => (Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]));

console.log('== schema: the decision lives on the Procedure ==');
{
  eq(model.getSchemaVersion() >= 77, true, `schemaVersion ${model.getSchemaVersion()} >= 77`);
  const a = catalog['Procedures'].byName['customerInputID'];
  const r = model.parseRule(a.rule);
  eq([r.kind, r.target, r.display], ['fk', 'Handouts', 'handoutName'],
    'customerInputID is a stored FK → Handouts (display handoutName)');
  eq(/multivalued/i.test(String(a.notes)), true, 'notes declare multivalued');
  eq(catalog['Handouts'].byName['customerFlag'], undefined,
    'the handout-level customerFlag RETIRED');
  eq(catalog['Handouts'].form.fields['Customer Input'], undefined,
    'the Customer Input switch left the Handouts form');
}

console.log('== form spec: gated on Inputs, cascade spelling (#274 trap) ==');
{
  const f = catalog['Procedures'].form.fields['Customer Inputs'];
  eq(f && f.attribute, 'customerInputID', 'Customer Inputs binds customerInputID');
  eq(f.check, 'Inputs IS NOT NULL', 'gated on the sibling Inputs field');
  const rule = String(f['field-rule']);
  eq(/Allow multiple/i.test(rule), true, 'multivalued picker');
  eq(/filtered by .*Inputs.*selected/i.test(rule), true,
    'rule matches the cascade regex naming Inputs (listener wiring)');
  const keys = Object.keys(catalog['Procedures'].form.fields);
  eq(keys.indexOf('Customer Inputs') - keys.indexOf('Inputs'), 1,
    'sits right after Inputs (the UX mock)');
}

console.log('== picker: exactly the chosen Inputs ==');
{
  const hs = data.getEntity('Handouts').slice(0, 3);
  const ids = hs.map((h) => h.handoutID);
  eq(forms.customerInputsForSelection(ids).map((o) => o.value), ids,
    'options = the selected inputs, in selection order');
  eq(forms.customerInputsForSelection(ids).map((o) => o.label),
    hs.map((h) => h.handoutName), 'labels resolve the handout names');
  eq(forms.customerInputsForSelection([]), [], 'no inputs chosen — no options');
  eq(forms.customerInputsForSelection(null), [], 'null-safe');
  eq(forms.customerInputsForSelection(['NO-SUCH']), [], 'unknown ids drop out');
}

console.log('== seeds: subset invariant + behavior-preserving census ==');
{
  const procs = data.getEntity('Procedures');
  eq(procs.every((p) => 'customerInputID' in p), true,
    'every procedure carries the key (parity)');
  const bad = procs.filter((p) => {
    const inputs = asList(p.taskInput).map(String);
    return !asList(p.customerInputID).every((id) => inputs.includes(String(id)));
  });
  eq(bad.map((p) => p.procedureID), [], 'customerInputID ⊆ taskInput on every procedure');
  const withCi = procs.filter((p) => asList(p.customerInputID).length);
  eq(withCi.length, 15, '15 clinic procedures declare customer inputs (migration census)');
  const DOMAIN_DOCS = ['Contrast Consent Form', 'Medical Order',
    'Sample Manifest', 'Sedation Consent Form']; // clinic.yaml customer_inputs
  const names = [...new Set(withCi.flatMap((p) => asList(p.customerInputID))
    .map((id) => data.getById('Handouts', id).handoutName))].sort();
  eq(names.every((n) => DOMAIN_DOCS.includes(n)), true,
    `seeded names come from the domain customer_inputs list (${names.join(', ')})`);
  eq(data.getEntity('Handouts').every((h) => !('customerFlag' in h)), true,
    'the retired flag key left every handout row');
}

console.log('== contextuality: same handout, different decision per procedure ==');
{
  // the issue #324 core: the SAME handout is a customer input in one method
  // and internal in another — impossible under the handout-level flag
  data.addRecord('Processes', { processID: 'PR-CI (t)', processName: 'CI Probe (t)' });
  data.addRecord('Tasks', { taskID: 'TK-CI (t)', taskName: 'CI Task (t)', processID: 'PR-CI (t)' });
  const h0 = data.getEntity('Handouts')[0];
  data.addRecord('Procedures', { procedureID: 'PRC-CI (t)', procedureRegistry: 'SOP-CI (t)',
    taskID: 'TK-CI (t)', taskInput: [h0.handoutID], customerInputID: [h0.handoutID],
    requirementID: [], procedureStatus: 'Approved' });
  const ticket = { ticketID: 'T-CI (t)', processID: ['PR-CI (t)'] };
  eq(resolve.ticketInputHandouts(ticket).map((h) => h.handoutID), [h0.handoutID],
    'listed in customerInputID — the input surfaces on the ticket');
  const proc = data.getById('Procedures', 'PRC-CI (t)');
  proc.customerInputID = [];
  eq(resolve.ticketInputHandouts(ticket), [],
    'same handout, same procedure inputs, empty decision — nothing surfaces (per-procedure)');
  // legacy rung: a pre-sv77 procedure WITHOUT the key falls back to the
  // retired handout flag (frozen-testdata posture) — and the key, when
  // present, WINS over a stale flag
  delete proc.customerInputID;
  h0.customerFlag = true;
  eq(resolve.ticketInputHandouts(ticket).map((h) => h.handoutID), [h0.handoutID],
    'no key (legacy snapshot) — the old handout flag still collects');
  proc.customerInputID = [];
  eq(resolve.ticketInputHandouts(ticket), [],
    'key present (even empty) beats a stale flag — the procedure decides');
  delete h0.customerFlag;
  data.removeRecords('Procedures', ['PRC-CI (t)']);
  data.removeRecords('Tasks', ['TK-CI (t)']);
  data.removeRecords('Processes', ['PR-CI (t)']);
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
