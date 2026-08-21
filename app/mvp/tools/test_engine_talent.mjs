#!/usr/bin/env node
// test_engine_talent.mjs — unit-test the 2026-08-01 Talent alignment round:
// Competence.departmentID (stored, derived from the event on save) feeding
// the Onboarding Department -> Competence cascade, the People.departmentID
// rule normalization, and the minor display-rule fixes (Competence.eventID
// eventTitle, Functions spelling, Roles.squadID squadName display).
// Run from prototype/:  node tools/test_engine_talent.mjs

import fs from 'fs';
// Pinned to the FROZEN transformer reference dataset (F3, Vitalis swap):
// this suite asserts engine behavior against known reference rows — the live
// demo dataset is guarded by validate_mockup (narrative block) instead.
globalThis.__MOCKUP_PATH__ = 'tools/testdata/mockup_transformers.json';

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

console.log('== Competence.departmentID: seeded + derived on save ==');
{
  const c = data.getById('Competence', 'CMP01');
  eq(c.departmentID, 'DPT01', 'CMP01 seeded from its event (EV02 -> DPT01)');
  eq(data.getEntity('Competence').every((r) => 'departmentID' in r), true,
    'every mockup competence carries the key (parity)');
  const r = model.parseRule(catalog['Competence'].byName['departmentID'].rule);
  eq([r.kind, r.target], ['fk', 'Departments'], 'stored FK rule');
  // commit-path derivation (applyDerivedUnits): department moved DOWN to
  // Processes in the payload round (issue #159) — the record stores the
  // department of the chosen PROCESS (legacy event fallback kept for old
  // snapshots that still carry it on the event)
  const rec = { processID: 'PR1' };
  forms.applyDerivedUnits('Competence', rec);
  eq(rec.departmentID, 'DPT01', 'save derives departmentID from the process');
  const rec2 = { processID: null, eventID: null };
  forms.applyDerivedUnits('Competence', rec2);
  eq(rec2.departmentID, null, 'no process -> null department');
}

console.log('== Onboarding: Department gates the Competence options ==');
{
  eq(catalog['Onboarding'].form.fields.Competence['field-rule'],
    'SelectLabel = processName; filtered by departmentID + roleID selected',
    'cascade declares department + role');
  // record-filter emulation (bare-attr dep, childKeyFor join): options whose
  // Competence row shares departmentID with the onboarding's department
  const all = forms.optionsForAttr('Onboarding', 'competenceID').options || [];
  const of = (dept) => all.filter((o) => {
    const rec = data.getById('Competence', o.value);
    return rec && String(rec.departmentID) === dept;
  });
  eq(of('DPT01').length, all.length, 'DPT01 keeps every demo competence');
  eq(of('DPT03').length, 0, 'DPT03 offers none (no competences there yet)');
}

console.log('== rule normalizations ==');
{
  const p = model.parseRule(catalog['People'].byName['departmentID'].rule);
  eq([p.kind, p.target], ['fk', 'Departments'], 'People.departmentID is a stored FK rule');
  const ev = model.columnsFor('Competence', 'table').find((c) => c.key === 'eventID');
  eq(ev.fk && ev.fk.display, 'eventTitle', 'Competence event column displays eventTitle');
  eq(model.parseRule(catalog['Competence'].byName['functionID'].rule).target,
    'Functions', 'Competence.functionID targets Functions (plural)');
  const role = data.getEntity('Roles')[0];
  eq(resolve.resolveDisplay('Roles', role, 'squadID'), 'SQ1',
    'Roles.squadID resolves the people\'s squad names');
}

console.log('== Roles: multivalued Job Family (was Graduation, #166), isActive gone (2026-08-03) ==');
{
  const o = forms.optionsForAttr('Roles', 'jobFamilyID');
  eq([o.target, o.multi], ['Job Family', true], 'Job Family select is a registry-sourced multi-picker');
  eq(catalog['Roles'].byName['isActive'], undefined, 'isActive attr removed');
  eq('Active' in catalog['Roles'].form.fields, false, 'Active radio removed');
  const rows = data.getEntity('Roles');
  eq(rows.every((r) => Array.isArray(r.jobFamilyID) && !('isActive' in r)), true,
    'data migrated: list-shaped job families, no isActive');
}

console.log('== Competence certifies a Product Scope (#159 follow-up) ==');
{
  const cat = catalog['Competence'];
  eq(model.parseRule(cat.byName['productScopeID'].rule).kind, 'fk', 'productScopeID is the stored anchor');
  eq([cat.byName['scopeID'].type, cat.byName['productGroupID'].type], ['mirror', 'mirror'],
    'scope and product group derive from the product scope');
  eq('Scope' in cat.form.fields || 'Product Group' in cat.form.fields, false,
    'separate Scope / Product Group selects removed');
  eq(cat.form.fields['Product Scope'].check, 'Process IS NOT NULL', 'Product Scope gated on Process');
  const rows = data.getEntity('Competence');
  eq(rows.every((r2) => r2.productScopeID && !('scopeID' in r2) && !('productGroupID' in r2)), true,
    'data migrated: every competence anchors a product scope, legacy keys dropped');
  eq(data.getById('Product Scopes', 'PS11') != null, true,
    'missing scope x product-group pairs were created as Product Scopes');
  const cmp = data.getById('Competence', 'CMP01');
  eq(forms.competenceProductScope(cmp), { scope: ['A.1'], pg: ['PG02'] },
    'staffing reads scope/pg through the certified product scope');
  eq(forms.competenceProductScope({}), { scope: null, pg: null },
    'no product scope = wildcard (matches everything)');
  eq(String(resolve.derivedValue('Competence', cat.byName['scopeID'], cmp)), 'Temperature Reduction',
    'scope column renders via the product scope');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
