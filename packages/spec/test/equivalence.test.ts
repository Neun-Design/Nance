import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ARTIFACT_PATH,
  AUTHORED,
  META,
  MODULE_ORDER,
  buildArtifact,
  compile,
  loadArtifact,
  serialize,
} from "../src/index.js";
import type { ModuleArtifact, ModuleName } from "../src/index.js";

describe("the committed artifact is exactly what the spec builds", () => {
  it("spec:build reproduces prototype/data/datamodel.json byte for byte", () => {
    expect(serialize(buildArtifact())).toBe(readFileSync(ARTIFACT_PATH, "utf8"));
  });

  it("all seven modules are authored, and the artifact lists them in the prototype's order", () => {
    expect(new Set(AUTHORED.map((m) => m.name))).toEqual(new Set(MODULE_ORDER));
    expect(Object.keys(buildArtifact().modules)).toEqual([...MODULE_ORDER]);
    expect(Object.keys(loadArtifact().modules)).toEqual([...MODULE_ORDER]);
  });

  it("_meta comes from the spec and keeps the schemaVersion convention", () => {
    const meta = buildArtifact()._meta;
    expect(meta).toEqual(META);
    expect(typeof meta["schemaVersion"]).toBe("number");
  });
});

describe("compile() assembles from the spec alone", () => {
  const mod = (tag: string): ModuleArtifact => ({ "sidebar-position": 1, tables: { [tag]: { pk: `${tag}ID` } } });
  const modules = { Organization: mod("org"), CRM: mod("crm"), Talent: mod("tal") } as Record<ModuleName, ModuleArtifact>;

  it("module order follows the declared order, not the map", () => {
    const out = compile({ schemaVersion: 1 }, modules, ["Talent", "Organization", "CRM"]);
    expect(Object.keys(out.modules)).toEqual(["Talent", "Organization", "CRM"]);
    expect(out._meta).toEqual({ schemaVersion: 1 });
  });

  it("a module in the order but not authored, or authored but not ordered, is an error", () => {
    expect(() => compile({}, modules, ["Organization", "Workspace"])).toThrow(/not authored/);
    expect(() => compile({}, modules, ["Organization", "CRM"])).toThrow(/missing from MODULE_ORDER/);
  });

  it("does not mutate its inputs", () => {
    const meta = { schemaVersion: 1 };
    const snapshot = JSON.stringify([meta, modules]);
    compile(meta, modules, ["Organization", "CRM", "Talent"]);
    expect(JSON.stringify([meta, modules])).toBe(snapshot);
  });
});
