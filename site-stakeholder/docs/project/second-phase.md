---
title: "Second Phase"
audience: stakeholder
purpose: "Second phase scope and purpose"
---

# Validation

The second phase of the EDQMS project is the current phase. It is executed under proposal [**PRP-C-0017**](https://neundesign-my.sharepoint.com/:w:/r/personal/bova_neun-design_com_br/Documents/Comercial/Northwind/Proposals/Proposal_PRP-C-0017_rev0.docx?d=w7429e4f979d64aea912580e67886d9ee&csf=1&web=1&e=dFefZ8), approved by Northwind Energy following the completion of Phase 1. Its purpose is to develop and validate the EDQMS prototype by applying it to a [real engineering case](../audit/end-to-end-case.md).

## The Strategic Logic of Validation

Phase 1 produced the diagnosis. Phase 2 tests the remedy against reality — before committing to a full implementation. This approach follows a "fail fast" strategy: it is far less costly to discover limitations in a controlled prototype context than after a production system has been built and deployed.

The validation is conducted through an **end-to-end engineering process case study** — a real project from the hub's existing portfolio applied to the prototype's structured procedure [templates](http://localhost:8000/prototype/data-model/#prototype-access). If the prototype can absorb the complexity of a real case, it is ready to be refined into a Minimal Viable Product. If gaps are found, they are documented as non-conformities and addressed before the next phase.

## Objectives

Phase 2 has four objectives:

1. **Validate the EDQMS prototype** — confirm that a single, unified template structure can accommodate all variations of activity criteria across different engineering case types.
2. **Identify improvement opportunities** — document any gaps, limitations, or missing features discovered during the end-to-end validation
3. **Define the implementation approach** — design the target-state solution that will carry the validated prototype into production
4. **Establish the path to MVP** — determine what is required to transition from prototype to a Minimal Viable Product ready for operational use

## Deliverables

| ID | Deliverable | Description | Duration |
| :--- | :--- | :--- | :--- |
| 001 | Strategic Execution Roadmap | An event-driven execution timeline for the end-to-end audit process | 1 week |
| 002 | [Standard Operational Procedures Template](http://localhost:8000/prototype/data-model/#procedure){data-preview} | A structured set of Microsoft Lists for creating and validating SOPs | 3 weeks |
| 003 | Prototype Implementation Assessment | Report identifying all improvements needed to reach MVP | 1 week |
| 005 | Target-State Solution Architecture | System architecture blueprint for the implementation of the MVP | 1 week |

## How the Validation Works

The prototype is built on Microsoft SharePoint Lists — a tool already in use at Northwind Energy. Seven interconnected lists form the relational SOP system: Event, Process, Activity, Actions, Handouts, Constraints, and Procedures.

A real engineering project (the Livorno case) was selected as the validation case. The engineering team works through the case using the prototype's templates, registering processes, activities, and procedures directly in the lists. Any execution problem encountered — a missing field, an ambiguous step, a process boundary that does not align with operational reality — is logged as a non-conformity item with a severity classification (critical, major, minor).

At the end of the validation, the non-conformity log becomes the primary input for the MVP Assessment.

## Non-Conformity Tracking

During the validation, any procedure that presents execution problems generates a non-conformity record with three fields:

| Field | Description |
| :--- | :--- |
| Procedure | Which procedure was affected |
| Issues | Description of the execution problem encountered |
| Impact | Severity classification: Critical, Major, or Minor |

Separate non-conformity records are created for problems of different severity levels — a critical and a minor issue in the same procedure are not conflated into a single record.

## What Success Looks Like

Phase 2 is complete when the team can confidently answer the project question:

> *"When something happens, will we know when to act, what is required, and how to execute it all?"*

— and can demonstrate that answer through a validated, documented procedure set covering the selected engineering events in the Offer Process boundary, with all non-conformities classified and an MVP roadmap defined.
