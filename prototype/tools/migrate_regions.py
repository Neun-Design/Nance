#!/usr/bin/env python3
"""Deterministic migration: Regions entity + requirements applicability (2026-07-30).

Implements the data side of prototype/requirements-model.md and the same-day
datamodel edits. Everything derives from existing values:

  Regions        new Organization table — one row per distinct legacy
                 Customers.region value (RG01…, sorted case-insensitively);
                 regionOwner = customerOwner of the region's first customer
  Customers      region (enum name) -> regionID (FK to the new row)
  Requirements   isActive boolean -> 'Active'/'Inactive' enum; drops the
                 removed requirementOwner; materialises the new applicability
                 keys regionID/businessUnitID as [] (= applies to all) and
                 regulatoryURL as null
  Product Specs  businessUnitID — unit of the spec's products (first by id)
  Onboarding     businessUnitID — via userID -> People.businessUnitID
  People         location (legacy factory FK) -> regionID via the customer's
                 regionID; drops location
  Business Units regionID[] — union of the regions of the unit's customers
                 (multivalued; empty when the unit has no customers yet)

Idempotent: fields already present and non-empty are left untouched; the
Regions table is only created when absent.
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


def find_module(data, table):
    for mod, tables in data.items():
        if isinstance(tables, dict) and table in tables:
            return mod
    return None


def find_table(data, name):
    mod = find_module(data, name)
    return data[mod][name] if mod else None


def blank(v):
    return v is None or v == '' or v == []


def as_list(v):
    if blank(v):
        return []
    return v if isinstance(v, list) else [v]


def migrate(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    customers = find_table(data, 'Customers')
    if customers is None:
        print(f'{path.name}: no Customers table — skipped')
        return
    changed = {}

    def note(k, n=1):
        changed[k] = changed.get(k, 0) + n

    # ---- Regions: one row per distinct legacy region name ----
    regions = find_table(data, 'Regions')
    if regions is None:
        names = sorted({c['region'] for c in customers if c.get('region')}, key=str.lower)
        owner_of = {}
        for c in sorted(customers, key=lambda x: str(x.get('customerID', ''))):
            if c.get('region') and c['region'] not in owner_of:
                owner_of[c['region']] = c.get('customerOwner')
        regions = [{
            'regionID': f'RG{i + 1:02d}',
            'regionName': name,
            'regionDescription': f'{name} region',
            'regionOwner': owner_of.get(name),
        } for i, name in enumerate(names)]
        org = find_module(data, 'Business Units')
        if org and regions:
            data[org]['Regions'] = regions
            note('Regions created', len(regions))
    region_id = {r['regionName']: r['regionID'] for r in regions or []}

    # ---- Customers: region name -> regionID ----
    for c in customers:
        if 'region' in c:
            legacy = c.pop('region')
            if blank(c.get('regionID')):
                c['regionID'] = region_id.get(legacy)
            note('Customers')

    # ---- Requirements: enum isActive, dropped owner, new applicability keys ----
    for r in (find_table(data, 'Requirements') or []):
        if isinstance(r.get('isActive'), bool):
            r['isActive'] = 'Active' if r['isActive'] else 'Inactive'
            note('Requirements')
        if 'requirementOwner' in r:
            del r['requirementOwner']
            note('Requirements')
        for field, default in (('regionID', []), ('businessUnitID', []), ('regulatoryURL', None)):
            if field not in r:
                r[field] = default
                note('Requirements')

    # ---- Product Specs: unit of the spec's products ----
    prod_bu = {p['productID']: as_list(p.get('businessUnitID'))
               for p in (find_table(data, 'Products') or [])}
    for s in (find_table(data, 'Product Specs') or []):
        if 'businessUnitID' not in s or blank(s.get('businessUnitID')):
            units = sorted({u for pid in as_list(s.get('productID')) for u in prod_bu.get(pid, [])})
            s['businessUnitID'] = units[0] if units else None
            note('Product Specs')

    # ---- People: legacy factory location -> region of that customer ----
    cust_region = {c['customerID']: c.get('regionID') for c in customers}
    for p in (find_table(data, 'People') or []):
        if 'location' in p:
            legacy = p.pop('location')
            if blank(p.get('regionID')):
                p['regionID'] = cust_region.get(legacy)
            note('People')

    # ---- Business Units: regions served, union of the unit's customers ----
    unit_regions = {}
    for c in customers:
        for u in as_list(c.get('businessUnitID')):
            if c.get('regionID'):
                unit_regions.setdefault(u, set()).add(c['regionID'])
    for bu in (find_table(data, 'Business Units') or []):
        if 'regionID' not in bu or blank(bu.get('regionID')):
            bu['regionID'] = sorted(unit_regions.get(bu.get('businessUnitID'), set()))
            note('Business Units')

    # ---- Onboarding: unit of the person ----
    person_bu = {p['userID']: p.get('businessUnitID')
                 for p in (find_table(data, 'People') or [])}
    for ob in (find_table(data, 'Onboarding') or []):
        if 'businessUnitID' not in ob or blank(ob.get('businessUnitID')):
            ob['businessUnitID'] = person_bu.get(ob.get('userID'))
            note('Onboarding')

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
