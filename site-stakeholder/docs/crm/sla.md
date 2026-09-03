---
title: "SLA"
audience: stakeholder
purpose: "SLA — what it is, when to register one, and its key fields"
---

# SLA

**What it is:** the Service Level Agreement (ISO §8.2) — the contract by which a customer
purchases [Payloads](../operation/payload.md) supplied by a department. Every contract
binds two parties: the contracting **Customer** and the **Supplier** that fulfils it. It is
the gate on execution: when the customer opens a [Ticket](../workspace/tickets.md), only
events covered by one of the customer's SLAs are offered.
**Register when:** phase 7, after the Operation module's Payloads exist.
**Key fields:** Code (the contract id); `Unit *` (grouped by segment) → unlocks the
supplying chain and the customer: **Branch** (the unit's branches — optional) →
`Supplier *` (the supplier inside the selected branch — the customer that branch belongs
to; with no branch chosen, every customer is offered grouped by type) → `Supplier
Department *` (the departments of the supplier's units — the department that will supply
the payloads); `Customer *` (the unit's customers, grouped by type) → **Payloads** (multi —
grouped by event, narrowed to the chosen supplying department); Status. The events and
product scopes the contract covers are derived from the purchased payloads — nothing to
select.
**Expand a row** to see the contract's [Forecasts](forecasts.md) — its temporal dimension:
each forecast projects the SLA's volume for one period.
