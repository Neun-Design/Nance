#!/usr/bin/env node
// test_engine_snapshot.mjs — unit-test the offline-database snapshot round
// trip (offline_database.md): exportSnapshot shape/_meta, importSnapshot
// replace semantics, schema-drift skipping, Countries exclusion, and
// malformed-file rejection. Run from prototype/:
//   node tools/test_engine_snapshot.mjs

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

console.log('== schema version (v3-review D9) ==');
{
  eq(typeof model.getSchemaVersion(), 'number', 'datamodel _meta.schemaVersion exposed');
  data.setSchemaVersion(model.getSchemaVersion());
}

console.log('== exportSnapshot ==');
const snap = data.exportSnapshot();
{
  eq(snap._meta.schemaVersion, model.getSchemaVersion(), 'snapshot stamps the schema version');
  eq(snap._meta.kind, 'blank-snapshot', '_meta stamps the snapshot kind');
  eq(typeof snap._meta.exportedAt, 'string', '_meta carries the export time');
  eq('Countries' in snap.Blank, false, 'system registry stays out of the file');
  eq(snap.Blank.Branches.length, data.getEntity('Branches').length,
    'user tables travel with all rows');
  eq(snap._meta.records > 0, true, 'record count stamped');
}

console.log('== importSnapshot: replace semantics ==');
{
  const branchesBefore = data.getEntity('Branches').length;
  const countriesBefore = data.getEntity('Countries').length;
  data.addRecord('Branches', { branchID: 'BR99', branchName: 'Temp', businessUnitID: 'BU01' });
  eq(data.getEntity('Branches').length, branchesBefore + 1, 'record added pre-import');
  const res = data.importSnapshot(snap);
  eq(data.getEntity('Branches').length, branchesBefore, 'import replaces (BR99 gone)');
  eq(data.getById('Branches', 'BR99') ?? null, null, 'index rebuilt on import');
  eq(data.getEntity('Countries').length, countriesBefore, 'Countries untouched by import');
  eq(res.skipped, [], 'no drift on a same-build round trip');
  eq(res.records, snap._meta.records, 'imported count matches the stamp');
}

console.log('== importSnapshot: drift + malformed ==');
{
  const drift = { _meta: {}, Blank: { 'Ghost Table': [{ x: 1 }], Regions: data.getEntity('Regions') } };
  const res = data.importSnapshot(drift);
  eq(res.skipped, ['Ghost Table'], 'unknown table skipped and reported');
  eq(data.getEntity('Regions').length > 0, true, 'known table imported');
  eq(data.getEntity('Branches').length, 0, 'tables absent from the file reset (replace, not merge)');
  let threw = null;
  try { data.importSnapshot({ nope: true }); } catch (e) { threw = e.message; }
  eq(/blank snapshot/.test(threw), true, 'file without a Blank section rejected');
  const older = { _meta: { schemaVersion: 0 }, Blank: { Regions: [] } };
  eq(data.importSnapshot(older).schemaMismatch,
    { file: 0, app: model.getSchemaVersion() }, 'version mismatch reported on import');
  eq(data.importSnapshot(snap).schemaMismatch ?? null, null, 'same-version import reports no mismatch');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
