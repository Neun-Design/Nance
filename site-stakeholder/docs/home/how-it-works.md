---
title: "How it works"
audience: stakeholder
purpose: "The chain from obligation to evidence, and how it maps onto the modules"
---

# From obligation to evidence — one connected chain

```
Requirement  →  Procedure  →  Competence  →  Execution  →  Evidence
```

Five links. Each one is a real object in the system, with an owner, and each is registered in
a module you can open from the tabs above.

## Requirement

**Norms, contracts and design limits, registered per scope and product.**

An IEC standard, a customer's contractual clause, a maximum tank weight, a testing obligation.
Requirements are not filed as documents — they are registered with an applicability: which
regions, which business units, which scopes and which product groups they bind. Leave a
dimension empty and the requirement applies to all of them.

→ [Operation · Requirements](../operation/requirements.md)

## Procedure

**The documented method for each task, under its requirement set.**

This is the link most systems miss. The same task takes a different form — and a different
amount of time — depending on which requirements bind it. So the procedure, not the task,
carries the requirement set, the input and output documents, and the execution time.

→ [Operation · Procedures](../operation/procedures.md)

## Competence

**Who is certified to execute each procedure.**

A competence is a role at a skill level, certified for a task chain on a specific product
scope, holding the procedures it covers. Certification is recorded per person through
onboarding, with the training material attached.

→ [Talent · Competence](../talent/competence.md) · [Talent · Onboarding](../talent/onboarding.md)

## Execution

**Tickets staffed only with certified people.**

When a ticket is opened, the system already knows which event it triggers, which payload that
event dispatches, which requirements come with it, and therefore which people may be assigned.
The responsible selector does not offer anyone else.

→ [Workspace · Tickets](../workspace/tickets.md) · [Workspace · Jobs](../workspace/jobs.md)

## Evidence

**Who, when, under which procedure — captured automatically.**

Nothing is written *for* the audit. Real start and end times, buffers, the governing
procedure and the certified executor are all recorded because the work passed through the
chain. The audit trail is a by-product of operating, not a project that precedes an
inspection.

---

## Event-driven by design

The chain does not run on a calendar. It is triggered by **real operational events** — a new
job, a nonconformity, a customer request — which is what keeps governance continuous instead
of retrospective.

A purely reactive operation responds to problems after they occur. A purely predictive one
tries to anticipate every scenario in advance, and produces process libraries nobody uses.
nance.it enables a third mode: **structured reactivity**. When the event occurs, the system
already knows which process applies, what requirements are in scope, and how to execute the
response.

→ [Portfolio · Events](../portfolio/events.md) · [Operation · Payload](../operation/payload.md)

## And the loop closes

Execution produces numbers, and numbers produce questions. A task that consistently overruns
its planned time usually means the procedure does not describe the work as it is really done.
Investigating that produces a registered **Issue** — a mapped opportunity or risk — and that
Issue justifies the next new scope, requirement, event or revised procedure.

That is the PDCA cycle of the governance system itself, and it lives in the
[Control](../control/index.md) module.
