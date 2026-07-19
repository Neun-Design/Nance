// table.js — generic data table: sort, mirror-field styling, status pills,
// collapsible rollup child rows, row selection, pagination (dashboard-01 style),
// hideable columns and a summation row over all numerical columns.

import { getEntity, lookup } from './data.js';

const PAGE_SIZES = [10, 25, 50, 100];

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

// opts: { columns, rows, pk, rollups, selectable, onSelectionChange, initialHidden }
// rollup rl: { label, childEntity, childKey?, resolve?(row), columns, orderBy?, nested? }
// Returns an API: { getSelected, clearSelection, setColumnHidden, isColumnHidden, redraw }
export function renderTable(container, opts) {
  const { columns, rows, pk, rollups = [], selectable = false, onSelectionChange } = opts;
  const hasRollups = rollups.length > 0;
  let sortKey = null, sortDir = 1;
  let page = 0, pageSize = PAGE_SIZES[0];
  const selected = new Set();       // pk values
  const hidden = new Set(opts.initialHidden || []);   // column ids (key || label)

  const wrap = document.createElement('div');
  wrap.className = 'tbl-wrap';
  container.appendChild(wrap);

  const colId = (col) => col.key || col.label;
  const visibleColumns = () => columns.filter(c => !hidden.has(colId(c)));

  function notifySelection() {
    if (onSelectionChange) onSelectionChange([...selected]);
  }

  function sortedRows() {
    if (!sortKey) return rows;
    const col = columns.find(c => colId(c) === sortKey);
    if (!col) return rows;
    return [...rows].sort((a, b) => {
      const va = resolveVal(col, a), vb = resolveVal(col, b);
      if (va == null) return 1; if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sortDir;
      return String(va).localeCompare(String(vb), undefined, { numeric: true }) * sortDir;
    });
  }

  function draw() {
    wrap.innerHTML = '';
    const data = sortedRows();
    const cols = visibleColumns();
    const pageCount = Math.max(1, Math.ceil(data.length / pageSize));
    if (page >= pageCount) page = pageCount - 1;
    const pageRows = data.slice(page * pageSize, (page + 1) * pageSize);
    const leadCols = (selectable ? 1 : 0) + (hasRollups ? 1 : 0);

    const tbl = document.createElement('table');
    tbl.className = 'dt';

    // header
    const thead = document.createElement('thead');
    const htr = document.createElement('tr');
    if (selectable) {
      const th = el('th', '', { style: 'width:32px', class: 'sel-cell' });
      const all = document.createElement('input');
      all.type = 'checkbox';
      all.checked = pageRows.length > 0 && pageRows.every(r => selected.has(r[pk]));
      all.indeterminate = !all.checked && pageRows.some(r => selected.has(r[pk]));
      all.addEventListener('change', () => {
        pageRows.forEach(r => all.checked ? selected.add(r[pk]) : selected.delete(r[pk]));
        notifySelection(); draw();
      });
      th.appendChild(all);
      htr.appendChild(th);
    }
    if (hasRollups) htr.appendChild(el('th', '', { style: 'width:28px' }));
    for (const col of cols) {
      const id = colId(col);
      const ind = sortKey === id ? `<span class="sort-ind">${sortDir > 0 ? '▲' : '▼'}</span>` : '';
      const th = document.createElement('th');
      th.innerHTML = escapeHtml(col.label || col.key) + ind;
      if (col.mirror) th.classList.add('mirror');
      th.addEventListener('click', () => {
        if (sortKey === id) sortDir *= -1; else { sortKey = id; sortDir = 1; }
        draw();
      });
      htr.appendChild(th);
    }
    thead.appendChild(htr); tbl.appendChild(thead);

    // body
    const tbody = document.createElement('tbody');
    if (!data.length) {
      const tr = document.createElement('tr');
      const td = el('td', 'No records match the current filters.', { class: 'empty-note' });
      td.colSpan = cols.length + leadCols;
      tr.appendChild(td); tbody.appendChild(tr);
    }
    for (const r of pageRows) {
      const tr = document.createElement('tr');
      if (selected.has(r[pk])) tr.classList.add('row-selected');
      if (selectable) {
        const td = el('td', '', { class: 'sel-cell' });
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = selected.has(r[pk]);
        cb.addEventListener('change', () => {
          cb.checked ? selected.add(r[pk]) : selected.delete(r[pk]);
          tr.classList.toggle('row-selected', cb.checked);
          notifySelection(); drawFooterOnly();
        });
        td.appendChild(cb);
        tr.appendChild(td);
      }
      if (hasRollups) tr.appendChild(rollupToggleCell(r, tr, cols.length + leadCols));
      for (const col of cols) {
        const td = document.createElement('td');
        if (col.mirror) td.classList.add('mirror');
        if (col.num) td.classList.add('num');
        td.innerHTML = cellHtml(col, r);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    tbl.appendChild(tbody);

    // summation row — SUM of every numerical column over ALL filtered rows
    const numCols = cols.filter(c => c.num);
    if (numCols.length && data.length) {
      const tfoot = document.createElement('tfoot');
      const tr = document.createElement('tr');
      tr.className = 'sum-row';
      for (let i = 0; i < leadCols; i++) tr.appendChild(el('td'));
      cols.forEach((col, i) => {
        const td = document.createElement('td');
        if (i === 0 && !col.num) td.textContent = `Σ Total (${data.length} rows)`;
        if (col.num) {
          td.classList.add('num');
          const sum = data.reduce((s, r) => {
            const v = resolveVal(col, r);
            return typeof v === 'number' && !isNaN(v) ? s + v : s;
          }, 0);
          td.textContent = formatNum(sum);
        }
        tr.appendChild(td);
      });
      tfoot.appendChild(tr); tbl.appendChild(tfoot);
    }

    wrap.appendChild(tbl);
    wrap.appendChild(buildFooter(data.length, pageCount));
  }

  // pagination + selection footer, dashboard-01 style
  function buildFooter(total, pageCount) {
    const foot = document.createElement('div');
    foot.className = 'tbl-foot';

    const selInfo = document.createElement('span');
    selInfo.className = 'tbl-selinfo';
    selInfo.textContent = selectable ? `${selected.size} of ${total} row(s) selected` : '';
    foot.appendChild(selInfo);

    const spacer = document.createElement('div');
    spacer.className = 'filter-spacer';
    foot.appendChild(spacer);

    const rpp = document.createElement('label');
    rpp.className = 'tbl-rpp';
    rpp.textContent = 'Rows per page ';
    const sel = document.createElement('select');
    PAGE_SIZES.forEach(n => {
      const o = document.createElement('option');
      o.value = n; o.textContent = n; if (n === pageSize) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => { pageSize = Number(sel.value); page = 0; draw(); });
    rpp.appendChild(sel);
    foot.appendChild(rpp);

    const info = document.createElement('span');
    info.className = 'tbl-pageinfo';
    info.textContent = `Page ${Math.min(page + 1, pageCount)} of ${pageCount}`;
    foot.appendChild(info);

    const prev = pagerBtn('‹', page === 0, () => { page -= 1; draw(); });
    const next = pagerBtn('›', page >= pageCount - 1, () => { page += 1; draw(); });
    foot.append(prev, next);
    return foot;
  }

  function drawFooterOnly() {
    const info = wrap.querySelector('.tbl-selinfo');
    if (info) info.textContent = `${selected.size} of ${sortedRows().length} row(s) selected`;
  }

  function pagerBtn(txt, disabled, onClick) {
    const b = document.createElement('button');
    b.className = 'tbl-pager';
    b.textContent = txt;
    b.disabled = disabled;
    b.addEventListener('click', onClick);
    return b;
  }

  function rollupToggleCell(r, parentTr, span) {
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
        detailTr = buildDetailRow(r, span);
        parentTr.after(detailTr);
      } else if (detailTr) { detailTr.remove(); detailTr = null; }
    });
    td.appendChild(btn);
    return td;
  }

  function buildDetailRow(r, span) {
    const tr = document.createElement('tr');
    tr.className = 'rollup-row';
    const td = document.createElement('td');
    td.colSpan = span;
    for (const rl of rollups) renderGroup(td, rl, childrenOf(rl, r));
    tr.appendChild(td);
    return tr;
  }

  function renderGroup(host, rl, kids, depth = 0) {
    const h = document.createElement('div');
    if (depth) h.style.marginLeft = `${depth * 18}px`;
    h.innerHTML = `<div style="font-weight:600;margin:6px 0;">${escapeHtml(rl.label)} <span class="count-badge">${kids.length}</span></div>`;
    host.appendChild(h);
    if (!kids.length) return;
    const mini = document.createElement('table'); mini.className = 'dt';
    if (depth) mini.style.marginLeft = `${depth * 18}px`;
    const thead = document.createElement('thead'); const htr = document.createElement('tr');
    rl.columns.forEach(c => htr.appendChild(el('th', c.label || c.key)));
    thead.appendChild(htr); mini.appendChild(thead);
    const tb = document.createElement('tbody');
    kids.forEach(k => {
      const ktr = document.createElement('tr');
      rl.columns.forEach(c => { const ktd = document.createElement('td'); ktd.innerHTML = cellHtml(c, k); ktr.appendChild(ktd); });
      tb.appendChild(ktr);
    });
    mini.appendChild(tb); host.appendChild(mini);
    // nested subitem table (guide §9, "A -> B"): grouped under each child row
    if (rl.nested) {
      kids.forEach(k => {
        const nkids = childrenOfRow(rl.nested, k, rl.childEntity);
        if (nkids.length) renderGroup(host, { ...rl.nested, label: `${labelOf(k, rl)} › ${rl.nested.label}` }, nkids, depth + 1);
      });
    }
  }

  function labelOf(row, rl) {
    const c = rl.columns && rl.columns[0];
    return c ? String(resolveVal(c, row) ?? '') : '';
  }

  function childrenOf(rl, r) {
    return childrenOfRow(rl, r, null);
  }

  function childrenOfRow(rl, r, parentEntityOverride) {
    let kids;
    if (rl.resolve) {
      kids = rl.resolve(r, parentEntityOverride) || [];
    } else {
      kids = getEntity(rl.childEntity).filter(c => {
        const fk = c[rl.childKey];
        if (Array.isArray(fk)) return fk.includes(r[pk]);
        return fk === r[pk];
      });
    }
    if (rl.orderBy) {
      kids = [...kids].sort((a, b) => String(a[rl.orderBy] ?? '')
        .localeCompare(String(b[rl.orderBy] ?? ''), undefined, { numeric: true }));
    }
    return kids;
  }

  draw();

  return {
    getSelected: () => [...selected],
    clearSelection: () => { selected.clear(); notifySelection(); draw(); },
    setColumnHidden: (id, hide) => { hide ? hidden.add(id) : hidden.delete(id); draw(); },
    isColumnHidden: (id) => hidden.has(id),
    redraw: draw,
  };
}

// ---- tiny helpers ----
function formatNum(n) {
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function el(tag, text, attrs = {}) {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else e.setAttribute(k, v);
  }
  return e;
}
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
