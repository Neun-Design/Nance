#!/usr/bin/env python3
"""Deterministic migration: Graduation becomes Job Family (issue #166).

The Graduation entity added no value to the model — what Talent needs is
the HR-standard Job Family grouping. The table renames wholesale
(Factories → Customers precedent):

  table   Graduation        -> Job Family
  pk      graduationID      -> jobFamilyID   (row ids keep their values)
  label   graduationTitle   -> jobFamilyName
  owner   graduationOwner   -> jobFamilyOwner
  dropped institutionName, graduationName (the CONCAT with the institution
          collapses to the name itself once the institution is gone)

FK references follow: Roles.graduationID / People.graduationID ->
jobFamilyID (values unchanged).

Idempotent: copies already carrying 'Job Family' (or without the legacy
keys) are left untouched. Applies to every mockup copy with the table.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]

RENAME = {'graduationID': 'jobFamilyID', 'graduationTitle': 'jobFamilyName',
          'graduationOwner': 'jobFamilyOwner'}
DROP = ('institutionName', 'graduationName')


def find_module(data, table):
    for mod, tables in data.items():
        if isinstance(tables, dict) and table in tables:
            return mod
    return None


def migrate(path):
    data = json.loads(path.read_text())
    mod = find_module(data, 'Graduation')
    rows_done = fks_done = 0
    if mod:
        rows = data[mod].pop('Graduation')
        for row in rows:
            for old, new in RENAME.items():
                if old in row:
                    row[new] = row.pop(old)
            for k in DROP:
                row.pop(k, None)
            rows_done += 1
        # keep the table at its position in the module map
        rebuilt = {}
        for k, v in data[mod].items():
            rebuilt[k] = v
        rebuilt['Job Family'] = rows
        data[mod] = rebuilt
    for tname in ('Roles', 'People'):
        tmod = find_module(data, tname)
        if not tmod:
            continue
        for row in data[tmod][tname]:
            if 'graduationID' in row:
                row['jobFamilyID'] = row.pop('graduationID')
                fks_done += 1
    if not mod and not fks_done:
        print(f'{path.name}: nothing to migrate — skipped')
        return
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    print(f'{path.name}: {rows_done} row(s) renamed, {fks_done} FK reference(s) moved')


for target in TARGETS:
    if target.exists():
        migrate(target)
