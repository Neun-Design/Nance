#!/usr/bin/env node
// test_engine_branches.mjs — unit-test the 2026-08-01 stakeholder round:
// the Branches table (segment/unit/region/country cascade, Manager-filtered
// owner), the Countries registry, Regions.continent, Issues by segment in
// the Organization module, Scope Classes, and the People/Requirements
// branchID renames. Run from prototype/:  node tools/test_engine_branches.mjs

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

console.log('== module map & dashboard order ==');
{
  const org = model.getModules().find((m) => m.name === 'Organization');
  eq(org.tables, ['Business Segments', 'Issues', 'Business Units', 'Departments',
    'Squads', 'Regions', 'Branches'], 'Organization order (Countries hidden)');
  const pf = model.getModules().find((m) => m.name === 'Portfolio');
  eq(pf.tables, ['Classes', 'Scopes', 'Products', 'Product Specs', 'Product Groups',
    'Requirements', 'Product Scopes'], 'Portfolio order (Issues moved out)');
}

console.log('== Branches seeded from branch customers ==');
{
  const br = data.getById('Branches', 'BR01');
  eq([br.branchName, br.cityName, br.countryName, br.regionID, br.businessUnitID],
    ['PN', 'Nuremberg', 'Germany', 'RG03', 'BU01'], 'BR01 mirrors FC01');
  eq(data.getEntity('Branches').length >= 6, true, 'branches present in both copies');
  const usa = data.getEntity('Branches').filter((b) => b.countryName === 'USA');
  eq(usa.length, 0, 'legacy USA spelling normalized to United States');
}

console.log('== Countries system registry & continent cascade basis ==');
{
  eq(data.getEntity('Countries').length > 150, true, 'country list loads from data/countries.json');
  eq(catalog['Countries'].systemRegistry, true, 'flagged system-registry (no "+" add-new, skipped by mockup parity)');
  const mock = JSON.parse(fs.readFileSync('data/mockup_data_prototype.json'));
  eq('Countries' in (mock.Organization || {}), false, 'mockup no longer carries country rows');
  eq(data.getById('Countries', 'Germany').continent, 'Europe', 'name-valued PK resolves');
  const opt = forms.optionsForAttr('Branches', 'countryName');
  eq(opt.target, 'Countries', 'country picker sourced from the registry');
  eq((opt.options || []).some((o) => o.value === 'Brazil'), true, 'options carry country names');
  const emea = data.getEntity('Regions').find((r) => r.regionName === 'EMEA');
  eq(emea.continent, 'Europe', 'Regions.continent demo default');
  const country = catalog['Branches'].form.fields.Country;
  eq(country['field-rule'], 'SelectLabel = continent; filtered by Region.continent selected',
    'country grouped by continent, record-matched on the region continent');
}

console.log('== Branches Owner: everyone, grouped by function ==');
{
  const r = model.parseRule(catalog['Branches'].byName['userID'].rule);
  eq(r.filter ?? null, null, 'no function filter on the rule (2026-08-01 revision)');
  const opt = forms.optionsForAttr('Branches', 'userID');
  eq((opt.options || []).length, data.getEntity('People').length, 'every person is offered');
  eq(catalog['Branches'].form.fields.Owner['field-rule'], 'SelectLabel = functionName',
    'options grouped by functionName');
}

console.log('== Issues by segment in Organization ==');
{
  eq(data.getById('Issues', 'IS02').businessSegmentID, 'BS01', 'segment seeded from the legacy unit');
  eq(catalog['Issues'].form.fields.Segment.attribute, 'businessSegmentID', 'form input is Segment');
  eq('Business Unit' in catalog['Issues'].form.fields, false, 'Business Unit input removed');
}

console.log('== Scopes: order, Opportunity matching, Classification ==');
{
  eq(Object.keys(catalog['Scopes'].form.fields),
    ['Code', 'Name', 'Business Unit', 'Opportunity', 'Classification'], 'field order per spec');
  eq(catalog['Scopes'].form.fields.Opportunity['field-rule'],
    'SelectLabel = issueType; filtered by Business Unit.businessSegmentID selected',
    'issues record-matched on the unit segments, grouped by issueType');
  eq(forms.optionsForAttr('Scopes', 'scopeClassID').target, 'Classes', 'Classification lists Classes');
}

console.log('== drill-down subitems: Regions -> Units -> Branches -> Departments ==');
{
  eq(catalog['Regions'].subitems.map((s) => s.table), ['Business Units'],
    'Regions shows only Business Units (Customers subitem dropped)');
  eq(catalog['Business Units'].subitems.map((s) => s.table), ['Branches'],
    'Business Units drills into Branches');
  const brSi = catalog['Branches'].subitems[0];
  eq([brSi.table, brSi.via], ['Departments', 'businessUnitID'],
    'Branches -> Departments joined via businessUnitID');
  const br = data.getById('Branches', 'BR01');
  eq(resolve.childrenOf('Branches', br, 'Departments', { via: brSi.via }).map((d) => d.departmentID),
    ['DPT01'], 'BR01 resolves the departments of its unit');
  const bu = data.getById('Business Units', 'BU01');
  eq(resolve.childrenOf('Business Units', bu, 'Branches').length > 0, true,
    'BU01 resolves its branches');
}

console.log('== Classes registry & subitem ==');
{
  eq(data.getEntity('Classes').length, 0, 'registry starts blank');
  data.addRecord('Classes', { scopeClassID: 'SC1', scopeClassName: 'Thermal', issueID: 'IS02' });
  data.updateRecord('Scopes', data.getEntity('Scopes')[0].scopeID, { scopeClassID: ['SC1'] });
  const cls = data.getById('Classes', 'SC1');
  const kids = resolve.childrenOf('Classes', cls, 'Scopes');
  eq(kids.length, 1, 'Classes -> Scopes subitem join (multivalued back-ref)');
}

console.log('== branchID renames (People / Requirements) ==');
{
  eq(forms.optionsForAttr('People', 'branchID').target, 'Branches', 'People Branch field queries Branches');
  eq(data.getEntity('People').filter((p) => 'customerID' in p).length, 0, 'People legacy key gone');
  eq(String(data.getEntity('People').find((p) => p.userID === 'U01').branchID).startsWith('BR'),
    true, 'People branch values converted FC -> BR');
  eq(forms.optionsForAttr('Requirements', 'branchID').target, 'Branches', 'Requirements Branch applicability');
  eq(catalog['Requirements'].form.fields.Branch.attribute, 'branchID', 'Requirements form field renamed');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
