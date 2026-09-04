#!/usr/bin/env python3
"""Project Branch round (2026-09-04, schemaVersion 72).

Projects gain `branchID` — the customer's contracting branch the project
runs under, narrowing the form's SLA options to the (customer, branch)
pair (an SLA without a branch is not branch-specific and stays offered —
Q1; see slasForProject in forms.js).

Seeds (deterministic, mirrored in build_seed.py): the UNANIMITY branch of
the project's linked SLAs — exactly one distinct non-null `SLA.branchID`
across the set → that branch; otherwise honest null. Integrity-safe under
the Q1 picker: a seeded branch never orphans a branch-less SLA of the same
project (it survives the filter), and mixed-branch sets seed null (no
narrowing is fabricated). Census at migration time: every SLA in both
copies' Projects chains carries a null branch → all projects seed null.

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
SCHEMA_VERSION = 72


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


def branch_for(project, slas):
    branches = set()
    for sid in as_list(project.get('slaID')):
        s = slas.get(str(sid))
        if s and s.get('branchID') not in (None, ''):
            branches.add(s['branchID'])
    return next(iter(branches)) if len(branches) == 1 else None


def migrate(path):
    raw = path.read_text(encoding='utf-8')
    mock = json.loads(raw)
    tables = tables_of(mock)
    slas = {str(s['slaID']): s for s in tables.get('SLA', [])}
    keyed = null = 0
    for p in tables.get('Projects', []):
        p['branchID'] = branch_for(p, slas)
        if p['branchID'] is None:
            null += 1
        else:
            keyed += 1
    mock.setdefault('_meta', {})['schemaVersion'] = SCHEMA_VERSION
    path.write_text(json.dumps(mock, indent=1, ensure_ascii=False)
                    + ('\n' if raw.endswith('\n') else ''), encoding='utf-8')
    return {'keyed': keyed, 'null': null}


def main():
    for path in COPIES:
        if not path.exists():
            print(f'skip (missing): {path}')
            continue
        print(f'{path.name}: {migrate(path)}')


if __name__ == '__main__':
    sys.exit(main())
