#!/usr/bin/env python3
"""Deterministic migration: Regions.countryName (2026-08-01, second round).

Regions gained a multivalued Country picker (FK -> Countries) that in turn
feeds the Branches form: the branch Country options are the countries
registered on the selected Region. Seed each region's list from the data we
already have:

  Regions.countryName  sorted union of the countryName of the region's
                       branches (Branches.regionID); regions with no
                       branches stay []

Idempotent: regions already carrying a non-empty countryName are untouched.
Applies to both mockup copies (prototype/data + sourceFiles/developer).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]


def migrate(path: Path) -> None:
    if not path.exists():
        print(f'skip (missing): {path}')
        return
    doc = json.loads(path.read_text(encoding='utf-8'))
    org = doc.get('Organization') or {}
    regions = org.get('Regions') or []
    branches = org.get('Branches') or []

    by_region = {}
    for b in branches:
        rid, country = b.get('regionID'), b.get('countryName')
        if rid and country:
            by_region.setdefault(rid, set()).add(country)

    changed = 0
    for r in regions:
        if r.get('countryName'):
            continue
        r['countryName'] = sorted(by_region.get(r.get('regionID'), set()))
        changed += 1

    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + '\n',
                    encoding='utf-8')
    print(f'{path.relative_to(ROOT)}: {changed} region(s) seeded')


if __name__ == '__main__':
    for target in TARGETS:
        migrate(target)
    sys.exit(0)
