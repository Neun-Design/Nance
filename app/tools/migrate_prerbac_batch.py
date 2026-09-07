#!/usr/bin/env python3
"""Pre-RBAC filter batch (issue #346, schemaVersion 87).

One round covers the remaining pre-RBAC filter inputs (#334 doctrine;
#340/#342/#344 precedents) — five new stored `businessUnitID` filter FKs:

  Jobs            = the ticket's unit (census 240/240 == project's unit)
  Forecasts       = the SLA's unit
  Forecast Scopes = the forecast's SLA's unit
  Competence      = the function's (first) unit
  Squads          = the department's unit

Onboarding needed no key (already stored + coherent 60/60) — only the
form gained the field. Product Specs LEFT the batch (census: 8/8 specs
span products of multiple units — a unit filter would orphan stored
picks on every row; spec definitions are cross-unit by design).

Every rule keys the unit from the row's own chain, so every seeded pair
survives its picker (#281/#344 form-integrity method). Same rules in the
seed builder (build_seed.py) — regenerated ≡ migrated. Runs on both
mockup copies; frozen transformers testdata stays unmigrated (#284).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COPIES = [
    ROOT / 'data' / 'mockup_data_prototype.json',
    ROOT.parent / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 87


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
    by = {name: {str(r[pk]): r for r in tables.get(name, [])}
          for name, pk in (('Tickets', 'ticketID'), ('Projects', 'projectID'),
                           ('SLA', 'slaID'), ('Forecasts', 'forecastID'),
                           ('Functions', 'functionID'), ('Departments', 'departmentID'))}
    stats = {}

    def unit_of(table, rid):
        row = by[table].get(str(rid)) if rid is not None else None
        return first(row.get('businessUnitID')) if row else None

    def seed(tname, rule):
        n = keyed = 0
        for r in tables.get(tname, []):
            n += 1
            r['businessUnitID'] = rule(r)
            if r['businessUnitID'] is not None:
                keyed += 1
        stats[tname] = f'{keyed}/{n}'

    seed('Jobs', lambda j: unit_of('Tickets', j.get('ticketID'))
         or unit_of('Projects', j.get('projectID')))
    seed('Forecasts', lambda f: unit_of('SLA', f.get('slaID')))

    def fs_unit(fs):
        fc = by['Forecasts'].get(str(fs.get('forecastID')))
        return unit_of('SLA', fc.get('slaID')) if fc else None
    seed('Forecast Scopes', fs_unit)
    seed('Competence', lambda c: unit_of('Functions', c.get('functionID')))
    seed('Squads', lambda s: unit_of('Departments', s.get('departmentID')))

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
