#!/usr/bin/env node
// test_engine_workflow_tasks_tab.mjs — proof suite for the authored display
// round (issue #299): (1) Workflows rows expand into a Tasks subitem (the
// authored block missed a comma after table-filters — normalized; generic
// join via Tasks.workflowID). (2) Tasks hides the derived executionTime and
// userID (CERTIFIED-USERS) columns from table AND subitem contexts — owned
// downstream: the ticket-contextual Users column (#233) leaves the Ticket
// Tasks tab; certifiedUsersForTask keeps powering Jobs staffing. (3) Payload
// product scopes render as productScopeRegistry codes (the #296 pattern):
// FK display re-pointed, scope grouping dropped, and the bespoke
// productScopesForPayload labels follow.
// Run from prototype/:  node tools/test_engine_workflow_tasks_tab.mjs

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
const fail = (m) => { fails += 1; console.log(`  ✗ ${m}`);
};
const eq = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));

console.log('== Workflows: Tasks subitem (generic workflowID join) ==');
{
  const subs = catalog['Workflows'].subitems;
  eq(subs.length === 1 && subs[0].table === 'Tasks', true,
    'Workflows declares the Tasks subitem (authored block, comma normalized)');
  const wf = data.getEntity('Workflows').find((w) =>
    data.getEntity('Tasks').some((t) => String(t.workflowID) === String(w.workflowID)));
  eq(wf != null, true, `probe workflow found (${wf && wf.workflowID})`);
  const kids = resolve.childrenOf('Workflows', wf, 'Tasks', {});
  eq(kids.length > 0 && kids.every((t) => String(t.workflowID) === String(wf.workflowID)), true,
    `rows expand into their tasks (${kids.length} for ${wf && wf.workflowID})`);
}

console.log('== Tasks: executionTime and Users columns hidden (authored) ==');
{
  const et = catalog['Tasks'].byName['executionTime'];
  const us = catalog['Tasks'].byName['userID'];
  eq([et['table-display'], et['subitem-display']], [false, false],
    'executionTime out of table and subitem contexts (rule intact — sums still derive)');
  eq([us['table-display'], us['subitem-display']], [false, false],
    'userID (CERTIFIED-USERS) out of table and subitem contexts');
  // rules untouched — the derivations keep powering Events sums and staffing
  eq(model.parseRule(et.rule).kind, 'sum', 'executionTime rule intact');
  eq(model.parseRule(us.rule).kind, 'certifiedusers', 'CERTIFIED-USERS rule intact');
  // owned downstream: the ticket Tasks tab no longer carries the Users
  // column (#233 accessor only decorates columns that survive the filter)
  const subCols = model.columnsFor('Tasks', 'sub').map((c) => c.name || c.key);
  eq(subCols.includes('userID'), false, 'the Ticket Tasks tab loses the Users column (owned)');
  eq(subCols.includes('procedureRegistry'), true, 'the #270 Procedure column stays');
}

console.log('== Payload: product scopes by registry code (#296 pattern) ==');
{
  const attr = catalog['Payload'].byName['productScopeID'];
  const r = model.parseRule(attr.rule);
  eq(r.display, 'productScopeRegistry', 'FK display re-pointed to the registry code');
  const f = catalog['Payload'].form.fields['Product Scope'];
  const rule = Array.isArray(f['field-rule']) ? f['field-rule'].join('; ') : String(f['field-rule']);
  eq(/SelectLabel/.test(rule), false, 'scope grouping dropped from the picker');
  eq(/filtered by Event \+ Business Unit selected/i.test(rule), true,
    'the Event + Business Unit cascade stays (#274 spelling intact)');
  const opts = forms.productScopesForPayload(null, null);
  eq(opts.length > 0, true, `picker offers ${opts.length} product scope(s)`);
  eq(opts.every((o) => {
    const ps = data.getById('Product Scopes', o.value);
    return ps && String(o.label) === String(ps.productScopeRegistry ?? o.value);
  }), true, 'every item labels as its productScopeRegistry code');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
