---
title: "App Guide — Workspace"
audience: stakeholder
purpose: "What to register in the Workspace module and in which order"
---

# Workspace

Execution: customer demand turned into projects, tickets and staffed jobs. The module is
part of the MVP walkthrough with Tickets and Projects active; the Jobs tab is available in
the full prototype only.

## Projects

**What it is:** a customer engagement grouping tickets, executed under the customer's
contracts.
**Register when:** phase 8, once CRM (including [SLAs](crm.md#sla)) exists.
**Key fields:** Registry ID; Name; `Unit *` (grouped by segment) → unlocks `Customer *`
(the unit's customers) → **SLA** (multi — the customer's contracts this project executes
under); Owner; Status. The coverage column (product scopes) derives from the linked SLAs.

## Tickets

**What it is:** a request inside a project — the entry point of execution. The ticket
carries its dispatch context: the payload of the chosen event, the governing SLA, the
processes it triggers and the applicable requirement set.
**Register when:** after its Project.
**Key fields:** `Unit *` (grouped by segment) → unlocks `Customer *` → unlocks `Project *`
(the customer's projects) and `Event *` — **only events covered by the customer's SLAs are
offered**; Details; Target date; Status. The payload, SLA, process, product/scope and
requirement columns are derived from that chain — nothing to select. The requirement set
includes customer-specific requirements registered against this customer.

## Jobs

**What it is:** the staffed execution unit: a task assigned to a certified person, with real
execution tracking. The tab is **not part of the MVP walkthrough** (full prototype only).
**Register when:** after Tickets (and phase 6 — Jobs only offer certified responsibles).
**Key fields:** `Project *` → unlocks `Ticket *` (grouped by customer) → unlocks Task (tasks
matching the ticket's customer, product group and scope) and Responsible (onboarded people
whose competence matches the chain). Status transitions stamp real start/end times; `Stoped`
time accrues as buffer and the real execution time is computed on Done.
