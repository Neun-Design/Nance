#!/usr/bin/env node
// test_engine_prerbac_procedure_filters.mjs — unit-test the pre-RBAC filter
// inputs on Procedures and Handouts (issue #340, the #334 doctrine):
// Procedures regain a stored departmentID (Unit → Department → Process form
// chain; the Process squad grouping is dropped) and Handouts gain
// businessUnitID (single) + departmentID (multi) so the Procedures
// Inputs/Outputs pickers narrow by the chosen department. Seeds re-key the
// procedure unit chain coherently (the pre-#340 rows all carried BU01) and
// every stored pick survives its picker (#281 edit-integrity).
// Run from prototype/:  node tools/test_engine_prerbac_procedure_filters.mjs

import fs from 'fs';
globalThis.fetch = async (p) => new Response(fs.readFileSync(p));

const model = await import('../js/model.js');
const data = await import('../js/data.js');
const { catalog } = await model.loadModel();
data.initMeta(catalog);
await data.loadData();
const forms = await import('../js/forms.js');

let fails = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails += 1; console.log(`  ✗ ${m}`); };
const eq = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));
const asList = (v) => (Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]));

const dm = JSON.parse(fs.readFileSync('data/datamodel.json', 'utf-8'));

console.log('== schema: the two filter chains (sv84) ==');
{
  eq(dm._meta.schemaVersion >= 84, true, `schemaVersion ${dm._meta.schemaVersion} >= 84`);
  const pd = catalog['Procedures'].byName['departmentID'];
  eq(model.parseRule(pd?.rule).kind, 'fk', 'Procedures.departmentID stored FK (re-added)');
  const hu = catalog['Handouts'].byName['businessUnitID'];
  const hd = catalog['Handouts'].byName['departmentID'];
  eq(model.parseRule(hu?.rule).kind, 'fk', 'Handouts.businessUnitID stored FK');
  eq(/multivalued/i.test(hu?.notes || ''), false, 'handout unit is single-valued');
  eq(model.parseRule(hd?.rule).kind, 'fk', 'Handouts.departmentID stored FK');
  eq(/multivalued/i.test(hd?.notes || ''), true, 'handout departments are multivalued');
}

console.log('== Procedures form: Unit → Department → Process, grouping dropped ==');
{
  const f = catalog['Procedures'].form.fields;
  const order = Object.keys(f);
  eq(order.indexOf('Department') > order.indexOf('Unit')
    && order.indexOf('Department') < order.indexOf('Process'), true,
    'Department sits between Unit and Process');
  eq(f['Department'].attribute, 'departmentID', 'bound to the stored FK');
  eq(f['Department'].check, 'Unit IS NOT NULL', 'gated on Unit');
  // #274 trap: the cascade only wires when the rule matches the regex
  eq(/filtered by .*Unit.*selected/i.test(f['Department']['field-rule']), true,
    'Department field-rule names the Unit dep in the wired spelling');
  eq(f['Process'].check, 'Department IS NOT NULL', 'Process gated on Department');
  eq(/filtered by .*Department.*selected/i.test(f['Process']['field-rule']), true,
    'Process filtered by the Department (generic stored-key cascade)');
  eq(/SelectLabel/i.test(String(f['Process']['field-rule'])), false,
    'the squad grouping left the Process rule (redundant under the filter)');
  for (const label of ['Inputs', 'Outputs']) {
    eq(/filtered by .*Department.*selected/i.test(String(f[label]['field-rule'])), true,
      `${label} field-rule names Department (listener wiring)`);
  }
}

console.log('== Handouts form: unit select + department multicheck ==');
{
  const f = catalog['Handouts'].form.fields;
  eq(f['Business Unit']?.attribute, 'businessUnitID', 'Business Unit bound to the FK');
  eq(f['Departments']?.attribute, 'departmentID', 'Departments bound to the FK');
  eq(f['Departments'].check, 'Business Unit IS NOT NULL', 'multicheck gated on the unit');
  const rule = asList(f['Departments']['field-rule']).join('; ');
  eq(/allow multiple/i.test(rule), true, 'multi-assignment spelling');
  eq(/filtered by .*Business Unit.*selected/i.test(rule), true,
    'unit-filtered (generic stored-key cascade on Departments.businessUnitID)');
  const opts = forms.optionsForAttr('Handouts', 'departmentID');
  eq(opts.multi, true, 'department picker is multivalued');
}

console.log('== handoutsForTask: the department dimension ==');
{
  const proc = data.getEntity('Procedures').find((p) => p.departmentID
    && asList(p.taskInput).length);
  eq(!!proc, true, 'a department-keyed procedure with inputs exists');
  const hid = String(asList(proc.taskInput)[0]);
  const h = data.getById('Handouts', hid);
  const vals = (dep) => forms.handoutsForTask(proc.processID, null, null, dep)
    .map((o) => String(o.value));
  eq(vals(null).includes(hid), true, 'no department selected — dimension skipped (lenient)');
  eq(vals(proc.departmentID).includes(hid), true, 'own department — the stored pick is offered');
  // a department that does NOT use this handout
  const foreign = data.getEntity('Departments')
    .map((d) => String(d.departmentID))
    .find((id) => !asList(h.departmentID).map(String).includes(id));
  eq(!!foreign, true, 'a department not serving the handout exists');
  eq(vals(foreign).includes(hid), false, 'foreign department — the handout leaves the picker');
  // Q1: an empty department key stays offered everywhere (live edit + restore)
  const saved = h.departmentID;
  h.departmentID = [];
  eq(vals(foreign).includes(hid), true, 'empty department key = offered everywhere (Q1)');
  h.departmentID = saved;
}

console.log('== seeds: coherent chain, every stored pick survives (#281) ==');
{
  const procs = data.getEntity('Procedures');
  let chain = 0; let reqs = 0; let io = 0;
  for (const p of procs) {
    const pr = data.getById('Processes', p.processID);
    const d = data.getById('Departments', p.departmentID);
    if (pr && d && String(pr.departmentID) === String(p.departmentID)
        && String(d.businessUnitID) === String(p.businessUnitID)) chain += 1;
    const offered = forms.requirementsForUnit(p.businessUnitID).map((o) => String(o.value));
    // issue #364: materialized sets = EVERY Active requirement — ids beyond
    // the unit picker's region gate are the accepted #290 edit-time
    // narrowing trap (region-pinned requirements flow through cross-unit
    // ticket chains, so the materialization must carry them)
    const beyond = asList(p.requirementID).filter((r) => !offered.includes(String(r)));
    const regionPinned = (r) => asList((data.getById('Requirements', r) || {}).regionID).length > 0;
    if (beyond.every(regionPinned)) reqs += 1;
    const opts = forms.handoutsForTask(p.processID, null, null, p.departmentID)
      .map((o) => String(o.value));
    if ([...asList(p.taskInput), ...asList(p.taskOutput)]
      .every((x) => opts.includes(String(x)))) io += 1;
  }
  eq(chain, procs.length, `chain coherence (dept = process's, unit = dept's): ${procs.length}/${procs.length}`);
  eq(reqs, procs.length,
    'requirement picks: in-picker or region-pinned-beyond (#364 accepted narrowing trap)');
  eq(io, procs.length, 'stored Input/Output picks survive the department filter');
  const hs = data.getEntity('Handouts');
  eq(hs.every((h) => 'departmentID' in h && 'businessUnitID' in h), true,
    'every handout row carries both keys (parity)');
  // handout departments = union of the using procedures' departments
  let union = 0;
  for (const h of hs) {
    const want = [];
    for (const p of procs) {
      const used = asList(p.taskInput).map(String).includes(String(h.handoutID))
        || asList(p.taskOutput).map(String).includes(String(h.handoutID));
      if (used && p.departmentID != null && !want.includes(p.departmentID)) want.push(p.departmentID);
    }
    if (JSON.stringify(asList(h.departmentID)) === JSON.stringify(want)) union += 1;
  }
  eq(union, hs.length, 'handout departments = union of the using procedures\' departments');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
