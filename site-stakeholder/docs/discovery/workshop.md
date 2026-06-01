---
title: "Workshop"
audience: stakeholder
purpose: "Discover what the problem really was"
---

# Workshop

The workshop was the pivotal moment of the Discovery phase. It was the event that brought together the stakeholders and actors who had been interviewed separately throughout the contextual analysis — and in doing so, revealed the actual problem with a clarity that no individual interview could have achieved alone.

## Purpose

The workshop had four defined objectives:

1. Discuss and map improvement opportunities based on the existing assumptions
2. Summarise the improvements into a clear problem statement
3. Sketch the paths available to reach the desired target state
4. Select one path to prototype

It was not a brainstorming session. It was a structured convergence exercise — taking the fragmented findings from two months of discovery work and forcing them into a single coherent direction.

## Method: Event Storming

The primary workshop technique used was **Event Storming**: a collaborative modelling method in which participants map the significant events that occur in a business operation — what happens, in what sequence, and who is responsible for responding.

In the context of the Engineering Hub's offer process, event storming made visible something that individual process maps had obscured: **the connection between events and execution was broken**. There were events happening in the operation — requests, releases, deviations, approvals — but no structured mechanism for ensuring a consistent, traceable response to each one.

This insight became the seed of the EDQMS architecture.

## What the Workshop Revealed

Two findings from the workshop stood out above all others:

### Finding 1: Managers and engineers could not connect tasks to objectives

During the event storming exercise, it became clear that participants — at all levels — had difficulty explaining how the work they did each day connected to the organisation's requirements and objectives. Process maps existed at a high level, but the detail required to answer questions like "what exactly do I do when this event occurs?" was not documented anywhere.

This was not a skills gap. The engineers were competent. It was an **architecture gap**: the operational knowledge existed, but it was held individually and informally, not captured in a shared, structured system.

### Finding 2: The real question was about execution clarity, not capacity

The workshop produced an **opportunities map** — a structured inventory of improvement areas across the offer process. After analysing this map, a single meta-question emerged that encompassed virtually every improvement opportunity:

> *"When something happens, will we know when to act, what is required, and how to execute it all?"*

This question reframed the entire engagement. It was not a question about staffing. It was not a question about process design at a high level. It was a question about **operational execution architecture** — the connective tissue between events and action.

## The Decision

The workshop concluded with a decision: prototype Standard Operating Procedures (SOPs) as the primary mechanism for answering the project question.

The rationale was straightforward:

- SOPs convert tacit knowledge into explicit, structured documentation
- They connect events to responses, activities to procedures, and steps to responsible roles
- They are auditable — which means they can be tested, improved, and validated
- They are replicable — which means a procedure correctly defined once can be executed by any qualified team member, anywhere

The decision was also pragmatic: Northwind Energy already used Microsoft SharePoint Lists as a working tool. The prototype would be built on that platform, minimising the learning curve and maximising the team's ability to engage with it immediately.

## From Workshop to Prototype

The workshop output — the opportunities map and the project question — became the specification for Phase 2. The prototype strategy was designed to test whether a single SOP template structure, built on an event-driven data model aligned with ISO 9001:2015, could adequately capture the full complexity of the Engineering Hub's offer process.

The answer to that question is what Phase 2 is producing.
