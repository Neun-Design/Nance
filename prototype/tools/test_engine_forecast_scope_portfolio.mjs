#!/usr/bin/env node
// test_engine_forecast_scope_portfolio.mjs — unit-test the Forecast Scopes
// portfolio key round (issue #242, R6-2): stored productScopeID anchor
// (scope/PG derived on save, stored for the requirement chain), functionID
// FK replacing the free-string name, the SUM×quantity rule, and the
// SLA-payload narrowing of the Product Scope picker.
// Run from prototype/:  node tools/test_engine_forecast_scope_portfolio.mjs

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

console.log('== schema: the product scope is the stored portfolio anchor ==');
{
  const cat = catalog['Forecast Scopes'];
  const ps = model.parseRule(cat.byName['productScopeID'].rule);
  eq([ps.kind, ps.target], ['fk', 'Product Scopes'], 'productScopeID is a stored FK (was a 4-key computed)');
  eq(forms.requiredAttrs('Forecast Scopes').has('productScopeID'), true, 'productScopeID is NOT NULL');
  const fn = model.parseRule(cat.byName['functionID'].rule);
  eq([fn.kind, fn.target, fn.display], ['fk', 'Functions', 'functionName'], 'functionID is a stored FK → Functions');
  eq(cat.byName['functionName'].type, 'mirror', 'functionName is the display twin');
  const sum = model.parseRule(cat.byName['estimatedHours'].rule);
  eq([sum.kind, sum.childAttr, sum.field, sum.multiplierField],
    ['sum', 'taskID', 'executionTime', 'forecastScopeQuantity'],
    'estimatedHours = SUM(tasks) × quantity (multiplier parsed)');
  eq('Scope' in cat.form.fields || 'Product Group' in cat.form.fields, false,
    'separate Scope / Product Group selects removed');
  eq(cat.form.fields['Product Scope'].check, 'Event IS NOT NULL', 'Product Scope gated on Event');
  eq(cat.form.fields.Notes.check, 'Product Scope IS NOT NULL',
    'A12: the Notes gate now names a REAL field');
}

console.log('== data: hours trace to procedures, × quantity ==');
{
  const rows = data.getEntity('Forecast Scopes');
  eq(rows.every((r) => r.functionID && !('functionName' in r)), true,
    'every row maps functionID, stored name dropped');
  const fs1 = data.getById('Forecast Scopes', 'FS001');
  const hoursAttr = catalog['Forecast Scopes'].byName['estimatedHours'];
  eq(Number(resolve.derivedValue('Forecast Scopes', hoursAttr, fs1)), fs1.estimatedHours,
    'live SUM×qty equals the re-stamped stored value (chained event)');
  const chained = new Set(data.getEntity('Tasks').map((t) => String(t.eventID)));
  const multi = rows.find((r) => chained.has(String(r.eventID)) && Number(r.forecastScopeQuantity) > 1);
  const base = multi && rows.find((r) => r.eventID === multi.eventID && Number(r.forecastScopeQuantity) === 1);
  if (multi && base) {
    eq(multi.estimatedHours, base.estimatedHours * Number(multi.forecastScopeQuantity),
      'quantity multiplies the same event\'s base hours');
  } else ok('(no qty pair on a chained event — skip ratio check)');
  // #192 posture: an event chaining no tasks keeps the planner's manual value
  const manual = rows.find((r) => !chained.has(String(r.eventID)));
  eq(Number(resolve.derivedValue('Forecast Scopes', hoursAttr, manual)), manual.estimatedHours,
    'no chained tasks → the stored manual estimate stands (#192 posture)');
  eq(manual.estimatedHours > 0, true, 'manual rows kept non-zero hours');
  const fc = data.getById('Forecasts', 'FRC001');
  const kids = rows.filter((r) => r.forecastID === 'FRC001');
  eq(fc.totalEstimatedHours, Math.round(kids.reduce((s, k) => s + k.estimatedHours, 0) * 100) / 100,
    'parent totalEstimatedHours re-cohered');
}

console.log('== save path: scope/PG follow the product scope ==');
{
  const ps = data.getEntity('Product Scopes')[0];
  const rec = { productScopeID: ps.productScopeID };
  forms.applyDerivedUnits('Forecast Scopes', rec);
  eq([rec.scopeID, rec.productGroupID], [ps.scopeID ?? null, ps.productGroupID ?? null],
    'applyDerivedUnits stamps scope + product group from the anchor');
}

console.log('== pickers: contract-narrowed product scopes, chained functions ==');
{
  const fc = data.getEntity('Forecasts')[0];
  const sla = data.getById('SLA', fc.slaID);
  const evId = (() => {
    for (const pid of (Array.isArray(sla.payloadID) ? sla.payloadID : [sla.payloadID]).filter(Boolean)) {
      const p = data.getById('Payload', pid);
      if (p && p.eventID != null) return p.eventID;
    }
    return null;
  })();
  const opts = forms.productScopesForForecastSLA(evId, fc.forecastID);
  eq(opts.length > 0, true, 'SLA-covered event offers its packaged scopes');
  const openOpts = forms.productScopesForForecastSLA(evId, null);
  eq(openOpts.length > 0, true, 'no forecast → the event\'s applicability (lenient)');
  const fns = forms.functionsForForecastEvent('EV01');
  eq(fns.map((f) => f.value).sort(), ['F1', 'F2', 'F3', 'F4', 'F5'],
    'Function options = the event\'s chained task functions');
  eq(forms.functionsForForecastEvent(null).length, data.getEntity('Functions').length,
    'no event → every function (lenient)');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
