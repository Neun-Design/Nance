// cards.js — KPI cards from the datamodel cards spec (DATAMODEL_GUIDE §4).
// Slot keys "Card R-C" give grid coordinates; card-rules resolve through the
// CARD_QUERIES map; trend-data renders before the main value: up-arrow green
// when rising, down-arrow red when falling.

import { getCatalog } from './model.js';
import { CARD_QUERIES } from './queries.js';

function slotPos(slot) {
  const m = String(slot).match(/(\d+)-(\d+)/);
  return m ? { row: Number(m[1]), col: Number(m[2]) } : { row: 1, col: 1 };
}

export function cardSpecs(tableName) {
  const cat = getCatalog(tableName);
  if (!cat || !cat.cards) return [];
  const entries = Array.isArray(cat.cards) ? cat.cards : [cat.cards];
  const out = [];
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue;
    for (const [slot, cd] of Object.entries(e)) {
      if (cd && typeof cd === 'object' && cd.title !== undefined) {
        out.push({ slot, ...slotPos(slot), spec: cd, table: tableName });
      }
    }
  }
  return out.sort((a, b) => a.row - b.row || a.col - b.col);
}

// opts: { detailsBtn?: (tableName) => HTMLElement|null }
export function renderCards(container, tableName, opts = {}) {
  const specs = cardSpecs(tableName);
  if (!specs.length) return false;
  const grid = document.createElement('div');
  grid.className = 'kpi-grid';
  for (const s of specs) grid.appendChild(renderCard(s, opts));
  container.appendChild(grid);
  return true;
}

export function renderCard(cardEntry, opts = {}) {
  const { spec, table, slot } = cardEntry;
  const q = CARD_QUERIES[`${table}::${slot}`];
  const data = q ? q() : { main: '—', trendPct: null, detail: spec['card-rules']?.['main-data'] || '' };

  const d = document.createElement('div');
  d.className = 'kpi';
  if (spec['card-tooltip']) d.title = spec['card-tooltip'];

  const label = document.createElement('div');
  label.className = 'kpi-label';
  label.textContent = spec.title || slot;
  d.appendChild(label);

  const valueRow = document.createElement('div');
  valueRow.className = 'kpi-value';
  if (data.trendPct != null) {
    const t = document.createElement('span');
    const up = data.trendPct >= 0;
    t.className = 'kpi-trend ' + (up ? 'trend-up' : 'trend-down');
    t.textContent = `${up ? '▲' : '▼'} ${Math.abs(data.trendPct)}% `;
    valueRow.appendChild(t);
  }
  valueRow.appendChild(document.createTextNode(String(data.main)));
  d.appendChild(valueRow);

  if (data.detail) {
    const sub = document.createElement('div');
    sub.className = 'kpi-sub';
    sub.textContent = data.detail;
    d.appendChild(sub);
  }
  if (data.list && data.list.length) {
    const ul = document.createElement('ul');
    ul.className = 'kpi-list';
    data.list.forEach((line) => { const li = document.createElement('li'); li.textContent = line; ul.appendChild(li); });
    d.appendChild(ul);
  }
  if (opts.detailsBtn) {
    const btn = opts.detailsBtn(table);
    if (btn) { btn.classList.add('kpi-details'); d.appendChild(btn); }
  }
  return d;
}
