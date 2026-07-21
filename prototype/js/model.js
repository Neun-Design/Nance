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
// The rules in datamodel.json are hand-written prose in many spellings:
//   "FK → Factories (display: CONCAT(factoryName,'-',city)"
//   "rollup → Roles via:functionID (display: roleName)"
//   "rollup: Workflows (via: processID; display: activityName)"
//   "mirror: DISTINCT(\"Tasks\".\"actionName\")"
//   "computed: lookup Actions via activityID (display: actionName)"
// so this parser extracts kind / target / via / display tolerantly instead of
// demanding one canonical shape. Unresolvable prose returns target null and
// the resolver falls back to the attribute-name domain.
const DISPLAY_KEYWORDS = new Set(['FOREACH', 'DISTINCT', 'CONCAT', 'SUM', 'IF']);

export function parseRule(rule) {
  if (!rule) return null;
  const txt = String(rule).trim();
  let m = txt.match(/^enum:\s*(.+)$/i);
  if (m) return { kind: 'enum', values: m[1].split('/').map((s) => s.trim()) };
  m = txt.match(/^computed:\s*SUM\(([A-Za-z]+)\.([A-Za-z]+)\)/i);
  if (m) return { kind: 'sum', childAttr: m[1], field: m[2] };

  const kindM = txt.match(/^(FK|rollup|mirror|computed)\b/i);
  if (!kindM) return null;
  const kind = kindM[1].toLowerCase();

  // display: plain field, or CONCAT(field,'lit',field) parts
  let display = null, concat = null;
  m = txt.match(/CONCAT\(([^)]*)\)?/i);
  if (m) {
    concat = m[1].split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => (/^['"]/.test(s) ? { lit: s.replace(/^['"]|['"]$/g, '') } : { field: s }));
  } else {
    m = txt.match(/display:\s*([A-Za-z_][A-Za-z0-9_]*)/i);
    if (m && !DISPLAY_KEYWORDS.has(m[1].toUpperCase())) display = m[1];
  }

  const vm = txt.match(/via:\s*([A-Za-z_][A-Za-z0-9_.]*)/i);
  const via = vm ? vm[1].trim() : null;

  // target table: after the arrow, from DISTINCT("Table"."field"), or after "kind:"
  let target = null;
  m = txt.match(/^(?:FK|rollup|mirror|computed)\s*(?:→|->)\s*([A-Za-z][A-Za-z &]*?)\s*(?:\(|via\b|display\b|;|,|$)/i);
  if (m) target = m[1].trim();
  if (!target) {
    m = txt.match(/DISTINCT\(\s*"([^"]+)"\s*\.\s*"([^"]+)"\s*\)/i);
    if (m) { target = m[1]; if (!display) display = m[2]; }
  }
  if (!target) {
    m = txt.match(/^(?:rollup|mirror|computed):\s*(?:from\s+|lookup\s+)?([A-Za-z][A-Za-z &]*?)\s*(?:\(|via\b|→|->|;|,|$)/i);
    if (m) target = m[1].trim();
  }

  if (kind === 'fk') return { kind: 'fk', target, display, concat };
  return { kind, target, via, display, concat };
}

// ---- subitem-tables entry parsing (guide §9) ----
// "Forecast Scopes" | "Workflows: ordered by indentationID"
// "Actions: rollup via Tasks.activityID" | "Product Scopes -> Competence"
// "Jobs: only jobStatus=Active|Queued" (status-filtered children)
// "Forecasts: display status=Approved only" (same filter, review spelling)
// "Scopes (via: scopeID)" (join field named inline)
// "Handouts (grouped by inputs)" (children via a through-table field; the
//   group renders as its own labelled list, e.g. "Handouts - Inputs")
export function parseSubitem(entry) {
  const chain = entry.split('->').map((s) => s.trim());
  const parseOne = (txt) => {
    const out = { table: '', orderBy: null, viaThrough: null, only: null,
      via: null, throughField: null, label: null };
    // parenthetical directives come out first — they may contain ':'
    const t = txt.replace(/\(([^)]*)\)/g, (_, inner) => {
      let m = inner.match(/via:?\s*([A-Za-z]+)/i);
      if (m) out.via = m[1];
      m = inner.match(/grouped by\s+([A-Za-z]+)/i);
      if (m) out.throughField = m[1];
      return '';
    }).trim();
    const [namePart, directive] = t.split(':').map((s) => s.trim());
    out.table = namePart;
    if (out.throughField) {
      out.label = `${namePart} - ${out.throughField.charAt(0).toUpperCase()}${out.throughField.slice(1)}`;
    }
    if (directive) {
      let m = directive.match(/ordered by\s+([A-Za-z]+)/i);
      if (m) out.orderBy = m[1];
      m = directive.match(/rollup via\s+([A-Za-z]+)\.([A-Za-z]+)/i);
      if (m) out.viaThrough = { table: m[1], field: m[2] };
      m = directive.match(/only\s+([A-Za-z]+)\s*=\s*(.+)/i)
        || directive.match(/(?:display\s+)?([A-Za-z]+)\s*=\s*(.+?)\s+only\s*$/i);
      if (m) out.only = { field: m[1], values: m[2].split('|').map((s) => s.trim()) };
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

// case-insensitive + forgiving table resolution ("tickets", "people",
// "Function", "Product", "Onboards"). Exact singular/plural match wins;
// a prefix match ("Onboards" → Onboarding) is the fallback.
export function resolveTable(name) {
  if (!name) return null;
  const norm = (s) => String(s).trim().toLowerCase().replace(/[^a-z]/g, '')
    .replace(/ies$/, 'y').replace(/s$/, '');
  const n = norm(name);
  if (!n) return null;
  let prefix = null;
  for (const t of Object.keys(catalog)) {
    const tl = norm(t);
    if (tl === n) return t;
    if (!prefix && n.length >= 5 && (tl.startsWith(n) || n.startsWith(tl))) prefix = t;
  }
  return prefix;
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
  // reference-ish rule: the cell shows a related record's display field,
  // so it is not a numeric column even when the stored type is INT
  const refRule = r && (r.kind === 'fk' || (r.target && resolveTable(r.target)) || r.display);
  const col = {
    key: a.name,
    label: humanize(a.name),
    num: NUMERIC.has(a.type) && !refRule,
    attr: a,
  };
  if (r && r.kind === 'fk') {
    const target = resolveTable(r.target);
    if (target) col.fk = { table: target, display: r.display, concat: r.concat };
  }
  if (a.type === 'ENUM') col.enum = true;
  if (a.type === 'LINK') col.link = true;
  // any relational rule (rollup/mirror/computed) resolves at render time —
  // also on stored columns, so FK-ish ids render as display names
  if (!col.fk && (DERIVED.has(a.type) || (r && r.kind !== 'enum' && r.kind !== 'sum' && refRule))) {
    col.derived = r || { kind: a.type };
  }
  if (r && r.kind === 'sum') col.derived = r;
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
