# ADR-0005 — Contributor documentation in the GitHub Wiki

- **Status:** Accepted
- **Date:** 2026-09-11
- **Deciders:** Rafael Bova (project owner)
- **Refines:** ADR-0004 (development workflow and AI context)
- **Related:** ADR-0001, ADR-0002, ADR-0003

## Context

ADR-0004 anticipated that developer documentation would derive from the repository and mentioned the possibility of a "Developers" tab in the stakeholder documentation. On review, it was decided that **treating the open source contributor as a stakeholder is conceptually wrong**: they are distinct audiences with distinct needs. Contributor documentation deserves its own, separate, navigable home.

At the same time, ADR-0004 established (rightly) that whatever must accompany the code should live **in the repository**, versioned and reviewed via PR — so it does not drift. The two things must be reconciled: a welcoming home for the contributor **and** the guarantee that it does not detach from the code.

Relevant technical constraint: the **GitHub Wiki has no API** and is a separate git repository (`<owner>/<repo>.wiki.git`); the first page must be created through the web interface to initialize it, and from then on it is published via `git push`.

## Decision

**Contributor documentation now lives in the GitHub Wiki, but it is written and versioned in `docs/wiki/` in the repository and published to the wiki from there.**

Concretely:

- **Source of truth:** the Markdown files in `docs/wiki/` in the repository. Edits come through PRs (review, versioning, history) — never directly through the wiki interface.
- **Publishing:** the content of `docs/wiki/` is mirrored to `<owner>/<repo>.wiki.git`. Manually at first; automated with a GitHub Action that pushes on every change to `docs/wiki/` on the main branch (`.github/workflows/publish-wiki.yml`).
- **Role of the wiki:** the navigable, friendly *presentation* layer for developers, UX, and designers — separate from the stakeholder documentation. It does not replace the repository as the source.
- **What stays in the repository (does not move to the wiki):** the **ADR log** (`docs/adr/`), the **`.claude/`** (agents/skills/commands), and the normative **`CONTRIBUTING.md`**. These artifacts must accompany the code and go through PRs; the wiki references them, it does not host them.
- **The "Developers tab" in the stakeholder documentation is cancelled** as a concept; its purpose is served by the wiki.

## Consequences

**Positive.** Contributors get their own, navigable documentation, without being treated as stakeholders. Since the source is `docs/wiki/` in the repository, the docs do not drift from the code and evolve via PR. The ADR log and `.claude/` remain intact in the repository.

**Negative / costs.** There is a publishing step (mirror `docs/wiki/` → `.wiki.git`), automated by the Action but requiring a `WIKI_TOKEN` secret. The wiki must be **enabled and have its first page created via the web interface** before the first push (a GitHub limitation). Contributors must remember to edit `docs/wiki/`, not the wiki directly (mitigated by a note in each page's footer and in `CONTRIBUTING.md`).

**Neutral.** The ADR-0004 principle ("repository as the source") is kept; only the *presentation surface* of the contributor documentation changes.

## Considered alternatives

**A "Developers" tab in the stakeholder documentation** (proposed in ADR-0004). Discarded for mixing distinct audiences: a contributor is not a stakeholder.

**Wiki as the source of truth (edited directly through the interface).** Discarded: the wiki lives outside source-code versioning, with no PR, and would drift — exactly the risk ADR-0004 wanted to avoid.

**Only `docs/` in the repository, no wiki.** Correct regarding versioning, but less navigable and welcoming for newcomers; the wiki adds the presentation layer without giving up the versioned source.
