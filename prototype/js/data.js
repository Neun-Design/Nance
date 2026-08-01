// data.js — load the mockup dataset, flatten entities, build id indexes and lookup helpers.
// Entity metadata (pk + label) is derived from the datamodel via initMeta(catalog).

const DATA_URL = 'data/mockup_data_prototype.json';
// system registries: predefined datasets shipped with the app (never
// user-registered) — loaded in every mode, blank walkthroughs included
const COUNTRIES_URL = 'data/countries.json';

// "?data=empty" boots every catalogued table blank — stakeholder walkthroughs
// building the QMS from scratch. Records created in this mode persist in
// localStorage (per browser) so a session survives reloads; "?data=empty&reset=1"
// wipes the saved session and starts over. Without the param, the mockup
// dataset loads as usual and nothing persists.
const PARAMS = typeof location !== 'undefined'
  ? new URLSearchParams(location.search) : new URLSearchParams();
export const BLANK_MODE = PARAMS.get('data') === 'empty';
const BLANK_KEY = 'edqms-blank-data';

function persist() {
  if (!BLANK_MODE) return;
  // system registries stay out of the user snapshot — they reload from file
  const { Countries, ...user } = store.entities;
  try { localStorage.setItem(BLANK_KEY, JSON.stringify({ Blank: user })); } catch { /* quota/private mode — keep in-memory */ }
}

// pk + human label field per entity, populated from the datamodel catalogue.
export const ENTITY_META = {};

export function initMeta(catalog) {
  for (const [tname, cat] of Object.entries(catalog)) {
    ENTITY_META[tname] = { pk: cat.pk, label: cat.label };
  }
  // FK_MAP: a field named like another entity's PK references that entity
  for (const k of Object.keys(FK_MAP)) delete FK_MAP[k];
  for (const [name, m] of Object.entries(ENTITY_META)) FK_MAP[m.pk] = name;
}

const store = {
  raw: null,
  entities: {},   // entityName -> array of records
  index: {},      // entityName -> Map(pk -> record)
  baseFields: {}, // entityName -> [field names present in the source JSON, pre-enrichment]
};

// Reverse map: a field named like another entity's PK is a foreign key to that entity.
export const FK_MAP = {};

export async function loadData() {
  let raw;
  if (BLANK_MODE) {
    if (PARAMS.has('reset')) localStorage.removeItem(BLANK_KEY);
    const saved = localStorage.getItem(BLANK_KEY);
    raw = saved ? JSON.parse(saved) : {};
  } else {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`Failed to load data (${res.status})`);
    raw = await res.json();
  }
  store.raw = raw;

  for (const [mod, entities] of Object.entries(raw)) {
    if (mod === '_meta') continue;
    for (const [name, rows] of Object.entries(entities)) {
      store.entities[name] = rows;
      store.baseFields[name] = rows[0] ? Object.keys(rows[0]) : [];
      const meta = ENTITY_META[name];
      const map = new Map();
      if (meta) rows.forEach(r => map.set(r[meta.pk], r));
      store.index[name] = map;
    }
  }
  if (BLANK_MODE) {
    // every catalogued table exists (empty) so tabs, forms and joins render
    for (const name of Object.keys(ENTITY_META)) {
      if (!store.entities[name]) {
        store.entities[name] = [];
        store.index[name] = new Map();
        store.baseFields[name] = [];
      }
    }
  }
  // Countries system registry — installed over whatever the dataset carried
  // (blank mode included: the country list is app data, not user data)
  try {
    const res = await fetch(COUNTRIES_URL);
    if (res.ok) {
      const rows = await res.json();
      store.entities['Countries'] = rows;
      store.baseFields['Countries'] = rows[0] ? Object.keys(rows[0]) : [];
      const meta = ENTITY_META['Countries'];
      const map = new Map();
      if (meta) rows.forEach(r => map.set(r[meta.pk], r));
      store.index['Countries'] = map;
    }
  } catch { /* registry file absent — dataset-provided rows stand */ }
  return store;
}

export const getEntity = (name) => store.entities[name] || [];
export const getById = (name, id) => store.index[name]?.get(id);
export const getBaseFields = (name) => store.baseFields[name] || [];

// Register a new in-memory record (non-persistent, resets on reload).
// Tables catalogued in the datamodel but absent from the dataset (newly
// added entities awaiting seed data) get their store initialized here.
export function addRecord(name, record) {
  const meta = ENTITY_META[name];
  if (!store.entities[name]) {
    store.entities[name] = [];
    store.index[name] = new Map();
    store.baseFields[name] = [];
  }
  store.entities[name].push(record);
  if (meta) store.index[name].set(record[meta.pk], record);
  persist();
  return record;
}

// Remove records by primary key (in-memory only). Returns the number removed.
export function removeRecords(name, ids) {
  const meta = ENTITY_META[name];
  if (!meta || !store.entities[name]) return 0;
  const idSet = new Set(ids);
  const before = store.entities[name].length;
  store.entities[name] = store.entities[name].filter(r => !idSet.has(r[meta.pk]));
  ids.forEach(id => store.index[name].delete(id));
  persist();
  return before - store.entities[name].length;
}

// Patch an existing record in place (keeps identity so index stays valid).
export function updateRecord(name, id, patch) {
  const rec = getById(name, id);
  if (rec) { Object.assign(rec, patch); persist(); }
  return rec;
}

// Look up a field on a related record by id, e.g. lookup('Roles', 'R04', 'roleName').
export function lookup(name, id, field) {
  const rec = getById(name, id);
  if (!rec) return id ?? '';
  return field ? rec[field] : rec[ENTITY_META[name]?.label];
}

// ---- offline snapshots (blank-mode consulting sessions) ----
// The blank-mode store doubles as an offline database: Save serializes it to
// a shareable JSON file (kept outside the repo — OneDrive folder), Import
// loads such a file back. System registries (Countries) never travel in
// snapshots; they reload from app data in every mode.
// schema version of the running app (wired by app.js from the datamodel's
// _meta after loadModel; tests set it explicitly) — snapshots stamp it and
// imports compare it so schema drift is visible to the consultant
let SCHEMA_VERSION = null;
export const setSchemaVersion = (v) => { SCHEMA_VERSION = v; };

export function exportSnapshot() {
  // deep-copy so the snapshot is immutable — later edits to the live store
  // must not leak into an already-taken export (and vice versa)
  const user = {};
  for (const [name, rows] of Object.entries(store.entities)) {
    if (name === 'Countries') continue;
    user[name] = structuredClone(rows);
  }
  return {
    _meta: {
      app: 'EDQMS prototype',
      kind: 'blank-snapshot',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      tables: Object.keys(user).filter((t) => (user[t] || []).length).length,
      records: Object.values(user).reduce((s, r) => s + (r ? r.length : 0), 0),
    },
    Blank: user,
  };
}

// Replace the user store with a snapshot's tables and persist. Table names
// this build doesn't catalogue (schema drift between the file and the app)
// are skipped and reported back so the UI can warn the consultant.
export function importSnapshot(raw) {
  const src = raw && raw.Blank;
  if (!src || typeof src !== 'object' || Array.isArray(src)) {
    throw new Error('not an EDQMS blank snapshot (missing "Blank" section)');
  }
  const skipped = Object.keys(src).filter((n) => !ENTITY_META[n]);
  const fileVersion = (raw._meta && raw._meta.schemaVersion) ?? null;
  const schemaMismatch = fileVersion != null && SCHEMA_VERSION != null
    && String(fileVersion) !== String(SCHEMA_VERSION)
    ? { file: fileVersion, app: SCHEMA_VERSION } : null;
  let records = 0;
  for (const name of Object.keys(ENTITY_META)) {
    if (name === 'Countries') continue;
    // clone: the caller's parsed file must not stay aliased into the store
    const rows = Array.isArray(src[name]) ? structuredClone(src[name]) : [];
    store.entities[name] = rows;
    store.baseFields[name] = rows[0] ? Object.keys(rows[0]) : [];
    const map = new Map();
    rows.forEach((r) => map.set(r[ENTITY_META[name].pk], r));
    store.index[name] = map;
    records += rows.length;
  }
  persist();
  return { records, skipped, schemaMismatch };
}

// Convenience label lookup using the entity's configured label field.
export const label = (name, id) => lookup(name, id, ENTITY_META[name]?.label);
