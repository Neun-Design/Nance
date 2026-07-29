#!/usr/bin/env node
// test_engine_org.mjs — unit-test the Organization-restructure engine work
// (issue #76): rule parsing (optional via colon, FK filter, dotted compound
// keys), the 3-key compound rollup with the empty-key wildcard (Q1), the
// path-computed via chain (Tasks ← Workflows ← Product Scopes), the filtered
// FK option list, and the bespoke Jobs task chain.
// Run from prototype/:  node tools/test_engine_org.mjs

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

console.log('== parseRule extensions ==');
{
  const r = model.parseRule("FK: Issues (filtered by issueType='Opportunity')");
  eq([r.kind, r.target, r.filter], ['fk', 'Issues', { field: 'issueType', value: 'Opportunity' }],
    'FK: form with filtered-by predicate');
}
{
  const r = model.parseRule('rollup → People via departmentID (display: userName)');
  eq([r.kind, r.via, r.display], ['rollup', 'departmentID', 'userName'], 'via without colon');
}
{
  const r = model.parseRule('rollup → Requirements (via: customerID + productScopeID.productGroupID + productScopeID.scopeID); display: requirementName');
  eq(r.viaList, ['customerID', 'productScopeID.productGroupID', 'productScopeID.scopeID'],
    '3-key compound via with dotted path keys');
}

console.log('== seed post-migration-shaped records ==');
data.addRecord('Customers', { customerID: 'FCT1', customerName: 'TST', city: 'Testville' });
data.addRecord('Issues', { issueID: 'IST1', issueName: 'Lifetime Extension (t)', issueType: 'Opportunity' });
data.addRecord('Issues', { issueID: 'IST2', issueName: 'Dielectric Failure (t)', issueType: 'Risk' });
// PS01 in the dataset: productGroupID PG01, scopeID A.2
const ps01 = data.getById('Product Scopes', 'PS01');
const pg = ps01.productGroupID, scope = ps01.scopeID;
data.addRecord('Requirements', { requirementID: 'RQT-GEN', requirementName: 'Generic Req (t)',
  scopeID: [scope], productGroupID: [pg] }); // no customerID → applies to all
data.addRecord('Requirements', { requirementID: 'RQT-CUST', requirementName: 'Customer Req (t)',
  scopeID: [scope], productGroupID: [pg], customerID: ['FCT1'] });
data.addRecord('Requirements', { requirementID: 'RQT-OTHER', requirementName: 'Other-customer Req (t)',
  scopeID: [scope], productGroupID: [pg], customerID: ['FC-NOPE'] });
data.addRecord('Workflows', { workflowID: 'WFT1', workflowName: 'Test WF',
  customerID: ['FCT1'], productScopeID: ['PS01'] });
data.addRecord('Workflows', { workflowID: 'WFT2', workflowName: 'Other WF',
  customerID: ['FC-NOPE'], productScopeID: ['PS01'] });
ok('seeded');

console.log('== Q1: 3-key compound rollup with empty-customer wildcard ==');
{
  const wf = data.getById('Workflows', 'WFT1');
  const kids = resolve.childrenOf('Workflows', wf, 'Requirements',
    { viaList: ['customerID', 'productScopeID.productGroupID', 'productScopeID.scopeID'] });
  const ids = kids.map((k) => k.requirementID).filter((i) => String(i).startsWith('RQT'));
  const hasGen = ids.includes('RQT-GEN'), hasCust = ids.includes('RQT-CUST'), hasOther = ids.includes('RQT-OTHER');
  if (hasGen && hasCust && !hasOther) ok('generic + matching-customer requirements roll up; other-customer excluded');
  else fail(`wildcard rollup — got ${JSON.stringify(ids)}`);
}

console.log('== path-computed via (Tasks ← Workflow ← Product Scope) ==');
{
  const vals = resolve.pathValues('Tasks', { taskID: 'TT-X', workflowID: 'WFT1' },
    'workflowID.productScopeID.scopeID');
  eq(vals, [scope], 'pathValues traverses workflowID → productScopeID → scopeID');
  const attr = { name: 'scopeID', type: 'VARCHAR',
    rule: 'computed: Workflows via: workflowID.productScopeID.scopeID (display: scopeName)' };
  const shown = resolve.derivedValue('Tasks', attr, { taskID: 'TT-X', workflowID: 'WFT1' });
  const want = resolve.resolveDisplay('Scopes', data.getById('Scopes', scope), 'scopeName');
  eq(shown, String(want), 'derivedValue shows the scope NAME through the path');
}

console.log('== filtered FK options (Scopes.scopeOpportunity → Opportunity issues) ==');
{
  const { options, target } = forms.optionsForAttr('Scopes', 'scopeOpportunity');
  const ids = (options || []).map((o) => o.value).filter((v) => String(v).startsWith('IST'));
  if (target === 'Issues' && ids.includes('IST1') && !ids.includes('IST2')) {
    ok('only issueType=Opportunity records offered');
  } else fail(`filtered FK — target=${target} opts=${JSON.stringify(ids)}`);
}

console.log('== bespoke Jobs task chain (tasksForJob) ==');
{
  const pgRec = data.getEntity('Product Groups').find((g) => g.productGroupID === pg);
  const prod = Array.isArray(pgRec.productID) ? pgRec.productID[0] : pgRec.productID;
  data.addRecord('Tickets', { ticketID: 'TKT-T1', customerName: 'FCT1', scopes: scope, products: prod });
  data.addRecord('Tasks', { taskID: 'TSK-T1', taskName: 'Match Task (t)', workflowID: 'WFT1' });
  data.addRecord('Tasks', { taskID: 'TSK-T2', taskName: 'Other-customer Task (t)', workflowID: 'WFT2' });
  // workflow with EMPTY applicability keys → applies to every customer/scope
  data.addRecord('Workflows', { workflowID: 'WFT3', workflowName: 'Generic WF', customerID: [], productScopeID: [] });
  data.addRecord('Tasks', { taskID: 'TSK-T3', taskName: 'Generic Task (t)', workflowID: 'WFT3' });
  const opts = forms.tasksForJob('TKT-T1').map((o) => o.value);
  const hasMatch = opts.includes('TSK-T1'), hasOther = opts.includes('TSK-T2');
  const hasWildcard = opts.includes('TSK-T3');
  if (hasMatch && !hasOther && hasWildcard) ok('ticket-matched + empty-key-wildcard tasks offered; other-customer excluded');
  else fail(`tasksForJob — match=${hasMatch} other=${hasOther} wildcard=${hasWildcard}`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
