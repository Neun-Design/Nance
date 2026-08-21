#!/usr/bin/env node
// test_engine_jobs_hygiene.mjs — unit-test the Jobs hygiene round (issue
// #244, R6-4): roleID mirrors the allocated person (A8), projectID derives
// from the ticket on save (A14), plannedExecutionTime freezes from the
// task's procedures (A9), the A13 date notes are unswapped in the data, and
// predecessorJobID/dependencyType exist for real (A6).
// Run from prototype/:  node tools/test_engine_jobs_hygiene.mjs

import fs from 'fs';
globalThis.fetch = async (p) => new Response(fs.readFileSync(p));

const model = await import('../js/model.js');
const data = await import('../js/data.js');
const { catalog } = await model.loadModel();
data.initMeta(catalog);
await data.loadData();
const resolve = await import('../js/resolve.js');
const forms = await import('../js/forms.js');

let fails = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails += 1; console.log(`  ✗ ${m}`); };
const eq = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));

console.log('== A8: a job has no role of its own ==');
{
  const cat = catalog['Jobs'];
  eq(cat.byName['roleID'].type, 'mirror', 'roleID is a mirror now');
  eq(data.getEntity('Jobs').every((j) => !('roleID' in j)), true, 'stored copies dropped (parity)');
  const job = data.getEntity('Jobs').find((j) => j.userID);
  const person = data.getById('People', job.userID);
  const cell = String(resolve.derivedValue('Jobs', cat.byName['roleID'], job));
  const roleName = String(resolve.resolveDisplay('People', person, 'roleID'));
  eq(cell, roleName, 'the cell renders the allocated person\'s role');
}

console.log('== A14 + A9: single sources ==');
{
  const tkt = data.getEntity('Tickets').find((t) => t.projectID);
  const rec = { ticketID: tkt.ticketID, projectID: 'WRONG' };
  forms.applyDerivedUnits('Jobs', rec);
  eq(rec.projectID, tkt.projectID, 'save overwrites projectID with the ticket\'s project');
  const jobs = data.getEntity('Jobs');
  const drift = jobs.filter((j) => {
    const t = data.getById('Tickets', j.ticketID);
    return t && t.projectID && String(j.projectID) !== String(t.projectID);
  });
  eq(drift.length, 0, 'no job points at a project different from its ticket\'s');
  const procs = data.getEntity('Procedures');
  const planOf = (taskId) => procs
    .filter((p) => (Array.isArray(p.taskID) ? p.taskID : [p.taskID])
      .some((t) => String(t) === String(taskId)))
    .reduce((s, p) => s + (Number(p.executionTime) || 0), 0);
  const chained = jobs.filter((j) => planOf(j.taskID) > 0);
  eq(chained.length > 0 && chained.every((j) => j.plannedExecutionTime === planOf(j.taskID)), true,
    'every chained job\'s plan equals its task\'s procedure hours');
  const rec2 = { taskID: chained[0].taskID };
  forms.applyDerivedUnits('Jobs', rec2);
  eq(rec2.plannedExecutionTime, planOf(chained[0].taskID), 'save freezes the plan from the procedures');
}

console.log('== A13: dates read the right way ==');
{
  const withBoth = data.getEntity('Jobs').filter((j) => j.startDate && j.deliveryDate);
  eq(withBoth.length > 0 && withBoth.every((j) => String(j.startDate) <= String(j.deliveryDate)),
    true, 'startDate (planned start) never follows deliveryDate (planned delivery)');
}

console.log('== A6: dependencies exist in the model, not just the code ==');
{
  const cat = catalog['Jobs'];
  const pred = model.parseRule(cat.byName['predecessorJobID'].rule);
  eq([pred.kind, pred.target], ['fk', 'Jobs'], 'predecessorJobID is a nullable self-FK');
  eq(model.parseRule(cat.byName['dependencyType'].rule).values,
    ['start-to-finish', 'start-to-start', 'finish-to-start', 'finish-to-finish'],
    'dependencyType reuses the indentationRule enum');
  eq(cat.form.fields.Predecessor.check, 'Ticket IS NOT NULL', 'Predecessor gated on Ticket');
  eq(cat.form.fields.Dependency.check, 'Predecessor IS NOT NULL', 'Dependency gated on Predecessor');
  const jobs = data.getEntity('Jobs');
  eq(jobs.every((j) => 'predecessorJobID' in j && 'dependencyType' in j), true,
    'every row carries the keys (parity)');
  const linked = jobs.filter((j) => j.predecessorJobID);
  eq(linked.length > 0, true, `${linked.length} jobs chain a predecessor`);
  eq(linked.every((j) => {
    const p = data.getById('Jobs', j.predecessorJobID);
    return p && String(p.ticketID) === String(j.ticketID) && j.dependencyType === 'finish-to-start';
  }), true, 'seeded chains stay within the ticket, finish-to-start');
  const opts = forms.optionsForAttr('Jobs', 'predecessorJobID');
  eq(opts.target, 'Jobs', 'the predecesorJob residue finally resolves to a real attribute');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
