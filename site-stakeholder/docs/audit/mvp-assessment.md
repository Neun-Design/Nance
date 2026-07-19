---
title: "MVP Assessment"
audience: stakeholder
purpose: "How to transform the prototype into a Minimal Viable Product"
---

# MVP Assessment

The MVP Assessment is the final deliverable of Phase 2 before the project moves into implementation. Its purpose is to translate the findings of the end-to-end validation into a concrete, actionable specification for the Minimal Viable Product — the first version of the EDQMS system that is ready for operational use.

## MVP Structure

A Minimal Viable Product is not a reduced version of the full solution. It is the smallest version that can deliver real operational value while remaining technically sound and organisationally sustainable.

For the EDQMS project, an MVP must be able to:

1. Be used by the engineering team in their daily work — not just demonstrated in a validation exercise
2. Handle the full range of event types in the validated [process boundary](https://bovarafa.github.io/EDQMS/prototype/prototype/#process-boundary){data-preview} without structural gaps
3. Enforce accountability through defined ownership at every level — event, process, activity, procedure
4. Support basic reporting and management review without requiring manual extraction of data
5. Be maintained and extended by the hub's quality management function without external dependency

The prototype does not yet meet all of these criteria. The MVP Assessment defines what must change to get there.

## From Non-Conformities to Requirements

The end-to-end case study produces a non-conformity log. Every entry in that log represents a gap between what the prototype can do and what the production system must do. The MVP Assessment processes that log and converts it into structured requirements:

| Non-Conformity Type | MVP Requirement Category |
| :--- | :--- |
| Template field missing or insufficient | Data model extension |
| Relationship between entities unclear or missing | Architecture revision |
| Procedure execution ambiguous | Template redesign |
| Access or permission problem | User authentication and access control |
| Automation gap | Workflow trigger definition |
| Reporting gap | Dashboard and monitoring requirement |

## The Assessment Process

The MVP Assessment (Deliverable 003) is conducted after the end-to-end case study is complete. It involves:

1. **Reviewing the non-conformity log** — classifying each item by its root cause type and its impact on production readiness
2. **Mapping requirements** — converting non-conformities and planned deferrals into specific, testable MVP requirements
3. **Prioritising the development backlog** — ordering requirements by operational impact, technical dependency, and implementation complexity
4. **Defining acceptance criteria** — establishing the specific conditions that must be met for each requirement to be considered satisfied at Phase 3 completion

## Connection to Phase 3

The MVP Assessment and the Target-State Solution Architecture (Deliverable 005) together define the full technical and functional specification that Phase 3 will execute against. They are the bridge between the validated prototype and the deployable system.

A Phase 3 proposal cannot be accurately scoped or costed before these two deliverables are complete. The assessment is not a preliminary step — it is a critical path item that determines the scope, timeline, and investment required for the final phase.
