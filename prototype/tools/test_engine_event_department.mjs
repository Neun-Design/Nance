#!/usr/bin/env node
// test_engine_event_department.mjs — proof suite for issue #352 (re-scoped,
// sv92): the department flag lands on EVENTS — an event is the request a
// DEPARTMENT must fulfill for its clients (Event × Product Scope = the
// Payload); on the Payload form the chosen Department filters the Event
// options, and Departments expose the reverse Events subitem tab.
//
// Seeds (census-first, the (a) in-unit rule transplanted): the event's
// department = first IN-UNIT department among its chaining processes (the
// 2 cross-unit signals EV06/EV11 fall to the fallback — #344 divergence
// family), else the unit's first department — clinic 20/20 keyed. New
// INVARIANT payload.departmentID ≡ event.departmentID (3 re-keys + the 4
// formerly-null admin payloads keyed) keeps the department-filtered Event
// picker offering every stored pick; SLA.departmentID re-keys to the new
// majority of its payloads (6 rows, sv68 rule).
// Run from prototype/:  node tools/test_engine_event_department.mjs

import fs from 'fs';
globalThis.fetch = async (p) => new Response(fs.readFileSync(p));

const model = await import('../js/model.js');
const data = await import('../js/data.js');
const { catalog } = await model.loadModel();
data.initMeta(catalog);
await data.loadData();
const resolve = await import('../js/resolve.js');

let fails = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails += 1; console.log(`  ✗ ${m}`); };
const eq = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));
const asList = (v) => (Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]));

console.log('== schema: the event owns its answering department ==');
{
  eq(model.getSchemaVersion() >= 92, true, `schemaVersion ${model.getSchemaVersion()} >= 92`);
  const a = catalog['Events'].byName['departmentID'];
  const r = model.parseRule(a.rule);
  eq([r.kind, r.target, r.display], ['fk', 'Departments', 'departmentName'],
    'Events.departmentID is a stored FK → Departments (display departmentName)');
  eq(/single/i.test(String(a.notes)), true, 'single-valued (one answering department per request)');
  eq(/multivalued/i.test(String(a.notes)), false, 'not multivalued');
  eq(String(catalog['Events'].byName['departmentID'].constraints || ''), 'FK',
    'nullable (legacy developer copy carries honest nulls)');
}

console.log('== form specs: gates + wired spellings (#274 trap) ==');
{
  const ef = catalog['Events'].form.fields;
  const keys = Object.keys(ef);
  eq(ef.Department.attribute, 'departmentID', 'Events form Department binds the FK');
  eq(ef.Department.check, 'Business Unit IS NOT NULL', 'Department gated on the Unit');
  eq(/filtered by Business Unit selected/i.test(String(ef.Department['field-rule'])), true,
    'Department cascade names Business Unit (generic stored-key path)');
  eq(keys.indexOf('Department') - keys.indexOf('Business Unit'), 1,
    'Department sits right after Business Unit');
  const pf = catalog['Payload'].form.fields;
  eq(/filtered by Business Unit \+ Department selected/i.test(String(pf.Event['field-rule'])), true,
    'Payload Event cascade names Business Unit + Department (generic multi-dep AND, #344 precedent)');
  const pKeys = Object.keys(pf);
  eq(pKeys.indexOf('Department') < pKeys.indexOf('Event'), true,
    'Payload form picks the Department BEFORE the Event (the issue flow)');
  eq(catalog['Departments'].subitems.some((s) => s.table === 'Events'), true,
    'Departments expose the reverse Events subitem tab');
}

console.log('== seeds: 20/20 keyed, in-unit invariant, honest fallbacks ==');
{
  const events = data.getEntity('Events');
  eq(events.length, 20, 'clinic census (20 events)');
  eq(events.every((e) => e.departmentID != null && e.departmentID !== ''), true,
    'every event carries its answering department');
  const deptUnit = new Map(data.getEntity('Departments')
    .map((d) => [String(d.departmentID), String(d.businessUnitID)]));
  eq(events.every((e) => deptUnit.get(String(e.departmentID)) === String(e.businessUnitID)), true,
    'in-unit invariant: the department belongs to the event\'s unit (form-integrity by construction)');
  // the 2 cross-unit signals fell to the fallback (#344 divergence family):
  // EV06 signal DPT02/BU01 with the event on BU02; EV11 DPT05/BU04 on BU03
  eq([data.getById('Events', 'EV06').departmentID, data.getById('Events', 'EV11').departmentID],
    ['DPT03', 'DPT04'], 'cross-unit signals honestly fall to the unit fallback (EV06/EV11)');
  eq([data.getById('Events', 'EV01').departmentID, data.getById('Events', 'EV05').departmentID],
    ['DPT01', 'DPT06'], 'in-unit signals keep their chaining process\'s department (EV01/EV05)');
}

console.log('== invariant: payload.departmentID ≡ event.departmentID ==');
{
  const evDept = new Map(data.getEntity('Events')
    .map((e) => [String(e.eventID), e.departmentID ?? null]));
  const payloads = data.getEntity('Payload');
  eq(payloads.length, 26, 'clinic census (26 payloads)');
  const drift = payloads.filter((p) => (p.departmentID ?? null) !== evDept.get(String(p.eventID)));
  eq(drift.map((p) => p.payloadID), [], 'every payload mirrors its event\'s department (26/26)');
  eq(payloads.every((p) => p.departmentID != null && p.departmentID !== ''), true,
    'the 4 formerly-null admin payloads gained their key');
  // form-integrity: with Event filtered by (unit, department), every stored
  // (departmentID, eventID) pair keeps its event on the table
  const orphans = payloads.filter((p) => {
    const ev = data.getById('Events', p.eventID);
    return !ev || String(ev.businessUnitID) !== String(p.businessUnitID)
      ? false // unit mismatch is the pre-existing lenient dimension, not this round's
      : (p.departmentID != null && String(ev.departmentID) !== String(p.departmentID));
  });
  eq(orphans.map((p) => p.payloadID), [],
    'department-filtered Event picker keeps every stored pick (0 orphans)');
}

console.log('== SLA: supplying department = the new majority of its payloads ==');
{
  const plDept = new Map(data.getEntity('Payload')
    .map((p) => [String(p.payloadID), p.departmentID ?? null]));
  const bad = data.getEntity('SLA').filter((s) => {
    const counts = new Map(); const order = [];
    for (const pid of asList(s.payloadID)) {
      const d = plDept.get(String(pid));
      if (!d) continue;
      if (!counts.has(d)) order.push(d);
      counts.set(d, (counts.get(d) || 0) + 1);
    }
    if (!order.length) return false; // no signal — the stored key was kept
    const majority = order.reduce((a, b) => (counts.get(b) > counts.get(a) ? b : a));
    return String(s.departmentID) !== String(majority);
  });
  eq(bad.map((s) => s.slaID), [], 'every SLA carries the majority department (sv68 rule, re-keyed)');
}

console.log('== Departments → Events reverse tab resolves ==');
{
  const dpt01 = data.getById('Departments', 'DPT01');
  const kids = resolve.childrenOf('Departments', dpt01, 'Events')
    .map((e) => e.eventID).sort();
  eq(kids.length > 0 && kids.every((id) => data.getById('Events', id).departmentID === 'DPT01'),
    true, `DPT01 lists exactly its answered requests (${kids.join(', ')})`);
}

console.log('== zero-flip guards: contract/ticket chains untouched ==');
{
  // no rule reads the event's department — the ticket/forecast chains match
  // on customers/suppliers/payload packaging only
  const tickets = data.getEntity('Tickets');
  eq(tickets.every((t) => Array.isArray(t.payloadID) && t.payloadID.length > 0), true,
    'every ticket still resolves its payload set (#350 chain untouched)');
  const withInputs = tickets.filter((t) => resolve.ticketInputHandouts(t).length > 0);
  eq(withInputs.length, 137, 'TICKET-INPUTS census unchanged (137/160)');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
