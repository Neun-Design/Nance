#!/usr/bin/env node
// test_engine_requirements_inheritance.mjs — proof suite for issue #226
// (schemaVersion 41): requirements inheritance. Tickets.requirementName is
// live-derived (INHERITED-REQUIREMENTS — the admitted payload chain AND-matched
// with the ticket's unit, its served regions and its customer, Q1 wildcards,
// Active only), and Competence.requirementID is the UNION of the linked
// procedures' sets with the context-aligned Active requirements
// (COMPETENCE-REQUIREMENTS — productScopeID anchor + the event's unit and its
// served regions, customer-agnostic per Q5). A new aligned requirement surfaces
// on existing tickets and competences with no re-seed.
// Run from prototype/:  node tools/test_engine_requirements_inheritance.mjs

import fs from 'fs';
globalThis.fetch = async (p) => new Response(fs.readFileSync(p));

const model = await import('../js/model.js');
const data = await import('../js/data.js');
const { catalog } = await model.loadModel();
data.initMeta(catalog);
await data.loadData();
const resolve = await import('../js/resolve.js');

let fails = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails += 1; console.log(`  ✗ ${m}`); };
const eq = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));

console.log('== schema: requirements inheritance round ==');
{
  eq(model.getSchemaVersion() >= 41, true, 'schemaVersion bumped to at least 41');
  const tk = catalog['Tickets'].byName['requirementName'];
  eq(tk.type, 'mirror', 'Tickets.requirementName typed mirror (derived, no seed)');
  const tr = model.parseRule(tk.rule);
  eq([tr.kind, tr.srcField, tr.display], ['inheritedreqs', 'eventID', 'requirementName'],
    'requirementName rule parses as INHERITED-REQUIREMENTS(eventID)');
  const cr = model.parseRule(catalog['Competence'].byName['requirementID'].rule);
  eq([cr.kind, cr.srcField, cr.display], ['competencereqs', 'procedureID', 'requirementName'],
    'Competence.requirementID rule parses as COMPETENCE-REQUIREMENTS(procedureID)');
}

console.log('== seeds: stored snapshots dropped ==');
{
  eq(data.getEntity('Tickets').every((t) => !('requirementName' in t)), true,
    'no ticket carries a stored requirementName (the rule would lose to it)');
  eq(data.getEntity('Competence').every((c) => !('requirementID' in c)), true,
    'no competence carries a stored requirementID');
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

console.log('== competence set: procedures ∪ context-aligned ==');
{
  data.addRecord('Tasks', { taskID: 'TSK-TI', taskName: 'Inheritance Task (t)', processID: 'PR1' });
  data.addRecord('Procedures', { procedureID: 'PROC-TI', procedureRegistry: 'PROC-TI (t)',
    taskID: 'TSK-TI', requirementID: ['RQ-TC'] });
  data.addRecord('Procedures', { procedureID: 'PROC-TW', procedureRegistry: 'PROC-TW (t)',
    taskID: 'TSK-TI', requirementID: [] });
  const comp = { competenceID: 'CMP-TI', eventID: 'EV-TI', productScopeID: 'PS-T1',
    procedureID: ['PROC-TI'] };
  const got = resolve.competenceRequirements(comp);
  eq(got.includes('RQ-TC'), true, "the procedure's explicit set is kept");
  eq(got.includes('RQ-TA') && got.includes('RQ-TD'), true,
    'context-aligned requirements join the set (event unit + served regions)');
  eq(got.includes('RQ-TF') && got.includes('RQ-TG'), true,
    'customer-specific requirements still align (customer-agnostic, Q5)');
  eq([got.includes('RQ-TB'), got.includes('RQ-TE'), got.includes('RQ-TH')], [false, false, false],
    'foreign region / Inactive / foreign scope stay out of the aligned side');
  eq(resolve.competenceRequirements({ ...comp, procedureID: ['PROC-TW'] }), null,
    'a wildcard procedure still certifies ALL (null — the union never narrows)');
  eq(resolve.competenceRequirements({ ...comp, productScopeID: null }), ['RQ-TC'],
    'no productScopeID anchor — no aligned set, procedures only');
  eq(resolve.competenceAlignedRequirements(comp).includes('RQ-TA'), true,
    'competenceAlignedRequirements exposes the aligned side on its own');
}

console.log('== staffing widens through the union ==');
{
  data.addRecord('Tasks', { taskID: 'TSK-TU', taskName: 'Union Task (t)', processID: 'PR1' });
  data.addRecord('Procedures', { procedureID: 'PROC-TU', procedureRegistry: 'PROC-TU (t)',
    taskID: 'TSK-TU', requirementID: ['RQ-TC', 'RQ-TA'] });
  data.addRecord('Competence', { competenceID: 'CMP-TU', taskID: 'TSK-TU', eventID: 'EV-TI',
    productScopeID: 'PS-T1', procedureID: ['PROC-TC'] });
  data.addRecord('Procedures', { procedureID: 'PROC-TC', procedureRegistry: 'PROC-TC (t)',
    taskID: 'TSK-TU', requirementID: ['RQ-TC'] });
  data.addRecord('Onboarding', { onboardID: 'OB-TU', userID: 'U-TU', competenceID: 'CMP-TU',
    isCertified: true });
  // procedures alone cover only RQ-TC; the competence context aligns RQ-TA —
  // before #226 this user was ineligible for a task requiring both
  eq(resolve.certifiedUsersForTask('TSK-TU').includes('U-TU'), true,
    'context-aligned coverage completes the AND requirement set');
}

console.log('== demo regression ==');
{
  const cmp = data.getById('Competence', 'CMP01');
  const cell = String(resolve.derivedValue('Competence', catalog['Competence'].byName['requirementID'], cmp));
  eq(/IEC 60076 Compliance/.test(cell) && /Delivery Lead Time/.test(cell), true,
    "CMP01 renders its procedure set (PRC01: CN1+CN4) — union keeps it");
  eq(/Insulation Level/.test(cell), true,
    'CMP01 gains CN7 through its certified context (PS03: A.1 | PG02)');
  const t0 = data.getEntity('Tickets')[0];
  const reqs = resolve.ticketRequirements(t0);
  eq(reqs.length > 0, true, `first demo ticket derives a live set (${reqs.length})`);
  eq(reqs.includes('CN8'), false, 'Budget Cap (CN8, Inactive) no longer surfaces on tickets');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
