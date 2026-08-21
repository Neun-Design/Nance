#!/usr/bin/env python3
"""derive_control.py — Capacity and Performance are OUTPUTS, never inputs
(issue #246, assessment §5.2). This module recomputes both Control tables
from their live sources and stamps them into the mockup copies; the
validator calls derive() again and fails the build on any divergence.
The future clinic seed generator (tools/seed/, MOCKUP_DEMO_PLAN §4.2)
reuses this module unchanged.

Grain and formulas (assessment §5.2):

  Capacity   = functionID × year × month (months = the Monthly forecasts)
    availableHours = Σ People.workingHours of the function × weeks of the
                     month (periodBusinessDays / 5 — the Report-A basis)
    allocatedHours = Σ Forecast Scopes.estimatedHours of the function in
                     the month's forecasts
    utilization    = allocated / available
    customerID     = the customer consuming the most of the function's
                     allocated hours that month (attribution, not grain)

  Performance = functionID × customerID × year × month over DONE jobs
    plannedHours      = Σ Jobs.plannedExecutionTime of the group
    realExecutionTime = Σ Jobs.realExecutionTime
    efficiency        = (planned / real − 1) × 100
    variance          = population variance of the per-job real hours
"""
import calendar
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]


def find_table(data, name):
    for tables in data.values():
        if isinstance(tables, dict) and name in tables:
            return tables[name]
    return None


def as_list(v):
    if isinstance(v, list):
        return [x for x in v if x not in (None, '')]
    return [v] if v not in (None, '') else []


def derive(tables):
    """tables: dict tableName -> rows (the flattened mockup). Returns
    (capacity_rows, performance_rows), deterministically ordered."""
    people = tables.get('People') or []
    forecasts = tables.get('Forecasts') or []
    scopes = tables.get('Forecast Scopes') or []
    jobs = tables.get('Jobs') or []
    tickets = {t.get('ticketID'): t for t in (tables.get('Tickets') or [])}
    person = {p.get('userID'): p for p in people}

    # ---- Capacity: functionID × month (from the Monthly forecasts) ----
    months = {}  # (year, month) -> businessDays
    fc_month = {}  # forecastID -> (year, month)
    fc_cust = {}
    for f in forecasts:
        start = str(f.get('periodStart') or '')[:10]
        if f.get('forecastPeriod') != 'Month' or len(start) < 7:
            continue
        key = (int(start[:4]), int(start[5:7]))
        months.setdefault(key, int(f.get('periodBusinessDays') or 0))
        fc_month[f.get('forecastID')] = key
        fc_cust[f.get('forecastID')] = f.get('customerID')

    weekly = {}
    for p in people:
        fid = p.get('functionID')
        if fid:
            weekly[fid] = weekly.get(fid, 0) + float(p.get('workingHours') or 0)

    alloc = {}   # (fid, key) -> hours
    by_cust = {}  # (fid, key) -> {customer: hours}
    for s in scopes:
        key = fc_month.get(s.get('forecastID'))
        fid = s.get('functionID')
        if key is None or not fid:
            continue
        h = float(s.get('estimatedHours') or 0)
        alloc[(fid, key)] = alloc.get((fid, key), 0) + h
        cust = fc_cust.get(s.get('forecastID'))
        if cust:
            d = by_cust.setdefault((fid, key), {})
            d[cust] = d.get(cust, 0) + h

    capacity = []
    fids = sorted({fid for fid in weekly} | {fid for fid, _ in alloc})
    keys = sorted(months)
    n = 0
    for key in keys:
        for fid in fids:
            n += 1
            bd = months[key]
            avail = round(weekly.get(fid, 0) * bd / 5, 2)
            al = round(alloc.get((fid, key), 0), 2)
            custs = by_cust.get((fid, key), {})
            top = sorted(custs.items(), key=lambda kv: (-kv[1], str(kv[0])))
            last = calendar.monthrange(key[0], key[1])[1]
            capacity.append({
                'capacityID': f'CAP{n:03d}',
                'functionID': fid,
                'periodType': 'Month',
                'periodYear': key[0],
                'periodQuarter': (key[1] - 1) // 3 + 1,
                'periodMonth': key[1],
                'periodStart': f'{key[0]:04d}-{key[1]:02d}-01',
                'periodFinish': f'{key[0]:04d}-{key[1]:02d}-{last:02d}',
                'availableHours': avail,
                'allocatedHours': al,
                'utilization': round(al / avail, 2) if avail else 0,
                'customerID': top[0][0] if top else None,
                'capacityOwner': 'U01',
            })

    # ---- Performance: functionID × customerID × month over Done jobs ----
    groups = {}
    for j in jobs:
        if j.get('jobStatus') != 'Done':
            continue
        end = str(j.get('realEndDate') or '')[:10]
        if len(end) < 7:
            continue
        p = person.get(j.get('userID'))
        t = tickets.get(j.get('ticketID'))
        fid = p and p.get('functionID')
        cust = t and t.get('customerID')
        if not fid or not cust:
            continue
        key = (fid, cust, int(end[:4]), int(end[5:7]))
        groups.setdefault(key, []).append(j)

    performance = []
    for n, key in enumerate(sorted(groups, key=lambda k: (k[2], k[3], str(k[0]), str(k[1]))), 1):
        fid, cust, year, month = key
        rows = groups[key]
        reals = [float(j.get('realExecutionTime') or 0) for j in rows]
        planned = round(sum(float(j.get('plannedExecutionTime') or 0) for j in rows), 2)
        real = round(sum(reals), 2)
        mean = sum(reals) / len(reals)
        var = round(sum((v - mean) ** 2 for v in reals) / len(reals), 2)
        last = calendar.monthrange(year, month)[1]
        performance.append({
            'usageID': f'PRF{n:03d}',
            'functionID': fid,
            'customerID': cust,
            'periodType': 'Month',
            'periodYear': year,
            'periodMonth': month,
            'plannedHours': planned,
            'realExecutionTime': real,
            'efficiency': round(((planned / real) - 1) * 100, 2) if real else 0,
            'variance': var,
            'reportedAt': f'{year:04d}-{month:02d}-{last:02d}',
            'reportedBy': 'U02',
            'performanceOwner': 'U01',
        })
    return capacity, performance


def flatten(data):
    flat = {}
    for mod, ents in data.items():
        if mod == '_meta':
            continue
        flat.update(ents)
    return flat


def main():
    for target in TARGETS:
        if not target.exists():
            print(f'{target}: not found — skipped')
            continue
        data = json.loads(target.read_text(encoding='utf-8'))
        cap_t = find_table(data, 'Capacity')
        perf_t = find_table(data, 'Performance')
        if cap_t is None or perf_t is None:
            print(f'{target.name}: no Control tables — skipped')
            continue
        capacity, performance = derive(flatten(data))
        cap_t[:] = capacity
        perf_t[:] = performance
        target.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
        print(f'{target.name}: Capacity={len(capacity)} rows, Performance={len(performance)} rows (derived)')


if __name__ == '__main__':
    sys.exit(main())
