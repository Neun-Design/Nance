#!/usr/bin/env python3
"""Deterministic migration: Product Groups apply to multiple products (#176).

`Product Groups.productID` becomes a multivalued FK — the same specs can
serve several products. Existing scalar values are wrapped into one-element
arrays; group membership is unchanged.

The stored `productGroupName` copies are dropped: the attribute is derived
(`computed: Products via: productID`) and a stored single-product name goes
stale the moment a second product joins the group — same lossy-stored-copy
treatment as Regions.continent (2026-08-03 round).

Idempotent: values already stored as lists / rows without the name key are
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
    mod = find_module(data, 'Product Groups')
    if not mod:
        print(f'{path.name}: table missing — skipped')
        return
    wrapped, dropped = 0, 0
    for row in data[mod]['Product Groups']:
        v = row.get('productID')
        if v is not None and not isinstance(v, list):
            row['productID'] = [v]
            wrapped += 1
        if 'productID' in row and 'productGroupName' in row:
            row.pop('productGroupName')
            dropped += 1
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    print(f'{path.name}: {wrapped} product group(s) wrapped, {dropped} stored name(s) dropped')


for target in TARGETS:
    if target.exists():
        migrate(target)
