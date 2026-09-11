# Glossary

Domain and architecture terms for **nance.it**. Especially useful for those arriving from UX/design or from outside the backend. The rendering concepts derive from the *datamodel* — see [[Working with the Datamodel]].

## Platform and domain

- **nance.it** — the platform (from *governance* — govern·nance.it). A **knowledge-driven governance** system where quality and governance obligations are *executed*, not just documented, generating audit evidence as a by-product of daily work.
- **EDQMS** (Event-Driven Quality Management System) — the **quality-management engine** of nance.it (modules Organization, Portfolio, Operation). It governs how the organization, its portfolio, and its operations are structured and controlled.
- **Knowledge management** — nance.it's other half: connecting **Workload** (task execution) with **Talent** (user competencies), so obligations are matched to the people competent to execute them.

## Domain and screens

- **Module** — a sidebar entry. The quality-management modules (**Organization**, **Portfolio**, **Operation**) form the EDQMS engine; **Workload** and **Talent** add the knowledge dimension. Ordered by `sidebar-position`.
- **Dashboard / Tab** — a screen inside a module. It renders, top to bottom: cards → data table → reports.
- **Overview** — a special dashboard assembled automatically from cards and reports marked `overview-display: true`.
- **Card** — a KPI above the table (main value, trend, detail), positioned by the grid coordinate `Card R-C`.
- **Report** — a chart below the table; its type and rule come from the datamodel.
- **Subitem table** — a per-row expandable child table (the chevron/arrow), filtered to that row's children.

## Datamodel and engine

- **Datamodel** — the canonical specification of the system. In v1, written in TypeScript (config-as-code) and compiled to `datamodel.json`.
- **Model / View / Behavior** — the three layers of the spec: data shape / layout / behavior (see [[Working with the Datamodel]]).
- **Engine** — the code (TS, framework-agnostic) that interprets the spec and resolves values at runtime.
- **Attribute** — a column/field of an entity, with `type`, `rule`, and constraints.
- **FK (foreign key)** — a reference to another entity; displays the target's *name*, never the raw id.
- **Rollup** — a derived value that aggregates child records (not stored; recomputed).
- **Mirror** — a value mirrored from related records (not stored).
- **Computed** — a value calculated by expression/path (not stored).
- **Derive, don't repeat** — principle: the View is derived from the Model; instances declare only exceptions.

## Data and infrastructure

- **Export contract** — the versioned format of the JSON exported by the app (`export_schema_version`), the basis of migration.
- **ETL** — the Extract/Validate/Transform/Load pipeline that loads JSON snapshots into Postgres idempotently (see [[Data and Migration Pipeline]]).
- **Idempotent** — running the same load N times results in the same state, with no duplication.
- **ADR** — Architecture Decision Record; a decision recorded under `docs/adr/`.
- **shadcn-vue** — the Vue implementation of the shadcn-style components (the original shadcn/ui is React-only).
