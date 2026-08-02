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

---

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
