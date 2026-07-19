// overview.js — executive landing page: KPI cards + headline charts, all computed from data.
// Per PROTOTYPE_REVIEW.md: every card and chart carries a "Details" button that routes to
// its source dashboard; Overview itself exposes no filters — analysis happens at the source.

import { getEntity } from './data.js';
import { renderChart } from './charts.js';
import { REGISTRY } from './registry.js';
import { go } from './router.js';

// Resolve the (module, tab) route that owns an entity's dashboard.
function routeFor(entity) {
  for (let mi = 0; mi < REGISTRY.length; mi++) {
    const ti = REGISTRY[mi].tabs.findIndex(t => t.entity === entity);
    if (ti !== -1) return { mi, ti, label: `${REGISTRY[mi].name} › ${REGISTRY[mi].tabs[ti].tab}` };
  }
  return null;
}

function detailsBtn(entity) {
  const r = routeFor(entity);
  if (!r) return null;
  const b = document.createElement('button');
  b.className = 'details-btn';
  b.textContent = 'Details ›';
  b.title = `Open ${r.label} to filter and analyse this data`;
  b.addEventListener('click', () => go(r.mi, r.ti));
  return b;
}

export function renderOverview(container) {
  container.innerHTML = '';
  const charts = [];

  const head = document.createElement('div');
  head.innerHTML = `<div class="tab-title-row"><h2 class="tab-title">Overview</h2>
    <span class="tab-count">Live KPIs computed from the demo dataset</span></div>
    <p class="tab-subtitle">Every figure and chart below is aggregated in the browser from the same data behind each module — use Details to open the source dashboard and apply filters there.</p>`;
  container.appendChild(head);

  // ---- KPI cards ----
  const projects = getEntity('Projects');
  const tickets = getEntity('Tickets');
  const jobs = getEntity('Jobs');
  const capacity = getEntity('Capacity');
  const onboarding = getEntity('Onboarding');
  const forecasts = getEntity('Forecasts');

  const activeProjects = projects.filter(p => p.projectStatus === 'In Progress').length;
  const openTickets = tickets.filter(t => ['Open', 'InProgress', 'Escalated'].includes(t.ticketStatus)).length;
  const doneJobs = jobs.filter(j => j.jobStatus === 'Done').length;
  const totAvail = capacity.reduce((s, c) => s + (c.availableHours || 0), 0);
  const totAlloc = capacity.reduce((s, c) => s + (c.allocatedHours || 0), 0);
  const util = totAvail ? Math.round((totAlloc / totAvail) * 100) : 0;
  const certified = onboarding.filter(o => o.isCertified).length;
  const certRate = onboarding.length ? Math.round((certified / onboarding.length) * 100) : 0;
  const approved = forecasts.filter(f => ['Approved', 'Submitted'].includes(f.status)).length;

  const grid = document.createElement('div');
  grid.className = 'kpi-grid';
  grid.append(
    kpi('Active Projects', activeProjects, `${projects.length} total`, 'Projects'),
    kpi('Open Tickets', openTickets, `${tickets.length} total`, 'Tickets'),
    kpi('Capacity Utilisation', `${util}%`, `${totAlloc} / ${totAvail} h`, 'Capacity'),
    kpi('Job Completion', `${Math.round((doneJobs / jobs.length) * 100)}%`, `${doneJobs} of ${jobs.length} done`, 'Jobs'),
    kpi('Certification Rate', `${certRate}%`, `${certified} of ${onboarding.length}`, 'Onboarding'),
    kpi('Forecasts Progressed', approved, `${forecasts.length} total`, 'Forecasts'),
  );
  container.appendChild(grid);

  // ---- charts ----
  const rp = document.createElement('div');
  rp.className = 'reports-grid';
  container.appendChild(rp);

  const chartSpecs = [
    { entity: 'Tickets', rows: tickets, spec: { type: 'donut', title: 'Tickets by Status', groupBy: 'ticketStatus', agg: 'count' } },
    { entity: 'Projects', rows: projects, spec: { type: 'donut', title: 'Projects by Status', groupBy: 'projectStatus', agg: 'count' } },
    { entity: 'Capacity', rows: capacity, spec: { type: 'special', builder: 'capacityDualBar' } },
    { entity: 'Jobs', rows: jobs, spec: { type: 'line', title: 'Jobs Completed per Week', xField: 'realEndDate', xBucket: 'week', agg: 'count', rowFilter: (r) => r.jobStatus === 'Done' } },
  ];
  for (const { entity, rows, spec } of chartSpecs) {
    const box = document.createElement('div');
    box.className = 'panel';
    const ph = document.createElement('div');
    ph.className = 'panel-head';
    const h3 = document.createElement('h3');
    h3.textContent = spec.title || '';
    ph.appendChild(h3);
    const db = detailsBtn(entity);
    if (db) ph.appendChild(db);
    box.appendChild(ph);
    const b = document.createElement('div'); b.className = 'panel-body';
    const host = document.createElement('div'); host.className = 'chart-box';
    b.appendChild(host); box.appendChild(b); rp.appendChild(box);
    charts.push(renderChart(host, spec, rows));
  }

  return charts;
}

function kpi(label, value, sub, entity) {
  const d = document.createElement('div');
  d.className = 'kpi';
  for (const [cls, txt] of [['kpi-label', label], ['kpi-value', value], ['kpi-sub', sub]]) {
    const e = document.createElement('div'); e.className = cls; e.textContent = txt; d.appendChild(e);
  }
  const db = detailsBtn(entity);
  if (db) { db.classList.add('kpi-details'); d.appendChild(db); }
  return d;
}
