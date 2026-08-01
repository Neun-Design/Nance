---
title: "App Guide — CRM"
audience: stakeholder
purpose: "What to register in the CRM module and in which order"
---

# CRM

The interested parties (ISO 9001:2015 §4.2) and their demand. A Customer here is **anyone
eligible to open a Ticket**: internal sites (type *branch*), external clients and suppliers.

## Customers

**What it is:** the registry of interested parties, typed `branch` / `client` / `supplier`.
**Register when:** phase 2, after Organization — internal sites first (they mirror your
Branches), then external clients/suppliers.
**Key fields:** Name; Type; `Segment *` (multi) → unlocks `Unit *` (multi, filtered by the
chosen segments); `Region *`; City/Country. After registering an internal customer, go back to
its [Branch](organization.md#branches) and set the Customer link — that is what lets the
customer open tickets to the branch's units.

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
