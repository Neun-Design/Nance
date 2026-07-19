// reports.js — chart panels from the datamodel reports spec (DATAMODEL_GUIDE §5).
// Each Report-X resolves its prose rule through REPORT_QUERIES; filters.fields
// build a per-report right-side drawer (Reset inside) whose values pre-filter
// the rows fed to the query. On Overview, filters are disabled by design.

import { getEntity, getById } from './data.js';
import { getCatalog, resolveTable, humanize, parseRule } from './model.js';
import { renderChart } from './charts.js';
import { REPORT_QUERIES } from './queries.js';
import { escapeHtml } from './table.js';

export function reportSpecs(tableName) {
  const cat = getCatalog(tableName);
  if (!cat || !cat.reports || typeof cat.reports !== 'object') return [];
  return Object.entries(cat.reports)
    .filter(([k, v]) => k.startsWith('Report') && v && typeof v === 'object')
    .map(([key, spec]) => ({ key, spec, table: tableName }));
}

// opts: { filtersEnabled (default true), detailsBtn?: (table) => el|null }
// returns array of live echarts instances
export function renderReports(container, tableName, opts = {}) {
  const specs = reportSpecs(tableName);
  if (!specs.length) return [];
  const grid = document.createElement('div');
  grid.className = 'reports-grid';
  container.appendChild(grid);
  const charts = [];
  for (const entry of specs) {
    const inst = renderReportPanel(grid, entry, opts);
    if (inst) charts.push(inst);
  }
  return charts;
}

function runQuery(entry, rows) {
  const q = REPORT_QUERIES[`${entry.table}::${entry.key}`];
  if (!q) return null;
  return q(rows);
}

export function renderReportPanel(grid, entry, opts = {}) {
  const filtersEnabled = opts.filtersEnabled !== false;
  const box = document.createElement('div');
  box.className = 'panel report-card';
  const head = document.createElement('div');
  head.className = 'panel-head';
  const h3 = document.createElement('h3');
  head.appendChild(h3);

  const btnWrap = document.createElement('div');
  btnWrap.className = 'tbl-controls';
  head.appendChild(btnWrap);
  box.appendChild(head);

  const body = document.createElement('div');
  body.className = 'panel-body';
  const host = document.createElement('div');
  host.className = 'chart-box';
  body.appendChild(host);
  box.appendChild(body);
  grid.appendChild(box);

  let chart = null;
  const state = {}; // filter field -> value

  const draw = () => {
    if (chart) { try { chart.dispose(); } catch (_) {} }
    host.innerHTML = '';
    const rows = applyFilters(entry.table, getEntity(entry.table), state);
    const spec = runQuery(entry, rows);
    if (!spec) {
      host.innerHTML = `<div class="empty-note">No query implemented for ${escapeHtml(entry.key)}</div>`;
      return;
    }
    h3.textContent = spec.title || entry.key;
    chart = renderChart(host, spec, spec.__pre || rows);
  };

  // per-report filter drawer (wireframe pattern; Reset inside)
  const filterFields = entry.spec.filters && entry.spec.filters.fields;
  if (filterFields && typeof filterFields === 'object') {
    const btn = document.createElement('button');
    btn.className = 'btn-secondary';
    btn.textContent = 'Filters';
    if (!filtersEnabled) {
      btn.disabled = true;
      btn.title = 'Filters are disabled on Overview — use Details to open the source dashboard';
    } else {
      const drawer = buildReportFilterDrawer(entry, filterFields, state, draw);
      btn.addEventListener('click', drawer.open);
    }
    btnWrap.appendChild(btn);
  }
  if (opts.detailsBtn) {
    const db = opts.detailsBtn(entry.table);
    if (db) btnWrap.appendChild(db);
  }

  draw();
  return { resize: () => chart && chart.resize(), dispose: () => chart && chart.dispose() };
}

// generic filter semantics: a field named like a stored attribute filters on
// equality; periodFrame renders a from/to date range applied to the best date
// field on the rows; "ALL"/empty means no constraint.
function applyFilters(tableName, rows, state) {
  const cat = getCatalog(tableName);
  let out = rows;
  for (const [field, value] of Object.entries(state)) {
    if (!value || value === 'ALL') continue;
    if (field === 'periodFrame') {
      const [from, to] = value;
      const dateField = ['periodStart', 'targetDate', 'startDate', 'createdAt', 'eventCreatedAt']
        .find((f) => cat.byName[f] || (rows[0] && f in rows[0]));
      if (dateField && (from || to)) {
        out = out.filter((r) => {
          const d = r[dateField] ? String(r[dateField]).slice(0, 10) : null;
          if (!d) return false;
          if (from && d < from) return false;
          if (to && d > to) return false;
          return true;
        });
      }
    } else if (rows[0] && field in rows[0]) {
      out = out.filter((r) => String(r[field]) === String(value));
    }
  }
  return out;
}

function buildReportFilterDrawer(entry, fields, state, onChange) {
  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  const shell = document.createElement('div'); shell.className = 'drawer-stack';
  const panel = document.createElement('div'); panel.className = 'drawer filter-drawer';
  shell.appendChild(panel); overlay.appendChild(shell);

  const head = document.createElement('div'); head.className = 'drawer-head';
  const title = document.createElement('div');
  title.innerHTML = `<div class="drawer-title">Filters — ${escapeHtml(entry.key)}</div>
    <div class="drawer-sub">${escapeHtml(entry.table)} report filters; Reset restores defaults</div>`;
  const x = document.createElement('button'); x.className = 'drawer-x'; x.textContent = '✕';
  head.append(title, x);
  const bodyHost = document.createElement('div'); bodyHost.className = 'drawer-body';
  panel.append(head, bodyHost);

  const bar = document.createElement('div');
  bar.className = 'filter-bar';
  bar.style.flexDirection = 'column';
  bodyHost.appendChild(bar);

  const controls = [];
  for (const [fname, fspec] of Object.entries(fields)) {
    if (!fspec || typeof fspec !== 'object') continue;
    const wrap = document.createElement('div');
    wrap.className = 'filter-field';
    const lbl = document.createElement('label');
    lbl.textContent = humanize(fname);
    wrap.appendChild(lbl);

    if (fname === 'periodFrame') {
      const from = mkDate(); const to = mkDate();
      const applyDefault = () => {
        // default: "last six months from current date"
        from.value = '2026-01-19'; to.value = '2026-07-19';
        state[fname] = [from.value, to.value];
      };
      const upd = () => { state[fname] = [from.value, to.value]; onChange(); };
      from.addEventListener('change', upd); to.addEventListener('change', upd);
      wrap.append(from, to);
      controls.push({ reset: () => { applyDefault(); } });
      applyDefault();
    } else {
      const sel = document.createElement('select');
      const options = optionsForFilter(entry.table, fname, fspec);
      fillSel(sel, options);
      sel.addEventListener('change', () => { state[fname] = sel.value; onChange(); });
      wrap.appendChild(sel);
      controls.push({ reset: () => { sel.value = ''; state[fname] = ''; } });
    }
    bar.appendChild(wrap);
  }

  const reset = document.createElement('button');
  reset.className = 'filter-reset';
  reset.textContent = 'Reset filters';
  reset.addEventListener('click', () => { controls.forEach((c) => c.reset()); onChange(); });
  bar.appendChild(reset);

  const close = () => overlay.classList.remove('open');
  x.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.body.appendChild(overlay);
  return { open: () => overlay.classList.add('open') };
}

function optionsForFilter(tableName, fname, fspec) {
  const cat = getCatalog(tableName);
  const attr = cat.byName[fname];
  const r = attr && parseRule(attr.rule);
  const ruleText = String(fspec['field-rule'] || '');
  const fkM = ruleText.match(/FK\s*->\s*([A-Za-z ]+)/);
  const target = (r && r.kind === 'fk' && resolveTable(r.target)) || (fkM && resolveTable(fkM[1]));
  if (target) {
    const tCat = getCatalog(target);
    return [...new Set(getEntity(target).map((row) => row[tCat.pk]))]
      .map((v) => ({ value: v, label: String(getById(target, v)?.[tCat.label] ?? v) }));
  }
  const vals = [...new Set(getEntity(tableName).map((row) => row[fname]).filter((v) => v != null && v !== ''))];
  return vals.sort().map((v) => ({ value: v, label: String(v) }));
}

function fillSel(sel, options) {
  sel.innerHTML = '';
  const all = document.createElement('option');
  all.value = ''; all.textContent = 'ALL';
  sel.appendChild(all);
  options.forEach((o) => { const el = document.createElement('option'); el.value = o.value; el.textContent = o.label; sel.appendChild(el); });
}

function mkDate() {
  const i = document.createElement('input');
  i.type = 'date';
  return i;
}
