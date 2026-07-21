// resolve.js — runtime value resolution for engine columns: FK display fields,
// rollup children/counts, computed SUMs and via-chains (DATAMODEL_GUIDE §3.3).
//
// Display resolution contract (prototype v1 review): reference cells and
// rollup cells always show display NAMES, never raw ids —
//   - stored id(s)  → resolved against the rule target, else the table whose
//     PK shares the attribute name (FK_MAP), else shown as-is (already a name)
//   - derived cells → children are resolved via: the declared via field
//     (child-FK or shared-field join), a direct child FK, a shared-domain
//     join, or a two-hop join through an intermediate table; when the rule
//     (or the attribute name) names a display field the distinct child
//     display values are shown, otherwise the count.

import { getEntity, getById, getBaseFields, ENTITY_META, FK_MAP } from './data.js';
import { getCatalog, resolveTable, childKeyFor, parseRule } from './model.js';

const MAX_DEPTH = 5;

// owner/audit fields all point at People — joining or displaying through them is meaningless
const isAudit = (n) => /Owner$/.test(n) || ['createdBy', 'changedBy', 'reportedBy'].includes(n);

// table referenced by an attribute NAME alone (pk-name match, else fuzzy table name)
function domainByName(attrName) {
  return FK_MAP[attrName] || resolveTable(attrName);
}

const dedupe = (arr) => [...new Set(arr)];

// join-path discovery is DATA-validated: a candidate field pair only forms a
// join when the two sides actually share values in the mockup dataset —
// catalogue-declared fields that are absent from the data can't be joined on.
function valuesOverlap(tableA, fieldA, tableB, fieldB) {
  const bVals = new Set();
  for (const r of getEntity(tableB)) {
    const v = r[fieldB];
    if (v == null || v === '') continue;
    (Array.isArray(v) ? v : [v]).forEach((x) => bVals.add(x));
  }
  if (!bVals.size) return false;
  return getEntity(tableA).some((r) => {
    const v = r[fieldA];
    if (v == null || v === '') return false;
    return (Array.isArray(v) ? v : [v]).some((x) => bVals.has(x));
  });
}

function concatDisplay(rec, parts) {
  return parts.map((p) => (p.lit != null ? p.lit : (rec[p.field] ?? ''))).join('');
}

// FK cell: show the target's display field (never the raw id)
export function fkDisplay(fk, value) {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return dedupe(value.map((v) => fkDisplay(fk, v))).join(', ');
  const meta = ENTITY_META[fk.table];
  const rec = getById(fk.table, value);
  if (!rec) return value; // stored as display value already, or unknown id
  if (fk.concat) return concatDisplay(rec, fk.concat);
  let field = fk.display && fk.display !== (meta && meta.pk) && rec[fk.display] != null
    ? fk.display : null;
  if (!field) field = meta && rec[meta.label] != null ? meta.label : null;
  return field ? rec[field] : value;
}

// value of `field` for a record of `tableName`, deriving when not stored:
// 1) stored on the record, 2) a same-named attribute with a rule,
// 3) through a sibling reference attribute whose target owns `field`.
export function resolveDisplay(tableName, rec, field, depth = 0) {
  if (!rec || !field) return '';
  if (rec[field] != null && rec[field] !== '') {
    return Array.isArray(rec[field]) ? rec[field].join(', ') : rec[field];
  }
  if (depth >= MAX_DEPTH) return '';
  const cat = getCatalog(tableName);
  if (!cat) return '';
  const a = cat.byName[field];
  if (a && a.rule) {
    const v = derivedValue(tableName, a, rec, depth + 1);
    return v === '—' ? '' : v;
  }
  for (const a2 of cat.attrs) {
    if (a2.name === field || isAudit(a2.name)) continue;
    const r2 = parseRule(a2.rule);
    const t2 = (r2 && r2.target && resolveTable(r2.target)) || domainByName(a2.name);
    if (!t2 || t2 === tableName) continue;
    const c2 = getCatalog(t2);
    const answers = c2 && (c2.label === field || c2.byName[field] || (r2 && r2.display === field));
    if (!answers) continue;
    const v = rec[a2.name];
    if (v != null && v !== '') return idsToDisplay(v, [t2], field, depth + 1);
    if (a2.rule && r2 && r2.kind !== 'fk') {
      const derived = derivedValue(tableName, a2, rec, depth + 1, field);
      if (derived !== '—' && derived !== '' && typeof derived !== 'number') return derived;
    }
  }
  return '';
}

// map stored id(s) to display values against candidate target tables;
// values that match no record pass through unchanged (already names)
function idsToDisplay(value, targets, display, depth) {
  const vals = Array.isArray(value) ? value : [value];
  const out = [];
  for (const v of vals) {
    if (v == null || v === '') continue;
    let shown = null;
    for (const t of targets) {
      if (!t) continue;
      const rec = getById(t, v);
      if (!rec) continue;
      const cat = getCatalog(t);
      if (display && display !== cat.pk) {
        const d = resolveDisplay(t, rec, display, depth);
        if (d !== '') { shown = d; break; }
      }
      shown = rec[cat.label] != null ? rec[cat.label] : v;
      break;
    }
    out.push(shown != null ? shown : v);
  }
  return dedupe(out.map(String)).join(', ');
}

// children of `parentRow` for a rollup rule / subitem entry.
// Resolution order: 1) declared via-through directive, 2) declared via field
// (child FK to parent, else shared-field join), 3) direct FK / pk-name match,
// 4) shared-domain join, 5) two-hop join through an intermediate table
// (e.g. Tasks → Workflows.constraints → Constraints).
export function childrenOf(parentTable, parentRow, childTable, opts = {}) {
  const parentCat = getCatalog(parentTable);
  const pkVal = parentRow[parentCat.pk];
  let rows = null;

  if (opts.viaThrough) {
    rows = viaThroughJoin(parentTable, pkVal, childTable, opts.viaThrough);
  }
  if (rows == null && opts.throughField) {
    rows = throughFieldJoin(parentTable, parentRow, childTable, opts.throughField);
  }
  if (rows == null && opts.via) {
    rows = viaFieldJoin(parentTable, parentRow, childTable, opts.via, pkVal);
  }
  if (rows == null) {
    const key = opts.childKey || childKeyFor(childTable, parentTable);
    if (key && valuesOverlap(childTable, key, parentTable, parentCat.pk)) {
      rows = getEntity(childTable).filter((c) => matches(c[key], pkVal));
    }
  }
  if (rows == null) {
    rows = sharedDomainJoin(parentTable, parentRow, childTable);
  }
  if (rows == null) {
    rows = twoHopJoin(parentTable, parentRow, childTable);
  }
  if (rows == null) {
    rows = reverseDerivedJoin(parentTable, parentRow, childTable);
  }
  rows = rows || [];
  if (opts.only) {
    rows = rows.filter((r) => opts.only.values.includes(String(r[opts.only.field])));
  }
  if (opts.orderBy) {
    rows = [...rows].sort((a, b) => String(a[opts.orderBy] ?? '')
      .localeCompare(String(b[opts.orderBy] ?? ''), undefined, { numeric: true }));
  }
  return rows;
}

// "via: X" — X is a child FK back to the parent, or a field stored on BOTH
// sides referencing the same domain (shared-field join), or a parent field
// holding child ids. Returns null when X isn't stored anywhere relevant.
function viaFieldJoin(parentTable, parentRow, childTable, via, pkVal) {
  const childRows = getEntity(childTable);
  const childHasVia = childRows.some((c) => via in c);
  if (childHasVia && fieldDomain(childTable, via) === parentTable) {
    return childRows.filter((c) => matches(c[via], pkVal));
  }
  if (childHasVia && via in parentRow && parentRow[via] != null) {
    return childRows.filter((c) => sameVal(c[via], parentRow[via]));
  }
  if (via in parentRow && parentRow[via] != null) {
    const cCat = getCatalog(childTable);
    const hits = childRows.filter((c) => matches(parentRow[via], c[cCat.pk]));
    if (hits.length) return hits;
  }
  return null;
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
  const r = a && parseRule(a.rule);
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

// candidate join fields for a table: what the DATA stores plus what the
// catalogue declares (the two disagree in places — e.g. Workflows.constrains
// in the datamodel vs .constraints in the dataset; guide §10)
function joinFields(table) {
  const cat = getCatalog(table);
  const names = new Set(getBaseFields(table));
  cat.stored.forEach((a) => names.add(a.name));
  return [...names].filter((n) => n !== cat.pk && !isAudit(n));
}

const _sharedCache = {};
function sharedDomainJoin(parentTable, parentRow, childTable) {
  const key = `${parentTable}→${childTable}`;
  if (!(key in _sharedCache)) {
    _sharedCache[key] = null;
    outer:
    for (const pa of joinFields(parentTable)) {
      const dom = fieldDomain(parentTable, pa);
      if (!dom || dom === childTable) continue;
      for (const ca of joinFields(childTable)) {
        if (fieldDomain(childTable, ca) === dom
            && valuesOverlap(parentTable, pa, childTable, ca)) {
          _sharedCache[key] = { parentField: pa, childField: ca };
          break outer;
        }
      }
    }
  }
  const join = _sharedCache[key];
  if (!join) return null;
  const v = parentRow[join.parentField];
  if (v == null || v === '') return [];
  return getEntity(childTable).filter((c) => sameVal(c[join.childField], v));
}

// two-hop join: parent → intermediate table M → child ids stored on M.
// Connections tried per M: (a) parent stores M's pk, (b) M stores parent's pk,
// (c) parent and M share a third domain (e.g. Product Scopes.scopeID and
// Workflows.scopes both → Scopes, Workflows.constraints → Constraints).
const _twoHopCache = {};
function twoHopJoin(parentTable, parentRow, childTable) {
  const key = `${parentTable}→${childTable}`;
  if (!(key in _twoHopCache)) {
    _twoHopCache[key] = findTwoHopPath(parentTable, childTable);
  }
  const path = _twoHopCache[key];
  if (!path) return null;
  const mCat = getCatalog(path.mid);
  let midRows;
  if (path.conn === 'pk') {
    const v = parentRow[path.parentField];
    if (v == null || v === '') return [];
    midRows = getEntity(path.mid).filter((m) => matches(v, m[mCat.pk]) || matches(m[mCat.pk], v));
  } else if (path.conn === 'childfk') {
    const pCat = getCatalog(parentTable);
    const pkVal = parentRow[pCat.pk];
    midRows = getEntity(path.mid).filter((m) => matches(m[path.midParentField], pkVal));
  } else { // shared
    const v = parentRow[path.parentField];
    if (v == null || v === '') return [];
    midRows = getEntity(path.mid).filter((m) => sameVal(m[path.midParentField], v));
  }
  const cCat = getCatalog(childTable);
  const ids = new Set();
  for (const m of midRows) {
    const v = m[path.midField];
    (Array.isArray(v) ? v : [v]).forEach((x) => x != null && x !== '' && ids.add(x));
  }
  return getEntity(childTable).filter((c) => ids.has(c[cCat.pk]));
}

function findTwoHopPath(parentTable, childTable) {
  const pCat = getCatalog(parentTable);
  const cCat = getCatalog(childTable);
  for (const [mid, mCat] of allCatalogs()) {
    if (mid === parentTable || mid === childTable) continue;
    const midField = joinFields(mid).find((ma) =>
      fieldDomain(mid, ma) === childTable && valuesOverlap(mid, ma, childTable, cCat.pk));
    if (!midField) continue;
    // (a) parent → M by pk
    const paPk = joinFields(parentTable).find((pa) =>
      fieldDomain(parentTable, pa) === mid && valuesOverlap(parentTable, pa, mid, mCat.pk));
    if (paPk) return { mid, midField, conn: 'pk', parentField: paPk };
    // (b) M → parent by pk
    const maFk = joinFields(mid).find((ma) =>
      ma !== midField && fieldDomain(mid, ma) === parentTable
      && valuesOverlap(mid, ma, parentTable, pCat.pk));
    if (maFk) return { mid, midField, conn: 'childfk', midParentField: maFk };
    // (c) shared third domain
    for (const pa of joinFields(parentTable)) {
      const dom = fieldDomain(parentTable, pa);
      if (!dom || dom === mid || dom === childTable) continue;
      const ma = joinFields(mid).find((x) =>
        x !== midField && fieldDomain(mid, x) === dom
        && valuesOverlap(parentTable, pa, mid, x));
      if (ma) return { mid, midField, conn: 'shared', parentField: pa, midParentField: ma };
    }
  }
  return null;
}

let _catalogList = null;
function allCatalogs() {
  if (!_catalogList) {
    _catalogList = Object.keys(ENTITY_META)
      .map((t) => [t, getCatalog(t)])
      .filter(([, c]) => c);
  }
  return _catalogList;
}

// children named by a field on a through-table, e.g. Tasks →
// Workflows.inputs → Handouts ("Handouts (grouped by inputs)"): find the
// intermediate table whose data stores `field` with child ids, reachable
// from the parent by a stored pk reference.
const _throughCache = {};
function throughFieldJoin(parentTable, parentRow, childTable, field) {
  const cCat = getCatalog(childTable);
  const key = `${parentTable}→${childTable}.${field}`;
  if (!(key in _throughCache)) {
    _throughCache[key] = null;
    for (const [mid, mCat] of allCatalogs()) {
      if (mid === parentTable || mid === childTable) continue;
      if (!valuesOverlap(mid, field, childTable, cCat.pk)) continue;
      const pa = joinFields(parentTable).find((p) =>
        fieldDomain(parentTable, p) === mid && valuesOverlap(parentTable, p, mid, mCat.pk));
      if (pa) { _throughCache[key] = { mid, parentField: pa }; break; }
    }
  }
  const path = _throughCache[key];
  if (!path) return null;
  const mCat = getCatalog(path.mid);
  const v = parentRow[path.parentField];
  if (v == null || v === '') return [];
  const ids = new Set();
  for (const m of getEntity(path.mid)) {
    if (!matches(v, m[mCat.pk]) && !matches(m[mCat.pk], v)) continue;
    const x = m[field];
    (Array.isArray(x) ? x : [x]).forEach((y) => y != null && y !== '' && ids.add(y));
  }
  return getEntity(childTable).filter((c) => ids.has(c[cCat.pk]));
}

// last resort: invert a derived relationship declared on the CHILD — e.g.
// Constraints → Product Scopes, where Product Scopes.constraintName is a
// rollup targeting Constraints. A child belongs to the parent when the
// parent appears among the child's resolved rows.
const _revCache = {};
const _revActive = new Set();
function reverseDerivedJoin(parentTable, parentRow, childTable) {
  const key = `${parentTable}→${childTable}`;
  if (_revActive.has(key)) return null;
  if (!(key in _revCache)) {
    _revCache[key] = null;
    const cCat = getCatalog(childTable);
    for (const a of cCat.attrs) {
      const r = parseRule(a.rule);
      if (r && r.kind !== 'fk' && r.target && resolveTable(r.target) === parentTable) {
        _revCache[key] = { via: simpleVia(r.via) };
        break;
      }
    }
  }
  const spec = _revCache[key];
  if (!spec) return null;
  const pk = getCatalog(parentTable).pk;
  const pkVal = parentRow[pk];
  _revActive.add(key);
  try {
    return getEntity(childTable).filter((c) =>
      childrenOf(childTable, c, parentTable, { via: spec.via }).some((p) => p[pk] === pkVal));
  } finally {
    _revActive.delete(key);
  }
}

function matches(fkVal, pkVal) {
  if (Array.isArray(fkVal)) return fkVal.includes(pkVal);
  return fkVal === pkVal;
}

function sameVal(a, b) {
  if (a == null || b == null || a === '' || b === '') return false;
  const A = Array.isArray(a) ? a : [a];
  const B = Array.isArray(b) ? b : [b];
  return A.some((x) => B.includes(x));
}

// derived attribute value for a table cell.
// `displayOverride` forces a display field (used by resolveDisplay hops).
export function derivedValue(tableName, attr, row, depth = 0, displayOverride = null) {
  const r = parseRule(attr.rule);
  if (!r || r.kind === 'enum') return row[attr.name] ?? '—';
  if (r.kind === 'fk') {
    const table = (r.target && resolveTable(r.target)) || domainByName(attr.name);
    if (!table) return row[attr.name] ?? '—';
    const v = fkDisplay({ table, display: r.display, concat: r.concat }, row[attr.name]);
    return v === '' ? '—' : v;
  }
  if (r.kind === 'sum') {
    // computed: SUM(childAttr.field) — childAttr names a rollup attribute
    const cat = getCatalog(tableName);
    const rollAttr = cat.byName[r.childAttr];
    const rr = rollAttr && parseRule(rollAttr.rule);
    if (rr && rr.target) {
      const child = resolveTable(rr.target);
      if (child) {
        const kids = childrenOf(tableName, row, child, { via: simpleVia(rr.via) });
        return kids.reduce((s, k) => s + (Number(k[r.field]) || 0), 0);
      }
    }
    // stored fallback (generator may have precomputed it)
    return row[attr.name] ?? '—';
  }

  if (depth > MAX_DEPTH) return '—';
  const target = r.target ? resolveTable(r.target) : null;
  const display = displayOverride || r.display;
  const stored = row[attr.name];

  // stored reference value(s): resolve id → display name
  if (stored != null && stored !== '' && !(Array.isArray(stored) && !stored.length)) {
    const targets = [target, domainByName(attr.name)].filter(Boolean);
    if (targets.length) {
      const s = idsToDisplay(stored, targets, display, depth + 1);
      if (s !== '') return s;
    }
    return Array.isArray(stored) ? stored.join(', ') : stored;
  }

  // derived: resolve children, then display names or count
  const child = target || domainByName(attr.name);
  if (!child || child === tableName) return '—';
  const kids = childrenOf(tableName, row, child, { via: simpleVia(r.via) });
  const cCat = getCatalog(child);
  let df = display && display !== cCat.pk ? display : null;
  // no display declared: the attribute's own name doubles as the display
  // field when the child can answer it (e.g. constraintName)
  if (!df && attr.name !== cCat.pk && (cCat.byName[attr.name] || cCat.label === attr.name)) {
    df = attr.name;
  }
  if (df) {
    const names = dedupe(kids
      .map((k) => String(resolveDisplay(child, k, df, depth + 1)))
      .filter((s) => s !== ''));
    return names.length ? names.join(', ') : '—';
  }
  return kids.length; // rollups without a display field render as a count
}

// via directives with dots/commas describe through-chains the simple join
// can't follow — drop them and let the fallback strategies resolve.
function simpleVia(via) {
  if (!via || via.includes('.') || via.includes(',')) return null;
  return via;
}
