#!/usr/bin/env node
// test_engine_ticket_input_flag.mjs — unit-test the Ticket Inputs chain
// (issue #280; re-sourced by issue #324): the TICKET-INPUTS rule kind and
// the Tickets Inputs subitem tab — for each task of the ticket's processes
// the live inherited requirement set (#226) narrows the procedures to
// exactly ONE (#270 AND coverage; GAP/ambiguous tasks contribute nothing)
// and the inputs in that procedure's OWN customerInputID set collect,
// deduped (the handout-level customerFlag and its form switch are RETIRED —
// the per-procedure decision is proven in
// test_engine_procedure_customer_inputs.mjs).
// Run from prototype/:  node tools/test_engine_ticket_input_flag.mjs

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

console.log('== schema: the handout-level flag RETIRED (issue #324) ==');
{
  eq(dm._meta.schemaVersion >= 57, true, `schemaVersion ${dm._meta.schemaVersion} >= 57`);
  eq(catalog['Handouts'].byName['customerFlag'], undefined,
    'customerFlag attr left the Handouts schema');
  eq(catalog['Handouts'].form.fields['Customer Input'], undefined,
    'the Customer Input switch left the Handouts form');
  const rows = data.getEntity('Handouts');
  eq(rows.every((h) => !('customerFlag' in h)), true,
    'no handout row carries the retired key (parity — removed attrs leave the data)');
  const withCi = data.getEntity('Procedures')
    .filter((p) => asList(p.customerInputID).length);
  eq(withCi.length > 0, true,
    `${withCi.length} procedures declare customer inputs (the decision lives there now)`);
}

console.log('== rule + tab: TICKET-INPUTS drives the Inputs subitem ==');
{
  const a = catalog['Tickets'].byName['inputHandoutID'];
  const r = model.parseRule(a.rule);
  eq([r.kind, r.srcField, r.display], ['ticketinputs', 'processID', 'handoutName'],
    'computed: TICKET-INPUTS(processID) (display: handoutName) parses');
  const tab = catalog['Tickets'].subitems.find((si) => si.tab && si.tab.name === 'Inputs');
  eq(tab != null, true, 'the Tickets Inputs tab is declared');
  eq([tab.table, tab.via, tab.tab.order], ['Handouts', 'inputHandoutID', 3],
    'tab lists Handouts via the TICKET-INPUTS attr, third tab');
}

console.log('== chain: unique procedure per task → its customer inputs, deduped ==');
{
  const tickets = data.getEntity('Tickets');
  // manual expectation, computed independently of ticketInputHandouts —
  // membership in the procedure's OWN customerInputID set since issue #324
  const expect = (t) => {
    const need = resolve.ticketRequirements(t).map(String);
    const procIds = asList(t.processID);
    const seen = new Set(); const out = [];
    for (const task of data.getEntity('Tasks')) {
      if (!procIds.some((p) => asList(task.processID).includes(p) || task.processID === p)) continue;
      const cands = data.getEntity('Procedures')
        .filter((p) => asList(p.taskID).includes(task.taskID) || p.taskID === task.taskID)
        .filter((p) => {
          const set = asList(p.requirementID).map(String);
          return !set.length || need.every((r) => set.includes(r));
        });
      if (cands.length !== 1) continue; // GAP or ambiguity — no inputs
      const wanted = asList(cands[0].customerInputID).map(String);
      for (const hid of asList(cands[0].taskInput)) {
        if (seen.has(String(hid)) || !wanted.includes(String(hid))) continue;
        const h = data.getById('Handouts', hid);
        if (!h) continue;
        seen.add(String(hid));
        out.push(h.handoutID);
      }
    }
    return out;
  };
  let withInputs = 0;
  let allMatch = true;
  for (const t of tickets) {
    const got = resolve.ticketInputHandouts(t).map((h) => h.handoutID);
    if (JSON.stringify(got) !== JSON.stringify(expect(t))) allMatch = false;
    if (got.length) withInputs += 1;
  }
  eq(allMatch, true, 'ticketInputHandouts matches the manual derivation on every ticket');
  eq(withInputs > 0, true,
    `${withInputs}/${tickets.length} demo tickets list customer inputs (${tickets.length - withInputs} honestly empty)`);

  // ambiguity kills the contribution: duplicate a resolved task's procedure
  // — two candidates = GAP (#270) — its inputs must drop out
  const t = tickets.find((x) => resolve.ticketInputHandouts(x).length);
  const before = resolve.ticketInputHandouts(t).map((h) => h.handoutID);
  const need = resolve.ticketRequirements(t).map(String);
  const task = data.getEntity('Tasks').find((tk) =>
    asList(t.processID).some((p) => asList(tk.processID).includes(p) || tk.processID === p)
    && data.getEntity('Procedures').filter((p) => p.taskID === tk.taskID)
      .filter((p) => { const s = asList(p.requirementID).map(String);
        return !s.length || need.every((r) => s.includes(r)); }).length === 1);
  const orig = data.getEntity('Procedures').find((p) => p.taskID === task.taskID);
  const clone = { ...orig, procedureID: 'PRC-T1', requirementID: [] }; // wildcard twin
  data.getEntity('Procedures').push(clone);
  const after = resolve.ticketInputHandouts(t).map((h) => h.handoutID);
  eq(after.length <= before.length, true,
    'a second covering procedure (wildcard twin) GAPs the task — inputs shrink or hold');
  eq(after.some((id) => asList(orig.customerInputID).includes(id))
    && asList(orig.customerInputID).length > 0, false,
  "the ambiguous task's customer inputs are gone");
  data.getEntity('Procedures').pop();

  // (the #218 strict-boolean gate retired with the handout flag — the
  // per-procedure membership gate is proven in
  // test_engine_procedure_customer_inputs.mjs, incl. the legacy rung)
}

console.log('== display: derivedValue joins the flagged names ==');
{
  const a = catalog['Tickets'].byName['inputHandoutID'];
  const t = data.getEntity('Tickets').find((x) => resolve.ticketInputHandouts(x).length);
  const want = resolve.ticketInputHandouts(t).map((h) => h.handoutName).join(', ');
  eq(resolve.derivedValue('Tickets', a, t), want, `names join for the drawer ("${want}")`);
  const bare = { ticketID: 'TK-T1', processID: [] };
  eq(resolve.derivedValue('Tickets', a, bare), '—', 'no processes → dash (no gap-tag: empty is legitimate)');
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
