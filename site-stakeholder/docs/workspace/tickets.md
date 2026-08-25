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
(the customer's projects), **Supplier** — the suppliers present in the customer's active
SLAs: choosing one narrows Event and Product Scope to the contracts of that
(customer, supplier) pair, leaving it empty follows every active SLA — and `Event *` —
**only events covered by the customer's SLAs are offered**; `Product Scope *` — the scope
the ticket targets, among those packaged by the event's payloads under those SLAs; `Forecast Scope` — the demand line of the contract's
[Forecasts](../crm/forecast-scopes.md) this ticket consumes (leave it empty when the work
was not forecast — the line's consumption counts the linked tickets and its remaining
balance follows); Details; Target date; Status. The payload, SLA, product/scope and requirement columns are
derived from that chain — nothing else to select. The requirement set is **live**
(2026-08-20): registering a new Active requirement whose applicability matches the ticket's
scopes, unit, served regions or customer makes it appear on existing tickets immediately —
no re-entry; inactivating a requirement removes it everywhere. The set includes
customer-specific requirements registered against this customer.
Expanding a ticket row opens two tabs — the **Processes** the event dispatches into
(narrowed by the chosen product scope) and the **Tasks** of those processes. The Users
column there is **ticket-aware** (2026-08-20): it lists only people whose certified
competences cover **every** requirement the ticket inherits — a new requirement landing on
the ticket clears the list until certifications catch up (bind it to the task's
[Procedure](../operation/procedures.md) so the certified competences absorb it).
