#!/usr/bin/env python3
"""Deterministic migration: Issues/Business Segments owners (v3-review D7, R2).

Rafael's D7 call: only Issues and Business Segments gain accountability
owners (ISO 9001:2015 §5.3) — the other owner-less tables stay as they are.
Seeds derive from the quality chain already in the data:

  Issues.issueOwner                qualityManager of the issue's first
                                   business unit (sorted); null when the
                                   issue has no unit or the unit no manager
  Business Segments.
    businessSegmentOwner           qualityManager of the segment's first
                                   business unit (sorted); null when none

Idempotent: rows already carrying the key are untouched.
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
    units = org.get('Business Units') or []
    qm_of_unit = {u.get('businessUnitID'): u.get('qualityManager') for u in units}
    units_of_segment = {}
    for u in sorted(units, key=lambda u: str(u.get('businessUnitID'))):
        seg = u.get('businessSegmentID')
        for s in (seg if isinstance(seg, list) else [seg]):
            units_of_segment.setdefault(s, u.get('businessUnitID'))

    changed = 0
    for i in org.get('Issues') or []:
        if 'issueOwner' in i:
            continue
        bu = i.get('businessUnitID')
        if isinstance(bu, list):
            bu = sorted(bu)[0] if bu else None
        i['issueOwner'] = qm_of_unit.get(bu)
        changed += 1
    for s in org.get('Business Segments') or []:
        if 'businessSegmentOwner' in s:
            continue
        s['businessSegmentOwner'] = qm_of_unit.get(units_of_segment.get(s.get('businessSegmentID')))
        changed += 1

    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + '\n',
                    encoding='utf-8')
    print(f'{path.relative_to(ROOT)}: {changed} owner(s) seeded')


if __name__ == '__main__':
    for target in TARGETS:
        migrate(target)
    sys.exit(0)
