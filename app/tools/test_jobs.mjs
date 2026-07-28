#!/usr/bin/env node
// test_jobs.mjs — unit-test the Jobs status-transition hook (restructure spec):
// Queued→Active stamps realStartDate; entering Stoped stamps stoppedAt;
// leaving Stoped accrues jobBufferExecution; Active→Done stamps realEndDate
// and stores realExecutionTime = elapsed − buffer.
// Run from prototype/:  node tools/test_jobs.mjs

import fs from 'fs';
globalThis.fetch = async (p) => new Response(fs.readFileSync(p));

const model = await import('../js/model.js');
const data = await import('../js/data.js');
const { catalog } = await model.loadModel();
data.initMeta(catalog);
await data.loadData();
const { applyJobTransition } = await import('../js/forms.js');

let fails = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails += 1; console.log(`  ✗ ${m}`); };
const at = (h) => new Date(Date.UTC(2026, 6, 28, 8 + h, 0, 0)).toISOString(); // 08:00 + h

console.log('== Jobs status transitions ==');

// Queued → Active stamps realStartDate
{
  const rec = { jobStatus: 'Active' };
  applyJobTransition('Jobs', rec, { jobStatus: 'Queued' }, at(0));
  if (rec.realStartDate === at(0)) ok('Queued→Active stamps realStartDate');
  else fail(`Queued→Active: realStartDate=${rec.realStartDate}`);
}

// Active → Stoped stamps stoppedAt only
{
  const rec = { jobStatus: 'Stoped' };
  applyJobTransition('Jobs', rec, { jobStatus: 'Active', realStartDate: at(0) }, at(2));
  if (rec.stoppedAt === at(2) && rec.realEndDate == null) ok('Active→Stoped stamps stoppedAt');
  else fail(`Active→Stoped: stoppedAt=${rec.stoppedAt} realEndDate=${rec.realEndDate}`);
}

// Stoped → Active accrues the pause into jobBufferExecution
{
  const rec = { jobStatus: 'Active' };
  applyJobTransition('Jobs', rec,
    { jobStatus: 'Stoped', realStartDate: at(0), stoppedAt: at(2), jobBufferExecution: 0.5 }, at(3));
  if (rec.jobBufferExecution === 1.5 && rec.stoppedAt === null) ok('Stoped→Active accrues buffer (0.5 + 1h)');
  else fail(`Stoped→Active: buffer=${rec.jobBufferExecution} stoppedAt=${rec.stoppedAt}`);
}

// Active → Done stamps realEndDate and stores realExecutionTime = elapsed − buffer
{
  const rec = { jobStatus: 'Done' };
  applyJobTransition('Jobs', rec,
    { jobStatus: 'Active', realStartDate: at(0), jobBufferExecution: 1.5 }, at(8));
  if (rec.realEndDate === at(8) && rec.realExecutionTime === 6.5) {
    ok('Active→Done stores realExecutionTime = 8h − 1.5h buffer = 6.5');
  } else fail(`Active→Done: end=${rec.realEndDate} realExecutionTime=${rec.realExecutionTime}`);
}

// no-ops: unchanged status and non-Jobs entities
{
  const rec = { jobStatus: 'Active' };
  applyJobTransition('Jobs', rec, { jobStatus: 'Active', realStartDate: at(0) }, at(5));
  const rec2 = { jobStatus: 'Done' };
  applyJobTransition('Tickets', rec2, { jobStatus: 'Queued' }, at(5));
  if (rec.realStartDate == null && rec2.realEndDate == null) ok('unchanged status / other entities: no-op');
  else fail('no-op cases mutated the record');
}

// mockup consistency: migrated Done jobs illustrate the formula
{
  const bad = data.getEntity('Jobs').filter((j) => j.jobStatus === 'Done'
    && j.realStartDate && j.realEndDate && typeof j.realExecutionTime === 'number'
    && String(j.realStartDate).length > 10)
    .filter((j) => {
      const hrs = (Date.parse(j.realEndDate) - Date.parse(j.realStartDate)) / 36e5;
      return Math.abs((hrs - (Number(j.jobBufferExecution) || 0)) - j.realExecutionTime) > 0.01;
    });
  if (!bad.length) ok('mockup Done jobs satisfy (end − start) − buffer = realExecutionTime');
  else fail(`${bad.length} mockup jobs break the formula, e.g. ${bad[0].jobID}`);
}

console.log(`\n${fails ? `${fails} FAILURES` : 'ALL PASS'}`);
process.exit(fails ? 1 : 0);
