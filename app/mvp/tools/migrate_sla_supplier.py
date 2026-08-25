#!/usr/bin/env python3
"""Deterministic migration: the SLA supplying party (issue #272).

1. Supplier customers — clinic (Vitalis) dataset only: three Supplier-type
   customers appended after the existing rows, replicating the seed
   builder's spec order and unit modulo (build_customers_branches — the
   clinic.yaml `suppliers` group), so a regenerated dataset and a migrated
   one agree on names/units. Owner = the first unit's quality manager.
2. `SLA.supplierID` seeded (NOT NULL) by the shared deterministic rule
   (mirrors Builder._sla_supplier in tools/seed/build_seed.py): an
   Internal Client customer is supplied by the first OTHER Internal Client
   of the SLA's unit; everyone else by the unit's Supplier-type customer
   (fallbacks: any Supplier → the unit's Internal Client → any other
   customer) — the chain keeps the rule total on the legacy copy, where
   every customer is an Internal Client and no Supplier exists.
3. `Tickets.supplierID` keyed on EVERY row (nullable — schema parity):
   None when index % 3 == 0 (the visible wildcard cohort, #243 mix
   posture); otherwise the supplier of the customer's lowest-slaID ACTIVE
   SLA whose payloads cover the ticket's event (fallback: the customer's
   lowest-slaID active SLA, else None).
4. `_meta.schemaVersion` stamped to 50 on the copy that carries it.

Idempotent: existing Supplier customers, non-blank SLA suppliers and
already-keyed tickets are recognised and skipped.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]

# clinic.yaml `customers.suppliers` — same names, same order (the builder's
# unit modulo lands them on BU03/BU04/BU01)
SUPPLIER_NAMES = [
    'ClinLab Reagents & Diagnostics',
    'HomeCare Medical Equipment',
    'Contrast & Radiopharma Supply Co.',
]


def find_table(data, name):
    for tables in data.values():
        if isinstance(tables, dict) and name in tables:
            return tables[name]
    return None


def as_list(v):
    if isinstance(v, list):
        return [x for x in v if x not in (None, '')]
    return [v] if v not in (None, '') else []


def blank(v):
    return v is None or v == '' or (isinstance(v, list) and not v)


def sla_supplier(customers, cust_id, unit):
    """Shared deterministic rule — mirrors Builder._sla_supplier."""
    def by_type(t):
        return sorted((c for c in customers if c.get('customerType') == t),
                      key=lambda c: str(c.get('customerID')))
    cust = next((c for c in customers if c.get('customerID') == cust_id), None)
    internals, sups = by_type('Internal Client'), by_type('Supplier')
    if cust and cust.get('customerType') == 'Internal Client':
        for c in internals:
            if c.get('customerID') != cust_id and unit in as_list(c.get('businessUnitID')):
                return c.get('customerID')
    for pool in (
        [c for c in sups if unit in as_list(c.get('businessUnitID'))],
        sups,
        [c for c in internals if unit in as_list(c.get('businessUnitID'))],
        [c for c in sorted(customers, key=lambda c: str(c.get('customerID')))
         if c.get('customerID') != cust_id],
    ):
        if pool:
            return pool[0].get('customerID')
    return None


def migrate(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    customers = find_table(data, 'Customers')
    slas = find_table(data, 'SLA')
    if customers is None or slas is None:
        print(f'{path.name}: no Customers/SLA tables — skipped')
        return

    meta = data.get('_meta') or {}
    units = find_table(data, 'Business Units') or []
    qm_by_unit = {u.get('businessUnitID'): u.get('qualityManager') for u in units}

    # 1. Supplier customers (clinic dataset only; skip if any already exist)
    created = 0
    if meta.get('domain') == 'clinic' and units \
            and not any(c.get('customerType') == 'Supplier' for c in customers):
        seg_of = {u.get('businessUnitID'): u.get('businessSegmentID') for u in units}
        unit_ids = [u.get('businessUnitID') for u in units]
        base = len(customers)
        for k, name in enumerate(SUPPLIER_NAMES):
            i = base + k
            cust_units = [unit_ids[i % len(unit_ids)]]
            if i % 3 == 0:
                cust_units.append(unit_ids[(i + 1) % len(unit_ids)])
            segs = sorted({seg_of[u] for u in cust_units if seg_of.get(u)})
            customers.append({
                'customerID': f'CUST{i+1:02d}', 'customerName': name,
                'businessSegmentID': segs, 'businessUnitID': cust_units,
                'customerType': 'Supplier', 'isActive': 'Active',
                'customerOwner': qm_by_unit.get(cust_units[0]),
            })
            created += 1

    # 2. SLA supplying party
    seeded = 0
    for s in slas:
        if not blank(s.get('supplierID')):
            continue
        sup = sla_supplier(customers, s.get('customerID'), s.get('businessUnitID'))
        if sup is not None:
            s['supplierID'] = sup
            seeded += 1

    # 3. Ticket supplier key (nullable, parity on every row)
    payloads = {p.get('payloadID'): p for p in (find_table(data, 'Payload') or [])}
    active = sorted((s for s in slas
                     if str(s.get('isActive') or 'Active') != 'Inactive'),
                    key=lambda s: str(s.get('slaID')))
    keyed = linked = 0
    for i, t in enumerate(find_table(data, 'Tickets') or []):
        if 'supplierID' in t:
            continue
        sup = None
        if i % 3 != 0:
            mine = [s for s in active
                    if t.get('customerID') in as_list(s.get('customerID'))]
            covering = [s for s in mine
                        if any(str((payloads.get(pid) or {}).get('eventID'))
                               == str(t.get('eventID'))
                               for pid in as_list(s.get('payloadID')))]
            gov = (covering or mine or [None])[0]
            sup = gov.get('supplierID') if gov else None
        t['supplierID'] = sup
        keyed += 1
        if sup is not None:
            linked += 1

    stamped = 0
    if 'schemaVersion' in meta and meta['schemaVersion'] < 50:
        meta['schemaVersion'] = 50
        stamped = 1

    if created or seeded or keyed or stamped:
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n',
                        encoding='utf-8')
        print(f'{path.name}: suppliers created={created}, sla seeded={seeded}, '
              f'tickets keyed={keyed} (linked={linked}), version stamped={stamped}')
    else:
        print(f'{path.name}: no changes')


def main():
    for target in TARGETS:
        if target.exists():
            migrate(target)
        else:
            print(f'{target}: not found — skipped')


if __name__ == '__main__':
    sys.exit(main())
