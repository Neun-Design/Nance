// overview.js — executive landing page: KPI cards + headline charts, all computed from data.

import { getEntity } from './data.js';
import { renderChart } from './charts.js';

export function renderOverview(container) {
  container.innerHTML = '';
  const charts = [];

  const head = document.createElement('div');
  head.innerHTML = `<div class="tab-title-row"><h2 class="tab-title">Overview</h2>
    <span class="tab-count">Live KPIs computed from the demo dataset</span></div>
    <p class="tab-subtitle">Every figure and chart below is aggregated in the browser from the same data behind each module — nothing here is a static image.</p>`;
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
    kpi('Active Projects', activeProjects, `${projects.length} total`),
    kpi('Open Tickets', openTickets, `${tickets.length} total`),
    kpi('Capacity Utilisation', `${util}%`, `${totAlloc} / ${totAvail} h`),
    kpi('Job Completion', `${Math.round((doneJobs / jobs.length) * 100)}%`, `${doneJobs} of ${jobs.length} done`),
    kpi('Certification Rate', `${certRate}%`, `${certified} of ${onboarding.length}`),
    kpi('Forecasts Progressed', approved, `${forecasts.length} total`),
  );
  container.appendChild(grid);

  // ---- charts ----
  const rp = document.createElement('div');
  rp.className = 'reports-grid';
  container.appendChild(rp);

  const chartSpecs = [
    { rows: tickets, spec: { type: 'donut', title: 'Tickets by Status', groupBy: 'ticketStatus', agg: 'count' } },
    { rows: projects, spec: { type: 'donut', title: 'Projects by Status', groupBy: 'projectStatus', agg: 'count' } },
    { rows: capacity, spec: { type: 'special', builder: 'capacityDualBar' } },
    { rows: jobs, spec: { type: 'line', title: 'Jobs Completed per Week', xField: 'realEndDate', xBucket: 'week', agg: 'count', rowFilter: (r) => r.jobStatus === 'Done' } },
  ];
  for (const { rows, spec } of chartSpecs) {
    const box = document.createElement('div');
    box.className = 'panel';
    box.innerHTML = `<div class="panel-head"><h3>${spec.title || ''}</h3></div>`;
    const b = document.createElement('div'); b.className = 'panel-body';
    const host = document.createElement('div'); host.className = 'chart-box';
    b.appendChild(host); box.appendChild(b); rp.appendChild(box);
    charts.push(renderChart(host, spec, rows));
  }

  return charts;
}

function kpi(label, value, sub) {
  const d = document.createElement('div');
  d.className = 'kpi';
  d.innerHTML = `<div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="kpi-sub">${sub}</div>`;
  return d;
}
