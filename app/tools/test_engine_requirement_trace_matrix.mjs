#!/usr/bin/env node
// test_engine_requirement_trace_matrix.mjs — the COMPREHENSIVENESS proof of
// requirement inheritance (Rafael, sv106): "the rule must hold for ANY
// combination of declared requirement dimensions that finds a trace in the
// ticket's parameters". Exhaustive matrix: every one of the 3^7 = 2187
// combinations of {declared-MATCHING, declared-MISMATCHING, UNDECLARED}
// across the seven applicability dimensions is built as a requirement and
// checked against the oracle:
//     inherits ⇔ NO dimension is declared-mismatching
// (declared-matching passes, undeclared skips — AND across dimensions).
// Plus explicit per-trace probes: the customer dimension through the #308
// pair (customer / applicant — the SUPPLIER is deliberately excluded since
// sv108: it answers requirements, it does not impose them), the branch
// dimension through the ticket's OUTPUT branch only (the input below the
// Applicant — Customer/Supplier registrations no longer trace), the region
// dimension through the unit's served regions AND the output branch's
// region.
// Run from prototype/:  node tools/test_engine_requirement_trace_matrix.mjs

import fs from 'fs';
globalThis.fetch = async (p) => new Response(fs.readFileSync(p));

const model = await import('../js/model.js');
const data = await import('../js/data.js');
const { catalog } = await model.loadModel();
data.initMeta(catalog);
await data.loadData();
const resolve = await import('../js/resolve.js');

let fails = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails += 1; console.log(`  ✗ ${m}`); };
const eq = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));
const asList = (v) => (Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]));

// ---- a ticket with the RICHEST context: customer + applicant + supplier,
// a stored OUTPUT branch (sv108) and admitted product scopes ----
const branchesOf = (cid) => data.getEntity('Branches')
  .filter((b) => asList(b.customerID).map(String).includes(String(cid)))
  .map((b) => String(b.branchID));
const t = data.getEntity('Tickets').find((tk) => tk.customerID && tk.applicantID && tk.supplierID
  && tk.branchID && resolve.ticketAdmittedScopeIds(tk).length);
eq(!!t, true, `rich-context probe ticket found (${t && t.ticketID})`);

const adm = resolve.ticketAdmittedScopeIds(t);
const psRow = data.getById('Product Scopes', adm[0]);
const unit = data.getById('Business Units', asList(t.businessUnitID)[0]);
const served = asList(unit.regionID).map(String);
// sv108: the branch context is the ticket's OWN output branch only
const branchCtx = [String(t.branchID)];
const branchRegions = branchCtx.flatMap((bid) => asIds(data.getById('Branches', bid)?.regionID))
  .map(String);
function asIds(v) { return asList(v); }

// per-dimension MATCH and MISMATCH values (mismatch = foreign to EVERY trace)
const DIMS = [
  { key: 'customerID', match: [t.applicantID], mismatch: [t.supplierID] }, // supplier NEVER traces (sv108)
  { key: 'businessUnitID', match: [asList(t.businessUnitID)[0]], mismatch: ['BU-NOPE'] },
  { key: 'regionID', match: [served[0] ?? branchRegions[0]], mismatch: ['RG-NOPE'] },
  { key: 'branchID', match: [branchCtx[0]], mismatch: ['BR-NOPE'] },
  { key: 'scopeID', match: [asList(psRow.scopeID)[0]], mismatch: ['SC-NOPE'] },
  { key: 'productGroupID', match: [asList(psRow.productGroupID)[0]], mismatch: ['PG-NOPE'] },
  { key: 'productScopeID', match: [psRow.productScopeID], mismatch: ['PS-NOPE'] },
];
eq(DIMS.every((d) => d.match[0] != null), true,
  'every dimension has a real trace on the probe ticket');

console.log('== exhaustive matrix: 3^7 combinations vs the oracle ==');
{
  let mismatches = 0; let tested = 0; let firstBad = null;
  for (let mask = 0; mask < Math.pow(3, 7); mask += 1) {
    let m = mask;
    const rec = { requirementID: 'RQ-MTX', requirementName: 'Matrix (t)', isActive: 'Active' };
    let anyForeign = false;
    for (const d of DIMS) {
      const state = m % 3; m = Math.floor(m / 3); // 0 = undeclared, 1 = match, 2 = mismatch
      if (state === 0) rec[d.key] = [];
      else if (state === 1) rec[d.key] = d.match;
      else { rec[d.key] = d.mismatch; anyForeign = true; }
    }
    data.addRecord('Requirements', rec);
    const got = resolve.ticketRequirements(t).map(String).includes('RQ-MTX');
    data.removeRecords('Requirements', ['RQ-MTX']);
    const want = !anyForeign; // oracle: inherits ⇔ no declared dimension mismatches
    tested += 1;
    if (got !== want && !firstBad) firstBad = { mask, rec: { ...rec }, got, want };
    if (got !== want) mismatches += 1;
  }
  eq(mismatches, 0, `all ${tested} combinations agree with the oracle (inherits ⇔ no foreign declared dimension)`);
  if (firstBad) console.log('  first divergence:', JSON.stringify(firstBad));
}

console.log('== explicit traces: every party and every region path ==');
{
  const probe = (extra) => {
    data.addRecord('Requirements', { requirementID: 'RQ-TRC', requirementName: 'Trace (t)',
      isActive: 'Active', regionID: [], businessUnitID: [], branchID: [], customerID: [],
      scopeID: [], productGroupID: [], productScopeID: [], ...extra });
    const got = resolve.ticketRequirements(t).map(String).includes('RQ-TRC');
    data.removeRecords('Requirements', ['RQ-TRC']);
    return got;
  };
  eq(probe({ customerID: [t.customerID] }), true, 'customer-pinned → traces via the ticket CUSTOMER');
  eq(probe({ customerID: [t.applicantID] }), true, 'customer-pinned → traces via the APPLICANT (#308)');
  // sv108 conceptual fix: a supplier must not impose requirements on a
  // request it must itself resolve — supplier-pinned requirements are
  // fully IGNORED by the ticket
  eq(String(t.supplierID) !== String(t.customerID)
    && String(t.supplierID) !== String(t.applicantID), true,
  'probe precondition: the supplier is a distinct party');
  eq(probe({ customerID: [t.supplierID] }), false,
    'supplier-pinned requirement NEVER inherits (sv108 — the supplier answers, it does not impose)');
  eq(probe({ branchID: [String(t.branchID)] }), true,
    'branch-pinned → traces via the ticket\'s OUTPUT branch (the input below Applicant)');
  const foreignBr = data.getEntity('Branches').find((b) => String(b.branchID) !== String(t.branchID)
    && [t.customerID, t.supplierID].some((cid) => branchesOf(cid).includes(String(b.branchID))));
  if (foreignBr) {
    eq(probe({ branchID: [String(foreignBr.branchID)] }), false,
      'a branch reachable only through Customer/Supplier registrations does NOT trace (sv108)');
  }
  if (served.length) eq(probe({ regionID: [served[0]] }), true, 'region-pinned → traces via the unit\'s served regions (#230)');
  if (branchRegions.length) {
    eq(probe({ regionID: [branchRegions[0]] }), true,
      'region-pinned → traces via the OUTPUT branch\'s region');
  }
  eq(probe({ scopeID: [asList(psRow.scopeID)[0]] }), true, 'scope-pinned → traces via an admitted product scope');
  eq(probe({ productGroupID: [asList(psRow.productGroupID)[0]] }), true, 'pg-pinned → traces via an admitted product scope');
  eq(probe({ scopeID: [asList(psRow.scopeID)[0]], productGroupID: ['PG-NOPE'] }), false,
    'scope+pg pair on DIFFERENT rows does not trace (the #192 pairing — the combination is the target)');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
