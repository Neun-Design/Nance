#!/usr/bin/env python3
"""Ticket output branch (Rafael's conceptual fix, sv108).

The ticket gains a stored `branchID` — the APPLICANT's branch that will
RECEIVE the ticket's output, chosen below the Applicant on the Parties
step. It becomes THE branch context of requirement inheritance:
branch-pinned requirements apply exactly to this branch (the sv105/sv106
party-branch union is superseded), and the SUPPLIER is removed from the
inheritance entirely — a supplier must not impose requirements on a
request it must itself resolve; customer-exclusive requirements keep
inheriting through the #308 pair (customer + applicant).

Seeds (deterministic, both copies): branchID = the FIRST branch where the
ticket's APPLICANT is registered (Branches.customerID, table row order);
null where the ticket has no applicant or the applicant has no branch —
the no-branch path stays demoed (#272 posture). Zero inheritance flips at
rest: the demo requirements carry materialized (full-dimension) branch
keys, which match any context and skip on blank.

The frozen transformers testdata stays unmigrated (#284).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COPIES = [
    ROOT / 'data' / 'mockup_data_prototype.json',
    ROOT.parent / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 108


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
    branches = tables.get('Branches', [])

    def first_branch_of(cid):
        if cid in (None, ''):
            return None
        for b in branches:
            if str(cid) in [str(x) for x in as_list(b.get('customerID'))]:
                return b['branchID']
        return None

    stats = {'tickets': 0, 'seeded': 0, 'null': 0}
    for t in tables.get('Tickets', []):
        stats['tickets'] += 1
        if 'branchID' not in t or t['branchID'] in (None, ''):
            t['branchID'] = first_branch_of(t.get('applicantID'))
            if t['branchID'] is None:
                stats['null'] += 1
            else:
                stats['seeded'] += 1
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
