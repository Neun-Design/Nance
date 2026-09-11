# Glossary

Domain and architecture terms for EDQMS. Especially useful for those arriving from UX/design or from outside the backend. The rendering concepts derive from the *datamodel* — see [[Working with the Datamodel]].

## Domain and screens

- **EDQMS** — Engineering Data Quality Management System; the Global Engineering Portal.
- **Module** — a sidebar entry (Customers, Operation, Inventory/Portfolio, Workload, Control, Talent). Ordered by `sidebar-position`.
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
