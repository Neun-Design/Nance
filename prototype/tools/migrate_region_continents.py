#!/usr/bin/env python3
"""Deterministic migration: Regions.continent becomes derived (2026-08-03).

Rafael's call: the Continent input is obsolete — countries are grouped by
continent, so the continent list derives from the selected countries
(`mirror: Countries via: countryName (display: continent)`). The stored copy
was also lossy (RG01 "Americas" said "North America" while covering Brazil
and Colombia); dropping it lets the derive list every continent the region
actually spans.

Data side: remove the stored `continent` key from Regions rows.
Idempotent; applies to every mockup copy that carries the table.
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
    mod = find_module(data, 'Regions')
    if not mod:
        print(f'{path.name}: no Regions table — skipped')
        return
    changed = 0
    for row in data[mod]['Regions']:
        if 'continent' in row:
            row.pop('continent')
            changed += 1
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    print(f'{path.name}: {changed} region row(s) stripped of the stored continent')


for target in TARGETS:
    if target.exists():
        migrate(target)
