#!/usr/bin/env node
// test_engine_ps_requirements.mjs — proof suite for Product Scope
// Requirements (issue #288): Product Scopes.requirementID became the STORED
// direct-pick FK (the link moved to the Product Scope form) and the visible
// REQUIREMENTS column moved to the comprehensive productScopeRequirements
// set — computed: PS-REQUIREMENTS(requirementID): direct picks ∪ the
// requirements EXPLICITLY connected to the row's scope ∪ those explicitly
// connected to its product group. Session decision: explicit connections
// ONLY — no Q1 wildcard here (a requirement with blank scope/product-group
// keys applies exactly where it is pinned; the ticket inheritance #226 keeps
// its own Q1 posture). Derived legs skip Inactive rows and stay gated by the
// requirement's unit/region applicability. Downstream: the Requirements
// table lost its Product Scopes subitem; Product Scopes gained the
// Requirements tab; Tickets gained a Requirements tab over the live
// inherited set (authored spec, via normalized to the INHERITED-REQUIREMENTS
// attr); requirementsForProductScopes (the Procedures picker) follows the
// comprehensive set.
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

console.log('== schema: stored direct-pick FK + comprehensive mirror ==');
{
  const direct = catalog['Product Scopes'].byName['requirementID'];
  const r = model.parseRule(direct.rule);
  eq([direct.type, r.kind, model.resolveTable(r.target)], ['FK', 'fk', 'Requirements'],
    'requirementID is a stored FK → Requirements (the retired compound rollup)');
  eq(/multivalued/i.test(String(direct.notes)), true, 'multivalued via the attribute note');
  eq(direct['table-display'], false, 'direct picks stay out of the table (REQUIREMENTS took over)');

  const comp = catalog['Product Scopes'].byName['productScopeRequirements'];
  const cr = model.parseRule(comp.rule);
  eq([cr.kind, cr.srcField, cr.display], ['psrequirements', 'requirementID', 'requirementName'],
    'computed: PS-REQUIREMENTS(requirementID) (display: requirementName) parses');
  eq([comp.type, comp['display-name'], comp['table-display'], comp['subitem-display']],
    ['mirror', 'REQUIREMENTS', true, true],
    'comprehensive attr: validator-safe mirror, REQUIREMENTS header, displayed');
}

console.log('== schema: form — unit-led cascade + Requirements picker ==');
{
  const f = catalog['Product Scopes'].form.fields;
  eq(f['Business Unit'] && f['Business Unit'].attribute, 'businessUnitID',
    'Business Unit is USER INPUT (authored spec)');
  // #274 dead-cascade trap: a picker only wires listeners when its rule
  // matches the `filtered by … selected` regex the engine greps for
  const CASCADE = /filtered by (?:the )?([A-Za-z .+&,]+?)(?: selected| field|$)/i;
  for (const label of ['Product Group', 'Scope']) {
    const rule = String(f[label]['field-rule']);
    eq(CASCADE.test(rule) && /businessUnitID/.test(rule), true,
      `${label}: unit cascade spelling wires (${rule})`);
    eq(f[label].check, 'Business Unit IS NOT NULL', `${label}: gated on the unit`);
  }
  const req = f['Requirements'];
  eq(req && req.attribute, 'requirementID', 'Requirements picker binds the stored FK');
  const rule = String(req['field-rule']);
  eq(/allow multiple/i.test(rule), true, 'multivalued picker');
  eq(/SelectLabel\s*=\s*requirementTypeName/.test(rule), true, 'grouped by requirementType');
  eq(/only active/i.test(rule), true, 'soft-deleted requirements are not offered');
  // the authored "SelectLabel ==" spelling must match the engine's grep
  const src = fs.readFileSync(new URL('../js/forms.js', import.meta.url), 'utf8');
  eq(/SelectLabel\\s\*=\{1,2\}/.test(src.replace(/[\\]/g, '\\')) || /=\{1,2\}/.test(src), true,
    'forms.js tolerates "SelectLabel ==" (authored Business Unit field)');
  eq(/only active/i.test(src), true, 'forms.js implements the "only Active" option filter');
}

console.log('== schema: subitem tabs moved ==');
{
  eq(catalog['Requirements'].subitems.length, 0,
    'Requirements lost the Product Scopes subitem (issue downstream impact)');
  const tab = (catalog['Product Scopes'].subitems || [])[0];
  eq([tab && tab.table, tab && tab.via, tab && tab.tab && tab.tab.name],
    ['Requirements', 'productScopeRequirements', 'Requirements'],
    'Product Scopes: Requirements tab via the PS-REQUIREMENTS attr');
  const tk = catalog['Tickets'].subitems.find((si) => si.tab && si.tab.name === 'Requirements');
  eq([tk && tk.table, tk && tk.via], ['Requirements', 'requirementName'],
    'Tickets: Requirements tab via the INHERITED-REQUIREMENTS attr (authored via normalized)');
  eq(catalog['Tickets'].byName['requirementName']['table-display'], false,
    'the joined-names Tickets column is hidden — the tab replaces it (authored)');
  // both via attrs are LIVE-derived — the tab resolve is overridden in app.js
  const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  eq(/psrequirements/.test(app) && /productScopeRequirementRows/.test(app), true,
    'app.js overrides the Product Scopes tab resolve (psrequirements)');
  eq(/inheritedreqs/.test(app), true, 'app.js overrides the Tickets tab resolve (inheritedreqs)');
}

console.log('== semantics: explicit connections only, deduped, direct first ==');
{
  const ps01 = data.getById('Product Scopes', 'PS01'); // BU01 · PG01 · SC02
  eq(ids(resolve.productScopeRequirementRows(ps01)), ['RQ06', 'RQ08', 'RQ09', 'RQ17'],
    'PS01: scope- and product-group-connected requirements only');
  // no Q1 wildcard: RQ01 is Active with BOTH keys blank (and its region set
  // includes BU01\'s served RG01) — under the retired compound rollup it
  // matched every product scope; now it applies only where pinned
  const rq01 = data.getById('Requirements', 'RQ01');
  eq([rq01.scopeID, rq01.productGroupID], [[], []], 'probe: RQ01 keys are blank (global)');
  eq(ids(resolve.productScopeRequirementRows(ps01)).includes('RQ01'), false,
    'blank-key requirement does NOT attach (no Q1 on the comprehensive set)');
  // direct pick: pinning RQ01 (and the already-connected RQ08) on a row —
  // picks come first, dedup keeps one RQ08
  data.addRecord('Product Scopes', { productScopeID: 'PS-T288', businessUnitID: 'BU01',
    productGroupID: 'PG01', scopeID: 'SC02', requirementID: ['RQ01', 'RQ08'], isActive: true });
  const t = data.getById('Product Scopes', 'PS-T288');
  eq(ids(resolve.productScopeRequirementRows(t)), ['RQ01', 'RQ08', 'RQ06', 'RQ09', 'RQ17'],
    'direct picks lead, scope/product-group legs follow, RQ08 deduped');
  data.removeRecords('Product Scopes', ['PS-T288']);
}

console.log('== semantics: union of legs (the AND-pair pain is gone) ==');
{
  const ps01 = data.getById('Product Scopes', 'PS01');
  // scope hit + FOREIGN product group: the retired AND rollup rejected this
  // combination — the grouping pain the issue solves; the union admits it
  data.addRecord('Requirements', { requirementID: 'RQ-T-UNION', requirementName: 'Union probe (t)',
    scopeID: ['SC02'], productGroupID: ['PG05'], businessUnitID: [], regionID: [], isActive: 'Active' });
  eq(ids(resolve.productScopeRequirementRows(ps01)).includes('RQ-T-UNION'), true,
    'scope leg admits a requirement whose product-group key names another group');
  data.removeRecords('Requirements', ['RQ-T-UNION']);
}

console.log('== semantics: unit/region gates + Inactive posture ==');
{
  const ps01 = data.getById('Product Scopes', 'PS01'); // BU01 serves RG01
  data.addRecord('Requirements', { requirementID: 'RQ-T-UNIT', requirementName: 'Unit gate (t)',
    scopeID: ['SC02'], productGroupID: [], businessUnitID: ['BU02'], regionID: [], isActive: 'Active' });
  eq(ids(resolve.productScopeRequirementRows(ps01)).includes('RQ-T-UNIT'), false,
    'scope-connected requirement restricted to ANOTHER unit is excluded');
  data.addRecord('Requirements', { requirementID: 'RQ-T-REGION', requirementName: 'Region gate (t)',
    scopeID: ['SC02'], productGroupID: [], businessUnitID: [], regionID: ['RG-NOPE'], isActive: 'Active' });
  eq(ids(resolve.productScopeRequirementRows(ps01)).includes('RQ-T-REGION'), false,
    'region-specific requirement outside the unit\'s served regions is excluded');
  data.addRecord('Requirements', { requirementID: 'RQ-T-INACT', requirementName: 'Inactive (t)',
    scopeID: ['SC02'], productGroupID: [], businessUnitID: [], regionID: [], isActive: 'Inactive' });
  eq(ids(resolve.productScopeRequirementRows(ps01)).includes('RQ-T-INACT'), false,
    'Inactive requirements leave the derived legs');
  // …but a stored DIRECT pick renders regardless (stored data wins; the
  // pickers gate lifecycle, the display stays honest to the link)
  data.addRecord('Product Scopes', { productScopeID: 'PS-T288b', businessUnitID: 'BU01',
    productGroupID: 'PG05', scopeID: 'SC07', requirementID: ['RQ-T-INACT'], isActive: true });
  const tb = data.getById('Product Scopes', 'PS-T288b');
  eq(ids(resolve.productScopeRequirementRows(tb)).includes('RQ-T-INACT'), true,
    'a directly pinned Inactive requirement still lists');
  // the Procedures picker keeps the #231 decision: Inactive never offered
  eq(forms.requirementsForProductScopes(['PS-T288b']).some((o) => o.value === 'RQ-T-INACT'), false,
    'requirementsForProductScopes filters Inactive even when pinned (#231)');
  data.removeRecords('Product Scopes', ['PS-T288b']);
  data.removeRecords('Requirements', ['RQ-T-UNIT', 'RQ-T-REGION', 'RQ-T-INACT']);
}

console.log('== picker re-point: requirementsForProductScopes unions the sets ==');
{
  const offered = forms.requirementsForProductScopes(['PS01']);
  eq(offered.map((o) => o.value).sort(), ['RQ06', 'RQ08', 'RQ09', 'RQ17'],
    'PS01 options = its comprehensive set');
  const labels = offered.map((o) => o.label);
  eq([...labels].sort((a, b) => a.localeCompare(b)), labels, 'options sorted by label');
  // union across product scopes, direct picks included
  data.addRecord('Product Scopes', { productScopeID: 'PS-T288c', businessUnitID: 'BU01',
    productGroupID: 'PG05', scopeID: 'SC07', requirementID: ['RQ01'], isActive: true });
  const union = forms.requirementsForProductScopes(['PS01', 'PS-T288c']).map((o) => o.value);
  eq(union.includes('RQ01') && union.includes('RQ08'), true,
    'multi-scope union carries each row\'s direct picks and legs');
  data.removeRecords('Product Scopes', ['PS-T288c']);
}

console.log('== rendering: derivedValue joins names, dash when empty ==');
{
  const comp = catalog['Product Scopes'].byName['productScopeRequirements'];
  const v = String(resolve.derivedValue('Product Scopes', comp, data.getById('Product Scopes', 'PS01')));
  eq(v.split(', ').length, 4, `PS01 cell joins 4 requirement names (${v.slice(0, 60)}…)`);
  eq(/RQ\d/.test(v), false, 'names, never raw ids');
  const empty = data.getEntity('Product Scopes').find((p) => !resolve.productScopeRequirementRows(p).length);
  eq(empty != null, true, `probe: ${empty && empty.productScopeID} carries no explicit connection`);
  eq(resolve.derivedValue('Product Scopes', comp, empty), '—',
    'no connection renders the dash — an unpinned product scope is legitimate (no gap-tag)');
}

console.log('== demo census: honest seeds ==');
{
  const pss = data.getEntity('Product Scopes');
  eq(pss.every((p) => Array.isArray(p.requirementID)), true,
    'every mockup row carries the stored key (migration parity)');
  eq(pss.every((p) => p.requirementID.length === 0), true,
    'zero direct picks seeded — no registration-time decision is fabricated');
  const withReqs = pss.filter((p) => resolve.productScopeRequirementRows(p).length).length;
  eq(withReqs, 19, `19/${pss.length} product scopes carry explicit connections (5 honest empties)`);
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
