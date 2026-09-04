#!/usr/bin/env python3
"""Branch customers N:N round (2026-09-04 second round, schemaVersion 74).

`Branches.customerID` becomes MULTIVALUED — a branch may serve several
customers (reverses the D1 single owner of 2026-08-03). The Customer form's
Branch picker offers every branch again and the save updates only the
saving customer's own membership (applyCustomerBranches in forms.js), so
the v73 steal bug and its hide-the-owned mitigation are both gone by
construction (branchAvailableForCustomer retired).

Seeds (deterministic, mirrored in build_seed.py): each branch's scalar
customerID becomes the singleton list [value]; null/empty becomes [] —
no new memberships are fabricated (the honest posture: grouping several
customers on a branch is a UI decision).

Runs on both mockup copies; the frozen transformers testdata stays
unmigrated by design (the engine tolerates the legacy scalar shape).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COPIES = [
    ROOT / 'data' / 'mockup_data_prototype.json',
    ROOT.parent / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 74


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


def migrate(path):
    raw = path.read_text(encoding='utf-8')
    mock = json.loads(raw)
    tables = tables_of(mock)
    listed = empty = kept = 0
    for b in tables.get('Branches', []):
        v = b.get('customerID')
        if isinstance(v, list):
            kept += 1
        elif v in (None, ''):
            b['customerID'] = []
            empty += 1
        else:
            b['customerID'] = [v]
            listed += 1
    mock.setdefault('_meta', {})['schemaVersion'] = SCHEMA_VERSION
    path.write_text(json.dumps(mock, indent=1, ensure_ascii=False)
                    + ('\n' if raw.endswith('\n') else ''), encoding='utf-8')
    return {'listed': listed, 'empty': empty, 'already': kept}


def main():
    for path in COPIES:
        if not path.exists():
            print(f'skip (missing): {path}')
            continue
        print(f'{path.name}: {migrate(path)}')


if __name__ == '__main__':
    sys.exit(main())
