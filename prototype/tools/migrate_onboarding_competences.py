#!/usr/bin/env python3
"""Deterministic migration: Onboarding certifies a competence GROUP (issue #239).

Onboarding.competenceID goes 1:many (multivalued):

    "competenceID": "CMP01"  ->  "competenceID": ["CMP01"]

and every row gains the new label attribute `onboardingTitle`, seeded from
the certified competences' TASK names (competenceName is a multi-hop
CONCAT the migration can't reproduce; Tasks.taskName is stored since the
#214 re-seed and names what the competence certifies). Rows whose chain
doesn't resolve fall back to "Onboarding <onboardID>" (the legacy
sourceFiles copy stores no taskName — all fallback there). No rows are
merged — grouping several competences under one onboarding is a UI
decision going forward, not something a migration should invent.

Idempotent: array-valued competenceID and present onboardingTitle are
untouched. Applies to both mockup copies (prototype/data +
sourceFiles/developer).
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
    onboardings = find_table(data, 'Onboarding')
    if onboardings is None:
        print(f'{path.name}: no Onboarding table — skipped')
        return
    task_names = {}
    for t in find_table(data, 'Tasks') or []:
        task_names[t.get('taskID')] = t.get('taskName')
    comp_tasks = {}
    for c in find_table(data, 'Competence') or []:
        comp_tasks[c.get('competenceID')] = c.get('taskID')
    listed = titled = 0
    for ob in onboardings:
        cid = ob.get('competenceID')
        if not isinstance(cid, list):
            ob['competenceID'] = [cid] if cid not in (None, '') else []
            listed += 1
        if not ob.get('onboardingTitle'):
            names = []
            for c in ob['competenceID']:
                n = task_names.get(comp_tasks.get(c))
                if n and n not in names:
                    names.append(n)
            ob['onboardingTitle'] = ', '.join(names) if names \
                else f"Onboarding {ob.get('onboardID', '?')}"
            titled += 1
    if listed or titled:
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
        print(f'{path.name}: competenceID listed={listed}, titles seeded={titled}')
    else:
        print(f'{path.name}: no changes')


def main():
    for target in TARGETS:
        if target.exists():
            migrate(target)
        else:
            print(f'{target}: not found — skipped')


if __name__ == '__main__':
    sys.exit(main())
