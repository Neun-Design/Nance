Version 3.0 — Created 01/08/2026 by Claude Code. Architecture & data-model review of
`prototype/data/datamodel.json` **on its own terms** — the reference ER model and design docs are
deliberately out of scope: the prototype's simplified model, shaped by stakeholder tests and
interviews, is the model of record.

> [!note] How to use this document
> Each finding ends with a `**Rafael:**` block — add your considerations point by point there.
> Decision points are numbered **D1–D12** (continuing the Q1–Q5 convention from
> `prototype_v2-review.md`). Nothing here is implemented yet; this is the debate artifact.

> [!note] Companion document
> The UI/UX review lives in `prototype_ux-review.md` (findings **U1–U9** + the tabbed
> subitem-tables feature, 02/08/2026) — same debate convention, own methodology section.

# Context

Reviewed at `main` = PR #123 (form-data integrity). The model spans 7 modules / ~30 tables with
NOT NULL anchors, deterministic seed migrations, 10 engine test suites and a failing-contract
validator. The strengths worth preserving: the datamodel as single declarative source (forms,
cascades, joins, dashboards), the "materialize FK + derive on save" pattern, and the
one-migration-one-suite-per-round workflow.

# Iterations 
This session will be the place to insert new features or data model instructions to be
assess in the review.

## New Procedure entity 
Currently the procedure is just a link input in the Task instances.
The new relationship must create a new Entity (table) for Procedures in the Operation module
Check the updates made in the datamodel to understand the impact of this new entity in the model.
I decided to create this procedure entity because the inputs and outputs of task can change depending
on the requirements applied, but a task must be requirement free, because a process cannot vary depending
on requirements or scopes. Process, workflows and tasks do not change depending on product scopes or requirements.
But the procedures to perform a given task can change depending on requirements, and competences can vary depending
on product scopes and the procedures.
That means that a task can have multiple procedures, and a procedure can be applied to multiple competences.

> **Claude (impact analysis, 03/08):** the concept is sound and I recommend adopting it — with a
> corrected schema. The invariance principle (Process/Workflow/Task are requirement-free;
> **Procedure** is where requirements bite; Competence certifies procedures) sharpens the model,
> matches the reference ER model (Procedure = "documented method", `procedureNumber` as external
> reference — CLAUDE.md §4.4 chain), and *simplifies* Competence as a side effect. The sketch in
> `datamodel.json` cannot run as written, though, and the change ripples through six things we
> already built. Point by point:
>
> **A. Blockers in the current sketch (working tree, 03/08):**
> 1. **The JSON does not parse** — missing comma before `"Procedures": {` (line ~3195) and a
>    trailing comma after its closing brace. The local app is down until fixed (the deployed
>    copies are unaffected).
> 2. **Stored-vs-derived inversion** — `Procedures.departmentID/processID/taskID/requirementID`
>    are typed `rollup` yet bound to form selects. A field the user *selects* must be a **stored
>    FK** (type `FK`, `FK → <Table> (display: …)`), with the cascade living in
>    `check:`/`field-rule: "filtered by X selected"` — the engine derives rollups and ignores
>    them as commit targets, and the validator's parity contract (schema-parity round) forbids
>    stored values under derived attrs. The dotted vias also traverse the wrong direction:
>    `businessUnitID.departmentID` reads a `departmentID` field *on Business Units*, which
>    doesn't exist (Departments store `businessUnitID`, not the reverse). The shipped cascade
>    engine already gives you Unit → Department → Process → Task with plain stored FKs +
>    `filtered by` rules (same pattern as Competence/Onboarding).
> 3. **Copy-paste slips** — the "Requirements" field binds `attribute: taskID` (should be
>    `requirementID`); Competence's new "Procedure" field also binds `taskID` (should be a new
>    stored `procedureID`); `"SelecLabel = squadName"` (typo — engine greps `SelectLabel`);
>    `Procedures.taskInput/taskOutput` notes still read "assigned to this task".
> 4. **Channels: `visibility: "hide"` un-catalogues the table** — `Handouts.channelID` FK display
>    and `Competence.channelName` mirror break. The convention for "keep but no dashboard" is the
>    hidden-registry pattern: `visibility: "show"` + `dashboard-order: 0` (Requirement Type,
>    Activities-R5).
> 5. **Inputs/Outputs now live in two places** — Procedures gained `taskInput`/`taskOutput` but
>    Tasks kept its own stored pair (attrs + form fields). Dual ownership is the drift anatomy of
>    D1. Your own rationale ("inputs and outputs of a task can change depending on the
>    requirements applied") says they belong to **Procedure only**; Tasks can expose a derived
>    union over its procedures where a task-level view is still wanted.
> 6. **No `procedureOwner`** — a procedure is documented information (ISO §7.5, controlled);
>    under your D7 owner policy this looks like an entity that *does* need accountability. Your
>    call.
> 7. **`Procedures.requirementID` should stay consistent with the applicability chain** —
>    recommend a stored multivalued FK whose form options are **filtered to the task's derived
>    requirement set** (the 5-key chain via the task's workflow), empty = applies to all (Q1).
>    Otherwise a procedure can claim a requirement its task's scope never produces.
>
> **B. Impact on what is already built:**
> 1. **Jobs staffing (`certified-responsible`)** — today it matches People through Competence's
>    *stored* `requirementID[]` (scope + product group + ticket requirements, narrowed by Task).
>    With certification moving to procedures, the match becomes ticket requirements → applicable
>    Procedures → Competences holding them; `forms.js` (`certified-responsible`, `tasksForJob`)
>    must re-route, and `test_engine_required.mjs`/`test_engine_talent.mjs` re-anchor.
> 2. **Competence simplifies** — drop stored `requirementID` (derive via `procedureID.requirementID`),
>    drop the Scope+PG-filtered Requirements multiselect from the form; `channelName` (mirror over
>    the task's handout channels) re-routes through procedures once inputs/outputs move.
> 3. **Tasks ↔ Handouts machinery moves** — `handoutsForTask` filtering and the "New Handout"
>    related-records launcher relocate to the Procedures form; the Inputs/Outputs subitem tabs you
>    placed on Procedures work out of the box (the object entries shipped in PR #136 accept
>    `(grouped by …)`); Tasks' single "Procedures" tab renders as one stacked group (tabs need 2+
>    — fine).
> 4. **Onboarding/Tasks requirement derives** lengthen by one hop (via Competence → Procedures).
> 5. **Migration is non-trivial but deterministic** — seed one Procedure per Task that carries
>    `procedureName`/`procedureURL` (registry = the old name, `requirementID = []` wildcard,
>    `taskID` link); Competence.procedureID = the procedures of its task; then drop
>    `Tasks.procedureName/procedureURL` (+ `taskInput/taskOutput` if decision A5 says move).
>    Both mockup copies; `schemaVersion` 5 → 6; one proof suite per the round workflow.
> 6. **Docs/deploy surface** — new Operation dashboard → app-guide page + D10 registration order
>    (Procedures registers after Tasks, before Competence), MVP walkthrough sequence, and a
>    `./deploy_pages.sh` run.
>
> **C. Sequencing** — this round touches Tasks/Workflows/Competence, the same ground as
> **#141 (Activities R5)**; #124/#132 also change the datamodel. One datamodel round at a time:
> suggest R5 first (it stabilizes the Workflows/Tasks keys Procedures will chain through), then
> Procedures — unless you prefer to fold both into one round. Effort: a full round (schema +
> migration + engine re-route + suite + guide) — comparable to the Regions round.
>
> **Corrected Procedures attribute sheet** (proposal to implement):
>
> | Attribute | Type | Rule / note |
> |---|---|---|
> | `procedureID` | INT PK | auto |
> | `procedureRegistry` | VARCHAR, NOT NULL | label attr (external registry number) |
> | `procedureURL` | LINK | |
> | `businessUnitID` | FK → Business Units | form filter only |
> | `departmentID` | FK → Departments | `check: Unit IS NOT NULL`, filtered by Unit |
> | `processID` | FK → Processes | `check: Department IS NOT NULL`, filtered via the department's squads; `SelectLabel = squadName` |
> | `taskID` | FK → Tasks, NOT NULL | `check: Process IS NOT NULL`, filtered by Process (join anchor for the Tasks rollup/tab) |
> | `requirementID` | FK → Requirements, multivalued, nullable | options = the task's derived requirement set; empty = all (Q1) |
> | `taskInput` / `taskOutput` | FK → Handouts, multivalued | moved from Tasks; `handoutsForTask` filtering follows |
> | `procedureOwner` | FK → People | pending your D7 call (item A6) |
>
> Competence side: new stored `procedureID[]` (FK → Procedures, filtered by Task selected);
> `requirementID` becomes derived via `procedureID.requirementID`.
>
> **Rafael:**
> A5 - Inputs/Outputs belong to procedures only.
> A6 - Well notice. The procedure do need an owner. Implement.

> **Claude (implemented, 03/08):** round shipped per the corrected attribute sheet + A5/A6.
> Schema: Procedures table with stored FKs and the Unit → Department → Process → Task cascade,
> `procedureOwner`, Handouts Inputs/Outputs tabs; Tasks dropped `procedureName/URL` and
> `taskInput/taskOutput` (form + attrs) and expands into its Procedures; Competence stores
> `procedureID[]` (Procedure select gated on Task) and derives `requirementID` through it;
> Channels became a hidden registry (`show` + `dashboard-order: 0`); `schemaVersion` 6.
> Migration `tools/migrate_procedures.py`: one procedure per demo task (PRC01…), requirement
> set = the task's competence sets, handouts from the task's workflow inputs/outputs, owner =
> taskOwner; all 12 competences linked, legacy fields dropped. Engine: `certified-responsible`
> matches requirements **through procedures** (empty set = certifies all, Q1);
> `handoutsForTask` ownership resolves via Procedures; new `requirementsForTask` limits the
> Requirements picker to the task's derived set. Proof: `tools/test_engine_procedures.mjs` +
> full 13-suite run + validator green; App Guide (operation/talent) updated.

## Dashboard trim — Issues & Actions become hidden registries; Issues classify by Unit

Rafael's datamodel edits (03/08, working tree): Issues and Actions set to `visibility: hide` +
`dashboard-order: 0`; `Issues.businessSegmentID` renamed to `businessUnitID` (Unit select grouped
by segment — reversing the 2026-08-01 segment round); Regions moved to Organization tab 2.

> **Claude (applied, 03/08):** intent adopted; three corrections per the decisions on record —
> 1. **`visibility: "hide"` → `"show"`** (dashboard-order 0 kept): `hide` un-catalogues the
>    table — the A4/Channels lesson. Scopes.scopeOpportunity + Classes.issueID (→ Issues) and
>    Tasks.actionID + Competence.actionID (→ Actions) keep resolving; both registries create
>    inline via the "+" button (Scopes Opportunity / Tasks Action fields), the Requirement-Type
>    pattern — and the same treatment R5 (#141) will give Activities.
> 2. **Duplicate attribute merged** — the rename collided with the legacy `businessUnitID`
>    (display businessUnitTitle) still in the schema; one stored FK remains, the orphaned
>    `businessSegmentName` mirror dropped, `businessUnitTitle` kept but hidden by default.
> 3. **Data migrated** (`tools/migrate_issue_units.py`): dead `businessSegmentID` key dropped,
>    legacy multivalued `businessUnitID` normalized to the single-valued shape the form stores
>    ([] → null, first unit wins).
>
> Regions at tab 2 kept as-is — it *improves* the D10 dependency order (Business Units store
> `regionID[]`, so Regions registers first). MVP impact: both walkthrough modules lose the two
> dashboards; the registration guide now points at the inline "+" path (App Guide
> organization/operation updated). schemaVersion 7; proof `tools/test_engine_registry_trim.mjs`;
> 14 suites + validator green.
>
> **Rafael:**

## Regions — continent derives from the selected countries

Rafael's edit (03/08): the Continent input is obsolete — countries are grouped by continent, so
the continent must fill automatically from the country selection.

> **Claude (applied, 03/08):** implemented as a render-time derive (the display-only pattern on
> record): `continent` became `mirror: Countries via: countryName (display: continent)` — no
> stored copy to drift, and changing the countries updates the continents instantly. Bonus fix:
> the stored value was lossy — RG01 "Americas" said "North America" while covering Brazil and
> Colombia; it now lists "North America, South America". Migration
> `tools/migrate_region_continents.py` drops the stored key; Continent form input removed
> (Rafael's edit kept); schemaVersion 8; proof in `test_engine_branches.mjs`; App Guide updated.
>
> **Rafael:**

## Customer-branch link — authored on the Customer form

Rafael's instruction (03/08): the Branches form must not carry a Customer input — the branch is
defined when the customer is registered, in the Customer form; the data still lands on the
Branches table.

> **Claude (applied, 03/08):** Branches form dropped the Customer field; the Customers form
> gained a **Branch** multi-picker (unlocked by Unit, grouped by unit). Storage direction is
> unchanged — `Branches.customerID` stays the stored key (D1) — the save applies a cross-table
> write: `applyCustomerBranches` in `forms.js` stamps the customer's id onto the selected Branch
> rows and clears deselected ones; nothing is stored on the Customer record
> (`Customers.branchID` is a display mirror of the reverse join, so the Customers table shows the
> branches). Edit mode pre-checks the branches currently linked (cross-table prefill). No data
> migration needed — the seeded BR↔FC links already live on Branches. schemaVersion 9; proof in
> `test_engine_branches.mjs` (form shape, save-path stamp, deselect-clears); 13 suites +
> validator green; App Guide organization/crm updated.
>
> **Rafael:**

## Classes — Issue field removed

Rafael's instruction (03/08): Classes does not need an Issue — drop the field from the entity's
registration.

> **Claude (applied, 03/08):** `Classes.issueID` attribute and the form's Issue select removed —
> Classes is now the plain scope-classification registry (Name + Definition). No data migration
> (the demo carries zero Class rows) and no dependents (the only inbound reference is
> `Scopes.scopeClassID`, untouched; `Issues.scopeID` derives via `scopeOpportunity`, not via
> Classes). schemaVersion 10; test fixture and App Guide Classes section updated; 13 suites +
> validator green.
>
> **Rafael:**

## Product Groups — classify by Business Unit

Rafael's edit (03/08): the LPT/MPT/DT segment enum on Product Groups becomes a `businessUnitID`
FK; a derived segment reference stays; the Product select is gated on the chosen unit.

> **Claude (applied, 03/08):** adopted with two corrections per the conventions — the form now
> binds **`businessUnitID`** (the sketch bound `businessUnitName`; a name-bound select stores
> the name and leaves the FK empty — the #121 trap), and the Product cascade dep names the
> bound attribute (`filtered by businessUnitID selected`; the sketch's `businessUnitName` would
> match no field). The sketch's derived `businessSegmentID` (typed FK) became the mirror
> `businessSegmentName` (`mirror: Business Units via: businessUnitID`) per the parity
> convention — hidden by default, available via Customize Columns. Migration
> `tools/migrate_pg_units.py`: enum code → segment (by `businessSegmentCode`) → the unit
> carrying that segment (total and deterministic in the demo: LPT/MPT → BU01, DT → BU02; the
> legacy sourceFiles copy has two pre-normalization 'MT' rows left null, flagged).
> schemaVersion 11; proof `tools/test_engine_pg_units.mjs`; 14 suites + validator green; App
> Guide Product Groups section updated.
>
> **Rafael:**

## Skill Levels — rank moves to the competence step

Rafael's edit + doctrine (03/08): `levelRank` leaves the Skill Levels registry — the rank is the
professional's step INSIDE a level, recorded per competence: a rank-1 competence on a Junior role
is achievable by a fresh hire; rank 3 on every competence of a level signals readiness to move up
a skill level.

> **Claude (applied, 03/08):** Skill Levels dropped `levelRank` (Rafael's edit kept) and the
> orphaned `skillLevelTitle` mirror (it concatenated the dropped rank; no dependents —
> `levelName` takes over the subitem display). `Competence.levelRank` became `enum: [1, 2, 3]`
> so the Skill Rank select offers exactly 1/2/3 (it was a bare INT), with the step semantics in
> its notes; Onboarding's derived rank untouched. Migration `tools/migrate_skill_rank.py` strips
> the stored key from Skill Levels rows (both copies). The promotion automation ("flag a userID
> at rank 3 on every competence of a level") is tracked as **issue #149**. schemaVersion 12;
> 14 suites + validator green; App Guide talent updated.
>
> **Rafael:**

## Roles — multivalued Graduation; isActive dropped

Rafael's edits (03/08): `graduationID` flagged "Multivalued" (a role may accept more than one
educational background — the note he called attention to) and the `isActive` flag removed.

> **Claude (applied, 03/08):** the multivalued keyword is exactly what the engine reads — the
> Graduation select is now a checkbox multi-picker (verified in-app, with the inline "+"
> intact); the note was enriched to keep the semantics alongside the keyword. isActive attr +
> Active radio removed (every demo role was True — the flag carried no information; the only
> `isActive` consumers elsewhere are People/Requirements, untouched). Migration
> `tools/migrate_roles_grad.py` listifies the stored graduation links and drops the isActive
> keys (both copies). Side fix: `validate_mockup.py`'s rollup-coverage check met a multivalued
> child key for the first time — it now flattens list values like the engine's array-aware
> joins. schemaVersion 13; proof in `test_engine_talent.mjs`; 14 suites + validator green; App
> Guide talent updated.
>
> **Rafael:**

# Central finding

## D1 — Customers and Branches are the same real-world thing registered twice

All 17 Customers are `customerType='branch'`, and the 17 Branches mirror them one-to-one
(BR01 ↔ FC01…), yet **no FK links the two tables**. Both carry their own geography
(Customers: `city`/`country`/`regionID`; Branches: `cityName`/`countryName`/`regionID`) which can
drift silently. Aggravating: no `client`/`supplier` customer exists in the demo — the enum exists
but the external-customer path was never exercised with stakeholders.

Options, in recommended order:

1. **Link** — add `Branches.customerID` (nullable FK): a branch *is* the organisational record of
   an internal customer; geography lives in one table, the other mirrors it.
2. **Specialize** — Customers keeps only `client`/`supplier` (the commercial role); Branches owns
   internal sites. Requires migrating Forecasts/Projects references.
3. **Keep separate** — accept the duplication (not recommended; this is the drift-bug anatomy the
   whole 2026-08-01 week was spent fixing).

Question that calibrates the choice: in the stakeholder interviews, is an internal site treated as
a *customer* of another site (repair shop serving a factory)? That would justify two linked
entities over a merge.

> **Rafael:**
> To answer your question about the relationship between sites (branches): Yes, but I need to give you some pointers.
> In the CRM module, Customers is treated as the `interested parties` (ISO9001:2015 clause 4.2 item A), meaning that
> every party in the Customer entity are eligible to open a Ticket for a given Business Unit and department.
> So, as a Customer is connected to a Branch, it can open tickets to all business units connected to that branch, being able
> to select all events also related to the business units related to the branch, and so on.
> For that reason, I think that **option 1** (Link) should be the way to go here!
> >[!note] Issue Update
> > I need to correct something in my strategy. I have said in our conversation that a Customer cannot live without a branch.
> > Thats not entirely true. Off course, a Customer can be connected to one or more branches, but it does not requires a branch to
> > exist in the database. What connects the Customer with a Branch is the `Contract`.
> > This entity, Contract, have not being modeled in our datamodel. A contract will relate to the entities: Product Scopes, Branches,
> > Forecasts. Meaning that a Contract will have a list of product scopes (filtered by the business Unit of the branch selected) and
> > will have a rollup relation with Forecasts to store all the forecast scopes created pr each product scope assigned to the contract.
> > Because of that change, it make sense to keep the first enum classification for customer type: internal client, external client, supplier.

---

# A. Domain modelling — the quality loop inside the prototype's own logic

## D2 — The improvement loop does not close

The prototype captures execution *symptoms* with sophistication (Jobs: `Stoped` status,
`jobBufferExecution`, `realStartDate`/`realEndDate`, `realExecutionTime`), but nothing connects an
execution deviation back to a quality record. **Issues has no lifecycle** — no status, no owner, no
severity, no link to Events/Jobs/Actions; today it only classifies Scopes and Classes.

Cheapest upgrade honouring the existing model: give the existing table life —
`issueStatus` (enum lifecycle), `issueOwner`, a severity/priority field, and a nullable
`sourceEventID` (or `jobID`) so a quality event is born where the work already records the pain.

Open question from the interviews: did stakeholders ever ask for deviation/nonconformity
registration, or was it left out deliberately?

> **Rafael:**
> Lets first define issues.
> Issues are defined on ISO9001:2015 as "positive and negative factors or conditions for consideration"
> In the EDQMS model, I have decided to make the association between a negative issue with a `risk` and a
> positive issue with an `opportunity` (hence the issueType enum values).
> So, the register and definition of a opportunity (a positive issue) is done by managers in strategic positions, 
> using SWOT analyses on the market or whatever toll they see to be more efficient to decide the market opportunities
> to define their business strategy (segmentation, units, departments, etc).
> The `risks`, in he other hand, must come from nonconformity flow as you mentioned in your question.
> After the investigation of a nonconformity the cause can be routed to reasons connected to a class called `risk`.
> Those types of nonconformity will automaticly be elevated to an issue of the type risk in the issues table.

## D3 — Activities is vestigial

The Tasks form field labelled "Activity" binds `workflowID` — in practice the workflow step *is*
the prototype's activity. The Activities table is referenced by no stored key (its rollups —
`Processes.activities`, `Workflows.activityID` — sit at 0% coverage in the validator).
Recommendation: retire the table (or `visibility: hide`) rather than keep schema the data
contradicts; it will confuse the client mapping sessions.

> **Rafael:**
> in this topic I still need your help. But first, let me explain why I have created to separate entities (workflow and activity).
> A workflow is a process step in essence, so once we define this workflow steps, we can draw a process map.
> A workflow step is formed by the relation of an activity and a process. So, to have a workflow step I first need an activity registered.
> In my mind, if I delete the activity register (table), allowing the user to manually insert the name of the activity in the workflow registration,
> any typo will break the relations needed for further controls or queries that needs activity grouping or filtering.
> **Do you have any suggestions to safe guarding this concerns while deleting the activity table?**

> **Claude (answer, approved by Rafael 01/08):** free text is indeed the wrong ending — the fix is
> the pattern the prototype already uses for `Requirement Type`: a **hidden registry with inline
> creation**. Activities leaves the tab strip (`dashboard-order: 0` — catalogued, no dashboard to
> maintain) and the Workflows form gains an "Activity" select bound to a stored `activityID` FK,
> with the existing `withAddNew` "+" button to register a new activity without leaving the form.
> No free typing — grouping/filtering stays FK-keyed — and "workflow step = activity × process"
> finally materializes as a stored key (fixing the 0%-coverage rollups as a side effect). The
> entity survives; only the dashboard-maintenance cost is removed. → scheduled as round R5.

## D4 — Control measures resources, not quality

Capacity and Performance are resource views. The data for **quality KPIs already exists** in the
model: `realExecutionTime` vs `taskExecutionTime` (adherence), `jobBufferExecution` (stoppage),
`isCertified` per department (competence coverage), Requirements per scope/product-group
(regulatory coverage). A third "Quality" view on the existing report engine would be the most
visible return for stakeholders.

> **Rafael:**
> I have initially created the Control just to test the queries for the datamodel, but them we created the overview to do that.
> The control module should be used as the Quality module, as you suggested.
> You don't need to generate this changes now, but you can create the issues for a future implementation of this control module
> with the following functionalities:
> - Nonconformity: as explained in the D2 question.
> - KPI builder: i would like to give managers the option to define the KPIs that will be dsplayed in the Report section of each
> dashboard and in the overview. I like the way monday.com solved that feature, they have a report setup menu. If you know that reference
> feel free to elaborate while creating this issue on github

---

# B. Internal consistency

## D5 — FK attributes declared in four different types

Attributes carrying an FK rule are typed `FK` (41), `INT` (44), `email` (25 — every owner field),
`VARCHAR` (11). Harmless to the current engine, painful for MVP DDL generation. A mechanical
normalization pass (everything → `FK`) closes it.

> **Rafael:**
> Please, proceed with the normalization you suggested.

## D6 — Last remaining name-keyed join

`Tickets` derives `forecastScopeID` through `Forecast Scopes.customerName` — the same fragility
class as the Onboarding `via:` bug (PR #121). Migrate to a PK-keyed join.

> **Rafael:**
> Agreed

## D7 — Owner-convention gaps

The prototype's own convention is "every record has an accountable owner". Missing on: Issues,
Workflows, Handouts, Requirements (owner was replaced by `regulatoryURL` on 2026-07-30 — the
accountability landed nowhere), Classes, Business Segments. (Business Units and Departments carry
managers — considered covered.)

> **Rafael:**
> This prototype follows ISO9001:2015 guidelines.
> Meaning that not every entity must have an owner, just the ones that needs accountability for the
> quality system.
> I agree that Issues and Business Segments should have owners, though. you can implement ownership on
> those entities.

## D8 — Text defects

- Issues' description is a copy-paste of Scopes' ("Defines the work scope boundaries…").
- Workflows form label "Identation Rule" → "Indentation Rule".

> **Rafael:**
> For the issues description you can use the definition I gave in item D2.
> for the workflow label, you can proceed with the correction.

---

# C. Readiness for the consulting engagement (blank-mode mapping)

## D9 — No schema version anywhere (gap #1 before the first workshop)

`datamodel.json` has no `_meta`, and blank-mode snapshots export without a schema fingerprint.
With client data living in OneDrive files while `main` evolves weekly, drift detection today only
catches renamed *tables* on import. Proposal: `_meta.schemaVersion` in the datamodel (manual bump
per schema PR) + stamp in `exportSnapshot()._meta` + comparison warning on import.

> **Rafael:**
> Agreed

## D10 — Registration order as an artifact

With the NOT NULL anchors, the FK graph defines a topological registration order (Segments →
Units → Departments/Regions → Branches/Squads → People → Portfolio → Operation → …). Today it is
implicit — the scribe discovers it by hitting gated selects. Proposal: a setup checklist
generated from the datamodel itself (or an Overview "start here" page) turning the constraint
into guidance for the workshops.

> **Rafael:**
> I loved the Overview "start here" page suggestion.
> But I would like to do that on a Mkdocs github page, with more details about how each entity and dashboard exists.
> Than, we could create a link for each module and dashboard redirecting the user to this mkdocs documentation,
> so the user can have a better Ideia on what to do on each element.
> please, implement a first draft of that mkdocs page for me to guide you on further improvements.

## D11 — Derivation scale (MVP note, not prototype work)

The 5-key Requirements chains and compound joins are recomputed per render — perfect at demo
scale (~1.5k records), O(n·m) at real scale. Recorded here as an input to the MVP architecture
decision; no prototype action.

> **Rafael:**
> Agreed

---

# D. Priorities proposed

## D12 — Sequencing

1. **Pre-engagement:** D9 (schemaVersion), D1 decision (minimum: the FK link), D10 (setup
   checklist).
2. **High value, low cost:** D2 (Issues lifecycle), D4 (Quality view), D8 (texts).
3. **Hygiene:** D5 (types), D6 (name-keyed join), D7 (owners), D3 (retire Activities).

> **Rafael:**
> Please, consider my notes first, thn present me with an updated plan if needed.
