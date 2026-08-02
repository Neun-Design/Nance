#!/usr/bin/env python3
"""Deterministic migration: businessUnitID propagation + managers (2026-07-30).

Seeds the fields added by the datamodel update, deriving everything from
existing links (nothing is invented):

  Business Units   qualityManager / operationalManager — first two active
                   People of the unit, ordered by userID
  Departments      departmentManager — first person (by userID) whose squad
                   belongs to the department
  Customers        businessSegmentID — the segment list of the customer's
                   Business Unit (Segment became user-selected, Q4 reversal)
  Events           businessUnitID — via customerName -> Customers
  Products         businessUnitID — via the product's groups' businessSegment
  Product Scopes   businessUnitID — via the row's businessSegment code
  Scopes           businessUnitID — union over Product Scopes using the scope
  Issues           businessUnitID — union over Scopes tagged with the issue
  Functions        businessUnitID — union over People holding the function

Schema alignment (same datamodel update): drops the removed
Handouts.handoutOwner attribute and materialises the new stored keys as
null/[] where nothing is derivable, so every row carries its stored attrs.

Idempotent: fields already present and non-empty are left untouched.
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
        if isinstance(tables, dict) and name in tables and isinstance(tables[name], list):
            return tables[name]
    return None


def blank(v):
    return v is None or v == '' or v == []


def as_list(v):
    if blank(v):
        return []
    return v if isinstance(v, list) else [v]


def migrate(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    t = {name: find_table(data, name) or [] for name in (
        'Business Segments', 'Business Units', 'Departments', 'Squads',
        'Customers', 'Events', 'Products', 'Product Groups', 'Product Scopes',
        'Scopes', 'Issues', 'Functions', 'People')}
    if not t['Business Units']:
        print(f'{path.name}: no Business Units table — skipped')
        return

    # segment code ("LPT") -> segment id -> owning Business Unit id
    seg_by_code = {s['businessSegmentCode']: s['businessSegmentID']
                   for s in t['Business Segments'] if s.get('businessSegmentCode')}
    bu_by_seg = {}
    for bu in t['Business Units']:
        for seg in as_list(bu.get('businessSegmentID')):
            bu_by_seg.setdefault(seg, bu['businessUnitID'])
    bu_by_code = {code: bu_by_seg[seg] for code, seg in seg_by_code.items() if seg in bu_by_seg}

    changed = {}

    def seed(row, field, value, table):
        if blank(value) or not blank(row.get(field)):
            return
        row[field] = value
        changed[table] = changed.get(table, 0) + 1

    # ---- Business Units: quality / operational managers ----
    people_by_bu = {}
    for p in sorted(t['People'], key=lambda x: str(x.get('userID', ''))):
        if p.get('isActive') is False:
            continue
        for bu in as_list(p.get('businessUnitID')):
            people_by_bu.setdefault(bu, []).append(p['userID'])
    for bu in t['Business Units']:
        pool = people_by_bu.get(bu['businessUnitID'], [])
        seed(bu, 'qualityManager', pool[0] if pool else None, 'Business Units')
        seed(bu, 'operationalManager', pool[1] if len(pool) > 1 else (pool[0] if pool else None),
             'Business Units')

    # ---- Departments: manager = first person in one of the department's squads ----
    squads_by_dept = {}
    for sq in t['Squads']:
        if sq.get('departmentID'):
            squads_by_dept.setdefault(sq['departmentID'], set()).add(sq['squadID'])
    for dep in t['Departments']:
        squad_ids = squads_by_dept.get(dep['departmentID'], set())
        pick = next((p['userID'] for p in sorted(t['People'], key=lambda x: str(x.get('userID', '')))
                     if p.get('squadID') in squad_ids), None)
        seed(dep, 'departmentManager', pick, 'Departments')

    # ---- Customers: segment list of the customer's unit (now user-editable) ----
    bu_segments = {bu['businessUnitID']: as_list(bu.get('businessSegmentID'))
                   for bu in t['Business Units']}
    cust_bu = {}
    for c in t['Customers']:
        units = as_list(c.get('businessUnitID'))
        cust_bu[c.get('customerName')] = units[0] if units else None
        segs = sorted({s for u in units for s in bu_segments.get(u, [])})
        seed(c, 'businessSegmentID', segs, 'Customers')

    # ---- Events: unit of the named customer ----
    for e in t['Events']:
        seed(e, 'businessUnitID', cust_bu.get(e.get('customerName')), 'Events')

    # ---- Products: units of the product's groups (via businessSegment code) ----
    prod_bus = {}
    for pg in t['Product Groups']:
        bu = bu_by_code.get(pg.get('businessSegment'))
        if not bu:
            continue
        for pid in as_list(pg.get('productID')):
            prod_bus.setdefault(pid, set()).add(bu)
    for p in t['Products']:
        seed(p, 'businessUnitID', sorted(prod_bus.get(p['productID'], set())), 'Products')

    # ---- Product Scopes: unit of the row's segment code ----
    for ps in t['Product Scopes']:
        seed(ps, 'businessUnitID', bu_by_code.get(ps.get('businessSegment')), 'Product Scopes')

    # ---- Scopes: union over Product Scopes using the scope ----
    scope_bus = {}
    for ps in t['Product Scopes']:
        bu = ps.get('businessUnitID') or bu_by_code.get(ps.get('businessSegment'))
        if not bu:
            continue
        for sid in as_list(ps.get('scopeID')):
            scope_bus.setdefault(sid, set()).add(bu)
    for s in t['Scopes']:
        seed(s, 'businessUnitID', sorted(scope_bus.get(s['scopeID'], set())), 'Scopes')

    # ---- Issues: union over Scopes tagged with the issue ----
    issue_bus = {}
    for s in t['Scopes']:
        for iid in as_list(s.get('scopeOpportunity')):
            issue_bus.setdefault(iid, set()).update(as_list(s.get('businessUnitID')))
    for i in t['Issues']:
        seed(i, 'businessUnitID', sorted(issue_bus.get(i['issueID'], set())), 'Issues')

    # ---- Functions: union over People holding the function ----
    func_bus = {}
    for p in t['People']:
        if p.get('functionID'):
            func_bus.setdefault(p['functionID'], set()).update(as_list(p.get('businessUnitID')))
    for f in t['Functions']:
        seed(f, 'businessUnitID', sorted(func_bus.get(f['functionID'], set())), 'Functions')

    # ---- schema alignment: removed attr + presence of the new stored keys ----
    handouts = find_table(data, 'Handouts') or []
    for h in handouts:
        if 'handoutOwner' in h:
            del h['handoutOwner']
            changed['Handouts cleanup'] = changed.get('Handouts cleanup', 0) + 1
    ensure = [
        (t['Business Units'], ('qualityManager', None)),
        (t['Business Units'], ('operationalManager', None)),
        (t['Departments'], ('departmentManager', None)),
        (t['Events'], ('businessUnitID', None)),
        (t['Products'], ('businessUnitID', [])),
        (t['Product Scopes'], ('businessUnitID', None)),
        (t['Scopes'], ('businessUnitID', [])),
        (t['Issues'], ('businessUnitID', [])),
        (t['Functions'], ('businessUnitID', [])),
        (t['Customers'], ('businessSegmentID', [])),
        (find_table(data, 'Tasks') or [], ('taskInput', [])),
        (find_table(data, 'Tasks') or [], ('taskOutput', [])),
    ]
    for rows, (field, default) in ensure:
        for row in rows:
            if field not in row:
                row[field] = default
                changed['key presence'] = changed.get('key presence', 0) + 1

    if changed:
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'{path.name}: ' + (', '.join(f'{k}={v}' for k, v in changed.items()) or 'no changes'))


def main():
    for target in TARGETS:
        if target.exists():
            migrate(target)
        else:
            print(f'{target}: not found — skipped')


if __name__ == '__main__':
    sys.exit(main())
