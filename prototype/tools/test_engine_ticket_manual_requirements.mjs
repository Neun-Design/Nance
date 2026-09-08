#!/usr/bin/env node
// test_engine_ticket_manual_requirements.mjs — proof suite for issue #359
// (sv95): manually selectable requirements on Tickets. The Requirements
// wizard Registry step gains the "Selectable on Tickets" Yes/No decision
// (#218 real-boolean convention, default No); the Tickets wizard Request
// step gains a multivalued Requirements picker BELOW Product Scope that
// offers flagged + Active requirements compatible on the PARTY/GEOGRAPHY
// gates (unit #304, served region, customer/applicant #308, project
// branch #353) with the PRODUCT dimensions relaxed (session decision — an
// exact-match rule would offer nothing: a flagged match is already
// inherited), MINUS the live inherited set. ticketRequirements UNIONS the
// picks AFTER the untouched inheritance match — an added requirement binds
// like any inherited one (tab, TICKET-PROCEDURE, TICKET-INPUTS, staffing).
// Run from prototype/:  node tools/test_engine_ticket_manual_requirements.mjs

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

console.log('== schema: flag + stored picks, wizard placements ==');
{
  eq(model.getSchemaVersion() >= 95, true, `schemaVersion ${model.getSchemaVersion()} >= 95`);
  eq(catalog['Requirements'].byName['ticketSelectable'].type, 'BOOLEAN',
    'ticketSelectable is a BOOLEAN (#218 real-boolean convention)');
  const ar = model.parseRule(catalog['Tickets'].byName['addedRequirementID'].rule);
  eq([ar.kind, ar.target, ar.display], ['fk', 'Requirements', 'requirementName'],
    'addedRequirementID is a stored FK → Requirements');
  eq(/multivalued/i.test(String(catalog['Tickets'].byName['addedRequirementID'].notes)), true,
    'addedRequirementID multivalued');
  const rf = catalog['Requirements'].form.fields;
  eq(rf['Selectable on Tickets'].step, 'Registry', 'flag field lives on the Registry step');
  const rKeys = Object.keys(rf);
  eq(rKeys.indexOf('Selectable on Tickets') - rKeys.indexOf('Type'), 1,
    'flag field sits right after Type');
  eq(/default: No/i.test(String(rf['Selectable on Tickets']['field-rule'])), true,
    'defaults to No on new records (#220 spelling)');
  const tf = catalog['Tickets'].form.fields;
  eq(tf.Requirements.step, 'Request', 'picker lives on the Request step');
  const tKeys = Object.keys(tf);
  eq(tKeys.indexOf('Requirements') - tKeys.indexOf('Product Scope'), 1,
    'picker sits right below Product Scope (the issue placement)');
  eq(tf.Requirements.check, 'Business Unit IS NOT NULL', 'picker gated on the Unit');
  const rule = Array.isArray(tf.Requirements['field-rule'])
    ? tf.Requirements['field-rule'].join('; ') : String(tf.Requirements['field-rule']);
  eq(/Allow multiple values/i.test(rule), true, 'multivalued picker');
  eq(/filtered by Business Unit \+ Applicant \+ Customer \+ Project selected/i.test(rule), true,
    'cascade names the party/geography deps (#274 wiring)');
}

console.log('== picker rule: flag + party/geography gates, minus inherited ==');
{
  const t0 = data.getEntity('Tickets').find((t) => t.applicantID != null && t.projectID != null);
  const draft = { businessUnitID: t0.businessUnitID, applicantID: t0.applicantID,
    customerID: t0.customerID, projectID: t0.projectID, supplierID: t0.supplierID,
    eventID: t0.eventID, productScopeID: t0.productScopeID };
  const inherited = new Set(resolve.ticketRequirements(draft).map(String));
  const offered = forms.manualRequirementsForTicket(draft).map((o) => String(o.value));
  eq(offered.every((id) => !inherited.has(id)), true,
    'no offered requirement is already inherited (subtraction)');
  eq(offered.every((id) => data.getById('Requirements', id).ticketSelectable === true), true,
    'only flagged (Yes) requirements are offered');
  // synthetic probes
  const mk = (id, extra) => data.addRecord('Requirements', { requirementID: id,
    requirementName: `${id} (t)`, isActive: 'Active', ticketSelectable: true,
    businessUnitID: [], regionID: [], scopeID: ['SC-GHOST'], productGroupID: [],
    productScopeID: [], branchID: [], ...extra });
  mk('RQM-OK', {});                                    // scope-pinned → NOT inherited, party-free → offered
  mk('RQM-NO', { ticketSelectable: false });           // unflagged → never offered
  mk('RQM-DEAD', { isActive: 'Inactive' });            // Inactive → never offered
  mk('RQM-FCUST', { customerID: 'CUST-GHOST' });       // foreign customer → excluded
  mk('RQM-APP', { customerID: t0.applicantID });       // pinned to the APPLICANT → offered (#308 pair)
  mk('RQM-FUNIT', { businessUnitID: ['BU-GHOST'] });   // foreign unit → excluded
  const after = forms.manualRequirementsForTicket(draft).map((o) => String(o.value));
  eq([after.includes('RQM-OK'), after.includes('RQM-NO'), after.includes('RQM-DEAD'),
    after.includes('RQM-FCUST'), after.includes('RQM-APP'), after.includes('RQM-FUNIT')],
  [true, false, false, false, true, false],
  'flag + Active + party gates decide; product pins do NOT exclude (relaxed dimensions)');
  // branch gate: pin to a branch ≠ the project's → excluded; = the project's → offered
  const prj = data.getById('Projects', t0.projectID);
  const saved = prj.branchID;
  const brA = data.getEntity('Branches')[0]; const brB = data.getEntity('Branches')[1];
  prj.branchID = brA.branchID;
  mk('RQM-BR', { branchID: [brB.branchID] });
  eq(forms.manualRequirementsForTicket(draft).some((o) => o.value === 'RQM-BR'), false,
    'pinned to another branch than the project\'s — excluded');
  data.getById('Requirements', 'RQM-BR').branchID = [brA.branchID];
  eq(forms.manualRequirementsForTicket(draft).some((o) => o.value === 'RQM-BR'), true,
    'pinned to the project\'s branch — offered');
  prj.branchID = saved;
  data.removeRecords('Requirements', ['RQM-NO', 'RQM-DEAD', 'RQM-FCUST', 'RQM-APP',
    'RQM-FUNIT', 'RQM-BR']);

  console.log('== union: an added requirement binds like an inherited one ==');
  const base = resolve.ticketRequirements(t0);
  eq(base.includes('RQM-OK'), false, 'scope-pinned probe is NOT inherited (premise)');
  t0.addedRequirementID = ['RQM-OK'];
  const withAdd = resolve.ticketRequirements(t0);
  eq(withAdd.includes('RQM-OK'), true, 'manual pick joins the effective set (union)');
  eq(withAdd.length, base.length + 1, 'inheritance untouched — the union only appends');
  data.getById('Requirements', 'RQM-OK').isActive = 'Inactive';
  eq(resolve.ticketRequirements(t0).includes('RQM-OK'), false,
    'an Inactive pick drops (lifecycle posture, like inheritance)');
  data.getById('Requirements', 'RQM-OK').isActive = 'Active';
  t0.addedRequirementID = [...base.slice(0, 1), 'RQM-OK'];
  eq(resolve.ticketRequirements(t0).length, base.length + 1,
    'adding an already-inherited requirement does not duplicate (dedup)');
  t0.addedRequirementID = [];
  data.removeRecords('Requirements', ['RQM-OK']);
}

console.log('== census: honest seeds, zero flips at rest ==');
{
  const reqs = data.getEntity('Requirements');
  eq(reqs.every((r) => typeof r.ticketSelectable === 'boolean'), true,
    'every requirement carries the flag as a real boolean (parity)');
  const want = (r) => (asList(r.customerID).length > 0 || asList(r.regionID).length > 0);
  eq(reqs.filter((r) => r.ticketSelectable !== want(r)).map((r) => r.requirementID), [],
    'flag cohort = the deterministic customer-or-region rule (8/18 clinic)');
  eq(reqs.filter((r) => r.ticketSelectable).length, 8, 'clinic cohort census (8 flagged)');
  const tickets = data.getEntity('Tickets');
  eq(tickets.every((t) => Array.isArray(t.addedRequirementID)
    && t.addedRequirementID.length === 0), true,
  'every ticket seeds an EMPTY manual set (zero at-rest changes)');
  const withInputs = tickets.filter((t) => resolve.ticketInputHandouts(t).length > 0);
  eq(withInputs.length, 137, 'TICKET-INPUTS census unchanged (137/160 — zero-flip guard)');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
