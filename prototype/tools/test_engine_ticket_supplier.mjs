#!/usr/bin/env node
// test_engine_ticket_supplier.mjs — unit-test the Ticket Supplier Decision
// (issue #281): the Tickets form Supplier select is re-sourced from the
// customer's active-SLA suppliers (#272, suppliersForTicketCustomer —
// retired) to the UNIT's customers grouped by customerType, gated and
// filtered by the Business Unit select. Pure form-rule + data round: the
// generic stored-key cascade (Customers.businessUnitID) drives the filter,
// zero bespoke engine paths. The migration unions each supplying
// customer's units with its SLAs'/tickets' units so every seeded pair
// survives the new filter (edit-mode options must keep offering the
// stored value or the FK is wiped on save — the form-integrity trap).
// Run from prototype/:  node tools/test_engine_ticket_supplier.mjs

import fs from 'fs';
globalThis.fetch = async (p) => new Response(fs.readFileSync(p));

const model = await import('../js/model.js');
const data = await import('../js/data.js');
const { catalog } = await model.loadModel();
data.initMeta(catalog);
await data.loadData();
const forms = await import('../js/forms.js');

let fails = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails += 1; console.log(`  ✗ ${m}`); };
const eq = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));
const asList = (v) => (Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]));

const dm = JSON.parse(fs.readFileSync('data/datamodel.json', 'utf-8'));

console.log('== form: the Supplier select follows the Business Unit ==');
{
  eq(dm._meta.schemaVersion >= 56, true, `schemaVersion ${dm._meta.schemaVersion} >= 56`);
  const fld = catalog['Tickets'].form.fields['Supplier'];
  eq(fld.attribute, 'supplierID', 'field bound to the stored FK (not a name mirror)');
  eq(fld.check, 'Business Unit IS NOT NULL', 'gated on Business Unit (was Customer, #272)');
  const rule = asList(fld['field-rule']).join(' | ');
  eq(/SelectLabel = customerType/.test(rule), true, 'options grouped by customerType');
  // #274 trap regression: the cascade only wires listeners when the rule
  // matches the `filtered by <deps> selected` regex — free text is dead
  eq(/filtered by .*Business Unit.*selected/i.test(rule), true,
    'field-rule names the Business Unit dep in the wired spelling');
  eq(/Customer selected/.test(rule), false, 'the #272 Customer dep is gone');
}

console.log('== sourcing: the generic stored-key cascade, no bespoke branch ==');
{
  eq(forms.suppliersForTicketCustomer === undefined, true,
    'suppliersForTicketCustomer export removed (the #272 sourcing is retired)');
  eq(model.childKeyFor('Customers', 'Business Units'), 'businessUnitID',
    'the join key the generic cascade filters on');
  const stored = data.getEntity('Customers')
    .some((c) => c.businessUnitID != null && c.businessUnitID !== '');
  eq(stored, true, 'Customers store the key — the stored-branch filter is active');
  const { target, multi } = forms.optionsForAttr('Tickets', 'supplierID');
  eq([target, multi], ['Customers', false], 'options come from Customers, single-valued');
}

console.log('== filter: a unit offers exactly its customers ==');
{
  const serves = (c, unit) => asList(c.businessUnitID).map(String).includes(String(unit));
  const { options } = forms.optionsForAttr('Tickets', 'supplierID');
  const ids = new Set(options.map((o) => String(o.value)));
  eq(data.getEntity('Customers').every((c) => ids.has(String(c.customerID))), true,
    'unfiltered options = every customer (the unit dep narrows at cascade time)');
  const inUnit = data.getEntity('Customers').filter((c) => serves(c, 'BU02'));
  eq(inUnit.length > 0, true, `BU02 serves ${inUnit.length} customers`);
  const out = data.getEntity('Customers').find((c) => !serves(c, 'BU02'));
  eq(out != null, true, `a customer outside BU02 exists (${out && out.customerID})`);
  // the migrated union: ClinLab supplies BU02's contracts through the #272
  // total fallback, so it must now serve BU02 and survive the unit filter
  const clinlab = data.getById('Customers', 'CUST19');
  if (clinlab) eq(serves(clinlab, 'BU02'), true, 'CUST19 gained BU02 (migration union)');
  else ok('CUST19 absent (non-clinic dataset) — union invariants below still bind');
}

console.log('== seeds: every stored pair survives the unit filter ==');
{
  const custs = new Map(data.getEntity('Customers').map((c) => [String(c.customerID), c]));
  const serves = (id, unit) => {
    const c = custs.get(String(id));
    return !!c && asList(c.businessUnitID).map(String).includes(String(unit));
  };
  const badSla = data.getEntity('SLA')
    .filter((s) => s.supplierID != null && s.supplierID !== ''
      && !serves(s.supplierID, s.businessUnitID));
  eq(badSla.map((s) => s.slaID), [], 'every SLA supplier serves the contract\'s unit');
  const badTk = data.getEntity('Tickets')
    .filter((t) => t.supplierID != null && t.supplierID !== ''
      && !serves(t.supplierID, t.businessUnitID));
  eq(badTk.map((t) => t.ticketID), [],
    'every ticket supplier serves the ticket\'s unit (edit prefill keeps the FK)');
}

console.log('== downstream: any unit customer may be declared (#325 union doctrine) ==');
{
  // any unit customer may be declared as supplier without emptying the Event
  // offer: since issue #325 the supplier binds only the APPLICANT leg of the
  // SLA survival pair — the customer leg is untouched, so a stranger
  // supplier yields the same events as no supplier at all
  const slas = data.getEntity('SLA').filter((s) => String(s.isActive || 'Active') !== 'Inactive');
  const cust = slas[0].customerID;
  const prj = data.getEntity('Projects').find((p) => String(p.customerID) === String(cust));
  const supplying = new Set(slas
    .filter((s) => asList(s.customerID).map(String).includes(String(cust)))
    .map((s) => String(s.supplierID)));
  const stranger = data.getEntity('Customers')
    .find((c) => !supplying.has(String(c.customerID)) && String(c.customerID) !== String(cust));
  const bare = forms.eventsForTicket({ projectID: prj.projectID, customerID: cust })
    .map((o) => String(o.value));
  const viaStranger = forms.eventsForTicket({ projectID: prj.projectID, customerID: cust,
    supplierID: stranger.customerID }).map((o) => String(o.value));
  eq(bare.length > 0, true, 'the customer leg offers events (scenario anchor)');
  eq(viaStranger, bare, 'stranger supplier narrows nothing — it binds the applicant leg only');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
