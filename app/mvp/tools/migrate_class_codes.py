#!/usr/bin/env python3
"""Deterministic migration: seed Product Groups.classCodeName (2026-08-02).

ux-review U1 (Rafael's call: "Seed classCodeName"): the dashboard's identity
column was null on every row. Codes derive from existing values only —

  classCodeName = "PC-<businessSegment>-<nn>"

where <nn> is the row's 1-based sequence within its segment, ordered by
productGroupID (PC = product class). E.g. PG01 (LPT) -> PC-LPT-01,
PG06 (MPT) -> PC-MPT-01.

Idempotent: rows with a non-empty classCodeName are left untouched.
Applies to every mockup copy that carries the table (the sourceFiles/developer
legacy copy predates Product Groups and is skipped).
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
    mod = find_module(data, 'Product Groups')
    if not mod:
        print(f'{path.name}: no Product Groups table — skipped')
        return
    rows = data[mod]['Product Groups']
    seq = {}
    changed = 0
    for row in sorted(rows, key=lambda r: str(r.get('productGroupID', ''))):
        seg = str(row.get('businessSegment') or 'NA')
        seq[seg] = seq.get(seg, 0) + 1
        if row.get('classCodeName'):
            continue
        row['classCodeName'] = f'PC-{seg}-{seq[seg]:02d}'
        changed += 1
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    print(f'{path.name}: seeded {changed} classCodeName value(s)')


for target in TARGETS:
    if target.exists():
        migrate(target)
