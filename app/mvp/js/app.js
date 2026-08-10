// app.js — bootstrap: load the datamodel engine + dataset, build navigation,
// render the active tab. All screen structure derives from datamodel.json
// via model.js (DATAMODEL_GUIDE.md is the contract).

import { loadData, getEntity, getById, removeRecords, addRecord, label, initMeta,
  BLANK_MODE, exportSnapshot, importSnapshot, setSchemaVersion } from './data.js';
import { loadModel, getModules, getCatalog, resolveTable, columnsFor, allColumns, getSchemaVersion } from './model.js';
import { fkDisplay, childrenOf, derivedValue } from './resolve.js';
import { buildColumnFilters } from './filters.js';
import { renderTable, escapeHtml } from './table.js';
import { renderCards } from './cards.js';
import { renderReports } from './reports.js';
import { renderOverview } from './overview.js';
import { openForm, supportsEdit, toast } from './forms.js';
import * as sessionFile from './session-file.js';
import { parseHash, go, onRoute } from './router.js';
import { requireLogin, logout } from './login.js';

const sidebarEl = document.getElementById('sidebar');
const tabScrollEl = document.getElementById('tab-scroll');
const tabViewEl = document.getElementById('tab-view');
const searchEl = document.getElementById('global-search');

let active = { module: -1, tab: 0 }; // start on the Overview dashboard
let searchTerm = '';
let liveCharts = [];

async function main() {
  await requireLogin();
  document.getElementById('avatar').addEventListener('click', logout);
  tabViewEl.innerHTML = '<div class="loading">Loading datamodel…</div>';
  try {
    const { catalog } = await loadModel();
    initMeta(catalog);
    setSchemaVersion(getSchemaVersion());
    await loadData();
  } catch (e) {
    tabViewEl.innerHTML = `<div class="empty-note">Could not load data: ${escapeHtml(e.message)}<br>Serve this folder over http (e.g. <code>python3 -m http.server</code>).</div>`;
    return;
  }
  if (BLANK_MODE) {
    const badge = document.querySelector('.header-badge');
    badge.textContent = 'MVP';
    badge.title = 'MVP walkthrough — records you create persist in this browser; add ?reset=1 to the URL to start over';
    // offline-database workflow (consulting sessions): the session lives in a
    // REAL local file. Save OVERWRITES it in place (no timestamped copies);
    // Save As writes a new version; Import makes the picked file the new
    // Save target. The header chip shows folder/name of the session file.
    const right = document.querySelector('.header-right');
    const chip = document.createElement('div');
    chip.className = 'session-file';
    const setChip = (lbl) => {
      chip.textContent = '📄 ' + (lbl || 'no session file');
      chip.title = lbl
        ? `Session file — Save overwrites ${lbl}`
        : 'No session file yet — Save asks for a folder on first use';
    };
    setChip(null);
    sessionFile.restoreHandles().then((lbl) => { if (lbl) setChip(lbl); });

    const snapshotText = () => JSON.stringify(exportSnapshot(), null, 1);
    // only a real user-cancel stays silent — every other failure (blocked
    // picker, permission denial, write error) must surface (2026-08-07 fix)
    const aborted = (e) => e && e.name === 'AbortError';
    // non-Chromium fallback: in-place writes are impossible — download a copy
    const legacyDownload = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([snapshotText()], { type: 'application/json' }));
      a.download = 'edqms_session.json';
      a.click();
      URL.revokeObjectURL(a.href);
      toast('This browser cannot write files in place — downloaded a copy instead');
    };

    const mkBtn = (label, title) => {
      const b = document.createElement('button');
      b.className = 'header-btn'; b.textContent = label; b.title = title;
      return b;
    };
    const imp = mkBtn('Import', 'Open a session file (.json) — it replaces the current records and becomes the Save target');
    const save = mkBtn('Save', 'Overwrite the session file shown in the chip (first save asks for the folder)');
    const saveAs = mkBtn('Save As', 'Save a new version — the picker opens in the current session folder');

    // a BLOCKED picker (Edge enterprise policy DefaultFileSystemWriteGuard,
    // Edge Enhanced Security Mode, permission denial) is not a user cancel —
    // fall back to downloading the file so the session is never lost
    const saveVia = (fn) => async () => {
      if (!sessionFile.supported) return legacyDownload();
      try {
        const lbl = await fn(snapshotText());
        if (lbl) { setChip(lbl); toast(`Saved ${lbl}`); }
      } catch (e) {
        if (aborted(e)) return;
        legacyDownload();
        toast(`Direct file access blocked by the browser (${e.name}) — downloaded a copy instead; use Import to resume from it`);
      }
    };
    save.addEventListener('click', saveVia(sessionFile.save));
    saveAs.addEventListener('click', saveVia(sessionFile.saveAs));

    const applyImport = (name, raw) => {
      const fileVer = (raw._meta && raw._meta.schemaVersion) ?? null;
      const appVer = getSchemaVersion();
      const drift = fileVer != null && appVer != null && String(fileVer) !== String(appVer)
        ? `\n\n⚠ Schema mismatch: file v${fileVer} vs app v${appVer} — fields may be missing or renamed; review before trusting derived views.` : '';
      if (!confirm(`Import "${name}"?\nThis replaces the records of the current session.${drift}`)) return false;
      const { records, skipped } = importSnapshot(raw);
      alert(`Imported ${records} record(s).${skipped.length
        ? `\nSkipped tables this build doesn't know (schema drift): ${skipped.join(', ')}` : ''}`);
      routeToActive();
      return true;
    };
    // legacy <input type=file> import for browsers without the API (no write-back)
    const file = document.createElement('input');
    file.type = 'file'; file.accept = 'application/json,.json'; file.hidden = true;
    file.addEventListener('change', async () => {
      const f = file.files && file.files[0];
      if (!f) return;
      try { applyImport(f.name, JSON.parse(await f.text())); }
      catch (e) { alert(`Import failed: ${e.message}`); }
    });
    imp.addEventListener('click', async () => {
      if (!sessionFile.supported) { file.value = ''; file.click(); return; }
      try {
        const picked = await sessionFile.importPick();
        if (applyImport(picked.name, JSON.parse(picked.text))) {
          setChip(picked.label);
          toast(`Session file: ${picked.label || picked.name}`);
        }
      } catch (e) {
        if (aborted(e)) return;
        if (e instanceof SyntaxError) return alert(`Import failed: ${e.message}`);
        // picker blocked (managed Edge read-guard policy / Enhanced
        // Security) — fall back to the classic file input, which policies
        // don't touch; Save will then use the download fallback symmetrically
        toast(`Direct file access blocked by the browser (${e.name}) — using the classic file chooser`);
        file.value = '';
        file.click();
      }
    });

    const avatar = document.getElementById('avatar');
    right.insertBefore(chip, right.firstChild);
    right.insertBefore(imp, avatar);
    right.insertBefore(save, avatar);
    right.insertBefore(saveAs, avatar);
    document.body.appendChild(file);
  }
  buildSidebar();
  onRoute(routeToActive);
  window.addEventListener('resize', () => liveCharts.forEach(c => c.resize()));
  searchEl.addEventListener('input', () => { searchTerm = searchEl.value.trim().toLowerCase(); renderBodyOnly(); });
  routeToActive();
}

// 20×20 stroke icons lifted from the standalone wireframe sidebar
const svgIcon = (paths) =>
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const MODULE_ICONS = {
  Overview: svgIcon('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>'),
  Organization: svgIcon('<rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/><path d="M12 7v5"/><path d="M5 17v-3h14v3"/>'),
  CRM: svgIcon('<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01"/>'),
  Operation: svgIcon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  Portfolio: svgIcon('<path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>'),
  Workspace: svgIcon('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9l2 2 3-3"/><path d="M8 15h8"/>'),
  Control: svgIcon('<path d="M3 3v18h18"/><path d="M7 14l3-4 3 3 4-6"/>'),
  Talent: svgIcon('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
};
const FALLBACK_ICON = svgIcon('<rect x="3" y="3" width="18" height="18" rx="2"/>');

// Blank-walkthrough scope: analytics modules/dashboards need seeded data, so
// in blank mode they stay visible in the navigation but inert (opaque, not
// selectable) — stakeholder sessions focus on the creation chain.
const BLANK_DISABLED_MODULES = new Set(['Overview', 'CRM', 'Workspace', 'Control']);
const BLANK_DISABLED_TABS = {};
const DISABLED_TIP = 'Not available in this walkthrough';
const moduleDisabled = (name) => BLANK_MODE && BLANK_DISABLED_MODULES.has(name);
const tabDisabled = (modName, table) => BLANK_MODE && !!BLANK_DISABLED_TABS[modName]?.has(table);

// Route guard: never land on (or stay in) a disabled module/dashboard.
function guardActive() {
  if (active.module === -1) {
    if (moduleDisabled('Overview')) {
      const mi = getModules().findIndex((m) => !moduleDisabled(m.name));
      active = { module: mi === -1 ? 0 : mi, tab: 0 };
    }
    return;
  }
  const mod = getModules()[active.module];
  if (!mod) return;
  if (moduleDisabled(mod.name)) {
    const mi = getModules().findIndex((m) => !moduleDisabled(m.name));
    active = { module: mi === -1 ? 0 : mi, tab: 0 };
    return;
  }
  if (tabDisabled(mod.name, mod.tables[active.tab])) {
    const ti = mod.tables.findIndex((t) => !tabDisabled(mod.name, t));
    active.tab = ti === -1 ? 0 : ti;
  }
}

function buildSidebar() {
  sidebarEl.innerHTML = '';
  sidebarEl.appendChild(navItem(MODULE_ICONS.Overview, 'Overview', () => { active = { module: -1, tab: 0 }; render(); }, active.module === -1, moduleDisabled('Overview')));
  const section = document.createElement('div');
  section.className = 'nav-section';
  section.textContent = 'Modules';
  sidebarEl.appendChild(section);
  getModules().forEach((mod, mi) => {
    sidebarEl.appendChild(navItem(MODULE_ICONS[mod.name] || FALLBACK_ICON, mod.name, () => go(mi, 0), active.module === mi, moduleDisabled(mod.name)));
  });
}

function navItem(icon, text, onClick, isActive, disabled) {
  const d = document.createElement('div');
  d.className = 'nav-item' + (isActive ? ' active' : '') + (disabled ? ' disabled' : '');
  const ico = document.createElement('span'); ico.className = 'nav-ico'; ico.innerHTML = icon;
  const lbl = document.createElement('span'); lbl.textContent = text;
  d.append(ico, lbl);
  if (disabled) d.title = DISABLED_TIP;
  else d.addEventListener('click', onClick);
  return d;
}

function routeToActive() {
  const r = parseHash();
  if (r) active = r; else if (active.module === -1) { /* keep overview */ } else active = { module: 0, tab: 0 };
  render();
}

let currentFilter = null;
let currentCfg = null;
let filterDrawer = null;

// ---- engine config: everything the renderers need, derived from the catalogue ----
function withAccessors(entity, cols) {
  return cols.map(col => {
    const c = { ...col };
    // multivalued FKs stay ARRAYS of display names — the renderers decide how
    // to show them (cells cap at +n, filters count individual values; U2/U9).
    // fkDisplay itself would join them into one long string.
    if (c.fk) c.accessor = (r) => {
      const v = r[c.key];
      if (Array.isArray(v)) return v.map((x) => fkDisplay(c.fk, x));
      return fkDisplay(c.fk, v);
    };
    else if (c.derived) c.accessor = (r) => derivedValue(entity, c.attr, r);
    return c;
  });
}

function mapSubitem(si, parentEntity) {
  const child = resolveTable(si.table);
  if (!child) return null;
  const opts = {
    viaThrough: si.viaThrough ? { ...si.viaThrough } : null,
    orderBy: si.orderBy, only: si.only,
    via: si.via || null, throughField: si.throughField || null,
    mapField: si.mapField || null,
  };
  const rl = {
    label: si.label || (si.only ? `${child} (${si.only.values.join('/')})` : child),
    tab: si.tab || null,
    childEntity: child,
    // map-directive children carry their per-parent value as __mapValue —
    // it renders as an extra "Values" column (issue #161)
    columns: withAccessors(child, columnsFor(child, 'sub'))
      .concat(si.mapField ? [{ key: '__mapValue', label: 'Values' }] : []),
    orderBy: si.orderBy,
    resolve: (row, parentOverride) => childrenOf(parentOverride || parentEntity, row, child, opts),
  };
  if (si.nested) rl.nested = mapSubitem(si.nested, child);
  return rl;
}

function engineCfg(tableName) {
  const cat = getCatalog(tableName);
  const cols = withAccessors(tableName, allColumns(tableName));
  const defaultHidden = cols.filter(c => c.attr['table-display'] !== true).map(c => c.key);
  return {
    tab: tableName,
    entity: tableName,
    pk: cat.pk,
    subtitle: cat.description,
    columns: cols,
    initialHidden: defaultHidden,
    tableFilters: cat.tableFilters,
    rollups: cat.subitems.map(si => mapSubitem(si, tableName)).filter(Boolean),
    readonly: false,
  };
}

function render() {
  guardActive();
  [...sidebarEl.querySelectorAll('.nav-item')].forEach((c, i) => {
    const idx = i - 1; // Overview occupies index 0; the section label isn't a nav-item
    c.classList.toggle('active', (active.module === -1 && i === 0) || active.module === idx);
  });
  disposeCharts();
  searchEl.value = ''; searchTerm = '';

  if (active.module === -1) {
    tabScrollEl.innerHTML = '';
    tabScrollEl.appendChild(guideLink(null));
    tabViewEl.innerHTML = '';
    liveCharts = renderOverview(tabViewEl);
    return;
  }

  const mod = getModules()[active.module];
  if (!mod) { active = { module: 0, tab: 0 }; return render(); }

  // Every table in this module is kept out of the tab strip (dashboard-order 0).
  if (!mod.tables.length) {
    tabScrollEl.innerHTML = '';
    tabScrollEl.appendChild(guideLink(mod.name));
    tabViewEl.innerHTML = '<div class="empty-note">No dashboards are enabled for this module.</div>';
    return;
  }
  if (active.tab >= mod.tables.length) active.tab = 0;

  // Tabs render in dashboard-order — getModules() already returns them sorted.
  tabScrollEl.innerHTML = '';
  mod.tables.forEach((t, ti) => {
    const chip = document.createElement('div');
    const off = tabDisabled(mod.name, t);
    chip.className = 'tab-chip' + (ti === active.tab ? ' active' : '') + (off ? ' disabled' : '');
    chip.textContent = t;
    if (off) chip.title = DISABLED_TIP;
    else chip.addEventListener('click', () => go(active.module, ti));
    tabScrollEl.appendChild(chip);
  });
  tabScrollEl.appendChild(guideLink(mod.name, mod.tables[active.tab]));

  currentCfg = engineCfg(mod.tables[active.tab]);
  renderTabShell(currentCfg);
}

// App Guide links (v3-review D10 phase 2): every module/dashboard opens its
// guide page. The deployed layout serves this app under /app/ with the docs
// at the site root; local runs fall back to the published site.
const GUIDE_BASE = location.pathname.includes('/app/mvp/')
  ? '../../app-guide/'
  : location.pathname.includes('/app/')
    ? '../app-guide/' : 'https://bovarafa.github.io/EDQMS/app-guide/';
const guideSlug = (s) => String(s).toLowerCase().replace(/\s+/g, '-');
function guideLink(moduleName, tableName = null) {
  const a = document.createElement('a');
  a.className = 'guide-link';
  a.target = '_blank';
  a.rel = 'noopener';
  a.href = moduleName
    ? `${GUIDE_BASE}${guideSlug(moduleName)}/${tableName ? '#' + guideSlug(tableName) : ''}`
    : GUIDE_BASE;
  a.title = 'Open the App Guide for this page — what it is, when to register, key fields';
  a.textContent = '📖 Guide';
  return a;
}

function renderTabShell(cfg) {
  tabViewEl.innerHTML = '';
  const rows = getEntity(cfg.entity);

  const head = document.createElement('div');
  head.innerHTML = `<div class="tab-title-row"><h2 class="tab-title">${escapeHtml(cfg.tab)}</h2>` +
    `<span class="tab-count" id="tab-count"></span></div>` +
    (cfg.subtitle ? `<p class="tab-subtitle">${escapeHtml(cfg.subtitle)}</p>` : '');
  tabViewEl.appendChild(head);

  filterDrawer = cfg.tableFilters ? buildFilterDrawer(cfg, rows) : null;
  currentFilter = filterDrawer ? filterDrawer.filter : { apply: (l) => l };

  const body = document.createElement('div');
  body.id = 'tab-body';
  tabViewEl.appendChild(body);
  renderBodyOnly();
}

// Microsoft Lists-style filter drawer (wireframe parity): checkbox sections
// per visible column, live match count, Clear all / Done footer. Only the
// table reads the resulting predicate — reports and cards stay unfiltered.
function buildFilterDrawer(cfg, rows) {
  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  const shell = document.createElement('div'); shell.className = 'drawer-stack';
  const panelEl = document.createElement('div'); panelEl.className = 'drawer filter-drawer';
  shell.appendChild(panelEl); overlay.appendChild(shell);

  const head = document.createElement('div'); head.className = 'drawer-head';
  const title = document.createElement('div');
  title.innerHTML = `<div class="drawer-title">Filters</div>
    <div class="drawer-sub">${escapeHtml(cfg.tab)} — checks OR within a column, AND across columns</div>`;
  const x = document.createElement('button'); x.className = 'drawer-x'; x.textContent = '✕';
  head.append(title, x);

  const countBar = document.createElement('div');
  countBar.className = 'filter-count';

  const bodyHost = document.createElement('div'); bodyHost.className = 'drawer-body';
  const foot = document.createElement('div'); foot.className = 'drawer-foot';
  panelEl.append(head, countBar, bodyHost, foot);

  const visibleCols = cfg.columns.filter(c => !cfg.initialHidden.includes(c.key));
  const filter = buildColumnFilters(bodyHost, visibleCols, rows, () => {
    renderBodyOnly();
    updateCount();
  });
  const updateCount = () => {
    countBar.textContent = `${filter.apply(rows).length} of ${rows.length} records match`;
  };
  updateCount();

  const clearBtn = document.createElement('button');
  clearBtn.className = 'btn-secondary'; clearBtn.textContent = 'Clear all';
  clearBtn.addEventListener('click', () => filter.clear());
  const doneBtn = document.createElement('button');
  doneBtn.className = 'btn-primary'; doneBtn.textContent = 'Done';
  foot.append(clearBtn, doneBtn);

  const close = () => overlay.classList.remove('open');
  x.addEventListener('click', close);
  doneBtn.addEventListener('click', close);
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

  const countEl = document.getElementById('tab-count');
  if (countEl) countEl.textContent = `${rows.length} of ${all.length} records`;

  // KPI cards above the table (datamodel cards spec); the blank walkthrough
  // hides analytics — stakeholders see only the record tables and forms
  if (!BLANK_MODE) renderCards(body, cfg.entity);

  const tablePanel = panel(`${cfg.tab} — records`);
  const controls = document.createElement('div');
  controls.className = 'tbl-controls';
  tablePanel.head.appendChild(controls);

  let editBtn = null, delBtn = null, tableApi = null;
  if (!cfg.readonly) {
    editBtn = ctrlBtn('Edit', true, () => {
      const ids = tableApi.getSelected();
      if (ids.length !== 1) return;
      openForm(cfg, renderBodyOnly, getById(cfg.entity, ids[0]));
    });
    delBtn = ctrlBtn('Delete', true, () => {
      const ids = tableApi.getSelected();
      if (!ids.length) return;
      // ux-review U6: name what is about to be deleted, and offer an undo —
      // in blank/MVP mode these are real client mapping records
      const names = ids.map((id) => label(cfg.entity, id) || id);
      const listed = names.slice(0, 5).join(', ') + (names.length > 5 ? ` … and ${names.length - 5} more` : '');
      if (!window.confirm(`Delete ${ids.length} record(s) from ${cfg.tab}?\n\n${listed}`)) return;
      const removed = ids.map((id) => getById(cfg.entity, id)).filter(Boolean);
      removeRecords(cfg.entity, ids);
      renderBodyOnly();
      undoToast(`Deleted ${removed.length} record(s) from ${cfg.tab}`, () => {
        removed.forEach((r) => addRecord(cfg.entity, r));
        renderBodyOnly();
      });
    });
    delBtn.classList.add('btn-danger');
    controls.append(editBtn, delBtn);
  }

  const custBtn = ctrlBtn('Customize Columns', false, () => toggleColsPopover(custBtn, cfg, () => tableApi));
  controls.appendChild(custBtn);

  const fltBtn = ctrlBtn('Filters', !filterDrawer, () => filterDrawer && filterDrawer.open());
  if (!filterDrawer) fltBtn.title = 'No filters defined for this table (table-filters)';
  controls.appendChild(fltBtn);

  if (!cfg.readonly) {
    const addBtn = document.createElement('button');
    addBtn.className = 'btn-primary';
    addBtn.innerHTML = '<span>+</span> New Item';
    addBtn.addEventListener('click', () => openForm(cfg, renderBodyOnly));
    controls.appendChild(addBtn);
  }

  tableApi = renderTable(tablePanel.body, {
    columns: cfg.columns, rows, pk: cfg.pk, rollups: cfg.rollups || [],
    initialHidden: cfg.initialHidden,
    selectable: !cfg.readonly,
    // stakeholder round 2026-07-31: clicking a row opens its edit drawer
    onRowClick: (!cfg.readonly && supportsEdit(cfg.entity))
      ? (r) => openForm(cfg, renderBodyOnly, r) : null,
    // issue #175: subitem rows open the child entity's edit drawer; saving
    // re-renders the parent tab so rollups pick the change up
    onSubRowClick: !cfg.readonly ? (childEntity, r) => {
      const childCfg = engineCfg(childEntity);
      if (!supportsEdit(childEntity)) return;
      const rec = getById(childEntity, r[childCfg.pk]);
      if (rec) openForm(childCfg, renderBodyOnly, rec);
    } : null,
    onSelectionChange: (ids) => {
      if (editBtn) editBtn.disabled = ids.length !== 1 || !supportsEdit(cfg.entity);
      if (delBtn) delBtn.disabled = ids.length === 0;
    },
  });
  body.appendChild(tablePanel.wrap);

  // report chart panels below the table (datamodel reports spec)
  liveCharts = BLANK_MODE ? [] : renderReports(body, cfg.entity);
}

function rowMatchesSearch(r, cfg, term) {
  return cfg.columns.some(col => {
    if (cfg.initialHidden.includes(col.key)) return false;
    const v = col.accessor ? col.accessor(r) : r[col.key];
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

// toast with an action button (delete-undo, ux-review U6); records live in
// memory, so restoring is just re-adding them
function undoToast(msg, onUndo) {
  const t = document.createElement('div');
  t.className = 'toast';
  const txt = document.createElement('span');
  txt.textContent = msg;
  const b = document.createElement('button');
  b.className = 'toast-undo';
  b.textContent = 'Undo';
  const dismiss = () => { t.classList.remove('show'); setTimeout(() => t.remove(), 200); };
  const timer = setTimeout(dismiss, 6000);
  b.addEventListener('click', () => { clearTimeout(timer); onUndo(); dismiss(); });
  t.append(txt, b);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
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
