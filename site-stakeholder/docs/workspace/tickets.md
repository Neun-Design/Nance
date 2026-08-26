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
(the customer's projects), **Supplier** — the party responsible for resolving the issue,
picked among the unit's customers grouped by type (unlocked by the Unit): choosing one
narrows Event and Product Scope to the contracts of that (customer, supplier) pair,
leaving it empty follows every active SLA — and `Event *` —
**only events covered by the customer's SLAs are offered**; `Product Scope *` — the scope
the ticket targets, among those packaged by the event's payloads under those SLAs; `Forecast Scope` — the demand line of the contract's
[Forecasts](../crm/forecast-scopes.md) this ticket consumes, following the same
(customer, supplier) narrowing as Event and Product Scope when a Supplier is declared
(leave it empty when the work
was not forecast — the line's consumption counts the linked tickets and its remaining
balance follows); Details; Target date; Status. The payload, SLA, product/scope and requirement columns are
derived from that chain — nothing else to select. The requirement set is **live**
(2026-08-20): registering a new Active requirement whose applicability matches the ticket's
scopes, unit, served regions or customer makes it appear on existing tickets immediately —
no re-entry; inactivating a requirement removes it everywhere. The set includes
customer-specific requirements registered against this customer.
Expanding a ticket row opens three tabs — the **Processes** the event dispatches into
(narrowed by the chosen product scope), the **Tasks** of those processes, and **Inputs**
(2026-08-26): the [Handouts](../operation/handouts.md) marked **Customer Input** among the
inputs of the ticket's resolved procedures — for each task, the ticket's requirement set
narrows the procedures to exactly one, and that procedure's customer-provided inputs are
listed. It is the collection checklist for ticket intake: what the customer must hand over
before remote teams can start (a task whose procedure is ambiguous or missing contributes
nothing until the gap is closed). The Users
column on Tasks is **ticket-aware** (2026-08-20): it lists only people whose certified
competences cover **every** requirement the ticket inherits — a new requirement landing on
the ticket clears the list until certifications catch up (bind it to the task's
[Procedure](../operation/procedures.md) so the certified competences absorb it).
