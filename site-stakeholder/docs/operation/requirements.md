---
title: "Requirements"
audience: stakeholder
purpose: "Requirements — what it is, when to register one, and its key fields"
---

# Requirements

**What it is:** the regulatory/design/commercial limits that bind scopes and product groups
(e.g. "ANVISA RDC 611 Compliance") — moved here from Portfolio (2026-08-12). Applicability is
multi-dimensional: region, unit, branch, customer, scope, product group — and **the
dimensions you declare constrain the inheritance; a dimension left empty does not
constrain** (2026-09-08 refinement): a requirement defined only for a branch binds
every ticket related to that branch (project, customer, applicant or supplier), one
defined only for a scope binds every ticket whose admitted product scopes carry it.
**Register when:** after Scopes and Product Groups (Portfolio module).

Since 2026-09-08 the form is a **three-step wizard** (the same chevron-step drawer as
[Procedures](procedures.md) and [Tickets](../workspace/tickets.md)):

**Step 1 — Registry:** Name, Description, Type (create new types inline with the "+"
button); **Selectable on Tickets** (2026-09-08) — Yes makes this requirement an offerable
**Constraint** on the [Tickets](../workspace/tickets.md) Request step for tickets of
its business unit(s): picked constraints filter the ticket's Product Scope options to
the scopes that answer for them; the automatic inheritance below is not affected
either way.

**Step 2 — Applicability** — the system's longest cascade gets its own screen, with the
rule written on it: *the dimensions you declare constrain; an empty dimension does not*. Region →
`Business Unit *` (unlocks after at least one Region is selected, 2026-08-27;
**mandatory** since 2026-09-08 — every requirement declares the unit(s) it belongs to,
the pre-RBAC rule) → Branch / Customer / Scope / Product Group / **Product Scope** —
Branch and Customer are multi-selects since 2026-09-08. The **Product Scope** picker
(2026-08-28) targets the requirement at specific
[Product Scope](../portfolio/product-scopes.md) combinations directly — options show
the combination's registry code, filtered by the selected units; a subset narrows
ticket inheritance to the named combinations, selecting all keeps every combination
covered (today's). The **Customer** multicheck offers the picked units' customers —
customer-specific requirements surface on the customer's
[Tickets](../workspace/tickets.md) through the [SLA](../crm/sla.md) chain.

**Step 3 — Compliance:** the regulatory reference and link of the external norm, and the
**Active** flag last (Save lives on this step).
**Applicability propagates live to tickets** (2026-08-20): an **Active** requirement is
inherited automatically by every [Ticket](../workspace/tickets.md) whose parameters align
(scope, product group, unit, served region, customer — and, since 2026-09-08, **branch**:
a requirement pinned to branches applies only where the ticket's project sits on one of
them, and only to Forecast demand lines whose contract is registered at one; the
dimension also organizes the Procedure form's Constraints facets) the moment it is
saved; switching it to Inactive withdraws it everywhere. **Competences never inherit automatically** — the new
requirement becomes an option on the [Procedure](procedures.md)'s Requirements picker, the
quality manager binds it there, and the [competences](../talent/competence.md) certifying
that procedure inherit the decision.
**Product Scopes read the connections explicitly** (2026-08-27, link inverted 2026-08-28):
the [Product Scope](../portfolio/product-scopes.md) REQUIREMENTS list shows the requirements
that **name** that combination on their own Product Scope dimension and the ones whose scope
or product-group dimension names it — three connections only: sharing the combination's
business unit or region is never enough to appear there (those dimensions only exclude
mismatches; unit- and region-wide applicability keeps acting on tickets through the
inheritance above). A requirement with all those dimensions empty appears there only where
its Product Scope dimension names it, so one requirement can govern exactly the combinations
it belongs to without being registered once per pair.
