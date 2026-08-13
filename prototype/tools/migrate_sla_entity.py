#!/usr/bin/env python3
"""Deterministic migration: SLA entity seed (2026-08-13, issue #179).

Creates the CRM.SLA table rows: one SLA per Customer — the contract by
which the customer purchases the Payloads of its (first) business unit
from that unit's department. branchID takes the customer's first branch
(nullable — a customer may have no branch); slaOwner seeds from the
unit's quality manager (ISO §5.3), falling back to the customer's owner.
Customers whose unit has no department are skipped (departmentID is a
NOT NULL anchor).

Idempotent: a mockup copy that already carries a non-empty SLA table is
untouched. Applies to both mockup copies (prototype/data +
sourceFiles/developer).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]


def find_table(data, name):
    for tables in data.values():
        if isinstance(tables, dict) and name in tables:
            return tables[name]
    return None


def as_list(v):
    if isinstance(v, list):
        return v
    return [] if v in (None, '') else [v]


def migrate(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    crm = data.get('CRM')
    customers = find_table(data, 'Customers')
    departments = find_table(data, 'Departments') or []
    branches = find_table(data, 'Branches') or []
    payloads = find_table(data, 'Payload') or []
    units = {u['businessUnitID']: u for u in (find_table(data, 'Business Units') or [])}
    if crm is None or customers is None:
        print(f'{path.name}: missing CRM/Customers — skipped')
        return
    if crm.get('SLA'):
        print(f'{path.name}: SLA table already seeded — skipped')
        return
    dep_by_unit = {}
    for d in sorted(departments, key=lambda d: str(d.get('departmentID'))):
        dep_by_unit.setdefault(d.get('businessUnitID'), d['departmentID'])
    branch_by_customer = {}
    for b in sorted(branches, key=lambda b: str(b.get('branchID'))):
        branch_by_customer.setdefault(b.get('customerID'), b['branchID'])
    rows, skipped = [], 0
    for cust in sorted(customers, key=lambda c: str(c.get('customerID'))):
        unit_ids = as_list(cust.get('businessUnitID'))
        unit = unit_ids[0] if unit_ids else None
        department = dep_by_unit.get(unit)
        if unit is None or department is None:
            skipped += 1
            continue
        i = len(rows) + 1
        rows.append({
            'slaID': f'SLA{i:02d}',
            'slaCode': f'SLA-{i:04d}',
            'businessUnitID': unit,
            'customerID': cust['customerID'],
            'branchID': branch_by_customer.get(cust['customerID']),
            'departmentID': department,
            'payloadID': [p['payloadID'] for p in sorted(payloads, key=lambda p: str(p.get('payloadID')))
                          if p.get('businessUnitID') == unit],
            'isActive': 'Active',
            'slaOwner': (units.get(unit) or {}).get('qualityManager') or cust.get('customerOwner') or 'U01',
        })
    crm['SLA'] = rows
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    note = f'{path.name}: SLA={len(rows)}'
    print(note + (f' (skipped {skipped} customers with no unit department)' if skipped else ''))


def main():
    for target in TARGETS:
        if target.exists():
            migrate(target)
        else:
            print(f'{target}: not found — skipped')


if __name__ == '__main__':
    sys.exit(main())
