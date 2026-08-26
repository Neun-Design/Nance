#!/usr/bin/env python3
"""Deterministic migration: Ticket Supplier Decision (issue #281).

The Tickets form Supplier select is re-sourced: instead of the customer's
active-SLA suppliers (#272), it offers the UNIT's customers grouped by
customerType, filtered by the Business Unit select (generic stored-key
cascade on `Customers.businessUnitID`). For every seeded (unit, supplier)
pair to survive the new filter — the cascade keeps an edit-mode value only
while it stays among the options, else the stored FK is wiped on save (the
form-integrity trap) — a supplier serving a unit's contracts must serve
that unit: this migration UNIONs each supplying customer's
`businessUnitID` with the units of the SLAs it supplies and (safety net)
the units of the tickets that declare it. The same rule runs in the seed
builder (build_seed.py), so a regenerated dataset and a migrated one agree.

In the frozen clinic dataset this touches exactly one customer: ClinLab
(CUST19, BU03/BU04) gains BU02 — the unit whose 4 contracts it supplies
through the #272 total fallback (BU02 drew no Supplier-type customer in
the `i % 4` rotation). The developer copy is already consistent (no-op).

Targets both mockup copies; `_meta.schemaVersion` stamped to 56 on the
copy that carries it. Idempotent: unions only append missing units.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 56


def find_table(doc, name):
    for tables in doc.values():
        if isinstance(tables, dict) and name in tables:
            return tables[name]
    return None


def as_list(v):
    if v is None or v == '':
        return []
    return v if isinstance(v, list) else [v]


def migrate(path):
    raw = path.read_text(encoding='utf-8')
    doc = json.loads(raw)
    customers = find_table(doc, 'Customers') or []
    by_id = {str(c.get('customerID')): c for c in customers}

    def union_unit(sup_id, unit):
        sup = by_id.get(str(sup_id)) if sup_id not in (None, '') else None
        if sup is None or unit in (None, ''):
            return 0
        units = as_list(sup.get('businessUnitID'))
        if unit in units:
            return 0
        sup['businessUnitID'] = units + [unit]
        by_id[str(sup_id)] = sup
        return 1

    touched = 0
    for s in find_table(doc, 'SLA') or []:
        touched += union_unit(s.get('supplierID'), s.get('businessUnitID'))
    for t in find_table(doc, 'Tickets') or []:
        touched += union_unit(t.get('supplierID'), t.get('businessUnitID'))

    meta = doc.get('_meta')
    if isinstance(meta, dict) and 'schemaVersion' in meta:
        meta['schemaVersion'] = SCHEMA_VERSION

    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False)
                    + ('\n' if raw.endswith('\n') else ''), encoding='utf-8')
    print(f'{path.name}: {touched} supplier unit(s) unioned')


if __name__ == '__main__':
    for target in TARGETS:
        migrate(target)
