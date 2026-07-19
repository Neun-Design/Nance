// queries.js — the declarative query map for report and card prose rules
// (DATAMODEL_GUIDE §4/§5). Prose isn't machine-parseable, so each rule maps to
// one named function; the engine (reports.js / cards.js) looks them up by
// `<Table>::<Report-X|Card R-C>`. Every function is asserted against the
// mockup dataset by prototype/tools/test_queries.mjs.

import { getEntity, getById, lookup } from './data.js';

const TODAY = new Date('2026-07-19');

// ---------- aggregation helpers ----------
const sum = (rows, f) => rows.reduce((s, r) => s + (Number(r[f]) || 0), 0);
function groupAgg(rows, keyF, valF = null) {
  const m = new Map();
  for (const r of rows) {
    const k = typeof keyF === 'function' ? keyF(r) : r[keyF];
    if (k == null || k === '') continue;
    m.set(k, (m.get(k) || 0) + (valF ? (Number(typeof valF === 'function' ? valF(r) : r[valF]) || 0) : 1));
  }
  return m;
}
const topEntries = (m, n = 12) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
function bar(title, m, labelFn, limit = 12) {
  const es = topEntries(m, limit);
  return { type: 'multibar', title, cats: es.map(([k]) => String(labelFn ? labelFn(k) : k)), series: [{ name: title, data: es.map(([, v]) => Math.round(v * 10) / 10) }] };
}
function donut(title, m, labelFn) {
  return { type: 'donut', title, groupBy: '__k', agg: 'sum', valueField: '__v',
    __pre: [...m.entries()].map(([k, v]) => ({ __k: String(labelFn ? labelFn(k) : k), __v: v })) };
}
function dual(title, cats, aName, aData, bName, bData, stacked = false) {
  return { type: 'multibar', title, cats, stacked, series: [{ name: aName, data: aData }, { name: bName, data: bData }] };
}
const monthKey = (d) => (d ? String(d).slice(0, 7) : null);
const procName = (pid) => lookup('Processes', pid, 'processName') || pid;
const factName = (fid) => lookup('Factories', fid, 'factoryName') || fid;
const jobProc = (j) => { const t = getById('Tickets', j.ticketID); return t ? t.processID : null; };

// ---------- REPORT QUERIES ----------
export const REPORT_QUERIES = {
  'Factories::Report-A': (rows) =>
    bar('Forecast Count by Factory', groupAgg(getEntity('Forecasts'), 'factoryID'), factName),

  // monthly budgeted hours (weeklyUsageQuota × ~4 weeks) vs ticket execution hours
  'Forecasts::Report-A': (rows) => {
    const budget = groupAgg(rows, 'periodFrame', (r) => r.weeklyUsageQuota * 4);
    const tickets = groupAgg(getEntity('Tickets'), (t) => {
      const mk = monthKey(t.targetDate); return mk ? mk.replace('-', '-M') : null;
    }, 'ticketExecutionTime');
    const months = [...new Set([...budget.keys(), ...tickets.keys()])].sort();
    return dual('Budgeted (quota) vs Ticket Execution Hours / Month', months,
      'Budgeted hours', months.map((m) => budget.get(m) || 0),
      'Ticket execution hours', months.map((m) => tickets.get(m) || 0));
  },

  'Forecast Scopes::Report-A': (rows) => stackedScopeHours(rows),
  'Forecast Scopes::Report-B': (rows) => stackedScopeHours(rows),

  'Tasks::Report-A': (rows) => bar('Tasks by Process', groupAgg(rows, 'processID'), procName),
  'Tasks::Report-B': (rows) =>
    bar('Tasks by Function', groupAgg(rows, 'functionID'), (k) => lookup('Functions', k, 'functionName') || k),

  'Events::Report-A': (rows) =>
    bar('Total Execution Time per Event', groupAgg(getEntity('Tasks'), 'eventID', 'executionTime'),
      (k) => lookup('Events', k, 'eventTitle') || k, 10),
  'Events::Report-B': (rows) =>
    bar('Tasks Count by Event', groupAgg(getEntity('Tasks'), 'eventID'),
      (k) => lookup('Events', k, 'eventTitle') || k, 10),

  'Processes::Report-A': (rows) => bar('Tasks by Process', groupAgg(getEntity('Tasks'), 'processID'), procName),

  'Tickets::Report-A': (rows) => bar('Tickets by Customer', groupAgg(rows, 'customerName'), null),
  'Tickets::Report-B': (rows) =>
    donut('Tickets by Scope', groupAgg(rows, 'scopes'), (k) => lookup('Scopes', k, 'scopeName') || k),

  'Projects::Report-A': (rows) => {
    const done = rows.filter((p) => /closed|done|complete/i.test(p.projectStatus || '')) ;
    const use = done.length ? done : rows;
    return dual('Estimated vs Real Execution Time per Project',
      use.map((p) => p.projectName),
      'Estimated', use.map((p) => p.estimatedTime || 0),
      'Real', use.map((p) => p.executionTime || 0));
  },

  'Jobs::Report-A': (rows) => {
    const planned = groupAgg(rows, 'customerName', 'plannedExecutionTime');
    const real = groupAgg(rows, 'customerName', 'realExecutionTime');
    const cats = [...planned.keys()];
    return dual('Planned vs Real Execution Hours by Factory', cats,
      'Planned', cats.map((c) => Math.round(planned.get(c) || 0)),
      'Real', cats.map((c) => Math.round(real.get(c) || 0)));
  },
  'Jobs::Report-B': (rows) =>
    bar('Real Execution Hours by Role', groupAgg(rows, 'roleID', 'realExecutionTime'),
      (k) => lookup('Roles', k, 'roleName') || k),

  'Capacity::Report-A': (rows) => {
    const avail = groupAgg(rows, 'factoryID', 'availableHours');
    const alloc = groupAgg(rows, 'factoryID', 'allocatedHours');
    const cats = [...avail.keys()];
    return dual('Available vs Allocated Hours by Factory', cats.map(factName),
      'Available', cats.map((c) => Math.round(avail.get(c) || 0)),
      'Allocated', cats.map((c) => Math.round(alloc.get(c) || 0)));
  },

  'Performance::Report-A': (rows) => {
    const planned = groupAgg(rows, 'customerName', 'plannedHours');
    const real = groupAgg(rows, 'customerName', 'realExecutionTime');
    const cats = [...planned.keys()];
    return dual('Planned vs Real Hours by Factory', cats,
      'Planned', cats.map((c) => Math.round(planned.get(c) || 0)),
      'Real', cats.map((c) => Math.round(real.get(c) || 0)));
  },
  'Performance::Report-B': (rows) =>
    bar('Variance by Process', groupAgg(rows, (r) => {
      const t = getById('Tickets', r.ticketID); return t ? procName(t.processID) : null;
    }, 'variance'), null),

  'Roles::Report-A': (rows) =>
    donut('Headcount by Function', groupAgg(rows, 'functionID', 'quantity'),
      (k) => lookup('Functions', k, 'functionName') || k),

  'Skill Levels::Report-A': (rows) =>
    donut('Headcount by Skill Level', groupAgg(getEntity('Roles'),
      (r) => lookup('Skill Levels', r.skillLevelID, 'levelName') || r.skillLevelID, 'quantity'), null),

  'Functions::Report-A': (rows) =>
    bar('Headcount by Function', groupAgg(getEntity('Roles'),
      (r) => lookup('Functions', r.functionID, 'functionName') || r.functionID, 'quantity'), null),

  'Graduation::Report-A': (rows) =>
    donut('Headcount by Graduation Field', groupAgg(getEntity('Roles'),
      (r) => lookup('Graduation', r.graduationID, 'field') || r.graduationID, 'quantity'), null),

  'People::Report-A': (rows) =>
    bar('Active People by Function', groupAgg(rows.filter((p) => p.isActive), 'functionID'),
      (k) => lookup('Functions', k, 'functionName') || k),
};

function stackedScopeHours(rows) {
  const scopeOf = (r) => lookup('Scopes', r.scopeID, 'scopeName') || r.scopeID;
  const cats = [...new Set(rows.map(scopeOf))];
  const fns = [...new Set(rows.map((r) => r.functionName).filter(Boolean))];
  return {
    type: 'multibar', stacked: true, title: 'Estimated Hours by Scope (stacked by Function)',
    cats,
    series: fns.map((fn) => ({
      name: fn,
      data: cats.map((c) => Math.round(sum(rows.filter((r) => scopeOf(r) === c && r.functionName === fn), 'estimatedHours'))),
    })),
  };
}

// ---------- CARD QUERIES ----------
// each returns { main, trendPct (± number | null), detail, list? }
export const CARD_QUERIES = {
  'Tasks::Card 1-1': () => {
    const byName = new Map();
    for (const t of getEntity('Tasks')) {
      if (!byName.has(t.taskName)) byName.set(t.taskName, new Set());
      byName.get(t.taskName).add(t.processID);
    }
    const top = [...byName.entries()].map(([n, s]) => [n, s.size])
      .filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { main: top.length ? `${top.length} recurrent` : '0',
      trendPct: null,
      detail: 'tasks appearing in multiple processes',
      list: top.map(([n, c]) => `${n} — ${c} processes`) };
  },

  'Tickets::Card 1-1': () => {
    const tks = getEntity('Tickets');
    const created = (t) => t.ticketCreatedAt ? new Date(t.ticketCreatedAt) : null;
    const daysAgo = (n) => new Date(TODAY.getTime() - n * 86400000);
    const last5 = tks.filter((t) => created(t) && created(t) >= daysAgo(5)).length;
    const thisMonth = tks.filter((t) => monthKey(t.ticketCreatedAt) === '2026-07').length;
    const prevMonth = tks.filter((t) => monthKey(t.ticketCreatedAt) === '2026-06').length;
    const trendPct = prevMonth ? Math.round(((thisMonth - prevMonth) / prevMonth) * 100) : null;
    return { main: String(last5), trendPct,
      detail: `${thisMonth} created this month`, };
  },

  'Capacity::Card 1-1': () => {
    const rows = getEntity('Capacity');
    const util = (rs) => { const a = sum(rs, 'allocatedHours'), b = sum(rs, 'availableHours'); return b ? a / b : 0; };
    const total = util(rows);
    const inWindow = (r, from, to) => { const d = new Date(r.periodStart); return d >= from && d < to; };
    const m = (n) => new Date(TODAY.getFullYear(), TODAY.getMonth() - n, 1);
    const recent = rows.filter((r) => inWindow(r, m(3), m(0)));
    const prior = rows.filter((r) => inWindow(r, m(6), m(3)));
    const trendPct = prior.length ? Math.round(((util(recent) - util(prior)) / util(prior)) * 100) : null;
    return { main: `${Math.round(total * 100)}%`, trendPct,
      detail: `${Math.round(sum(rows, 'allocatedHours'))} / ${Math.round(sum(rows, 'availableHours'))} h` };
  },

  'Capacity::Card 1-2': () => {
    const rows = getEntity('Capacity');
    const gapBy = groupAgg(rows, 'factoryID', (r) => (r.availableHours - r.allocatedHours));
    const es = [...gapBy.entries()];
    const mean = es.reduce((s, [, v]) => s + v, 0) / (es.length || 1);
    const top = es.sort((a, b) => b[1] - a[1])[0];
    return { main: top ? factName(top[0]) : '—', trendPct: null,
      detail: top ? `${Math.round(top[1])} h gap vs ${Math.round(mean)} h average` : '' };
  },

  'Performance::Card 1-1': () => {
    const jobs = getEntity('Jobs').filter((j) => j.realExecutionTime != null);
    const byProc = new Map();
    for (const j of jobs) {
      const p = jobProc(j); if (!p) continue;
      if (!byProc.has(p)) byProc.set(p, []);
      byProc.get(p).push(Number(j.realExecutionTime) || 0);
    }
    let top = null;
    for (const [p, vals] of byProc) {
      if (vals.length < 2) continue;
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
      if (!top || sd > top.sd) top = { p, sd, vals };
    }
    if (!top) return { main: '—', trendPct: null, detail: 'no job spread yet' };
    const sorted = [...top.vals].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return { main: `${top.sd.toFixed(1)} h σ`, trendPct: null,
      detail: `${procName(top.p)} — median ${median.toFixed(1)} h × variance ${(top.sd ** 2).toFixed(1)}` };
  },

  'Performance::Card 1-2': () => {
    const rows = getEntity('Performance');
    const eff = (rs) => { const p = sum(rs, 'plannedHours'), r = sum(rs, 'realExecutionTime'); return r ? ((p / r) - 1) * 100 : 0; };
    const total = eff(rows);
    const recent = rows.filter((r) => new Date(r.periodYear, r.periodMonth - 1, 1) >= new Date(2026, 3, 1));
    const prior = rows.filter((r) => { const d = new Date(r.periodYear, r.periodMonth - 1, 1); return d >= new Date(2026, 0, 1) && d < new Date(2026, 3, 1); });
    const trendPct = prior.length ? Math.round(eff(recent) - eff(prior)) : null;
    return { main: `${total.toFixed(1)}%`, trendPct,
      detail: `${Math.round(sum(rows, 'plannedHours'))} planned / ${Math.round(sum(rows, 'realExecutionTime'))} real h` };
  },

  'Skill Levels::Card 1-1': () => {
    const m = groupAgg(getEntity('Roles'), 'skillLevelID', 'quantity');
    const top = topEntries(m, 1)[0];
    return { main: top ? String(top[1]) : '—', trendPct: null,
      detail: top ? (lookup('Skill Levels', top[0], 'levelName') || top[0]) : '' };
  },
};
