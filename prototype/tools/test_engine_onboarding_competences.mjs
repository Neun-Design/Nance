#!/usr/bin/env node
// test_engine_onboarding_competences.mjs — unit-test the Onboarding 1:many
// round (issue #239): competenceID is the onboarding's competence GROUP
// (multivalued), onboardingTitle names the group (table label, required),
// the Competences subitem tab lists the group, coverage unions WITHIN one
// onboarding in both staffing controls, and legacy scalar snapshots keep
// resolving.
// Run from prototype/:  node tools/test_engine_onboarding_competences.mjs

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

console.log('== schema: competence group + title label ==');
{
  const o = forms.optionsForAttr('Onboarding', 'competenceID');
  eq([o.target, o.multi], ['Competence', true], 'Competence picker is a multi-select on the Competence registry');
  eq(catalog['Onboarding'].label, 'onboardingTitle', 'onboardingTitle is the table label');
  eq(forms.requiredAttrs('Onboarding').has('onboardingTitle'), true, 'title is required (label + NOT NULL)');
  const f = catalog['Onboarding'].form.fields.Title;
  eq(f && f.attribute, 'onboardingTitle', 'form opens with the Title input');
  const subs = catalog['Onboarding'].subitems || [];
  eq(subs.map((s) => [s.table, s.via]), [['Competence', 'competenceID']],
    'Competences subitem tab declared (via: competenceID), dashboard level');
}

console.log('== mockup migration: arrays + seeded titles ==');
{
  const rows = data.getEntity('Onboarding');
  eq(rows.length > 0 && rows.every((r) => Array.isArray(r.competenceID)), true,
    'every seeded onboarding stores a competence id ARRAY');
  eq(rows.every((r) => typeof r.onboardingTitle === 'string' && r.onboardingTitle !== ''), true,
    'every seeded onboarding carries a non-empty title (parity)');
  const first = data.getById('Onboarding', 'ONB001');
  eq(first.onboardingTitle, 'Requirement Capture-Approval',
    'titles seed from the certified competence\'s task name');
}

console.log('== subitem + derived columns resolve the whole group ==');
{
  const row = { onboardID: 'OB-X', competenceID: ['CMP01', 'CMP02'] };
  const kids = resolve.childrenOf('Onboarding', row, 'Competence', { via: 'competenceID' });
  eq(kids.map((k) => k.competenceID).sort(), ['CMP01', 'CMP02'],
    'subitem join lists every competence of the group');
  const scopeAttr = catalog['Onboarding'].byName['scopeName'];
  const one = String(resolve.derivedValue('Onboarding', scopeAttr, data.getById('Onboarding', 'ONB001')));
  eq(one, 'Temperature Reduction', 'single-competence scope column unchanged');
  const many = String(resolve.derivedValue('Onboarding', scopeAttr, row));
  eq(many.includes('Temperature Reduction'), true, 'group scope column resolves through the array');
}

console.log('== CERTIFIED-USERS: coverage unions WITHIN one onboarding ==');
{
  data.addRecord('Requirements', { requirementID: 'RQ-G1', requirementName: 'Group Req 1 (t)' });
  data.addRecord('Requirements', { requirementID: 'RQ-G2', requirementName: 'Group Req 2 (t)' });
  data.addRecord('Tasks', { taskID: 'TSK-G', taskName: 'Group Probe Task (t)', processID: 'PR1' });
  data.addRecord('Procedures', { procedureID: 'PROC-G1', procedureRegistry: 'PROC-G1 (t)',
    taskID: 'TSK-G', requirementID: ['RQ-G1'] });
  data.addRecord('Procedures', { procedureID: 'PROC-G2', procedureRegistry: 'PROC-G2 (t)',
    taskID: 'TSK-G', requirementID: ['RQ-G2'] });
  data.addRecord('Competence', { competenceID: 'CMP-G1', procedureID: ['PROC-G1'] });
  data.addRecord('Competence', { competenceID: 'CMP-G2', procedureID: ['PROC-G2'] });
  // ONE onboarding whose group covers RQ-G1 ∪ RQ-G2 → in
  data.addRecord('Onboarding', { onboardID: 'OB-G1', onboardingTitle: 'Group (t)',
    userID: 'U-G1', competenceID: ['CMP-G1', 'CMP-G2'], isCertified: true });
  // partial group → out
  data.addRecord('Onboarding', { onboardID: 'OB-G2', onboardingTitle: 'Partial (t)',
    userID: 'U-G2', competenceID: ['CMP-G1'], isCertified: true });
  // full group but not certified → out (isCertified gates the whole group)
  data.addRecord('Onboarding', { onboardID: 'OB-G3', onboardingTitle: 'Uncertified (t)',
    userID: 'U-G3', competenceID: ['CMP-G1', 'CMP-G2'], isCertified: false });
  // legacy scalar snapshot value still resolves
  data.addRecord('Competence', { competenceID: 'CMP-G5', procedureID: [] }); // wildcard
  data.addRecord('Onboarding', { onboardID: 'OB-G4', onboardingTitle: 'Legacy (t)',
    userID: 'U-G4', competenceID: 'CMP-G5', isCertified: true });
  eq(resolve.certifiedUsersForTask('TSK-G').sort(), ['U-G1', 'U-G4'],
    'intra-group union covers AND; partial/uncertified out; legacy scalar in');
}

console.log('== certified-responsible: any group member qualifies, no dupes ==');
{
  const opts = forms.certifiedResponsibles(null, 'TSK-G');
  const ids = opts.map((o) => o.value).sort();
  eq(ids.includes('U-G1') && ids.includes('U-G2') && ids.includes('U-G4'), true,
    'lenient no-ticket path: any matching competence in the group qualifies');
  eq(ids.includes('U-G3'), false, 'uncertified onboarding stays out');
  eq(new Set(ids).size, ids.length, 'a multi-competence onboarding lists its person once');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
