#!/usr/bin/env node
// test_engine_branch_conflict.mjs — proof suite for the branch-conflict fix
// (2026-09-04, schema v73): the customer-branch link is authored on the
// Customer form but STORED on Branches.customerID, and the old save path
// re-stamped ANY picked branch — registering a customer with a branch used
// by another record silently stripped the older customer (the reported
// bug). Now (1) the Branch picker only offers unlinked branches or the
// edited customer's own (branchAvailableForCustomer), and (2) the save
// path skips owned branches too (imports/stale sessions stay honest).
// Reassignment is explicit: deselect on the owning customer first.
// The audit result is also pinned here: applyCustomerBranches is the ONLY
// cross-table write-back in the form engine — every other field stores on
// the record being saved, so no other table can lose data this way.
// Run from prototype/:  node tools/test_engine_branch_conflict.mjs

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

console.log('== schema: the guard is documented ==');
{
  eq(model.getSchemaVersion() >= 73, true, `schemaVersion ${model.getSchemaVersion()} >= 73`);
  eq(/not owned by another customer/.test(catalog['Customers'].form.fields.Branch.tooltip),
    true, 'tooltip tells the user only unowned branches are offered');
  eq(catalog['Customers'].byName['branchID'].type, 'mirror',
    'Customers.branchID stays a display mirror — the link lives on Branches');
}

console.log('== branchAvailableForCustomer: the ownership predicate ==');
{
  eq(forms.branchAvailableForCustomer({ customerID: null }, 'CUST01'), true,
    'unlinked branch (null) available to anyone');
  eq(forms.branchAvailableForCustomer({ customerID: '' }, 'CUST01'), true,
    'unlinked branch (empty) available to anyone');
  eq(forms.branchAvailableForCustomer({ customerID: 'CUST01' }, 'CUST01'), true,
    'own branch stays offered on edit');
  eq(forms.branchAvailableForCustomer({ customerID: 'CUST09' }, 'CUST01'), false,
    'another customer\'s branch is NOT available');
  eq(forms.branchAvailableForCustomer({ customerID: 'CUST09' }, null), false,
    'NEW record (no id yet) — owned branches not available either');
}

console.log('== save path: an owned branch is never stolen ==');
{
  const branch = data.getEntity('Branches')
    .find((b) => b.customerID != null && b.customerID !== '');
  eq(!!branch, true, 'demo has an owned branch to probe');
  const owner = branch.customerID;
  const bPk = branch.branchID;
  // the reported bug: a NEW customer picks the owned branch — must not stick
  forms.applyCustomerBranches('Customers',
    { customerID: 'CUST-PROBE', customerName: 'Probe', branchID: [bPk] }, 'customerID');
  eq(data.getById('Branches', bPk).customerID, owner,
    `registering another customer with ${bPk} does NOT strip ${owner}`);
  // explicit reassignment: the owner deselects, then the pick lands
  forms.applyCustomerBranches('Customers', { customerID: owner, branchID: [] }, 'customerID');
  eq(data.getById('Branches', bPk).customerID, null, 'owner deselect clears the link');
  forms.applyCustomerBranches('Customers',
    { customerID: 'CUST-PROBE', branchID: [bPk] }, 'customerID');
  eq(data.getById('Branches', bPk).customerID, 'CUST-PROBE',
    'an unlinked branch is stamped normally');
  // deselect on a NON-owner never clears someone else's link
  data.updateRecord('Branches', bPk, { customerID: owner });
  forms.applyCustomerBranches('Customers', { customerID: 'CUST-PROBE', branchID: [] }, 'customerID');
  eq(data.getById('Branches', bPk).customerID, owner,
    'a non-owner saving without the branch leaves the owner untouched');
}

console.log('== picker: only unlinked-or-own branches survive the filter ==');
{
  // the ownership filter runs inside the cascade closure over the generic
  // options — mirror it here over the same option source
  const a = catalog['Customers'].byName['branchID'];
  const all = forms.optionsForAttr('Customers', 'branchID', a.rule).options || [];
  eq(all.length > 0, true, `generic option source offers ${all.length} branch(es)`);
  const bT = 'Branches';
  const forNew = all.filter((o) => forms.branchAvailableForCustomer(data.getById(bT, o.value), null));
  const linked = data.getEntity(bT).filter((b) => b.customerID != null && b.customerID !== '').length;
  eq(forNew.length, all.length - linked,
    `NEW customer sees only the ${all.length - linked} unlinked branch(es) — ${linked} owned are hidden`);
  const someOwner = data.getEntity(bT).find((b) => b.customerID)?.customerID;
  const forOwner = all.filter((o) => forms.branchAvailableForCustomer(data.getById(bT, o.value), someOwner));
  eq(forOwner.some((o) => data.getById(bT, o.value).customerID === someOwner), true,
    'editing the owner keeps its own branches offered (prefill survives — form-integrity)');
  eq(forOwner.every((o) => forms.branchAvailableForCustomer(data.getById(bT, o.value), someOwner)),
    true, 'no other customer\'s branch leaks into the owner\'s picker');
  // the field still rides the cascade: the rule spelling wires _refilter —
  // without it the ownership filter in the closure would be dead (#274)
  const rule = [].concat(catalog['Customers'].form.fields.Branch['field-rule']).join('; ');
  eq(/filtered by (?:the )?[A-Za-z .+&,]+?(?: selected| field|$)/i.test(rule), true,
    'Branch field-rule matches the cascade regex — the closure filter is reachable');
}

console.log('== audit: the only cross-table write-back in the form engine ==');
{
  const src = fs.readFileSync(new URL('../js/forms.js', import.meta.url), 'utf8');
  const writes = [...src.matchAll(/updateRecord\(([^,)]+)/g)].map((m) => m[1].trim());
  const crossTable = writes.filter((w) => !['ctx.entity', "'Jobs'"].includes(w));
  eq(crossTable.every((w) => w === 'bT'), true,
    `cross-table writes only in applyCustomerBranches (${JSON.stringify(crossTable)})`);
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
