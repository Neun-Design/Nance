#!/usr/bin/env python3
"""Deterministic migration: competence-procedure 1:1 (2026-08-20, issue #231).

Backs the schemaVersion 42 doctrine correction — a requirement never enters a
competence automatically: the quality manager binds requirements to the
Procedure, and the competence inherits its set through a SINGLE certified
procedure (cardinality 1:1, Rafael's clarification after #226/PR #229).

`Competence.procedureID` becomes single-valued: one-element arrays unwrap to
the scalar id. Rows holding several procedures are left untouched and reported
(none exist in the demo — every competence already certifies exactly one).

Deterministic and idempotent: re-running is a no-op after the first pass.
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


def find_table(data, name):
    for tables in data.values():
        if isinstance(tables, dict) and name in tables:
            return tables[name]
    return None


def migrate(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    competences = find_table(data, 'Competence')
    if competences is None:
        print(f'{path.name}: missing Competence — skipped')
        return
    changed, kept = 0, []
    for c in competences:
        v = c.get('procedureID')
        if isinstance(v, list):
            if len(v) <= 1:
                c['procedureID'] = v[0] if v else None
                changed += 1
            else:
                kept.append(c.get('competenceID'))
    if changed:
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    note = f' (multi-procedure rows left as-is: {kept})' if kept else ''
    print(f'{path.name}: Competence={changed}{note}')


def main():
    for target in TARGETS:
        if target.exists():
            migrate(target)
        else:
            print(f'{target}: not found — skipped')


if __name__ == '__main__':
    sys.exit(main())
