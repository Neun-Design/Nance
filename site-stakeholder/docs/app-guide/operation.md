---
title: "App Guide — Operation"
audience: stakeholder
purpose: "What to register in the Operation module and in which order"
---

# Operation

The QMS process chain (ISO 9001:2015 §4.4): events trigger processes, processes decompose into
workflow steps, steps carry tasks with inputs and outputs.

## Events

**What it is:** the business occurrences that drive the QMS — the architectural pivot of the
model.
**Register when:** first in the module; Competence (phase 6) also anchors on events.
**Key fields:** Title, Description; `Business Unit *` → unlocks `Department *` (only the
unit's departments).

## Processes

**What it is:** a top-level flow triggered by an event, run by a squad.
**Register when:** after Events.
**Key fields:** Registry number, Name, Description; `Event *` → unlocks Squad (squads of the
department handling the event); Owner; Status; Version.

## Workflows

**What it is:** the ordered steps of a process — the process map. Step numbers (1, 2, 2.1…)
are computed from each step's parent and indentation rule; you never type them.
**Register when:** after Processes.
**Key fields:** `Process *` → unlocks Activity and Parent Step (steps of the same process);
Indentation Rule (start-to-finish = next number, start-to-start = sub-number under the parent).

## Actions

**What it is:** discrete quality interventions a task executes (approval, verification…).
**Register when:** before Tasks.

## Channels

**What it is:** the communication channels documents flow through.
**Register when:** before Handouts (each handout names its channel).

## Handouts

**What it is:** the documents/templates that flow through channels — tasks consume handouts
as inputs and produce them as outputs.
**Register when:** before Tasks; handouts can also be created inline from the Task form.

## Tasks

**What it is:** the executable work item of a workflow step, with execution time, inputs and
outputs — the level Jobs are staffed against.
**Register when:** last in the module.
**Key fields:** `Event *` → `Process *` → Activity (the process's steps) → `Action *`;
Inputs/Outputs offer only handouts that are free or already on this chain; execution time.
