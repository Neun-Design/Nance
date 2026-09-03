#!/usr/bin/env node
// test_engine_task_indentation.mjs — proof suite for issue #302 (schema v66):
// (1) Tasks gain a stored self-referential predecessorTask (nullable FK; no
// constrain dimension — every task link is start-to-finish) and a DERIVED
// taskIndentationID: the workflow step's STEPORDER indentation padded to two
// segments ("1" → "1.0") + the task's sequence within the SAME step by the
// predecessor chain ("1.0.1", "1.1.2", "2.0.1" — the issue's example table).
// A predecessor in ANOTHER step never sub-numbers (the counter restarts per
// step, the issue's T04). (2) Every Tasks subitem context orders by it
// (Workflows subitem, Tickets Tasks tab). (3) The Predecessor Task form
// select offers the tasks of the selected Process (generic cascade — the
// #274 dead-cascade spelling holds) with PK values (self-ref guard). (4) The
// authored procedureStatus enum is absorbed (house ENUM/enum spelling,
// Status field, demo rows Approved).
// Run from prototype/:  node tools/test_engine_task_indentation.mjs

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

const taskIndent = (row) =>
  resolve.derivedValue('Tasks', catalog['Tasks'].byName['taskIndentationID'], row);

console.log('== schema: predecessorTask + taskIndentationID (v66) ==');
{
  eq(model.getSchemaVersion() >= 66, true, 'schemaVersion bumped to at least 66');
  const pred = catalog['Tasks'].byName['predecessorTask'];
  eq([pred.type, pred.constraints], ['FK', 'FK'],
    'predecessorTask is a stored nullable FK (no NOT NULL — process roots)');
  eq(model.parseRule(pred.rule).target, 'Tasks', 'self-referential target');
  const ind = catalog['Tasks'].byName['taskIndentationID'];
  eq(ind.type, 'computed', 'taskIndentationID is derived, never stored');
  const r = model.parseRule(ind.rule);
  eq([r.kind, r.predField, r.stepField], ['taskorder', 'predecessorTask', 'workflowID'],
    'TASKORDER(predecessorTask, workflowID) parses');
  eq([ind['table-display'], ind['subitem-display']], [true, true],
    'outline number visible in table and subitem contexts');
  // stored key present on every row (parity — migrate_task_indentation.py)
  const rows = data.getEntity('Tasks');
  eq(rows.every((t) => 'predecessorTask' in t), true,
    `every task carries the predecessorTask key (${rows.length} rows)`);
  eq(rows.every((t) => t.predecessorTask == null
    || (data.getById('Tasks', t.predecessorTask) || {}).processID === t.processID), true,
    'every seeded predecessor is a task of the SAME process');
}

console.log('== the issue #302 example table, synthesized ==');
{
  // Workflows: A01 → 1, A02 (A01, finish-to-finish) → 1.1, A03 (A01,
  // start-to-finish) → 2; Tasks: T01@A01 (no pred) → 1.0.1, T02@A02 (T01)
  // → 1.1.1, T03@A02 (T02) → 1.1.2, T04@A03 (T03, OTHER step) → 2.0.1
  data.addRecord('Workflows', { workflowID: 'WX302-1', processID: 'PX302',
    activityID: null, parentStepID: null, indentationRule: null });
  data.addRecord('Workflows', { workflowID: 'WX302-2', processID: 'PX302',
    activityID: null, parentStepID: 'WX302-1', indentationRule: 'finish-to-finish' });
  data.addRecord('Workflows', { workflowID: 'WX302-3', processID: 'PX302',
    activityID: null, parentStepID: 'WX302-1', indentationRule: 'start-to-finish' });
  const t = (id, wf, pred) => data.addRecord('Tasks',
    { taskID: id, processID: 'PX302', workflowID: wf, predecessorTask: pred });
  const [t1, t2, t3, t4] = [t('TX302-1', 'WX302-1', null),
    t('TX302-2', 'WX302-2', 'TX302-1'), t('TX302-3', 'WX302-2', 'TX302-2'),
    t('TX302-4', 'WX302-3', 'TX302-3')];
  eq(taskIndent(t1), '1.0.1', 'T01: single-digit step pads .0, seq restarts (1.0.1)');
  eq(taskIndent(t2), '1.1.1', 'T02: sub-numbered step keeps its depth (1.1.1)');
  eq(taskIndent(t3), '1.1.2', 'T03: predecessor in the SAME step increments (1.1.2)');
  eq(taskIndent(t4), '2.0.1', 'T04: predecessor in ANOTHER step never sub-numbers (2.0.1)');
  data.removeRecords('Tasks', ['TX302-1', 'TX302-2', 'TX302-3', 'TX302-4']);
  data.removeRecords('Workflows', ['WX302-1', 'WX302-2', 'WX302-3']);
}

console.log('== live-census: derived values match an independent chain walk ==');
{
  // independent seq: walk the per-step predecessor chain (STEPORDER itself
  // is proven by the pinned indentation suite — only the TASKORDER layer
  // re-derives here)
  const tasks = data.getEntity('Tasks');
  let checked = 0; let bad = 0;
  for (const task of tasks) {
    const wf = data.getById('Workflows', task.workflowID);
    if (!wf) continue;
    const wfAttr = catalog['Workflows'].byName['indentationID'];
    let base = String(resolve.derivedValue('Workflows', wfAttr, wf));
    if (!base.includes('.')) base += '.0';
    const step = tasks.filter((x) => String(x.workflowID) === String(task.workflowID));
    const ids = new Set(step.map((x) => String(x.taskID)));
    let seq = 0; let cur = task;
    while (cur) {
      seq += 1;
      cur = ids.has(String(cur.predecessorTask)) ? step.find(
        (x) => String(x.taskID) === String(cur.predecessorTask)) : null;
    }
    checked += 1;
    if (taskIndent(task) !== `${base}.${seq}`) {
      bad += 1;
      fail(`${task.taskID}: got ${taskIndent(task)}, want ${base}.${seq}`);
    }
  }
  eq([checked > 0, bad], [true, 0], `full census matches (${checked} tasks)`);
}

console.log('== subitem ordering: every Tasks context sorts by the outline ==');
{
  const wfSub = catalog['Workflows'].subitems[0];
  eq([wfSub.table, wfSub.orderBy], ['Tasks', 'taskIndentationID'],
    'Workflows subitem ordered by taskIndentationID');
  const tkSub = catalog['Tickets'].subitems.find((s) => s.table === 'Tasks');
  eq([tkSub.orderBy, tkSub.via], ['taskIndentationID', 'processID'],
    'Tickets Tasks tab keeps its via and gains the order');
  // the sort must BITE: reverse the store, resolve, assert ascending anyway
  const ticket = data.getEntity('Tickets').find((tk) => {
    const kids = resolve.childrenOf('Tickets', tk, 'Tasks', { via: 'processID' });
    return kids.length > 2;
  });
  eq(ticket != null, true, `probe ticket found (${ticket && ticket.ticketID})`);
  const arr = data.getEntity('Tasks');
  arr.reverse();
  const kids = resolve.childrenOf('Tickets', ticket, 'Tasks',
    { via: 'processID', orderBy: 'taskIndentationID' });
  arr.reverse();
  const vals = kids.map((k) => taskIndent(k));
  const sorted = [...vals].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  eq(vals, sorted, `ticket tab rows ascend by outline even from a reversed store (${vals.length} rows)`);
}

console.log('== form: Predecessor Task select (generic Process cascade) ==');
{
  const f = catalog['Tasks'].form.fields['Predecessor Task'];
  eq(f && f.attribute, 'predecessorTask', 'field bound to the stored FK');
  eq(f.check, 'Process IS NOT NULL', 'gated on Process');
  // the #274 trap: only the "filtered by … selected" spelling wires listeners
  eq(/filtered by (?:the )?[A-Za-z .+&,]+?(?: selected| field|$)/i.test(String(f['field-rule'])),
    true, 'field-rule matches the cascade regex (dead-cascade regression)');
  const { options, target } = forms.optionsForAttr('Tasks', 'predecessorTask', '');
  eq(target, 'Tasks', 'options come from Tasks (self-referential)');
  eq(options.length, data.getEntity('Tasks').length,
    'parentless rows do NOT vanish (self-ref guard — the empty Parent Step bug)');
  eq(options.every((o) => data.getById('Tasks', o.value) != null), true,
    'option values are task PKs, labels task names (no name-mirror binding)');
}

console.log('== procedureStatus absorbed (authored enum, house spelling) ==');
{
  const a = catalog['Procedures'].byName['procedureStatus'];
  eq(a.type, 'ENUM', 'type normalized to the house ENUM spelling');
  eq(model.parseRule(a.rule).values, ['Approved', 'In Progress', 'To Do'],
    'enum rule parses its three values');
  const f = catalog['Procedures'].form.fields['Status'];
  eq(f && f.attribute, 'procedureStatus', 'Status field bound');
  const { options } = forms.optionsForAttr('Procedures', 'procedureStatus', a.rule);
  eq(options.map((o) => o.value), ['Approved', 'In Progress', 'To Do'],
    'select offers the fixed enum options');
  const rows = data.getEntity('Procedures');
  eq(rows.every((p) => p.procedureStatus === 'Approved'), true,
    `demo SOPs seed Approved (${rows.length} rows — in use, honest status)`);
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
