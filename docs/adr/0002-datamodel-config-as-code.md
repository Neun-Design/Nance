# ADR-0002 — Datamodel as config-as-code (Model / View / Behavior)

- **Status:** Accepted
- **Date:** 2026-09-11
- **Deciders:** Rafael Bova (project owner)
- **Related:** ADR-0001 (stack), ADR-0003 (migration), ADR-0004 (dev workflow)

## Context

In the prototype, a single `datamodel.json` describes the whole system — modules, tables, attributes, cards, reports, forms, filters, and subitems — and an engine (`model.js` + `resolve.js` + `queries.js`) interprets and renders it generically. This metadata-driven design is the project's greatest asset and must be preserved. However, authoring in plain JSON revealed three problems:

**No abstraction mechanism.** JSON has no variables, references, inheritance, or functions. There is no way to factor out repetition: adding a parameter to every `form` field requires editing each instance by hand. Instances carry the full specification instead of just *overrides*.

**Behavior as prose.** The `rule`s, the `check`s ("Disable this field until Ticket has been selected"), the cascade `field-rule`s, and the report `rule`s are, in practice, code written in English, interpreted by a tolerant parser or hand-mapped in `queries.js`. It is logic disguised as data — fragile, unverifiable, and without editor support.

**Model, View, and Controller conflated.** Schema (attributes, types, FKs), layout (card grid, columns, drawer steps, chart type), and behavior (rules, cascades, queries) live in the same nodes, with no seam between layers.

The datamodel guide already documents *drift* bugs stemming from this (e.g. the `overview-dislay` key misspelled in several places; casing inconsistencies), typical symptoms of a configuration with no validation or types.

## Decision

**Author the datamodel as config-as-code in TypeScript, separated into three layers, and compile it to a JSON artifact consumed at runtime.**

**Three layers** (in the `packages/spec` package, one folder each):

- **Model** — entities, attributes, types, and **structured relations** (FK/rollup/mirror as typed objects, not prose). It is the source of truth for the data shape and feeds the Postgres schema generation (ADR-0001) and the migration export/validation contract (ADR-0003).
- **View** — per-screen layout (visible columns, card grid, drawer steps, chart choice), referencing Model fields by id and **composed from presets**.
- **Behavior** — cascades (`check`), option filters (`field-rule`), and card/report query definitions, as **TypeScript functions**, not prose.

**Derive, don't repeat.** Most of the View is *deduced* from the Model: an FK attribute becomes a select whose options come from the target table; a numeric one right-aligns and joins the Σ row. Each screen declares only exceptions. A form is "the Model's fields, minus these, in these steps, with these overrides" — not N full specs.

**Reusable presets.** Field archetypes (`fkSelect`, `dateRange`, `moneyInput`) defined once as factory functions; instances apply them with pointwise overrides. Adding a parameter to every field of a type becomes a change in **one** place.

**Compile to JSON.** A build step serializes the resolved spec into a `datamodel.json` (now a *generated* artifact, not hand-written), consumed by the engine at runtime and by the schema generator. This preserves the "single artifact" benefit and the ability to inspect the effective spec, without paying the cost of authoring JSON by hand.

**Validate via types + zod.** The type compiler prevents omitting a required key or misspelling a name; a `zod` schema validates domain invariants at build time (e.g. every table has exactly one PK; every FK points to an existing entity). The documented drift bugs become impossible.

Illustrative example of the target pattern:

```ts
// behavior/presets.ts — archetypes defined ONCE
const fkSelect = (target: Entity, opts: Partial<Field> = {}): Field => ({
  component: "shadcn-vue:combobox",
  source: target,          // options and label derive from the Model
  createNew: true,         // nested "+ create new" button, by default
  ...opts,
});

// view/tickets.form.ts — the form is DERIVATION + overrides
export const TicketForm = formFor(Ticket, {
  steps: ["SELECT TEMPLATE", "SCHEDULE"],
  fields: {
    taskTemplate: {
      step: "SELECT TEMPLATE",
      check: (f) => f.ticket != null,               // cascade as a function
      options: (f) => tasksForTicket(f.ticket),     // filter as a function
    },
    // other fields inherit from the Model — not redeclared
  },
});
```

## Consequences

**Positive.** The DRY pain disappears: global changes are made in the preset or in `formFor`. Behavior becomes verifiable, autocompletable code, testable with Vitest (the existing `resolve`/`queries` tests migrate here as a safety net). Layer separation makes the Model reusable by migration and schema generation. The engine stays framework-agnostic (ADR-0001).

**Negative / costs.** Introduces a build step (TS spec → JSON). Editing the spec requires TypeScript, not just JSON — a small barrier for developers, but relevant if a non-programmer needed to edit it (mitigated by the ADR-0004 documentation). Migrating the current `datamodel.json` to the three layers is one-time work and must be done with the resolution tests green.

**Neutral.** The runtime still consumes a `datamodel.json`; only *how* it is born changes (compiled, not written).

## Considered alternatives

**Stay in JSON with presets + `$ref` + JSON Schema.** Solves part of DRY (data reuse) and locks down drift via validation, but does not solve behavior-as-prose and is uncomfortable to author by hand (no types, no functions, no comments). It remains the lower-effort path if the team rejects the build step.

**Lua (or another embedded DSL).** Correctly recognizes the need for a real language in configuration (functions, composition). Discarded for introducing an additional runtime and language into an all-JS/TS stack, with an FFI boundary and loss of type integration — cost with no gain over what TypeScript already offers natively.
