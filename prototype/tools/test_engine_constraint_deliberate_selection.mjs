#!/usr/bin/env node
// test_engine_constraint_deliberate_selection.mjs — the deliberate-selection
// rule (Rafael, sv109): once the user ENGAGES the ticket's Constraints
// input (≥1 pick), the OFFERED selectable requirements that were NOT picked
// are a deliberate exclusion — they leave the ticket's inheritance;
// requirements never offered there (not selectable / another unit) inherit
// normally. ZERO picks = no decision — the inheritance stays untouched
// (session decision: an ignored optional input must not silently strip
// requirements; the demo seeds carry empty picks → 0 flips at rest).
// Modeled on the reported case (edqms_session TIC-1: "Northwind Energy
// Design" offered + unpicked → out; "3rd Party Design" picked → stays).
// Run from prototype/:  node tools/test_engine_constraint_deliberate_selection.mjs

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

const dm = JSON.parse(fs.readFileSync('data/datamodel.json', 'utf-8'));

console.log('== schema: sv109, the rule on the keys ==');
{
  eq(dm._meta.schemaVersion >= 109, true, `schemaVersion ${dm._meta.schemaVersion} >= 109`);
  eq(/sv109|deliberate/i.test(String(catalog['Tickets'].byName.constraintID.notes)), true,
    'constraintID notes record the deliberate-selection rule');
  eq(typeof resolve.selectableConstraintIds, 'function',
    'the offered-set core is shared (selectableConstraintIds in resolve.js)');
}

console.log('== the TIC-1 shape: two offered, one picked ==');
{
  // a ticket inheriting ≥2 OFFERED selectables (the demo has them by
  // construction — 8 selectable requirements, empty picks everywhere)
  const probe = (() => {
    for (const t of data.getEntity('Tickets')) {
      const offered = resolve.selectableConstraintIds(asList(t.businessUnitID)[0] ?? null);
      const inh = resolve.ticketRequirements(t).map(String).filter((id) => offered.includes(id));
      if (inh.length >= 2) return { t, inh };
    }
    return null;
  })();
  eq(!!probe, true, `a ticket inheriting ≥2 offered selectables exists (${probe && probe.t.ticketID})`);
  const { t, inh } = probe;
  const [keep, drop] = inh;
  const before = resolve.ticketRequirements(t).map(String).sort();
  const savedPicks = t.constraintID;
  // engage the input: pick ONE of the offered selectables
  t.constraintID = [keep];
  const after = resolve.ticketRequirements(t).map(String);
  eq(after.includes(keep), true, 'the PICKED constraint stays inherited');
  eq(after.includes(drop), false,
    'the offered-but-UNPICKED selectable leaves the inheritance (deliberate exclusion)');
  // requirements never offered there are untouched
  const unoffered = before.filter((id) => !resolve.selectableConstraintIds(asList(t.businessUnitID)[0]).includes(id));
  eq(unoffered.every((id) => after.includes(id)), true,
    'requirements never offered as Constraints inherit normally');
  // disengage: zero picks = no decision — everything returns
  t.constraintID = [];
  eq(resolve.ticketRequirements(t).map(String).sort(), before,
    'zero picks = no decision — the inheritance is untouched (session decision)');
  t.constraintID = savedPicks;
}

console.log('== downstream: the dispatch re-evaluates under the narrowed set ==');
{
  // picking constraints shrinks `need` — the procedure resolution follows
  const t = data.getEntity('Tickets').find((tk) => {
    const offered = resolve.selectableConstraintIds(asList(tk.businessUnitID)[0] ?? null);
    return resolve.ticketRequirements(tk).map(String).some((id) => offered.includes(id));
  });
  const savedPicks = t.constraintID;
  const needBefore = resolve.ticketRequirements(t);
  const offered = resolve.selectableConstraintIds(asList(t.businessUnitID)[0]);
  const anyOffered = needBefore.map(String).find((id) => offered.includes(id));
  t.constraintID = [anyOffered];
  const needAfter = resolve.ticketRequirements(t);
  eq(needAfter.length <= needBefore.length, true,
    'the inherited set never GROWS under picks (the rule only removes)');
  eq(needAfter.map(String).includes(String(anyOffered)), true, 'the pick survives');
  t.constraintID = savedPicks;
}

console.log('== census: the rule sleeps on the demo (empty picks everywhere) ==');
{
  const tickets = data.getEntity('Tickets');
  eq(tickets.filter((t) => asList(t.constraintID).length).length, 0,
    'no demo ticket engages the Constraints input — 0 flips at rest');
  eq(tickets.filter((t) => resolve.ticketRequirements(t).length === 0).length, 0,
    'all 160 tickets keep a non-empty inheritance');
  let withInputs = 0;
  for (const t of tickets) if (resolve.ticketInputHandouts(t).length) withInputs += 1;
  eq(withInputs, 137, 'TICKET-INPUTS census preserved (137/160)');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
