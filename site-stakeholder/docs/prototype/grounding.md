---
title: "Grounding"
audience: stakeholder
purpose: "ISO 9001 relevance, Event Driven Architecture"
---

# Grounding

The EDQMS prototype is not built on intuition or convention. It is grounded in three converging principles — one from quality management theory, one from information architecture, and one from organisational knowledge practice. Understanding these foundations explains why the system is designed the way it is, and why that design is the right fit for the Engineering Hub's challenge.

## ISO 9001:2015: The Quality Framework

ISO 9001:2015 is the current edition of the most widely adopted quality management standard in the world. Three of its most significant updates in the 2015 revision directly shape the EDQMS architecture.

### Risk-Based Thinking (§6.1)

> *"Risk management could be the single most significant addition to ISO 9001:2015. It requires a complete change of focus in implementing a quality management system. Instead of just mindlessly implementing the 'shalls' of the standard, the organisation has to identify and control its unique risks and opportunities."*
> — Cochran, C. (2015). ISO 9001:2015 in Plain English.

In ISO 9001:2015, risk encompasses both threats and opportunities. Every business requirement — from a customer specification to a regulatory constraint — may constitute a risk, an opportunity, or both. Activities in the EDQMS are designed with reference to the risks and opportunities associated with the processes they belong to. This means that when a procedure is defined, the team explicitly identifies what can go wrong and what can be exploited — and designs the procedure's quality gates accordingly.

### Process Approach (§4.4)

> *"You're required to determine the processes needed by your organisation and to define a number of key details about them, such as their inputs, outputs, criteria, methods, and measurements. This requires the organisation to consider all the various elements of a process, not just the one or two pieces believed to be the most important."*
> — Cochran (2015)

The demand for operational detail has increased substantially in the 2015 edition. High-level process maps — the kind that exist in many organisations today — are no longer sufficient for reporting, decision-making, execution, or integration with digital tools. The process approach in ISO 9001:2015 requires organisations to break operations down to a level where meaningful measurement, automation, and integration become possible. The EDQMS data model implements this requirement at four levels of decomposition: Process, Activity, Procedure, and Operation.

### Knowledge Management (§7.1.6)

> *"The organisation shall determine the knowledge necessary for the operation of its processes and to achieve conformity of products and services. When addressing changing needs and trends, the organisation shall consider its current knowledge and determine how to acquire or access any necessary additional knowledge and required updates."*
> — ISO 9001:2015, §7.1.6

This clause formalises what experienced practitioners have long understood: a process that exists only in the minds of experienced team members is not a managed process. It is a dependency on individual presence. When those individuals leave, change roles, or are unavailable, the process either stops or degrades.

The EDQMS architecture treats knowledge management as the foundation of quality management. **Procedures are the mechanism through which tacit knowledge is converted into explicit knowledge.** And explicit knowledge — documented, structured, auditable — is the only kind that can be reliably replicated across regions and over time.

## Event-Driven Architecture: The Structural Logic

An event-driven architecture is one in which the behaviour of a system is determined by the events that occur within it, rather than by a predetermined schedule or a static set of rules applied uniformly.

In the context of quality management, this principle produces a fundamental shift:

| Traditional QMS | Event-Driven QMS |
| :--- | :--- |
| Quality checks are scheduled periodically | Quality responses are triggered by operational events |
| Compliance is assessed retrospectively | Deviations are surfaced in near-real time |
| Procedures are consulted after a decision is made | Procedures are activated as part of the decision |
| Risk identification happens in planned review sessions | Risk conditions are detected as events occur |

In the EDQMS model, the **Event** entity is the architectural anchor. Every Standard Operating Procedure is not a static document sitting in a folder — it is activated by something that happens in the operation. An event triggers a process, which requires activities, each of which is executed through a documented procedure. Quality management is not an overlay on operations; it is embedded in the event stream of daily work.

**ISO grounding:** ISO 9001:2015 §4.4.1(f) requires that processes address the risks and opportunities determined in clause 6.1. The Event entity is the real-time implementation mechanism through which the operation surfaces those conditions.

## Knowledge Management: The Practical Case

The discovery work at Northwind Energy confirmed what ISO 9001:2015 §7.1.6 requires in theory. The Engineering Hub's engineers were competent professionals. The gap was not in their individual knowledge — it was in the absence of a system for externalising that knowledge so it could be shared, replicated, and improved.

The distinction matters for investment decisions: hiring more engineers or running more training programmes would not have addressed the root cause. The root cause was structural. The solution is architectural: a system that captures how work is done, who is responsible, what the expected outputs are, and what the applicable constraints are — for every significant event in the operation.

This is what the EDQMS prototype is designed to validate. The question is not whether the engineering team knows how to do the work. The question is whether the system can capture that knowledge in a form that is permanently usable by anyone.
