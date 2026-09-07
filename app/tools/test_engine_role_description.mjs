#!/usr/bin/env node
// test_engine_role_description.mjs — unit-test the Roles Description field
// (issue #336): stored TEXT attr + Description textarea right below Role
// Name (the #328 jobFamilyDescription precedent). Seeds: deterministic
// generated text, same rule in migration and seed builder.
// Run from prototype/:  node tools/test_engine_role_description.mjs

import fs from 'fs';
globalThis.fetch = async (p) => new Response(fs.readFileSync(p));

const model = await import('../js/model.js');
const data = await import('../js/data.js');
const { catalog } = await model.loadModel();
data.initMeta(catalog);
await data.loadData();

let fails = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails += 1; console.log(`  ✗ ${m}`); };
const eq = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));

const dm = JSON.parse(fs.readFileSync('data/datamodel.json', 'utf-8'));

console.log('== schema: TEXT attr, description display convention ==');
{
  eq(dm._meta.schemaVersion >= 82, true, `schemaVersion ${dm._meta.schemaVersion} >= 82`);
  const a = catalog['Roles'].byName['roleDescription'];
  eq(a?.type, 'TEXT', 'roleDescription is TEXT');
  eq(a?.rule, null, 'plain stored attr, no rule');
  eq(/NOT NULL/.test(a?.constraints || ''), false, 'nullable (description convention)');
  eq([a?.['table-display'], a?.['subitem-display']], [true, false],
    'table=true subitem=false (the sibling *Description convention)');
}

console.log('== form: Description textarea right below Role Name ==');
{
  const fields = catalog['Roles'].form.fields;
  const f = fields['Description'];
  eq(f?.attribute, 'roleDescription', 'Description field bound to roleDescription');
  eq(f?.['field-type']?.field, 'shadcn-textarea',
    'long-text input (the #328 jobFamilyDescription spelling)');
  const order = Object.keys(fields);
  eq(order.indexOf('Description') - order.indexOf('Role Name'), 1,
    'sits immediately below Role Name');
  eq(order.indexOf('Business Unit') - order.indexOf('Description'), 1,
    'Business Unit (#334) follows it');
}

console.log('== seeds: deterministic text on every row (migration ≡ builder rule) ==');
{
  const roles = data.getEntity('Roles');
  eq(roles.every((r) => 'roleDescription' in r), true, 'every role row carries the key');
  let agree = 0;
  for (const r of roles) {
    const fn = data.getById('Functions', r.functionID);
    const want = fn && fn.functionName
      ? `${r.roleName} role within the ${fn.functionName} function` : null;
    if (r.roleDescription === want) agree += 1;
  }
  eq(agree, roles.length, `all ${roles.length} descriptions follow the deterministic rule`);
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
