---
title: "Product Scopes"
audience: stakeholder
purpose: "Product Scopes — what it is, when to register one, and its key fields"
---

# Product Scopes

**What it is:** the executable combination scope × product group for a business unit — the
thing Forecast Scopes and Workflows point at.
**Register when:** last in the module.
**Key fields:** `Business Unit *` (grouped by segment) → unlocks `Product Group *` (shown as
product | SPECS) and `Scope *`. Requirements are **not** picked here (2026-08-28): the link
is declared on the [Requirement](../operation/requirements.md) side — a requirement created
for this business unit reaches the combination automatically, and a requirement can name
specific combinations through its own Product Scope dimension. The **REQUIREMENTS** column
and the **Requirements** tab on the expanded row show everything that applies: requirements
naming this combination, the ones connected to its scope or product group, and the ones
created for its unit.
