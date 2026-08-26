#!/usr/bin/env node
// test_engine_ticket_input_flag.mjs — unit-test the Ticket Input Flag
// (issue #280): the stored BOOLEAN Handouts.customerFlag (Customer Input
// switch on the Handouts form), the TICKET-INPUTS rule kind, and the
// Tickets Inputs subitem tab — for each task of the ticket's processes the
// live inherited requirement set (#226) narrows the procedures to exactly
// ONE (#270 AND coverage; GAP/ambiguous tasks contribute nothing) and that
// procedure's customerFlag = TRUE input handouts collect, deduped.
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

console.log('== schema: the customer flag on Handouts ==');
{
  eq(dm._meta.schemaVersion >= 57, true, `schemaVersion ${dm._meta.schemaVersion} >= 57`);
  const a = catalog['Handouts'].byName['customerFlag'];
  eq(a && a.type, 'BOOLEAN', 'customerFlag is a stored BOOLEAN');
  const fld = catalog['Handouts'].form.fields['Customer Input'];
  eq(fld && fld.attribute, 'customerFlag', 'Customer Input field binds the flag');
  eq(Object.keys(fld['field-type'])[0], 'switch', 'rendered as the single-checkbox switch');
  eq(fld.tooltip, 'Select this checkbox if the provided input should be defined '
    + 'by the customer upon ticket creation.', 'issue tooltip verbatim');
  const rows = data.getEntity('Handouts');
  eq(rows.every((h) => 'customerFlag' in h), true, 'every handout row carries the key (parity)');
  eq(rows.every((h) => typeof h.customerFlag === 'boolean'), true,
    'seeded values are real booleans (#218 posture)');
  const flagged = rows.filter((h) => h.customerFlag === true).map((h) => h.handoutName).sort();
  eq(flagged.length > 0, true, `${flagged.length} customer inputs flagged (${flagged.join(', ')})`);
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

console.log('== chain: unique procedure per task → flagged inputs, deduped ==');
{
  const tickets = data.getEntity('Tickets');
  // manual expectation, computed independently of ticketInputHandouts
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
      for (const hid of asList(cands[0].taskInput)) {
        if (seen.has(String(hid))) continue;
        seen.add(String(hid));
        const h = data.getById('Handouts', hid);
        if (h && h.customerFlag === true) out.push(h.handoutID);
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
  eq(after.some((id) => asList(orig.taskInput).includes(id))
    && asList(orig.taskInput).some((id) => {
      const h = data.getById('Handouts', id); return h && h.customerFlag === true;
    }), false, "the ambiguous task's flagged inputs are gone");
  data.getEntity('Procedures').pop();

  // strict boolean: a string 'true' does not pass the flag gate
  const h0 = resolve.ticketInputHandouts(t)[0];
  const saved = h0.customerFlag;
  h0.customerFlag = 'true';
  eq(resolve.ticketInputHandouts(t).some((h) => h.handoutID === h0.handoutID), false,
    "string 'true' is not a flag (#218 strict-gate posture)");
  h0.customerFlag = saved;
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
