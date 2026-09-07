#!/usr/bin/env node
// test_engine_prerbac_batch.mjs — unit-test the pre-RBAC filter batch
// (issue #346, the #334 doctrine): the six remaining forms in one round —
// Jobs, Forecasts, Forecast Scopes, Onboarding, Competence, Squads — plus
// two fixes the census surfaced (the THREE dead Forecast Scopes branches,
// #274 free-text trap latent since #242; the Jobs dead clientName
// grouping). Product Specs deliberately LEFT the batch (8/8 specs span
// products of multiple units — a unit filter would orphan stored picks on
// every row).
// Run from prototype/:  node tools/test_engine_prerbac_batch.mjs

import fs from 'fs';
globalThis.fetch = async (p) => new Response(fs.readFileSync(p));

const model = await import('../js/model.js');
const data = await import('../js/data.js');
const { catalog } = await model.loadModel();
data.initMeta(catalog);
await data.loadData();
const forms = await import('../js/forms.js');

let fails = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails += 1; console.log(`  ✗ ${m}`); };
const eq = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));
const asList = (v) => (Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]));
const S = (v) => String(v);
const WIRED = (rule, dep) => new RegExp(`filtered by .*${dep}.*selected`, 'i')
  .test(asList(rule).join('; '));

const dm = JSON.parse(fs.readFileSync('data/datamodel.json', 'utf-8'));

console.log('== schema: five new filter FKs (sv87) ==');
{
  eq(dm._meta.schemaVersion >= 87, true, `schemaVersion ${dm._meta.schemaVersion} >= 87`);
  for (const t of ['Jobs', 'Forecasts', 'Forecast Scopes', 'Competence', 'Squads']) {
    const a = catalog[t].byName['businessUnitID'];
    eq(model.parseRule(a?.rule).kind === 'fk' && /#346/.test(a?.notes || ''), true,
      `${t}.businessUnitID stored FK with the #346 note`);
  }
}

console.log('== forms: BU leads, gates + wired spellings (#274) ==');
{
  const cases = [
    ['Jobs', 'Project'], ['Forecasts', 'SLA'], ['Forecast Scopes', 'Forecast'],
    ['Onboarding', 'Department'], ['Competence', 'Function'], ['Squads', 'Department'],
  ];
  for (const [t, child] of cases) {
    const f = catalog[t].form.fields;
    eq(f['Business Unit']?.attribute, 'businessUnitID', `${t}: Business Unit field bound`);
    eq(f[child].check, 'Business Unit IS NOT NULL', `${t}: ${child} gated on the unit`);
    eq(WIRED(f[child]['field-rule'], 'Business Unit'), true,
      `${t}: ${child} filtered in the wired spelling`);
  }
  // redundant unit groupings dropped where the BU filter landed (#335)
  for (const [t, child] of [['Squads', 'Department'], ['Onboarding', 'Department'],
    ['Forecast Scopes', 'Forecast']]) {
    eq(/SelectLabel\s*={1,2}\s*businessUnitName/i
      .test(asList(catalog[t].form.fields[child]['field-rule']).join('; ')), false,
    `${t}: ${child} unit grouping dropped (redundant under the filter)`);
  }
  // Jobs: the dead clientName grouping (attr dropped in schema-parity) is gone
  const jp = asList(catalog['Jobs'].form.fields['Project']['field-rule']).join('; ');
  eq(/clientName/.test(jp), false, 'Jobs: dead clientName grouping gone');
  eq(/SelectLabel\s*=\s*customerName/.test(jp), true, 'Jobs: Project groups by customerName');
}

console.log('== the three revived Forecast Scopes branches (#274 fix) ==');
{
  const f = catalog['Forecast Scopes'].form.fields;
  eq(WIRED(f['Event']['field-rule'], 'Forecast'), true, 'Event wired to Forecast');
  eq(WIRED(f['Product Scope']['field-rule'], 'Event.*\\+.*Forecast'), true,
    'Product Scope wired to Event + Forecast');
  eq(WIRED(f['Function']['field-rule'], 'Event'), true, 'Function wired to Event');
  // the helpers narrow for real — stored picks survive, a foreign forecast excludes
  const fss = data.getEntity('Forecast Scopes');
  let evOk = 0; let psOk = 0; let fnOk = 0;
  for (const r of fss) {
    if (forms.eventsForForecastSLA(r.forecastID).map((o) => S(o.value)).includes(S(r.eventID))) evOk += 1;
    if (forms.productScopesForForecastSLA(r.eventID, r.forecastID)
      .map((o) => S(o.value)).includes(S(r.productScopeID))) psOk += 1;
    if (forms.functionsForForecastEvent(r.eventID).map((o) => S(o.value)).includes(S(r.functionID))) fnOk += 1;
  }
  eq([evOk, psOk, fnOk], [fss.length, fss.length, fss.length],
    `all ${fss.length} stored picks survive the three revived filters`);
}

console.log('== seeds: every unit keyed from the row\'s own chain ==');
{
  const checks = [
    ['Jobs', (j) => {
      const t = data.getById('Tickets', j.ticketID);
      const p = data.getById('Projects', j.projectID);
      return S(j.businessUnitID) === S((t || p || {}).businessUnitID);
    }],
    ['Forecasts', (f) => S(j2u('SLA', f.slaID)) === S(f.businessUnitID)],
    ['Forecast Scopes', (r) => {
      const fc = data.getById('Forecasts', r.forecastID);
      return fc && S(j2u('SLA', fc.slaID)) === S(r.businessUnitID);
    }],
    ['Competence', (c) => S(j2u('Functions', c.functionID)) === S(c.businessUnitID)],
    ['Squads', (s) => S(j2u('Departments', s.departmentID)) === S(s.businessUnitID)],
  ];
  function j2u(table, id) {
    const row = data.getById(table, id);
    return row ? asList(row.businessUnitID)[0] : undefined;
  }
  for (const [t, rule] of checks) {
    const rows = data.getEntity(t);
    eq(rows.filter(rule).length, rows.length, `${t}: ${rows.length}/${rows.length} chain-coherent`);
    eq(rows.every((r) => 'businessUnitID' in r), true, `${t}: every row carries the key (parity)`);
  }
  // Onboarding needed no new key — coherent as stored (60/60 census)
  const obs = data.getEntity('Onboarding');
  eq(obs.every((o) => {
    const d = data.getById('Departments', o.departmentID);
    return d && S(asList(d.businessUnitID)[0]) === S(o.businessUnitID);
  }), true, 'Onboarding: stored unit == department\'s unit (no migration needed)');
}

console.log('== applyDerivedUnits: Onboarding derive is a blank-only fallback ==');
{
  const rec = { businessUnitID: 'BU-USER', departmentID: 'DPT03' };
  forms.applyDerivedUnits('Onboarding', rec);
  eq(rec.businessUnitID, 'BU-USER', 'a user-picked unit survives the save');
  const blank = { businessUnitID: null, departmentID: 'DPT03' };
  forms.applyDerivedUnits('Onboarding', blank);
  eq(S(blank.businessUnitID), S(asList(data.getById('Departments', 'DPT03').businessUnitID)[0]),
    'a blank unit still derives from the department (#288 posture)');
}

console.log('== exclusion doctrine: Product Specs stays OUT (revisitable census) ==');
{
  eq('Business Unit' in catalog['Product Specs'].form.fields, false,
    'Product Specs form has no Business Unit filter (excluded by census)');
  let crossUnit = 0;
  for (const sp of data.getEntity('Product Specs')) {
    const units = new Set();
    for (const pid of asList(sp.productID)) {
      const p = data.getById('Products', pid);
      if (p) asList(p.businessUnitID).forEach((u) => units.add(S(u)));
    }
    if (units.size > 1) crossUnit += 1;
  }
  eq(crossUnit > 0, true,
    `${crossUnit} specs span products of multiple units (why the filter stays out)`);
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
