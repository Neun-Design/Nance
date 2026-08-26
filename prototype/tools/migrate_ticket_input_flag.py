#!/usr/bin/env python3
"""Deterministic migration: Ticket Input Flag (issue #280).

Keys every Handout row with the new stored BOOLEAN `customerFlag` — TRUE
for the documents a customer genuinely provides upon ticket creation,
picked by NAME per domain (the structural alternative — inputs never
produced as any procedure's output — flags nothing here: the demo
procedures chain handouts in a modulo rotation, so every handout is both
input and output somewhere):

- clinic (Vitalis): Medical Order, Contrast Consent Form, Sedation
  Consent Form, Sample Manifest — what the patient/referrer brings.
- transformers (legacy developer copy): Requirement Spec, Electrical
  Datasheet — what the repair customer hands over with the unit.

The same name list feeds the seed builder (`customer_inputs` in
clinic.yaml), so a regenerated dataset and a migrated one agree.

Targets both mockup copies; `_meta.schemaVersion` stamped to 57 on the
copy that carries it. Idempotent: rows already keyed are left untouched.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 57

CUSTOMER_INPUTS = {
    'Medical Order', 'Contrast Consent Form', 'Sedation Consent Form',
    'Sample Manifest',                       # clinic
    'Requirement Spec', 'Electrical Datasheet',  # transformers (legacy copy)
}


def find_table(doc, name):
    for tables in doc.values():
        if isinstance(tables, dict) and name in tables:
            return tables[name]
    return None


def migrate(path):
    raw = path.read_text(encoding='utf-8')
    doc = json.loads(raw)
    handouts = find_table(doc, 'Handouts')
    if handouts is None:
        print(f'{path.name}: no Handouts table — skipped')
        return

    touched = 0
    for h in handouts:
        if 'customerFlag' in h:
            continue  # idempotence
        h['customerFlag'] = h.get('handoutName') in CUSTOMER_INPUTS
        touched += 1

    meta = doc.get('_meta')
    if isinstance(meta, dict) and 'schemaVersion' in meta:
        meta['schemaVersion'] = SCHEMA_VERSION

    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False)
                    + ('\n' if raw.endswith('\n') else ''), encoding='utf-8')
    flagged = sum(1 for h in handouts if h.get('customerFlag') is True)
    print(f'{path.name}: {touched} handouts keyed, {flagged} flagged as customer inputs')


if __name__ == '__main__':
    for target in TARGETS:
        migrate(target)
