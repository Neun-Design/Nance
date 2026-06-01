---
title: "End-to-End Case"
audience: stakeholder
purpose: "Use a real case to apply the prototype in order to audit events"
---

# End-to-End Case

The end-to-end case study is the practical core of the validation phase. It takes the SOP prototype out of the abstract and applies it to a real engineering project — testing whether the template structure can accommodate operational complexity as it actually exists in the hub's work.

## Why a Real Case

Two approaches were available for validating the prototype:

**Hypothetical mapping** — defining procedures from scratch based on ideally described service scopes. This approach allows control over complexity but produces procedures that may not reflect how work is actually done.

**Real case mapping** — using an existing project as the source of procedure definitions. This approach is harder because the evidence is messier, but it provides a stronger validation signal. If the template can handle real case data, it can handle the variation it will encounter in production.

The decision was made to use a real case, for a specific and important reason: domain experts produce better, more reliable procedure definitions when they work from concrete examples rather than abstract scenarios. A procedure developed by reference to a real project is more likely to be accurate, actionable, and replicable.

There is also an operational benefit to this approach: once the procedures for a given case have been mapped through the prototype, the hub has working documentation for that case type — documentation that can be applied immediately to future projects with similar scope.

## The Selected Case: Livorno

The project selected for the end-to-end validation is **Livorno**. This project was chosen because it has sufficient scope complexity to test the template across multiple interfaces and event types — providing broad coverage of the Offer Process boundary within a single case.

## Interfaces in Scope

The Livorno case involves six operational interfaces across four Northwind Energy locations:

| ID | Owner | Business Unit | Department |
| :--- | :--- | :--- | :--- |
| ITF-001 | Thomas | Nuremberg | Engineering |
| ITF-002 | Joao | Charlotte | Engineering |
| ITF-003 | Bicca | Linz | Engineering |
| ITF-004 | — | Weiz | Engineering |
| ITF-005 | — | Charlotte | Project Management |
| ITF-006 | — | Linz | Project Management |

The inclusion of multiple locations and both Engineering and Project Management departments means the validation exercise will test how well the template handles inter-regional, cross-functional event flows — the operational condition that is most likely to surface gaps.

## Events Selected for Validation

Not all events in the Offer Process boundary are being audited in this phase. The events were selected to ensure stakeholders have enough material to understand the real-world impact of the prototype on daily operations:

| Event | Producer | Consumer | Estimated Audit Time |
| :--- | :--- | :--- | :--- |
| Offer Calculation Requested | Charlotte (Project Mgmt) | Charlotte Engineering, Linz Engineering | 18 hours |
| FIA Support Requested | Charlotte (Project Mgmt) | Charlotte Engineering, Linz Engineering | 28 hours |
| Technical Data Requested | Linz, Charlotte | Nuremberg | 21 hours |
| Technical Data Released | Nuremberg | Linz, Charlotte | 12 hours |
| Offer Calculation Released | Charlotte, Linz | Linz, Charlotte | 18 hours |

Total estimated audit time: **97 hours**

## How the Audit Works

For each selected event, the validation team:

1. Identifies the Process and Activities that the event triggers within the Livorno project context
2. Transfers the relevant process information from existing PDF diagrams into the prototype's Process and Activity lists
3. Develops and registers Procedures for each Activity — documenting steps, roles, tools, constraints, and expected outputs (Handouts)
4. Logs any execution problem encountered as a non-conformity item

## Non-Conformity Classification

Every execution problem discovered during the audit is documented with three fields:

| Field | Description |
| :--- | :--- |
| Procedure | The specific procedure where the problem was found |
| Issues | A clear description of the execution problem |
| Impact | Severity classification: Critical, Major, or Minor |

The classification rules:

- **Critical** — the procedure cannot be completed without resolving this problem; the template structure is fundamentally inadequate for this case
- **Major** — the procedure can be completed with workarounds, but the problem will cause consistent difficulty or ambiguity in production
- **Minor** — a usability or completeness issue that does not prevent execution but degrades the quality of the registered data

Multiple non-conformity records are created when a single procedure has problems of different severity levels. Mixing severity levels within a single record is not permitted.

## What This Case Produces

The Livorno end-to-end case produces three types of output:

- **Populated SOP lists** — registered procedures for the five selected events, demonstrating the template's coverage
- **A non-conformity log** — the structured record of all problems found, classified by severity
- **Domain knowledge formalised** — working procedure documentation for the Livorno case type, immediately reusable for similar future projects

These outputs feed directly into the MVP Assessment, where they become the specification for the improvements required to move the prototype to production readiness.
