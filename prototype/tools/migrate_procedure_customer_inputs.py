#!/usr/bin/env python3
"""Procedure customer inputs round (issue #324, schemaVersion 77).

The customer-input decision moves from the HANDOUT to the PROCEDURE
(session decisions): a handout flagged at handout level was a customer
input in EVERY procedure using it, but the decision is contextual — the
same document may be customer-provided in one method and internal in
another. New stored `Procedures.customerInputID[]` (subset of taskInput);
`Handouts.customerFlag` and the form switch are RETIRED.

Seeds (behavior-preserving, session decision): each procedure's
customerInputID = its inputs currently flagged customerFlag == True — the
Tickets Inputs tab stays IDENTICAL (clinic census 137/160 with inputs).
Then the customerFlag key is DELETED from every Handout row (parity:
removed attrs must leave the data). Mirrored in build_seed.py (the
domain's `customer_inputs` name list now applies per procedure).

Runs on both mockup copies; the frozen transformers testdata stays
unmigrated by design (ticketInputHandouts keeps a legacy-fallback rung:
procedures without the key read the old handout flag).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COPIES = [
    ROOT / 'data' / 'mockup_data_prototype.json',
    ROOT.parent / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 77


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


def migrate(path):
    raw = path.read_text(encoding='utf-8')
    mock = json.loads(raw)
    tables = tables_of(mock)
    handouts = {str(h['handoutID']): h for h in tables.get('Handouts', [])}
    flagged = {hid for hid, h in handouts.items() if h.get('customerFlag') is True}
    stats = {'procedures': 0, 'with_customer_inputs': 0, 'flags_dropped': 0}
    for p in tables.get('Procedures', []):
        p['customerInputID'] = [hid for hid in as_list(p.get('taskInput'))
                                if str(hid) in flagged]
        stats['procedures'] += 1
        if p['customerInputID']:
            stats['with_customer_inputs'] += 1
    for h in handouts.values():
        if 'customerFlag' in h:
            del h['customerFlag']
            stats['flags_dropped'] += 1
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
