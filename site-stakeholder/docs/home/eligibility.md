---
title: "The eligibility rules"
audience: stakeholder
purpose: "Knowledge Driven Governance — how the system decides which method executes each task, and who may execute it"
---

# The eligibility rules

**This is the heart of Knowledge Driven Governance:** the system — not tribal memory —
decides *which documented method* executes each task of a ticket, and *who is allowed to
execute it*. Both decisions are derived live from registered knowledge (requirements,
procedures, competences, certifications), and every gap in that knowledge is made
visible instead of silently absorbed by improvisation.

## 1. Which procedure executes a task

When a [Ticket](../workspace/tickets.md) is opened, each task of its dispatched
processes is resolved against the ticket's context. A [Procedure](../operation/procedures.md)
is **eligible** for the task when all three checks hold:

1. **Requirement coverage** — the procedure's declared requirement set covers **every**
   requirement the ticket inherits (region, unit, branch, customer, scope, product
   group and product scope, AND-matched). On the requirement side, **the dimensions
   you declare constrain the inheritance — a dimension left empty does not constrain**
   (2026-09-08 refinement): a requirement defined only for a branch binds every ticket
   related to that branch — through the project, the customer, the applicant **or the
   supplier** — one defined only for a customer binds the tickets naming that customer
   in **any** role (customer, applicant or supplier), one defined only for a region
   binds the tickets whose unit serves it or whose related branches sit in it, and one
   defined only for a scope binds every ticket whose admitted product scopes carry it.
   The rule is exhaustive by construction: every declared dimension is matched against
   **all** the traces the ticket's parameters provide for it. (On the *coverage* side — the procedure's own requirement
   set — nothing is covered by omission: an empty set covers nothing.)
2. **Product scope** — the procedure must name at least one of the scopes the ticket
   admits through its contract chain.
3. **Approved status** — only procedures with status **Approved** are considered
   (2026-09-08). A method still being written or reviewed cannot be the documented way
   to execute work.

The outcome is deliberately strict — **exactly one** eligible procedure:

| Eligible procedures | What the Tasks tab shows | Meaning |
|---|---|---|
| **1** | the procedure's registry code | the governed path — this is the method |
| **0** | **GAP** | no approved method covers this combination — a knowledge gap to fill |
| **2+** | **GAP** with the hover hint `Procedures redundancy <ids>` | competing methods — a redundancy the quality manager must resolve, and the hint names exactly which ones collide |

## 2. Requirements re-evaluate everything, live

Requirements are never copied onto tickets — they are **inherited live**. The moment a
new requirement is registered with a combination that matches a ticket (its unit,
customer, scopes…), it joins that ticket's requirement list immediately, and every
task dispatch is **re-evaluated**: a procedure that does not cover the new requirement
stops being eligible and the task shows a GAP — the system pointing at every procedure
that must be revisited. This is the deliberate review loop quality management demands:
new obligations surface work; they are never silently absorbed.

## 3. Who may execute the task

A person is **eligible to resolve a ticket's task** when the chain of registered
knowledge closes end to end:

1. **Certified onboarding** — the person holds an [Onboarding](../talent/onboarding.md)
   with *Certified = Yes* covering the competence (the certification covers the
   onboarding's whole competence group).
2. **A bound, exercisable competence** — the [Competence](../talent/competence.md) must
   be linked to procedures of the task, and at least one of them must be **Approved**.
   A competence without a procedure, or whose methods all await approval, is inert —
   there is nothing to exercise yet.
3. **Full coverage** — the union of the person's certified competences must cover
   **every** requirement of the task *plus* the ticket's inherited set. Partial
   competences may compose: two certifications that together span the set qualify the
   person.

This chain feeds the **Users** column on the ticket's Tasks tab, the Users column on
Procedures, and the **Responsible** select on [Jobs](../workspace/jobs.md) — the same
rule everywhere, derived from the same records.

## Continuously verified

These rules are executable contracts: dedicated automated tests exercise each gate
(coverage, redundancy, approval, certification, live re-evaluation) and run on **every
change** to the prototype through the project's continuous-integration pipeline —
the governance rules cannot drift silently.
