---
title: "Handouts"
audience: stakeholder
purpose: "Handouts — what it is, when to register one, and its key fields"
---

# Handouts

**What it is:** the documents/templates that flow through channels — procedures consume
handouts as inputs and produce them as outputs. (Channels are a hidden registry: each
handout names its channel inline.)
**Register when:** before Procedures; handouts can also be created inline from the
Procedure form.
**Key fields (2026-09-07):** Name, Description; **Business Unit** (single) → unlocks
**Departments** (multi — the unit's departments): the departments the handout serves.
The Procedure form's Inputs/Outputs pickers narrow to the handouts of the chosen
department — select every department to offer the handout everywhere (explicit
selection since 2026-09-08: an empty list offers it nowhere; until role-based access
control lands, forms carry filter inputs like these so the same MVP serves different
units and departments); Channel and template identification.
**Customer Input moved to the Procedure** (2026-09-04): the checkbox that marked a
handout as customer-provided left this form — the decision is contextual: the same
document may be a customer input in one method and produced internally in another.
It is now made per procedure, on the **Customer Inputs** field of the
[Procedure](procedures.md) form; the selected inputs surface on the ticket's
**Inputs** tab ([Tickets](../workspace/tickets.md)), so remote teams see up front
what to collect before starting the work.
