#!/usr/bin/env python3
"""Deterministic migration: Classes tied to Business Units (issue #204).

Seeds the new multivalued `Classes.businessUnitID` as the UNION of the
units of the scopes carrying each class, in first-seen scope order — the
same rule the seed builder backfills (build_seed.py), so a regenerated
dataset and a migrated one agree. A class no scope references keeps [];
it stays visible on the Classes dashboard but out of unit-filtered
pickers (the Scopes form Classification narrowing).

Targets both mockup copies; a copy without a Classes table is skipped
(the legacy sourceFiles/developer copy never received the class-codes
round table). `_meta.schemaVersion` stamped to 55 on the copy that
carries it.

Idempotent: rows already carrying the key are left untouched.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 55


def find_table(doc, name):
    for tables in doc.values():
        if isinstance(tables, dict) and name in tables:
            return tables[name]
    return None


def as_list(v):
    if v is None or v == '':
        return []
    return v if isinstance(v, list) else [v]


def migrate(path):
    raw = path.read_text(encoding='utf-8')
    doc = json.loads(raw)
    classes = find_table(doc, 'Classes')
    if classes is None:
        print(f'{path.name}: no Classes table — skipped')
        return
    scopes = find_table(doc, 'Scopes') or []

    units_of_class = {}
    for s in scopes:
        for cid in as_list(s.get('scopeClassID')):
            bucket = units_of_class.setdefault(str(cid), [])
            for u in as_list(s.get('businessUnitID')):
                if u not in bucket:
                    bucket.append(u)

    touched = 0
    for c in classes:
        if 'businessUnitID' in c:
            continue  # idempotence
        c['businessUnitID'] = units_of_class.get(str(c['scopeClassID']), [])
        touched += 1

    meta = doc.get('_meta')
    if isinstance(meta, dict) and 'schemaVersion' in meta:
        meta['schemaVersion'] = SCHEMA_VERSION

    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False)
                    + ('\n' if raw.endswith('\n') else ''), encoding='utf-8')
    print(f'{path.name}: {touched} classes keyed '
          f'({sum(1 for c in classes if c.get("businessUnitID"))} with units)')


if __name__ == '__main__':
    for target in TARGETS:
        migrate(target)
