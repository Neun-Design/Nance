#!/usr/bin/env node
// test_engine_ticket_scope_sla_filter.mjs — the Product Scope options
// filter (Rafael, sv110): only the scopes that pass the SLA chain
// **Applicant → Supplier → BRANCH** are offered. The ticket's OUTPUT
// branch (sv108) gates the contract basis: an SLA pinned to ANOTHER
// branch drops — its payloads' events and scopes leave the ticket's
// universe; an SLA WITHOUT a branch is not branch-specific and stays
// (the #316 slasForProject posture); a blank ticket branch skips the
// dimension. Fixtures replicate the reported edqms_session shape (the
// TIC-1 incoherence: output branch BRA-3, SLA of BRA-2 — the filter must
// prevent that combination). Demo census: 0/20 SLAs carry a branch → the
// leg is 0-flip at rest by construction.
// Run from prototype/:  node tools/test_engine_ticket_scope_sla_filter.mjs

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

const dm = JSON.parse(fs.readFileSync('data/datamodel.json', 'utf-8'));

console.log('== schema: sv110, the Branch joins the SLA-basis wiring ==');
{
  eq(dm._meta.schemaVersion >= 110, true, `schemaVersion ${dm._meta.schemaVersion} >= 110`);
  const f = catalog['Tickets'].form.fields;
  eq(/\+ Branch/.test(String(f.Event['field-rule'])), true,
    'Event cascade names the Branch (#274 wired spelling)');
  eq(/\+ Branch/.test(String(f['Product Scope']['field-rule'])), true,
    'Product Scope cascade names the Branch');
  const src = fs.readFileSync('js/forms.js', 'utf-8');
  eq((src.match(/branchID: val\('Branch'\)/g) || []).length >= 2, true,
    'both dispatches pass the Branch into the SLA context');
}

// ---- fixtures: the edqms_session shape — one pair, two branches ----
// SLA-A (branch BR-A) packages PL-A (event EV-A, scope PS-A);
// SLA-B (branch BR-B) packages PL-B (event EV-B, scope PS-B);
// SLA-G (NO branch)   packages PL-G (event EV-A, scope PS-G).
const ps = data.getEntity('Product Scopes');
const [psA, psB, psG] = [ps[0], ps[1], ps[2]];
data.addRecord('Branches', { branchID: 'BR-SLA-A', branchName: 'A (t)', customerID: ['CUST01'] });
data.addRecord('Branches', { branchID: 'BR-SLA-B', branchName: 'B (t)', customerID: ['CUST01'] });
data.addRecord('Events', { eventID: 'EV-SLA-A', eventTitle: 'EvA (t)', scopeID: [], productID: [] });
data.addRecord('Events', { eventID: 'EV-SLA-B', eventTitle: 'EvB (t)', scopeID: [], productID: [] });
data.addRecord('Payload', { payloadID: 'PL-SLA-A', eventID: 'EV-SLA-A', productScopeID: [psA.productScopeID] });
data.addRecord('Payload', { payloadID: 'PL-SLA-B', eventID: 'EV-SLA-B', productScopeID: [psB.productScopeID] });
data.addRecord('Payload', { payloadID: 'PL-SLA-G', eventID: 'EV-SLA-A', productScopeID: [psG.productScopeID] });
data.addRecord('SLA', { slaID: 'SLA-T-A', customerID: ['CUST-APP'], supplierID: 'CUST-SUP',
  branchID: 'BR-SLA-A', payloadID: ['PL-SLA-A'], isActive: 'Active' });
data.addRecord('SLA', { slaID: 'SLA-T-B', customerID: ['CUST-APP'], supplierID: 'CUST-SUP',
  branchID: 'BR-SLA-B', payloadID: ['PL-SLA-B'], isActive: 'Active' });
data.addRecord('SLA', { slaID: 'SLA-T-G', customerID: ['CUST-APP'], supplierID: 'CUST-SUP',
  payloadID: ['PL-SLA-G'], isActive: 'Active' });
const ctx = (branch) => ({ applicantID: 'CUST-APP', supplierID: 'CUST-SUP', branchID: branch });

console.log('== the SLA basis: Applicant → Supplier → Branch ==');
{
  const ids = (c) => resolve.ticketAdmittedSLAs(c).map((s) => String(s.slaID))
    .filter((id) => id.startsWith('SLA-T'));
  eq(ids(ctx(null)).sort(), ['SLA-T-A', 'SLA-T-B', 'SLA-T-G'],
    'blank ticket branch → the dimension is skipped (all pair SLAs survive)');
  eq(ids(ctx('BR-SLA-A')).sort(), ['SLA-T-A', 'SLA-T-G'],
    'branch chosen → the other branch\'s SLA drops; the branch-less SLA stays (#316)');
  eq(ids(ctx('BR-SLA-B')).sort(), ['SLA-T-B', 'SLA-T-G'], 'symmetric for the other branch');
}

console.log('== the Product Scope options follow the filtered basis ==');
{
  const opts = (ev, branch) => forms.productScopesForTicket(ev, ctx(branch))
    .map((o) => String(o.value));
  eq(opts('EV-SLA-A', 'BR-SLA-A').sort(),
    [String(psA.productScopeID), String(psG.productScopeID)].sort(),
    'branch A: the A-contract scope + the branch-less contract scope are offered');
  eq(opts('EV-SLA-A', 'BR-SLA-B').includes(String(psA.productScopeID)), false,
    'the reported incoherence is CLOSED: with another output branch, the A-contract scope is NOT offerable');
  eq(opts('EV-SLA-B', 'BR-SLA-A'), [],
    'an event reachable only through the dropped SLA offers nothing');
  // the Event options follow the same basis
  const evs = (branch) => forms.eventsForTicket(ctx(branch)).map((o) => String(o.value))
    .filter((id) => id.startsWith('EV-SLA'));
  eq(evs('BR-SLA-A').sort(), ['EV-SLA-A'], 'Event options follow: only the surviving contracts\' events');
  eq(evs(null).sort(), ['EV-SLA-A', 'EV-SLA-B'], 'blank branch → both events (dimension skipped)');
}

console.log('== the inheritance chain rides the same basis ==');
{
  const t = { ticketID: 'TK-SLA-T', businessUnitID: 'BU01', applicantID: 'CUST-APP',
    supplierID: 'CUST-SUP', eventID: 'EV-SLA-A', branchID: 'BR-SLA-B' };
  eq(resolve.ticketAdmittedScopeIds(t), [String(psG.productScopeID)],
    'with another branch, only the BRANCH-LESS contract still covers the event (the A-contract scope is gone)');
  t.branchID = 'BR-SLA-A';
  eq(resolve.ticketAdmittedScopeIds(t).sort(),
    [String(psA.productScopeID), String(psG.productScopeID)].sort(),
    'switching to the contract\'s branch restores the admitted set');
}

data.removeRecords('SLA', ['SLA-T-A', 'SLA-T-B', 'SLA-T-G']);
data.removeRecords('Payload', ['PL-SLA-A', 'PL-SLA-B', 'PL-SLA-G']);
data.removeRecords('Events', ['EV-SLA-A', 'EV-SLA-B']);
data.removeRecords('Branches', ['BR-SLA-A', 'BR-SLA-B']);

console.log('== demo census: the leg sleeps at rest ==');
{
  eq(data.getEntity('SLA').filter((s) => s.branchID != null && s.branchID !== '').length, 0,
    '0/20 demo SLAs carry a branch — branch-less contracts survive every ticket (0 flips)');
  let withInputs = 0;
  for (const t of data.getEntity('Tickets')) if (resolve.ticketInputHandouts(t).length) withInputs += 1;
  eq(withInputs, 137, 'TICKET-INPUTS census preserved (137/160)');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
