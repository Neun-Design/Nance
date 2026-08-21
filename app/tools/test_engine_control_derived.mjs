#!/usr/bin/env node
// test_engine_control_derived.mjs — unit-test the Control derivation round
// (issue #246, R6-6): the new grains (Capacity = function × month,
// Performance = function × customer × month over Done jobs), the derived
// numbers matching their §5.2 formulas, and the A15 Overview redirect.
// The validator's derivation gate re-proves the full equality on every run.
// Run from prototype/:  node tools/test_engine_control_derived.mjs

import fs from 'fs';
globalThis.fetch = async (p) => new Response(fs.readFileSync(p));
// overview.js pulls charts.js, which reads CSS vars at module init — a
// minimal DOM shim keeps the import alive in node
globalThis.document = { documentElement: {} };
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });

const model = await import('../js/model.js');
const data = await import('../js/data.js');
const { catalog } = await model.loadModel();
data.initMeta(catalog);
await data.loadData();
const overview = await import('../js/overview.js');

let fails = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails += 1; console.log(`  ✗ ${m}`); };
const eq = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));

console.log('== grains: the ambiguity is gone ==');
{
  const cap = catalog['Capacity'];
  eq(model.parseRule(cap.byName['functionID'].rule).target, 'Functions', 'Capacity anchors functionID');
  eq([cap.byName['departmentID'], cap.byName['roleID']], [undefined, undefined],
    'Capacity dropped the department × role mix');
  const perf = catalog['Performance'];
  eq([model.parseRule(perf.byName['functionID'].rule).target,
    model.parseRule(perf.byName['customerID'].rule).target], ['Functions', 'Customers'],
    'Performance anchors functionID × customerID');
  eq([perf.byName['regionID'], perf.byName['ticketID'], perf.byName['squadName']],
    [undefined, undefined, undefined], 'Performance dropped the region × ticket × squad mix');
  eq([cap.byName['functionName'].type, perf.byName['customerName'].type], ['mirror', 'mirror'],
    'display names are mirrors of the stored FKs');
}

console.log('== the numbers trace to their sources (§5.2 formulas) ==');
{
  const caps = data.getEntity('Capacity');
  const row = caps.find((c) => c.functionID === 'F1' && c.periodYear === 2025 && c.periodMonth === 8);
  const weekly = data.getEntity('People')
    .filter((p) => String(p.functionID) === 'F1')
    .reduce((s, p) => s + (Number(p.workingHours) || 0), 0);
  const fc = data.getEntity('Forecasts').find((f) =>
    f.forecastPeriod === 'Month' && String(f.periodStart).startsWith('2025-08'));
  eq(row.availableHours, Math.round(weekly * fc.periodBusinessDays / 5 * 100) / 100,
    'availableHours = Σ function workingHours × weeks of the month');
  const monthFcs = new Set(data.getEntity('Forecasts')
    .filter((f) => f.forecastPeriod === 'Month' && String(f.periodStart).startsWith('2025-08'))
    .map((f) => f.forecastID));
  const alloc = data.getEntity('Forecast Scopes')
    .filter((s) => monthFcs.has(s.forecastID) && String(s.functionID) === 'F1')
    .reduce((s, r) => s + (Number(r.estimatedHours) || 0), 0);
  eq(row.allocatedHours, Math.round(alloc * 100) / 100,
    'allocatedHours = Σ the function\'s demand lines in the month');
  eq(row.utilization, Math.round(row.allocatedHours / row.availableHours * 100) / 100,
    'utilization = allocated / available');
  const perfs = data.getEntity('Performance');
  const p0 = perfs[0];
  const doneJobs = data.getEntity('Jobs').filter((j) => {
    if (j.jobStatus !== 'Done' || !j.realEndDate) return false;
    const person = data.getById('People', j.userID);
    const tkt = data.getById('Tickets', j.ticketID);
    return person && tkt && String(person.functionID) === String(p0.functionID)
      && String(tkt.customerID) === String(p0.customerID)
      && String(j.realEndDate).startsWith(`${p0.periodYear}-${String(p0.periodMonth).padStart(2, '0')}`);
  });
  eq(p0.realExecutionTime,
    Math.round(doneJobs.reduce((s, j) => s + (Number(j.realExecutionTime) || 0), 0) * 100) / 100,
    'Performance real hours = Σ the group\'s Done jobs');
  eq(perfs.length > 0 && new Set(perfs.map((r) => `${r.periodYear}-${r.periodMonth}`)).size >= 12,
    true, 'Performance spans 12 monthly periods (validator basis)');
}

console.log('== A15: Details keeps its promise ==');
{
  eq(overview.SOURCE_REDIRECT, { Capacity: 'Forecast Scopes', Performance: 'Jobs' },
    'Control items redirect to their live sources');
  eq(overview.routeFor('Capacity').label.includes('Forecast Scopes'), true,
    'Capacity Details routes to CRM › Forecast Scopes');
  eq(overview.routeFor('Performance').label.includes('Jobs'), true,
    'Performance Details routes to Workspace › Jobs');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
