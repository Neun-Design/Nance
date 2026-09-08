#!/usr/bin/env node
// test_engine_requirement_applicability.mjs — proof for issue #366 (sv99):
// the #364 doctrine on the REQUIREMENT side. Every applicability key must
// be DECLARED — an empty key keeps the requirement out of every
// inheritance ('apply to all' = every value explicitly selected; a value
// registered later requires revisiting the requirement). customerID is
// MULTIVALUED (was single, #180). Pre-sv99 snapshots keep the old Q1
// reading via legacyWildcardData(99); blank mode is always strict.
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
    eq(/#366/.test(String(by[k].notes)), true, `${k} notes record the #366 doctrine`);
  }
  const f = catalog['Requirements'].form.fields;
  const rule = (l) => String(f[l]['field-rule'] || '');
  eq(/allow multiple/i.test(rule('Branch')), true, 'Branch field is a multicheck now');
  eq(/allow multiple/i.test(rule('Customer')), true, 'Customer field is a multicheck now');
  eq(/SelectLabel = businessUnitName/.test(rule('Customer'))
    && /filtered by businessUnitID selected/.test(rule('Customer')), true,
  'Customer keeps the #212 grouping + cascade');
  const strip = catalog['Requirements'].form.steps.Applicability['step-description'];
  eq(/select all values|every dimension must be declared/i.test(strip), true,
    'the Applicability strip teaches the explicit-pick rule');
  eq(/applies to all \(Q1\)/i.test(strip), false, 'the old Q1 wording left the strip');
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
  const probe = data.getById('Requirements', 'RQ-T366');
  for (const k of KEYS) {
    const saved = probe[k];
    probe[k] = [];
    eq(resolve.ticketRequirements(t).map(String).includes('RQ-T366'), false,
      `blank ${k} keeps the requirement out of every inheritance (#366 strict)`);
    probe[k] = saved;
  }
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
  eq(forms.requirementsForUnit('BU01').map((o) => String(o.value)).includes('RQ-T366b'), false,
    'a requirement with undeclared unit/region is offered NOWHERE (#366; was: everywhere)');
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
