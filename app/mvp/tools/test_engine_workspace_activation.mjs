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
  // payloadID/slaID are STORED multivalued FKs since issue #325 (sv76): the
  // engine resolves the dispatch package(s) + governing contract(s) on save
  eq(model.parseRule(cat.byName['payloadID'].rule).kind, 'fk', 'payloadID is a stored FK since #325 (resolved on save)');
  eq(model.parseRule(cat.byName['payloadID'].rule).target, 'Payload', 'payloadID targets Payload');
  eq(model.parseRule(cat.byName['slaID'].rule).kind, 'fk', 'slaID is a stored FK since #325 (resolved on save)');
  eq(model.parseRule(cat.byName['slaID'].rule).target, 'SLA', 'slaID targets SLA');
  const pj = catalog['Projects'];
  eq(model.parseRule(pj.byName['businessUnitID'].rule).kind, 'fk', 'Projects.businessUnitID is a stored FK anchor');
  eq(model.parseRule(pj.byName['slaID'].rule).kind, 'fk', 'Projects.slaID is a stored FK (multivalued picker, not a rollup)');
  eq(model.getSchemaVersion() >= 33, true, 'schemaVersion bumped to at least 33');
}

console.log('== form spec: gated cascade ==');
{
  const t = catalog['Tickets'].form.fields;
  // the #243 consumption-link input left the form again in the 2026-09-03
  // input-removal round (sv70) — the stored forecastScopeID link is data-only
  eq('Forecast Scope' in t, false, 'Forecast Scope input removed (sv70; the stored link stays)');
  eq(t.Customer.check, 'Business Unit IS NOT NULL', 'Customer gated on the unit');
  eq(t.Project.check, 'Customer IS NOT NULL', 'Project gated on the customer');
  // the PROJECT's contracts are the option universe since issue #325 —
  // the Event field gates on it (strict posture)
  eq(t.Event.check, 'Project IS NOT NULL', 'Event gated on the project (#325)');
  const p = catalog['Projects'].form.fields;
  eq(p.SLA.attribute, 'slaID', 'Projects SLA binds the FK');
  eq(/Allow multiple/i.test(String(p.SLA['field-rule'])), true, 'Projects SLA is multivalued');
  eq(p.SLA.check, 'Customer IS NOT NULL', 'Projects SLA gated on the customer');
}

console.log('== eventsForTicket: the PROJECT contracts gate the events (#325) ==');
{
  const all = data.getEntity('Events').length;
  // strict posture: no project = no options (the #192 lenient wildcard and
  // the eventsForCustomerSLAs helper retired with the #325 re-sourcing)
  eq(forms.eventsForCustomerSLAs === undefined, true, 'eventsForCustomerSLAs retired (#325)');
  eq(forms.eventsForTicket({}).length, 0, 'no project — no events (strict)');
  const prj = data.getEntity('Projects').find((p) => (p.slaID || []).length);
  const offered = forms.eventsForTicket({ projectID: prj.projectID, customerID: prj.customerID });
  const covered = new Set();
  for (const sid of prj.slaID) {
    const s = data.getById('SLA', sid);
    for (const pid of (s.payloadID || [])) covered.add(data.getById('Payload', pid).eventID);
  }
  eq(offered.length > 0 && offered.length < all, true,
    `project contracts narrow the offer (${offered.length} of ${all})`);
  eq(offered.every((o) => covered.has(o.value)), true, 'every offered event is packaged by the project contracts');
  eq(forms.eventsForTicket({ projectID: prj.projectID }).length, 0,
    'no customer/applicant pair match — no events (strict: the survival legs need a party)');
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
  // ticket payload/SLA are STORED since #325 — every seed resolves its
  // dispatch package(s) and the contracts stay inside the project's set
  eq(tickets.every((t) => Array.isArray(t.payloadID) && t.payloadID.length > 0), true,
    'every ticket stores its resolved payload set (160/160 census)');
  eq(tickets.every((t) => t.payloadID.every((id) => data.getById('Payload', id).eventID === t.eventID)),
    true, 'every stored payload carries the ticket event');
  eq(tickets.every((t) => {
    const prj = data.getById('Projects', t.projectID);
    return Array.isArray(t.slaID) && t.slaID.length > 0
      && t.slaID.every((id) => (prj.slaID || []).includes(id));
  }), true, 'every stored contract belongs to the ticket project');
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
