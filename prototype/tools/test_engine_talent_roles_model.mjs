#!/usr/bin/env node
// test_engine_talent_roles_model.mjs — proof suite for the Talent Roles
// model (issue #328, schemaVersion 78):
//   • Roles drop skillLevelID (the level is defined per Competence — the
//     competence owns the role + level pair, and a person accumulates the
//     pairs through onboarding) and jobFamilyID (inherits through the
//     Function since #298);
//   • Roles gain a multivalued departmentID — departments where the role
//     is exercised; the form multicheck groups by businessUnitName and
//     filters by the selected Function through the generic shared-unit
//     join (Functions.businessUnitID × Departments.businessUnitID — the
//     #309 Supplier Department shape, zero engine code);
//   • Job Family's `field` category became the free-text
//     jobFamilyDescription (textarea) — the Functions select grouping
//     and the family Report-A grouping re-pointed;
//   • the Competence Role picker filters by Function only (the role ↔
//     skill level link is indirect now);
//   • seeds: per role, the in-unit departments where the function's
//     people sit, fallback = the unit's first department (both mockup
//     copies; build_seed.py runs the same rule in lockstep).
// Run from prototype/:  node tools/test_engine_talent_roles_model.mjs

import fs from 'fs';
globalThis.fetch = async (p) => new Response(fs.readFileSync(p));

const model = await import('../js/model.js');
const data = await import('../js/data.js');
const { catalog } = await model.loadModel();
data.initMeta(catalog);
await data.loadData();
const resolve = await import('../js/resolve.js');
const forms = await import('../js/forms.js');
const queries = await import('../js/queries.js');

let fails = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails += 1; console.log(`  ✗ ${m}`); };
const eq = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));
const asList = (v) => (Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]));

console.log('== schema: Roles keep function + departments only ==');
{
  eq(model.getSchemaVersion() >= 78, true, `schemaVersion ${model.getSchemaVersion()} >= 78`);
  const cat = catalog['Roles'];
  eq(cat.byName['skillLevelID'] ?? null, null, 'skillLevelID left the catalogue');
  eq(cat.byName['jobFamilyID'] ?? null, null, 'jobFamilyID left the catalogue');
  const dep = cat.byName['departmentID'];
  const r = model.parseRule(dep.rule);
  eq([dep.type, r.kind, model.resolveTable(r.target), r.display],
    ['FK', 'fk', 'Departments', 'departmentName'],
    'departmentID: stored FK → Departments, displayed by name');
  eq(/multivalued/i.test(String(dep.notes)), true, 'multivalued (attribute note)');
}

console.log('== form: Departments multicheck, Skill Level / Job Family gone ==');
{
  const f = catalog['Roles'].form.fields;
  eq('Skill Level' in f, false, 'Skill Level select gone');
  eq('Job Family' in f, false, 'Job Family select gone');
  const d = f['Departments'];
  eq(d && d.attribute, 'departmentID', 'Departments field binds the stored key');
  eq(d.check, 'Function IS NOT NULL', 'gated on Function (multicheck-gate posture)');
  const ruleText = asList(d['field-rule']).join('; ');
  eq(/allow multiple/i.test(ruleText), true, 'multi-assignment spelling');
  // issue #334 re-point: the businessUnitName grouping left the rule — the
  // Business Unit is a USER decision on the form now, so every offered
  // department belongs to the chosen unit and the group header was redundant
  eq(/SelectLabel\s*={1,2}\s*businessUnitName/.test(ruleText), false,
    'businessUnitName grouping dropped (#334 — unit is a user decision)');
  // #274 trap: a cascade only wires listeners when the rule matches the
  // `filtered by … selected` regex — free-text spellings leave it dead
  const m = ruleText.match(/filtered by (?:the )?([A-Za-z .+&,]+?)(?: selected| field|$)/i);
  eq(m && m[1].trim(), 'Function', 'cascade dep names the Function field');
  const o = forms.optionsForAttr('Roles', 'departmentID');
  eq([o.target, !!o.multi], ['Departments', true], 'picker targets Departments, multi');
}

console.log('== cascade: Function → Departments rides the shared-unit join ==');
{
  // the generic fallback (childKeyFor finds no stored functionID on
  // Departments) descends through the join engine — same shape as the #309
  // SLA Supplier Department (Customers × Departments over businessUnitID)
  const dept = (id) => data.getById('Departments', id);
  for (const fn of data.getEntity('Functions')) {
    const units = new Set(asList(fn.businessUnitID).map(String));
    const kids = resolve.childrenOf('Functions', fn, 'Departments', {});
    const want = data.getEntity('Departments')
      .filter((d) => units.has(String(d.businessUnitID)))
      .map((d) => String(d.departmentID)).sort();
    eq(kids.map((d) => String(d.departmentID)).sort(), want,
      `${fn.functionID} offers exactly its units' departments (${want.join(', ') || 'none'})`);
    if (!want.length) fail(`${fn.functionID}: unit with no departments in the demo`);
    void dept;
  }
}

console.log('== census: every seeded department survives the picker (form integrity) ==');
{
  const roles = data.getEntity('Roles');
  eq(roles.every((r) => Array.isArray(r.departmentID)), true,
    'every role stores a departmentID array');
  eq(roles.every((r) => !('skillLevelID' in r) && !('jobFamilyID' in r)), true,
    'no role keeps the retired keys (parity)');
  eq(roles.every((r) => r.departmentID.length > 0), true,
    'clinic demo: 12/12 roles keyed (fallback covered the people-less units)');
  for (const r of roles) {
    const fn = data.getById('Functions', r.functionID);
    const units = new Set(asList(fn.businessUnitID).map(String));
    const inUnit = r.departmentID.every((d) =>
      units.has(String((data.getById('Departments', d) || {}).businessUnitID)));
    if (!inUnit) fail(`${r.roleID}: seeded department outside the function's units — the edit-mode picker would wipe it`);
  }
  ok('every seeded department is in-unit for its function (picker keeps it on edit)');
  // the F4 shape: no in-unit people signal → the unit's first department
  const f4roles = roles.filter((r) => String(r.functionID) === 'F4');
  eq(f4roles.map((r) => r.departmentID), f4roles.map(() => ['DPT05']),
    'fallback bites: F4 (BU04) roles land on the unit department despite the out-of-unit people');
}

console.log('== doctrine: the competence owns the role + skill level pair ==');
{
  const comp = catalog['Competence'];
  eq([comp.byName['skillLevelID'].type, comp.byName['skillLevelID'].constraints],
    ['FK', 'FK, NOT NULL'], 'Competence keeps its own stored skill level');
  eq(data.getEntity('Competence').every((c) => c.skillLevelID != null), true,
    'every demo competence stores its level (rows untouched by the migration)');
  const rf = comp.form.fields['Role'];
  eq(rf.check, 'Function IS NOT NULL', 'Role picker gated on Function now');
  eq(rf['field-rule'], 'filtered by Function selected',
    'Role picker filters by Function only (no Skill Level leg — Roles store none)');
}

console.log('== Job Family: field → jobFamilyDescription, links re-pointed ==');
{
  const cat = catalog['Job Family'];
  eq(cat.byName['field'] ?? null, null, 'field attr gone');
  eq(cat.byName['jobFamilyDescription'].type, 'TEXT', 'jobFamilyDescription is TEXT');
  const df = cat.form.fields['Description'];
  eq([df && df.attribute, df && Object.keys(df['field-type'])[0]],
    ['jobFamilyDescription', 'field'],
    'Description textarea bound to it ({field: shadcn-textarea} spelling)');
  eq(data.getEntity('Job Family').every((j) =>
    !('field' in j) && typeof j.jobFamilyDescription === 'string'), true,
    'rows renamed (parity: the old key left the data)');
  eq(cat.byName['roles'] ?? null, null,
    'the (via: jobFamilyID) roles rollup left with the stored key');
  // Job Family → Roles stays derivable without it: the generic chain descends
  // Functions (store jobFamilyID) → Roles (store functionID) — #298 pattern
  const jf = data.getEntity('Job Family').find((j) => data.getEntity('Functions')
    .some((fn) => String(fn.jobFamilyID) === String(j.jobFamilyID)));
  const kids = resolve.childrenOf('Job Family', jf, 'Roles', {});
  eq(kids.length > 0, true,
    `Job Family → Roles resolves through Functions (${kids.length} for ${jf.jobFamilyID})`);
  const fnGroup = catalog['Functions'].form.fields['Job Family'];
  eq(fnGroup['field-rule'] ?? null, null,
    'Functions select grouping dropped (a description cannot group)');
}

console.log('== queries: skill level counts competences, family resolves via function ==');
{
  const rep = queries.REPORT_QUERIES['Skill Levels::Report-A']([]);
  const byLevel = new Map(rep.__pre.map((x) => [x.__k, x.__v]));
  const wantLevels = new Map();
  for (const c of data.getEntity('Competence')) {
    const name = (data.getById('Skill Levels', c.skillLevelID) || {}).levelName || c.skillLevelID;
    wantLevels.set(name, (wantLevels.get(name) || 0) + 1);
  }
  eq([...byLevel.entries()].sort(), [...wantLevels.entries()].sort(),
    'Report-A counts competences per level (independent walk agrees)');
  const card = queries.CARD_QUERIES['Skill Levels::Card 1-1']();
  const top = [...wantLevels.entries()].sort((a, b) => b[1] - a[1])[0];
  eq([card.main, card.detail], [String(top[1]), top[0]], 'card: level with most competences');
  const fam = queries.REPORT_QUERIES['Job Family::Report-A']([]);
  const wantFam = new Map();
  for (const r of data.getEntity('Roles')) {
    const fn = data.getById('Functions', r.functionID) || {};
    const name = (data.getById('Job Family', fn.jobFamilyID) || {}).jobFamilyName || fn.jobFamilyID;
    if (name != null) wantFam.set(name, (wantFam.get(name) || 0) + (Number(r.quantity) || 0));
  }
  eq(new Map(fam.__pre.map((x) => [x.__k, x.__v])), wantFam,
    'family headcount resolves through the role\'s function');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
