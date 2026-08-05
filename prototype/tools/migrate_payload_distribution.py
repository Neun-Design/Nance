#!/usr/bin/env python3
"""Deterministic migration: the Payload distribution round (issue #159, 2026-08-05).

The ER-model Payload — the dispatch carrier of business context — distributes
into the prototype's Event and Process entities: Events declare applicability
(scopes/products), Processes materialize department + product scopes, and
Procedures chain product scopes from their process.

Data side (everything derives from existing values; new applicability keys
seed EMPTY = applies to all, the Q1 wildcard — nobody has registered event
applicability yet):

  Processes   departmentID = the department its EVENT carried (moved down);
              productScopeID = []
  Events      drop departmentID; scopeID = []; productID = []
  Procedures  drop the stored departmentID key; productScopeID = []

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
    op = find_module(data, 'Events')
    if not op:
        print(f'{path.name}: no Events table — skipped')
        return
    events = {str(e.get('eventID')): e for e in data[op].get('Events', [])}

    proc_moved = 0
    for pr in data[op].get('Processes', []):
        if 'departmentID' not in pr:
            ev = events.get(str(pr.get('eventID'))) or {}
            pr['departmentID'] = ev.get('departmentID')
            proc_moved += 1
        pr.setdefault('productScopeID', [])

    ev_changed = 0
    for ev in data[op].get('Events', []):
        if 'departmentID' in ev:
            ev.pop('departmentID')
            ev_changed += 1
        ev.setdefault('scopeID', [])
        ev.setdefault('productID', [])

    prc_changed = 0
    for pc in data[op].get('Procedures', []):
        if 'departmentID' in pc:
            pc.pop('departmentID')
            prc_changed += 1
        pc.setdefault('productScopeID', [])

    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    print(f'{path.name}: {proc_moved} process department(s) materialized, '
          f'{ev_changed} event key(s) dropped, {prc_changed} procedure key(s) dropped')


for target in TARGETS:
    if target.exists():
        migrate(target)
