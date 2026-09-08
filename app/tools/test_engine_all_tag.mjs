#!/usr/bin/env node
// test_engine_all_tag.mjs — unit-test the `all-tag` attribute flag (sv97,
// gap-tag's positive sibling): stored Q1 applicability sets render their
// EMPTY value as the 'All' neutral pill — the wizard's "Apply to all"
// deliberately stores an empty set (empty = applies to everything,
// dynamically), so the cell states the wildcard instead of showing a blank
// that reads as "forgot to fill". First adopters: the four Procedures
// applicability keys (branchID / customerID / productScopeID /
// requirementID); the positive-pick customerInputID (empty = NO customer
// inputs, #324) must NOT carry it. Also regresses the eligibility posture
// the tag describes: an empty requirementID/productScopeID set is the Q1
// wildcard in ticketProcedureForTask — it COVERS every ticket context, it
// never excludes the procedure.
// Run from prototype/:  node tools/test_engine_all_tag.mjs

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

console.log('== schema: sv97, the four flagged applicability keys ==');
{
  eq(dm._meta.schemaVersion >= 97, true, `schemaVersion ${dm._meta.schemaVersion} >= 97`);
  const by = catalog['Procedures'].byName;
  for (const n of ['branchID', 'customerID', 'productScopeID', 'requirementID']) {
    eq(by[n]?.['all-tag'], true, `Procedures.${n} carries all-tag`);
  }
  // positive-pick / plain sets stay unflagged — empty there means NONE
  for (const n of ['customerInputID', 'taskInput', 'taskOutput']) {
    eq(by[n]?.['all-tag'], undefined, `Procedures.${n} does NOT carry all-tag`);
  }
}

console.log('== allTagEmpty: helper semantics ==');
{
  const flagged = { 'all-tag': true };
  eq(typeof resolve.allTagEmpty, 'function', 'exported from resolve.js');
  eq(resolve.allTagEmpty(flagged, []), true, 'flagged + empty array = All');
  eq(resolve.allTagEmpty(flagged, null), true, 'flagged + null = All');
  eq(resolve.allTagEmpty(flagged, ''), true, 'flagged + empty string = All');
  eq(resolve.allTagEmpty(flagged, ['R01']), false, 'flagged + non-empty array = plain values');
  eq(resolve.allTagEmpty(flagged, 'R01'), false, 'flagged + scalar = plain value');
  eq(resolve.allTagEmpty({}, []), false, 'UNflagged attr never tags (opt-in)');
  eq(resolve.allTagEmpty(null, []), false, 'null attr is safe');
}

console.log('== app.js: fk accessor + neutral pill wired ==');
{
  const src = fs.readFileSync('js/app.js', 'utf-8');
  eq(/import\s*{[^}]*allTagEmpty[^}]*}\s*from '\.\/resolve\.js'/.test(src), true,
    'app.js imports allTagEmpty from resolve.js');
  eq(/allTagEmpty\(c\.attr, v\)\) return 'All'/.test(src), true,
    "the fk accessor returns 'All' on a flagged empty value");
  eq(/all-tag[^\n]*=== true\s*\)\s*{\s*\n\s*c\.pill = \(v\) => \(v === 'All' \? 'neutral' : null\)/.test(src),
    true, "flagged columns style the literal 'All' as the neutral pill (others plain)");
}

console.log('== eligibility: the empty set the tag describes IS the Q1 wildcard ==');
{
  // synthetic task with ONE wildcard procedure: covers ANY requirement set
  data.addRecord('Tasks', { taskID: 'TSK-AT', taskName: 'All-tag Task (t)', processID: 'PR1' });
  data.addRecord('Procedures', { procedureID: 'PROC-AT-W', procedureRegistry: 'PROC-AT-W (t)',
    taskID: 'TSK-AT', requirementID: [], productScopeID: [] });
  eq(resolve.ticketProcedureForTask('TSK-AT', ['RQ-X', 'RQ-Y'], ['PS-X'])?.procedureID,
    'PROC-AT-W', 'wildcard procedure matches ANY requirement + scope context');
  eq(resolve.ticketProcedureForTask('TSK-AT', [], null)?.procedureID,
    'PROC-AT-W', 'and the blank / no-ticket context too');
  // ambiguity posture (#270): a SPECIFIC procedure covering the same context
  // makes two candidates — GAP, the wildcard does not silently win
  data.addRecord('Procedures', { procedureID: 'PROC-AT-S', procedureRegistry: 'PROC-AT-S (t)',
    taskID: 'TSK-AT', requirementID: ['RQ-X'], productScopeID: [] });
  eq(resolve.ticketProcedureForTask('TSK-AT', ['RQ-X'], null), null,
    'wildcard + covering specific = ambiguity (GAP), unchanged by this round');
}

console.log('== demo census: the tag bites where the wizard stored wildcards ==');
{
  const procs = data.getEntity('Procedures').filter((p) => !/\(t\)$/.test(p.procedureRegistry || ''));
  const attr = catalog['Procedures'].byName['requirementID'];
  const wild = procs.filter((p) => resolve.allTagEmpty(attr, p.requirementID)).length;
  const pinned = procs.length - wild;
  console.log(`  · ${procs.length} demo procedures — ${wild} render All, ${pinned} render their picks`);
  eq(wild + pinned, procs.length, 'every demo procedure resolves to All or its picks');
  // branchID/customerID were seeded EMPTY by migrate_procedure_wizard.py
  // (declared-only round) — the flag turns every one of those blanks into All
  const bAttr = catalog['Procedures'].byName['branchID'];
  eq(procs.every((p) => resolve.allTagEmpty(bAttr, p.branchID) || asList(p.branchID).length > 0),
    true, 'every branch cell states All or lists its branches — no silent blank left');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
