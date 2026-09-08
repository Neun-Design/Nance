#!/usr/bin/env node
// test_engine_user_eligibility.mjs — the USER eligibility contract
// (Rafael's CI round, sv103): who may resolve a ticket's tasks. The chain:
//   Person → Onboarding (isCertified === true, strict #218 boolean; the
//   certification covers the onboarding's whole competence GROUP #239)
//   → Competence (must be BOUND to procedures — #368 — and EXERCISABLE:
//   ≥1 Approved procedure, sv71) → Procedures (only APPROVED ones
//   contribute their requirement sets) → coverage: the union of the
//   person's certified, task-compatible competences must cover EVERY
//   requirement of the task (∪ the ticket's live inherited set inside a
//   ticket context — #233 AND semantics).
// Verified two ways: synthetic fixtures walking each gate, and a
// full-census independent re-derivation compared against
// certifiedUsersForTask on every demo task.
// Run from prototype/:  node tools/test_engine_user_eligibility.mjs

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

// ---- fixtures: one person per gate under test ----
data.addRecord('People', { userID: 'U-EL', userName: 'Eligible (t)' });
data.addRecord('Tasks', { taskID: 'TSK-EL', taskName: 'Eligibility Task (t)', processID: 'PR1' });
data.addRecord('Procedures', { procedureID: 'PRC-EL', procedureRegistry: 'SOP-EL (t)',
  taskID: 'TSK-EL', requirementID: ['RQ01', 'RQ02'], productScopeID: [], procedureStatus: 'Approved' });
data.addRecord('Competence', { competenceID: 'CMP-EL', competenceTitle: 'Eligibility (t)',
  taskID: 'TSK-EL', procedureID: ['PRC-EL'] });
data.addRecord('Onboarding', { onboardID: 'OB-EL', onboardingTitle: 'Eligibility (t)',
  userID: 'U-EL', competenceID: ['CMP-EL'], isCertified: true });

const users = () => resolve.certifiedUsersForTask('TSK-EL');
const proc = data.getById('Procedures', 'PRC-EL');
const comp = data.getById('Competence', 'CMP-EL');
const ob = data.getById('Onboarding', 'OB-EL');

console.log('== the happy chain: certified onboarding → competence → approved procedure ==');
{
  eq(users().includes('U-EL'), true,
    'certified holder of a task-bound competence with an Approved procedure IS eligible');
  eq(resolve.competenceRequirements(comp), ['RQ01', 'RQ02'],
    'the competence inherits the procedure\'s requirement set (#231 doctrine)');
}

console.log('== gate: onboarding certification (strict boolean, group-wide) ==');
{
  ob.isCertified = false;
  eq(users().includes('U-EL'), false, 'isCertified=false → not eligible');
  ob.isCertified = 'true';
  eq(users().includes('U-EL'), false, 'the string "true" never passes (#218 strict boolean)');
  ob.isCertified = true;
  eq(users().includes('U-EL'), true, 'restored');
}

console.log('== gate: competence must be bound and exercisable ==');
{
  const saved = comp.procedureID;
  comp.procedureID = [];
  eq(users().includes('U-EL'), false,
    'a competence with NO procedure link is inert — nothing to exercise (#368)');
  comp.procedureID = saved;
  proc.procedureStatus = 'To Do';
  eq(users().includes('U-EL'), false,
    'a fully-unapproved procedure group is inert (sv71 status gate)');
  proc.procedureStatus = 'Approved';
  eq(users().includes('U-EL'), true, 'approval restores eligibility');
}

console.log('== gate: task compatibility + requirement coverage (AND) ==');
{
  const saved = comp.taskID;
  comp.taskID = 'TSK-OTHER';
  eq(users().includes('U-EL'), false, 'a competence naming ANOTHER task does not qualify');
  comp.taskID = saved;
  // ticket context (#233): coverage must also span the ticket's inherited
  // set — a context requirement outside the competence's coverage excludes
  eq(resolve.certifiedUsersForTask('TSK-EL', ['RQ-CTX']).includes('U-EL'), false,
    'an uncovered ticket-context requirement excludes the holder (AND semantics)');
  // two PARTIAL competences cover together (union — #239 group posture)
  data.addRecord('Procedures', { procedureID: 'PRC-EL2', procedureRegistry: 'SOP-EL2 (t)',
    taskID: 'TSK-EL', requirementID: ['RQ-CTX'], productScopeID: [], procedureStatus: 'Approved' });
  data.addRecord('Competence', { competenceID: 'CMP-EL2', competenceTitle: 'Eligibility 2 (t)',
    taskID: 'TSK-EL', procedureID: ['PRC-EL2'] });
  ob.competenceID = ['CMP-EL', 'CMP-EL2'];
  eq(resolve.certifiedUsersForTask('TSK-EL', ['RQ-CTX']).includes('U-EL'), true,
    'the union of the person\'s certified competences covers the full set together');
  ob.competenceID = ['CMP-EL'];
}

console.log('== the Jobs staffing control mirrors the chain ==');
{
  eq(forms.certifiedResponsibles(null, 'TSK-EL').some((o) => o.value === 'U-EL'), true,
    'certifiedResponsibles offers the eligible holder');
  ob.isCertified = false;
  eq(forms.certifiedResponsibles(null, 'TSK-EL').some((o) => o.value === 'U-EL'), false,
    'and drops them with the certification');
  ob.isCertified = true;
}

console.log('== full census: independent re-derivation matches the engine ==');
{
  // recompute eligibility from raw rows — no engine helpers on the path —
  // and compare with certifiedUsersForTask on EVERY demo task
  const procs = data.getEntity('Procedures');
  const comps = new Map(data.getEntity('Competence').map((c) => [String(c.competenceID), c]));
  const approved = (p) => p && (p.procedureStatus == null || p.procedureStatus === ''
    || String(p.procedureStatus) === 'Approved');
  const compCoverage = (c) => {
    const ids = asList(c.procedureID);
    if (!ids.length) return null; // inert (#368)
    const rows = ids.map((id) => procs.find((p) => String(p.procedureID) === String(id))).filter(Boolean);
    if (!rows.length) return null;
    const ap = rows.filter(approved);
    if (!ap.length) return null; // inert (sv71)
    const set = new Set();
    ap.forEach((p) => asList(p.requirementID).forEach((r) => set.add(String(r))));
    return set;
  };
  let mismatches = 0;
  for (const task of data.getEntity('Tasks')) {
    const tid = String(task.taskID);
    const need = new Set();
    procs.filter((p) => asList(p.taskID).map(String).includes(tid))
      .forEach((p) => asList(p.requirementID).forEach((r) => need.add(String(r))));
    // union across a user's onboardings (the engine unions per USER —
    // separate certified onboardings compose coverage together)
    const engine = resolve.certifiedUsersForTask(task.taskID).slice().sort();
    const byUser = new Map();
    for (const o of data.getEntity('Onboarding')) {
      if (o.isCertified !== true || o.userID == null) continue;
      const cur = byUser.get(o.userID) || new Set();
      for (const cid of asList(o.competenceID)) {
        const c = comps.get(String(cid));
        if (!c) continue;
        const cTasks = asList(c.taskID).map(String);
        if (cTasks.length && !cTasks.includes(tid)) continue;
        const cov = compCoverage(c);
        if (cov == null) continue;
        cur.add('__any__');
        cov.forEach((r) => cur.add(r));
      }
      byUser.set(o.userID, cur);
    }
    const manual = [...byUser.entries()]
      .filter(([, cover]) => cover.has('__any__') && [...need].every((r) => cover.has(r)))
      .map(([uid]) => uid).sort();
    if (JSON.stringify(engine) !== JSON.stringify(manual)) mismatches += 1;
  }
  eq(mismatches, 0,
    `engine ≡ independent re-derivation on all ${data.getEntity('Tasks').length} tasks`);
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
