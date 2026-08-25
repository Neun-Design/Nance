#!/usr/bin/env node
// test_engine_forecast_region.mjs — unit-test the Forecast Scopes region
// re-point (issue #230): since #191 Customers store no geography, so the old
// `forecastID.customerID.regionID` leg resolved [] and multiViaJoin silently
// skipped the region constraint — region-specific requirements matched every
// forecast scope. The leg now reads the customer's units' SERVED regions
// (`forecastID.customerID.businessUnitID.regionID`, Business Units.regionID —
// the #226 ticket-inheritance posture), which the dotted-path engine can
// traverse (the Branches alternative is a reverse join, inexpressible today).
// Run from prototype/:  node tools/test_engine_forecast_region.mjs

import fs from 'fs';
// Pinned to the FROZEN transformer reference dataset (F3, Vitalis swap):
// known reference rows — BU01 serves RG01–RG03, BU03 serves none.
globalThis.__MOCKUP_PATH__ = 'tools/testdata/mockup_transformers.json';

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

const reqAttr = catalog['Forecast Scopes'].byName['requirementID'];
const rule = model.parseRule(reqAttr.rule);

console.log('== schema: the region leg reads the units\' served regions ==');
{
  eq(rule.viaList, ['forecastID.customerID.businessUnitID.regionID',
    'forecastID.customerID.businessUnitID', 'scopeID', 'productGroupID'],
  'declared via chain re-pointed (dormant customerID.regionID leg gone)');
  // the premise of #230: geography left Customers at #191 — the old path
  // has no stored hop to traverse
  eq(catalog['Customers'].byName['regionID'], undefined,
    'Customers still declare no regionID (issue #191)');
}

// synthetic applicability context: a unit serving ONLY EMEA, a customer on
// it, a forecast for that customer, and a demand line on PS01's scope/group
const ps01 = data.getById('Product Scopes', 'PS01');
const rgEMEA = data.getEntity('Regions').find((r) => r.regionName === 'EMEA').regionID;
const rgAPAC = data.getEntity('Regions').find((r) => r.regionName === 'APAC').regionID;
data.addRecord('Business Units', { businessUnitID: 'BUR1', businessUnitName: 'Region Unit',
  regionID: [rgEMEA] });
data.addRecord('Customers', { customerID: 'FCR1', customerName: 'Region Cust',
  businessUnitID: ['BUR1'] });
data.addRecord('Forecasts', { forecastID: 'FRCR1', customerID: 'FCR1' });
data.addRecord('Forecast Scopes', { forecastScopeID: 'FSR1', forecastID: 'FRCR1',
  scopeID: ps01.scopeID, productGroupID: ps01.productGroupID });
const mk = (id, extra) => data.addRecord('Requirements', {
  requirementID: id, requirementName: `${id} (t)`, isActive: 'Active',
  scopeID: [ps01.scopeID], productGroupID: [ps01.productGroupID],
  regionID: [], businessUnitID: [], ...extra });
mk('RQF-ALL', {});                              // no region/unit → applies to all
mk('RQF-EMEA', { regionID: [rgEMEA] });         // unit serves EMEA → matches
mk('RQF-APAC', { regionID: [rgAPAC] });         // unserved region → excluded
mk('RQF-BUR1', { businessUnitID: ['BUR1'] });   // customer's unit → matches
mk('RQF-BU01', { businessUnitID: ['BU01'] });   // other unit → excluded
const fsr1 = data.getById('Forecast Scopes', 'FSR1');

console.log('== path engine: dormant leg vs served-regions leg ==');
{
  eq(resolve.pathValues('Forecast Scopes', fsr1, 'forecastID.customerID.regionID'), [],
    'old path still resolves EMPTY (the #230 dormancy)');
  eq(resolve.pathValues('Forecast Scopes', fsr1, 'forecastID.customerID.businessUnitID.regionID'),
    [rgEMEA], 'new path reaches the unit\'s served regions');
}

console.log('== region dimension bites again (declared rule, AND + Q1) ==');
{
  const kids = resolve.childrenOf('Forecast Scopes', fsr1, 'Requirements',
    { viaList: rule.viaList });
  const ids = kids.map((k) => k.requirementID).filter((i) => String(i).startsWith('RQF'));
  eq([ids.includes('RQF-ALL'), ids.includes('RQF-EMEA'), ids.includes('RQF-APAC'),
    ids.includes('RQF-BUR1'), ids.includes('RQF-BU01')],
  [true, true, false, true, false],
  'wildcard + served-region + own-unit roll up; unserved region / other unit excluded');
  const shown = String(resolve.derivedValue('Forecast Scopes', reqAttr, fsr1));
  eq(shown.includes('RQF-EMEA (t)') && !shown.includes('RQF-APAC (t)'), true,
    `derivedValue renders the narrowed set (${shown.slice(0, 60)}…)`);
}

console.log('== lenient posture: a unit serving no region skips the dimension ==');
{
  // BU03 is seeded with regionID [] (no customers at migration time) — the
  // path resolves empty, so region-specific requirements stay admitted
  // (multiViaJoin posture: a blank context side skips its dimension)
  eq(data.getById('Business Units', 'BU03').regionID, [], 'BU03 serves no region (premise)');
  data.addRecord('Customers', { customerID: 'FCR2', customerName: 'No-region Cust',
    businessUnitID: ['BU03'] });
  data.addRecord('Forecasts', { forecastID: 'FRCR2', customerID: 'FCR2' });
  data.addRecord('Forecast Scopes', { forecastScopeID: 'FSR2', forecastID: 'FRCR2',
    scopeID: ps01.scopeID, productGroupID: ps01.productGroupID });
  const fsr2 = data.getById('Forecast Scopes', 'FSR2');
  const ids = resolve.childrenOf('Forecast Scopes', fsr2, 'Requirements',
    { viaList: rule.viaList }).map((k) => k.requirementID);
  eq([ids.includes('RQF-EMEA'), ids.includes('RQF-APAC')], [true, true],
    'region-specific requirements admitted when the unit serves no region');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
