#!/usr/bin/env node
// test_engine_branch_conflict.mjs — proof suite for the branch-conflict saga
// (2026-09-04, schema v74): the customer-branch link is authored on the
// Customer form but STORED on Branches.customerID. The original save
// re-stamped ANY picked branch, silently stripping the older customer; the
// v73 first cut hid owned branches from other customers' pickers, which
// Rafael rejected ("the branch leaves the options menu"). Session decision:
// the link is N:N — `Branches.customerID` is MULTIVALUED, every branch
// stays offered, and the save touches only the SAVING customer's own
// membership (adds to picked, removes from deselected). No steal and no
// hiding, by construction. branchAvailableForCustomer (v73) is RETIRED.
// suppliersForBranch (SLA Supplier, sv68) offers every customer registered
// at the branch. Legacy scalar values are tolerated engine-wide.
// Run from prototype/:  node tools/test_engine_branch_conflict.mjs

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
const list = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);

console.log('== schema: the N:N link ==');
{
  eq(model.getSchemaVersion() >= 74, true, `schemaVersion ${model.getSchemaVersion()} >= 74`);
  const a = catalog['Branches'].byName['customerID'];
  eq(/multivalued/i.test(a.notes || ''), true,
    'Branches.customerID notes declare multivalued (the engine multi flag)');
  const r = model.parseRule(a.rule);
  eq([r.kind, r.target], ['fk', 'Customers'], 'still an FK → Customers');
  eq(/several customers/.test(catalog['Customers'].form.fields.Branch.tooltip), true,
    'tooltip tells the user a branch may serve several customers');
  eq('branchAvailableForCustomer' in forms, false,
    'v73 ownership predicate RETIRED (no hiding, no guard needed under N:N)');
}

console.log('== migration: scalars became honest singletons ==');
{
  const brs = data.getEntity('Branches');
  eq(brs.every((b) => Array.isArray(b.customerID)), true,
    `every branch carries a LIST (${brs.length} rows)`);
  eq(brs.every((b) => b.customerID.length === 1), true,
    'honest singletons — no membership fabricated by the migration');
}

console.log('== save path: each customer only touches its own membership ==');
{
  const branch = data.getEntity('Branches').find((b) => list(b.customerID).length);
  const bPk = branch.branchID;
  const original = [...list(branch.customerID)];
  const owner = original[0];
  // the reported flow: ANOTHER customer picks the same branch — both stay
  forms.applyCustomerBranches('Customers',
    { customerID: 'CUST-NN', customerName: 'Probe', branchID: [bPk] }, 'customerID');
  eq(list(data.getById('Branches', bPk).customerID).sort(), [...original, 'CUST-NN'].sort(),
    `second customer ADDS its membership — ${owner} keeps its link (no steal)`);
  // re-saving the same pick is a no-op (idempotent membership)
  forms.applyCustomerBranches('Customers',
    { customerID: 'CUST-NN', branchID: [bPk] }, 'customerID');
  eq(list(data.getById('Branches', bPk).customerID).length, original.length + 1,
    're-saving the same pick does not duplicate the membership');
  // deselecting removes ONLY the saving customer's link
  forms.applyCustomerBranches('Customers',
    { customerID: 'CUST-NN', branchID: [] }, 'customerID');
  eq(list(data.getById('Branches', bPk).customerID), original,
    'deselect removes only the saving customer — the other membership survives');
  // the owner deselecting leaves the branch honestly empty
  forms.applyCustomerBranches('Customers',
    { customerID: owner, branchID: [] }, 'customerID');
  eq(list(data.getById('Branches', bPk).customerID), [],
    'last member out — the branch keeps an empty list, claimable by anyone');
  data.updateRecord('Branches', bPk, { customerID: original }); // restore
}

console.log('== legacy scalar tolerance (frozen/pre-v74 snapshots) ==');
{
  data.addRecord('Branches', { branchID: 'BR-LEGACY', branchName: 'Legacy probe',
    businessSegmentID: [], businessUnitID: [], departmentID: [],
    customerID: 'CUST-OLD', cityName: null, regionID: null, countryName: null, userID: null });
  forms.applyCustomerBranches('Customers',
    { customerID: 'CUST-NN', branchID: ['BR-LEGACY'] }, 'customerID');
  eq(list(data.getById('Branches', 'BR-LEGACY').customerID).sort(), ['CUST-NN', 'CUST-OLD'],
    'a legacy scalar value becomes a list on the first write — old member kept');
}

console.log('== picker & prefill: every branch offered, memberships prefill ==');
{
  const a = catalog['Branches'].byName['customerID'];
  eq(forms.optionsForAttr('Branches', 'customerID', a.rule).multi, true,
    'the multivalued note drives the engine multi flag');
  const all = forms.optionsForAttr('Customers', 'branchID',
    catalog['Customers'].byName['branchID'].rule).options || [];
  eq(all.length, data.getEntity('Branches').length,
    `the Customers Branch picker offers ALL ${all.length} branches again (no ownership hiding)`);
  // prefill rides presetFor (module-private, arrOverlap on the list key) —
  // the membership resolution it depends on is proven by the reverse-join
  // block below on the same array values
  const shared = data.getEntity('Branches').find((b) => list(b.customerID).length === 1);
  eq(!!list(shared.customerID)[0], true,
    `probe branch ${shared.branchID} linked to ${list(shared.customerID)[0]}`);
}

console.log('== reverse joins: the Customers BRANCH column resolves the array ==');
{
  const branch = data.getEntity('Branches').find((b) => list(b.customerID).length);
  const [cid] = list(branch.customerID);
  const customer = data.getById('Customers', cid);
  const kids = resolve.childrenOf('Customers', customer, 'Branches');
  eq(kids.some((b) => b.branchID === branch.branchID), true,
    'childrenOf(customer → Branches) matches through the LIST key');
  // a second membership joins the same branch under BOTH customers
  const other = data.getEntity('Customers')
    .find((c) => String(c.customerID) !== String(cid));
  const saved = [...list(branch.customerID)];
  data.updateRecord('Branches', branch.branchID, { customerID: [...saved, other.customerID] });
  const kids2 = resolve.childrenOf('Customers', other, 'Branches');
  eq(kids2.some((b) => b.branchID === branch.branchID), true,
    'the SAME branch now also joins under the second customer (N:N both ways)');
  data.updateRecord('Branches', branch.branchID, { customerID: saved });
}

console.log('== suppliersForBranch: every registered customer is a candidate ==');
{
  const branch = data.getEntity('Branches').find((b) => list(b.customerID).length === 1);
  const [cid] = list(branch.customerID);
  eq(forms.suppliersForBranch(branch.branchID).map((o) => o.value), [cid],
    'single membership → that customer (the sv68 behavior, unchanged)');
  const other = data.getEntity('Customers')
    .find((c) => String(c.customerID) !== String(cid));
  const saved = [...list(branch.customerID)];
  data.updateRecord('Branches', branch.branchID, { customerID: [...saved, other.customerID] });
  eq(forms.suppliersForBranch(branch.branchID).map((o) => o.value).sort(),
    [cid, other.customerID].sort(),
    'two memberships → BOTH offered as candidate suppliers');
  data.updateRecord('Branches', branch.branchID, { customerID: [] });
  eq(forms.suppliersForBranch(branch.branchID).length,
    data.getEntity('Customers').length,
    'no membership → every customer (lenient, sv68 posture)');
  data.updateRecord('Branches', branch.branchID, { customerID: saved });
}

console.log('== audit: still the only cross-table write-back in the form engine ==');
{
  const src = fs.readFileSync(new URL('../js/forms.js', import.meta.url), 'utf8');
  const writes = [...src.matchAll(/updateRecord\(([^,)]+)/g)].map((m) => m[1].trim());
  const crossTable = writes.filter((w) => !['ctx.entity', "'Jobs'"].includes(w));
  eq(crossTable.every((w) => w === 'bT'), true,
    `cross-table writes only in applyCustomerBranches (${JSON.stringify(crossTable)})`);
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
