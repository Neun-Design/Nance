---
title: "Customers"
audience: stakeholder
purpose: "Customers — what it is, when to register one, and its key fields"
---

# Customers

**What it is:** the registry of interested parties, typed `Internal` (the network's own
units and clinics) or `External` (insurers, partner hospitals, supplying companies).
Geography is not registered here — a customer's city, country and region live on its
[Branches](../organization/branches.md).
**Register when:** phase 2, after Organization — internal sites first (they mirror your
Branches), then external clients and suppliers.
**Key fields:** Name; Type; `Segment *` (multi) → unlocks `Unit *` (multi, filtered by the
chosen segments); **Branch** (multi, unlocked by Unit — grouped by unit). **The branch link
is authored here:** saving the customer writes it onto the selected
[Branch](../organization/branches.md) records; the Branches form has no Customer input.
A branch may serve **several** customers — every branch is offered, and saving updates
only this customer's own links (picking a branch never strips it from another customer;
deselecting removes only yours). Expanding a customer row lists its SLAs.
