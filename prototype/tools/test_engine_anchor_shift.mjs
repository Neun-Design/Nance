#!/usr/bin/env node
// test_engine_anchor_shift.mjs — proof suite for issue #306: the monthly
// anchor shift (data.js shiftAnchoredDates, MOCKUP_DEMO_PLAN §5.2) must not
// change STORED durations. Registered pairs (Jobs realStartDate →
// realEndDate/stoppedAt) shift the anchor field by calendar and land every
// dependent at anchor + its ORIGINAL offset — the #245 equation
// (end − start) − buffer = realExecutionTime survives any rollover,
// including months of different lengths (the J167 +24h break) and day
// clamps (Jan 31 → Feb 28). Unpaired dates keep the plain calendar shift;
// period frames and _meta.anchorDate are untouched by the pair refactor.
// `now` is injectable, so rollovers replay deterministically.
// Run from prototype/:  node tools/test_engine_anchor_shift.mjs

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
const hrs = (a, b) => (Date.parse(a) - Date.parse(b)) / 36e5;

console.log('== live dataset: durations survive whatever today\'s delta is ==');
{
  const raw = JSON.parse(fs.readFileSync('data/mockup_data_prototype.json', 'utf8'));
  const rawJobs = new Map(raw.Workspace.Jobs.map((j) => [j.jobID, j]));
  const jobs = data.getEntity('Jobs');
  const done = jobs.filter((j) => j.jobStatus === 'Done' && j.realStartDate && j.realEndDate);
  eq(done.length > 0, true, `probe: ${done.length} Done jobs with real windows`);
  const drifted = done.filter((j) => {
    const r = rawJobs.get(j.jobID);
    return Math.abs(hrs(j.realEndDate, j.realStartDate) - hrs(r.realEndDate, r.realStartDate)) > 0.001;
  });
  eq(drifted.length, 0, 'no loaded real window differs in length from the raw file');
  eq(done.every((j) => Math.abs(hrs(j.realEndDate, j.realStartDate)
    - Number(j.jobBufferExecution || 0) - Number(j.realExecutionTime || 0)) < 0.02), true,
    'the #245 equation closes on every loaded Done job');
  // the lifecycle suite compares against the SHIFTED anchor (bug 1)
  const ad = data.anchorToday();
  eq(ad != null, true, `anchorToday() resolves (${ad && ad.toDateString()})`);
  eq(done.every((j) => Date.parse(j.realEndDate) <= ad.getTime() + 86400e3), true,
    'every Done real end sits at or before the shifted anchor day');
}

console.log('== synthetic rollovers (injectable now; clobbers anchorToday — last) ==');
{
  const doc = () => ({
    _meta: { anchorDate: '2026-08-21' },
    Workspace: {
      Jobs: [
        { jobID: 'JX1', jobStatus: 'Done', realStartDate: '2026-04-26T08:00:00',
          realEndDate: '2026-05-01T01:40:12', jobBufferExecution: 1,
          realExecutionTime: 112.67, stoppedAt: null,
          startDate: '2026-04-26', deliveryDate: '2026-05-01' },
        { jobID: 'JX2', jobStatus: 'Stoped', realStartDate: '2026-01-31T08:00:00',
          stoppedAt: '2026-01-31T10:00:00', realEndDate: null },
      ],
    },
    CRM: { Forecasts: [{ forecastID: 'FX1', periodFrame: '2026-August',
      periodYear: 2026, periodMonth: 8 }] },
  });

  // delta 0 — the anchor month itself: everything loads untouched
  let d = doc();
  data.shiftAnchoredDates(d, new Date('2026-08-25T12:00:00'));
  eq([d.Workspace.Jobs[0].realEndDate, d._meta.anchorDate],
    ['2026-05-01T01:40:12', '2026-08-21'], 'delta 0: nothing shifts');

  // delta 1 — the September rollover that broke the suites (J167 shape):
  // Apr→May start, end lands at start + 113.67h — NOT at the calendar
  // position Jun 1 that stretched the window by 24h
  d = doc();
  data.shiftAnchoredDates(d, new Date('2026-09-03T12:00:00'));
  const j1 = d.Workspace.Jobs[0];
  eq(j1.realStartDate, '2026-05-26T08:00:00', 'anchor field shifts by calendar');
  eq(j1.realEndDate, '2026-05-31T01:40:12', 'end = start + ORIGINAL elapsed (not Jun 1)');
  eq(Math.abs(hrs(j1.realEndDate, j1.realStartDate) - 1 - 112.67) < 0.02, true,
    'the J167 equation closes after the rollover');
  eq([j1.startDate, j1.deliveryDate], ['2026-05-26', '2026-06-01'],
    'unpaired planned dates keep the plain calendar shift');
  const j2 = d.Workspace.Jobs[1];
  eq(j2.stoppedAt, `${j2.realStartDate.slice(0, 10)}T10:00:00`,
    'stoppedAt preserves its offset from the start');
  eq([d.CRM.Forecasts[0].periodFrame, d.CRM.Forecasts[0].periodMonth],
    ['2026-September', 9], 'period frames still shift (walker refactor regression)');
  eq(d._meta.anchorDate, '2026-09-21', 'anchor stamps the shifted month');

  // day clamp — Jan 31 start rolls into February: clamped to Feb 28, the
  // +2h pause offset intact
  d = doc();
  data.shiftAnchoredDates(d, new Date('2026-09-10T12:00:00'));
  // (delta 1 clamps nothing on JX2 — force a Feb landing with a fresh doc)
  const feb = { _meta: { anchorDate: '2026-01-10' }, Workspace: { Jobs: [
    { jobID: 'JX3', jobStatus: 'Stoped', realStartDate: '2026-01-31T08:00:00',
      stoppedAt: '2026-01-31T10:00:00', realEndDate: null }] } };
  data.shiftAnchoredDates(feb, new Date('2026-02-15T12:00:00'));
  const j3 = feb.Workspace.Jobs[0];
  eq(j3.realStartDate, '2026-02-28T08:00:00', 'day clamps to the target month length');
  eq(j3.stoppedAt, '2026-02-28T10:00:00', 'pause offset preserved through the clamp');

  // multi-month + cross-month landing: delta 5 pushes the Apr window into
  // Sep 26 → Oct 1 — duration still exact
  d = doc();
  data.shiftAnchoredDates(d, new Date('2027-01-15T12:00:00'));
  const j5 = d.Workspace.Jobs[0];
  eq(j5.realStartDate, '2026-09-26T08:00:00', 'delta 5 start');
  eq(j5.realEndDate, '2026-10-01T01:40:12', 'delta 5 end crosses into October, elapsed exact');
  eq(Math.abs(hrs(j5.realEndDate, j5.realStartDate) - 113.67) < 0.001, true,
    'elapsed is 113.67h at every delta');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
