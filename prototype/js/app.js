// app.js — bootstrap: load data, build navigation, render the active tab.

import { loadData, getEntity } from './data.js';
import { enrichAll } from './compute.js';
import { REGISTRY } from './registry.js';
import { buildFilterBar } from './filters.js';
import { renderTable } from './table.js';
import { renderChart } from './charts.js';
import { renderOverview } from './overview.js';
import { openForm } from './forms.js';
import { parseHash, go, onRoute } from './router.js';

const sidebarEl = document.getElementById('sidebar');
const tabScrollEl = document.getElementById('tab-scroll');
const tabViewEl = document.getElementById('tab-view');
const searchEl = document.getElementById('global-search');

let active = { module: -1, tab: 0 }; // start on the Overview dashboard
let searchTerm = '';
let liveCharts = [];

// Overview is a synthetic module at index -1 handled specially.
async function main() {
  tabViewEl.innerHTML = '<div class="loading">Loading dataset…</div>';
  try {
    await loadData();
    enrichAll();
  } catch (e) {
    tabViewEl.innerHTML = `<div class="empty-note">Could not load data: ${e.message}<br>Serve this folder over http (e.g. <code>python3 -m http.server</code>).</div>`;
    return;
  }
  buildSidebar();
  onRoute(routeToActive);
  window.addEventListener('resize', () => liveCharts.forEach(c => c.resize()));
  searchEl.addEventListener('input', () => { searchTerm = searchEl.value.trim().toLowerCase(); renderBodyOnly(); });
  routeToActive();
}

function buildSidebar() {
  sidebarEl.innerHTML = '';
  // Overview entry
  sidebarEl.appendChild(navItem('📈', 'Overview', () => { active = { module: -1, tab: 0 }; render(); }, active.module === -1));
  REGISTRY.forEach((mod, mi) => {
    sidebarEl.appendChild(navItem(mod.icon, mod.name, () => go(mi, 0), active.module === mi));
  });
}

function navItem(icon, text, onClick, isActive) {
  const d = document.createElement('div');
  d.className = 'nav-item' + (isActive ? ' active' : '');
  d.innerHTML = `<span class="nav-ico">${icon}</span><span>${text}</span>`;
  d.addEventListener('click', onClick);
  return d;
}

function routeToActive() {
  const r = parseHash();
  if (r) active = r; else if (active.module === -1) { /* keep overview */ } else active = { module: 0, tab: 0 };
  render();
}

let currentFilter = null;
let currentCfg = null;

function render() {
  // refresh sidebar active state
  [...sidebarEl.children].forEach((c, i) => {
    const idx = i - 1; // account for Overview at 0
    c.classList.toggle('active', (active.module === -1 && i === 0) || active.module === idx);
  });
  disposeCharts();
  searchEl.value = ''; searchTerm = '';

  if (active.module === -1) {
    tabScrollEl.innerHTML = '';
    tabViewEl.innerHTML = '';
    liveCharts = renderOverview(tabViewEl);
    return;
  }

  const mod = REGISTRY[active.module];
  if (!mod) { active = { module: 0, tab: 0 }; return render(); }
  if (active.tab >= mod.tabs.length) active.tab = 0;

  // tab chips
  tabScrollEl.innerHTML = '';
  mod.tabs.forEach((t, ti) => {
    const chip = document.createElement('div');
    chip.className = 'tab-chip' + (ti === active.tab ? ' active' : '');
    chip.textContent = t.tab;
    chip.addEventListener('click', () => go(active.module, ti));
    tabScrollEl.appendChild(chip);
  });

  currentCfg = mod.tabs[active.tab];
  renderTabShell(currentCfg);
}

function renderTabShell(cfg) {
  tabViewEl.innerHTML = '';
  const rows = getEntity(cfg.entity);

  // header
  const head = document.createElement('div');
  const flag = cfg.readonly ? ' <span class="readonly-flag">READ-ONLY</span>' : '';
  head.innerHTML = `<div class="tab-title-row"><h2 class="tab-title">${cfg.tab}</h2>` +
    `<span class="tab-count" id="tab-count"></span>${flag}</div>` +
    (cfg.subtitle ? `<p class="tab-subtitle">${cfg.subtitle}</p>` : '');
  tabViewEl.appendChild(head);

  // filter bar
  const filterHost = document.createElement('div');
  tabViewEl.appendChild(filterHost);
  currentFilter = (cfg.filters && cfg.filters.length)
    ? buildFilterBar(filterHost, cfg.filters, rows, renderBodyOnly)
    : { apply: (l) => l };

  // body host (table + charts)
  const body = document.createElement('div');
  body.id = 'tab-body';
  tabViewEl.appendChild(body);
  renderBodyOnly();
}

function renderBodyOnly() {
  if (active.module === -1 || !currentCfg) return;
  const body = document.getElementById('tab-body');
  if (!body) return;
  disposeCharts();
  body.innerHTML = '';

  const cfg = currentCfg;
  const all = getEntity(cfg.entity);
  let rows = currentFilter.apply(all);
  if (searchTerm) rows = rows.filter(r => rowMatchesSearch(r, cfg, searchTerm));

  // update count
  const countEl = document.getElementById('tab-count');
  if (countEl) countEl.textContent = `${rows.length} of ${all.length} records`;

  // entity table panel (Rule 1 — always present)
  const tablePanel = panel(`${cfg.tab} — records`);
  // "New Item" — every editable tab (Rule 4: not the read-only Control tabs)
  if (!cfg.readonly) {
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-primary';
    addBtn.innerHTML = '<span>+</span> New Item';
    addBtn.addEventListener('click', () => openForm(cfg, renderBodyOnly));
    tablePanel.head.appendChild(addBtn);
  }
  renderTable(tablePanel.body, { columns: cfg.columns, rows, pk: cfg.pk, rollups: cfg.rollups || [] });
  body.appendChild(tablePanel.wrap);

  // charts panel
  if (cfg.charts && cfg.charts.length) {
    const rp = document.createElement('div');
    rp.className = 'reports-grid';
    for (const spec of cfg.charts) {
      const box = panel(spec.title || '');
      const chartHost = document.createElement('div');
      chartHost.className = 'chart-box';
      box.body.appendChild(chartHost);
      box.wrap.classList.add('report-card');
      rp.appendChild(box.wrap);
      const chartRows = spec.rowsFrom ? getEntity(spec.rowsFrom) : rows;
      const inst = renderChart(chartHost, spec, chartRows);
      liveCharts.push(inst);
    }
    body.appendChild(rp);
  }
}

function rowMatchesSearch(r, cfg, term) {
  return cfg.columns.some(col => {
    let v = col.accessor ? col.accessor(r) : (col.lookup ? undefined : r[col.key]);
    if (col.lookup) return String(r[col.key] ?? '').toLowerCase().includes(term); // cheap: match id
    return String(v ?? '').toLowerCase().includes(term);
  });
}

function panel(title) {
  const wrap = document.createElement('div');
  wrap.className = 'panel';
  const head = document.createElement('div');
  head.className = 'panel-head';
  head.innerHTML = title ? `<h3>${title}</h3>` : '';
  wrap.appendChild(head);
  const body = document.createElement('div');
  body.className = 'panel-body';
  wrap.appendChild(body);
  return { wrap, body, head };
}

function disposeCharts() {
  liveCharts.forEach(c => { try { c.dispose(); } catch (_) {} });
  liveCharts = [];
}

main();
