#!/usr/bin/env node
// test_engine_project_form_slim.mjs — the Projects form slim-down (Rafael's
// logical correction, sv111). Since #350/sv110 the ticket's contract
// universe is the Applicant → Supplier → Branch basis over ALL active SLAs,
// and since sv108 the only branch trace of inheritance is the ticket's
// OUTPUT branch — so the Projects Branch and SLA inputs were dead weight
// that could only confuse the user. Retired: the two form fields, the
// stored `branchID`/`slaID` attrs, the `productScopeName` coverage mirror
// (sourced from the no-longer-editable link) and the `slasForProject`
// picker helper (replaces test_engine_project_branch.mjs, whose feature
// this round retires). The Customer input STAYS — it filters the ticket's
// Project options and feeds the inheritance parties (Rule 2 of
// INHERITANCE_CONTRACT.md: project customer + applicant), proven live here.
// Run from prototype/:  node tools/test_engine_project_form_slim.mjs

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

console.log('== schema: the dead dimensions left Projects (sv111) ==');
{
  eq(dm._meta.schemaVersion >= 111, true, `schemaVersion ${dm._meta.schemaVersion} >= 111`);
  const by = catalog['Projects'].byName;
  eq(by.branchID === undefined, true, 'branchID attr retired (#316 superseded)');
  eq(by.slaID === undefined, true, 'slaID attr retired (#192 link superseded by the #350 basis)');
  eq(by.productScopeName === undefined, true,
    'productScopeName coverage mirror retired (derived via the retired slaID)');
  eq(by.customerID !== undefined, true, 'customerID STAYS — the inheritance party source');
}

console.log('== form: Branch/SLA gone, Customer intact ==');
{
  const f = catalog['Projects'].form.fields;
  eq('Branch' in f, false, 'Branch input removed');
  eq('SLA' in f, false, 'SLA input removed');
  eq(f.Customer && f.Customer.attribute, 'customerID', 'Customer input stays, bound to the FK');
  eq(f.Customer.check, 'Business Unit IS NOT NULL', 'Customer keeps its pre-RBAC gate (#346)');
  eq(forms.slasForProject === undefined, true,
    'slasForProject retired (dead-helper posture, #281/#294)');
}

console.log('== parity: the purged keys left every row (both-copy migration) ==');
{
  const rows = data.getEntity('Projects');
  eq(rows.length > 0, true, `${rows.length} demo projects loaded`);
  eq(rows.filter((p) => 'branchID' in p || 'slaID' in p || 'productScopeName' in p).length, 0,
    'no Projects row carries a retired key (migrate_project_form_slim.py)');
}

console.log('== the PROJECT CUSTOMER inheritance party (Rafael\'s rule, verified live) ==');
{
  // the removal does NOT touch the party chain: requirements connected to
  // the project's customer must keep inheriting into its tickets. The trace
  // reads the ticket's stored customerID, which the form cascade pins to
  // the project's customer (Customer select filters the Project options).
  const tickets = data.getEntity('Tickets');
  const agree = tickets.filter((t) => {
    const prj = t.projectID && data.getById('Projects', t.projectID);
    return prj && String(prj.customerID ?? '') === String(t.customerID ?? '');
  }).length;
  eq(agree, tickets.length,
    `ticket.customerID ≡ project.customerID on all ${tickets.length} tickets (cascade coherence)`);
  const t = tickets.find((tk) => tk.projectID && resolve.ticketAdmittedScopeIds(tk).length);
  const prj = data.getById('Projects', t.projectID);
  data.addRecord('Requirements', { requirementID: 'RQ-PRJ-CUST', requirementName: 'Project-customer probe (t)',
    isActive: 'Active', registryUnitID: asList(t.businessUnitID)[0] ?? 'BU01',
    customerID: [prj.customerID], businessUnitID: [], regionID: [], branchID: [],
    scopeID: [], productGroupID: [], productScopeID: [] });
  eq(resolve.ticketRequirements(t).map(String).includes('RQ-PRJ-CUST'), true,
    `pinned ONLY to the project's customer (${prj.customerID}) → inherited by ${t.ticketID}`);
  const other = data.getEntity('Customers').find((c) =>
    String(c.customerID) !== String(prj.customerID)
    && String(c.customerID) !== String(t.applicantID ?? ''));
  data.getById('Requirements', 'RQ-PRJ-CUST').customerID = [other.customerID];
  eq(resolve.ticketRequirements(t).map(String).includes('RQ-PRJ-CUST'), false,
    're-pinned to a foreign customer → excluded (declared constrains)');
  data.removeRecords('Requirements', ['RQ-PRJ-CUST']);
}

console.log('== the ticket chain never read the retired keys (regression) ==');
{
  // the Applicant → Supplier → Branch basis is project-blind: same
  // survivors with and without the projectID on the ctx
  const t = data.getEntity('Tickets').find((tk) => tk.projectID && tk.applicantID);
  const withPrj = resolve.ticketAdmittedSLAs(t).map((s) => String(s.slaID)).sort();
  const noPrj = resolve.ticketAdmittedSLAs({ ...t, projectID: null })
    .map((s) => String(s.slaID)).sort();
  eq(withPrj, noPrj, 'ticketAdmittedSLAs ignores the project (the #350 basis)');
  let withInputs = 0;
  for (const tk of data.getEntity('Tickets')) if (resolve.ticketInputHandouts(tk).length) withInputs += 1;
  eq(withInputs, 137, 'TICKET-INPUTS census preserved (137/160 — 0 flips)');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
