# EDQMS — Event Driven Quality Management System

## Project Overview

EDQMS is an Event Driven Quality Management System fully aligned with **ISO 9001:2015**. Its central thesis is that quality management should be simultaneously reactive and proactive — driven by Events occurring within business operations rather than by periodic, calendar-based audits alone.

**Reference sources:**
- ISO/FDIS 9001:2015(E) — normative standard (all "shall" requirements)
- Cochran, C. (2015). *ISO 9001:2015 in Plain English*. Paton Professional.

**ER-UML Diagram:** https://lucid.app/lucidchart/090097f0-5c82-40ac-999b-ff1c96ba5c94 (Tab: EDQMS ER-UML)

---

## Architecture Overview

The data model is organized into **five functional entity groups**:

### 1. Organisational Context (ISO 9001:2015 §4.1–4.3)
Captures the internal/external context and interested party requirements that feed risk identification.

| Entity | Purpose |
|---|---|
| Source / Source Category | External and internal issue origins |
| Requirement | Interested party obligations (customer, statutory, regulatory) |
| Scope / Scope Category | QMS applicability boundaries |
| Constrain / Constrain Type | Regulatory and contractual limits that bound risk treatment options |
| Region, Location, Business Unit, Department | Organisational structure |

**Requirements — department-scoped obligations (prototype, 2026-07-28 restructure):**

The prototype's `Requirements` table (Portfolio module) is the former `Constraints` dashboard, renamed and generalized so **any engineering department** (transformer repairs, switch gear, …) can register the regulatory/design/commercial limits that bind its scopes and product groups (ISO §4.3).

> **Naming note:** prototype-`Requirements` is a **different concept** from the ER-model `Requirement` entity above (ISO §4.2 interested-party obligations). When mapping the prototype back to the ER model, prototype-`Requirements` corresponds to `Constrain`/`Constrain Type`.

| Attribute | Type | Purpose |
|---|---|---|
| `requirementID` | PK (auto) | |
| `requirementName` | VARCHAR | e.g. "IEC 60076 Compliance", "Max Tank Weight" |
| `requirementDescription` | TEXT | |
| `requirementTypeID` | FK → Requirement Type | Type registry (Operational / Design / Testing / Technical / Commercial as seed data) |
| `scopeID` | FK → Scopes, **multivalued** | Scopes this requirement applies to |
| `productGroupID` | FK → Product Groups, **multivalued** | Product groups it applies to; displayed as `productName \| SPECS` (CONCAT with the computed `specsSummary`) |
| `customerID` | FK → Customers, **multivalued** | Customers it applies to (2026-07-29). **Empty = applies to all customers** — the multivalued applicability keys are the flattened associative entity (decision Q1, `prototype/prototype_v2-review.md`) |
| `isActive`, `regulatoryReference` | BOOLEAN / VARCHAR | Lifecycle flag and external norm code |

`Requirement Type` is a hidden registry (`dashboard-order: 0` — catalogued but kept out of the tab strip); new types are created inline via the "+" button on the Type select of the Requirements form.

**How requirements flow through the model:** they are *derived from the scope + product group pair*, never selected directly on operational records —

- `Product Scopes` / `Forecast Scopes` roll them up with the compound rule `rollup → Requirements (via: productGroupID + scopeID)` (AND semantics, array-aware);
- `Competence` **stores** the certified `requirementID[]` (multi-select filtered by the chosen Scope + Product Group);
- `Tasks` and `Onboarding` **derive** their requirement names through Competence;
- `Jobs` uses the chain for staffing: the Responsible select offers only Onboarding-**certified** people whose Competence matches the ticket's scope, product group and linked requirements (narrowed by the selected Task).

Related Jobs behavior from the same restructure: status transitions stamp `realStartDate` (Queued→Active) and `realEndDate` (Active→Done) with the real clock, Stoped dwell accrues `jobBufferExecution`, and `realExecutionTime = (end − start) − buffer` is stored on Done.

Implemented in `prototype/data/datamodel.json` + `prototype/tools/migrate_requirements.py` (deterministic rename/migration) and the prototype engine (compound `via: a + b` joins in `model.js`/`resolve.js`, multi-dependency form cascades, `applyJobTransition` and the `certified-responsible` control in `forms.js`).

**Organization & CRM (prototype, 2026-07-29 restructure):**

The prototype's module map is now: `Organization` (1) · `Portfolio` (2) · `CRM` (3) · `Talent` (4) · `Operation` (5) · `Workspace` (6, renamed from `Workload` on 2026-07-30) · `Control` (7).

- **Organization module** — `Business Segments` (LPT/MPT/DT/SG registry replacing the old `businessSegment` enum) → `Business Units` → `Departments` (ids `DPT01…`, matched by legacy Capacity/Performance refs) → `Squads` (moved from Talent; `departmentID` FK, owner picked among the department's People).
- **CRM module** — the former `Customers` module; the `Factories` table is renamed **`Customers`** (`factoryID/Name` → `customerID/Name`): internal factories and final Northwind Energy clients are one entity, classified by `businessUnitID` (now **multivalued**). ~~Segment is read-only, derived from the Unit — decision Q4~~ **Q4 reversed 2026-07-30:** `businessSegmentID` is a stored, user-selected multivalued FK. **Cascade inverted same day (PR #96):** Segment (multivalued) is picked *first*; Unit is gated on it (`check: "Segment IS NOT NULL"`) and filtered to the selected segments' units (`field-rule: "filtered by Segment selected"`).
- **Issues** (Portfolio) — registry typed `Opportunity | Risk`; `Scopes.scopeOpportunity` is an FK to Issues. Since 2026-07-30 the `issueType='Opportunity'` filter is dropped — **all** Issues are offered, grouped by `issueType` in the form.
- **Customer-aware chain** — `Workflows` declare `customerID[]` + `productScopeID[]`; their `requirements` derive via the 3-key compound rollup `via: customerID + productScopeID.productGroupID + productScopeID.scopeID` (empty key = applies to all, Q1); `Tasks` derive customer/scope/product-group from their workflow via dotted paths; the Jobs Task select follows the ticket's customer + product group + scope (`tasksForJob` in `forms.js`); Competence stays **customer-agnostic** (decision Q5).

Full change catalog and decisions Q1–Q5: `prototype/prototype_v2-review.md`. Data migration: `prototype/tools/migrate_organization.py` (applied to both mockup copies). Engine tests: `prototype/tools/test_engine_org.mjs`.

**Workflow ordering & business-unit propagation (prototype, 2026-07-30 update):**

- **Derived `indentationID`** — Workflows carry `parentStepID` + `indentationRule` (enum: start-to-finish / start-to-start / finish-to-start / finish-to-finish); the outline number (`1`, `2`, `2.1`, `3`…) is **never stored**: rule `computed: STEPORDER(parentStepID, indentationRule) per processID` (`stepOrderMap` in `resolve.js`) numbers each process's steps at render time — sequential rules take the next major number, parallel rules sub-number under the parent. Processes' subitem-table orders by it. Spec and decision log: `prototype/identation-rule.md`; migration: `prototype/tools/migrate_indentation.py`.
- **`businessUnitID` propagation** — stored FK on Events, Products, Scopes, Issues, Functions, Product Scopes (single or multivalued per table); Processes derive it from their Events (`mirror: Events via: eventID`); Forecasts expose a hidden `businessUnitName` mirror that groups the Forecast select on Forecast Scopes (which also filters to `periodFinish >= current month`). Product Scopes' Product Group select cascades from the chosen Business Unit. Seeds: `prototype/tools/migrate_business_units.py` (also seeds `qualityManager`/`operationalManager` on Business Units and `departmentManager` on Departments).
- **Tasks ↔ Handouts (filtered selection)** — `taskInput`/`taskOutput` stay stored multivalued FKs; the Inputs/Outputs pickers only offer Handouts that are unlinked or whose owning task shares the ticket's Process → Activity → Action chain (`handoutsForTask` in `forms.js`). The Tasks form shows a single "New Handout" related-records button (grouped input/output subitem lists are display-only).
- **Form-engine fixes** — enum rules accept bracket-list spellings (`enum: ['A', 'B']`, `enum: [1, 2, 3]`); multivalued checkbox pickers render `SelectLabel = <field>` group headers.
- **Schema parity zeroed** — `prototype/tools/validate_mockup.py` passes with 0 failures again: derived display attrs mistyped as stored (VARCHAR/INT with computed/mirror/rollup rules) now carry type `mirror` (validator treats mirror as derived; the engine keeps mirror attrs as label/join candidates — `DERIVED` in `model.js` is rollup/computed only); `Squads.squadOwner` is a stored `FK → People`; `forecastScopeRegistry`/`productSpecOwner`/`Competence.resources` are declared; `prototype/tools/migrate_schema_parity.py` seeds `People.departmentID` (via squad), `Onboarding.levelRank` (via competence), `Projects.customerID` (name lookup) and drops the legacy stored copies `Projects.clientName`/`customerName` and `Tasks.customerName`/`scopes` (both derive from FKs since the 2026-07-29 restructure).

Engine tests: `prototype/tools/test_engine_indentation.mjs`.

**Regions & region-aware requirements (prototype, 2026-07-30 second update — `prototype/requirements-model.md`):**

- **`Regions`** (Organization module) — `regionID/Name/Description/Owner` registry replacing the old `Customers.region` enum; `Customers.regionID` is an FK to it. `Business Units` carries a **multivalued** `regionID[]` (regions served; seeded as the union of the unit's customers' regions — BU with no customers stays `[]`). Seed/convert: `prototype/tools/migrate_regions.py`.
- **Requirements applicability grew two dimensions**: multivalued `regionID[]` and `businessUnitID[]` (empty = applies to all, Q1 wildcard). Form cascade: Region (multi) → Business Unit (multi, filtered via the region's customers — two-hop join) → Customer/Scope/Product Group (filtered by Unit). The operational rollups carry the new keys: `Workflows.requirements` and `Forecast Scopes.requirementID` use the 5-key chain `customerID + customerID.regionID + customerID.businessUnitID + productGroup + scope`; `Product Scopes.requirementID` adds `businessUnitID`. Also: `isActive` became an `Active|Inactive` enum and `regulatoryURL` (LINK) replaced `requirementOwner` (owner-convention deviation — Rafael's call).
- **Display helpers** — `businessUnitTitle` (`CONCAT(businessUnitName,'-',businessSegmentName)`) on Business Units, mirrored on Issues; `fkDisplay` now resolves derived display fields. Product Scopes' Product Group picker shows `productName | SPECS` and binds `productGroupID`.
- **Form-engine** — cascade deps may name the bound *attribute* (`filtered by businessUnitID selected`); multivalued deps union the join-engine children of every selected value. Product Specs/Onboarding gained a stored `businessUnitID` (seeded) driving filtered pickers; People form got a Squad select filtered by Department.

Engine tests: `prototype/tools/test_engine_regions.mjs`.

> **Source of truth:** `prototype/data/datamodel.json` is the canonical schema. `sourceFiles/developer/datamodel.json` is a legacy design reference kept for the wireframe era — it received the Factories attribute rename but not the Organization/CRM restructure, and is **not** consumed by the prototype.

### 2. Operations Chain (ISO 9001:2015 §4.4)
Models the QMS process hierarchy at four levels of decomposition.

| Entity | Role |
|---|---|
| Process | Top-level business activity (`processID`, `processName`, `processOwner`, `processDescription`). Self-referential via `is subprocess`. |
| Process Boundary | Defines the scope limits of a Process (`boundaryID`). Each Process boundary **belong to** one or more Processes. |
| Activity | Sub-process within a Process. A Process **requires** one or more Activities. |
| Payload | Association class between the Trigger mechanism and Activity. Stores the business rules/specs (context, requirements, product specs) that determine which Activity an Event initiates. An Activity contains zero or one Payload. `payloadID` is its primary key. |
| Procedure | Documented method for executing an Activity (`procedureNumber` as external reference) |
| Operation | Specific steps within a Procedure (`operationID`, `operationName`, `operationOwner`) |
| Action | A discrete quality management intervention |
| Channel, Interface, Tool, Handout, Property, Specs | Supporting operational entities |
| Product & Service / Product Category | Products/services affected by quality events |

**Product Specs — dynamic attribute definitions (ISO §8.1):**

`Product Specs` is not a table of fixed classification records; each row *defines an attribute* that Product Groups of the applicable products must fill in.

| Attribute | Type | Purpose |
|---|---|---|
| `productSpecID` | PK (auto) | |
| `specName` | VARCHAR | Becomes the attribute label in the Product Group form |
| `specInputType` | ENUM: `INT` \| `DECIMAL` \| `String` \| `List` | Controls the input control rendered for the attribute |
| `specDescription` | TEXT | Shown as the field hint |
| `productID` | FK → Products, **multivalued** | Products this spec applies to |
| `specOptions` | VARCHAR | Semicolon/comma-separated allowed values; only used when `specInputType = List` |

**Dispatch into Product Groups:** when a Product Group is created/edited, selecting the Product enables exactly the spec fields assigned to that product, each typed per `specInputType`. The entered values are stored on the Product Group record as a `specValues` object map (`productSpecID → value`) and surfaced in tables through a computed **SPECS** summary column (`computed: MAP(specValues → Product Specs display: specName)` in the prototype rule mini-DSL), rendering e.g. `Voltage Rate: <=145, Power Rating: <=100`.

Downstream consequences: `Competence` references spec *definitions* it certifies (multivalued FK → Product Specs, displayed by `specName`); `Product Scopes` no longer stores a `productSpecID` — the spec dimension lives on the Product Group. Implemented in `prototype/data/datamodel.json` (Product Specs / Product Groups schemas) and the prototype engine (`MAP()` rule kind in `model.js`/`resolve.js`, `dynamic-specs` form field type in `forms.js`).

### 3. Leadership & Resource Context (ISO 9001:2015 §5)

| Entity | Role |
|---|---|
| User | All `*Owner` foreign keys throughout the model resolve to User |
| Role | Groups of Users with defined responsibilities and authorities |

Every entity in the model has an `owner` attribute (typed as FK → User/Role) to enforce accountability at every node of the quality chain (§5.3, §6.2.2(c)).

### 4. Risk Management (ISO 9001:2015 §6.1)

| Attribute | Description |
|---|---|
| `riskID` | Primary key |
| `riskTitle` | Short label |
| `riskDescription` | Detailed description |
| `riskCategory` | Enumeration: `Threat` \| `Opportunity` |
| `riskPriorityNumber` | Severity × Likelihood (Cochran RPN). Used to threshold which risks advance to Action planning. |
| `riskOwner` | FK → User |

**Key relationships:**
- `Risk ↔ Event` (Trigger) — Events detect or confirm risk conditions in near-real time
- `Risk ↔ Requirement` (Apply to) — Contextualises risks against specific obligations (§6.1.1(a))

**actionApplication** entity classifies Actions by QMS process context:

| actionApplicationName | ISO Clause |
|---|---|
| Risk management | 6.1.2 |
| Control | 8 |
| Communication | 7.4 |
| Monitoring | 9.1 |
| Improvement | 10 |

### 5. Event Engine — Architectural Core

The `Event` entity is the architectural pivot. Its attributes are deliberately minimal (`eventTitle`, `eventOwner:UserID`) to keep Events as lightweight triggers. Its relationships span the entire model:

- `Event` **apply to** `Payload` — Event is associated with a Payload (1+), which carries the business context for dispatching
- `Event` **triggers** `Risk` — detects or confirms risk conditions in real time
- `Event` **Apply to** `Source` — links events to their origin context

**Trigger mechanism and the Broker pattern:**

The `Trigger` relationship is the dispatch hub connecting Events to operational execution. A single Trigger fires **either** one or more Processes **or** zero-or-one Activity directly — never both simultaneously.

| Trigger target | Cardinality | When used |
|---|---|---|
| Process | 1..* | Event initiates one or more full processes |
| Payload (→ Activity) | exactly 1 | Event initiates a single Activity via a Payload |
| Activity (direct) | 0..1 | Event initiates at most one Activity without a Payload |

The **Broker** role (typically the Quality Manager or a designated process manager) is responsible for creating Payloads and wiring them to Activities or Processes — i.e., defining the business rules that connect the two sides. This role may be absorbed by the `processOwner`.

**Payload** carries the combination of requirements and product specs that determine which Activity is triggered. Because a Process is composed of multiple Activities, a single Payload can only target one Activity; to initiate multiple Activities, the Payload must target a Process that orchestrates them.

**`Source` relationship rules:**
- `Source` (1+) **has** → Requirement (1+) and/or Payload (0..*)
- `Requirement` (0..*) **has** → Product & Service (0..*) and/or Payload (0..*)
- `Product & Service` (1+) **Has** → Payload (0..*)

These replace the former direct "Trigger" edges from Source/Requirement/Product to Event.

---

## PDCA Cycle Mapping

| Phase | Entities | ISO Ref. |
|---|---|---|
| **PLAN** | Risk, Source, Requirement, Payload (business rules) | 4.1, 4.2, 6.1.1 |
| **DO** | Action, actionApplication, Role, Operation, Procedure, Process Boundary | 6.1.2, 6.2.2 |
| **CHECK** | Event (monitoring), Product & Service, Specs, Trigger | 9.1, 9.3.2(e) |
| **ACT** | Event (corrective/preventive), Risk (updated RPN), Action | 10.1, 10.2 |

---

## Open Design Items

These are known gaps to address in upcoming iterations:

| Priority | Item | Rationale |
|---|---|---|
| **High** | Direct `Risk —[addressed by]→ Action` relationship | Currently mediated through `actionApplication`. ISO §6.1.2(a) requires direct traceability from risk to action. |
| **Medium** | Nonconformity entity (ISO §10.2) | Needed to complete the improvement cycle through clause 10. |
| **Medium** | Risk Review / Re-assessment Event | Implements §9.3.2(e) — management review of action effectiveness. |
| **Low** | DocumentedInformation entity (ISO §7.5) | For audit-readiness: distinguishes maintained (living) vs. retained (historical) records. |

---

## Tech Stack
<!-- To be defined. Project uses Node.js (package.json present). -->

## Development Workflow

### Setup
<!-- How to install dependencies and set up the dev environment -->

### Running the Project
<!-- How to start the app, dev server, etc. -->

### Testing
<!-- How to run tests -->

### Building
<!-- How to build for production -->

## Code Style & Conventions
<!-- To be defined -->

## Key Directories

- `sourceFiles/` — Architecture reference documents and ER diagram exports
  - `EDQMS-01_DataModel_DesignRationale.md` — Full data model design rationale mapped to ISO 9001:2015
  - `EDBPM_ER-Diagram.json` — Lucidchart ER-UML diagram export (EDQMS ER-UML tab)
  - `broker_interface.md` — Defines the Payload association class, Broker role, and dispatch rules governing Event→Trigger→Process/Activity relationships

## Environment Variables
<!-- To be defined -->
