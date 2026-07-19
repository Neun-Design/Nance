// compute.js — derive computed/mirror/rollup fields (base fields only live in the JSON)
// and provide aggregation helpers used by charts.

import { getEntity, getById, lookup } from './data.js';

// ---- Enrichment: add computed/mirror fields onto records in memory (non-persistent) ----
export function enrichAll() {
  enrichProductScopes();
  enrichTasks();
  enrichCapacity();
  enrichForecasts();
  enrichJobs();
  enrichTickets();
}

// Product Scope gets a friendly composite name used across Operation/Inventory.
function enrichProductScopes() {
  for (const ps of getEntity('Product Scopes')) {
    const grp = getById('Product Groups', ps.productGroupID);
    ps.scopeName = lookup('Scopes', ps.scopeID, 'scopeName');
    ps.businessSegment = grp ? grp.businessSegment : '';
    ps.productScopeName = `${ps.businessSegment || '?'} · ${ps.scopeName || '?'}`;
  }
}

function enrichTasks() {
  for (const t of getEntity('Tasks')) {
    t.actionName = lookup('Actions', t.actionID, 'actionName');
    t.activityName = lookup('Activities', t.activityID, 'activityName');
    t.processName = lookup('Processes', t.processID, 'processName');
    t.eventTitle = lookup('Events', t.eventID, 'eventTitle');
    t.roleName = lookup('Roles', t.roleID, 'roleName');
    const ps = getById('Product Scopes', t.productScopeID);
    t.scopeName = ps ? ps.scopeName : '';
    // taskName = CONCAT(actionName — activityName — processName)  [mirror]
    t.taskName = [t.actionName, t.activityName, t.processName].filter(Boolean).join(' — ');
    t.constraintNames = (t.constrainIDs || []).map(id => lookup('Constraints', id, 'constrainName')).join(', ');
  }
}

function enrichCapacity() {
  for (const c of getEntity('Capacity')) {
    c.utilization = c.availableHours ? Math.round((c.allocatedHours / c.availableHours) * 100) : 0;
  }
}

// Forecast totalEstimatedHours = sum of executionTime of Tasks matching each of the
// forecast's scopes (same productScope + event).
function enrichForecasts() {
  const fscopes = getEntity('Forecast Scopes');
  const tasks = getEntity('Tasks');
  for (const f of getEntity('Forecasts')) {
    const scopes = fscopes.filter(fs => fs.forecastID === f.forecastID);
    let hours = 0;
    for (const fs of scopes) {
      hours += tasks
        .filter(t => t.productScopeID === fs.productScopeID && t.eventID === fs.eventID)
        .reduce((s, t) => s + (t.executionTime || 0), 0);
    }
    f.totalEstimatedHours = hours;
    f.factoryName = lookup('Factories', f.factoryID, 'factoryName');
    f.periodLabel = forecastPeriodLabel(f);
  }
}

function forecastPeriodLabel(f) {
  if (f.forecastPeriod === 'Month') return `${f.forecastYear}-M${String(f.forecastMonth).padStart(2, '0')}`;
  if (f.forecastPeriod === 'Quarter') return `${f.forecastYear} Q${f.forecastQuarter}`;
  return `${f.forecastYear}`;
}

function enrichJobs() {
  for (const j of getEntity('Jobs')) {
    const t = getById('Tasks', j.taskID);
    j.roleID = t ? t.roleID : '';
    j.roleName = t ? lookup('Roles', t.roleID, 'roleName') : '';
    j.plannedTime = t ? t.executionTime : null;
    j.executionGap = (j.realExecutionTime != null && j.plannedTime != null)
      ? j.realExecutionTime - j.plannedTime : null;
    j.userName = lookup('People', j.userID, 'userName');
  }
}

function enrichTickets() {
  for (const tk of getEntity('Tickets')) {
    tk.eventTitle = lookup('Events', tk.eventID, 'eventTitle');
    tk.ownerName = lookup('People', tk.ticketOwner, 'userName');
    tk.projectName = lookup('Projects', tk.projectID, 'projectName');
  }
}

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
