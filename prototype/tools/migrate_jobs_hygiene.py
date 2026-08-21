#!/usr/bin/env python3
"""Deterministic migration: Jobs hygiene (issue #244 — A6/A8/A9/A14).

1. A8: stored `roleID` DROPPED — the attribute is a mirror of the
   allocated person's role now (it matched People in 0/187 rows).
2. A14: `projectID` re-stamped from the ticket (single source; 0
   divergences today, drift impossible tomorrow).
3. A9: `plannedExecutionTime` frozen from the task's procedures — the sum
   of Procedures.executionTime of the job's (re-seeded, #243) taskID.
   Jobs whose task chains no procedures keep the prior value (#192
   posture).
4. A13: rows seeded under the swapped notes carry a start AFTER the
   delivery (16 legacy "JC" jobs, a full year apart) — the two values
   swap so start precedes delivery everywhere.
5. A6: `predecessorJobID`/`dependencyType` seeded — within each ticket
   the jobs chain in jobID order (finish-to-start), first job has no
   predecessor. Every row carries both keys (absent key = parity fail).

Idempotent: stamps recompute the same values; the dependency seed only
fills rows that don't carry the key yet. Applies to both mockup copies.
"""
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


def migrate(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    jobs = find_table(data, 'Jobs')
    if jobs is None:
        print(f'{path.name}: no Jobs table — skipped')
        return
    tickets = {t.get('ticketID'): t for t in (find_table(data, 'Tickets') or [])}
    task_exec = {}
    for p in (find_table(data, 'Procedures') or []):
        for t in as_list(p.get('taskID')):
            task_exec[str(t)] = task_exec.get(str(t), 0) + float(p.get('executionTime') or 0)

    dropped = restamped = frozen = chained = swapped = 0
    by_ticket = {}
    for j in jobs:
        by_ticket.setdefault(j.get('ticketID'), []).append(j)

    for j in jobs:
        if 'roleID' in j:
            j.pop('roleID')
            dropped += 1
        tkt = tickets.get(j.get('ticketID'))
        if tkt and tkt.get('projectID') and j.get('projectID') != tkt['projectID']:
            j['projectID'] = tkt['projectID']
            restamped += 1
        plan = task_exec.get(str(j.get('taskID')))
        if plan and j.get('plannedExecutionTime') != plan:
            j['plannedExecutionTime'] = plan
            frozen += 1
        s, d = j.get('startDate'), j.get('deliveryDate')
        if s and d and str(s) > str(d):
            j['startDate'], j['deliveryDate'] = d, s
            swapped += 1

    for tid, group in by_ticket.items():
        group.sort(key=lambda x: str(x.get('jobID')))
        prev = None
        for j in group:
            if 'predecessorJobID' not in j:
                j['predecessorJobID'] = prev
                j['dependencyType'] = 'finish-to-start' if prev else None
                if prev:
                    chained += 1
            prev = j.get('jobID')

    if dropped or restamped or frozen or chained or swapped:
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
        print(f'{path.name}: roleID dropped={dropped}, projectID restamped={restamped}, '
              f'plan frozen={frozen}, dates swapped={swapped}, dependencies chained={chained}')
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
