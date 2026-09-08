#!/usr/bin/env python3
"""Events/Payload explicit-applicability round (issue #367, schemaVersion 100).

The #364 doctrine lands on the admission chain: an EVENT's applicability
(scopeID[] / productID[], #159) and a PAYLOAD's packaging
(productScopeID[], #190) must be DECLARED — an empty key admits/packages
NOTHING ('all' = every value explicitly selected; a scope or product
registered later requires revisiting the event/payload).

Data side, both mockup copies:

- Events: every empty `scopeID` → the full Scopes dimension; every empty
  `productID` → the full Products dimension (table row order) — the
  faithful translation of the old wildcard (no constraint = admits every
  product scope), so eventProductScopeIds resolves identically at rest.
- Payload: every empty `productScopeID` → the owning event's admitted
  applicability at migration time (the #332 event_product_scope_ids port,
  run AFTER the event materialization — for formerly-wildcard events that
  is every product scope, exactly what the old widening returned).

Zero flips by construction on the ticket admission chain
(admittedProductScopeIds / ticketAdmittedPayloads), the pickers and the
Forecast Scopes anchor. The frozen transformers testdata stays unmigrated
(#284); pre-sv100 snapshots keep the old Q1 reading via
legacyWildcardData(100).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COPIES = [
    ROOT / 'data' / 'mockup_data_prototype.json',
    ROOT.parent / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 100


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
    """Port of eventProductScopeIds (resolve.js) — the #332 migration port,
    run on the ALREADY-MATERIALIZED event (full keys = the old wildcard's
    admitted set)."""
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


def migrate(path):
    raw = path.read_text(encoding='utf-8')
    mock = json.loads(raw)
    tables = tables_of(mock)
    all_scopes = [s['scopeID'] for s in tables.get('Scopes', [])]
    all_products = [p['productID'] for p in tables.get('Products', [])]
    stats = {'events': len(tables.get('Events', [])), 'event_keys': 0,
             'payloads': len(tables.get('Payload', [])), 'packaged': 0}
    for ev in tables.get('Events', []):
        if not as_list(ev.get('scopeID')):
            ev['scopeID'] = list(all_scopes)
            stats['event_keys'] += 1
        if not as_list(ev.get('productID')):
            ev['productID'] = list(all_products)
            stats['event_keys'] += 1
    events = {str(e['eventID']): e for e in tables.get('Events', [])}
    for pl in tables.get('Payload', []):
        if not as_list(pl.get('productScopeID')):
            pl['productScopeID'] = event_product_scope_ids(
                events.get(str(pl.get('eventID'))), tables)
            if pl['productScopeID']:
                stats['packaged'] += 1
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
