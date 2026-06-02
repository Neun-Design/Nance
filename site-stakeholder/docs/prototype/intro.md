---
title: "Intro"
audience: stakeholder
purpose: "What the use of a prototype for a project like this"
---

# Prototyping — Introduction

A prototype is not a product. It is a structured experiment. Its purpose is to validate assumptions about whether a proposed approach can actually solve the stated problem — before committing the resources required to build the full solution.

For the EDQMS project, this distinction is particularly important. The problem being solved is methodological: can a single, structured template for Standard Operating Procedures capture the full complexity of the Engineering Hub's engineering events? That question cannot be answered by architecture alone. It can only be answered by applying the template to real operational data and observing what happens.

## Why Prototyping is the Right Approach Here

Three characteristics of the EDQMS project make prototyping the correct strategy at this stage:

### 1. The methodology is the innovation

EDQMS is not primarily a software product — it is a methodology. The data model, the event-driven architecture, and the ISO 9001:2015 alignment are all in service of a method for creating and managing operational procedures. The prototype tests whether that method works in practice, not in theory.

### 2. The user context is complex

The Engineering Hub involves multiple regions, multiple business units, multiple product types, and multiple interface structures. A procedure template that works for one type of engineering event may not work for another. The prototype exposes these variations under controlled conditions rather than discovering them after deployment.

### 3. The cost of being wrong increases sharply after Phase 2

If the template has structural limitations — missing fields, ambiguous procedure steps, gaps in the event-to-activity mapping — it is far less costly to discover and correct those limitations during a validation exercise than after a full production system has been built, integrated with ERP systems, and distributed to a global team.

The prototype is the investment that protects the larger investment.

## What the Prototype Does Not Do

The prototype is intentionally minimal. It does not:

- Implement user authentication or role-based access control
- Automate workflow triggers
- Integrate with SAP or other ERP systems
- Track nonconformities as a formal process (ISO 9001:2015 §10.2)
- Manage the lifecycle of documented information (ISO 9001:2015 §7.5)

These capabilities are explicitly out of scope for the prototype. They are documented requirements for Phase 3. The prototype's sole purpose is to validate the **core methodology** — the template structure that connects events to procedures through a traceable chain of entities.

## The Prototype Platform

The prototype is hosted on **Microsoft SharePoint Lists** — a tool already in use within Northwind Energy's operational environment. This choice was deliberate:

- It reduces the technology barrier for the validation exercise
- It allows the engineering team to interact with the prototype in a familiar environment
- It produces usable data about how well the template fits the operational workflow, without the noise that comes from learning a new platform simultaneously

The seven interconnected lists that form the prototype are accessible to the Northwind Energy team with appropriate sharing permissions. The full list of entities and access links is provided in the [Data Model](data-model.md) page.

## Value at Stake

The prototype is the mechanism through which the project answers a decisive question for stakeholders:

> *"When something happens, will we know when to act, what is required, and how to execute it all?"*

A prototype that answers this question — correctly, traceably, and within an ISO 9001:2015 framework — demonstrates that the methodology works and can be scaled to the full operation. A prototype that fails to answer it reveals the structural gaps before Phase 3 spending begins.

This is the direct link between the prototype and the three organisational outcomes the project is designed to deliver:

| Outcome | How the prototype tests it |
| :--- | :--- |
| **Onboarding speed** | Can a team member unfamiliar with a specific case type execute a procedure from the template alone? |
| **Cross-regional consistency** | Does the template structure hold across different event types, business units, and regional interfaces? |
| **Governance at scale** | Are the entity relationships and field definitions sufficient to support the quality traceability ISO 9001:2015 requires? |

If the prototype passes these tests, the path to Phase 3 is clear. If it does not, the gaps are inexpensive to correct at this stage.

## What This Section Covers

The pages in this Prototyping section explain:

- **[Grounding](grounding.md)** — the theoretical and normative foundations that the prototype architecture is built on: ISO 9001:2015, event-driven architecture, and knowledge management principles
- **[Data Model](data-model.md)** — the entity structure and relationships that form the SOP system, with access links to each SharePoint list
- **[Prototype](prototype.md)** — how the prototype will be used and developed during the validation phase
