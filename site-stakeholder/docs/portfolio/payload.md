---
title: "Payload"
audience: stakeholder
purpose: "Payload — what it is, when to register one, and its key fields"
---

# Payload

**What it is:** the dispatch package — one **event × the product scopes it applies to**.
Payloads are what [SLAs](../crm/sla.md) purchase, and the chain that carries the applicable
requirements into the customer's [Tickets](../workspace/tickets.md). Defining them is the
Broker's job (typically the quality or process manager).
**Register when:** after this module's Product Scopes and Operation's Processes; before the
CRM SLAs.
**Key fields:** Code; `Unit *` (grouped by segment) → **Department** (the unit's
departments — the department that supplies this payload; [SLAs](../crm/sla.md) filter
their purchasable payloads by it) → `Event *` — since 2026-09-08 picking the Department
first **narrows the events to the requests that department answers** (each
[Event](events.md) now carries its answering department; leave the Department empty to
see every event of the unit) → **Product Scopes** (multi — the event's applicability
narrowed to the unit, shown by registry code since 2026-08-28; **explicit selection
since 2026-09-08**: select every offered scope to package the event's full
applicability — an empty list packages nothing); Activate.
