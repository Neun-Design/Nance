#!/usr/bin/env python3
"""Deterministic migration: 2026-07-31 stakeholder-test datamodel round.

Seeds the stored attributes added after the stakeholder walkthrough
(prototype/stakeholders_test_results.md):

  Product Groups  classCodeName — new VARCHAR, no derivable source -> null
  Onboarding      departmentID — the onboarded person's department
                  (via userID -> People.departmentID); the Department input
                  replaces Business Unit on the form

Idempotent: rows already carrying the key are untouched.
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
    changed = {}

    def note(k, n=1):
        changed[k] = changed.get(k, 0) + n

    for g in (find_table(data, 'Product Groups') or []):
        if 'classCodeName' not in g:
            g['classCodeName'] = None
            note('Product Groups')

    person_dept = {p['userID']: p.get('departmentID')
                   for p in (find_table(data, 'People') or [])}
    for ob in (find_table(data, 'Onboarding') or []):
        if 'departmentID' not in ob:
            ob['departmentID'] = person_dept.get(ob.get('userID'))
            note('Onboarding')

    if changed:
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'{path.name}: ' + (', '.join(f'{k}={v}' for k, v in changed.items()) or 'no changes'))


def main():
    for target in TARGETS:
        if target.exists():
            migrate(target)
        else:
            print(f'{target}: not found — skipped')


if __name__ == '__main__':
    sys.exit(main())
