#!/usr/bin/env node
// test_engine_ticket_forecast_link.mjs — unit-test the demand→execution link
// (issue #243, R6-3): Tickets.forecastScopeID nullable FK (options via the
// customer's SLA chain, no date gating), consumption as a real rollup COUNT
// with the derived remaining balance, Tickets.productScopeID NOT NULL, and
// Jobs.taskID as a stored FK.
// Run from prototype/:  node tools/test_engine_ticket_forecast_link.mjs

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

console.log('== schema: the cycle closes ==');
{
  const tk = catalog['Tickets'];
  const link = model.parseRule(tk.byName['forecastScopeID'].rule);
  eq([link.kind, link.target], ['fk', 'Forecast Scopes'], 'forecastScopeID is a stored FK');
  eq(forms.requiredAttrs('Tickets').has('forecastScopeID'), false, 'link is nullable (outside-forecast is valid)');
  eq(forms.requiredAttrs('Tickets').has('productScopeID'), true, 'productScopeID is NOT NULL now (A2)');
  eq(tk.form.fields['Forecast Scope'].check, 'Event IS NOT NULL', 'link select gated on Event');
  const cons = model.parseRule(catalog['Forecast Scopes'].byName['consumption'].rule);
  eq([cons.kind, cons.target, cons.via], ['rollup', 'Tickets', 'forecastScopeID'],
    'consumption is a real rollup over the linked tickets');
  const rem = model.parseRule(catalog['Forecast Scopes'].byName['remaining'].rule);
  eq([rem.kind, rem.minuend, rem.subtrahend], ['diff', 'forecastScopeQuantity', 'consumption'],
    'remaining = quantity − consumption (diff rule parsed)');
  const jt = model.parseRule(catalog['Jobs'].byName['taskID'].rule);
  eq([jt.kind, jt.target], ['fk', 'Tasks'], 'Jobs.taskID is a stored FK (was the collapsing 3-key rollup)');
}

console.log('== data: link seeded, counts real ==');
{
  const tickets = data.getEntity('Tickets');
  eq(tickets.every((t) => t.productScopeID), true, 'every ticket targets a product scope (was 0/135)');
  const linked = tickets.filter((t) => t.forecastScopeID);
  eq(linked.length > 0, true, `${linked.length} tickets consume a demand line, the rest ran outside the forecast`);
  const fsc = data.getById('Forecast Scopes', linked[0].forecastScopeID);
  const count = tickets.filter((t) => String(t.forecastScopeID) === String(fsc.forecastScopeID)).length;
  eq(Number(resolve.derivedValue('Forecast Scopes', catalog['Forecast Scopes'].byName['consumption'], fsc)),
    count, 'consumption cell = the COUNT of linked tickets');
  const rem = Number(resolve.derivedValue('Forecast Scopes', catalog['Forecast Scopes'].byName['remaining'], fsc));
  eq(rem, Number(fsc.forecastScopeQuantity) - count, 'remaining = quantity − real consumption');
  eq(data.getEntity('Forecast Scopes').every((r) => !('consumption' in r)), true,
    'invented stored consumption dropped (parity)');
  const distinctTasks = new Set(data.getEntity('Jobs').map((j) => String(j.taskID))).size;
  eq(distinctTasks > 6, true, `jobs spread over ${distinctTasks} tasks (was 6 — A2 payoff)`);
}

console.log('== picker: SLA chain + event/product-scope match, lenient ==');
{
  const linkedTicket = data.getEntity('Tickets').find((t) => t.forecastScopeID);
  const opts = forms.forecastScopesForTicket(linkedTicket.eventID, linkedTicket.productScopeID,
    linkedTicket.customerID);
  eq(opts.some((o) => String(o.value) === String(linkedTicket.forecastScopeID)), true,
    'the linked demand line is among the offered options');
  const fsc = data.getById('Forecast Scopes', opts[0].value);
  eq(String(fsc.eventID), String(linkedTicket.eventID), 'options match the ticket\'s event');
  eq(/^\S+ \|/.test(opts[0].label), true, 'labels lead with the period frame');
  const open = forms.forecastScopesForTicket(null, null, null);
  eq(open.length, data.getEntity('Forecast Scopes').length, 'no context → every demand line (lenient)');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
