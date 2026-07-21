// compute.js — aggregation helpers used by charts.js, plus the retired
// enrichment pass. The registry-era enrichAll precomputed mirror fields onto
// rows; the datamodel engine now derives FK displays, rollups and computed
// values at render time (see resolve.js). enrichAll stays as a no-op so
// callers keep a single "data changed" hook.

export function enrichAll() { /* engine derives values at render time */ }

// ---- ISO week key (YYYY-Www) for time-bucketed line charts ----
export function weekKey(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ---- Generic aggregation helpers ----
export function groupCount(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = typeof keyFn === 'function' ? keyFn(r) : r[keyFn];
    if (k == null || k === '') continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

export function groupSum(rows, keyFn, valFn) {
  const m = new Map();
  for (const r of rows) {
    const k = typeof keyFn === 'function' ? keyFn(r) : r[keyFn];
    if (k == null || k === '') continue;
    const v = typeof valFn === 'function' ? valFn(r) : (r[valFn] || 0);
    m.set(k, (m.get(k) || 0) + v);
  }
  return m;
}

// Sorted [ [key,val], ... ] from a Map — by value desc (default) or key asc.
export function sortedEntries(map, { by = 'value', dir = 'desc', limit } = {}) {
  let arr = [...map.entries()];
  arr.sort((a, b) => by === 'key'
    ? String(a[0]).localeCompare(String(b[0]))
    : b[1] - a[1]);
  if (dir === 'asc' && by === 'value') arr.reverse();
  if (limit) arr = arr.slice(0, limit);
  return arr;
}
