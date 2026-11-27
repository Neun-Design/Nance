import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';

const asList = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);

// Would the holder stay task-eligible through a DIFFERENT competence after the
// chain's procedure group goes inert? Conservative: any other exercisable,
// task-compatible competence disqualifies the chain for the flip scenario.
function otherCompetenceCovers(engine, ob, comp, taskId) {
  const { data, resolve } = engine;
  for (const o2 of data.getEntity('Onboarding')) {
    if (o2.isCertified !== true || String(o2.userID) !== String(ob.userID)) continue;
    for (const cid of asList(o2.competenceID)) {
      const c2 = data.getById('Competence', cid);
      if (!c2 || c2 === comp) continue;
      const tasks = asList(c2.taskID);
      if (tasks.length && !tasks.includes(taskId)) continue;
      const sharesGroup = asList(c2.procedureID).some((p) => asList(comp.procedureID).includes(p));
      if (!sharesGroup && resolve.competenceExercisable(c2)) return true;
    }
  }
  return false;
}

// Port of the findChain selector in tools/test_engine_procedure_status_gate.mjs:
// a certified onboarding whose competence binds a procedure and currently
// yields the holder among the task's eligible users. Chains with exclusive
// coverage are preferred so the drop assertion is deterministic under seed
// drift; the plain first chain (the proof's pick) is the fallback.
function findChain(engine) {
  const { data, resolve } = engine;
  let fallback = null;
  for (const ob of data.getEntity('Onboarding')) {
    if (ob.isCertified !== true || !ob.userID) continue;
    for (const compId of asList(ob.competenceID)) {
      const comp = data.getById('Competence', compId);
      if (!comp) continue;
      for (const procId of asList(comp.procedureID)) {
        const proc = data.getById('Procedures', procId);
        if (!proc) continue;
        const taskId = asList(proc.taskID)[0] ?? asList(comp.taskID)[0];
        if (taskId == null) continue;
        if (!resolve.certifiedUsersForTask(taskId).includes(ob.userID)) continue;
        if (!otherCompetenceCovers(engine, ob, comp, taskId)) return { ob, comp, taskId };
        fallback = fallback || { ob, comp, taskId };
      }
    }
  }
  return fallback;
}

Given('a procedure with no status key', function () {
  this.proc = {};
});

Given('a procedure with status {string}', function (status) {
  this.proc = { procedureStatus: status };
});

Then('the procedure is considered approved', function () {
  assert.equal(this.engine.resolve.procedureApproved(this.proc), true);
});

Then('the procedure is considered not approved', function () {
  assert.equal(this.engine.resolve.procedureApproved(this.proc), false);
});

Given('a competence with no procedure links', function () {
  this.comp = { procedureID: [] };
});

Then('the competence is not exercisable', function () {
  assert.equal(this.engine.resolve.competenceExercisable(this.comp), false);
});

Given('a task staffed through a certified competence chain', function () {
  this.chain = findChain(this.engine);
  assert.ok(this.chain, 'no live certified chain (onboarding -> competence -> procedure -> task) in the dataset');
});

When('the whole procedure group of that competence flips to {string}', function (status) {
  const { data } = this.engine;
  const ids = asList(this.chain.comp.procedureID);
  this.chain.saved = new Map(ids.map((id) => [id, (data.getById('Procedures', id) || {}).procedureStatus]));
  for (const id of ids) {
    const proc = data.getById('Procedures', id);
    if (proc) proc.procedureStatus = status;
  }
});

Then('the competence becomes inert', function () {
  assert.equal(this.engine.resolve.competenceExercisable(this.chain.comp), false);
});

Then('the certified holder drops out of the task eligibility', function () {
  const eligible = this.engine.resolve.certifiedUsersForTask(this.chain.taskId);
  assert.ok(!eligible.includes(this.chain.ob.userID),
    `holder ${this.chain.ob.userID} still eligible for task ${this.chain.taskId}`);
});

When('the procedure group flips back to its original statuses', function () {
  const { data } = this.engine;
  for (const [id, status] of this.chain.saved) {
    const proc = data.getById('Procedures', id);
    if (!proc) continue;
    if (status === undefined) delete proc.procedureStatus;
    else proc.procedureStatus = status;
  }
});

Then('the certified holder is eligible for the task again', function () {
  const eligible = this.engine.resolve.certifiedUsersForTask(this.chain.taskId);
  assert.ok(eligible.includes(this.chain.ob.userID),
    `holder ${this.chain.ob.userID} not restored for task ${this.chain.taskId}`);
});
