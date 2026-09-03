#!/usr/bin/env python3
"""Ticket Applicant round (issue #308, schemaVersion 69).

Tickets gain `applicantID` — the INTERNAL customer opening the ticket, a
second requirement-inheritance party (the #226 customer gate widens to the
(customer, applicant) pair; empty key = inherits through the customer alone).

Seeds (deterministic, mirrored in build_seed.py): a null cohort at
`i % 3 == 0` keeps the no-applicant path demoed (#272 posture); the rest
take the first Internal-type customer serving the ticket's unit, preferring
one DIFFERENT from the ticket's own customer (self-opened fallback), sorted
by customerID; no Internal in the unit = honest null.

Runs on both mockup copies; the frozen transformers testdata stays
unmigrated by design.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COPIES = [
    ROOT / 'data' / 'mockup_data_prototype.json',
    ROOT.parent / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 69


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


def applicant_for(ticket, internals):
    unit = ticket.get('businessUnitID')
    pool = [c for c in internals if unit in as_list(c.get('businessUnitID'))]
    others = [c for c in pool if c['customerID'] != ticket.get('customerID')]
    pick = (others or pool)
    return pick[0]['customerID'] if pick else None


def migrate(path):
    raw = path.read_text(encoding='utf-8')
    mock = json.loads(raw)
    tables = tables_of(mock)
    internals = sorted((c for c in tables.get('Customers', [])
                        if c.get('customerType') == 'Internal'),
                       key=lambda c: c['customerID'])
    keyed = null_cohort = 0
    for i, t in enumerate(tables.get('Tickets', [])):
        if i % 3 == 0:
            t['applicantID'] = None
        else:
            t['applicantID'] = applicant_for(t, internals)
        if t['applicantID'] is None:
            null_cohort += 1
        else:
            keyed += 1
    mock.setdefault('_meta', {})['schemaVersion'] = SCHEMA_VERSION
    path.write_text(json.dumps(mock, indent=1, ensure_ascii=False)
                    + ('\n' if raw.endswith('\n') else ''), encoding='utf-8')
    return {'keyed': keyed, 'null': null_cohort}


def main():
    for path in COPIES:
        if not path.exists():
            print(f'skip (missing): {path}')
            continue
        print(f'{path.name}: {migrate(path)}')


if __name__ == '__main__':
    sys.exit(main())
