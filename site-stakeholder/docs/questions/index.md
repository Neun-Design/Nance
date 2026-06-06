---
title: "Q&A"
audience: stakeholder
purpose: "List of questions for users to read after following the reading guideline"
---

# Questions and Answers

This page answers the questions most commonly asked by stakeholders at different stages of involvement with the EDQMS project. If you have followed the Managers reading track on the [How to use this site](../how-to-use-this-site.md) page, these answers give you the context needed to participate in project governance discussions without reading the full documentation.

---

## Why did this project begin, and when will I know it ended?

The project began in January 2026, when Northwind Energy engaged Neun Design to support the Global Engineering Hub for power transformer repair. The initial mandate was to map process gaps and define engineering roles.

During the discovery work, a more fundamental problem surfaced: the hub's teams could not reliably answer, for any given operational event, what they should do, what was required of them, and how to execute it. That finding reframed the entire engagement.

The project will be complete when the hub has a fully operational, ISO 9001:2015 ***aligned*** [^1] quality management system embedded in its daily engineering workflows — one that can be maintained and extended by the hub's own team without external dependency. That is the outcome of Phase 3.

[^1]: 
    This project does not aim to implement ISO 9001 directly. Instead, it uses the standard as a foundational reference for developing a management system, ensuring that, when certification becomes necessary, the path to compliance is significantly simplified.

---

## What problem is this project actually solving?

The core problem is an execution architecture gap. The hub has engineering processes defined at a high level, but those processes are not connected to the specific events that trigger them or to the detailed procedures that tell team members exactly what to do.

The result is that knowledge is or, most certainly, will be held individually — in the heads of experienced engineers — rather than documented in a shared, structured system. When something happens in the operation, the response depends on who happens to be available and what they remember, rather than on a defined, auditable procedure.

EDQMS solves this by making every operational event the entry point to a traceable chain: event triggers process, process requires activities, activities are executed through documented procedures.

---

## How can I explain the value of this project to someone who has not been involved?

Frame it in terms of three operational risks that a system like EDQMS directly reduces:

**Onboarding risk** — without documented procedures, every new engineer is a period of degraded quality while they learn informally from colleagues. With EDQMS, new team members have a system to reference from day one.

**Continuity risk** — when experienced team members leave or change roles, undocumented knowledge leaves with them. EDQMS converts that knowledge into explicit, reusable procedures before it walks out the door.

**Scale risk** — as the hub grows across more regions and serves more business units, informal coordination becomes increasingly unreliable. EDQMS provides the governance layer that makes coordinated quality management possible at scale.

---

## Why does this feel like a Quality Department project?

Because the underlying problem is, at its core, a governance problem.

ISO 9001:2015 is the framework being used to structure that governance. It provides the architectural reference: risk-based thinking, process decomposition, knowledge management, and accountability at every operational node. But the standard is the means, not the objective.

The objective is governance at organisational scale — the ability to onboard new engineers without losing execution fidelity, to maintain cross-regional consistency without relying on institutional memory, and to adapt operations to internal or external change without rebuilding from scratch. That set of outcomes would be necessary even if ISO certification were never on the agenda.

Traditional quality programmes treat ISO 9001 as the primary goal. They produce documentation for audits, layer compliance checks on top of existing operations, and create a parallel structure that does not change how work is actually done.

EDQMS inverts that logic. Governance is built into the execution architecture. When an engineer responds to an operational event, they are not consulting the quality management system — they are using it. ISO 9001 alignment is a consequence of a well-designed governance structure, not its cause.

---

## Can I use this site to track project progress?
Yes.

To understand what has been completed, what is currently in progress, and what is planned next, please refer to the [Project Status](../project-status.md) page.

---

## What is a prototype and why not build the real system now?

The prototype tests whether the solution design is sound before committing the investment required to build the full system.

The core question the prototype answers is: can a single, unified [SOP template](http://localhost:8000/prototype/data-model/#procedure){ data-preview } structure accommodate all the variations of engineering events in the hub's offer process? That question cannot be answered by design alone — it can only be answered by applying the template to real operational data.

Building the full production system before that question is answered would risk discovering structural limitations only after a significant Phase 3 investment has been made, at which point corrections are far more expensive.

The [prototype](http://localhost:8000/prototype/prototype/#accessing-the-prototype){ data-preview} is the investment that protects the larger investment.

---

## What happens after the prototype validation is complete?

Two deliverables will be produced:

- **Prototype Implementation Assessment** — a comprehensive report identifying all structural improvements required to transition from prototype to MVP, derived from the non-conformity log generated during the validation exercise
- **Target-State Solution Architecture** — a system architecture blueprint defining the structure, integrations, and capabilities required for the production implementation

These two documents will define the scope, timeline, and investment for the final [Implementation Phase](http://localhost:8000/implementation/).

---

## What will it take to manage this system after Implementation?

The handover design for Implementation is that the hub's quality management function — supported by the [Quality Manager](https://neundesign.sharepoint.com/:b:/r/sites/Northwind-Offer/Documentos%20Compartilhados/BPM/Deliverables/Recruitment/recruitment-quality-manager.pdf?csf=1&web=1&e=V2s0uT) or an equivalent role — can operate, maintain, and extend the system without ongoing external dependency.

Specifically, this means:

- The Broker role (the function responsible for connecting events to processes and defining the business rules that govern procedure activation) should be staffed internally, ideally by the Quality Manager or a designated process manager
- The procedure library will require ongoing maintenance as processes evolve, new case types emerge, and the hub expands to new regions
- New procedure definitions will follow the same template structure validated in [Phase 2](http://localhost:8000/project/second-phase/), ensuring consistency as the library grows

The system is designed so that maintaining it is part of the quality management function — not an additional overhead.

---

## What could cause this project to fail or stall?

Three conditions represent the primary execution risks:

1. **Stakeholder and SME availability** — the validation work depends on domain experts being available to develop and review procedure definitions. Delays in scheduling or access to key personnel directly extend the validation timeline.

2. **Scope creep during validation** — the prototype is intentionally minimal. Attempting to add production-level features (automation, integrations, access control) before the template structure is validated would undermine the purpose of the validation phase.

3. **Unclear ownership at Implementation Phase** — for Phase 3 to produce a sustainable system, the client organisation must designate clear ownership of the EDQMS function before deployment begins. A system deployed without an internal owner is a system that will gradually become unused.

All three risks are manageable with appropriate governance and scheduling discipline.
