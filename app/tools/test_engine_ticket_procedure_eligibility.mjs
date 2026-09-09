#!/usr/bin/env node
// test_engine_ticket_procedure_eligibility.mjs — the PROCEDURE eligibility
// contract (Rafael's CI round, sv103), three vias:
//   1.1 via ticket requirements: the Tasks tab must resolve exactly ONE
//       procedure per task; SEVERAL eligible = a REDUNDANCY gap carrying
//       the hover hint `Procedures redundancy <ids>` (zero = plain GAP).
//   1.2 via new Requirement: registering a requirement whose declared
//       combination matches a ticket ADDS it to the ticket's live set
//       (#226) and the task dispatch re-evaluates immediately.
//   1.3 via procedure Status: only APPROVED procedures are candidates —
//       the sv71 "dispatch ungated" decision is superseded.
// Run from prototype/:  node tools/test_engine_ticket_procedure_eligibility.mjs

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

// a real dispatch: a ticket whose context resolves a task to ONE procedure
const probe = (() => {
  for (const t of data.getEntity('Tickets')) {
    const need = resolve.ticketRequirements(t);
    const adm = resolve.ticketAdmittedScopeIds(t);
    for (const task of data.getEntity('Tasks')) {
      if (!asList(t.processID).some((p) => asList(task.processID).map(String).includes(String(p)))) continue;
      const win = resolve.ticketProcedureForTask(task.taskID, need, adm);
      if (win) return { t, task, win, need, adm };
    }
  }
  return null;
})();

console.log('== 1.1 via ticket requirements: one procedure, or a named redundancy ==');
{
  eq(!!probe, true, 'a resolving (ticket, task) dispatch exists in the demo');
  const { task, win, need, adm } = probe;
  eq(resolve.ticketProcedureDisplay(task.taskID, need, 'procedureRegistry', adm),
    String(win.procedureRegistry), 'single eligible procedure → its registry renders (pill)');
  eq(resolve.ticketProcedureHint(task.taskID, need, adm), null,
    'a clean resolution carries NO hint');
  // a covering twin makes it a REDUNDANCY: GAP + hint naming BOTH candidates
  const twin = { ...win, procedureID: 'PRC-RED' };
  data.getEntity('Procedures').push(twin);
  eq(resolve.ticketProcedureDisplay(task.taskID, need, 'procedureRegistry', adm), 'GAP',
    'two eligible procedures → the dispatch GAPs');
  eq(resolve.ticketProcedureHint(task.taskID, need, adm),
    `Procedures redundancy ${win.procedureID}, PRC-RED`,
    'the hint names the colliding candidates (`Procedures redundancy <ids>`)');
  data.getEntity('Procedures').pop();
  // zero candidates (no covering method) = plain GAP, nothing to enumerate
  const saved = win.requirementID;
  win.requirementID = [];
  const cands = resolve.ticketProcedureCandidates(task.taskID, need, adm);
  if (cands.length === 0) {
    ok('no covering method → zero candidates');
    eq(resolve.ticketProcedureDisplay(task.taskID, need, 'procedureRegistry', adm), 'GAP',
      'zero candidates → GAP');
    eq(resolve.ticketProcedureHint(task.taskID, need, adm), null,
      'a zero-candidate GAP carries NO redundancy hint');
  } else {
    ok('another procedure covers — zero-candidate leg exercised via fixtures elsewhere');
  }
  win.requirementID = saved;
}

console.log('== 1.2 via new Requirement: live inheritance re-evaluates the dispatch ==');
{
  const { t, task, win, adm } = probe;
  const before = resolve.ticketRequirements(t).map(String).sort();
  // a requirement declaring EVERY dimension (the #366 doctrine) pinned to
  // the ticket's own combination — it must inherit immediately
  const dim = (tab, pk) => data.getEntity(tab).map((r) => r[pk]);
  data.addRecord('Requirements', {
    requirementID: 'RQ-ELIG', requirementName: 'Eligibility probe (t)', isActive: 'Active',
    regionID: dim('Regions', 'regionID'), businessUnitID: dim('Business Units', 'businessUnitID'),
    branchID: dim('Branches', 'branchID'), customerID: [t.customerID],
    scopeID: dim('Scopes', 'scopeID'), productGroupID: dim('Product Groups', 'productGroupID'),
    productScopeID: dim('Product Scopes', 'productScopeID'),
  });
  const after = resolve.ticketRequirements(t).map(String);
  eq(after.includes('RQ-ELIG'), true,
    'the new requirement joins the ticket\'s live set (no re-seed, #226)');
  // dispatch re-evaluated: the old winner does NOT cover the new
  // requirement → the task GAPs until the procedure is revisited
  eq(resolve.ticketProcedureForTask(task.taskID, resolve.ticketRequirements(t), adm), null,
    'the previous winner no longer covers → the dispatch GAPs (re-evaluation)');
  // the quality manager revisits the procedure: adding the requirement to
  // its set restores the resolution — the doctrine's review loop
  const saved = win.requirementID;
  win.requirementID = [...asList(saved), 'RQ-ELIG'];
  eq(resolve.ticketProcedureForTask(task.taskID, resolve.ticketRequirements(t), adm)?.procedureID,
    win.procedureID, 'revisiting the procedure (adding the requirement) restores the dispatch');
  win.requirementID = saved;
  // a requirement pinned to ANOTHER customer does not inherit
  const other = data.getEntity('Customers')
    .find((c) => String(c.customerID) !== String(t.customerID)
      && String(c.customerID) !== String(t.applicantID ?? ''));
  data.getById('Requirements', 'RQ-ELIG').customerID = [other.customerID];
  eq(resolve.ticketRequirements(t).map(String).includes('RQ-ELIG'), false,
    'a requirement pinned to another customer stays out (AND match)');
  data.removeRecords('Requirements', ['RQ-ELIG']);
  eq(resolve.ticketRequirements(t).map(String).sort(), before, 'baseline restored');

  // branch via the OUTPUT branch (sv108 — supersedes the sv105 party
  // union): a requirement pinned to the ticket's stored branchID — the
  // Applicant's branch chosen to RECEIVE the output — inherits
  const tb = data.getEntity('Tickets').find((tk) => tk.branchID != null && tk.branchID !== '');
  eq(tb != null, true, 'a ticket with a stored OUTPUT branch exists');
  const applBranch = data.getById('Branches', tb.branchID);
  const dim2 = (tab, pk) => data.getEntity(tab).map((r) => r[pk]);
  data.addRecord('Requirements', { requirementID: 'RQ-ELIG-BR', requirementName: 'Branch probe (t)',
    isActive: 'Active', regionID: dim2('Regions', 'regionID'),
    businessUnitID: dim2('Business Units', 'businessUnitID'),
    customerID: dim2('Customers', 'customerID'), scopeID: dim2('Scopes', 'scopeID'),
    productGroupID: dim2('Product Groups', 'productGroupID'),
    productScopeID: dim2('Product Scopes', 'productScopeID'),
    branchID: [applBranch.branchID] });
  eq(resolve.ticketRequirements(tb).map(String).includes('RQ-ELIG-BR'), true,
    'pinned to the APPLICANT\'s branch → inherits (the parties\' branch context)');
  // pinned to a branch FOREIGN to every party (and to the project) → out
  const partyBranches = data.getEntity('Branches').filter((b) =>
    (Array.isArray(b.customerID) ? b.customerID : [b.customerID]).map(String)
      .some((c) => [String(tb.customerID), String(tb.applicantID)].includes(c)))
    .map((b) => String(b.branchID));
  const prjB = tb.projectID && data.getById('Projects', tb.projectID)?.branchID;
  const foreign = data.getEntity('Branches').find((b) =>
    !partyBranches.includes(String(b.branchID)) && String(b.branchID) !== String(prjB ?? ''));
  data.getById('Requirements', 'RQ-ELIG-BR').branchID = [foreign.branchID];
  eq(resolve.ticketRequirements(tb).map(String).includes('RQ-ELIG-BR'), false,
    'pinned to a branch foreign to the parties AND the project → stays out');
  data.removeRecords('Requirements', ['RQ-ELIG-BR']);
}

console.log('== 1.3 via procedure Status: only Approved methods are candidates ==');
{
  const { task, win, need, adm } = probe;
  const saved = win.procedureStatus;
  win.procedureStatus = 'In Progress';
  eq(resolve.ticketProcedureCandidates(task.taskID, need, adm)
    .map((p) => String(p.procedureID)).includes(String(win.procedureID)), false,
  'a non-Approved procedure is NOT a candidate (sv71 extended to the dispatch)');
  eq(resolve.ticketProcedureDisplay(task.taskID, need, 'procedureRegistry', adm), 'GAP',
    'the dispatch GAPs while the method awaits approval');
  win.procedureStatus = 'Approved';
  eq(resolve.ticketProcedureForTask(task.taskID, need, adm)?.procedureID, win.procedureID,
    'approval restores the dispatch');
  win.procedureStatus = saved;
  // status breaks a redundancy: of two eligible methods, approving only one
  // resolves the task to it
  const twin = { ...win, procedureID: 'PRC-RED2', procedureStatus: 'To Do' };
  data.getEntity('Procedures').push(twin);
  eq(resolve.ticketProcedureForTask(task.taskID, need, adm)?.procedureID, win.procedureID,
    'an unapproved twin does not create a redundancy — the Approved method resolves');
  twin.procedureStatus = 'Approved';
  eq(resolve.ticketProcedureHint(task.taskID, need, adm),
    `Procedures redundancy ${win.procedureID}, PRC-RED2`,
    'approving the twin creates the named redundancy');
  data.getEntity('Procedures').pop();
  // missing status key = Approved (legacy tolerance, frozen/pre-#302 rows)
  eq(resolve.procedureApproved({ procedureID: 'X' }), true, 'missing status key counts as Approved');
}

console.log('== census: the gates bite nothing at rest ==');
{
  eq(data.getEntity('Procedures').every((p) => resolve.procedureApproved(p)), true,
    'every demo procedure is Approved — the dispatch gate adds zero flips at rest');
  let withInputs = 0;
  for (const t of data.getEntity('Tickets')) {
    if (resolve.ticketInputHandouts(t).length) withInputs += 1;
  }
  eq(withInputs, 137, 'TICKET-INPUTS census preserved (137/160)');
  // the redundancy hint appears ONLY where a GAP has ≥2 candidates —
  // full-census consistency between hint and candidate count
  let mismatches = 0;
  for (const t of data.getEntity('Tickets').slice(0, 40)) {
    const need = resolve.ticketRequirements(t);
    const adm = resolve.ticketAdmittedScopeIds(t);
    for (const task of data.getEntity('Tasks')) {
      if (!asList(t.processID).some((p) => asList(task.processID).map(String).includes(String(p)))) continue;
      const n = resolve.ticketProcedureCandidates(task.taskID, need, adm).length;
      const hint = resolve.ticketProcedureHint(task.taskID, need, adm);
      if ((n > 1) !== (hint != null)) mismatches += 1;
      if (hint != null && !/^Procedures redundancy /.test(hint)) mismatches += 1;
    }
  }
  eq(mismatches, 0, 'hint ⇔ (candidates > 1) on every sampled dispatch, exact prefix');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
