#!/usr/bin/env node
// test_engine_ticket_scope.mjs — proof suite for issue #214 (schemaVersion 36):
// the ticket product-scope round. Tickets gain a stored productScopeID (single-
// valued, picked among the event's payload scopes under the customer's SLAs —
// productScopesForTicket), their processID snapshot narrows by the chosen scope
// (ticketProcesses, derived on save) and drives the new Processes/Tasks subitem
// tabs (via: processID, replacing the Jobs tab); Tasks gain the CERTIFIED-USERS
// derived column (AND semantics over the task's derived requirement set) and
// taskName reorders to `activityName-actionName`.
// Run from prototype/:  node tools/test_engine_ticket_scope.mjs

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

console.log('== schema: ticket product-scope round ==');
{
  eq(model.getSchemaVersion() >= 36, true, 'schemaVersion bumped to at least 36');
  const tk = catalog['Tickets'];
  const ps = model.parseRule(tk.byName['productScopeID'].rule);
  eq(ps.kind, 'fk', 'Tickets.productScopeID is a stored FK');
  eq(ps.target, 'Product Scopes', 'productScopeID targets Product Scopes');
  eq(tk.byName['producScopeID'], undefined, 'authored producScopeID typo normalized away');
  eq(tk.byName['processID']['table-display'], false, 'processID left the Tickets table columns');
  const ts = catalog['Tasks'];
  eq(ts.byName['userID'].type, 'mirror', 'Tasks.userID typed mirror (derived, no seed)');
  const ur = model.parseRule(ts.byName['userID'].rule);
  eq([ur.kind, ur.srcField, ur.display], ['certifiedusers', 'taskID', 'userName'],
    'userID rule parses as CERTIFIED-USERS(taskID) display userName');
  const tn = model.parseRule(ts.byName['taskName'].rule);
  eq(tn.concat, [{ field: 'activityName' }, { lit: '-' }, { field: 'actionName' }],
    'taskName CONCAT reordered to activityName-actionName');
  eq(catalog['Procedures'].byName['processID']['table-display'], true,
    'Procedures.processID joined the table columns');
}

console.log('== form spec: Product Scope select ==');
{
  const f = catalog['Tickets'].form.fields['Product Scope'];
  eq(f.attribute, 'productScopeID', 'Product Scope binds productScopeID');
  eq(f.check, 'Project IS NOT NULL', 'gated on Project (authored spelling)');
  eq(/filtered by Event/i.test(String(f['field-rule'])), true, 'refiltered by the Event');
  eq(catalog['Tickets'].form['subitem-tables'], undefined,
    'form-level New Job launcher removed (literal reading, issue #214)');
}

console.log('== subitem tabs: Processes/Tasks replace Jobs ==');
{
  const subs = catalog['Tickets'].subitems;
  // three since issue #280 added the Inputs tab (Handouts via inputHandoutID)
  eq(subs.length, 3, 'three subitem groups');
  eq(subs.slice(0, 2).map((s) => s.table), ['Processes', 'Tasks'], 'first tabs target Processes and Tasks');
  eq(subs.slice(0, 2).map((s) => s.via), ['processID', 'processID'], 'both join via the processID snapshot');
  eq(subs.every((s) => s.tab), true, 'all are tabbed entries (tab strip renders)');
  eq(subs.some((s) => s.table === 'Jobs'), false, 'Jobs tab gone');
  const tkRow = { ticketID: 'TK-PROBE', processID: ['PR1'] };
  const procs = resolve.childrenOf('Tickets', tkRow, 'Processes', { via: 'processID' });
  eq(procs.map((p) => p.processID), ['PR1'], 'Processes tab resolves the snapshot ids');
  const kids = resolve.childrenOf('Tickets', tkRow, 'Tasks', { via: 'processID' });
  eq(kids.length > 0 && kids.every((t) => t.processID === 'PR1'), true,
    'Tasks tab resolves the tasks of the snapshot processes');
}

console.log('== productScopesForTicket: payload scopes under the SLAs ==');
{
  const all = data.getEntity('Product Scopes').length;
  eq(forms.productScopesForTicket(null, null).length, all, 'no event — every scope (lenient)');
  const p3 = data.getEntity('Payload').find((p) => (p.productScopeID || []).length === 3);
  const got = forms.productScopesForTicket(p3.eventID, null).map((o) => o.value).sort();
  eq(got, [...p3.productScopeID].sort(), 'event with a 3-scope payload offers exactly those');
  // SLA narrowing needs an event with two payloads — synthesize one
  data.addRecord('Payload', { payloadID: 'PLD-T2', payloadCode: 'PLD-T2 (t)',
    eventID: p3.eventID, productScopeID: [p3.productScopeID[0]] });
  data.addRecord('Customers', { customerID: 'CUST-T', customerName: 'Scope Probe (t)' });
  data.addRecord('SLA', { slaID: 'SLA-T', slaCode: 'SLA-T', customerID: 'CUST-T',
    payloadID: ['PLD-T2'], isActive: 'Active' });
  eq(forms.productScopesForTicket(p3.eventID, 'CUST-T').map((o) => o.value),
    [p3.productScopeID[0]], "the customer's SLA narrows to the purchased payload");
  const noSla = forms.productScopesForTicket(p3.eventID, 'NO-SUCH-CUSTOMER').map((o) => o.value).sort();
  eq(noSla, [...new Set([...p3.productScopeID, p3.productScopeID[0]])].sort(),
    'customer without SLA — every payload of the event (lenient)');
  // wildcard payload — empty list = every scope the event admits
  data.addRecord('Events', { eventID: 'EV-T', eventTitle: 'Wildcard Probe (t)' });
  data.addRecord('Payload', { payloadID: 'PLD-TW', payloadCode: 'PLD-TW (t)', eventID: 'EV-T', productScopeID: [] });
  eq(forms.productScopesForTicket('EV-T', null).length,
    forms.productScopesForEvent('EV-T').length, 'wildcard payload widens to the full applicability');
}

console.log('== ticketProcesses + on-save snapshot ==');
{
  eq(forms.ticketProcesses('EV01', null), ['PR1'], "the event's processes, no scope chosen");
  data.addRecord('Processes', { processID: 'PC-T9', processName: 'Scoped Probe (t)',
    eventID: 'EV01', productScopeID: ['PS01'] });
  eq(forms.ticketProcesses('EV01', 'PS01').sort(), ['PC-T9', 'PR1'],
    'empty process list covers every scope; the scoped process matches its own');
  eq(forms.ticketProcesses('EV01', 'PS02'), ['PR1'], 'the scoped process drops on a foreign scope');
  const rec = { eventID: 'EV01', productScopeID: 'PS02' };
  forms.applyDerivedUnits('Tickets', rec);
  eq(rec.processID, ['PR1'], 'save derives the narrowed processID snapshot');
  const legacy = { eventID: 'EV02', processID: 'PR1' };
  forms.applyDerivedUnits('Tickets', legacy);
  eq(legacy.processID, 'PR1', 'events without processes keep the prior snapshot (#192 posture)');
}

console.log('== CERTIFIED-USERS: AND semantics over the task requirement set ==');
{
  data.addRecord('Requirements', { requirementID: 'RQ-T1', requirementName: 'Req Probe 1 (t)' });
  data.addRecord('Requirements', { requirementID: 'RQ-T2', requirementName: 'Req Probe 2 (t)' });
  data.addRecord('Tasks', { taskID: 'TSK-T', taskName: 'Probe Task (t)', processID: 'PR1' });
  data.addRecord('Procedures', { procedureID: 'PROC-T1', procedureRegistry: 'PROC-T1 (t)',
    taskID: 'TSK-T', requirementID: ['RQ-T1', 'RQ-T2'] });
  data.addRecord('Procedures', { procedureID: 'PROC-T2', procedureRegistry: 'PROC-T2 (t)',
    taskID: 'TSK-T', requirementID: ['RQ-T1'] });
  data.addRecord('Procedures', { procedureID: 'PROC-T3', procedureRegistry: 'PROC-T3 (t)',
    taskID: 'TSK-T', requirementID: ['RQ-T2'] });
  data.addRecord('Procedures', { procedureID: 'PROC-T5', procedureRegistry: 'PROC-T5 (t)',
    taskID: 'TSK-T', requirementID: [] });
  data.addRecord('Competence', { competenceID: 'CMP-T1', procedureID: ['PROC-T1'] });
  data.addRecord('Competence', { competenceID: 'CMP-T2', procedureID: ['PROC-T2'] });
  data.addRecord('Competence', { competenceID: 'CMP-T3', procedureID: ['PROC-T3'] });
  data.addRecord('Competence', { competenceID: 'CMP-T5', procedureID: ['PROC-T5'] });
  data.addRecord('Competence', { competenceID: 'CMP-T6', taskID: 'TSK-OTHER', procedureID: ['PROC-T1'] });
  const ob = (id, user, comp, cert) => data.addRecord('Onboarding',
    { onboardID: id, userID: user, competenceID: comp, isCertified: cert });
  ob('OB-T1', 'U-T1', 'CMP-T1', true);   // full cover → in
  ob('OB-T2', 'U-T2', 'CMP-T2', true);   // partial (RQ-T1 only) → out
  ob('OB-T3', 'U-T3', 'CMP-T2', true);   // partial…
  ob('OB-T3b', 'U-T3', 'CMP-T3', true);  // …union across competences covers → in
  ob('OB-T4', 'U-T4', 'CMP-T1', false);  // not certified → out
  ob('OB-T5', 'U-T5', 'CMP-T5', true);   // wildcard procedure certifies all → in
  ob('OB-T6', 'U-T6', 'CMP-T6', true);   // competence names another task → out
  eq(resolve.certifiedUsersForTask('TSK-T').sort(), ['U-T1', 'U-T3', 'U-T5'],
    'certified + AND coverage + cross-competence union + wildcard + task gate');
  data.addRecord('People', { userID: 'U-T1', userName: 'Probe One (t)' });
  const cell = resolve.derivedValue('Tasks', catalog['Tasks'].byName['userID'],
    data.getById('Tasks', 'TSK-T'));
  eq(/Probe One \(t\)/.test(String(cell)), true, 'userID cell renders People names');
  // demo data: every listed user of a real task holds a certified onboarding
  const obs = data.getEntity('Onboarding');
  const demo = resolve.certifiedUsersForTask('012');
  eq(demo.length > 0 && demo.every((u) => obs.some((o) => o.userID === u && o.isCertified === true)),
    true, 'demo task 012 lists only certified people');
}

console.log('== taskName re-seed: stored names match the chain ==');
{
  const wf = Object.fromEntries(data.getEntity('Workflows').map((w) => [w.workflowID, w]));
  const act = Object.fromEntries(data.getEntity('Activities').map((a) => [a.activityID, a]));
  const acts = Object.fromEntries(data.getEntity('Actions').map((a) => [a.actionID, a]));
  const drift = data.getEntity('Tasks').filter((t) => {
    const a = act[(wf[t.workflowID] || {}).activityID] || {};
    const an = (acts[t.actionID] || {}).actionName;
    return a.activityName && an && t.taskName !== `${a.activityName}-${an}`;
  });
  eq(drift.map((t) => t.taskID), [], 'every seeded task carries activityName-actionName');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
