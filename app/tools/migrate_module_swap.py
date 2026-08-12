#!/usr/bin/env python3
"""Deterministic migration: Events and Requirements swap modules (2026-08-12).

Rafael's call: `Events` belongs to the Portfolio module (it takes the tab
slot Requirements held) and `Requirements` belongs to Operation (taking
Events' old slot). The hidden `Requirement Type` registry follows its
owner table into Operation. Rows are moved between the mockup's module
sections unchanged — ids, FKs and shapes are untouched.

Idempotent: copies already carrying the tables in their new sections are
left untouched. Applies to every mockup copy with the tables.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]

MOVES = [  # (table, from-module, to-module)
    ('Events', 'Operation', 'Portfolio'),
    ('Requirements', 'Portfolio', 'Operation'),
    ('Requirement Type', 'Portfolio', 'Operation'),
]


def migrate(path):
    data = json.loads(path.read_text())
    moved = []
    for table, src, dst in MOVES:
        if src in data and isinstance(data[src], dict) and table in data[src]:
            if dst not in data or not isinstance(data[dst], dict):
                continue
            data[dst][table] = data[src].pop(table)
            moved.append(table)
    if not moved:
        print(f'{path.name}: nothing to move — skipped')
        return
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    print(f'{path.name}: moved {", ".join(moved)}')


for target in TARGETS:
    if target.exists():
        migrate(target)
