#!/usr/bin/env python3
"""Deterministic migration: Requirements.customerID seed (2026-08-13, issue #180).

Seeds the new nullable FK customerID on every Requirements row. The form
input is disabled (field-rule "disabled") — customer-specific requirements
are registered per customer once the SLA chain lands (#179/#191); until
then every requirement seeds as None, i.e. "applies to all customers"
(Q1 wildcard).

Idempotent: rows that already carry the customerID key are untouched.
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
    requirements = find_table(data, 'Requirements')
    if requirements is None:
        print(f'{path.name}: no Requirements table — skipped')
        return
    changed = 0
    for r in requirements:
        if 'customerID' not in r:
            r['customerID'] = None
            changed += 1
    if changed:
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'{path.name}: Requirements={changed}' if changed else f'{path.name}: no changes')


def main():
    for target in TARGETS:
        if target.exists():
            migrate(target)
        else:
            print(f'{target}: not found — skipped')


if __name__ == '__main__':
    sys.exit(main())
