---
title: "App Guide — Workspace"
audience: stakeholder
purpose: "What to register in the Workspace module and in which order"
---

# Workspace

Execution: customer demand turned into projects, tickets and staffed jobs.

## Projects

**What it is:** a customer engagement grouping tickets.
**Register when:** phase 8, once CRM and Portfolio exist.
**Key fields:** Name; `Customer *`; dates.

## Tickets

**What it is:** a request inside a project — carries the customer, scope and products the work
is about.
**Register when:** after its Project.
**Key fields:** `Project *`; the customer/scope/product context that downstream Jobs will
match against.

## Jobs

**What it is:** the staffed execution unit: a task assigned to a certified person, with real
execution tracking.
**Register when:** after Tickets (and phase 6 — Jobs only offer certified responsibles).
**Key fields:** `Project *` → unlocks `Ticket *` (grouped by customer) → unlocks Task (tasks
matching the ticket's customer, product group and scope) and Responsible (onboarded people
whose competence matches the chain). Status transitions stamp real start/end times; `Stoped`
time accrues as buffer and the real execution time is computed on Done.
