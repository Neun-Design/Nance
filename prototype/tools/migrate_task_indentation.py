#!/usr/bin/env python3
"""Deterministic migration: Tasks indentation + Procedures status (issue #302).

Tasks gain a stored self-referential `predecessorTask` (nullable FK — the
first task of a process has no predecessor; every task link is
start-to-finish, there is no constrain/indentationRule dimension). The
outline number `taskIndentationID` is DERIVED (TASKORDER in resolve.js),
never stored — this migration only seeds the chain:

- per process, tasks are ordered by (workflow-step outline, insertion
  order) — the step outline is the same STEPORDER derivation the engine
  runs (Python port below) — and chained in that order, exactly the
  issue's example table (T02's predecessor is T01 across activities;
  a predecessor in ANOTHER step never sub-numbers, so the seeded chain
  and the per-step counters agree with the derived values).

The seed builder chains tasks per process in insertion order — identical
here, because the demo workflows chain sequentially (finish-to-start),
so insertion order IS step order; a regenerated and a migrated dataset
agree.

Procedures seed `procedureStatus: 'Approved'` (authored enum absorbed in
the same round): the demo SOPs staff competences and drive execution
times — an unapproved status would be dishonest.

Targets both mockup copies; `_meta.schemaVersion` stamped to 66 on the
copy that carries it. The frozen transformers testdata stays unmigrated
by design. Idempotent.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 66

PARALLEL = {'finish-to-finish', 'start-to-start'}


def find_table(doc, name):
    for tables in doc.values():
        if isinstance(tables, dict) and name in tables:
            return tables[name]
    return None


def step_order(rows, pk, parent='parentStepID', rule='indentationRule'):
    """Python port of stepOrderMap (resolve.js): outline numbers in
    insertion order, parents before children — sequential rules take the
    next major number, parallel rules sub-number under the parent."""
    order, sub = {}, {}
    inset = {r[pk] for r in rows}
    major = 0
    pending = list(rows)
    while pending:
        rest = []
        for w in pending:
            pid = w.get(parent)
            has = pid not in (None, '') and pid in inset
            if has and pid not in order:
                rest.append(w)
                continue
            if has and str(w.get(rule) or '').lower() in PARALLEL:
                n = sub.get(pid, 0) + 1
                sub[pid] = n
                order[w[pk]] = f'{order[pid]}.{n}'
            else:
                major += 1
                order[w[pk]] = str(major)
        if len(rest) == len(pending):
            for w in rest:  # cycle or dangling parents
                major += 1
                order[w[pk]] = str(major)
            break
        pending = rest
    return order


def outline_key(outline):
    if not outline:
        return (10 ** 9,)
    return tuple(int(x) for x in outline.split('.'))


def migrate(path):
    raw = path.read_text(encoding='utf-8')
    doc = json.loads(raw)
    tasks = find_table(doc, 'Tasks')
    workflows = find_table(doc, 'Workflows') or []
    procedures = find_table(doc, 'Procedures') or []
    if tasks is None:
        print(f'{path.name}: no Tasks table — skipped')
        return

    # workflow-step outline per process (the engine's STEPORDER)
    by_process = {}
    for w in workflows:
        by_process.setdefault(w.get('processID'), []).append(w)
    step_of = {}
    for steps in by_process.values():
        step_of.update(step_order(steps, 'workflowID'))

    chained = 0
    for pid in dict.fromkeys(t.get('processID') for t in tasks):
        ordered = sorted(
            (t for t in tasks if t.get('processID') == pid),
            key=lambda t: (outline_key(step_of.get(t.get('workflowID'))),
                           tasks.index(t)))
        prev = None
        for t in ordered:
            if 'predecessorTask' not in t:  # idempotence
                t['predecessorTask'] = prev
                chained += 1
            prev = t['taskID']

    statused = 0
    for p in procedures:
        if 'procedureStatus' not in p:  # idempotence
            p['procedureStatus'] = 'Approved'
            statused += 1

    meta = doc.get('_meta')
    if isinstance(meta, dict) and 'schemaVersion' in meta:
        meta['schemaVersion'] = SCHEMA_VERSION

    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False)
                    + ('\n' if raw.endswith('\n') else ''), encoding='utf-8')
    roots = sum(1 for t in tasks if t.get('predecessorTask') is None)
    print(f'{path.name}: {chained} tasks chained ({roots} process roots), '
          f'{statused} procedures set Approved')


if __name__ == '__main__':
    for target in TARGETS:
        migrate(target)
