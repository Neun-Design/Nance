---
title: "Operation"
audience: stakeholder
purpose: "What to register in the Operation module and in which order"
---

# Operation

The QMS process chain (ISO 9001:2015 §4.4): events (registered in Portfolio) trigger
processes, processes decompose into workflow steps, steps carry tasks with inputs and outputs.

## Entities in this module

Listed in registration order. Each page answers three questions: *what it is*, *when to register one*, and *the key fields* — including which selection unlocks which.

- [**Requirements**](requirements.md) — the regulatory/design/commercial limits that bind scopes and product groups (e.g. "IEC 60076 Compliance") — moved here from Portfolio (2026-08-12). Applicability is multi-dimensional: region, unit,…
- [**Processes**](processes.md) — a top-level flow triggered by an event, run by a squad.
- [**Workflows**](workflows.md) — the ordered steps of a process — the process map. Step numbers (1, 2, 2.1…) are computed from each step's parent and indentation rule; you never type them.
- [**Payload**](payload.md) — the dispatch package — one event × the product scopes it applies to. Payloads are what SLAs purchase, and the chain that carries the applicable requirements into the customer's Tickets. Defining them…
- [**Actions**](actions.md) — discrete quality interventions a task executes (approval, verification…).
- [**Handouts**](handouts.md) — the documents/templates that flow through channels — procedures consume handouts as inputs and produce them as outputs. (Channels are a hidden registry: each handout names its channel inline.)
- [**Tasks**](tasks.md) — the executable work item of a workflow step — the level Jobs are staffed against. Its execution time is not registered here: it derives from the task's procedures. Tasks are requirement-free: how a…
- [**Procedures**](procedures.md) — the documented method for executing a task (ISO §4.4/§7.5). Each row registers how a task is performed under a given requirement set, with its own input and output handouts — the same task can carry…
