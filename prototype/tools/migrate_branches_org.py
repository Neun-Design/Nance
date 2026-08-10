#!/usr/bin/env python3
"""Deterministic migration: Branches org structure (issues #168 + #169).

#168 — a branch can host multiple segments and units: the stored
`businessSegmentID` / `businessUnitID` scalars become arrays (existing
value wrapped, order preserved).

#169 — departments stop being inherited from the business unit: Branches
gain a stored multivalued `departmentID`, seeded as the departments of the
branch's unit(s) so the migrated data keeps exactly what the old
`Departments (via: businessUnitID)` subitem join displayed.

Idempotent: values already stored as lists are left untouched; a branch
that already carries a departmentID key is not re-seeded.
Applies to every mockup copy that carries the table.
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


def as_list(v):
    if isinstance(v, list):
        return v
    return [] if v in (None, '') else [v]


def migrate(path):
    data = json.loads(path.read_text())
    mod = find_module(data, 'Branches')
    dep_mod = find_module(data, 'Departments')
    if not mod or not dep_mod:
        print(f'{path.name}: tables missing — skipped')
        return
    departments = data[dep_mod].get('Departments', [])
    wrapped, seeded = 0, 0
    for row in data[mod]['Branches']:
        for key in ('businessSegmentID', 'businessUnitID'):
            if key in row and not isinstance(row[key], list):
                row[key] = as_list(row[key])
                wrapped += 1
        if 'departmentID' not in row:
            units = as_list(row.get('businessUnitID'))
            row['departmentID'] = [d['departmentID'] for d in departments
                                   if d.get('businessUnitID') in units]
            seeded += 1
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    print(f'{path.name}: {wrapped} scalar value(s) wrapped, '
          f'{seeded} branch(es) seeded with departments')


for target in TARGETS:
    if target.exists():
        migrate(target)
