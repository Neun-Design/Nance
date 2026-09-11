# Working with the Datamodel

This is the most important page for anyone who will change how nance.it behaves. The *datamodel* is the specification that describes the system; almost every change to a screen, field, or rule happens here — not in UI code scattered around. The underlying decision is **ADR-0002**.

## Config-as-code, not hand-written JSON

The specification is written in **TypeScript** (in `packages/spec`) and **compiled** to a `datamodel.json` that the engine consumes. Writing in TS — rather than plain JSON — gives three things JSON cannot: **reuse** (functions and composition), **types** (the compiler prevents omitting or misspelling a key), and **behavior as code** (functions, not English sentences).

## The three layers

**Model** — entities, attributes, types, and structured relations (FK/rollup/mirror as typed objects, not prose). It is the source of the data shape: it feeds the Postgres schema and migration validation.

**View** — the per-screen layout: visible columns, card grid, form steps, chart type. It references Model fields by id and is **composed from presets**.

**Behavior** — cascades (`check`), option filters, and the card/report queries, as **functions**.

## Derive, don't repeat

The golden rule: **do not redeclare what the Model already knows.** A form is "the Model's fields, minus these, in these steps, with these overrides". An FK attribute already renders a select whose options come from the target table; a numeric one already joins the Σ row. You only write the exceptions.

```ts
// presets defined ONCE
const fkSelect = (target, opts = {}) => ({
  component: "shadcn-vue:combobox",
  source: target,        // options/label derive from the Model
  createNew: true,       // nested "+ create new" button, by default
  ...opts,
});

// a form is derivation + overrides
export const TicketForm = formFor(Ticket, {
  steps: ["SELECT TEMPLATE", "SCHEDULE"],
  fields: {
    taskTemplate: {
      step: "SELECT TEMPLATE",
      check: (f) => f.ticket != null,             // cascade as a function
      options: (f) => tasksForTicket(f.ticket),   // filter as a function
    },
  },
});
```

Practical consequence: **to add a parameter to every field of a type, you change the preset (or `formFor`) in one place** — not each instance.

## Common tasks

**Add a field to an entity.** Declare the attribute in the Model (name, type, `rule` if it is a relation). It already shows up on screens by derivation; adjust the View only to hide/reorder. If it is a stored field, generate the database migration (`pnpm db:generate`).

**Add a new entity.** Create the Model file; add it to a module in the View; define Behavior (cards/reports) if any. Run `pnpm spec:build` and the tests.

**Change a cascade rule.** Edit the `check`/`options` function in Behavior — with autocomplete and type checking, instead of rewriting a sentence.

**Change a card/report query.** Edit the corresponding function in Behavior; make sure the Vitest test is green.

## Compile and validate

```bash
pnpm spec:build     # spec (TS) -> datamodel.json
pnpm test           # Vitest: engine + resolution + queries
pnpm db:generate    # (when the Model changed) generates a Drizzle migration
```

The spec is validated by types and by a `zod` schema at build time (e.g. every table has exactly one PK; every FK points to an existing entity). Errors that used to become silent *drift* bugs now fail the build.

## Reference

Full decision and discarded alternatives (including why we do **not** use Lua or plain JSON): **ADR-0002** under `docs/adr/`.
