#!/usr/bin/env node
// test_engine_procedure_scope_gate.mjs — unit-test the procedure scope gate
// (issue #332): Procedures.productScopeID gates the ticket→procedure match
// DIRECTLY — with a ticket scope context, a procedure pinned to scopes must
// name at least one scope the ticket admits (empty key = every scope, Q1);
// an empty context array skips the dimension (the multiViaJoin blank-context
// posture) and a null context (task-level fallback, standalone Tasks drawer)
// is ungated. Demo seeds re-aligned by migrate_procedure_scope_gate.py
// (stored ∪ task→process→event payload-packaged scopes, #281 posture):
// census preserved — 0 dispatch flips, 137/160 tickets keep their inputs.
// Run from prototype/:  node tools/test_engine_procedure_scope_gate.mjs

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
const asList = (v) => (Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]));

const dm = JSON.parse(fs.readFileSync('data/datamodel.json', 'utf-8'));

console.log('== schema: sv80, the gate is documented on the key ==');
{
  eq(dm._meta.schemaVersion >= 80, true, `schemaVersion ${dm._meta.schemaVersion} >= 80`);
  const a = catalog['Procedures'].byName['productScopeID'];
  eq(!!a, true, 'Procedures.productScopeID exists');
  eq(/#332/.test(a?.notes || ''), true, 'the notes document the #332 gate');
}

console.log('== helper: ticketAdmittedScopeIds is the shared scope context ==');
{
  eq(typeof resolve.ticketAdmittedScopeIds, 'function', 'exported from resolve.js');
  eq(resolve.ticketAdmittedScopeIds(null), [], 'null-safe');
  const tickets = data.getEntity('Tickets');
  // equals the admitted payload-chain set ∩ the chosen scope, per ticket
  let agree = 0;
  for (const t of tickets) {
    let want = resolve.admittedProductScopeIds(t.eventID, t);
    const chosen = asList(t.productScopeID);
    if (chosen.length) want = want.filter((id) => chosen.includes(id));
    if (JSON.stringify(resolve.ticketAdmittedScopeIds(t)) === JSON.stringify(want)) agree += 1;
  }
  eq(agree, tickets.length, `admitted ∩ chosen agreement on all ${tickets.length} tickets`);
}

// a ticket whose winner procedure carries a NON-EMPTY scope key — the gate's
// live-edit subject (state restored after every block)
const tickets = data.getEntity('Tickets');
const tasks = data.getEntity('Tasks');
const subject = (() => {
  for (const t of tickets) {
    const need = resolve.ticketRequirements(t);
    const adm = resolve.ticketAdmittedScopeIds(t).map(String);
    if (!adm.length) continue;
    const procIds = asList(t.processID).map(String);
    for (const task of tasks) {
      if (!asList(task.processID).map(String).some((p) => procIds.includes(p))) continue;
      const win = resolve.ticketProcedureForTask(task.taskID, need, adm);
      if (win && asList(win.productScopeID).length) return { t, task, win, need, adm };
    }
  }
  return null;
})();

console.log('== gate semantics (live edit on a real dispatch) ==');
{
  eq(!!subject, true, 'a scope-pinned winning dispatch exists in the demo');
  const { task, win, need, adm } = subject;
  const saved = win.productScopeID;
  const foreign = data.getEntity('Product Scopes')
    .map((ps) => String(ps.productScopeID)).filter((id) => !adm.includes(id)).slice(0, 1);
  eq(foreign.length, 1, 'a scope the ticket does NOT admit exists');
  win.productScopeID = foreign;
  eq(resolve.ticketProcedureForTask(task.taskID, need, adm), null,
    'procedure pinned to a foreign scope is no candidate — the dispatch GAPs');
  eq(resolve.ticketProcedureForTask(task.taskID, need, null)?.procedureID, win.procedureID,
    'null context (task-level fallback) stays ungated — the foreign pin still matches');
  eq(resolve.ticketProcedureForTask(task.taskID, need, [])?.procedureID, win.procedureID,
    'EMPTY context array skips the dimension (multiViaJoin blank-context posture)');
  win.productScopeID = [];
  eq(resolve.ticketProcedureForTask(task.taskID, need, adm)?.procedureID, win.procedureID,
    'empty procedure key = every scope (Q1 wildcard) — the match returns');
  win.productScopeID = saved;
  eq(resolve.ticketProcedureForTask(task.taskID, need, adm)?.procedureID, win.procedureID,
    'restored state matches again');
}

console.log('== threading: display + inputs + app accessor carry the context ==');
{
  const { t, task, win, need, adm } = subject;
  const saved = win.productScopeID;
  eq(resolve.ticketProcedureDisplay(task.taskID, need, 'procedureRegistry', adm),
    String(win.procedureRegistry), 'ticketProcedureDisplay resolves with the scope context');
  const foreign = data.getEntity('Product Scopes')
    .map((ps) => String(ps.productScopeID)).filter((id) => !adm.includes(id)).slice(0, 1);
  win.productScopeID = foreign;
  eq(resolve.ticketProcedureDisplay(task.taskID, need, 'procedureRegistry', adm), 'GAP',
    'the display GAPs under the gate');
  const before = resolve.ticketInputHandouts(t).map((h) => String(h.handoutID));
  win.productScopeID = saved;
  const after = resolve.ticketInputHandouts(t).map((h) => String(h.handoutID));
  eq(before.length <= after.length, true,
    'ticketInputHandouts rides the gate — a foreign pin never ADDS inputs');
  const appSrc = fs.readFileSync('js/app.js', 'utf-8');
  eq(/ticketprocedure[\s\S]{0,400}ticketAdmittedScopeIds\(ticket\)/.test(appSrc), true,
    'the ticket-context accessor passes ticketAdmittedScopeIds (app.js)');
  eq(appSrc.split('\n').some((l) => l.startsWith('import ')
    && /ticketAdmittedScopeIds/.test(l)), true, 'app.js imports the helper');
}

console.log('== census: the re-seed preserves every pre-gate dispatch (#281) ==');
{
  const procs = data.getEntity('Procedures');
  const preGate = (taskId, needS) => {
    const hits = procs.filter((p) => String(p.taskID) === String(taskId))
      .filter((p) => {
        const s = asList(p.requirementID).map(String);
        return !s.length || needS.every((r) => s.includes(r));
      });
    return hits.length === 1 ? hits[0] : null;
  };
  let pairs = 0; let flips = 0; let withInputs = 0;
  for (const t of tickets) {
    const needS = resolve.ticketRequirements(t).map(String);
    const adm = resolve.ticketAdmittedScopeIds(t).map(String);
    const procIds = asList(t.processID).map(String);
    for (const task of tasks) {
      if (!asList(task.processID).map(String).some((p) => procIds.includes(p))) continue;
      pairs += 1;
      const o = preGate(task.taskID, needS);
      const n = resolve.ticketProcedureForTask(task.taskID, needS, adm);
      if ((o && o.procedureID) !== (n && n.procedureID)) flips += 1;
    }
    if (resolve.ticketInputHandouts(t).length) withInputs += 1;
  }
  eq(flips, 0, `0 dispatch flips across ${pairs} (ticket, task) pairs`);
  eq(withInputs, 137, '137/160 tickets keep their customer inputs (#324 census)');
  // migration invariant: every resolving winner names an admitted scope or
  // wildcards — the gate never fires at rest (it bites on UI edits only)
  eq(procs.every((p) => 'productScopeID' in p), true,
    'every demo procedure carries the scope key');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
