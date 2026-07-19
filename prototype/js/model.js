// model.js — the datamodel engine core. Loads data/datamodel.json and turns it
// into runtime catalogues per DATAMODEL_GUIDE.md: modules → tabs, column sets
// (table-display / subitem-display), FK display resolution from the rule
// mini-DSL, table-filters, and parsed subitem-tables (directives + nesting).

const DM_URL = 'data/datamodel.json';

let DM = null;
const catalog = {};        // tableName -> catalogue entry
let moduleList = [];       // [{ name, tables: [tableName] }]

const NUMERIC = new Set(['INT', 'DECIMAL']);
const DERIVED = new Set(['rollup', 'computed']);

export const humanize = (f) => String(f)
  .replace(/IDs$/, 's').replace(/ID$/, '')
  .replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

// ---- rule mini-DSL parsing (guide §3.3) ----
export function parseRule(rule) {
  if (!rule) return null;
  let m = rule.match(/^FK\s*→\s*([A-Za-z &]+?)\s*(?:\(display:\s*([A-Za-z]+)\))?\s*$/);
  if (m) return { kind: 'fk', target: m[1].trim(), display: m[2] || null };
  m = rule.match(/^rollup\s*→\s*([A-Za-z &]+?)\s*\(via:\s*([A-Za-z. ]+)\)/);
  if (m) return { kind: 'rollup', target: m[1].trim(), via: m[2].trim() };
  m = rule.match(/^computed:\s*SUM\(([A-Za-z]+)\.([A-Za-z]+)\)/);
  if (m) return { kind: 'sum', childAttr: m[1], field: m[2] };
  m = rule.match(/^computed\s*→\s*([A-Za-z &]+?)\s*\(via:\s*([A-Za-z. ]+)\)/);
  if (m) return { kind: 'computed-path', target: m[1].trim(), via: m[2].trim() };
  m = rule.match(/^enum:\s*(.+)$/);
  if (m) return { kind: 'enum', values: m[1].split('/').map((s) => s.trim()) };
  return null;
}

// ---- subitem-tables entry parsing (guide §9) ----
// "Forecast Scopes" | "Workflows: ordered by indentationID"
// "Actions: rollup via Tasks.activityID" | "Product Scopes -> Competence"
export function parseSubitem(entry) {
  const chain = entry.split('->').map((s) => s.trim());
  const parseOne = (txt) => {
    const [namePart, directive] = txt.split(':').map((s) => s.trim());
    const out = { table: namePart, orderBy: null, viaThrough: null };
    if (directive) {
      let m = directive.match(/ordered by\s+([A-Za-z]+)/i);
      if (m) out.orderBy = m[1];
      m = directive.match(/rollup via\s+([A-Za-z]+)\.([A-Za-z]+)/i);
      if (m) out.viaThrough = { table: m[1], field: m[2] };
    }
    return out;
  };
  const parsed = chain.map(parseOne);
  for (let i = 0; i < parsed.length - 1; i++) parsed[i].nested = parsed[i + 1];
  return parsed[0];
}

export async function loadModel() {
  const res = await fetch(DM_URL);
  if (!res.ok) throw new Error(`Failed to load datamodel (${res.status})`);
  DM = await res.json();

  moduleList = [];
  for (const [mname, m] of Object.entries(DM.modules)) {
    const tables = Object.keys(m.tables).filter(
      (t) => (m.tables[t].visibility || 'show') === 'show');
    moduleList.push({ name: mname, tables });
    for (const tname of tables) {
      catalog[tname] = buildCatalog(mname, tname, m.tables[tname]);
    }
  }
  return { modules: moduleList, catalog };
}

function buildCatalog(moduleName, tableName, spec) {
  const attrs = spec.attributes || [];
  const stored = attrs.filter((a) => !DERIVED.has(a.type));
  const pkAttr = attrs.find((a) => a.constraints === 'PK');
  const pk = pkAttr ? pkAttr.name : stored[0]?.name;

  // label heuristic: `xxxName`/`xxxTitle` attr, else first non-PK VARCHAR
  const label =
    (stored.find((a) => /(Name|Title)$/.test(a.name) && a.name !== pk) ||
     stored.find((a) => a.type === 'VARCHAR' && a.name !== pk) ||
     pkAttr || stored[0]).name;

  const byName = {};
  attrs.forEach((a) => { byName[a.name] = a; });

  return {
    module: moduleName,
    name: tableName,
    description: spec.description || '',
    pk, label,
    attrs, stored, byName,
    tableFilters: spec['table-filters'] === true,
    cards: spec.cards || null,
    reports: spec.reports || null,
    form: spec.form || null,
    subitems: (Array.isArray(spec['subitem-tables']) ? spec['subitem-tables'] : [])
      .filter((e) => typeof e === 'string' && e.trim())
      .map(parseSubitem),
  };
}

// ---- lookups ----
export const getModules = () => moduleList;
export const getCatalog = (tableName) => catalog[tableName] || null;

// case-insensitive + forgiving table resolution ("tickets", "people", "Function")
export function resolveTable(name) {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  for (const t of Object.keys(catalog)) {
    const tl = t.toLowerCase();
    if (tl === n || tl === n + 's' || tl + 's' === n) return t;
  }
  return null;
}

// find the child attribute that references `parentTable` (FK rule or pk-name match)
export function childKeyFor(childTable, parentTable) {
  const child = catalog[childTable];
  const parent = catalog[parentTable];
  if (!child || !parent) return null;
  for (const a of child.attrs) {
    const r = parseRule(a.rule);
    if (r && r.kind === 'fk' && resolveTable(r.target) === parentTable) return a.name;
  }
  if (child.byName[parent.pk]) return parent.pk;
  return null;
}

// columns for the main table (table-display) or subitem context (subitem-display)
export function columnsFor(tableName, ctx = 'table') {
  const cat = catalog[tableName];
  if (!cat) return [];
  const key = ctx === 'sub' ? 'subitem-display' : 'table-display';
  return cat.attrs.filter((a) => a[key] === true).map((a) => toColumn(a));
}

export function allColumns(tableName) {
  const cat = catalog[tableName];
  return cat ? cat.attrs.map((a) => toColumn(a)) : [];
}

function toColumn(a) {
  const r = parseRule(a.rule);
  const col = {
    key: a.name,
    label: humanize(a.name),
    num: NUMERIC.has(a.type) && !(r && r.kind === 'fk'),
    attr: a,
  };
  if (r && r.kind === 'fk') {
    const target = resolveTable(r.target);
    if (target) col.fk = { table: target, display: r.display };
  }
  if (a.type === 'ENUM') col.enum = true;
  if (a.type === 'LINK') col.link = true;
  if (DERIVED.has(a.type)) col.derived = r || { kind: a.type };
  return col;
}

// filter specs for buildFilterBar: ENUMs + FK selects + one text search
export function filterSpecsFor(tableName) {
  const cat = catalog[tableName];
  if (!cat || !cat.tableFilters) return [];
  const specs = [];
  for (const a of cat.stored) {
    if (specs.length >= 4) break;
    const r = parseRule(a.rule);
    if (a.type === 'ENUM') {
      specs.push({ field: a.name, label: humanize(a.name), type: 'select' });
    } else if (r && r.kind === 'fk' && resolveTable(r.target)) {
      specs.push({ field: a.name, label: humanize(a.name), type: 'select' });
    }
  }
  const txt = cat.stored.find((a) => a.type === 'VARCHAR' && a.name !== cat.pk);
  if (txt && specs.length < 4) {
    specs.push({ field: txt.name, label: humanize(txt.name), type: 'search' });
  }
  return specs;
}
