#!/usr/bin/env python3
"""Deterministic migration: the Procedures entity (2026-08-03, v3-review Iterations round).

Rafael's model decision: Process/Workflow/Task are requirement-free; the
PROCEDURE is where requirements bite (and carries the input/output handouts —
decision A5); Competence certifies procedures (requirements derive through
them). Everything derives from existing values:

  Procedures     one row per Task that carries the legacy procedureName /
                 procedureURL pair (all demo tasks do) — PRC01… in taskID
                 order. Chain FKs derive from the task: processID (stored on
                 the task), departmentID via the task's event, businessUnitID
                 via that department. requirementID = the union of the
                 requirement sets of the competences linked to the task
                 (demo data has exactly one distinct set per task); tasks
                 no competence references keep [] (= applies to all, Q1).
                 taskInput/taskOutput come from the task's stored pair when
                 present, else from its workflow's inputs/outputs (the demo
                 data carried the handout links at the workflow level);
                 procedureOwner = taskOwner (accountability follows the
                 task, A6).
  Tasks          drop procedureName, procedureURL, taskInput, taskOutput.
  Competence     procedureID = the procedures of the row's taskID whose
                 requirement set matches the row's legacy stored set;
                 drop the stored requirementID (now derived via procedures).

Idempotent: skipped when the target already has a Procedures table with rows.
Applies to every mockup copy that carries the tables.
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


def as_list(v):
    if v is None or v == '':
        return []
    return list(v) if isinstance(v, list) else [v]


def migrate(path):
    data = json.loads(path.read_text())
    op = find_module(data, 'Tasks')
    talent = find_module(data, 'Competence')
    if not op:
        print(f'{path.name}: no Tasks table — skipped')
        return
    if data.get(op, {}).get('Procedures'):
        print(f'{path.name}: Procedures already seeded — skipped')
        return

    tasks = data[op]['Tasks']
    workflows = {r['workflowID']: r for r in data[op].get('Workflows', [])}
    events = {r['eventID']: r for r in data[op].get('Events', [])}
    org = find_module(data, 'Departments')
    departments = {r['departmentID']: r for r in data.get(org, {}).get('Departments', [])} if org else {}
    comps = data.get(talent, {}).get('Competence', []) if talent else []

    # requirement sets per task, from the competences that reference it
    req_sets = {}
    for c in comps:
        tid = c.get('taskID')
        if tid is None:
            continue
        req_sets.setdefault(str(tid), set()).update(as_list(c.get('requirementID')))

    procedures = []
    by_task = {}
    for i, t in enumerate(sorted(tasks, key=lambda r: str(r.get('taskID', ''))), 1):
        tid = t.get('taskID')
        ev = events.get(t.get('eventID')) or {}
        dept = departments.get(ev.get('departmentID')) or {}
        wf = workflows.get(t.get('workflowID')) or {}
        proc = {
            'procedureID': f'PRC{i:02d}',
            'procedureRegistry': t.get('procedureName') or f'PRC-{tid}',
            'procedureURL': t.get('procedureURL'),
            'businessUnitID': dept.get('businessUnitID'),
            'departmentID': ev.get('departmentID'),
            'processID': t.get('processID'),
            'taskID': tid,
            'requirementID': sorted(req_sets.get(str(tid), set())),
            'taskInput': as_list(t.get('taskInput')) or as_list(wf.get('inputs')),
            'taskOutput': as_list(t.get('taskOutput')) or as_list(wf.get('outputs')),
            'procedureOwner': t.get('taskOwner'),
        }
        procedures.append(proc)
        by_task[str(tid)] = proc['procedureID']

    data[op]['Procedures'] = procedures

    for t in tasks:
        for k in ('procedureName', 'procedureURL', 'taskInput', 'taskOutput'):
            t.pop(k, None)

    linked = 0
    for c in comps:
        pid = by_task.get(str(c.get('taskID')))
        c['procedureID'] = [pid] if pid else []
        if pid:
            linked += 1
        c.pop('requirementID', None)

    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    print(f'{path.name}: {len(procedures)} procedure(s) seeded; '
          f'{linked}/{len(comps)} competence(s) linked')


for target in TARGETS:
    if target.exists():
        migrate(target)
