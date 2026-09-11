# Contributing

Thanks for contributing to EDQMS. This page summarizes how we work. The underlying policy is **ADR-0004**; the `CONTRIBUTING.md` file in the repository is the normative version (this page is the friendly entry point).

## Workflow

1. Open or comment on an *issue* describing what you intend to do.
2. Create a branch following the project's convention (e.g. `feat/...`, `fix/...`, `docs/...`).
3. Make the changes with matching **tests** and **documentation**.
4. Run `pnpm test` and `pytest tools/` — both green.
5. Open a PR following the checklist below.

## Conventions

- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`…).
- Changed the datamodel **Model**? Generate the database migration and run `pnpm spec:build` (see [[Working with the Datamodel]]).
- Created a **script** (Python or Node)? Document it: header docstring + an entry in `tools/README.md` with the command and an example.
- Changed **contributor documentation**? Edit the files in `docs/wiki/` (not directly in the GitHub wiki) and open a PR — the wiki is published from `docs/wiki/` (see ADR-0005).

## PR checklist

- [ ] Relevant tests added/updated and green (`pnpm test`, `pytest tools/`).
- [ ] Documentation updated (wiki in `docs/wiki/`, `tools/README.md`, docstrings).
- [ ] If an architecture decision changed, an ADR was added under `docs/adr/`.
- [ ] Commits follow Conventional Commits.

## Shared AI context

Contributors use different AI tools (Claude Code, Cursor, Copilot, Fable, among others). So that everyone starts from the same understanding:

- **`.claude/`** in the repository provides *agents*, *skills*, and *commands* for those using Claude Code; the **`CLAUDE.md`** at the root describes the architecture, conventions, and entry points. It is discovered automatically on clone.
- **Neutral documentation** (this wiki and `docs/adr/`) is Markdown any AI assistant can ingest — it is the conceptual source; `.claude/` is its materialization for Claude Code.

When contributing with AI, feed your assistant this wiki and the ADR log, and **review the output** — the quality bar (green tests, decisions respected) is the same, with or without AI.

## Code of conduct and license

See `CODE_OF_CONDUCT.md` and `LICENSE` in the repository.
