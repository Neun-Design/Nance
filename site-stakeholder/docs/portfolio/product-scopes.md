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
product | SPECS) and `Scope *`; **Requirements** (2026-08-27) — the
[Requirements](../operation/requirements.md) that apply to this specific combination, picked
directly at registration (multi-select grouped by type; inactive requirements are not
offered). The **REQUIREMENTS** column and the **Requirements** tab on the expanded row show
the comprehensive set: the ones picked here **plus** every requirement explicitly connected
to the chosen scope or product group on its own registration. A requirement registered with
empty scope and product-group dimensions appears only where it is picked — that is the point
of the direct link: one requirement, applied to exactly the combinations it governs, without
duplicating it per pair. (Tickets keep their wider inheritance: empty dimensions still mean
"applies to all" on the operational chain.)
