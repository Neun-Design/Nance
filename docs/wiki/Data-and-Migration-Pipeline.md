# Data and Migration Pipeline

How data lives in the **current MVP**, which Python tools maintain it, and what happens to the data when the datamodel changes. The v1 plan (JSON → PostgreSQL, **ADR-0003**) is summarized at the end — it is decided, not built.

## Today — the two JSON files

Everything the prototype shows comes from `prototype/data/`:

| File | What it is | Who writes it |
|---|---|---|
| `datamodel.json` | The **schema**: modules, tables, attributes, rules, forms, cards, reports. `_meta.schemaVersion` identifies the schema (114 at the time of writing). | **Generated** from `packages/spec` — never by hand (see [[Working with the Datamodel]]). |
| `mockup_data_prototype.json` | The **Vitalis demo dataset**: `module → entity → rows`, plus `_meta` (`schemaVersion`, `anchorDate`, `domain`, `organization`). | The seed generator, then one `migrate_*.py` per schema change. |
| `countries.json` | A system registry (loaded in every mode, never user-edited). | Static. |

Two rules hold the pair together:

- **Only stored attributes are persisted.** `rollup`, `mirror` and `computed` attributes are derived by the engine at render time; a stored copy of a derived value is a bug (the validator reports it as an "extra non-canonical field").
- **Dates are anchored.** The seed stamps `_meta.anchorDate`; on load the engine shifts every date forward by the whole months elapsed since the anchor, so "the last 12 months" always end in the current month and the demo never ages.

## Blank mode and snapshots

Opening the app with `?data=empty` (locally) or under `/app/mvp/` (published) boots every table **empty**. Records created there persist in the browser's `localStorage`; `?reset=1` wipes them. The header offers **Export / Import** (any browser) and **Save / Save As** to a real file (Chromium, File System Access API):

```json
{ "_meta": { "app": "EDQMS prototype", "kind": "blank-snapshot", "schemaVersion": 114, "exportedAt": "…" },
  "Blank": { "Regions": [ … ], "Business Units": [ … ], … } }
```

On import the app compares the file's `schemaVersion` with its own and **warns on mismatch**; tables it does not catalogue are skipped and reported. There is no automatic upgrader for user snapshots — if a schema change breaks old snapshots, the migration script below is the tool to bring them forward.

## The Python tooling (`prototype/tools/`)

Every script documents itself in its header docstring (open the file, or `python3 <script> --help` where it takes arguments). Run them **from `prototype/`**. `pip install pyyaml` first.

| Script | Purpose | Run |
|---|---|---|
| `validate_mockup.py` | The **parity contract** between schema and data: stored attributes present on every row and nothing else, FKs resolvable, rollup coverage, report/card data sufficiency, Control tables equal to their derivation. Exit 1 on failure. | `python3 tools/validate_mockup.py` |
| `seed/build_seed.py` | **Deterministic, catalogue-driven generator** of the demo dataset from `seed/domains/clinic.yaml` (Vitalis). Every produced row is checked against the stored-attribute contract; any divergence raises. Output: `seed/out/mockup_clinic.json` (`--out` to change). | `python3 tools/seed/build_seed.py --domain clinic --strict-narrative` |
| `seed/test_seed_pipeline.py` | Proof that two builds are byte-identical and that a stored attribute without a seed rule fails loudly. | `python3 tools/seed/test_seed_pipeline.py` |
| `derive_control.py` | **Capacity** and **Performance** (Control module) are outputs, never inputs: recomputed from People, Forecast Scopes and Jobs. Used by the seed and by the validator. | imported, not run directly |
| `migrate_<slug>.py` | **One script per schema change** that touches stored data: deterministic, idempotent, stamps `_meta.schemaVersion`. The history of the dataset is the list of these files. | `python3 tools/migrate_<slug>.py` |
| `generate_mockup.py` | The generator that predates `seed/`; kept for history. New data goes through the seed. | — |
| `test_*.mjs` | The **engine battery** (Node, 84 proofs) — reads the artifact and the dataset like the app does. | `for t in tools/test_*.mjs; do node "$t"; done` |

## The loop — when the datamodel changes

A datamodel change is only done when the data still satisfies the contract:

1. Edit `packages/spec/src/modules/<module>.ts`, bump `schemaVersion` in `src/meta.ts`, `npm run build` ([[Working with the Datamodel]]).
2. **Did a stored attribute appear, disappear, or change type/meaning?** Write `prototype/tools/migrate_<slug>.py` — deterministic, idempotent (re-running on an already-migrated file changes nothing), stamping the new `schemaVersion` into `_meta`. Pattern to copy: `migrate_jobs_derived_copies.py` (drops a stored copy that became a mirror). Keep the file format (`indent=1, ensure_ascii=False`) so the diff shows only the rows you touched.
3. Update `seed/build_seed.py` (and `domains/clinic.yaml` if the domain vocabulary changed) so a fresh seed also satisfies the new contract.
4. `python3 tools/validate_mockup.py` and the battery must be green. The validator has its **own** regexes over the rule text (`FK → Entity`, `rollup → Entity (via: field)`), so it is a third reader of the artifact, next to the engine and the tests.

If your change is only derived (a rollup, a new report), no migration is needed — but the validator still checks that the relation resolves in the data.

## Tomorrow — v1 (ADR-0003, not built)

At the v1 launch the accumulated JSON goes into **PostgreSQL**, whose schema is generated from the spec's Model layer. ADR-0003 decides a **versioned export contract** (the snapshot `_meta` above is its seed) and an idempotent Python **ETL** in four stages — Extract (adapter per export version) → Validate (against the Model) → Transform (drop derived fields, map multivalued fields) → Load (FK order, one transaction, `INSERT … ON CONFLICT DO UPDATE`). Because it is idempotent, cutover is: freeze the prototype → export → `--dry-run` → `--load` → verify. None of `tools/etl/` exists yet; when it lands, this section becomes the "Today".
