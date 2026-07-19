// app.js — bootstrap: load data, build navigation, render the active tab.

import { loadData, getEntity, getById, removeRecords } from './data.js';
import { enrichAll } from './compute.js';
import { REGISTRY } from './registry.js';
import { buildFilterBar } from './filters.js';
import { renderTable, escapeHtml } from './table.js';
import { renderChart } from './charts.js';
import { renderOverview } from './overview.js';
import { openForm, supportsEdit } from './forms.js';
import { parseHash, go, onRoute } from './router.js';
import { requireLogin, logout } from './login.js';

const sidebarEl = document.getElementById('sidebar');
const tabScrollEl = document.getElementById('tab-scroll');
const tabViewEl = document.getElementById('tab-view');
const searchEl = document.getElementById('global-search');

let active = { module: -1, tab: 0 }; // start on the Overview dashboard
let searchTerm = '';
let liveCharts = [];

// Overview is a synthetic module at index -1 handled specially.
async function main() {
  await requireLogin();
  document.getElementById('avatar').addEventListener('click', logout);
  tabViewEl.innerHTML = '<div class="loading">Loading dataset…</div>';
  try {
    await loadData();
    enrichAll();
  } catch (e) {
    tabViewEl.innerHTML = `<div class="empty-note">Could not load data: ${escapeHtml(e.message)}<br>Serve this folder over http (e.g. <code>python3 -m http.server</code>).</div>`;
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
  const ico = document.createElement('span'); ico.className = 'nav-ico'; ico.textContent = icon;
  const lbl = document.createElement('span'); lbl.textContent = text;
  d.append(ico, lbl);
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

let filterDrawer = null;

function renderTabShell(cfg) {
  tabViewEl.innerHTML = '';
  const rows = getEntity(cfg.entity);

  // header
  const head = document.createElement('div');
  const flag = cfg.readonly ? ' <span class="readonly-flag">READ-ONLY</span>' : '';
  head.innerHTML = `<div class="tab-title-row"><h2 class="tab-title">${escapeHtml(cfg.tab)}</h2>` +
    `<span class="tab-count" id="tab-count"></span>${flag}</div>` +
    (cfg.subtitle ? `<p class="tab-subtitle">${escapeHtml(cfg.subtitle)}</p>` : '');
  tabViewEl.appendChild(head);

  // filters live in a right-side drawer (wireframe pattern); Reset stays inside it
  filterDrawer = (cfg.filters && cfg.filters.length) ? buildFilterDrawer(cfg, rows) : null;
  currentFilter = filterDrawer ? filterDrawer.filter : { apply: (l) => l };

  // body host (table + charts)
  const body = document.createElement('div');
  body.id = 'tab-body';
  tabViewEl.appendChild(body);
  renderBodyOnly();
}

function buildFilterDrawer(cfg, rows) {
  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  const shell = document.createElement('div'); shell.className = 'drawer-stack';
  const panel = document.createElement('div'); panel.className = 'drawer filter-drawer';
  shell.appendChild(panel); overlay.appendChild(shell);

  const head = document.createElement('div'); head.className = 'drawer-head';
  const title = document.createElement('div');
  title.innerHTML = `<div class="drawer-title">Filters — ${escapeHtml(cfg.tab)}</div>
    <div class="drawer-sub">Combined with AND; Reset clears every filter</div>`;
  const x = document.createElement('button'); x.className = 'drawer-x'; x.textContent = '✕';
  head.append(title, x);

  const bodyHost = document.createElement('div'); bodyHost.className = 'drawer-body';
  panel.append(head, bodyHost);
  const filter = buildFilterBar(bodyHost, cfg.filters, rows, renderBodyOnly);

  const close = () => overlay.classList.remove('open');
  x.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  tabViewEl.appendChild(overlay);
  return { filter, open: () => overlay.classList.add('open') };
}

function renderBodyOnly() {
  if (active.module === -1 || !currentCfg) return;
  const body = document.getElementById('tab-body');
  if (!body) return;
  disposeCharts();
  if (openPopover) { openPopover.remove(); openPopover = null; }
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
  const controls = document.createElement('div');
  controls.className = 'tbl-controls';
  tablePanel.head.appendChild(controls);

  // Edit — enabled only when exactly one row is selected
  let editBtn = null, delBtn = null, tableApi = null;
  if (!cfg.readonly) {
    editBtn = ctrlBtn('Edit', true, () => {
      const ids = tableApi.getSelected();
      if (ids.length !== 1) return;
      openForm(cfg, renderBodyOnly, getById(cfg.entity, ids[0]));
    });
    if (!supportsEdit(cfg.entity)) editBtn.title = 'Editing uses the stepped form — not available for this entity in the prototype';
    // Delete — enabled when one or more rows are selected
    delBtn = ctrlBtn('Delete', true, () => {
      const ids = tableApi.getSelected();
      if (!ids.length) return;
      if (!window.confirm(`Delete ${ids.length} record(s) from ${cfg.tab}? (in-memory only)`)) return;
      removeRecords(cfg.entity, ids);
      enrichAll();
      renderBodyOnly();
    });
    delBtn.classList.add('btn-danger');
    controls.append(editBtn, delBtn);
  }

  // Customize Columns — checkbox popover per wireframe
  const custBtn = ctrlBtn('Customize Columns', false, () => toggleColsPopover(custBtn, cfg, () => tableApi));
  controls.appendChild(custBtn);

  // Filters — opens the right-side drawer; disabled when the tab defines none
  const fltBtn = ctrlBtn('Filters', !filterDrawer, () => filterDrawer && filterDrawer.open());
  if (!filterDrawer) fltBtn.title = 'No filters defined for this table';
  controls.appendChild(fltBtn);

  // "New Item" — every editable tab (Rule 4: not the read-only Control tabs)
  if (!cfg.readonly) {
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-primary';
    addBtn.innerHTML = '<span>+</span> New Item';
    addBtn.addEventListener('click', () => openForm(cfg, renderBodyOnly));
    controls.appendChild(addBtn);
  }

  tableApi = renderTable(tablePanel.body, {
    columns: cfg.columns, rows, pk: cfg.pk, rollups: cfg.rollups || [],
    selectable: !cfg.readonly,
    onSelectionChange: (ids) => {
      if (editBtn) editBtn.disabled = ids.length !== 1 || !supportsEdit(cfg.entity);
      if (delBtn) delBtn.disabled = ids.length === 0;
    },
  });
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

function ctrlBtn(label, disabled, onClick) {
  const b = document.createElement('button');
  b.className = 'btn-secondary';
  b.textContent = label;
  b.disabled = disabled;
  b.addEventListener('click', onClick);
  return b;
}

let openPopover = null;
function toggleColsPopover(anchor, cfg, getApi) {
  if (openPopover) { openPopover.remove(); openPopover = null; return; }
  const api = getApi();
  const pop = document.createElement('div');
  pop.className = 'cols-pop';
  const note = document.createElement('div');
  note.className = 'cols-pop-title';
  note.textContent = 'Toggle columns';
  pop.appendChild(note);
  for (const col of cfg.columns) {
    const id = col.key || col.label;
    const row = document.createElement('label');
    row.className = 'cols-pop-row';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !api.isColumnHidden(id);
    cb.addEventListener('change', () => api.setColumnHidden(id, !cb.checked));
    const txt = document.createElement('span');
    txt.textContent = col.label || col.key;
    row.append(cb, txt);
    pop.appendChild(row);
  }
  anchor.parentElement.appendChild(pop);
  openPopover = pop;
  const onDocClick = (e) => {
    if (!pop.contains(e.target) && e.target !== anchor) {
      pop.remove(); openPopover = null;
      document.removeEventListener('click', onDocClick, true);
    }
  };
  document.addEventListener('click', onDocClick, true);
}

function panel(title) {
  const wrap = document.createElement('div');
  wrap.className = 'panel';
  const head = document.createElement('div');
  head.className = 'panel-head';
  if (title) { const h = document.createElement('h3'); h.textContent = title; head.appendChild(h); }
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
