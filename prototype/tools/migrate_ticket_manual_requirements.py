#!/usr/bin/env python3
"""Manually selectable requirements on Tickets (issue #359, schemaVersion 95).

Two new stored keys, both sides of the manual-addition chain:

- `Requirements.ticketSelectable` (BOOLEAN, #218 real-boolean convention,
  form default No) — the governance decision that a requirement may be
  ADDED MANUALLY to compatible tickets. Demo cohort (session decision,
  deterministic): requirements pinned to a CUSTOMER or a REGION seed Yes
  (5 clinic rows) — the Tickets picker is demonstrable with zero at-rest
  changes; everything else seeds No.

- `Tickets.addedRequirementID[]` — the manual picks, seeded EMPTY on every
  row (honest: no demo ticket carries additions; ticketRequirements unions
  them after the UNTOUCHED inheritance match, so empty = zero flips at
  rest — the TICKET-INPUTS 137/160 census guard holds).

Runs on both mockup copies; the frozen transformers testdata stays
unmigrated by design (missing keys read as blank/false — legacy
tolerance: `ticketSelectable !== true` never offers, absent picks add
nothing).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COPIES = [
    ROOT / 'data' / 'mockup_data_prototype.json',
    ROOT.parent / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 95


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


def pinned(v):
    return v not in (None, '', [])


def migrate(path):
    raw = path.read_text(encoding='utf-8')
    mock = json.loads(raw)
    tables = tables_of(mock)
    stats = {'requirements': 0, 'flagged_yes': 0, 'tickets': 0}
    for r in tables.get('Requirements', []):
        stats['requirements'] += 1
        r['ticketSelectable'] = bool(pinned(r.get('customerID')) or pinned(r.get('regionID')))
        if r['ticketSelectable']:
            stats['flagged_yes'] += 1
    for t in tables.get('Tickets', []):
        stats['tickets'] += 1
        t['addedRequirementID'] = []
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
