// filters.js — build a filter bar from specs; hold state; expose a predicate.
// Filter types: 'select' (distinct values, optionally via a value fn/label), 'search' (free text).

import { getEntity } from './data.js';

// spec: { field, label, type:'select'|'search', valueFn?, labelFn?, source? }
// source: entityName to draw distinct values from (defaults to the tab rows passed in)
export function buildFilterBar(container, specs, rows, onChange) {
  const state = {};          // field -> selected value ('' = all)
  const bar = document.createElement('div');
  bar.className = 'filter-bar';

  for (const spec of specs) {
    const wrap = document.createElement('div');
    wrap.className = 'filter-field';
    const id = `flt-${spec.field}`;
    const lbl = document.createElement('label');
    lbl.textContent = spec.label || spec.field;
    lbl.htmlFor = id;
    wrap.appendChild(lbl);

    if (spec.type === 'search') {
      const inp = document.createElement('input');
      inp.type = 'search'; inp.id = id; inp.placeholder = 'Contains…';
      inp.addEventListener('input', () => { state[spec.field] = inp.value.trim().toLowerCase(); onChange(); });
      wrap.appendChild(inp);
    } else {
      const sel = document.createElement('select');
      sel.id = id;
      const srcRows = spec.source ? getEntity(spec.source) : rows;
      const vals = distinctValues(srcRows, spec);
      const optAll = document.createElement('option');
      optAll.value = ''; optAll.textContent = 'All';
      sel.appendChild(optAll);
      for (const v of vals) {
        const o = document.createElement('option');
        o.value = String(v.value); o.textContent = v.label;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => { state[spec.field] = sel.value; onChange(); });
      wrap.appendChild(sel);
    }
    bar.appendChild(wrap);
  }

  const spacer = document.createElement('div'); spacer.className = 'filter-spacer'; bar.appendChild(spacer);
  const reset = document.createElement('button');
  reset.className = 'filter-reset'; reset.textContent = 'Reset filters';
  reset.addEventListener('click', () => {
    for (const k of Object.keys(state)) state[k] = '';
    bar.querySelectorAll('select').forEach(s => s.value = '');
    bar.querySelectorAll('input[type=search]').forEach(i => i.value = '');
    onChange();
  });
  bar.appendChild(reset);
  container.appendChild(bar);

  // predicate combining every active filter (AND)
  function predicate(specsRef) {
    return (r) => {
      for (const spec of specsRef) {
        const sel = state[spec.field];
        if (!sel) continue;
        const raw = spec.valueFn ? spec.valueFn(r) : r[spec.field];
        if (spec.type === 'search') {
          if (!String(raw ?? '').toLowerCase().includes(sel)) return false;
        } else if (String(raw) !== sel) return false;
      }
      return true;
    };
  }

  return { apply: (list) => list.filter(predicate(specs)), state };
}

function distinctValues(rows, spec) {
  const seen = new Map();
  for (const r of rows) {
    const v = spec.valueFn ? spec.valueFn(r) : r[spec.field];
    if (v == null || v === '') continue;
    if (!seen.has(v)) seen.set(v, spec.labelFn ? spec.labelFn(v) : v);
  }
  return [...seen.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { numeric: true }));
}
