---
title: "Forecasts"
audience: stakeholder
purpose: "Forecasts — what it is, when to register one, and its key fields"
---

# Forecasts

!!! warning "Not part of the MVP walkthrough"
    This dashboard exists in the full prototype but is disabled in the MVP mode used
    for the guided setup. Register it only if you are working in the full app.

**What it is:** the temporal dimension of a contract — a demand plan projecting an
[SLA](sla.md)'s volume over a period (an SLA has one forecast per planning period).
**Register when:** phase 7 of the full prototype, once the SLA exists. The tab
is **not part of the MVP walkthrough** (disabled at `/app/mvp/`).
**Key fields:** `SLA *` (grouped by customer — the customer derives from the contract),
`Period *` (Month, Quarter or Annual) → unlocks period start. Only forecasts whose period
hasn't ended are offered downstream.
