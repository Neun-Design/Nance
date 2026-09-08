#!/usr/bin/env node
// test_engine_ticket_project_sla.mjs — proof suite for issue #325 (sv76):
// the resolved payload(s) + governing SLA(s) are STORED on save
// (multivalued honesty, no form input) and the pickers only offer what the
// surviving contracts package.
//
// SURVIVAL RE-SOURCED by issue #350 (sv89): the (Applicant, Supplier) pair
// over every Active SLA replaced the #325 project universe and its
// two-leg union — full rule semantics live in
// test_engine_ticket_sla_cascade.mjs; this suite keeps the #325 subjects
// that survive (stored keys, save resolution, picker form-integrity,
// legacy inheritance rung).
// Run from prototype/:  node tools/test_engine_ticket_project_sla.mjs

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

console.log('== schema: stored payload/SLA keys ==');
{
  eq(model.getSchemaVersion() >= 76, true, `schemaVersion ${model.getSchemaVersion()} >= 76`);
  const cat = catalog['Tickets'];
  const pl = model.parseRule(cat.byName['payloadID'].rule);
  eq([pl.kind, pl.target, pl.display], ['fk', 'Payload', 'payloadCode'],
    'payloadID is a stored FK → Payload (display payloadCode)');
  eq(/multivalued/i.test(String(cat.byName['payloadID'].notes)), true,
    'payloadID notes declare multivalued (engine multi detection)');
  const sl = model.parseRule(cat.byName['slaID'].rule);
  eq([sl.kind, sl.target, sl.display], ['fk', 'SLA', 'slaCode'],
    'slaID is a stored FK → SLA (display slaCode)');
  eq(/multivalued/i.test(String(cat.byName['slaID'].notes)), true,
    'slaID notes declare multivalued');
  // neither key takes form input — they resolve on save (applyDerivedUnits)
  const bound = new Set(Object.values(cat.form.fields).map((f) => f.attribute));
  eq(bound.has('payloadID') || bound.has('slaID'), false,
    'payloadID/slaID bound to NO form field (resolved, never picked)');
}

console.log('== form spec: gates + cascade spellings (#274 trap) ==');
{
  const t = catalog['Tickets'].form.fields;
  eq(t.Event.check, 'Project IS NOT NULL', 'Event gated on the Project (strict doctrine)');
  eq(t['Product Scope'].check, 'Event IS NOT NULL', 'Product Scope gated on the Event');
  // the bespoke dispatch branches are unreachable unless the field-rule
  // matches the `filtered by … selected` regex AND names every dep
  const evRule = String(t.Event['field-rule']);
  eq(/filtered by .*selected/i.test(evRule), true, 'Event rule matches the cascade regex');
  for (const dep of ['Applicant', 'Supplier']) {
    eq(evRule.includes(dep), true, `Event cascade names ${dep} (#350 pair)`);
  }
  const psRule = String(t['Product Scope']['field-rule']);
  eq(/filtered by .*selected/i.test(psRule), true, 'Product Scope rule matches the cascade regex');
  for (const dep of ['Event', 'Applicant', 'Supplier']) {
    eq(psRule.includes(dep), true, `Product Scope cascade names ${dep} (#350 pair)`);
  }
}

console.log('== ticketAdmittedSLAs: re-sourced to the (Applicant, Supplier) pair (#350) ==');
{
  // full rule semantics are proven in test_engine_ticket_sla_cascade.mjs —
  // here only the re-source regression: the pair decides, the project does
  // not restrict, Inactive stays filtered
  data.addRecord('Customers', { customerID: 'CU-B (t)', customerName: 'Applicant B (t)' });
  data.addRecord('Customers', { customerID: 'SUP-X (t)', customerName: 'Supplier X (t)' });
  data.addRecord('SLA', { slaID: 'SLA-B (t)', slaCode: 'SLA-B', customerID: 'CU-B (t)',
    supplierID: 'SUP-X (t)', payloadID: [], isActive: 'Active' });
  data.addRecord('SLA', { slaID: 'SLA-DEAD (t)', slaCode: 'SLA-DEAD', customerID: 'CU-B (t)',
    supplierID: 'SUP-X (t)', payloadID: [], isActive: 'Inactive' });
  // a project that links NEITHER probe contract — under #325 it was the
  // universe and would have blocked them
  data.addRecord('Projects', { projectID: 'PJ-U (t)', projectRegistryID: 'PJ-U (t)',
    customerID: 'CU-B (t)', slaID: [] });
  const probeIds = new Set(['SLA-B (t)', 'SLA-DEAD (t)']);
  const ids = (rows) => rows.map((s) => s.slaID).filter((id) => probeIds.has(id));

  eq(ids(resolve.ticketAdmittedSLAs({ projectID: 'PJ-U (t)', applicantID: 'CU-B (t)',
    supplierID: 'SUP-X (t)' })), ['SLA-B (t)'],
  'the pair admits its contract even OUTSIDE the project set (Inactive filtered)');
  eq(resolve.ticketAdmittedSLAs(null), [], 'null ctx — no survivors');
  data.removeRecords('Projects', ['PJ-U (t)']);
  data.removeRecords('SLA', ['SLA-B (t)', 'SLA-DEAD (t)']);
  data.removeRecords('Customers', ['CU-B (t)', 'SUP-X (t)']);
}

console.log('== save resolution: payload + SLA stored (applyDerivedUnits) ==');
{
  // two contracts of the SAME project selling the SAME payload — the pair
  // resolves BOTH (multivalued storage is the honest shape, session decision)
  data.addRecord('Events', { eventID: 'EV-R (t)', eventTitle: 'Resolve Probe (t)' });
  data.addRecord('Payload', { payloadID: 'PLD-R (t)', payloadCode: 'PLD-R',
    eventID: 'EV-R (t)', productScopeID: ['PS01', 'PS02'] });
  data.addRecord('Payload', { payloadID: 'PLD-R2 (t)', payloadCode: 'PLD-R2',
    eventID: 'EV-R (t)', productScopeID: ['PS02'] });
  data.addRecord('Customers', { customerID: 'CU-R (t)', customerName: 'Resolver (t)' });
  data.addRecord('SLA', { slaID: 'SLA-R1 (t)', slaCode: 'SLA-R1', customerID: 'CU-R (t)',
    payloadID: ['PLD-R (t)'], isActive: 'Active' });
  data.addRecord('SLA', { slaID: 'SLA-R2 (t)', slaCode: 'SLA-R2', customerID: 'CU-R (t)',
    payloadID: ['PLD-R (t)', 'PLD-R2 (t)'], isActive: 'Active' });
  data.addRecord('Projects', { projectID: 'PJ-R (t)', projectRegistryID: 'PJ-R (t)',
    customerID: 'CU-R (t)', slaID: ['SLA-R1 (t)', 'SLA-R2 (t)'] });

  const rec = { ticketID: 'TK-R (t)', projectID: 'PJ-R (t)', customerID: 'CU-R (t)',
    eventID: 'EV-R (t)', productScopeID: 'PS01' };
  forms.applyDerivedUnits('Tickets', rec);
  eq(rec.payloadID, ['PLD-R (t)'], 'the (event, scope) pair resolves its packaging payload');
  eq(rec.slaID, ['SLA-R1 (t)', 'SLA-R2 (t)'],
    'BOTH selling contracts store (multivalued honesty — no arbitrary pick)');

  const rec2 = { ticketID: 'TK-R2 (t)', projectID: 'PJ-R (t)', customerID: 'CU-R (t)',
    eventID: 'EV-R (t)', productScopeID: 'PS02' };
  forms.applyDerivedUnits('Tickets', rec2);
  eq(rec2.payloadID, ['PLD-R (t)', 'PLD-R2 (t)'], 'a scope packaged twice resolves both payloads');

  const rec3 = { ticketID: 'TK-R3 (t)', projectID: null, customerID: 'CU-R (t)',
    eventID: 'EV-R (t)', productScopeID: 'PS01' };
  forms.applyDerivedUnits('Tickets', rec3);
  eq([rec3.payloadID, rec3.slaID], [['PLD-R (t)'], ['SLA-R1 (t)', 'SLA-R2 (t)']],
    'no project — the pair basis resolves regardless (#350: strict posture retired)');

  data.removeRecords('Projects', ['PJ-R (t)']);
  data.removeRecords('SLA', ['SLA-R1 (t)', 'SLA-R2 (t)']);
  data.removeRecords('Payload', ['PLD-R (t)', 'PLD-R2 (t)']);
  data.removeRecords('Events', ['EV-R (t)']);
  data.removeRecords('Customers', ['CU-R (t)']);
}

console.log('== census: seeds resolve, options keep the stored picks ==');
{
  const tickets = data.getEntity('Tickets');
  eq(tickets.length, 160, 'clinic census (160 tickets)');
  eq(tickets.every((t) => Array.isArray(t.payloadID) && t.payloadID.length > 0), true,
    'every ticket stores a non-empty payload set');
  eq(tickets.every((t) => Array.isArray(t.slaID) && t.slaID.length > 0), true,
    'every ticket stores a non-empty contract set');
  eq(tickets.filter((t) => t.slaID.length > 1).length >= 1, true,
    'the multivalued shape bites (multi-SLA tickets exist — census: 16)');
  // lockstep: the stored keys equal a live re-resolution (migration ≡ engine)
  const drift = tickets.filter((t) => {
    const pls = resolve.ticketAdmittedPayloads(t.eventID, t, t.productScopeID ?? null)
      .map((p) => p.payloadID);
    const plSet = new Set(pls.map(String));
    const slas = resolve.ticketAdmittedSLAs(t)
      .filter((s) => asList(s.payloadID).some((id) => plSet.has(String(id))))
      .map((s) => s.slaID);
    return JSON.stringify(pls) !== JSON.stringify(t.payloadID)
      || JSON.stringify(slas) !== JSON.stringify(t.slaID);
  });
  eq(drift.map((t) => t.ticketID), [], 'stored keys ≡ live re-resolution (lockstep)');
  // form-integrity trap (#281): the strict pickers must keep offering every
  // seeded pick — else edit-save would silently wipe the stored FK
  const orphanEv = tickets.filter((t) => !forms.eventsForTicket(t)
    .some((o) => String(o.value) === String(t.eventID)));
  eq(orphanEv.map((t) => t.ticketID), [], 'every seeded event survives its own picker');
  const orphanPs = tickets.filter((t) => t.productScopeID != null && t.productScopeID !== ''
    && !forms.productScopesForTicket(t.eventID, t)
      .some((o) => String(o.value) === String(t.productScopeID)));
  eq(orphanPs.map((t) => t.ticketID), [], 'every seeded product scope survives its own picker');
}

console.log('== inheritance: project chain first, legacy rung behind it ==');
{
  const t0 = data.getEntity('Tickets')[0];
  const viaProject = resolve.ticketRequirements(t0);
  eq(viaProject.length > 0, true, `the project chain yields a requirement set (${viaProject.length})`);
  // a snapshot ticket OUTSIDE the project chain (no project) falls back to
  // the pre-#325 customer-SLA path instead of collapsing — frozen-testdata
  // tolerance; UI-created tickets never land here (options are strict)
  const legacy = resolve.ticketRequirements({ ...t0, projectID: null });
  eq(legacy.length > 0, true, 'legacy rung: a project-less snapshot still inherits');
  eq(JSON.stringify(viaProject), JSON.stringify(legacy),
    'drift zero on demo data — both chains admit the same scopes (census)');
}

console.log('== retirement: the customer-SLA event helper left with #325 ==');
{
  eq(forms.eventsForCustomerSLAs, undefined, 'eventsForCustomerSLAs retired (dead-helper posture)');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
