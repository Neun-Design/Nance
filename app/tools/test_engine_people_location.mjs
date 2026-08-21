#!/usr/bin/env node
// test_engine_people_location.mjs — proof for the People location round
// (issues #170 + #167): a person CAN belong to a Branch but MUST have a
// location (region → country → city). Stored countryName drives the #167
// country column/filter; the Country picker follows the Branches pattern
// (registry-sourced, region-filtered, grouped by continent).
// Run from prototype/:  node tools/test_engine_people_location.mjs

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
const forms = await import('../js/forms.js');

let fails = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails += 1; console.log(`  ✗ ${m}`); };
const eq = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));

console.log('== #170: schema — location mandatory, branch optional ==');
{
  const at = catalog['People'].byName;
  eq(/NOT NULL/.test(at['regionID'].constraints || ''), true, 'regionID stays NOT NULL');
  eq(/NOT NULL/.test(at['countryName'].constraints || ''), true, 'countryName NOT NULL (location is mandatory)');
  eq(/NOT NULL/.test(at['branchID'].constraints || ''), false, 'branchID stays nullable (branch is optional)');
  eq(!!at['cityName'], true, 'cityName present (region → country → city chain)');
  const names = catalog['People'].attrs.map((a) => a.name);
  eq(names.indexOf('countryName'), names.indexOf('regionID') + 1,
    'Country column sits next to Region');
}

console.log('== #167: country column & report filter ==');
{
  const at = catalog['People'].byName;
  eq(at['countryName']['table-display'], true, 'countryName is a table column');
  eq(catalog['People'].tableFilters, true, 'People table has the filter drawer');
  const raw = JSON.parse(fs.readFileSync('data/datamodel.json'));
  const ra = raw.modules.Talent.tables.People.reports['Report-A'];
  eq(ra.filters.includes('countryName') && !ra.filters.includes('locationID'), true,
    'Report-A filters on countryName (legacy locationID dropped)');
}

console.log('== mockup seeding: country/city derive from the branch ==');
{
  const ppl = data.getEntity('People');
  eq(ppl.every((p) => p.countryName != null && p.countryName !== ''), true,
    'every person carries a country');
  const drift = ppl.filter((p) => {
    if (!p.branchID) return false;
    const b = data.getById('Branches', p.branchID);
    return b && String(p.countryName) !== String(b.countryName);
  });
  eq(drift.map((p) => p.userID), [], 'branch-stationed people agree with their branch country');
  const lena = data.getById('People', 'U01');
  eq([lena.countryName, lena.cityName], ['Germany', 'Nuremberg'], 'U01 seeded from BR01');
}

console.log('== form: Country gated on Region, registry-sourced, continent groups ==');
{
  const f = catalog['People'].form.fields;
  eq(Object.keys(f).indexOf('Country'), Object.keys(f).indexOf('Region') + 1,
    'Country input right after Region');
  eq(f.Country.attribute, 'countryName', 'binds the stored FK');
  eq(f.Country.check, 'Region IS NOT NULL', 'gated on Region');
  eq(f.Country['field-rule'], 'SelectLabel = continent; filtered by Region.countryName selected',
    'Branches pattern: continent groups, region-filtered options');
  eq(f.City.attribute, 'cityName', 'City input bound');
  const opt = forms.optionsForAttr('People', 'countryName');
  eq(opt.target, 'Countries', 'picker sourced from the Countries registry');
  eq((opt.options || []).some((o) => o.value === 'Germany'), true, 'options carry country names');
  // record-matching cascade (same branch as Branches.countryName): only the
  // selected region's countries survive
  const emea = data.getEntity('Regions').find((r) => r.regionName === 'EMEA');
  const kept = (opt.options || []).filter((o) => {
    const rec = data.getById('Countries', o.value);
    return rec && emea.countryName.includes(rec.countryName);
  });
  eq(kept.map((o) => o.value), ['Austria', 'Croatia', 'Germany', 'Hungary', 'Italy'],
    'EMEA person Country options collapse to the region countries');
}

console.log(fails ? `\nFAILED — ${fails} assertion(s)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
