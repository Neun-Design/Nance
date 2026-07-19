---
title: "Intro"
audience: stakeholder
purpose: "Why it is important to validate a prototype (fail fast strategy)"
---

# Validation — Introduction

Validation is the phase where assumptions meet reality. It is the deliberate, structured test of whether the solution designed in theory performs as expected when applied to real operational data.

For a project like EDQMS, skipping or shortening this phase would be a significant strategic risk. The investment being protected by validation is not the cost of Phase 2 — it is the cost of Phase 3, where the validated methodology becomes a production system integrated into the hub's daily operations across multiple regions and business units.

## Why Validation is Non-Negotiable

The [prototype](https://bovarafa.github.io/EDQMS/prototype/prototype/#accessing-the-prototype){data-preview} was designed to be minimal by intent. Minimal means it is fast to build and fast to test — but it also means it makes assumptions about the template structure, the field definitions, the entity relationships, and the procedure-level detail that may not hold under all conditions.

There are two ways those assumptions can be tested:

1. Deploy the system and discover limitations through operational failures — after the investment of Phase 3 has been made
2. Test the assumptions against real data now, in a controlled environment, at prototype cost

The second approach is always preferable. This is the "fail fast" principle: find the failures early, when they are inexpensive to correct, rather than late, when correcting them requires re-engineering a deployed system.

## What the Validation Tests

The validation does not test the content of the procedures. Whether the engineering team has correctly defined the steps of a specific repair offer calculation is an operational question — it is not the question this validation is designed to answer.

The validation tests the **template structure**:

- Can the seven-entity prototype accommodate all the variations of activity criteria across different event types?
- Are the field definitions in each list sufficient to capture the information that team members need to document?
- Do the relationships between entities correctly reflect how work actually flows in the operation?
- Can the procedure registration process be completed by a domain expert without ambiguity?

If the template structure passes these tests, the validation is successful. If gaps are found, they are documented, classified by severity, and addressed in the MVP specification.

## The Strategic Value of Finding Problems

Non-conformities discovered during the validation are not failures — they are outputs. Each one represents a structural improvement requirement that, if unaddressed, would have degraded the operational value of the system in Phase 3.

A critical non-conformity discovered during validation costs a documentation entry and a design revision. The same non-conformity discovered after Phase 3 deployment costs system re-engineering, user retraining, and potentially a period of degraded operational quality.

Validation is the process by which the project generates the information it needs to deploy with confidence.

## The Validation Method

The validation is conducted through an **end-to-end engineering process case study** — a real project from the hub's existing portfolio, applied to the prototype's structured procedure templates. The selected case (Livorno) is complex enough to test the template across multiple interfaces and event types, providing comprehensive coverage of the Offer Process boundary.

The method is described in detail in the [End-to-End Case](end-to-end-case.md) page. The path from validation findings to MVP is described in the [MVP Assessment](mvp-assessment.md) page.
