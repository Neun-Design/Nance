#!/usr/bin/env python3
"""Deterministic migration: Product Specs input type relabel (issue #205).

specInputType enum INT/DECIMAL/String/List becomes
Number/Text/Choice/List/Checkbox:

    INT     -> Number   (decimal input; the integer-only variant is gone)
    DECIMAL -> Number
    String  -> Text
    List    -> Choice   (single pick from Allowed Values)

'List' is REUSED for the new multiple-choice type (stored semicolon-
separated) and 'Checkbox' (boolean) is new — neither exists in pre-v34
data, so the mapping above is unambiguous. Stored specValues on Product
Groups are untouched (values keep their type; only the definitions'
labels change).

Idempotent: rows already carrying a new-world spelling are untouched.
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

RENAME = {'INT': 'Number', 'DECIMAL': 'Number', 'String': 'Text', 'List': 'Choice'}


def find_table(data, name):
    for tables in data.values():
        if isinstance(tables, dict) and name in tables:
            return tables[name]
    return None


def migrate(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    specs = find_table(data, 'Product Specs')
    if specs is None:
        print(f'{path.name}: no Product Specs table — skipped')
        return
    changed = 0
    for s in specs:
        old = s.get('specInputType')
        if old in RENAME:
            s['specInputType'] = RENAME[old]
            changed += 1
    if changed:
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'{path.name}: Product Specs={changed}' if changed else f'{path.name}: no changes')


def main():
    for target in TARGETS:
        if target.exists():
            migrate(target)
        else:
            print(f'{target}: not found — skipped')


if __name__ == '__main__':
    sys.exit(main())
