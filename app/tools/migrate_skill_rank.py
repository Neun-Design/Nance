#!/usr/bin/env python3
"""Deterministic migration: levelRank leaves Skill Levels (2026-08-03).

Rafael's edit + context (v3-review Iterations): the rank is not a property of
the Skill Level registry — it is the professional's STEP inside a level,
recorded per competence (Competence.levelRank, now `enum: [1, 2, 3]`; rank 3
on every competence of a level signals readiness for promotion — automation
tracked in issue #149).

Data side: drop the stored `levelRank` key from Skill Levels rows (the attr
is gone from the schema; Competence/Onboarding ranks are untouched).
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
    mod = find_module(data, 'Skill Levels')
    if not mod:
        print(f'{path.name}: no Skill Levels table — skipped')
        return
    changed = 0
    for row in data[mod]['Skill Levels']:
        if 'levelRank' in row:
            row.pop('levelRank')
            changed += 1
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    print(f'{path.name}: {changed} skill level row(s) stripped of levelRank')


for target in TARGETS:
    if target.exists():
        migrate(target)
