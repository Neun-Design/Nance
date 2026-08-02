#!/usr/bin/env python3
"""Deterministic migration: Events.departmentID (2026-08-01, Operation round).

Events gained a Department input (FK -> Departments) cascaded from the
event's Business Unit. Seed the existing rows from data already present:

  Events.departmentID  the department of the event's businessUnitID
                       (units currently map to a single department);
                       events without a unit, or whose unit has no
                       department, get null

Idempotent: events already carrying a departmentID key are untouched.
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
    departments = (doc.get('Organization') or {}).get('Departments') or []
    dept_by_unit = {}
    for d in departments:
        dept_by_unit.setdefault(d.get('businessUnitID'), d.get('departmentID'))

    events = (doc.get('Operation') or {}).get('Events') or []
    changed = 0
    for e in events:
        if 'departmentID' in e:
            continue
        e['departmentID'] = dept_by_unit.get(e.get('businessUnitID'))
        changed += 1

    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + '\n',
                    encoding='utf-8')
    print(f'{path.relative_to(ROOT)}: {changed} event(s) seeded')


if __name__ == '__main__':
    for target in TARGETS:
        migrate(target)
    sys.exit(0)
