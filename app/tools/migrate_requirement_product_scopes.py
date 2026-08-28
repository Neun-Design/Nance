#!/usr/bin/env python3
"""Deterministic migration: Requirement Product Scopes (issue #294).

Inverts the #288 form-level link — the requirement now declares which
product scopes it applies to, the Product Scope form no longer picks
requirements:

- `Product Scopes.requirementID` (stored direct-pick FK, #288) is
  REMOVED from every row — the parity validator requires stored attrs
  exact, so a dropped attribute must leave the data too. The demo seeds
  were honest empty lists (no pick was ever fabricated), so nothing is
  lost.
- `Requirements.productScopeID` (stored multivalued FK → Product Scopes)
  is seeded as the honest empty list on every row: no requirement in the
  demo names specific product scopes — the comprehensive
  PS-REQUIREMENTS set still derives the explicit scope/product-group
  connections, and requirements created FOR a business unit attach to
  the unit's product scopes automatically (the #294 rationale).

The same shape runs in the seed builder (`build_seed.py`), so a
regenerated dataset and a migrated one agree.

Targets both mockup copies; `_meta.schemaVersion` stamped to 62 on the
copy that carries it. Idempotent.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 62


def find_table(doc, name):
    for tables in doc.values():
        if isinstance(tables, dict) and name in tables:
            return tables[name]
    return None


def migrate(path):
    raw = path.read_text(encoding='utf-8')
    doc = json.loads(raw)
    pss = find_table(doc, 'Product Scopes')
    reqs = find_table(doc, 'Requirements')

    dropped = 0
    for ps in (pss or []):
        if 'requirementID' in ps:
            del ps['requirementID']
            dropped += 1
    keyed = 0
    for r in (reqs or []):
        if 'productScopeID' not in r:
            r['productScopeID'] = []
            keyed += 1

    meta = doc.get('_meta')
    if isinstance(meta, dict) and 'schemaVersion' in meta:
        meta['schemaVersion'] = SCHEMA_VERSION

    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False)
                    + ('\n' if raw.endswith('\n') else ''), encoding='utf-8')
    print(f'{path.name}: {dropped} product scopes dropped requirementID, '
          f'{keyed} requirements keyed with productScopeID []')


if __name__ == '__main__':
    for target in TARGETS:
        migrate(target)
