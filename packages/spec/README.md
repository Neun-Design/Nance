# @nance/spec — the datamodel as config-as-code

Implements **ADR-0002**: the datamodel is authored in TypeScript and **compiled** to
`prototype/data/datamodel.json`, which the prototype engine keeps consuming unchanged.

```
packages/spec (TypeScript)  ──spec:build──▶  prototype/data/datamodel.json  ──▶  prototype/js/* (unchanged)
```

## Commands

```bash
cd packages/spec
npm ci              # devDependencies always install here (.npmrc include=dev) — even if NODE_ENV=production is set in the environment running the command
npm run build       # compile → prototype/data/datamodel.json (idempotent, byte-stable)
npm run diff        # semantic diff: spec output vs the committed file (exit 1 if different)
npm test            # Vitest: equivalence + merge semantics
npm run typecheck
```

## How the build works (since the cutover)

Every module is authored in `src/modules/<module>.ts`; `_meta` (incl. `schemaVersion`) lives in
`src/meta.ts`; `MODULE_ORDER` in `src/index.ts` fixes the artifact's module order. `spec:build`
validates the modules (the build gate) and writes the artifact. There is no passthrough: the
JSON is output only.

| What | Where you edit it | Guarded by |
|---|---|---|
| Any module | `src/modules/<module>.ts`, then `npm run build` | CI: `build` + `git diff --exit-code` rejects hand edits to the JSON; the build gate fails on unsuppressed Model errors |
| `schemaVersion`, conventions | `src/meta.ts` | bump on every change to modules/tables/attributes/rules |

## Authoring

```bash
npm run build && npm run diff && npm test
(cd ../../prototype && for t in tools/test_*.mjs; do node "$t" >/dev/null || echo "FAIL $t"; done; python3 tools/validate_mockup.py)
```

`npm run scaffold-module -- <ModuleName> --issue <N>` bootstraps a module file from a JSON module
(it was how every Phase 3 slice started; it can still draft a module from a JSON sketch).

`src/authoring.ts` is the vocabulary: `entity(...)`, `attr(name, type, { rel, notes, constraints, show })`,
relation builders `fk / mirror / rollup / computed / concat / enumOf / userInput`, `formFor(...)`,
`table(def, view)`, `defineModule(name, sidebarPosition, tables, { suppress })`. Model errors the JSON
already carried are listed in `suppress` with their fix issue; `spec:build` fails on any other error.

**Three consumers read the artifact — canonical text must satisfy all of them.** The engine's
`parseRule`/form regexes are tolerant; `validate_mockup.py` has its own Python regexes (it needs
`FK → …` and `rollup → … (via: x)`); and the engine battery sometimes asserts literal text. The
canonical forms were chosen to match all three (and the dominant authored spelling), and one test
assertion that demanded a synonym contradicted by another test now reads the rule the way
`forms.js` does. The **engine battery is the final oracle** for every slice.

A change is done when `npm run diff` reports no differences, `npm test` is green **and** the
engine test battery (`prototype/tools/test_*.mjs` + `validate_mockup.py`) is green.

## The Model layer (`src/model/`)

Entities, fields, storage types and **relations as typed objects, not prose** (ADR-0002).

- `relation.ts` — `Relation` is *exactly* the output of the engine's own `parseRule`
  (`prototype/js/model.js`, imported — single source of truth): `fk | mirror | rollup |
  computed | enum`, the special computed functions (`steporder`, `sum`, `map`, …) and
  `userInput`. `renderRule()` prints one canonical spelling; the law
  `parseRule(renderRule(parseRule(r))) ≡ parseRule(r)` is proven by test over every
  attribute of the current datamodel, so normalizing the drifted spellings is
  behavior-preserving.
- `types.ts` — `Field`, `Entity`, `StorageType`, `Constraint`; `FieldDisplay` is the View
  overlay (`table-display` / `subitem-display`) supplied when emitting.
- `lift.ts` — hand-written JSON → Model (View keys handed back untouched).
- `emit.ts` — Model + display overlay → the engine's attribute node, canonical key order.
- `invariants.ts` — zod shape + model-wide checks. **Errors** (fail the build for a migrated
  module): one PK per entity, relation targets exist, `via` not dead text, enums non-empty,
  no duplicate/misspelled keys. **Warnings** (#177 naming, ownership, `FK` constraint).

```bash
npm run lint            # migration-debt inventory of the current datamodel (add --strict to fail on errors)
```

`spec:diff` treats two `rule` strings as equal when the engine parses them to the same
object, so a migrated module's canonical spelling is not reported as a difference.

## The View and Behavior layers (`src/view/`, `src/behavior/`)

- **Widget** (`field-type`) — the engine reads only the *first key, lowercased*; the value is a
  component hint. `defaultWidgetFor(field)` derives the control from the Model (fk / enum /
  BOOLEAN → `select`, DATE → `date picker`, JSON → `dynamic-specs`, else `input`).
- **Check** (`check`) — `{kind:'notNull', deps} | {kind:'equals', dep, values}`; builders
  `requires(...)`, `requiresValue(...)`.
- **FieldRule** (`field-rule`) — the engine's `;`-separated clauses as an object (`filteredBy`,
  `multi`, `groupBy`, `enum`, `disabled`, `whereCurrentMonth`, `onlyActive`, `specsOf`,
  `default`); text the engine ignores is kept verbatim in `note` and reported by lint.
- **`formFor(entity, { steps?, fields })`** — *derive, don't repeat*: every field binds to a
  Model attribute (checked at build time), gets its control derived unless overridden, and
  states only its exceptions (tooltip, step, check, rule).
- **`emitTable` / `emitModule`** — the full node in canonical key order; `liftModule` decodes a
  hand-written module into the same TypeScript shape (the starting point of every slice).
  `cards`, `reports`, `subitem-tables` stay validated data (their prose is hand-mapped inside
  the engine; an executable form belongs to the v1 engine).
- **`src/semantic.ts`** — "same to the engine": rules / checks / field-rules by parse
  equivalence, widgets by key, subitem entries by the engine's `normalizeSubitem`. Shared by
  `spec:diff` and the tests.

Proven on the current datamodel: whole-table lift → emit is semantically equal for all 42
tables, whole-module for all 7, and `compile()` with every module migrated equals the
passthrough artifact — so a module can be authored in TypeScript and swapped in without the
engine noticing.

## Status

- Phase 1 (scaffold): 100 % passthrough — `spec:build` reproduces the committed file byte for byte.
- Phase 2-A (Model layer): done — lift → emit reproduces all 498 attributes; `spec:lint`
  reports the drift to fix slice by slice.
- Phase 2-B (View + Behavior): done — whole-module equivalence proven for all 7 modules.
- Phase 3-A: **Organization + Portfolio are compiled from TypeScript** (semantically identical to the
  hand-written modules; 2 inherited Portfolio errors suppressed → #412).
- Phase 3-B: **Operation + Talent compiled from TypeScript** (3 inherited errors suppressed → #414).
- Phase 3-C: **CRM + Workspace + Control compiled** (14 inherited errors suppressed → #417).
- Phase 4-A (cutover): **done** — no passthrough; `_meta` and module order authored; the JSON is
  output only. Remaining debt: the suppressed errors (#412, #414, #417), to be fixed with
  `schemaVersion` bumps.

Plan and decisions: `docs/adr/0002-datamodel-config-as-code.md`, wiki *Working with the Datamodel*.
