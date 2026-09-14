/**
 * Invariants (ADR-0002): "the documented drift bugs become impossible".
 *
 * Two levels, on purpose:
 *  - `error`  — violates what the engine needs or what the ADR mandates
 *               (one PK, relations that resolve). Fails the build for a
 *               migrated module.
 *  - `warn`   — naming conventions (#177) the current data does not fully
 *               meet yet. Reported by `spec:lint`; promoted to `error` per
 *               module as the migration slices fix them.
 */

import { z } from "zod";
import { CONSTRAINTS, ENGINE_TYPES, type Entity, type ModelModule } from "./types.js";

const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;

const concatPart = z.union([
  z.object({ lit: z.string() }).strict(),
  z.object({ field: z.string().min(1) }).strict(), // the engine takes any non-quoted text as a field ref
]);
const filter = z.object({ field: z.string().regex(identifier), value: z.string() }).strict();
const nullableId = z.string().regex(identifier).nullable();
const srcDisplay = (kind: string) =>
  z.object({ kind: z.literal(kind), srcField: z.string().regex(identifier), display: nullableId }).strict();

export const RelationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("userInput") }).strict(),
  z.object({ kind: z.literal("enum"), values: z.array(z.string().min(1)).min(1) }).strict(),
  z
    .object({
      kind: z.literal("fk"),
      target: z.string().min(1).nullable(),
      display: nullableId,
      concat: z.array(concatPart).nullable(),
      via: nullableId,
      filter: filter.nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.enum(["mirror", "rollup", "computed"]),
      target: z.string().min(1).nullable(),
      via: z.string().nullable(),
      viaList: z.array(z.string()).nullable(),
      display: nullableId,
      concat: z.array(concatPart).nullable(),
      filter: filter.nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("steporder"),
      parentField: z.string().regex(identifier),
      ruleField: z.string().regex(identifier),
      groupField: nullableId,
    })
    .strict(),
  z
    .object({
      kind: z.literal("taskorder"),
      predField: z.string().regex(identifier),
      stepField: z.string().regex(identifier),
    })
    .strict(),
  srcDisplay("certifiedusers"),
  srcDisplay("inheritedreqs"),
  srcDisplay("ticketprocedure"),
  srcDisplay("ticketinputs"),
  srcDisplay("psrequirements"),
  z
    .object({
      kind: z.literal("sum"),
      childAttr: z.string().regex(identifier),
      field: z.string().regex(identifier),
      multiplierField: nullableId,
    })
    .strict(),
  z
    .object({
      kind: z.literal("diff"),
      minuend: z.string().regex(identifier),
      subtrahend: z.string().regex(identifier),
    })
    .strict(),
  z
    .object({
      kind: z.literal("map"),
      srcField: z.string().regex(identifier),
      target: z.string().min(1),
      display: nullableId,
    })
    .strict(),
  z
    .object({
      kind: z.literal("format"),
      srcField: z.string().regex(identifier),
      pattern: z.string().min(1),
    })
    .strict(),
]);

export const FieldSchema = z
  .object({
    name: z.string().regex(identifier, "field names are identifiers"),
    type: z.enum(ENGINE_TYPES as [string, ...string[]]),
    relation: RelationSchema.optional(),
    notes: z.union([z.string(), z.array(z.string())]).nullable(),
    constraints: z.array(z.enum(CONSTRAINTS)),
    displayName: z.string().min(1).optional(),
    gapTag: z.boolean().optional(),
  })
  .strict(); // a misspelled key (`overview-dislay`…) fails here

export const EntitySchema = z
  .object({
    name: z.string().min(1),
    description: z.string(),
    fields: z.array(FieldSchema).min(1),
    systemRegistry: z.unknown().optional(),
  })
  .strict()
  .superRefine((e, ctx) => {
    const seen = new Set<string>();
    for (const f of e.fields) {
      if (seen.has(f.name)) ctx.addIssue({ code: "custom", path: ["fields"], message: `duplicate field ${f.name}` });
      seen.add(f.name);
    }
  });

export type Severity = "error" | "warn";
export interface Finding {
  severity: Severity;
  module: string;
  entity: string;
  field?: string;
  message: string;
}

const RELATION_TARGET_KINDS = new Set(["fk", "mirror", "rollup", "map"]);

/**
 * Model-wide checks: they need every entity in scope (targets may live in
 * another module). Shape errors from zod are reported as `error` too.
 */
export function validateModel(modules: ModelModule[]): Finding[] {
  const findings: Finding[] = [];
  const byName = new Map<string, Entity>();
  for (const m of modules) for (const e of m.entities) byName.set(e.name, e);

  for (const m of modules) {
    for (const e of m.entities) {
      const at = (field?: string) => ({ module: m.name, entity: e.name, ...(field ? { field } : {}) });
      const shape = EntitySchema.safeParse(e);
      if (!shape.success) {
        for (const i of shape.error.issues) {
          findings.push({ severity: "error", ...at(), message: `${i.path.join(".")}: ${i.message}` });
        }
      }

      const pks = e.fields.filter((f) => f.constraints.includes("PK"));
      if (pks.length !== 1) {
        findings.push({ severity: "error", ...at(), message: `expected exactly one PK, found ${pks.length}${pks.length ? ` (${pks.map((p) => p.name).join(", ")})` : ""}` });
      }
      for (const pk of pks) {
        if (!pk.name.endsWith("ID")) findings.push({ severity: "warn", ...at(pk.name), message: `PK name should end with "ID" (#177)` });
      }
      if (!e.fields.some((f) => f.name.endsWith("Owner"))) {
        findings.push({ severity: "warn", ...at(), message: `no *Owner field (#177 / ISO 9001 ownership)` });
      }

      const own = new Set(e.fields.map((f) => f.name));
      for (const f of e.fields) {
        const r = f.relation;
        if (!r) continue;
        if (RELATION_TARGET_KINDS.has(r.kind)) {
          const target = (r as { target: string | null }).target;
          if (!target) findings.push({ severity: "error", ...at(f.name), message: `${r.kind} without a target` });
          else if (!byName.has(target)) findings.push({ severity: "error", ...at(f.name), message: `${r.kind} target "${target}" is not an entity` });
        }
        // A computed may be a pure expression (no target); when it names one, it must resolve.
        if (r.kind === "computed" && r.target != null && r.target !== "CONCAT" && !byName.has(r.target)) {
          findings.push({ severity: "error", ...at(f.name), message: `computed target "${r.target}" is not an entity (malformed rule?)` });
        }
        // `via` semantics follow the engine's childrenOf/viaFieldJoin: the field may
        // live on the target (child FK) or on this entity (shared-field join). It is
        // dead text — an error — only when it exists on neither side.
        if ((r.kind === "mirror" || r.kind === "rollup") && r.via && !r.viaList && !r.via.includes(".") && r.target && byName.has(r.target)) {
          const targetFields = new Set(byName.get(r.target)!.fields.map((x) => x.name));
          if (!targetFields.has(r.via) && !own.has(r.via)) {
            findings.push({ severity: "error", ...at(f.name), message: `${r.kind} via "${r.via}" is a field of neither ${e.name} nor ${r.target}` });
          }
        }
        if (r.kind === "fk" && !f.constraints.includes("FK")) {
          findings.push({ severity: "warn", ...at(f.name), message: `FK relation but constraints lack "FK"` });
        }
      }
    }
  }
  return findings;
}

export function hasErrors(findings: Finding[]): boolean {
  return findings.some((f) => f.severity === "error");
}
