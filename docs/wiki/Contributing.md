# Contributing

Thanks for contributing to nance.it. This page is the friendly entry point; the **normative** conventions (branch names, PR titles, labels, templates) are in [`CONTRIBUTING.md`](https://github.com/Neun-Design/Nance/blob/main/CONTRIBUTING.md) at the repository root, and the underlying policy is **ADR-0004**.

## Workflow

1. Open or comment on an *issue* describing what you intend to do (blank issues are disabled — pick a template).
2. Branch from `main` following the convention: `feat/<scope>/<slug>`, `fix/<scope>/<slug>`, `docs/<audience>/<slug>`, `design/<slug>`, `data/<slug>`, `chore/<slug>`. Scopes for `feat`/`fix`: `prototype` · `spec` · `docs` · `data` · `ci` · `infra`. Direct pushes to `main` are blocked.
3. Make the change with matching **tests** and **documentation** (see [[Getting Started]] for the commands).
4. Everything green:

   ```bash
   cd packages/spec && npm run build && npm run diff && npm test     # if the datamodel changed
   cd prototype
   for t in tools/test_*.mjs; do node "$t" >/dev/null || echo "FAIL $t"; done
   python3 tools/validate_mockup.py
   ```

5. Open a PR against `main` with a **Conventional Commits** title — `type(scope): description`, e.g. `feat(prototype): add quality module tabs`, `data(operation): make Tasks.roles a real FK`, `docs(dev): align the wiki with the MVP`. The `validate-pr` Action rejects branch names and titles that do not match; `label-pr` tags the PR by the files changed.

## Conventions

- **Datamodel changes go through `packages/spec`**, never through `prototype/data/datamodel.json` (generated; CI fails on drift). Bump `schemaVersion` in `src/meta.ts`, commit the rebuilt JSON with your change, and add a `prototype/tools/migrate_<slug>.py` when a stored attribute changed — see [[Working with the Datamodel]] and [[Data and Migration Pipeline]].
- **Engine changes (`prototype/js/`) come with a proof** in `prototype/tools/test_engine_*.mjs`. The battery is the contract every datamodel change is measured against, so it must stay meaningful.
- **Scripts document themselves**: a header docstring with purpose, inputs, outputs and the run command (every file in `prototype/tools/` follows this). There is no separate script index — the docstring is the documentation; the wiki table in [[Data and Migration Pipeline]] lists the ones a contributor needs.
- **Contributor documentation lives in `docs/wiki/`** (this wiki is published from there on every merge to `main`, ADR-0005) — never edit the GitHub wiki directly. The stakeholder Guide lives in `site-stakeholder/`. The rendering contract of the artifact is `prototype/DATAMODEL_GUIDE.md`; the prototype's own README covers the running modes.
- **Architecture changes get an ADR** under `docs/adr/` (sequential number, context → decision → consequences).

## PR checklist

- [ ] Branch name and PR title follow the convention (the Action tells you if not).
- [ ] Engine battery + `validate_mockup.py` green; `packages/spec` tests green and `datamodel.json` rebuilt when the spec changed.
- [ ] `schemaVersion` bumped and a migration script added when stored data changed.
- [ ] Documentation updated where it is read: `docs/wiki/` (developers), `site-stakeholder/` (end users), docstrings (scripts), `docs/adr/` (decisions).
- [ ] The PR body says how to see the change (which screen, which column, which command).

## Shared AI context

Contributors use different AI tools (Claude Code, Cursor, Copilot, among others). So that everyone starts from the same understanding:

- **`CLAUDE.md`** at the root describes the architecture, conventions and entry points; **`.claude/skills/gh-tasks/`** packages the review/plan/PR/issue workflow used on this repository. Both are discovered automatically on clone by Claude Code; other assistants can be pointed at the same files.
- **Neutral documentation** (this wiki, `docs/adr/`, `prototype/DATAMODEL_GUIDE.md`) is plain Markdown any assistant can ingest — it is the conceptual source; `.claude/` is its materialization for one tool.

When contributing with AI, feed your assistant this wiki and the ADR log, and **review the output** — the quality bar (green tests, decisions respected, a migration for every stored change) is the same with or without AI.

## License

Apache-2.0 — see `LICENSE` in the repository. The "nance" name and the `nance.it` domain are reserved (see the README's *Project model*).
