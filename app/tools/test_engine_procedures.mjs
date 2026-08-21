#!/usr/bin/env node
// test_engine_procedures.mjs — proof suite for the Procedures round
// (v3-review Iterations, 2026-08-03): Process/Workflow/Task stay
// requirement-free, the Procedure carries the requirement set and the
// input/output handouts (A5), Competence certifies procedures (requirements
// derive through them), procedureOwner exists (A6).
// Run from prototype/:  node tools/test_engine_procedures.mjs

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

console.log('== schema: stored FKs, owner, label ==');
{
  const cat = catalog['Procedures'];
  eq(!!cat, true, 'Procedures catalogued in Operation');
  eq(cat.label, 'procedureRegistry', 'label attribute is the registry code');
  // departmentID left Procedures in the payload round (issue #159); productScopeID joined
  for (const name of ['businessUnitID', 'processID', 'taskID', 'productScopeID', 'requirementID', 'procedureOwner']) {
    const r = model.parseRule(cat.byName[name].rule);
    eq(r && r.kind, 'fk', `${name} is a stored FK rule (not a rollup)`);
  }
  eq(model.parseRule(catalog['Tasks'].byName['procedureID'].rule).kind, 'rollup',
    'Tasks.procedureID stays the derived rollup');
  eq(catalog['Tasks'].byName['taskInput'], undefined, 'Tasks no longer owns taskInput (A5)');
  eq(catalog['Channels'] != null, true, 'Channels stays catalogued (hidden registry, A4)');
  eq(model.getSchemaVersion() >= 6, true, 'schemaVersion at least 6 (Procedures round)');
}

console.log('== migration: seeds and links ==');
{
  const procs = data.getEntity('Procedures');
  const tasks = data.getEntity('Tasks');
  eq(procs.length, tasks.length, 'one procedure per demo task');
  eq(procs.every((p) => p.taskID != null && p.procedureRegistry), true,
    'every procedure anchors a task and carries a registry code');
  eq(tasks.every((t) => !('procedureName' in t) && !('taskInput' in t)), true,
    'legacy procedure/handout fields dropped from Tasks');
  const p1 = data.getById('Procedures', 'PRC01');
  eq([p1.taskID, p1.requirementID], ['012', ['CN1', 'CN4']],
    'PRC01 carries task 012 and the competence-derived requirement set');
  eq(p1.procedureOwner != null, true, 'procedureOwner seeded (A6)');
}

console.log('== Competence: certifies procedures, requirements derive ==');
{
  const comp = data.getById('Competence', 'CMP01');
  eq(comp.procedureID, 'PRC01', 'CMP01 links its task\'s procedure (single-valued since #231)');
  eq('requirementID' in comp, false, 'stored requirementID dropped');
  const attr = catalog['Competence'].byName['requirementID'];
  const names = String(resolve.derivedValue('Competence', attr, comp));
  eq(/IEC 60076|Max Tank|CN/.test(names) && !/^CN\d/.test(names), true,
    `requirement names derive via the procedure (${names.slice(0, 60)})`);
}

console.log('== staffing: certified-responsible still resolves via procedures ==');
{
  // any ticket with a scope should still find at least one certified person
  const ticket = data.getEntity('Tickets').find((t) => t.scopes || t.scopeID);
  const { options } = forms.optionsForAttr('Competence', 'procedureID');
  eq((options || []).length > 0, true, 'Competence Procedure select offers options');
  eq(ticket != null, true, `staffing probe ticket found (${ticket && ticket.ticketID})`);
}

console.log('== requirementsForTask: options follow the task\'s derived set ==');
{
  const all = forms.requirementsForTask(null);
  // the picker is the requirement decision point since #231 — Inactive
  // requirements (CN8 in the demo) are never offered
  const active = data.getEntity('Requirements')
    .filter((r) => String(r.isActive || 'Active') !== 'Inactive');
  eq(all.length, active.length, 'no task -> every ACTIVE requirement offered');
  const task = data.getEntity('Tasks').find((t) => t.workflowID);
  const opts = forms.requirementsForTask(task.taskID);
  eq(opts.length > 0, true, `task ${task.taskID} offers ${opts.length} requirement(s)`);
  eq(opts.every((o) => /[A-Za-z]{3,}/.test(o.label)), true, 'options are display names');
}

console.log('== handouts: ownership resolves through procedures ==');
{
  const proc = data.getEntity('Procedures').find((p) => (p.taskInput || []).length);
  eq(proc != null, true, `a procedure carries inputs (${proc && proc.procedureID})`);
  const task = data.getById('Tasks', proc.taskID);
  // a linked handout is offered on its owning chain, refused off-chain
  const onChain = forms.handoutsForTask(task.processID, null, null);
  eq(onChain.some((o) => (proc.taskInput || []).includes(o.value)), true,
    'linked handout offered on the owning process chain');
  const kids = resolve.childrenOf('Tasks', task, 'Procedures', {});
  eq(kids.some((k) => k.procedureID === proc.procedureID), true,
    'Tasks → Procedures subitem join resolves');
}

console.log('== executionTime lives on Procedures (2026-08-04) ==');
{
  eq(catalog['Procedures'].byName['executionTime'].type, 'DECIMAL', 'stored per procedure');
  eq(catalog['Tasks'].byName['executionTime'].type, 'mirror', 'task time is derived');
  eq('Execution Time' in catalog['Tasks'].form.fields, false, 'Tasks form input removed');
  eq(catalog['Procedures'].form.fields['Execution Time'].attribute, 'executionTime',
    'Procedures form gained the input');
  const t = data.getById('Tasks', '012');
  eq('executionTime' in t, false, 'stored task key dropped');
  eq(resolve.derivedValue('Tasks', catalog['Tasks'].byName['executionTime'], t),
    data.getById('Procedures', 'PRC01').executionTime, 'task derives the sum of its procedures');
  const ev = data.getEntity('Events').find((e) => e.eventID === 'EV01');
  eq(resolve.derivedValue('Events', catalog['Events'].byName['executionTime'], ev) > 0, true,
    'Events nested sum resolves through the derived task time');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
