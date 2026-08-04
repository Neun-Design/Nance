#!/usr/bin/env python3
"""Deterministic migration: Product Groups classify by Business Unit (2026-08-03).

Rafael's edit (v3-review Iterations): the LPT/MPT/DT segment enum on Product
Groups becomes a stored `businessUnitID` FK; the segment now derives from the
unit (mirror). Mapping derives from existing registries only:

  enum code -> Business Segments row (by businessSegmentCode)
            -> the Business Unit whose businessSegmentID contains it
  (demo: LPT/MPT -> BU01 Power Transformers, DT -> BU02 Distribution)

Each demo segment resolves to exactly one unit, so the mapping is total and
deterministic. Rows migrate `businessSegment` -> `businessUnitID`; unknown or
missing codes leave businessUnitID null (flagged in the output).

Idempotent: rows without a businessSegment key are left untouched.
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
    mod = find_module(data, 'Product Groups')
    org = find_module(data, 'Business Segments')
    if not mod or not org:
        print(f'{path.name}: tables missing — skipped')
        return
    seg_by_code = {r.get('businessSegmentCode'): r['businessSegmentID']
                   for r in data[org].get('Business Segments', [])}
    unit_by_seg = {}
    for u in data[org].get('Business Units', []):
        segs = u.get('businessSegmentID') or []
        for s in (segs if isinstance(segs, list) else [segs]):
            unit_by_seg.setdefault(s, u['businessUnitID'])
    changed, unmapped = 0, []
    for row in data[mod]['Product Groups']:
        if 'businessSegment' not in row:
            continue
        code = row.pop('businessSegment')
        row['businessUnitID'] = unit_by_seg.get(seg_by_code.get(code))
        if row['businessUnitID'] is None:
            unmapped.append((row.get('productGroupID'), code))
        changed += 1
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    note = f'; UNMAPPED: {unmapped}' if unmapped else ''
    print(f'{path.name}: {changed} product group(s) migrated{note}')


for target in TARGETS:
    if target.exists():
        migrate(target)
