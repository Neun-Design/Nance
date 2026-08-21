#!/usr/bin/env node
// test_engine_sla_forecasts.mjs — unit-test the SLA temporal dimension round
// (issue #241, R6-1): Forecasts.slaID stored NOT NULL anchor (SLA 1:N
// Forecasts — SLA-as-Contract), customer derived on save, the SLA Forecasts
// subitem tab, the Forecast Scopes Event narrowing to the contract's
// payloads, and the A7/A10 period seeds.
// Run from prototype/:  node tools/test_engine_sla_forecasts.mjs

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

console.log('== schema: the forecast anchors its contract ==');
{
  const cat = catalog['Forecasts'];
  const r = model.parseRule(cat.byName['slaID'].rule);
  eq([r.kind, r.target, r.display], ['fk', 'SLA', 'slaTitle'], 'slaID is a stored FK → SLA showing slaTitle');
  eq(forms.requiredAttrs('Forecasts').has('slaID'), true, 'slaID is required (NOT NULL)');
  eq(cat.form.fields.SLA && cat.form.fields.SLA.attribute, 'slaID', 'form opens with the SLA select');
  eq('Customer' in cat.form.fields, false, 'Customer select (obsolete region rule, A11) is gone');
  const bu = model.parseRule(cat.byName['businessUnitName'].rule);
  eq(bu.target, 'SLA', 'businessUnitName mirrors through the contract');
  eq((catalog['SLA'].subitems || []).map((s) => s.table), ['Forecasts'],
    'SLA expands into a Forecasts subitem tab');
}

console.log('== mockup migration: every forecast carries its customer\'s SLA ==');
{
  const rows = data.getEntity('Forecasts');
  const slaByCustomer = new Map(data.getEntity('SLA').map((s) => [String(s.customerID), s.slaID]));
  eq(rows.length > 0 && rows.every((f) => f.slaID === slaByCustomer.get(String(f.customerID))), true,
    'slaID matches the customer\'s SLA on every row (deterministic #179 seed)');
  const periods = [...new Set(rows.map((f) => f.forecastPeriod))].sort();
  eq(periods, ['Annual', 'Month', 'Quarter'], 'the three enum periods are seeded (A7), Monthly relabelled (A10)');
  const q = data.getById('Forecasts', 'FRC157');
  eq([q.forecastPeriod, q.periodFrame, q.periodFinish], ['Quarter', '2026-Q4', '2026-12-31'],
    'A7 quarter row carries coherent period fields');
  const kids = resolve.childrenOf('Forecasts', q, 'Forecast Scopes', {});
  eq(kids.length > 0, true, 'A7 rows have cloned forecast scopes');
}

console.log('== save path: customer derives from the contract ==');
{
  const rec = { slaID: 'SLA03' };
  forms.applyDerivedUnits('Forecasts', rec);
  const sla = data.getById('SLA', 'SLA03');
  eq(rec.customerID, sla.customerID, 'applyDerivedUnits stamps the SLA\'s customer');
  const keep = { slaID: null, customerID: 'FC09' };
  forms.applyDerivedUnits('Forecasts', keep);
  eq(keep.customerID, 'FC09', 'no SLA → prior customer kept (legacy leniency)');
}

console.log('== Forecast Scopes Event: narrowed to the contract\'s payloads ==');
{
  const all = data.getEntity('Events').length;
  eq(forms.eventsForForecastSLA(null).length, all, 'no forecast → every event (lenient)');
  const fc = data.getEntity('Forecasts')[0];
  const sla = data.getById('SLA', fc.slaID);
  const covered = new Set();
  for (const pid of (Array.isArray(sla.payloadID) ? sla.payloadID : [sla.payloadID]).filter(Boolean)) {
    const p = data.getById('Payload', pid);
    if (p && p.eventID != null) covered.add(String(p.eventID));
  }
  const opts = forms.eventsForForecastSLA(fc.forecastID);
  eq(opts.length, covered.size, 'options = exactly the SLA\'s payload events');
  eq(opts.every((o) => covered.has(String(o.value))), true, 'every option is contract-covered');
  data.addRecord('SLA', { slaID: 'SLA-T', slaCode: 'SLA-T', customerID: 'FC01', payloadID: [] });
  data.addRecord('Forecasts', { forecastID: 'FRC-T', slaID: 'SLA-T', customerID: 'FC01' });
  eq(forms.eventsForForecastSLA('FRC-T').length, all, 'SLA without payloads → every event (wildcard)');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
