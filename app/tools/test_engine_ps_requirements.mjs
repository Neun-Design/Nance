#!/usr/bin/env node
// test_engine_ps_requirements.mjs — proof suite for the Product Scope ↔
// Requirements link (issue #288, inverted by #294): the stored link lives on
// Requirements.productScopeID (the requirement declares which product scopes
// it applies to; the #288 Product Scopes.requirementID pick and the #290
// unit-exclusive picker are RETIRED — a requirement created FOR a business
// unit is inherited by the unit's product scopes automatically, so a
// form-level pick on the Product Scope was redundant). The visible
// REQUIREMENTS column / subitem tab render the comprehensive
// productScopeRequirements set — computed: PS-REQUIREMENTS(productScopeID):
// requirements NAMING the row ∪ explicitly connected via scope ∪ via product
// group — THREE legs only since #296: unit/region are exclusion gates,
// never sources (unit-wide inheritance lives on the ticket chain, Q1).
// Still no Q1 wildcard here: a
// requirement with ALL keys blank attaches nowhere (the ticket inheritance
// #226 keeps Q1, and gains the productScopeID dimension under it).
// Run from prototype/:  node tools/test_engine_ps_requirements.mjs

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
const fail = (m) => { fails += 1; console.log(`  ✗ ${m}`);
};
const eq = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));
const ids = (rows) => rows.map((r) => r.requirementID);
const asList = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);

console.log('== schema: the stored link lives on Requirements (#294) ==');
{
  const link = catalog['Requirements'].byName['productScopeID'];
  const r = model.parseRule(link.rule);
  eq([link.type, r.kind, model.resolveTable(r.target), r.display],
    ['FK', 'fk', 'Product Scopes', 'productScopeRegistry'],
    'Requirements.productScopeID: stored FK → Product Scopes, displayed by the registry code (#296)');
  eq(/multivalued/i.test(String(link.notes)), true, 'multivalued via the attribute note');
  // the #288 direct-pick FK is GONE — catalogue and data
  eq(catalog['Product Scopes'].byName['requirementID'], undefined,
    'Product Scopes.requirementID retired from the catalogue');
  eq(data.getEntity('Product Scopes').every((p) => !('requirementID' in p)), true,
    'no mockup product scope carries the retired key (parity)');
  eq(data.getEntity('Requirements').every((r2) => Array.isArray(r2.productScopeID)), true,
    'every mockup requirement carries the new stored key (migration parity)');
  // #366: the formerly-empty keys were materialized with the FULL dimension
  // ("all", explicit) — still no SPECIFIC target fabricated: a full set
  // reads as global and pins nothing (namesFullDimension display posture)
  eq(data.getEntity('Requirements')
    .every((r2) => resolve.namesFullDimension(r2.productScopeID, 'Product Scopes')), true,
  'every seeded key names the full dimension — no specific target fabricated (#366)');

  const comp = catalog['Product Scopes'].byName['productScopeRequirements'];
  const cr = model.parseRule(comp.rule);
  eq([cr.kind, cr.srcField, cr.display], ['psrequirements', 'productScopeID', 'requirementName'],
    'computed: PS-REQUIREMENTS(productScopeID) — srcField names the INVERSE key');
  eq([comp.type, comp['display-name'], comp['table-display'], comp['subitem-display']],
    ['mirror', 'REQUIREMENTS', true, true],
    'comprehensive attr: validator-safe mirror, REQUIREMENTS header, displayed');
}

console.log('== schema: forms — picker moved, #290 retired ==');
{
  const rf = catalog['Requirements'].form.fields['Product Scope'];
  eq(rf && rf.attribute, 'productScopeID', 'Requirements form gains the Product Scope picker');
  const rule = Array.isArray(rf['field-rule']) ? rf['field-rule'].join('; ') : String(rf['field-rule']);
  eq(/allow multiple/i.test(rule), true, 'multivalued picker');
  eq(/SelectLabel/.test(rule), false,
    'no grouping — options show the plain productScopeRegistry code (#296)');
  const CASCADE = /filtered by (?:the )?([A-Za-z .+&,]+?)(?: selected| field|$)/i;
  eq(CASCADE.test(rule) && /registryUnitID/.test(rule), true,
    'unit cascade wires via the sv107 Registry filter (#274 trap)');
  // Product Scopes form: the Requirements input is gone
  eq(catalog['Product Scopes'].form.fields['Requirements'], undefined,
    'Product Scopes form no longer picks requirements');
  // retired export (#281 pattern): the #290 strict helper left forms.js
  eq(forms.requirementsExclusiveToUnit, undefined,
    'requirementsExclusiveToUnit retired with the picker');
  const src = fs.readFileSync(new URL('../js/forms.js', import.meta.url), 'utf8');
  eq(/requirementsExclusiveToUnit/.test(src), false, 'no dead reference remains in forms.js');
}

console.log('== schema: subitem tabs (unchanged by #294) ==');
{
  eq(catalog['Requirements'].subitems.length, 0,
    'Requirements still declares no Product Scopes subitem (#288 downstream)');
  const tab = (catalog['Product Scopes'].subitems || [])[0];
  eq([tab && tab.table, tab && tab.via, tab && tab.tab && tab.tab.name],
    ['Requirements', 'productScopeRequirements', 'Requirements'],
    'Product Scopes: Requirements tab via the PS-REQUIREMENTS attr');
  const tk = catalog['Tickets'].subitems.find((si) => si.tab && si.tab.name === 'Requirements');
  eq([tk && tk.table, tk && tk.via], ['Requirements', 'requirementName'],
    'Tickets: Requirements tab via the INHERITED-REQUIREMENTS attr');
  const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  eq(/psrequirements/.test(app) && /productScopeRequirementRows/.test(app), true,
    'app.js still overrides the Product Scopes tab resolve (psrequirements)');
  eq(/inheritedreqs/.test(app), true, 'app.js still overrides the Tickets tab resolve');
}

console.log('== semantics: named ∪ scope ∪ product-group legs, no Q1 ==');
{
  const ps01 = data.getById('Product Scopes', 'PS01'); // BU01 · PG01 · SC02
  eq(ids(resolve.productScopeRequirementRows(ps01)), ['RQ06', 'RQ08', 'RQ09', 'RQ17'],
    'PS01: scope- and product-group-connected requirements only (no named/unit hits in the demo)');
  // no wildcard: RQ01 is Active with the connection keys MATERIALIZED to the
  // full dimensions (#366 — the explicit spelling of the former blanks); a
  // full set is global, not a specific pin, so the row still attaches
  // through NO connection leg (namesFullDimension display posture — the
  // #288 globals-stay-out decision survives the materialization)
  const rq01 = data.getById('Requirements', 'RQ01');
  eq([resolve.namesFullDimension(rq01.scopeID, 'Scopes'),
    resolve.namesFullDimension(rq01.productGroupID, 'Product Groups'),
    resolve.namesFullDimension(rq01.productScopeID, 'Product Scopes')],
  [true, true, true], 'probe: RQ01 connection keys name the full dimensions (global)');
  eq(rq01.businessUnitID.length > 0, true,
    'unit key mandatory since the #359 redefinition (all-units seed)');
  eq(ids(resolve.productScopeRequirementRows(ps01)).includes('RQ01'), false,
    'a global requirement attaches nowhere (full sets do not pin — #288 preserved)');
  // named leg: the requirement DECLARES the product scope — leads the list
  data.addRecord('Requirements', { requirementID: 'RQ-T-NAMED', requirementName: 'Named (t)',
    scopeID: [], productGroupID: [], businessUnitID: [], regionID: [],
    productScopeID: ['PS01'], isActive: 'Active' });
  eq(ids(resolve.productScopeRequirementRows(ps01))[0], 'RQ-T-NAMED',
    'a requirement naming PS01 attaches and leads (declared link first)');
  const ps02 = data.getById('Product Scopes', 'PS02');
  eq(ids(resolve.productScopeRequirementRows(ps02)).includes('RQ-T-NAMED'), false,
    'the named leg reaches only the declared product scopes');
  data.removeRecords('Requirements', ['RQ-T-NAMED']);
}

console.log('== semantics: unit/region are gates, never sources (#296) ==');
{
  const ps01 = data.getById('Product Scopes', 'PS01'); // BU01, serves RG01
  // #366: the inheritance probe declares every dimension (full = "all",
  // explicit) and pins only the unit — the strict #226 chain drops any
  // requirement with an undeclared key
  const dim = (tab, pk) => data.getEntity(tab).map((r2) => r2[pk]);
  const fullDims = {
    regionID: dim('Regions', 'regionID'), branchID: dim('Branches', 'branchID'),
    customerID: dim('Customers', 'customerID'), scopeID: dim('Scopes', 'scopeID'),
    productGroupID: dim('Product Groups', 'productGroupID'),
    productScopeID: dim('Product Scopes', 'productScopeID'),
  };
  data.addRecord('Requirements', { requirementID: 'RQ-T-UNIT1', requirementName: 'Unit-wide (t)',
    isActive: 'Active', ...fullDims, businessUnitID: ['BU01'] });
  eq(ids(resolve.productScopeRequirementRows(ps01)).includes('RQ-T-UNIT1'), false,
    'a requirement sharing the row\'s unit does NOT attach through that dimension (#296 — full connection sets do not pin)');
  data.addRecord('Requirements', { requirementID: 'RQ-T-REG1', requirementName: 'Region-wide (t)',
    scopeID: [], productGroupID: [], businessUnitID: [], regionID: ['RG01'], isActive: 'Active' });
  eq(ids(resolve.productScopeRequirementRows(ps01)).includes('RQ-T-REG1'), false,
    'a requirement sharing the row\'s served region does NOT attach either');
  // ticket inheritance carries the unit dimension — untouched by #296
  const tkt = data.getEntity('Tickets').find((t) => String(t.businessUnitID) === 'BU01');
  eq(tkt != null && resolve.ticketRequirements(tkt).includes('RQ-T-UNIT1'), true,
    'the unit-pinned requirement still inherits into the unit\'s tickets (#226 chain, all dims declared)');
  data.removeRecords('Requirements', ['RQ-T-UNIT1', 'RQ-T-REG1']);
}

console.log('== semantics: union of legs + unit/region gates + Inactive ==');
{
  const ps01 = data.getById('Product Scopes', 'PS01');
  data.addRecord('Requirements', { requirementID: 'RQ-T-UNION', requirementName: 'Union probe (t)',
    scopeID: ['SC02'], productGroupID: ['PG05'], businessUnitID: [], regionID: [], isActive: 'Active' });
  eq(ids(resolve.productScopeRequirementRows(ps01)).includes('RQ-T-UNION'), true,
    'scope leg admits a requirement whose product-group key names another group');
  data.addRecord('Requirements', { requirementID: 'RQ-T-GATE', requirementName: 'Unit gate (t)',
    scopeID: ['SC02'], productGroupID: [], businessUnitID: ['BU02'], regionID: [], isActive: 'Active' });
  eq(ids(resolve.productScopeRequirementRows(ps01)).includes('RQ-T-GATE'), false,
    'scope-connected requirement restricted to ANOTHER unit is excluded');
  data.addRecord('Requirements', { requirementID: 'RQ-T-REGION', requirementName: 'Region gate (t)',
    scopeID: ['SC02'], productGroupID: [], businessUnitID: [], regionID: ['RG-NOPE'], isActive: 'Active' });
  eq(ids(resolve.productScopeRequirementRows(ps01)).includes('RQ-T-REGION'), false,
    'region-specific requirement outside the unit\'s served regions is excluded');
  data.addRecord('Requirements', { requirementID: 'RQ-T-INACT', requirementName: 'Inactive (t)',
    scopeID: ['SC02'], productGroupID: [], businessUnitID: [], regionID: [], isActive: 'Inactive' });
  eq(ids(resolve.productScopeRequirementRows(ps01)).includes('RQ-T-INACT'), false,
    'Inactive requirements leave the derived legs');
  // …but the DECLARED link renders regardless (stored data wins; pickers
  // gate lifecycle, the display stays honest to the link)
  data.addRecord('Requirements', { requirementID: 'RQ-T-INACT2', requirementName: 'Inactive named (t)',
    scopeID: [], productGroupID: [], businessUnitID: [], regionID: [],
    productScopeID: ['PS01'], isActive: 'Inactive' });
  eq(ids(resolve.productScopeRequirementRows(ps01)).includes('RQ-T-INACT2'), true,
    'an Inactive requirement NAMING the row still lists');
  // pickers gate lifecycle (#231) — since #304 the Procedures picker is the
  // unit-scoped requirementsForUnit, and it never offers Inactive rows
  eq(forms.requirementsForUnit(null).some((o) => o.value === 'RQ-T-INACT2'), false,
    'the Procedures picker filters Inactive even when named (#231/#304)');
  data.removeRecords('Requirements', ['RQ-T-UNION', 'RQ-T-GATE', 'RQ-T-REGION', 'RQ-T-INACT', 'RQ-T-INACT2']);
}

console.log('== ticket chain: the productScopeID dimension under Q1 (#226/#294) ==');
{
  // replicate ticketRequirements' admitted-set head to pick in/out probes
  // (project-SLA ctx since issue #325 — the ticket row IS the ctx)
  const probe = data.getEntity('Tickets').map((t) => {
    let admitted = resolve.admittedProductScopeIds(t.eventID, t);
    const chosen = asList(t.productScopeID);
    if (chosen.length) admitted = admitted.filter((id) => chosen.includes(id));
    const out = data.getEntity('Product Scopes').map((p) => p.productScopeID)
      .find((id) => !admitted.includes(id));
    return { t, psIn: admitted[0], psOut: out };
  }).find((x) => x.psIn && x.psOut);
  eq(probe != null, true, 'probe ticket found (has admitted and non-admitted product scopes)');
  // #366: probes declare every dimension and pin only productScopeID
  const dim2 = (tab, pk) => data.getEntity(tab).map((r2) => r2[pk]);
  const declared = {
    regionID: dim2('Regions', 'regionID'), branchID: dim2('Branches', 'branchID'),
    businessUnitID: dim2('Business Units', 'businessUnitID'),
    customerID: dim2('Customers', 'customerID'), scopeID: dim2('Scopes', 'scopeID'),
    productGroupID: dim2('Product Groups', 'productGroupID'),
  };
  data.addRecord('Requirements', { requirementID: 'RQ-T-DIM', requirementName: 'PS dimension (t)',
    isActive: 'Active', ...declared, productScopeID: [probe.psIn] });
  eq(resolve.ticketRequirements(probe.t).includes('RQ-T-DIM'), true,
    'a requirement naming an ADMITTED product scope inherits into the ticket');
  data.removeRecords('Requirements', ['RQ-T-DIM']);
  data.addRecord('Requirements', { requirementID: 'RQ-T-DIM2', requirementName: 'PS dimension out (t)',
    isActive: 'Active', ...declared, productScopeID: [probe.psOut] });
  eq(resolve.ticketRequirements(probe.t).includes('RQ-T-DIM2'), false,
    'a requirement naming only NON-admitted product scopes stays out (AND dimension)');
  data.removeRecords('Requirements', ['RQ-T-DIM2']);
  // #366: the demo's materialized "all" rows keep inheriting (explicit lists)
  eq(resolve.ticketRequirements(probe.t).length > 0, true,
    'materialized all-dimension rows still inherit — the census rode the flip');
}

console.log('== picker retirement: the PS-following helper left with #304 ==');
{
  // requirementsForProductScopes was RETIRED by issue #304 — the Procedures
  // picker offers the unit-wide universe (requirementsForUnit, proven in
  // test_engine_procedure_requirements.mjs). The comprehensive PS set stays
  // proven on productScopeRequirementRows above.
  eq(forms.requirementsForProductScopes, undefined,
    'requirementsForProductScopes retired (#304)');
  const labels = forms.requirementsForUnit(null).map((o) => o.label);
  eq([...labels].sort((a, b) => a.localeCompare(b)), labels, 'picker options sorted by label');
}

console.log('== rendering: derivedValue joins names, dash when empty ==');
{
  const comp = catalog['Product Scopes'].byName['productScopeRequirements'];
  const v = String(resolve.derivedValue('Product Scopes', comp, data.getById('Product Scopes', 'PS01')));
  eq(v.split(', ').length, 4, `PS01 cell joins 4 requirement names (${v.slice(0, 60)}…)`);
  eq(/RQ\d/.test(v), false, 'names, never raw ids');
  const empty = data.getEntity('Product Scopes').find((p) => !resolve.productScopeRequirementRows(p).length);
  eq(empty != null, true, `probe: ${empty && empty.productScopeID} carries no connection`);
  eq(resolve.derivedValue('Product Scopes', comp, empty), '—',
    'no connection renders the dash — an untargeted product scope is legitimate (no gap-tag)');
}

console.log('== demo census: honest seeds ==');
{
  const pss = data.getEntity('Product Scopes');
  const withReqs = pss.filter((p) => resolve.productScopeRequirementRows(p).length).length;
  eq(withReqs, 19, `19/${pss.length} product scopes carry connections (5 honest empties; `
    + 'the unit leg adds nothing yet — 18/18 demo requirements have a blank unit key)');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
