#!/usr/bin/env node
// test_engine_sla_supplier.mjs — unit-test the SLA supplying party (issue
// #272): SLA.supplierID stored FK NOT NULL (form select = every customer,
// grouped by customerType), Tickets.supplierID nullable FK, and the
// supplier-narrowed Event / Product Scope chain (eventsForCustomerSLAs,
// admittedProductScopeIds — lenient wildcard posture kept). The Ticket
// Supplier picker sourcing moved to the unit's customers in issue #281 —
// see test_engine_ticket_supplier.mjs.
// Run from prototype/:  node tools/test_engine_sla_supplier.mjs

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

console.log('== schema: the contract has two parties ==');
{
  eq(dm._meta.schemaVersion >= 50, true, `schemaVersion ${dm._meta.schemaVersion} >= 50`);
  const sup = model.parseRule(catalog['SLA'].byName['supplierID'].rule);
  eq([sup.kind, sup.target], ['fk', 'Customers'], 'SLA.supplierID is a stored FK → Customers');
  eq(forms.requiredAttrs('SLA').has('supplierID'), true, 'SLA.supplierID is NOT NULL (a contract needs both parties)');
  const tsup = model.parseRule(catalog['Tickets'].byName['supplierID'].rule);
  eq([tsup.kind, tsup.target], ['fk', 'Customers'], 'Tickets.supplierID is a stored FK → Customers');
  eq(forms.requiredAttrs('Tickets').has('supplierID'), false, 'ticket supplier is nullable (wildcard posture)');
}

console.log('== form spec: grouped select + supplier-aware cascade ==');
{
  const sf = catalog['SLA'].form.fields;
  const sKeys = Object.keys(sf);
  eq(sf['Supplier'].attribute, 'supplierID', 'SLA Supplier field binds supplierID');
  eq(sf['Supplier'].check, null, 'SLA Supplier has no gate (every customer offered)');
  const sRule = JSON.stringify(sf['Supplier']['field-rule']);
  eq(sRule.includes('SelectLabel = customerType'), true, 'SLA Supplier groups by customerType');
  // sv68 supplier flow: the supplier is found through the branch (the
  // customer the branch points at — suppliersForBranch); the #272 "every
  // customer, no filter" posture survives as the no-branch lenient path
  eq(sRule.includes('filtered by branchID selected'), true,
    'SLA Supplier filtered by the branch (sv68 — cascade spelling wires the bespoke branch, #274 trap)');
  eq(sKeys.indexOf('Supplier') - sKeys.indexOf('Branch'), 1, 'Supplier sits right after Branch');
  eq(sKeys.indexOf('Supplier Department') - sKeys.indexOf('Supplier'), 1,
    'Supplier Department follows Supplier');
  eq(sKeys.indexOf('Customer') - sKeys.indexOf('Supplier Department'), 1,
    'Customer follows the supplying chain');

  const tf = catalog['Tickets'].form.fields;
  const tKeys = Object.keys(tf);
  eq(tf['Supplier'].attribute, 'supplierID', 'Ticket Supplier field binds supplierID');
  eq(tf['Supplier'].check, 'Business Unit IS NOT NULL',
    'Ticket Supplier gated on Business Unit (re-sourced by #281)');
  eq(tKeys.indexOf('Supplier') - tKeys.indexOf('Project'), 1, 'Ticket Supplier sits after Project');
  eq(tKeys.indexOf('Event') - tKeys.indexOf('Supplier'), 1, 'Event follows Supplier');
  eq(String(tf['Event']['field-rule']).includes('Customer + Supplier'), true,
    'Event cascade names Supplier (listener wiring)');
  eq(String(tf['Product Scope']['field-rule']).includes('Supplier'), true,
    'Product Scope cascade names Supplier (listener wiring)');
  // the Forecast Scope input (and its #274 cascade-spelling fix) left the
  // form in the 2026-09-03 input-removal round — the stored link is data-only
  eq('Forecast Scope' in tf, false, 'Forecast Scope input removed from the Tickets form (sv70)');
}

console.log('== seeds: every contract supplied, both postures demoed ==');
{
  const customers = data.getEntity('Customers');
  const byId = new Map(customers.map((c) => [String(c.customerID), c]));
  // the dedicated Supplier customerType left the enum in sv68 — the three
  // Vitalis medical suppliers relabelled External (session decision)
  eq(customers.filter((c) => !['Internal', 'External'].includes(c.customerType)).length, 0,
    'no customer carries a pre-sv68 type label');
  const slas = data.getEntity('SLA');
  eq(slas.every((s) => s.supplierID != null && s.supplierID !== ''
    && byId.has(String(s.supplierID))), true, 'every SLA supplier resolves in Customers');
  const supTypes = new Set(slas.map((s) => byId.get(String(s.supplierID)).customerType));
  eq(supTypes.has('External'), true, 'some contracts supplied by an external company');
  eq(supTypes.has('Internal'), true, 'some contracts supplied by an internal clinic (any type may supply)');

  const tickets = data.getEntity('Tickets');
  eq(tickets.every((t) => 'supplierID' in t), true, 'every ticket carries the supplierID key (parity)');
  eq(tickets.some((t) => t.supplierID == null), true, 'the wildcard cohort is alive (null supplier)');
  const linked = tickets.filter((t) => t.supplierID != null);
  eq(linked.length > 0, true, `${linked.length} tickets declare a supplier`);
  const bad = linked.filter((t) => !slas.some((s) => asList(s.customerID).map(String).includes(String(t.customerID))
    && String(s.isActive || 'Active') !== 'Inactive'
    && String(s.supplierID) === String(t.supplierID)));
  eq(bad.length, 0, 'every declared supplier belongs to an active SLA of the ticket\'s customer');
}

console.log('== picker: sourcing retired in favour of the unit\'s customers (issue #281) ==');
{
  eq(forms.suppliersForTicketCustomer === undefined, true,
    'suppliersForTicketCustomer export removed — the generic Business Unit cascade sources the Supplier select');
}

console.log('== narrowing: the (customer, supplier) pair filters the chain ==');
{
  // In-memory scenario: give the customer's second contract a different
  // supplier and a single payload — the pair must narrow to that contract.
  const slas = data.getEntity('SLA');
  const cust = slas[0].customerID;
  const mine = slas.filter((s) => String(s.customerID) === String(cust));
  eq(mine.length >= 2, true, `customer ${cust} holds ${mine.length} contracts (scenario needs 2)`);
  const [slaA, slaB] = mine;
  const savedSup = slaB.supplierID; const savedPl = slaB.payloadID;
  const otherSup = data.getEntity('Customers')
    .find((c) => String(c.customerID) !== String(slaA.supplierID)).customerID;
  slaB.supplierID = otherSup;
  slaB.payloadID = asList(slaB.payloadID).slice(0, 1);

  const all = forms.eventsForCustomerSLAs(cust).map((o) => String(o.value));
  const viaB = forms.eventsForCustomerSLAs(cust, otherSup).map((o) => String(o.value));
  const plB = data.getById('Payload', asList(slaB.payloadID)[0]);
  eq(viaB, [String(plB.eventID)], 'supplier B narrows the events to its single contracted payload');
  eq(viaB.every((v) => all.includes(v)), true, 'narrowed set ⊆ the unfiltered offer');
  const viaA = forms.eventsForCustomerSLAs(cust, slaA.supplierID).map((o) => String(o.value));
  eq(viaA.length >= viaB.length, true, 'supplier A keeps its own (wider) contract coverage');
  const ghost = forms.eventsForCustomerSLAs(cust, 'CUST-GHOST').map((o) => String(o.value));
  eq(ghost, all, 'unknown supplier → lenient (matches nothing, narrows nothing)');

  const psAll = forms.productScopesForTicket(plB.eventID, cust).map((o) => String(o.value));
  const psB = forms.productScopesForTicket(plB.eventID, cust, otherSup).map((o) => String(o.value));
  eq(psB.every((v) => psAll.includes(v)), true, 'product scopes narrowed by the pair ⊆ the customer offer');
  eq(psB.length > 0, true, 'the pair still packages scopes (wildcard payload widens, Q1)');

  // (the #274 demand-line narrowing block retired with forecastScopesForTicket
  // in the 2026-09-03 input-removal round — the Forecast Scope input left the
  // Tickets form and the stored link is data-only)
  eq(forms.forecastScopesForTicket === undefined, true,
    'forecastScopesForTicket export removed (dead-helper posture)');
  slaB.supplierID = savedSup; slaB.payloadID = savedPl;
}

console.log('== requirements: the AND-chain follows the pair ==');
{
  const ticket = data.getEntity('Tickets').find((t) => t.supplierID != null);
  const withSup = resolve.ticketRequirements(ticket);
  eq(Array.isArray(withSup), true, `supplier-declared ticket inherits ${withSup.length} requirement(s)`);
  const bare = resolve.ticketRequirements({ ...ticket, supplierID: null });
  eq(withSup.every((r) => bare.includes(r)), true,
    'declared supplier never ADDS requirements beyond the customer-wide set');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
