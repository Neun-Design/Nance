---
title: "Start here"
audience: stakeholder
purpose: "Setup guide for mapping an operation in the EDQMS prototype: what to register, in which order, and why"
---

# Start here

This guide turns the prototype into a **mapping tool for your operation**. Every screen (dashboard)
belongs to a module, and most registrations depend on earlier ones — a Branch needs its Business
Unit, a Process needs its triggering Event, a Competence needs the Scope and Product Group it
certifies. Register in the order below and no selector will ever be unexpectedly empty.

!!! tip "MVP mode & saving your work"
    Open the prototype at `/app/mvp/` to start from a blank QMS. Your records persist in the
    browser, but the browser is a cache — **use the `Save` button** (top bar) at every milestone
    and store the downloaded file in the shared folder. `Import` loads a saved session back.
    The app warns if the file was saved by a different schema version.

## The registration order

Fields marked `*` in the forms are mandatory — they are the anchors that connect your records to
the rest of the model. The order below follows those anchors:

| Phase | Module | Register (in order) |
|---|---|---|
| 1 — Structure | [Organization](organization/index.md) | Business Segments → Business Units → Regions → Departments → Branches → Squads |
| 2 — Interested parties | [CRM](crm/index.md) | Customers — **after the Branches they will contract with** (internal sites first, then clients/suppliers) |
| 3 — What you sell | [Portfolio](portfolio/index.md) | Classes → Scopes → Products → Product Specs → Product Groups → Product Scopes *(a Scope names the [Issue](control/issues.md) that justifies it — create it inline from the Scope form)* |
| 4 — Who works | [Talent](talent/index.md) | Skill Levels → Job Family → Functions → Roles → People |
| 5 — How you work | [Operation](operation/index.md) | Events *(Portfolio tab)* → Requirements → Processes → Workflows → Actions/Handouts → Tasks → Procedures → Payload |
| 6 — Certification | [Talent](talent/index.md) | Competence → Onboarding *(needs phase 5's Events)* |
| 7 — Contracts | [CRM](crm/index.md) | SLA — **after phase 5's Payloads** *(the Forecasts pair sits outside the MVP walkthrough)* |
| 8 — Execution | [Workspace](workspace/index.md) | Projects → Tickets *(Jobs: full prototype only)* |
| 9 — Monitoring & improvement | [Control](control/index.md) | Nothing to register for the dashboards — Capacity and Performance are computed from phases 1–8. Issues are registered here as investigation produces them, feeding the next modelling cycle |

!!! note "Why this order"
    The order is derived from the data model itself: every mandatory foreign key points to a
    table earlier in the sequence. You can always come back and add more records to an earlier
    phase — the order only matters for the *first* pass.

## How each module page is organised

Each module page lists its dashboards **in registration order**, with three answers per dashboard:
*what it is*, *when to register one*, and *the key fields* (including which selections unlock
which — the cascades). Start with [Organization](organization/index.md).
