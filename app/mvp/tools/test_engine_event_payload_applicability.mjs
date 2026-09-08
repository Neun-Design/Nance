#!/usr/bin/env node
// test_engine_event_payload_applicability.mjs — proof for issue #367
// (sv100): the #364 doctrine on the admission chain. An EVENT's
// applicability (scopeID/productID, #159) and a PAYLOAD's packaging
// (productScopeID, #190) must be DECLARED — an empty key admits/packages
// NOTHING ('all' = every value explicitly selected; a scope registered
// later requires revisiting the event/payload). Pre-sv100 snapshots keep
// the old Q1 reading via legacyWildcardData(100); blank mode is always
// strict. Census at the flip: 0 flips across evAdmit(20) / admitted(160)
// / payloads(160) / reqs(160) / dispatch(1502) / inputs(160) /
// procPicker(6) / fsPicker(60).
// Run from prototype/:  node tools/test_engine_event_payload_applicability.mjs

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
const asList = (v) => (Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]));

const dm = JSON.parse(fs.readFileSync('data/datamodel.json', 'utf-8'));

console.log('== schema: sv100, doctrine on the event/payload keys ==');
{
  eq(dm._meta.schemaVersion >= 100, true, `schemaVersion ${dm._meta.schemaVersion} >= 100`);
  const ev = catalog['Events'].byName;
  eq(/#367/.test(String(ev.scopeID.notes)) && /#367/.test(String(ev.productID.notes)), true,
    'Events scopeID/productID notes record the #367 doctrine');
  eq(/#367/.test(String(catalog['Payload'].byName.productScopeID.notes)), true,
    'Payload packaging notes record the #367 doctrine');
  eq(data.legacyWildcardData(100), false, 'the sv100 mockup is STRICT on the admission chain');
}

console.log('== eventProductScopeIds: undeclared dimension admits nothing ==');
{
  const ev = data.getEntity('Events').find((e) => resolve.eventProductScopeIds(e.eventID).length);
  const before = resolve.eventProductScopeIds(ev.eventID).map(String).sort();
  const saved = ev.scopeID;
  ev.scopeID = [];
  eq(resolve.eventProductScopeIds(ev.eventID), [],
    'blank scopeID → the event admits NOTHING (#367; was: no constraint)');
  ev.scopeID = saved;
  const savedP = ev.productID;
  ev.productID = [];
  eq(resolve.eventProductScopeIds(ev.eventID), [],
    'blank productID → the event admits NOTHING');
  ev.productID = savedP;
  eq(resolve.eventProductScopeIds(ev.eventID).map(String).sort(), before, 'restored');
  eq(resolve.eventProductScopeIds(null).length, data.getEntity('Product Scopes').length,
    'no-event CONTEXT stays lenient (context, not a declaration)');
}

console.log('== payload packaging: empty packages nothing ==');
{
  // live probe on a real ticket: blank its winning payload's packaging —
  // the admitted set must NOT widen to the event applicability
  const t = data.getEntity('Tickets').find((tk) =>
    resolve.ticketAdmittedPayloads(tk.eventID, tk).length === 1
    && resolve.ticketAdmittedScopeIds(tk).length);
  eq(t != null, true, `single-payload probe ticket found (${t && t.ticketID})`);
  const pl = resolve.ticketAdmittedPayloads(t.eventID, t)[0];
  const before = resolve.ticketAdmittedScopeIds(t).map(String).sort();
  const saved = pl.productScopeID;
  pl.productScopeID = [];
  eq(resolve.admittedProductScopeIds(t.eventID, t), [],
    'an unpackaged payload admits nothing (#367; was: the event\'s full applicability)');
  // and it fails the explicit scope filter of ticketAdmittedPayloads
  const scope = before[0];
  eq(resolve.ticketAdmittedPayloads(t.eventID, t, scope).length, 0,
    'empty packaging fails the scope filter (was: always survived)');
  pl.productScopeID = saved;
  eq(resolve.ticketAdmittedScopeIds(t).map(String).sort(), before, 'restored');
}

console.log('== productScopesForForecastSLA: unpackaged contributes nothing ==');
{
  const fsr = data.getEntity('Forecast Scopes').find((r) => {
    const fc = data.getById('Forecasts', r.forecastID);
    const sla = fc && data.getById('SLA', fc.slaID);
    return sla && asList(sla.payloadID).some((pid) => {
      const p = data.getById('Payload', pid);
      return p && String(p.eventID) === String(r.eventID);
    });
  });
  eq(fsr != null, true, 'a forecast scope with an SLA event payload exists');
  const fc = data.getById('Forecasts', fsr.forecastID);
  const sla = data.getById('SLA', fc.slaID);
  const pl = asList(sla.payloadID).map((pid) => data.getById('Payload', pid))
    .find((p) => p && String(p.eventID) === String(fsr.eventID));
  const before = forms.productScopesForForecastSLA(fsr.eventID, fsr.forecastID)
    .map((o) => String(o.value)).sort();
  const saved = pl.productScopeID;
  pl.productScopeID = [];
  const after = forms.productScopesForForecastSLA(fsr.eventID, fsr.forecastID)
    .map((o) => String(o.value));
  eq(after.length <= before.length, true,
    'blanking the packaging never WIDENS the demand-line options (no event fallback)');
  pl.productScopeID = saved;
}

console.log('== migration census: every key declared, chain invariants hold ==');
{
  const evs = data.getEntity('Events');
  eq(evs.filter((e) => !asList(e.scopeID).length || !asList(e.productID).length).length, 0,
    `every event declares both dimensions (${evs.length} events)`);
  const pls = data.getEntity('Payload');
  eq(pls.filter((p) => !asList(p.productScopeID).length).length, 0,
    `every payload packages an explicit list (${pls.length} payloads)`);
  // packaging stays inside the event's admitted applicability
  const outOf = pls.filter((p) => {
    const admits = resolve.eventProductScopeIds(p.eventID).map(String);
    return !asList(p.productScopeID).every((id) => admits.includes(String(id)));
  });
  eq(outOf.map((p) => p.payloadID), [], 'every packaging ⊆ its event\'s admitted set');
  const tickets = data.getEntity('Tickets');
  eq(tickets.filter((t) => !resolve.ticketAdmittedScopeIds(t).length).length, 0,
    'all 160 tickets keep a non-empty admitted scope set');
  let withInputs = 0;
  for (const t of tickets) if (resolve.ticketInputHandouts(t).length) withInputs += 1;
  eq(withInputs, 137, 'TICKET-INPUTS census preserved (137/160 — the 0-flip census rode here)');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
