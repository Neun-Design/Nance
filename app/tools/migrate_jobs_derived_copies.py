#!/usr/bin/env python3
"""Deterministic migration: drop the stored copy of Jobs.jobName, which became
a mirror in the spec (2026-09-14, issue #417, schemaVersion 114).

- Jobs.jobName → mirror → Tasks (via: taskID) (display: taskName)
Also stamps the mockup's _meta.schemaVersion (114 — the two previous debt
rounds, 112 and 113, changed no mockup rows and left the stamp at 111).

jobName was a stored copy (the seed wrote `jobName = task.taskName`) of a
value the engine now derives at render time. (Jobs.customerName stays stored:
Jobs::Report-A in queries.js groups by the raw row key.)
Derived attributes are not persisted (ADR-0002 / ADR-0003), and
validate_mockup.py flags a stored key on a mirror-typed attribute as
"extra non-canonical fields" — so the keys are removed from every Jobs row.

Deterministic and idempotent: re-running on a migrated file changes nothing.
Applies to prototype/data/mockup_data_prototype.json (the only copy since the
sourceFiles/ exclusion). The seed generator (tools/seed/build_seed.py) no
longer emits the two keys.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json'
DROP = ('jobName',)
SCHEMA_VERSION = 114  # datamodel _meta.schemaVersion this migration belongs to


def find_table(data, name):
    for tables in data.values():
        if isinstance(tables, dict) and name in tables:
            return tables[name]
    return None


def migrate(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    jobs = find_table(data, 'Jobs')
    if jobs is None:
        print(f'{path}: no Jobs table — nothing to do')
        return 0
    removed = 0
    for row in jobs:
        for key in DROP:
            if key in row:
                del row[key]
                removed += 1
    # stamp the mockup with the datamodel version, as every migration does
    data.setdefault('_meta', {})['schemaVersion'] = SCHEMA_VERSION
    # indent=1, no ASCII escaping — the file's own format, so the diff is only the change
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'{path.relative_to(ROOT)}: {len(jobs)} Jobs rows, {removed} stored copies removed; _meta.schemaVersion = {SCHEMA_VERSION}')
    return removed


if __name__ == '__main__':
    if not TARGET.exists():
        sys.exit(f'missing {TARGET}')
    migrate(TARGET)
