#!/usr/bin/env python3
"""Deterministic migration: executionTime moves from Tasks to Procedures (2026-08-04).

Rafael's theory (v3-review Iterations): a task can carry several procedures,
each shaped by its requirement set — the requirements change how long the
task takes, so a fixed time on the Task makes no sense. Procedures create
the variance; the time is registered per procedure and the task derives the
sum of its procedures.

Data side:
  Procedures  executionTime = the stored time of the procedure's task
              (demo: one procedure per task, so the move is lossless).
  Tasks       drop the stored executionTime key (now derived).

Idempotent: procedures that already carry a time and tasks without the key
are left untouched. Applies to every mockup copy that carries the tables.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]


def find_module(data, table):
    for mod, tables in data.items():
        if isinstance(tables, dict) and table in tables:
            return mod
    return None


def migrate(path):
    data = json.loads(path.read_text())
    op = find_module(data, 'Tasks')
    if not op or 'Procedures' not in data.get(op, {}):
        print(f'{path.name}: tables missing — skipped')
        return
    tasks = {str(t.get('taskID')): t for t in data[op]['Tasks']}
    moved = 0
    for proc in data[op]['Procedures']:
        if proc.get('executionTime') is not None:
            continue
        task = tasks.get(str(proc.get('taskID')))
        if task and task.get('executionTime') is not None:
            proc['executionTime'] = task['executionTime']
            moved += 1
        else:
            proc['executionTime'] = None
    dropped = 0
    for t in data[op]['Tasks']:
        if 'executionTime' in t:
            t.pop('executionTime')
            dropped += 1
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    print(f'{path.name}: {moved} time(s) moved onto procedures, {dropped} task key(s) dropped')


for target in TARGETS:
    if target.exists():
        migrate(target)
