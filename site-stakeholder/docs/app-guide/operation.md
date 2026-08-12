---
title: "App Guide — Operation"
audience: stakeholder
purpose: "What to register in the Operation module and in which order"
---

# Operation

The QMS process chain (ISO 9001:2015 §4.4): events (registered in Portfolio) trigger
processes, processes decompose into workflow steps, steps carry tasks with inputs and outputs.

## Requirements

**What it is:** the regulatory/design/commercial limits that bind scopes and product groups
(e.g. "IEC 60076 Compliance") — moved here from Portfolio (2026-08-12). Applicability is
multi-dimensional: region, unit, branch, customer, scope, product group — **an empty
dimension means "applies to all"**.
**Register when:** after Scopes and Product Groups (Portfolio module).
**Key fields:** Name, Type (create new types inline with the "+" button); the applicability
cascade Region → Business Unit → Branch/Customer/Scope/Product Group; regulatory reference/URL.

## Processes

**What it is:** a top-level flow triggered by an event, run by a squad.
**Register when:** after Events (Portfolio module).
**Key fields:** Registry number, Name, Description; `Event *` → unlocks **Department**
(departments of the event's unit) and **Product Scopes** (multi — offered from the event's
applicability, empty = covers all); Department → unlocks Squad (squads of the process's own
department); Owner; Status; Version.

## Workflows

**What it is:** the ordered steps of a process — the process map. Step numbers (1, 2, 2.1…)
are computed from each step's parent and indentation rule; you never type them.
**Register when:** after Processes.
**Key fields:** `Process *` → unlocks Activity and Parent Step (steps of the same process);
Indentation Rule (start-to-finish = next number, start-to-start = sub-number under the parent).

## Actions

**What it is:** discrete quality interventions a task executes (approval, verification…).
**Register when:** before Tasks. Actions has **no dashboard tab** — register them inline with
the "+" button on the Task form's Action field (hidden-registry pattern).

## Handouts

**What it is:** the documents/templates that flow through channels — procedures consume
handouts as inputs and produce them as outputs. (Channels are a hidden registry: each
handout names its channel inline.)
**Register when:** before Procedures; handouts can also be created inline from the
Procedure form.

## Tasks

**What it is:** the executable work item of a workflow step — the level Jobs are staffed
against. Its execution time is not registered here: it derives from the task's procedures. Tasks are **requirement-free**: how a task is performed under a
given requirement set lives in its Procedures.
**Register when:** after Actions, before Procedures.
**Key fields:** `Event *` → `Process *` → Activity (the process's steps) → `Action *`;
execution time. Expanding a task row lists its registered procedures.

## Procedures

**What it is:** the documented method for executing a task (ISO §4.4/§7.5). Each row
registers how a task is performed under a given **requirement set**, with its own input and
output handouts — the same task can carry several procedures, one per requirement variant.
An empty requirement list means the procedure applies to every requirement.
**Register when:** last in the module — after Tasks; before Competence (a competence
certifies procedures).
**Key fields:** registry code and URL of the controlled document; `Unit` → `Process` (the
unit's processes) → `Task *` (the anchor); **Product Scopes** (multi — offered from the
process's list, empty = applies to all); Requirements follows the selected product scopes
(their derived requirement sets — with none selected, the task's set); **execution time**
(hours under THIS requirement set — procedures create the variance in task duration; the
task shows the sum); Inputs/Outputs offer only handouts that are free or already on this
chain; accountable owner. Expanding a procedure shows its handout tabs and product scopes.
