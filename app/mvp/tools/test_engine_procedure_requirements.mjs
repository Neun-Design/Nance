#!/usr/bin/env node
// test_engine_procedure_requirements.mjs — proof suite for issue #304
// (schema v67): the Procedures form Requirements picker offers the
// UNIT-WIDE universe — every Active requirement whose unit key is empty
// (Q1 — applies to all) or names the selected Unit, AND whose region key is
// empty or names one of the unit's SERVED regions (Business Units.regionID,
// the #230 posture). Unit/region stay EXCLUSION gates (#296): a requirement
// pinned to another unit never leaks in through a shared region. The #159
// product-scope/task narrowing is replaced; requirementsForProductScopes and
// requirementsForTask are retired. Grouping (SelectLabel =
// requirementTypeName) and the multivalue spelling are KEPT (issue text).
// Run from prototype/:  node tools/test_engine_procedure_requirements.mjs

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

console.log('== form spec: Unit cascade, grouping kept (v67) ==');
{
  eq(model.getSchemaVersion() >= 67, true, 'schemaVersion bumped to at least 67');
  const f = catalog['Procedures'].form.fields['Requirements'];
  eq(f.attribute, 'requirementID', 'field bound to the stored multivalued FK');
  eq(f.check, 'Task IS NOT NULL', 'gate unchanged — the issue only re-points the filter');
  const rule = Array.isArray(f['field-rule']) ? f['field-rule'] : [String(f['field-rule'])];
  eq(rule.includes('Allow multiple values'), true, 'multivalue spelling kept');
  eq(rule.includes('SelectLabel = requirementTypeName'), true, 'grouping rule KEPT (issue text)');
  eq(rule.includes('filtered by productScopeID selected'), false, '#159 product-scope dep gone');
  // the #274 trap: the cascade only wires when a part matches the regex AND
  // the captured dep resolves to a form field
  const part = rule.find((p) => /filtered by (?:the )?([A-Za-z .+&,]+?)(?: selected| field|$)/i.test(p));
  const dep = part && part.match(/filtered by (?:the )?([A-Za-z .+&,]+?)(?: selected| field|$)/i)[1];
  eq(dep, 'Unit', 'cascade names the Unit field (dead-cascade regression)');
  eq('Unit' in catalog['Procedures'].form.fields, true, 'the named dep is a real field label');
}

console.log('== requirementsForUnit: unit + served-region gates (synthetic) ==');
{
  // BU01 serves RG01 only (clinic census) — the probe pins every leg
  const bu01 = data.getById('Business Units', 'BU01');
  eq(JSON.stringify(bu01.regionID), JSON.stringify(['RG01']), 'probe precondition: BU01 serves RG01 only');
  const req = (id, extra) => data.addRecord('Requirements', {
    requirementID: id, requirementName: `${id} (t)`, scopeID: [], productGroupID: [],
    businessUnitID: [], regionID: [], isActive: 'Active', ...extra });
  req('RQ-X-SAME', { businessUnitID: ['BU01'] });
  req('RQ-X-OTHER', { businessUnitID: ['BU02'] });
  req('RQ-X-REG', { regionID: ['RG01'] });
  req('RQ-X-REGOUT', { regionID: ['RG03'] });
  req('RQ-X-BOTH', { businessUnitID: ['BU02'], regionID: ['RG01'] });
  req('RQ-X-INACT', { businessUnitID: ['BU01'], isActive: 'Inactive' });
  const offered = forms.requirementsForUnit('BU01').map((o) => o.value);
  eq(offered.includes('RQ-X-SAME'), true, 'unit-keyed requirement offered for its unit');
  eq(offered.includes('RQ-X-OTHER'), false, "another unit's requirement stays out");
  eq(offered.includes('RQ-X-REG'), true, 'region-pinned requirement offered when the unit SERVES it');
  eq(offered.includes('RQ-X-REGOUT'), false, 'region the unit does not serve stays out');
  eq(offered.includes('RQ-X-BOTH'), false,
    'a shared region never overrides a foreign unit key (exclusion gates, #296)');
  eq(offered.includes('RQ-X-INACT'), false, 'Inactive requirements are never offered (#231)');
  // Q1: blank-key requirements stay in every unit's universe
  eq(offered.includes('RQ01') || offered.length > 6, true, 'Q1 wildcards stay offered');
  const all = forms.requirementsForUnit(null).map((o) => o.value);
  eq([all.includes('RQ-X-OTHER'), all.includes('RQ-X-REGOUT'), all.includes('RQ-X-INACT')],
    [true, true, false], 'no unit → every Active requirement (lenient cascade posture)');
  data.removeRecords('Requirements',
    ['RQ-X-SAME', 'RQ-X-OTHER', 'RQ-X-REG', 'RQ-X-REGOUT', 'RQ-X-BOTH', 'RQ-X-INACT']);
}

console.log('== demo census: the region leg bites on the clinic data ==');
{
  // 18 Active requirements, all with blank unit keys; 6 pinned to regions —
  // the Argentina-only ones (RG03: ANMAT, PDPA, Interpreter) leave the
  // pickers of units that do not serve RG03
  const bu01 = forms.requirementsForUnit('BU01').map((o) => o.value); // serves RG01
  const bu02 = forms.requirementsForUnit('BU02').map((o) => o.value); // serves RG02+RG03
  eq(bu01.length, 15, 'BU01 offer: 18 − the 3 RG03-only requirements');
  eq([bu01.includes('RQ02'), bu01.includes('RQ05'), bu01.includes('RQ18')],
    [false, false, false], 'ANMAT / PDPA / Interpreter leave the BU01 picker');
  eq([bu01.includes('RQ01'), bu01.includes('RQ03'), bu01.includes('RQ04')],
    [true, true, true], 'RG01∪RG02-pinned requirements stay (BU01 serves RG01)');
  eq(bu02.length, 18, 'BU02 (serves RG02+RG03) keeps the full universe');
  eq(forms.requirementsForUnit(null).length, 18, 'lenient: every Active requirement');
  // grouping stays resolvable: every offered record reaches its type name
  const named = bu01.every((id) => {
    const rec = data.getById('Requirements', id);
    return rec && String(resolve.resolveDisplay('Requirements', rec, 'requirementTypeName') || '') !== '';
  });
  eq(named, true, 'every option resolves requirementTypeName (SelectLabel grouping)');
}

console.log('== retirements: the #159 helpers left with #304 ==');
{
  eq(forms.requirementsForProductScopes, undefined, 'requirementsForProductScopes retired');
  eq(forms.requirementsForTask, undefined, 'requirementsForTask retired');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
