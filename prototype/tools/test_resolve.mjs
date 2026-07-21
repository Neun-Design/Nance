#!/usr/bin/env node
// test_resolve.mjs — assert FK/rollup/mirror display resolution against the
// mockup dataset (prototype_v1-review: reference cells and form options show
// display NAMES, never raw ids; constraintName must never render as 0).
// Run from prototype/:  node tools/test_resolve.mjs

import fs from 'fs';
globalThis.fetch = async (p) => new Response(fs.readFileSync(p));

const model = await import('../js/model.js');
const data = await import('../js/data.js');
const { catalog } = await model.loadModel();
data.initMeta(catalog);
await data.loadData();
const { derivedValue, fkDisplay, resolveDisplay } = await import('../js/resolve.js');

let fails = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails += 1; console.log(`  ✗ ${m}`); };

const row = (t, i = 0) => data.getEntity(t)[i];
function cell(table, attrName, r = row(table)) {
  const attr = catalog[table].byName[attrName];
  const rule = model.parseRule(attr.rule);
  if (rule && rule.kind === 'fk') {
    const target = model.resolveTable(rule.target);
    return fkDisplay({ table: target, display: rule.display, concat: rule.concat }, r[attrName]);
  }
  return derivedValue(table, attr, r);
}

// value must be a non-empty string containing `re` and not a bare id / 0
function expectName(table, attrName, re, r) {
  const v = cell(table, attrName, r);
  const s = String(v);
  if (s !== '' && s !== '0' && s !== '—' && re.test(s)) ok(`${table}.${attrName} → ${JSON.stringify(s.slice(0, 60))}`);
  else fail(`${table}.${attrName} → ${JSON.stringify(v)} (expected match ${re})`);
}

console.log('== review nonconformities: table/subitem cells ==');
// Forecasts FACTORY: CONCAT(factoryName,'-',city), not FC ids
expectName('Forecasts', 'factoryID', /^(?!FC\d)[A-Za-zÀ-ú].*-.+/);
// Forecast Scopes: names, not ids / 0
expectName('Forecast Scopes', 'constraintName', /[A-Za-z]{3,}/);
expectName('Forecast Scopes', 'processID', /^(?!PC\d)[A-Za-z]/);
expectName('Forecast Scopes', 'productGroupID', /^(?!PG\d)[A-Za-z]/);
// Tasks
expectName('Tasks', 'constraintName', /[A-Za-z]{3,}/);
expectName('Tasks', 'processID', /^(?!PC\d)[A-Za-z]/);
expectName('Tasks', 'functionID', /^(?!F\d)[A-Za-z]/);
expectName('Tasks', 'actionID', /^(?!A\d)[A-Za-z]/);
// Inventory
expectName('Product Scopes', 'constraintName', /[A-Za-z]{3,}/);
expectName('Product Groups', 'productID', /^(?!P\d)[A-Za-z]/);
expectName('Product Groups', 'productClassID', /[A-Za-z]{3,}/);
// Talent
expectName('People', 'roleID', /[A-Za-z]{3,}/);
expectName('Onboarding', 'functionID', /^(?!F\d)[A-Za-z]/);
expectName('Competence', 'roleID', /^(?!R\d)[A-Za-z]/);
expectName('Competence', 'actionID', /^(?!A\d)[A-Za-z]/);
expectName('Competence', 'activityID', /^(?!AT\d)[A-Za-z]/);
expectName('Competence', 'constrainID', /[A-Za-z]{3,}/);
// Workload
expectName('Jobs', 'roleID', /^(?!R\d)[A-Za-z]/);

console.log('== review nonconformities: form select options ==');
const { optionsForAttr } = await import('../js/forms.js');
function expectOptions(entity, attrName, labelRe, { wantMulti = null } = {}) {
  const { options, target, multi } = optionsForAttr(entity, attrName);
  if (!options || !options.length) return fail(`${entity}.${attrName}: no options (target=${target})`);
  const bad = options.filter((o) => !labelRe.test(o.label));
  if (bad.length) return fail(`${entity}.${attrName}: ${bad.length} id-like labels, e.g. ${JSON.stringify(bad[0])}`);
  if (wantMulti != null && multi !== wantMulti) return fail(`${entity}.${attrName}: multi=${multi}, expected ${wantMulti}`);
  ok(`${entity}.${attrName}: ${options.length} options, e.g. ${JSON.stringify(options[0].label)}${multi ? ' [multi]' : ''}`);
}
// options must be display names, never bare ids
expectOptions('Forecast Scopes', 'productGroupID', /^(?!PG\d+$)./);
expectOptions('Forecast Scopes', 'constraintName', /[A-Za-z]{3,}/);
expectOptions('Tasks', 'processID', /^(?!PC\d+$)./);
expectOptions('Tasks', 'workflowID', /^(?!WF\d+$)./);
expectOptions('Tasks', 'constraintName', /[A-Za-z]{3,}/);
expectOptions('Product Scopes', 'constraintName', /[A-Za-z]{3,}/);
expectOptions('Product Groups', 'productID', /^(?!P\d+$)./);
expectOptions('Product Groups', 'productClassID', /^(?!PC\d+$)./, { wantMulti: true });
expectOptions('Competence', 'roleID', /^(?!R\d+$)./);
expectOptions('Competence', 'taskID', /^(?!T\d+$)./);
expectOptions('Competence', 'constrainID', /[A-Za-z]{3,}/);
expectOptions('Onboarding', 'roleID', /^(?!R\d+$)./);
expectOptions('Onboarding', 'competenceID', /^(?!CMP\d+$)./);

console.log('== subitem-tables joins (v1 review, subitem rendering v2) ==');
const { childrenOf } = await import('../js/resolve.js');
function subitemsOf(table, r = row(table)) {
  const cat = catalog[table];
  return cat.subitems.map((si) => {
    const child = model.resolveTable(si.table);
    const kids = childrenOf(table, r, child, {
      viaThrough: si.viaThrough, via: si.via, throughField: si.throughField, only: si.only,
    });
    return { si, child, kids };
  });
}
{
  // Factories → Forecasts, Approved only
  const [f] = subitemsOf('Factories');
  const statuses = [...new Set(f.kids.map((k) => k.status))];
  if (f.kids.length && statuses.join() === 'Approved') ok(`Factories→Forecasts: ${f.kids.length} kids, all Approved`);
  else fail(`Factories→Forecasts: ${f.kids.length} kids, statuses=${statuses}`);

  // Tasks → Handouts grouped by inputs / outputs
  const groups = subitemsOf('Tasks');
  for (const g of groups) {
    if (g.child !== 'Handouts') continue;
    const label = g.si.label;
    if (g.kids.length && /Handouts - (Inputs|Outputs)/.test(label)) {
      ok(`Tasks→${label}: ${g.kids.map((k) => k.handoutName).join(', ')}`);
    } else fail(`Tasks→${label || g.si.table}: ${g.kids.length} kids`);
  }
  if (!groups.some((g) => /Inputs/.test(g.si.label || '')) || !groups.some((g) => /Outputs/.test(g.si.label || ''))) {
    fail('Tasks: expected two grouped Handouts subitem lists');
  }

  // Constraints → Product Scopes (reverse of the derived constraintName rollup)
  const cons = data.getEntity('Constraints').find((c) => c.constraintName === 'Max Tank Weight');
  const [cps] = subitemsOf('Constraints', cons);
  if (cps.child === 'Product Scopes' && cps.kids.length) ok(`Constraints→Product Scopes: ${cps.kids.length} kids for Max Tank Weight`);
  else fail(`Constraints→Product Scopes: ${cps.kids.length} kids`);

  // Roles → Competence, Product Scopes → Scopes
  const [rc] = subitemsOf('Roles');
  if (rc.child === 'Competence' && rc.kids.length) ok(`Roles→Competence: ${rc.kids.length} kids`);
  else fail(`Roles→Competence: ${rc.kids.length} kids`);
  const [pss] = subitemsOf('Product Scopes');
  if (pss.child === 'Scopes' && pss.kids.length) ok(`Product Scopes→Scopes: ${pss.kids.map((k) => k.scopeName).join(', ')}`);
  else fail(`Product Scopes→Scopes: ${pss.kids.length} kids`);
}

console.log('== smoke: every displayed column resolves without throwing ==');
let cells = 0;
for (const [tname, cat] of Object.entries(catalog)) {
  const rows = data.getEntity(tname).slice(0, 5);
  for (const a of cat.attrs) {
    if (a['table-display'] !== true && a['subitem-display'] !== true) continue;
    for (const r of rows) {
      try { cell(tname, a.name, r); cells += 1; }
      catch (e) { fail(`${tname}.${a.name} throws: ${e.message}`); }
    }
  }
}
ok(`${cells} cells resolved without exceptions`);

console.log(`\n${fails ? `${fails} FAILURES` : 'ALL PASS'}`);
process.exit(fails ? 1 : 0);
