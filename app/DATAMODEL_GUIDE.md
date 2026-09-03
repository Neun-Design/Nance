# EDQMS `datamodel.json` — Rendering Guide

> **Purpose.** `prototype/data/datamodel.json` is the canonical UI specification for the
> Division Governance Portal prototype. Every dashboard, table, card, report, drawer form,
> filter and subitem list must be **derived from this file** — a screen is correct only if
> it can be traced back to a parameter documented here.
>
> **Status.** The datamodel engine (`js/model.js` + `js/resolve.js`) now derives every
> screen from this file at runtime; the hand-coded registry is retired. Any change to
> the engine (or to this file) must keep `tools/test_resolve.mjs` and
> `tools/test_queries.mjs` green — they assert the behaviours documented below against
> the mockup dataset. Companion documents: `PROTOTYPE_REVIEW.md` /
> `prototype_v1-review.md` (change backlogs) and the `#wireframe` reference
> (`sourceFiles/developer/standalone_wireframe.html`) for interaction patterns.

---

## 1. Top-level structure

```json
{
  "modules": {
    "<Module name>": {
      "sidebar-position": 1,
      "tables": {
        "<Table name>": { …table spec… }
      }
    }
  }
}
```

| Level | Meaning in the UI |
|---|---|
| **module** (`Organization`, `Portfolio`, `CRM`, `Talent`, `Operation`, `Workspace`, `Control`) | One entry in the **sidebar**. Selecting it shows the module's dashboards. Its `sidebar-position` sets the order — see §2.1. |
| **table** | One **tab (dashboard)** inside the module. The tab renders, top to bottom: cards → data table (with controls) → reports. |

The fixed **Overview** entry always sits at the top of the sidebar; `sidebar-position`
orders the modules listed beneath it.

The **Overview** dashboard is *not* a module: it is assembled automatically from every
card and report across all modules whose `overview-display` parameter is `true`
(see §7).

---

## 2. Module-level keys

Each module entry carries `tables` (§2.1) plus an ordering hint:

| Key | Type | Drives |
|---|---|---|
| `sidebar-position` | int | The module's rank in the **sidebar**, ascending (`1` = first module under Overview). The engine (`model.js`) sorts modules by this value; ties and modules without the key fall back to their order in the file. Because the engine sorts once and every module index derives from the sorted list, the active-tab highlight stays in sync — no other change is needed to reorder the sidebar. |
| `tables` | object | The module's dashboards — see §2.1. |

### 2.1 Table-level keys

Every table spec carries these keys:

| Key | Type | Drives |
|---|---|---|
| `visibility` | `"show"` | Whether the tab is rendered at all. Only `"show"` exists today; any other value must hide the tab without deleting the spec. |
| `description` | string | Human/ISO context for the entity (often cites the ISO 9001 clause). Surface as the tab subtitle and/or a ⓘ tooltip on the tab title. Not data-bearing. |
| `attributes` | array | Column & field catalogue — see §3. |
| `cards` | array \| `null` | KPI cards above the table — see §4. `null` = this dashboard has no cards. |
| `reports` | object \| `null` | Charts below the table — see §5. |
| `form` | object \| `null` | The "New Item"/"Edit" drawer — see §6. |
| `table-filters` | bool \| `[]` \| `null` | Whether the table's **Filters** button is enabled — see §8. |
| `subitem-tables` | array (optional) | Expandable child tables per row — see §9. Absent ⇒ rows don't expand. |

---

## 3. `attributes` — the column & field catalogue

Each attribute is one column/field of the entity:

```json
{
  "name": "projectID",
  "type": "INT",
  "rule": "FK → Projects (display: projectRegistryID)",
  "notes": null,
  "table-display": true,
  "subitem-display": true,
  "constraints": "FK"
}
```

### 3.1 `name`
The canonical camelCase field name. It is the join key to mockup rows
(`mockup_data_prototype.json`) and the `attribute` binding used by form fields (§6.2).

### 3.2 `type`
Declares both storage shape and rendering behaviour:

| `type` | Rendering behaviour |
|---|---|
| `INT`, `DECIMAL`, `decimal` | Numeric column: right-aligned, **included in the table's Σ summation row**. |
| `VARCHAR`, `TEXT` | Plain text. |
| `ENUM` | Fixed value set (see `rule`, e.g. `enum: LPT/MT/DT`). Render as a status **pill** where the values represent states, and as a `select` in forms/filters. |
| `BOOLEAN` | Yes/No — render as check/pill; `switch` in forms. |
| `DATE`, `DATETIME` | ISO dates; date-pickers in forms, range-pickers in filters. |
| `email` | A person reference — every `*Owner` attribute uses this; resolves to People (`userName`). |
| `LINK` | Clickable URL (e.g. `procedureURL`). |
| `rollup` | **Derived, not stored.** Aggregates child records via the `rule` (e.g. `rollup → Forecasts (via: customerID)`). Computed at render time; read-only in forms ("Auto-calculated on save"). |
| `computed` | Derived scalar via the `rule`'s expression/path chain. Read-only, same treatment as `rollup`. |

### 3.3 `rule`
A mini-DSL declaring where values come from. Grammar patterns in use:

| Pattern | Meaning |
|---|---|
| `FK → <Table> (display: <field>)` | Foreign key. Store the target PK, **display the named field** (never the raw ID) in tables, subitems, and selects. `display: CONCAT(a,'-',b)` composes several fields (Forecasts CUSTOMER = `customerName-city`); parts may be computed on the target (Requirements PG = `productName \| specsSummary`). |
| `FK → <Table> (via: <field>)` | Name-valued FK: the select stores `<field>`'s value instead of the pk (legacy Tickets rows store customer names this way). |
| `FK: <Table> (filtered by f='v')` | **Filtered FK** (2026-07-29): option lists and joins only consider target records where `f = v` — `Scopes.scopeOpportunity → Issues` filtered to `issueType='Opportunity'`. |
| `rollup → <Table> (via: <field>)` | Collect the related rows of `<Table>` — see the join ladder below. The colon after `via` is optional. |
| `rollup → <Table> (via: a + b [+ c])` | **Compound key** (AND semantics): children must match the parent on every listed field that their data actually stores; either side may hold arrays (Forecast Scopes.requirementID = requirements whose applicability keys contain the line's chain values). Unstored fields are skipped (§10: data wins). Entries may be **dotted paths** (`productScopeID.scopeID`) — the parent traverses the path, the child matches on the last segment. A child storing an applicability key **empty** (`[]`/null) matches every parent: a Requirement without `customerID` applies to all customers (decision Q1). (Product Scopes.requirementID carried this rule until issue #288 and was retired by #294 — the stored link lives on `Requirements.productScopeID` now; the visible set is `PS-REQUIREMENTS` below.) |
| `mirror: <source>` | Value mirrored from related records, e.g. `mirror: DISTINCT("Tasks"."actionName")` or `mirror: Competence (via: competenceID) (display: roleName)`. |
| `computed: <expression>` | Calculated value, e.g. `computed: SUM(forecastScopes.estimatedHours)`. |
| `computed → <Table> (via: <path.chain>)` | Calculated by walking a relationship path (dots = hops through stored FKs), then displaying the final ids against the last segment's domain — `Tasks.scopeID = computed: Workflows via: workflowID.productScopeID.scopeID (display: scopeName)`. |
| `computed: CERTIFIED-USERS(<taskField>) (display: userName)` | **Certified eligible people** (issue #214, Tasks.userID): People holding a CERTIFIED Onboarding (`isCertified`) on a task-compatible competence (no `taskID` on the competence = generic; with one it must name the task), whose **combined** competences cover **ALL** the requirements the task derives from its procedures (union of the requirement sets; a wildcard procedure covers everything — the Jobs `certified-responsible` doctrine as a derived column). Resolved live by `certifiedUsersForTask` in `resolve.js`. **Ticket context (issue #233):** rendered inside a Ticket's Tasks tab, coverage must ALSO span the ticket's live inherited requirement set — the subitem accessor passes `ticketRequirements(ticket)` as extra ids (`mapSubitem` in `app.js`; the subitem render pipeline threads the parent row to cell accessors). The standalone Tasks dashboard stays task-level. |
| `computed: INHERITED-REQUIREMENTS(<eventField>) (display: requirementName)` | **Live requirements inheritance** (issue #226, Tickets.requirementName — replaces the #192 stored snapshot): the Active requirements AND-matched against the ticket's admitted payload chain — event → payloads under the customer's ACTIVE SLAs (lenient `productScopesForTicket` posture) → product scopes (∩ the ticket's `productScopeID` when set) — plus the ticket's unit, that unit's served regions (`Business Units.regionID`) and the ticket's customer. Requirement keys left empty apply to all (Q1); Inactive requirements never inherit. Resolved live by `ticketRequirements` in `resolve.js` — a new aligned requirement surfaces on existing tickets with no re-seed. |
| `computed: PS-REQUIREMENTS(<inverseField>) (display: requirementName)` | **Comprehensive product-scope requirement set** (issue #288, legs inverted by #294, unit leg removed by #296 — Product Scopes.productScopeRequirements): the requirements **NAMING** the row (`Requirements.productScopeID`, the stored link declared on the REQUIREMENT — `<inverseField>` names that key; the form picker shows the `productScopeRegistry` code) ∪ those EXPLICITLY connected to the row's scope ∪ its product group — **three connection legs only**: a requirement sharing the row's `businessUnitID`/`regionID` does NOT attach through those dimensions (unit/region act purely as exclusion gates on the derived legs; unit-wide inheritance lives on the ticket/forecast chains under Q1). Still **no Q1 wildcard here**: a requirement with ALL keys blank attaches nowhere (the ticket chain above keeps Q1 and gains the `productScopeID` dimension under it — empty = all, non-empty = only the named product scopes; the Forecast Scopes compound chain carries the same leg). Derived legs skip Inactive requirements; a declared (named) link renders even Inactive — stored data wins, the pickers gate lifecycle. Resolved live by `productScopeRequirementRows` in `resolve.js`; feeds the REQUIREMENTS column, the Product Scopes → Requirements subitem tab (resolve overridden in `mapSubitem`, the #280 pattern — the via attr is never stored) and the Procedures Requirements picker (`requirementsForProductScopes`). |
| `computed: STEPORDER(<parentField>, <ruleField>) per <groupField>` | **Derived step outline number** (identation-rule.md, Workflows.indentationID): numbers the rows sharing `<groupField>` (one process) by the `<parentField>` chain — sequential rules (`start-to-finish`, `finish-to-start`, or none) take the next major number, parallel rules (`finish-to-finish`, `start-to-start`) sub-number under the parent (`1`, `2`, `2.1`, `3`…). Never stored; `stepOrderMap` in `resolve.js`. |
| `computed: TASKORDER(<predField>, <stepField>)` | **Derived task outline number** (issue #302, Tasks.taskIndentationID): the workflow step's STEPORDER indentation is the base, **padded to two segments** when it is a single major number (`1` → `1.0` — the planned Gantt webhook consumers need a fixed depth), and the task's sequence within the SAME step appends as the last segment (`1.0.1`, `1.1.2`, `2.0.1`). Tasks carry no constrain/indentationRule dimension — every `<predField>` link is start-to-finish (sequential), so the per-step chain numbers `1, 2, 3…`; a predecessor in ANOTHER step counts as no parent (the counter restarts per step — the issue's T04). Never stored; `taskOrderValue` in `resolve.js`. Every Tasks subitem context (`Workflows`, the Tickets Tasks tab) declares `ordered by taskIndentationID`. |
| `enum: A/B/C` | The closed value list for an `ENUM` type. Bracket-quoted (`enum: ['A', 'B']`) and comma spellings parse alike — also in inline field-rule overrides (`optionsForAttr` delegates to `parseRule`). |

> **Competence doctrine (issue #231, reverting the #226 union):** a requirement NEVER
> enters a competence automatically. The quality manager binds requirements to the
> **Procedure** (its Requirements picker offers only **Active**, context-aligned options),
> and the competence — 1:1 with its certified procedure since #231 — inherits the
> procedure's set (`computed → Procedures (via: procedureID)`, `competenceRequirements`
> in `resolve.js`). Tickets keep the live INHERITED-REQUIREMENTS chain above.

**Tolerant parsing.** The rules are hand-written prose in many spellings; the parser
(`model.js parseRule`) extracts *kind / target / via / display* rather than demanding
one canonical shape. `->` and `→` are equivalent, `via:`/`display:` may appear with or
without parentheses, `DISTINCT("T"."f")` names both target and display, and unparseable
prose degrades gracefully (the stored value is shown).

**Display resolution.** Reference and derived cells always show display **names**,
never raw ids:

1. A **stored** id (or id array) resolves against the rule target, else against the
   table whose PK shares the attribute name (`processID` → Processes). Values that
   match no record pass through unchanged (they are already names).
2. A **derived** cell resolves its child rows, then shows the distinct display values —
   using the rule's `display:` field, or the attribute's own name when the child can
   answer it (`requirementName`). Rollups with no display field render as a **count**.
3. Child rows resolve through a join ladder, tried in order: declared through-path
   (`rollup via Tasks.activityID`) → declared `via:` field (child FK, else shared-field
   join) → direct child FK → shared-domain join → **two-hop join** through an
   intermediate table (Tasks → Workflows.requirements → Requirements) → **reverse derived
   join** (invert a rollup declared on the child, incl. compound-via rollups).
4. Every join candidate is **data-validated**: the two sides must actually share values
   in `mockup_data_prototype.json`, so catalogue/dataset drift (§10) cannot produce
   silent empty joins.

### 3.4 `notes`
Free-text intent for developers ("Total demand projected across all scopes"). Use it for
tooltips on column headers where present. Not machine-actionable.

### 3.5 `table-display`
`true` ⇒ the attribute is a **default visible column of the main table**.
`false` ⇒ hidden by default, but must still be offered in the **Customize Columns**
popover so users can opt in. PKs and plumbing FKs are typically `false`.

### 3.6 `subitem-display`
`true` ⇒ this attribute appears as a **column of the subitem (child) table** when this
entity is rendered *as someone else's subitem* (§9). This is how the child table stays
compact: only `subitem-display: true` columns are shown in the expanded dropdown,
regardless of the child's own `table-display` settings.

### 3.7 `constraints`
`PK` (exactly one per table), `FK`, or `null`. `PK` columns are auto-generated in forms
(read-only "auto" field). `FK` requires the `rule` to name its target.

---

## 4. `cards` — KPI cards above the table

```json
"cards": [
  {
    "Card 1-1": {
      "title": "Recurrent tasks across Processes",
      "card-rules": {
        "main-data": "Top 3 tasks that appear in multiple processes",
        "trend-data": null,
        "detail-data": "this card must be a list with two columns: taskID | process count"
      },
      "card-component": "shadcn-card",
      "card-tooltip": "Most recurring tasks across the process landscape…",
      "overview-display": true
    }
  }
]
```

| Parameter | Meaning |
|---|---|
| **slot key** `"Card R-C"` | Grid position: `R` = row, `C` = column (`Card 1-2` = first row, second column). Lay cards out on a grid honouring these coordinates. *(Case-insensitive: `card 1-1` occurs in the data.)* |
| `title` | Label displayed above the main value. |
| `card-rules.main-data` | **What the highlighted value is** — a computation described in prose (count, top-N list, percentage…). This is the card's query specification. |
| `card-rules.trend-data` | Direction indicator: rising ⇒ up-arrow with **green** number, falling ⇒ down-arrow with **red** number, positioned **before** the main-data. `null` ⇒ no trend element. |
| `card-rules.detail-data` | Secondary line **below** the main value in reduced font (may itself specify a mini-layout, e.g. a two-column list). `null` ⇒ omit. |
| `card-component` | Component reference — `shadcn-card` (case varies) per the project design system (`#design-system`). |
| `card-tooltip` | Hover explanation of what the card measures. |
| `overview-display` | `true` ⇒ this card is **also rendered on the Overview dashboard** (§7). Absent/`null` ⇒ module-only. |

`"cards": null` means the dashboard intentionally has no cards.

---

## 5. `reports` — charts below the table

```json
"reports": {
  "Report-A": {
    "overview-display": true,
    "graph_type": "bar chart - multiple",
    "rule": "availableHours vs. allocatedHours side by side grouped by customerName. Y = hours, X = customerName",
    "filters": {
      "fields": {
        "periodFrame": {
          "field-type": { "range-picker": "shadcn-Date Picker" },
          "tooltip": null,
          "default": "last six months from current date",
          "check": null,
          "field-rule": null
        },
        "customerName": {
          "field-type": { "combobox": "shadcn-combobox" },
          "tooltip": null,
          "default": "ALL",
          "check": null,
          "field-rule": "FK -> Customers (display: customerName): Multivalued field"
        }
      }
    }
  }
}
```

| Parameter | Meaning |
|---|---|
| **key** `Report-A`, `Report-B`, … | One chart panel each, rendered in key order. The letter is the report's identity (PROTOTYPE_REVIEW.md refers to "report A" this way). |
| `graph_type` | Chart family in prose: `bar chart`, `bar chart - multiple` (grouped series), `donut`, `line`, … Choose the design-system/shadcn chart that best matches; where no component is named, pick the closest fit (per PROTOTYPE_REVIEW.md Reports note). |
| `rule` | **The query specification in prose**: measure(s), grouping, and axis mapping ("Y = hours, X = customerName"). Implementations must satisfy the rule against the mockup dataset — this is what report tests should assert. |
| `filters.fields` | The report's own filter set. Each entry follows the **form-field grammar** (§6.2) plus a `default` (initial state — e.g. `"ALL"` or `"last six months from current date"`). Render per the wireframe pattern: a **filter button on the report `<div>`** opening a right-side drawer with these inputs and a **Reset** button inside the drawer. Each report has its *own* filter button. |
| `overview-display` | `true` ⇒ the chart also appears on the Overview dashboard (§7). |

`"reports": null` ⇒ no charts on this dashboard (e.g. Forecasts, per the review backlog).

---

## 6. `form` — the New Item / Edit drawer

```json
"form": {
  "steps": { "<STEP TITLE>": { "step-description": "…", "step-order": 1 } },
  "fields": { "<Field label>": { …field spec… } },
  "subitem-tables": ["Jobs"]
}
```

Forms open in a **right-side drawer** (wireframe pattern). `form: null` or a free-text
placeholder (e.g. `["see #wireframe"]`) means the form isn't specified yet — fall back
to the wireframe.

### 6.1 `steps`
Named sections that partition the form vertically. `step-order` gives the sequence,
`step-description` the helper text under the section heading. Fields opt into a step via
their `step` parameter. `steps: null` ⇒ single flat form.

### 6.2 `fields` — the field grammar

```json
"Product Group": {
  "field-type": { "Select": "shadcn-select" },
  "attribute": "productGroupID",
  "tooltip": null,
  "step": null,
  "check": "Scope IS NOT NULL",
  "field-rule": "filtered by Scope selected"
}
```

| Parameter | Meaning |
|---|---|
| **key** | The visible field label. |
| `field-type` | `{ "<component>": "<source>" }` — the **key** is the UI component, the **value** is where it comes from: `html` (native input, e.g. `{"month":"html"}`) or a design-system reference (`shadcn-input`, `shadcn-select`, `shadcn-combobox`, `shadcn-date picker`, `shadcn-switch`, `shadcn-Textarea`, `shadcn-radio button`, `shadcn-comboboxGroups` for grouped options…). |
| `attribute` | **Binding to §3**: which attribute `name` this field writes. The attribute's `type`/`rule` determine value handling (FK ⇒ options come from the target table, displayed by the `display:` field). |
| `tooltip` | Hover/inline hint on the control. |
| `step` | Which §6.1 step the field belongs to. |
| `check` | **Enable/visibility condition** in prose — the field is disabled (or hidden) until the condition holds, e.g. `"Scope IS NOT NULL"` (presence, `A && B` allowed), `"Input Type = Choice\|List"` (equality; `\|` separates accepted values), `"Disable this field until the Ticket field has been selected"`. This is how cascading forms are declared. |
| `field-rule` | **Data behaviour**: how to populate/filter/derive the field's options or value — e.g. `"filtered by Scope selected"` (cascade), `rollup -> …` chains, `FK -> Events (display: eventName): Multivalued field`. `Multivalued field` ⇒ multi-select. |

**Select options** derive from the bound attribute's rule (§3.3): labels are display
names (never ids), values are what the parent rows actually store — the target PK, or
the name itself for label-named attributes stored as names (`requirementName`). An
attribute whose `notes` contain `multivalued` renders as a multi-select even without a
`field-rule` marker. A select bound to a **`BOOLEAN`** attribute renders **fixed Yes/No
options** and commits a real boolean (issue #218 — `BOOLEAN_OPTIONS`/`booleanFromSelect`
in `forms.js`): the distinct-from-data fallback offers nothing on a blank dataset, and a
string `"true"` would never pass the strict certified gates (`isCertified === true`).
A boolean field-rule may carry **`default: Yes|No`** (issue #220, Customers.Active):
the option is preselected on NEW records only — edit prefill overwrites it with the
stored value, and fields without the rule keep starting at the placeholder.
A select field-rule may carry **`only Active`** (issue #288, the Product Scopes
Requirements picker): options whose target record is soft-deleted are dropped —
`isActive` spelled as the ENUM `Active|Inactive` or the #218 boolean, blank counting
as Active (#222 posture). `SelectLabel = <field>` accepts `=` or `==` (authored specs
use both — the Product Scopes Business Unit field arrived as `SelectLabel ==`).
(The #290 unit-exclusive Requirements picker on Product Scopes was RETIRED by #294 —
the link inverted: the Requirements form carries a multivalued **Product Scope**
picker instead, items showing the plain `productScopeRegistry` code (#296; no
grouping), unit-filtered by the generic stored-key cascade. `only Active` remains
an available spelling for any select.)

**2026-07-29 Organization/CRM constructs.** `field-type {"readonly": …}` renders a
read-only input whose value is **derived live** from the sibling controls through the
attribute's rule and never stored (Customers.Segment auto-fills from the chosen
Business Unit — decision Q4). Cascades whose option records don't store the dependency
key fall back to a **join-engine membership** test (Squads.Owner lists the chosen
Department's People through the shared business-unit domain). Three chains are bespoke
controls rather than generic joins: the Jobs **Responsible** select
(`certified-responsible`: Onboarding-certified people matching the ticket's
scope/product-group/requirements), the Jobs **Task** select (`tasksForJob`: tasks
whose workflow matches the ticket's customer + product group + scope, empty workflow
keys meaning "applies to all" — Q1), and the Tickets **Product Scope** select
(`productScopesForTicket`, issue #214: the scopes packaged by the selected event's
payloads narrowed to the payloads purchased by the customer's active SLAs; a payload
with an empty scope list widens to the event's full applicability, no SLA = every
payload of the event — lenient).

**Selection fields that reference another table** offer a **"+" (create new item)
button** beside the select: it pushes a nested drawer tab for the referenced table onto
the spine; on save the select refreshes its options and picks the new record
(wireframe pattern — implemented for every rollup select, spec-driven and generic).

### 6.3 `form.subitem-tables`
Related child tables to expose **inside the form** as "New \<child\>" sections (e.g.
Roles offers Competence; the Tickets → Jobs launcher was retired in issue #214). String
entries only — the tabbed object form belongs to the dashboard-level §9 key. Same
resolution rules as §9, but rendered as nested-form launchers rather than dropdown
tables.

---

## 7. `overview-display` — assembling the Overview dashboard

The Overview dashboard is a *compilation*: iterate every module → table → cards/reports
and pull in each item with `"overview-display": true`.

Rules (from PROTOTYPE_REVIEW.md):

1. Each pulled-in card/chart renders exactly like it does on its home dashboard, plus a
   **Details** button linking to the source dashboard.
2. **Report filters are disabled on Overview** — the Details button is the path to
   filtering at the source.
3. Items without the parameter (or `null`) stay module-only.

Current `true` inventory — cards: Tickets `Card 1-1`, Capacity `Card 1-1`, Performance
`Card 1-2`, Skill Levels `Card 1-1`; reports: Forecasts A, Forecast Scopes B, Tasks B,
Jobs A, Capacity A, Performance A, Roles A.

---

## 8. `table-filters` — the table's Filters button

Declared per table; drives the table **Filters** control — a **Microsoft Lists-style
right-side drawer** (wireframe pattern): one collapsible section per *visible* column,
each a checkbox list of the column's distinct display values with counts. Checks OR
together within a column and AND across columns; a live "N of M records match" bar and
a **Clear all** / **Done** footer complete the drawer. Values resolve through the
column accessor, so FK columns filter by display name.

| Value | Meaning |
|---|---|
| `true` | Filters enabled — sections are derived automatically from the visible columns (2–25 distinct values). |
| `[]` (empty list) | Reserved for an explicit filter list; empty today ⇒ treat as **disabled** until populated (Product Class, Competence). |
| `null` | No table filters (Capacity, Performance — their filtering lives on the *reports*, §5). Button disabled. |

> Note: the table filter predicate applies to the **table rows only**. Report and card
> queries pull their own rows and are never affected by it; report-level filters (§5)
> are configured independently.

---

## 9. `subitem-tables` — expandable child rows

```json
"subitem-tables": ["Workflows: ordered by identationID"]
```

When a table declares `subitem-tables`, **every row gets a dropdown arrow** (chevron).
Expanding it reveals one child table *per listed entry*, filtered to the children of
that row (matched through the FK/rollup relationship between the two entities).

**Column selection:** the child table's columns are the child entity's attributes with
`subitem-display: true` (§3.6) — *not* its `table-display` set.

**Entry syntax:**

| Syntax | Meaning | Example |
|---|---|---|
| `"Forecast Scopes"` | Plain child table, joined via the obvious FK (or the §3.3 join ladder when no direct FK exists — incl. the reverse derived join: Requirements → Product Scopes). | Forecasts → their Forecast Scopes |
| `"Workflows: ordered by identationID"` | `:` suffix adds a **directive** — here a sort order (WBS-style `1, 2, 2.1, 2.2…`). | Processes → Workflows |
| `"Actions: rollup via Tasks.activityID"` | Directive declaring the **join path** when it isn't a direct FK (Actions relate to Activities through Tasks). | Activities → Actions |
| `"Jobs: only jobStatus=Active\|Queued"` | **Status-filtered children** — only rows whose field matches one of the `\|`-separated values. | (the Tickets → Jobs reference retired in issue #214 — Tickets now expand into Processes/Tasks tabs `(via: processID)`; the spelling stays engine-supported) |
| `"Forecasts: display status=Approved only"` | Same filter, review spelling. | Customers → Approved Forecasts |
| `"Scopes (via: scopeID)"` | The join field named inline (parenthetical directive). | Product Scopes → Scopes |
| `"Handouts (grouped by inputs)"` | Children named by a **through-table field** (Tasks → Workflows.inputs → Handouts). Each group renders as its **own labelled list** — declaring both `inputs` and `outputs` yields "Handouts - Inputs" and "Handouts - Outputs" under one expanded row. | Tasks → Handouts |
| `"Product Specs (map: specValues)"` | Children synthesize from the **parent row's object map** `{ childId: value }`: one row per entry, joined to the child table, with the value rendered in an extra **Values** column (`__mapValue`). Missing child records keep the raw id. | Product Groups → Product Specs (issue #161) |
| `"Product Scopes -> Competence"` | **Nesting**: the subitem table has its own subitem table — Product Scopes rows expand again into Competence. Arbitrary depth follows the same rules recursively. | Tasks → Product Scopes → Competence |
| `[]` | Explicitly no subitems. Same effect as omitting the key. |
| Lowercase names (`"tickets"`, `"people"`, `"competence"`) | Match tables **case-insensitively** (fuzzy singular/plural too: `"Onboards"` → Onboarding). |

Grouped subitems: a list with multiple string entries renders **multiple stacked child
groups** under one expanded row. Tables with 2+ child lists normally use the **tabbed
object form** below instead (Squads and Tasks are the references).

**Tabbed subitem groups (object entries):** an entry may also be an object —

```json
"subitem-tables": [
  { "tab-order": 1, "rule": null, "tab-name": "people",    "tab-table": "People" },
  { "tab-order": 2, "rule": null, "tab-name": "processes", "tab-table": "Processes" }
]
```

When **every** entry of a table is an object and there are 2+ of them, the expanded row
renders a **tab strip** instead of stacked lists: one tab per child table (humanized
`tab-name` + record-count badge, ordered by `tab-order`), with the active tab's child
table below it (Squads → People / Processes and Tasks → Handouts Inputs / Outputs are
the references). `rule` accepts exactly the same directive text a string entry would
carry after `:` (`"ordered by …"`, `"only f=v"`, `"rollup via T.f"`) or in parens
(`"(via: f)"`, `"(grouped by f)"`); `null` means the plain FK join. A mixed
string/object list keeps the stacked layout — the objects then behave like their
equivalent string entries.

---

## 10. Known data quirks (fix upstream, don't code around silently)

> Resolved 2026-07-19 (`data/fix-datamodel-quirks`): stray `overview-display` keys
> (Roles.reports, Skill Levels.cards) relocated into their Report/Card entries; slot-key
> and `card-component` casing normalized; `enum: LPT/MT/DT` → `LPT/MPT/DT`;
> `decimal` → `DECIMAL`. Remaining by design:

| Quirk | Location | Correct interpretation |
|---|---|---|
| `form` sometimes holds prose placeholders (`["see #wireframe"]`, `["keep the way it is in the #wireframe"]`) | Products | Follow the wireframe until a structured form spec lands. (Squads gained a structured spec in the 2026-07-29 Organization restructure.) |
| Lowercase table names in `subitem-tables` (`"tickets"`, `"people"`) | several | Match case-insensitively (§9). |
| ~~Catalogue field names drift from the dataset (`Workflows.constrains` vs data `constraints`)~~ | Workflows | **Resolved 2026-07-28** (`tools/migrate_requirements.py`): both sides renamed to `requirements`. |
| ~~`Constrain`/`constraint` naming mixed across entities~~ | ex-Constraints | **Resolved 2026-07-28**: the whole family is now `requirement*` (`requirementID`, `requirementTypeID`, `requirementName`); the entity is Portfolio → Requirements, typed by the hidden Requirement Type table (dashboard-order 0). |
| `Skill Levels` catalogue declares `skillLevelTitle` but the data stores `levelName` | Skill Levels | Displays that need the level name point at `levelName` (e.g. Competence.skillLevelID); fix upstream when touching the datamodel. |

---

## 11. Renderer checklist (what consumes what)

| UI element | Parameters consumed |
|---|---|
| Sidebar | module names, `sidebar-position` (ordering) |
| Tab (dashboard) | table name, `visibility`, `description` |
| KPI cards | `cards` (slot grid, title, card-rules, component, tooltip) |
| Data table columns | `attributes` → `table-display`, `type` (alignment/pills/Σ), `rule` (FK display fields) |
| Customize Columns popover | all `attributes` (checked = `table-display: true`) |
| Σ summation row | `attributes` with numeric `type` |
| Filters button + drawer | `table-filters` + visible columns (§8, Microsoft Lists style) |
| Row dropdown / child tables | `subitem-tables` + child's `subitem-display` attributes |
| New Item / Edit drawer | `form.steps`, `form.fields` (`field-type`, `attribute`, `check`, `field-rule`), `form.subitem-tables`, attribute `notes: multivalued`, "+" create-new on rollup selects |
| Charts | `reports` (`graph_type`, `rule`) |
| Per-report filter drawers | `reports.*.filters.fields` (+ `default`) |
| Overview dashboard | every card/report with `overview-display: true`, + Details buttons |
