---
title: "Data Model"
audience: stakeholder
purpose: "Show the concise data model necessary to build the prototype"
---

# Data Model

The EDQMS prototype is built on a deliberately simplified data model. Its purpose is not to validate the full EDQMS system architecture — it is to validate whether the **SOP template structure** can handle the complexity of the Engineering Hub's engineering events. Every entity in the model exists because removing it would leave part of the project question unanswered.

## The Seven Entities

The prototype consists of seven interconnected entities, implemented as Microsoft SharePoint Lists. Together, they form a complete, traceable quality chain from the operational trigger to the documented output.

```
Event
  └── TRIGGERS → Process
                    └── REQUIRES → Activity
                                     └── HAS → Procedure
                                                  ├── APPLY TO → Scope / Region / Product
                                                  ├── APPLY TO → Constrains
                                                  ├── HAS → Actions
                                                  └── HAS → Handouts
```

This chain answers all three dimensions of the project question simultaneously:

- **"When to act"** — the Event defines the trigger
- **"What is required"** — the Process, Activity, and Constraints define the requirements
- **"How to execute it"** — the Procedure, Actions, and Handouts define the execution method and its expected outputs

## Entity Reference

### Event

**What it represents:** Any occurrence within the operation that initiates a quality management response — a customer request, a technical deviation, a design decision point, or a handover between teams.

**Role:** The entry point. By logging an Event, the team activates the set of Processes, Activities, and Procedures that define the correct response.

**ISO 9001:2015 reference:** §4.4.1(f) — processes must address the risks and opportunities determined in clause 6.1. The Event is the real-time detection mechanism.

---

### Process

**What it represents:** A top-level business activity performed in response to an Event — for example, Technical Offer Development, Design Review, or Repair Scope Definition.

**Role:** A single Event can trigger one or more Processes. Each Process has a defined owner, scope, and set of required Activities.

**ISO 9001:2015 reference:** §4.4.1 — the organisation must establish, implement, maintain, and continually improve QMS processes and their interactions.

---

### Activity

**What it represents:** A sub-process or specific task within a Process — for example, within Technical Offer Development: Scope Definition, Cost Estimation, Technical Drawing Review.

**Role:** The unit of execution. An Event can also directly require a specific Activity, enabling targeted responses without activating the entire Process chain.

**ISO 9001:2015 reference:** §4.4.1(b) — the sequence and interaction of processes. Activities represent the second level of decomposition.

---

### Procedure

**What it represents:** The documented method for executing a specific Activity. It answers: *how exactly should this Activity be carried out?* It captures steps, responsible roles, required tools, applicable constraints, and expected outputs.

**Role:** The core deliverable of the prototype. When a Procedure is correctly defined, any team member — regardless of location or prior experience — knows what to do.

**ISO 9001:2015 reference:** §4.4.2(a) — the organisation must maintain documented information to support the operation of its processes.

---

### Constraints

**What it represents:** Regulatory, contractual, or technical limits that bound how a Procedure may be executed — for example, IEC standards governing insulation testing, or customer contractual requirements for hold points.

**Role:** Prevents improvisation that introduces non-conformity risk. A team member executing a Procedure sees both the steps and the limits within which those steps must remain.

**ISO 9001:2015 reference:** §4.3 — QMS scope must consider external and internal issues and the requirements of interested parties.

---

### Actions

**What it represents:** Discrete quality management interventions associated with a Procedure — quality gates embedded within execution steps, such as inspection checkpoints, sign-off requirements, or corrective measures.

**Role:** Ensures execution is not only efficient but controlled. An Action record identifies what must be done, who is responsible, and under what conditions it applies.

**ISO 9001:2015 reference:** §6.1.2 — the organisation must plan actions to address risks and opportunities and integrate them into QMS processes.

---

### Handouts

**What it represents:** The inputs and outputs — documents, completed forms, technical specifications, or drawing revisions — produced or consumed during the execution of a Procedure.

**Role:** Makes quality measurable. If the correct Handout has been produced, the Activity was completed. If it has not, the gap is immediately visible.

**ISO 9001:2015 reference:** §4.4.2(b) — retained documented information as evidence of conformity.

---

## Prototype Access

The prototype is hosted on Microsoft SharePoint. All seven lists are accessible to the Northwind Energy team via the links below. Access credentials should be requested from the Neun Design project team if not already provisioned.

| Entity | SharePoint List |
| :--- | :--- |
| Event | [Event List](https://neundesign-my.sharepoint.com/:l:/g/personal/bova_neun-design_com_br/JADX-ZYffFWlRIkb4dKSSKkDAS5nW6aGDKdHvVzvvtO_al0?e=bo5Y2e) |
| Process | [Process List](https://neundesign-my.sharepoint.com/:l:/g/personal/bova_neun-design_com_br/JACI7rapl98QToi1CY1Mv5vRAWK84A2DF8c1s_EBeHnSIA4?e=yfd74u) |
| Activity | [Activity List](https://neundesign-my.sharepoint.com/:l:/g/personal/bova_neun-design_com_br/JACI7rapl98QToi1CY1Mv5vRAWK84A2DF8c1s_EBeHnSIA4?e=dzjw1v) |
| Actions | [Actions List](https://neundesign-my.sharepoint.com/:l:/g/personal/bova_neun-design_com_br/JAA4MvW114jGRpj1SuD344sxAZAgi_bq9kiAQv5A49KUif0?e=4eLn00) |
| Handouts | [Handouts List](https://neundesign-my.sharepoint.com/:l:/g/personal/bova_neun-design_com_br/JADxdUgQAQW1SqfRiyW4cS79AYjcPevcLVpDtNl6aoBgDnk?e=x5AQIQ) |
| Constraints | [Constraints List](https://neundesign-my.sharepoint.com/:l:/g/personal/bova_neun-design_com_br/JAArCR49W2rIRIYfTvWLdwppAQNdS1RlNseUsT3FsMjqbv0?e=cgOc1C) |
| Procedures | [Procedures List](https://neundesign-my.sharepoint.com/:l:/g/personal/bova_neun-design_com_br/JADX-ZYffFWlRIkb4dKSSKkDAQnnTc27XfiYhtrPo1_MFO8?e=IkhAKm) |

## What the Prototype Does Not Include

The following capabilities are out of scope for the prototype and will be addressed in Phase 3:

- User authentication and role-based access control
- Automated workflow triggers (Power Automate or equivalent)
- Integration with Northwind Energy's SAP or internal ERP systems
- Formal nonconformity tracking (ISO 9001:2015 §10.2)
- Documented Information lifecycle management (ISO 9001:2015 §7.5)

These items will be specified in Deliverable 003 (Prototype Implementation Assessment) and Deliverable 005 (Target-State Solution Architecture).
