#!/usr/bin/env python3
"""Pre-RBAC filter inputs on Workflows (issue #342, schemaVersion 85).

The #340 Procedures chain applied to the Workflows form: new stored
`businessUnitID` + `departmentID` filter FKs, cascade Business Unit →
Department → Process (the Process select was ungated and offered every
process).

Seeds — the #340 rule, so every seeded chain survives its own pickers
(form-integrity): department = the process's `departmentID`, unit = the
department's `businessUnitID`. Same rule in the seed builder
(build_seed.py) — regenerated ≡ migrated. Runs on both mockup copies
(the developer copy no-ops to honest nulls — its processes carry no
departments); frozen transformers testdata stays unmigrated (#284).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COPIES = [
    ROOT / 'data' / 'mockup_data_prototype.json',
    ROOT.parent / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 85


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


def first(v):
    lst = as_list(v)
    return lst[0] if lst else None


def migrate(path):
    raw = path.read_text(encoding='utf-8')
    mock = json.loads(raw)
    tables = tables_of(mock)
    processes = {str(p['processID']): p for p in tables.get('Processes', [])}
    departments = {str(d['departmentID']): d for d in tables.get('Departments', [])}
    stats = {'workflows': 0, 'keyed': 0, 'null': 0}
    for wf in tables.get('Workflows', []):
        stats['workflows'] += 1
        pr = processes.get(str(first(wf.get('processID'))))
        dept_id = first(pr.get('departmentID')) if pr else None
        wf['departmentID'] = dept_id
        dept = departments.get(str(dept_id)) if dept_id is not None else None
        wf['businessUnitID'] = first(dept.get('businessUnitID')) if dept else None
        stats['keyed' if dept_id is not None else 'null'] += 1
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
