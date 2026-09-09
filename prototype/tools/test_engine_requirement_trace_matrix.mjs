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
// Plus explicit per-trace probes: the customer dimension through EACH party
// (customer / applicant / SUPPLIER), the branch dimension through project
// and each party's registration, the region dimension through the unit's
// served regions AND through a related branch's region.
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
// a non-empty branch context and admitted product scopes ----
const branchesOf = (cid) => data.getEntity('Branches')
  .filter((b) => asList(b.customerID).map(String).includes(String(cid)))
  .map((b) => String(b.branchID));
const t = data.getEntity('Tickets').find((tk) => tk.customerID && tk.applicantID && tk.supplierID
  && resolve.ticketAdmittedScopeIds(tk).length
  && (branchesOf(tk.customerID).length || branchesOf(tk.applicantID).length
    || branchesOf(tk.supplierID).length));
eq(!!t, true, `rich-context probe ticket found (${t && t.ticketID})`);

const adm = resolve.ticketAdmittedScopeIds(t);
const psRow = data.getById('Product Scopes', adm[0]);
const unit = data.getById('Business Units', asList(t.businessUnitID)[0]);
const served = asList(unit.regionID).map(String);
const branchCtx = [...new Set([
  ...(t.projectID && data.getById('Projects', t.projectID)?.branchID
    ? [String(data.getById('Projects', t.projectID).branchID)] : []),
  ...branchesOf(t.customerID), ...branchesOf(t.applicantID), ...branchesOf(t.supplierID),
])];
const branchRegions = branchCtx.flatMap((bid) => asIds(data.getById('Branches', bid)?.regionID))
  .map(String);
function asIds(v) { return asList(v); }

// per-dimension MATCH and MISMATCH values (mismatch = foreign to EVERY trace)
const DIMS = [
  { key: 'customerID', match: [t.supplierID], mismatch: ['CUST-NOPE'] }, // via the SUPPLIER — the widest party
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
  eq(probe({ customerID: [t.supplierID] }), true, 'customer-pinned → traces via the SUPPLIER (sv106 comprehensive)');
  for (const [label, cid] of [['customer', t.customerID], ['applicant', t.applicantID], ['supplier', t.supplierID]]) {
    const bs = branchesOf(cid);
    if (bs.length) eq(probe({ branchID: [bs[0]] }), true, `branch-pinned → traces via the ${label}'s branch`);
  }
  if (served.length) eq(probe({ regionID: [served[0]] }), true, 'region-pinned → traces via the unit\'s served regions (#230)');
  if (branchRegions.length) {
    eq(probe({ regionID: [branchRegions[0]] }), true,
      'region-pinned → traces via a related BRANCH\'s region (sv106 comprehensive)');
  }
  eq(probe({ scopeID: [asList(psRow.scopeID)[0]] }), true, 'scope-pinned → traces via an admitted product scope');
  eq(probe({ productGroupID: [asList(psRow.productGroupID)[0]] }), true, 'pg-pinned → traces via an admitted product scope');
  eq(probe({ scopeID: [asList(psRow.scopeID)[0]], productGroupID: ['PG-NOPE'] }), false,
    'scope+pg pair on DIFFERENT rows does not trace (the #192 pairing — the combination is the target)');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
