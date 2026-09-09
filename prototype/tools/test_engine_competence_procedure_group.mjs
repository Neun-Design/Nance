#!/usr/bin/env node
// test_engine_competence_procedure_group.mjs — proof suite for the competence
// procedure GROUP round (issue #284, schemaVersion 58): Competence.procedureID
// returns to 1:many (multivalued — the group stays restricted to the
// competence's task) and the new stored competenceTitle is the table label
// (user-given: the title is what distinguishes and groups competences).
// Decisions recorded in-session: the group is task-scoped. (The #284 "Q1
// wildcard kept" decision was SUPERSEDED by issue #364 — an empty-set
// procedure now contributes nothing; the old reading survives only on
// pre-sv98 datasets via legacyWildcardData.)
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
  // sv104 (Rafael, 2026-09-08): the Title INPUT left the form — the label
  // auto-derives on save via the #284 seed rule (applyDerivedUnits;
  // proven in test_engine_competence_title_derive.mjs)
  eq(catalog['Competence'].form.fields.Title, undefined,
    'the Title input left the form (sv104 — label auto-derived on save)');
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
  // issue #364: the empty-set wildcard is RETIRED — an unpinned procedure
  // contributes NOTHING (the #284 "wildcard certifies everything" decision
  // is superseded; the old reading survives only on pre-sv98 datasets)
  eq(resolve.competenceRequirements({ procedureID: ['PROC-CPGA', 'PROC-CPGW'] }), ['RQ-CPG1'],
    'an empty-set procedure in the group adds no coverage (#364 — was: null/certifies all)');
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

console.log('== demo groups: variant SOPs exercise both sides of #270 coverage ==');
{
  const list = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
  eq(data.getById('Competence', 'CMP01').procedureID, ['PRC01', 'PRC47'],
    'CMP01 groups the contrast SOP with its GENERAL variant');
  eq(data.getById('Competence', 'CMP02').procedureID, ['PRC02', 'PRC48'],
    'CMP02 groups the wildcard SOP with its CONTRAST variant');
  eq(data.getById('Competence', 'CMP11').procedureID, ['PRC11', 'PRC49'],
    'CMP11 groups the lab SOP with its GENERAL variant');
  const contrast = data.getEntity('Requirements')
    .find((r) => r.requirementName === 'Contrast Administration Protocol').requirementID;
  // issue #364: the GENERAL variants' empty sets were MATERIALIZED to every
  // Active requirement (the retired wildcard's faithful translation); the
  // contrast variant keeps its designed single pick
  const allActive = data.getEntity('Requirements')
    .filter((r) => String(r.isActive || 'Active') !== 'Inactive')
    .map((r) => r.requirementID);
  eq([data.getById('Procedures', 'PRC47').requirementID,
    data.getById('Procedures', 'PRC48').requirementID,
    data.getById('Procedures', 'PRC49').requirementID], [allActive, [contrast], allActive],
    'variants carry the materialized sets (all-Active / contrast / all-Active, #364)');
  eq(data.getById('Procedures', 'PRC47').taskID, data.getById('Procedures', 'PRC01').taskID,
    'variants stay on their base SOP\'s task (the group is task-scoped, #284)');
  // ticket context: a rich requirement set is only covered by the wildcard —
  // T001 flips GAP → SOP-001-G, T002 keeps resolving to its base SOP
  const byProcess = new Map();
  for (const t of data.getEntity('Tasks')) {
    if (!byProcess.has(t.processID)) byProcess.set(t.processID, []);
    byProcess.get(t.processID).push(t.taskID);
  }
  const reaches = (taskId) => data.getEntity('Tickets').find((tk) =>
    list(tk.processID).some((pid) => (byProcess.get(pid) || []).includes(taskId)));
  const tk1 = reaches('T001');
  const reqs1 = resolve.ticketRequirements(tk1) || [];
  eq(reqs1.length > 1, true, `probe ticket ${tk1.ticketID} carries a rich context (${reqs1.length} reqs)`);
  eq((resolve.ticketProcedureForTask('T001', reqs1) || {}).procedureID, 'PRC47',
    'T001 resolves to the general variant in ticket context (GAP rescued)');
  const tk2 = reaches('T002');
  eq((resolve.ticketProcedureForTask('T002', resolve.ticketRequirements(tk2) || []) || {}).procedureID, 'PRC02',
    'T002 keeps resolving to its base SOP (the specific variant never covers)');
  eq(resolve.ticketProcedureForTask('T002', []), null,
    'standalone (no context) T002 is now ambiguous — two procedures, honest GAP');
  // group effects: the materialized variant carries every Active requirement,
  // so CMP01's UNION covers the same universe the old wildcard did — but as
  // an explicit list now (#364); the certified holder staffs BOTH variants
  const cmp01 = resolve.competenceRequirements(data.getById('Competence', 'CMP01'));
  eq([...cmp01].sort(), [...allActive].sort(),
    'CMP01 certifies every Active requirement — explicit union, no wildcard (#364)');
  const holder = data.getEntity('Onboarding').find((ob) => ob.isCertified === true
    && list(ob.competenceID).includes('CMP01'));
  eq(holder != null, true, `CMP01 has a certified holder (${holder && holder.userID})`);
  eq(resolve.certifiedUsersForProcedure('PRC47').includes(holder.userID), true,
    'the holder staffs the variant\'s Users column too (#271, staffing spread)');
}

console.log(fails ? `\n${fails} FAILED` : '\nall green');
process.exit(fails ? 1 : 0);
