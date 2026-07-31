#!/usr/bin/env python3
"""Deterministic migration: Customers.customerType enum (2026-07-31).

Seeds the new ENUM attribute customerType ('branch' | 'client' |
'supplier') on every Customers row. All current mockup customers descend
from the former Factories table (internal Northwind Energy factories), so
they seed as 'branch'; clients and suppliers are registered through the
form going forward. Also renames the same-day legacy option spellings
('internal client' -> 'branch', 'external client' -> 'client').

Idempotent: rows that already carry a non-empty customerType are untouched.
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
    customers = find_table(data, 'Customers')
    if customers is None:
        print(f'{path.name}: no Customers table — skipped')
        return
    # 2026-07-31 rename: 'internal client' -> 'branch', 'external client' -> 'client'
    legacy = {'internal client': 'branch', 'external client': 'client'}
    changed = 0
    for c in customers:
        if c.get('customerType') in legacy:
            c['customerType'] = legacy[c['customerType']]
            changed += 1
        elif not c.get('customerType'):
            c['customerType'] = 'branch'
            changed += 1
    if changed:
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'{path.name}: Customers={changed}' if changed else f'{path.name}: no changes')


def main():
    for target in TARGETS:
        if target.exists():
            migrate(target)
        else:
            print(f'{target}: not found — skipped')


if __name__ == '__main__':
    sys.exit(main())
