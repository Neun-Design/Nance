#!/usr/bin/env node
// test_engine_gap_identification.mjs — unit-test GAP identification (issue
// #271): the system points at gaps without waiting for a nonconformity.
// (1) Procedures gain a derived Users column — holders of a CERTIFIED
// Onboarding on a competence bound to the procedure (strict association, no
// wildcard); nobody eligible = the GAP tag. (2) The Tasks Procedures rollup
// becomes a visible column — a task with no procedure = the GAP tag. Both
// render through the generic `gap-tag` attr flag (derivedValue wrapper).
// Run from prototype/:  node tools/test_engine_gap_identification.mjs

import fs from 'fs';
// Pinned to the FROZEN transformer reference dataset (F3, Vitalis swap):
// synthetic (t) rows are layered on top of known reference rows.
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

const usersAttr = catalog['Procedures'].byName['userID'];
const procsAttr = catalog['Tasks'].byName['procedureID'];

console.log('== schema: the two gap-tagged columns ==');
{
  const rule = model.parseRule(usersAttr.rule);
  eq([rule.kind, rule.srcField, rule.display], ['certifiedusers', 'procedureID', 'userName'],
    'Procedures.userID reuses the CERTIFIED-USERS kind with the procedure chain');
  eq([usersAttr['gap-tag'], usersAttr['display-name'], usersAttr.type],
    [true, 'Users', 'mirror'], 'Users column: gap-tagged, header override, validator-safe mirror');
  eq([procsAttr['gap-tag'], procsAttr['display-name'], procsAttr['table-display'],
    procsAttr['subitem-display']], [true, 'Procedures', true, false],
  'Tasks Procedures rollup: gap-tagged, plural header, visible in the main table only');
  const col = model.columnsFor('Tasks', 'table').find((c) => c.key === 'procedureID');
  eq([col.label, !!col.derived], ['Procedures', true], 'Tasks column resolves at render time');
}

// fixtures: a procedure with a certified holder, one with only an
// UNCERTIFIED holder, and one with no competence at all
data.addRecord('People', { userID: 'U-GA', userName: 'Certified Holder (t)' });
data.addRecord('People', { userID: 'U-GB', userName: 'Uncertified Holder (t)' });
data.addRecord('Tasks', { taskID: 'TSK-GA', taskName: 'Gap Task (t)', processID: 'PR1' });
data.addRecord('Procedures', { procedureID: 'PROC-GA', procedureRegistry: 'PROC-GA (t)',
  taskID: 'TSK-GA', requirementID: [] });
data.addRecord('Procedures', { procedureID: 'PROC-GB', procedureRegistry: 'PROC-GB (t)',
  taskID: 'TSK-GA', requirementID: [] });
data.addRecord('Procedures', { procedureID: 'PROC-GC', procedureRegistry: 'PROC-GC (t)',
  taskID: 'TSK-GA', requirementID: [] });
data.addRecord('Competence', { competenceID: 'CMP-GA', taskID: 'TSK-GA', procedureID: 'PROC-GA' });
data.addRecord('Competence', { competenceID: 'CMP-GB', taskID: 'TSK-GA', procedureID: 'PROC-GB' });
data.addRecord('Competence', { competenceID: 'CMP-GW', taskID: 'TSK-GA' }); // no procedure
// group onboarding (#239): the certified competence sits inside an array
data.addRecord('Onboarding', { onboardID: 'OB-GA', userID: 'U-GA',
  competenceID: ['CMP-GA'], isCertified: true });
data.addRecord('Onboarding', { onboardID: 'OB-GB', userID: 'U-GB',
  competenceID: ['CMP-GB'], isCertified: false });
data.addRecord('Onboarding', { onboardID: 'OB-GW', userID: 'U-GB',
  competenceID: ['CMP-GW'], isCertified: true });

console.log('== certifiedUsersForProcedure: strict certified association ==');
{
  eq(resolve.certifiedUsersForProcedure('PROC-GA'), ['U-GA'],
    'a certified group onboarding staffs the bound procedure');
  eq(resolve.certifiedUsersForProcedure('PROC-GB'), [],
    'an UNCERTIFIED onboarding does not staff (isCertified gate)');
  eq(resolve.certifiedUsersForProcedure('PROC-GC'), [],
    'a procedure-less competence does NOT staff a specific procedure (no wildcard)');
  eq(resolve.certifiedUsersForProcedure(null), [], 'null procedure = nobody');
}

console.log('== Procedures Users column: names or GAP ==');
{
  const pa = data.getById('Procedures', 'PROC-GA');
  eq(String(resolve.derivedValue('Procedures', usersAttr, pa)), 'Certified Holder (t)',
    'eligible holders render as names');
  const pb = data.getById('Procedures', 'PROC-GB');
  eq(String(resolve.derivedValue('Procedures', usersAttr, pb)), 'GAP',
    'no certified holder renders the GAP tag (gap-tag wrapper)');
}

console.log('== Tasks Procedures column: registries or GAP ==');
{
  const withProcs = data.getById('Tasks', 'TSK-GA');
  const cell = String(resolve.derivedValue('Tasks', procsAttr, withProcs));
  eq(/PROC-GA \(t\)/.test(cell) && cell !== 'GAP', true,
    'a task with procedures lists their registries');
  data.addRecord('Tasks', { taskID: 'TSK-GN', taskName: 'Bare Task (t)', processID: 'PR1' });
  eq(String(resolve.derivedValue('Tasks', procsAttr, data.getById('Tasks', 'TSK-GN'))), 'GAP',
    'a task with NO procedure renders the GAP tag');
}

console.log('== gap-tag is opt-in: untagged attrs keep the dash ==');
{
  const reqAttr = catalog['Tasks'].byName['requirementName'];
  const bare = data.getById('Tasks', 'TSK-GN');
  eq(String(resolve.derivedValue('Tasks', reqAttr, bare)), '—',
    'an untagged empty derived value still renders the dash');
}

console.log('== demo census (frozen dataset) ==');
{
  const procs = data.getEntity('Procedures').filter((p) => !String(p.procedureID).startsWith('PROC-G'));
  const gaps = procs.filter((p) => resolve.derivedValue('Procedures', usersAttr, p) === 'GAP');
  eq(procs.length > 0 && gaps.length < procs.length, true,
    `some demo procedures resolve users (${procs.length - gaps.length}/${procs.length}; ${gaps.length} honest GAPs)`);
  const tasks = data.getEntity('Tasks').filter((t) => !String(t.taskID).startsWith('TSK-G'));
  const tGaps = tasks.filter((t) => resolve.derivedValue('Tasks', procsAttr, t) === 'GAP');
  eq(tasks.length - tGaps.length, 50,
    `the 50 seeded tasks with procedures resolve (${tGaps.length} tasks flagged GAP)`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
