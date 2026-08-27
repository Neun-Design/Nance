#!/usr/bin/env python3
"""Deterministic migration: Product Scope Requirements (issue #288).

Product Scopes.requirementID became a STORED multivalued FK — the
requirements DIRECTLY selected at registration (the compound rollup it
replaces derived the set at render time, so no mockup row carries the
key). Every Product Scope row is seeded with the honest empty list: no
registration-time pick has been made in the demo — the comprehensive
`productScopeRequirements` set (PS-REQUIREMENTS, explicit connections
only) still surfaces the requirements whose scope/product-group keys
name the row, so the REQUIREMENTS column keeps its explicit links.
Session decision (no Q1 wildcard on the comprehensive set): requirements
with blank scope AND product-group keys leave the Product Scopes views
until pinned — the ticket inheritance (#226) keeps offering them.

The same empty seed runs in the seed builder (`build_seed.py`), so a
regenerated dataset and a migrated one agree.

Targets both mockup copies; `_meta.schemaVersion` stamped to 59 on the
copy that carries it. Idempotent: rows already keyed are left untouched.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 59


def find_table(doc, name):
    for tables in doc.values():
        if isinstance(tables, dict) and name in tables:
            return tables[name]
    return None


def migrate(path):
    raw = path.read_text(encoding='utf-8')
    doc = json.loads(raw)
    pss = find_table(doc, 'Product Scopes')
    if pss is None:
        print(f'{path.name}: no Product Scopes table — skipped')
        return

    touched = 0
    for ps in pss:
        if 'requirementID' in ps:
            continue  # idempotence
        ps['requirementID'] = []
        touched += 1

    meta = doc.get('_meta')
    if isinstance(meta, dict) and 'schemaVersion' in meta:
        meta['schemaVersion'] = SCHEMA_VERSION

    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False)
                    + ('\n' if raw.endswith('\n') else ''), encoding='utf-8')
    print(f'{path.name}: {touched} product scopes keyed with requirementID []')


if __name__ == '__main__':
    for target in TARGETS:
        migrate(target)
