#!/usr/bin/env node
// test_engine_payload.mjs — proof suite for the Payload distribution round
// (issue #159, 2026-08-05): the ER-model Payload distributes into Event
// (applicability: scopes/products) and Process (department + product scopes);
// Procedures chain product scopes from the process and derive requirement
// options through them. Empty applicability keys = applies to all (Q1).
// Run from prototype/:  node tools/test_engine_payload.mjs

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

console.log('== schema shapes ==');
{
  const ev = catalog['Events'];
  eq(ev.byName['departmentID'], undefined, 'Events dropped departmentID (moved down)');
  eq([model.parseRule(ev.byName['scopeID'].rule).kind, model.parseRule(ev.byName['productID'].rule).kind],
    ['fk', 'fk'], 'Events applicability keys are stored FKs');
  eq(ev.byName['productGroupID'].type, 'mirror', 'event product groups derive from the products');
  const pr = catalog['Processes'];
  eq(model.parseRule(pr.byName['departmentID'].rule).kind, 'fk', 'Processes store the department');
  eq(model.parseRule(pr.byName['productScopeID'].rule).kind, 'fk', 'Processes store product scopes');
  const pc = catalog['Procedures'];
  eq(pc.byName['departmentID'], undefined, 'Procedures dropped departmentID');
  eq(model.parseRule(pc.byName['productScopeID'].rule).kind, 'fk', 'Procedures store product scopes');
  eq(model.getSchemaVersion(), 19, 'schemaVersion 19');
}

console.log('== migration: department moved event -> process, wildcards seeded ==');
{
  eq(data.getById('Processes', 'PR1').departmentID, 'DPT01', 'PR1 carries its event\'s department');
  eq(data.getEntity('Events').every((e) => !('departmentID' in e)
    && Array.isArray(e.scopeID) && Array.isArray(e.productID)), true,
    'events: key dropped, empty applicability seeded (Q1 wildcard)');
  eq(data.getEntity('Procedures').every((p) => !('departmentID' in p)
    && Array.isArray(p.productScopeID)), true, 'procedures: key dropped, wildcard seeded');
}

console.log('== productScopesForEvent: wildcard + narrowed ==');
{
  const all = data.getEntity('Product Scopes').length;
  eq(forms.productScopesForEvent('EV01').length, all, 'wildcard event admits every product scope');
  const ps0 = data.getEntity('Product Scopes').find((ps) => (ps.scopeID || []).length || ps.scopeID);
  const scope = Array.isArray(ps0.scopeID) ? ps0.scopeID[0] : ps0.scopeID;
  data.addRecord('Events', { eventID: 'EVT9', eventTitle: 'Payload probe', scopeID: [scope], productID: [] });
  const narrowed = forms.productScopesForEvent('EVT9');
  eq(narrowed.length > 0 && narrowed.length < all, true,
    `scope-limited event narrows the offer (${narrowed.length}/${all})`);
  data.removeRecords('Events', ['EVT9']);
}

console.log('== productScopesForProcess + requirement options via product scopes ==');
{
  const all = data.getEntity('Product Scopes').length;
  eq(forms.productScopesForProcess('PR1').length, all,
    'process with an empty list covers every product scope of its (wildcard) event');
  const ps = data.getEntity('Product Scopes').find((r) => r.productGroupID && r.scopeID);
  const psPk = ENTITYPK(ps);
  const viaPS = forms.requirementsForProductScopes([psPk]);
  const attr = catalog['Product Scopes'].byName['requirementID'];
  const derived = String(resolve.derivedValue('Product Scopes', attr, ps) || '');
  eq(viaPS.length > 0, true, `product scope ${psPk} offers ${viaPS.length} requirement(s)`);
  eq(viaPS.every((o) => derived.includes(o.label)), true,
    'options match the product scope\'s own derived requirement set');
  function ENTITYPK(row) { return row[catalog['Product Scopes'].pk]; }
}

console.log('== cascade joins the forms rely on ==');
{
  const unit = data.getById('Business Units', 'BU01');
  const procs = resolve.childrenOf('Business Units', unit, 'Processes', {});
  eq(procs.length > 0, true, `Unit -> Process join resolves (${procs.length} process(es) for BU01)`);
  const dept = data.getById('Departments', 'DPT01');
  const squads = resolve.childrenOf('Departments', dept, 'Squads', {});
  eq(squads.length > 0, true, `Department -> Squads join resolves (${squads.length})`);
  const evTabs = catalog['Events'].subitems;
  eq(evTabs.map((s) => [s.table, s.tab.name]),
    [['Processes', 'Processes'], ['Product Scopes', 'Product scopes']],
    'Events expands into Processes + Product Scopes tabs');
}

console.log('== Competence department derives via the process (decision Q-159.3) ==');
{
  const rec = { processID: 'PC01' };
  forms.applyDerivedUnits('Competence', rec);
  eq(rec.departmentID, 'DPT03', 'department follows the selected process');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
