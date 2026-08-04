---
title: "App Guide — CRM"
audience: stakeholder
purpose: "What to register in the CRM module and in which order"
---

# CRM

The interested parties (ISO 9001:2015 §4.2) and their demand. A Customer here is **anyone
eligible to open a Ticket**: internal sites (type *branch*), external clients and suppliers.

!!! important "Customers connect to Branches through Contracts"
    Contracts are made with physical/legal **sites** (branches), never with Business Units.
    A customer can exist without a branch, and can hold contracts with several branches —
    the **Contract** is what connects them. Registering the
    [Branches](organization.md#branches) (phase 1) before customers keeps that connection
    ready, and it is what lets a customer open tickets to a branch's business units.

## Customers

**What it is:** the registry of interested parties, typed `branch` / `client` / `supplier`.
**Register when:** phase 2, after Organization — internal sites first (they mirror your
Branches), then external clients/suppliers.
**Key fields:** Name; Type; `Segment *` (multi) → unlocks `Unit *` (multi, filtered by the
chosen segments); `Region *`; City/Country; **Branch** (multi, unlocked by Unit — grouped by
unit). **The branch link is authored here:** saving the customer stamps its id onto the
selected [Branch](organization.md#branches) records (deselecting clears it); the Branches
form has no Customer input.

!!! note "Roadmap"
    A **Contract** entity is coming to CRM: each contract connects a customer to a branch
    and carries the product scopes it covers (filtered by the branch's business unit) plus
    the forecasts raised against them; the customer types become
    `internal client / external client / supplier` — see GitHub issue #132.

## Forecasts

**What it is:** a demand plan for a customer over a period.
**Register when:** phase 7, once Portfolio and Scopes exist.
**Key fields:** `Customer *`, `Period *` → unlocks period start. Only forecasts whose period
hasn't ended are offered downstream.

## Forecast Scopes

**What it is:** the breakdown of a forecast into scopes and product groups with quantities —
the demand line items.
**Register when:** right after its Forecast.
**Key fields:** `Forecast *` (grouped by unit); `Scope *` → unlocks Product Group (only groups
of that scope), Quantity and Notes. Requirements applicable to the scope + product group pair
are derived automatically — nothing to select.
