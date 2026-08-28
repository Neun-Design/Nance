---
title: "Requirements"
audience: stakeholder
purpose: "Requirements — what it is, when to register one, and its key fields"
---

# Requirements

**What it is:** the regulatory/design/commercial limits that bind scopes and product groups
(e.g. "ANVISA RDC 611 Compliance") — moved here from Portfolio (2026-08-12). Applicability is
multi-dimensional: region, unit, branch, customer, scope, product group — **an empty
dimension means "applies to all"**.
**Register when:** after Scopes and Product Groups (Portfolio module).
**Key fields:** Name, Type (create new types inline with the "+" button); the applicability
cascade Region → Business Unit → Branch/Customer/Scope/Product Group/**Product Scope** — the
Business Unit picker unlocks after at least one Region is selected (2026-08-27); regulatory
reference/URL. The **Product Scope** picker (2026-08-28) targets the requirement at specific
[Product Scope](../portfolio/product-scopes.md) combinations directly — options show the
combination's registry code, filtered by the selected units; leave it empty when the
scope/product-group dimensions already describe the applicability. On the operational
chain it behaves like every other dimension: empty applies to all, filled narrows ticket
inheritance to the named combinations. The **Customer** select unlocks after picking a Business Unit and offers that
unit's customers (leave it empty to apply to all) — customer-specific requirements surface on
the customer's [Tickets](../workspace/tickets.md) through the [SLA](../crm/sla.md) chain.
**Applicability propagates live to tickets** (2026-08-20): an **Active** requirement is
inherited automatically by every [Ticket](../workspace/tickets.md) whose parameters align
(scope, product group, unit, served region, customer) the moment it is saved; switching it
to Inactive withdraws it everywhere. **Competences never inherit automatically** — the new
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
