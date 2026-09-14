# Getting Started

Everything you need to run the **current MVP** on your machine and make a first contribution. If any step fails, open an *issue* — fixing this guide is a valid contribution.

> **What exists today vs. what is decided.** The MVP is the **prototype**: a static, vanilla-JavaScript SPA (`prototype/`) whose screens are rendered from a *datamodel* compiled from TypeScript (`packages/spec/`). The v1 stack (Vue + Express + PostgreSQL, ADR-0001) is the decided target and is **not built yet** — do not look for `apps/` or `pnpm`. See [[Architecture Overview]].

## Prerequisites

- **Node.js 22+** (24 works) and **npm** — for the datamodel spec and the engine test battery.
- **Python 3.11+** — the validator, seed and migration scripts, and the stakeholder docs site. `pip install pyyaml` for the validator.
- **Git**.

No database, no bundler, no framework install.

## Repository layout (today)

```
Nance/
├─ prototype/                 # the MVP — static SPA, open it with any http server
│  ├─ index.html, js/         # the metadata engine (model.js, resolve.js, queries.js, forms.js, …)
│  ├─ data/datamodel.json     # GENERATED from packages/spec — never hand-edit
│  ├─ data/mockup_data_prototype.json   # the Vitalis demo dataset (seeded)
│  └─ tools/                  # test battery (test_*.mjs), validate_mockup.py, seed/, migrate_*.py
├─ packages/spec/             # the datamodel as config-as-code (TypeScript) → compiles datamodel.json
├─ site-stakeholder/          # the stakeholder Guide (MkDocs) + the optional "Ask AI" API
├─ docs/adr/, docs/wiki/      # decisions; this wiki (published from here)
├─ CLAUDE.md, .claude/        # shared AI context
└─ CONTRIBUTING.md            # the normative conventions (branches, PR titles, labels)
```

## Run the prototype

```bash
git clone git@github.com:Neun-Design/Nance.git
cd Nance/prototype
python3 -m http.server 8080
# open http://localhost:8080          — the demo, pre-loaded with the Vitalis dataset
# open http://localhost:8080/?data=empty   — blank mode: model your own operation from scratch
```

It is a static folder: no build step, no `npm install`. Data lives in the browser session; **Export/Import** in the header saves and loads a JSON *snapshot* stamped with the datamodel's `schemaVersion`.

## Set up the datamodel spec

```bash
cd packages/spec
npm ci                # devDependencies always install (.npmrc include=dev)
npm run build         # spec (TS) → ../../prototype/data/datamodel.json  (idempotent)
npm run diff          # "no differences" when the committed JSON matches the spec
npm test              # Vitest — laws over the real datamodel, the build gate, the layers
```

The compiled `datamodel.json` is committed. **Never edit it by hand** — change `src/modules/<module>.ts`, bump `schemaVersion` in `src/meta.ts`, rebuild, commit both. CI fails on drift. Full guide: [[Working with the Datamodel]].

## Run the test battery

```bash
cd prototype
for t in tools/test_*.mjs; do node "$t" >/dev/null || echo "FAIL $t"; done   # 84 engine proofs
python3 tools/validate_mockup.py                                             # datamodel ↔ mockup parity
```

Both must be green before a PR. They are the **final oracle** for any datamodel change (the engine, the validator's own regexes and the battery all read the artifact).

## Run the stakeholder Guide (optional)

```bash
pip install "mkdocs>=1.6" "mkdocs-material>=9.6"
cd site-stakeholder && mkdocs serve
# open http://localhost:8000
```

The published Guide is what end users read: https://neun-design.github.io/Nance/ (the demo app is served under `/app/`, blank mode under `/app/mvp/`).

## Your first change — the shape of a datamodel PR

1. Branch per `CONTRIBUTING.md` (`feat/prototype/<slug>`, `data/<slug>`, …).
2. Edit `packages/spec/src/modules/<module>.ts`; bump `schemaVersion`; `npm run build`.
3. If a stored attribute was added or removed, write a deterministic `prototype/tools/migrate_<slug>.py` that updates `mockup_data_prototype.json` (pattern: `migrate_jobs_derived_copies.py`) and, when relevant, the seed in `tools/seed/build_seed.py`.
4. Battery + validator green; add or update an engine proof under `tools/test_engine_*.mjs` when behavior changes.
5. PR with a Conventional Commits title — see [[Contributing]].

## Where the v1 work will go

`packages/spec` is placed where the v1 monorepo (ADR-0001) expects it, so it needs no move. The Vue renderer, the Express API, the Postgres schema (Drizzle) and the Python ETL (ADR-0003) are the next phases; the wiki will grow those sections when they exist.
