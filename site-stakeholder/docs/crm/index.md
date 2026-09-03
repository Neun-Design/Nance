---
title: "CRM"
audience: stakeholder
purpose: "What to register in the CRM module and in which order"
---

# CRM

The interested parties (ISO 9001:2015 §4.2) and their contracts. A Customer here is **anyone
eligible to open a Ticket**: internal sites (*Internal*), external clients and supplying
companies (*External*). The module is part of the MVP walkthrough: Customers and SLA are
active; the Forecasts pair stays out of it.

!!! important "Customers connect to the operation through SLAs"
    Contracts are made between a **customer** and a **supplying department** — never with
    a Business Unit directly. The **SLA** dashboard is where that contract lives: the
    branch identifies the supplier, the supplier's department supplies the
    [Payloads](../operation/payload.md) the customer purchases, and tickets the customer
    opens can only trigger events those payloads cover. Registering the
    [Branches](../organization/branches.md) (phase 1) before customers keeps the connection
    ready.

## Entities in this module

Listed in registration order. Each page answers three questions: *what it is*, *when to register one*, and *the key fields* — including which selection unlocks which.

- [**Customers**](customers.md) — the registry of interested parties, typed Internal / External. Geography is not registered here — a customer's city, country and region live on its Branches.
- [**SLA**](sla.md) — the Service Level Agreement (ISO §8.2) — the contract by which a customer purchases Payloads supplied by a department. It is the gate on execution: when the customer opens a Ticket, only events…
- [**Forecasts**](forecasts.md) — a demand plan for a customer over a period.
- [**Forecast Scopes**](forecast-scopes.md) — the breakdown of a forecast into scopes and product groups with quantities — the demand line items.
