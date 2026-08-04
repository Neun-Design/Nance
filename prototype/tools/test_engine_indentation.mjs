#!/usr/bin/env node
// test_engine_indentation.mjs — unit-test the 2026-07-30 engine work:
// derived STEPORDER indentation (identation-rule.md), bracket-list enum
// parsing, the chain-filtered Handout options for Tasks (filtered-selection
// decision), and the 3-key Forecast Scopes requirement rollup via the
// dotted forecastID.customerID key.
// Run from prototype/:  node tools/test_engine_indentation.mjs

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

console.log('== parseRule: enum spellings ==');
eq(model.parseRule('enum: Active/Inactive').values, ['Active', 'Inactive'], 'slash list');
eq(model.parseRule("enum: ['Opportunity', 'Risk']").values, ['Opportunity', 'Risk'], 'bracketed quoted list');
eq(model.parseRule('enum: [1, 2, 3]').values, ['1', '2', '3'], 'bracketed number list');
eq(model.parseRule("enum: ['start-to-finish', 'start-to-start', 'finish-to-start', 'finish-to-finish']").values,
  ['start-to-finish', 'start-to-start', 'finish-to-start', 'finish-to-finish'], 'indentationRule enum');

console.log('== parseRule: STEPORDER ==');
{
  const r = model.parseRule('computed: STEPORDER(parentStepID, indentationRule) per processID');
  eq([r.kind, r.parentField, r.ruleField, r.groupField],
    ['steporder', 'parentStepID', 'indentationRule', 'processID'], 'STEPORDER with group field');
}

console.log('== stepOrderMap: identation-rule.md example ==');
{
  // Offer Electrical Design example table (WF01…WF07 → 1, 2, 2.1, 2.2, 3, 3.1, 4)
  const rows = [
    { id: 'WF01', parentStepID: null, indentationRule: null },
    { id: 'WF02', parentStepID: 'WF01', indentationRule: 'start-to-finish' },
    { id: 'WF03', parentStepID: 'WF02', indentationRule: 'finish-to-finish' },
    { id: 'WF04', parentStepID: 'WF02', indentationRule: 'finish-to-finish' },
    { id: 'WF05', parentStepID: 'WF02', indentationRule: 'start-to-finish' },
    { id: 'WF06', parentStepID: 'WF05', indentationRule: 'finish-to-finish' },
    { id: 'WF07', parentStepID: 'WF05', indentationRule: 'start-to-finish' },
  ];
  const map = resolve.stepOrderMap(rows, 'id');
  eq(rows.map((r) => map.get(r.id)), ['1', '2', '2.1', '2.2', '3', '3.1', '4'], 'doc example numbering');
}

console.log('== derived indentationID matches the legacy stored values ==');
{
  // gabarito: the values stored in the mockup before migrate_indentation.py
  const legacy = {
    WF01: '1', WF02: '2', WF03: '2.1', WF04: '2.2', WF05: '3', WF06: '3.1', WF07: '4',
    WF08: '1', WF09: '2', WF10: '3', WF11: '4',
    WF12: '1', WF13: '2', WF14: '3',
    WF15: '1', WF16: '2',
    WF17: '1', WF18: '2',
    WF19: '1', WF20: '2', WF21: '3',
  };
  const attr = model.getCatalog('Workflows').byName['indentationID'];
  const got = {};
  for (const id of Object.keys(legacy)) {
    got[id] = resolve.derivedValue('Workflows', attr, data.getById('Workflows', id));
  }
  eq(got, legacy, 'all 21 mockup workflows re-derive their legacy numbers');
  const stored = data.getEntity('Workflows').some((w) => 'indentationID' in w);
  eq(stored, false, 'no workflow row stores indentationID any more');
}

console.log('== subitem ordering follows the derived number ==');
{
  // out-of-insertion-order chain: A=1, B=2, C=1.1, D=2.1 → sorted A, C, B, D
  data.addRecord('Processes', { processID: 'PC-T1', processName: 'Step-order test (t)' });
  data.addRecord('Workflows', { workflowID: 'WFT-A', processID: 'PC-T1', parentStepID: null });
  data.addRecord('Workflows', { workflowID: 'WFT-B', processID: 'PC-T1', parentStepID: 'WFT-A', indentationRule: 'start-to-finish' });
  data.addRecord('Workflows', { workflowID: 'WFT-C', processID: 'PC-T1', parentStepID: 'WFT-A', indentationRule: 'finish-to-finish' });
  data.addRecord('Workflows', { workflowID: 'WFT-D', processID: 'PC-T1', parentStepID: 'WFT-B', indentationRule: 'start-to-start' });
  const si = model.getCatalog('Processes').subitems.find((s) => s.table === 'Workflows');
  eq(si && si.orderBy, 'indentationID', 'Processes subitem directive orders by indentationID');
  const kids = resolve.childrenOf('Processes', data.getById('Processes', 'PC-T1'), 'Workflows',
    { orderBy: 'indentationID' });
  eq(kids.map((k) => k.workflowID), ['WFT-A', 'WFT-C', 'WFT-B', 'WFT-D'],
    'children sorted 1, 1.1, 2, 2.1 regardless of insertion order');
}

console.log('== Parent Step: self-referential FK options (2026-08-04 fix) ==');
{
  eq(catalog['Workflows'].form.fields['Parent Step'].attribute, 'parentStepID',
    'form binds parentStepID (not activityID)');
  data.addRecord('Workflows', { workflowID: 'WFT9', processID: 'PC01', activityID: 'AT1' });
  const o = forms.optionsForAttr('Workflows', 'parentStepID');
  eq((o.options || []).every((x) => data.getById('Workflows', x.value) != null), true,
    'option values are workflow pks (not each row\'s own parent id)');
  eq((o.options || []).some((x) => x.value === 'WFT9'), true,
    'a freshly created PARENTLESS step is offered (the empty-dropdown bug)');
  const pp = forms.optionsForAttr('Processes', 'parentProcessID');
  eq((pp.options || []).every((x) => data.getById('Processes', x.value) != null), true,
    'Processes.parentProcessID heals too (same self-ref class)');
  data.removeRecords('Workflows', ['WFT9']);
}

console.log('== handoutsForTask: filtered selection (decision 2026-07-30) ==');
{
  // Ownership lives on Procedures since the Procedures round: link a fresh
  // handout through PRC01 (task 012, chain PR1 / WF08 / AC01) and leave a
  // second fresh one unlinked — seeded procedures already own the workflow
  // handouts, so only new records are chain-free.
  data.addRecord('Handouts', { handoutID: 'HO98', handoutName: 'Linked Probe' });
  data.addRecord('Handouts', { handoutID: 'HO99', handoutName: 'Unlinked Probe' });
  const p = data.getById('Procedures', 'PRC01');
  data.updateRecord('Procedures', 'PRC01', { ...p, taskInput: ['HO98'] });
  const on = forms.handoutsForTask('PR1', 'WF08', 'AC01').map((o) => o.value);
  const off = forms.handoutsForTask('PR2', 'WF13', 'AC05').map((o) => o.value);
  eq([on.includes('HO98'), on.includes('HO99')], [true, true],
    'matching chain offers the procedure-linked handout and unlinked ones');
  eq([off.includes('HO98'), off.includes('HO99')], [false, true],
    'other chain hides the procedure-linked handout, keeps unlinked ones');
}

console.log('== Forecast Scopes requirement rollup via forecastID.customerID ==');
{
  const fs0 = data.getEntity('Forecast Scopes').find((r) => r.forecastID && r.scopeID && r.productGroupID);
  const cust = resolve.pathValues('Forecast Scopes', fs0, 'forecastID.customerID');
  eq(cust.length > 0, true, 'dotted path reaches the forecast customer');
  data.addRecord('Requirements', { requirementID: 'RQT-FS-GEN', requirementName: 'FS Generic (t)',
    scopeID: [fs0.scopeID], productGroupID: [fs0.productGroupID] });
  data.addRecord('Requirements', { requirementID: 'RQT-FS-OTHER', requirementName: 'FS Other (t)',
    scopeID: [fs0.scopeID], productGroupID: [fs0.productGroupID], customerID: ['FC-NOPE'] });
  data.addRecord('Requirements', { requirementID: 'RQT-FS-CUST', requirementName: 'FS Cust (t)',
    scopeID: [fs0.scopeID], productGroupID: [fs0.productGroupID], customerID: [cust[0]] });
  const kids = resolve.childrenOf('Forecast Scopes', fs0, 'Requirements',
    { viaList: ['forecastID.customerID', 'scopeID', 'productGroupID'] });
  const ids = kids.map((k) => k.requirementID).filter((i) => String(i).startsWith('RQT-FS'));
  eq([ids.includes('RQT-FS-GEN'), ids.includes('RQT-FS-CUST'), ids.includes('RQT-FS-OTHER')],
    [true, true, false], 'wildcard + matching customer roll up; other customer excluded');
}

console.log('== enum options reach the form engine ==');
{
  const issue = forms.optionsForAttr('Issues', 'issueType');
  eq(issue.options && issue.options.map((o) => o.value), ['Opportunity', 'Risk'], 'Issues.issueType options');
  const rank = forms.optionsForAttr('Onboarding', 'levelRank');
  eq(rank.options && rank.options.map((o) => o.value), ['1', '2', '3'], 'Onboarding.levelRank options');
}

console.log('== Activities as hidden registry (v3-review R5, D3) ==');
{
  const op = model.getModules().find((m) => m.name === 'Operation');
  eq(op.tables.includes('Activities'), false, 'Activities out of the tab strip (dashboard-order 0)');
  eq(!!catalog['Activities'], true, 'still catalogued (options + inline "+" reachable)');
  const r = model.parseRule(catalog['Workflows'].byName['activityID'].rule);
  eq([r.kind, r.target, r.display], ['fk', 'Activities', 'activityName'],
    'Workflows.activityID is a stored FK (was a dead rollup)');
  // seed rows only — the STEPORDER block above adds in-memory WFT-* fixtures
  eq(data.getEntity('Workflows').filter((w) => !String(w.workflowID).startsWith('WFT'))
    .every((w) => w.activityID), true, 'every seeded step linked to its activity');
  eq(forms.requiredAttrs('Workflows').has('activityID'), true, 'activity is a NOT NULL anchor');
  const pr1 = data.getById('Processes', 'PR1');
  const acts = resolve.derivedValue('Processes', catalog['Processes'].byName['activities'], pr1);
  eq(String(acts).includes('Requirement Capture'), true,
    'Processes.activities revived through the workflow chain');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
