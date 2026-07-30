Version 2.0 — Created 29/07/2026 by Claude Code from the uncommitted `datamodel.json` diff (post-Requirements-restructure baseline `1e7aec3`).

> [!note] For gh-tasks review/plan
> This document catalogs every change hand-edited into `prototype/data/datamodel.json` and
> `sourceFiles/developer/datamodel.json` / the two `mockup_data_prototype.json` copies, plus the
> nonconformities and engine/data work required to make the prototype run again.
> After implementation, review `DATAMODEL_GUIDE.md` and the Architecture Overview in `CLAUDE.md` —
> both still describe the pre-Organization model (Factories, businessSegment enum, Squads in Talent).

# Theme of this revision

Continuation of the multi-department restructure (see `sourceFiles/developer/prototype_restructure.md`):

1. **New `Organization` module** — Business Segments → Business Units → Departments → Squads
   hierarchy replaces the flat `businessSegment` enum and absorbs Squads from Talent.
2. **Factories become Customers** — the `Customers` module is renamed `CRM`, the `Factories`
   table becomes `Customers`, and `factoryID`/`factoryName` become `customerID`/`customerName`
   everywhere. Internal factories and final Northwind Energy clients are now the same entity.
3. **Customer-aware chain** — `Requirements`, `Workflows`, `Tasks` and `Jobs` gain a customer
   dimension: requirements can be scoped per customer, workflows declare customer + product scopes,
   tasks derive customer/scope/product-group from their workflow, and jobs resolve their task by
   customer + product group + scope.
4. **New `Issues` table (Portfolio)** — generalizes the former `scopeOpportunity` enum into a
   registry typed `Opportunity | Risk`; `Scopes.scopeOpportunity` becomes an FK filtered on
   `issueType = 'Opportunity'`.

# Repairs already applied (this session, agreed with Rafael)

The hand edits left `prototype/data/datamodel.json` unparseable; the following was fixed in place
(the file validates again — semantic work below is still open):

- [x] Syntax: 3 trailing commas (Business Units / Business Segments / Departments), unclosed
  `Squads` table + `Organization` module before `"CRM"`, unclosed `Product Scopes` form field in
  Workflows, two `/*…*/` comments converted (Workflows.requirements → `notes` TODO;
  Product Scopes form Product Group display intent → `field-rule`).
- [x] `Talent.sidebar-position` 3 → 4 (was clashing with CRM = 3). Final order: Organization 1,
  Portfolio 2, CRM 3, Talent 4, Operation 5, Workload 6, Control 7.
- [x] **Projects form** — the new external-client `Customer` field (customerID → Customers) and the
  old internal-factory `Customer` select shared one JSON key. Decision: **merge into one** —
  single `Customer` field on `customerID`; `customerName` attribute converted to a hidden
  `mirror: Customers via: customerID` so downstream mirrors (Tickets, Jobs) keep resolving.
- [x] **Squads form** — fields were copy-pasted from Departments; corrected to
  Department → `departmentID`, Name → `squadName`, Type → `squadType` (new), Owner → `squadOwner`.
- [x] **Customers form** — duplicate `Segment` key: the obsolete enum-based field (attribute
  `businessSegment`, deleted from the table) was silently overriding the new `businessSegmentID`
  field at parse time; obsolete field removed.
- [x] **Issues form** — `Name` field pointed at `scopeName` (copy-paste); corrected to `issueName`.

# Change catalog by module

## Organization (new module, sidebar 1)

- **Business Segments** (order 1): `businessSegmentID`, `businessSegmentName`, `…Description`,
  `…Code` (e.g. "LPT"). Registry replacing the former `Customers.businessSegment` enum (LPT/MPT/DT).
- **Business Units** (order 2): `businessUnitID`, `businessSegmentID` (FK, multivalued),
  `businessUnitName`, `businessUnitCode` (e.g. "LMPT").
- **Departments** (order 3): `departmentID`, `businessUnitID` (FK) + `businessUnitName` mirror,
  `departmentName`, `departmentCode`. Form groups Business Unit by `businessSegmentName`.
- **Squads** (order 4, moved from Talent): dropped `managerName`/`managerEmail`; added
  `departmentID` (FK); `squadOwner` is now `rollup → People via departmentID (display: userName)`
  — i.e. the owner is picked among the department's people.

## CRM (former Customers module, sidebar 3)

- **Factories → Customers**: `factoryID`/`factoryName` → `customerID`/`customerName`;
  `factoryTitle` → `customerTitle`; `businessSegment` enum **removed**, replaced by
  `businessUnitID` (FK → Business Units) + `businessSegmentID`
  (`rollup -> Business Units via: businessUnitID (display: businessSegmentName)`).
  Form gains `Unit` and `Segment` (Segment gated by `check: "Unit IS NOT NULL"`).
- **Forecasts / Forecast Scopes**: `factoryID` FK renamed `customerID`; region mirror updated.

## Portfolio (sidebar 2)

- **Product Scopes**: `productGroupID`/`productGroupName` no longer displayed; new displayed
  rollups `productName` (`rollup → Products via: productGroupID`) and `productSpecName`
  (per Q2: `rollup → Product Groups via: productGroupID (display: specsSummary)`), both
  multivalued; `products` attribute removed; `businessSegment` hidden from
  subitems; form reordered (Registry ID first) and Product Group field now stores
  `productGroupName` with display intent `CONCAT(productName,'-',productSpecName)`.
- **Scopes**: `scopeOpportunity` changed from enum to
  `FK: Issues (filtered by issueType='Opportunity')`, multivalued.
- **Issues** (new, order 8): `issueID`, `issueName`, `issueDescription`,
  `issueType` enum `Opportunity | Risk`, `scopeID` reverse rollup; `subitem-tables: ["Scopes"]`.
- **Product Specs**: `productID` hidden from table; `productSpecOwner` removed;
  `subitem-tables: ["Products"]` added.
- **Requirements**: new `customerID` (FK → Customers, **multivalued**) + Customer form field
  (grouped by `businessUnitName`) — requirements are now optionally customer-scoped, not only
  scope + product-group-scoped.

## Operation (sidebar 5)

- **Tasks**: customer/scope/product-group now **derive from the workflow** instead of being stored:
  - `requirementName`: `computed → Workflows (via: workflowID) (display: requirementName)`
  - `scopes` → `scopeID`: `computed: Workflows via: workflowID.productScopeID.scopeID`
  - new `productGroupID`: `computed: Workflows via: workflowID.productScopeID.productGroupID`
  - `customerName` → `customerID`: `computed: Workflows (via: workflowID) (display: customerName)`, hidden.
- **Workflows**: new `customerID` (FK → Customers, multivalued) and `productScopeID`
  (FK → Product Scopes, multivalued); removed `customer`, `products`, `workflowOwner`;
  `requirements` rewritten per Q1 as a 3-key compound rollup (Rafael's inline TODO about an
  associative entity resolved — see Design decisions).
  Form gains `Customer` and `Product Scopes` comboboxGroups (grouped by `businessUnitName` /
  `scopeName`).

## Workload (sidebar 6)

- **Projects**: free-text `clientName` → `customerID` (`FK -> Customers`); form merged per the
  decision above.
- **Jobs**: new `scopeID` and `productGroupID` (`rollup → Product Scopes via: ticketID`),
  new `customerID` (`mirror: Projects via: projectID`); `taskID` changed from a plain FK to
  `rollup → Tasks via: customerID -> productGroupID -> scopeID (display: taskName)` — the job's
  task options are narrowed by the ticket's customer, product group and scope.

## Control (sidebar 7)

- **Capacity**: `factoryID` → `customerID` (rule body still stale — see nonconformities).

## Talent (sidebar 4)

- **Squads removed** (moved to Organization).
- **People**: new `businessUnitID` (FK → Business Units) and `departmentID`
  (`rollup -> Departments via: businessUnitID`); form gains `Unit` (grouped by
  `businessSegmentName`) and `Department` (gated by `check: "Unit IS NOT NULL"`).

## sourceFiles copies

- `sourceFiles/developer/datamodel.json`: only the `factoryID/factoryName → customerID/customerName`
  attribute rename (module still `Customers`, table still `Factories`, no Organization/Issues).
- `sourceFiles/developer/mockup_data_prototype.json`: factory-key rename + `productClassID →
  productSpecID` in the `Product Spec` seed rows.
- `prototype/data/mockup_data_prototype.json`: factory-key rename only (already used
  `productSpecID`).

# Nonconformities — must be fixed during implementation

## A. Factories→Customers rename leftovers (`prototype/data/datamodel.json`)

The rename was applied to attribute names but not to rule bodies, report specs and filter fields.
`grep -n 'Factories\|factory'` currently returns ~30 hits; the complete list:

- [x] `Customers.customerTitle` rule: `computed: CONCAT(factoryName,'-',city)` → `customerName`.
- [x] `Customers.factoryOwner` attribute — rename to `customerOwner` (also in mockup rows).
- [x] `Customers` form `Name` field attribute: `factoryName` → `customerName` (currently a dead
  reference; the Name input would not bind).
- [x] `Forecasts.customerID` rule: `FK → Factories` → `FK → Customers`.
- [x] `Forecasts.factoryTitle` / `Forecast Scopes.factoryTitle` — rename to `customerTitle`;
  rules `mirror → Factories …` → `Customers`; forecast display
  `CONCAT(factoryTitle,' | ', periodFrame)` accordingly.
- [x] Report/filter rules still on factory vocabulary: Forecasts Report-A/B filters
  (`factoryTitle` filter fields, `FK -> Factories …`, `SelectLabel = Factories.region`,
  `SelectLabel = Forecasts.factoryName`), Tickets/Capacity/Performance Report-A rules
  (`grouped by factoryName`), Capacity `Card 1-2` (`factoryName with the biggest utilization gap`),
  Workload `factoryName` filter fields.
- [x] `Tickets.customerName` (line ~3476) rule: `FK → Factories (display: CONCAT(factoryName + city)`
  → `Customers` + `customerName` (note: this rule was already missing its closing parenthesis).
- [x] `Capacity.customerID` rule: `FK → Factories (display: factoryName)` →
  `FK → Customers (display: customerName)`.
- [x] `Onboarding.location` (line ~5303) rule: `FK → Factories (display: factoryName)` →
  `FK → Customers (display: customerName)`.

## B. Copy-paste / definition errors introduced by the edits

- [x] `Business Units.businessSegmentID` rule `"FK ->  Business Segment (display: businessSegmentName"`
  — missing closing parenthesis and wrong table name (`Business Segments`).
- [x] `Departments.businessUnitName` mirror uses nonstandard syntax
  (`mirror: businessUnitName via businessUnitID`) — normalize to the engine form
  `mirror: Business Units via: businessUnitID (display: businessUnitName)`.
- [x] `People.businessUnitID` and `People.departmentID` carry `notes: "Auto-generated primary key"`
  and `constraints: "PK"` (copy-paste) — must be `FK`/`null`. **Risk:** three PK-flagged
  attributes can break the engine's PK detection for People.
- [x] `Issues.scopeID` rule is prose (`computed: list scopeID from Scopes where scopeID matches`)
  — normalize to `rollup → Scopes (via: scopeOpportunity)` (reverse of the new FK).
- [x] `Jobs.scopeID` / `Jobs.productGroupID` notes say "Ticket this job belongs to" (copy-paste;
  cosmetic).
- [x] `Tasks` form still has a `Customer` field bound to the removed `customerName` attribute.
  Since `customerID` is now computed from the workflow (hidden), the field should be **removed**
  from the form (customer is no longer an input on Tasks — matches the restructure direction).
- [x] `Workflows.productScopeID` display referenced a nonexistent `productScopeName` — fixed per
  Q3 to `display: CONCAT(productName,' | ',scopeName)`.
- [x] Pre-existing (not from this edit, found while validating): `Forecast Scopes` form
  `Product Group` → missing `productGroupName` attribute; `Skill Levels` form `Rank` → missing
  `levelRank` attribute.

## C. Engine work required (rule mini-DSL constructs not yet supported)

- [x] **Path-traversal computed** — two-hop dotted `via` paths: Tasks.scopeID /
  Tasks.productGroupID (`computed: Workflows via: workflowID.productScopeID.scopeID`) and the
  path keys inside the Q1 rollup below.
- [x] **3-key compound rollup with path keys** — `Workflows.requirements`:
  `rollup → Requirements (via: customerID + productScopeID.productGroupID +
  productScopeID.scopeID)` (Q1, applied in the datamodel). Extends the 2-key compound join in
  `model.js`/`resolve.js` to three keys, allows dotted path keys, and treats an **empty
  `Requirements.customerID` as matching every customer**.
- [x] **Chained-via rollup** — `rollup → Tasks via: customerID -> productGroupID -> scopeID`
  (Jobs.taskID). Normalize to the compound-AND syntax (`via: customerID + productGroupID +
  scopeID`) rather than introducing a third `->` syntax; covered by the 3-key extension above.
- [x] **Filtered FK** — `FK: Issues (filtered by issueType='Opportunity')`
  (Scopes.scopeOpportunity): FK option lists constrained by a predicate on the target table.
- [x] **Owner-from-rollup select** — `Squads.squadOwner: rollup → People via departmentID` used as
  a form select: options restricted to People of the chosen Department (form cascade on
  `departmentID`).
- [x] **Form gating + readonly derived field** — `check: "Unit IS NOT NULL"`
  (Customers.Segment, People.Department): verify the existing multi-dependency cascade in
  `forms.js` covers gating a field on another field's non-null value. Per Q4, Customers.Segment
  is additionally a **readonly** input auto-filled from the chosen Unit's
  `businessSegmentName` — new `readonly` field-type behavior in `forms.js`.
- [x] **Multivalued FK on a plain select** — `Business Units.businessSegmentID` is multivalued but
  rendered as `shadcn-select`; either render a multi-combobox or drop `multivalued`.

## D. Mockup data migration (`prototype/data/mockup_data_prototype.json`)

`data.js` indexes records **by table name**, so with the current file the renamed `Customers`
table renders empty (rows still live under the `"Factories"` key).

- [x] Rename table key `Factories` → `Customers`; move it (with Forecasts / Forecast Scopes) under
  a `CRM` module key, and Squads under `Organization` (module keys are cosmetic for the loader,
  table keys are not).
- [x] Rename remaining record keys: `factoryOwner` → `customerOwner`, `factoryTitle` →
  `customerTitle` (Forecasts / Forecast Scopes rows).
- [x] Seed new tables:
  - `Business Segments` — LPT, MPT, DT (from the removed enum).
  - `Business Units` and `Departments` — at least the transformer-repairs department plus one more
    (e.g. switch gear) to demonstrate the multi-department objective.
  - `Issues` — Lifetime Extension, Increase Capability, Dielectric Failure as `Opportunity`
    (from the removed `scopeOpportunity` enum values), plus at least one `Risk`.
- [x] Wire new FKs on existing rows: `Customers.businessUnitID`, `People.businessUnitID`,
  `Requirements.customerID`, `Workflows.customerID` + `productScopeID`,
  `Projects.customerID` (map former `clientName` strings to Customer records),
  `Scopes.scopeOpportunity` → Issue IDs; drop `managerName`/`managerEmail` from Squads and add
  `departmentID`.
- [x] Follow the `prototype/tools/migrate_requirements.py` precedent: write a deterministic
  `migrate_organization.py` so the migration is reproducible on both mockup copies.

## E. Copy divergence

`sourceFiles/developer/datamodel.json` received only the attribute rename and now lags the
prototype copy (no Organization module, no Issues, table still `Factories`). Decide whether to
sync it or formally declare `prototype/data/datamodel.json` the single source of truth and mark
the sourceFiles copy legacy.

> **Resolved (P3-A):** `prototype/data/datamodel.json` is the canonical schema;
> the sourceFiles copy keeps only the attribute rename and is documented as a
> legacy design reference in CLAUDE.md.

# Design decisions (Q1–Q5, approved by Rafael 29/07/2026 — recommendations adopted)

The datamodel-level parts of each decision are **already applied** to
`prototype/data/datamodel.json`; the engine work they imply is tracked in section C.

**Q1 — No associative entity for Requirements.** The multivalued `customerID[]`, `scopeID[]`,
`productGroupID[]` on `Requirements` *are* the flattened associative entity
(Requirement-Applicability). Applied: `Workflows.requirements` is now
`rollup → Requirements (via: customerID + productScopeID.productGroupID + productScopeID.scopeID);
display: requirementName` — compound AND join with path keys through the linked Product Scope,
with the convention that a requirement with an **empty** `customerID` applies to all customers
(generic department requirements keep working). The associative entity belongs in the **ER-UML
model** (Constrain side) when the prototype is mapped back. Grouping the Workflows UI by
customer → scope → product group remains a display concern, not a schema one.

**Q2 — `Product Scopes.productSpecName`.** Applied:
`rollup → Product Groups via: productGroupID (display: specsSummary)` — the SPECS summary of the
linked Product Group replaces the copy-pasted Products rollup. The form's Product Group display
`CONCAT(productName,'-',productSpecName)` now has a real source.

**Q3 — Workflow → Product Scope display.** Applied:
`FK → Product Scopes (display: CONCAT(productName,' | ',scopeName))` — scope + product is the
meaningful label, matching the Jobs chain.

**Q4 — `Customers.businessSegmentID` is read-only in the form.** Applied: the Segment field is
now a read-only input auto-filled from the Business Unit rollup
(`field-rule: "readonly: auto-filled from businessUnitID rollup (display: businessSegmentName)"`,
still gated on `Unit IS NOT NULL`). One source of truth — nothing stored redundantly.

> **Q4 addendum (2026-07-30, twice revised).** First reversal: Segment became a stored,
> user-selected multivalued FK gated on Unit. Second revision (PR #96): the cascade direction
> inverted — **Segment is picked first**, and Unit is gated on it (`check: "Segment IS NOT NULL"`)
> with options filtered to the selected segments' units (`field-rule: "filtered by Segment
> selected"`). Note the engine only reads cascade filters from `field-rule` in the
> `filtered by <Label> selected` spelling; gate suffixes inside `check` are ignored.

**Q5 — Competence stays customer-agnostic.** A certification (e.g. "IEC 60076 Compliance") holds
regardless of customer; Competence keeps certifying by scope + product group, and the Jobs
`certified-responsible` control keeps matching on scope/product-group/requirements. The customer
dimension narrows the requirement *set* naturally through the Q1 rollup. No schema change.
