#!/usr/bin/env python3
"""Pre-RBAC filter inputs on Tasks (issue #344, schemaVersion 86).

The #340 chain applied to the Tasks form: new stored `businessUnitID` +
`departmentID` filter FKs — Business Unit → Department → Process, with
the existing Event leg kept (Process = `filtered by Event + Department
selected`, the generic multi-dep AND). The Event select stays UNfiltered
by unit (session decision: 16/46 demo tasks chain events whose unit
differs from their process department's unit — filtering would orphan
stored picks, and re-keying event units would cascade through the
Payload/SLA chains).

Seeds — the #340 rule (every seeded chain survives its own pickers):
department = the process's `departmentID`, unit = the department's.
Same rule in the seed builder (build_seed.py) — regenerated ≡ migrated.
Runs on both mockup copies (developer no-ops to honest nulls); frozen
transformers testdata stays unmigrated (#284).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COPIES = [
    ROOT / 'data' / 'mockup_data_prototype.json',
    ROOT.parent / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 86


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
    stats = {'tasks': 0, 'keyed': 0, 'null': 0}
    for t in tables.get('Tasks', []):
        stats['tasks'] += 1
        pr = processes.get(str(first(t.get('processID'))))
        dept_id = first(pr.get('departmentID')) if pr else None
        t['departmentID'] = dept_id
        dept = departments.get(str(dept_id)) if dept_id is not None else None
        t['businessUnitID'] = first(dept.get('businessUnitID')) if dept else None
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
