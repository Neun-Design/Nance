#!/usr/bin/env python3
"""Deterministic migration: coherent Job lifecycle history (issue #245).

The lifecycle UI (Start/Pause/Resume/Finish) needs a dataset whose story
holds together (assessment §7.4 generator rules):

1. No real date in the future on finished work — Done jobs whose
   realStartDate/realEndDate sit past the ANCHOR (2026-08-21) shift back
   in whole 183-day steps until they don't (planned dates shift along).
2. Every Stoped job carries `stoppedAt` (the 2 seeded ones had null) —
   stamped one hour after its realStartDate.
3. Every Done job closes the equation:
   realExecutionTime = (realEndDate − realStartDate) − jobBufferExecution.
4. Status-shape coherence: Active jobs have a start and no end; Queued
   jobs have neither.

Idempotent: each rule recomputes the same result. Applies to both mockup
copies.
"""
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
ANCHOR = datetime(2026, 8, 21)
STEP = timedelta(days=183)


def parse(v):
    if not v:
        return None
    try:
        return datetime.fromisoformat(str(v).replace('Z', ''))
    except ValueError:
        return None


def iso(dt, like):
    if dt is None:
        return None
    return dt.strftime('%Y-%m-%dT%H:%M:%S') if 'T' in str(like or '') else dt.strftime('%Y-%m-%d')


def find_table(data, name):
    for tables in data.values():
        if isinstance(tables, dict) and name in tables:
            return tables[name]
    return None


def migrate(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    jobs = find_table(data, 'Jobs')
    if jobs is None:
        print(f'{path.name}: no Jobs table — skipped')
        return
    shifted = stamped = closed = shaped = 0
    for j in jobs:
        status = j.get('jobStatus')
        rs, re_ = parse(j.get('realStartDate')), parse(j.get('realEndDate'))
        if status == 'Done' and (rs or re_):
            latest = max(d for d in (rs, re_) if d)
            steps = 0
            while latest - steps * STEP > ANCHOR:
                steps += 1
            if steps:
                for k in ('realStartDate', 'realEndDate', 'startDate', 'deliveryDate'):
                    d = parse(j.get(k))
                    if d:
                        j[k] = iso(d - steps * STEP, j.get(k))
                rs, re_ = parse(j.get('realStartDate')), parse(j.get('realEndDate'))
                shifted += 1
        if status == 'Stoped':
            if not j.get('realStartDate'):
                j['realStartDate'] = iso(ANCHOR - timedelta(days=7), '2026-01-01T00:00:00')
                rs = parse(j['realStartDate'])
            if not j.get('stoppedAt'):
                j['stoppedAt'] = iso(rs + timedelta(hours=1), '2026-01-01T00:00:00')
                stamped += 1
        if status == 'Done' and rs and re_:
            buf = float(j.get('jobBufferExecution') or 0)
            real = round(max(0.0, (re_ - rs).total_seconds() / 3600 - buf), 2)
            if j.get('realExecutionTime') != real:
                j['realExecutionTime'] = real
                closed += 1
        if status == 'Active':
            if j.get('realEndDate'):
                j['realEndDate'] = None
                shaped += 1
            if not j.get('realStartDate'):
                j['realStartDate'] = iso(ANCHOR - timedelta(days=3), '2026-01-01T00:00:00')
                shaped += 1
        if status == 'Queued' and (j.get('realStartDate') or j.get('realEndDate')):
            j['realStartDate'] = None
            j['realEndDate'] = None
            shaped += 1
    if shifted or stamped or closed or shaped:
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
        print(f'{path.name}: future Done shifted={shifted}, stoppedAt stamped={stamped}, '
              f'equations closed={closed}, shapes fixed={shaped}')
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
