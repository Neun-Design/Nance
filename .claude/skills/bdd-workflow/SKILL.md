---
name: bdd-workflow
description: Enforces the BDD-first workflow for nance.it (packages/bdd). Use PROACTIVELY whenever a new feature, improvement, doctrine, decision or behavior change is discussed, planned, or filed as an issue — evaluate if a new .feature or fixture is needed. HARD RULE - features and fixtures are authored and validated BEFORE any step-definition or implementation code is written. Invoked as /bdd-workflow [evaluate|author|validate|implement].
---

# nance.it BDD-first workflow

Rafael's rule (2026-11-17, the round that created `packages/bdd`, issue #473):

> Whenever something new or any kind of improvement is discussed, evaluate the
> need for a new `.feature` or `fixture`. Features and fixtures are created
> BEFORE the step-definitions. Only after the features are VALIDATED do we
> move on to step-definitions and tests.

This is a sequencing law, not a suggestion. It applies to every round:
datamodel changes, engine behavior, reports/cards, API contracts, doctrines.

---

## Phase 0 — `evaluate` (run this in EVERY new discussion)

When a new feature, improvement, bug with behavioral impact, or decision is
being discussed or turned into an issue, answer explicitly:

1. **Does this change observable behavior?** (engine rule, report/card output,
   API contract, eligibility/dispatch doctrine, form gating with data effect)
   - Yes → a `.feature` is required or an existing one must be amended.
   - No (pure refactor, docs, styling) → record "no BDD impact" in the issue.
2. **Which module folder owns it?** Placement rule: the feature lands where
   the decision *bites*, not where the data lives (`packages/bdd/README.md`).
3. **Does it need a fixture?** Reports/cards → structural-invariant fixture in
   `fixtures/reports/`; API payloads → `fixtures/api/`. Fixtures are
   INVARIANTS, never absolute totals (seeds regenerate).
4. Record the verdict in the GitHub issue (a "BDD impact" section listing the
   planned `.feature` file(s) and fixture(s)).

## Phase 1 — `author` (features + fixtures FIRST)

- Write the `.feature` file(s) in English Gherkin under
  `packages/bdd/features/<module>/`, tagged `@wip` plus the taxonomy tags
  (`@module-<name>`, `@issue-NNN`, and `@doctrine`/`@report`/`@api` as
  applicable). `@wip` keeps them out of every run until steps exist — the
  default profile filters `not @wip`.
- Write the fixture files alongside.
- Every feature Background asserts `the schema version is at least N`.
- Never pin calendar dates (the `shiftAnchoredDates` trap); scenarios that
  will mutate the store must carry `@mutating`.
- **Do NOT write step-definitions, engine code, or migrations in this phase.**

## Phase 2 — `validate` (the gate)

Present the Gherkin to Rafael for validation — the scenarios ARE the agreed
specification. Iterate on wording, scenario coverage and examples until he
approves. Nothing downstream starts before this gate. Record the validation
in the issue (or PR review) before proceeding.

## Phase 3 — `implement` (step-definitions + tests + code)

Only after validation:

1. Write/extend step-definitions (`step-definitions/<folder>.steps.mjs`;
   reuse `common.steps.mjs` before writing new steps).
2. Remove the `@wip` tags; `npm run test:engine` / `npm run test:api` must go
   green.
3. Implement the actual change (spec module, engine, migration, proof suite —
   the existing round conventions are unchanged; the proof battery in
   `prototype/tools/` still accompanies engine changes).
4. The PR ships feature + fixture + steps + implementation together, all
   green in the CI `bdd` job.

---

## Reference

- Conventions, tag taxonomy and house rules: `packages/bdd/README.md`
- Runner: Cucumber.js in `packages/bdd` (`npm run test:engine` needs nothing;
  `npm run test:api` needs the chat API booted — see the README)
- Issue/PR mechanics: the `gh-tasks` skill (`.claude/skills/gh-tasks`)
- A feature that needs data the clinic mockup cannot show → raise it in the
  issue; seed changes belong to the seed-builder round, not to fixtures
