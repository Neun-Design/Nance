#!/usr/bin/env python3
"""Deterministic migration: Payload entity seed (2026-08-13, issue #190).

Creates the Operation.Payload table rows: one payload per Event, packaging
the product scopes the event's applicability admits (scopeID × productID,
each empty = all — Q1 wildcard), narrowed to the event's business unit
(form parity with productScopesForPayload in forms.js). payloadOwner seeds
from the event's owner (Broker role, ISO §5.3).

Idempotent: a mockup copy that already carries a non-empty Payload table
is untouched. Applies to both mockup copies (prototype/data +
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


def overlap(a, b):
    A, B = as_list(a), as_list(b)
    return bool(A) and bool(B) and any(x in B for x in A)


def admissible_product_scopes(event, product_scopes, pg_by_id):
    """Mirror of forms.js productScopesForPayload: event applicability
    (empty keys = all) AND the event's business unit."""
    scopes = as_list(event.get('scopeID'))
    products = as_list(event.get('productID'))
    out = []
    for ps in product_scopes:
        if scopes and not overlap(ps.get('scopeID'), scopes):
            continue
        if products:
            pg = pg_by_id.get(ps.get('productGroupID'))
            if not pg or not overlap(pg.get('productID'), products):
                continue
        if event.get('businessUnitID') and not overlap(ps.get('businessUnitID'), event.get('businessUnitID')):
            continue
        out.append(ps['productScopeID'])
    return out


def migrate(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    operation = data.get('Operation')
    events = find_table(data, 'Events')
    product_scopes = find_table(data, 'Product Scopes')
    product_groups = find_table(data, 'Product Groups')
    if operation is None or events is None or product_scopes is None:
        print(f'{path.name}: missing Operation/Events/Product Scopes — skipped')
        return
    if operation.get('Payload'):
        print(f'{path.name}: Payload table already seeded — skipped')
        return
    pg_by_id = {pg['productGroupID']: pg for pg in (product_groups or [])}
    rows = []
    for i, ev in enumerate(sorted(events, key=lambda e: str(e.get('eventID'))), start=1):
        rows.append({
            'payloadID': f'PLD{i:02d}',
            'payloadCode': f'PLC-{i:04d}',
            'businessUnitID': ev.get('businessUnitID'),
            'eventID': ev.get('eventID'),
            'productScopeID': admissible_product_scopes(ev, product_scopes, pg_by_id),
            'isActive': 'Active',
            'payloadOwner': ev.get('eventOwner') or 'U01',
        })
    operation['Payload'] = rows
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'{path.name}: Payload={len(rows)}')


def main():
    for target in TARGETS:
        if target.exists():
            migrate(target)
        else:
            print(f'{target}: not found — skipped')


if __name__ == '__main__':
    sys.exit(main())
