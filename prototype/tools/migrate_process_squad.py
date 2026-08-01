#!/usr/bin/env python3
"""Deterministic migration: Processes.squadID (2026-08-01, Operation round).

Processes gained a Squad input (FK -> Squads) cascaded from the process's
Event: the options are the squads of the department handling the event
(Event.departmentID, itself seeded by migrate_event_department.py). Seed
the existing rows through the same chain:

  Processes.squadID  first squad (by squadID) of the department of the
                     process's event; null when the chain breaks (no
                     event, no event department, or no squad there)

Idempotent: processes already carrying a squadID key are untouched.
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


def migrate(path: Path) -> None:
    if not path.exists():
        print(f'skip (missing): {path}')
        return
    doc = json.loads(path.read_text(encoding='utf-8'))
    org = doc.get('Organization') or {}
    ops = doc.get('Operation') or {}

    squad_by_dept = {}
    for s in sorted(org.get('Squads') or [], key=lambda s: str(s.get('squadID'))):
        squad_by_dept.setdefault(s.get('departmentID'), s.get('squadID'))
    dept_by_event = {e.get('eventID'): e.get('departmentID')
                     for e in ops.get('Events') or []}

    changed = 0
    for p in ops.get('Processes') or []:
        if 'squadID' in p:
            continue
        p['squadID'] = squad_by_dept.get(dept_by_event.get(p.get('eventID')))
        changed += 1

    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + '\n',
                    encoding='utf-8')
    print(f'{path.relative_to(ROOT)}: {changed} process(es) seeded')


if __name__ == '__main__':
    for target in TARGETS:
        migrate(target)
    sys.exit(0)
