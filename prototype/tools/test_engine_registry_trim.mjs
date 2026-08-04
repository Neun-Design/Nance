#!/usr/bin/env node
// test_engine_registry_trim.mjs — proof suite for the 2026-08-03 dashboard
// trim round: Issues and Actions become hidden registries (catalogued, no
// tab — created inline from the Scopes / Tasks forms), Issues classifies by
// Business Unit again (segment = select group header), Regions moves to
// tab 2. The A4 lesson applies: visibility stays "show" so every FK display
// and select across the model keeps resolving.
// Run from prototype/:  node tools/test_engine_registry_trim.mjs

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

console.log('== hidden registries: catalogued, no tab ==');
{
  eq(!!catalog['Issues'] && !!catalog['Actions'], true, 'Issues and Actions stay catalogued');
  const org = model.getModules().find((m) => m.name === 'Organization');
  const op = model.getModules().find((m) => m.name === 'Operation');
  eq(org.tables.includes('Issues'), false, 'Issues out of the Organization tab strip');
  eq(op.tables.includes('Actions'), false, 'Actions out of the Operation tab strip');
  eq(org.tables[1], 'Regions', 'Regions is Organization tab 2');
  eq(model.getSchemaVersion(), 7, 'schemaVersion bumped to 7');
}

console.log('== FK selects still resolve into the registries ==');
{
  const opp = forms.optionsForAttr('Scopes', 'scopeOpportunity');
  eq(opp.target, 'Issues', 'Scopes Opportunity select targets Issues');
  eq((opp.options || []).length, data.getEntity('Issues').length, 'every issue offered');
  const act = forms.optionsForAttr('Competence', 'actionID');
  eq(act.target, 'Actions', 'Competence Action select targets Actions');
  eq((act.options || []).length > 0, true, 'action options offered');
  const taskAct = forms.optionsForAttr('Tasks', 'actionID');
  eq((taskAct.options || []).length > 0, true, 'Tasks form Action select keeps its options');
}

console.log('== Issues: unit classification (2026-08-03 reversal) ==');
{
  const bu = catalog['Issues'].attrs.filter((a) => a.name === 'businessUnitID');
  eq(bu.length, 1, 'single businessUnitID attribute');
  eq(model.parseRule(bu[0].rule).target, 'Business Units', 'stored FK to Business Units');
  eq(catalog['Issues'].byName['businessSegmentName'], undefined, 'orphaned segment mirror dropped');
  eq(catalog['Issues'].form.fields.Unit['field-rule'], 'SelectLabel = businessSegmentName',
    'segment surfaces as the select group header');
  eq(data.getEntity('Issues').every((r) => !('businessSegmentID' in r) && !Array.isArray(r.businessUnitID)),
    true, 'data migrated: no segment key, scalar unit');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
