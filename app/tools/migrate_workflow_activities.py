#!/usr/bin/env python3
"""Deterministic migration: Workflows.activityID (v3-review R5, D3 approved).

Activities becomes a hidden registry (dashboard-order 0, created inline via
the '+' button) and each workflow step stores the activity it executes
(step = activity x process). Seed the existing steps:

  Workflows.activityID  the Activity whose activityName equals the step's
                        stored workflowName (21/21 homonymous in the demo);
                        step names with no matching activity get one CREATED
                        (next A## id, name = step name) so the FK is total --
                        the registry is meant to mirror the step vocabulary

Idempotent: workflows already carrying a non-empty activityID are untouched.
Applies to both mockup copies (prototype/data + sourceFiles/developer).
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]


def next_activity_id(activities):
    best = 0
    for a in activities:
        m = re.fullmatch(r'A(\d+)', str(a.get('activityID') or ''))
        if m:
            best = max(best, int(m.group(1)))
    return f'A{best + 1:02d}'


def migrate(path: Path) -> None:
    if not path.exists():
        print(f'skip (missing): {path}')
        return
    doc = json.loads(path.read_text(encoding='utf-8'))
    ops = doc.get('Operation') or {}
    activities = ops.setdefault('Activities', [])
    by_name = {str(a.get('activityName') or '').lower(): a['activityID'] for a in activities}

    linked, created = 0, 0
    for w in ops.get('Workflows') or []:
        if w.get('activityID'):
            continue
        name = str(w.get('workflowName') or '').strip()
        aid = by_name.get(name.lower())
        if aid is None and name:
            aid = next_activity_id(activities)
            activities.append({'activityID': aid, 'activityName': name,
                              'activityDescription': None, 'activityOwner': None})
            by_name[name.lower()] = aid
            created += 1
        w['activityID'] = aid
        linked += 1

    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + '\n',
                    encoding='utf-8')
    print(f'{path.relative_to(ROOT)}: {linked} step(s) linked, {created} activity(ies) created')


if __name__ == '__main__':
    for target in TARGETS:
        migrate(target)
    sys.exit(0)
