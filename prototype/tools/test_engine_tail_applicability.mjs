#!/usr/bin/env node
// test_engine_tail_applicability.mjs — proof for issue #368 (R4+R5,
// sv101): the #364 doctrine closes on the remaining multivalued
// applicability sets. Processes.productScopeID (empty = "covers every
// scope of the event") and Handouts.departmentID (empty = "offered
// everywhere") are strict — sv101 materialized the demo blanks; and a
// Competence with NO procedure link is INERT (covers nothing, not
// exercisable — nothing to exercise; procedureID stays NULLABLE by
// decision: a NOT NULL would break parity on the legacy developer copy,
// the engine gates close the UI hole). Competence.productScopeID stays a
// single-valued nullable FK — context posture, OUT of doctrine scope.
// Pre-sv101 snapshots keep every old reading via legacyWildcardData(101).
// Census at the flip: 0 flips across hDept(6) / hTask(49) / procPS(6) /
// tkProc(160) / users(46) / resp(320) / reqs(160) / dispatch(1502) /
// inputs(160).
// Run from prototype/:  node tools/test_engine_tail_applicability.mjs

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

const dm = JSON.parse(fs.readFileSync('data/datamodel.json', 'utf-8'));

console.log('== schema: sv101, the tail keys record the doctrine ==');
{
  eq(dm._meta.schemaVersion >= 101, true, `schemaVersion ${dm._meta.schemaVersion} >= 101`);
  eq(/#368/.test(String(catalog['Processes'].byName.productScopeID.notes)), true,
    'Processes.productScopeID notes record #368');
  eq(/#368/.test(String(catalog['Handouts'].byName.departmentID.notes)), true,
    'Handouts.departmentID notes record #368');
  eq(/#368/.test(String(catalog['Competence'].byName.procedureID.notes)), true,
    'Competence.procedureID notes record #368 (incl. the nullable decision)');
  eq(/NOT NULL/i.test(String(catalog['Competence'].byName.procedureID.constraints || '')), false,
    'procedureID stays nullable (legacy-copy parity) — the engine gates close the hole');
  eq(data.legacyWildcardData(101), false, 'the sv101 mockup is STRICT on the tail chains');
}

console.log('== handouts: an undeclared department list is offered nowhere ==');
{
  const dept = data.getEntity('Departments')[0].departmentID;
  const h = data.getEntity('Handouts').find((x) =>
    asList(x.departmentID).map(String).includes(String(dept)));
  const saved = h.departmentID;
  h.departmentID = [];
  eq(forms.handoutsForDepartment(dept).some((o) => String(o.value) === String(h.handoutID)), false,
    'blanked departments → out of the department picker (#368; was: everywhere)');
  eq(forms.handoutsForTask(null, null, null, dept)
    .some((o) => String(o.value) === String(h.handoutID)), false,
  'and out of the department-narrowed Inputs/Outputs picker');
  h.departmentID = saved;
  eq(forms.handoutsForDepartment(dept).some((o) => String(o.value) === String(h.handoutID)), true,
    'restored — offered again');
  eq(forms.handoutsForDepartment(null).length, data.getEntity('Handouts').length,
    'no department selected = every handout (lenient CONTEXT, unchanged)');
}

console.log('== processes: an undeclared coverage list covers nothing ==');
{
  const pr = data.getEntity('Processes').find((p) => asList(p.productScopeID).length);
  const before = forms.productScopesForProcess(pr.processID).map((o) => String(o.value)).sort();
  eq(before.length > 0, true, `probe process ${pr.processID} covers ${before.length} scopes`);
  const saved = pr.productScopeID;
  pr.productScopeID = [];
  eq(forms.productScopesForProcess(pr.processID), [],
    'blanked coverage → the picker offers nothing (#368; was: the event fallback)');
  const scope = before[0];
  const ev = asList(pr.eventID)[0];
  eq(forms.ticketProcesses(ev, scope).map(String).includes(String(pr.processID)), false,
    'a chosen scope drops the undeclared process from the ticket dispatch');
  eq(forms.ticketProcesses(ev, null).map(String).includes(String(pr.processID)), true,
    'no chosen scope still keeps it (blank CONTEXT skips the dimension)');
  pr.productScopeID = saved;
  eq(forms.productScopesForProcess(pr.processID).map((o) => String(o.value)).sort(), before,
    'restored');
}

console.log('== competence: no procedure link = inert (covers nothing, not exercisable) ==');
{
  const noLink = { competenceID: 'CMP-TAIL', taskID: [] };
  eq(resolve.competenceRequirements(noLink), [],
    'no link, no stored set → covers NOTHING (#368; was: null = covers all)');
  eq(resolve.competenceExercisable(noLink), false,
    'no link → NOT exercisable (nothing to exercise)');
  eq(resolve.competenceRequirements({ competenceID: 'CMP-TAIL2', requirementID: ['RQ01'] }),
    ['RQ01'], 'a legacy stored requirement set stays honoured (explicit data)');
  // live probe: unlink a certified competence — its holder must drop from
  // the task's Users column until re-linked
  const task = data.getEntity('Tasks').find((t) => resolve.certifiedUsersForTask(t.taskID).length);
  const before = resolve.certifiedUsersForTask(task.taskID).sort();
  const ob = data.getEntity('Onboarding').find((o) => o.isCertified === true
    && asList(o.competenceID).some((cid) => {
      const c = data.getById('Competence', cid);
      return c && asList(c.taskID).length === 0 || (c && asList(c.taskID).map(String).includes(String(task.taskID)));
    }));
  const comp = asList(ob.competenceID).map((cid) => data.getById('Competence', cid))
    .find((c) => c && (asList(c.taskID).length === 0
      || asList(c.taskID).map(String).includes(String(task.taskID))));
  const saved = comp.procedureID;
  comp.procedureID = [];
  eq(resolve.competenceExercisable(comp), false, 'unlinked live → inert');
  comp.procedureID = saved;
  eq(resolve.certifiedUsersForTask(task.taskID).sort(), before, 'restored — eligibility intact');
}

console.log('== migration census: every tail key declared, chain invariants hold ==');
{
  eq(data.getEntity('Processes').filter((p) => !asList(p.productScopeID).length).length, 0,
    'every process declares its coverage (6/6 materialized from the event sets)');
  eq(data.getEntity('Handouts').filter((h) => !asList(h.departmentID).length).length, 0,
    'every handout declares its departments');
  eq(data.getEntity('Competence').filter((c) => !asList(c.procedureID).length).length, 0,
    'every clinic competence keeps a procedure group (0/28 were unlinked)');
  let withInputs = 0;
  for (const t of data.getEntity('Tickets')) {
    if (resolve.ticketInputHandouts(t).length) withInputs += 1;
  }
  eq(withInputs, 137, 'TICKET-INPUTS census preserved (137/160 — the 0-flip census rode here)');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
