#!/usr/bin/env node
// test_engine_talent.mjs — unit-test the 2026-08-01 Talent alignment round:
// Competence.departmentID (stored, derived from the event on save) feeding
// the Onboarding Department -> Competence cascade, the People.departmentID
// rule normalization, and the minor display-rule fixes (Competence.eventID
// eventTitle, Functions spelling, Roles.squadID squadName display).
// Run from prototype/:  node tools/test_engine_talent.mjs

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

console.log('== Competence.departmentID: seeded + derived on save ==');
{
  const c = data.getById('Competence', 'CMP01');
  eq(c.departmentID, 'DPT01', 'CMP01 seeded from its event (EV02 -> DPT01)');
  eq(data.getEntity('Competence').every((r) => 'departmentID' in r), true,
    'every mockup competence carries the key (parity)');
  const r = model.parseRule(catalog['Competence'].byName['departmentID'].rule);
  eq([r.kind, r.target], ['fk', 'Departments'], 'stored FK rule');
  // commit-path derivation (applyDerivedUnits): the record stores the
  // department of the chosen event — form-created rows join like seeded ones
  const rec = { eventID: 'EV02' };
  forms.applyDerivedUnits('Competence', rec);
  eq(rec.departmentID, 'DPT01', 'save derives departmentID from the event');
  const rec2 = { eventID: null };
  forms.applyDerivedUnits('Competence', rec2);
  eq(rec2.departmentID, null, 'no event -> null department');
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

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
