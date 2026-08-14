---
title: "App Guide — CRM"
audience: stakeholder
purpose: "What to register in the CRM module and in which order"
---

# CRM

The interested parties (ISO 9001:2015 §4.2) and their contracts. A Customer here is **anyone
eligible to open a Ticket**: internal sites (*Internal Client*), external clients and
suppliers. The module is part of the MVP walkthrough: Customers and SLA are active;
the Forecasts pair stays out of it.

!!! important "Customers connect to the operation through SLAs"
    Contracts are made between a **customer of a branch** and a **department** — never with
    a Business Unit directly. The **SLA** dashboard is where that contract lives: it names
    the [Payloads](operation.md#payload) the customer purchases, and tickets the customer
    opens can only trigger events those payloads cover. Registering the
    [Branches](organization.md#branches) (phase 1) before customers keeps the connection
    ready.

## Customers

**What it is:** the registry of interested parties, typed `Internal Client` /
`External Client` / `Supplier`. Geography is not registered here — a customer's city,
country and region live on its [Branches](organization.md#branches).
**Register when:** phase 2, after Organization — internal sites first (they mirror your
Branches), then external clients/suppliers.
**Key fields:** Name; Type; `Segment *` (multi) → unlocks `Unit *` (multi, filtered by the
chosen segments); **Branch** (multi, unlocked by Unit — grouped by unit). **The branch link
is authored here:** saving the customer stamps its id onto the selected
[Branch](organization.md#branches) records (deselecting clears it); the Branches form has
no Customer input. Expanding a customer row lists its SLAs.

## SLA

**What it is:** the Service Level Agreement (ISO §8.2) — the contract by which a customer
of a branch purchases [Payloads](operation.md#payload) from a department. It is the gate on
execution: when the customer opens a [Ticket](workspace.md#tickets), only events covered by
an SLA with that department are offered.
**Register when:** phase 7, after the Operation module's Payloads exist.
**Key fields:** Code (the contract id); `Unit *` (grouped by segment) → unlocks `Customer *`
(the unit's customers), **Branch** (the customer's branches — optional, a customer may have
none) and `Department *` (the unit's departments) → **Payloads** (multi — the unit's
payloads, grouped by event); Activate. The events and product scopes the contract covers
are derived from the purchased payloads — nothing to select.

## Forecasts

**What it is:** a demand plan for a customer over a period.
**Register when:** phase 7 of the full prototype, once Portfolio and Scopes exist. The tab
is **not part of the MVP walkthrough** (disabled at `/app/mvp/`).
**Key fields:** `Customer *`, `Period *` → unlocks period start. Only forecasts whose period
hasn't ended are offered downstream.

## Forecast Scopes

**What it is:** the breakdown of a forecast into scopes and product groups with quantities —
the demand line items.
**Register when:** right after its Forecast (full prototype only — the tab is disabled in
the MVP walkthrough).
**Key fields:** `Forecast *` (grouped by unit); `Scope *` → unlocks Product Group (only groups
of that scope), Quantity and Notes. Requirements applicable to the scope + product group pair
are derived automatically — nothing to select.
