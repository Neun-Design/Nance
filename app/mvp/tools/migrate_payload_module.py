#!/usr/bin/env python3
"""Deterministic migration: Payload moves to Portfolio (2026-09-07).

The Payload entity (issue #190) leaves the Operation module for
Portfolio — it packages an Event with the Product Scopes it admits, and
both parents are Portfolio tables. Rows are untouched; only the module
NESTING moves: the parity validator matches mockup tables BY MODULE
(`MOCK[module][table]`), so the rows must live under the module the
catalogue declares. The runtime loader flattens modules and never
noticed — this is validator/catalogue parity only.

The seed builder is catalogue-driven (`module_of` comes from the live
datamodel), so a regenerated dataset nests Payload under Portfolio
automatically.

Targets both mockup copies; `_meta.schemaVersion` stamped to 79 on the
copy that carries it. Idempotent.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 79


def migrate(path):
    raw = path.read_text(encoding='utf-8')
    doc = json.loads(raw)
    op = doc.get('Operation')
    pf = doc.get('Portfolio')
    if not isinstance(op, dict) or not isinstance(pf, dict):
        print(f'{path.name}: module nesting missing — skipped')
        return
    moved = 0
    if 'Payload' in op:  # idempotence
        pf['Payload'] = op.pop('Payload')
        moved = len(pf['Payload'])

    meta = doc.get('_meta')
    if isinstance(meta, dict) and 'schemaVersion' in meta:
        meta['schemaVersion'] = SCHEMA_VERSION

    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False)
                    + ('\n' if raw.endswith('\n') else ''), encoding='utf-8')
    print(f'{path.name}: Payload nested under Portfolio '
          f'({moved} rows moved)' if moved else
          f'{path.name}: already nested under Portfolio (no-op)')


if __name__ == '__main__':
    for target in TARGETS:
        migrate(target)
