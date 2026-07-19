// overview.js — the Overview dashboard is a compilation (DATAMODEL_GUIDE §7):
// every card and report across the datamodel with overview-display: true is
// pulled in, each with a Details button routing to its source dashboard.
// Report filters are disabled here by design — filtering happens at the source.

import { getModules, getCatalog } from './model.js';
import { cardSpecs, renderCard } from './cards.js';
import { reportSpecs, renderReportPanel } from './reports.js';
import { go } from './router.js';

function routeFor(entity) {
  const mods = getModules();
  for (let mi = 0; mi < mods.length; mi++) {
    const ti = mods[mi].tables.indexOf(entity);
    if (ti !== -1) return { mi, ti, label: `${mods[mi].name} › ${entity}` };
  }
  return null;
}

function detailsBtn(entity) {
  const r = routeFor(entity);
  if (!r) return null;
  const b = document.createElement('button');
  b.className = 'details-btn';
  b.textContent = 'Details ›';
  b.title = `Open ${r.label} to filter and analyse this data`;
  b.addEventListener('click', () => go(r.mi, r.ti));
  return b;
}

export function renderOverview(container) {
  container.innerHTML = '';
  const charts = [];

  const head = document.createElement('div');
  head.innerHTML = `<div class="tab-title-row"><h2 class="tab-title">Overview</h2>
    <span class="tab-count">Compiled from every card and report flagged overview-display</span></div>
    <p class="tab-subtitle">Filters are disabled here — use Details to open the source dashboard and analyse the data there.</p>`;
  container.appendChild(head);

  // ---- overview cards ----
  const grid = document.createElement('div');
  grid.className = 'kpi-grid';
  let anyCard = false;
  for (const mod of getModules()) {
    for (const t of mod.tables) {
      for (const c of cardSpecs(t)) {
        if (c.spec['overview-display'] === true) {
          anyCard = true;
          grid.appendChild(renderCard(c, { detailsBtn }));
        }
      }
    }
  }
  if (anyCard) container.appendChild(grid);

  // ---- overview reports (filters disabled) ----
  const rp = document.createElement('div');
  rp.className = 'reports-grid';
  container.appendChild(rp);
  for (const mod of getModules()) {
    for (const t of mod.tables) {
      const cat = getCatalog(t);
      if (!cat) continue;
      for (const entry of reportSpecs(t)) {
        if (entry.spec['overview-display'] === true) {
          const inst = renderReportPanel(rp, entry, { filtersEnabled: false, detailsBtn });
          if (inst) charts.push(inst);
        }
      }
    }
  }
  return charts;
}
