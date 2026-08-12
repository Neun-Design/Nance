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
  eq(org.tables, ['Business Segments', 'Regions', 'Business Units', 'Departments',
    'Squads', 'Branches'], 'Organization order (Issues a hidden registry, Regions tab 2 — 2026-08-03)');
  const pf = model.getModules().find((m) => m.name === 'Portfolio');
  eq(pf.tables, ['Classes', 'Scopes', 'Products', 'Product Specs', 'Product Groups',
    'Events', 'Product Scopes'], 'Portfolio order (Events in from Operation, 2026-08-12 swap)');
  const opMod = model.getModules().find((m) => m.name === 'Operation');
  eq(opMod.tables, ['Tasks', 'Requirements', 'Processes', 'Workflows', 'Handouts',
    'Procedures'], 'Operation order (Requirements in from Portfolio, Events out)');
}

console.log('== Branches seeded from branch customers ==');
{
  const br = data.getById('Branches', 'BR01');
  eq([br.branchName, br.cityName, br.countryName, br.regionID, br.businessUnitID],
    ['PN', 'Nuremberg', 'Germany', 'RG03', ['BU01']], 'BR01 mirrors FC01 (unit multivalued since #168)');
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
  // Regions.continent is DERIVED from the selected countries since
  // 2026-08-03 (the Continent input is gone) — the stored copy was lossy
  const emea = data.getEntity('Regions').find((r) => r.regionName === 'EMEA');
  const contAttr = catalog['Regions'].byName['continent'];
  eq('continent' in emea, false, 'stored continent dropped from the data');
  eq(resolve.derivedValue('Regions', contAttr, emea), 'Europe', 'EMEA derives Europe');
  const amer = data.getEntity('Regions').find((r) => r.regionName === 'Americas');
  eq(resolve.derivedValue('Regions', contAttr, amer), 'North America, South America',
    'Americas derives BOTH continents (the stored value said only North America)');
  eq('Continent' in catalog['Regions'].form.fields, false, 'Continent form input removed');
  const country = catalog['Branches'].form.fields.Country;
  eq(country['field-rule'], 'SelectLabel = continent; filtered by Region.countryName selected',
    'country grouped by continent, record-matched on the region countries');
}

console.log('== Regions.countryName drives the Branches Country picker ==');
{
  const emea = data.getEntity('Regions').find((r) => r.regionName === 'EMEA');
  eq(emea.countryName.includes('Germany') && !emea.countryName.includes('Brazil'), true,
    'EMEA countries seeded from its branches');
  const opt = forms.optionsForAttr('Regions', 'countryName');
  eq([opt.target, opt.multi], ['Countries', true], 'Regions Country picker: registry-sourced, multivalued');
  eq(catalog['Regions'].form.fields.Country['field-rule'],
    'Allow multiple values; SelectLabel = continent', 'grouped multi-select on the Regions form');
  // record-matching cascade (forms.js "Dep.field" branch): a Branches country
  // option survives only when the Countries row shares countryName with the
  // selected Region record
  const all = forms.optionsForAttr('Branches', 'countryName').options;
  const kept = all.filter((o) => {
    const rec = data.getById('Countries', o.value);
    return rec && emea.countryName.includes(rec.countryName);
  });
  eq(kept.map((o) => o.value), ['Austria', 'Croatia', 'Germany', 'Hungary', 'Italy'],
    'EMEA branch Country options collapse to the region countries');
}

console.log('== Branches <-> Customers link (v3-review D1, option 1) ==');
{
  eq(data.getById('Branches', 'BR01').customerID, 'FC01', 'BR01 linked to its mirror customer');
  eq(data.getEntity('Branches').every((b) => b.customerID), true, 'all demo branches linked');
  const r = model.parseRule(catalog['Branches'].byName['customerID'].rule);
  eq([r.target, r.filter], ['Customers', { field: 'customerType', value: 'branch' }],
    'FK filtered to branch-type customers');
  const opt = forms.optionsForAttr('Branches', 'customerID',
    catalog['Branches'].byName['customerID'].rule);
  eq(opt.options.every((o) => data.getById('Customers', o.value).customerType === 'branch'),
    true, 'option list only offers branch-type customers');
  // geography agreement (the validator warns on drift; here it must hold)
  const drift = data.getEntity('Branches').filter((b) => {
    const c = data.getById('Customers', b.customerID);
    return c && (String(b.cityName) !== String(c.city)
      || String(b.countryName) !== String(c.country)
      || String(b.regionID) !== String(c.regionID));
  });
  eq(drift.map((b) => b.branchID), [], 'linked pairs agree on city/country/region');
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

console.log('== Issues classify by Unit again (2026-08-03 reversal, hidden registry) ==');
{
  eq(data.getById('Issues', 'IS02').businessUnitID, 'BU01', 'unit kept from the legacy value');
  eq('businessSegmentID' in data.getById('Issues', 'IS02'), false, 'segment key dropped');
  eq(catalog['Issues'].form.fields.Unit.attribute, 'businessUnitID', 'form input is Unit (segment = group header)');
  eq('Segment' in catalog['Issues'].form.fields, false, 'Segment input removed');
  const bu = catalog['Issues'].attrs.filter((a) => a.name === 'businessUnitID');
  eq(bu.length, 1, 'single businessUnitID attribute (duplicate merged)');
}

console.log('== Scopes: order, Opportunity hidden, Classification ==');
{
  eq(Object.keys(catalog['Scopes'].form.fields),
    ['Code', 'Name', 'Description', 'Business Unit', 'Classification'],
    'field order per spec (Description added by #181, Opportunity hidden by #174)');
  // #174: the Issue/Opportunity concept awaits reframing — the INPUT is gone
  // but the stored attribute (and existing values) survive
  eq('Opportunity' in catalog['Scopes'].form.fields, false, 'Opportunity input removed');
  eq(!!catalog['Scopes'].byName['scopeOpportunity'], true, 'scopeOpportunity attr kept');
  eq(forms.optionsForAttr('Scopes', 'scopeClassID').target, 'Classes', 'Classification lists Classes');
}

console.log('== drill-down subitems: Regions -> Units -> Branches -> Departments ==');
{
  eq(catalog['Regions'].subitems.map((s) => s.table), ['Business Units'],
    'Regions shows only Business Units (Customers subitem dropped)');
  eq(catalog['Business Units'].subitems.map((s) => s.table), ['Branches'],
    'Business Units drills into Branches');
  const brSi = catalog['Branches'].subitems[0];
  eq([brSi.table, brSi.via], ['Departments', 'departmentID'],
    'Branches -> Departments joined via the stored departmentID (#169)');
  const br = data.getById('Branches', 'BR01');
  eq(resolve.childrenOf('Branches', br, 'Departments', { via: brSi.via }).map((d) => d.departmentID),
    ['DPT01'], 'BR01 resolves its selected departments');
  const bu = data.getById('Business Units', 'BU01');
  eq(resolve.childrenOf('Business Units', bu, 'Branches').length > 0, true,
    'BU01 resolves its branches');
}

console.log('== Classes registry & subitem ==');
{
  eq(data.getEntity('Classes').length, 0, 'registry starts blank');
  data.addRecord('Classes', { scopeClassID: 'SC1', scopeClassName: 'Thermal' });
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

console.log('== customer-branch link authored on the Customer form (2026-08-03) ==');
{
  eq('Customer' in catalog['Branches'].form.fields, false, 'Branches form has no Customer input');
  eq(catalog['Customers'].form.fields.Branch.attribute, 'branchID', 'Customers form gained the Branch picker');
  eq(catalog['Customers'].byName['branchID'].type, 'mirror', 'Customers.branchID is a display mirror (nothing stored)');
  // save-path: picking BR02 for a new customer stamps the branch; deselect clears
  const rec = { customerID: 'FC98', customerName: 'Probe Customer', branchID: ['BR02'] };
  forms.applyCustomerBranches('Customers', rec, 'customerID');
  eq('branchID' in rec, false, 'collected branchID consumed, not stored on the customer');
  eq(data.getById('Branches', 'BR02').customerID, 'FC98', 'selected branch stamped with the customer');
  const rec2 = { customerID: 'FC98', branchID: [] };
  forms.applyCustomerBranches('Customers', rec2, 'customerID');
  eq(data.getById('Branches', 'BR02').customerID, null, 'deselecting clears the branch link');
  // restore the seeded owner so later assertions stay untouched
  data.updateRecord('Branches', 'BR02', { customerID: 'FC02' });
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');

process.exit(fails ? 1 : 0);
