#!/usr/bin/env python3
"""Deterministic migration: Forecasts hang off the contract (issue #241).

SLA-as-Contract decision (assessment A4): the SLA entity IS the contract,
and Forecasts give it its temporal dimension (SLA 1:N Forecasts).

1. Every forecast gains `slaID` — the SLA of its customer (the #179 seed
   created exactly one SLA per customer, so the mapping is unambiguous).
2. `forecastPeriod` data relabel `Monthly` -> `Month` (assessment A10 —
   the catalogue enum is Annual/Quarter/Month).
3. A7 seed: the prototype copy gains four forecasts exercising the other
   two enum values — Quarter (2026-Q4) and Annual (2026) for the first
   two customers, children cloned from each customer's first forecast
   with fresh PKs. The legacy sourceFiles copy only gets 1–2 (its chains
   don't support cloning).

Idempotent: rows already carrying slaID / new-world spellings are
untouched; the A7 rows are keyed by fixed PKs.
"""
import json
import sys
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    (ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json', True),
    (ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json', False),
]


def find_table(data, name):
    for tables in data.values():
        if isinstance(tables, dict) and name in tables:
            return tables[name]
    return None


def business_days(start, finish):
    d, n = start, 0
    while d <= finish:
        if d.weekday() < 5:
            n += 1
        d += timedelta(days=1)
    return n


def a7_rows(forecasts, scopes, sla_by_customer):
    """Four Quarter/Annual forecasts for the first two customers, children
    cloned from each customer's first forecast."""
    new_fc, new_fs = [], []
    customers = []
    for f in forecasts:
        c = f.get('customerID')
        if c and c not in customers:
            customers.append(c)
    specs = [('FRC157', 0, 'Quarter', date(2026, 10, 1), date(2026, 12, 31), '2026-Q4'),
             ('FRC158', 0, 'Annual', date(2026, 1, 1), date(2026, 12, 31), '2026'),
             ('FRC159', 1, 'Quarter', date(2026, 10, 1), date(2026, 12, 31), '2026-Q4'),
             ('FRC160', 1, 'Annual', date(2026, 1, 1), date(2026, 12, 31), '2026')]
    existing = {f['forecastID'] for f in forecasts}
    next_fs = 391
    for pk, ci, period, start, finish, frame in specs:
        if pk in existing or ci >= len(customers):
            continue
        cust = customers[ci]
        src = next(f for f in forecasts if f.get('customerID') == cust)
        kids = [s for s in scopes if s.get('forecastID') == src['forecastID']]
        total = sum(float(k.get('estimatedHours') or 0) for k in kids)
        days = (finish - start).days + 1
        weeks = max(1, round(days / 7))
        new_fc.append({
            'forecastID': pk,
            'slaID': sla_by_customer.get(cust),
            'customerID': cust,
            'forecastPeriod': period,
            'periodStart': start.isoformat(),
            'periodFinish': finish.isoformat(),
            'periodBusinessDays': business_days(start, finish),
            'periodFrame': frame,
            'weeklyUsageQuota': round(total / weeks) if total else 0,
            'status': 'Approved',
            'createdBy': src.get('createdBy'),
            'createdAt': src.get('createdAt'),
            'totalEstimatedHours': total,
            'forecastOwner': src.get('forecastOwner'),
        })
        for k in kids:
            clone = dict(k)
            clone['forecastScopeID'] = f'FS{next_fs:03d}'
            clone['forecastScopeRegistry'] = f'FSR-2026-{next_fs:04d}'
            clone['forecastID'] = pk
            next_fs += 1
            new_fs.append(clone)
    return new_fc, new_fs


def migrate(path, full_seed):
    data = json.loads(path.read_text(encoding='utf-8'))
    forecasts = find_table(data, 'Forecasts')
    slas = find_table(data, 'SLA') or []
    if forecasts is None:
        print(f'{path.name}: no Forecasts table — skipped')
        return
    sla_by_customer = {}
    for s in slas:
        sla_by_customer.setdefault(s.get('customerID'), s.get('slaID'))
    linked = relabelled = 0
    for f in forecasts:
        if not f.get('slaID'):
            f['slaID'] = sla_by_customer.get(f.get('customerID'))
            linked += 1
        if f.get('forecastPeriod') == 'Monthly':
            f['forecastPeriod'] = 'Month'
            relabelled += 1
    added = 0
    if full_seed:
        scopes = find_table(data, 'Forecast Scopes') or []
        new_fc, new_fs = a7_rows(forecasts, scopes, sla_by_customer)
        forecasts.extend(new_fc)
        scopes.extend(new_fs)
        added = len(new_fc)
    if linked or relabelled or added:
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
        print(f'{path.name}: slaID linked={linked}, period relabelled={relabelled}, A7 forecasts added={added}')
    else:
        print(f'{path.name}: no changes')


def main():
    for target, full in TARGETS:
        if target.exists():
            migrate(target, full)
        else:
            print(f'{target}: not found — skipped')


if __name__ == '__main__':
    sys.exit(main())
