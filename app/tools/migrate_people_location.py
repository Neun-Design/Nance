#!/usr/bin/env python3
"""Deterministic migration: People location (issues #170 + #167).

New concept: a person CAN belong to a Branch but MUST have a Location
(region → country → city). People gain stored `countryName` (NOT NULL,
drives the #167 country column/filter) and nullable `cityName`.

Seeding is derived from existing data only, in fallback order:
  1. the person's branch → its countryName / cityName;
  2. no branch → the region's single country when unambiguous
     (regionID → Regions.countryName holding exactly one entry);
  3. otherwise countryName stays null (flagged in the output).

Idempotent: rows already carrying a countryName key are left untouched.
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


def migrate(path):
    data = json.loads(path.read_text())
    mod = find_module(data, 'People')
    org = find_module(data, 'Branches')
    if not mod or not org:
        print(f'{path.name}: tables missing — skipped')
        return
    branch_by_id = {b['branchID']: b for b in data[org].get('Branches', [])}
    region_by_id = {r['regionID']: r for r in data[org].get('Regions', [])}
    seeded, unmapped = 0, []
    for row in data[mod]['People']:
        if 'countryName' in row:
            continue
        branch = branch_by_id.get(row.get('branchID'))
        if branch:
            row['countryName'] = branch.get('countryName')
            row['cityName'] = branch.get('cityName')
        else:
            countries = (region_by_id.get(row.get('regionID')) or {}).get('countryName') or []
            row['countryName'] = countries[0] if len(countries) == 1 else None
            row['cityName'] = None
        if row['countryName'] is None:
            unmapped.append(row.get('userID'))
        seeded += 1
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    note = f'; UNMAPPED (no branch, ambiguous region): {unmapped}' if unmapped else ''
    print(f'{path.name}: {seeded} person(s) seeded{note}')


for target in TARGETS:
    if target.exists():
        migrate(target)
