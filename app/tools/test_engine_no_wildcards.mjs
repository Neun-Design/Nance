#!/usr/bin/env node
// test_engine_no_wildcards.mjs — unit-test the retirement of the empty-set
// wildcard (issue #364, sv98). Doctrine: an empty multivalued applicability
// set applies to NOTHING — "apply to all" is a decision the USER
// materializes by selecting every value (today's list; a requirement
// registered later requires revisiting each procedure — the deliberate
// quality review the dynamic wildcard silently bypassed). The "Apply to
// all" wizard row and field-rule token are gone; the sv97 all-tag flag is
// retired (superseded within hours — the #290→#294 pattern); pre-sv98
// datasets (frozen testdata, unstamped legacy files) keep the old Q1
// reading via legacyWildcardData(), and blank mode is ALWAYS strict.
// Migration materialized every pre-#364 empty set (census: 1502/1502
// dispatches preserved, 137/160 input tickets, 0 Users flips).
// Run from prototype/:  node tools/test_engine_no_wildcards.mjs

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

console.log('== schema: sv98, the doctrine on the keys, the token gone ==');
{
  eq(dm._meta.schemaVersion >= 98, true, `schemaVersion ${dm._meta.schemaVersion} >= 98`);
  const by = catalog['Procedures'].byName;
  for (const n of ['branchID', 'customerID', 'productScopeID', 'requirementID']) {
    eq(by[n]?.['all-tag'], undefined, `Procedures.${n}: all-tag flag retired`);
    eq(/#364/.test(String(by[n]?.notes)), true, `Procedures.${n} notes record the #364 doctrine`);
  }
  const form = dm.modules.Operation.tables.Procedures.form;
  const ruleTexts = Object.values(form.fields || form).flatMap((f) =>
    (f && typeof f === 'object' && 'field-rule' in f) ? [JSON.stringify(f['field-rule'])] : []);
  eq(ruleTexts.some((r) => /apply to all/i.test(r)), false,
    'no field-rule carries the "Apply to all" token (tooltips may cite the phrase in prose)');
  eq(/apply to all \(Q1\)/i.test(JSON.stringify(form)), false,
    'the Application step-description dropped the Q1 wording');
}

console.log('== forms.js / app.js / css: the wildcard row and the all-tag are gone ==');
{
  const formsSrc = fs.readFileSync('js/forms.js', 'utf-8');
  eq(/applyAllMode|form-applyall/.test(formsSrc), false,
    'forms.js: no applyAllMode dispatch, no wildcard-row class');
  eq(/mkMultiCheck\(options\)\s*{/.test(formsSrc), true,
    'mkMultiCheck takes options only (no applyAll param)');
  const appSrc = fs.readFileSync('js/app.js', 'utf-8');
  eq(/allTagEmpty|all-tag/.test(appSrc), false, 'app.js: all-tag accessor/pill hooks retired');
  eq(resolve.allTagEmpty, undefined, 'resolve.js: allTagEmpty export retired');
  const css = fs.readFileSync('assets/app.css', 'utf-8');
  eq(/form-applyall/.test(css), false, 'app.css: wildcard-row styling removed');
}

console.log('== legacyWildcardData: strict on the sv98 mockup ==');
{
  eq(typeof data.legacyWildcardData, 'function', 'exported from data.js');
  eq(data.legacyWildcardData(), false, 'the migrated clinic dataset (sv98) is STRICT');
}

console.log('== strict dispatch: present-empty sets cover nothing ==');
{
  data.addRecord('Tasks', { taskID: 'TSK-NW', taskName: 'No-wildcard Task (t)', processID: 'PR1' });
  data.addRecord('Procedures', { procedureID: 'PRC-NW-E', procedureRegistry: 'PRC-NW-E (t)',
    taskID: 'TSK-NW', requirementID: [], productScopeID: [] });
  eq(resolve.ticketProcedureForTask('TSK-NW', ['RQ01'], null), null,
    'an empty requirement set does NOT cover a non-empty context (was: wildcard)');
  eq(resolve.ticketProcedureForTask('TSK-NW', [], null)?.procedureID, 'PRC-NW-E',
    'coverage stays vacuous for an EMPTY context (set ⊇ need semantics, unchanged)');
  eq(resolve.ticketProcedureForTask('TSK-NW', [], ['PS01']), null,
    'an empty scope set names NO admitted scope (was: every scope)');
  // materialized picks behave exactly like the old wildcard did
  data.addRecord('Procedures', { procedureID: 'PRC-NW-M', procedureRegistry: 'PRC-NW-M (t)',
    taskID: 'TSK-NW', requirementID: ['RQ01', 'RQ02'], productScopeID: ['PS01'] });
  eq(resolve.ticketProcedureForTask('TSK-NW', ['RQ01'], ['PS01'])?.procedureID, 'PRC-NW-M',
    'explicitly selected values cover their context');
}

console.log('== strict coverage: competenceRequirements without the wildcard ==');
{
  const comp = { competenceID: 'CMP-NW', taskID: 'TSK-NW',
    procedureID: ['PRC-NW-E', 'PRC-NW-M'] };
  eq(resolve.competenceRequirements(comp), ['RQ01', 'RQ02'],
    'an empty-set procedure contributes NOTHING (was: null = certifies all)');
  const only = { competenceID: 'CMP-NW2', taskID: 'TSK-NW', procedureID: ['PRC-NW-E'] };
  eq(resolve.competenceRequirements(only), [],
    'a group of only empty-set procedures covers [] — never null');
}

console.log('== migration census: every wildcard materialized, dispatches preserved ==');
{
  const procs = data.getEntity('Procedures').filter((p) => !/\(t\)$/.test(p.procedureRegistry || ''));
  for (const key of ['requirementID', 'branchID', 'customerID', 'productScopeID']) {
    const empty = procs.filter((p) => !asList(p[key]).length).length;
    eq(empty, 0, `no live procedure keeps an empty ${key} (${procs.length} rows)`);
  }
  // the would-have-flipped case (region-pinned requirements through a
  // cross-unit chain): a BU02 ticket resolving BU01 procedures — the
  // all-Active materialization keeps it resolving (the region-gated #304
  // set would GAP it: census 317/1502 flips on the first cut)
  const t = data.getById('Tickets', 'TK002');
  const need = resolve.ticketRequirements(t);
  const adm = resolve.ticketAdmittedScopeIds(t);
  eq(resolve.ticketProcedureForTask('T002', need, adm)?.procedureID, 'PRC02',
    'TK002|T002 still resolves PRC02 (cross-unit region-pinned need covered)');
  let withInputs = 0;
  for (const tk of data.getEntity('Tickets')) {
    if (resolve.ticketInputHandouts(tk).length) withInputs += 1;
  }
  eq(withInputs, 137, 'inputs census preserved: 137/160 tickets list customer inputs');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
