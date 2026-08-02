#!/usr/bin/env python3
"""Deterministic migration: People.customerID (2026-07-31).

Seeds the new nullable FK People.customerID (branch / internal factory
the person is stationed at). Derivation from existing values: the
first (by customerID) Customers row with customerType 'branch'
whose businessUnitID contains the person's unit AND whose regionID equals
the person's regionID — the same pair the regions migration derived from
the person's original factory `location`, so this effectively recovers it.
No match -> null (the attribute is nullable).

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


def as_list(v):
    if v is None or v == '' or v == []:
        return []
    return v if isinstance(v, list) else [v]


def migrate(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    people = find_table(data, 'People')
    customers = find_table(data, 'Customers') or []
    if people is None:
        print(f'{path.name}: no People table — skipped')
        return
    internal = sorted(
        (c for c in customers if c.get('customerType') == 'branch'),
        key=lambda c: str(c.get('customerID', '')))
    changed = 0
    for p in people:
        if 'customerID' in p:
            continue
        match = next(
            (c for c in internal
             if p.get('businessUnitID') in as_list(c.get('businessUnitID'))
             and c.get('regionID') == p.get('regionID')), None)
        p['customerID'] = match['customerID'] if match else None
        changed += 1
    if changed:
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'{path.name}: People={changed}' if changed else f'{path.name}: no changes')


def main():
    for target in TARGETS:
        if target.exists():
            migrate(target)
        else:
            print(f'{target}: not found — skipped')


if __name__ == '__main__':
    sys.exit(main())
