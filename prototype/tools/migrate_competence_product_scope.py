#!/usr/bin/env python3
"""Deterministic migration: Competence certifies a Product Scope (2026-08-05).

Issue #159 follow-up: the Competence form drops the separate Scope / Product
Group selects — the pair lives in ONE key, the certified Product Scope
(offered from the selected process's list). Data side:

  Competence      productScopeID = the Product Scope matching the row's legacy
                  (scopeID, productGroupID) pair; the legacy keys are dropped
                  (they now derive from the product scope).
  Product Scopes  pairs certified by a competence but missing from the
                  registry are CREATED (PS11…), lossless: scope + product
                  group come from the competence, businessUnitID from the
                  product group's products, name/registry/segment follow the
                  existing row conventions.

Idempotent: rows already carrying productScopeID are left untouched.
Applies to every mockup copy that carries the tables.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]


def find_module(data, table):
    for mod, tables in data.items():
        if isinstance(tables, dict) and table in tables:
            return mod
    return None


def as_list(v):
    return v if isinstance(v, list) else [] if v in (None, '') else [v]


def migrate(path):
    data = json.loads(path.read_text())
    tal = find_module(data, 'Competence')
    pf = find_module(data, 'Product Scopes')
    org = find_module(data, 'Business Segments')
    if not tal or not pf:
        print(f'{path.name}: tables missing — skipped')
        return
    comps = data[tal]['Competence']
    pss = data[pf]['Product Scopes']
    pgs = {r['productGroupID']: r for r in data[pf].get('Product Groups', [])}
    prods = {r['productID']: r for r in data[pf].get('Products', [])}
    seg_code = {}
    units = {u['businessUnitID']: u for u in data.get(org, {}).get('Business Units', [])}
    for sgm in data.get(org, {}).get('Business Segments', []):
        seg_code[sgm['businessSegmentID']] = sgm.get('businessSegmentCode')
    scopes = {r['scopeID']: r for r in data[pf].get('Scopes', [])}

    def unit_of_pg(pgid):
        pg = pgs.get(pgid) or {}
        for pid in as_list(pg.get('productID')):
            for u in as_list((prods.get(pid) or {}).get('businessUnitID')):
                return u
        return None

    def find_ps(scope, pgid):
        for ps in pss:
            if str(ps.get('productGroupID')) == str(pgid) and scope in as_list(ps.get('scopeID')) + [ps.get('scopeID')]:
                return ps['productScopeID']
        return None

    created, linked = [], 0
    for comp in comps:
        if comp.get('productScopeID'):
            comp.pop('scopeID', None)
            comp.pop('productGroupID', None)
            continue
        scope, pgid = comp.pop('scopeID', None), comp.pop('productGroupID', None)
        if scope is None or pgid is None:
            comp['productScopeID'] = None
            continue
        psid = find_ps(scope, pgid)
        if psid is None:
            n = len(pss) + 1
            psid = f'PS{n:02d}'
            unit = unit_of_pg(pgid)
            pg = pgs.get(pgid) or {}
            seg = None
            for s in as_list((units.get(unit) or {}).get('businessSegmentID')):
                seg = seg_code.get(s)
                break
            pss.append({
                'productScopeID': psid,
                'productScopeRegistry': f'PSR-{n:04d}',
                'productGroupID': pgid,
                'scopeID': scope,
                'productScopeName': f"{pg.get('productGroupName', pgid)} · {(scopes.get(scope) or {}).get('scopeName', scope)}",
                'businessSegment': seg,
                'isActive': True,
                'createdAt': '2026-08-05',
                'productScopeOwner': pg.get('productGroupOwner') or comp.get('competenceOwner'),
                'businessUnitID': unit,
            })
            created.append(psid)
        comp['productScopeID'] = psid
        linked += 1

    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    note = f'; created {created}' if created else ''
    print(f'{path.name}: {linked} competence(s) linked{note}')


for target in TARGETS:
    if target.exists():
        migrate(target)
