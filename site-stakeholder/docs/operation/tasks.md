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
**Key fields:** `Event *` → `Process *` → Activity (the process's steps) → `Action *`.
The task's name derives from that chain (`Activity-Action`). Execution time and the
certified-people derivations stay behind the scenes (2026-08-28: those columns left the
tables — staffing eligibility keeps acting on [Jobs](../workspace/jobs.md) and the
procedure Users column): eligibility means certified competences covering all the
requirements of the task's procedures. Expanding a task row lists its registered
procedures.
