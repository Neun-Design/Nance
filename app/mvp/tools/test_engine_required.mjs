#!/usr/bin/env node
// test_engine_required.mjs — unit-test the required-fields round (2026-08-01):
// NOT NULL anchors from the datamodel + the label-attr identity rule feeding
// forms.js requiredAttrs/missingRequired (commit blocks on missing), and the
// Q1 wildcard exemption (Requirements applicability keys stay nullable).
// Run from prototype/:  node tools/test_engine_required.mjs

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

console.log('== requiredAttrs: anchors + label ==');
{
  const br = forms.requiredAttrs('Branches');
  eq(['branchName', 'businessSegmentID', 'businessUnitID', 'regionID']
    .every((a) => br.has(a)), true, 'Branches: label + three anchors required');
  eq(br.has('cityName') || br.has('countryName') || br.has('userID'), false,
    'non-anchor Branches fields stay optional');
  const pp = forms.requiredAttrs('People');
  eq(['userName', 'regionID', 'businessUnitID', 'departmentID', 'functionID']
    .every((a) => pp.has(a)), true, 'People: the Region→Unit→Department chain is required');
  eq(pp.has('squadID') || pp.has('branchID'), false,
    'People squad/branch stay nullable by design');
}

console.log('== Q1 wildcards stay nullable ==');
{
  const rq = forms.requiredAttrs('Requirements');
  eq(['regionID', 'businessUnitID', 'customerID', 'branchID'].some((a) => rq.has(a)),
    false, 'Requirements applicability keys (empty = applies to all) not required');
  eq(forms.requiredAttrs('Workflows').has('parentStepID'), false,
    'parentStepID nullable (root step)');
  eq(forms.requiredAttrs('Processes').has('squadID'), false,
    'Processes.squadID stays optional (DPT03 gap)');
}

console.log('== missingRequired: commit gate ==');
{
  const present = new Set(['branchName', 'businessSegmentID', 'businessUnitID', 'regionID', 'cityName']);
  eq(forms.missingRequired('Branches',
    { branchName: 'X', businessSegmentID: 'BS01', businessUnitID: 'BU01', regionID: 'RG01' }, present),
    [], 'complete record passes');
  eq(forms.missingRequired('Branches',
    { branchName: 'X', businessSegmentID: 'BS01', businessUnitID: '', regionID: null }, present),
    ['businessUnitID', 'regionID'], 'empty string and null are both flagged');
  eq(forms.missingRequired('Customers',
    { customerName: 'C', businessSegmentID: ['BS01'], regionID: 'RG01', businessUnitID: [] },
    new Set(['customerName', 'businessSegmentID', 'regionID', 'businessUnitID'])),
    ['businessUnitID'], 'empty multivalued list is flagged');
  // derived-on-save keys are not form controls — never enforced
  eq(forms.missingRequired('Competence', { }, new Set(['roleID'])),
    [], 'attrs absent from the form are skipped (departmentID derives on save)');
}

console.log('== seed data satisfies the new contract ==');
{
  const bad = [];
  for (const [tname, cat] of Object.entries(catalog)) {
    for (const a of Object.values(cat.byName)) {
      if (!/NOT NULL/i.test(String(a.constraints || ''))) continue;
      for (const r of data.getEntity(tname)) {
        const v = r[a.name];
        if (v == null || v === '' || (Array.isArray(v) && !v.length)) bad.push(`${tname}.${a.name}`);
      }
    }
  }
  eq([...new Set(bad)], [], 'no seed row violates a NOT NULL anchor');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
