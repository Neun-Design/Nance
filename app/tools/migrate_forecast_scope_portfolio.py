#!/usr/bin/env python3
"""Deterministic migration: Forecast Scopes portfolio key (issue #242).

1. `functionID` — the free-string `functionName` becomes a stored FK
   (Functions name -> id); the stored name key is DROPPED (it is a mirror
   now — extra stored keys fail the parity validator).
2. `estimatedHours` re-stamp — the honest equation of the new rule
   `SUM(taskID.executionTime) * forecastScopeQuantity`, applied ONLY to
   rows whose event chains tasks (each task's time = sum of its
   procedures' executionTime). 332/398 demo rows chain events with NO
   tasks — those keep the planner's stored manual estimate (#192
   posture, mirrored by the engine's no-children stored fallback); the
   clinic generator closes the gap in F1.
3. Parent coherence — every Forecast re-stamps `totalEstimatedHours`
   (sum of its children) and `weeklyUsageQuota` (total / weeks of the
   period, round(days/7) as in migrate_sla_forecasts).

productScopeID needs no repair: all rows already store a valid Product
Scope id (verified before authoring). Idempotent by construction — every
stamp recomputes the same value. Applies to both mockup copies.
"""
import json
import sys
from datetime import date
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


def migrate(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    scopes = find_table(data, 'Forecast Scopes')
    if scopes is None:
        print(f'{path.name}: no Forecast Scopes table — skipped')
        return
    functions = find_table(data, 'Functions') or []
    fn_by_name = {f.get('functionName'): f.get('functionID') for f in functions}
    tasks = find_table(data, 'Tasks') or []
    procs = find_table(data, 'Procedures') or []
    task_exec = {}
    for p in procs:
        t = p.get('taskID')
        task_exec[t] = task_exec.get(t, 0) + float(p.get('executionTime') or 0)
    event_hours = {}
    for t in tasks:
        ev = t.get('eventID')
        event_hours[ev] = event_hours.get(ev, 0) + task_exec.get(t.get('taskID'), 0)

    fn_mapped = restamped = kept = 0
    for r in scopes:
        if 'functionID' not in r:
            r['functionID'] = fn_by_name.get(r.pop('functionName', None))
            fn_mapped += 1
        base = event_hours.get(r.get('eventID'), 0)
        if not base:
            kept += 1  # event chains no tasks — the manual estimate stands
            continue
        qty = r.get('forecastScopeQuantity')
        qty = float(qty) if qty not in (None, '') else 1.0
        hours = round(base * qty, 2)
        if r.get('estimatedHours') != hours:
            r['estimatedHours'] = hours
            restamped += 1

    forecasts = find_table(data, 'Forecasts') or []
    parents = 0
    for f in forecasts:
        kids = [s for s in scopes if s.get('forecastID') == f.get('forecastID')]
        total = round(sum(float(k.get('estimatedHours') or 0) for k in kids), 2)
        try:
            start = date.fromisoformat(str(f.get('periodStart'))[:10])
            finish = date.fromisoformat(str(f.get('periodFinish'))[:10])
            weeks = max(1, round(((finish - start).days + 1) / 7))
        except (TypeError, ValueError):
            weeks = 4
        quota = round(total / weeks) if total else 0
        if f.get('totalEstimatedHours') != total or f.get('weeklyUsageQuota') != quota:
            f['totalEstimatedHours'] = total
            f['weeklyUsageQuota'] = quota
            parents += 1

    if fn_mapped or restamped or parents:
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
        print(f'{path.name}: functionID mapped={fn_mapped}, hours restamped={restamped}, '
              f'manual kept={kept}, parents recohered={parents}')
    else:
        print(f'{path.name}: no changes')


def main():
    for target in TARGETS:
        if target.exists():
            migrate(target)
        else:
            print(f'{target}: not found — skipped')


if __name__ == '__main__':
    sys.exit(main())
