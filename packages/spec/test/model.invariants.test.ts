import { describe, expect, it } from "vitest";
import {
  FieldSchema,
  hasErrors,
  parseConstraints,
  renderRule,
  validateModel,
  type Entity,
  type Field,
  type ModelModule,
} from "../src/model/index.js";

const pk = (name: string): Field => ({ name, type: "INT", notes: null, constraints: ["PK"] });
const plain = (name: string): Field => ({ name, type: "VARCHAR", notes: null, constraints: [] });
const fk = (name: string, target: string): Field => ({
  name,
  type: "FK",
  notes: null,
  constraints: ["FK"],
  relation: { kind: "fk", target, display: null, concat: null, via: null, filter: null },
});
const entity = (name: string, fields: Field[]): Entity => ({ name, description: "", fields });
const model = (...entities: Entity[]): ModelModule[] => [{ name: "M", entities }];

const errorsOf = (m: ModelModule[]) => validateModel(m).filter((f) => f.severity === "error").map((f) => f.message);
const warnsOf = (m: ModelModule[]) => validateModel(m).filter((f) => f.severity === "warn").map((f) => f.message);

describe("invariants — the documented drift bugs fail the build", () => {
  const good = model(
    entity("People", [pk("peopleID"), plain("userName"), plain("peopleOwner")]),
    entity("Squads", [pk("squadID"), fk("squadOwner", "People")]),
  );

  it("a well-formed model has no errors", () => {
    expect(errorsOf(good)).toEqual([]);
    expect(hasErrors(validateModel(good))).toBe(false);
  });

  it("exactly one PK per entity", () => {
    expect(errorsOf(model(entity("X", [plain("a"), plain("xOwner")])))).toContain("expected exactly one PK, found 0");
    expect(errorsOf(model(entity("X", [pk("aID"), pk("bID"), plain("xOwner")])))).toContain("expected exactly one PK, found 2 (aID, bID)");
  });

  it("an FK must target an existing entity", () => {
    const m = model(entity("Squads", [pk("squadID"), fk("squadOwner", "Poeple")]));
    expect(errorsOf(m)).toContain('fk target "Poeple" is not an entity');
  });

  it("a mirror's via must be a field of its own entity", () => {
    const e = entity("Squads", [
      pk("squadID"),
      fk("squadOwner", "People"),
      { name: "ownerName", type: "mirror", notes: null, constraints: [],
        relation: { kind: "mirror", target: "People", via: "ownerID", viaList: null, display: "userName", concat: null, filter: null } },
    ]);
    expect(errorsOf([{ name: "M", entities: [e, entity("People", [pk("peopleID"), plain("userName"), plain("peopleOwner")])] }]))
      .toContain('mirror via "ownerID" is a field of neither Squads nor People');
  });

  it("an enum needs values; a misspelled key is rejected by the schema", () => {
    expect(FieldSchema.safeParse({ ...plain("t"), relation: { kind: "enum", values: [] } }).success).toBe(false);
    expect(FieldSchema.safeParse({ ...plain("t"), "overview-dislay": true }).success).toBe(false);
    expect(FieldSchema.safeParse({ ...plain("t"), type: "varchar" }).success).toBe(false);
  });

  it("duplicate field names are an error", () => {
    expect(errorsOf(model(entity("X", [pk("xID"), plain("a"), plain("a"), plain("xOwner")])))).toContain("fields: duplicate field a");
  });

  it("naming conventions (#177) are warnings, not errors", () => {
    const m = model(entity("Things", [pk("thingKey"), plain("label")]));
    expect(errorsOf(m)).toEqual([]);
    expect(warnsOf(m)).toEqual([
      'PK name should end with "ID" (#177)',
      "no *Owner field (#177 / ISO 9001 ownership)",
    ]);
  });
});

describe("renderRule canonical forms", () => {
  it("enum, fk, mirror, rollup, sum", () => {
    expect(renderRule({ kind: "enum", values: ["Risk", "Opportunity"] })).toBe("enum: ['Risk', 'Opportunity']");
    expect(renderRule({ kind: "fk", target: "People", display: "userName", concat: null, via: null, filter: null })).toBe("FK → People (display: userName)");
    expect(renderRule({ kind: "mirror", target: "Business Units", via: "businessUnitID", viaList: null, display: "businessUnitName", concat: null, filter: null })).toBe("mirror → Business Units (via: businessUnitID) (display: businessUnitName)");
    expect(renderRule({ kind: "rollup", target: "People", via: "squadID", viaList: null, display: null, concat: null, filter: null })).toBe("rollup → People (via: squadID)");
    expect(renderRule({ kind: "sum", childAttr: "taskID", field: "executionTime", multiplierField: "forecastScopeQuantity" })).toBe("computed: SUM(taskID.executionTime) * forecastScopeQuantity");
  });
});

describe("constraints", () => {
  it("parses the CSV form and rejects unknown tokens", () => {
    expect(parseConstraints("FK, NOT NULL")).toEqual(["FK", "NOT NULL"]);
    expect(parseConstraints(null)).toEqual([]);
    expect(() => parseConstraints("UNIQUE")).toThrow(/Unknown constraint/);
  });
});
