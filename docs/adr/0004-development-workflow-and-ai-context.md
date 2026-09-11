# ADR-0004 — Development workflow and shared AI context

- **Status:** Accepted
- **Date:** 2026-09-11
- **Deciders:** Rafael Bova (project owner)
- **Related:** ADR-0001, ADR-0002, ADR-0003
- **Refined by:** ADR-0005

## Context

nance.it v1 will be **open source**, and external contribution matters already at this stage. The project is **polyglot**: the application in TypeScript (Vue/Express/Node — ADR-0001), the specification in compiled TypeScript (ADR-0002), and data/ETL/validation tooling in **Python** (ADR-0003). Contributors — developers, UX, and designers — will use **different AI tools** (Claude Code, Cursor, Copilot, Fable, among others) and need to start from the **same understanding** of the project so their contributions are coherent.

There is also a specific request: to materialize the Claude Code development context (skills, agents, and related documentation) so that any contributor uses the same environment. The initial idea was *gists*; this ADR decides how to handle this sustainably.

## Decision

**Make the repository the single source of the workflow and the AI context — versioned with the code, tool-agnostic, and with all scripts documented.**

**1. Every script is documented, not just application code.** Each tool in `tools/` (Python scripts for data parsing, ETL, validation; Node test scripts) has: a docstring header explaining purpose, inputs, and outputs; an entry in `tools/README.md` with the run command and an example; and, when it produces or consumes data, a reference to the matching contract/Model. The goal is for UX and designers to **understand the pipeline** and be able to ask their own AI tools for help without relying on tribal knowledge.

**2. AI context lives in `.claude/` in the repository — not in gists.** The versioned `.claude/` folder contains `agents/`, `skills/`, and `commands/`, and a `CLAUDE.md` at the root describes the architecture, conventions, and entry points. This way the context is discovered automatically by Claude Code in any clone, evolves in PRs alongside the code, and never drifts from it. *Gists* were discarded for being decoupled from the repository, unversioned together, and prone to divergence.

**3. Tool-agnostic context.** Since not everyone uses Claude Code, the essential understanding (architecture, domain glossary, decisions — this ADR log) lives in neutral Markdown under `docs/`, which any AI assistant can ingest. `.claude/` is the *tool-specific materialization* of that context for Claude Code; the conceptual source is the neutral documentation, avoiding divergent duplication.

**4. Minimal contribution conventions.** A `CONTRIBUTING.md` defines: monorepo setup (pnpm, Python), how to run app/tests/ETL, branch and Conventional Commits standards, the requirement of green tests (Vitest for the engine, pytest for the ETL), and PR review. `LICENSE`, `README.md`, and `CODE_OF_CONDUCT.md` complete the open source package.

**5. Basis for the "Developers" content.** The contributor-facing documentation **derives** from this repository (this ADR, `CONTRIBUTING.md`, `tools/README.md`, and `CLAUDE.md`), instead of being maintained separately — the human documentation and the AI context come from the same source.

## Consequences

**Positive.** A single place of truth for code, decisions, and AI context, versioned together. Contributors on any AI tool start from the same understanding. The Python pipeline is accessible to non-backend profiles. The contributor documentation does not become a parallel document that ages.

**Negative / costs.** Requires discipline to keep `.claude/`, `docs/`, and docstrings up to date in PRs (mitigable with a PR checklist item and, in the future, a CI check). There is an initial cost to document each existing script.

**Neutral.** The choice does not force anyone to use Claude Code; it only offers the context ready for those who do, and the neutral equivalent for those who do not.

## Considered alternatives

**Gists for skills/agents/documentation.** The initial proposal. Discarded: gists sit outside the PR flow, are not versioned with the code, and tend to drift from the repository's reality.

**A companion repository just for AI context.** Keeps the context separate from application code; discarded for the same reason as gists (desynchronization) and for doubling the maintenance overhead.

**GitHub Wiki as the source of the dev documentation.** Useful for navigation, but the wiki lives outside source-code versioning; we adopt `docs/` in the repository as the source and leave the wiki as a generated mirror, not the truth. (This alternative is refined by ADR-0005, which places contributor documentation in the wiki while keeping `docs/wiki/` as the versioned source.)
