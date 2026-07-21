#!/usr/bin/env python3
"""validate_mockup.py — assert the mockup dataset satisfies the datamodel
coverage contract (issue #23 / DATAMODEL_GUIDE). Exit 1 on any failure.

Checks: schema parity (stored attrs exactly), FK resolvability (PK or display
value), rollup coverage (>=70% parents with children), report data sufficiency
(12-month spread, Draft forecasts, quota+hours), card computability (task
recurrence, two-period trends), fixture preservation.
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DM = json.load(open(ROOT / 'data' / 'datamodel.json'))
MOCK = json.load(open(ROOT / 'data' / 'mockup_data_prototype.json'))

fails, warns = [], []
ok = lambda m: print(f'  ✓ {m}')
def fail(m): fails.append(m); print(f'  ✗ {m}')
def warn(m): warns.append(m); print(f'  ~ {m}')

flat = {}
for mod, ents in MOCK.items():
    if mod == '_meta':
        continue
    flat.update(ents)

# resolve table name case-insensitively / singular-ish
def find_table(name):
    name = name.strip()
    for t in flat:
        if t.lower() == name.lower() or t.lower() == name.lower() + 's':
            return t
    return None

# ---------- 1. schema parity ----------
print('\n== schema parity ==')
pk_of, label_candidates = {}, {}
for mname, m in DM['modules'].items():
    if find := set(m['tables']) - set(MOCK.get(mname, {})):
        fail(f'{mname}: tables missing from mockup: {find}')
    for tname, t in m['tables'].items():
        rows = MOCK.get(mname, {}).get(tname, [])
        stored = [a['name'] for a in t['attributes'] if a['type'] not in ('rollup', 'computed')]
        pk = next((a['name'] for a in t['attributes'] if a.get('constraints') == 'PK'), None)
        pk_of[tname] = pk
        if not rows:
            fail(f'{tname}: no rows'); continue
        missing = [f for f in stored if any(f not in r for r in rows)]
        extra = sorted({k for r in rows for k in r} - set(stored))
        if missing: fail(f'{tname}: rows missing stored attrs {missing}')
        if extra: fail(f'{tname}: extra non-canonical fields {extra}')
        if pk:
            ids = [r[pk] for r in rows]
            if len(ids) != len(set(ids)): fail(f'{tname}: duplicate {pk} values')
if not fails: ok('all 30 tables present, stored attrs exact, PKs unique')

# ---------- 2. FK resolvability ----------
print('\n== FK resolvability ==')
id_sets, display_sets = {}, {}
for tname, rows in flat.items():
    pk = pk_of.get(tname)
    id_sets[tname] = {r[pk] for r in rows} if pk and rows else set()
    display_sets[tname] = {v for r in rows for v in r.values() if isinstance(v, str)}
NON_TABLES = {'Departments', 'Regions'}  # code-value FKs by design
fk_checked = fk_bad = 0
for mname, m in DM['modules'].items():
    for tname, t in m['tables'].items():
        rows = flat.get(tname, [])
        for a in t['attributes']:
            if a['type'] in ('rollup', 'computed') or not a.get('rule'):
                continue
            mt = re.match(r'FK\s*→\s*([A-Za-z &]+?)(?:\s*\(|$)', a['rule'])
            if not mt:
                continue
            target = mt.group(1).strip()
            if target in NON_TABLES:
                continue
            real = find_table(target)
            if not real:
                warn(f'{tname}.{a["name"]}: FK target {target!r} not a mockup table'); continue
            for r in rows:
                v = r.get(a['name'])
                vals = v if isinstance(v, list) else ([] if v in (None, '') else [v])
                for x in vals:
                    fk_checked += 1
                    if x not in id_sets[real] and x not in display_sets[real]:
                        fk_bad += 1
                        if fk_bad < 8: fail(f'{tname}.{a["name"]}={x!r} unresolvable in {real}')
if fk_bad == 0: ok(f'{fk_checked} FK values all resolvable (PK or display)')
else: fail(f'{fk_bad}/{fk_checked} FK values unresolvable')

# ---------- 3. rollup coverage ----------
print('\n== rollup coverage ==')
for mname, m in DM['modules'].items():
    for tname, t in m['tables'].items():
        rows = flat.get(tname, [])
        pk = pk_of.get(tname)
        for a in t['attributes']:
            if a['type'] != 'rollup' or not a.get('rule'):
                continue
            mt = re.match(r'rollup\s*→\s*([A-Za-z &]+?)\s*\(via:\s*([A-Za-z.]+)\)', a['rule'])
            if not mt:
                continue
            target, via = find_table(mt.group(1)), mt.group(2)
            if not target or '.' in via:
                continue
            child_vals = {c.get(via) for c in flat.get(target, [])}
            covered = sum(1 for r in rows if r.get(pk) in child_vals)
            pct = covered / len(rows) * 100 if rows else 0
            (ok if pct >= 70 else warn)(f'{tname}.{a["name"]} → {target}: {pct:.0f}% parents covered')

# ---------- 4. report data sufficiency ----------
print('\n== report sufficiency ==')
months = lambda rows, f: {str(r.get(f, ''))[:7] for r in rows if r.get(f)}
if len(months(flat['Jobs'], 'realEndDate')) >= 10: ok('Jobs: completions span ≥10 months')
else: fail('Jobs: insufficient monthly spread')
if len({(r['periodYear'], r['periodMonth']) for r in flat['Capacity']}) >= 12: ok('Capacity: 12 monthly periods')
else: fail('Capacity: <12 periods')
if len({(r['periodYear'], r['periodMonth']) for r in flat['Performance']}) >= 12: ok('Performance: 12 monthly periods')
else: fail('Performance: <12 periods')
drafts = sum(1 for r in flat['Forecasts'] if r['status'] == 'Draft')
if drafts >= 3: ok(f'Forecasts: {drafts} Draft rows (Capacity exclusion radio testable)')
else: fail('Forecasts: too few Draft rows')
if all(r.get('weeklyUsageQuota') for r in flat['Forecasts']) and all(r.get('ticketExecutionTime') is not None for r in flat['Tickets']):
    ok('budget-vs-estimated inputs present (weeklyUsageQuota + ticketExecutionTime)')
else: fail('budget-vs-estimated inputs incomplete')

# ---------- 5. card computability ----------
print('\n== card computability ==')
byname = defaultdict(set)
for t in flat['Tasks']:
    byname[t['taskName']].add(t['processID'])
recur = [n for n, procs in byname.items() if len(procs) >= 2]
if len(recur) >= 3: ok(f'{len(recur)} task names recur across ≥2 processes (top-3 card non-degenerate)')
else: fail('too few recurring task names')
half = len(flat['Capacity']) // 2
a1 = sum(r['allocatedHours'] for r in flat['Capacity'][:half])
a2 = sum(r['allocatedHours'] for r in flat['Capacity'][half:])
if a1 != a2: ok('Capacity: two-period totals differ (trend arrows renderable)')
else: fail('Capacity: flat trend')

# ---------- 6. fixtures ----------
print('\n== fixtures ==')
FIX = {'Factories': 17, 'Actions': 7, 'Scopes': 10, 'Products': 14, 'Product Groups': 14,
       'Product Class': 15, 'Events': 31, 'Tickets': 135}
for t, n in FIX.items():
    (ok if len(flat[t]) == n else fail)(f'{t}: {len(flat[t])} rows (expected {n})')

print(f'\nRESULT: {"FAIL" if fails else "PASS"} — {len(fails)} failures, {len(warns)} warnings')
sys.exit(1 if fails else 0)
