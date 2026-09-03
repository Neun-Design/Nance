#!/usr/bin/env node
// test_engine_crm_activation.mjs — proof suite for issue #191 (Sponsors
// Presentation P4): CRM joins the MVP walkthrough (Customers + SLA active,
// Forecasts pair gated per-tab so it stays catalogued) and Customers slim
// down — customerType relabelled (Internal | External since the sv68
// supplier-flow round; was Internal/External Client | Supplier),
// geography (city/country/regionID + the customerTitle CONCAT) single-
// sourced on Branches. Run from prototype/:  node tools/test_engine_crm_activation.mjs

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

console.log('== Customers slim-down: enum relabel, geography gone ==');
{
  const cat = catalog['Customers'];
  eq(/'Internal'.*'External'/.test(cat.byName['customerType'].rule)
    && !/Client|Supplier/.test(cat.byName['customerType'].rule), true,
    'customerType enum relabelled (issue #191; Internal | External since sv68)');
  for (const gone of ['city', 'country', 'regionID', 'customerTitle']) {
    eq(cat.byName[gone], undefined, `${gone} left Customers (geography lives on Branches)`);
  }
  eq(cat.label, 'customerName', 'label stays customerName');
  const names = cat.attrs.map((a) => a.name);
  eq(names.indexOf('businessSegmentID') < names.indexOf('businessUnitID'), true,
    'segment listed before unit (PR #96 cascade order)');
  for (const goneField of ['City', 'Country', 'Region']) {
    eq(goneField in cat.form.fields, false, `${goneField} form input removed`);
  }
  eq(model.getSchemaVersion() >= 32, true, 'schemaVersion bumped to at least 32');
}

console.log('== displays follow the slim-down ==');
{
  const r = model.parseRule(catalog['Tickets'].byName['customerID'].rule);
  eq(r.display, 'customerName', 'Tickets customer displays customerName (customerTitle is gone)');
  eq(/country/i.test(String(catalog['Tickets'].form.fields.Customer['field-rule'])), false,
    'Tickets Customer rule no longer names the dropped country attr (P5 evolved it to the unit-gated cascade)');
  const fc = data.getEntity('Forecasts')[0];
  const v = String(resolve.derivedValue('Forecasts', catalog['Forecasts'].byName['customerTitle'], fc));
  const cust = data.getById('Customers', fc.customerID);
  eq(v, String(cust.customerName), 'Forecasts.customerTitle mirror resolves customerName');
}

console.log('== seeds: relabelled, geography keys dropped ==');
{
  const allowed = new Set(['Internal', 'External']);
  const rows = data.getEntity('Customers');
  eq(rows.every((c) => allowed.has(c.customerType)), true, 'every customerType uses the new labels');
  eq(rows.flatMap((c) => ['city', 'country', 'regionID', 'customerTitle'].filter((k) => k in c)), [],
    'no row carries a legacy geography key');
  const opt = forms.optionsForAttr('Branches', 'customerID', catalog['Branches'].byName['customerID'].rule);
  eq(opt.options.length > 0, true, `Branches customer filter still yields options (${opt.options.length})`);
  eq(opt.options.every((o) => data.getById('Customers', o.value).customerType === 'Internal'),
    true, 'filter follows the relabelled enum');
}

console.log('== MVP walkthrough gating (app.js) ==');
{
  const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  const modules = app.match(/BLANK_DISABLED_MODULES = new Set\(\[([^\]]*)\]\)/)[1];
  eq(/'CRM'/.test(modules), false, 'CRM no longer in BLANK_DISABLED_MODULES');
  eq(/'Overview'/.test(modules) && /'Control'/.test(modules), true,
    'Overview/Control stay out of the walkthrough (Workspace joined in P5/#192)');
  const tabs = app.match(/BLANK_DISABLED_TABS = (\{[^;]*\});/)[1];
  eq(/CRM/.test(tabs) && /'Forecasts'/.test(tabs) && /'Forecast Scopes'/.test(tabs), true,
    'Forecasts pair gated per-tab in the CRM walkthrough');
  // tab-level gating keeps the pair CATALOGUED (visibility:"disabled" would
  // drop them from the catalog and break Customers.forecastID/Capacity)
  const crm = model.getModules().find((m) => m.name === 'CRM');
  eq(crm.tables, ['Customers', 'SLA', 'Forecasts', 'Forecast Scopes'],
    'CRM strip order 1-4, Forecasts pair still catalogued');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
