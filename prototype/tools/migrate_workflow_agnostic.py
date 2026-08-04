#!/usr/bin/env python3
"""Deterministic migration: the 2026-08-04 coherence round.

Completes Rafael's datamodel edits under the Procedures doctrine
("Process, workflows and tasks do not change depending on product scopes or
requirements" — v3-review Iterations):

  Workflows  drop the stored customerID / productScopeID keys — workflows are
             applicability-agnostic; requirements bite at the Procedure
             (Procedures.requirementID) and the customer lives on the Ticket.
             Also drops the stale scopes / procedures display copies (their
             source Tasks fields left in the Procedures round).
  People     isActive boolean -> 'Active'/'Inactive' enum (same treatment
             Requirements got in the regions round).

Idempotent; applies to every mockup copy that carries the tables.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]


def find_module(data, table):
    for mod, tables in data.items():
        if isinstance(tables, dict) and table in tables:
            return mod
    return None


def migrate(path):
    data = json.loads(path.read_text())
    wf_mod = find_module(data, 'Workflows')
    wf_changed = 0
    if wf_mod:
        for row in data[wf_mod]['Workflows']:
            for k in ('customerID', 'productScopeID', 'scopes', 'procedures'):
                if k in row:
                    row.pop(k)
                    wf_changed += 1
    pe_mod = find_module(data, 'People')
    pe_changed = 0
    if pe_mod:
        for row in data[pe_mod]['People']:
            v = row.get('isActive')
            if isinstance(v, bool):
                row['isActive'] = 'Active' if v else 'Inactive'
                pe_changed += 1
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    print(f'{path.name}: {wf_changed} workflow key(s) dropped, {pe_changed} people flag(s) enumified')


for target in TARGETS:
    if target.exists():
        migrate(target)
