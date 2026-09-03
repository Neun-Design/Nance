#!/usr/bin/env node
// test_engine_ticket_applicant.mjs — proof suite for issue #308 (schema v69):
// Tickets gain `applicantID`, the INTERNAL customer opening the ticket — a
// second requirement-inheritance party. The #226 customer gate widens to the
// (customer, applicant) pair: a requirement pinned to EITHER party is
// inherited; empty key = applies to all (Q1 unchanged); a legacy ticket
// without the key inherits through the customer alone. The form Applicant
// select sits before Customer and offers only Internal-type customers (the
// attribute-rule filter — Branches.customerID precedent, zero engine code).
// Run from prototype/:  node tools/test_engine_ticket_applicant.mjs

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

console.log('== schema: the second inheritance party ==');
{
  eq(model.getSchemaVersion() >= 69, true, `schemaVersion ${model.getSchemaVersion()} >= 69`);
  const r = model.parseRule(catalog['Tickets'].byName['applicantID'].rule);
  eq([r.kind, r.target, r.display], ['fk', 'Customers', 'customerName'],
    'applicantID is a stored FK → Customers displaying customerName');
  eq(r.filter, { field: 'customerType', value: 'Internal' },
    'attribute-rule filter pins the type (Branches precedent)');
  eq(forms.requiredAttrs('Tickets').has('applicantID'), false,
    'nullable — a ticket without an applicant inherits through the customer alone');
}

console.log('== form: Applicant before Customer ==');
{
  const f = catalog['Tickets'].form.fields;
  const keys = Object.keys(f);
  eq(f.Applicant.attribute, 'applicantID', 'Applicant binds applicantID');
  eq(keys.indexOf('Applicant') - keys.indexOf('Business Unit'), 1, 'Applicant follows Business Unit');
  eq(keys.indexOf('Customer') - keys.indexOf('Applicant'), 1, 'Customer follows Applicant (issue order)');
  eq(f.Applicant['field-rule'], null,
    'no field-rule — the Internal filter rides the attribute rule');
  const opt = forms.optionsForAttr('Tickets', 'applicantID', catalog['Tickets'].byName['applicantID'].rule);
  eq(opt.target, 'Customers', 'picker sourced from Customers');
  eq(opt.options.length > 0, true, `picker offers ${opt.options.length} internal customer(s)`);
  eq(opt.options.every((o) => data.getById('Customers', o.value).customerType === 'Internal'),
    true, 'only Internal-type customers offered');
}

console.log('== inheritance: the customer gate widens to the pair ==');
{
  const ticket = data.getEntity('Tickets').find((t) => t.customerID && t.eventID);
  const internal = data.getEntity('Customers')
    .find((c) => c.customerType === 'Internal' && String(c.customerID) !== String(ticket.customerID));
  data.addRecord('Requirements', {
    requirementID: 'REQ-APPL', requirementName: 'Applicant-pinned probe',
    requirementTypeID: null, customerID: internal.customerID, isActive: 'Active',
  });
  const bare = resolve.ticketRequirements({ ...ticket, applicantID: null });
  eq(bare.includes('REQ-APPL'), false,
    'pinned to a third party — NOT inherited without an applicant');
  const withAppl = resolve.ticketRequirements({ ...ticket, applicantID: internal.customerID });
  eq(withAppl.includes('REQ-APPL'), true,
    'the applicant brings its pinned requirements into the ticket');
  eq(bare.every((id) => withAppl.includes(id)), true,
    'the applicant only ADDS — the customer inheritance is untouched (union)');
  const otherAppl = resolve.ticketRequirements({ ...ticket, applicantID: 'CUST-GHOST' });
  eq(otherAppl.includes('REQ-APPL'), false,
    'a different applicant does not match the pinned requirement');
  // legacy rows never migrated carry NO key at all — resolves through the customer
  const legacy = { ...ticket };
  delete legacy.applicantID;
  eq(JSON.stringify(resolve.ticketRequirements(legacy)), JSON.stringify(bare),
    'a legacy ticket without the key inherits through the customer alone');
  // a requirement pinned to the ticket's own CUSTOMER still inherits (gate is a pair, not a swap)
  data.addRecord('Requirements', {
    requirementID: 'REQ-CUST', requirementName: 'Customer-pinned probe',
    requirementTypeID: null, customerID: ticket.customerID, isActive: 'Active',
  });
  const both = resolve.ticketRequirements({ ...ticket, applicantID: internal.customerID });
  eq(both.includes('REQ-CUST') && both.includes('REQ-APPL'), true,
    'both parties inherit together — customer-pinned AND applicant-pinned');
}

console.log('== seeds: cohort census (both postures demoed) ==');
{
  const tickets = data.getEntity('Tickets');
  eq(tickets.every((t) => 'applicantID' in t), true, 'every ticket carries the key (parity)');
  eq(tickets.filter((t) => t.applicantID == null).length > 0, true, 'null cohort alive');
  const keyed = tickets.filter((t) => t.applicantID != null);
  eq(keyed.length > 0, true, `${keyed.length} tickets declare an applicant`);
  eq(keyed.every((t) => {
    const c = data.getById('Customers', t.applicantID);
    return c && c.customerType === 'Internal';
  }), true, 'every seeded applicant is an Internal customer');
  eq(keyed.every((t) => {
    const c = data.getById('Customers', t.applicantID);
    return asList(c.businessUnitID).map(String).includes(String(t.businessUnitID));
  }), true, 'every seeded applicant serves the ticket\'s unit');
  eq(tickets.filter((_, i) => i % 3 === 0).every((t) => t.applicantID == null), true,
    'the i % 3 == 0 cohort is the null cohort (deterministic seed rule)');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
