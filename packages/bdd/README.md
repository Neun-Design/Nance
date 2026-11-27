# @nance/bdd — the BDD layer

Gherkin features are the executable home for the project's **doctrines and
decisions** (issue #473). Where a proof suite in `prototype/tools/` asserts an
implementation, a feature here states the *rule* in business language and
proves it against the live engine, the report queries, or the public API.

## Layout

```
features/<module>/*.feature   one folder per datamodel module + api/
step-definitions/*.steps.mjs  one file per feature folder + common.steps.mjs
support/                      engine loader, World, hooks
fixtures/reports/ fixtures/api/
```

The module folders mirror `packages/spec/src/modules/`: `organization`,
`portfolio`, `crm`, `talent`, `operation`, `workspace`, `control` — plus
`api/` for the Ask AI service contract.

**Placement rule:** a doctrine lands as a feature in the module where the
decision *bites*, not where the data lives. Procedure eligibility is a
`workspace/` feature — it governs ticket/task dispatch — even though the raw
records belong to Talent and Operation.

## Running

```bash
npm ci
npm run test:engine        # everything except @api (no server needed)

# API scenarios need the chat API running locally:
ANTHROPIC_API_KEY=dummy EDQMS_RATE_LIMIT_REQUESTS=5 EDQMS_RATE_LIMIT_WINDOW_SECONDS=60 \
  python3 -m uvicorn server:app --app-dir ../../site-stakeholder/api --port 8777 &
npm run test:api           # only @api; override the URL with BDD_API_URL
```

CI runs both in the `bdd` job of `.github/workflows/test-battery.yml`.

## Tag taxonomy

| Tag | Meaning |
|---|---|
| `@module-<name>` | the owning module folder |
| `@issue-NNN` | the GitHub issue that decided the rule |
| `@doctrine` | encodes a recorded decision/doctrine |
| `@report` | exercises a `REPORT_QUERIES`/`CARD_QUERIES` contract |
| `@api` | needs the chat API running (excluded from `test:engine`) |
| `@mutating` | mutates the in-memory store — the After hook restores a pristine snapshot |
| `@wip` | excluded from every run (default profile filters `not @wip`) |

## House rules

- **Fixtures are invariants, never totals.** Seeds regenerate and
  `derive_control.py` recomputes the Control tables — a fixture pinning
  absolute numbers rots on the next seed round. Pin structure (series names,
  types, label sources) and derivation *equations*; exact values only when
  anchored to the planted stories in `prototype/tools/seed/narrative.md`.
- **Every Background asserts `the schema version is at least N`** — the
  repo-wide `getSchemaVersion() >= N` convention, so stale features fail
  loudly instead of silently testing an older model.
- **Never pin calendar dates.** `shiftAnchoredDates` (`prototype/js/data.js`)
  moves every date forward on load; use `anchorToday()` when a step needs
  "today".
- **The engine is read-mostly.** Scenarios that mutate records must carry
  `@mutating`; the hook restores the snapshot, but steps should still restore
  what they touched (re-approval behavior is often part of the rule itself).
- **@api scenarios never reach the Anthropic client.** The rate limiter runs
  before validation and every fixture fails validation, so a dummy
  `ANTHROPIC_API_KEY` is safe — never write a scenario whose request would
  pass validation. Each scenario takes a fresh `X-Forwarded-For` identity to
  isolate the per-IP limiter.
- **BDD only READS `prototype/`** — never rebuild `datamodel.json` from here
  (the CI drift guard owns that), never edit the mockup copies.

## Adding a feature

1. Pick the module folder by where the decision bites.
2. Reuse steps from `common.steps.mjs` before writing new ones; new step
   files are named after the feature folder they serve.
3. Tag with `@module-<name>` + `@issue-NNN` (+ `@doctrine`/`@report`/`@api`).
4. If the rule needs data the clinic mockup can't show, raise it in the issue
   — seed changes belong to the seed builder round, not to fixtures here.
