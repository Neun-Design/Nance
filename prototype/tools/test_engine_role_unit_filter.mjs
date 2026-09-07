#!/usr/bin/env node
// test_engine_role_unit_filter.mjs — unit-test the Roles Business Unit
// filter select (issue #334): a single-valued stored FK whose only job is
// to NARROW the Function options (pre-RBAC filter-input doctrine — until
// RBAC lands, forms carry filter inputs so the MVP serves different
// Business Segments/Units). Pure form-rule round: zero engine changes, the
// generic stored-key cascade on Functions.businessUnitID drives the
// refilter (the #281 proven path).
// Run from prototype/:  node tools/test_engine_role_unit_filter.mjs

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

const dm = JSON.parse(fs.readFileSync('data/datamodel.json', 'utf-8'));

console.log('== schema: single stored unit key, pre-RBAC doctrine noted ==');
{
  eq(dm._meta.schemaVersion >= 81, true, `schemaVersion ${dm._meta.schemaVersion} >= 81`);
  const a = catalog['Roles'].byName['businessUnitID'];
  const r = model.parseRule(a.rule);
  eq([r.kind, model.resolveTable(r.target), r.display],
    ['fk', 'Business Units', 'businessUnitName'], 'FK → Business Units declared');
  eq(/NOT NULL/.test(a.constraints || ''), true, 'NOT NULL (cascade-dep convention)');
  eq(/multivalued/i.test(a.notes || ''), false, 'single-valued (the issue asks single)');
  const opts = forms.optionsForAttr('Roles', 'businessUnitID');
  eq(opts.multi !== true, true, 'form picker is single-select');
  eq(/RBAC/.test(a.notes || ''), true, 'notes record the pre-RBAC filter-input doctrine');
}

console.log('== form: select before Function, gate + wired cascade spelling ==');
{
  const fields = catalog['Roles'].form.fields;
  eq(fields['Business Unit']?.attribute, 'businessUnitID',
    'Business Unit field bound to the FK (not a name mirror)');
  const order = Object.keys(fields);
  eq(order.indexOf('Business Unit') > order.indexOf('Role Name')
    && order.indexOf('Business Unit') < order.indexOf('Function'), true,
    'sits between Role Name and Function');
  const fn = fields['Function'];
  eq(fn.check, 'Business Unit IS NOT NULL', 'Function gated on Business Unit');
  // #274 trap regression: the cascade only wires listeners when the rule
  // matches the `filtered by <deps> selected` regex — free text is dead
  eq(/filtered by .*Business Unit.*selected/i.test(fn['field-rule']), true,
    'Function field-rule names the Business Unit dep in the wired spelling');
  const dept = fields['Departments'];
  eq(dept.check, 'Function IS NOT NULL', 'Departments gate untouched (#328)');
  eq(/filtered by .*Function.*selected/i.test(String(dept['field-rule'])), true,
    'Departments filter untouched (#328)');
}

console.log('== join: the unit narrows to ITS functions (generic stored-key) ==');
{
  const fnsOf = (id) => resolve.childrenOf('Business Units',
    data.getById('Business Units', id), 'Functions')
    .map((f) => String(f.functionID)).sort();
  const expect = {};
  for (const f of data.getEntity('Functions')) {
    for (const u of asList(f.businessUnitID)) {
      (expect[u] = expect[u] || []).push(String(f.functionID));
    }
  }
  for (const u of data.getEntity('Business Units')) {
    const id = u.businessUnitID;
    eq(fnsOf(id), (expect[id] || []).sort(),
      `${u.businessUnitName}: functions ${(expect[id] || []).join(', ') || 'none'}`);
  }
}

console.log('== seeds: unit = the function\'s unit; every row survives the picker ==');
{
  const roles = data.getEntity('Roles');
  eq(roles.every((r) => 'businessUnitID' in r), true, 'every role row carries the key');
  let fromFn = 0; let survive = 0;
  for (const r of roles) {
    const fn = data.getById('Functions', r.functionID);
    const fnUnits = asList(fn?.businessUnitID).map(String);
    if (fnUnits[0] === String(r.businessUnitID)) fromFn += 1;
    // form-integrity: the gated Function picker under the seeded unit must
    // offer the role's own function, else edit-mode wipes the stored FK
    if (fnUnits.includes(String(r.businessUnitID))) survive += 1;
  }
  eq(fromFn, roles.length, `all ${roles.length} units seeded from the function`);
  eq(survive, roles.length, 'all seeded rows survive the gated picker');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
