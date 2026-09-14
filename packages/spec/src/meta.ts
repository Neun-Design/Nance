/**
 * `_meta` of the artifact — authored here since the cutover (ADR-0002 P4-A).
 *
 * `schemaVersion` convention: bump it by 1 in every PR that changes
 * modules/tables/attributes/rules. Blank-mode snapshots stamp it and the app
 * warns on import mismatch (v3-review D9). Canonical re-spelling of an
 * equivalent rule is NOT a change.
 */

import type { JsonObject } from "./types.js";

export const SCHEMA_VERSION = 113;

export const META: JsonObject = {
  schemaVersion: SCHEMA_VERSION,
  convention:
    "bump schemaVersion by 1 in every PR that changes modules/tables/attributes/rules; blank-mode snapshots stamp it and the app warns on import mismatch (v3-review D9)",
  "form-steps-convention":
    "ANY form may adopt the wizard UI introduced by the Procedures drawer (issue #353) — the engine is fully generic, adoption is pure datamodel authoring: (1) set form.steps to an object of step titles, each { \"step-order\": <int, unique>, \"step-description\": <helper text or null> }; (2) give every field a \"step\" naming one of those titles EXACTLY (a mismatched title silently lands the field in the always-visible host — validate_mockup.py §1d fails on it; a null step is legal and renders on every step, warned). The drawer then shows the chevron step strip, one step at a time, and Previous/Cancel/Next with Save on the last step; all fields build up front, so cross-step cascades/gates keep firing and save collects every control (NOT NULL validation runs on Save, not on Next). steps: null = single flat form (the default everywhere else). Optional companion, independent of the wizard: per-entity faceted controls. (The \"Apply to all\" field-rule token was RETIRED by issue #364 — applicability is an explicit pick; the user selects every value to apply to all.)",
};
