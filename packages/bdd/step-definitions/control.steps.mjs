import { Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { readFixture } from '../support/fixtures.mjs';

function runReport(world, id, state = {}) {
  const query = world.engine.queries.REPORT_QUERIES[id];
  assert.ok(query, `no report query implemented for "${id}"`);
  const table = id.split('::')[0];
  const spec = query(world.engine.data.getEntity(table), state);
  assert.ok(spec && spec.type, `"${id}" returned no spec`);
  return spec;
}

function seriesByName(world, name) {
  const s = (world.report.series || []).find((x) => x.name === name);
  assert.ok(s, `no series "${name}" in ${JSON.stringify((world.report.series || []).map((x) => x.name))}`);
  return s;
}

const total = (s) => s.data.reduce((sum, v) => sum + (Number(v) || 0), 0);

function assertCategoriesAreLabels(world, table) {
  const meta = world.engine.data.ENTITY_META[table];
  assert.ok(meta && meta.label, `no label metadata for table "${table}"`);
  const labels = new Set(world.engine.data.getEntity(table).map((r) => r[meta.label]));
  assert.ok(world.report.cats.length > 0, 'report has no categories');
  for (const cat of world.report.cats) {
    assert.ok(labels.has(cat), `category "${cat}" is not a ${table}.${meta.label}`);
  }
}

When('I run report {string}', function (id) {
  this.report = runReport(this, id);
});

When('I run report {string} with radio {string}', function (id, radio) {
  this.report = runReport(this, id, { radio });
});

When('I remember the total of series {string} as {string}', function (name, key) {
  this.remembered[key] = total(seriesByName(this, name));
});

Then('the report satisfies the invariants in fixture {string}', function (rel) {
  const inv = readFixture(rel);
  if (inv.minSchemaVersion != null) {
    const v = this.engine.model.getSchemaVersion();
    assert.ok(Number(v) >= inv.minSchemaVersion, `schemaVersion ${v} < fixture's ${inv.minSchemaVersion}`);
  }
  if (inv.type) assert.equal(this.report.type, inv.type);
  if (inv.series) {
    assert.deepEqual((this.report.series || []).map((s) => s.name), inv.series);
  }
  if (inv.categoriesAreLabelsOf) assertCategoriesAreLabels(this, inv.categoriesAreLabelsOf);
});

Then('every report category is a label from the {string} table', function (table) {
  assertCategoriesAreLabels(this, table);
});

Then('every value of series {string} is greater than 0', function (name) {
  const s = seriesByName(this, name);
  s.data.forEach((v, i) => assert.ok(Number(v) > 0, `${name}[${this.report.cats[i]}] = ${v}`));
});

Then('the total of series {string} is greater than 0', function (name) {
  assert.ok(total(seriesByName(this, name)) > 0, `series "${name}" sums to 0`);
});

Then('the total of series {string} is at most the remembered {string}', function (name, key) {
  assert.ok(key in this.remembered, `nothing remembered as "${key}"`);
  const got = total(seriesByName(this, name));
  assert.ok(got <= this.remembered[key], `${got} > remembered ${key} ${this.remembered[key]}`);
});

// Stored values are rounded to 2 decimals by derive_control.py, so the
// recomputed equations must agree within the half-cent rounding band.
const ROUNDING = 0.005 + 1e-9;

Then('every {string} row derives utilization as allocated hours over available hours', function (table) {
  for (const row of this.engine.data.getEntity(table)) {
    if (!Number(row.availableHours)) continue;
    const want = Number(row.allocatedHours) / Number(row.availableHours);
    assert.ok(Math.abs(Number(row.utilization) - want) <= ROUNDING,
      `${row.capacityID}: utilization ${row.utilization} != ${want.toFixed(4)}`);
  }
});

Then('every {string} row derives efficiency from planned hours over real execution time', function (table) {
  for (const row of this.engine.data.getEntity(table)) {
    if (!Number(row.realExecutionTime)) continue;
    const want = ((Number(row.plannedHours) / Number(row.realExecutionTime)) - 1) * 100;
    assert.ok(Math.abs(Number(row.efficiency) - want) <= ROUNDING,
      `${row.usageID}: efficiency ${row.efficiency} != ${want.toFixed(4)}`);
  }
});
