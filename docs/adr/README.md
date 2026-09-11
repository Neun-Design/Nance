# Architecture Decision Records (ADR) — nance.it

This directory records the **architecture decisions** for **nance.it** (its quality-management engine, EDQMS, and the surrounding platform). Each ADR documents *one* decision: the context that motivated it, the decision taken, the consequences, and the discarded alternatives. ADRs are **immutable once accepted** — when a decision changes, a new ADR is created that *supersedes* the previous one, preserving the history.

The purpose of this log is twofold. First, traceability: any contributor (or AI tool) understands *why* the project is the way it is without commit archaeology. Second, it serves as shared context in an **open source** project where developers, UX, and designers use different AI tools — the ADRs are the source of truth everyone feeds into their assistants.

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](0001-v1-technology-stack.md) | v1 technology stack: Vue + Express + Node + Postgres | Accepted |
| [0002](0002-datamodel-config-as-code.md) | Datamodel as config-as-code (Model / View / Behavior) | Accepted |
| [0003](0003-json-to-postgres-migration.md) | JSON → Postgres data migration via idempotent ETL | Accepted |
| [0004](0004-development-workflow-and-ai-context.md) | Development workflow and shared AI context | Accepted (refined by 0005) |
| [0005](0005-contributor-docs-in-github-wiki.md) | Contributor documentation in the GitHub Wiki | Accepted |

## Format

We follow **MADR** (Markdown Any Decision Records), lean: `Status`, `Context`, `Decision`, `Consequences`, `Considered alternatives`. Sequential four-digit numbering; file name in kebab-case. A new ADR starts as `Proposed`, becomes `Accepted` after review, and may end as `Superseded by 00NN` or `Deprecated`.

To propose a new decision, copy an existing ADR as a template, fill in the sections, open a PR, and reference the issue/discussion that originated it.

## Scope and sequence

These ADRs cover the v1 foundation. One deliverable depends on **implementing** them and will be handled next, not in this log:

1. **Materializing the AI context** (`.claude/` with agents, skills, and commands + `CLAUDE.md`) — the policy is in ADR-0004; the files themselves land when the v1 repository is created.

> The former "Developers tab in the Stakeholder documentation" was **cancelled** by ADR-0005: contributor documentation now lives in the **GitHub Wiki**, written and versioned in `docs/wiki/`. The initial wiki content is already in `docs/wiki/`.

## Cross-cutting principle

One decision cuts across all ADRs and is worth stating up front: **the system specification (the datamodel) and the engine that interprets it are framework-agnostic**. They are pure TypeScript, with no dependency on Vue, Express, or Postgres. Only the thin layers — the *renderer* (Vue), the *API* (Express), and the *loader/persistence* (Postgres) — know the concrete technology. This keeps low the cost of any future framework change and is what lets each decision below be treated relatively independently.
