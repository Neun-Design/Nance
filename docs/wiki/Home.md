# nance.it — Developer Wiki

Welcome to the documentation for **developers and contributors** of **nance.it**. This wiki is the starting point for anyone who will **write code, design the interface, or work with the project's data** — it is separate and distinct from the stakeholder documentation, which covers the product from a business perspective.

> **Open source** project (Apache-2.0). Contributions are welcome already at this stage. If this is your first time here, start with **[[Getting Started]]**.

## What nance.it is

**nance.it** (from *governance* — govern·**nance.it**) is a **knowledge-driven governance** platform: an event-driven system where quality and governance obligations are *executed*, not just documented, producing audit evidence as a by-product of daily operations.

It is built from two connected halves:

- **EDQMS — the quality-management engine.** It governs how the organization is structured and how work is controlled, through the **Organization**, **Portfolio**, and **Operation** modules.
- **Knowledge management.** Achieved by connecting **task execution (Workload)** with **user competencies (Talent)** — so governance is driven by what people actually know and do: who is competent to execute each obligation, and whether they did.

Under the hood, every screen is metadata-driven: a **specification** (the *datamodel*) describes modules, tables, cards, charts, forms, and filters, and an **engine** interprets that specification and renders the application generically. Understanding this is the key to contributing — see **[[Architecture Overview]]** and **[[Working with the Datamodel]]**.

## Documentation map

| Page | Purpose |
|---|---|
| [[Getting Started]] | Prerequisites, clone, install, run app/API/tests/ETL. |
| [[Architecture Overview]] | Big picture: spec → engine → renderer/API, stack and principles. |
| [[Working with the Datamodel]] | How the datamodel works (config-as-code) and how to add fields/entities. |
| [[Data and Migration Pipeline]] | Export format, JSON→Postgres ETL, and Python data tooling. |
| [[Contributing]] | Workflow, conventions, PRs, and shared AI context. |
| [[Glossary]] | Domain terms (module, dashboard, card, report, rollup, mirror, subitem…). |

## Where decisions live

The **architecture decisions** live in the repository, under `docs/adr/` (the *ADR log*), not here — this wiki explains *how to work*; the ADRs explain *why* the project is the way it is. When a "why" is relevant on a page, it points to the corresponding ADR.

## Source of this wiki

This content is **written and versioned in `docs/wiki/` in the repository** and published here to the GitHub Wiki. To fix or extend a page, edit the corresponding file in `docs/wiki/` and open a PR — do not edit directly through the wiki interface, to avoid drifting from the code (see ADR-0005).
