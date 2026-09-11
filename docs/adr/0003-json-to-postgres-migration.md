# ADR-0003 — JSON → Postgres data migration via idempotent ETL

- **Status:** Accepted
- **Date:** 2026-09-11
- **Deciders:** Rafael Bova (project owner)
- **Related:** ADR-0001 (stack), ADR-0002 (datamodel), ADR-0004 (dev workflow)

## Context

The end client **already uses the current MVP in production** and its database is persisted as **JSON** (the prototype's in-memory store serialized, in the structure `module → entity → rows`, as in `mockup_data_prototype.json`). That use continues **until the v1 cloud launch**. At launch, the accumulated real data must be loaded into **PostgreSQL**, whose schema is **generated from the datamodel's Model layer** (ADR-0002).

Facts that guide the solution: derived fields (rollup/mirror/computed) are **not** stored — they are recomputed by the engine — so the migration only needs the **base fields**. The launch may slip, and last-minute fixes may require reloading. And the project values documented **Python data tooling**, so that developers, UX, and designers understand the pipeline and use their own assistants (ADR-0004).

## Decision

**Define a versioned export contract now and implement the migration as an idempotent, re-runnable ETL in Python.**

**1. Freeze and version the export contract — immediately.** Since the client accumulates data every day, a stable, versioned export format (`export_schema_version`) is defined now, with metadata (timestamp, app version, datamodel version that produced it). The prototype starts exporting in that format. This protects the data generated from now until launch and makes the migration predictable, instead of chasing a format that changes along the way.

**2. Four-stage ETL** (`tools/etl/`, Python), runnable as many times as needed:

- **Extract.** Read an exported JSON snapshot; identify `export_schema_version` and pick the matching adapter.
- **Validate.** Check the snapshot against the **schema derived from the Model layer** (the same `zod`/JSON Schema from ADR-0002, exported for Python consumption as JSON Schema). Failures become a readable **validation report**, without loading anything — the problem is found before touching the database.
- **Transform.** Drop derived fields; map multivalued/array fields to JSONB or association tables per the Model; normalize types (ISO dates, enums); preserve the original primary keys to keep identity stability and referential integrity.
- **Load.** Insert in FK topological order (parents before children), all within **one transaction**, via **idempotent upsert** (`INSERT ... ON CONFLICT (pk) DO UPDATE`). Running the same snapshot twice produces exactly the same state — no duplication.

**3. Operation modes.** `--dry-run` (validates and simulates, reporting counts and differences, without writing); `--load` (runs for real); `--report` (produces a summary: rows per entity, rejections, orphan FKs). A **migration log** in its own table records each run (snapshot version, counts, result).

**4. Testability.** Tests (pytest) with fixture snapshots covering: idempotency (running 2× = same state), referential integrity, and round-trip (prototype export → ETL → query in Postgres matches expectations). They reuse the intent of the existing tests (`validate_mockup.py`, `test_resolve.mjs`).

**5. Cutover at launch.** Since the ETL is idempotent, the launch is: freeze writes in the prototype → export the final snapshot → `--dry-run` → `--load` → validate → point v1 at Postgres. If anything fails, fix it and reload the same snapshot with no side effects.

## Consequences

**Positive.** Re-runnable and safe: the launch date can change and fixes can be reapplied with no risk of duplicating data. Validation against the Model anticipates data-quality problems. It reuses the Model as the single source (database schema, ETL validation, and app rules all come from the same place). Written in Python and documented, it is accessible to the whole team.

**Negative / costs.** Requires discipline to keep the export contract stable and evolve it by version (with a per-version adapter in Extract). PK stability depends on the prototype not reusing/renumbering ids — this must be guaranteed in the export. Divergences between the format accumulated by the client and the current Model will need explicit mapping rules (documented alongside the version adapter).

**Neutral.** Derived fields absent from the database are expected and recomputed by the engine; the migration does not consider them.

## Considered alternatives

**Single (big-bang) cutover with no idempotency.** Simpler to write, but fragile: any failure or date slip forces manual cleanup before reloading. Discarded because of the asymmetry between the low cost of idempotency and the high risk of the one-shot.

**Continuous sync / dual-write** between JSON and Postgres during a transition window. Robust for zero-downtime, but requires maintaining two write systems in parallel and reconciling them — complexity disproportionate to an MVP with a planned cutover. Discarded.
