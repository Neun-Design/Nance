---
title: "Prototype"
audience: stakeholder
purpose: "How the prototype will be used and developed"
---

# Prototype

The prototype is the working instrument of Phase 2. It is not a finished system — it is a structured experiment built to answer a specific question: can a single SOP template accommodate all the variations of activity criteria that appear across the Engineering Hub's engineering processes?

## The Process Boundary Chosen for Validation

The validation requires a defined scope. Not all engineering processes can be audited simultaneously within a single phase — that would defeat the purpose of prototyping. A specific **process boundary** was selected: the **Offer Process**.

The Offer Process governs the set of engineering events related to offer calculation and technical scope definition — the workflow through which the hub receives, analyses, and responds to customer requests for repair offers. This boundary was selected because:

- It is the only process boundary fully mapped at this stage of the project
- It has sufficient complexity to expose multiple interfaces between different regions and business units
- The events within it span the full range of interaction types the hub manages — from initial opportunity requests to offer approvals and rejections

## The Events Being Validated

The following events, defined within the Offer Process boundary, are being audited through the prototype:

| ID | Event | Description |
| :--- | :--- | :--- |
| EVT001 | Opportunity Development Request | Sales creates the opportunity and notifies the offer manager |
| EVT002 | Offer Calculation Requested | Engineering receives a demand for creating an offer calculation |
| EVT003 | FIA Support Requested | Findings Investigation Analysis requested by sales or offer manager |
| EVT004 | FIA Report Released | Findings Investigation Analysis Report is released |
| EVT005 | Technical Data Requested | Engineering needs more information to develop the offer calculation |
| EVT006 | Technical Data Released | Customer or local engineering releases the requested documentation |
| EVT008 | Offer Calculation Released | Engineering releases the documentation for the offer team to finalise the proposal |
| EVT009 | Offer Calculation Revision Requested | Sales or offer manager asks engineering to modify the calculation |
| EVT010 | Offer Rejected | The final offer is rejected by the customer |
| EVT011 | Offer Approved | The final offer is approved by the customer |
| EVT012 | Inspection Scope Requested | For complex repairs, engineering may be asked to develop an inspection scope |
| EVT013 | Inspection Scope Released | Inspections and tests necessary to develop technical scope, project, and studies |
| EVT014 | Inspection Report Released | Field service engineering develops report according to scope |

## How the Prototype is Used

The validation proceeds in three steps for each event in scope:

### Step 1: Transfer existing process diagrams to structured lists

Process information currently held in PDF diagrams is transferred into the prototype's Process and Activity lists with full metadata — owner, description, inputs, outputs, sequence. This step tests whether the template's fields are sufficient to capture the information that already exists.

### Step 2: Register activities and verify applicability

Activities within each process are registered in the Activity list. For each activity, the team verifies whether the template structure matches the operational reality of how the activity is actually executed.

### Step 3: Develop and register procedures

This is the core validation step. For each activity, the team develops a Procedure — documenting the specific steps, responsible roles, required tools, applicable constraints, and expected outputs. Any execution problem encountered is logged as a non-conformity item. Problems that cannot be resolved within the current template structure become documented improvement requirements for the MVP.

## The Two Validation Approaches

Two strategies were considered for auditing the selected events:

| Approach | Method | Advantage | Limitation |
| :--- | :--- | :--- | :--- |
| **Track A: Project-Oriented** | Map procedures based on real projects currently in development or already delivered | Less time-consuming; uses validated real data | Requires multiple projects to cover all activity variations |
| **Track B: Service Scope-Oriented** | Map procedures based on hypothetical service scopes, designing steps from scratch | Enables selection of the most relevant scopes; focuses on high-impact procedures | More time-consuming; steps must be defined from first principles |

The chosen approach for this phase is documented in the Case Study section.

## What the Prototype Produces

At the end of the validation exercise, the prototype produces three outputs that feed directly into the Phase 2 deliverables:

1. **A populated SOP template** — the Offer Process event set fully registered in the seven SharePoint lists, demonstrating the template's coverage and usability
2. **A non-conformity log** — a structured record of every execution problem encountered during registration, classified by severity (critical, major, minor)
3. **An improvement requirement list** — derived from the non-conformity log, specifying every structural change, field addition, or relationship modification needed to transition from prototype to MVP

These three outputs are the inputs to the Prototype Implementation Assessment (Deliverable 003) and the Target-State Solution Architecture (Deliverable 005).
