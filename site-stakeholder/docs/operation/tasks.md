---
title: "Tasks"
audience: stakeholder
purpose: "Tasks — what it is, when to register one, and its key fields"
---

# Tasks

**What it is:** the executable work item of a workflow step — the level Jobs are staffed
against. Its execution time is not registered here: it derives from the task's procedures. Tasks are **requirement-free**: how a task is performed under a
given requirement set lives in its Procedures.
**Register when:** after Actions, before Procedures.
**Key fields:** `Event *` → `Process *` → Activity (the process's steps) → `Action *` →
Predecessor Task (a task of the same process executed before this one — leave it empty
for the first task).
The task's name derives from that chain (`Activity-Action`). Execution time and the
certified-people derivations stay behind the scenes (2026-08-28: those columns left the
tables — staffing eligibility keeps acting on [Jobs](../workspace/jobs.md) and the
procedure Users column): eligibility means certified competences covering all the
requirements of the task's procedures. Expanding a task row lists its registered
procedures.

**Task order (2026-09-03):** the **Indentation** column extends the
[workflow](workflows.md) outline one level down — the step's number is the base
(single digits pad a `.0`: step `1` → `1.0`) and the task's position within the step
appends last (`1.0.1`, `1.1.2`, `2.0.1`). It is derived from the predecessor chain,
never typed in, and every list of tasks (the workflow's expanded row, the ticket's
Tasks tab) sorts by it — so a planner reads the execution order of a ticket's tasks
in one place, without cross-checking the activity table.
