#!/usr/bin/env python3
"""Deterministic migration: derived Workflow indentation (2026-07-30).

`indentationID` became a DERIVED value (rule `computed: STEPORDER(parentStepID,
indentationRule) per processID` — see prototype/identation-rule.md): the engine
numbers the steps of each process at render time, so the stored column goes
away. Legacy rows carried the number but not the `indentationRule` that now
drives it, so the migration:

  1. infers `indentationRule` from the legacy number — a dotted number (2.1)
     means the step ran parallel to siblings ("finish-to-finish"); a plain
     number under a parent means sequential ("start-to-finish"); roots keep
     no rule;
  2. drops the stored `indentationID`.

Idempotent: rows without `indentationID` are left untouched.

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
        if isinstance(tables, dict) and name in tables and isinstance(tables[name], list):
            return tables[name]
    return None


def migrate(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    workflows = find_table(data, 'Workflows')
    if workflows is None:
        print(f'{path.name}: no Workflows table — skipped')
        return
    changed = 0
    for w in workflows:
        if 'indentationID' not in w:
            continue
        legacy = str(w.pop('indentationID') or '')
        if w.get('parentStepID'):
            w['indentationRule'] = 'finish-to-finish' if '.' in legacy else 'start-to-finish'
        else:
            w.setdefault('indentationRule', None)
        changed += 1
    if changed:
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'{path.name}: {changed} workflow row(s) migrated')


def main():
    for target in TARGETS:
        if target.exists():
            migrate(target)
        else:
            print(f'{target}: not found — skipped')


if __name__ == '__main__':
    sys.exit(main())
