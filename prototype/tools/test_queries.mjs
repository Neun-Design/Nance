#!/usr/bin/env node
// test_queries.mjs — assert every datamodel report and card query produces
// non-degenerate output against the mockup dataset (PROTOTYPE_REVIEW Reports
// note: "Create tests to ensure the tables and queries are correct and satisfy
// every report card"). Run from prototype/:  node tools/test_queries.mjs

import fs from 'fs';
globalThis.fetch = async (p) => new Response(fs.readFileSync(p));

const model = await import('../js/model.js');
const data = await import('../js/data.js');
const { catalog } = await model.loadModel();
data.initMeta(catalog);
await data.loadData();
const { REPORT_QUERIES, CARD_QUERIES } = await import('../js/queries.js');

let fails = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails += 1; console.log(`  ✗ ${m}`); };

// ---- every declared report has a query, and it yields data ----
console.log('== reports ==');
for (const [tname, cat] of Object.entries(catalog)) {
  if (!cat.reports || typeof cat.reports !== 'object') continue;
  for (const key of Object.keys(cat.reports).filter((k) => k.startsWith('Report'))) {
    if (cat.reports[key] == null || typeof cat.reports[key] !== 'object') continue; // empty placeholder slot
    const id = `${tname}::${key}`;
    const q = REPORT_QUERIES[id];
    if (!q) { fail(`${id}: no query implemented`); continue; }
    let spec;
    try { spec = q(data.getEntity(tname)); } catch (e) { fail(`${id}: throws ${e.message}`); continue; }
    if (!spec || !spec.type) { fail(`${id}: no spec returned`); continue; }
    const total = spec.series
      ? spec.series.reduce((s, x) => s + x.data.reduce((a, b) => a + Math.abs(Number(b) || 0), 0), 0)
      : (spec.__pre ? spec.__pre.reduce((s, r) => s + Math.abs(Number(r.__v) || 0), 0) : 1);
    const cats = spec.cats ? spec.cats.length : (spec.__pre ? spec.__pre.length : 1);
    if (cats > 0 && total > 0) ok(`${id}: ${spec.type}, ${cats} categories, total ${Math.round(total)}`);
    else fail(`${id}: degenerate output (cats=${cats}, total=${total})`);
  }
}

// ---- every declared card has a query with a computable main value ----
console.log('== cards ==');
for (const [tname, cat] of Object.entries(catalog)) {
  const entries = Array.isArray(cat.cards) ? cat.cards : (cat.cards ? [cat.cards] : []);
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue;
    for (const [slot, cd] of Object.entries(e)) {
      if (!cd || typeof cd !== 'object' || cd.title === undefined) continue;
      const id = `${tname}::${slot}`;
      const q = CARD_QUERIES[id];
      if (!q) { fail(`${id}: no card query implemented`); continue; }
      let out;
      try { out = q(); } catch (err) { fail(`${id}: throws ${err.message}`); continue; }
      if (out && out.main != null && out.main !== '—' && out.main !== '0') {
        ok(`${id}: main=${JSON.stringify(out.main)} trend=${out.trendPct ?? '–'} detail=${JSON.stringify((out.detail || '').slice(0, 40))}`);
      } else fail(`${id}: degenerate main value ${JSON.stringify(out && out.main)}`);
    }
  }
}

// ---- Capacity::Report-A: available (People.workingHours) vs allocated
//      (Forecast Scopes.estimatedHours), grouped by functionName ----
console.log('== Capacity Report-A (available vs allocated by function) ==');
{
  const spec = REPORT_QUERIES['Capacity::Report-A'](data.getEntity('Capacity'), {});
  const funcs = new Set(data.getEntity('Capacity').map((c) => c.functionName));
  const byFunc = spec.cats.length && spec.cats.every((c) => funcs.has(c));
  const [avail, alloc] = spec.series;
  const availPos = avail.data.every((v) => v > 0);
  const allocPos = alloc.data.every((v) => v > 0);
  if (byFunc && avail.name === 'Available' && alloc.name === 'Allocated' && availPos && allocPos) {
    // over-commit (alloc > avail) is a valid signal of an understaffed function, not an error
    const over = spec.cats.filter((_, i) => alloc.data[i] > avail.data[i]);
    ok(`Capacity::Report-A: ${spec.cats.length} functions, available & allocated all > 0${over.length ? ` (over-committed: ${over.join(', ')})` : ''}`);
  } else {
    fail(`Capacity::Report-A: byFunc=${byFunc} availPos=${availPos} allocPos=${allocPos}`);
  }
  // draft radio reduces (or holds) allocated demand
  const nod = REPORT_QUERIES['Capacity::Report-A'](data.getEntity('Capacity'), { radio: 'nodraft' });
  const allocAll = alloc.data.reduce((a, b) => a + b, 0);
  const allocNod = nod.series[1].data.reduce((a, b) => a + b, 0);
  if (allocNod <= allocAll) ok(`Capacity::Report-A nodraft: allocated ${allocNod} <= all ${allocAll}`);
  else fail(`Capacity::Report-A nodraft: allocated ${allocNod} > all ${allocAll}`);
}

// ---- trend coverage: at least one card trends up and the data spans months ----
console.log('== trend sanity ==');
const trends = Object.entries(CARD_QUERIES).map(([id, q]) => { try { return [id, q().trendPct]; } catch { return [id, null]; } })
  .filter(([, t]) => t != null);
if (trends.length >= 2) ok(`trend values present on ${trends.length} cards: ${trends.map(([i, t]) => `${i}=${t}%`).join(', ')}`);
else fail('fewer than 2 cards produce trend values');

console.log(`\nRESULT: ${fails ? 'FAIL' : 'PASS'} — ${fails} failures`);
process.exit(fails ? 1 : 0);
