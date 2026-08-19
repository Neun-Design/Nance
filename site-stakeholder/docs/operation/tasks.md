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
**Key fields:** `Event *` → `Process *` → Activity (the process's steps) → `Action *`;
execution time. The task's name derives from that chain (`Activity-Action`), and the
**Users** column derives live the certified people eligible for the task — those whose
certified competences cover all the requirements of its procedures. Expanding a task row
lists its registered procedures.
