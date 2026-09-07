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
  eq(Object.keys(cat.form.fields), ['Name', 'Description'],
    'form: Name + Description (field → jobFamilyDescription textarea, #328)');
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
  // issue #328: roles no longer pick a family — the link inverted onto the
  // Function; the frozen pre-#328 rows keep the stored key as tolerated legacy
  eq(catalog['Roles'].byName['jobFamilyID'] ?? null, null,
    'Roles.jobFamilyID left the catalogue (#328 — family inherits via Function)');
  eq(data.getEntity('Roles').some((r) => (r.jobFamilyID || []).includes('G1')), true,
    'frozen rows keep the legacy stored key (tolerated, #284 posture)');
  // issue #298: People derive the family through their Function since the
  // function↔family link landed — the stored FK became a mirror
  eq(catalog['People'].byName['jobFamilyID'].rule,
    'mirror → Functions (via: functionID) (display: jobFamilyName)',
    'People family derives through the function (#298)');
}

console.log(fails ? `\nFAILED — ${fails} assertion(s)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
