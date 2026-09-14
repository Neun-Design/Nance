# Working with the Datamodel

This is the most important page for anyone who will change how nance.it behaves. The *datamodel* is the specification that describes the system; almost every change to a screen, field, or rule happens here — not in UI code scattered around. The underlying decision is **ADR-0002**.

## Config-as-code, not hand-written JSON

The specification is written in **TypeScript** — one file per module in `packages/spec/src/modules/` — and **compiled** to `prototype/data/datamodel.json`, which the prototype engine consumes unchanged. The JSON is a **generated, committed artifact**: never edit it by hand. CI rebuilds it and fails on any drift (`spec:build` + `git diff --exit-code`).

Writing in TS rather than plain JSON gives three things JSON cannot: **reuse** (builders and derivation), **types** (a misspelled key or a bad type fails the build), and **relations as objects** (an FK, mirror or rollup is a typed value, not an English sentence).

## The three layers

**Model** (`src/model/`) — entities, attributes, storage types, and structured relations. A `Relation` is exactly what the engine's own `parseRule` produces (the spec imports it — one source of truth), and `renderRule` prints the canonical spelling; the round trip is proven over every attribute.

**View** (`src/view/`) — per-screen layout: the form (`formFor`), the control of each field (`Widget`), table keys (`dashboardOrder`, `visibility`, `tableFilters`, `subitemTables`, `cards`, `reports`).

**Behavior** (`src/behavior/`) — cascades (`check`) and option filters (`field-rule`) as objects with builders: `requires("Business Unit")`, `{ multi: true, filteredBy: "Unit" }`.

> **Scope note.** Until the engine itself is TypeScript (v1), Behavior compiles to the engine's *current* `rule` / `check` / `field-rule` text: you get types, reuse and build-time validation, while the engine keeps interpreting the same grammar. Executable functions (`check: (f) => …`) arrive with the v1 engine.

## Derive, don't repeat

The golden rule: **do not redeclare what the Model already knows.** `formFor` derives each field's control from the Model (an FK or enum becomes a `select`, a DATE a `date picker`, JSON a `dynamic-specs`, everything else an `input`); a form declares only its exceptions — tooltip, step, check, rule, or a different widget.

```ts
const businessUnits = entity("Business Units", "Addresses ISO 9001:2015 section 4", [
  attr("businessUnitID", "INT", { constraints: ["PK"], show: [false, false] }),
  attr("businessUnitName", "VARCHAR"),
  attr("businessSegmentID", "FK", { rel: fk("Business Segments", { display: "businessSegmentCode" }) }),
  attr("qualityManager", "FK", { rel: fk("People", { display: "userName" }) }),
]);

table(businessUnits, {
  visibility: "show",
  dashboardOrder: 3,
  form: formFor(businessUnits.entity, {
    fields: {
      Segment: { attribute: "businessSegmentID" },                       // FK → select, derived
      Name: { attribute: "businessUnitName", widget: "field" },          // an exception
      "Quality Manager": { attribute: "qualityManager", widget: "selectgroups", rule: { groupBy: "functionName" } },
    },
  }),
  tableFilters: true,
  subitemTables: ["Branches"],
});
```

The vocabulary lives in `packages/spec/src/authoring.ts`: `entity`, `attr`, the relation builders (`fk`, `mirror`, `rollup`, `computed`, `concat`, `enumOf`, `userInput`), `formFor`, `table`, `defineModule`.

## Common tasks

**Add a field to an entity.** Add an `attr(...)` to the entity in its module file. It appears on screens by derivation; add a form field only if the form should show it, and adjust `show` for the table/subitem columns.

**Add a new entity.** Add an `entity(...)` and a `table(...)` to the module. Relations must target existing entities — the build checks it.

**Change a cascade or an option filter.** Edit the `check` / `rule` of the form field — with autocomplete and build-time reference checks instead of rewriting a sentence.

**Change a card or report.** They are still declared data (their prose is hand-mapped inside the engine); edit the literal in the module file.

**Any of the above** — then bump `_meta.schemaVersion` in `packages/spec/src/meta.ts` (the convention: +1 in every PR that changes modules/tables/attributes/rules; blank-mode snapshots stamp it and the app warns on import mismatch) and rebuild.

## Compile, validate, test

```bash
cd packages/spec
npm ci                 # devDependencies always install here (.npmrc include=dev)
npm run build          # spec (TS) → prototype/data/datamodel.json (idempotent)
npm run diff           # semantic diff: spec output vs the committed file
npm run lint           # invariant report: unsuppressed / suppressed errors, warnings
npm test               # Vitest: laws over the real datamodel, build gate, layers
cd ../../prototype && for t in tools/test_*.mjs; do node "$t" >/dev/null || echo "FAIL $t"; done
python3 tools/validate_mockup.py
```

**The build gate.** `spec:build` validates every module: exactly one PK per entity, relation targets that exist, `via` that is not dead text, non-empty enums, no duplicate or misspelled keys. An error fails the build **unless it is listed in the module's `suppress` with the issue that will fix it** — the debt inherited from the hand-written JSON is tracked that way (#412, #414, #417) and must shrink to zero. Naming conventions (#177) are warnings.

**The engine battery is the final oracle.** Three consumers read the artifact — the engine's parsers, `validate_mockup.py`'s own regexes, and the test battery — so a change is done only when all of them are green.

## Reference

Full decision and discarded alternatives (including why we do **not** use Lua or plain JSON): **ADR-0002** under `docs/adr/`. The package README (`packages/spec/README.md`) documents the layers and the build in more detail. Historical `prototype/tools/migrate_*.py` scripts patched the JSON directly; since the cutover, schema changes are spec edits.
