#!/usr/bin/env python3
"""Deterministic migration: backfill NOT NULL anchors (2026-08-01).

The required-fields round marks structural anchors NOT NULL (cascade deps +
derived-chain join keys). Two legacy seed gaps are backfilled so the new
validate_mockup.py required-fields check starts green:

  Scopes.businessUnitID   (multivalued) units of the scope's opportunity
                          issue; fallback 1: union of units of sibling scopes
                          sharing the same opportunity; fallback 2: union of
                          units of the scope-code prefix family (A.4 <- A.*)
  Functions.businessUnitID  F6 'Manager' has no people and no derivable unit
                          -- seeded with the first unit by id (BU01), the
                          documented convention for unanchored demo rows

Idempotent: rows already carrying a non-empty value are untouched.
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

empty = lambda v: v is None or v == '' or (isinstance(v, list) and not v)


def migrate(path: Path) -> None:
    if not path.exists():
        print(f'skip (missing): {path}')
        return
    doc = json.loads(path.read_text(encoding='utf-8'))
    org = doc.get('Organization') or {}
    pf = doc.get('Portfolio') or {}
    tal = doc.get('Talent') or {}

    units_of_issue = {i.get('issueID'): [u for u in (i.get('businessUnitID') or []) if u]
                      for i in org.get('Issues') or []}
    scopes = pf.get('Scopes') or []
    units_of_opp = {}
    for s in scopes:
        opp = s.get('scopeOpportunity')
        for u in (s.get('businessUnitID') or []):
            if opp and u:
                units_of_opp.setdefault(opp, set()).add(u)

    units_of_prefix = {}
    for s in scopes:
        prefix = str(s.get('scopeID') or '').split('.')[0]
        for u in (s.get('businessUnitID') or []):
            if prefix and u:
                units_of_prefix.setdefault(prefix, set()).add(u)

    changed = []
    for s in scopes:
        if not empty(s.get('businessUnitID')):
            continue
        opp = s.get('scopeOpportunity')
        prefix = str(s.get('scopeID') or '').split('.')[0]
        units = (units_of_issue.get(opp)
                 or sorted(units_of_opp.get(opp, set()))
                 or sorted(units_of_prefix.get(prefix, set())))
        if units:
            s['businessUnitID'] = sorted(units)
            changed.append(f"Scopes.{s.get('scopeID')}={s['businessUnitID']}")

    first_unit = min((u.get('businessUnitID') for u in org.get('Business Units') or []
                      if u.get('businessUnitID')), default=None)
    for f in tal.get('Functions') or []:
        if empty(f.get('businessUnitID')) and first_unit:
            f['businessUnitID'] = first_unit
            changed.append(f"Functions.{f.get('functionID')}={first_unit}")

    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + '\n',
                    encoding='utf-8')
    print(f'{path.relative_to(ROOT)}: {len(changed)} backfilled — {changed}')


if __name__ == '__main__':
    for target in TARGETS:
        migrate(target)
    sys.exit(0)
