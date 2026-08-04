#!/usr/bin/env python3
"""Deterministic migration: Issues classify by Business Unit again (2026-08-03).

Rafael's reversal of the 2026-08-01 stakeholder round (segment classification):
`Issues.businessSegmentID` is gone — the stored key is `businessUnitID` (single
valued; the segment surfaces as the select's group header). Also part of the
same round: Issues and Actions leave the tab strip as hidden registries
(created inline from the Scopes / Tasks forms), and Regions moves to tab 2.

Data side:
  Issues   drop the dead businessSegmentID key; normalize the legacy
           multivalued businessUnitID ([] / [x] / [x, y]) to the single-valued
           shape the form stores — first unit wins (deterministic), [] -> null.

Idempotent: rows without businessSegmentID and with scalar businessUnitID are
left untouched. Applies to every mockup copy that carries the table.
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
    mod = find_module(data, 'Issues')
    if not mod:
        print(f'{path.name}: no Issues table — skipped')
        return
    changed = 0
    for row in data[mod]['Issues']:
        before = (row.get('businessSegmentID', '∅'), row.get('businessUnitID', '∅'))
        row.pop('businessSegmentID', None)
        bu = row.get('businessUnitID')
        if isinstance(bu, list):
            row['businessUnitID'] = bu[0] if bu else None
        if (row.get('businessSegmentID', '∅'), row.get('businessUnitID', '∅')) != before:
            changed += 1
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    print(f'{path.name}: {changed} issue row(s) normalized')


for target in TARGETS:
    if target.exists():
        migrate(target)
