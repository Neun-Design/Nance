---
title: "App Guide — CRM"
audience: stakeholder
purpose: "What to register in the CRM module and in which order"
---

# CRM

The interested parties (ISO 9001:2015 §4.2) and their demand. A Customer here is **anyone
eligible to open a Ticket**: internal sites (type *branch*), external clients and suppliers.

!!! important "Every customer anchors to a Branch"
    Contracts are made with physical/legal **sites**, never with Business Units — so no
    customer of any type exists without a Branch behind it. Always register the
    [Branches](organization.md#branches) (phase 1) **before** their customers: an internal
    customer *is* the commercial face of its site; a client or supplier connects to the site
    it contracts with. That anchoring is what lets a customer open tickets to the branch's
    business units.

## Customers

**What it is:** the registry of interested parties, typed `branch` / `client` / `supplier`.
**Register when:** phase 2, after Organization — internal sites first (they mirror your
Branches), then external clients/suppliers.
**Key fields:** Name; Type; `Segment *` (multi) → unlocks `Unit *` (multi, filtered by the
chosen segments); `Region *`; City/Country. **Today the anchoring is recorded on the Branch
form:** after registering an internal customer, open its [Branch](organization.md#branches)
and set the Customer select there.

!!! note "Roadmap"
    The anchoring is moving into this form: every Customer will pick its Branch directly at
    registration (mandatory for all three types), and internal customers will inherit the
    site's geography automatically — see GitHub issue #132.

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
