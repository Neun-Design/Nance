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

// month labels for the FORMAT('YYYY-MonthName') rule (Forecasts.periodFrame)
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// owner/audit fields all point at People — joining or displaying through them is meaningless
const isAudit = (n) => /Owner$/.test(n) || ['createdBy', 'changedBy', 'reportedBy'].includes(n);

// table referenced by an attribute NAME alone (pk-name match, else fuzzy table name)
function domainByName(attrName) {
  return FK_MAP[attrName] || resolveTable(attrName);
}

const dedupe = (arr) => [...new Set(arr)];

// spec value map entries (Product Groups specValues): Checkbox specs store
// booleans (issue #205) — shown Yes/No wherever the map renders
const specValueLabel = (v) => (v === true ? 'Yes' : v === false ? 'No' : v);

// ---- STEPORDER (identation-rule.md): derived outline numbers for process
// steps. Rows are numbered in insertion order, parents before children:
//   - no parent (or parent outside the set) → next major number (1, 2, 3…)
//   - parallel dependency (finish-to-finish, start-to-start) → sub-number
//     under the parent (2.1, 2.2, 2.1.1…)
//   - sequential dependency (start-to-finish, finish-to-start, or none) →
//     next major number
// The value is NEVER stored: callers pass the sibling rows of ONE process, so
// the computation stays scoped no matter how many workflows exist overall.
const STEP_PARALLEL = new Set(['finish-to-finish', 'start-to-start']);
export function stepOrderMap(rows, pkField, parentField = 'parentStepID', ruleField = 'indentationRule') {
  const map = new Map();
  const subCount = new Map();
  const inSet = new Set(rows.map((r) => r[pkField]));
  let major = 0;
  let pending = rows;
  while (pending.length) {
    const rest = [];
    for (const w of pending) {
      const pid = w[parentField];
      const hasParent = pid != null && pid !== '' && inSet.has(pid);
      if (hasParent && !map.has(pid)) { rest.push(w); continue; }
      if (hasParent && STEP_PARALLEL.has(String(w[ruleField] || '').toLowerCase())) {
        const n = (subCount.get(pid) || 0) + 1;
        subCount.set(pid, n);
        map.set(w[pkField], `${map.get(pid)}.${n}`);
      } else {
        major += 1;
        map.set(w[pkField], String(major));
      }
    }
    if (rest.length === pending.length) {
      // cycle or dangling parents — number the leftovers sequentially
      for (const w of rest) { major += 1; map.set(w[pkField], String(major)); }
      break;
    }
    pending = rest;
  }
  return map;
}

// STEPORDER value for one row: number its sibling group (same groupField
// value) and read this row's entry.
function stepOrderValue(tableName, rule, row) {
  const cat = getCatalog(tableName);
  const all = getEntity(tableName);
  const rows = rule.groupField
    ? all.filter((x) => x[rule.groupField] === row[rule.groupField])
    : all;
  const map = stepOrderMap(rows, cat.pk, rule.parentField, rule.ruleField);
  return map.get(row[cat.pk]) ?? '—';
}

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

// computed: CONCAT(...) evaluated on the SAME row, resolving each field part
// cross-table. Supports two bespoke tokens used in the datamodel:
//   [field]                     → the field's resolved value(s), brackets dropped
//   [{typeField: valueField}]   → paired "typeValue: valueValue", comma-joined
export function computedConcat(tableName, parts, row, depth) {
  return parts.map((p) => {
    if (p.lit != null) return p.lit;
    const f = String(p.field).trim().replace(/^\[|\]$/g, '');
    const map = f.match(/^\{\s*([A-Za-z0-9_]+)\s*:\s*([A-Za-z0-9_]+)\s*\}$/);
    if (map) {
      const types = String(resolveDisplay(tableName, row, map[1], depth) || '').split(', ');
      const vals = String(resolveDisplay(tableName, row, map[2], depth) || '').split(', ');
      const pairs = [];
      for (let i = 0; i < vals.length; i += 1) {
        const v = vals[i];
        if (!v) continue;
        const t = types[i] || types[0] || '';
        pairs.push(t ? `${t}: ${v}` : v);
      }
      return pairs.join(', ');
    }
    const v = resolveDisplay(tableName, row, f, depth);
    return v == null ? '' : String(v);
  }).join('');
}

// FK cell: show the target's display field (never the raw id)
export function fkDisplay(fk, value) {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return dedupe(value.map((v) => fkDisplay(fk, v))).join(', ');
  const meta = ENTITY_META[fk.table];
  const rec = getById(fk.table, value);
  if (!rec) return value; // stored as display value already, or unknown id
  if (fk.concat) {
    // resolve parts cross-table so computed fields (e.g. specsSummary) work;
    // fall back to the target's label when nothing resolves
    const s = computedConcat(fk.table, fk.concat, rec, 0).replace(/\s+/g, ' ').trim();
    if (s && !/^[\s|,:—-]*$/.test(s)) return s;
    return meta && rec[meta.label] != null ? rec[meta.label] : value;
  }
  let field = fk.display && fk.display !== (meta && meta.pk) && rec[fk.display] != null
    ? fk.display : null;
  if (!field && fk.display && fk.display !== (meta && meta.pk)) {
    // display names a DERIVED field of the target (e.g. businessUnitTitle) —
    // resolve it instead of silently falling back to the label
    const d = resolveDisplay(fk.table, rec, fk.display, 1);
    if (d !== '') return String(d);
  }
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
  // siblings whose target STORES the field win over ones that only declare it
  // as a derived attr — e.g. Forecast Scopes.scopeName must hop scopeID →
  // Scopes (stored) rather than forecastID → Forecasts (mirror), which would
  // recurse back here and degrade to a count.
  let fallback = null;
  for (const a2 of cat.attrs) {
    if (a2.name === field || isAudit(a2.name)) continue;
    const r2 = parseRule(a2.rule);
    const t2 = (r2 && r2.target && resolveTable(r2.target)) || domainByName(a2.name);
    if (!t2 || t2 === tableName) continue;
    const c2 = getCatalog(t2);
    const declared = c2 && c2.byName[field];
    const answers = c2 && (c2.label === field || declared || (r2 && r2.display === field));
    if (!answers) continue;
    const direct = (r2 && r2.display === field) || (declared && !declared.rule);
    const v = rec[a2.name];
    if (v != null && v !== '') {
      if (direct) return idsToDisplay(v, [t2], field, depth + 1);
      if (!fallback) fallback = { v, t2 };
      continue;
    }
    if (a2.rule && r2 && r2.kind !== 'fk') {
      const derived = derivedValue(tableName, a2, rec, depth + 1, field);
      // bare counts (numbers or digit strings bubbled through deeper hops)
      // are non-answers for a display field — keep looking
      if (derived !== '—' && derived !== '' && typeof derived !== 'number'
          && !/^\d+(\.\d+)?$/.test(String(derived))) return derived;
    }
  }
  if (fallback) {
    const s = idsToDisplay(fallback.v, [fallback.t2], field, depth + 1);
    if (s !== '') return s;
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
// (e.g. Tasks → Workflows.requirements → Requirements).
export function childrenOf(parentTable, parentRow, childTable, opts = {}) {
  const parentCat = getCatalog(parentTable);
  const pkVal = parentRow[parentCat.pk];
  let rows = null;

  if (opts.viaThrough) {
    rows = viaThroughJoin(parentTable, pkVal, childTable, opts.viaThrough);
  }
  // "(map: field)" — the parent row carries an object map { childId: value };
  // children are the mapped child records, each cloned with its value as
  // __mapValue (Product Groups → Product Specs, issue #161). Missing child
  // records keep the raw id so stale maps stay visible instead of vanishing.
  if (rows == null && opts.mapField) {
    const cCat = getCatalog(childTable);
    const obj = parentRow[opts.mapField];
    rows = obj && typeof obj === 'object' && !Array.isArray(obj)
      ? Object.entries(obj)
          .filter(([, v]) => v != null && v !== '')
          .map(([id, v]) => {
            const rec = getById(childTable, id);
            return { ...(rec || { [cCat.pk]: id, [cCat.label]: id }), __mapValue: specValueLabel(v) };
          })
      : [];
  }
  if (rows == null && opts.throughField) {
    rows = throughFieldJoin(parentTable, parentRow, childTable, opts.throughField);
  }
  if (rows == null && opts.viaList) {
    rows = multiViaJoin(parentTable, parentRow, childTable, opts.viaList, pkVal);
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
    // derived order fields (STEPORDER) are computed over the child set —
    // exactly the sibling group — since the value is never stored
    const cCat = getCatalog(childTable);
    const oAttr = cCat && cCat.byName[opts.orderBy];
    const oRule = oAttr && parseRule(oAttr.rule);
    if (oRule && oRule.kind === 'steporder') {
      const map = stepOrderMap(rows, cCat.pk, oRule.parentField, oRule.ruleField);
      rows = [...rows].sort((a, b) => String(map.get(a[cCat.pk]) ?? '')
        .localeCompare(String(map.get(b[cCat.pk]) ?? ''), undefined, { numeric: true }));
    } else {
      rows = [...rows].sort((a, b) => String(a[opts.orderBy] ?? '')
        .localeCompare(String(b[opts.orderBy] ?? ''), undefined, { numeric: true }));
    }
  }
  return rows;
}

// raw values of a dotted path from a row: each segment reads a stored field,
// intermediate values are mapped id → record against the segment attribute's
// FK target (else the pk-name / fuzzy table-name domain). Returns the raw
// value list of the FINAL segment (ids or literals — never display names),
// so callers can join or display them. Empty when any hop is unstored.
export function pathValues(tableName, row, path, depth = 0) {
  if (depth > MAX_DEPTH) return [];
  const segs = String(path).split('.').map((s) => s.trim()).filter(Boolean);
  let curTable = tableName;
  let recs = [row];
  for (let i = 0; i < segs.length; i += 1) {
    const seg = segs[i];
    const vals = [];
    for (const rec of recs) {
      const v = rec && rec[seg];
      if (v == null || v === '') continue;
      (Array.isArray(v) ? v : [v]).forEach((x) => x != null && x !== '' && vals.push(x));
    }
    if (i === segs.length - 1) return dedupe(vals);
    const next = fieldDomain(curTable, seg);
    if (!next) return [];
    recs = vals.map((v) => getById(next, v)).filter(Boolean);
    curTable = next;
  }
  return [];
}

// domain of the FINAL segment of a dotted path (for display resolution of
// path-derived values) — e.g. "workflowID.productScopeID.scopeID" → Scopes
function pathDomain(tableName, path) {
  const segs = String(path).split('.').map((s) => s.trim()).filter(Boolean);
  let curTable = tableName;
  for (let i = 0; i < segs.length - 1; i += 1) {
    curTable = fieldDomain(curTable, segs[i]);
    if (!curTable) return null;
  }
  return curTable ? fieldDomain(curTable, segs[segs.length - 1]) : null;
}

// "via: a + b + c" — compound key with AND semantics: children must match the
// parent on every listed field that the child DATA actually stores. Each field
// is either a child FK to the parent (matched against the parent pk) or a
// field shared by both sides (sameVal, array-aware — e.g. Requirements store
// scopeID/productGroupID arrays while Product Scopes store single values).
// Dotted entries ("productScopeID.scopeID") traverse the parent side as a
// path; the child matches on the last segment. A child that stores the key
// EMPTY (null / '' / []) matches every parent — applicability keys left blank
// mean "applies to all" (Q1: a Requirement without customerID is generic).
// Fields absent from the child data are skipped, so rules can name aspirational
// keys without breaking (guide §10: data wins over catalogue).
function multiViaJoin(parentTable, parentRow, childTable, fields, pkVal) {
  const childRows = getEntity(childTable);
  const childPk = getCatalog(childTable).pk;
  const childField = (f) => f.split('.').pop();
  const usable = fields.filter((f) => childField(f) !== childPk
    && childRows.some((c) => childField(f) in c));
  if (!usable.length) return null;
  const blank = (v) => v == null || v === '' || (Array.isArray(v) && !v.length);
  let rows = childRows, constrained = false;
  for (const f of usable) {
    const cf = childField(f);
    if (f.includes('.')) {
      const vals = pathValues(parentTable, parentRow, f);
      if (vals.length) {
        rows = rows.filter((c) => blank(c[cf]) || sameVal(c[cf], vals));
        constrained = true;
      }
    } else if (fieldDomain(childTable, f) === parentTable) {
      rows = rows.filter((c) => matches(c[f], pkVal));
      constrained = true;
    } else if (f in parentRow && parentRow[f] != null && parentRow[f] !== '') {
      rows = rows.filter((c) => blank(c[f]) || sameVal(c[f], parentRow[f]));
      constrained = true;
    }
    // else: field unresolvable on the parent — skip
  }
  return constrained ? rows : null;
}

// "via: X" — X is a child FK back to the parent, or a field stored on BOTH
// sides referencing the same domain (shared-field join), or a parent field
// holding child ids. Returns null when X isn't stored anywhere relevant.
function viaFieldJoin(parentTable, parentRow, childTable, via, pkVal) {
  const childRows = getEntity(childTable);
  const childHasVia = childRows.some((c) => via in c);
  // via naming the child's own pk (e.g. "mirror: Forecast Scopes via:
  // forecastScopeID") points at the parent's rollup attr, not a child FK —
  // a child pk never references the parent, so let the FK fallback join.
  if (childHasVia && via !== getCatalog(childTable).pk
      && fieldDomain(childTable, via) === parentTable) {
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
// catalogue declares (the two disagree in places — e.g. legacy Workflows.constrains
// in the datamodel vs .constraints in the dataset — both now "requirements"; guide §10)
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
// Workflows.scopes both → Scopes, Workflows.requirements → Requirements).
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
  if (path.conn === 'chain') {
    // 1-N-N descent: M stores the parent's pk, child stores M's pk
    // (e.g. Factories ← Forecasts ← Forecast Scopes)
    const pCat = getCatalog(parentTable);
    const pkVal = parentRow[pCat.pk];
    const midIds = new Set(getEntity(path.mid)
      .filter((m) => matches(m[path.midParentField], pkVal))
      .map((m) => m[mCat.pk]));
    return getEntity(childTable).filter((c) => {
      const v = c[path.childField];
      return (Array.isArray(v) ? v : [v]).some((x) => midIds.has(x));
    });
  }
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
    if (midField) {
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
    // (d) chain: M → parent by pk and child → M by pk (1-N-N descent,
    // e.g. Factories ← Forecasts ← Forecast Scopes). No child ids stored on
    // M — the child's own FK to M carries the join.
    const chainFk = joinFields(mid).find((ma) =>
      fieldDomain(mid, ma) === parentTable && valuesOverlap(mid, ma, parentTable, pCat.pk));
    const childFk = childKeyFor(childTable, mid);
    if (chainFk && childFk && valuesOverlap(childTable, childFk, mid, mCat.pk)) {
      return { mid, conn: 'chain', midParentField: chainFk, childField: childFk };
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
  // Prefer a parent field that stores the child ids directly, named for this
  // group — e.g. Tasks.taskInput for "grouped by inputs". This reflects the
  // record's own (possibly multivalued) assignment rather than a through-table
  // default. Falls back to the through-table search below when absent/empty.
  const stem = String(field).toLowerCase().replace(/s$/, '');
  const pCat = getCatalog(parentTable);
  const directAttr = pCat && pCat.attrs.find((a) => {
    if (!a.name.toLowerCase().includes(stem)) return false;
    const r = parseRule(a.rule);
    return r && r.target && resolveTable(r.target) === childTable;
  });
  if (directAttr) {
    const v = parentRow[directAttr.name];
    if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) {
      const hits = getEntity(childTable).filter((c) => matches(v, c[cCat.pk]));
      if (hits.length) return hits;
    }
  }
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
// Requirements → Product Scopes, where Product Scopes.requirementID is a
// rollup targeting Requirements. A child belongs to the parent when the
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
        _revCache[key] = { via: simpleVia(r.via), viaList: r.viaList };
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
      childrenOf(childTable, c, parentTable, { via: spec.via, viaList: spec.viaList }).some((p) => p[pk] === pkVal));
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

// ---- Requirements inheritance (issue #226) ----
const asIds = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);

// Product scopes an EVENT's applicability admits (id-level core of the
// productScopesForEvent picker in forms.js): scope overlap AND the product
// group's product among the event's products (each empty = all, Q1).
export function eventProductScopeIds(eventId) {
  const pk = ENTITY_META['Product Scopes'].pk;
  const all = getEntity('Product Scopes');
  const ev = eventId != null && eventId !== '' ? getById('Events', eventId) : null;
  if (!ev) return all.map((ps) => ps[pk]);
  const scopes = asIds(ev.scopeID);
  const products = asIds(ev.productID);
  return all.filter((ps) => {
    if (scopes.length && !sameVal(ps.scopeID, scopes)) return false;
    if (products.length) {
      const pg = ps.productGroupID && getById('Product Groups', ps.productGroupID);
      if (!pg || !sameVal(pg.productID, products)) return false;
    }
    return true;
  }).map((ps) => ps[pk]);
}

// Product scopes a TICKET's payload chain admits (id-level core of the
// productScopesForTicket picker — the issue #214 posture kept intact): the
// event's payloads narrowed to the payloads purchased by the customer's
// ACTIVE SLAs (lenient fallbacks: no customer / no SLA / empty intersection
// keeps every payload of the event), narrowed to the supplier's contracts
// when the ticket declares one (issue #272 — lenient on empty match); a
// payload with an EMPTY productScopeID packages every scope the event admits
// (Q1 — widens to full applicability).
export function admittedProductScopeIds(eventId, customerId, supplierId = null) {
  if (!eventId) return eventProductScopeIds(null);
  let payloads = getEntity('Payload').filter((p) => sameVal(p.eventID, eventId));
  if (customerId) {
    let slas = getEntity('SLA').filter((s) => sameVal(s.customerID, customerId)
      && String(s.isActive || 'Active') !== 'Inactive');
    if (supplierId) {
      const bySup = slas.filter((s) => String(s.supplierID) === String(supplierId));
      if (bySup.length) slas = bySup; // lenient on empty match — existing posture
    }
    if (slas.length) {
      const bought = new Set();
      slas.forEach((s) => asIds(s.payloadID).forEach((id) => bought.add(String(id))));
      const kept = payloads.filter((p) => bought.has(String(p.payloadID)));
      if (kept.length) payloads = kept;
    }
  }
  const ids = [];
  for (const p of payloads) {
    const scopes = asIds(p.productScopeID);
    if (!scopes.length) return eventProductScopeIds(eventId); // wildcard payload
    scopes.forEach((id) => { if (!ids.includes(id)) ids.push(id); });
  }
  return ids;
}

// regions served by a set of business units (Business Units.regionID, union)
function servedRegionIds(unitIds) {
  const out = [];
  for (const u of unitIds) {
    const bu = getById('Business Units', u);
    if (bu) asIds(bu.regionID).forEach((rg) => { if (!out.includes(rg)) out.push(rg); });
  }
  return out;
}

// AND-match Active requirements against an applicability context (issue #226).
// Gate order: lifecycle (blank isActive counts as Active — issue #222 default
// posture), customer, unit, region, then scope + product group paired per
// product scope (the #192 requirement_names pairing). A requirement key left
// EMPTY matches everything (Q1); a context side left blank skips its dimension
// (multiViaJoin posture — a unit serving no region still admits
// region-specific requirements).
function matchRequirements({ psRows, unitIds, regionIds, customerId }) {
  const blank = (v) => v == null || v === '' || (Array.isArray(v) && !v.length);
  const out = [];
  for (const r of getEntity('Requirements')) {
    if (String(r.isActive || 'Active') === 'Inactive') continue;
    if (!blank(r.customerID) && !sameVal(r.customerID, customerId)) continue;
    if (!blank(r.businessUnitID) && unitIds.length && !sameVal(r.businessUnitID, unitIds)) continue;
    if (!blank(r.regionID) && regionIds.length && !sameVal(r.regionID, regionIds)) continue;
    const needScope = !blank(r.scopeID);
    const needPg = !blank(r.productGroupID);
    if (needScope || needPg) {
      const hit = psRows.some((ps) => (!needScope || sameVal(r.scopeID, ps.scopeID))
        && (!needPg || sameVal(r.productGroupID, ps.productGroupID)));
      if (!hit) continue;
    }
    out.push(r.requirementID);
  }
  return out;
}

// Requirements a TICKET inherits live (issue #226 — replaces the #192 stored
// snapshot): the admitted payload-chain product scopes (∩ the ticket's
// productScopeID when set) AND-matched with the ticket's unit, that unit's
// served regions and the ticket's customer. Deliberate divergence from the
// #192 seed: the unit gate reads the TICKET's unit, not ps.businessUnitID.
export function ticketRequirements(ticket) {
  if (!ticket) return [];
  let ids = admittedProductScopeIds(ticket.eventID, ticket.customerID, ticket.supplierID ?? null);
  const chosen = asIds(ticket.productScopeID);
  if (chosen.length) ids = ids.filter((id) => chosen.includes(id));
  const psRows = ids.map((id) => getById('Product Scopes', id)).filter(Boolean);
  const unitIds = asIds(ticket.businessUnitID);
  return matchRequirements({ psRows, unitIds, regionIds: servedRegionIds(unitIds),
    customerId: ticket.customerID ?? null });
}

// Requirements a competence certifies — via its procedure since the
// Procedures round (v3-review Iterations): the linked procedure's requirement
// set (single-valued since issue #231, 1:1; legacy multi-value rows still
// union). A procedure with an EMPTY set applies to every requirement (Q1
// wildcard → null = no restriction). Rows that still carry a legacy stored
// requirementID keep working. Shared with the Jobs certified-responsible
// control (forms.js) since issue #214. Doctrine (issue #231, reverting the
// #226 union): a requirement NEVER enters a competence automatically — the
// quality manager binds it to the Procedure, and the competence inherits
// the procedure's set through this function.
export function competenceRequirements(comp) {
  const pT = resolveTable('Procedures');
  const ids = Array.isArray(comp.procedureID) ? comp.procedureID
    : comp.procedureID != null && comp.procedureID !== '' ? [comp.procedureID] : [];
  if (!pT || !ids.length) return comp.requirementID || null;
  const procs = ids.map((id) => getById(pT, id)).filter(Boolean);
  if (!procs.length) return comp.requirementID || null;
  const set = [];
  for (const p of procs) {
    const reqs = Array.isArray(p.requirementID) ? p.requirementID
      : p.requirementID != null && p.requirementID !== '' ? [p.requirementID] : [];
    if (!reqs.length) return null; // wildcard procedure — certifies all
    reqs.forEach((r) => { if (!set.includes(r)) set.push(r); });
  }
  return set;
}

// CERTIFIED-USERS(taskField) — People eligible to execute a task (issue #214,
// the certified-responsible doctrine at the Tasks level): a user qualifies
// when they hold at least one CERTIFIED Onboarding (isCertified) on a
// task-compatible competence (a competence without taskID is generic; one
// with it must name the task), and the union of those competences' requirement
// coverage (competenceRequirements — null = wildcard, covers everything)
// includes EVERY requirement the task derives from its procedures (AND
// semantics; a wildcard procedure adds no requirement to the task's set).
// `extraReqIds` (issue #233) narrows eligibility by context: inside a ticket's
// Tasks tab the caller passes the ticket's inherited requirement set, so
// coverage must span the task set ∪ the ticket set.
export function certifiedUsersForTask(taskId, extraReqIds = []) {
  if (taskId == null || taskId === '') return [];
  const list = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
  const obT = resolveTable('Onboarding');
  const compT = resolveTable('Competence');
  const procT = resolveTable('Procedures');
  if (!obT || !compT) return [];
  const taskReqs = [];
  if (procT) {
    for (const p of getEntity(procT)) {
      if (!list(p.taskID).includes(taskId)) continue;
      list(p.requirementID).forEach((r) => { if (!taskReqs.includes(r)) taskReqs.push(r); });
    }
  }
  list(extraReqIds).forEach((r) => { if (!taskReqs.includes(r)) taskReqs.push(r); });
  // union each user's certified, task-compatible coverage before testing —
  // two partial competences may cover the task's set together, whether they
  // sit on separate onboardings or in one onboarding's competence GROUP
  // (competenceID multivalued since issue #239; isCertified covers the group)
  const cover = new Map(); // userID → { all, reqs:Set }
  for (const ob of getEntity(obT)) {
    if (ob.isCertified !== true) continue;
    if (ob.userID == null || ob.userID === '') continue;
    for (const compId of list(ob.competenceID)) {
      const comp = getById(compT, compId);
      if (!comp) continue;
      const compTasks = list(comp.taskID);
      if (compTasks.length && !compTasks.includes(taskId)) continue;
      const cur = cover.get(ob.userID) || { all: false, reqs: new Set() };
      const reqs = competenceRequirements(comp);
      if (reqs == null) cur.all = true;
      else list(reqs).forEach((r) => cur.reqs.add(r));
      cover.set(ob.userID, cur);
    }
  }
  const out = [];
  for (const [uid, c] of cover) {
    if (c.all || taskReqs.every((r) => c.reqs.has(r))) out.push(uid);
  }
  return out;
}

// CERTIFIED-USERS cell text — shared by derivedValue and the ticket-context
// subitem accessor (issue #233, mapSubitem in app.js).
export function certifiedUsersDisplay(taskId, extraReqIds = [], display = null, depth = 1) {
  const ids = certifiedUsersForTask(taskId, extraReqIds);
  if (!ids.length) return '—';
  return idsToDisplay(ids, [resolveTable('People')], display, depth) || '—';
}

// Users eligible to execute a PROCEDURE (issue #271): holders of a CERTIFIED
// Onboarding (isCertified) on a competence bound to this procedure
// (Competence.procedureID, 1:1 since #231; legacy array rows still match).
// Strict association, no wildcard — a competence WITHOUT a procedure widens
// staffing coverage (competenceRequirements → null), but it does not staff a
// specific procedure's Users column: the issue asks for "the competence
// associated with the specified procedure".
export function certifiedUsersForProcedure(procId) {
  if (procId == null || procId === '') return [];
  const obT = resolveTable('Onboarding');
  const compT = resolveTable('Competence');
  if (!obT || !compT) return [];
  const out = [];
  for (const ob of getEntity(obT)) {
    if (ob.isCertified !== true) continue;
    if (ob.userID == null || ob.userID === '') continue;
    if (out.includes(ob.userID)) continue;
    for (const compId of asIds(ob.competenceID)) {
      const comp = getById(compT, compId);
      if (comp && matches(comp.procedureID, procId)) { out.push(ob.userID); break; }
    }
  }
  return out;
}

// The single procedure a requirement context selects for a task (issue #270):
// candidates = the task's procedures whose requirement set COVERS every id in
// `reqIds` — AND semantics, the engine-wide coverage posture of
// certifiedUsersForTask; an EMPTY procedure set is the Q1 wildcard and covers
// everything. Exactly one candidate → that procedure row; zero or several →
// null (the GAP tag: no unambiguous documented method for the combination —
// including a wildcard procedure coexisting with a specific one, which is a
// genuine ambiguity the quality manager must resolve).
export function ticketProcedureForTask(taskId, reqIds = []) {
  if (taskId == null || taskId === '') return null;
  const pT = resolveTable('Procedures');
  if (!pT) return null;
  const need = asIds(reqIds).map(String);
  const hits = getEntity(pT).filter((p) => matches(p.taskID, taskId))
    .filter((p) => {
      const set = asIds(p.requirementID).map(String);
      return !set.length || need.every((r) => set.includes(r));
    });
  return hits.length === 1 ? hits[0] : null;
}

// TICKET-PROCEDURE cell text — shared by derivedValue (task-level fallback,
// no context: unique procedure or GAP) and the ticket-context subitem
// accessor (mapSubitem in app.js), which passes the ticket's live inherited
// requirement set (#226).
export function ticketProcedureDisplay(taskId, reqIds = [], display = null) {
  const p = ticketProcedureForTask(taskId, reqIds);
  if (!p) return 'GAP';
  const v = p[display || 'procedureRegistry'];
  return v == null || v === '' ? String(p.procedureID) : String(v);
}

// Customer-provided INPUTS of a ticket (issue #280): for each task of the
// ticket's processes, the ticket's live inherited requirement set (#226)
// narrows the task's procedures to exactly ONE (#270 AND coverage — a GAP
// or ambiguous task contributes nothing: while the method is unresolved its
// inputs are unknowable), and that procedure's input handouts flagged
// customerFlag === true (real boolean, #218 strict-gate posture) collect,
// deduped in first-seen order. Returns Handout ROWS — the Tickets Inputs
// subitem tab renders them directly (mapSubitem in app.js).
export function ticketInputHandouts(ticket) {
  const hT = resolveTable('Handouts');
  const tT = resolveTable('Tasks');
  if (!hT || !tT || !ticket) return [];
  const procIds = asIds(ticket.processID);
  if (!procIds.length) return [];
  const need = ticketRequirements(ticket);
  const seen = new Set();
  const out = [];
  for (const task of getEntity(tT)) {
    if (!procIds.some((p) => matches(task.processID, p))) continue;
    const proc = ticketProcedureForTask(task.taskID, need);
    if (!proc) continue;
    for (const hid of asIds(proc.taskInput)) {
      if (seen.has(String(hid))) continue;
      seen.add(String(hid));
      const h = getById(hT, hid);
      if (h && h.customerFlag === true) out.push(h);
    }
  }
  return out;
}

// derived attribute value for a table cell. Attrs flagged `gap-tag` in the
// datamodel render an EMPTY derived value as the GAP tag (issue #271): the
// system points at the hole — a procedure nobody is certified to execute, a
// task with no documented method — instead of a silent dash. The caution-pill
// styling lives in withAccessors (app.js); every other consumer (drawer,
// subitem cells) inherits the tag through this wrapper.
// `displayOverride` forces a display field (used by resolveDisplay hops).
export function derivedValue(tableName, attr, row, depth = 0, displayOverride = null) {
  const v = derivedValueInner(tableName, attr, row, depth, displayOverride);
  if (attr && attr['gap-tag'] === true
      && (v == null || v === '' || v === '—' || (Array.isArray(v) && !v.length))) {
    return 'GAP';
  }
  return v;
}

function derivedValueInner(tableName, attr, row, depth = 0, displayOverride = null) {
  const r = parseRule(attr.rule);
  if (!r || r.kind === 'enum') return row[attr.name] ?? '—';
  if (r.kind === 'steporder') return stepOrderValue(tableName, r, row);
  if (r.kind === 'certifiedusers') {
    // srcField picks the chain (issue #271): taskID = task-level eligibility
    // (certifiedUsersForTask); procedureID = holders of a certified competence
    // bound to THIS procedure (certifiedUsersForProcedure, strict association)
    if (r.srcField === 'procedureID') {
      const ids = certifiedUsersForProcedure(row[r.srcField]);
      if (!ids.length) return '—';
      return idsToDisplay(ids, [resolveTable('People')], r.display, depth + 1) || '—';
    }
    return certifiedUsersDisplay(row[r.srcField], [], r.display, depth + 1);
  }
  if (r.kind === 'inheritedreqs') {
    const ids = ticketRequirements(row);
    if (!ids.length) return '—';
    const s = idsToDisplay(ids, [resolveTable('Requirements')], r.display, depth + 1);
    return s || '—';
  }
  if (r.kind === 'ticketprocedure') {
    return ticketProcedureDisplay(row[r.srcField], [], r.display);
  }
  if (r.kind === 'ticketinputs') {
    const rows = ticketInputHandouts(row);
    if (!rows.length) return '—';
    return rows.map((h) => {
      const v = h[r.display || 'handoutName'];
      return v == null || v === '' ? String(h.handoutID) : String(v);
    }).join(', ');
  }
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
        const kids = childrenOf(tableName, row, child, { via: simpleVia(rr.via), viaList: rr.viaList });
        // a child field may itself be derived (Tasks.executionTime sums the
        // task's Procedures since 2026-08-04) — nested sums resolve through
        // derivedValue instead of reading a raw key that no longer exists
        const childCat = getCatalog(child);
        // no chained children → the stored manual estimate stands (#192
        // posture, issue #242: most demo events chain no tasks yet — the
        // planner's number is the honest value until the chain exists)
        if (!kids.length && row[attr.name] != null && row[attr.name] !== '') {
          return row[attr.name];
        }
        const sum = kids.reduce((s, k) => {
          let v = Number(k[r.field]);
          if (k[r.field] == null || Number.isNaN(v)) {
            const ca = childCat && childCat.byName[r.field];
            v = ca ? Number(derivedValue(child, ca, k, depth + 1)) : NaN;
          }
          return s + (Number.isNaN(v) ? 0 : v);
        }, 0);
        // "SUM(...) * field" scales by the row's own field (issue #242);
        // a blank multiplier counts as 1 so drafts don't zero out
        if (r.multiplierField) {
          const mv = Number(row[r.multiplierField]);
          return sum * (Number.isNaN(mv) || row[r.multiplierField] == null
            || row[r.multiplierField] === '' ? 1 : mv);
        }
        return sum;
      }
    }
    // stored fallback (generator may have precomputed it)
    return row[attr.name] ?? '—';
  }

  if (r.kind === 'diff') {
    // computed: a - b over the row's own attrs — a derived operand (e.g. the
    // consumption rollup) resolves through derivedValue; a stored one reads raw
    const cat = getCatalog(tableName);
    const num = (name) => {
      const a2 = cat && cat.byName[name];
      const v = a2 && a2.rule ? derivedValue(tableName, a2, row, depth + 1) : row[name];
      const n = Number(v);
      return Number.isNaN(n) ? 0 : n;
    };
    return num(r.minuend) - num(r.subtrahend);
  }
  if (r.kind === 'format') {
    // computed: FORMAT(dateField, 'YYYY-MonthName') — stored value wins so the
    // generator's precomputed labels are untouched; derives for new records
    const stored = row[attr.name];
    if (stored != null && stored !== '') return stored;
    const v = row[r.srcField];
    if (v == null || v === '') return '—';
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) return String(v);
    if (/YYYY-MonthName/i.test(r.pattern)) return `${d.getUTCFullYear()}-${MONTH_NAMES[d.getUTCMonth()]}`;
    return String(v);
  }
  if (r.kind === 'map') {
    // computed: MAP(objField → Table) — row[srcField] is { id: value };
    // render "name: value" pairs, keeping the raw id when the record is gone
    const obj = row[r.srcField];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '—';
    const t = r.target ? resolveTable(r.target) : null;
    const parts = [];
    for (const [id, v] of Object.entries(obj)) {
      if (v == null || v === '') continue;
      let name = id;
      if (t) {
        const rec = getById(t, id);
        if (rec) {
          const cat = getCatalog(t);
          const df = r.display && r.display !== cat.pk ? r.display : cat.label;
          const d = resolveDisplay(t, rec, df, depth + 1);
          if (d !== '') name = String(d);
        }
      }
      parts.push(`${name}: ${specValueLabel(v)}`);
    }
    return parts.length ? parts.join(', ') : '—';
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

  // computed CONCAT across the row's own (cross-table) fields, e.g.
  // competenceName. Only when not stored, so precomputed values still win.
  if (r.concat) {
    const s = computedConcat(tableName, r.concat, row, depth + 1);
    return s.replace(/\s+/g, ' ').trim() || '—';
  }

  // path-computed via ("computed: Workflows via: workflowID.productScopeID.scopeID"):
  // traverse the dotted path from this row's stored fields, then resolve the
  // final raw values against the last segment's domain (display names win).
  if (r.via && r.via.includes('.') && !r.viaList) {
    const vals = pathValues(tableName, row, r.via, depth + 1);
    if (vals.length) {
      const dom = pathDomain(tableName, r.via);
      if (dom) {
        const s = idsToDisplay(vals, [dom], display, depth + 1);
        if (s !== '') return s;
      }
      return vals.join(', ');
    }
    // path unstored on this record — fall through to the generic strategies
  }

  // derived: resolve children, then display names or count
  const child = target || domainByName(attr.name);
  if (!child || child === tableName) return '—';
  const kids = childrenOf(tableName, row, child, { via: simpleVia(r.via), viaList: r.viaList });
  const cCat = getCatalog(child);
  let df = display && display !== cCat.pk ? display : null;
  // no display declared: the attribute's own name doubles as the display
  // field when the child can answer it (e.g. requirementName)
  if (!df && attr.name !== cCat.pk && (cCat.byName[attr.name] || cCat.label === attr.name)) {
    df = attr.name;
  }
  // *Name/*Title attrs are display requests even when the child doesn't
  // declare the field — resolveDisplay can answer through a sibling hop
  // (e.g. Factories.scopeName → Forecast Scopes.scopeID → Scopes). Falls
  // back to the count below when nothing resolves.
  let dfGuessed = false;
  if (!df && attr.name !== cCat.pk && /(Name|Title)$/.test(attr.name)) {
    df = attr.name; dfGuessed = true;
  }
  if (df) {
    const names = dedupe(kids
      .map((k) => String(resolveDisplay(child, k, df, depth + 1)))
      // guessed display fields must yield real names — drop counts that
      // bubbled up from deeper unresolved hops
      .filter((s) => s !== '' && !(dfGuessed && /^\d+(\.\d+)?$/.test(s))));
    if (names.length) return names.join(', ');
    return dfGuessed ? kids.length : '—';
  }
  return kids.length; // rollups without a display field render as a count
}

// via directives with dots/commas describe through-chains the simple join
// can't follow — drop them and let the fallback strategies resolve.
function simpleVia(via) {
  if (!via || via.includes('.') || via.includes(',')) return null;
  return via;
}
