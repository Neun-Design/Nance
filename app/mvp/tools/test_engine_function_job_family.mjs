#!/usr/bin/env node
// test_engine_function_job_family.mjs — proof suite for Job Family Relations
// (issue #298): a Function belongs to a Job Family. The link is STORED on
// the Function (Functions.jobFamilyID, form select grouped by the family's
// `field` attribute) and People derive their family through the selected
// function (mirror → Functions via functionID; the People form no longer
// picks it — the stored copies were dropped, parity). The Job Family
// `people` subitem keeps resolving without the stored key: the generic
// twoHopJoin 'chain' descends Job Family → Functions (store jobFamilyID) →
// People (store functionID).
// Run from prototype/:  node tools/test_engine_function_job_family.mjs

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

console.log('== schema: the link lives on Functions ==');
{
  const link = catalog['Functions'].byName['jobFamilyID'];
  const r = model.parseRule(link.rule);
  eq([link.type, r.kind, model.resolveTable(r.target), r.display],
    ['FK', 'fk', 'Job Family', 'jobFamilyName'],
    'Functions.jobFamilyID: stored FK → Job Family, displayed by name');
  eq(/nullable/i.test(String(link.notes)), true,
    'nullable — a function without a roles signal stays unkeyed (honest)');
  const f = catalog['Functions'].form.fields['Job Family'];
  eq(f && f.attribute, 'jobFamilyID', 'Functions form gains the Job Family select');
  eq(/SelectLabel\s*=\s*field/.test(String(f['field-rule'])), true,
    'options grouped by the family `field` attribute (issue spelling)');
  eq(/allow multiple|multivalued/i.test(String(f['field-rule'])), false,
    'single-valued — a function belongs to ONE family');
}

console.log('== schema: People derive the family through the function ==');
{
  const a = catalog['People'].byName['jobFamilyID'];
  eq([a.type, a.rule], ['mirror', 'mirror → Functions (via: functionID) (display: jobFamilyName)'],
    'People.jobFamilyID is a mirror through functionID (the roleID pattern)');
  eq(catalog['People'].form.fields['Job Family'], undefined,
    'the People form no longer picks the family (issue downstream impact)');
  eq(data.getEntity('People').every((p) => !('jobFamilyID' in p)), true,
    'no mockup person carries the stored key (parity)');
  eq(data.getEntity('Functions').every((fn) => 'jobFamilyID' in fn), true,
    'every mockup function carries the new stored key (migration parity)');
  eq(data.getEntity('Functions').every((fn) => fn.jobFamilyID != null), true,
    'clinic demo: every function derived its family from its roles (6/6)');
}

console.log('== display: the person cell resolves function → family name ==');
{
  const person = data.getEntity('People').find((p) => p.functionID);
  const fn = data.getById('Functions', person.functionID);
  const jf = data.getById('Job Family', fn.jobFamilyID);
  const attr = catalog['People'].byName['jobFamilyID'];
  eq(String(resolve.derivedValue('People', attr, person)), String(jf.jobFamilyName),
    `person ${person.userID} shows "${jf.jobFamilyName}" via ${fn.functionID}`);
  // seed sanity: the function's family matches its roles' family (the
  // migration rule — roles majority, first-seen on ties)
  const roleFams = data.getEntity('Roles')
    .filter((r) => String(r.functionID) === String(fn.functionID))
    .flatMap((r) => (Array.isArray(r.jobFamilyID) ? r.jobFamilyID : [r.jobFamilyID]));
  eq(roleFams.includes(fn.jobFamilyID), true, 'the seeded family agrees with the roles signal');
}

console.log('== Job Family people subitem: two-hop chain survives ==');
{
  const jf = data.getEntity('Job Family').find((j) =>
    data.getEntity('Functions').some((fn) => String(fn.jobFamilyID) === String(j.jobFamilyID)));
  const kids = resolve.childrenOf('Job Family', jf, 'People', {});
  eq(kids.length > 0, true,
    `Job Family → People resolves without the stored key (${kids.length} for ${jf.jobFamilyID})`);
  const fnsOf = new Set(data.getEntity('Functions')
    .filter((fn) => String(fn.jobFamilyID) === String(jf.jobFamilyID))
    .map((fn) => String(fn.functionID)));
  eq(kids.every((p) => fnsOf.has(String(p.functionID))), true,
    'every listed person holds a function of that family (chain descent)');
}

console.log('== picker: families grouped by field ==');
{
  const o = forms.optionsForAttr('Functions', 'jobFamilyID');
  eq([o.target, !!o.multi], ['Job Family', false], 'options target the registry, single pick');
  const names = data.getEntity('Job Family').map((j) => String(j.jobFamilyName));
  eq((o.options || []).every((x) => names.includes(String(x.label))), true,
    'items label as family names (field only groups)');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
