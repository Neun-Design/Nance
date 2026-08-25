#!/usr/bin/env node
// test_engine_ticket_procedure.mjs — unit-test the ticket-related procedure
// resolution (issue #270): inside a Ticket's Tasks tab the new Procedure
// column narrows each task's procedures by the ticket's inherited requirement
// set with AND semantics (coverage, the certifiedUsersForTask posture — an
// empty procedure set is the Q1 wildcard). Exactly one candidate renders its
// procedureRegistry; zero or several render the GAP tag. Task-level fallback
// (standalone drawer, no context): unique procedure or GAP.
// Run from prototype/:  node tools/test_engine_ticket_procedure.mjs

import fs from 'fs';
// Pinned to the FROZEN transformer reference dataset (F3, Vitalis swap):
// synthetic (t) rows are layered on top — no dependence on demo procedures.
globalThis.__MOCKUP_PATH__ = 'tools/testdata/mockup_transformers.json';

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

const attr = catalog['Tasks'].byName['procedureRegistry'];

console.log('== schema: the Procedure column on the ticket Tasks tab ==');
{
  const rule = model.parseRule(attr.rule);
  eq([rule.kind, rule.srcField, rule.display], ['ticketprocedure', 'taskID', 'procedureRegistry'],
    'TICKET-PROCEDURE rule parses (srcField + display)');
  eq([attr['subitem-display'], attr['table-display'], attr.type],
    [true, false, 'mirror'], 'subitem-only, derived (validator-safe mirror type)');
  const col = model.columnsFor('Tasks', 'sub').find((c) => c.key === 'procedureRegistry');
  eq([col.label, !!col.derived], ['Procedure', true],
    'column titled "Procedure" (display-name override) and render-time derived');
}

// synthetic fixtures: a task with two requirement-specific procedures
data.addRecord('Tasks', { taskID: 'TSK-TP', taskName: 'Proc Task (t)', processID: 'PR1' });
data.addRecord('Procedures', { procedureID: 'PROC-TPA', procedureRegistry: 'PROC-TPA (t)',
  taskID: 'TSK-TP', requirementID: ['RQ-P1'] });
data.addRecord('Procedures', { procedureID: 'PROC-TPB', procedureRegistry: 'PROC-TPB (t)',
  taskID: 'TSK-TP', requirementID: ['RQ-P1', 'RQ-P2'] });

console.log('== AND coverage narrows to a single procedure ==');
{
  const p = resolve.ticketProcedureForTask('TSK-TP', ['RQ-P1', 'RQ-P2']);
  eq(p && p.procedureID, 'PROC-TPB',
    'the full pair is covered only by the two-requirement procedure');
  eq(resolve.ticketProcedureDisplay('TSK-TP', ['RQ-P1', 'RQ-P2']), 'PROC-TPB (t)',
    'display renders the unique procedureRegistry');
  eq(resolve.ticketProcedureForTask('TSK-TP', ['RQ-P1']), null,
    'a subset both procedures cover is ambiguous (AND filters candidates, not OR)');
  eq(resolve.ticketProcedureDisplay('TSK-TP', ['RQ-P1']), 'GAP', 'ambiguity renders GAP');
  eq(resolve.ticketProcedureDisplay('TSK-TP', ['RQ-PX']), 'GAP',
    'an uncovered requirement renders GAP (no candidate)');
  eq(resolve.ticketProcedureDisplay('TSK-TP', []), 'GAP',
    'no context + several procedures = GAP (task-level fallback)');
}

console.log('== Q1 wildcard and degenerate inputs ==');
{
  data.addRecord('Tasks', { taskID: 'TSK-TW', taskName: 'Wildcard Task (t)', processID: 'PR1' });
  data.addRecord('Procedures', { procedureID: 'PROC-TWW', procedureRegistry: 'PROC-TWW (t)',
    taskID: 'TSK-TW', requirementID: [] });
  eq(resolve.ticketProcedureDisplay('TSK-TW', ['RQ-P1', 'RQ-P2']), 'PROC-TWW (t)',
    'a lone wildcard procedure covers any combination (Q1)');
  data.addRecord('Procedures', { procedureID: 'PROC-TWS', procedureRegistry: 'PROC-TWS (t)',
    taskID: 'TSK-TW', requirementID: ['RQ-P1'] });
  eq(resolve.ticketProcedureDisplay('TSK-TW', ['RQ-P1']), 'GAP',
    'wildcard + specific procedure both cover = genuine ambiguity, GAP');
  data.addRecord('Tasks', { taskID: 'TSK-TN', taskName: 'Bare Task (t)', processID: 'PR1' });
  eq(resolve.ticketProcedureDisplay('TSK-TN', ['RQ-P1']), 'GAP',
    'a task with no procedures renders GAP');
  eq(resolve.ticketProcedureDisplay(null, ['RQ-P1']), 'GAP', 'null task renders GAP');
}

console.log('== derivedValue fallback (standalone Tasks, no ticket context) ==');
{
  data.addRecord('Tasks', { taskID: 'TSK-TS', taskName: 'Single Task (t)', processID: 'PR1' });
  data.addRecord('Procedures', { procedureID: 'PROC-TSS', procedureRegistry: 'PROC-TSS (t)',
    taskID: 'TSK-TS', requirementID: ['RQ-P9'] });
  const one = data.getById('Tasks', 'TSK-TS');
  eq(String(resolve.derivedValue('Tasks', attr, one)), 'PROC-TSS (t)',
    'a single-procedure task renders its registry without context');
  const many = data.getById('Tasks', 'TSK-TP');
  eq(String(resolve.derivedValue('Tasks', attr, many)), 'GAP',
    'a multi-procedure task renders GAP without context');
}

console.log('== demo regression: migrate_procedures seeded one procedure per task ==');
{
  // every demo task with procedures resolves task-level to a registry (the
  // one-procedure-per-task seed) — GAP only where a task chains none
  const withProcs = data.getEntity('Tasks')
    .filter((t) => !String(t.taskID).startsWith('TSK-T'))
    .filter((t) => data.getEntity('Procedures').some((p) => String(p.taskID) === String(t.taskID)));
  const bad = withProcs.filter((t) => resolve.ticketProcedureDisplay(t.taskID) === 'GAP');
  eq(bad.length, 0, `all ${withProcs.length} demo tasks with procedures resolve task-level`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
