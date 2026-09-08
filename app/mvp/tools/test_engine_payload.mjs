#!/usr/bin/env node
// test_engine_payload.mjs — proof suite for the Payload distribution round
// (issue #159, 2026-08-05): the ER-model Payload distributes into Event
// (applicability: scopes/products) and Process (department + product scopes);
// Procedures chain product scopes from the process and derive requirement
// options through them. Empty applicability keys = applies to all (Q1).
// Run from prototype/:  node tools/test_engine_payload.mjs

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

console.log('== schema shapes ==');
{
  const ev = catalog['Events'];
  // the #159 drop was superseded by issue #352 (sv92): the key is BACK with
  // new semantics — the department that ANSWERS the event (single FK; the
  // #159 doctrine stays intact on Processes, which keep their own stored key)
  eq(model.parseRule(ev.byName['departmentID'].rule).target, 'Departments',
    'Events.departmentID back as the answering department (#352 supersedes the #159 drop)');
  eq([model.parseRule(ev.byName['scopeID'].rule).kind, model.parseRule(ev.byName['productID'].rule).kind],
    ['fk', 'fk'], 'Events applicability keys are stored FKs');
  eq(ev.byName['productGroupID'].type, 'mirror', 'event product groups derive from the products');
  const pr = catalog['Processes'];
  eq(model.parseRule(pr.byName['departmentID'].rule).kind, 'fk', 'Processes store the department');
  eq(model.parseRule(pr.byName['productScopeID'].rule).kind, 'fk', 'Processes store product scopes');
  const pc = catalog['Procedures'];
  // #159 dropped the key; issue #340 RE-ADDED it as a stored pre-RBAC filter
  // input (Unit → Department → Process form chain) — the Competence
  // department still derives via the process, so the #159 doctrine holds
  eq(model.parseRule(pc.byName['departmentID'].rule).kind, 'fk',
    'Procedures departmentID is back as a stored filter FK (#340)');
  eq(model.parseRule(pc.byName['productScopeID'].rule).kind, 'fk', 'Procedures store product scopes');
  eq(model.getSchemaVersion() >= 19, true, 'schemaVersion at least 19 (payload round)');
}

console.log('== migration: department moved event -> process, wildcards seeded ==');
{
  eq(data.getById('Processes', 'PR1').departmentID, 'DPT01', 'PR1 carries its event\'s department');
  eq(data.getEntity('Events').every((e) => !('departmentID' in e)
    && Array.isArray(e.scopeID) && Array.isArray(e.productID)), true,
    'events: key dropped, empty applicability seeded (Q1 wildcard)');
  // the #159 key drop was superseded by #340 (stored filter input) on LIVE
  // data — this FROZEN pre-#340 dataset keeps the dropped shape as
  // TOLERATED (#284 posture; live-data seeds are proven in
  // test_engine_prerbac_procedure_filters.mjs)
  eq(data.getEntity('Procedures').every((p) => !('departmentID' in p)
    && Array.isArray(p.productScopeID)), true,
    'frozen procedures keep the pre-#340 shape (no department key — tolerated)');
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
  // issue #304 retired the requirementsForProductScopes picker helper — the
  // PS→requirements chain stays proven on the resolve layer directly.
  // issue #288: the derived display moved to the comprehensive
  // productScopeRequirements attr (PS-REQUIREMENTS — explicit connections
  // only); requirementID is the stored direct-pick FK now, absent on the
  // frozen pre-#288 rows (tolerated legacy shape — the direct leg no-ops)
  const viaPS = resolve.productScopeRequirementRows(ps);
  const attr = catalog['Product Scopes'].byName['productScopeRequirements'];
  const derived = String(resolve.derivedValue('Product Scopes', attr, ps) || '');
  eq(viaPS.length > 0, true, `product scope ${psPk} carries ${viaPS.length} requirement(s)`);
  eq(viaPS.every((r) => derived.includes(r.requirementName)), true,
    'rows match the product scope\'s own derived requirement set');
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
