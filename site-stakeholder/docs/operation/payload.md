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
**Register when:** after Processes and the Portfolio's Product Scopes; before the CRM SLAs.
**Key fields:** Code; `Unit *` (grouped by segment) → unlocks `Event *` (the unit's events)
→ **Product Scopes** (multi — the event's applicability narrowed to the unit, grouped by
scope; empty = every scope the event admits); Activate.
