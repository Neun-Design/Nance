#!/usr/bin/env node
// test_engine_workflow_prerbac_filters.mjs — unit-test the pre-RBAC filter
// inputs on the Workflows form (issue #342, the #334 doctrine, the #340
// Procedures chain): stored businessUnitID + departmentID filter FKs,
// cascade Business Unit → Department → Process (the Process select was
// ungated and offered every process). Seeds follow the #340 rule —
// department = the process's, unit = the department's — so every seeded
// chain survives its own pickers (#281 form-integrity).
// Run from prototype/:  node tools/test_engine_workflow_prerbac_filters.mjs

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
const asList = (v) => (Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]));

const dm = JSON.parse(fs.readFileSync('data/datamodel.json', 'utf-8'));

console.log('== schema: the two filter FKs (sv85) ==');
{
  eq(dm._meta.schemaVersion >= 85, true, `schemaVersion ${dm._meta.schemaVersion} >= 85`);
  const bu = catalog['Workflows'].byName['businessUnitID'];
  const dp = catalog['Workflows'].byName['departmentID'];
  eq(model.parseRule(bu?.rule).kind, 'fk', 'Workflows.businessUnitID stored FK');
  eq(model.parseRule(dp?.rule).kind, 'fk', 'Workflows.departmentID stored FK');
  eq(/#342/.test(bu?.notes || '') && /#342/.test(dp?.notes || ''), true,
    'both notes record the pre-RBAC filter round');
}

console.log('== form: Business Unit → Department → Process ==');
{
  const f = catalog['Workflows'].form.fields;
  const order = Object.keys(f);
  eq(order.slice(0, 3), ['Business Unit', 'Department', 'Process'],
    'the chain leads the form in cascade order');
  eq([f['Business Unit'].attribute, f['Department'].attribute],
    ['businessUnitID', 'departmentID'], 'fields bound to the stored FKs');
  eq(f['Department'].check, 'Business Unit IS NOT NULL', 'Department gated on the unit');
  // #274 trap: the cascade only wires when the rule matches the regex
  eq(/filtered by .*Business Unit.*selected/i.test(f['Department']['field-rule']), true,
    'Department field-rule names the Business Unit dep in the wired spelling');
  eq(f['Process'].check, 'Department IS NOT NULL', 'Process gated on the Department');
  eq(/filtered by .*Department.*selected/i.test(f['Process']['field-rule']), true,
    'Process filtered by the Department (generic stored-key cascade)');
  eq(f['Activity'].check, 'Process IS NOT NULL', 'Activity gate untouched');
  eq(/filtered by Process selected/i.test(f['Parent Step']['field-rule']), true,
    'Parent Step filter untouched (#302)');
}

console.log('== joins: unit → departments, department → processes ==');
{
  const kids = (parent, row, child) => resolve.childrenOf(parent, row, child)
    .map((r) => String(r[catalog[child].pk])).sort();
  for (const d of data.getEntity('Departments').slice(0, 3)) {
    const want = data.getEntity('Processes')
      .filter((p) => String(p.departmentID) === String(d.departmentID))
      .map((p) => String(p.processID)).sort();
    eq(kids('Departments', d, 'Processes'), want,
      `${d.departmentID}: processes ${want.join(', ') || 'none'}`);
  }
}

console.log('== seeds: coherent chain — every row survives its pickers ==');
{
  const wfs = data.getEntity('Workflows');
  eq(wfs.every((w) => 'businessUnitID' in w && 'departmentID' in w), true,
    'every workflow row carries both keys (parity)');
  let chain = 0;
  for (const w of wfs) {
    const pr = data.getById('Processes', w.processID);
    const d = data.getById('Departments', w.departmentID);
    if (pr && d && String(pr.departmentID) === String(w.departmentID)
        && String(asList(d.businessUnitID)[0]) === String(w.businessUnitID)) chain += 1;
  }
  eq(chain, wfs.length,
    `chain coherence (dept = process's, unit = dept's): ${wfs.length}/${wfs.length}`);
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
