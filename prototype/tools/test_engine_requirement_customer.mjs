#!/usr/bin/env node
// test_engine_requirement_customer.mjs — proof suite for issue #180
// (Sponsors Presentation P1) updated for issue #212: Requirements gains
// a customerID FK → Customers. The select shipped DISABLED until the
// SLA chain landed (#179/#191); since #212 it is ENABLED mirroring the
// sibling Branch field — gated on Business Unit, options filtered to
// the selected units' customers, grouped by unit name. Empty = applies
// to all customers (Q1 wildcard); mockup rows seed the key as null.
// Run from prototype/:  node tools/test_engine_requirement_customer.mjs

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

let fails = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails += 1; console.log(`  ✗ ${m}`); };
const eq = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));

console.log('== schema: Requirements.customerID stored FK ==');
{
  const cat = catalog['Requirements'];
  const attr = cat.byName['customerID'];
  eq(!!attr, true, 'customerID catalogued on Requirements');
  const r = model.parseRule(attr.rule);
  eq(r && r.kind, 'fk', 'customerID is a stored FK rule (not a rollup)');
  eq(r && r.target, 'Customers', 'customerID targets Customers');
  eq(attr.constraints === 'FK', true, 'customerID is nullable (wildcard) — not NOT NULL');
  eq(model.getSchemaVersion() >= 29, true, 'schemaVersion bumped to at least 29');
}

console.log('== form spec: Customer select enabled, unit-gated (issue #212) ==');
{
  const dmRaw = JSON.parse(fs.readFileSync(new URL('../data/datamodel.json', import.meta.url)));
  const req = dmRaw.modules.Operation.tables.Requirements;
  const field = req.form.fields.Customer;
  eq(!!field, true, 'Requirements form declares a Customer field');
  eq(field && field.attribute, 'customerID', 'Customer field binds customerID (the FK, not a display name)');
  const rule = field && (Array.isArray(field['field-rule']) ? field['field-rule'].join('; ') : field['field-rule'] || '');
  eq(/(^|;)\s*disabled\s*(;|$)/i.test(rule), false, 'the disabled token is gone');
  eq(field.check, 'Business Unit IS NOT NULL', 'gated until a Business Unit is picked');
  eq(rule, 'SelectLabel = businessUnitName; filtered by businessUnitID selected',
    'options filtered to the selected units, grouped by unit name (Branch-field mirror)');
}

console.log('== cascade join: a unit offers exactly its own customers ==');
{
  const resolve = await import('../js/resolve.js');
  const bu = data.getEntity('Business Units').find((u) => data.getEntity('Customers')
    .some((c) => (Array.isArray(c.businessUnitID) ? c.businessUnitID : [c.businessUnitID]).includes(u.businessUnitID)));
  eq(!!bu, true, `a unit with customers exists (${bu && bu.businessUnitID})`);
  const kids = resolve.childrenOf('Business Units', bu, 'Customers').map((c) => c.customerID);
  const want = data.getEntity('Customers')
    .filter((c) => (Array.isArray(c.businessUnitID) ? c.businessUnitID : [c.businessUnitID]).includes(bu.businessUnitID))
    .map((c) => c.customerID);
  eq(kids.length > 0 && kids.length === want.length && want.every((id) => kids.includes(id)), true,
    `childrenOf(unit → Customers) = the unit's customers (${kids.length}), array-aware businessUnitID`);
  const all = data.getEntity('Customers').length;
  eq(kids.length < all, true, `filter is selective (${kids.length} of ${all} customers)`);
}

console.log('== seeds: mockup rows carry the key, all wildcard ==');
{
  const rows = data.getEntity('Requirements');
  eq(rows.length > 0, true, `Requirements mockup rows present (${rows.length})`);
  eq(rows.every((r) => 'customerID' in r), true, 'every row seeds the customerID key (parity)');
  eq(rows.every((r) => r.customerID == null), true, 'all rows seed null — applies to all customers (Q1)');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
