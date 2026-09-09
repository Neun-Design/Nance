#!/usr/bin/env node
// test_engine_procedure_wizard.mjs — proof suite for issue #353 (sv90):
// the Procedures drawer becomes a four-step WIZARD (Registry / Application
// / Constraints / Inputs & Outputs — the issue's reference mockup, first
// consumer of the form-spec `steps`), with the mockup's parenthetical
// notes as the filter contract.
//
// Data side: Procedures gain the APPLICABILITY keys branchID[]/customerID[]
// (declared only — the ticket→procedure match does NOT gate on them yet,
// #332 posture; seeded empty by #353, MATERIALIZED by #364: the empty-set
// wildcard is retired, "apply to all" = every value selected) and the
// stored-but-inert Requirements.branchID dimension is ACTIVATED
// (matchRequirements gate on the ticket's project branch; the
// forecastID.slaID.branchID rollup leg; the Branches Requirements facet).
// The Constraints step facets ONE stored requirementID[] set by what pins
// each requirement (most-specific facet wins); Inputs/Outputs re-point to
// the department-admitted handouts (the unit rides transitively — census
// 98/98 stored picks survive); Product Scopes KEEPS the process-packaged
// sourcing (the mockup's Unit+Department note awaits the Product Scope ↔
// Department link, issue #352 — a unit filter today would orphan 96/264
// stored picks and flip the #332 gate).
// Run from prototype/:  node tools/test_engine_procedure_wizard.mjs

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

console.log('== schema: applicability keys + wizard steps spec ==');
{
  eq(model.getSchemaVersion() >= 90, true, `schemaVersion ${model.getSchemaVersion()} >= 90`);
  const cat = catalog['Procedures'];
  const br = model.parseRule(cat.byName['branchID'].rule);
  eq([br.kind, br.target], ['fk', 'Branches'], 'branchID is a stored FK → Branches');
  eq(/multivalued/i.test(String(cat.byName['branchID'].notes)), true, 'branchID multivalued');
  eq(/does NOT gate/i.test(String(cat.byName['branchID'].notes)), true,
    'branchID notes record the declared-only session decision');
  const cu = model.parseRule(cat.byName['customerID'].rule);
  eq([cu.kind, cu.target], ['fk', 'Customers'], 'customerID is a stored FK → Customers');
  eq(/multivalued/i.test(String(cat.byName['customerID'].notes)), true, 'customerID multivalued');

  const spec = cat.form;
  eq(Object.keys(spec.steps || {}), ['Registry', 'Application', 'Constraints', 'Inputs & Outputs'],
    'four wizard steps in the mockup order');
  const stepOf = {};
  for (const [label, f] of Object.entries(spec.fields)) stepOf[label] = f.step;
  eq(Object.values(stepOf).every((s) => s != null), true, 'every field carries a step key');
  eq(['Registry Code', 'Unit', 'Department', 'Process', 'Task', 'Owner', 'Status',
    'Procedure URL', 'Execution Time'].every((l) => stepOf[l] === 'Registry'), true,
  'Registry step fields (Execution Time KEPT — session decision, the mockup omission)');
  eq(['Branches', 'Customers', 'Product Scopes'].map((l) => stepOf[l]),
    ['Application', 'Application', 'Application'], 'Application step fields');
  eq(stepOf['Requirements'], 'Constraints', 'Constraints step field');
  eq(['Inputs', 'Customer Inputs', 'Outputs'].map((l) => stepOf[l]),
    ['Inputs & Outputs', 'Inputs & Outputs', 'Inputs & Outputs'], 'Inputs & Outputs step fields');
}

console.log('== form spec: gates + wired spellings (#274 trap) + Apply-to-all tokens ==');
{
  const f = catalog['Procedures'].form.fields;
  const rule = (l) => (Array.isArray(f[l]['field-rule']) ? f[l]['field-rule'].join('; ') : String(f[l]['field-rule'] || ''));
  eq(f.Branches.check, 'Unit IS NOT NULL', 'Branches gated on Unit');
  eq(/filtered by Unit selected/i.test(rule('Branches')), true,
    'Branches cascade names Unit (generic stored-key path — Branches store businessUnitID)');
  eq(f.Customers.check, 'Unit IS NOT NULL', 'Customers gated on Unit');
  eq(/filtered by Unit \+ Branches selected/i.test(rule('Customers')), true,
    'Customers cascade names Unit + Branches (bespoke — the generic reverse read is the #309 trap)');
  eq(/filtered by Unit \+ Branches selected/i.test(rule('Requirements')), true,
    'Requirements cascade names Unit + Branches (faceted rebuild deps)');
  eq(/filtered by processID selected/i.test(rule('Product Scopes')), true,
    'Product Scopes KEEPS the process sourcing (unit/department filter awaits #352)');
  eq(/filtered by Department selected/i.test(rule('Inputs'))
    && /filtered by Department selected/i.test(rule('Outputs')), true,
  'Inputs/Outputs re-pointed to the Department dimension');
  // issue #364: the Apply-to-all token is RETIRED — applicability is an
  // explicit pick (the user selects every value to apply to all)
  for (const l of ['Branches', 'Customers', 'Product Scopes', 'Requirements', 'Customer Inputs']) {
    eq(/apply to all/i.test(rule(l)), false, `${l} no longer carries the Apply-to-all token (#364)`);
  }
}

console.log('== facetedRequirementOptions: partition + grouping + branch narrowing ==');
{
  const flat = (fac) => fac.options.filter((o) => !o.header).map((o) => o.value);
  // clinic BU01 baseline: 15 admitted (#304 census), 2 customer-pinned, none
  // pinned to branches/product scopes
  const base = forms.facetedRequirementOptions('BU01', []);
  eq(base.map((x) => x.title), ['Business Unit Requirements', 'Branches Requirements',
    'Customers Requirements', 'Product Scopes Requirements'], 'four facets in the mockup order');
  eq([flat(base[0]).length, flat(base[1]).length, flat(base[2]).length, flat(base[3]).length],
    [13, 0, 2, 0], 'clinic partition: 13 unit / 0 branch / 2 customer / 0 product-scope');
  eq(base[2].options.some((o) => o.header), true, 'customer facet groups per customer name');
  const union = base.flatMap(flat);
  eq(new Set(union).size, union.length, 'each requirement lands in exactly ONE facet (dedup)');
  eq(union.length, forms.requirementsForUnit('BU01').length,
    'the facets partition the FULL #304 unit universe');

  // synthetic probes: most-specific facet wins; branch narrowing bites.
  // #366: undeclared dimensions leave the universe entirely — the probes
  // materialize every leg ("all", explicit) and pin only what they test
  const br1 = data.getEntity('Branches')[0];
  const dim = (tab, pk) => data.getEntity(tab).map((r) => r[pk]);
  const allDims = {
    businessUnitID: dim('Business Units', 'businessUnitID'),
    regionID: dim('Regions', 'regionID'), scopeID: dim('Scopes', 'scopeID'),
    productGroupID: dim('Product Groups', 'productGroupID'),
    productScopeID: dim('Product Scopes', 'productScopeID'),
    customerID: dim('Customers', 'customerID'), branchID: dim('Branches', 'branchID'),
  };
  data.addRecord('Requirements', { requirementID: 'RQW-BR', requirementName: 'RQW-BR (t)',
    isActive: 'Active', ...allDims, branchID: [br1.branchID] });
  data.addRecord('Requirements', { requirementID: 'RQW-PSC', requirementName: 'RQW-PSC (t)',
    isActive: 'Active', ...allDims,
    productScopeID: ['PS01'], customerID: ['CUST01'], branchID: [br1.branchID] });
  const probe = forms.facetedRequirementOptions('BU01', []);
  eq(flat(probe[1]).includes('RQW-BR'), true, 'branch-pinned requirement lands in the Branches facet');
  eq(flat(probe[3]).includes('RQW-PSC') && !flat(probe[2]).includes('RQW-PSC')
    && !flat(probe[1]).includes('RQW-PSC'), true,
  'product-scope pin outranks customer/branch pins (most-specific facet wins)');
  // Customers facet narrowed by selected branches: keep only their
  // registered customers (Branches.customerID)
  const regd = new Set(asList(br1.customerID).map(String));
  const narrowed = forms.facetedRequirementOptions('BU01', [br1.branchID]);
  // customerID is multivalued since #366 — kept rows name ≥1 registered customer
  const keptOk = flat(narrowed[2]).every((id) =>
    asList(data.getById('Requirements', id).customerID).some((c) => regd.has(String(c))));
  eq(keptOk, true,
    'branch selection narrows the Customers facet to the registered customers');
  data.removeRecords('Requirements', ['RQW-BR', 'RQW-PSC']);
}

console.log('== customersForUnitBranches: bespoke reverse read (#309 trap regression) ==');
{
  const br1 = data.getEntity('Branches').find((b) => asList(b.customerID).length === 1);
  const all = forms.customersForUnitBranches(null, []).length;
  eq(all, data.getEntity('Customers').length, 'no unit/branches — every customer (lenient)');
  const unitOnly = forms.customersForUnitBranches('BU01', []);
  eq(unitOnly.every((o) => asList(data.getById('Customers', o.value).businessUnitID)
    .map(String).includes('BU01')), true, 'unit filter — only BU01 customers');
  const viaBr = forms.customersForUnitBranches(null, [br1.branchID]);
  eq(viaBr.map((o) => String(o.value)), asList(br1.customerID).map(String),
    'branch narrowing reads Branches.customerID — NOT the sharedDomainJoin segment-mates');
}

console.log('== handoutsForDepartment: the Inputs/Outputs re-point ==');
{
  eq(forms.handoutsForDepartment(null).length, data.getEntity('Handouts').length,
    'no department — every handout (lenient)');
  const offered = forms.handoutsForDepartment('DPT03').map((o) => String(o.value));
  eq(offered.length < data.getEntity('Handouts').length, true, 'the department filter narrows');
  eq(offered.every((id) => {
    const ds = asList(data.getById('Handouts', id).departmentID).map(String);
    return !ds.length || ds.includes('DPT03');
  }), true, 'offered = department-admitted or department-free (Q1, #340 posture)');
  // census: every stored Input/Output pick survives its procedure's picker
  const orphans = [];
  for (const pr of data.getEntity('Procedures')) {
    const opts = new Set(forms.handoutsForDepartment(pr.departmentID).map((o) => String(o.value)));
    for (const key of ['taskInput', 'taskOutput']) {
      for (const hid of asList(pr[key])) {
        if (!opts.has(String(hid))) orphans.push(`${pr.procedureID}:${hid}`);
      }
    }
  }
  eq(orphans, [], 'census: 98/98 stored Input/Output picks survive the department filter');
}

console.log('== Requirements.branchID: the OUTPUT-branch inheritance gate (sv108) ==');
{
  // sv108 (Rafael's conceptual fix): the branch context is the ticket's
  // OWN stored branchID — the Applicant's branch receiving the output;
  // the project branch no longer participates. Blank input skips.
  const t0 = data.getEntity('Tickets')[0];
  const savedBranch = t0.branchID;
  const brX = data.getEntity('Branches')[0];
  const brY = data.getEntity('Branches')[1];
  const dim = (tab, pk) => data.getEntity(tab).map((r) => r[pk]);
  data.addRecord('Requirements', { requirementID: 'RQW-GATE', requirementName: 'RQW-GATE (t)',
    isActive: 'Active', businessUnitID: dim('Business Units', 'businessUnitID'),
    regionID: dim('Regions', 'regionID'), scopeID: dim('Scopes', 'scopeID'),
    productGroupID: dim('Product Groups', 'productGroupID'),
    productScopeID: dim('Product Scopes', 'productScopeID'),
    customerID: dim('Customers', 'customerID'), branchID: [brX.branchID] });
  t0.branchID = brX.branchID;
  eq(resolve.ticketRequirements(t0).includes('RQW-GATE'), true,
    'output branch = the pinned branch — the requirement inherits');
  t0.branchID = brY.branchID;
  eq(resolve.ticketRequirements(t0).includes('RQW-GATE'), false,
    'output branch elsewhere — excluded (the dimension bites)');
  t0.branchID = null;
  eq(resolve.ticketRequirements(t0).includes('RQW-GATE'), true,
    'no output branch — dimension skipped (lenient, the region posture)');
  t0.branchID = savedBranch;
  data.removeRecords('Requirements', ['RQW-GATE']);
  // zero flips at rest: every clinic requirement names EVERY branch (the
  // #366 materialized spelling of the formerly-empty key) — the gate still
  // bites nothing until a row is narrowed in the UI
  eq(data.getEntity('Requirements')
    .filter((r) => !resolve.namesFullDimension(r.branchID, 'Branches')).length, 0,
  'clinic census: 18/18 requirements name the full branch dimension — no bite at rest');
  const withInputs = data.getEntity('Tickets')
    .filter((t) => resolve.ticketInputHandouts(t).length > 0);
  eq(withInputs.length, 137, 'TICKET-INPUTS census unchanged (137/160 — zero-flip guard)');
}

console.log('== Forecast Scopes rollup: the contract-branch leg ==');
{
  const reqAttr = catalog['Forecast Scopes'].byName['requirementID'];
  const rule = model.parseRule(reqAttr.rule);
  eq(rule.viaList.includes('forecastID.slaID.branchID'), true,
    'declared via chain carries the forecastID.slaID.branchID leg (#353)');
  const ps01 = data.getById('Product Scopes', 'PS01');
  const brX = data.getEntity('Branches')[0];
  const brY = data.getEntity('Branches')[1];
  data.addRecord('Customers', { customerID: 'FCW1', customerName: 'Branch Cust (t)' });
  data.addRecord('SLA', { slaID: 'SLAW1', slaCode: 'SLAW1', customerID: 'FCW1',
    branchID: brX.branchID, payloadID: [], isActive: 'Active' });
  data.addRecord('Forecasts', { forecastID: 'FRCW1', customerID: 'FCW1', slaID: 'SLAW1' });
  data.addRecord('Forecast Scopes', { forecastScopeID: 'FSW1', forecastID: 'FRCW1',
    scopeID: ps01.scopeID, productGroupID: ps01.productGroupID });
  data.addRecord('Requirements', { requirementID: 'RQW-FBR', requirementName: 'RQW-FBR (t)',
    isActive: 'Active', businessUnitID: [], regionID: [], scopeID: [ps01.scopeID],
    productGroupID: [ps01.productGroupID], productScopeID: [], branchID: [brX.branchID] });
  const fsw1 = data.getById('Forecast Scopes', 'FSW1');
  const ids = () => resolve.childrenOf('Forecast Scopes', fsw1, 'Requirements',
    { viaList: rule.viaList }).map((k) => k.requirementID);
  eq(ids().includes('RQW-FBR'), true, 'contract on the pinned branch — the requirement rolls up');
  data.getById('SLA', 'SLAW1').branchID = brY.branchID;
  eq(ids().includes('RQW-FBR'), false, 'contract on ANOTHER branch — excluded');
  data.getById('SLA', 'SLAW1').branchID = null;
  eq(ids().includes('RQW-FBR'), true, 'branch-less contract — empty path skips the leg (lenient)');
  data.removeRecords('Requirements', ['RQW-FBR']);
  data.removeRecords('Forecast Scopes', ['FSW1']);
  data.removeRecords('Forecasts', ['FRCW1']);
  data.removeRecords('SLA', ['SLAW1']);
  data.removeRecords('Customers', ['FCW1']);
}

console.log('== steps convention: generalized for ANY form (follow-up round, sv91) ==');
{
  const dm = JSON.parse(fs.readFileSync('data/datamodel.json', 'utf8'));
  eq(typeof dm._meta['form-steps-convention'], 'string',
    '_meta carries the form-steps-convention (adoption is pure datamodel authoring)');
  eq(/ANY form/i.test(dm._meta['form-steps-convention']), true,
    'the convention states the wizard is not Procedures-specific');
  // datamodel-wide consistency (the validate_mockup §1d contract): every
  // stepped form has unique integer step-orders and every field.step names
  // a declared title — the silent always-visible-host trap stays guarded
  const bad = [];
  for (const m of Object.values(dm.modules)) {
    for (const [tname, t] of Object.entries(m.tables || {})) {
      const form = t.form || {};
      const steps = form.steps;
      if (!steps || typeof steps !== 'object') continue;
      const orders = Object.values(steps).map((s) => s && s['step-order']);
      if (orders.some((o) => !Number.isInteger(o)) || new Set(orders).size !== orders.length) {
        bad.push(`${tname}: step-orders ${JSON.stringify(orders)}`);
      }
      for (const [label, f] of Object.entries(form.fields || {})) {
        if (f && f.step && !(f.step in steps)) bad.push(`${tname}.${label}: "${f.step}"`);
      }
    }
  }
  eq(bad, [], 'every stepped form declares consistent steps (datamodel-wide walk)');
}

console.log('== seeds: applicability keys on every procedure, materialized (#364) ==');
{
  const procs = data.getEntity('Procedures');
  eq(procs.length, 49, 'clinic census (49 procedures)');
  eq(procs.every((p) => 'branchID' in p && 'customerID' in p), true,
    'every procedure carries both applicability keys (parity)');
  // issue #364: the wizard round's honest-empty seeds (Q1 = all) were
  // MATERIALIZED — "applies to all" is now every value explicitly stored
  eq(procs.every((p) => asList(p.branchID).length > 0 && asList(p.customerID).length > 0), true,
    'all MATERIALIZED — the retired wildcard became the explicit unit-wide lists (#364)');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
