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
  // geography single-sourced on Branches since issue #191 — the Customers
  // regionID/city/country copies are gone; the region lives on the branch
  eq(catalog['Customers'].byName['regionID'], undefined, 'Customers no longer declare regionID (issue #191)');
  eq(data.getEntity('Customers').every((c) => !('regionID' in c) && !('region' in c)), true,
    'customer seeds carry no region keys');
  const shown = resolve.derivedValue('Branches', catalog['Branches'].byName['regionID'],
    data.getEntity('Branches')[0]);
  eq(/^(EMEA|Americas|APAC)$/.test(String(shown)), true, 'Branches.regionID renders the region NAME');
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
  // 2026-08-01: requirements applicability moved from customers to Branches —
  // the bare customerID leg left the chain (region/unit still derive from the
  // workflow's customer)
  const kids = resolve.childrenOf('Workflows', wf, 'Requirements', { viaList: [
    'customerID.regionID', 'customerID.businessUnitID',
    'productScopeID.productGroupID', 'productScopeID.scopeID'] });
  const ids = kids.map((k) => k.requirementID).filter((i) => String(i).startsWith('RQR'));
  eq([ids.includes('RQR-ALL'), ids.includes('RQR-EMEA'), ids.includes('RQR-APAC'),
    ids.includes('RQR-BU01'), ids.includes('RQR-BU03')],
  [true, true, false, true, false],
  'wildcard + region-matched + unit-matched roll up; other region/unit excluded');
  // 2026-08-04 coherence round: Workflows are applicability-agnostic — the
  // declared 5-key chain moved off the schema (requirements bite at the
  // Procedure); the multiViaJoin assertions above cover the engine itself.
  eq(catalog['Workflows'].byName['requirements'], undefined,
    'Workflows no longer declare a requirements chain (Procedures doctrine)');
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

console.log('== Segment-first Customers cascade (PR #96) ==');
{
  // Unit options follow the selected Segments: join-engine children of each
  // selected Business Segment among Business Units (multivalued deps union)
  const segs = data.getEntity('Business Segments');
  const unitsOf = (id) => resolve.childrenOf('Business Segments',
    segs.find((s) => s.businessSegmentID === id), 'Business Units')
    .map((b) => b.businessUnitID);
  eq(unitsOf('BS01'), ['BU01'], 'BS01 (LPT) reaches BU01');
  eq(unitsOf('BS03'), ['BU02'], 'BS03 (DT) reaches BU02');
  eq(unitsOf('BS04'), ['BU03'], 'BS04 (SG) reaches BU03');
  // the datamodel spells the cascade in engine-readable form: the gate lives
  // in `check`, the option filter in `field-rule` (a "rollup by … selected"
  // suffix inside `check` is invisible to both parsers in forms.js)
  const unit = catalog['Customers'].form.fields.Unit;
  eq(unit.check, 'Segment IS NOT NULL', 'Unit gated on Segment');
  eq(unit['field-rule'], 'filtered by Segment selected', 'Unit filtered by selected Segments');
}

console.log('== Business Units.regionID[] (multivalued, seeded from customers) ==');
{
  const reg = forms.optionsForAttr('Business Units', 'regionID');
  eq(reg.multi, true, 'Region picker on Business Units is multivalued');
  const byId = Object.fromEntries(data.getEntity('Business Units')
    .map((b) => [b.businessUnitID, b.regionID]));
  eq(byId['BU01'], ['RG01', 'RG02', 'RG03'], 'BU01 seeded with the union of its customers’ regions');
  eq(byId['BU03'], [], 'BU03 (no customers) seeded empty');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
