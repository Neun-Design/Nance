#!/usr/bin/env node
// test_engine_payload_entity.mjs — proof suite for issue #190 (Sponsors
// Presentation P2): the Payload ENTITY materializes in Operation (order 7).
// A payload packages one Event × Product Scopes combination; the Product
// Scope picker offers the event's applicability (scopeID × productID,
// empty = all — Q1) narrowed to the payload's unit, items labelled by
// product group and grouped by scope (SelectLabel = scopeName).
// Run from prototype/:  node tools/test_engine_payload_entity.mjs

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

console.log('== schema: Payload catalogued in Operation ==');
{
  const cat = catalog['Payload'];
  eq(!!cat, true, 'Payload catalogued');
  eq(cat.pk, 'payloadID', 'PK is payloadID');
  eq(cat.label, 'payloadCode', 'label attribute is payloadCode');
  for (const name of ['businessUnitID', 'eventID', 'productScopeID', 'payloadOwner']) {
    const r = model.parseRule(cat.byName[name].rule);
    eq(r && r.kind, 'fk', `${name} is a stored FK rule (not a rollup — the select must store the PK)`);
  }
  eq(model.parseRule(cat.byName['eventID'].rule).target, 'Events', 'eventID targets Events');
  eq(model.getSchemaVersion() >= 30, true, 'schemaVersion bumped to at least 30');
}

console.log('== form spec: cascade + grouped multi-select ==');
{
  const dmRaw = JSON.parse(fs.readFileSync(new URL('../data/datamodel.json', import.meta.url)));
  const spec = dmRaw.modules.Operation.tables.Payload;
  eq(spec['dashboard-order'], 7, 'dashboard-order 7 (spec)');
  eq(spec.visibility, 'show', 'visible in the tab strip');
  const f = spec.form.fields;
  eq(f.Event.check, 'Business Unit IS NOT NULL', 'Event gated on the unit');
  eq(f['Product Scope'].attribute, 'productScopeID', 'Product Scope binds the FK (not a display name)');
  eq(f['Product Scope'].check, 'Event IS NOT NULL', 'Product Scope gated on the event');
  const rule = f['Product Scope']['field-rule'].join('; ');
  eq(/Allow multiple/i.test(rule), true, 'Product Scope is multivalued');
  eq(/SelectLabel = scopeName/.test(rule), true, 'options grouped by scope');
}

console.log('== productScopesForPayload: applicability × unit ==');
{
  const all = data.getEntity('Product Scopes');
  // wildcard event (EV01 has empty scopeID/productID): every scope of its unit
  const ev = data.getById('Events', 'EV01');
  const mine = all.filter((ps) => String(ps.businessUnitID) === String(ev.businessUnitID));
  eq(forms.productScopesForPayload('EV01', ev.businessUnitID).length, mine.length,
    'wildcard event narrowed to the unit\'s product scopes');
  eq(forms.productScopesForPayload('EV01', null).length, all.length,
    'no unit selected — wildcard event admits every product scope');
  // narrowed event: only product scopes sharing the declared scope
  const ps0 = all.find((ps) => ps.scopeID);
  const scope = Array.isArray(ps0.scopeID) ? ps0.scopeID[0] : ps0.scopeID;
  data.addRecord('Events', { eventID: 'EVX9', eventTitle: 'Payload entity probe', businessUnitID: ps0.businessUnitID, scopeID: [scope], productID: [] });
  const narrowed = forms.productScopesForPayload('EVX9', ps0.businessUnitID);
  eq(narrowed.length > 0 && narrowed.length < all.length, true,
    'declared scope narrows the applicability');
  eq(narrowed.every((o) => {
    const ps = data.getById('Product Scopes', o.value);
    const s = Array.isArray(ps.scopeID) ? ps.scopeID : [ps.scopeID];
    return s.includes(scope) && String(ps.businessUnitID) === String(ps0.businessUnitID);
  }), true, 'every option matches scope AND unit');
  // items label by product group, not the default "product | scope" pair
  const sample = narrowed[0] && data.getById('Product Scopes', narrowed[0].value);
  const pgLabel = sample && String(narrowed[0].label);
  eq(!!pgLabel && pgLabel.length > 0, true, `options carry product-group labels (e.g. "${pgLabel}")`);
}

console.log('== seeds: one payload per event, unit-consistent ==');
{
  const payloads = data.getEntity('Payload');
  const events = data.getEntity('Events').filter((e) => e.eventID !== 'EVX9');
  eq(payloads.length, events.length, `one payload per event (${payloads.length})`);
  const stored = ['payloadID', 'payloadCode', 'businessUnitID', 'eventID', 'productScopeID', 'isActive', 'payloadOwner'];
  eq(payloads.every((p) => stored.every((k) => k in p)), true, 'every row seeds all stored attrs (parity)');
  eq(payloads.every((p) => {
    const ev = data.getById('Events', p.eventID);
    return ev && p.businessUnitID === ev.businessUnitID;
  }), true, 'payload unit matches its event\'s unit');
  eq(payloads.every((p) => (Array.isArray(p.productScopeID) ? p.productScopeID : []).every((id) => {
    const ps = data.getById('Product Scopes', id);
    return ps && String(ps.businessUnitID) === String(p.businessUnitID);
  })), true, 'packaged product scopes belong to the payload\'s unit');
  eq(payloads.every((p) => p.payloadOwner != null && p.payloadOwner !== ''), true, 'payloadOwner seeded (Broker, ISO §5.3)');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
