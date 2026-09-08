---
title: "Events"
audience: stakeholder
purpose: "Events — what it is, when to register one, and its key fields"
---

# Events

**What it is:** the business occurrences that drive the QMS — the architectural pivot of the
model (moved here from Operation, 2026-08-12).
**Register when:** after Product Groups — Processes (Operation module) and Competence
(phase 6) anchor on events.
**Key fields:** Title, Description; `Business Unit *` → unlocks **Department**
(2026-09-08) — the department that **answers** this event: an event is fundamentally the
request a department must fulfill for its clients, and the Event × Product Scope
combination is what a [Payload](payload.md) packages — and **Scopes** / **Products**
(multi — the event's applicability, distributed from the ER-model Payload; leave empty to
apply to all). The Process keeps its own department key (the execution side); the
event's department is the request's owner and drives the Payload form's Event filter.
Expanding an event lists its Processes and the Product Scopes its applicability admits;
expanding a [Department](../organization/departments.md) lists the requests it answers.
