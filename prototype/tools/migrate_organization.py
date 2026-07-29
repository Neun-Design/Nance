#!/usr/bin/env python3
"""migrate_organization.py — deterministic Organization/CRM mockup migration
(2026-07-29 restructure, issue #77; prototype/prototype_v2-review.md §D).

Transforms a mockup_data_prototype.json file in place:
  1. Modules: Customers → CRM (Factories table → Customers); new Organization
     module holding Business Segments / Business Units / Departments and the
     Squads table moved out of Talent.
  2. Record keys: factoryID/Name/Title/Owner → customer* (idempotent — files
     already partially renamed are completed, not double-renamed).
  3. Seeds: Business Segments (LPT/MPT/DT from the retired enum + SG for the
     switch-gear department demo), Business Units, Departments (ids match the
     DPT01-style refs legacy Capacity/Performance rows already carry), Issues
     (former scopeOpportunity enum values as Opportunity + one Risk).
  4. Wiring: Customers.businessUnitID (from the retired businessSegment),
     People.businessUnitID, Squads.departmentID (managerName/Email dropped),
     Scopes.scopeOpportunity → Issue ids, Requirements.customerID ([] =
     applies to all customers, Q1 wildcard) + one customer-scoped demo
     requirement, Workflows.customerID + productScopeID derived from the
     legacy customer/scopes/products fields (legacy keys dropped so the Q1
     rollup derives requirements at runtime).

Usage:  python3 tools/migrate_organization.py <mockup.json> [more.json ...]
"""
import json
import sys
from collections import OrderedDict

KEY_RENAMES = {
    'factoryID': 'customerID', 'factoryName': 'customerName',
    'factoryTitle': 'customerTitle', 'factoryOwner': 'customerOwner',
    # Product Specs took over the retired Product Class registry (2026-07-28
    # refactor); the developer copy still carried the old key
    'productClassID': 'productSpecID',
}

SEGMENTS = [
    ('BS01', 'LPT', 'Large Power Transformers'),
    ('BS02', 'MPT', 'Medium Power Transformers'),
    ('BS03', 'DT', 'Distribution Transformers'),
    ('BS04', 'SG', 'Switch Gear'),
]
UNITS = [  # (id, name, code, segment ids)
    ('BU01', 'Power Transformers', 'PT', ['BS01', 'BS02']),
    ('BU02', 'Distribution Transformers', 'DT', ['BS03']),
    ('BU03', 'Switch Gear', 'SG', ['BS04']),
]
DEPARTMENTS = [  # ids match the DPT01 refs already stored on Capacity/Performance
    ('DPT01', 'Transformer Repairs Engineering', 'TRE', 'BU01'),
    ('DPT02', 'Switch Gear Engineering', 'SGE', 'BU03'),
    ('DPT03', 'Distribution Engineering', 'DE', 'BU02'),
]
SEG_TO_UNIT = {'LPT': 'BU01', 'MPT': 'BU01', 'DT': 'BU02'}
RISK_ISSUE = ('IS90', 'Chronic Rework', 'Risk',
              'Recurring rework on delivered designs detected across tickets')


def rename_record_keys(rows):
    out = []
    for r in rows:
        out.append(OrderedDict((KEY_RENAMES.get(k, k), v) for k, v in r.items()))
    return out


def migrate(path):
    with open(path, encoding='utf-8') as f:
        data = json.load(f, object_pairs_hook=OrderedDict)

    tables = {}   # table name -> (module, rows) for every module section
    for mod, ts in data.items():
        if mod == '_meta' or not isinstance(ts, dict):
            continue
        for tname, rows in ts.items():
            tables[tname] = (mod, rows)

    def rows_of(name):
        return tables[name][1] if name in tables else []

    # ---- 2. record-key renames (idempotent) everywhere ----
    for mod, ts in data.items():
        if mod == '_meta' or not isinstance(ts, dict):
            continue
        for tname in list(ts.keys()):
            ts[tname] = rename_record_keys(ts[tname])
    tables = {t: (m, data[m][t]) for m, ts in data.items()
              if m != '_meta' and isinstance(ts, dict) for t in ts}

    customers = rows_of('Customers') or rows_of('Factories')

    # ---- 3. seeds ----
    seg_rows = [OrderedDict([('businessSegmentID', i), ('businessSegmentName', n),
                             ('businessSegmentDescription', n), ('businessSegmentCode', c)])
                for i, c, n in SEGMENTS]
    unit_rows = [OrderedDict([('businessUnitID', i), ('businessSegmentID', segs),
                              ('businessUnitName', n), ('businessUnitCode', c)])
                 for i, n, c, segs in UNITS]
    dep_rows = [OrderedDict([('departmentID', i), ('businessUnitID', bu),
                             ('departmentName', n), ('departmentCode', c)])
                for i, n, c, bu in DEPARTMENTS]

    opp_values = sorted({s.get('scopeOpportunity') for s in rows_of('Scopes')
                         if isinstance(s.get('scopeOpportunity'), str) and s.get('scopeOpportunity')})
    issue_rows, issue_by_name = [], {}
    for n, name in enumerate(opp_values, start=1):
        iid = f'IS{n:02d}'
        issue_by_name[name] = iid
        issue_rows.append(OrderedDict([('issueID', iid), ('issueName', name),
                                       ('issueDescription', f'{name} opportunity (from the retired scopeOpportunity enum)'),
                                       ('issueType', 'Opportunity')]))
    if not issue_rows:  # already migrated — rebuild the name map from stored ids
        pass
    issue_rows.append(OrderedDict([('issueID', RISK_ISSUE[0]), ('issueName', RISK_ISSUE[1]),
                                   ('issueDescription', RISK_ISSUE[3]), ('issueType', RISK_ISSUE[2])]))

    # ---- 4. wiring ----
    for c in customers:
        seg = c.pop('businessSegment', None)
        c.setdefault('businessUnitID', SEG_TO_UNIT.get(seg, 'BU01'))

    for p in rows_of('People'):
        p.setdefault('businessUnitID', 'BU01')  # current dataset is the transformer-repairs org

    squads = rows_of('Squads')
    for s in squads:
        s.pop('managerName', None)
        s.pop('managerEmail', None)
        s.setdefault('departmentID', 'DPT01')

    for s in rows_of('Scopes'):
        v = s.get('scopeOpportunity')
        if isinstance(v, str) and v in issue_by_name:
            s['scopeOpportunity'] = issue_by_name[v]

    cust_by_name = {c.get('customerName'): c.get('customerID') for c in customers}
    reqs = rows_of('Requirements')
    for r in reqs:
        r.setdefault('customerID', [])  # empty = applies to all customers (Q1)
    if reqs and not any(r.get('requirementID') == 'CN9' for r in reqs):
        de_cust = next((c['customerID'] for c in customers
                        if c.get('country') == 'Germany'), None)
        reqs.append(OrderedDict([
            ('requirementID', 'CN9'), ('requirementName', 'Grid Code DE Compliance'),
            ('requirementDescription', 'German grid-connection rules for transformer repairs delivered to DE sites'),
            ('requirementTypeID', reqs[0].get('requirementTypeID', 'RT1')),
            ('scopeID', ['A.1', 'A.2']), ('productGroupID', ['PG01']),
            ('customerID', [de_cust] if de_cust else []),
            ('isActive', True), ('regulatoryReference', 'VDE-AR-N 4130'),
            ('requirementOwner', 'U01'),
        ]))

    pgs = rows_of('Product Groups')
    pss = rows_of('Product Scopes')
    pgs_by_product = {}
    for g in pgs:
        prods = g.get('productID')
        for p in (prods if isinstance(prods, list) else [prods]):
            if p:
                pgs_by_product.setdefault(p, []).append(g.get('productGroupID'))
    for w in rows_of('Workflows'):
        cust = w.pop('customer', None)
        prod = w.pop('products', None)
        w.pop('workflowOwner', None)
        w.pop('requirements', None)  # derived by the Q1 rollup at runtime
        cid = cust_by_name.get(cust) or (cust if cust in {c.get('customerID') for c in customers} else None)
        w.setdefault('customerID', [cid] if cid else [])
        if 'productScopeID' not in w:
            # prefer the exact scope + product-group product scope; fall back
            # to every product scope of the workflow's scope (the legacy data
            # rarely has the exact pair registered)
            scope = w.get('scopes')
            groups = set(pgs_by_product.get(prod, []))
            exact = [ps['productScopeID'] for ps in pss
                     if scope and ps.get('scopeID') == scope
                     and groups and ps.get('productGroupID') in groups]
            by_scope = [ps['productScopeID'] for ps in pss
                        if scope and ps.get('scopeID') == scope]
            w['productScopeID'] = exact or by_scope

    # ---- 1. module restructure ----
    def take(name):
        if name in tables:
            mod = tables[name][0]
            return data[mod].pop(name)
        return None

    cust_rows = take('Customers') or take('Factories') or []
    forecasts = take('Forecasts') or []
    fscopes = take('Forecast Scopes') or []
    squad_rows = take('Squads') or squads

    out = OrderedDict()
    if '_meta' in data:
        data['_meta']['note3'] = ('2026-07-29 Organization/CRM migration: CRM module '
                                  '(Factories -> Customers), Organization module with Business '
                                  'Segments/Units, Departments and Squads, Issues registry, '
                                  'customer wiring on Requirements/Workflows.')
        out['_meta'] = data['_meta']
    out['Organization'] = OrderedDict([
        ('Business Segments', seg_rows), ('Business Units', unit_rows),
        ('Departments', dep_rows), ('Squads', squad_rows),
    ])
    out['CRM'] = OrderedDict([('Customers', cust_rows), ('Forecasts', forecasts),
                              ('Forecast Scopes', fscopes)])
    if 'Portfolio' in data and 'Issues' not in data['Portfolio']:
        data['Portfolio']['Issues'] = issue_rows
    for mod, ts in data.items():
        if mod == '_meta' or mod in ('Customers', 'CRM', 'Organization'):
            continue
        if isinstance(ts, dict) and ts:
            out[mod] = ts

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write('\n')
    counts = {t: len(r) for m in out for t, r in (out[m].items() if isinstance(out[m], dict) else []) if m != '_meta'}
    print(f'{path}: migrated — ' + ', '.join(f'{t}={n}' for t, n in list(counts.items())[:8]) + ' …')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for p in sys.argv[1:]:
        migrate(p)
