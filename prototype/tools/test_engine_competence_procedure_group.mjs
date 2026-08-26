#!/usr/bin/env node
// test_engine_competence_procedure_group.mjs — proof suite for the competence
// procedure GROUP round (issue #284, schemaVersion 58): Competence.procedureID
// returns to 1:many (multivalued — the group stays restricted to the
// competence's task) and the new stored competenceTitle is the table label
// (user-given: the title is what distinguishes and groups competences).
// Decisions recorded in-session: the Q1 wildcard is KEPT (one empty-set
// procedure in the group certifies everything) and the group is task-scoped.
// The #231 doctrine survives: requirements bind on the Procedure; the
// competence inherits the UNION of its procedures' sets.
// Run from prototype/:  node tools/test_engine_competence_procedure_group.mjs

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

console.log('== schema: procedure GROUP + title label ==');
{
  eq(model.getSchemaVersion() >= 58, true, 'schemaVersion bumped to at least 58');
  const title = catalog['Competence'].byName['competenceTitle'];
  eq([title.type, /NOT NULL/i.test(title.constraints || '')], ['VARCHAR', true],
    'competenceTitle is a stored VARCHAR, NOT NULL');
  eq(catalog['Competence'].label, 'competenceTitle',
    'competenceTitle is the table label (first *Title attr)');
  eq(forms.requiredAttrs('Competence').has('competenceTitle'), true,
    'title is required (label + NOT NULL)');
  const f = catalog['Competence'].form.fields.Title;
  eq(f && f.attribute, 'competenceTitle', 'form opens with the Title input');
  eq(f && f['field-type'] && 'input' in f['field-type'], true,
    'Title renders as a free-text input');
  eq(f && f.tooltip,
    'Names the competence — distinguishes and groups competences now that one competence certifies a group of procedures',
    'Title tooltip verbatim');
}

console.log('== schema: multivalued picker keeps the cascade wired ==');
{
  const pa = catalog['Competence'].byName['procedureID'];
  eq(/multivalued/i.test(pa.notes || ''), true,
    'procedureID notes mark the GROUP multivalued (1:many, issue #284)');
  const o = forms.optionsForAttr('Competence', 'procedureID');
  eq([o.target, o.multi], ['Procedures', true],
    'Procedure picker is a multi-select on the Procedures registry');
  const pf = catalog['Competence'].form.fields['Procedure'];
  eq(/filtered by .*Task.* selected/i.test(JSON.stringify(pf['field-rule'])), true,
    'field-rule keeps the "filtered by Task selected" spelling (#274 dead-cascade regression) — the group is task-scoped');
  const ob = catalog['Onboarding'].byName['competenceID'];
  eq(/display: competenceTitle/.test(ob.rule), true,
    'Onboarding competence picker displays the user-given title (#284 re-point)');
}

console.log('== seeds: arrays + deterministic titles (migration ↔ builder agreement) ==');
{
  const comps = data.getEntity('Competence');
  eq(comps.length > 0 && comps.every((c) => Array.isArray(c.procedureID)), true,
    'every seeded competence stores a procedure id ARRAY');
  eq(comps.every((c) => typeof c.competenceTitle === 'string' && c.competenceTitle !== ''), true,
    'every seeded competence carries a non-empty title (parity)');
  // full census: recompute the deterministic title rule — "<stored task
  // name> | <scope name>" via the certified product scope — and match
  const psIx = new Map(data.getEntity('Product Scopes').map((p) => [p.productScopeID, p]));
  const scIx = new Map(data.getEntity('Scopes').map((s) => [s.scopeID, s]));
  const tkIx = new Map(data.getEntity('Tasks').map((t) => [t.taskID, t]));
  const mismatches = comps.filter((c) => {
    const tn = (tkIx.get(c.taskID) || {}).taskName;
    const sn = (scIx.get((psIx.get(c.productScopeID) || {}).scopeID) || {}).scopeName;
    const want = tn && sn ? `${tn} | ${sn}` : tn || `Competence ${c.competenceID}`;
    return c.competenceTitle !== want;
  });
  eq(mismatches.map((c) => c.competenceID), [],
    'every title matches the shared deterministic rule (full census)');
}

console.log('== inheritance: the group UNIONS its procedures\' sets ==');
{
  data.addRecord('Procedures', { procedureID: 'PROC-CPGA', procedureRegistry: 'PROC-CPGA (t)',
    taskID: 'TSK-CPG', requirementID: ['RQ-CPG1'] });
  data.addRecord('Procedures', { procedureID: 'PROC-CPGB', procedureRegistry: 'PROC-CPGB (t)',
    taskID: 'TSK-CPG', requirementID: ['RQ-CPG2', 'RQ-CPG1'] });
  data.addRecord('Procedures', { procedureID: 'PROC-CPGW', procedureRegistry: 'PROC-CPGW (t)',
    taskID: 'TSK-CPG', requirementID: [] });
  eq(resolve.competenceRequirements({ procedureID: ['PROC-CPGA', 'PROC-CPGB'] }),
    ['RQ-CPG1', 'RQ-CPG2'],
    'two procedures in the group → deduped UNION of their sets');
  eq(resolve.competenceRequirements({ procedureID: ['PROC-CPGA', 'PROC-CPGW'] }), null,
    'one Q1-wildcard procedure in the group → certifies everything (decision kept, #284)');
  eq(resolve.competenceRequirements({ procedureID: 'PROC-CPGA' }), ['RQ-CPG1'],
    'legacy scalar rows still resolve (frozen snapshots, pre-#284 imports)');
}

console.log('== staffing: one competence staffs every procedure of its group ==');
{
  data.addRecord('Competence', { competenceID: 'CMP-CPG', competenceTitle: 'Group probe (t)',
    taskID: 'TSK-CPG', procedureID: ['PROC-CPGA', 'PROC-CPGB'] });
  data.addRecord('Onboarding', { onboardID: 'OB-CPG', onboardingTitle: 'Group probe (t)',
    userID: 'U-CPG', competenceID: ['CMP-CPG'], isCertified: true });
  eq(resolve.certifiedUsersForProcedure('PROC-CPGA').includes('U-CPG'), true,
    'the holder staffs the first procedure of the group');
  eq(resolve.certifiedUsersForProcedure('PROC-CPGB').includes('U-CPG'), true,
    'the holder staffs the second procedure of the group');
  eq(resolve.certifiedUsersForProcedure('PROC-CPGW').includes('U-CPG'), false,
    'strict association survives — no membership, no staffing (#271 posture)');
}

console.log(fails ? `\n${fails} FAILED` : '\nall green');
process.exit(fails ? 1 : 0);
