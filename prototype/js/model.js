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
  // enum spellings: "enum: A/B", "enum: A, B", "enum: ['A', 'B']"
  let m = txt.match(/^enum:\s*(.+)$/i);
  if (m) {
    const body = m[1].trim().replace(/^\[|\]$/g, '');
    const values = body.split(/[/,]/).map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    return { kind: 'enum', values };
  }
  // STEPORDER(parentField, ruleField) per groupField — derived outline number
  // for ordered process steps (identation-rule.md): numbering is scoped to the
  // rows sharing groupField, so it never scans beyond one process.
  m = txt.match(/^computed:\s*STEPORDER\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)(?:\s+per\s+([A-Za-z_][A-Za-z0-9_]*))?$/i);
  if (m) return { kind: 'steporder', parentField: m[1], ruleField: m[2], groupField: m[3] || null };
  // CERTIFIED-USERS(taskField) — People eligible to execute a task: certified
  // Onboarding on a task-compatible competence covering ALL the task's derived
  // requirements (issue #214, certifiedUsersForTask in resolve.js)
  m = txt.match(/^computed:\s*CERTIFIED-USERS\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)(?:\s*\(\s*display:\s*([A-Za-z_][A-Za-z0-9_]*)\s*\))?$/i);
  if (m) return { kind: 'certifiedusers', srcField: m[1], display: m[2] || null };
  // INHERITED-REQUIREMENTS(eventField) — Active requirements a ticket inherits
  // live from its applicability context: admitted payload-chain scopes +
  // unit/region/customer AND-match (issue #226, ticketRequirements in resolve.js)
  m = txt.match(/^computed:\s*INHERITED-REQUIREMENTS\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)(?:\s*\(\s*display:\s*([A-Za-z_][A-Za-z0-9_]*)\s*\))?$/i);
  if (m) return { kind: 'inheritedreqs', srcField: m[1], display: m[2] || null };
  // optional multiplier: "SUM(taskID.executionTime) * forecastScopeQuantity"
  // scales the child sum by one of the row's own fields (issue #242)
  m = txt.match(/^computed:\s*SUM\(([A-Za-z]+)\.([A-Za-z]+)\)(?:\s*[*×]\s*([A-Za-z_][A-Za-z0-9_]*))?/i);
  if (m) return { kind: 'sum', childAttr: m[1], field: m[2], multiplierField: m[3] || null };
  // MAP(objField → Table display: field) — an object map whose keys are ids in
  // Table; renders as "name: value" pairs (e.g. Product Groups specValues)
  m = txt.match(/^computed:\s*MAP\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:→|->)\s*([A-Za-z][A-Za-z &]*?)\s*(?:display:\s*([A-Za-z_][A-Za-z0-9_]*))?\s*\)$/i);
  if (m) return { kind: 'map', srcField: m[1], target: m[2].trim(), display: m[3] || null };
  // FORMAT(dateField, 'pattern') — date reformatting, e.g. Forecasts.periodFrame
  // as 'YYYY-MonthName' ("2025-August"). Stored values still win at render time.
  m = txt.match(/^computed:\s*FORMAT\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*'([^']+)'\s*\)$/i);
  if (m) return { kind: 'format', srcField: m[1], pattern: m[2] };

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

  // via: a single field, or a compound key "via: a + b + c" (AND semantics —
  // children must match the parent on every field that is actually stored).
  // Compound entries may be dotted paths ("productScopeID.scopeID"): the
  // parent side traverses the path, the child matches on the last segment.
  // The colon is optional ("rollup → People via departmentID").
  const vm = txt.match(/\bvia:?\s*([A-Za-z_][A-Za-z0-9_.]*(?:\s*\+\s*[A-Za-z_][A-Za-z0-9_.]*)*)/i);
  let via = null, viaList = null;
  if (vm) {
    const parts = vm[1].split('+').map((s) => s.trim()).filter(Boolean);
    via = parts[0];
    if (parts.length > 1) viaList = parts;
  }

  // target table: after the arrow, from DISTINCT("Table"."field"), or after "kind:"
  let target = null;
  m = txt.match(/^(?:FK|rollup|mirror|computed)\s*(?:→|->)\s*([A-Za-z][A-Za-z &]*?)\s*(?:\(|via\b|display\b|;|,|$)/i);
  if (m) target = m[1].trim();
  if (!target) {
    m = txt.match(/DISTINCT\(\s*"([^"]+)"\s*\.\s*"([^"]+)"\s*\)/i);
    if (m) { target = m[1]; if (!display) display = m[2]; }
  }
  if (!target) {
    m = txt.match(/^(?:FK|rollup|mirror|computed):\s*(?:from\s+|lookup\s+)?([A-Za-z][A-Za-z &]*?)\s*(?:\(|via\b|→|->|;|,|$)/i);
    if (m) target = m[1].trim();
  }

  // "FK: Issues (filtered by issueType='Opportunity')" — option lists and
  // joins only consider target records where field = value
  let filter = null;
  m = txt.match(/filtered by\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*'([^']+)'/i);
  if (m) filter = { field: m[1], value: m[2] };

  // fk keeps via too: "FK → Factories (via: factoryName)" stores the named
  // target field instead of the pk (name-valued FK, e.g. Tasks.customerName)
  if (kind === 'fk') return { kind: 'fk', target, display, concat, via, filter };
  return { kind, target, via, viaList, display, concat, filter };
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
      via: null, throughField: null, mapField: null, label: null };
    // parenthetical directives come out first — they may contain ':'
    const t = txt.replace(/\(([^)]*)\)/g, (_, inner) => {
      let m = inner.match(/via:?\s*([A-Za-z]+)/i);
      if (m) out.via = m[1];
      m = inner.match(/grouped by\s+([A-Za-z]+)/i);
      if (m) out.throughField = m[1];
      // "(map: specValues)" — children synthesize from the PARENT row's
      // object map { childId: value } joined to the child table, each row
      // carrying its value as __mapValue (Product Groups specs, issue #161)
      m = inner.match(/map:?\s*([A-Za-z]+)/i);
      if (m) out.mapField = m[1];
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

// Object entries (guide §9, Squads reference) declare TABBED subitem groups:
//   { "tab-order": 1, "rule": null, "tab-name": "people", "tab-table": "People" }
// `rule` carries the same directive text a string entry would put after ':'
// ("ordered by X", "only f=v", "rollup via T.f") or in parens ("(via: f)").
// The parsed shape is identical to a string entry plus a `tab` marker; the
// renderer switches the expanded row to a tab strip when every group of a
// table carries one (mixed string/object lists keep the stacked layout).
export function normalizeSubitem(entry) {
  if (typeof entry === 'string' && entry.trim()) return parseSubitem(entry);
  if (entry && typeof entry === 'object' && entry['tab-table']) {
    const rule = entry.rule == null ? '' : String(entry.rule).trim();
    const txt = !rule ? String(entry['tab-table'])
      : rule.startsWith('(') ? `${entry['tab-table']} ${rule}`
      : `${entry['tab-table']}: ${rule}`;
    const si = parseSubitem(txt);
    si.tab = {
      name: entry['tab-name'] ? humanize(entry['tab-name']) : si.table,
      order: typeof entry['tab-order'] === 'number' ? entry['tab-order'] : Infinity,
    };
    if (!si.label) si.label = si.tab.name;
    return si;
  }
  return null;
}

// schema version stamped in datamodel _meta (v3-review D9): bumped on every
// schema PR; blank-mode snapshots carry it so imports can detect drift
export function getSchemaVersion() {
  return (DM && DM._meta && DM._meta.schemaVersion) ?? null;
}

export async function loadModel() {
  const res = await fetch(DM_URL);
  if (!res.ok) throw new Error(`Failed to load datamodel (${res.status})`);
  DM = await res.json();

  moduleList = [];
  // Sidebar order is driven by each module's `sidebar-position` (§2 of the
  // datamodel guide); modules without one keep their insertion order, sorted last.
  const entries = Object.entries(DM.modules).map(([mname, m], i) => ({
    mname, m, pos: typeof m['sidebar-position'] === 'number' ? m['sidebar-position'] : Infinity, i,
  }));
  entries.sort((a, b) => (a.pos - b.pos) || (a.i - b.i));
  for (const { mname, m } of entries) {
    const visible = Object.keys(m.tables).filter(
      (t) => (m.tables[t].visibility || 'show') === 'show');
    // Catalogue every visible table so FK / subitem resolution can reach it,
    // even ones kept out of the module's tab strip (dashboard-order 0).
    for (const tname of visible) {
      catalog[tname] = buildCatalog(mname, tname, m.tables[tname]);
    }
    // Tabs within a module follow `dashboard-order` ascending (§ datamodel guide).
    // A value of 0 keeps the table out of the tab strip; a missing value sorts last.
    const orderOf = (t) => {
      const v = m.tables[t]['dashboard-order'];
      return typeof v === 'number' ? v : Infinity;
    };
    const tables = visible
      .filter((t) => orderOf(t) !== 0)
      .sort((a, b) => orderOf(a) - orderOf(b));
    moduleList.push({ name: mname, tables });
  }
  return { modules: moduleList, catalog };
}

const subOrder = (si) =>
  (si.tab && Number.isFinite(si.tab.order)) ? si.tab.order : Number.MAX_SAFE_INTEGER;

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
    // predefined dataset shipped with the app — never user-registered
    systemRegistry: spec['system-registry'] === true,
    subitems: (Array.isArray(spec['subitem-tables']) ? spec['subitem-tables'] : [])
      .map(normalizeSubitem)
      .filter(Boolean)
      // tab-order sorts tabbed entries; string entries keep insertion order
      .sort((a, b) => subOrder(a) - subOrder(b)),
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
  // attribute names leak into table resolution through sloppy rule prose
  // ("rollup: from eventID"): an id-suffixed name must never fuzzy-match a
  // table ("eventid" ~ Events served eventIDs as Process options, 2026-08-04)
  const idish = /id$/.test(n);
  let prefix = null;
  for (const t of Object.keys(catalog)) {
    const tl = norm(t);
    if (tl === n) return t;
    if (!prefix && !idish && n.length >= 5 && (tl.startsWith(n) || n.startsWith(tl))) prefix = t;
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
    // datamodel may override the humanized header via "display-name"
    label: a['display-name'] || humanize(a.name),
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
  // also on stored columns, so FK-ish ids render as display names. CONCAT
  // rules count too: their target parses as null/garbage but the concat
  // parts drive computedConcat (e.g. Competence.competenceName).
  if (!col.fk && (DERIVED.has(a.type)
      || (r && r.kind !== 'enum' && r.kind !== 'sum' && (refRule || r.concat || r.kind === 'format')))) {
    col.derived = r || { kind: a.type };
  }
  if (r && r.kind === 'sum') col.derived = r;
  return col;
}

