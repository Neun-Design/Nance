#!/usr/bin/env python3
"""Deterministic migration: requirements inheritance (2026-08-20, issue #226).

Backs the schemaVersion 41 spec changes — requirements now flow LIVE into
tickets and competences whose parameters align:
- Tickets.requirementName became a derived attribute (rule
  `computed: INHERITED-REQUIREMENTS(eventID)` — ticketRequirements in
  resolve.js). The #192/#214 stored snapshots are DROPPED: stored values win
  over rules at render time, and a stored copy of a derived attribute fails
  the validate_mockup.py parity check ("extra non-canonical fields").
- Competence.requirementID (rule `computed: COMPETENCE-REQUIREMENTS`) is
  popped defensively — no row carries it since the Procedures round, but the
  engine keeps honouring a legacy stored value as fallback for old snapshots.

Deterministic and idempotent: re-running is a no-op after the first pass.
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


def migrate(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    tickets = find_table(data, 'Tickets')
    if tickets is None:
        print(f'{path.name}: missing Tickets — skipped')
        return
    competences = find_table(data, 'Competence') or []

    t_changed = 0
    for t in tickets:
        if 'requirementName' in t:
            t.pop('requirementName')
            t_changed += 1

    c_changed = 0
    for c in competences:
        if 'requirementID' in c:
            c.pop('requirementID')
            c_changed += 1

    if t_changed or c_changed:
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'{path.name}: Tickets={t_changed}, Competence={c_changed}')


def main():
    for target in TARGETS:
        if target.exists():
            migrate(target)
        else:
            print(f'{target}: not found — skipped')


if __name__ == '__main__':
    sys.exit(main())
