---
title: "Power Apps Implementation Guide"
audience: stakeholder
purpose: "Step-by-step instructions to build the EDQMS prototype as a Model-Driven App in Microsoft Power Apps with Dataverse"
---

# Power Apps Implementation Guide

This guide describes how to build the EDQMS prototype as a **Model-Driven App** in Microsoft Power Apps, using Dataverse as the database layer. It translates the [data model](data-model.md) — 14 entities, their attributes, and their relationships — into a working application, step by step.

Follow the steps in the order presented. Each step depends on the one before it: structural tables must exist before operational tables can reference them via Lookup columns, and all tables must exist before the app and sitemap can be configured.

!!! Note "Scope"
    This guide covers the MVP prototype only. It implements the 14 entities defined in the prototype data model and does not include the full EDQMS architecture (Risk, Source, Requirement, Payload, Trigger). Those capabilities belong to Phase 3.

---

## Prerequisites

Before starting, ensure the following are in place:

| Requirement | Details |
| :--- | :--- |
| Power Platform account | Developer Plan (free) is sufficient for the prototype |
| Environment with Dataverse | The default environment created with the Developer Plan includes Dataverse |
| Portal access | make.powerapps.com |
| Role | System Customizer or System Administrator in the target environment |

!!! Note "Developer Plan"
    The Power Apps Developer Plan is free and provides a personal Dataverse environment with full customisation access. It is the recommended starting point for building and validating the prototype before any enterprise tenant is involved.

---

## Step 1 — Create the Solution

A **Solution** is the container that groups all customisations — tables, relationships, and the app itself — into a single portable unit. Creating all components inside a dedicated solution keeps the prototype isolated from other applications in the environment.

**Create the Publisher first:**

1. Navigate to **Solutions** in the left sidebar of make.powerapps.com
2. Select **Publishers** → **New publisher**
3. Enter the following values:

| Field | Value |
| :--- | :--- |
| Display name | EDQMS |
| Name | EDQMS |
| Prefix | edqms |

4. Save the publisher.

**Then create the Solution:**

1. Select **New solution**
2. Enter:

| Field | Value |
| :--- | :--- |
| Display name | EDQMS Prototype |
| Name | EDQMSPrototype |
| Publisher | EDQMS (the one just created) |
| Version | 1.0.0.0 |

3. Save. All subsequent steps are performed **inside this solution**.

!!! Info "Why a prefix matters"
    The `edqms` prefix is automatically prepended to every custom table name (`edqms_event`, `edqms_procedure`, etc.) and every custom column name. This prevents naming collisions with Dataverse native tables and makes it immediately clear which components belong to this solution. Do not skip this step.

---

## Step 2 — Create the Structural Tables

Structural tables are the reference data layer. They have no dependencies on other custom tables and must therefore be created first. Operational tables will reference them through Lookup columns.

**How to create a table:**

Inside the solution, select **New → Table**. For each table below, set the Display Name, Plural Name, and Primary Column display name as specified. After saving the table, add the additional columns listed using **New → Column** inside the table editor.

!!! Note "Primary Column"
    The Primary Column is the record label that appears in all Lookup fields throughout the app. Choose a name that makes the record immediately identifiable — the region name, the channel name, the role name.

---

### 2.1 Region

| Setting | Value |
| :--- | :--- |
| Display name | Region |
| Plural name | Regions |
| Primary column display name | Region Name |

No additional columns required for the prototype.

---

### 2.2 Scope

| Setting | Value |
| :--- | :--- |
| Display name | Scope |
| Plural name | Scopes |
| Primary column display name | Scope Name |

| Column display name | Schema name | Data type | Required |
| :--- | :--- | :--- | :--- |
| Description | edqms_scopedescription | Multiline Text | No |

---

### 2.3 Channel

**What it represents:** The communication medium through which a Handout is managed or transmitted — for example, the Teams channel where a technical report is reviewed, the SharePoint library where a drawing revision is stored, or the ERP system where a cost estimate is submitted.

| Setting | Value |
| :--- | :--- |
| Display name | Channel |
| Plural name | Channels |
| Primary column display name | Channel Name |

| Column display name | Schema name | Data type | Choices | Required |
| :--- | :--- | :--- | :--- | :--- |
| Channel Type | edqms_channeltype | Choice | Email · Teams · SharePoint · ERP · Physical · Other | Yes |

---

### 2.4 Interface

**What it represents:** The system, platform, or organisational boundary across which information is exchanged — for example, the SAP interface between project management and engineering, or the Teams interface between two business units in different regions.

| Setting | Value |
| :--- | :--- |
| Display name | Interface |
| Plural name | Interfaces |
| Primary column display name | Interface Name |

| Column display name | Schema name | Data type | Choices | Required |
| :--- | :--- | :--- | :--- | :--- |
| Interface Type | edqms_interfacetype | Choice | System · Document · Meeting · Form · Other | Yes |

---

### 2.5 Product

| Setting | Value |
| :--- | :--- |
| Display name | Product |
| Plural name | Products |
| Primary column display name | Product Name |

| Column display name | Schema name | Data type | Required |
| :--- | :--- | :--- | :--- |
| Description | edqms_productdescription | Multiline Text | No |

---

### 2.6 Role

**What it represents:** A defined function or responsibility within the QMS — for example, Offer Engineer, Quality Manager, or Project Manager. Roles are linked to Procedures to indicate which functions are accountable for executing each SOP, regardless of which individual holds that function at a given time.

| Setting | Value |
| :--- | :--- |
| Display name | Role |
| Plural name | Roles |
| Primary column display name | Role Name |

| Column display name | Schema name | Data type | Required |
| :--- | :--- | :--- | :--- |
| Description | edqms_roledescription | Multiline Text | No |

---

## Step 3 — Create the Operational Tables

Operational tables capture the live data generated during quality management execution. They reference structural tables via Lookup columns and must be created in the exact order below.

!!! Danger "Creation order is mandatory"
    A Lookup column can only reference a table that already exists in the solution. Follow the numbered sequence without skipping or reordering steps. If a target table does not exist when you try to add the Lookup, the column creation will fail.

---

### 3.1 Event

**What it represents:** Any occurrence within the Engineering Hub's operations that initiates a quality management response — a customer request, a technical deviation, a design decision point, or a handover between teams. Events are the entry point. By logging an Event, the team activates the chain of Processes, Activities, and Procedures that defines the correct response.

| Setting | Value |
| :--- | :--- |
| Display name | Event |
| Plural name | Events |
| Primary column display name | Event Title |

| Column display name | Schema name | Data type | Required |
| :--- | :--- | :--- | :--- |
| Description | edqms_eventdescription | Multiline Text | No |
| Event Date | edqms_eventdate | Date Only | Yes |
| Event Owner | edqms_eventowner | Lookup → User (systemuser) | Yes |

---

### 3.2 Process

**What it represents:** A top-level business activity performed in response to an Event — for example, Technical Offer Development, FIA Analysis, or Inspection Scope Definition. A single Event can trigger one or more Processes, each with a defined owner and a set of required Activities.

| Setting | Value |
| :--- | :--- |
| Display name | Process |
| Plural name | Processes |
| Primary column display name | Process Name |

| Column display name | Schema name | Data type | Required |
| :--- | :--- | :--- | :--- |
| Description | edqms_processdescription | Multiline Text | No |
| Process Owner | edqms_processowner | Lookup → User (systemuser) | Yes |
| Event | edqms_event | Lookup → Event (edqms_event) | Yes |

---

### 3.3 Activity

**What it represents:** A specific task within a Process — for example, within Technical Offer Development: Scope Definition, Cost Estimation, or Technical Drawing Review. Activities represent the second level of decomposition in the operational chain.

| Setting | Value |
| :--- | :--- |
| Display name | Activity |
| Plural name | Activities |
| Primary column display name | Activity Title |

| Column display name | Schema name | Data type | Required |
| :--- | :--- | :--- | :--- |
| Description | edqms_activitydescription | Multiline Text | No |
| Process | edqms_process | Lookup → Process (edqms_process) | Yes |

---

### 3.4 Procedure

!!! Danger "System Anchor"
    The Procedure is the central entity of the prototype. It is the point where all other data converges into a single, executable, documented method. When a Procedure is correctly defined, any team member — regardless of location or prior experience — knows what to do, within which limits, and what output is expected. Validating the Procedure template is the primary goal of the prototype. Every other entity exists to give the Procedure its context.

**What it represents:** The Standard Operating Procedure (SOP) that defines exactly how an Activity must be carried out — its steps, responsible roles, applicable constraints, and expected outputs.

| Setting | Value |
| :--- | :--- |
| Display name | Procedure |
| Plural name | Procedures |
| Primary column display name | Procedure Number |

| Column display name | Schema name | Data type | Required |
| :--- | :--- | :--- | :--- |
| Procedure Title | edqms_proceduretitle | Text | Yes |
| Description | edqms_proceduredescription | Multiline Text | No |
| Activity | edqms_activity | Lookup → Activity (edqms_activity) | Yes |
| Version | edqms_version | Text | No |
| Approval Date | edqms_approvaldate | Date Only | No |
| Approved By | edqms_approvedby | Lookup → User (systemuser) | No |

---

### 3.5 Operation

**What it represents:** A specific, sequenced step within a Procedure — one action in the ordered list that defines how the SOP is executed. The sequence of Operations is what makes a Procedure auditable: it can be followed, reviewed, and improved step by step.

| Setting | Value |
| :--- | :--- |
| Display name | Operation |
| Plural name | Operations |
| Primary column display name | Operation Name |

| Column display name | Schema name | Data type | Required |
| :--- | :--- | :--- | :--- |
| Description | edqms_operationdescription | Multiline Text | No |
| Sequence Number | edqms_sequencenumber | Whole Number | Yes |
| Procedure | edqms_procedure | Lookup → Procedure (edqms_procedure) | Yes |

---

### 3.6 Action

**What it represents:** A quality management intervention embedded within a Procedure — an inspection checkpoint, a sign-off requirement, a hold point, or a corrective measure that must be triggered under specific conditions.

| Setting | Value |
| :--- | :--- |
| Display name | Action |
| Plural name | Actions |
| Primary column display name | Action Title |

| Column display name | Schema name | Data type | Choices | Required |
| :--- | :--- | :--- | :--- | :--- |
| Description | edqms_actiondescription | Multiline Text | — | No |
| Action Type | edqms_actiontype | Choice | Inspection · Sign-off · Hold Point · Corrective · Preventive | Yes |
| Condition | edqms_condition | Multiline Text | — | No |
| Responsible | edqms_responsible | Lookup → User (systemuser) | — | No |
| Procedure | edqms_procedure | Lookup → Procedure (edqms_procedure) | — | Yes |

---

### 3.7 Handout

**What it represents:** A document, completed form, technical specification, or drawing revision that is produced or consumed during the execution of a Procedure. Handouts make quality measurable: if the correct output has been produced, the Activity was completed. If it has not, the gap is immediately visible.

| Setting | Value |
| :--- | :--- |
| Display name | Handout |
| Plural name | Handouts |
| Primary column display name | Handout Title |

| Column display name | Schema name | Data type | Choices | Required |
| :--- | :--- | :--- | :--- | :--- |
| Description | edqms_handoutdescription | Multiline Text | — | No |
| Handout Type | edqms_handouttype | Choice | Input · Output | Yes |
| Document Reference | edqms_documentreference | Text | — | No |
| Procedure | edqms_procedure | Lookup → Procedure (edqms_procedure) | — | Yes |
| Managed By (Interface) | edqms_interface | Lookup → Interface (edqms_interface) | — | No |
| Managed Through (Channel) | edqms_channel | Lookup → Channel (edqms_channel) | — | No |

---

### 3.8 Constrain

**What it represents:** A regulatory, contractual, or technical limit that bounds how a Procedure may be executed — for example, an IEC standard governing insulation testing, or a customer contractual requirement for hold points. Constraints are linked to the Scope, Region, and Product they apply to, and to the specific Operation they restrict.

| Setting | Value |
| :--- | :--- |
| Display name | Constrain |
| Plural name | Constraints |
| Primary column display name | Constrain Title |

| Column display name | Schema name | Data type | Choices | Required |
| :--- | :--- | :--- | :--- | :--- |
| Description | edqms_constraindescription | Multiline Text | — | No |
| Constrain Type | edqms_constraintype | Choice | Regulatory · Contractual · Technical | Yes |
| Scope | edqms_scope | Lookup → Scope (edqms_scope) | — | No |
| Region | edqms_region | Lookup → Region (edqms_region) | — | No |
| Product | edqms_product | Lookup → Product (edqms_product) | — | No |
| Operation | edqms_operation | Lookup → Operation (edqms_operation) | — | No |

---

## Step 4 — Create the N:N Relationships

Six relationships in the data model cannot be expressed as a Lookup column because both sides can have multiple records. These are Many-to-Many relationships and must be created after all 14 tables exist.

!!! Info "How to create a N:N relationship"
    Open the **source table** in the solution → go to the **Relationships** tab → select **Add relationship** → choose **Many-to-Many** → select the target table. Power Apps creates a hidden junction table automatically. Repeat for each row below.

| Source Table | Target Table | Relationship meaning |
| :--- | :--- | :--- |
| Procedure | Scope | A Procedure applies within one or more Scopes |
| Procedure | Region | A Procedure applies to one or more Regions |
| Procedure | Product | A Procedure applies to one or more Products |
| Procedure | Role | A Procedure involves one or more Roles |
| Activity | Channel | An Activity uses one or more Channels |
| Activity | Interface | An Activity crosses one or more Interfaces |

---

## Step 5 — Create the Model-Driven App

1. Inside the solution, select **New → App → Model-driven app**
2. Enter:

| Field | Value |
| :--- | :--- |
| Name | EDQMS Prototype |
| Description | MVP prototype — ISO 9001:2015 aligned quality management chain |

3. Select **Create**. The App Designer opens.

---

## Step 6 — Configure the Sitemap

The sitemap defines the navigation structure visible to users. Open the **Navigation** panel in the App Designer and create four areas, each with the tables listed below.

**Area 1 — Events**

| Element | Value |
| :--- | :--- |
| Area title | Events |
| Group title | Event Management |
| SubArea | Table: Event (edqms_event) |

**Area 2 — Operational Chain**

| SubArea | Table |
| :--- | :--- |
| Processes | edqms_process |
| Activities | edqms_activity |
| Procedures | edqms_procedure |

**Area 3 — Execution**

| SubArea | Table |
| :--- | :--- |
| Operations | edqms_operation |
| Actions | edqms_action |
| Handouts | edqms_handout |

**Area 4 — Configuration**

| SubArea | Table |
| :--- | :--- |
| Constraints | edqms_constrain |
| Channels | edqms_channel |
| Interfaces | edqms_interface |
| Roles | edqms_role |
| Scopes | edqms_scope |
| Regions | edqms_region |
| Products | edqms_product |

---

## Step 7 — Configure the Main Forms

Each table has a default Main Form generated automatically when the table is created. Customise the forms below to control which fields appear and how they are arranged. For all other tables, the default auto-generated form is sufficient for the prototype.

### Procedure Form

The Procedure form is the most important in the app. Organise it into two sections and two tabs.

**Section 1 — Identification**

| Field | Column |
| :--- | :--- |
| Procedure Number | edqms_name (primary) |
| Procedure Title | edqms_proceduretitle |
| Activity | edqms_activity |
| Description | edqms_proceduredescription |

**Section 2 — Approval**

| Field | Column |
| :--- | :--- |
| Version | edqms_version |
| Approval Date | edqms_approvaldate |
| Approved By | edqms_approvedby |

**Tab: Execution Details** — add three subgrids:

| Subgrid label | Related table | Relationship type |
| :--- | :--- | :--- |
| Operations | edqms_operation | 1:N (Procedure → Operation) |
| Actions | edqms_action | 1:N (Procedure → Action) |
| Handouts | edqms_handout | 1:N (Procedure → Handout) |

**Tab: Applicability** — add three subgrids (N:N):

| Subgrid label | Related table |
| :--- | :--- |
| Scopes | edqms_scope |
| Regions | edqms_region |
| Products | edqms_product |

### Event Form

| Field | Column |
| :--- | :--- |
| Event Title | edqms_name (primary) |
| Description | edqms_eventdescription |
| Event Date | edqms_eventdate |
| Event Owner | edqms_eventowner |

Add a **Processes** subgrid (1:N) at the bottom of the form so that all Processes triggered by an Event are visible directly from the Event record.

---

## Step 8 — Configure the Views

For each table, edit the **Active Records** view to display the most relevant columns. Sort by the column most useful for day-to-day navigation.

| Table | Columns to display | Sort by |
| :--- | :--- | :--- |
| Event | Event Title · Event Date · Event Owner | Event Date (desc) |
| Process | Process Name · Event · Process Owner | Process Name |
| Activity | Activity Title · Process | Activity Title |
| Procedure | Procedure Number · Procedure Title · Activity · Version · Approved By | Procedure Number |
| Operation | Operation Name · Sequence Number · Procedure | Sequence Number (asc) |
| Action | Action Title · Action Type · Procedure | Action Title |
| Handout | Handout Title · Handout Type · Procedure · Channel | Handout Title |
| Constrain | Constrain Title · Constrain Type · Scope · Region | Constrain Title |

---

## Step 9 — Populate Reference Data

Structural tables must contain records before any Lookup column in the operational tables can reference them. Populate them in the order below using the Configuration area of the app.

| Order | Table | What to enter |
| :--- | :--- | :--- |
| 1 | Region | The hub regions — e.g., EMEA · Americas · APAC, or specific factory locations (Nuremberg, Charlotte, Linz) |
| 2 | Scope | The applicable QMS scope — begin with **Offer Process** |
| 3 | Product | The transformer service product lines in scope for the Offer Process |
| 4 | Channel | Communication channels used by the hub: Teams · SharePoint · SAP · Email |
| 5 | Interface | System and organisational interfaces: SAP-PM · Engineering Portal · BU Interface |
| 6 | Role | Functions involved in the Offer Process: Offer Engineer · FIA Specialist · Project Manager · Quality Manager |

---

## Step 10 — Test the End-to-End Chain

With reference data in place, create one complete operational chain to confirm that all relationships resolve correctly and the app navigation works end to end.

!!! Tip "Suggested test record — EVT002 Offer Calculation"
    EVT002 (Offer Calculation Requested) was used in the prototype validation against the Livorno project. It has known inputs and outputs and covers multiple interfaces, making it the most useful record for a first end-to-end test.

**Create the following records in sequence:**

1. **Event** — Title: `EVT002 — Offer Calculation Requested` · Date: today · Owner: your user
2. **Process** — Name: `Offer Process` · Event: EVT002 · Owner: your user
3. **Activity** — Title: `Scope Definition` · Process: Offer Process
4. **Procedure** — Number: `SOP-OF-001` · Title: `Offer Scope Definition Procedure` · Activity: Scope Definition
5. **Operation** — Name: `Review customer technical specification` · Sequence: 1 · Procedure: SOP-OF-001
6. **Operation** — Name: `Define transformer repair scope` · Sequence: 2 · Procedure: SOP-OF-001
7. **Action** — Title: `Scope Confirmation Sign-off` · Type: Sign-off · Procedure: SOP-OF-001
8. **Handout** — Title: `Offer Calculation Sheet` · Type: Output · Procedure: SOP-OF-001 · Channel: SharePoint
9. On the Procedure record, open the **Applicability** tab and link it to the Offer Process Scope and the relevant Region(s)

**Verification checklist:**

- [ ] Opening the Event record shows the linked Offer Process in the subgrid
- [ ] Opening the Procedure record shows Operations in sequence order on the Execution Details tab
- [ ] The Action and Handout appear on their respective subgrids
- [ ] The Scope and Region N:N subgrids display the linked records on the Applicability tab
- [ ] Navigating from Event → Process → Activity → Procedure completes without errors
- [ ] The Operations view displays records sorted by Sequence Number ascending
