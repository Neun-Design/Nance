#!/usr/bin/env node
// test_engine_requirement_applicability.mjs — the Requirements
// applicability contract (#366/sv99, REFINED at sv106 — the ruling
// semantics): a DECLARED dimension constrains the inheritance, an
// undeclared one does not (blank = unconstrained; version-independent —
// the sv99 strict reading and its legacy gate were reverted at sv106).
// customerID is MULTIVALUED (was single, #180).
// Display posture: a set naming the ENTIRE dimension reads as global — not
// a specific pin — in the Constraints facets (#353) and the
// PS-REQUIREMENTS legs (#288), so both authored partitions survive the
// sv99 materialization (namesFullDimension). Census at the flip: 0 flips
// across reqs(160) / dispatch(1502) / inputs(160) / fscope(388) /
// psreq(24) / facets(4) / picker(4).
// Run from prototype/:  node tools/test_engine_requirement_applicability.mjs

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
const KEYS = ['regionID', 'businessUnitID', 'branchID', 'customerID',
  'scopeID', 'productGroupID', 'productScopeID'];

console.log('== schema: sv99, doctrine on every key, cardinality flip ==');
{
  eq(dm._meta.schemaVersion >= 99, true, `schemaVersion ${dm._meta.schemaVersion} >= 99`);
  const by = catalog['Requirements'].byName;
  eq(/multivalued since issue #366/.test(String(by.customerID.notes)), true,
    'customerID notes record the cardinality flip (single #180 → multi #366)');
  for (const k of ['regionID', 'branchID', 'customerID', 'scopeID', 'productGroupID', 'productScopeID']) {
    eq(/#366|sv106/.test(String(by[k].notes)), true, `${k} notes record the doctrine (#366/sv106 refinement)`);
  }
  const f = catalog['Requirements'].form.fields;
  const rule = (l) => String(f[l]['field-rule'] || '');
  eq(/allow multiple/i.test(rule('Branch')), true, 'Branch field is a multicheck now');
  eq(/allow multiple/i.test(rule('Customer')), true, 'Customer field is a multicheck now');
  eq(/filtered by registryUnitID selected/.test(rule('Customer')), true,
    'Customer cascade re-pointed to the sv107 Registry filter (grouping dropped — single-unit filter)');
  const strip = catalog['Requirements'].form.steps.Applicability['step-description'];
  eq(/dimensions you DECLARE constrain/i.test(strip), true,
    'the Applicability strip teaches the declared-constrains rule (sv106 refinement)');
  eq(/applies to all \(Q1\)/i.test(strip), false, 'the old Q1 wording stays out of the strip');
}

console.log('== legacyWildcardData(99): the sv99 mockup is strict ==');
{
  eq(data.legacyWildcardData(99), false, 'requirement chains: strict on sv99 data');
  eq(data.legacyWildcardData(), false, 'procedure chains (default 98): still strict');
}

console.log('== namesFullDimension: the display reading of a materialized set ==');
{
  const allScopes = data.getEntity('Scopes').map((s) => s.scopeID);
  eq(resolve.namesFullDimension(allScopes, 'Scopes'), true, 'full dimension = true');
  eq(resolve.namesFullDimension(allScopes.slice(0, 1), 'Scopes'), false, 'proper subset = false');
  eq(resolve.namesFullDimension([], 'Scopes'), false, 'empty = false (not a pin either)');
}

console.log('== migration census: every key declared on every row ==');
{
  const rows = data.getEntity('Requirements');
  eq(rows.length, 18, 'clinic census (18 requirements)');
  for (const k of KEYS) {
    eq(rows.filter((r) => !asList(r[k]).length).length, 0, `no blank ${k} left`);
    eq(rows.every((r) => Array.isArray(r[k])), true, `${k} stored as a LIST on every row`);
  }
  const pinnedCust = rows.filter((r) => asList(r.customerID).length
    && !resolve.namesFullDimension(r.customerID, 'Customers'));
  eq(pinnedCust.length, 2, 'the two #180 customer-pinned rows survive as proper subsets');
  eq(pinnedCust.every((r) => asList(r.customerID).length === 1), true,
    'their scalars became singleton lists');
}

console.log('== matchRequirements: strict — any undeclared dimension = inherits nowhere ==');
{
  const t = data.getEntity('Tickets')[0];
  const before = resolve.ticketRequirements(t).map(String).sort();
  eq(before.length > 0, true, `probe ticket ${t.ticketID} inherits ${before.length} requirements`);
  // a fully-declared synthetic requirement inherits; blanking ANY key kills it
  const dims = Object.fromEntries(KEYS.map((k, i) => [k,
    data.getEntity(['Regions', 'Business Units', 'Branches', 'Customers', 'Scopes',
      'Product Groups', 'Product Scopes'][i]).map((r) => r[['regionID', 'businessUnitID',
      'branchID', 'customerID', 'scopeID', 'productGroupID', 'productScopeID'][i]])]));
  data.addRecord('Requirements', { requirementID: 'RQ-T366', requirementName: 'Probe (t)',
    isActive: 'Active', ...dims });
  eq(resolve.ticketRequirements(t).map(String).includes('RQ-T366'), true,
    'all-dimensions-declared requirement inherits (materialized "all")');
  // sv106 refinement (Rafael): a DECLARED dimension constrains, an
  // undeclared one does NOT — blanking any key leaves the requirement
  // inheriting (the dimension stops constraining); a declared key that
  // MISMATCHES the context excludes it
  const probe = data.getById('Requirements', 'RQ-T366');
  for (const k of KEYS) {
    const saved = probe[k];
    probe[k] = [];
    eq(resolve.ticketRequirements(t).map(String).includes('RQ-T366'), true,
      `blank ${k} does not constrain — the requirement still inherits (sv106)`);
    probe[k] = saved;
  }
  // declared-but-foreign customer excludes (the constraining direction)
  const foreignCust = data.getEntity('Customers').find((c) =>
    String(c.customerID) !== String(t.customerID) && String(c.customerID) !== String(t.applicantID ?? '')
    && String(c.customerID) !== String(t.supplierID ?? ''));
  const savedCust = probe.customerID;
  probe.customerID = [foreignCust.customerID];
  eq(resolve.ticketRequirements(t).map(String).includes('RQ-T366'), false,
    'a DECLARED customer key foreign to every party excludes (constrains)');
  probe.customerID = savedCust;
  // proper subsets still narrow: pin the probe to a scope the ticket admits
  const admitted = resolve.ticketAdmittedScopeIds(t);
  probe.productScopeID = [admitted[0]];
  eq(resolve.ticketRequirements(t).map(String).includes('RQ-T366'), true,
    'a proper subset naming an admitted scope still inherits');
  probe.productScopeID = data.getEntity('Product Scopes')
    .map((ps) => ps.productScopeID).filter((id) => !admitted.map(String).includes(String(id)));
  eq(resolve.ticketRequirements(t).map(String).includes('RQ-T366'),
    probe.productScopeID.length === 0,
    'a subset naming only unadmitted scopes does not inherit');
  data.removeRecords('Requirements', ['RQ-T366']);
  eq(JSON.stringify(resolve.ticketRequirements(t).map(String).sort()),
    JSON.stringify(before), 'probe removed — baseline restored');
}

console.log('== facets: the #353 partition survives the materialization ==');
{
  const facets = forms.facetedRequirementOptions('BU01', []);
  const count = (i) => facets[i].options.filter((o) => !o.header).length;
  eq([count(0), count(1), count(2), count(3)], [13, 0, 2, 0],
    'BU01 partition preserved: 13 global / 0 branch / 2 customer / 0 product-scope');
  eq(facets.map((x) => x.title), ['Business Unit Requirements', 'Branches Requirements',
    'Customers Requirements', 'Product Scopes Requirements'], 'facet order unchanged');
}

console.log('== PS-REQUIREMENTS: full-dimension sets do not pin (#288 display preserved) ==');
{
  const ps = data.getEntity('Product Scopes')[0];
  const before = resolve.productScopeRequirementRows(ps).map((r) => String(r.requirementID)).sort();
  // a materialized-global row does NOT attach via its full productScopeID set
  const global = data.getEntity('Requirements').find((r) =>
    resolve.namesFullDimension(r.productScopeID, 'Product Scopes'));
  eq(global != null, true, `a materialized-global requirement exists (${global && global.requirementID})`);
  eq(before.includes(String(global.requirementID))
    && !resolve.namesFullDimension(global.scopeID, 'Scopes')
    && !resolve.namesFullDimension(global.productGroupID, 'Product Groups'), before.includes(String(global.requirementID)),
  'if it appears, it is through a PINNED scope/pg leg — never the full set');
  // pinning the global to exactly this row attaches it via the named leg
  const saved = global.productScopeID;
  global.productScopeID = [ps.productScopeID];
  eq(resolve.productScopeRequirementRows(ps).map((r) => String(r.requirementID))
    .includes(String(global.requirementID)), true, 'a proper-subset pin attaches via the named leg');
  global.productScopeID = saved;
  eq(JSON.stringify(resolve.productScopeRequirementRows(ps).map((r) => String(r.requirementID)).sort()),
    JSON.stringify(before), 'restored — baseline intact');
}

console.log('== requirementsForUnit: strict keys, region census preserved ==');
{
  const bu1 = forms.requirementsForUnit('BU01').map((o) => String(o.value));
  eq(bu1.length, 15, 'BU01 offers 15/18 (the 3 RG03-pinned stay excluded — #304 census)');
  const bu2 = forms.requirementsForUnit('BU02').map((o) => String(o.value));
  eq(bu2.length, 18, 'BU02 (serves RG03) offers all 18');
  data.addRecord('Requirements', { requirementID: 'RQ-T366b', requirementName: 'Blank probe (t)',
    isActive: 'Active', businessUnitID: [], regionID: [] });
  eq(forms.requirementsForUnit('BU01').map((o) => String(o.value)).includes('RQ-T366b'), true,
    'a requirement with undeclared unit/region belongs to every unit universe (sv106 refinement)');
  data.removeRecords('Requirements', ['RQ-T366b']);
}

console.log('== inheritance invariant: every demo ticket keeps a non-empty set ==');
{
  const tickets = data.getEntity('Tickets');
  eq(tickets.filter((t) => resolve.ticketRequirements(t).length === 0).length, 0,
    `all ${tickets.length} tickets inherit at least one requirement (0-flip census rode here)`);
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
