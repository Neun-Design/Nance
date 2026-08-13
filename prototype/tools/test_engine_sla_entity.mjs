#!/usr/bin/env node
// test_engine_sla_entity.mjs — proof suite for issue #179 (Sponsors
// Presentation P3): the SLA entity lands in CRM (tab 2) — the contract by
// which a Customer purchases Payloads from a Department. Stored FK chain
// Business Unit → Customer/Branch/Department → Payloads (multivalued,
// unit-filtered, grouped by event); events/product scopes derive through
// the purchased payloads (computed via: payloadID); Customers' subitem
// swaps Forecasts → SLA. Run from prototype/:  node tools/test_engine_sla_entity.mjs

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

console.log('== schema: SLA catalogued in CRM, tab 2 ==');
{
  const cat = catalog['SLA'];
  eq(!!cat, true, 'SLA catalogued');
  eq(cat.pk, 'slaID', 'PK is slaID');
  eq(cat.label, 'slaTitle', 'label = slaTitle (derived CONCAT — mirror attrs stay label candidates)');
  for (const name of ['businessUnitID', 'customerID', 'branchID', 'departmentID', 'payloadID', 'slaOwner']) {
    const r = model.parseRule(cat.byName[name].rule);
    eq(r && r.kind, 'fk', `${name} is a stored FK rule (not a rollup — the picker must store PKs)`);
  }
  const crm = model.getModules().find((m) => m.name === 'CRM');
  eq(crm.tables.slice(0, 2), ['Customers', 'SLA'], 'CRM order: Customers 1, SLA 2');
  eq(model.getSchemaVersion() >= 31, true, 'schemaVersion bumped to at least 31');
}

console.log('== form spec: BU-anchored cascade, payloads grouped by event ==');
{
  const dmRaw = JSON.parse(fs.readFileSync(new URL('../data/datamodel.json', import.meta.url)));
  const spec = dmRaw.modules.CRM.tables.SLA;
  const f = spec.form.fields;
  eq(f.Customer.check, 'Business Unit IS NOT NULL', 'Customer gated on the unit');
  eq(f.Branch.check, 'Customer IS NOT NULL', 'Branch gated on the customer');
  eq(f.Department['field-rule'], 'filtered by businessUnitID selected',
    'Department unit-filtered (spec gated on Branch — Departments carry no branch key)');
  eq(f.Payloads.attribute, 'payloadID', 'Payloads binds the FK');
  const rule = f.Payloads['field-rule'].join('; ');
  eq(/Allow multiple/i.test(rule) && /SelectLabel = eventTitle/.test(rule), true,
    'Payloads multivalued, grouped by event title');
  const opt = forms.optionsForAttr('SLA', 'payloadID', catalog['SLA'].byName['payloadID'].rule);
  eq(opt.target, 'Payload', 'Payloads picker sourced from the Payload table');
  // Customers subitem now lists the customer's contracts
  eq(dmRaw.modules.CRM.tables.Customers['subitem-tables'], ['SLA'], 'Customers subitem swaps Forecasts → SLA');
  eq(model.childKeyFor('SLA', 'Customers'), 'customerID', 'subitem join key resolves (SLA.customerID)');
}

console.log('== derived chain: events/product scopes through the payloads ==');
{
  const cat = catalog['SLA'];
  const sla = data.getEntity('SLA').find((s) => (s.payloadID || []).length);
  eq(!!sla, true, `an SLA with purchased payloads exists (${sla && sla.slaID})`);
  const events = String(resolve.derivedValue('SLA', cat.byName['eventID'], sla));
  const wantTitle = data.getById('Events', data.getById('Payload', sla.payloadID[0]).eventID).eventTitle;
  eq(events.includes(wantTitle), true, `eventID derives the payload events (saw "${wantTitle}")`);
  const scopes = String(resolve.derivedValue('SLA', cat.byName['productScopeName'], sla));
  eq(scopes.length > 0 && scopes !== '—' && !/^\d+$/.test(scopes), true,
    `productScopeName derives display names, not counts (saw "${scopes.slice(0, 60)}")`);
  const title = String(resolve.derivedValue('SLA', cat.byName['slaTitle'], sla));
  const unitName = data.getById('Business Units', sla.businessUnitID).businessUnitName;
  eq(title.startsWith(sla.slaCode) && title.includes(unitName), true,
    `slaTitle CONCAT resolves code AND unit/department names — plain field parts, the "X from FK" spelling is not implemented (saw "${title}")`);
}

console.log('== seeds: one SLA per customer, unit-consistent ==');
{
  const slas = data.getEntity('SLA');
  const customers = data.getEntity('Customers');
  eq(slas.length, customers.length, `one SLA per customer (${slas.length})`);
  const stored = ['slaID', 'slaCode', 'businessUnitID', 'customerID', 'branchID', 'departmentID', 'payloadID', 'isActive', 'slaOwner'];
  eq(slas.every((s) => stored.every((k) => k in s)), true, 'every row seeds all stored attrs (parity)');
  eq(slas.every((s) => {
    const dep = data.getById('Departments', s.departmentID);
    return dep && dep.businessUnitID === s.businessUnitID;
  }), true, 'providing department belongs to the SLA unit');
  eq(slas.every((s) => (s.payloadID || []).every((id) => {
    const p = data.getById('Payload', id);
    return p && p.businessUnitID === s.businessUnitID;
  })), true, 'purchased payloads belong to the SLA unit');
  eq(slas.every((s) => !s.branchID || (data.getById('Branches', s.branchID) || {}).customerID === s.customerID),
    true, 'branch, when present, belongs to the contracting customer');
  eq(slas.every((s) => s.slaOwner != null && s.slaOwner !== ''), true, 'slaOwner seeded (ISO §5.3)');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
