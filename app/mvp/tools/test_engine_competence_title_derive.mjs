#!/usr/bin/env node
// test_engine_competence_title_derive.mjs — the Competence Title input left
// the form (Rafael, 2026-09-08, sv104): the label auto-derives on save via
// the #284 seed rule — "<task name> | <scope name>" → task name →
// "Competence <id>" (applyDerivedUnits in forms.js). Blank-only:
// updateRecord MERGES, so stored titles survive edits untouched, and the
// NOT NULL label stays satisfied without a user input.
// Run from prototype/:  node tools/test_engine_competence_title_derive.mjs

import fs from 'fs';
globalThis.fetch = async (p) => new Response(fs.readFileSync(p));

const model = await import('../js/model.js');
const data = await import('../js/data.js');
const { catalog } = await model.loadModel();
data.initMeta(catalog);
await data.loadData();
const forms = await import('../js/forms.js');

let fails = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails += 1; console.log(`  ✗ ${m}`); };
const eq = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));

const dm = JSON.parse(fs.readFileSync('data/datamodel.json', 'utf-8'));

console.log('== schema: sv104, the input is gone, the label survives ==');
{
  eq(dm._meta.schemaVersion >= 104, true, `schemaVersion ${dm._meta.schemaVersion} >= 104`);
  eq(catalog['Competence'].form.fields['Title'], undefined,
    'the Competence form no longer declares a Title input');
  const attr = catalog['Competence'].byName['competenceTitle'];
  eq(/NOT NULL/.test(String(attr.constraints)), true, 'competenceTitle stays NOT NULL (the label)');
  eq(/auto-derived/.test(String(attr.notes)), true, 'the notes record the derive');
}

console.log('== derive on save: the #284 seed rule ==');
{
  const task = data.getEntity('Tasks').find((t) => t.taskName);
  const ps = data.getEntity('Product Scopes').find((p) => p.scopeID != null
    && data.getById('Scopes', p.scopeID)?.scopeName);
  const scopeName = data.getById('Scopes', ps.scopeID).scopeName;
  const rec = { competenceID: 'CMP-TD', taskID: task.taskID, productScopeID: ps.productScopeID };
  forms.applyDerivedUnits('Competence', rec);
  eq(rec.competenceTitle, `${task.taskName} | ${scopeName}`,
    'task + scope → "<task name> | <scope name>"');
  const rec2 = { competenceID: 'CMP-TD2', taskID: task.taskID };
  forms.applyDerivedUnits('Competence', rec2);
  eq(rec2.competenceTitle, String(task.taskName), 'no product scope → the task name alone');
  const rec3 = { competenceID: 'CMP-TD3' };
  forms.applyDerivedUnits('Competence', rec3);
  eq(rec3.competenceTitle, 'Competence CMP-TD3', 'no chain at all → "Competence <id>"');
  // blank-only: a stored/user title is never overwritten
  const rec4 = { competenceID: 'CMP-TD4', taskID: task.taskID, competenceTitle: 'Kept (t)' };
  forms.applyDerivedUnits('Competence', rec4);
  eq(rec4.competenceTitle, 'Kept (t)', 'a non-blank title survives the derive (blank-only)');
}

console.log('== demo census: every stored title untouched (merge posture) ==');
{
  const rows = data.getEntity('Competence');
  eq(rows.filter((c) => c.competenceTitle == null || c.competenceTitle === '').length, 0,
    `all ${rows.length} demo competences keep their stored titles`);
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
