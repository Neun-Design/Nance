// filters.js — Microsoft Lists-style column filters (standalone wireframe
// parity, prototype v1 review). One collapsible section per visible column,
// each a checkbox list of the column's distinct display values: checks
// within a section OR together, sections AND together. The predicate applies
// to the TABLE rows only — report and card queries pull their own rows, so
// table filters never influence them.

const MAX_SECTIONS = 8;      // most-useful columns first, keep the drawer scannable
const MAX_VALUES = 25;       // columns with more distinct values aren't filterable
const AUTO_EXPAND_VALUES = 8;

// columns: engine columns ({ key, label, accessor? }); rows: the tab's records
// Returns { apply(list), clear(), hasSections }
export function buildColumnFilters(container, columns, rows, onChange) {
  const state = new Map(); // column key -> Set(selected display values)
  const resolve = (col, r) => {
    const v = col.accessor ? col.accessor(r) : r[col.key];
    return v == null || v === '' ? '—' : String(v);
  };

  const sections = [];
  for (const col of columns) {
    const counts = new Map();
    for (const r of rows) {
      const v = resolve(col, r);
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    if (counts.size < 2 || counts.size > MAX_VALUES) continue;
    sections.push({
      col,
      values: [...counts.entries()]
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true })),
    });
    if (sections.length >= MAX_SECTIONS) break;
  }

  const host = document.createElement('div');
  host.className = 'cfltr';
  container.appendChild(host);

  const checkboxes = []; // { input, key, value }
  for (const sec of sections) {
    const box = document.createElement('div');
    box.className = 'cfltr-section';

    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'cfltr-head';
    const name = document.createElement('span');
    name.textContent = sec.col.label || sec.col.key;
    const chev = document.createElement('span');
    chev.className = 'cfltr-chev';
    chev.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
    head.append(name, chev);
    box.appendChild(head);

    const list = document.createElement('div');
    list.className = 'cfltr-values';
    let open = sec.values.length <= AUTO_EXPAND_VALUES;
    const sync = () => {
      list.style.display = open ? '' : 'none';
      chev.classList.toggle('open', open);
    };
    head.addEventListener('click', () => { open = !open; sync(); });
    sync();

    for (const [value, count] of sec.values) {
      const row = document.createElement('label');
      row.className = 'cfltr-row';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.addEventListener('change', () => {
        if (!state.has(sec.col.key)) state.set(sec.col.key, new Set());
        const set = state.get(sec.col.key);
        cb.checked ? set.add(value) : set.delete(value);
        if (!set.size) state.delete(sec.col.key);
        onChange();
      });
      const lbl = document.createElement('span');
      lbl.textContent = value;
      const n = document.createElement('span');
      n.className = 'cfltr-count';
      n.textContent = count;
      row.append(cb, lbl, n);
      list.appendChild(row);
      checkboxes.push({ input: cb });
    }
    box.appendChild(list);
    host.appendChild(box);
  }

  if (!sections.length) {
    const note = document.createElement('div');
    note.className = 'empty-note';
    note.textContent = 'No filterable columns on this table.';
    host.appendChild(note);
  }

  const byKey = new Map(sections.map((s) => [s.col.key, s.col]));
  const predicate = (r) => {
    for (const [key, set] of state) {
      const col = byKey.get(key);
      if (!col || !set.size) continue;
      if (!set.has(resolve(col, r))) return false;
    }
    return true;
  };

  return {
    apply: (list) => list.filter(predicate),
    clear: () => {
      state.clear();
      checkboxes.forEach((c) => { c.input.checked = false; });
      onChange();
    },
    hasSections: sections.length > 0,
  };
}
