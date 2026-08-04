#!/usr/bin/env python3
"""Deterministic migration: Roles round (2026-08-03).

Rafael's edits: `Roles.graduationID` is now MULTIVALUED (a role may accept
more than one educational background) and `isActive` leaves the table (every
demo role was True — the flag carried no information).

Data side:
  Roles  graduationID scalar -> single-element list (the multivalued shape
         the form stores); drop the isActive key.

Idempotent: rows already list-shaped / without isActive are left untouched.
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
    mod = find_module(data, 'Roles')
    if not mod:
        print(f'{path.name}: no Roles table — skipped')
        return
    listified, dropped = 0, 0
    for row in data[mod]['Roles']:
        g = row.get('graduationID')
        if g is not None and not isinstance(g, list):
            row['graduationID'] = [g] if g != '' else []
            listified += 1
        if 'isActive' in row:
            row.pop('isActive')
            dropped += 1
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    print(f'{path.name}: {listified} graduation link(s) listified, {dropped} isActive key(s) dropped')


for target in TARGETS:
    if target.exists():
        migrate(target)
