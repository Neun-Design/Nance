#!/usr/bin/env node
// test_engine_pg_multiproduct.mjs — proof for the multi-product Product
// Groups round (issue #176): productID is a multivalued stored FK, the
// spec fields offered in the form are the UNION of the selected products'
// spec definitions (specsForProducts), and the array FK flows through the
// applicability joins and the `productName | SPECS` displays.
// Run from prototype/:  node tools/test_engine_pg_multiproduct.mjs

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

console.log('== #176: schema & data — productID multivalued ==');
{
  const at = catalog['Product Groups'].byName['productID'];
  eq(/multivalued/i.test(at.notes || '') && !/not multivalued/i.test(at.notes || ''),
    true, 'productID declared multivalued');
  const opt = forms.optionsForAttr('Product Groups', 'productID');
  eq(opt.multi, true, 'form picker is multi-select');
  eq(data.getEntity('Product Groups').every((g) => Array.isArray(g.productID)),
    true, 'every mockup group stores an array');
  const f = catalog['Product Groups'].form.fields.Product;
  eq([f.check, f['field-rule']], ['Business Unit IS NOT NULL', 'filtered by businessUnitID selected'],
    'Product picker stays gated & filtered by the selected Business Unit');
}

console.log('== #176: spec dispatch is the UNION of the selected products ==');
{
  // synthetic definitions with DISJOINT product sets — the demo specs apply
  // to every product, which cannot tell union from intersection
  data.addRecord('Product Specs', { productSpecID: 'SPECX1', specName: 'Only P01',
    specInputType: 'String', specDescription: '', productID: ['P01'], specOptions: null });
  data.addRecord('Product Specs', { productSpecID: 'SPECX2', specName: 'Only P05',
    specInputType: 'String', specDescription: '', productID: ['P05'], specOptions: null });
  const ids = (l) => forms.specsForProducts(l).map((s) => s.productSpecID);
  eq(ids(['P01']).includes('SPECX1') && !ids(['P01']).includes('SPECX2'), true,
    'single product offers only its own specs');
  const both = ids(['P01', 'P05']);
  eq(both.includes('SPECX1') && both.includes('SPECX2'), true,
    'two products offer the UNION (a spec mandatory for one product is never hidden)');
  eq(ids([]), [], 'no products selected — no spec fields');
  data.removeRecords('Product Specs', ['SPECX1', 'SPECX2']);
}

console.log('== array FK flows through joins & displays ==');
{
  // applicability: an event constrained to one product still admits a scope
  // whose group CONTAINS that product among others
  const pg = data.getEntity('Product Groups').find((g) => g.productID.includes('P01'));
  data.updateRecord('Product Groups', pg.productGroupID, { productID: ['P01', 'P05'] });
  const ps = data.getEntity('Product Scopes').find((s) => s.productGroupID === pg.productGroupID);
  if (ps) {
    const ev = data.getEntity('Events').find((e) => e.eventID);
    data.updateRecord('Events', ev.eventID, { productID: ['P05'], scopeID: [] });
    const admitted = forms.productScopesForEvent(ev.eventID).map((o) => o.value);
    eq(admitted.includes(ps.productScopeID), true,
      'event product P05 admits the scope of the [P01, P05] group');
  } else ok('(no product scope references the group — join check skipped)');
  // productGroupName derives from the product array (the stored mockup copy
  // was dropped — a stored single-product name goes stale with 2+ products,
  // and the legacy "CONCAT(productName from productID)" spelling never parsed)
  const nameAttr = catalog['Product Groups'].byName['productGroupName'];
  eq(nameAttr.type, 'mirror', 'productGroupName typed as derived display');
  eq('productGroupName' in data.getById('Product Groups', pg.productGroupID), false,
    'stored name copy dropped from the mockup');
  eq(resolve.derivedValue('Product Groups', nameAttr,
    data.getById('Product Groups', pg.productGroupID)), 'LPT, Reactors',
    'group name derives from BOTH products');
  // display: the FK CONCAT joins every product name before the SPECS block
  const reqAttr = catalog['Requirements'].byName['productGroupID'];
  const r = model.parseRule(reqAttr.rule);
  const label = resolve.fkDisplay({ table: r.target, display: r.display, concat: r.concat },
    pg.productGroupID);
  eq(label, 'LPT, Reactors | Voltage Rate: <=145, Power Rating: <=100',
    'Requirements picker label carries every product name');
  data.updateRecord('Product Groups', pg.productGroupID, { productID: ['P01'] });
}

console.log(fails ? `\nFAILED — ${fails} assertion(s)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
