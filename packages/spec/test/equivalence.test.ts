import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ARTIFACT_PATH,
  AUTHORED,
  migrated,
  buildArtifact,
  compile,
  loadPassthrough,
  serialize,
} from "../src/index.js";
import type { DatamodelArtifact, ModuleArtifact } from "../src/index.js";

const EXPECTED_MODULES = [
  "Organization",
  "CRM",
  "Operation",
  "Portfolio",
  "Workspace",
  "Control",
  "Talent",
] as const;

describe("equivalence with the committed artifact", () => {
  it("spec:build reproduces prototype/data/datamodel.json byte for byte", () => {
    const committed = readFileSync(ARTIFACT_PATH, "utf8");
    expect(serialize(buildArtifact())).toBe(committed);
  });

  it("covers all seven modules, in the prototype's order", () => {
    const names = Object.keys(buildArtifact().modules);
    expect(names).toEqual([...EXPECTED_MODULES]);
  });

  it("Phase 3: the authored modules are the ones compile() merges; the rest pass through", () => {
    expect(AUTHORED.map((m) => m.name)).toEqual(["Organization", "Portfolio"]);
    expect(Object.keys(migrated())).toEqual(["Organization", "Portfolio"]);
  });

  it("keeps _meta and the schemaVersion convention untouched", () => {
    const meta = buildArtifact()._meta;
    expect(typeof meta["schemaVersion"]).toBe("number");
    expect(meta).toEqual(loadPassthrough()._meta);
  });
});

describe("compile() merge semantics", () => {
  const mod = (tag: string): ModuleArtifact => ({
    "sidebar-position": 1,
    tables: { [tag]: { pk: `${tag}ID` } },
  });

  const passthrough: DatamodelArtifact = {
    _meta: { schemaVersion: 1 },
    modules: { Organization: mod("org"), CRM: mod("crm"), Talent: mod("tal") },
  };

  it("a migrated module replaces its passthrough counterpart (spec wins)", () => {
    const out = compile(passthrough, { CRM: mod("crm-from-spec") });
    expect(out.modules.CRM).toEqual(mod("crm-from-spec"));
    expect(out.modules.Organization).toEqual(mod("org"));
  });

  it("module order follows the passthrough, not the migrated map", () => {
    const out = compile(passthrough, { Talent: mod("t2"), Organization: mod("o2") });
    expect(Object.keys(out.modules)).toEqual(["Organization", "CRM", "Talent"]);
  });

  it("a module authored only in the spec is appended at the end", () => {
    const out = compile(passthrough, { Control: mod("ctl") });
    expect(Object.keys(out.modules)).toEqual([
      "Organization",
      "CRM",
      "Talent",
      "Control",
    ]);
  });

  it("does not mutate its inputs", () => {
    const snapshot = JSON.stringify(passthrough);
    compile(passthrough, { CRM: mod("x") });
    expect(JSON.stringify(passthrough)).toBe(snapshot);
  });
});
