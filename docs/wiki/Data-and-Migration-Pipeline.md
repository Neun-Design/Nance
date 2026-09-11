# Data and Migration Pipeline

How data enters nance.it and how the v1 database will be populated from what the client already uses today. The data tooling is **Python** and is documented so that any role (dev, UX, designer) understands the pipeline and can use their own AI tools. Underlying decision: **ADR-0003**.

## Context

The client already uses the MVP and its database is saved as **JSON** (structure `module → entity → rows`). At the v1 launch, that data goes into **PostgreSQL**, whose schema is **generated from the datamodel's Model layer**. Derived fields (rollup/mirror/computed) are **not** stored — the engine recomputes them — so the migration only loads **base fields**.

## Export contract (versioned)

The exported JSON carries metadata: `export_schema_version`, timestamp, app version, and the datamodel version that produced it. **Freezing this format now** is what makes the data accumulated from now until launch migratable. Each export version has a matching adapter in the *Extract* stage.

## The ETL in four stages

The scripts live in `tools/etl/`.

1. **Extract** — reads a JSON snapshot and picks the adapter by `export_schema_version`.
2. **Validate** — checks the snapshot against the schema derived from the Model (the same `zod`/JSON Schema from the spec, exported to Python). Failures become a **readable report**, without touching the database.
3. **Transform** — drops derived fields; maps multivalued/array fields to JSONB or association tables per the Model; normalizes types; preserves the original PKs (identity stability and referential integrity).
4. **Load** — inserts in FK topological order (parents before children), in a **transaction**, via **idempotent upsert** (`INSERT ... ON CONFLICT (pk) DO UPDATE`). Running the same snapshot twice yields the same state — no duplication.

## Usage modes

```bash
python -m tools.etl --snapshot export.json --dry-run   # validates and simulates, no writes
python -m tools.etl --snapshot export.json --load      # runs for real
python -m tools.etl --snapshot export.json --report    # summary: rows/entity, rejections, orphan FKs
```

Each real run is recorded in a **migration log** (snapshot version, counts, result).

## Cutover at launch

Because the ETL is idempotent: freeze writes in the prototype → export the final snapshot → `--dry-run` → `--load` → validate → point v1 at Postgres. If anything fails, fix it and reload the **same** snapshot with no side effects.

## Tests

Under `tools/` with **pytest**, covering idempotency (2× = same state), referential integrity, and round-trip (prototype export → ETL → query in Postgres matches expectations). Run `pytest tools/`.

## Other data tooling

Related/legacy scripts for generating and validating mockups also live in `tools/` and are documented in `tools/README.md` (purpose, inputs, outputs, run example). If you create a new script, document it there — it is part of the **ADR-0004** policy.
