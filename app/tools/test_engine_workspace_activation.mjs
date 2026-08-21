#!/usr/bin/env node
// test_engine_workspace_activation.mjs — proof suite for issue #192
// (Sponsors Presentation P5, closes the milestone): Workspace joins the
// MVP walkthrough (Tickets + Projects active, Jobs gated per-tab) and the
// ticket chain goes SLA-aware — Business Unit anchors the Customer/Project
// cascade, the Event select only offers events covered by the customer's
// SLAs (issue #179 rationale), payload/SLA derive on the ticket, Projects
// link their contracts. Run from prototype/:  node tools/test_engine_workspace_activation.mjs

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

console.log('== schema: SLA-aware ticket chain ==');
{
  const cat = catalog['Tickets'];
  eq(model.parseRule(cat.byName['businessUnitID'].rule).kind, 'fk', 'businessUnitID is a stored FK anchor');
  eq(model.parseRule(cat.byName['eventID'].rule).display, 'eventTitle', 'eventID displays eventTitle (eventName never existed)');
  // #192 removed forecastScopeID as a CHAIN INPUT; issue #243 reintroduced it
  // with different semantics — a nullable CONSUMPTION link (A1). Stale absence
  // assertion retired (issue #207 precedent); the new behavior is proven by
  // test_engine_ticket_forecast_link.mjs.
  eq(model.parseRule(cat.byName['forecastScopeID'].rule).target, 'Forecast Scopes',
    'forecastScopeID is the #243 consumption link (not the pre-#192 chain input)');
  eq(model.parseRule(cat.byName['payloadID'].rule).target, 'Payload', 'payloadID derives from Payload via the event');
  eq(model.parseRule(cat.byName['slaID'].rule).target, 'SLA', 'slaID derives the customer contracts');
  const pj = catalog['Projects'];
  eq(model.parseRule(pj.byName['businessUnitID'].rule).kind, 'fk', 'Projects.businessUnitID is a stored FK anchor');
  eq(model.parseRule(pj.byName['slaID'].rule).kind, 'fk', 'Projects.slaID is a stored FK (multivalued picker, not a rollup)');
  eq(model.getSchemaVersion() >= 33, true, 'schemaVersion bumped to at least 33');
}

console.log('== form spec: gated cascade ==');
{
  const t = catalog['Tickets'].form.fields;
  // the #192 "input removed" assertion retired — #243 added the field back as
  // the nullable consumption link, gated on Event
  eq(t['Forecast Scope'].check, 'Event IS NOT NULL', 'Forecast Scope is the #243 link, gated on Event');
  eq(t.Customer.check, 'Business Unit IS NOT NULL', 'Customer gated on the unit');
  eq(t.Project.check, 'Customer IS NOT NULL', 'Project gated on the customer');
  eq(t.Event.check, 'Customer IS NOT NULL', 'Event gated on the customer');
  const p = catalog['Projects'].form.fields;
  eq(p.SLA.attribute, 'slaID', 'Projects SLA binds the FK');
  eq(/Allow multiple/i.test(String(p.SLA['field-rule'])), true, 'Projects SLA is multivalued');
  eq(p.SLA.check, 'Customer IS NOT NULL', 'Projects SLA gated on the customer');
}

console.log('== eventsForCustomerSLAs: contracts gate the events ==');
{
  const all = data.getEntity('Events').length;
  eq(forms.eventsForCustomerSLAs(null).length, all, 'no customer — every event (lenient wildcard)');
  const sla = data.getEntity('SLA').find((s) => (s.payloadID || []).length);
  const offered = forms.eventsForCustomerSLAs(sla.customerID);
  const covered = new Set(sla.payloadID.map((id) => data.getById('Payload', id).eventID));
  eq(offered.length > 0 && offered.length < all, true,
    `SLA narrows the offer (${offered.length} of ${all})`);
  eq(offered.every((o) => covered.has(o.value)), true, 'every offered event is covered by the customer contracts');
  data.addRecord('Customers', { customerID: 'FCW9', customerName: 'NoSLA', businessUnitID: 'BU01', businessSegmentID: 'SG01', customerType: 'External Client' });
  eq(forms.eventsForCustomerSLAs('FCW9').length, all, 'customer without SLA — every event (lenient wildcard)');
}

console.log('== seeds: unit anchors + payload-chain snapshots ==');
{
  const tickets = data.getEntity('Tickets');
  eq(tickets.length >= 100, true, `ticket seeds present (${tickets.length})`);
  eq(tickets.every((t) => t.businessUnitID != null && t.businessUnitID !== ''), true,
    'every ticket seeds the businessUnitID anchor (NOT NULL)');
  eq(tickets.every((t) => {
    const c = data.getById('Customers', t.customerID);
    const units = Array.isArray(c.businessUnitID) ? c.businessUnitID : [c.businessUnitID];
    return units.includes(t.businessUnitID);
  }), true, 'ticket unit matches its customer');
  // requirementName is live-derived since issue #226 (INHERITED-REQUIREMENTS):
  // the stored #192 snapshots were dropped and the payload chain resolves at
  // render time — new aligned requirements surface with no re-seed
  eq(tickets.every((t) => !('requirementName' in t)), true,
    'requirement snapshots dropped (live derivation, issue #226)');
  eq(resolve.ticketRequirements(tickets[0]).length > 0, true,
    'the payload chain still yields a requirement set, now live');
  const projects = data.getEntity('Projects');
  eq(projects.every((p) => p.businessUnitID != null && Array.isArray(p.slaID)), true,
    'projects seed unit + contract list');
  eq(projects.every((p) => p.slaID.every((id) => data.getById('SLA', id).customerID === p.customerID)),
    true, 'project contracts belong to the project customer');
  // ticket payload derives through the event (childrenOf join)
  const t0 = tickets[0];
  const kids = resolve.childrenOf('Tickets', t0, 'Payload', { viaList: ['eventID'] });
  eq(kids.length > 0 && kids.every((p) => p.eventID === t0.eventID), true,
    'payloadID rollup resolves the event package');
}

console.log('== MVP walkthrough gating (app.js) ==');
{
  const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  const modules = app.match(/BLANK_DISABLED_MODULES = new Set\(\[([^\]]*)\]\)/)[1];
  eq(/'Workspace'/.test(modules), false, 'Workspace no longer in BLANK_DISABLED_MODULES');
  eq(/'Overview'/.test(modules) && /'Control'/.test(modules), true, 'Overview/Control stay out');
  const tabs = app.match(/BLANK_DISABLED_TABS = (\{[\s\S]*?\});/)[1];
  eq(/Workspace/.test(tabs) && /'Jobs'/.test(tabs), true, 'Jobs gated per-tab in the Workspace walkthrough');
  const ws = model.getModules().find((m) => m.name === 'Workspace');
  eq(ws.tables, ['Tickets', 'Projects', 'Jobs'], 'Workspace strip order 1-3, Jobs still catalogued');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
