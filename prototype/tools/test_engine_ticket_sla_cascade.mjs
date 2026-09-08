#!/usr/bin/env node
// test_engine_ticket_sla_cascade.mjs — proof suite for issue #350 (sv89):
// the APPLICANT → SUPPLIER contracts are the basis of the ticket's
// Event/Product Scope options and of the stored payloadID/slaID
// resolution, superseding the #325 project universe (keeping it would
// re-introduce the Customer → Applicant cascade the issue removes).
//
// Survival rule (session decisions recorded with the round): a ticket's
// surviving SLAs = every Active SLA matching the exact pair
//   SLA.customerID names the Applicant AND SLA.supplierID = the Supplier,
// a BLANK context side SKIPPING its dimension (multiViaJoin posture — the
// #308 null-applicant cohort keeps resolving; blank both sides = every
// Active SLA). The Customer no longer participates in SLA survival (it
// only filters the Projects select); the Project no longer restricts the
// contract set (the #325 strict no-project [] posture leaves with it).
// Seeds re-aligned by migrate_ticket_sla_cascade.py (supplier re-keyed to
// the applicant's covering contract's; #281 unit union for the Supplier
// picker; payloadID/slaID re-derived).
// Run from prototype/:  node tools/test_engine_ticket_sla_cascade.mjs

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

console.log('== schema: notes + form spec follow the #350 basis ==');
{
  eq(model.getSchemaVersion() >= 89, true, `schemaVersion ${model.getSchemaVersion()} >= 89`);
  const cat = catalog['Tickets'];
  eq(/#350/.test(String(cat.byName['eventID'].notes)), true,
    'eventID notes name the #350 contract basis');
  eq(/#350/.test(String(cat.byName['slaID'].notes)), true,
    'slaID notes carry the re-sourced survival rule');
  eq(/#350/.test(String(cat.byName['supplierID'].notes)), true,
    'supplierID notes name the SLA-basis pair');
  const t = cat.form.fields;
  // gates unchanged — Project stays a form-flow anchor, not an SLA dimension
  eq(t.Event.check, 'Project IS NOT NULL', 'Event still gated on Project (form-flow anchor)');
  eq(t['Product Scope'].check, 'Event IS NOT NULL', 'Product Scope still gated on Event');
  // cascade deps re-spelled to the pair (#274 trap: listeners only attach
  // to NAMED deps; Customer/Project must leave so they stop refiltering)
  const evRule = String(t.Event['field-rule']);
  eq(/filtered by .*selected/i.test(evRule), true, 'Event rule matches the cascade regex');
  for (const dep of ['Applicant', 'Supplier']) {
    eq(evRule.includes(dep), true, `Event cascade names ${dep}`);
  }
  for (const dep of ['Project', 'Customer']) {
    eq(evRule.includes(dep), false, `Event cascade no longer names ${dep}`);
  }
  const psRule = String(t['Product Scope']['field-rule']);
  eq(/filtered by .*selected/i.test(psRule), true, 'Product Scope rule matches the cascade regex');
  for (const dep of ['Event', 'Applicant', 'Supplier']) {
    eq(psRule.includes(dep), true, `Product Scope cascade names ${dep}`);
  }
  for (const dep of ['Project', 'Customer']) {
    eq(psRule.includes(dep), false, `Product Scope cascade no longer names ${dep}`);
  }
}

console.log('== ticketAdmittedSLAs: the exact (Applicant, Supplier) pair ==');
{
  data.addRecord('Customers', { customerID: 'CU-A (t)', customerName: 'Buyer A (t)' });
  data.addRecord('Customers', { customerID: 'CU-B (t)', customerName: 'Applicant B (t)' });
  data.addRecord('Customers', { customerID: 'SUP-X (t)', customerName: 'Supplier X (t)' });
  data.addRecord('SLA', { slaID: 'SLA-A (t)', slaCode: 'SLA-A', customerID: 'CU-A (t)',
    supplierID: 'SUP-X (t)', payloadID: [], isActive: 'Active' });
  data.addRecord('SLA', { slaID: 'SLA-B (t)', slaCode: 'SLA-B', customerID: 'CU-B (t)',
    supplierID: 'SUP-X (t)', payloadID: [], isActive: 'Active' });
  data.addRecord('SLA', { slaID: 'SLA-B2 (t)', slaCode: 'SLA-B2', customerID: 'CU-B (t)',
    supplierID: 'CU-A (t)', payloadID: [], isActive: 'Active' });
  data.addRecord('SLA', { slaID: 'SLA-DEAD (t)', slaCode: 'SLA-DEAD', customerID: 'CU-B (t)',
    supplierID: 'SUP-X (t)', payloadID: [], isActive: 'Inactive' });
  // a project linking ONLY the customer's contract — under #325 it was the
  // universe; under #350 it must not restrict anything
  data.addRecord('Projects', { projectID: 'PJ-U (t)', projectRegistryID: 'PJ-U (t)',
    customerID: 'CU-A (t)', slaID: ['SLA-A (t)'] });
  const probeIds = new Set(['SLA-A (t)', 'SLA-B (t)', 'SLA-B2 (t)', 'SLA-DEAD (t)']);
  const ids = (rows) => rows.map((s) => s.slaID).filter((id) => probeIds.has(id));

  eq(ids(resolve.ticketAdmittedSLAs({ applicantID: 'CU-B (t)', supplierID: 'SUP-X (t)' })),
    ['SLA-B (t)'], 'the exact pair admits exactly its contract (Inactive filtered)');
  eq(ids(resolve.ticketAdmittedSLAs({ applicantID: 'CU-B (t)' })),
    ['SLA-B (t)', 'SLA-B2 (t)'], 'no supplier — the dimension is skipped (blank-skips)');
  eq(ids(resolve.ticketAdmittedSLAs({ supplierID: 'SUP-X (t)' })),
    ['SLA-A (t)', 'SLA-B (t)'],
    'no applicant — the supplier alone narrows (#350 divergence from the #325 leg anchor)');
  eq(ids(resolve.ticketAdmittedSLAs({})).length >= 3, true,
    'blank both sides — every Active SLA (lenient; strict no-project [] retired)');
  eq(ids(resolve.ticketAdmittedSLAs({ projectID: 'PJ-U (t)', customerID: 'CU-A (t)',
    applicantID: 'CU-B (t)', supplierID: 'SUP-X (t)' })), ['SLA-B (t)'],
  'Customer and Project do NOT participate — a contract outside the project set is admitted');
  eq(resolve.ticketAdmittedSLAs(null), [], 'null ctx — no survivors');
  data.removeRecords('Projects', ['PJ-U (t)']);
  data.removeRecords('SLA', ['SLA-A (t)', 'SLA-B (t)', 'SLA-B2 (t)', 'SLA-DEAD (t)']);
  data.removeRecords('Customers', ['CU-A (t)', 'CU-B (t)', 'SUP-X (t)']);
}

console.log('== save resolution: stored keys follow the pair (applyDerivedUnits) ==');
{
  data.addRecord('Events', { eventID: 'EV-R (t)', eventTitle: 'Resolve Probe (t)' });
  data.addRecord('Payload', { payloadID: 'PLD-R (t)', payloadCode: 'PLD-R',
    eventID: 'EV-R (t)', productScopeID: ['PS01', 'PS02'] });
  data.addRecord('Payload', { payloadID: 'PLD-R2 (t)', payloadCode: 'PLD-R2',
    eventID: 'EV-R (t)', productScopeID: ['PS02'] });
  data.addRecord('Customers', { customerID: 'AP-R (t)', customerName: 'Applicant R (t)' });
  data.addRecord('Customers', { customerID: 'SUP-R (t)', customerName: 'Supplier R (t)' });
  data.addRecord('SLA', { slaID: 'SLA-R1 (t)', slaCode: 'SLA-R1', customerID: 'AP-R (t)',
    supplierID: 'SUP-R (t)', payloadID: ['PLD-R (t)'], isActive: 'Active' });
  data.addRecord('SLA', { slaID: 'SLA-R2 (t)', slaCode: 'SLA-R2', customerID: 'AP-R (t)',
    supplierID: 'SUP-R (t)', payloadID: ['PLD-R (t)', 'PLD-R2 (t)'], isActive: 'Active' });

  const rec = { ticketID: 'TK-R (t)', applicantID: 'AP-R (t)', supplierID: 'SUP-R (t)',
    eventID: 'EV-R (t)', productScopeID: 'PS01' };
  forms.applyDerivedUnits('Tickets', rec);
  eq(rec.payloadID, ['PLD-R (t)'], 'the (event, scope) pick resolves its packaging payload');
  eq(rec.slaID, ['SLA-R1 (t)', 'SLA-R2 (t)'],
    'BOTH selling contracts store (multivalued honesty, #325 posture kept)');
  // no project involved — the pair alone resolves (the #325 strictness left)
  eq(rec.projectID == null, true, 'resolution needed no project (basis is the pair)');

  const rec2 = { ticketID: 'TK-R2 (t)', applicantID: 'AP-R (t)', supplierID: 'SUP-R (t)',
    eventID: 'EV-R (t)', productScopeID: 'PS02' };
  forms.applyDerivedUnits('Tickets', rec2);
  eq(rec2.payloadID, ['PLD-R (t)', 'PLD-R2 (t)'], 'a scope packaged twice resolves both payloads');

  data.removeRecords('SLA', ['SLA-R1 (t)', 'SLA-R2 (t)']);
  data.removeRecords('Payload', ['PLD-R (t)', 'PLD-R2 (t)']);
  data.removeRecords('Events', ['EV-R (t)']);
  data.removeRecords('Customers', ['AP-R (t)', 'SUP-R (t)']);
}

console.log('== census: seeds resolve under the pair, picks survive the pickers ==');
{
  const tickets = data.getEntity('Tickets');
  eq(tickets.length, 160, 'clinic census (160 tickets)');
  eq(tickets.every((t) => Array.isArray(t.payloadID) && t.payloadID.length > 0), true,
    'every ticket stores a non-empty payload set (160/160 resolved)');
  eq(tickets.every((t) => Array.isArray(t.slaID) && t.slaID.length > 0), true,
    'every ticket stores a non-empty contract set');
  const nullApp = tickets.filter((t) => t.applicantID == null || t.applicantID === '');
  eq(nullApp.length, 54, 'the #308 null-applicant cohort is intact (54 tickets)');
  eq(nullApp.every((t) => t.payloadID.length > 0), true,
    'blank-skips posture bites: every null-applicant ticket still resolves');
  // supplier re-key invariant: a ticket carrying both parties names a pair
  // whose contracts purchase a covering payload (no orphan pairs)
  const paired = tickets.filter((t) => t.applicantID != null && t.applicantID !== ''
    && t.supplierID != null && t.supplierID !== '');
  eq(paired.length, 106, 'every applicant-carrying ticket carries its pair supplier');
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
  // form-integrity trap (#281/#290): the pickers must keep offering every
  // seeded pick — else edit-save would silently wipe the stored FK
  const orphanEv = tickets.filter((t) => !forms.eventsForTicket(t)
    .some((o) => String(o.value) === String(t.eventID)));
  eq(orphanEv.map((t) => t.ticketID), [], 'every seeded event survives its own picker');
  const orphanPs = tickets.filter((t) => t.productScopeID != null && t.productScopeID !== ''
    && !forms.productScopesForTicket(t.eventID, t)
      .some((o) => String(o.value) === String(t.productScopeID)));
  eq(orphanPs.map((t) => t.ticketID), [], 'every seeded product scope survives its own picker');
  const custById = new Map(data.getEntity('Customers').map((c) => [String(c.customerID), c]));
  const orphanSup = tickets.filter((t) => {
    if (t.supplierID == null || t.supplierID === '') return false;
    const c = custById.get(String(t.supplierID));
    return !c || !asList(c.businessUnitID).map(String).includes(String(t.businessUnitID));
  });
  eq(orphanSup.map((t) => t.ticketID), [],
    'every re-keyed supplier serves the ticket unit (#281 union — the Supplier picker keeps it)');
}

console.log('== derived chain: the re-source does not flip inheritance at rest ==');
{
  const tickets = data.getEntity('Tickets');
  // the admitted-scope CONTEXT (∩ chosen scope) feeds requirements, the
  // TICKET-PROCEDURE pill and TICKET-INPUTS — pre-round census: identical
  // on all 160 tickets, inputs census 137/160 (#280). Assert the flip
  // guards, not the old rule (which is gone).
  eq(tickets.every((t) => resolve.ticketAdmittedScopeIds(t).length > 0), true,
    'every ticket keeps a non-empty admitted-scope context');
  const withInputs = tickets.filter((t) => resolve.ticketInputHandouts(t).length > 0);
  eq(withInputs.length, 137, 'TICKET-INPUTS census unchanged (137/160 — zero-flip proof)');
  const withReqs = tickets.filter((t) => resolve.ticketRequirements(t).length > 0);
  eq(withReqs.length > 0, true,
    `inherited requirement sets keep resolving (${withReqs.length}/160 tickets)`);
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
