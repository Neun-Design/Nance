#!/usr/bin/env python3
"""Deterministic migration: Tickets.customerName -> customerID (v3-review R3).

D6 (approved): the last name-keyed join. Tickets stored the customer *name*
(name-valued FK) and the forecastScopeID/taskID compound rollups joined on
it. The schema now stores the PK (customerID) with a customerName display
mirror (the Projects pattern):

  Tickets.customerID    resolved from the stored customerName by unique
                        customerName lookup on Customers; fallbacks for the
                        legacy copy, whose tickets stored old-format ids as
                        the "name": direct customerID match, then the
                        zero-padded spelling (FC1 -> FC01); still-unmatched
                        values stay null (and are reported)
  Tickets.customerName  stored copy DROPPED -- it is a mirror now

Idempotent: tickets already carrying a customerID key are untouched.
Applies to both mockup copies (prototype/data + sourceFiles/developer).
"""
import json
import re
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
    customers = (doc.get('CRM') or {}).get('Customers') or []
    by_name = {}
    ids = {str(c['customerID']) for c in customers}
    for c in customers:
        by_name.setdefault(str(c.get('customerName') or '').lower(), []).append(c['customerID'])

    def resolve_customer(name):
        hits = by_name.get(str(name or '').lower(), [])
        if len(hits) == 1:
            return hits[0]
        s = str(name or '')
        if s in ids:                                   # legacy: id stored as "name"
            return s
        m = re.fullmatch(r'([A-Za-z]+)(\d+)', s)       # legacy: FC1 -> FC01
        if m:
            padded = f'{m.group(1)}{int(m.group(2)):02d}'
            if padded in ids:
                return padded
        return None

    unmatched = []
    changed = 0
    for t in (doc.get('Workspace') or {}).get('Tickets') or []:
        if t.get('customerID'):
            continue
        name = t.pop('customerName', None)
        t['customerID'] = resolve_customer(name)
        if name and t['customerID'] is None:
            unmatched.append((t.get('ticketID'), name))
        changed += 1

    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + '\n',
                    encoding='utf-8')
    print(f'{path.relative_to(ROOT)}: {changed} ticket(s) migrated'
          + (f'; UNMATCHED: {unmatched}' if unmatched else ''))


if __name__ == '__main__':
    for target in TARGETS:
        migrate(target)
    sys.exit(0)
