#!/usr/bin/env node
// test_engine_subtabs.mjs — unit-test the tabbed subitem-tables feature
// (guide §9 object entries, Squads → People/Processes reference): object-entry
// normalization, tab-order sorting, rule directives inside objects, string
// backward-compatibility and the join resolution of both Squads tabs.
// Run from prototype/:  node tools/test_engine_subtabs.mjs

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

console.log('== normalizeSubitem: object entries ==');
{
  const si = model.normalizeSubitem({ 'tab-order': 2, rule: null, 'tab-name': 'processes', 'tab-table': 'Processes' });
  eq([si.table, si.tab.name, si.tab.order], ['Processes', 'Processes', 2], 'plain object entry');
  const so = model.normalizeSubitem({ 'tab-order': 1, rule: 'ordered by indentationID', 'tab-name': 'steps', 'tab-table': 'Workflows' });
  eq([so.table, so.orderBy, so.tab.name], ['Workflows', 'indentationID', 'Steps'], 'rule directive: ordered by');
  const sf = model.normalizeSubitem({ 'tab-order': 1, rule: 'only jobStatus=Active|Queued', 'tab-name': 'jobs', 'tab-table': 'Jobs' });
  eq([sf.only.field, sf.only.values], ['jobStatus', ['Active', 'Queued']], 'rule directive: only filter');
  const sv = model.normalizeSubitem({ 'tab-order': 1, rule: '(via: businessUnitID)', 'tab-name': 'departments', 'tab-table': 'Departments' });
  eq(sv.via, 'businessUnitID', 'rule directive: parenthetical via');
  eq(model.normalizeSubitem('Forecast Scopes').tab ?? null, null, 'string entry carries no tab');
  eq(model.normalizeSubitem({}), null, 'object without tab-table is dropped');
}

console.log('== Squads catalogue: two ordered tabs ==');
{
  const subs = catalog['Squads'].subitems;
  eq(subs.length, 2, 'both subitem groups survive parsing');
  eq(subs.map((s) => s.table), ['People', 'Processes'], 'sorted by tab-order');
  eq(subs.map((s) => s.tab.name), ['People', 'Processes'], 'humanized tab names');
}

console.log('== joins: both tabs resolve children ==');
{
  const sq = data.getEntity('Squads')[0];
  const people = resolve.childrenOf('Squads', sq, 'People', {});
  eq(people.every((p) => String(p.squadID) === String(sq.squadID)), true,
    `People tab filters by squadID (${people.length} row(s) for ${sq.squadName})`);
  eq(people.length > 0, true, 'first demo squad has people');
  const procs = resolve.childrenOf('Squads', sq, 'Processes', {});
  eq(procs.every((p) => String(p.squadID) === String(sq.squadID)), true,
    `Processes tab filters by squadID (${procs.length} row(s))`);
}

console.log('== Procedures: Handouts Inputs/Outputs as tabs (moved from Tasks, Procedures round) ==');
{
  const procs = catalog['Procedures'].subitems;
  eq(procs.map((s) => [s.table, s.throughField, s.tab.name]),
    [['Handouts', 'inputs', 'Inputs'], ['Handouts', 'outputs', 'Outputs']],
    'both grouped-by entries carry tabs in order');
  eq(procs.map((s) => s.label), ['Handouts - Inputs', 'Handouts - Outputs'],
    'group labels preserved for stacked fallbacks');
  const tasks = catalog['Tasks'].subitems;
  eq(tasks.map((s) => [s.table, s.tab.name]), [['Procedures', 'Procedures']],
    'Tasks expands into its Procedures (single group renders stacked)');
}

console.log('== string entries: stacked layout preserved ==');
{
  eq(catalog['Departments'].subitems[0].table, 'Squads', 'Departments single subitem intact');
  eq(catalog['Processes'].subitems.every((s) => !s.tab), true, 'Processes Workflows entry stays untabbed');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
