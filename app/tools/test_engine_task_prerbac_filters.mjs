#!/usr/bin/env node
// test_engine_task_prerbac_filters.mjs — unit-test the pre-RBAC filter
// inputs on the Tasks form (issue #344, the #334 doctrine, the #340/#342
// chain): stored businessUnitID + departmentID filter FKs — Business Unit
// → Department → Process, with the existing Event leg KEPT (Process =
// `filtered by Event + Department selected`, the generic multi-dep AND).
// The Event select stays unfiltered by unit (session decision: 16/46 demo
// tasks chain events whose unit differs from their department's — a unit
// filter would orphan stored picks).
// Run from prototype/:  node tools/test_engine_task_prerbac_filters.mjs

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
const asList = (v) => (Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]));

const dm = JSON.parse(fs.readFileSync('data/datamodel.json', 'utf-8'));

console.log('== schema: the two filter FKs (sv86) ==');
{
  eq(dm._meta.schemaVersion >= 86, true, `schemaVersion ${dm._meta.schemaVersion} >= 86`);
  const bu = catalog['Tasks'].byName['businessUnitID'];
  const dp = catalog['Tasks'].byName['departmentID'];
  eq(model.parseRule(bu?.rule).kind, 'fk', 'Tasks.businessUnitID stored FK');
  eq(model.parseRule(dp?.rule).kind, 'fk', 'Tasks.departmentID stored FK');
  eq(/does NOT filter the Event/i.test(bu?.notes || ''), true,
    'the unit note records the Event-stays-unfiltered decision');
}

console.log('== form: BU → Department lead; Process = Event ∧ Department ==');
{
  const f = catalog['Tasks'].form.fields;
  const order = Object.keys(f);
  eq(order.slice(0, 4), ['Business Unit', 'Department', 'Event', 'Process'],
    'field order: the doctrine pair leads, Event stays the anchor');
  eq(f['Department'].check, 'Business Unit IS NOT NULL', 'Department gated on the unit');
  eq(/filtered by .*Business Unit.*selected/i.test(f['Department']['field-rule']), true,
    'Department field-rule names the Business Unit dep in the wired spelling (#274)');
  eq([f['Event'].check, f['Event']['field-rule']], [null, null],
    'Event stays ungated and unfiltered (the 16/46 census decision)');
  eq(f['Process'].check, 'Event IS NOT NULL', 'Process gate on Event kept');
  eq(/filtered by .*Event.*\+.*Department.*selected/i.test(f['Process']['field-rule']), true,
    'Process ANDs the Event and Department legs (generic multi-dep cascade)');
  eq(f['Predecessor Task'].check, 'Process IS NOT NULL', 'Predecessor gate untouched (#302)');
}

console.log('== the multi-dep AND has stored keys on both legs ==');
{
  // the generic cascade filters option records by their OWN stored keys —
  // Processes must store eventID and departmentID for the AND to bite
  const pr = catalog['Processes'];
  eq([model.parseRule(pr.byName['eventID'].rule).kind,
    model.parseRule(pr.byName['departmentID'].rule).kind], ['fk', 'fk'],
  'Processes store both legs (eventID #159 + departmentID)');
  const t0 = data.getEntity('Tasks')[0];
  const p0 = data.getById('Processes', t0.processID);
  eq(String(p0.eventID) === String(t0.eventID)
    && String(p0.departmentID) === String(t0.departmentID), true,
  'the seeded process matches BOTH legs of its task');
}

console.log('== seeds: coherent chain + the honest Event-unit census ==');
{
  const tasks = data.getEntity('Tasks');
  eq(tasks.every((t) => 'businessUnitID' in t && 'departmentID' in t), true,
    'every task row carries both keys (parity)');
  let chain = 0; let evDiverge = 0;
  for (const t of tasks) {
    const pr = data.getById('Processes', t.processID);
    const d = data.getById('Departments', t.departmentID);
    if (pr && d && String(pr.departmentID) === String(t.departmentID)
        && String(asList(d.businessUnitID)[0]) === String(t.businessUnitID)) chain += 1;
    const ev = data.getById('Events', t.eventID);
    if (ev && !asList(ev.businessUnitID).map(String).includes(String(t.businessUnitID))) {
      evDiverge += 1;
    }
  }
  eq(chain, tasks.length,
    `chain coherence (dept = process's, unit = dept's): ${tasks.length}/${tasks.length}`);
  // the reason Event is NOT unit-filtered: divergent event units exist —
  // if this census ever drops to 0 the filter becomes revisitable
  eq(evDiverge > 0, true,
    `${evDiverge} tasks chain events of another unit (why Event stays unfiltered)`);
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
