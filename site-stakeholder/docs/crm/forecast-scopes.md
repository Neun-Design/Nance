---
title: "Forecast Scopes"
audience: stakeholder
purpose: "Forecast Scopes — what it is, when to register one, and its key fields"
---

# Forecast Scopes

!!! warning "Not part of the MVP walkthrough"
    This dashboard exists in the full prototype but is disabled in the MVP mode used
    for the guided setup. Register it only if you are working in the full app.

**What it is:** the breakdown of a forecast into Event × Product Scope line items with
quantities — the same dispatch unit the contract's [Payloads](../portfolio/payload.md) use.
**Register when:** right after its Forecast (full prototype only — the tab is disabled in
the MVP walkthrough).
**Key fields:** `Business Unit` (2026-09-07 — the pre-RBAC filter input: the Forecast
options narrow to the chosen unit) → `Forecast *` → `Event` (only events the contract
covers) → `Product Scope *` (the scopes the contract's payloads package for that event —
scope and product group derive from it) → Function (the function the demand line projects
hours for), Quantity and Notes. The Event/Product Scope/Function narrowing is enforced
live in the form since 2026-09-07 (the filters existed but were not wired). Requirements applicable to the pair are derived automatically — nothing
to select. Estimated hours multiply the event's task hours by the quantity; when the event
chains no tasks yet, the value you type stands.
