#!/usr/bin/env node
// test_engine_ticket_task_columns.mjs — proof suite for the Ticket Tasks tab
// columns round (2026-09-04, schema v75): the ticket Tasks tab restores the
// eligible USERS column (#233 ticket-contextual CERTIFIED-USERS, hidden
// globally by the #299 authored edit) and gains an EXECUTION TIME column —
// the time of the procedure the ticket's requirement context resolves for
// each task (#270 TICKET-PROCEDURE with display re-pointed to executionTime;
// time lives per procedure, the 2026-08-04 doctrine). Both ride the new
// per-tab "tab-columns" spec parameter (normalizeSubitem in model.js +
// mapSubitem append in app.js): the #299 global hide (subitem-display
// false) holds for every other context. Eligibility is verified end to end:
// certified-onboarding gate (#218 strict boolean), ticket-context coverage
// (#226 union), procedure-status gate (sv71).
// Run from prototype/:  node tools/test_engine_ticket_task_columns.mjs

import fs from 'fs';
globalThis.fetch = async (p) => new Response(fs.readFileSync(p));

const model = await import('../js/model.js');
const data = await import('../js/data.js');
const { catalog } = await model.loadModel();
data.initMeta(catalog);
await data.loadData();
const resolve = await import('../js/resolve.js');

let fails = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails += 1; console.log(`  ✗ ${m}`); };
const eq = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));
const asIds = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);

// (ticket, task) pairs of the demo, in ticket order
function* ticketTasks() {
  for (const tk of data.getEntity('Tickets')) {
    for (const pid of asIds(tk.processID)) {
      for (const task of data.getEntity('Tasks')) {
        if (String(task.processID) === String(pid)) yield [tk, task];
      }
    }
  }
}

console.log('== schema: the two columns and the tab-columns spec ==');
{
  eq(model.getSchemaVersion() >= 75, true, `schemaVersion ${model.getSchemaVersion()} >= 75`);
  const u = catalog['Tasks'].byName['userID'];
  eq(u['display-name'], 'Users', 'Users header override (the #271 Procedures pattern)');
  eq(u['subitem-display'], false, 'userID stays globally hidden (#299) — the tab re-adds it');
  const t = catalog['Tasks'].byName['procedureExecutionTime'];
  const r = model.parseRule(t.rule);
  eq([r.kind, r.srcField, r.display], ['ticketprocedure', 'taskID', 'executionTime'],
    'Execution Time rides the #270 TICKET-PROCEDURE resolution, display re-pointed');
  eq(t['display-name'], 'Execution Time', 'header override');
  eq(t['subitem-display'], false, 'globally hidden too — ticket-tab-only via tab-columns');
  const tab = catalog['Tickets'].subitems.find((si) => si.tab && si.tab.name === 'Tasks');
  eq(tab != null, true, 'the Tickets Tasks tab is declared');
  eq(tab.tabColumns, ['userID', 'procedureExecutionTime'],
    'tab-columns re-adds Users and Execution Time on THIS tab');
  eq(tab.orderBy, 'taskIndentationID', 'taskIndentationID ordering untouched (#302)');
  const wf = (catalog['Workflows'].subitems || []).find((si) => si.table === 'Tasks');
  eq(wf && wf.tabColumns, undefined, 'the Workflows Tasks subitem carries NO tab-columns — #299 holds there');
}

console.log('== wiring: the append and the display-keyed pill reach the DOM ==');
{
  const src = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  eq(/si\.tabColumns/.test(src), true, 'mapSubitem consumes tabColumns');
  const appendsBeforeOverrides = src.indexOf('si.tabColumns')
    < src.indexOf("parentEntity === 'Tickets'");
  eq(appendsBeforeOverrides, true,
    'columns append BEFORE the ticket-context override loop — accessors/pills attach to them');
  eq(/rule\.display === 'procedureRegistry'/.test(src), true,
    'pill keyed by display: registry pills the method, the time renders plain (GAP stays caution)');
}

console.log('== eligibility: the ticket-context Users column ==');
{
  let hit = null;
  for (const [tk, task] of ticketTasks()) {
    const users = resolve.certifiedUsersDisplay(task.taskID,
      resolve.ticketRequirements(tk), 'userName');
    if (users && users !== '—' && String(users).length) { hit = [tk, task, String(users)]; break; }
  }
  eq(!!hit, true, 'a staffed (ticket, task) pair exists in the demo');
  const [tk, task, users] = hit;
  const names = users.split(',').map((s) => s.trim());
  ok(`probe: ${tk.ticketID}/${task.taskID} → ${names.join(', ')}`);
  // every displayed user holds at least one CERTIFIED onboarding (#218 gate)
  const people = data.getEntity('People').filter((p) => names.includes(p.userName));
  eq(people.length, names.length, 'every displayed name is a real person');
  eq(people.every((p) => data.getEntity('Onboarding')
    .some((ob) => String(ob.userID) === String(p.userID) && ob.isCertified === true)),
  true, 'every displayed user holds a CERTIFIED onboarding (strict boolean gate)');
  // flip the certification off → the user drops (the onboarding gate bites)
  const person = people[0];
  const obs = data.getEntity('Onboarding')
    .filter((ob) => String(ob.userID) === String(person.userID) && ob.isCertified === true);
  obs.forEach((ob) => data.updateRecord('Onboarding', ob.onboardID, { isCertified: false }));
  const after = String(resolve.certifiedUsersDisplay(task.taskID,
    resolve.ticketRequirements(tk), 'userName'));
  eq(after.includes(person.userName), false,
    `de-certifying the onboarding drops ${person.userName} from the column`);
  obs.forEach((ob) => data.updateRecord('Onboarding', ob.onboardID, { isCertified: true }));
  const restored = String(resolve.certifiedUsersDisplay(task.taskID,
    resolve.ticketRequirements(tk), 'userName'));
  eq(restored.includes(person.userName), true, 're-certifying restores the eligibility');
}

console.log('== eligibility: the procedure-status gate (sv71) bites the column ==');
{
  let hit = null;
  for (const [tk, task] of ticketTasks()) {
    const users = resolve.certifiedUsersDisplay(task.taskID,
      resolve.ticketRequirements(tk), 'userName');
    const proc = resolve.ticketProcedureForTask(task.taskID, resolve.ticketRequirements(tk));
    if (users && users !== '—' && String(users).length && proc) { hit = [tk, task, proc]; break; }
  }
  eq(!!hit, true, 'a staffed pair with a resolved procedure exists');
  const [tk, task, proc] = hit;
  const before = String(resolve.certifiedUsersDisplay(task.taskID,
    resolve.ticketRequirements(tk), 'userName'));
  // flip EVERY procedure of the task to To Do — all competences go inert
  const procs = data.getEntity('Procedures').filter((p) => String(p.taskID) === String(task.taskID));
  const saved = procs.map((p) => [p.procedureID, p.procedureStatus]);
  procs.forEach((p) => data.updateRecord('Procedures', p.procedureID, { procedureStatus: 'To Do' }));
  const gated = String(resolve.certifiedUsersDisplay(task.taskID,
    resolve.ticketRequirements(tk), 'userName'));
  eq(gated.length === 0 || gated === '—', true,
    `un-approving the task's procedures empties the column (was "${before.slice(0, 40)}")`);
  const timeStill = resolve.ticketProcedureDisplay(task.taskID,
    resolve.ticketRequirements(tk), 'executionTime');
  eq(timeStill, String(proc.executionTime),
    'the Execution Time column still renders — #270 resolution deliberately ungated (#315)');
  saved.forEach(([id, st]) => data.updateRecord('Procedures', id, { procedureStatus: st }));
}

console.log('== execution time: the resolved procedure\'s time, GAP on ambiguity ==');
{
  let hit = null;
  for (const [tk, task] of ticketTasks()) {
    const proc = resolve.ticketProcedureForTask(task.taskID, resolve.ticketRequirements(tk));
    if (proc && proc.executionTime != null) { hit = [tk, task, proc]; break; }
  }
  const [tk, task, proc] = hit;
  const need = resolve.ticketRequirements(tk);
  eq(resolve.ticketProcedureDisplay(task.taskID, need, 'executionTime'),
    String(proc.executionTime),
    `resolved method's time renders (${proc.procedureRegistry} → ${proc.executionTime})`);
  // a second wildcard procedure makes the resolution ambiguous → GAP (#270)
  data.addRecord('Procedures', { procedureID: 'PRC-AMB', procedureRegistry: 'AMB-1',
    taskID: task.taskID, requirementID: [], executionTime: 99, procedureStatus: 'Approved' });
  eq(resolve.ticketProcedureDisplay(task.taskID, need, 'executionTime'), 'GAP',
    'ambiguous resolution renders GAP — same posture as the Procedure column');
  data.removeRecords('Procedures', ['PRC-AMB']);
  // census: the time column resolves wherever the Procedure column does
  let agree = true, n = 0;
  for (const [tk2, task2] of ticketTasks()) {
    if (n++ > 400) break;
    const need2 = resolve.ticketRequirements(tk2);
    const reg = resolve.ticketProcedureDisplay(task2.taskID, need2, 'procedureRegistry');
    const time = resolve.ticketProcedureDisplay(task2.taskID, need2, 'executionTime');
    if ((reg === 'GAP') !== (time === 'GAP')) { agree = false; break; }
  }
  eq(agree, true, 'Procedure and Execution Time columns agree on GAP row by row');
}

console.log('== standalone fallback: the Tasks drawer stays task-level ==');
{
  const t = catalog['Tasks'].byName['procedureExecutionTime'];
  const single = data.getEntity('Tasks').find((task) => data.getEntity('Procedures')
    .filter((p) => String(p.taskID) === String(task.taskID)).length === 1);
  const proc = data.getEntity('Procedures').find((p) => String(p.taskID) === String(single.taskID));
  eq(String(resolve.derivedValue('Tasks', t, single)), String(proc.executionTime),
    'no ticket context → the task-level unique procedure\'s time (the #270 fallback)');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
