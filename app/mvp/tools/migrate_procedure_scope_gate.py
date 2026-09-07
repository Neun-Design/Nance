#!/usr/bin/env python3
"""Procedure scope gate round (issue #332, schemaVersion 80).

`Procedures.productScopeID[]` now GATES the ticket→procedure match
directly (ticketProcedureForTask in resolve.js): with a ticket scope
context, a procedure pinned to scopes must name at least one scope the
ticket admits, or it is no candidate. The demo seeds predate the gate
(#159 era, truncated to the event's first two packaged pairs by the seed
builder) and would orphan 606/1502 (ticket, task) dispatches — the inputs
census would collapse 137→19.

Re-seed (deliberate, the #281 edit-integrity posture — every pre-gate
dispatch must survive the new filter): each procedure's productScopeID
becomes its stored picks ∪ the scopes packaged by the payloads of its
task's process's event(s), in payload row order (a wildcard payload —
empty packaging — contributes the event's full applicability, the #214
posture). Stored picks stay first, so the migrated list equals the seed
builder's full `pack_of` list on regenerated data (the stored set was its
[:2] prefix). Census after: 0 flips, 137/160 tickets keep their inputs.

Runs on both mockup copies (the legacy developer copy no-ops: procedures
carry empty scope keys — Q1 wildcard, the gate bites nothing — and its
processes chain no events); the frozen transformers testdata stays
unmigrated by design (#284 posture).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COPIES = [
    ROOT / 'data' / 'mockup_data_prototype.json',
    ROOT.parent / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 80


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
    """resolve.js sameVal: any overlap between the two sides, blank = no."""
    la, lb = as_list(a), as_list(b)
    return bool(la) and bool(lb) and any(x in lb for x in la)


def event_product_scope_ids(ev, tables):
    """Python port of eventProductScopeIds (resolve.js): the scopes an
    event's applicability admits — scope overlap AND the product group's
    product among the event's products (each empty = all, Q1)."""
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
    tasks = {str(t['taskID']): t for t in tables.get('Tasks', [])}
    processes = {str(p['processID']): p for p in tables.get('Processes', [])}
    events = {str(e['eventID']): e for e in tables.get('Events', [])}
    payloads = tables.get('Payload', [])

    def event_packaged_scopes(ev_id):
        """Scopes the event's payloads package, payload row order; a
        wildcard payload widens to the event's full applicability."""
        out = []
        for pl in payloads:
            if str(pl.get('eventID')) != str(ev_id):
                continue
            packed = as_list(pl.get('productScopeID')) \
                or event_product_scope_ids(events.get(str(ev_id)), tables)
            for ps in packed:
                if ps not in out:
                    out.append(ps)
        return out

    stats = {'procedures': 0, 'widened': 0, 'untouched': 0}
    for proc in tables.get('Procedures', []):
        stats['procedures'] += 1
        merged = list(as_list(proc.get('productScopeID')))
        task = tasks.get(str(proc.get('taskID')))
        for pr_id in as_list(task.get('processID')) if task else []:
            pr = processes.get(str(pr_id))
            for ev_id in as_list(pr.get('eventID')) if pr else []:
                for ps in event_packaged_scopes(ev_id):
                    if ps not in merged:
                        merged.append(ps)
        if merged != as_list(proc.get('productScopeID')):
            proc['productScopeID'] = merged
            stats['widened'] += 1
        else:
            stats['untouched'] += 1
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
