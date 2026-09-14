/**
 * Relations as typed objects, not prose (ADR-0002, Model layer).
 *
 * The prototype engine decides what a field *is* by `parseRule(attr.rule)` in
 * `prototype/js/model.js` — a tolerant regex parser returning `{ kind, … }`.
 * Rather than re-implement that grammar (and drift from it), the spec imports
 * the engine's own `parseRule` and defines `Relation` as *exactly its output*.
 *
 * `renderRule(relation)` prints one canonical prose form. The safety law,
 * proven by test over every attribute of the current datamodel:
 *
 *     parseRule(renderRule(parseRule(rule)))  ≡  parseRule(rule)
 *
 * so normalizing the drifted spellings found in the JSON (`computed:` vs
 * `computed`, `→` vs `->`, three `enum` syntaxes, `via` with or without a
 * colon) is behavior-preserving for the engine.
 */

// The engine module has no imports and no DOM references, so it loads in Node.
// It is untyped JS; we narrow it to the shape below (allowJs in tsconfig).
import { parseRule as engineParseRule } from "../../../../prototype/js/model.js";

export type ConcatPart = { lit: string } | { field: string };
export type RuleFilter = { field: string; value: string };

/** `FK → Target (via: f) (display: d | CONCAT(…)) (filtered by f='v')` */
export interface FkRelation {
  kind: "fk";
  target: string | null;
  display: string | null;
  concat: ConcatPart[] | null;
  via: string | null;
  filter: RuleFilter | null;
}

/** mirror / rollup / computed share one shape in the engine. */
export interface LinkRelation {
  kind: "mirror" | "rollup" | "computed";
  target: string | null;
  via: string | null;
  viaList: string[] | null;
  display: string | null;
  concat: ConcatPart[] | null;
  filter: RuleFilter | null;
}

export interface EnumRelation {
  kind: "enum";
  values: string[];
}

// Special computed functions the engine recognizes (see parseRule comments).
export interface StepOrderRelation {
  kind: "steporder";
  parentField: string;
  ruleField: string;
  groupField: string | null;
}
export interface TaskOrderRelation {
  kind: "taskorder";
  predField: string;
  stepField: string;
}
export interface SrcDisplayRelation {
  kind:
    | "certifiedusers"
    | "inheritedreqs"
    | "ticketprocedure"
    | "ticketinputs"
    | "psrequirements";
  srcField: string;
  display: string | null;
}
export interface SumRelation {
  kind: "sum";
  childAttr: string;
  field: string;
  multiplierField: string | null;
}
export interface DiffRelation {
  kind: "diff";
  minuend: string;
  subtrahend: string;
}
export interface MapRelation {
  kind: "map";
  srcField: string;
  target: string;
  display: string | null;
}
export interface FormatRelation {
  kind: "format";
  srcField: string;
  pattern: string;
}

/**
 * "user input" — the only rule text the engine does not parse (it returns
 * null, i.e. a plain stored field). Kept as an explicit kind so the intent
 * survives the round trip instead of degrading to "no rule".
 */
export interface UserInputRelation {
  kind: "userInput";
}

export type ParsedRule =
  | FkRelation
  | LinkRelation
  | EnumRelation
  | StepOrderRelation
  | TaskOrderRelation
  | SrcDisplayRelation
  | SumRelation
  | DiffRelation
  | MapRelation
  | FormatRelation;

export type Relation = ParsedRule | UserInputRelation;

/** The engine's parser, typed. Returns null for no rule / unparseable text. */
export const parseRule: (rule: unknown) => ParsedRule | null =
  engineParseRule as (rule: unknown) => ParsedRule | null;

const USER_INPUT = "user input";

/** Turn a raw `rule` value into a Relation (or undefined for a plain field). */
export function relationFromRule(rule: unknown): Relation | undefined {
  if (rule == null || rule === "") return undefined;
  const parsed = parseRule(rule);
  if (parsed) return parsed;
  if (String(rule).trim().toLowerCase() === USER_INPUT) return { kind: "userInput" };
  throw new Error(`Unparseable rule: ${JSON.stringify(rule)}`);
}

const SPECIAL_FN: Record<SrcDisplayRelation["kind"], string> = {
  certifiedusers: "CERTIFIED-USERS",
  inheritedreqs: "INHERITED-REQUIREMENTS",
  ticketprocedure: "TICKET-PROCEDURE",
  ticketinputs: "TICKET-INPUTS",
  psrequirements: "PS-REQUIREMENTS",
};

function renderConcat(parts: ConcatPart[]): string {
  return `CONCAT(${parts.map((p) => ("lit" in p ? `'${p.lit}'` : p.field)).join(",")})`;
}

function displayClause(r: { display: string | null; concat: ConcatPart[] | null }): string {
  if (r.concat) return ` (display: ${renderConcat(r.concat)})`;
  return r.display ? ` (display: ${r.display})` : "";
}

function viaClause(r: { via: string | null; viaList?: string[] | null }): string {
  if (r.viaList && r.viaList.length > 1) return ` (via: ${r.viaList.join(" + ")})`;
  return r.via ? ` (via: ${r.via})` : "";
}

function filterClause(r: { filter: RuleFilter | null }): string {
  return r.filter ? ` (filtered by ${r.filter.field}='${r.filter.value}')` : "";
}

/** Canonical prose for a Relation — the inverse of `parseRule` up to parse-equivalence. */
export function renderRule(r: Relation): string {
  switch (r.kind) {
    case "userInput":
      return USER_INPUT;
    case "enum":
      return `enum: [${r.values.map((v) => `'${v}'`).join(", ")}]`;
    case "steporder":
      return (
        `computed: STEPORDER(${r.parentField}, ${r.ruleField})` +
        (r.groupField ? ` per ${r.groupField}` : "")
      );
    case "taskorder":
      return `computed: TASKORDER(${r.predField}, ${r.stepField})`;
    case "certifiedusers":
    case "inheritedreqs":
    case "ticketprocedure":
    case "ticketinputs":
    case "psrequirements":
      return (
        `computed: ${SPECIAL_FN[r.kind]}(${r.srcField})` +
        (r.display ? ` (display: ${r.display})` : "")
      );
    case "sum":
      return (
        `computed: SUM(${r.childAttr}.${r.field})` +
        (r.multiplierField ? ` * ${r.multiplierField}` : "")
      );
    case "diff":
      return `computed: ${r.minuend} - ${r.subtrahend}`;
    case "map":
      return (
        `computed: MAP(${r.srcField} → ${r.target}` +
        (r.display ? ` display: ${r.display}` : "") +
        `)`
      );
    case "format":
      return `computed: FORMAT(${r.srcField}, '${r.pattern}')`;
    case "fk":
      return `FK → ${r.target ?? ""}` + viaClause(r) + displayClause(r) + filterClause(r);
    case "mirror":
    case "rollup":
    case "computed": {
      // A pure expression (no target) is written as `computed: CONCAT(…)`.
      if (r.kind === "computed" && r.concat && (r.target == null || r.target === "CONCAT")) {
        return `computed: ${renderConcat(r.concat)}` + viaClause(r) + filterClause(r);
      }
      return (
        `${r.kind} → ${r.target ?? ""}` + viaClause(r) + displayClause(r) + filterClause(r)
      );
    }
  }
}
