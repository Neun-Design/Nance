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
is authored here:** saving the customer stamps its id onto the selected
[Branch](../organization/branches.md) records (deselecting clears it); the Branches form has
no Customer input. A branch belongs to **one** customer — the picker only offers branches
not yet assigned to another customer, so registering a customer can never strip a branch
from an older record; to move a branch, deselect it on the owning customer first.
Expanding a customer row lists its SLAs.
