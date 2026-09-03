---
title: "Procedures"
audience: stakeholder
purpose: "Procedures — what it is, when to register one, and its key fields"
---

# Procedures

**What it is:** the documented method for executing a task (ISO §4.4/§7.5). Each row
registers how a task is performed under a given **requirement set**, with its own input and
output handouts — the same task can carry several procedures, one per requirement variant.
An empty requirement list means the procedure applies to every requirement.
**Register when:** last in the module — after Tasks; before Competence (a competence
certifies procedures).
**Key fields:** registry code and URL of the controlled document; `Unit` → `Process` (the
unit's processes) → `Task *` (the anchor); **Product Scopes** (multi — offered from the
process's list, empty = applies to all); **Requirements** offers every active requirement
of the selected Unit (2026-09-03) — including ones pinned to a region the unit serves,
grouped by type — so the full combination the unit answers for is pickable in one place
(a requirement pinned to another unit or to a region the unit does not serve stays out);
**execution time**
(hours under THIS requirement set — procedures create the variance in task duration; the
task shows the sum); Inputs/Outputs offer only handouts that are free or already on this
chain; accountable owner; **Status** (2026-09-03) tracks the lifecycle of the documented
method — `Approved`, `In Progress` or `To Do` — **and gates eligibility**: only an
`Approved` procedure can be exercised, so people certified on a competence bound to a
procedure still in progress do not appear as eligible (the procedure's Users column shows
the GAP, and Jobs staffing skips them) until the status flips to `Approved`. Expanding a
procedure shows its handout tabs and product scopes.
