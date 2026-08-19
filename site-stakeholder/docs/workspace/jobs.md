---
title: "Jobs"
audience: stakeholder
purpose: "Jobs — what it is, when to register one, and its key fields"
---

# Jobs

!!! warning "Not part of the MVP walkthrough"
    This dashboard exists in the full prototype but is disabled in the MVP mode used
    for the guided setup. Register it only if you are working in the full app.

**What it is:** the staffed execution unit: a task assigned to a certified person, with real
execution tracking. The tab is **not part of the MVP walkthrough** (full prototype only).
**Register when:** after Tickets (and phase 6 — Jobs only offer certified responsibles).
**Key fields:** `Project *` → unlocks `Ticket *` (grouped by customer) → unlocks Task (tasks
matching the ticket's customer, product group and scope) and Responsible (onboarded people
whose competence matches the chain). Status transitions stamp real start/end times; `Stoped`
time accrues as buffer and the real execution time is computed on Done.
