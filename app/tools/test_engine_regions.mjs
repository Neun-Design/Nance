#!/usr/bin/env node
// test_engine_regions.mjs — unit-test the Regions entity and the region/
// business-unit-aware requirements applicability (requirements-model.md,
// 2026-07-30): the Regions table, the Customers.regionID FK, the two-hop
// Regions → Business Units join behind the Requirements form cascade, the
// 5-key Workflows requirement rollup with region/unit wildcards, and the
// enum'd Requirements.isActive.
// Run from prototype/:  node tools/test_engine_regions.mjs

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

console.log('== Regions table (migrate_regions.py) ==');
{
  const rows = data.getEntity('Regions');
  eq(rows.map((r) => r.regionName).sort(), ['APAC', 'Americas', 'EMEA'], 'three regions from the legacy enum');
  const stored = data.getEntity('Customers').every((c) => 'regionID' in c && !('region' in c));
  eq(stored, true, 'customers store regionID, legacy region field dropped');
  const shown = resolve.derivedValue('Customers', catalog['Customers'].byName['regionID'],
    data.getEntity('Customers')[0]);
  eq(/^(EMEA|Americas|APAC)$/.test(String(shown)), true, 'Customers.regionID renders the region NAME');
}

console.log('== Regions → Business Units (Requirements form cascade join) ==');
{
  const rg = data.getEntity('Regions').find((r) => r.regionName === 'EMEA');
  const bus = resolve.childrenOf('Regions', rg, 'Business Units').map((b) => b.businessUnitID);
  eq(bus.length > 0, true, `EMEA reaches units through its customers (${bus.join(', ')})`);
}

console.log('== 5-key requirement rollup: region / unit wildcards (Q1 semantics) ==');
{
  // customer in a known region+unit, workflow pointing at PS01's scope/group
  const ps01 = data.getById('Product Scopes', 'PS01');
  const pg = ps01.productGroupID, scope = ps01.scopeID;
  const rgEMEA = data.getEntity('Regions').find((r) => r.regionName === 'EMEA').regionID;
  const rgAPAC = data.getEntity('Regions').find((r) => r.regionName === 'APAC').regionID;
  data.addRecord('Customers', { customerID: 'FCR1', customerName: 'RGT', city: 'Regiontown',
    regionID: rgEMEA, businessUnitID: 'BU01' });
  data.addRecord('Workflows', { workflowID: 'WFR1', workflowName: 'Region WF',
    customerID: ['FCR1'], productScopeID: ['PS01'] });
  const mk = (id, extra) => data.addRecord('Requirements', {
    requirementID: id, requirementName: `${id} (t)`,
    scopeID: [scope], productGroupID: [pg], regionID: [], businessUnitID: [], ...extra });
  mk('RQR-ALL', {});                                   // no region/unit → applies to all
  mk('RQR-EMEA', { regionID: [rgEMEA] });              // matches the customer's region
  mk('RQR-APAC', { regionID: [rgAPAC] });              // other region → excluded
  mk('RQR-BU01', { businessUnitID: ['BU01'] });        // matches the customer's unit
  mk('RQR-BU03', { businessUnitID: ['BU03'] });        // other unit → excluded
  const wf = data.getById('Workflows', 'WFR1');
  const kids = resolve.childrenOf('Workflows', wf, 'Requirements', { viaList: [
    'customerID', 'customerID.regionID', 'customerID.businessUnitID',
    'productScopeID.productGroupID', 'productScopeID.scopeID'] });
  const ids = kids.map((k) => k.requirementID).filter((i) => String(i).startsWith('RQR'));
  eq([ids.includes('RQR-ALL'), ids.includes('RQR-EMEA'), ids.includes('RQR-APAC'),
    ids.includes('RQR-BU01'), ids.includes('RQR-BU03')],
  [true, true, false, true, false],
  'wildcard + region-matched + unit-matched roll up; other region/unit excluded');
  const declared = model.parseRule(catalog['Workflows'].byName['requirements'].rule);
  eq(declared.viaList, ['customerID', 'customerID.regionID', 'customerID.businessUnitID',
    'productScopeID.productGroupID', 'productScopeID.scopeID'], 'datamodel rule declares the 5-key chain');
}

console.log('== Requirements form: enum isActive + region options ==');
{
  const act = forms.optionsForAttr('Requirements', 'isActive');
  eq(act.options && act.options.map((o) => o.value), ['Active', 'Inactive'], 'isActive enum options');
  const stored = data.getEntity('Requirements')
    .filter((r) => !String(r.requirementID).startsWith('RQR'))
    .every((r) => r.isActive === 'Active' || r.isActive === 'Inactive');
  eq(stored, true, 'mockup isActive values migrated to the enum');
  const reg = forms.optionsForAttr('Requirements', 'regionID');
  const names = (reg.options || []).map((o) => o.label).sort();
  eq(names, ['APAC', 'Americas', 'EMEA'], 'Region picker lists region names');
  eq(reg.multi, true, 'Region picker is multivalued');
}

console.log('== derived display through FK (businessUnitTitle) ==');
{
  const bu = data.getEntity('Business Units')[0];
  const title = resolve.fkDisplay({ table: 'Business Units', display: 'businessUnitTitle' },
    bu.businessUnitID);
  eq(/-/.test(String(title)), true, `fkDisplay derives computed display fields (${String(title).slice(0, 40)}…)`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
