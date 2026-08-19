---
title: "Tickets"
audience: stakeholder
purpose: "Tickets — what it is, when to register one, and its key fields"
---

# Tickets

**What it is:** a request inside a project — the entry point of execution. The ticket
carries its dispatch context: the payload of the chosen event, the governing SLA, the
processes it triggers and the applicable requirement set.
**Register when:** after its Project.
**Key fields:** `Unit *` (grouped by segment) → unlocks `Customer *` → unlocks `Project *`
(the customer's projects) and `Event *` — **only events covered by the customer's SLAs are
offered**; `Product Scope` — narrows the ticket to one of the scopes packaged by the
event's payloads under those SLAs (leave it empty to target every scope they admit);
Details; Target date; Status. The payload, SLA, product/scope and requirement columns are
derived from that chain — nothing else to select. The requirement set includes
customer-specific requirements registered against this customer.
Expanding a ticket row opens two tabs — the **Processes** the event dispatches into
(narrowed by the chosen product scope) and the **Tasks** of those processes.
