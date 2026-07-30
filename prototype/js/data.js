// data.js — load the mockup dataset, flatten entities, build id indexes and lookup helpers.
// Entity metadata (pk + label) is derived from the datamodel via initMeta(catalog).

const DATA_URL = 'data/mockup_data_prototype.json';

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
  try { localStorage.setItem(BLANK_KEY, JSON.stringify({ Blank: store.entities })); } catch { /* quota/private mode — keep in-memory */ }
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

// Convenience label lookup using the entity's configured label field.
export const label = (name, id) => lookup(name, id, ENTITY_META[name]?.label);
