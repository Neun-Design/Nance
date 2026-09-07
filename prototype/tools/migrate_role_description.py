#!/usr/bin/env python3
"""Roles Description round (issue #336, schemaVersion 82).

The Roles form gains a **Description** textarea right below Role Name
(the #328 jobFamilyDescription precedent). New stored
`Roles.roleDescription` (TEXT, nullable — description convention).

Seeds: deterministic generated text — the functionDescription/
levelDescription posture — "<roleName> role within the <functionName>
function" (honest null when the function row is missing). Same rule in
the seed builder (build_seed.py), so regenerated ≡ migrated.

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
SCHEMA_VERSION = 82


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
    functions = {str(f['functionID']): f for f in tables.get('Functions', [])}
    stats = {'roles': 0, 'seeded': 0, 'null': 0}
    for r in tables.get('Roles', []):
        stats['roles'] += 1
        fn = functions.get(str(r.get('functionID')))
        if fn and fn.get('functionName'):
            r['roleDescription'] = (f"{r['roleName']} role within the "
                                    f"{fn['functionName']} function")
            stats['seeded'] += 1
        else:
            r['roleDescription'] = None
            stats['null'] += 1
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
