// charts.js — thin ECharts wrapper. Every chart is computed from the rows passed in,
// so filters flow straight through. Series colours come from the --se-data-* palette.

import { lookup } from './data.js';
import { groupCount, groupSum, sortedEntries, weekKey } from './compute.js';

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const PALETTE = [
  '--se-data-coral', '--se-data-royal-blue', '--se-data-green', '--se-data-orange',
  '--se-data-purple', '--se-data-turquoise', '--se-data-plum', '--se-data-blue',
  '--se-data-avocado', '--se-data-orchid', '--se-data-yellow', '--se-data-petrol',
].map(cssVar);

const AXIS = cssVar('--se-text-secondary');
const GRID = cssVar('--se-ui-4');
const FONT = cssVar('--se-font-family');

const baseText = { color: cssVar('--se-text-primary'), fontFamily: FONT };
const baseGrid = { left: 48, right: 24, top: 40, bottom: 40, containLabel: true };

function baseOption(title) {
  return {
    color: PALETTE,
    textStyle: baseText,
    title: title ? { text: title, left: 0, top: 4, textStyle: { fontSize: 14, fontWeight: 600, color: cssVar('--se-text-primary'), fontFamily: FONT } } : undefined,
    // richText renders tooltips on canvas — category values can't inject HTML
    tooltip: { trigger: 'item', confine: true, renderMode: 'richText' },
    grid: baseGrid,
  };
}

const catAxis = (extra = {}) => ({
  type: 'category', axisLabel: { color: AXIS, fontFamily: FONT },
  axisLine: { lineStyle: { color: GRID } }, axisTick: { show: false }, ...extra,
});
const valAxis = (extra = {}) => ({
  type: 'value', axisLabel: { color: AXIS, fontFamily: FONT },
  splitLine: { lineStyle: { color: GRID } }, ...extra,
});

// resolve spec.groupBy (string field or fn) -> key fn
const keyFn = (g) => (typeof g === 'function' ? g : (r) => r[g]);
// map a raw key to a display label
const labelOf = (spec, k) => (spec.labelFn ? spec.labelFn(k) : k);

// ---------------- standard builders ----------------
function buildBar(spec, rows) {
  const map = spec.agg === 'sum'
    ? groupSum(rows, keyFn(spec.groupBy), spec.valueField)
    : groupCount(rows, keyFn(spec.groupBy));
  const entries = sortedEntries(map, { by: spec.sortByKey ? 'key' : 'value', dir: spec.sortDir || 'desc', limit: spec.limit });
  const cats = entries.map(([k]) => labelOf(spec, k));
  const vals = entries.map(([, v]) => v);
  const o = baseOption(spec.title);
  o.tooltip.trigger = 'axis'; o.tooltip.axisPointer = { type: 'shadow' };
  if (spec.horizontal) {
    o.xAxis = valAxis(); o.yAxis = catAxis({ data: cats.slice().reverse() });
    o.series = [{ type: 'bar', data: vals.slice().reverse(), barMaxWidth: 22 }];
  } else {
    o.xAxis = catAxis({ data: cats, axisLabel: { color: AXIS, fontFamily: FONT, interval: 0, rotate: cats.length > 6 ? 30 : 0 } });
    o.yAxis = valAxis();
    o.series = [{ type: 'bar', data: vals, barMaxWidth: 40 }];
  }
  return o;
}

function buildDonut(spec, rows) {
  const map = spec.agg === 'sum'
    ? groupSum(rows, keyFn(spec.groupBy), spec.valueField)
    : groupCount(rows, keyFn(spec.groupBy));
  const data = [...map.entries()].map(([k, v]) => ({ name: String(labelOf(spec, k)), value: v }));
  const o = baseOption(spec.title);
  o.legend = { bottom: 0, textStyle: { color: AXIS, fontFamily: FONT } };
  o.series = [{
    type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'], data,
    label: { color: cssVar('--se-text-primary'), fontFamily: FONT, formatter: '{b}: {c}' },
    itemStyle: { borderColor: cssVar('--se-base-1'), borderWidth: 2 },
  }];
  o.tooltip.formatter = '{b}: {c} ({d}%)';
  return o;
}

function buildLine(spec, rows) {
  const bucket = spec.xBucket === 'week' ? (r) => weekKey(r[spec.xField]) : keyFn(spec.xField);
  const xs = [...new Set(rows.map(bucket).filter(Boolean))].sort();
  const o = baseOption(spec.title);
  o.tooltip.trigger = 'axis';
  o.xAxis = catAxis({ data: xs });
  o.yAxis = valAxis();
  if (spec.seriesBy) {
    const groups = new Map();
    for (const r of rows) {
      const s = keyFn(spec.seriesBy)(r); if (s == null) continue;
      if (!groups.has(s)) groups.set(s, []);
      groups.get(s).push(r);
    }
    o.legend = { bottom: 0, textStyle: { color: AXIS, fontFamily: FONT } };
    o.series = [...groups.entries()].map(([s, rs]) => {
      const m = spec.agg === 'sum' ? groupSum(rs, bucket, spec.valueField) : groupCount(rs, bucket);
      return { name: String(labelOf(spec, s)), type: 'line', smooth: true, data: xs.map(x => m.get(x) || 0) };
    });
  } else {
    const m = spec.agg === 'sum' ? groupSum(rows, bucket, spec.valueField) : groupCount(rows, bucket);
    o.series = [{ type: 'line', smooth: true, areaStyle: { opacity: 0.08 }, data: xs.map(x => m.get(x) || 0) }];
  }
  return o;
}

// precomputed grouped/stacked bars: spec { cats, series: [{name, data}], stacked }
function buildMultiBar(spec) {
  const o = baseOption(spec.title);
  o.tooltip.trigger = 'axis'; o.tooltip.axisPointer = { type: 'shadow' };
  o.legend = { bottom: 0, textStyle: { color: AXIS, fontFamily: FONT } };
  o.xAxis = catAxis({ data: spec.cats, axisLabel: { color: AXIS, fontFamily: FONT, interval: 0, rotate: spec.cats.length > 6 ? 30 : 0 } });
  o.yAxis = valAxis();
  o.series = spec.series.map(s => ({
    name: s.name, type: 'bar', data: s.data, barMaxWidth: 26,
    ...(spec.stacked ? { stack: 'total' } : {}),
  }));
  return o;
}

// ---------------- special builders (named) ----------------
const SPECIALS = {
  // Capacity: available vs allocated hours by role
  capacityDualBar(rows) {
    const roles = rows.map(r => r.roleName || lookup('Roles', r.roleID, 'roleName'));
    const o = baseOption('Available vs Allocated Hours by Role');
    o.tooltip.trigger = 'axis'; o.tooltip.axisPointer = { type: 'shadow' };
    o.legend = { bottom: 0, textStyle: { color: AXIS, fontFamily: FONT } };
    o.xAxis = catAxis({ data: roles, axisLabel: { color: AXIS, fontFamily: FONT, interval: 0, rotate: 30 } });
    o.yAxis = valAxis();
    o.series = [
      { name: 'Available', type: 'bar', data: rows.map(r => r.availableHours), barMaxWidth: 18 },
      { name: 'Allocated', type: 'bar', data: rows.map(r => r.allocatedHours), barMaxWidth: 18 },
    ];
    return o;
  },
  // Capacity utilisation % by role
  capacityUtil(rows) {
    const o = baseOption('Utilisation % by Role');
    o.tooltip.trigger = 'axis'; o.tooltip.axisPointer = { type: 'shadow' };
    o.xAxis = catAxis({ data: rows.map(r => r.roleName), axisLabel: { color: AXIS, fontFamily: FONT, interval: 0, rotate: 30 } });
    o.yAxis = valAxis({ axisLabel: { formatter: '{value}%', color: AXIS, fontFamily: FONT } });
    o.series = [{ type: 'bar', data: rows.map(r => r.utilization), barMaxWidth: 30 }];
    return o;
  },
  // Usage: role x jobs heatmap-style — used hours by function over months
  usageHeatmap(rows) {
    const funcs = [...new Set(rows.map(r => r.functionName))];
    const months = [...new Set(rows.map(r => `${r.periodYear}-M${String(r.periodMonth).padStart(2, '0')}`))].sort();
    const data = [];
    rows.forEach(r => {
      const x = months.indexOf(`${r.periodYear}-M${String(r.periodMonth).padStart(2, '0')}`);
      const y = funcs.indexOf(r.functionName);
      data.push([x, y, r.usedHours]);
    });
    const max = Math.max(1, ...rows.map(r => r.usedHours));
    const o = baseOption('Used Hours — Function × Month');
    o.tooltip = { position: 'top', confine: true };
    o.grid = { left: 120, right: 24, top: 40, bottom: 60 };
    o.xAxis = { type: 'category', data: months, axisLabel: { color: AXIS, fontFamily: FONT } };
    o.yAxis = { type: 'category', data: funcs, axisLabel: { color: AXIS, fontFamily: FONT } };
    o.visualMap = { min: 0, max, calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
      inRange: { color: [cssVar('--se-base-information'), cssVar('--se-data-coral')] }, textStyle: { color: AXIS } };
    o.series = [{ type: 'heatmap', data, label: { show: true, color: '#fff' } }];
    return o;
  },
  // Productivity efficiency buckets donut
  efficiencyBuckets(rows) {
    const buckets = { '<80%': 0, '80–100%': 0, '>100%': 0 };
    rows.forEach(r => {
      const eff = r.target ? (r.output / r.target) * 100 : 0;
      if (eff < 80) buckets['<80%']++; else if (eff <= 100) buckets['80–100%']++; else buckets['>100%']++;
    });
    const o = baseOption('Teams by Efficiency Bucket');
    o.legend = { bottom: 0, textStyle: { color: AXIS, fontFamily: FONT } };
    o.series = [{ type: 'pie', radius: ['45%', '70%'], center: ['50%', '45%'],
      data: Object.entries(buckets).map(([k, v]) => ({ name: k, value: v })),
      itemStyle: { borderColor: cssVar('--se-base-1'), borderWidth: 2 } }];
    o.tooltip.formatter = '{b}: {c} ({d}%)';
    return o;
  },
  // Productivity output vs target by team
  productivityBars(rows) {
    const o = baseOption('Output vs Target by Team');
    o.tooltip.trigger = 'axis'; o.tooltip.axisPointer = { type: 'shadow' };
    o.legend = { bottom: 0, textStyle: { color: AXIS, fontFamily: FONT } };
    o.xAxis = catAxis({ data: rows.map(r => r.teamName), axisLabel: { color: AXIS, fontFamily: FONT, interval: 0, rotate: 20 } });
    o.yAxis = valAxis();
    o.series = [
      { name: 'Output', type: 'bar', data: rows.map(r => r.output), barMaxWidth: 18 },
      { name: 'Target', type: 'bar', data: rows.map(r => r.target), barMaxWidth: 18 },
    ];
    return o;
  },
  // Jobs: estimated vs actual execution time, grouped by project
  jobExecVariance(rows) {
    const byProj = new Map();
    rows.forEach(j => {
      const p = j.projectName || '—';
      if (!byProj.has(p)) byProj.set(p, { plan: 0, real: 0 });
      byProj.get(p).plan += j.plannedTime || 0;
      byProj.get(p).real += j.realExecutionTime || 0;
    });
    const projs = [...byProj.keys()];
    const o = baseOption('Estimated vs Actual Hours by Project');
    o.tooltip.trigger = 'axis'; o.tooltip.axisPointer = { type: 'shadow' };
    o.legend = { bottom: 0, textStyle: { color: AXIS, fontFamily: FONT } };
    o.xAxis = catAxis({ data: projs, axisLabel: { color: AXIS, fontFamily: FONT, interval: 0, rotate: 25 } });
    o.yAxis = valAxis();
    o.series = [
      { name: 'Estimated', type: 'bar', data: projs.map(p => byProj.get(p).plan), barMaxWidth: 18 },
      { name: 'Actual', type: 'bar', data: projs.map(p => byProj.get(p).real), barMaxWidth: 18 },
    ];
    return o;
  },
};

// ---------------- public API ----------------
export function renderChart(container, spec, rows) {
  if (spec.rowFilter) rows = rows.filter(spec.rowFilter);
  const el = document.createElement('div');
  el.style.width = '100%'; el.style.height = '100%';
  container.appendChild(el);
  const chart = echarts.init(el, null, { renderer: 'canvas' });
  let option;
  if (spec.type === 'special') option = SPECIALS[spec.builder](rows);
  else if (spec.type === 'multibar') option = buildMultiBar(spec);
  else if (spec.type === 'donut') option = buildDonut(spec, rows);
  else if (spec.type === 'line') option = buildLine(spec, rows);
  else option = buildBar(spec, rows);
  chart.setOption(option);
  return chart;
}
