---
title: "Procedures"
audience: stakeholder
purpose: "Procedures — what it is, when to register one, and its key fields"
---

# Procedures

**What it is:** the documented method for executing a task (ISO §4.4/§7.5). Each row
registers how a task is performed under a given **requirement set**, with its own input and
output handouts — the same task can carry several procedures, one per requirement variant.
The requirement set is an explicit selection (2026-09-08): a procedure covers exactly the
requirements listed on it — an empty list covers none — and registering a new requirement
means revisiting each procedure to add it where it applies.
**Register when:** last in the module — after Tasks; before Competence (a competence
certifies procedures).

Since 2026-09-08 the form is a **four-step wizard** — the largest form in the system,
reorganized so each concern gets its own screen (chevron steps at the top, Previous/Next
at the bottom, Save on the last step; clicking a step jumps to it, and validation still
runs on Save):

**Step 1 — Registry:** registry code; `Unit` → `Department` (pick the department and the
Process options narrow to it; until role-based access control lands, forms carry filter
inputs like this one so the same MVP serves different units and departments) →
`Process` (the department's processes) → `Task *` (the anchor); accountable owner;
**Status** — tracks the lifecycle of the documented method (`Approved`, `In Progress`,
`To Do`) **and gates eligibility**: only an `Approved` procedure can be exercised, so
people certified on a competence bound to a procedure still in progress do not appear
as eligible until the status flips; URL of the controlled document; **execution time**
(hours under THIS requirement set — procedures create the variance in task duration; the
task shows the sum).

**Step 2 — Application:** where the procedure applies. **Branches** (the Unit's
customers' branches) and **Customers** (the Unit's customers, narrowed to the selected
Branches' registrations) are new applicability declarations — for now they document the
applicability without changing which procedure a ticket resolves (that gate comes in a
later round); **Product Scopes** (offered from the process's list) keeps gating the
ticket match directly (2026-09-07): a ticket only resolves this procedure when it admits
one of the pinned scopes. **Applicability is an explicit pick (2026-09-08):** to apply
a procedure to all branches, customers, scopes or requirements, select **every value**
— that covers today's list, deliberately. When a new item is registered later (a new
requirement, branch, customer…), it is **not** silently covered: each procedure must
be revisited and the item added where it applies — the quality review the old "Apply
to all" wildcard used to bypass. A picker left empty means the procedure applies to
**nothing** on that dimension.

**Step 3 — Constraints:** the requirement set, now **faceted by what pins each
requirement**: *Business Unit Requirements* (unit-wide and global obligations),
*Branches Requirements*, *Customers Requirements* (grouped per customer, narrowed to the
selected Branches) and *Product Scopes Requirements* (grouped per scope) — the same
unit-wide universe as before (requirements pinned to another unit or an unserved region
stay out), just organized so the quality manager sees where each obligation comes from.
It is still ONE requirement set: a requirement appears in exactly one facet.

**Step 4 — Inputs & Outputs:** Inputs/Outputs offer the handouts admitted for the chosen
Department (a [Handout](handouts.md) declares the departments it serves; one with no
departments is offered everywhere); **Customer Inputs** (2026-09-04) — among the chosen
Inputs, tick each one the customer must provide upon ticket creation, and the selected
documents surface on the ticket's Inputs tab ([Tickets](../workspace/tickets.md)).

Expanding a procedure shows its handout tabs and product scopes.
