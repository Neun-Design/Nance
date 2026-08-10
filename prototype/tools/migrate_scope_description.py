#!/usr/bin/env python3
"""Deterministic migration: Scopes gain a description (issue #181).

`scopeDescription` (TEXT, nullable) helps users understand the activities
a scope involves. Existing rows gain the key as null — the content is
authored by users, not derivable from other data.

Idempotent: rows already carrying the key are left untouched.
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
    mod = find_module(data, 'Scopes')
    if not mod:
        print(f'{path.name}: table missing — skipped')
        return
    seeded = 0
    for row in data[mod]['Scopes']:
        if 'scopeDescription' not in row:
            row['scopeDescription'] = None
            seeded += 1
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    print(f'{path.name}: {seeded} scope(s) seeded')


for target in TARGETS:
    if target.exists():
        migrate(target)
