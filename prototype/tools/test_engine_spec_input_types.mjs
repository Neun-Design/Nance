#!/usr/bin/env node
// test_engine_spec_input_types.mjs — proof for the Product Specs input type
// relabel (issue #205): specInputType enum becomes Number/Text/Choice/List/
// Checkbox (Choice = old single-pick List; List = NEW multiple choice stored
// semicolon-separated; Checkbox = boolean shown Yes/No), the Allowed Values
// gate accepts "Input Type = Choice|List" alternatives, and legacy spellings
// from pre-v34 snapshots still resolve to a control kind.
// Run from prototype/:  node tools/test_engine_spec_input_types.mjs

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

console.log('== #205: schema — the five input types ==');
{
  const at = catalog['Product Specs'].byName['specInputType'];
  const r = model.parseRule(at.rule);
  eq(r && r.kind, 'enum', 'specInputType parses as enum');
  eq(r.values, ['Number', 'Text', 'Choice', 'List', 'Checkbox'],
    'enum offers Number/Text/Choice/List/Checkbox');
  const opt = forms.optionsForAttr('Product Specs', 'specInputType');
  eq(opt.options.map((o) => o.value), ['Number', 'Text', 'Choice', 'List', 'Checkbox'],
    'form select offers the five types');
  const f = catalog['Product Specs'].form.fields['Allowed Values'];
  eq(f.check, 'Input Type = Choice|List',
    'Allowed Values unlocks for Choice OR List (eq-check alternatives)');
}

console.log('== #205: data — mockup rows migrated off the legacy spellings ==');
{
  const NEW = new Set(['Number', 'Text', 'Choice', 'List', 'Checkbox']);
  const rows = data.getEntity('Product Specs');
  eq(rows.length > 0 && rows.every((s) => NEW.has(s.specInputType)), true,
    'every Product Specs row carries a new-world specInputType');
}

console.log('== #205: control kind — new types and legacy spellings ==');
{
  const kinds = (l) => l.map(forms.specInputKind);
  eq(kinds(['Number', 'Text', 'Choice', 'List', 'Checkbox']),
    ['number', 'text', 'choice', 'multi', 'checkbox'],
    'new spellings map to their controls');
  eq(kinds(['INT', 'DECIMAL', 'String', 'string', 'int']),
    ['number', 'number', 'text', 'text', 'number'],
    'legacy INT/DECIMAL/String still resolve (pre-v34 snapshots)');
  eq(forms.specInputKind(null), 'text', 'missing type falls back to text');
}

console.log('== #205: display — multi strings pass through, booleans show Yes/No ==');
{
  data.addRecord('Product Specs', { productSpecID: 'SPECX3', specName: 'Cooling',
    specInputType: 'List', specDescription: '', productID: ['P01'],
    specOptions: 'ONAN; ONAF; OFAF' });
  data.addRecord('Product Specs', { productSpecID: 'SPECX4', specName: 'Explosion Proof',
    specInputType: 'Checkbox', specDescription: '', productID: ['P01'], specOptions: null });
  const pg = data.getEntity('Product Groups')[0];
  const prevValues = pg.specValues;
  data.updateRecord('Product Groups', pg.productGroupID,
    { specValues: { SPECX3: 'ONAN; ONAF', SPECX4: false } });
  const at = catalog['Product Groups'].byName['specsSummary'];
  eq(resolve.derivedValue('Product Groups', at, data.getById('Product Groups', pg.productGroupID)),
    'Cooling: ONAN; ONAF, Explosion Proof: No',
    'SPECS summary renders the semicolon list as-is and the boolean as No');
  const kids = resolve.childrenOf('Product Groups',
    data.getById('Product Groups', pg.productGroupID), 'Product Specs',
    { mapField: 'specValues' });
  eq(kids.map((k) => k.__mapValue), ['ONAN; ONAF', 'No'],
    '__mapValue column carries the formatted values (false → No)');
  data.updateRecord('Product Groups', pg.productGroupID,
    { specValues: { SPECX3: 'ONAN; ONAF', SPECX4: true } });
  eq(resolve.derivedValue('Product Groups', at, data.getById('Product Groups', pg.productGroupID)),
    'Cooling: ONAN; ONAF, Explosion Proof: Yes', 'true renders Yes');
  data.updateRecord('Product Groups', pg.productGroupID, { specValues: prevValues });
  data.removeRecords('Product Specs', ['SPECX3', 'SPECX4']);
}

console.log(fails ? `\nFAILED — ${fails} assertion(s)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
