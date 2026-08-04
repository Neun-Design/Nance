---
title: "App Guide — Organization"
audience: stakeholder
purpose: "What to register in the Organization module and in which order"
---

# Organization

The organisational context (ISO 9001:2015 §4.1): who you are, where you operate, and how the
company is subdivided. **Everything else in the model hangs off this module — register it first.**

## Business Segments

**What it is:** the top-level market segments (e.g. LPT, MPT, DT, SG).
**Register when:** first thing, phase 1 — one row per segment.
**Key fields:** Name, Acronym, Owner (accountability, ISO §5.3).

## Business Units

**What it is:** the operating units inside a segment.
**Register when:** right after Segments.
**Key fields:** Name; `Segment *`; quality/operational managers. The unit's Regions list fills in
automatically as you register customers.

## Regions

**What it is:** geographical groupings (EMEA, Americas, APAC) with the countries they cover.
**Register when:** before Branches and Customers (both pick a Region).
**Key fields:** Name; Continent; **Countries** (multi-select, grouped by continent) — the
countries you tick here become the only Country options for this region's branches.

## Departments

**What it is:** the engineering departments of a unit (e.g. Transformer Repairs Engineering).
**Register when:** after Units — Events and People will need them.
**Key fields:** `Business Unit *`, Name, Acronym, Manager. A department automatically appears in
the drill-down of every Branch of its unit.

## Branches

**What it is:** the physical sites (factories/shops) of the organisation.
**Register when:** after Units and Regions.
**Key fields:** `Segment *` → unlocks `Unit *`; Name; City; `Region *` → unlocks Country (only
the region's registered countries are offered); **Customer** (optional) — after phase 2, come
back and link the branch to its internal customer record (contracts are made with sites, not
business units; the branch is the site customers contract with); Owner.

## Squads

**What it is:** working groups inside a department (used for forecasting and process assignment).
**Register when:** after Departments; before Processes pick their squad (phase 5).
**Key fields:** `Department *`, Name, Type (internal/outsource), Owner (offered from the
department's people — so you may prefer to finish [Talent](talent.md) phase 4 first).

## Issues

**What it is:** positive and negative factors for consideration (ISO §4.1/§4.2): positive =
**Opportunities**, registered top-down from strategic analysis; negative = **Risks**, elevated
automatically from the future nonconformity flow.
**Register when:** opportunities during phase 3, before Scopes (each Scope points at the
opportunity that justifies it). Issues has **no dashboard tab** — register them inline with
the "+" button on the Scope form's Opportunity field (hidden-registry pattern).
**Key fields:** Name, Type (Opportunity/Risk), `Unit` (grouped by segment), Owner.
