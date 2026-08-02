#!/usr/bin/env python3
"""Deterministic migration: Competence.departmentID (2026-08-01, Talent round).

Competence gained a stored departmentID (FK -> Departments) derived from its
event (Events.departmentID, seeded by migrate_event_department.py). It is the
join key for the Onboarding form's Department -> Competence cascade: only
competences of the onboarding's department are offered. Seed existing rows
through the same chain:

  Competence.departmentID  the departmentID of the row's eventID; null when
                           the event is missing or has no department

Idempotent: competences already carrying a departmentID key are untouched.
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
    dept_by_event = {e.get('eventID'): e.get('departmentID')
                     for e in (doc.get('Operation') or {}).get('Events') or []}

    changed = 0
    for c in (doc.get('Talent') or {}).get('Competence') or []:
        if 'departmentID' in c:
            continue
        c['departmentID'] = dept_by_event.get(c.get('eventID'))
        changed += 1

    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + '\n',
                    encoding='utf-8')
    print(f'{path.relative_to(ROOT)}: {changed} competence(s) seeded')


if __name__ == '__main__':
    for target in TARGETS:
        migrate(target)
    sys.exit(0)
