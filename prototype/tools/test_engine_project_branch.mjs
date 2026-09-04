#!/usr/bin/env node
// test_engine_project_branch.mjs — proof suite for the Project Branch round
// (2026-09-04, schema v72): Projects gain `branchID` — the customer's
// contracting branch the project runs under. The form Branch select sits
// between Customer and SLA (gated on Customer, generic stored-key cascade —
// Branches store customerID), and the SLA picker narrows to the (customer,
// branch) pair via slasForProject: an SLA without a branch is not
// branch-specific and stays offered (Q1 — the strict generic arrOverlap
// path would drop it); no branch chosen → the customer's full set.
// Run from prototype/:  node tools/test_engine_project_branch.mjs

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
const ids = (opts) => opts.map((o) => String(o.value)).sort();

console.log('== schema: the branch dimension on Projects ==');
{
  eq(model.getSchemaVersion() >= 72, true, `schemaVersion ${model.getSchemaVersion()} >= 72`);
  const a = catalog['Projects'].byName['branchID'];
  const r = model.parseRule(a.rule);
  eq([r.kind, r.target, r.display], ['fk', 'Branches', 'branchName'],
    'branchID is a stored FK → Branches displaying branchName');
  eq(forms.requiredAttrs('Projects').has('branchID'), false,
    'nullable — a customer may have no branch (#179 posture)');
  const projects = data.getEntity('Projects');
  eq(projects.every((p) => Object.prototype.hasOwnProperty.call(p, 'branchID')), true,
    `parity: every project row carries the key (${projects.length} rows)`);
  eq(projects.every((p) => p.branchID == null), true,
    'census: honest nulls — no linked SLA pins a branch (unanimity seed rule)');
}

console.log('== form: Branch between Customer and SLA ==');
{
  const f = catalog['Projects'].form.fields;
  const keys = Object.keys(f);
  eq(f.Branch.attribute, 'branchID', 'Branch binds branchID');
  eq(keys.indexOf('Branch') - keys.indexOf('Customer'), 1, 'Branch follows Customer');
  eq(keys.indexOf('SLA') - keys.indexOf('Branch'), 1, 'SLA follows Branch');
  eq(f.Branch.check, 'Customer IS NOT NULL', 'gated on Customer');
  // the cascade regex from forms.js — a rule that does not match it wires NO
  // listeners and the dispatch branch is dead in the DOM (the #274 trap)
  const CASCADE = /filtered by (?:the )?([A-Za-z .+&,]+?)(?: selected| field|$)/i;
  const mBr = String(f.Branch['field-rule']).match(CASCADE);
  eq(mBr && mBr[1].trim(), 'Customer',
    'Branch cascade names Customer — generic stored-key path (Branches.customerID)');
  const slaRule = [].concat(f.SLA['field-rule']).join('; ');
  eq(/allow multiple/i.test(slaRule), true, 'SLA keeps the multi spelling');
  const mSla = slaRule.match(CASCADE);
  const parts = mSla
    ? mSla[1].split(/\s*(?:\+|&&|,|\band\b)\s*/i).map((s) => s.trim()).filter(Boolean) : [];
  eq(parts, ['Customer', 'Branch'],
    'SLA cascade names BOTH deps — listeners attach to Customer and Branch (#274)');
}

console.log('== branch picker: generic-path preconditions ==');
{
  const a = catalog['Projects'].byName['branchID'];
  const opt = forms.optionsForAttr('Projects', 'branchID', a.rule);
  eq(opt.target, 'Branches', 'picker sourced from Branches');
  eq(opt.options.length > 0, true, `picker offers ${opt.options.length} branch(es)`);
  const byName = new Map(data.getEntity('Branches')
    .map((b) => [String(b.branchID), b.branchName]));
  eq(opt.options.every((o) => o.label === byName.get(String(o.value))), true,
    'options labelled branchName');
  eq(data.getEntity('Branches').some((b) => b.customerID != null && b.customerID !== ''),
    true, 'Branches store customerID — the stored-key cascade filters by the selected customer');
}

console.log('== slasForProject: the (customer, branch) pair ==');
{
  const slas = data.getEntity('SLA');
  const byCust = new Map();
  for (const s of slas) {
    const k = String(s.customerID);
    byCust.set(k, [...(byCust.get(k) || []), s]);
  }
  const pair = [...byCust.entries()].find(([, v]) => v.length >= 2);
  eq(!!pair, true, 'demo has a customer with 2+ contracts');
  const [custId, custSlas] = pair;
  eq(ids(forms.slasForProject(null)), ids(slas.map((s) => ({ value: s.slaID }))),
    'no customer → every SLA (lenient — the field is gated on Customer anyway)');
  const mine = forms.slasForProject(custId);
  eq(ids(mine), custSlas.map((s) => String(s.slaID)).sort(),
    'customer → exactly its contracts (the pre-round behavior)');
  const sample = custSlas[0];
  eq(mine.find((o) => String(o.value) === String(sample.slaID)).label, sample.slaCode,
    'options labelled slaCode (the generic display, unchanged)');
  eq(slas.every((s) => s.branchID == null || s.branchID === ''), true,
    'census: no demo SLA pins a branch — the narrowing bites nothing at rest');
  const anyBranch = data.getEntity('Branches')[0].branchID;
  eq(ids(forms.slasForProject(custId, anyBranch)), ids(mine),
    'Q1: branch-less SLAs survive any branch pick (not branch-specific)');
}

console.log('== live pin: a branch-pinned SLA narrows the pair ==');
{
  const slas = data.getEntity('SLA');
  const byCust = new Map();
  for (const s of slas) {
    const k = String(s.customerID);
    byCust.set(k, [...(byCust.get(k) || []), s]);
  }
  const [custId, custSlas] = [...byCust.entries()].find(([, v]) => v.length >= 2);
  const [keep, pin] = custSlas;
  const [brA, brB] = data.getEntity('Branches').map((b) => b.branchID);
  pin.branchID = brA;
  const atA = ids(forms.slasForProject(custId, brA));
  eq(atA.includes(String(pin.slaID)), true, 'pinned SLA offered at its branch');
  eq(atA.includes(String(keep.slaID)), true, 'branch-less sibling stays offered (Q1)');
  const atB = ids(forms.slasForProject(custId, brB));
  eq(atB.includes(String(pin.slaID)), false, 'SLA pinned to ANOTHER branch drops');
  eq(atB.includes(String(keep.slaID)), true, 'branch-less sibling survives everywhere');
  const noBranch = ids(forms.slasForProject(custId));
  eq(noBranch.includes(String(pin.slaID)) && noBranch.includes(String(keep.slaID)), true,
    'no branch chosen → the customer\'s full set (lenient)');
  pin.branchID = null; // restore — later suites share the loaded dataset
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
