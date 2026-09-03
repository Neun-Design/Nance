#!/usr/bin/env node
// test_engine_requirements_inheritance.mjs — proof suite for issues #226/#231
// (schemaVersion 41/42): requirements inheritance. Tickets.requirementName is
// live-derived (INHERITED-REQUIREMENTS — the admitted payload chain AND-matched
// with the ticket's unit, its served regions and its customer, Q1 wildcards,
// Active only). Competence follows the #231 doctrine (reverting the #226
// union): a requirement NEVER enters a competence automatically — the quality
// manager binds it to the Procedure (whose Requirements picker offers the
// context-aligned options), and the competence inherits the set of its SINGLE
// certified procedure (1:1).
// Run from prototype/:  node tools/test_engine_requirements_inheritance.mjs

import fs from 'fs';
// Pinned to the FROZEN transformer reference dataset (F3, Vitalis swap):
// this suite asserts engine behavior against known reference rows — the live
// demo dataset is guarded by validate_mockup (narrative block) instead.
globalThis.__MOCKUP_PATH__ = 'tools/testdata/mockup_transformers.json';

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

console.log('== schema: requirements inheritance round ==');
{
  eq(model.getSchemaVersion() >= 43, true, 'schemaVersion bumped to at least 43');
  const tk = catalog['Tickets'].byName['requirementName'];
  eq(tk.type, 'mirror', 'Tickets.requirementName typed mirror (derived, no seed)');
  const tr = model.parseRule(tk.rule);
  eq([tr.kind, tr.srcField, tr.display], ['inheritedreqs', 'eventID', 'requirementName'],
    'requirementName rule parses as INHERITED-REQUIREMENTS(eventID)');
  const cr = model.parseRule(catalog['Competence'].byName['requirementID'].rule);
  eq([cr.kind, cr.target, cr.via, cr.display], ['computed', 'Procedures', 'procedureID', 'requirementName'],
    'Competence.requirementID derives through the procedure (#231 — no COMPETENCE-REQUIREMENTS kind)');
  const pa = catalog['Competence'].byName['procedureID'];
  eq(/multivalued/i.test(pa.notes || ''), true,
    'procedureID is a multivalued procedure GROUP again (1:many, issue #284)');
}

console.log('== seeds: stored snapshots dropped, legacy scalars tolerated ==');
{
  eq(data.getEntity('Tickets').every((t) => !('requirementName' in t)), true,
    'no ticket carries a stored requirementName (the rule would lose to it)');
  eq(data.getEntity('Competence').every((c) => !('requirementID' in c)), true,
    'no competence carries a stored requirementID');
  eq(data.getEntity('Competence').every((c) => !Array.isArray(c.procedureID)), true,
    'frozen reference keeps the #231 scalar rows (legacy shape, tolerated since #284)');
}

// probe chain: unit BU01 (serves RG01-03), one event, one payload packaging
// two scopes — PS-T1 (A.2 | PG01) and PS-T2 (G | PG04)
data.addRecord('Product Scopes', { productScopeID: 'PS-T1', scopeID: 'A.2',
  productGroupID: 'PG01', businessUnitID: 'BU01' });
data.addRecord('Product Scopes', { productScopeID: 'PS-T2', scopeID: 'G',
  productGroupID: 'PG04', businessUnitID: 'BU01' });
data.addRecord('Events', { eventID: 'EV-TI', eventTitle: 'Inheritance Probe (t)',
  businessUnitID: 'BU01', scopeID: [], productID: [] });
data.addRecord('Payload', { payloadID: 'PLD-TI', payloadCode: 'PLD-TI (t)',
  eventID: 'EV-TI', productScopeID: ['PS-T1', 'PS-T2'] });
const req = (id, name, extra) => data.addRecord('Requirements',
  { requirementID: id, requirementName: name, isActive: 'Active', ...extra });
req('RQ-TA', 'Req Aligned (t)', { scopeID: ['A.2'], productGroupID: ['PG01'], regionID: ['RG02'] });
req('RQ-TB', 'Req Foreign Region (t)', { scopeID: ['A.2'], productGroupID: ['PG01'], regionID: ['RG-T9'] });
req('RQ-TC', 'Req Foreign Unit (t)', { scopeID: ['A.2'], productGroupID: ['PG01'], businessUnitID: ['BU02'] });
req('RQ-TD', 'Req Wildcard (t)', {});
req('RQ-TE', 'Req Inactive (t)', { scopeID: ['A.2'], productGroupID: ['PG01'], isActive: 'Inactive' });
req('RQ-TF', 'Req Customer FC01 (t)', { scopeID: ['A.2'], productGroupID: ['PG01'], customerID: 'FC01' });
req('RQ-TG', 'Req Customer FC02 (t)', { scopeID: ['A.2'], productGroupID: ['PG01'], customerID: 'FC02' });
req('RQ-TH', 'Req Other Scope (t)', { scopeID: ['G'], productGroupID: ['PG04'] });

console.log('== tickets inherit live (Q1 AND semantics) ==');
{
  const t = { ticketID: 'TK-TI', eventID: 'EV-TI', businessUnitID: 'BU01', customerID: null };
  const got = resolve.ticketRequirements(t);
  eq(got.includes('RQ-TA'), true, 'aligned requirement (scope+pg+served region) inherited');
  eq(got.includes('RQ-TB'), false, 'region the unit does not serve — out');
  eq(got.includes('RQ-TC'), false, "another unit's requirement — out");
  eq(got.includes('RQ-TD'), true, 'full-wildcard requirement applies to all (Q1)');
  eq(got.includes('RQ-TE'), false, 'Inactive requirement never inherits');
  eq(got.includes('RQ-TF'), false, 'customer-specific requirement skips a customer-less ticket');
  eq(got.includes('RQ-TH'), true, 'second packaged scope admits its requirement');
  const withCust = resolve.ticketRequirements({ ...t, customerID: 'FC01' });
  eq([withCust.includes('RQ-TF'), withCust.includes('RQ-TG')], [true, false],
    "the ticket's customer gates customer-specific requirements (#180 dimension)");
  const narrowed = resolve.ticketRequirements({ ...t, productScopeID: 'PS-T1' });
  eq([narrowed.includes('RQ-TA'), narrowed.includes('RQ-TH')], [true, false],
    'a chosen productScopeID narrows the admitted scopes (issue #214)');
  const cell = String(resolve.derivedValue('Tickets', catalog['Tickets'].byName['requirementName'], t));
  eq(/Req Aligned \(t\)/.test(cell) && !/Req Inactive/.test(cell), true,
    'the requirementName cell renders inherited names live');
}

console.log('== competence doctrine (#231): the procedure decides, the competence inherits ==');
{
  data.addRecord('Tasks', { taskID: 'TSK-TI', taskName: 'Inheritance Task (t)', processID: 'PR1' });
  data.addRecord('Procedures', { procedureID: 'PROC-TI', procedureRegistry: 'PROC-TI (t)',
    taskID: 'TSK-TI', productScopeID: ['PS-T1'], requirementID: ['RQ-TC'] });
  data.addRecord('Procedures', { procedureID: 'PROC-TW', procedureRegistry: 'PROC-TW (t)',
    taskID: 'TSK-TI', requirementID: [] });
  const comp = { competenceID: 'CMP-TI', eventID: 'EV-TI', productScopeID: 'PS-T1',
    procedureID: 'PROC-TI' };
  eq(resolve.competenceRequirements(comp), ['RQ-TC'],
    "the competence set IS the procedure's set — aligned requirements do NOT auto-join");
  // the human path: the aligned requirement is OFFERED on the procedure —
  // since issue #304 the picker carries the UNIT-WIDE universe (BU01 serves
  // RG01-03, so the RG02-pinned probe stays in; foreign unit/region stay out)
  const offered = forms.requirementsForUnit('BU01').map((o) => o.value);
  eq(offered.includes('RQ-TA'), true,
    "…the Procedures form Requirements picker offers the context-aligned option");
  eq([offered.includes('RQ-TB'), offered.includes('RQ-TC')], [false, false],
    'foreign-region and foreign-unit requirements stay out of the unit picker');
  eq(offered.includes('RQ-TE'), false, 'Inactive requirements are not offered');
  // …and once the quality manager binds it, the competence inherits it
  data.updateRecord('Procedures', 'PROC-TI', { requirementID: ['RQ-TC', 'RQ-TA'] });
  eq(resolve.competenceRequirements(comp), ['RQ-TC', 'RQ-TA'],
    'binding the requirement to the procedure flows into the competence');
  eq(resolve.competenceRequirements({ ...comp, procedureID: 'PROC-TW' }), null,
    'a wildcard procedure still certifies ALL (null, Q1)');
}

console.log('== staffing follows the procedure decision ==');
{
  data.addRecord('Tasks', { taskID: 'TSK-TU', taskName: 'Union Task (t)', processID: 'PR1' });
  data.addRecord('Procedures', { procedureID: 'PROC-TU', procedureRegistry: 'PROC-TU (t)',
    taskID: 'TSK-TU', requirementID: ['RQ-TC', 'RQ-TA'] });
  data.addRecord('Procedures', { procedureID: 'PROC-TC', procedureRegistry: 'PROC-TC (t)',
    taskID: 'TSK-TU', requirementID: ['RQ-TC'] });
  data.addRecord('Competence', { competenceID: 'CMP-TU', taskID: 'TSK-TU', eventID: 'EV-TI',
    productScopeID: 'PS-T1', procedureID: 'PROC-TC' });
  data.addRecord('Onboarding', { onboardID: 'OB-TU', userID: 'U-TU', competenceID: 'CMP-TU',
    isCertified: true });
  // the task derives {RQ-TC, RQ-TA}; CMP-TU's procedure covers only RQ-TC —
  // context alignment does NOT widen coverage (#231 doctrine)
  eq(resolve.certifiedUsersForTask('TSK-TU').includes('U-TU'), false,
    'aligned-but-unbound requirements do not widen staffing coverage');
  data.updateRecord('Procedures', 'PROC-TC', { requirementID: ['RQ-TC', 'RQ-TA'] });
  eq(resolve.certifiedUsersForTask('TSK-TU').includes('U-TU'), true,
    "updating the procedure's set is what makes the holder eligible");
}

console.log('== ticket context (#233): coverage must span the ticket set ==');
{
  const tk = { ticketID: 'TK-TC', eventID: 'EV-TI', businessUnitID: 'BU01', customerID: null };
  const tkReqs = resolve.ticketRequirements(tk);
  eq(tkReqs.includes('RQ-TD') && tkReqs.includes('RQ-TA'), true,
    'the probe ticket inherits wildcard + aligned requirements');
  eq(resolve.certifiedUsersForTask('TSK-TU').includes('U-TU'), true,
    'task-level column: U-TU stays eligible (procedure set covered)');
  eq(resolve.certifiedUsersForTask('TSK-TU', tkReqs).includes('U-TU'), false,
    "ticket context: the ticket's inherited set is not fully covered — U-TU drops out");
  data.addRecord('Procedures', { procedureID: 'PROC-TX', procedureRegistry: 'PROC-TX (t)',
    taskID: 'TSK-TU', requirementID: [] });
  data.addRecord('Competence', { competenceID: 'CMP-TX', taskID: 'TSK-TU', eventID: 'EV-TI',
    productScopeID: 'PS-T1', procedureID: 'PROC-TX' });
  data.addRecord('Onboarding', { onboardID: 'OB-TX', userID: 'U-TX', competenceID: 'CMP-TX',
    isCertified: true });
  data.addRecord('People', { userID: 'U-TX', userName: 'Wildcard Probe (t)' });
  eq(resolve.certifiedUsersForTask('TSK-TU', tkReqs).includes('U-TX'), true,
    'a wildcard-procedure competence still covers the ticket context (Q1)');
  eq(/Wildcard Probe \(t\)/.test(String(resolve.certifiedUsersDisplay('TSK-TU', tkReqs, 'userName'))),
    true, 'certifiedUsersDisplay renders the context-narrowed cell');
}

console.log('== demo regression ==');
{
  const cmp = data.getById('Competence', 'CMP01');
  const cell = String(resolve.derivedValue('Competence', catalog['Competence'].byName['requirementID'], cmp));
  eq(/IEC 60076 Compliance/.test(cell) && /Delivery Lead Time/.test(cell), true,
    "CMP01 renders its procedure set (PRC01: CN1+CN4)");
  eq(/Insulation Level/.test(cell), false,
    'CMP01 does NOT gain CN7 from context alignment (#231 revert of the #226 union)');
  const t0 = data.getEntity('Tickets')[0];
  const reqs = resolve.ticketRequirements(t0);
  eq(reqs.length > 0, true, `first demo ticket derives a live set (${reqs.length})`);
  eq(reqs.includes('CN8'), false, 'Budget Cap (CN8, Inactive) no longer surfaces on tickets');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
