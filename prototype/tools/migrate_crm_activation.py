#!/usr/bin/env python3
"""Deterministic migration: CRM activation round (2026-08-13, issue #191).

Customers restructure backing the MVP CRM activation:
- customerType relabel: 'branch' -> 'Internal Client', 'client' ->
  'External Client', 'supplier' -> 'Supplier' (reverts the 2026-07-31
  lowercase enum; the Branches customer filter follows the new value).
- drops the redundant geography keys city / country / regionID (and any
  stored customerTitle copy) — geography lives on the customer's
  Branches since the Branches round; the schema no longer declares them
  (extra non-canonical keys fail the parity validator).

Idempotent: already-relabelled rows and already-dropped keys are
untouched. Applies to both mockup copies (prototype/data +
sourceFiles/developer).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]

RELABEL = {'branch': 'Internal Client', 'client': 'External Client', 'supplier': 'Supplier'}
DROP = ('city', 'country', 'regionID', 'customerTitle')


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
    relabelled = dropped = 0
    for c in customers:
        if c.get('customerType') in RELABEL:
            c['customerType'] = RELABEL[c['customerType']]
            relabelled += 1
        for k in DROP:
            if k in c:
                del c[k]
                dropped += 1
    if relabelled or dropped:
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
        print(f'{path.name}: relabelled={relabelled}, dropped keys={dropped}')
    else:
        print(f'{path.name}: no changes')


def main():
    for target in TARGETS:
        if target.exists():
            migrate(target)
        else:
            print(f'{target}: not found — skipped')


if __name__ == '__main__':
    sys.exit(main())
