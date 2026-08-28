#!/usr/bin/env python3
"""Deterministic migration: Function Job Family (issue #298).

A function belongs to a Job Family — the link is stored on the Function
and People derive their family through the selected function:

- `Functions.jobFamilyID` is seeded from the function's ROLES (Roles
  store both functionID and jobFamilyID since the Alpha rename): the
  most common family among the function's roles, first-seen order on
  ties; fallback: the most common family stored on the function's
  PEOPLE; no signal at all leaves the key null (honest — the legacy
  developer copy's Manager function has no roles).
- `People.jobFamilyID` becomes a derived mirror through functionID —
  the stored copies are DROPPED from every row (the parity validator
  requires removed stored attrs to leave the data).

The seed builder derives the same link from the domain pack's
function→family map (`fam_of_fn`), which is also what seeded the roles —
a regenerated dataset and a migrated one agree.

Targets both mockup copies; `_meta.schemaVersion` stamped to 65 on the
copy that carries it. Idempotent.
"""
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 65


def find_table(doc, name):
    for tables in doc.values():
        if isinstance(tables, dict) and name in tables:
            return tables[name]
    return None


def as_list(v):
    return v if isinstance(v, list) else [] if v in (None, '') else [v]


def family_of(fid, roles, people):
    votes = Counter()
    order = {}
    for r in roles:
        if str(fid) not in [str(x) for x in as_list(r.get('functionID'))]:
            continue
        for jf in as_list(r.get('jobFamilyID')):
            votes[jf] += 1
            order.setdefault(jf, len(order))
    if not votes:
        for p in people:
            if str(p.get('functionID')) != str(fid):
                continue
            for jf in as_list(p.get('jobFamilyID')):
                votes[jf] += 1
                order.setdefault(jf, len(order))
    if not votes:
        return None
    best = max(votes.values())
    return min((jf for jf, n in votes.items() if n == best), key=lambda jf: order[jf])


def migrate(path):
    raw = path.read_text(encoding='utf-8')
    doc = json.loads(raw)
    fns = find_table(doc, 'Functions')
    roles = find_table(doc, 'Roles') or []
    people = find_table(doc, 'People') or []
    if fns is None:
        print(f'{path.name}: no Functions table — skipped')
        return

    keyed = 0
    for fn in fns:
        if 'jobFamilyID' in fn:
            continue  # idempotence
        fn['jobFamilyID'] = family_of(fn.get('functionID'), roles, people)
        keyed += 1
    dropped = 0
    for p in people:
        if 'jobFamilyID' in p:
            del p['jobFamilyID']
            dropped += 1

    meta = doc.get('_meta')
    if isinstance(meta, dict) and 'schemaVersion' in meta:
        meta['schemaVersion'] = SCHEMA_VERSION

    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False)
                    + ('\n' if raw.endswith('\n') else ''), encoding='utf-8')
    nulls = sum(1 for fn in fns if fn.get('jobFamilyID') is None)
    print(f'{path.name}: {keyed} functions keyed ({nulls} without signal), '
          f'{dropped} people dropped the stored family')


if __name__ == '__main__':
    for target in TARGETS:
        migrate(target)
