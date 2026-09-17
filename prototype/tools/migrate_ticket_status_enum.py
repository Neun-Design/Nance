#!/usr/bin/env python3
"""Deterministic migration: re-key Tickets.ticketStatus to the renamed enum
(2026-09-17, schemaVersion 115 — Rafael's authored edit in workspace.ts).

The enum changed `Open | InProgress | Resolved | Escalated | Closed` →
`To Do | InProgress | Done | Escalated | Closed | On Hold`: two members were
renamed (Open → To Do, Resolved → Done) and On Hold was added. Stored rows
carrying the old spellings would sit OUTSIDE the enum — the edit drawer's
Status select could not prefill them and saving would silently wipe the
status (the form-integrity trap), so the values are re-keyed in place.

Also stamps _meta.schemaVersion (115 — the round that lands the generalized
"default: <value>" field-rule; the default itself bites on NEW records only,
so no other data change belongs to it).

Deterministic and idempotent: re-running on a migrated file changes nothing.
Applies to prototype/data/mockup_data_prototype.json (the only copy since the
sourceFiles/ exclusion). The seed generator (tools/seed/build_seed.py) emits
the new spellings directly.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json'
RENAME = {'Open': 'To Do', 'Resolved': 'Done'}
SCHEMA_VERSION = 115  # datamodel _meta.schemaVersion this migration belongs to


def find_table(data, name):
    for tables in data.values():
        if isinstance(tables, dict) and name in tables:
            return tables[name]
    return None


def migrate(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    tickets = find_table(data, 'Tickets')
    if tickets is None:
        print(f'{path}: no Tickets table — nothing to do')
        return 0
    rekeyed = 0
    for row in tickets:
        old = row.get('ticketStatus')
        if old in RENAME:
            row['ticketStatus'] = RENAME[old]
            rekeyed += 1
    # stamp the mockup with the datamodel version, as every migration does
    data.setdefault('_meta', {})['schemaVersion'] = SCHEMA_VERSION
    # indent=1, no ASCII escaping — the file's own format, so the diff is only the change
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'{path.relative_to(ROOT)}: {len(tickets)} Tickets rows, {rekeyed} statuses re-keyed; _meta.schemaVersion = {SCHEMA_VERSION}')
    return rekeyed


if __name__ == '__main__':
    if not TARGET.exists():
        sys.exit(f'missing {TARGET}')
    migrate(TARGET)
