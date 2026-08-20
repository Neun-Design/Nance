#!/usr/bin/env node
// test_engine_boolean_select.mjs — proof suite for issue #218: selects bound
// to BOOLEAN attributes (Onboarding.isCertified, Product Scopes.isActive)
// render fixed Yes/No options and commit a REAL boolean. The distinct-from-
// data fallback offered nothing on a blank dataset, and the DOM select's
// string "true" never passed the strict certified gates (isCertified === true
// in certifiedUsersForTask and the Jobs certified-responsible control).
// Run from prototype/:  node tools/test_engine_boolean_select.mjs

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

console.log('== helpers: fixed options + coercion ==');
{
  eq(forms.BOOLEAN_OPTIONS.map((o) => o.label), ['Yes', 'No'], 'fixed Yes/No options');
  eq(forms.BOOLEAN_OPTIONS.map((o) => o.value), ['true', 'false'], 'option values are the coercible spellings');
  eq(forms.booleanFromSelect('true'), true, "'true' → true");
  eq(forms.booleanFromSelect('false'), false, "'false' → false");
  eq(forms.booleanFromSelect(''), null, "placeholder '' → null (nullable stays possible)");
  eq(forms.booleanFromSelect(null), null, 'null → null');
  eq(forms.booleanFromSelect(true), true, 'already-boolean passes through (edit round-trip)');
}

console.log('== spec guard: the BOOLEAN+select pairings ==');
{
  eq(catalog['Onboarding'].byName['isCertified'].type, 'BOOLEAN', 'Onboarding.isCertified typed BOOLEAN');
  const obField = Object.values(catalog['Onboarding'].form.fields)
    .find((f) => f.attribute === 'isCertified');
  eq(obField && 'select' in obField['field-type'], true, 'Certified is a select field');
  eq(catalog['Product Scopes'].byName['isActive'].type, 'BOOLEAN', 'Product Scopes.isActive typed BOOLEAN');
  const psField = Object.values(catalog['Product Scopes'].form.fields)
    .find((f) => f.attribute === 'isActive');
  eq(psField && 'select' in psField['field-type'], true, 'Active is a select field');
  // issue #220: the Customers soft-delete flag joined the form, defaulting Yes
  eq(catalog['Customers'].byName['isActive'].type, 'BOOLEAN', 'Customers.isActive typed BOOLEAN');
  const cField = Object.values(catalog['Customers'].form.fields)
    .find((f) => f.attribute === 'isActive');
  eq(cField && 'select' in cField['field-type'], true, 'Customers Active is a select field (issue #220)');
  eq(forms.booleanDefault(cField && cField['field-rule']), 'true', 'Customers Active defaults Yes on new records');
}

console.log('== booleanDefault: the "default: Yes|No" spelling ==');
{
  eq(forms.booleanDefault('default: Yes'), 'true', 'Yes → preselect true');
  eq(forms.booleanDefault('default: no'), 'false', 'No → preselect false');
  eq(forms.booleanDefault('default: true'), 'true', 'true spelling accepted');
  eq(forms.booleanDefault('filtered by Unit selected'), null, 'no default rule → placeholder start');
  eq(forms.booleanDefault(null), null, 'null rule → placeholder start');
  const obField = Object.values(catalog['Onboarding'].form.fields)
    .find((f) => f.attribute === 'isCertified');
  eq(forms.booleanDefault(obField && obField['field-rule']), null,
    'isCertified carries NO default — certifying by default would be a semantic claim');
}

console.log('== integration: only a real boolean certifies ==');
{
  data.addRecord('Requirements', { requirementID: 'RQ-B1', requirementName: 'Bool Probe (t)' });
  data.addRecord('Tasks', { taskID: 'TSK-B', taskName: 'Bool Probe Task (t)', processID: 'PR1' });
  data.addRecord('Procedures', { procedureID: 'PROC-B1', procedureRegistry: 'PROC-B1 (t)',
    taskID: 'TSK-B', requirementID: ['RQ-B1'] });
  data.addRecord('Competence', { competenceID: 'CMP-B1', procedureID: ['PROC-B1'] });
  // saved through the fixed select: booleanFromSelect('true') → real boolean
  data.addRecord('Onboarding', { onboardID: 'OB-B1', userID: 'U-B1', competenceID: 'CMP-B1',
    isCertified: forms.booleanFromSelect('true') });
  // the pre-#218 bug: the DOM select committed the raw string
  data.addRecord('Onboarding', { onboardID: 'OB-B2', userID: 'U-B2', competenceID: 'CMP-B1',
    isCertified: 'true' });
  const users = resolve.certifiedUsersForTask('TSK-B');
  eq(users.includes('U-B1'), true, 'coerced boolean certifies the user (Tasks Users column)');
  eq(users.includes('U-B2'), false, 'the legacy string "true" never certified — the bug this fixes');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
