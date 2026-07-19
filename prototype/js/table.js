// table.js — generic data table: sort, mirror-field styling, status pills,
// and collapsible rollup child rows (default collapsed) per the global UI rules.

import { getEntity, lookup } from './data.js';

// col: { key, label, lookup:[entity,field], accessor, mirror, num, pill }
function resolveVal(col, r) {
  if (col.accessor) return col.accessor(r);
  if (col.lookup) return lookup(col.lookup[0], r[col.key], col.lookup[1]);
  return r[col.key];
}

function cellHtml(col, r) {
  const v = resolveVal(col, r);
  if (col.pill) {
    const cls = col.pill(v, r) || 'neutral';
    return `<span class="pill ${cls}">${escapeHtml(v ?? '')}</span>`;
  }
  if (Array.isArray(v)) return escapeHtml(v.join(', '));
  return escapeHtml(v ?? '');
}

function tdClass(col) {
  const c = [];
  if (col.mirror) c.push('mirror');
  if (col.num) c.push('num');
  return c.length ? ` class="${c.join(' ')}"` : '';
}

// opts: { columns, rows, pk, rollups }
export function renderTable(container, opts) {
  const { columns, rows, pk, rollups = [] } = opts;
  const hasRollups = rollups.length > 0;
  let sortKey = null, sortDir = 1;

  const wrap = document.createElement('div');
  wrap.className = 'tbl-wrap';
  container.appendChild(wrap);

  function sortedRows() {
    if (!sortKey) return rows;
    const col = columns.find(c => (c.key || c.label) === sortKey);
    if (!col) return rows;
    return [...rows].sort((a, b) => {
      const va = resolveVal(col, a), vb = resolveVal(col, b);
      if (va == null) return 1; if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sortDir;
      return String(va).localeCompare(String(vb), undefined, { numeric: true }) * sortDir;
    });
  }

  function draw() {
    const data = sortedRows();
    const tbl = document.createElement('table');
    tbl.className = 'dt';

    // header
    const thead = document.createElement('thead');
    const htr = document.createElement('tr');
    if (hasRollups) htr.appendChild(el('th', '', { style: 'width:28px' }));
    for (const col of columns) {
      const id = col.key || col.label;
      const ind = sortKey === id ? `<span class="sort-ind">${sortDir > 0 ? '▲' : '▼'}</span>` : '';
      const th = el('th', (col.label || col.key) + ind, col.mirror ? { class: 'mirror' } : {});
      th.innerHTML = (col.label || col.key) + ind;
      if (col.mirror) th.classList.add('mirror');
      th.addEventListener('click', () => {
        if (sortKey === id) sortDir *= -1; else { sortKey = id; sortDir = 1; }
        wrap.innerHTML = ''; draw();
      });
      htr.appendChild(th);
    }
    thead.appendChild(htr); tbl.appendChild(thead);

    // body
    const tbody = document.createElement('tbody');
    if (!data.length) {
      const tr = document.createElement('tr');
      const td = el('td', 'No records match the current filters.', { class: 'empty-note' });
      td.colSpan = columns.length + (hasRollups ? 1 : 0);
      td.className = 'empty-note';
      tr.appendChild(td); tbody.appendChild(tr);
    }
    for (const r of data) {
      const tr = document.createElement('tr');
      if (hasRollups) tr.appendChild(rollupToggleCell(r, tbody, tr));
      for (const col of columns) {
        const td = document.createElement('td');
        if (col.mirror) td.classList.add('mirror');
        if (col.num) td.classList.add('num');
        td.innerHTML = cellHtml(col, r);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    tbl.appendChild(tbody);
    wrap.appendChild(tbl);
  }

  function rollupToggleCell(r, tbody, parentTr) {
    const td = document.createElement('td');
    const total = rollups.reduce((s, rl) => s + childrenOf(rl, r).length, 0);
    if (!total) return td;
    const btn = document.createElement('button');
    btn.className = 'rollup-toggle';
    btn.innerHTML = `<span class="chev">▶</span>`;
    let open = false, detailTr = null;
    btn.addEventListener('click', () => {
      open = !open;
      btn.classList.toggle('open', open);
      if (open) {
        detailTr = buildDetailRow(r);
        parentTr.after(detailTr);
      } else if (detailTr) { detailTr.remove(); detailTr = null; }
    });
    td.appendChild(btn);
    return td;
  }

  function buildDetailRow(r) {
    const tr = document.createElement('tr');
    tr.className = 'rollup-row';
    const td = document.createElement('td');
    td.colSpan = columns.length + 1;
    for (const rl of rollups) {
      const kids = childrenOf(rl, r);
      const h = document.createElement('div');
      h.innerHTML = `<div style="font-weight:600;margin:6px 0;">${rl.label} <span class="count-badge">${kids.length}</span></div>`;
      td.appendChild(h);
      if (kids.length) {
        const mini = document.createElement('table'); mini.className = 'dt';
        const thead = document.createElement('thead'); const htr = document.createElement('tr');
        rl.columns.forEach(c => htr.appendChild(el('th', c.label || c.key)));
        thead.appendChild(htr); mini.appendChild(thead);
        const tb = document.createElement('tbody');
        kids.forEach(k => {
          const ktr = document.createElement('tr');
          rl.columns.forEach(c => { const ktd = document.createElement('td'); ktd.innerHTML = cellHtml(c, k); ktr.appendChild(ktd); });
          tb.appendChild(ktr);
        });
        mini.appendChild(tb); td.appendChild(mini);
      }
    }
    tr.appendChild(td);
    return tr;
  }

  function childrenOf(rl, r) {
    return getEntity(rl.childEntity).filter(c => {
      const fk = c[rl.childKey];
      if (Array.isArray(fk)) return fk.includes(r[pk]);
      return fk === r[pk];
    });
  }

  draw();
}

// ---- tiny helpers ----
function el(tag, text, attrs = {}) {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else e.setAttribute(k, v);
  }
  return e;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
