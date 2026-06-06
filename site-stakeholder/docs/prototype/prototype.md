---
title: "Prototype"
audience: stakeholder
purpose: "How the prototype will be used and developed"
---

# Prototype

The prototype is the working instrument of Phase 2. It is not a finished system — it is a structured experiment built to answer a specific question: can a single [SOP template](http://localhost:8000/prototype/data-model/#procedure){ data-preview } accommodate all the variations of activity criteria that appear across the Engineering Hub's engineering processes?

## Process Boundary

The validation requires a defined scope. Not all engineering processes can be audited simultaneously within a single phase — that would defeat the purpose of prototyping. A specific **process boundary** was selected: the **Offer Process**.

The Offer Process governs the set of engineering events related to offer calculation and technical scope definition — the workflow through which the hub receives, analyses, and responds to customer requests for repair offers. This boundary was selected because:

- It is the only process boundary fully mapped at this stage of the project
- It has sufficient complexity to expose multiple interfaces between different regions and business units
- The events within it span the full range of interaction types the hub manages — from initial opportunity requests to offer approvals and rejections

### Events

The following events, defined within the Offer Process boundary, will be available for audit through the prototype:

!!! Note
    
    During the [audit planning](http://localhost:8000/audit/end-to-end-case/#audit-planning) phase, the most relevant events from the list below will be selected. In some cases, auditing all events within a given boundary may introduce unnecessary noise or redundancy.

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


## Prototype Application

<div class="grid cards" markdown>

-    __STEP #1 > Transfer existing process diagrams to structured lists__

    ---

    Process information currently held in PDF diagrams is transferred into the prototype's [Process List](https://neundesign-my.sharepoint.com/:l:/g/personal/bova_neun-design_com_br/JACul9NMrWSmSaZcHcxSNXeNAXI5GDgVYTglBMfMKFz-Fq4?e=eDMFjt) with full metadata — owner, description, inputs, outputs, sequence. This step tests whether the template's fields are sufficient to capture the information that already exists.

-    __STEP #2 > Register activities and verify applicability__

    ---

    Activities within each process are registered in the [Activity List](https://neundesign-my.sharepoint.com/:l:/g/personal/bova_neun-design_com_br/JACI7rapl98QToi1CY1Mv5vRAXXRTOmOuBoOzwkORbeZh6o?e=djq5uT). For each activity, the team verifies whether the template structure matches the operational reality of how the activity is actually executed.

-    __STEP #3 > Develop and register procedures__

    ---

    This is the core validation step. For each activity, the team develops a [Procedure](https://neundesign-my.sharepoint.com/:l:/r/personal/bova_neun-design_com_br/Lists/Engineering%20SOPs?e=SHVM6f) — documenting the specific steps, responsible roles, required tools, applicable constraints, and expected outputs. Any execution problem encountered is logged as a non-conformity item. Problems that cannot be resolved within the current template structure become documented improvement requirements for the MVP.

</div>

## Validation Approaches

Two strategies were considered for auditing the selected events:

| Approach | Method | Advantage | Limitation |
| :--- | :--- | :--- | :--- |
| **Track A: Project-Oriented** | Map procedures based on real projects currently in development or already delivered | Less time-consuming; uses validated real data | Requires multiple projects to cover all activity variations |
| **Track B: Service Scope-Oriented** | Map procedures based on hypothetical service scopes, designing steps from scratch | Enables selection of the most relevant scopes; focuses on high-impact procedures | More time-consuming; steps must be defined from first principles |

The chosen approach for this phase is documented in the [Case Study section](http://localhost:8000/audit/end-to-end-case/).

## Prototype Outputs

At the end of the validation exercise, the prototype produces three outputs that feed directly into the Phase 2 deliverables:

1. **A populated SOP template** — the Offer Process event set fully registered in the seven SharePoint lists, demonstrating the template's coverage and usability
2. **A non-conformity log** — a structured record of every execution problem encountered during registration, classified by severity (critical, major, minor)
3. **An improvement requirement list** — derived from the non-conformity log, specifying every structural change, field addition, or relationship modification needed to transition from prototype to MVP

These three outputs are the inputs to the Prototype Implementation Assessment (Deliverable 003) and the Target-State Solution Architecture (Deliverable 005).


### Accessing the prototype

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

## Out of Scope

The following capabilities are out of scope for the prototype and will be addressed in Phase 3:

- User authentication and role-based access control
- Automated workflow triggers (Power Automate or equivalent)
- Integration with Northwind Energy's SAP or internal ERP systems
- Formal nonconformity tracking (ISO 9001:2015 §10.2)
- Documented Information lifecycle management (ISO 9001:2015 §7.5)

These items will be specified in Deliverable 003 (Prototype Implementation Assessment) and Deliverable 005 (Target-State Solution Architecture).
