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
is declared on the [Requirement](../operation/requirements.md) side — a requirement names
specific combinations through its own Product Scope dimension (by registry code), or reaches
them through its scope/product-group dimensions. The **REQUIREMENTS** column and the
**Requirements** tab on the expanded row show exactly those three connections: requirements
naming this combination and the ones connected to its scope or product group (sharing the
unit or region is not a connection — unit-wide obligations act on tickets, not here).
