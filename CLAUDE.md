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
| `customerID` | FK → Customers | Customer-specific requirement (issue #180, 2026-08-13 — re-introduced single-valued after leaving in the Branches round; select **enabled** 2026-08-19, issue #212, `schemaVersion` 35): the form select mirrors the sibling Branch field — gated `check: "Business Unit IS NOT NULL"`, options = the selected units' customers grouped by unit (`field-rule: "SelectLabel = businessUnitName; filtered by businessUnitID selected"`). The `field-rule: "disabled"` engine support in `forms.js` stays (pattern available to future fields). **Empty = applies to all customers** (decision Q1, `prototype/prototype_v2-review.md`) |
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
- ~~**Customer-aware chain**~~ **Superseded 2026-08-04 (Procedures doctrine):** Workflows and Tasks are applicability-agnostic — `Workflows.customerID[]`/`productScopeID[]` and the 5-key `requirements` chain were removed; the requirement set lives on `Procedures.requirementID[]` (empty = applies to all, Q1) and `Tasks.requirementName` derives via the task's procedures. The Jobs Task select degrades gracefully to every task (`tasksForJob` keeps its lenient wildcard path for legacy snapshots); staffing selectivity lives in `certified-responsible` via Competence → Procedures. Competence stays customer-agnostic (Q5).

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
| `specInputType` | ENUM: `Number` \| `Text` \| `Choice` \| `List` \| `Checkbox` | Controls the input control rendered for the attribute (issue #205 relabel of `INT`/`DECIMAL`/`String`/`List`): Number = decimal input, Text = string, Choice = single pick from `specOptions`, List = **multiple** picks stored semicolon-separated (`"A; B"`), Checkbox = boolean rendered Yes/No in the SPECS displays. Legacy spellings from pre-v34 snapshots still resolve in `specInputKind()` (`forms.js`); old single-choice `List` rows were migrated to `Choice` (`tools/migrate_spec_input_types.py`). The Allowed Values field gate uses the eq-check alternatives spelling `check: "Input Type = Choice\|List"` |
| `specDescription` | TEXT | Shown as the field hint |
| `productID` | FK → Products, **multivalued** | Products this spec applies to |
| `specOptions` | VARCHAR | Semicolon/comma-separated allowed values; only used when `specInputType` is `Choice` or `List` |

**Dispatch into Product Groups:** when a Product Group is created/edited, selecting the Product enables exactly the spec fields assigned to that product, each typed per `specInputType`. The entered values are stored on the Product Group record as a `specValues` object map (`productSpecID → value`) and surfaced in tables through a computed **SPECS** summary column (`computed: MAP(specValues → Product Specs display: specName)` in the prototype rule mini-DSL), rendering e.g. `Voltage Rate: <=145, Power Rating: <=100`.

Downstream consequences: `Competence` references spec *definitions* it certifies (multivalued FK → Product Specs, displayed by `specName`); `Product Scopes` no longer stores a `productSpecID` — the spec dimension lives on the Product Group. Implemented in `prototype/data/datamodel.json` (Product Specs / Product Groups schemas) and the prototype engine (`MAP()` rule kind in `model.js`/`resolve.js`, `dynamic-specs` form field type in `forms.js`).

**Spec input types round (prototype, 2026-08-19, issue #205, `schemaVersion` 34 — PRs #206/#208/#210):** the `specInputType` relabel above landed with engine support in three places — `dynamic-specs` renders a checkbox multi-picker for `List` (value stored `"A; B"`) and a single "Yes" checkbox row for `Checkbox`, with per-kind prefill; `specValueLabel()` in `resolve.js` formats boolean spec values as Yes/No in both the SPECS `MAP` summary and the specs subitem `__mapValue` column; and form `check` gates accept the **equality-alternatives spelling** `"A = V1|V2"` (documented in `DATAMODEL_GUIDE.md` §form-fields), introduced for the Allowed Values gate. Migration `tools/migrate_spec_input_types.py` (mockup rows relabelled; old single-pick `List` → `Choice`, so the reused `List` spelling is unambiguous in v34 data); proof `tools/test_engine_spec_input_types.mjs`; stakeholder guide page `portfolio/product-specs.md` updated and deployed. Same-day companions: issue #207/PR #208 retired the two `test_resolve.mjs` assertions stale since the Sponsors Presentation rounds (Forecasts `customerTitle` mirrors the plain name since #191; the Customers first subitem is SLA since #179 — the block now finds the group by table name), restoring a fully green 25-suite battery; issue #209/PR #210 gave both deploy workflows a shared `concurrency: gh-pages` group after the #206+#208 back-to-back merges raced the `gh-pages` push (second deploy rejected non-fast-forward, needed a manual rerun).

**Procedures — requirement-dependent task execution (prototype, 2026-08-03 round):**

Rafael's invariance principle (v3-review "Iterations"): **Process/Workflow/Task are requirement-free** — the **Procedure** is where requirements bite. The prototype's Operation module gained a `Procedures` table (materializing the ER-model Procedure at task level): each row = the documented method for executing a Task under a given requirement set, with its own input/output handouts (moved off Tasks — decision A5) and an accountable `procedureOwner` (A6, ISO §5.3/§7.5). Key semantics:

- `procedureRegistry` (label) + `procedureURL` identify the controlled document; stored FK cascade `businessUnitID → departmentID → processID → taskID` (task = NOT NULL join anchor); multivalued `requirementID[]` — **empty = applies to every requirement** (Q1 wildcard), form options limited to the task's *derived* requirement set (`requirementsForTask` in `forms.js`).
- A task has many procedures (Tasks expands into a Procedures subitem tab) and `executionTime` lives **per procedure** since 2026-08-04 (the requirement set changes how long a task takes — the task derives the sum, Events sum through it via nested derived SUMs); a procedure is held by many competences: `Competence.procedureID[]` (multivalued FK, gated on Task) replaced the stored `requirementID` — requirements now **derive through the procedures** (`computed → Procedures via: procedureID`), and Jobs staffing (`certified-responsible`) matches ticket requirements against the procedure sets (a wildcard procedure certifies all).
- `handoutsForTask` ownership resolves via Procedures; Channels became a hidden registry (`dashboard-order: 0`).

Migration `prototype/tools/migrate_procedures.py` (one procedure per demo task; requirement sets from the task's competences; handouts from the task's workflow); proof suite `prototype/tools/test_engine_procedures.mjs`; `schemaVersion` 6.

**Payload distribution (prototype, 2026-08-05 round, issue #159, `schemaVersion` 19):** the ER-model **Payload** distributes into Event and Process — `Events` declare applicability (`scopeID[]`/`productID[]` stored multivalued, empty = applies to all Q1; `productGroupID` derives from the products; **departmentID moved down to Processes**); `Processes` store `departmentID` (options = the event's unit) and `productScopeID[]` (offered from the event's applicability via `productScopesForEvent`); `Procedures` dropped `departmentID`, chain `productScopeID[]` from the process (`productScopesForProcess`) and their Requirements picker follows the selected product scopes (`requirementsForProductScopes`, task-set fallback). `Competence.departmentID` now derives from the selected **process** on save. **Follow-up (same day, `schemaVersion` 20):** Competence certifies a **Product Scope** — stored `productScopeID` (process-filtered select) replaced the separate Scope/Product Group selects; `scopeID`/`productGroupID` became mirrors through it and `certified-responsible` matches via `competenceProductScope()` (no product scope = wildcard). Migrations `tools/migrate_payload_distribution.py` + `tools/migrate_competence_product_scope.py` (missing scope×PG pairs created as Product Scopes); proofs `tools/test_engine_payload.mjs` + the talent suite.

**Payload entity (prototype, 2026-08-13, issue #190, `schemaVersion` 30 — Sponsors Presentation P2):** the ER-model **Payload** now also materializes as an Operation table (`dashboard-order` 7): one row = one **Event × Product Scopes** combination, the dispatch package the SLA/Tickets chain (#179/#192) will hang off. Stored FKs `businessUnitID` (NOT NULL) → `eventID` (NOT NULL, unit-filtered select) → `productScopeID[]` (multivalued; options = the event's applicability narrowed to the unit via `productScopesForPayload` in `forms.js`, items labelled `productGroupName | specs` and grouped by `scopeName`; empty = every admitted scope, Q1 wildcard) + `isActive` enum and `payloadOwner` (Broker role, ISO §5.3 — seeded from the event's owner, no form input). Seed `tools/migrate_payload_entity.py` (one payload per event); proof `tools/test_engine_payload_entity.mjs`.

**SLA entity (prototype, 2026-08-13, issue #179, `schemaVersion` 31 — Sponsors Presentation P3):** `CRM.SLA` (tab 2; Forecasts/Forecast Scopes shift to 3/4) — the contract by which a **Customer** of a branch purchases **Payloads** from a **Department**; tickets will only be able to trigger events covered by an SLA with that department (#192). Stored FK chain `businessUnitID` (NOT NULL) → `customerID` (NOT NULL) / `branchID` (nullable — a customer may have no branch, gated on Customer) / `departmentID` (NOT NULL, **unit**-filtered — the authored spec gated it on Branch but Departments carry no branch key) → `payloadID[]` (multivalued picker, unit-filtered, grouped by `eventTitle`). `eventID`/`productScopeName` derive through the purchased payloads (`computed → Payload (via: payloadID)`, Competence pattern); label = `slaTitle` (`computed: CONCAT(slaCode,'-',businessUnitName,'-',departmentName)` — **plain field parts only**: the `X from FK` CONCAT spelling is NOT implemented by `computedConcat`, parts resolve via the sibling-FK hop); `slaOwner` seeds from the unit's quality manager (ISO §5.3, no form input). Customers' subitem swaps Forecasts → SLA. Seed `tools/migrate_sla_entity.py` (one SLA per customer, all unit payloads); proof `tools/test_engine_sla_entity.mjs`.

**CRM activation & Customers slim-down (prototype, 2026-08-13, issue #191, `schemaVersion` 32 — Sponsors Presentation P4):** CRM joined the MVP walkthrough — `app.js` `BLANK_DISABLED_MODULES` drops `CRM` and `BLANK_DISABLED_TABS` gates the `Forecasts`/`Forecast Scopes` tabs **per-mode** (the authored spec's `visibility: "disabled"` would have un-catalogued them, breaking their rollup targets — `model.js` only catalogues `visibility: show` tables). Customers slimmed down: `customerType` relabelled `Internal Client | External Client | Supplier` (the Branches customer filter follows), geography **single-sourced on Branches** — `city`/`country`/`regionID` and the `customerTitle` CONCAT left Customers; `Tickets.customerID` displays `customerName`, its form groups by `businessUnitName` (was `country`), `Forecasts.customerTitle` mirrors `customerName`; segment listed before unit (PR #96 cascade order). Migration `tools/migrate_crm_activation.py` (relabel + drop legacy keys — extras fail the parity validator); validator's branch-customer drift check replaced by a legacy-keys-gone check; proof `tools/test_engine_crm_activation.mjs`.

**Workspace activation & SLA-aware tickets (prototype, 2026-08-13, issue #192, `schemaVersion` 33 — Sponsors Presentation P5, closes the milestone):** Workspace joined the MVP walkthrough (`BLANK_DISABLED_MODULES` keeps only Overview/Control; `Jobs` gated per-tab in `BLANK_DISABLED_TABS` — same un-catalogue trap as P4). Ticket chain: stored `businessUnitID` anchor (NOT NULL, seeded from the customer) → Customer (unit-filtered) → Project (customer-filtered) → **Event offered only from the customer's active SLAs** (`eventsForCustomerSLAs` in `forms.js` — issue #179 rationale; no customer/no SLA = every event, lenient wildcard); `forecastScopeID` and the Forecast Scope input left Tickets; `payloadID` derives `rollup → Payload (via: eventID)`, `slaID` derives the customer contracts; `eventID` display fixed to `eventTitle` (`eventName` never existed). The four snapshot VARCHARs (`processID`/`products`/`scopes`/`requirementName`) re-seed from the payload chain — requirements under Q1 AND-semantics across scope/product-group/unit/**customer** (the #180 dimension bites). Projects: stored `businessUnitID` + multivalued `slaID` (customer-filtered picker) + `productScopeName` coverage mirror through the SLAs. Migration `tools/migrate_workspace_activation.py`; proof `tools/test_engine_workspace_activation.mjs`.

**Ticket product-scope round (prototype, 2026-08-19, issue #214, `schemaVersion` 36):** Rafael's authored datamodel edits, implemented with three session decisions (tabs replace Jobs literally; Product Scope single-valued; CERTIFIED-USERS = AND coverage). **Tickets** gain a stored single `productScopeID` (FK → Product Scopes, empty = every admitted scope Q1; normalized from the authored `producScopeID` name-mirror typo — selects bound to name-mirrors store names and break joins): the form select (gate `Project IS NOT NULL`, refiltered by Event) offers the scopes packaged by the event's payloads narrowed to the customer's **active-SLA** payloads (`productScopesForTicket` in `forms.js`, lenient like `eventsForCustomerSLAs`; wildcard payload = the event's full applicability). The `processID` snapshot now stores process **ids** narrowed by event + chosen scope (`ticketProcesses`, derived on save via `applyDerivedUnits`; events without processes keep the prior value — #192 posture; the #192 seed stored joined *names*, re-seeded as id arrays) and drives the expanded row's **Processes/Tasks tabs** (`(via: processID)`, dashboard-level) which **replace the Jobs tab**; the form-level "New Job" launcher is gone (the authored tabbed block sat inside `form` with an unclosed array — the engine only reads the object form at dashboard level, §9). **Tasks**: `userID` is a derived `mirror` — new rule kind `computed: CERTIFIED-USERS(taskID) (display: userName)` (`certifiedUsersForTask` in `resolve.js`, sharing `competenceRequirements` with the Jobs control): certified Onboarding + task-compatible competences whose **union** covers ALL the task's derived requirements (wildcard procedure covers everything). `taskName` reordered to `CONCAT(activityName,'-',actionName)` — stored values win over CONCAT rules, so the mockup re-seeds (the pre-36 names were decorative; the honest re-seed killed the cross-process name recurrence — the "recurrent tasks" card was **redefined to count recurring ACTIONS across processes** in the follow-up, issue #216 option B, `schemaVersion` 37: card spec + `Tasks::Card 1-1` in `queries.js`, degeneracy gates re-armed in `validate_mockup.py`/`test_queries.mjs`). **Procedures**: `processID`/`taskID` moved up in the column order, `processID` now `table-display: true`. Migration `tools/migrate_ticket_scope_round.py` (both mockup copies; zero `productScopeID` seeds — no demo payload packages exactly one scope, honest under the single-seed decision); proof `tools/test_engine_ticket_scope.mjs`. **Follow-up #218 (`schemaVersion` 38, BOOLEAN-select convention):** selects bound to `BOOLEAN` attrs (`Onboarding.isCertified`, `Product Scopes.isActive`) render fixed **Yes/No** options and commit a **real boolean** (`BOOLEAN_OPTIONS`/`booleanFromSelect` in `forms.js`) — the distinct-from-data fallback offered nothing on a blank dataset and the DOM select's string `"true"` never passed the strict certified gates (`isCertified === true`), so UI-registered onboardings could never surface anyone in the Tasks Users column; proof `tools/test_engine_boolean_select.mjs`. **Follow-up #220 (`schemaVersion` 39):** `Customers.isActive` (soft-delete flag, visible column) was bound to **no form field** at all — UI-created customers never got the key. The Customers form gained the **Active** select, and boolean field-rules accept **`default: Yes|No`** (`booleanDefault` in `forms.js`): preselects on NEW records only, edit prefill wins, and `isCertified` deliberately carries no default. #222 (`schemaVersion` 40) extended `default: Yes` to the Product Scopes Active select, dropping its stale `enum: Active, Inactive` field-rule (dead text since the #219 branch — the other `isActive` fields, SLA/Requirements/Payload/People, use the ENUM `Active|Inactive` convention and are untouched).

**Onboarding competence group (prototype, 2026-08-21, issue #239, `schemaVersion` 44):** `Onboarding.competenceID` is **multivalued** — one onboarding certifies a GROUP of competences (1:many; the pre-44 single FK dated from the Talent alignment round and was reverted at Rafael's request; the Competence→Procedure 1:1 of #231 is untouched). New stored **`onboardingTitle`** (VARCHAR, NOT NULL) names the group — first `*Title` attr, so it is the table label and therefore form-required; the form opens with the Title input and the Competence selectGroups renders as the grouped multicheck (department + role cascade unchanged). A dashboard-level **Competences subitem tab** (`(via: competenceID)`, Tickets `(via: processID)` precedent) lists the group per row. Engine: the two scalar readers of `ob.competenceID` — `certifiedUsersForTask` (`resolve.js`) and the exported `certifiedResponsibles` (`forms.js`) — iterate the array; requirement coverage unions **within** an onboarding as well as across rows (#214 AND semantics kept), any group member qualifies the person for Jobs staffing, and `isCertified` gates the **whole group** (partial progress = a separate onboarding). Legacy scalar snapshots keep resolving (`list()`/`matches` normalization). Migration `tools/migrate_onboarding_competences.py` (both mockup copies: scalar→singleton array, titles seeded from the certified competence's stored task name; no row merging — grouping is a UI decision); proof `tools/test_engine_onboarding_competences.mjs`.

**SLA supplier definition (prototype, 2026-08-25, issue #272, `schemaVersion` 50):** every contract binds a **(customer, supplier) pair** — `SLA.supplierID` is a stored FK → Customers, **NOT NULL**, and the form's Supplier select offers **every** customer grouped by `customerType` (`SelectLabel = customerType`, no unit filter — decision of the round; **any** type may supply: an Internal Client clinic can be the supplying side of another unit's SLA). Downstream, **Tickets** gain a nullable `supplierID` (form select between Project and Event, gated on Customer, options = the distinct suppliers of the customer's ACTIVE SLAs via `suppliersForTicketCustomer` in `forms.js`); the Event and Product Scope pickers narrow to the SLAs matching the pair — `eventsForCustomerSLAs`/`productScopesForTicket`/`admittedProductScopeIds` grew an **optional trailing `supplierId`** (old-arity callers untouched), lenient when no SLA matches (the `kept.length` posture), and `ticketRequirements` threads `ticket.supplierID` so the requirement AND-chain follows the pair. The Event/Product Scope field-rules must **name** Supplier (`filtered by Customer + Supplier selected`) — cascade listeners only attach to deps listed in the rule. Seed builder updated in lockstep (`tools/seed/test_seed_pipeline.py` rebuilds from the live datamodel and fails on any unfilled stored attr): `clinic.yaml` fixtures Customers 18→**21** + a `suppliers` group (order matters — the builder's `i % 4` unit modulo lands ClinLab→BU03, HomeCare→BU04, Contrast→BU01), `Builder._sla_supplier` holds the shared deterministic rule (Internal Client customer ⇒ first other Internal Client of the unit; else the unit's Supplier-type, with total fallbacks) and Supplier-type customers are **excluded from the SLA rotation** (story anchors index into the pre-#272 sequence). Migration `tools/migrate_sla_supplier.py` (both mockup copies; creates the 3 suppliers only when `_meta.domain == 'clinic'`, seeds all SLA rows, keys `supplierID` on every ticket — null cohort at `i % 3 == 0`, others follow the covering active SLA); proof `tools/test_engine_sla_supplier.mjs` (36-suite battery green). **Follow-up #274 (`schemaVersion` 51):** `forecastScopesForTicket` grew the same optional trailing `supplierId` — a declared Supplier keeps only the demand lines of the (customer, supplier) contracts (lenient posture). The round also fixed a latent #243 wiring bug: the Forecast Scope field-rule lacked the **`filtered by … selected` spelling**, so `buildSpecFields` never attached `_refilter` and the dispatch branch calling `forecastScopesForTicket` was DEAD in the DOM — the select offered every demand line unfiltered (the helper was only ever exercised by the proof suite). Rule is now the array `["filtered by Event + Product Scope + Customer + Supplier selected", …]`; trap generalized: **a bespoke dispatch branch inside the cascade block is unreachable unless the field-rule matches the `filtered by` regex** — free-text rules don't wire listeners. No data migration (mockup `_meta` stamped 51); proof: forecast-scope narrowing + rule-spelling regression blocks in `tools/test_engine_sla_supplier.mjs`.

**Forecast Scopes region re-point (prototype, 2026-08-25, issue #230, `schemaVersion` 52):** the region dimension of `Forecast Scopes.requirementID` was **dormant since #191** — the rule's `forecastID.customerID.regionID` leg traversed a field Customers no longer store (geography moved to Branches), so `pathValues` resolved `[]` and `multiViaJoin` silently skipped the constraint: region-specific requirements matched every demand line. The leg is re-pointed to the customer's units' **served regions** — `forecastID.customerID.businessUnitID.regionID` (`Business Units.regionID`, the #226 ticket-inheritance posture; the Branches alternative is a reverse join the dotted-path `via:` cannot traverse). Lenient posture preserved: a unit serving no region (path `[]`) still admits region-specific requirements. Display/rollup only — no stored data changes, no migration (mockup `_meta` stamped 52). Proof `tools/test_engine_forecast_region.mjs` (dormancy regression + served-region narrowing + Q1 wildcards).

**Ticket-related procedures (prototype, 2026-08-25, issue #270, `schemaVersion` 53):** the Tickets Tasks tab gains a **Procedure** column — for each task, the ticket's live inherited requirement set (#226) must narrow the task's procedures to **exactly one**: candidates are the procedures whose `requirementID[]` **covers ALL** the ticket requirements (AND semantics, the `certifiedUsersForTask` coverage posture; empty set = Q1 wildcard, covers everything). One candidate → its `procedureRegistry` renders as a **pill tag** (`info`); zero or several → **GAP** (`caution`) — including the wildcard-coexists-with-specific case, a genuine ambiguity for the quality manager. Implementation mirrors #233 end to end: new rule kind `computed: TICKET-PROCEDURE(taskID) (display: procedureRegistry)` (`model.js`), `ticketProcedureForTask`/`ticketProcedureDisplay` in `resolve.js` (derivedValue falls back to the task-level set: unique procedure or GAP — the standalone Tasks drawer), ticket-contextual accessor + `col.pill` in `mapSubitem` (`app.js` — first use of table.js's dormant pill rendering; accessor and pill compose: `resolveVal` then `cellHtml` wraps). New Tasks attr `procedureRegistry` (type `mirror` = validator-safe derived, `subitem-display` only, **`display-name: "Procedure"`** header override — the existing `procedureID` rollup was untouchable: `SUM(procedureID.executionTime)` resolves through its rule). No stored data changes, no migration (mockup `_meta` stamped 53). Proof `tools/test_engine_ticket_procedure.mjs` (AND narrowing, GAP postures, wildcard ambiguity, derivedValue fallback, demo one-procedure-per-task regression).

**GAP identification (prototype, 2026-08-25, issue #271, `schemaVersion` 54):** the system points at gaps without waiting for a nonconformity, via a new **generic `gap-tag` attribute flag**: the `derivedValue` wrapper (`resolve.js`) renders an EMPTY derived value as the **GAP** tag on flagged attrs (dash `—` everywhere else — opt-in), `withAccessors` (`app.js`) styles it as the caution pill, and `cellHtml` (`table.js`) now lets a **falsy pill class fall through** to plain rendering — only the GAP is a pill, value lists render plain (the #270 pills, always-truthy classes, are untouched). Two columns use it: **`Procedures.userID`** ("Users", `display-name` override) — holders of a CERTIFIED Onboarding on a competence **bound to this procedure** (`certifiedUsersForProcedure` in `resolve.js`; strict association, NO wildcard — a procedure-less competence widens staffing coverage but does not staff a specific procedure's column); the rule reuses the CERTIFIED-USERS kind and **`srcField` picks the chain** (`procedureID` vs `taskID`). And **`Tasks.procedureID`** (rollup, now a visible column headed "Procedures" — plural, to avoid colliding with the #270 "Procedure" column; kept out of the ticket Tasks tab where #270 already carries the contextual signal) — a task with no procedure renders GAP. Downstream (#270 rationale): once the ticket narrows a task to its single procedure, that procedure already carries — or lacks — its eligible users. No stored data, no migration (mockup `_meta` stamped 54). Proof `tools/test_engine_gap_identification.mjs` (strict association, certified gate, no-wildcard, GAP renders, opt-in dash regression, demo census: 5/50 frozen-dataset procedures staffed — 45 honest GAPs).

**Dashboard trim (prototype, 2026-08-03 second round, `schemaVersion` 7):** `Issues` and `Actions` are **hidden registries** (`dashboard-order: 0`, still catalogued) — created inline via the "+" button on the Scopes Opportunity / Tasks Action selects; `Issues.businessUnitID` replaced `businessSegmentID` (Unit select grouped by segment — reversal of the 2026-08-01 segment round; migration `tools/migrate_issue_units.py`); Regions is Organization tab 2 (matches the D10 dependency order).

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
