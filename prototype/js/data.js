// data.js — load the mockup dataset, flatten entities, build id indexes and lookup helpers.
// Entity metadata (pk + label) is derived from the datamodel via initMeta(catalog).

const DATA_URL = 'data/mockup_data_prototype.json';

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
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`Failed to load data (${res.status})`);
  const raw = await res.json();
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
  return store;
}

export const getEntity = (name) => store.entities[name] || [];
export const getById = (name, id) => store.index[name]?.get(id);
export const getBaseFields = (name) => store.baseFields[name] || [];

// Register a new in-memory record (non-persistent, resets on reload).
export function addRecord(name, record) {
  const meta = ENTITY_META[name];
  store.entities[name].push(record);
  if (meta) store.index[name].set(record[meta.pk], record);
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
  return before - store.entities[name].length;
}

// Patch an existing record in place (keeps identity so index stays valid).
export function updateRecord(name, id, patch) {
  const rec = getById(name, id);
  if (rec) Object.assign(rec, patch);
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
