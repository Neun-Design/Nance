# EDQMS `datamodel.json` — Rendering Guide

> **Purpose.** `prototype/data/datamodel.json` is the canonical UI specification for the
> Global Engineering Portal prototype. Every dashboard, table, card, report, drawer form,
> filter and subitem list must be **derived from this file** — a screen is correct only if
> it can be traced back to a parameter documented here.
>
> **Current gap.** The running prototype still draws its screens from a hand-coded
> `js/registry.js`. This guide is the contract for closing that gap: any renderer (or
> manual registry update) must interpret the parameters exactly as described below.
> Companion documents: `PROTOTYPE_REVIEW.md` (change backlog) and the `#wireframe`
> reference for interaction patterns.

---

## 1. Top-level structure

```json
{
  "modules": {
    "<Module name>": {
      "tables": {
        "<Table name>": { …table spec… }
      }
    }
  }
}
```

| Level | Meaning in the UI |
|---|---|
| **module** (`Customers`, `Operation`, `Inventory`, `Workload`, `Control`, `Talent`) | One entry in the **sidebar**. Selecting it shows the module's dashboards. |
| **table** | One **tab (dashboard)** inside the module. The tab renders, top to bottom: cards → data table (with controls) → reports. |

The **Overview** dashboard is *not* a module: it is assembled automatically from every
card and report across all modules whose `overview-display` parameter is `true`
(see §7).

---

## 2. Table-level keys

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
| `rollup` | **Derived, not stored.** Aggregates child records via the `rule` (e.g. `rollup → Forecasts (via: factoryID)`). Computed at render time; read-only in forms ("Auto-calculated on save"). |
| `computed` | Derived scalar via the `rule`'s expression/path chain. Read-only, same treatment as `rollup`. |

### 3.3 `rule`
A mini-DSL declaring where values come from. Grammar patterns in use:

| Pattern | Meaning |
|---|---|
| `FK → <Table> (display: <field>)` | Foreign key. Store the target PK, **display the named field** (never the raw ID) in tables, subitems, and selects. |
| `rollup → <Table> (via: <fkField>)` | Collect all child rows of `<Table>` whose `<fkField>` points at this record. |
| `computed: <expression>` | Calculated value, e.g. `computed: SUM(forecastScopes.estimatedHours)`. |
| `computed → <Table> (via: <path.chain>)` | Calculated by walking a relationship path (dots = hops through FKs). |
| `enum: A/B/C` | The closed value list for an `ENUM` type. |

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
    "rule": "availableHours vs. allocatedHours side by side grouped by factoryName. Y = hours, X = FactoryNames",
    "filters": {
      "fields": {
        "periodFrame": {
          "field-type": { "range-picker": "shadcn-Date Picker" },
          "tooltip": null,
          "default": "last six months from current date",
          "check": null,
          "field-rule": null
        },
        "factoryName": {
          "field-type": { "combobox": "shadcn-combobox" },
          "tooltip": null,
          "default": "ALL",
          "check": null,
          "field-rule": "FK -> Factories (display: factoryName): Multivalued field"
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
| `rule` | **The query specification in prose**: measure(s), grouping, and axis mapping ("Y = hours, X = FactoryNames"). Implementations must satisfy the rule against the mockup dataset — this is what report tests should assert. |
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
| `check` | **Enable/visibility condition** in prose — the field is disabled (or hidden) until the condition holds, e.g. `"Scope IS NOT NULL"`, `"Disable this field until the Ticket field has been selected"`. This is how cascading forms are declared. |
| `field-rule` | **Data behaviour**: how to populate/filter/derive the field's options or value — e.g. `"filtered by Scope selected"` (cascade), `rollup -> …` chains, `FK -> Events (display: eventName): Multivalued field`. `Multivalued field` ⇒ multi-select. |

**Selection fields that reference another table** (`select` / `combobox` /
multi-selection / search types whose `attribute` is an FK) must offer an
**"add new '\<field-name\>'" button** that pushes a nested drawer tab for creating the
referenced record inline (wireframe pattern; already implemented as the drawer spine).

### 6.3 `form.subitem-tables`
Related child tables to expose **inside the form** as "New \<child\>" sections (e.g. the
Tickets form offers Jobs creation; Roles offers Competence). Same resolution rules as
§9, but rendered as nested-form launchers rather than dropdown tables.

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
`card 1-2`; reports: Forecasts A, Forecast Scopes B, Tasks B, Jobs A, Capacity A,
Performance A.

---

## 8. `table-filters` — the table's Filters button

Declared per table; interacts with the table **Filters** control (right-side drawer,
Reset inside — wireframe pattern):

| Value | Meaning |
|---|---|
| `true` | Filters enabled. Filterable columns follow from the attributes (ENUM/FK/date columns are the natural filter set). |
| `[]` (empty list) | Reserved for an explicit filter list; empty today ⇒ treat as **disabled** until populated (Product Class, Competence). |
| `null` | No table filters (Capacity, Performance — their filtering lives on the *reports*, §5). Button disabled. |

> Note: report-level filters (§5) are configured independently and are **not** governed
> by this key.

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
| `"Forecast Scopes"` | Plain child table, joined via the obvious FK. | Forecasts → their Forecast Scopes |
| `"Workflows: ordered by identationID"` | `:` suffix adds a **directive** — here a sort order (WBS-style `1, 2, 2.1, 2.2…`). | Processes → Workflows |
| `"Actions: rollup via Tasks.activityID"` | Directive declaring the **join path** when it isn't a direct FK (Actions relate to Activities through Tasks). | Activities → Actions |
| `"Product Scopes -> Competence"` | **Nesting**: the subitem table has its own subitem table — Product Scopes rows expand again into Competence. Arbitrary depth follows the same rules recursively. | Tasks → Product Scopes → Competence |
| `[]` | Explicitly no subitems (Jobs). Same effect as omitting the key. |
| Lowercase names (`"tickets"`, `"people"`, `"competence"`) | Match tables **case-insensitively**. |

Grouped subitems: a list with multiple entries renders **multiple child groups** under
one expanded row (the Events dashboard's Tasks + Tickets grouping is the reference).

---

## 10. Known data quirks (fix upstream, don't code around silently)

| Quirk | Location | Correct interpretation |
|---|---|---|
| `reports` contains a stray top-level `"overview-display"` key beside `Report-A` | `Talent.Roles` | It belongs *inside* Report-A; treat it as Report-A's flag and fix the JSON. |
| Slot-key casing varies (`Card 1-1` vs `card 1-1`) | Performance, Skill Levels | Match case-insensitively. |
| `card-component` casing varies (`shadcn-card` / `shadcn-Card`) | several | Same component. |
| Factories `businessSegment` rule says `enum: LPT/MT/DT` but mockup data uses `MPT` | Factories vs mockup | `MT` ≙ `MPT`; align the enum to `LPT/MPT/DT`. |
| `form` sometimes holds prose placeholders (`["see #wireframe"]`, `["keep the way it is in the #wireframe"]`) | Products, Product Class, Squads | Follow the wireframe until a structured form spec lands. |
| `type` casing varies (`DECIMAL`/`decimal`) | Forecast Scopes | Same type. |

---

## 11. Renderer checklist (what consumes what)

| UI element | Parameters consumed |
|---|---|
| Sidebar | module names |
| Tab (dashboard) | table name, `visibility`, `description` |
| KPI cards | `cards` (slot grid, title, card-rules, component, tooltip) |
| Data table columns | `attributes` → `table-display`, `type` (alignment/pills/Σ), `rule` (FK display fields) |
| Customize Columns popover | all `attributes` (checked = `table-display: true`) |
| Σ summation row | `attributes` with numeric `type` |
| Filters button + drawer | `table-filters` |
| Row dropdown / child tables | `subitem-tables` + child's `subitem-display` attributes |
| New Item / Edit drawer | `form.steps`, `form.fields` (`field-type`, `attribute`, `check`, `field-rule`), `form.subitem-tables` |
| Charts | `reports` (`graph_type`, `rule`) |
| Per-report filter drawers | `reports.*.filters.fields` (+ `default`) |
| Overview dashboard | every card/report with `overview-display: true`, + Details buttons |
