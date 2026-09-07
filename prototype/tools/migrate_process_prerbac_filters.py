#!/usr/bin/env python3
"""Pre-RBAC filter inputs on Processes (issue #348, schemaVersion 88).

Reverts the #346 recorded exclusion (Rafael's call): the Processes form
gains the doctrine pair — `businessUnitID` converts from a MIRROR of the
event's unit to a **stored FK** (materialize-FK convention) gating the
Department select; the Event anchor stays unfiltered (the #344 posture —
census: 2/6 demo processes chain events of another unit, PR2/PR5).

Seeds: the DEPARTMENT's unit (fallback: the event's; honest null when
neither resolves — the developer copy's processes carry no departments).
Same rule in the seed builder (build_seed.py) — regenerated ≡ migrated.
Runs on both mockup copies; frozen transformers testdata stays
unmigrated (#284).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COPIES = [
    ROOT / 'data' / 'mockup_data_prototype.json',
    ROOT.parent / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 88


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
    departments = {str(d['departmentID']): d for d in tables.get('Departments', [])}
    events = {str(e['eventID']): e for e in tables.get('Events', [])}
    stats = {'processes': 0, 'dept_unit': 0, 'event_unit': 0, 'null': 0}
    for p in tables.get('Processes', []):
        stats['processes'] += 1
        d = departments.get(str(first(p.get('departmentID'))))
        ev = events.get(str(first(p.get('eventID'))))
        unit = first(d.get('businessUnitID')) if d else None
        if unit is not None:
            stats['dept_unit'] += 1
        elif ev is not None and first(ev.get('businessUnitID')) is not None:
            unit = first(ev.get('businessUnitID'))
            stats['event_unit'] += 1
        else:
            stats['null'] += 1
        p['businessUnitID'] = unit
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
