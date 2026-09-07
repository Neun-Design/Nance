#!/usr/bin/env python3
"""Roles Business Unit filter round (issue #334, schemaVersion 81).

The Roles form gains a single-valued **Business Unit** select whose only
job is to FILTER the Function options (pre-RBAC filter-input doctrine:
until RBAC lands, forms carry inputs that narrow the remaining options so
the MVP serves different Business Segments/Units). The filter is a stored
FK — `Roles.businessUnitID`, NOT NULL (cascade-dep convention) — because
the generic stored-key cascade reads sibling stored keys.

Seeds: each role's unit = its function's (first) unit — the gated
Function picker offers the role's own function by construction, so every
seeded row survives edit-mode (form-integrity trap). Fallback: the first
Business Unit row (functions are NOT NULL on unit in both copies, so the
fallback should never fire — kept for robustness).

Runs on both mockup copies; the frozen transformers testdata stays
unmigrated by design (#284 posture).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COPIES = [
    ROOT / 'data' / 'mockup_data_prototype.json',
    ROOT.parent / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 81


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
    functions = {str(f['functionID']): f for f in tables.get('Functions', [])}
    units = tables.get('Business Units', [])
    fallback = units[0]['businessUnitID'] if units else None
    stats = {'roles': 0, 'from_function': 0, 'fallback': 0}
    for r in tables.get('Roles', []):
        stats['roles'] += 1
        fn = functions.get(str(r.get('functionID')))
        fn_units = as_list(fn.get('businessUnitID')) if fn else []
        if fn_units:
            r['businessUnitID'] = fn_units[0]
            stats['from_function'] += 1
        else:
            r['businessUnitID'] = fallback
            stats['fallback'] += 1
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
