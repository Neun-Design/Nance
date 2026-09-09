#!/usr/bin/env python3
"""Requirements Registry-unit split (Rafael, sv107).

The #359 mandate made `businessUnitID` NOT NULL — mixing the pre-RBAC
FILTER role (#334: narrow the wizard options) into the inheritance
APPLICABILITY dimension, so every requirement was born unit-constrained
and a cross-unit requirement (e.g. "only for scope S") could not be
expressed. The split:

- new stored `registryUnitID` (FK → Business Units, NOT NULL) — the
  wizard Registry step's pre-RBAC filter: it narrows every Applicability
  option (regions = the unit's served regions; the applicability unit
  multicheck offers exactly this unit) and is NEVER read by the
  inheritance chains. Removal candidate when RBAC lands.
- `businessUnitID` returns to NULLABLE — the optional unit-applicability
  dimension (declared constrains, undeclared does not — sv106).

Seeds: registryUnitID = the FIRST unit of the row's businessUnitID key
(demo rows carry the #359 all-units seed → BU01 everywhere; the all-units
applicability keys are kept — ≡ unconstrained under declared-constrains,
zero inheritance flips). Both mockup copies; the frozen transformers
testdata stays unmigrated (#284).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COPIES = [
    ROOT / 'data' / 'mockup_data_prototype.json',
    ROOT.parent / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 107


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
    units = [u['businessUnitID'] for u in tables.get('Business Units', [])]
    stats = {'rows': 0, 'seeded': 0}
    for r in tables.get('Requirements', []):
        stats['rows'] += 1
        if 'registryUnitID' not in r or r['registryUnitID'] in (None, ''):
            own = as_list(r.get('businessUnitID'))
            r['registryUnitID'] = own[0] if own else (units[0] if units else None)
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
