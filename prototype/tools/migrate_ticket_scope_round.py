#!/usr/bin/env python3
"""Deterministic migration: ticket product-scope round (2026-08-19, issue #214).

Three re-seeds backing the schemaVersion 36 spec changes:
- Tasks.taskName re-seeds to the new CONCAT order `activityName-actionName`
  (task → workflow → activity for the first part, task → action for the
  second; stored values win over the rule at render time, so the mockup
  must carry the new spelling). Tasks whose chain does not resolve keep
  their prior name.
- Tickets.productScopeID (new stored FK, single-valued) seeds from the
  event's payload scopes: exactly ONE admitted scope seeds it, several —
  or a wildcard payload with an empty list — leave it null (Q1: empty =
  every scope the payloads admit).
- Tickets.processID re-seeds as an ID ARRAY — the event's processes
  narrowed by the seeded product scope (a process with an empty
  productScopeID list covers every scope). The #192 seed stored joined
  process NAMES; the Processes/Tasks subitem tabs added by this round
  join `(via: processID)` against the Processes pk, so ids are required.
  Events without processes keep the prior value (#192 posture).

Deterministic and idempotent: re-running recomputes the same values.
Applies to both mockup copies (prototype/data + sourceFiles/developer).
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
        return v
    return [] if v in (None, '') else [v]


def uniq(seq):
    out = []
    for x in seq:
        if x and x not in out:
            out.append(x)
    return out


def migrate(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    tasks = find_table(data, 'Tasks')
    tickets = find_table(data, 'Tickets')
    if tasks is None or tickets is None:
        print(f'{path.name}: missing Tasks/Tickets — skipped')
        return
    workflows = {w['workflowID']: w for w in (find_table(data, 'Workflows') or [])}
    activities = {a['activityID']: a for a in (find_table(data, 'Activities') or [])}
    actions = {a['actionID']: a for a in (find_table(data, 'Actions') or [])}
    processes = find_table(data, 'Processes') or []
    payloads = find_table(data, 'Payload') or []

    # ---- Tasks.taskName → activityName-actionName ----
    t_changed = 0
    for t in tasks:
        wf = workflows.get(t.get('workflowID')) or {}
        activity = (activities.get(wf.get('activityID')) or {}).get('activityName')
        action = (actions.get(t.get('actionID')) or {}).get('actionName')
        if not activity or not action:
            continue
        name = f'{activity}-{action}'
        if t.get('taskName') != name:
            t['taskName'] = name
            t_changed += 1

    # ---- Tickets.productScopeID + processID (id array) ----
    def payload_scopes(event_id):
        out = []
        for p in sorted(payloads, key=lambda p: str(p.get('payloadID'))):
            if p.get('eventID') == event_id:
                scopes = as_list(p.get('productScopeID'))
                if not scopes:
                    return []  # wildcard payload — every admitted scope
                out.extend(scopes)
        return uniq(out)

    def event_processes(event_id, scope_id):
        out = []
        for p in sorted(processes, key=lambda p: str(p.get('processID'))):
            if p.get('eventID') != event_id:
                continue
            covered = as_list(p.get('productScopeID'))
            if scope_id and covered and scope_id not in covered:
                continue
            out.append(p.get('processID'))
        return uniq(out)

    k_changed = 0
    for t in tickets:
        scopes = payload_scopes(t.get('eventID'))
        scope = scopes[0] if len(scopes) == 1 else None
        procs = event_processes(t.get('eventID'), scope)
        new = {
            'productScopeID': scope,
            'processID': procs if procs else t.get('processID'),
        }
        if any(t.get(k, '__missing__') != v for k, v in new.items()):
            t.update(new)
            k_changed += 1

    if t_changed or k_changed:
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'{path.name}: Tasks={t_changed}, Tickets={k_changed}')


def main():
    for target in TARGETS:
        if target.exists():
            migrate(target)
        else:
            print(f'{target}: not found — skipped')


if __name__ == '__main__':
    sys.exit(main())
