---
title: "SLA"
audience: stakeholder
purpose: "SLA — what it is, when to register one, and its key fields"
---

# SLA

**What it is:** the Service Level Agreement (ISO §8.2) — the contract by which a customer
of a branch purchases [Payloads](../operation/payload.md) from a department. It is the gate on
execution: when the customer opens a [Ticket](../workspace/tickets.md), only events covered by
an SLA with that department are offered.
**Register when:** phase 7, after the Operation module's Payloads exist.
**Key fields:** Code (the contract id); `Unit *` (grouped by segment) → unlocks `Customer *`
(the unit's customers), **Branch** (the customer's branches — optional, a customer may have
none) and `Department *` (the unit's departments) → **Payloads** (multi — the unit's
payloads, grouped by event); Activate. The events and product scopes the contract covers
are derived from the purchased payloads — nothing to select.
