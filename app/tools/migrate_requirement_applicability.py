#!/usr/bin/env python3
"""Requirements explicit-applicability round (issue #366, schemaVersion 99).

The #364 doctrine lands on the Requirement side: every applicability key
must be DECLARED — an empty key keeps the requirement out of every
inheritance ('apply to all' = every value explicitly selected; a value
registered later requires revisiting the requirement — the deliberate
review the old Q1 wildcard bypassed).

Data side, both mockup copies:

- Every EMPTY applicability key is MATERIALIZED with its FULL dimension
  (table row order) — the faithful translation of what the blank meant
  under the old reading, so ticket inheritance (#226), the Forecast Scopes
  compound rollup (multiViaJoin) and the pickers are preserved at rest
  (0 flips; the #365 lesson: materialize what the WILDCARD covered).
  Keys: regionID, businessUnitID, branchID, customerID, scopeID,
  productGroupID, productScopeID.
- `customerID` becomes MULTIVALUED (was single, #180): scalars convert to
  singleton lists; blanks materialize to every customer. `branchID` scalars
  (if any) convert the same way.

Display posture (#366, engine side): a set naming the ENTIRE dimension
reads as global — NOT a specific pin — in the Constraints facets (#353)
and the PS-REQUIREMENTS legs (#288), so those authored partitions render
exactly as before (namesFullDimension in resolve.js).

The frozen transformers testdata stays unmigrated (#284); its pre-sv99
stamp keeps the legacy wildcard reading via legacyWildcardData(99).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COPIES = [
    ROOT / 'data' / 'mockup_data_prototype.json',
    ROOT.parent / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 99

# applicability key → the table whose full dimension materializes a blank
DIMENSIONS = [
    ('regionID', 'Regions', 'regionID'),
    ('businessUnitID', 'Business Units', 'businessUnitID'),
    ('branchID', 'Branches', 'branchID'),
    ('customerID', 'Customers', 'customerID'),
    ('scopeID', 'Scopes', 'scopeID'),
    ('productGroupID', 'Product Groups', 'productGroupID'),
    ('productScopeID', 'Product Scopes', 'productScopeID'),
]


def tables_of(mock):
    """The mockup nests tables by module (false 0-rows trap) — walk it."""
    out = {}
    for mod, tabs in mock.items():
        if mod.startswith('_') or not isinstance(tabs, dict):
            continue
        for name, rows in tabs.items():
            if isinstance(rows, list):
                out[name] = rows
    return out


def as_list(v):
    if v is None or v == '':
        return []
    return v if isinstance(v, list) else [v]


def migrate(path):
    raw = path.read_text(encoding='utf-8')
    mock = json.loads(raw)
    tables = tables_of(mock)
    full = {key: [r[pk] for r in tables.get(tab, [])]
            for key, tab, pk in DIMENSIONS}
    stats = {'requirements': 0, 'materialized': 0, 'listified': 0}
    for r in tables.get('Requirements', []):
        stats['requirements'] += 1
        for key, _tab, _pk in DIMENSIONS:
            cur = r.get(key)
            vals = as_list(cur)
            if not vals:
                r[key] = list(full[key])
                if r[key]:
                    stats['materialized'] += 1
            elif not isinstance(cur, list):
                # cardinality conversion (customerID multi since #366) —
                # every key is stored as a list from sv99 on
                r[key] = vals
                stats['listified'] += 1
    mock.setdefault('_meta', {})['schemaVersion'] = SCHEMA_VERSION
    path.write_text(json.dumps(mock, indent=1, ensure_ascii=False)
                    + ('\n' if raw.endswith('\n') else ''), encoding='utf-8')
    return stats


def main():
    for path in COPIES:
        if not path.exists():
            print(f'skip (missing): {path}')
            continue
        print(f'{path.name}: {migrate(path)}')


if __name__ == '__main__':
    sys.exit(main())
