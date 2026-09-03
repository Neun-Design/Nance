#!/usr/bin/env python3
"""2026-09-03 round (schemaVersion 68): SLA supplier flow + Payload department.

1. Customers.customerType relabel: 'Internal Client' -> 'Internal',
   'External Client' -> 'External', 'Supplier' -> 'External' (session
   decision: the dedicated Supplier type leaves the enum; the three clinic
   supplier companies are external firms — supplierID FKs preserved).
2. Payload.departmentID (new stored FK -> Departments): the department that
   supplies the payload, derived from the event's processes (Processes store
   eventID + departmentID since issue #159) — first non-empty department in
   row order; honest null when the event chains no process. Every row gains
   the key (absent key = parity failure).
3. SLA alignment (form-integrity posture, issues #281/#290): departmentID is
   re-keyed to the MAJORITY derived department of the SLA's purchased
   payloads (first-seen tiebreak; no derivable department = keep current),
   and the supplier's businessUnitID is unioned with the department's unit so
   the "Supplier Department" picker (departments of the supplier's units)
   keeps offering the seeded value on edit. Payload sets stay INTACT — the
   ticket chains read the stored payloadID; the edit-time narrowing of the
   Payloads picker to the chosen department is the accepted #290 trap.

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
RELABEL = {'Internal Client': 'Internal', 'External Client': 'External',
           'Supplier': 'External'}
SCHEMA_VERSION = 68


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


def payload_departments(tables):
    """payloadID -> supplying department: first non-empty departmentID among
    the processes chaining the payload's event, in Processes row order."""
    by_event = {}
    for p in tables.get('Processes', []):
        for ev in as_list(p.get('eventID')):
            by_event.setdefault(str(ev), []).append(p.get('departmentID'))
    out = {}
    for pl in tables.get('Payload', []):
        depts = [d for d in by_event.get(str(pl.get('eventID')), []) if d]
        out[pl['payloadID']] = depts[0] if depts else None
    return out


def majority_first_seen(values):
    counts, order = {}, []
    for v in values:
        if v not in counts:
            order.append(v)
        counts[v] = counts.get(v, 0) + 1
    return max(order, key=lambda v: counts[v], default=None)


def migrate(path):
    raw = path.read_text(encoding='utf-8')
    mock = json.loads(raw)
    tables = tables_of(mock)
    stats = {'relabelled': 0, 'payloads_keyed': 0, 'payloads_null': 0,
             'slas_rekeyed': 0, 'supplier_units_unioned': 0}

    for c in tables.get('Customers', []):
        t = c.get('customerType')
        if t in RELABEL:
            c['customerType'] = RELABEL[t]
            stats['relabelled'] += 1

    pdept = payload_departments(tables)
    for pl in tables.get('Payload', []):
        pl['departmentID'] = pdept.get(pl['payloadID'])
        stats['payloads_keyed' if pl['departmentID'] else 'payloads_null'] += 1

    cust_by_id = {c['customerID']: c for c in tables.get('Customers', [])}
    dept_unit = {d['departmentID']: d.get('businessUnitID')
                 for d in tables.get('Departments', [])}
    for s in tables.get('SLA', []):
        depts = [pdept.get(pid) for pid in as_list(s.get('payloadID'))]
        pick = majority_first_seen([d for d in depts if d])
        if pick and pick != s.get('departmentID'):
            s['departmentID'] = pick
            stats['slas_rekeyed'] += 1
        sup = cust_by_id.get(s.get('supplierID'))
        du = dept_unit.get(s.get('departmentID'))
        if sup and du:
            units = sup.get('businessUnitID')
            units = units if isinstance(units, list) else [units]
            if du not in units:
                units.append(du)
                sup['businessUnitID'] = units
                stats['supplier_units_unioned'] += 1

    mock.setdefault('_meta', {})['schemaVersion'] = SCHEMA_VERSION
    path.write_text(json.dumps(mock, indent=1, ensure_ascii=False)
                    + ('\n' if raw.endswith('\n') else ''), encoding='utf-8')
    return stats


def main():
    for path in COPIES:
        if not path.exists():
            print(f'skip (missing): {path}')
            continue
        stats = migrate(path)
        print(f'{path.name}: {stats}')


if __name__ == '__main__':
    sys.exit(main())
