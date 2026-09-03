#!/usr/bin/env node
// test_engine_job_lifecycle.mjs — unit-test the Job lifecycle round (issue
// #245, R6-5): the exported transition map drives the drawer's action bar,
// each move stamps what applyJobTransition promises, and the re-seeded
// history is coherent (no future Done dates, closed equations, stoppedAt on
// every Stoped row).
// Run from prototype/:  node tools/test_engine_job_lifecycle.mjs

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

console.log('== the action map: one button per legal move ==');
{
  eq(forms.JOB_TRANSITIONS.Queued, [['Start', 'Active']], 'Queued offers Start');
  eq(forms.JOB_TRANSITIONS.Active, [['Pause', 'Stoped'], ['Finish', 'Done']], 'Active offers Pause + Finish');
  eq(forms.JOB_TRANSITIONS.Stoped, [['Resume', 'Active']], 'Stoped offers Resume');
  eq(forms.JOB_TRANSITIONS.Done, undefined, 'Done offers nothing (terminal)');
}

console.log('== each move stamps what the drawer promises ==');
{
  const t0 = '2026-08-21T08:00:00.000Z';
  const start = { jobStatus: 'Active' };
  forms.applyJobTransition('Jobs', start, { jobStatus: 'Queued' }, t0);
  eq(start.realStartDate, t0, 'Start stamps realStartDate');
  const pause = { jobStatus: 'Stoped' };
  forms.applyJobTransition('Jobs', pause, { jobStatus: 'Active', realStartDate: t0 }, '2026-08-21T10:00:00.000Z');
  eq(pause.stoppedAt, '2026-08-21T10:00:00.000Z', 'Pause stamps stoppedAt');
  const resume = { jobStatus: 'Active' };
  forms.applyJobTransition('Jobs', resume,
    { jobStatus: 'Stoped', realStartDate: t0, stoppedAt: '2026-08-21T10:00:00.000Z', jobBufferExecution: 0 },
    '2026-08-21T11:30:00.000Z');
  eq([resume.jobBufferExecution, resume.stoppedAt], [1.5, null], 'Resume accrues the pause into the buffer');
  const finish = { jobStatus: 'Done', jobBufferExecution: 1.5 };
  forms.applyJobTransition('Jobs', finish,
    { jobStatus: 'Active', realStartDate: t0 }, '2026-08-21T14:00:00.000Z');
  eq([finish.realEndDate, finish.realExecutionTime], ['2026-08-21T14:00:00.000Z', 4.5],
    'Finish closes realExecutionTime = elapsed − buffer');
}

console.log('== seeded history: the story holds together ==');
{
  // the dataset shifts forward by whole months on every load (data.js
  // shiftAnchoredDates) — compare against the SHIFTED anchor, never a pinned
  // constant (issue #306: the '2026-08-21' pin went stale on the September
  // rollover and read the shifted Done dates as "future")
  const ad = data.anchorToday();
  const p = (n) => String(n).padStart(2, '0');
  const ANCHOR = ad
    ? `${ad.getFullYear()}-${p(ad.getMonth() + 1)}-${p(ad.getDate())}`
    : '2026-08-21';
  const jobs = data.getEntity('Jobs');
  const done = jobs.filter((j) => j.jobStatus === 'Done');
  eq(done.length > 0 && done.every((j) => (!j.realStartDate || String(j.realStartDate) <= ANCHOR + 'T23:59:59')
    && (!j.realEndDate || String(j.realEndDate) <= ANCHOR + 'T23:59:59')), true,
    'no Done job carries real dates in the future');
  const hrs = (a, b) => (Date.parse(a) - Date.parse(b)) / 36e5;
  eq(done.filter((j) => j.realStartDate && j.realEndDate).every((j) =>
    Math.abs(hrs(j.realEndDate, j.realStartDate) - Number(j.jobBufferExecution || 0)
      - Number(j.realExecutionTime || 0)) < 0.02), true,
    'every Done job closes the equation (elapsed − buffer = real)');
  const stoped = jobs.filter((j) => j.jobStatus === 'Stoped');
  eq(stoped.length > 0 && stoped.every((j) => j.stoppedAt), true, 'every Stoped job carries stoppedAt');
  eq(jobs.filter((j) => j.jobStatus === 'Active').every((j) => j.realStartDate && !j.realEndDate),
    true, 'Active jobs: started, not ended');
  eq(jobs.filter((j) => j.jobStatus === 'Queued').every((j) => !j.realStartDate && !j.realEndDate),
    true, 'Queued jobs: untouched clocks');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
