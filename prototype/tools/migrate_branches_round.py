#!/usr/bin/env python3
"""Deterministic migration: 2026-08-01 stakeholder round — Branches & Classes.

Implements the data side of prototype/stakeholders_test_results.md:

  Countries      hidden registry seeded with the world's countries per
                 continent (feeds the Branches Country picker)
  Regions        continent enum — demo defaults by region name
                 (Americas -> North America, APAC -> Asia, EMEA -> Europe)
  Branches       new Organization table seeded from the branch-typed
                 Customers (FCnn -> BRnn): name/city/country/region/unit;
                 businessSegmentID = first segment of the customer (or of
                 its unit); userID left null (Owner is Manager-filtered)
  Functions      seeds the 'Manager' function (F6) the Branches Owner
                 picker filters on (nobody is reassigned)
  Issues         businessSegmentID = first segment of the issue's legacy
                 unit; rows move to the Organization section
  Scopes         scopeClassID = [] (new multivalued FK -> Classes)
  Classes        new empty Portfolio table (registry starts blank)
  Requirements   customerID key renamed to branchID (FCnn -> BRnn values)
  People         customerID key renamed to branchID (FCnn -> BRnn values)

Idempotent: keys already present/converted are left untouched.
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

CONTINENT_BY_REGION = {'Americas': 'North America', 'APAC': 'Asia', 'EMEA': 'Europe'}

# legacy free-text country spellings -> Countries registry names
COUNTRY_ALIASES = {'USA': 'United States', 'US': 'United States',
                   'UK': 'United Kingdom', 'UAE': 'United Arab Emirates'}

COUNTRIES = {
    'Africa': [
        'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi',
        'Cabo Verde', 'Cameroon', 'Central African Republic', 'Chad', 'Comoros',
        'Congo', 'Democratic Republic of the Congo', 'Djibouti', 'Egypt',
        'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Ethiopia', 'Gabon',
        'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Ivory Coast', 'Kenya',
        'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali',
        'Mauritania', 'Mauritius', 'Morocco', 'Mozambique', 'Namibia', 'Niger',
        'Nigeria', 'Rwanda', 'Sao Tome and Principe', 'Senegal', 'Seychelles',
        'Sierra Leone', 'Somalia', 'South Africa', 'South Sudan', 'Sudan',
        'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe',
    ],
    'Asia': [
        'Afghanistan', 'Armenia', 'Azerbaijan', 'Bahrain', 'Bangladesh',
        'Bhutan', 'Brunei', 'Cambodia', 'China', 'Cyprus', 'Georgia', 'India',
        'Indonesia', 'Iran', 'Iraq', 'Israel', 'Japan', 'Jordan', 'Kazakhstan',
        'Kuwait', 'Kyrgyzstan', 'Laos', 'Lebanon', 'Malaysia', 'Maldives',
        'Mongolia', 'Myanmar', 'Nepal', 'North Korea', 'Oman', 'Pakistan',
        'Palestine', 'Philippines', 'Qatar', 'Saudi Arabia', 'Singapore',
        'South Korea', 'Sri Lanka', 'Syria', 'Taiwan', 'Tajikistan',
        'Thailand', 'Timor-Leste', 'Turkey', 'Turkmenistan',
        'United Arab Emirates', 'Uzbekistan', 'Vietnam', 'Yemen',
    ],
    'Europe': [
        'Albania', 'Andorra', 'Austria', 'Belarus', 'Belgium',
        'Bosnia and Herzegovina', 'Bulgaria', 'Croatia', 'Czechia', 'Denmark',
        'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary',
        'Iceland', 'Ireland', 'Italy', 'Kosovo', 'Latvia', 'Liechtenstein',
        'Lithuania', 'Luxembourg', 'Malta', 'Moldova', 'Monaco', 'Montenegro',
        'Netherlands', 'North Macedonia', 'Norway', 'Poland', 'Portugal',
        'Romania', 'Russia', 'San Marino', 'Serbia', 'Slovakia', 'Slovenia',
        'Spain', 'Sweden', 'Switzerland', 'Ukraine', 'United Kingdom',
        'Vatican City',
    ],
    'North America': [
        'Antigua and Barbuda', 'Bahamas', 'Barbados', 'Belize', 'Canada',
        'Costa Rica', 'Cuba', 'Dominica', 'Dominican Republic', 'El Salvador',
        'Grenada', 'Guatemala', 'Haiti', 'Honduras', 'Jamaica', 'Mexico',
        'Nicaragua', 'Panama', 'Saint Kitts and Nevis', 'Saint Lucia',
        'Saint Vincent and the Grenadines', 'Trinidad and Tobago',
        'United States',
    ],
    'South America': [
        'Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Ecuador',
        'Guyana', 'Paraguay', 'Peru', 'Suriname', 'Uruguay', 'Venezuela',
    ],
    'Oceania': [
        'Australia', 'Fiji', 'Kiribati', 'Marshall Islands', 'Micronesia',
        'Nauru', 'New Zealand', 'Palau', 'Papua New Guinea', 'Samoa',
        'Solomon Islands', 'Tonga', 'Tuvalu', 'Vanuatu',
    ],
}


def find_module(data, table):
    for mod, tables in data.items():
        if isinstance(tables, dict) and table in tables:
            return mod
    return None


def find_table(data, name):
    mod = find_module(data, name)
    return data[mod][name] if mod else None


def as_list(v):
    if v is None or v == '' or v == []:
        return []
    return v if isinstance(v, list) else [v]


def first(v):
    lst = as_list(v)
    return lst[0] if lst else None


def migrate(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    org = data.setdefault('Organization', {})
    changed = {}

    def note(k, n=1):
        changed[k] = changed.get(k, 0) + n

    # ---- Countries registry ----
    if 'Countries' not in org:
        org['Countries'] = [{'countryName': c, 'continent': cont}
                            for cont in sorted(COUNTRIES) for c in sorted(COUNTRIES[cont])]
        note('Countries created', len(org['Countries']))

    # ---- Regions: demo continents ----
    for r in (find_table(data, 'Regions') or []):
        if 'continent' not in r:
            r['continent'] = CONTINENT_BY_REGION.get(r.get('regionName'))
            note('Regions')

    # ---- Branches from branch-typed customers (FCnn -> BRnn) ----
    customers = find_table(data, 'Customers') or []
    units = {u['businessUnitID']: u for u in (find_table(data, 'Business Units') or [])}
    br_of = {}
    for c in sorted(customers, key=lambda x: str(x.get('customerID', ''))):
        if c.get('customerType') != 'branch':
            continue
        br_of[c['customerID']] = 'BR' + ''.join(ch for ch in str(c['customerID']) if ch.isdigit())
    if 'Branches' not in org:
        rows = []
        for c in sorted(customers, key=lambda x: str(x.get('customerID', ''))):
            bid = br_of.get(c.get('customerID'))
            if not bid:
                continue
            unit = first(c.get('businessUnitID'))
            seg = first(c.get('businessSegmentID')) or first((units.get(unit) or {}).get('businessSegmentID'))
            rows.append({
                'branchID': bid,
                'businessSegmentID': seg,
                'businessUnitID': unit,
                'branchName': c.get('customerName'),
                'cityName': c.get('city'),
                'regionID': c.get('regionID'),
                'countryName': COUNTRY_ALIASES.get(c.get('country'), c.get('country')),
                'userID': None,
            })
        org['Branches'] = rows
        note('Branches created', len(rows))
    else:
        for b in org['Branches']:
            fixed = COUNTRY_ALIASES.get(b.get('countryName'))
            if fixed:
                b['countryName'] = fixed
                note('Branches country normalized')

    # ---- Functions: the Manager function the Owner picker filters on ----
    funcs = find_table(data, 'Functions')
    if funcs is not None and not any(f.get('functionName') == 'Manager' for f in funcs):
        template = {k: None for k in funcs[0]} if funcs else {}
        nums = [int(''.join(ch for ch in str(f.get('functionID', '')) if ch.isdigit()) or 0) for f in funcs]
        template.update({'functionID': f'F{max(nums or [0]) + 1}', 'functionName': 'Manager'})
        funcs.append(template)
        note('Functions')

    # ---- Issues: segment from the legacy unit; rows live in Organization ----
    issues_mod = find_module(data, 'Issues')
    for i in (find_table(data, 'Issues') or []):
        if 'businessSegmentID' not in i:
            i['businessSegmentID'] = first((units.get(first(i.get('businessUnitID'))) or {}).get('businessSegmentID'))
            note('Issues')
    if issues_mod and issues_mod != 'Organization':
        org['Issues'] = data[issues_mod].pop('Issues')
        note('Issues moved')

    # ---- Scopes: empty classification ----
    for s in (find_table(data, 'Scopes') or []):
        if 'scopeClassID' not in s:
            s['scopeClassID'] = []
            note('Scopes')

    # ---- Classes: blank registry ----
    if find_table(data, 'Classes') is None:
        data.setdefault('Portfolio', {})['Classes'] = []
        note('Classes created')

    # ---- Requirements / People: customerID key -> branchID (FC -> BR) ----
    def to_branch(v):
        if isinstance(v, list):
            return [br_of.get(x, x) for x in v]
        return br_of.get(v, v)
    for name in ('Requirements', 'People'):
        for r in (find_table(data, name) or []):
            if 'customerID' in r and 'branchID' not in r:
                r['branchID'] = to_branch(r.pop('customerID'))
                note(name)

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
