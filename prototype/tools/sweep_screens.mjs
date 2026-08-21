#!/usr/bin/env node
// sweep_screens.mjs — the F5 screen sweep (MOCKUP_DEMO_PLAN §6): audits every
// module tab of the live demo dataset — table rows, KPI cards, report charts
// and first-row subitems — and fails on the two acceptance breakers:
//   · an EMPTY visible tab (hidden registries excepted),
//   · a DEGENERATE card or chart (no data, zero totals, flat single-value
//     series across 2+ categories).
// Prints the tab-by-tab checklist; --md writes it to tools/sweep_report.md.
// Run from prototype/:  node tools/sweep_screens.mjs [--md]

import fs from 'fs';
globalThis.fetch = async (p) => new Response(fs.readFileSync(p));

const model = await import('../js/model.js');
const data = await import('../js/data.js');
const { catalog, modules } = await (async () => {
  const { catalog } = await model.loadModel();
  return { catalog, modules: model.getModules() };
})();
data.initMeta(catalog);
await data.loadData();
const resolve = await import('../js/resolve.js');
const { CARD_QUERIES, REPORT_QUERIES } = await import('../js/queries.js');

let fails = 0;
const lines = [];
const say = (s) => { lines.push(s); console.log(s); };
const bad = (s) => { fails += 1; say(`  ✗ ${s}`); };

const flat = (arr) => arr.length > 1 && new Set(arr.map((v) => Math.round(v * 100))).size === 1;

say('# F5 screen sweep — Vitalis demo dataset');
say('');
for (const mod of modules) {
  say(`## ${mod.name}`);
  for (const tname of mod.tables) {
    const cat = catalog[tname];
    if (!cat) continue;
    const rows = data.getEntity(tname) || [];
    const hidden = !cat.dashboardOrder;      // dashboard-order 0 = registry
    const marks = [];

    if (!rows.length && !hidden) bad(`${tname}: visible tab with NO rows`);
    else marks.push(`${rows.length} rows${hidden ? ' (hidden registry)' : ''}`);

    // cards — the catalogue stores them as an ARRAY of {'Card R-C': spec}
    const cardKeys = (Array.isArray(cat.cards) ? cat.cards : [cat.cards])
      .filter(Boolean).flatMap((c) => Object.keys(c));
    for (const key of cardKeys) {
      const q = CARD_QUERIES[`${tname}::${key}`];
      if (!q) { bad(`${tname}::${key}: card declared, no query`); continue; }
      let out;
      try { out = q(); } catch (e) { bad(`${tname}::${key}: card throws (${e.message})`); continue; }
      const main = String(out && out.main);
      if (main === '' || main === '—' || main === '0' || main === 'NaN' || main === 'undefined') {
        bad(`${tname}::${key}: degenerate card (main="${main}")`);
      } else marks.push(`card ${key} → ${main}`);
    }

    // reports
    for (const key of Object.keys(cat.reports || {})) {
      if (!key.startsWith('Report') || cat.reports[key] == null
          || typeof cat.reports[key] !== 'object') continue;
      const q = REPORT_QUERIES[`${tname}::${key}`];
      if (!q) { bad(`${tname}::${key}: report declared, no query`); continue; }
      let spec;
      try { spec = q(rows, {}); } catch (e) { bad(`${tname}::${key}: report throws (${e.message})`); continue; }
      const series = spec.series || [];
      const cats = spec.cats || (spec.__pre ? spec.__pre.map((r) => r.__k) : []);
      const total = series.length
        ? series.reduce((s, x) => s + x.data.reduce((a, b) => a + (Number(b) || 0), 0), 0)
        : (spec.__pre || []).reduce((s, r) => s + (Number(r.__v) || 0), 0);
      if (!cats.length || total === 0) {
        bad(`${tname}::${key}: degenerate chart (cats=${cats.length}, total=${total})`);
      } else if (series.length && series.every((x) => flat(x.data))) {
        bad(`${tname}::${key}: flat chart (single value across ${cats.length} categories)`);
      } else marks.push(`report ${key} → ${cats.length} cats, total ${Math.round(total)}`);
    }

    // subitems: at least ONE row must have children (full scan — a tab whose
    // dropdown is empty on every row is a broken promise)
    for (const si of cat.subitems || []) {
      if (!rows.length) continue;
      const child = model.resolveTable(si.table);
      if (!child) { bad(`${tname} subitem → ${si.table}: unknown table`); continue; }
      const withKids = rows.find((r) =>
        resolve.childrenOf(tname, r, child, { via: si.via, orderBy: si.orderBy,
          only: si.only, throughField: si.throughField, mapField: si.mapField }).length);
      if (!withKids) bad(`${tname} subitem → ${si.label || si.table}: no row has children`);
      else marks.push(`subitem ${si.label || si.table} ✓`);
    }

    if (marks.length) say(`  - **${tname}** — ${marks.join(' · ')}`);
  }
  say('');
}

say(fails ? `RESULT: FAIL — ${fails} degenerate screens` : 'RESULT: PASS — zero empty tabs, zero degenerate cards/charts');
if (process.argv.includes('--md')) {
  fs.writeFileSync('tools/sweep_report.md', lines.join('\n') + '\n');
  console.log('written tools/sweep_report.md');
}
process.exit(fails ? 1 : 0);
