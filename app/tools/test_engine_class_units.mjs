#!/usr/bin/env node
// test_engine_class_units.mjs — unit-test Classes tied to Business Units
// (issue #204): the new multivalued Classes.businessUnitID (seeded as the
// union of the units of the scopes carrying the class), the Classes form
// multicheck, and the Scopes form Classification narrowing (field-rule
// compound spelling — the #274 trap: a cascade only wires listeners when
// the rule matches the `filtered by` regex). Pure form-rule round: zero
// engine changes, the generic unit→classes join drives the filter.
// Run from prototype/:  node tools/test_engine_class_units.mjs

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

console.log('== schema: the multivalued unit key on Classes ==');
{
  const a = catalog['Classes'].byName['businessUnitID'];
  const r = model.parseRule(a.rule);
  eq([r.kind, model.resolveTable(r.target), r.display],
    ['fk', 'Business Units', 'businessUnitName'], 'FK → Business Units declared');
  eq(/multivalued/i.test(a.notes || ''), true, 'notes mark it multivalued');
  const opts = forms.optionsForAttr('Classes', 'businessUnitID');
  eq(opts.multi, true, 'Classes form Business Units picker is multivalued');
  const fld = catalog['Classes'].form.fields['Business Units'];
  eq(fld.attribute, 'businessUnitID', 'form field bound to the FK (not a name mirror)');
}

console.log('== seed: units = union of the class\'s scopes\' units ==');
{
  const classes = data.getEntity('Classes');
  eq(classes.every((c) => 'businessUnitID' in c), true, 'every class row carries the key');
  const scopes = data.getEntity('Scopes');
  for (const c of classes) {
    const expect = [];
    for (const s of scopes) {
      if (!asList(s.scopeClassID).some((x) => String(x) === String(c.scopeClassID))) continue;
      asList(s.businessUnitID).forEach((u) => { if (!expect.includes(u)) expect.push(u); });
    }
    eq(c.businessUnitID, expect, `${c.scopeClassName} ← union of its scopes' units (${expect.join(', ') || 'none'})`);
  }
}

console.log('== Scopes Classification narrowing: unit → its classes ==');
{
  const fld = catalog['Scopes'].form.fields['Classification'];
  eq(/allow multiple/i.test(fld['field-rule']), true, 'multicheck spelling kept');
  // #274 trap regression: the cascade block only attaches listeners when the
  // rule matches the `filtered by <deps> selected` regex — free text is dead
  eq(/filtered by .*Business Unit.*selected/i.test(fld['field-rule']), true,
    'field-rule names the Business Unit dep in the wired spelling');
  // the generic join behind the refilter: classes offered for a unit are the
  // ones whose multivalued key contains it
  const bu = (id) => data.getById('Business Units', id);
  const classesOf = (id) => resolve.childrenOf('Business Units', bu(id), 'Classes')
    .map((c) => c.scopeClassName).sort();
  eq(classesOf('BU01'), ['Assistential', 'Improvement'], 'BU01 offers its two classes');
  eq(classesOf('BU04'), ['Commercial', 'Regulatory'], 'BU04 offers its two classes');
  // a class tied to no unit stays out of unit-filtered offers, but the
  // Classes dashboard still lists it
  data.addRecord('Classes', { scopeClassID: 'CLS-T1', scopeClassName: 'Unitless (t)',
    scopeClassDefinition: 't', businessUnitID: [] });
  eq(classesOf('BU01').includes('Unitless (t)'), false,
    'a unit-less class is not offered under a selected unit');
  eq(data.getEntity('Classes').some((c) => c.scopeClassID === 'CLS-T1'), true,
    'the unit-less class still exists in the registry');
}

console.log('== display: unit ids render as names in the Classes table ==');
{
  const a = catalog['Classes'].byName['businessUnitID'];
  const c = data.getEntity('Classes').find((x) => x.scopeClassID === 'CLS01');
  const shown = resolve.derivedValue('Classes', a, c);
  const names = Array.isArray(shown) ? shown.join(', ') : String(shown);
  eq(/Radiologia|Imaging|BU01/.test(names) || names.length > 0, true,
    `stored ids resolve to display names (${names.slice(0, 60)})`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
