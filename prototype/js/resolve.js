// resolve.js — runtime value resolution for engine columns: FK display fields,
// rollup children/counts, computed SUMs and via-chains (DATAMODEL_GUIDE §3.3).

import { getEntity, getById, ENTITY_META } from './data.js';
import { getCatalog, resolveTable, childKeyFor, parseRule } from './model.js';

// FK cell: show the target's display field (never the raw id)
export function fkDisplay(fk, value) {
  if (value == null || value === '') return '';
  const meta = ENTITY_META[fk.table];
  const rec = getById(fk.table, value);
  if (!rec) return value; // stored as display value already, or unknown id
  const field = fk.display && rec[fk.display] != null ? fk.display
    : (meta && rec[meta.label] != null ? meta.label : null);
  return field ? rec[field] : value;
}

// children of `parentRow` for a rollup rule / subitem entry.
// Resolution order: 1) declared via-through directive, 2) direct FK / pk-name
// match, 3) shared-domain join (a stored field on both sides referencing the
// same third table — e.g. Tasks.scopes and Product Scopes.scopeID both → Scopes).
export function childrenOf(parentTable, parentRow, childTable, opts = {}) {
  const parentCat = getCatalog(parentTable);
  const pkVal = parentRow[parentCat.pk];
  let rows = null;

  if (opts.viaThrough) {
    rows = viaThroughJoin(parentTable, pkVal, childTable, opts.viaThrough);
  }
  if (rows == null) {
    const key = opts.childKey || childKeyFor(childTable, parentTable);
    if (key) rows = getEntity(childTable).filter((c) => matches(c[key], pkVal));
  }
  if (rows == null) {
    rows = sharedDomainJoin(parentTable, parentRow, childTable);
  }
  rows = rows || [];
  if (opts.orderBy) {
    rows = [...rows].sort((a, b) => String(a[opts.orderBy] ?? '')
      .localeCompare(String(b[opts.orderBy] ?? ''), undefined, { numeric: true }));
  }
  return rows;
}

// e.g. Actions via Tasks.activityID: through-rows belonging to the parent name
// the child ids in `field`. Returns null when the declared path isn't stored,
// so the caller can fall back.
function viaThroughJoin(parentTable, pkVal, childTable, via) {
  const through = resolveTable(via.table);
  const throughKey = through && childKeyFor(through, parentTable);
  const childCat = getCatalog(childTable);
  if (!through || !throughKey) return null;
  const throughRows = getEntity(through);
  if (!throughRows.some((tr) => via.field in tr)) return null; // field not stored
  const ids = new Set();
  for (const tr of throughRows) {
    if (matches(tr[throughKey], pkVal)) {
      const v = tr[via.field];
      (Array.isArray(v) ? v : [v]).forEach((x) => x != null && ids.add(x));
    }
  }
  return getEntity(childTable).filter((c) => ids.has(c[childCat.pk]));
}

// what third table does this attribute's value domain reference?
function fieldDomain(tableName, attrName) {
  const cat = getCatalog(tableName);
  const a = cat && cat.byName[attrName];
  if (!a) return null;
  const r = parseRule(a.rule);
  if (r && r.kind === 'fk') return resolveTable(r.target);
  for (const [t, c] of Object.entries(cataloguePks())) {
    if (c === attrName && t !== tableName) return t;
  }
  return resolveTable(attrName); // e.g. "scopes" → Scopes, "products" → Products
}

let _pkCache = null;
function cataloguePks() {
  if (!_pkCache) {
    _pkCache = {};
    for (const name of Object.keys(ENTITY_META)) _pkCache[name] = ENTITY_META[name].pk;
  }
  return _pkCache;
}

const _sharedCache = {};
function sharedDomainJoin(parentTable, parentRow, childTable) {
  const key = `${parentTable}→${childTable}`;
  if (!(key in _sharedCache)) {
    _sharedCache[key] = null;
    const pCat = getCatalog(parentTable), cCat = getCatalog(childTable);
    // owner/audit fields all point at People — joining on them is meaningless
    const skip = (n) => /Owner$/.test(n) || ['createdBy', 'changedBy', 'reportedBy'].includes(n);
    outer:
    for (const pa of pCat.stored) {
      if (skip(pa.name)) continue;
      const dom = pa.name === pCat.pk ? null : fieldDomain(parentTable, pa.name);
      if (!dom || dom === childTable) continue;
      for (const ca of cCat.stored) {
        if (ca.name === cCat.pk || skip(ca.name)) continue;
        if (fieldDomain(childTable, ca.name) === dom) {
          _sharedCache[key] = { parentField: pa.name, childField: ca.name };
          break outer;
        }
      }
    }
  }
  const join = _sharedCache[key];
  if (!join) return null;
  const v = parentRow[join.parentField];
  if (v == null || v === '') return [];
  return getEntity(childTable).filter((c) => matches(c[join.childField], v) || matches(v, c[join.childField]));
}

function matches(fkVal, pkVal) {
  if (Array.isArray(fkVal)) return fkVal.includes(pkVal);
  return fkVal === pkVal;
}

// derived attribute value for a table cell
export function derivedValue(tableName, attr, row) {
  const r = parseRule(attr.rule);
  if (!r) return '—';
  if (r.kind === 'rollup') {
    const child = resolveTable(r.target);
    if (!child) return '—';
    const via = r.via.includes('.') ? null : r.via;
    const kids = via
      ? getEntity(child).filter((c) => matches(c[via], row[getCatalog(tableName).pk]))
      : childrenOf(tableName, row, child);
    return kids.length; // rollups render as a count in table cells
  }
  if (r.kind === 'sum') {
    // computed: SUM(childAttr.field) — childAttr names a rollup attribute
    const cat = getCatalog(tableName);
    const rollAttr = cat.byName[r.childAttr];
    const rr = rollAttr && parseRule(rollAttr.rule);
    if (rr && rr.kind === 'rollup') {
      const child = resolveTable(rr.target);
      const via = rr.via.includes('.') ? null : rr.via;
      const kids = via
        ? getEntity(child).filter((c) => matches(c[via], row[cat.pk]))
        : childrenOf(tableName, row, child);
      return kids.reduce((s, k) => s + (Number(k[r.field]) || 0), 0);
    }
    // stored fallback (generator may have precomputed it)
    return row[attr.name] ?? '—';
  }
  // computed-path and unknown shapes: show stored value if present
  return row[attr.name] ?? '—';
}
