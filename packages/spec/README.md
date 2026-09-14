# @nance/spec — the datamodel as config-as-code

Implements **ADR-0002**: the datamodel is authored in TypeScript and **compiled** to
`prototype/data/datamodel.json`, which the prototype engine keeps consuming unchanged.

```
packages/spec (TypeScript)  ──spec:build──▶  prototype/data/datamodel.json  ──▶  prototype/js/* (unchanged)
```

## Commands

```bash
cd packages/spec
npm ci              # if your shell sets NODE_ENV=production, use: npm ci --include=dev
npm run build       # compile → prototype/data/datamodel.json (idempotent, byte-stable)
npm run diff        # semantic diff: spec output vs the committed file (exit 1 if different)
npm test            # Vitest: equivalence + merge semantics
npm run typecheck
```

## How the incremental migration works

The compiled artifact is a **merge**: modules already authored in the spec (`MIGRATED` in
`src/index.ts`) win; every other module is **passed through** from the committed JSON.
So the artifact is always complete and the prototype runs at every step.

| Module state | Where you edit it | Guarded by |
|---|---|---|
| Not migrated yet | `prototype/data/datamodel.json`, as today | — |
| Migrated | the spec (then `npm run build`) | CI: `build` + `git diff --exit-code` rejects hand edits to the JSON |

A migration slice is accepted when `npm run diff` reports no differences for its modules
**and** the engine test battery (`prototype/tools/test_*.mjs` + `validate_mockup.py`) is green.
The passthrough is removed at the cutover, when the artifact becomes 100 % compiled.

`_meta.schemaVersion` keeps its convention: bump it in any PR that changes
modules/tables/attributes/rules — the scaffold does not.

## Status

Phase 1 (scaffold): 100 % passthrough — `spec:build` reproduces the committed file byte for byte.
Next: the Model layer (types + invariants), then View + Behavior (presets, `formFor`), then the
module slices. Plan and decisions: `docs/adr/0002-datamodel-config-as-code.md`, wiki
*Working with the Datamodel*.
