#!/usr/bin/env node
// test_engine_enum_default.mjs — proof suite for the generalized
// "default: <value>" field-rule (schemaVersion 115): the #220 boolean-only
// preselect grows an ENUM leg — a select bound to an ENUM attribute
// preselects the rule's value on NEW records (edit prefill wins; a value
// naming no offered option is ignored). First consumer: the Tickets form
// Status field defaults "To Do" (Rafael's authored edit, which also renamed
// the enum — Open → To Do, Resolved → Done, + On Hold — re-keyed in the
// mockup by tools/migrate_ticket_status_enum.py).
// Run from prototype/:  node tools/test_engine_enum_default.mjs

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

console.log('== fieldDefault: the generalized "default: <value>" capture ==');
{
  eq(forms.fieldDefault('default: To Do'), 'To Do', 'enum member with a space is captured whole');
  eq(forms.fieldDefault('default: To Do; filtered by Unit selected'), 'To Do',
    'value runs to the next ";" — following clauses stay out');
  eq(forms.fieldDefault('SelectLabel = x; default: On Hold'), 'On Hold',
    'mid-list clause captured (arrays join with "; " at the call site)');
  eq(forms.fieldDefault('default: Yes'), 'Yes', 'boolean spelling passes through verbatim');
  eq(forms.fieldDefault('filtered by Unit selected'), null, 'no default clause → null');
  eq(forms.fieldDefault(null), null, 'null rule → null');
}

console.log('== booleanDefault: the #220 contract is unchanged ==');
{
  eq(forms.booleanDefault('default: Yes'), 'true', 'Yes → preselect true');
  eq(forms.booleanDefault('default: no'), 'false', 'No → preselect false');
  eq(forms.booleanDefault('default: true'), 'true', 'true spelling accepted');
  eq(forms.booleanDefault('default: To Do'), null,
    'a non-boolean default never reaches a BOOLEAN select');
  eq(forms.booleanDefault('filtered by Unit selected'), null, 'no default rule → placeholder start');
  eq(forms.booleanDefault(null), null, 'null rule → placeholder start');
}

console.log('== spec guard: the Tickets Status field ==');
{
  const cat = catalog['Tickets'];
  const attr = cat && cat.byName && cat.byName['ticketStatus'];
  eq(attr && attr.type, 'ENUM', 'ticketStatus typed ENUM');
  const parsed = model.parseRule(attr && attr.rule);
  eq(parsed && parsed.kind, 'enum', 'rule parses as enum');
  eq(parsed && parsed.values, ['To Do', 'InProgress', 'Done', 'Escalated', 'Closed', 'On Hold'],
    'the sv115 members (Open → To Do, Resolved → Done, + On Hold)');
  const field = cat && cat.form && cat.form.fields && cat.form.fields['Status'];
  const ruleText = field && (Array.isArray(field['field-rule'])
    ? field['field-rule'].join('; ') : (field['field-rule'] || ''));
  eq(forms.fieldDefault(ruleText), 'To Do', 'the Status field-rule defaults To Do');
  eq(parsed && parsed.values.includes(forms.fieldDefault(ruleText)), true,
    'the default names a member of the enum (an out-of-enum value would be ignored)');
}

console.log('== spec guard: the three boolean defaults survive ==');
{
  const pick = (table, label) => {
    const f = catalog[table] && catalog[table].form && catalog[table].form.fields
      && catalog[table].form.fields[label];
    const rt = f && (Array.isArray(f['field-rule']) ? f['field-rule'].join('; ') : (f['field-rule'] || ''));
    return forms.booleanDefault(rt);
  };
  eq(pick('Customers', 'Active'), 'true', 'Customers Active defaults Yes (issue #220)');
  eq(pick('Product Scopes', 'Active'), 'true', 'Product Scopes Active defaults Yes (issue #222)');
  eq(pick('Requirements', 'Selectable on Tickets'), 'false',
    'Requirements Selectable on Tickets defaults No (issue #359)');
}

console.log('== data census: every stored status sits inside the sv115 enum ==');
{
  const rows = data.getEntity('Tickets');
  const members = new Set(['To Do', 'InProgress', 'Done', 'Escalated', 'Closed', 'On Hold']);
  const orphans = rows.filter((r) => !members.has(r.ticketStatus));
  eq(orphans.length, 0, `no ticket carries a pre-rename status (${rows.length} rows walked)`);
  eq(rows.length > 0, true, 'the census walked a non-empty table');
  eq(model.getSchemaVersion() >= 115, true, 'datamodel schemaVersion >= 115');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
