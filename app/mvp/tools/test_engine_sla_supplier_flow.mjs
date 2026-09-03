#!/usr/bin/env node
// test_engine_sla_supplier_flow.mjs — proof suite for the 2026-09-03
// supplier-flow round (schemaVersion 68, authored datamodel edits):
//   • Customers.customerType relabelled to Internal | External (the
//     dedicated Supplier type left the enum; the three clinic supplier
//     companies are External now — session decision);
//   • Payload.departmentID — new stored FK → Departments (authored spec
//     wrote a rollup via the unit — normalized: the form select and the
//     SLA Payloads department filter need the stored key), seeded from the
//     event's processes' department, honest null when no process chains;
//   • SLA form re-flow: Business Unit → Branch (gated on the unit) →
//     Supplier (the customer the branch points at — bespoke
//     suppliersForBranch; lenient without a branch) → Supplier Department
//     (departments of the supplier's units — generic shared-unit join) →
//     Customer → Payloads (filtered by the chosen department) → Status.
// Run from prototype/:  node tools/test_engine_sla_supplier_flow.mjs

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
const asList = (v) => (Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]));

console.log('== schema: Payload gains its supplying department ==');
{
  eq(model.getSchemaVersion() >= 68, true, `schemaVersion ${model.getSchemaVersion()} >= 68`);
  const cat = catalog['Payload'];
  const bu = model.parseRule(cat.byName['businessUnitID'].rule);
  eq([bu.kind, bu.target], ['fk', 'Business Units'],
    'businessUnitID casing restored (the authored edit lowercased the whole attr)');
  const dep = model.parseRule(cat.byName['departmentID'].rule);
  eq([dep.kind, dep.target, dep.display], ['fk', 'Departments', 'departmentName'],
    'departmentID is a stored FK → Departments (authored rollup-via-unit normalized)');
  eq(forms.requiredAttrs('Payload').has('departmentID'), false,
    'departmentID nullable — an event chaining no process leaves it honestly empty');
  const ct = catalog['Customers'].byName['customerType'].rule;
  eq(/'Internal'.*'External'/.test(ct) && !/Client|Supplier/.test(ct), true,
    'customerType enum is Internal | External');
}

console.log('== form spelling: the supplying chain (live datamodel) ==');
{
  const dmRaw = JSON.parse(fs.readFileSync('data/datamodel.json', 'utf-8'));
  const f = dmRaw.modules.CRM.tables.SLA.form.fields;
  eq(Object.keys(f), ['Code', 'Business Unit', 'Branch', 'Supplier', 'Supplier Department',
    'Customer', 'Payloads', 'Status'], 'SLA field order follows the supplying chain');
  eq(f.Branch.check, 'Business Unit IS NOT NULL', 'Branch gated on the unit (session decision)');
  eq(f.Branch['field-rule'], 'filtered by businessUnitID selected', 'Branch offers the unit\'s branches');
  eq(f.Supplier['field-rule'], 'SelectLabel = customerType; filtered by branchID selected',
    'Supplier rule carries the cascade spelling (a bespoke dispatch branch is DEAD without it — #274 trap)');
  eq(f['Supplier Department'].attribute, 'departmentID', 'Supplier Department binds SLA.departmentID');
  eq(f['Supplier Department']['field-rule'], 'filtered by supplierID selected',
    'Supplier Department filtered by the supplier (generic shared-unit join)');
  const plRule = f.Payloads['field-rule'].join('; ');
  eq(plRule.includes('filtered by departmentID selected'), true,
    'Payloads picker filtered by the supplying department');
  const pf = dmRaw.modules.Operation.tables.Payload.form.fields;
  eq([pf.Department.attribute, pf.Department['field-rule']],
    ['departmentID', 'filtered by businessUnitID selected'],
    'Payload form Department select: stored FK, unit-filtered (generic stored-key cascade)');
}

console.log('== suppliersForBranch: the supplier inside the branch ==');
{
  const all = data.getEntity('Customers').length;
  eq(forms.suppliersForBranch(null).length, all, 'no branch — every customer (lenient)');
  const br = data.getEntity('Branches').find((b) => b.customerID);
  const single = forms.suppliersForBranch(br.branchID);
  eq(single.map((o) => String(o.value)), [String(br.customerID)],
    `branch ${br.branchID} offers exactly its owning customer`);
  data.addRecord('Branches', { branchID: 'BR-GHOST', branchName: 'Ghost', customerID: null });
  eq(forms.suppliersForBranch('BR-GHOST').length, all,
    'branch pointing at no customer — every customer (lenient)');
}

console.log('== generic paths: preconditions hold ==');
{
  eq(model.childKeyFor('Payload', 'Departments'), 'departmentID',
    'Payloads picker resolves the stored-key cascade (Payload.departmentID)');
  // Supplier Department: departments of the supplier's units via the
  // shared-unit join (Customers.businessUnitID × Departments.businessUnitID)
  const sup = data.getEntity('Customers').find((c) => asList(c.businessUnitID).length);
  const kids = resolve.childrenOf('Customers', sup, 'Departments');
  const units = asList(sup.businessUnitID).map(String);
  eq(kids.length > 0, true, `supplier ${sup.customerID} reaches ${kids.length} department(s)`);
  eq(kids.every((d) => units.includes(String(d.businessUnitID))), true,
    'every offered department belongs to one of the supplier\'s units');
}

console.log('== seeds: payload departments from the event\'s processes ==');
{
  const payloads = data.getEntity('Payload');
  eq(payloads.every((p) => 'departmentID' in p), true, 'every payload carries the key (parity)');
  // independent walk of the migration rule: first non-empty department among
  // the processes chaining the payload's event, in Processes row order
  const byEvent = {};
  for (const pr of data.getEntity('Processes')) {
    for (const ev of asList(pr.eventID)) {
      (byEvent[String(ev)] = byEvent[String(ev)] || []).push(pr.departmentID);
    }
  }
  const want = (p) => (byEvent[String(p.eventID)] || []).filter(Boolean)[0] ?? null;
  eq(payloads.filter((p) => (p.departmentID ?? null) !== want(p)).map((p) => p.payloadID), [],
    'each departmentID equals the first process-derived department (null = no process chains)');
}

console.log('== seeds: SLA edit-integrity invariants ==');
{
  const custById = new Map(data.getEntity('Customers').map((c) => [String(c.customerID), c]));
  const deptUnit = new Map(data.getEntity('Departments').map((d) => [String(d.departmentID), String(d.businessUnitID)]));
  const pDept = new Map(data.getEntity('Payload').map((p) => [String(p.payloadID), p.departmentID]));
  const slas = data.getEntity('SLA');
  // the Supplier Department picker (departments of the supplier's units) must
  // keep offering the seeded department — else editing wipes the stored FK
  const outside = slas.filter((s) => {
    const sup = custById.get(String(s.supplierID));
    return !sup || !asList(sup.businessUnitID).map(String).includes(deptUnit.get(String(s.departmentID)));
  });
  eq(outside.map((s) => s.slaID), [], 'every SLA department sits inside its supplier\'s units');
  // majority alignment: the seeded department is the majority supplying
  // department of the purchased payloads (first-seen tiebreak) when derivable
  const majority = (pids) => {
    const counts = new Map();
    for (const pid of pids) {
      const d = pDept.get(String(pid));
      if (d) counts.set(d, (counts.get(d) || 0) + 1);
    }
    let best = null;
    for (const [d, n] of counts) if (best == null || n > counts.get(best)) best = d;
    return best;
  };
  const misaligned = slas.filter((s) => {
    const m = majority(asList(s.payloadID));
    return m != null && m !== s.departmentID;
  });
  eq(misaligned.map((s) => s.slaID), [],
    'SLA departments follow the majority of their payloads (Payloads-picker edit survival)');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
