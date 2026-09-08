#!/usr/bin/env python3
"""No-dynamic-wildcards round (issue #364, schemaVersion 98).

Doctrine (Rafael, 2026-09-08): the empty-set wildcard is RETIRED — an empty
multivalued applicability set applies to NOTHING. "Apply to all" is a
decision the USER materializes by selecting every value (today's list): a
requirement registered later is NOT silently covered — every procedure must
be revisited and the new requirement added manually where it applies (the
deliberate quality review the dynamic wildcard bypassed, ISO §6.1).

Data side: the pre-#364 empty sets on the four Procedures applicability
keys MEANT "all" under the old reading — this migration MATERIALIZES them
with exactly what each picker offers today, so every dispatch/coverage
result is preserved (zero flips at rest; the doctrine starts biting on the
NEXT registration, which is the point):

- `requirementID` [] → EVERY Active requirement (table row order). This
  deliberately IGNORES the #304 picker's region gate: the old wildcard
  covered every Active requirement, and ticket inheritance flows region-
  pinned requirements through cross-unit chains (the #344 divergence — a
  BU02 ticket resolving BU01 procedures brings RG03 requirements a
  region-gated set would miss: census 317/1502 dispatch flips, inputs
  137→80). Materializing all Active ids is the faithful translation
  (0 flips by construction — the need is always ⊆ Active); the ids beyond
  the picker carry the accepted #290/#340 edit-time narrowing trap.
- `productScopeID` [] → the task→process→event payload-packaged scopes
  (the #332 union; wildcard payload = event applicability). Clinic rows
  are already filled by #332 — this leg only touches the legacy copy.
- `branchID` [] → the Unit's customers' branches (the generic two-hop the
  picker rides: branches registered to any of the unit's customers).
- `customerID` [] → the Unit's customers narrowed to the materialized
  Branches' registrations (customersForUnitBranches with every branch
  ticked); no branches → the unit's full customer set (lenient posture).

`customerInputID` is untouched — it was never a wildcard (empty = NO
customer inputs, the #324 positive pick).

Runs on both mockup copies; the frozen transformers testdata stays
unmigrated by design (#284) — its pre-sv98 stamp keeps the legacy wildcard
reading via legacyWildcardData() in data.js.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COPIES = [
    ROOT / 'data' / 'mockup_data_prototype.json',
    ROOT.parent / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 98


def tables_of(mock):
    """The mockup nests tables by module (false 0-rows trap) — walk it."""
    out = {}
    for mod, tabs in mock.items():
        if mod.startswith('_') or not isinstance(tabs, dict):
            continue
        for name, rows in tabs.items():
            if isinstance(rows, list):
                out[name] = rows
    return out


def as_list(v):
    if v is None or v == '':
        return []
    return v if isinstance(v, list) else [v]


def same_val(a, b):
    la, lb = as_list(a), as_list(b)
    return bool(la) and bool(lb) and any(x in lb for x in la)


def event_product_scope_ids(ev, tables):
    """Port of eventProductScopeIds (resolve.js) — see #332 migration."""
    all_ps = tables.get('Product Scopes', [])
    if ev is None:
        return [ps['productScopeID'] for ps in all_ps]
    groups = {str(g['productGroupID']): g for g in tables.get('Product Groups', [])}
    scopes, products = as_list(ev.get('scopeID')), as_list(ev.get('productID'))
    out = []
    for ps in all_ps:
        if scopes and not same_val(ps.get('scopeID'), scopes):
            continue
        if products:
            pg = groups.get(str(ps.get('productGroupID')))
            if not pg or not same_val(pg.get('productID'), products):
                continue
        out.append(ps['productScopeID'])
    return out


def materialize(tables):
    """Fill every EMPTY applicability key on Procedures with its picker
    universe. Returns per-key fill counters. Shared with the seed builder
    (_materialize_wildcards in build_seed.py) — the rules must agree so
    regenerated and migrated datasets match."""
    customers = tables.get('Customers', [])
    branches = tables.get('Branches', [])
    reqs = tables.get('Requirements', [])
    tasks = {str(t['taskID']): t for t in tables.get('Tasks', [])}
    processes = {str(p['processID']): p for p in tables.get('Processes', [])}
    events = {str(e['eventID']): e for e in tables.get('Events', [])}
    payloads = tables.get('Payload', [])

    def unit_customers(unit_id):
        if unit_id in (None, ''):
            return [c['customerID'] for c in customers]
        return [c['customerID'] for c in customers
                if str(unit_id) in [str(x) for x in as_list(c.get('businessUnitID'))]]

    def unit_branches(unit_id):
        cust = set(str(c) for c in unit_customers(unit_id))
        if unit_id in (None, ''):
            return [b['branchID'] for b in branches]
        return [b['branchID'] for b in branches
                if any(str(c) in cust for c in as_list(b.get('customerID')))]

    def active_requirements():
        """The old wildcard's faithful translation: every Active requirement
        (ticket inheritance only ever matches Active ones — need ⊆ this set,
        so materializing it preserves every dispatch). NOT the #304
        region-gated picker universe — see the module docstring."""
        return [r['requirementID'] for r in reqs
                if str(r.get('isActive') or 'Active') != 'Inactive']

    def packaged_scopes(proc):
        out = []
        task = tasks.get(str(proc.get('taskID')))
        for pr_id in as_list(task.get('processID')) if task else []:
            pr = processes.get(str(pr_id))
            for ev_id in as_list(pr.get('eventID')) if pr else []:
                for pl in payloads:
                    if str(pl.get('eventID')) != str(ev_id):
                        continue
                    packed = as_list(pl.get('productScopeID')) \
                        or event_product_scope_ids(events.get(str(ev_id)), tables)
                    for ps in packed:
                        if ps not in out:
                            out.append(ps)
        return out

    stats = {'requirementID': 0, 'productScopeID': 0, 'branchID': 0, 'customerID': 0}
    for proc in tables.get('Procedures', []):
        unit_id = proc.get('businessUnitID')
        if not as_list(proc.get('requirementID')):
            proc['requirementID'] = active_requirements()
            if proc['requirementID']:
                stats['requirementID'] += 1
        if not as_list(proc.get('productScopeID')):
            proc['productScopeID'] = packaged_scopes(proc)
            if proc['productScopeID']:
                stats['productScopeID'] += 1
        if not as_list(proc.get('branchID')):
            proc['branchID'] = unit_branches(unit_id)
            if proc['branchID']:
                stats['branchID'] += 1
        if not as_list(proc.get('customerID')):
            ucust = unit_customers(unit_id)
            picked = as_list(proc.get('branchID'))
            if picked:
                registered = set()
                by_id = {str(b['branchID']): b for b in branches}
                for bid in picked:
                    b = by_id.get(str(bid))
                    if b:
                        registered.update(str(c) for c in as_list(b.get('customerID')))
                ucust = [c for c in ucust if str(c) in registered]
            proc['customerID'] = ucust
            if proc['customerID']:
                stats['customerID'] += 1
    return stats


def migrate(path):
    raw = path.read_text(encoding='utf-8')
    mock = json.loads(raw)
    tables = tables_of(mock)
    stats = materialize(tables)
    stats['procedures'] = len(tables.get('Procedures', []))
    mock.setdefault('_meta', {})['schemaVersion'] = SCHEMA_VERSION
    path.write_text(json.dumps(mock, indent=1, ensure_ascii=False)
                    + ('\n' if raw.endswith('\n') else ''), encoding='utf-8')
    return stats


def main():
    for path in COPIES:
        if not path.exists():
            print(f'skip (missing): {path}')
            continue
        print(f'{path.name}: {migrate(path)}')


if __name__ == '__main__':
    sys.exit(main())
