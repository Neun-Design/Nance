#!/usr/bin/env python3
"""Pre-RBAC filter inputs on Procedures and Handouts (issue #340, sv84).

Two filter chains land (the #334 doctrine — filter inputs are stored FKs):

1. **Procedures** regain a stored `departmentID` (the #159 drop is
   superseded for the FORM chain): Unit → Department → Process. Seeds:
   the process's departmentID; and `businessUnitID` is RE-KEYED to that
   department's unit — the pre-#340 rows all carried BU01 while their
   processes' departments spanned four units, which would break
   form-integrity under the new cascade (the #281/#309 edit-integrity
   posture: every seeded chain must survive its own pickers).

2. **Handouts** gain `businessUnitID` (single) + `departmentID`
   (multivalued): each handout's departments = the UNION of the
   departments of the procedures using it as input or output (procedure
   row order — stored Input/Output picks must survive the new
   department-filtered pickers), unit = the first department's unit.
   Unused handouts stay honestly empty (Q1 — offered everywhere).

Same rules in the seed builder (build_seed.py) — regenerated ≡ migrated.
Runs on both mockup copies; frozen transformers testdata stays
unmigrated (#284 posture).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COPIES = [
    ROOT / 'data' / 'mockup_data_prototype.json',
    ROOT.parent / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 84


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
    stats = {'procs': 0, 'dept_keyed': 0, 'unit_rekeyed': 0,
             'handouts': 0, 'handouts_keyed': 0}

    for proc in tables.get('Procedures', []):
        stats['procs'] += 1
        pr = processes.get(str(first(proc.get('processID'))))
        dept_id = first(pr.get('departmentID')) if pr else None
        proc['departmentID'] = dept_id
        if dept_id is not None:
            stats['dept_keyed'] += 1
            dept = departments.get(str(dept_id))
            unit = first(dept.get('businessUnitID')) if dept else None
            if unit is not None and unit != proc.get('businessUnitID'):
                proc['businessUnitID'] = unit
                stats['unit_rekeyed'] += 1

    for h in tables.get('Handouts', []):
        stats['handouts'] += 1
        hid = h['handoutID']
        depts = []
        for proc in tables.get('Procedures', []):
            if hid not in as_list(proc.get('taskInput')) \
                    and hid not in as_list(proc.get('taskOutput')):
                continue
            d = proc.get('departmentID')
            if d is not None and d not in depts:
                depts.append(d)
        h['departmentID'] = depts
        d0 = departments.get(str(depts[0])) if depts else None
        h['businessUnitID'] = first(d0.get('businessUnitID')) if d0 else None
        if depts:
            stats['handouts_keyed'] += 1

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
