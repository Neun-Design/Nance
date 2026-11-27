import { Given, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';

Given('the engine is loaded with the clinic mockup dataset', function () {
  assert.ok(this.engine, 'engine not booted (BeforeAll hook)');
  assert.ok(this.engine.data.getEntity('Business Units').length > 0, 'mockup dataset looks empty');
});

Given('the schema version is at least {int}', function (min) {
  const v = this.engine.model.getSchemaVersion();
  assert.ok(Number(v) >= min, `schemaVersion ${v} < ${min}`);
});

function rowsOf(world, table) {
  const rows = world.engine.data.getEntity(table);
  assert.ok(rows.length > 0, `no "${table}" rows in the dataset`);
  return rows;
}

function assertKeyed(world, table, fields) {
  for (const row of rowsOf(world, table)) {
    for (const f of fields) {
      assert.ok(row[f] != null && row[f] !== '',
        `"${table}" row misses "${f}": ${JSON.stringify(row).slice(0, 100)}`);
    }
  }
}

Then('every {string} row has values for {string}, {string} and {string}',
  function (table, a, b, c) { assertKeyed(this, table, [a, b, c]); });

Then('every {string} row has values for {string}, {string}, {string} and {string}',
  function (table, a, b, c, d) { assertKeyed(this, table, [a, b, c, d]); });

Then('no two {string} rows share the same {string}, {string} and {string}', function (table, a, b, c) {
  const seen = new Set();
  for (const row of rowsOf(this, table)) {
    const key = JSON.stringify([row[a], row[b], row[c]]);
    assert.ok(!seen.has(key), `duplicate "${table}" grain ${key}`);
    seen.add(key);
  }
});
