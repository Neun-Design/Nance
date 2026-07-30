#!/usr/bin/env python3
"""Deterministic migration: mockup ↔ datamodel schema parity (2026-07-30).

Clears the residual validate_mockup.py parity debt left behind by the earlier
restructures. Everything derives from existing links or is materialised as
null — nothing is invented:

  People       departmentID — via squadID -> Squads.departmentID (else null);
               graduationID — not derivable, null
  Onboarding   levelRank — via competenceID -> Competence.levelRank (else null);
               trainingURL — user input, null
  Projects     customerID — Customers lookup by the stored customerName;
               drops legacy clientName / customerName (the datamodel merged
               the Client field into Customers and derives customerName as a
               mirror of customerID)
  Tasks        drops legacy customerName / scopes (since the 2026-07-29
               restructure the customer/scope dimension derives from the
               task's workflow — nothing reads the stored copies)

Idempotent: fields already present and non-empty are left untouched.
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
        if isinstance(tables, dict) and name in tables and isinstance(tables[name], list):
            return tables[name]
    return None


def blank(v):
    return v is None or v == '' or v == []


def migrate(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    t = {name: find_table(data, name) or [] for name in (
        'People', 'Squads', 'Onboarding', 'Competence', 'Projects', 'Customers', 'Tasks')}
    changed = {}

    def note(table):
        changed[table] = changed.get(table, 0) + 1

    def seed(table, row, field, derived):
        # write when the key is absent, or when a real value fills a blank one
        if field not in row:
            row[field] = derived if not blank(derived) else None
            note(table)
        elif blank(row[field]) and not blank(derived):
            row[field] = derived
            note(table)

    # ---- People: departmentID via squad; graduationID null ----
    dept_of_squad = {sq['squadID']: sq.get('departmentID') for sq in t['Squads']}
    for p in t['People']:
        seed('People', p, 'departmentID', dept_of_squad.get(p.get('squadID')))
        seed('People', p, 'graduationID', None)

    # ---- Onboarding: levelRank via competence; trainingURL null ----
    rank_of_comp = {c['competenceID']: c.get('levelRank') for c in t['Competence']}
    for ob in t['Onboarding']:
        seed('Onboarding', ob, 'levelRank', rank_of_comp.get(ob.get('competenceID')))
        seed('Onboarding', ob, 'trainingURL', None)

    # ---- Projects: customerID from customerName; drop merged legacy fields ----
    cust_by_name = {c.get('customerName'): c['customerID'] for c in t['Customers']}
    for pr in t['Projects']:
        seed('Projects', pr, 'customerID', cust_by_name.get(pr.get('customerName')))
        for legacy in ('clientName', 'customerName'):
            if legacy in pr:
                del pr[legacy]
                note('Projects')

    # ---- Tasks: drop legacy stored customer/scope copies ----
    for task in t['Tasks']:
        for legacy in ('customerName', 'scopes'):
            if legacy in task:
                del task[legacy]
                note('Tasks')

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
