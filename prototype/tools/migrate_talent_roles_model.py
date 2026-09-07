#!/usr/bin/env python3
"""Deterministic migration: Talent Roles model (issue #328).

The direct role ↔ skill level and role ↔ job family links are retired —
the skill level is defined per Competence (the competence defines the
role + level pair, and a person accumulates those pairs through
onboarding) and the job family inherits through the Function (#298).
The role instead gains the departments where it is exercised:

- `Roles.skillLevelID` / `Roles.jobFamilyID` are DROPPED from every row
  (the parity validator requires removed stored attrs to leave the data).
- `Roles.departmentID` (multivalued) is seeded per role from its
  function: the departments where the function's PEOPLE sit, restricted
  to the function's business units — the form picker only offers
  in-unit departments (generic shared-unit join), and a seeded value
  outside the options would be wiped on edit (the form-integrity trap).
  First-seen People row order; no in-unit people signal falls back to
  the unit's first department (row order); a unit with no departments
  leaves an honest [].
- `Job Family.field` is RENAMED `jobFamilyDescription` (the stored
  values were already description-shaped free text).

The seed builder runs the same department rule after seeding People
(build_seed.py in lockstep) — a regenerated dataset and a migrated one
agree.

Targets both mockup copies; `_meta.schemaVersion` stamped to 78 on the
copy that carries it. Idempotent.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 78


def find_table(doc, name):
    for tables in doc.values():
        if isinstance(tables, dict) and name in tables:
            return tables[name]
    return None


def as_list(v):
    return v if isinstance(v, list) else [] if v in (None, '') else [v]


def depts_for_function(fid, fns, people, departments):
    """Shared rule with build_seed.py — keep the two in lockstep."""
    fn = next((f for f in fns if str(f.get('functionID')) == str(fid)), None)
    if fn is None:
        return []
    units = {str(u) for u in as_list(fn.get('businessUnitID'))}
    in_unit = [d['departmentID'] for d in departments
               if str(d.get('businessUnitID')) in units]
    in_unit_set = {str(d) for d in in_unit}
    seen, out = set(), []
    for p in people:
        if str(p.get('functionID')) != str(fid):
            continue
        dep = p.get('departmentID')
        if dep in (None, '') or str(dep) not in in_unit_set or str(dep) in seen:
            continue
        seen.add(str(dep))
        out.append(dep)
    return out if out else in_unit[:1]


def migrate(path):
    raw = path.read_text(encoding='utf-8')
    doc = json.loads(raw)
    roles = find_table(doc, 'Roles')
    if roles is None:
        print(f'{path.name}: no Roles table — skipped')
        return
    fns = find_table(doc, 'Functions') or []
    people = find_table(doc, 'People') or []
    departments = find_table(doc, 'Departments') or []
    families = find_table(doc, 'Job Family') or []

    dropped, keyed = 0, 0
    for r in roles:
        for gone in ('skillLevelID', 'jobFamilyID'):
            if gone in r:
                del r[gone]
                dropped += 1
        if 'departmentID' not in r:  # idempotence
            r['departmentID'] = depts_for_function(
                r.get('functionID'), fns, people, departments)
            keyed += 1
    renamed = 0
    for jf in families:
        if 'field' in jf:
            jf['jobFamilyDescription'] = jf.pop('field')
            renamed += 1

    meta = doc.get('_meta')
    if isinstance(meta, dict) and 'schemaVersion' in meta:
        meta['schemaVersion'] = SCHEMA_VERSION

    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False)
                    + ('\n' if raw.endswith('\n') else ''), encoding='utf-8')
    empty = sum(1 for r in roles if not r.get('departmentID'))
    print(f'{path.name}: {keyed} roles keyed with departments ({empty} empty), '
          f'{dropped} legacy keys dropped, {renamed} families renamed field → description')


if __name__ == '__main__':
    for target in TARGETS:
        migrate(target)
