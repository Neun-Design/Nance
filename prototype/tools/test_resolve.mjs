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
// Forecasts CUSTOMER: customerID shows the plain customerName; customerTitle
// mirrors it too since the CRM activation round (#191) — the CONCAT with
// geography left Customers when city/country moved to Branches (issue #207).
expectName('Forecasts', 'customerID', /^(?!FC\d)[A-Za-zÀ-ú]/);
expectName('Forecasts', 'customerTitle', /^(?!FC\d)[A-Za-zÀ-ú]/);
// Forecast Scopes: names, not ids / 0 (requirementName → requirementID,
// computed via forecastID.customerID + scopeID + productGroupID, 2026-07-30)
expectName('Forecast Scopes', 'requirementID', /[A-Za-z]{3,}/);
expectName('Forecast Scopes', 'processID', /^(?!PC\d)[A-Za-z]/);
expectName('Forecast Scopes', 'productGroupID', /^(?!PG\d)[A-Za-z]/);
// Tasks — requirementName/functionID derive through Competence via taskID
expectName('Tasks', 'requirementName', /[A-Za-z]{3,}/);
expectName('Tasks', 'processID', /^(?!PC\d)[A-Za-z]/);
expectName('Tasks', 'functionID', /^(?!F\d)[A-Za-z]/);
expectName('Tasks', 'actionID', /^(?!A\d)[A-Za-z]/);
// Portfolio
expectName('Product Scopes', 'requirementID', /[A-Za-z]{3,}/); // compound via: productGroupID + scopeID
expectName('Product Groups', 'productID', /^(?!P\d)[A-Za-z]/);
// Requirements: concat display resolves the computed specsSummary part —
// parametrized (F3, plan §5.5): the first requirement that HAS product
// groups, whatever the domain calls it
expectName('Requirements', 'productGroupID', /\|/,
  data.getEntity('Requirements').find((r) => Array.isArray(r.productGroupID) && r.productGroupID.length));
// specsSummary renders the specValues map as "Spec Name: value" pairs
expectName('Product Groups', 'specsSummary', /[A-Za-z]{3,}[^:]*: /);
// Competence certifies spec DEFINITIONS now — names, not SPECxx ids
expectName('Competence', 'productSpecID', /^(?!SPEC\d)[A-Za-z]/);
// Talent
expectName('People', 'roleID', /[A-Za-z]{3,}/);
expectName('Onboarding', 'functionID', /^(?!F\d)[A-Za-z]/);
expectName('Competence', 'roleID', /^(?!R\d)[A-Za-z]/);
expectName('Competence', 'actionID', /^(?!A\d)[A-Za-z]/);
expectName('Competence', 'activityID', /^(?!AT\d)[A-Za-z]/);
expectName('Competence', 'requirementID', /[A-Za-z]{3,}/);
expectName('Competence', 'competenceName', /applied to/);
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
// (Forecast Scopes.requirementName select was removed 2026-07-30 — the
// requirements now derive as the computed requirementID, no form input.)
expectOptions('Tasks', 'processID', /^(?!PC\d+$)./);
expectOptions('Tasks', 'workflowID', /^(?!WF\d+$)./);
// (Tasks.customerName was removed in the Organization restructure — the
// customer now derives from the task's workflow, so there is no form input.)
expectOptions('Product Groups', 'productID', /^(?!P\d+$)./);
// Product Specs assign to one or more products via the checkbox multi-picker
expectOptions('Product Specs', 'productID', /^(?!P\d+$)./, { wantMulti: true });
// Requirements bind to scopes / product groups with multi-pickers
expectOptions('Requirements', 'scopeID', /[A-Za-z]{3,}/, { wantMulti: true });
expectOptions('Requirements', 'productGroupID', /\|/, { wantMulti: true });
expectOptions('Competence', 'roleID', /^(?!R\d+$)./);
expectOptions('Competence', 'taskID', /^(?!T\d+$)./);
// (Competence.requirementID became derived in the Procedures round — the
// form input is the Procedure picker, a multivalued GROUP again since #284
// (1:many, task-scoped), and the requirement set is the UNION of the chosen
// procedures' sets.)
expectOptions('Competence', 'procedureID', /[A-Za-z]{3,}/, { wantMulti: true });
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
  // Customers → SLA (the subitem swapped Forecasts → SLA in the SLA round,
  // #179): every kid is a contract owned by THIS customer (issue #207)
  if (!row('Customers')) fail('Customers→SLA: no Customers rows (mockup migration #77 pending)');
  else {
    const cust = row('Customers');
    const f = subitemsOf('Customers').find((g) => g.child === 'SLA');
    if (!f) fail('Customers→SLA: no SLA subitem group declared');
    else if (f.kids.length && f.kids.every((k) => k.customerID === cust.customerID)) {
      ok(`Customers→SLA: ${f.kids.length} kid(s), all owned by ${cust.customerID}`);
    } else {
      fail(`Customers→SLA: ${f.kids.length} kids, owners=${[...new Set(f.kids.map((k) => k.customerID))]}`);
    }
  }

  // Procedures → Handouts grouped by inputs / outputs (moved from Tasks in
  // the Procedures round — Tasks now expands into its Procedures instead)
  const procWithHandouts = data.getEntity('Procedures')
    .find((p) => (p.taskInput || []).length && (p.taskOutput || []).length);
  const groups = subitemsOf('Procedures', procWithHandouts);
  for (const g of groups) {
    if (g.child !== 'Handouts') continue;
    const label = g.si.label;
    if (g.kids.length && /Handouts - (Inputs|Outputs)/.test(label)) {
      ok(`Procedures→${label}: ${g.kids.map((k) => k.handoutName).join(', ')}`);
    } else fail(`Procedures→${label || g.si.table}: ${g.kids.length} kids`);
  }
  if (!groups.some((g) => /Inputs/.test(g.si.label || '')) || !groups.some((g) => /Outputs/.test(g.si.label || ''))) {
    fail('Procedures: expected two grouped Handouts subitem lists');
  }
  const [tp] = subitemsOf('Tasks');
  if (tp.child === 'Procedures' && tp.kids.length) {
    ok(`Tasks→Procedures: ${tp.kids.length} kid(s) for the first task`);
  } else fail(`Tasks→Procedures: ${tp.kids.length} kids`);

  // Requirements → Product Scopes (reverse of the compound requirementID
  // rollup) — parametrized (F3, plan §5.5): the ONE domain-coupled assertion
  // ('Max Tank Weight') becomes "the first requirement carrying BOTH a
  // product group and a scope", whatever the domain names it
  const req = data.getEntity('Requirements').find((c) =>
    Array.isArray(c.productGroupID) && c.productGroupID.length
    && Array.isArray(c.scopeID) && c.scopeID.length);
  const [cps] = subitemsOf('Requirements', req);
  if (cps.child === 'Product Scopes' && cps.kids.length) ok(`Requirements→Product Scopes: ${cps.kids.length} kids for ${req.requirementName}`);
  else fail(`Requirements→Product Scopes: ${cps.kids.length} kids (probe: ${req && req.requirementName})`);

  // Roles → Competence
  const [rc] = subitemsOf('Roles');
  if (rc.child === 'Competence' && rc.kids.length) ok(`Roles→Competence: ${rc.kids.length} kids`);
  else fail(`Roles→Competence: ${rc.kids.length} kids`);
  // Product Scopes no longer declares subitem-tables (datamodel set to null) — rows don't expand.
  const pssKids = subitemsOf('Product Scopes');
  if (pssKids.length === 0) ok('Product Scopes: no subitems (subitem-tables: null)');
  else fail(`Product Scopes: expected no subitems, got ${pssKids.length}`);
  // Scopes → Product Scopes: the inverse relationship now lives on Scopes (joined via scopeID).
  const [sps] = subitemsOf('Scopes');
  if (sps && sps.child === 'Product Scopes' && sps.kids.length) ok(`Scopes→Product Scopes: ${sps.kids.length} kids`);
  else fail(`Scopes→Product Scopes: ${sps ? sps.kids.length : 'no subitem'} kids`);
}

console.log('== module graph: every named import has a matching export ==');
// browsers fail the WHOLE import graph on one bad binding (blank app), and
// DOM-touching modules (charts.js) never load under node — so cross-check
// bindings statically.
{
  const files = fs.readdirSync('js').filter((f) => f.endsWith('.js'));
  const exportsBy = {};
  const importRefs = [];
  for (const f of files) {
    const src = fs.readFileSync(`js/${f}`, 'utf8');
    const names = new Set();
    for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
    for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
      m[1].split(',').forEach((p) => { p = p.trim(); if (p) names.add(p.split(/\s+as\s+/).pop().trim()); });
    }
    exportsBy[f] = names;
    for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\/([\w.]+)'/g)) {
      m[1].split(',').forEach((p) => {
        p = p.trim();
        if (p) importRefs.push({ from: f, name: p.split(/\s+as\s+/)[0].trim(), src: m[2] });
      });
    }
  }
  const broken = importRefs.filter((i) => !(exportsBy[i.src] || new Set()).has(i.name));
  if (broken.length) broken.forEach((i) => fail(`${i.from} imports { ${i.name} } from ${i.src} — not exported`));
  else ok(`${importRefs.length} import bindings verified across ${files.length} modules`);
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
