#!/usr/bin/env python3
"""Deterministic migration: Branches.customerID (2026-08-01, v3-review D1).

D1 option 1 (approved): a branch is the organisational record of an internal
customer (interested party, ISO 9001:2015 §4.2) — link them with a nullable
FK. The 17 demo branches were originally seeded FROM the branch-type
customers, so the link is recovered deterministically:

  Branches.customerID   the customer whose customerName equals branchName
                        (unique across the demo set — 'PN' <-> 'PN', ...);
                        fallback: unique (city, businessUnitID) match;
                        no match -> stays null (the FK is optional)
  Customers.country     legacy spellings normalized to the Countries registry
                        (USA/US -> United States, UK -> United Kingdom, ...)
                        so linked pairs agree — the validator's new geography
                        drift check flagged FC15 'USA' vs BR15

Idempotent: branches already carrying a customerID key are untouched.
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

# legacy free-text country spellings -> Countries registry names
# (same table migrate_branches_round.py used for the branch side)
COUNTRY_ALIASES = {'USA': 'United States', 'US': 'United States',
                   'UK': 'United Kingdom', 'UAE': 'United Arab Emirates'}


def migrate(path: Path) -> None:
    if not path.exists():
        print(f'skip (missing): {path}')
        return
    doc = json.loads(path.read_text(encoding='utf-8'))
    customers = (doc.get('CRM') or {}).get('Customers') or []
    branches = (doc.get('Organization') or {}).get('Branches') or []

    by_name, by_city_unit = {}, {}
    for c in customers:
        if c.get('customerType') != 'branch':
            continue
        by_name.setdefault(str(c.get('customerName') or '').lower(), []).append(c['customerID'])
        units = c.get('businessUnitID')
        for u in (units if isinstance(units, list) else [units]):
            by_city_unit.setdefault((str(c.get('city') or '').lower(), u), []).append(c['customerID'])

    normalized = 0
    for c in customers:
        alias = COUNTRY_ALIASES.get(str(c.get('country') or '').strip())
        if alias:
            c['country'] = alias
            normalized += 1

    changed = 0
    for b in branches:
        if 'customerID' in b:
            continue
        hits = by_name.get(str(b.get('branchName') or '').lower(), [])
        if len(hits) != 1:
            hits = by_city_unit.get((str(b.get('cityName') or '').lower(), b.get('businessUnitID')), [])
        b['customerID'] = hits[0] if len(hits) == 1 else None
        changed += 1

    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + '\n',
                    encoding='utf-8')
    linked = sum(1 for b in branches if b.get('customerID'))
    print(f'{path.relative_to(ROOT)}: {changed} branch(es) seeded, {linked}/{len(branches)} linked, '
          f'{normalized} country spelling(s) normalized')


if __name__ == '__main__':
    for target in TARGETS:
        migrate(target)
    sys.exit(0)
