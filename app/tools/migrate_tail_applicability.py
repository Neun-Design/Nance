#!/usr/bin/env python3
"""No-wildcards tail round (issue #368 — R4+R5, schemaVersion 101).

The #364 doctrine closes on the remaining multivalued applicability sets:

- `Processes.productScopeID[]` (#159): empty = "covers every scope of the
  event" → RETIRED. Materialized with the EVENT's admitted applicability
  (the sv100-materialized events — the faithful translation of the old
  fallback). Clinic 6/6 processes were empty; developer 5/5 (no event
  chains → the old no-event fallback admitted every product scope, so the
  full dimension is the faithful fill).
- `Handouts.departmentID[]` (#340): empty = "offered everywhere" →
  RETIRED. Materialized with every department (clinic 0 empty — no-op;
  developer 10/10).
- Competence eligibility (#368 R5, ENGINE-ONLY — no data change): a
  competence with NO procedure link covers nothing and is not exercisable
  on sv101+ data (clinic 0/28 in that state; the legacy developer copy's
  12 no-link rows become honestly inert — its chains predate Procedures).
  `Competence.procedureID` stays NULLABLE by decision: a NOT NULL would
  break parity on that legacy copy; the engine gates close the UI hole.
- `Competence.productScopeID` is OUT of doctrine scope: single-valued
  nullable FK — a context posture, not a multivalued applicability set.

Pre-sv101 snapshots keep every old reading via legacyWildcardData(101);
the frozen transformers testdata stays unmigrated (#284).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COPIES = [
    ROOT / 'data' / 'mockup_data_prototype.json',
    ROOT.parent / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 101


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
    """Port of eventProductScopeIds (resolve.js) on the materialized event
    (no-event → every product scope, the old lenient-context fallback)."""
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
    events = {str(e['eventID']): e for e in tables.get('Events', [])}
    stats = {'processes': 0, 'handouts': 0}
    for pr in tables.get('Processes', []):
        if not as_list(pr.get('productScopeID')):
            evs = as_list(pr.get('eventID'))
            covered = []
            for ev_id in (evs or [None]):
                for ps in event_product_scope_ids(events.get(str(ev_id)), tables):
                    if ps not in covered:
                        covered.append(ps)
            pr['productScopeID'] = covered
            if covered:
                stats['processes'] += 1
    all_depts = [d['departmentID'] for d in tables.get('Departments', [])]
    for h in tables.get('Handouts', []):
        if not as_list(h.get('departmentID')):
            h['departmentID'] = list(all_depts)
            if h['departmentID']:
                stats['handouts'] += 1
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
