#!/usr/bin/env node
// test_engine_ticket_constraints.mjs — proof suite for the issue #359
// REDEFINITION (sv96, superseding the sv95 manual-additions proof): the
// Selectable-on-Tickets flag is an additional FILTER layer for the
// ticket's Product Scope options. The Request-step input is renamed
// CONSTRAINTS and sits BEFORE Product Scope; it offers the flagged +
// Active requirements of the ticket's BUSINESS UNIT (the redefined rule —
// unit equality, nothing else), and the picks narrow the Product Scope
// options to the scopes whose comprehensive PS-REQUIREMENTS set covers
// ALL of them (AND — a filter narrows). The #359 manual-union in
// ticketRequirements is RETIRED — inheritance is the only requirement
// source again. Requirements.businessUnitID is MANDATORY (pre-RBAC
// correction); demo rows seeded ALL units — the explicit spelling of the
// former empty key's Q1 meaning, chain-preserving by construction.
// Run from prototype/:  node tools/test_engine_ticket_constraints.mjs

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

console.log('== schema: renamed key, mandatory unit, wizard placement ==');
{
  eq(model.getSchemaVersion() >= 96, true, `schemaVersion ${model.getSchemaVersion()} >= 96`);
  const cr = model.parseRule(catalog['Tickets'].byName['constraintID'].rule);
  eq([cr.kind, cr.target], ['fk', 'Requirements'], 'constraintID is a stored FK → Requirements');
  eq(catalog['Tickets'].byName['addedRequirementID'], undefined,
    'addedRequirementID renamed away (the manual-additions key is gone)');
  eq(catalog['Requirements'].byName['ticketSelectable'].type, 'BOOLEAN',
    'ticketSelectable stays the #218 real-boolean flag');
  eq(/NOT NULL/.test(String(catalog['Requirements'].byName['businessUnitID'].constraints)),
    true, 'Requirements.businessUnitID is MANDATORY (pre-RBAC correction)');
  const tf = catalog['Tickets'].form.fields;
  eq('Requirements' in tf, false, 'the Requirements-labelled field is gone');
  eq(tf.Constraints.attribute, 'constraintID', 'Constraints field binds the renamed key');
  eq(tf.Constraints.step, 'Request', 'Constraints lives on the Request step');
  const tKeys = Object.keys(tf);
  eq(tKeys.indexOf('Product Scope') - tKeys.indexOf('Constraints'), 1,
    'Constraints sits right BEFORE Product Scope (the redefined placement)');
  eq(tf.Constraints.check, 'Business Unit IS NOT NULL', 'Constraints gated on the Unit');
  const rule = Array.isArray(tf.Constraints['field-rule'])
    ? tf.Constraints['field-rule'].join('; ') : String(tf.Constraints['field-rule']);
  eq(/Allow multiple values/i.test(rule) && /filtered by Business Unit selected/i.test(rule),
    true, 'multivalued + unit-cascade spelling (#274 wiring)');
  eq(/filtered by Event \+ Applicant \+ Supplier \+ Constraints selected/i
    .test(String(tf['Product Scope']['field-rule'])), true,
  'Product Scope cascade NAMES Constraints (the filter layer is wired)');
}

console.log('== constraintsForTicketUnit: flag + unit equality, nothing else ==');
{
  const offered = forms.constraintsForTicketUnit('BU01').map((o) => String(o.value));
  eq(offered.every((id) => {
    const r = data.getById('Requirements', id);
    return r.ticketSelectable === true && asList(r.businessUnitID).map(String).includes('BU01');
  }), true, 'offered = flagged + Active + unit-matching only');
  // with the all-units seed every flagged row reaches every unit (8 clinic)
  eq(offered.length, 8, 'all-units seed: the whole flagged cohort reaches BU01 (8)');
  data.addRecord('Requirements', { requirementID: 'RQC-X', requirementName: 'RQC-X (t)',
    isActive: 'Active', ticketSelectable: true, businessUnitID: ['BU02'],
    regionID: [], scopeID: [], productGroupID: [], productScopeID: [], branchID: [] });
  eq(forms.constraintsForTicketUnit('BU01').some((o) => o.value === 'RQC-X'), false,
    'a constraint of ANOTHER unit is not offered (unit equality bites)');
  eq(forms.constraintsForTicketUnit('BU02').some((o) => o.value === 'RQC-X'), true,
    'offered on its own unit');
  data.getById('Requirements', 'RQC-X').ticketSelectable = false;
  eq(forms.constraintsForTicketUnit('BU02').some((o) => o.value === 'RQC-X'), false,
    'unflagged — never offered');
  data.removeRecords('Requirements', ['RQC-X']);
  eq(forms.manualRequirementsForTicket, undefined,
    'manualRequirementsForTicket retired (dead-helper posture)');
}

console.log('== the Constraints layer narrows the Product Scope options (AND) ==');
{
  const t0 = data.getEntity('Tickets').find((t) => t.applicantID != null);
  const ctx = { applicantID: t0.applicantID, supplierID: t0.supplierID };
  const base = forms.productScopesForTicket(t0.eventID, ctx).map((o) => String(o.value));
  eq(base.length > 0, true, `baseline offer (${base.length} scopes, #350 chain untouched)`);
  eq(forms.productScopesForTicket(t0.eventID, ctx, []).map((o) => String(o.value)), base,
    'no constraints picked — unfiltered (lenient)');
  // pin a probe requirement to ONE offered scope: picking it must narrow
  // the offer to exactly the scopes covering it
  const target = base[0];
  data.addRecord('Requirements', { requirementID: 'RQC-PIN', requirementName: 'RQC-PIN (t)',
    isActive: 'Active', ticketSelectable: true, businessUnitID: [String(t0.businessUnitID)],
    regionID: [], scopeID: [], productGroupID: [], productScopeID: [target], branchID: [] });
  const narrowed = forms.productScopesForTicket(t0.eventID, ctx, ['RQC-PIN'])
    .map((o) => String(o.value));
  eq(narrowed.every((id) => resolve.productScopeRequirementRows(data.getById('Product Scopes', id))
    .some((r) => String(r.requirementID) === 'RQC-PIN')), true,
  'every surviving scope covers the picked constraint (PS-REQUIREMENTS legs)');
  eq(narrowed.includes(target), true, 'the pinned scope survives');
  eq(narrowed.length < base.length || base.length === 1, true,
    'the layer NARROWS the offer');
  // AND semantics: an impossible pair (second constraint pinned to a scope
  // outside the offer) empties the intersection
  data.addRecord('Requirements', { requirementID: 'RQC-PIN2', requirementName: 'RQC-PIN2 (t)',
    isActive: 'Active', ticketSelectable: true, businessUnitID: [String(t0.businessUnitID)],
    regionID: [], scopeID: [], productGroupID: [], productScopeID: ['PS-GHOST'], branchID: [] });
  eq(forms.productScopesForTicket(t0.eventID, ctx, ['RQC-PIN', 'RQC-PIN2']).length, 0,
    'AND coverage: a constraint no offered scope answers empties the offer (honest gap)');
  data.removeRecords('Requirements', ['RQC-PIN', 'RQC-PIN2']);
}

console.log('== the union is RETIRED: inheritance is the only requirement source ==');
{
  const t0 = data.getEntity('Tickets')[0];
  const base = resolve.ticketRequirements(t0);
  data.addRecord('Requirements', { requirementID: 'RQC-U', requirementName: 'RQC-U (t)',
    isActive: 'Active', ticketSelectable: true, businessUnitID: [String(t0.businessUnitID)],
    regionID: [], scopeID: ['SC-GHOST'], productGroupID: [], productScopeID: [], branchID: [] });
  t0.constraintID = ['RQC-U'];
  eq(resolve.ticketRequirements(t0).includes('RQC-U'), false,
    'a picked constraint does NOT join the requirement set (pure filter)');
  eq(JSON.stringify(resolve.ticketRequirements(t0)), JSON.stringify(base),
    'inherited set identical with or without picks (#226 chain untouched)');
  t0.constraintID = [];
  data.removeRecords('Requirements', ['RQC-U']);
}

console.log('== census: mandatory units seeded, zero flips at rest ==');
{
  const reqs = data.getEntity('Requirements');
  const allUnits = data.getEntity('Business Units').map((u) => String(u.businessUnitID));
  eq(reqs.every((r) => asList(r.businessUnitID).length > 0), true,
    'every requirement carries its unit(s) — the mandatory rule holds on seeds');
  eq(reqs.every((r) => JSON.stringify(asList(r.businessUnitID).map(String)) ===
    JSON.stringify(allUnits)), true,
  'demo rows seeded ALL units — the explicit Q1 spelling (chain-preserving)');
  // the all-units key behaves exactly like the former empty one:
  eq(forms.requirementsForUnit('BU01').length, 15,
    'requirementsForUnit census unchanged (BU01 15/18 — the #304 region gate still bites)');
  const tickets = data.getEntity('Tickets');
  eq(tickets.every((t) => Array.isArray(t.constraintID) && t.constraintID.length === 0), true,
    'every ticket seeds an EMPTY constraint set (renamed key, zero at-rest changes)');
  const withInputs = tickets.filter((t) => resolve.ticketInputHandouts(t).length > 0);
  eq(withInputs.length, 137, 'TICKET-INPUTS census unchanged (137/160 — zero-flip guard)');
  eq(reqs.filter((r) => r.ticketSelectable).length, 8, 'flag cohort unchanged (8/18)');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
