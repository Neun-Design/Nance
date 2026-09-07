#!/usr/bin/env node
// test_engine_process_prerbac_filters.mjs — unit-test the pre-RBAC filter
// inputs on the Processes form (issue #348, reverting the #346 recorded
// exclusion): businessUnitID converts mirror→stored FK (materialize-FK
// convention — the mirror derived the EVENT's unit) and gates the
// Department select; the Event anchor stays unfiltered (the #344 posture —
// 2/6 demo processes chain events of another unit). Latent fix riding
// along: the Owner select filtered people by the EVENT's unit, dropping
// the stored owner on the two divergent processes — re-pointed to the
// chosen Business Unit (census 6/6 owners sit in the department's unit).
// Run from prototype/:  node tools/test_engine_process_prerbac_filters.mjs

import fs from 'fs';
globalThis.fetch = async (p) => new Response(fs.readFileSync(p));

const model = await import('../js/model.js');
const data = await import('../js/data.js');
const { catalog } = await model.loadModel();
data.initMeta(catalog);
await data.loadData();

let fails = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails += 1; console.log(`  ✗ ${m}`); };
const eq = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));
const asList = (v) => (Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]));
const S = (v) => String(v);

const dm = JSON.parse(fs.readFileSync('data/datamodel.json', 'utf-8'));

console.log('== schema: mirror → stored FK (sv88) ==');
{
  eq(dm._meta.schemaVersion >= 88, true, `schemaVersion ${dm._meta.schemaVersion} >= 88`);
  const a = catalog['Processes'].byName['businessUnitID'];
  eq(a?.type, 'FK', 'businessUnitID is a stored FK now (was mirror)');
  eq(model.parseRule(a?.rule).kind, 'fk', 'FK → Business Units rule');
  eq(/#348/.test(a?.notes || ''), true, 'the note records the round and the seed rule');
}

console.log('== form: BU → Department lead; Event anchor unfiltered ==');
{
  const f = catalog['Processes'].form.fields;
  const order = Object.keys(f);
  eq(order.indexOf('Business Unit') < order.indexOf('Department')
    && order.indexOf('Department') < order.indexOf('Event'), true,
  'field order: Business Unit → Department → Event');
  eq(f['Business Unit'].attribute, 'businessUnitID', 'BU field bound to the stored FK');
  eq(f['Department'].check, 'Business Unit IS NOT NULL', 'Department gated on the unit (was Event)');
  eq(/filtered by .*Business Unit.*selected/i.test(f['Department']['field-rule']), true,
    'Department filtered in the wired spelling (#274)');
  eq([f['Event'].check, f['Event']['field-rule']], [null, null],
    'Event stays ungated and unfiltered (the divergence posture)');
  eq(f['Product Scopes'].check, 'Event IS NOT NULL', 'Product Scopes gate untouched (#159)');
  eq(/filtered by .*Business Unit.*selected/i.test(f['Owner']['field-rule']), true,
    'Owner re-pointed to the chosen unit (the event-unit path dropped stored owners)');
  eq(/eventID\.businessUnitID/.test(JSON.stringify(f)), false,
    'the dotted event-unit spelling left the form');
  eq(/filtered by departmentID selected/i.test(f['Squad']['field-rule']), true,
    'Squad filter untouched');
}

console.log('== seeds: unit = the department\'s; divergence census ==');
{
  const prs = data.getEntity('Processes');
  eq(prs.every((p) => 'businessUnitID' in p), true, 'every row carries the key (parity)');
  let chain = 0; let diverge = 0; let ownerOk = 0; let owners = 0;
  for (const p of prs) {
    const d = data.getById('Departments', p.departmentID);
    if (d && S(asList(d.businessUnitID)[0]) === S(p.businessUnitID)) chain += 1;
    const ev = data.getById('Events', p.eventID);
    if (ev && S(asList(ev.businessUnitID)[0]) !== S(p.businessUnitID)) diverge += 1;
    const owner = p.processOwner && data.getById('People', p.processOwner);
    if (owner) {
      owners += 1;
      if (asList(owner.businessUnitID).map(S).includes(S(p.businessUnitID))) ownerOk += 1;
    }
  }
  eq(chain, prs.length, `unit = the department's unit: ${prs.length}/${prs.length}`);
  eq(diverge > 0, true,
    `${diverge} processes chain events of another unit (why Event stays unfiltered)`);
  eq(ownerOk, owners, `all ${owners} stored owners survive the re-pointed Owner filter`);
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
