#!/usr/bin/env python3
"""Deterministic migration: competence procedure GROUP (2026-08-26, issue #284).

Backs the schemaVersion 58 cardinality change — `Competence.procedureID`
returns to 1:many (reverting the #231 1:1; the #231 doctrine is KEPT: the
quality manager binds requirements on the Procedure, the competence inherits
the UNION of its procedures' sets; one Q1-wildcard procedure in the group
certifies everything — decision recorded in #284). The group stays restricted
to the competence's task (the form picker filters by Task).

Two changes per Competence row:
- `procedureID` becomes an ARRAY: scalar values wrap into a singleton list
  (None/'' → []); rows already holding a list are left untouched.
- new stored `competenceTitle` (NOT NULL — the table label): seeded
  deterministically as "<stored task name> | <scope name>" (scope via the
  certified product scope), falling back to the task name alone, then to
  "Competence <competenceID>". Rows already titled are left untouched.

Deterministic and idempotent: re-running is a no-op after the first pass.
Applies to both mockup copies (prototype/data + sourceFiles/developer) and
stamps `_meta.schemaVersion = 58`.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 58


def find_table(data, name):
    for tables in data.values():
        if isinstance(tables, dict) and name in tables:
            return tables[name]
    return None


def index_by(rows, key):
    return {r.get(key): r for r in (rows or []) if r.get(key) is not None}


def seed_title(comp, tasks_ix, ps_ix, scopes_ix):
    task = tasks_ix.get(comp.get('taskID'))
    task_name = (task or {}).get('taskName')
    ps = ps_ix.get(comp.get('productScopeID'))
    scope = scopes_ix.get((ps or {}).get('scopeID'))
    scope_name = (scope or {}).get('scopeName')
    if task_name and scope_name:
        return f'{task_name} | {scope_name}'
    if task_name:
        return task_name
    return f"Competence {comp.get('competenceID')}"


def migrate(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    competences = find_table(data, 'Competence')
    if competences is None:
        print(f'{path.name}: missing Competence — skipped')
        return
    tasks_ix = index_by(find_table(data, 'Tasks'), 'taskID')
    ps_ix = index_by(find_table(data, 'Product Scopes'), 'productScopeID')
    scopes_ix = index_by(find_table(data, 'Scopes'), 'scopeID')
    wrapped, titled = 0, 0
    for c in competences:
        v = c.get('procedureID')
        if not isinstance(v, list):
            c['procedureID'] = [v] if v not in (None, '') else []
            wrapped += 1
        if not c.get('competenceTitle'):
            c['competenceTitle'] = seed_title(c, tasks_ix, ps_ix, scopes_ix)
            titled += 1
    stamped = data.get('_meta', {}).get('schemaVersion') != SCHEMA_VERSION
    if stamped:
        data.setdefault('_meta', {})['schemaVersion'] = SCHEMA_VERSION
    if wrapped or titled or stamped:
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'{path.name}: procedureID wrapped={wrapped} titled={titled} '
          f'schemaVersion={data.get("_meta", {}).get("schemaVersion")}')


def main():
    for target in TARGETS:
        if target.exists():
            migrate(target)
        else:
            print(f'{target}: not found — skipped')


if __name__ == '__main__':
    main()
