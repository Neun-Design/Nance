#!/usr/bin/env node
// test_engine_branches_org.mjs — proof for the Branches org-structure round
// (issues #168 + #169): businessSegmentID/businessUnitID multivalued, the
// stored departmentID[] replacing unit inheritance, the Segment -> Unit ->
// Departments form cascade and the departmentID-driven subitem join.
// Run from prototype/:  node tools/test_engine_branches_org.mjs

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

console.log('== #168: segment & unit are multivalued ==');
{
  const at = catalog['Branches'].byName;
  eq(/multivalued/i.test(at['businessSegmentID'].notes || ''), true,
    'businessSegmentID declared multivalued');
  eq(/multivalued/i.test(at['businessUnitID'].notes || ''), true,
    'businessUnitID declared multivalued');
  const rows = data.getEntity('Branches');
  eq(rows.every((b) => Array.isArray(b.businessSegmentID) && Array.isArray(b.businessUnitID)),
    true, 'every mockup branch stores arrays');
  // table display still resolves names through the array FK
  const br = data.getById('Branches', 'BR01');
  eq(resolve.fkDisplay({ table: 'Business Units', display: 'businessUnitName' }, br.businessUnitID),
    'Power Transformers', 'array FK still renders the unit name');
}

console.log('== #168: Segment -> Unit cascade (Customers pattern, PR #96) ==');
{
  const f = catalog['Branches'].form.fields;
  eq(f.Segment['field-rule'], 'multivalued', 'Segment select is multi');
  eq(f.Unit.check, 'Segment IS NOT NULL', 'Unit gated on Segment');
  eq(f.Unit['field-rule'], 'filtered by Segment selected', 'Unit filtered by the selected segments');
}

console.log('== #169: stored departmentID[] ==');
{
  const at = catalog['Branches'].byName['departmentID'];
  eq(!!at, true, 'departmentID attribute exists');
  eq(/multivalued/i.test(at.notes || ''), true, 'departmentID declared multivalued');
  const rows = data.getEntity('Branches');
  eq(rows.every((b) => Array.isArray(b.departmentID)), true,
    'every mockup branch carries a seeded department list');
  const br01 = data.getById('Branches', 'BR01');
  eq(br01.departmentID, ['DPT01'], 'BR01 seeded with its unit\'s departments');
}

console.log('== #169: Departments form field gated & filtered by Unit ==');
{
  const f = catalog['Branches'].form.fields.Departments;
  eq(!!f, true, 'Departments field present on the form');
  eq(f.attribute, 'departmentID', 'binds the stored FK');
  eq(f.check, 'Unit IS NOT NULL', 'gated on Unit');
  eq(f['field-rule'], 'filtered by Unit selected', 'options follow the selected units');
  const opts = forms.optionsForAttr('Branches', 'departmentID');
  eq(opts.target, 'Departments', 'options sourced from Departments');
  eq((opts.options || []).length > 0, true, 'department options offered');
}

console.log('== #169: subitem join via departmentID ==');
{
  const si = catalog['Branches'].subitems[0];
  eq([si.table, si.via], ['Departments', 'departmentID'], 'subitem declared via departmentID');
  const br = data.getById('Branches', 'BR01');
  eq(resolve.childrenOf('Branches', br, 'Departments', { via: si.via })
    .map((d) => d.departmentID), ['DPT01'], 'subitem lists the SELECTED departments');
  // selection is authoritative, not inheritance: dropping the department
  // from the branch empties the subitem even though the unit still has it
  data.updateRecord('Branches', 'BR01', { departmentID: [] });
  eq(resolve.childrenOf('Branches', data.getById('Branches', 'BR01'), 'Departments',
    { via: si.via }), [], 'deselected branch shows no departments');
  data.updateRecord('Branches', 'BR01', { departmentID: ['DPT01'] });
}

console.log(fails ? `\nFAILED — ${fails} assertion(s)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
