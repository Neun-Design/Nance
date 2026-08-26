#!/usr/bin/env python3
"""Deterministic demo enrichment: procedure GROUPS on competences (2026-08-26,
follow-up of issue #284).

The clinic demo was honest-singleton after #284 — one procedure per task, so
every competence group had one member and the 1:many cardinality had no
visible effect. This migration adds THREE variant procedures (same task as
their base SOP — the group stays task-scoped, the #284 decision) and appends
them to the certified competences' groups, exercising both sides of the #270
coverage semantics (procedure set ⊇ ticket set, empty = Q1 wildcard):

- PRC47 "SOP-001-G" — GENERAL (wildcard) variant of PRC01 (T001, Contrast):
  T001's ticket cells flip GAP → SOP-001-G (the specific SOP never covers a
  rich ticket context; the general one always does), and CMP01's group now
  holds a wildcard → the competence certifies every requirement (decision
  kept in #284).
- PRC48 "SOP-002-C" — CONTRAST-specific variant of PRC02 (T002, wildcard):
  tickets keep resolving to SOP-002 (the specific variant never covers), the
  STANDALONE Tasks drawer flips to GAP for T002 (two procedures, no context —
  genuine ambiguity), and CMP02's requirement column shows the union.
- PRC49 "SOP-011-G" — general variant of PRC11 (T011, ISO 15189): the lab-side
  GAP rescue, smaller footprint (23 cells).

Variants copy every stored attribute from their base SOP (same handouts, same
execution time, same served pairs) except id/registry/requirement set.
The same deterministic rule runs in the seed builder (`_procedure_variants`
in build_seed.py), so regenerated and migrated datasets agree.

Also re-freezes the affected jobs' `plannedExecutionTime` (R6 hygiene: the
plan is the task's procedure-hours SUM, and the variants raise it). Run
`tools/derive_control.py` afterwards — job plans feed Performance, and the
validator's control gate compares stored rows against the derivation.

Deterministic and idempotent; clinic-gated (`_meta.domain == 'clinic'` — the
legacy developer copy is left untouched). Data-only: no schema change, no
schemaVersion bump.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]

# (variant id, registry suffix, base procedure id, competence, requirement names)
VARIANTS = [
    ('PRC47', '-G', 'PRC01', 'CMP01', []),
    ('PRC48', '-C', 'PRC02', 'CMP02', ['Contrast Administration Protocol']),
    ('PRC49', '-G', 'PRC11', 'CMP11', []),
]


def find_table(data, name):
    for tables in data.values():
        if isinstance(tables, dict) and name in tables:
            return tables[name]
    return None


def migrate(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    if data.get('_meta', {}).get('domain') != 'clinic':
        print(f'{path.name}: not the clinic demo — skipped')
        return
    procedures = find_table(data, 'Procedures')
    competences = find_table(data, 'Competence')
    requirements = find_table(data, 'Requirements')
    if procedures is None or competences is None:
        print(f'{path.name}: missing tables — skipped')
        return
    proc_ix = {p['procedureID']: p for p in procedures}
    comp_ix = {c['competenceID']: c for c in competences}
    req_ix = {r['requirementName']: r['requirementID'] for r in (requirements or [])}
    added, grouped = 0, 0
    for vid, suffix, base_id, comp_id, req_names in VARIANTS:
        base = proc_ix.get(base_id)
        comp = comp_ix.get(comp_id)
        if base is None or comp is None:
            print(f'{path.name}: {base_id}/{comp_id} missing — variant {vid} skipped')
            continue
        if vid not in proc_ix:
            variant = dict(base)
            variant['procedureID'] = vid
            variant['procedureRegistry'] = f"{base['procedureRegistry']}{suffix}"
            variant['requirementID'] = [req_ix[n] for n in req_names]
            procedures.append(variant)
            proc_ix[vid] = variant
            added += 1
        group = comp.get('procedureID')
        if not isinstance(group, list):
            group = [group] if group not in (None, '') else []
        if vid not in group:
            comp['procedureID'] = group + [vid]
            grouped += 1
    # re-freeze the affected jobs' plans (R6 hygiene: plannedExecutionTime is
    # frozen from the task's procedure-hours SUM — a variant raises the sum,
    # so jobs on the variant tasks re-freeze deterministically; the seed
    # builder recomputes proc_hours after the variants and needs no fix)
    refrozen = 0
    variant_tasks = {proc_ix[v[0]]['taskID'] for v in VARIANTS if v[0] in proc_ix}
    hours = {}
    for p in procedures:
        hours[p['taskID']] = hours.get(p['taskID'], 0) + (p.get('executionTime') or 0)
    for j in (find_table(data, 'Jobs') or []):
        if j.get('taskID') in variant_tasks:
            plan = round(hours[j['taskID']], 2)
            if j.get('plannedExecutionTime') != plan:
                j['plannedExecutionTime'] = plan
                refrozen += 1
    if added or grouped or refrozen:
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'{path.name}: variants added={added} groups extended={grouped} job plans refrozen={refrozen}')


def main():
    for target in TARGETS:
        if target.exists():
            migrate(target)
        else:
            print(f'{target}: not found — skipped')


if __name__ == '__main__':
    main()
