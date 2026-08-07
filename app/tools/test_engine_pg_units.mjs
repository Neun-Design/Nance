#!/usr/bin/env node
// test_engine_pg_units.mjs — proof suite for the 2026-08-03 Product Groups
// round: the LPT/MPT/DT segment enum became a stored businessUnitID FK; the
// segment derives from the unit (mirror); the Product select cascades from
// the chosen unit. Corrections applied over Rafael's sketch: the form binds
// the FK (never the display name — the #121 trap) and the filter dep names
// the bound attribute.
// Run from prototype/:  node tools/test_engine_pg_units.mjs

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

console.log('== schema: unit FK + derived segment ==');
{
  const cat = catalog['Product Groups'];
  const bu = model.parseRule(cat.byName['businessUnitID'].rule);
  eq([bu.kind, model.resolveTable(bu.target)], ['fk', 'Business Units'], 'businessUnitID is a stored FK');
  eq(cat.byName['businessSegment'], undefined, 'segment enum gone');
  eq(cat.byName['businessSegmentName'].type, 'mirror', 'segment is a derived mirror');
  eq(cat.form.fields['Business Unit'].attribute, 'businessUnitID', 'form binds the FK, not the name (#121)');
  eq(cat.form.fields['Product'].check, 'Business Unit IS NOT NULL', 'Product gated on Unit');
  eq(cat.form.fields['Product']['field-rule'], 'filtered by businessUnitID selected', 'cascade dep names the attribute');
  eq(model.getSchemaVersion() >= 11, true, 'schemaVersion at least 11 (PG units round)');
}

console.log('== data: deterministic enum -> unit mapping ==');
{
  const rows = data.getEntity('Product Groups');
  eq(rows.every((r) => !('businessSegment' in r) && r.businessUnitID), true, 'every row migrated');
  eq(data.getById('Product Groups', 'PG01').businessUnitID, 'BU01', 'LPT -> Power Transformers');
  eq(data.getById('Product Groups', 'PG09').businessUnitID, 'BU02', 'DT -> Distribution Transformers');
}

console.log('== derives and cascade ==');
{
  const attr = catalog['Product Groups'].byName['businessSegmentName'];
  const seg = String(resolve.derivedValue('Product Groups', attr, data.getById('Product Groups', 'PG09')));
  eq(/Distribution Transformers/.test(seg), true, `PG09 segment derives via the unit (${seg})`);
  const bu2 = data.getById('Business Units', 'BU02');
  const kids = resolve.childrenOf('Business Units', bu2, 'Products', {});
  eq(kids.length > 0 && kids.every((p) => (Array.isArray(p.businessUnitID)
    ? p.businessUnitID.includes('BU02') : p.businessUnitID === 'BU02')), true,
    `Unit -> Product cascade join resolves (${kids.length} product(s) for BU02)`);
  const opts = forms.optionsForAttr('Product Groups', 'businessUnitID');
  eq(opts.target, 'Business Units', 'Unit select sourced from Business Units');
}

console.log('== specs expand as a subitem (issue #161) ==');
{
  const si = catalog['Product Groups'].subitems[0];
  eq([si.table, si.mapField], ['Product Specs', 'specValues'], 'map directive parsed');
  eq(catalog['Product Groups'].byName['specsSummary']['table-display'], false,
    'SPECS summary column hidden by default');
  const pg = data.getById('Product Groups', 'PG01');
  const kids = resolve.childrenOf('Product Groups', pg, 'Product Specs', { mapField: 'specValues' });
  eq(kids.length, Object.keys(pg.specValues || {}).length, 'one row per spec value');
  eq(kids.every((k) => k.specName && k.__mapValue != null), true,
    `rows carry SPEC NAME + VALUES (${kids.map((k) => k.specName + '=' + k.__mapValue).join(', ')})`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
