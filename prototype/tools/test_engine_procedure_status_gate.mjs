#!/usr/bin/env node
// test_engine_procedure_status_gate.mjs — proof suite for the procedure-status
// eligibility gate (schemaVersion 71): only an APPROVED procedure can be
// exercised. A certified onboarding (isCertified === true, the #214/#218
// strict gate) is no longer sufficient — if the competence hangs off a
// procedure whose procedureStatus (#302) is not 'Approved', the holder is NOT
// eligible for the task until the status flips. Gates: procedureApproved /
// competenceExercisable (resolve.js), threaded through certifiedUsersForTask
// (#214/#233), certifiedUsersForProcedure (#271) and certifiedResponsibles
// (Jobs staffing, forms.js). Rows without the key = Approved (legacy
// tolerance, the isActive posture).
// Run from prototype/:  node tools/test_engine_procedure_status_gate.mjs

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
const asList = (v) => (Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]));

console.log('== gate helpers ==');
{
  eq(model.getSchemaVersion() >= 71, true, `schemaVersion ${model.getSchemaVersion()} >= 71`);
  eq(resolve.procedureApproved({ procedureStatus: 'Approved' }), true, 'Approved passes');
  eq(resolve.procedureApproved({ procedureStatus: 'In Progress' }), false, 'In Progress gates');
  eq(resolve.procedureApproved({ procedureStatus: 'To Do' }), false, 'To Do gates');
  eq(resolve.procedureApproved({}), true, 'missing key = Approved (legacy tolerance)');
  eq(resolve.procedureApproved(null), false, 'no row = not approved');
  eq(resolve.competenceExercisable({ procedureID: [] }), true,
    'competence without procedures stays exercisable (legacy stored-requirement rows)');
}

// find a live eligibility chain to flip: a certified onboarding whose
// competence binds a procedure and currently yields eligible users
const findChain = () => {
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
        return { ob, comp, proc, taskId };
      }
    }
  }
  return null;
};

console.log('== flipping the status drops eligibility everywhere ==');
{
  const chain = findChain();
  eq(!!chain, true, 'a live certified chain (onboarding→competence→procedure→task) exists');
  const { ob, comp, proc, taskId } = chain;
  const procIds = asList(comp.procedureID);
  const saved = new Map(procIds.map((id) => [id, (data.getById('Procedures', id) || {}).procedureStatus]));

  // the whole group must be non-Approved for the competence to go inert
  for (const id of procIds) {
    const p = data.getById('Procedures', id);
    if (p) p.procedureStatus = 'In Progress';
  }
  eq(resolve.competenceExercisable(comp), false, 'whole group unapproved → competence inert');
  eq(resolve.competenceRequirements(comp), [],
    'inert group covers NOTHING ([] — never null, which would read as the wildcard)');
  eq(resolve.certifiedUsersForProcedure(proc.procedureID).length, 0,
    'unapproved procedure has no eligible users (Users column shows the GAP)');
  const dropped = !resolve.certifiedUsersForTask(taskId).includes(ob.userID);
  eq(dropped, true, 'certified holder drops out of the task eligibility while unapproved');
  const respIds = forms.certifiedResponsibles(null, taskId).map((o) => String(o.value));
  const otherCovers = data.getEntity('Onboarding').some((o2) => o2 !== ob
    && o2.isCertified === true && String(o2.userID) === String(ob.userID)
    && asList(o2.competenceID).some((cid) => {
      const c2 = data.getById('Competence', cid);
      return c2 && c2 !== comp && resolve.competenceExercisable(c2)
        && (!asList(c2.taskID).length || asList(c2.taskID).includes(taskId));
    }));
  if (!otherCovers) {
    eq(respIds.includes(String(ob.userID)), false,
      'Jobs Responsible options drop the holder too (certified-responsible gate)');
  } else {
    ok('holder kept by ANOTHER exercisable competence — Jobs gate not assertable on this chain');
  }

  // restore → eligibility returns (the gate is live, not a snapshot)
  for (const [id, st] of saved) {
    const p = data.getById('Procedures', id);
    if (p) { if (st === undefined) delete p.procedureStatus; else p.procedureStatus = st; }
  }
  eq(resolve.certifiedUsersForTask(taskId).includes(ob.userID), true,
    'flipping back to Approved restores eligibility');
}

console.log('== wildcard procedures obey the gate ==');
{
  const comp = { procedureID: ['PROC-WILD-GATE'], taskID: [] };
  data.addRecord('Procedures', { procedureID: 'PROC-WILD-GATE', procedureRegistry: 'WILD',
    taskID: [], requirementID: [], procedureStatus: 'To Do' });
  eq(resolve.competenceRequirements(comp), [],
    'a NON-Approved wildcard no longer certifies everything');
  data.getById('Procedures', 'PROC-WILD-GATE').procedureStatus = 'Approved';
  eq(resolve.competenceRequirements(comp), null,
    'the same wildcard certifies everything again once Approved');
}

console.log('== demo census: gate bites nothing at rest ==');
{
  const procs = data.getEntity('Procedures');
  eq(procs.every((p) => resolve.procedureApproved(p)), true,
    'every seeded procedure is Approved (#302 seed) — eligibility unchanged at rest');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
