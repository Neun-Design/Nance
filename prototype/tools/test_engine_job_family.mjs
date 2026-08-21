#!/usr/bin/env node
// test_engine_job_family.mjs — proof for the Graduation → Job Family rename
// (issue #166, Factories → Customers precedent): renamed pk/label/owner,
// institution dropped (and the CONCAT display that depended on it), FK
// references on Roles/People follow, dashboard report re-keyed.
// Run from prototype/:  node tools/test_engine_job_family.mjs

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

console.log('== #166: table renamed, institution gone ==');
{
  eq(catalog['Graduation'] ?? null, null, 'Graduation table gone from the catalogue');
  const cat = catalog['Job Family'];
  eq([cat.pk, cat.label], ['jobFamilyID', 'jobFamilyName'], 'pk/label renamed');
  eq(cat.byName['institutionName'] ?? null, null, 'institutionName dropped');
  eq(cat.byName['graduationName'] ?? null, null,
    'CONCAT(title + institution) display dropped (name == title now)');
  eq(Object.keys(cat.form.fields), ['Name', 'Field'], 'form: Name + Field only');
  const talent = model.getModules().find((m) => m.name === 'Talent');
  eq(talent.tables.includes('Job Family') && !talent.tables.includes('Graduation'),
    true, 'Job Family holds the Talent tab (Graduation gone)');
}

console.log('== #166: data & FK references follow ==');
{
  const rows = data.getEntity('Job Family');
  eq(rows.length, 4, 'registry rows migrated');
  eq(rows.every((r) => r.jobFamilyID && r.jobFamilyName && !('institutionName' in r)
    && !('graduationName' in r)), true, 'rows carry the renamed keys only');
  const o = forms.optionsForAttr('Roles', 'jobFamilyID');
  eq([o.target, o.multi], ['Job Family', true], 'Roles picker targets Job Family (multivalued)');
  const role = data.getEntity('Roles').find((r) => (r.jobFamilyID || []).includes('G1'));
  const r = model.parseRule(catalog['Roles'].byName['jobFamilyID'].rule);
  eq(resolve.fkDisplay({ table: r.target, display: r.display }, role.jobFamilyID),
    'Electrical Engineering', 'Roles FK cell resolves the family name');
  eq(catalog['People'].byName['jobFamilyID'].rule, 'FK → Job Family (display: jobFamilyName)',
    'People FK follows the rename');
}

console.log(fails ? `\nFAILED — ${fails} assertion(s)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
