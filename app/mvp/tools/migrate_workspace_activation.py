#!/usr/bin/env python3
"""Deterministic migration: Workspace activation round (2026-08-13, issue #192).

Tickets/Projects restructure backing the MVP Workspace activation:
- Tickets gain the stored businessUnitID anchor (from the ticket's
  customer, first unit) and their snapshot columns are re-seeded from
  the payload chain: processID = the event's process names (events
  without processes keep the prior value), products/scopes = the
  product/scope names of the event's payload product scopes,
  requirementName = the requirements those product scopes derive under
  Q1 AND-semantics across scope / product group / unit / customer
  (the issue #180 customer dimension applies here).
- Projects gain businessUnitID (from the customer) and slaID — the
  customer's SLAs (multivalued).

Deterministic and idempotent: re-running recomputes the same values.
Applies to both mockup copies (prototype/data + sourceFiles/developer).
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


def uniq(seq):
    out = []
    for x in seq:
        if x and x not in out:
            out.append(x)
    return out


def migrate(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    tickets = find_table(data, 'Tickets')
    projects = find_table(data, 'Projects')
    customers = {c['customerID']: c for c in (find_table(data, 'Customers') or [])}
    processes = find_table(data, 'Processes') or []
    payloads = find_table(data, 'Payload') or []
    pss = {p['productScopeID']: p for p in (find_table(data, 'Product Scopes') or [])}
    pgs = {p['productGroupID']: p for p in (find_table(data, 'Product Groups') or [])}
    products = {p['productID']: p for p in (find_table(data, 'Products') or [])}
    scopes = {s['scopeID']: s for s in (find_table(data, 'Scopes') or [])}
    requirements = find_table(data, 'Requirements') or []
    slas = find_table(data, 'SLA') or []
    if tickets is None or projects is None:
        print(f'{path.name}: missing Tickets/Projects — skipped')
        return

    def unit_of_customer(cid):
        units = as_list((customers.get(cid) or {}).get('businessUnitID'))
        return units[0] if units else None

    def payload_product_scopes(event_id):
        out = []
        for p in sorted(payloads, key=lambda p: str(p.get('payloadID'))):
            if p.get('eventID') == event_id:
                out.extend(as_list(p.get('productScopeID')))
        return uniq(out)

    def requirement_names(ps_ids, customer_id):
        names = []
        for r in sorted(requirements, key=lambda r: str(r.get('requirementID'))):
            if as_list(r.get('customerID')) and not overlap(r.get('customerID'), customer_id):
                continue
            for pid in ps_ids:
                ps = pss.get(pid)
                if not ps:
                    continue
                if as_list(r.get('scopeID')) and not overlap(r.get('scopeID'), ps.get('scopeID')):
                    continue
                if as_list(r.get('productGroupID')) and not overlap(r.get('productGroupID'), ps.get('productGroupID')):
                    continue
                if as_list(r.get('businessUnitID')) and not overlap(r.get('businessUnitID'), ps.get('businessUnitID')):
                    continue
                names.append(r.get('requirementName'))
                break
        return uniq(names)

    t_changed = 0
    for t in tickets:
        unit = unit_of_customer(t.get('customerID'))
        ps_ids = payload_product_scopes(t.get('eventID'))
        proc_names = uniq(p.get('processName') for p in processes if p.get('eventID') == t.get('eventID'))
        prod_names = uniq(products.get(as_list(pgs.get(pss[pid].get('productGroupID'), {}).get('productID'))[0], {}).get('productName')
                          for pid in ps_ids if pid in pss and as_list(pgs.get(pss[pid].get('productGroupID'), {}).get('productID')))
        scope_names = uniq(scopes.get(pss[pid].get('scopeID'), {}).get('scopeName') for pid in ps_ids if pid in pss)
        req_names = requirement_names(ps_ids, t.get('customerID'))
        new = {
            'businessUnitID': unit,
            'processID': ', '.join(proc_names) if proc_names else t.get('processID'),
            'products': ', '.join(prod_names) if prod_names else t.get('products'),
            'scopes': ', '.join(scope_names) if scope_names else t.get('scopes'),
            'requirementName': ', '.join(req_names) if req_names else t.get('requirementName'),
        }
        if any(t.get(k) != v for k, v in new.items()):
            t.update(new)
            t_changed += 1

    p_changed = 0
    for p in projects:
        cust = p.get('customerID')
        new = {
            'businessUnitID': unit_of_customer(cust),
            'slaID': [s['slaID'] for s in sorted(slas, key=lambda s: str(s.get('slaID')))
                      if s.get('customerID') == cust],
        }
        if any(p.get(k) != v for k, v in new.items()):
            p.update(new)
            p_changed += 1

    if t_changed or p_changed:
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'{path.name}: Tickets={t_changed}, Projects={p_changed}')


def main():
    for target in TARGETS:
        if target.exists():
            migrate(target)
        else:
            print(f'{target}: not found — skipped')


if __name__ == '__main__':
    sys.exit(main())
