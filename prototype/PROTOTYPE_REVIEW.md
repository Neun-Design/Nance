# EDQMS Prototype — Review & Change Prompt

> **Purpose.** This document is the source prompt for the `/gh-tasks review` and
> `/gh-tasks plan` skills. It describes every interface and data change the EDQMS prototype
> still needs. Use it to (a) review the current branch against the requirements below and
> (b) plan the issues/PRs required to close each gap.
>
> **Before reviewing:** diff `#datamodel` against the version used to build `#wireframe` to
> identify what changed, then apply the revisions in this document.

## How to read this document

| Marker | Meaning |
|---|---|
| `- [ ]` | An actionable change item the reviewer must verify or plan. |
| `> [!NOTE] gh-task review/plan` | A design decision or instruction addressed directly to the reviewer/planner. |
| `> [!WARNING]` | Mockup-data handling instruction — states whether to **replace** existing rows or **append** new ones. |
| `#name` | A reference defined in the **Reference glossary** below. |
| `{ "component": "source" }` | `field-type` notation: the **key** is the UI component type, the **value** is its source (library or render mode). |

## Reference glossary

All `#` references below resolve relative to this file's location (`prototype/`).

| Reference | Path (relative to `prototype/`) | Description |
|---|---|---|
| `#wireframe` | `../sourceFiles/developer/prototype_wireframe/Global Engineering Portal (standalone).html` | Approved interaction and layout reference |
| `#datamodel` | `data/datamodel.json` | Canonical schema: tables, cards, forms, filters, reports |
| `#design-system` | `../sourceFiles/developer/prototype_designSystem.html` | Northwind Energy shadcn design-system reference for this project |
| `#events-csv` | `../sourceFiles/developer/events.csv` | Mockup data for the Events table |
| `#tickets-csv` | `../sourceFiles/developer/tickets.csv` | Mockup data for the Tickets table |

---

# Global UI Revisions

All shadcn block and component references must be applied through this project's
`#design-system`.

## Dashboard

- [ ] Use the shadcn **dashboard-01** block (`npx shadcn@latest add dashboard-01`) as the
  default layout for every screen (tab).
- [ ] To determine whether a screen shows `cards` or `reports`, check `#datamodel`.

## Login

- [ ] Create a login screen.
- [ ] Use the shadcn **login-01** block (`npx shadcn@latest add login-01`).
- [ ] Login has only `username` and `password`:
  - `username == se-admin`
  - `password == @NorthwindEnergy2026`

## Settings

- [ ] Set the entire platform to **dark mode** by default.

  > [!NOTE] gh-task review/plan
  > A light/dark toggle is not required for the prototype, but file an issue to add it in a
  > future release.

- [ ] Create a **calendar configurator**:
  - [ ] Create calendar templates:
    - [ ] Define the working days of the week.
    - [ ] Define the working hours of the working day.
    - [ ] Define holidays and days off in the calendar.

  > [!NOTE] gh-task review/plan
  > Calendar registration can be deferred to a future update. For the prototype, assume
  > resources work Monday–Friday, 7 hours/day, for the purpose of report calculations.

## Tables

- [ ] Use the shadcn `<DataTable>` component.
- [ ] **Summation row:** add a final row to every table that SUMs all numerical attributes.
- [ ] Tables must use the same component as shadcn **dashboard-01** — same pagination style,
  rows-per-page control, etc.
- [ ] **Controls** are buttons at the top of the table that change the behaviour of the table
  and its items:
  - [ ] **Edit** — enabled only when exactly one item is selected.
  - [ ] **Delete** — enabled when one or more items are selected.
  - [ ] **Customize Columns** — per `#wireframe`.
  - [ ] **Filters** — per the `table-filters` key and `#wireframe`.
  - [ ] **New Item** — per `#wireframe` and the Drawers section below.

## Cards

Card schema (from `#datamodel`):

```json
"cards": [
  {
    "Card 1-1": /* display order on screen; the numbers are (row - column) of the grid */ {
      "title": "Title of the card, displayed above the main-data",
      "card-rules": {
        "main-data": "Highlighted value in the card",
        "trend-data": "Direction of the value: rising → up arrow with green numbers; falling → down arrow with red numbers. Position the trend before the main-data in the card.",
        "detail-data": "Placed below the main-data in a reduced font, showing detail about the main-data"
      },
      "card-component": "UI component reference",
      "card-tooltip": "Explanation of what the card represents"
    }
  }
]
```

## Drawers

- [ ] Whenever a form field
  `{datamodel.table.form.field-name : type == "multi-selection" | "selection" | "search"}`
  selects items related to another table, add an **"add new '<field-name>'"** button that
  opens a new drawer tab. `#wireframe` already demonstrates this functionality.

### Forms

`field-type` is an object with a **key** and a **value**. The key is the component type; the
value is the source.

**Example 1 — `{ "month": "html" }`**

```html
<input type="month" />
```

**Example 2 — `{ "Textarea": "shadcn-field" }`**

```tsx
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

export function FieldTextarea() {
  return (
    <FieldSet className="w-full max-w-xs">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="feedback">Feedback</FieldLabel>
          <Textarea
            id="feedback"
            placeholder="Your feedback helps us improve..."
            rows={4}
          />
          <FieldDescription>
            Share your thoughts about our service.
          </FieldDescription>
        </Field>
      </FieldGroup>
    </FieldSet>
  )
}
```

**Example 3 — `{ "Combobox": "shadcn-combobox" }`**

```tsx
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

const frameworks = ["Next.js", "SvelteKit", "Nuxt.js", "Remix", "Astro"]

export function ExampleCombobox() {
  return (
    <Combobox items={frameworks}>
      <ComboboxInput placeholder="Select a framework" />
      <ComboboxContent>
        <ComboboxEmpty>No items found.</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
```

Form schema (from `#datamodel`):

```json
{
  "form": {
    "steps": {
      "step-title": {
        "step-description": "string",
        "step-order": "integer"  /* vertical position of the step in the form */
      }
    },
    "fields": {
      "field-name": {
        "field-type": [{ "text": "html" }, { "month": "html" }, { "range-picker": "shadcn" }],
        "tooltip": "Description shown on the UI element",
        "step": "step-title",
        "check": "Appears only if a given field, or field combination, matches a criterion",
        "field-rule": "How to display the field's items, or the input constraints"
      }
    }
  }
}
```

**Example — Jobs table form:**

```json
{
  "form": {
    "steps": {
      "SELECT TEMPLATE": {
        "step-description": "Select a task to create baselines and filter roles",
        "step-order": 1
      },
      "SCHEDULE": {
        "step-description": "Select when the task must be delivered",
        "step-order": 2
      }
    },
    "fields": {
      "Ticket": {
        "field-type": { "select": "shadcn" },
        "tooltip": " ",
        "step": "SELECT TEMPLATE",
        "check": null,
        "field-rule": null
      },
      "Task Template": {
        "field-type": { "Groups": "shadcn-combobox" },
        "tooltip": " ",
        "step": "SELECT TEMPLATE",
        "check": "Disable this field until the Ticket field has been selected",
        "field-rule": "rollup -> field.Ticket.input (via: Tickets Form) -> Tickets(processID) -> Tasks (via: processID); display: taskName FILTER BY scopeID (via: ticketID -> productScopeID -> scopeID) GROUP BY processName"
      },
      "Planned Execution Period": {
        "field-type": { "Range Picker": "shadcn-Date Picker" },
        "tooltip": " ",
        "step": "SCHEDULE",
        "check": "Disable this field until Ticket and Task Template have been selected",
        "field-rule": null
      }
    }
  }
}
```

### Report filters

- [ ] Report filters follow the same structure as forms: each filter has a button that opens
  a right-side drawer containing the inputs.

  > [!NOTE] gh-task review/plan
  > Evaluate the best way to present report filters. If you find an alternative that improves
  > the user experience, feel free to apply it instead of the button + drawer model suggested
  > above.

- [ ] The **Reset** button must live inside the drawer.
- [ ] Each report `<div>` must have its own filter button.

### Table filters

- [ ] Table filters must be built the same way as in `#wireframe`.
- [ ] Follow the `#wireframe` pattern: a button that opens a right-side drawer.
  - Each table's filter button is enabled or disabled based on the value of the
    `table-filters` key in `#datamodel`.

## Sidebar

- [ ] Apply shadcn **sidebar-07** (`npx shadcn@latest add sidebar-07`).
  - [ ] Remove the current Tabs structure from the dashboards to adopt this sidebar. The tabs
    become the module menu entries in the sidebar.

## Reports

- [ ] For reports where `#datamodel` gives no shadcn reference, choose a shadcn component
  from the library that best represents the report's rules and filters.

  > [!NOTE] gh-task review/plan
  > Create tests to ensure the tables and queries are correct and satisfy every report card.

## Tabs (Dashboards)

- [ ] Use shadcn **dashboard-01** (`npx shadcn@latest add dashboard-01`), respecting the
  sidebar component specified above.
- [ ] Follow the `Edit` / `Delete` / `Customize Columns` button pattern per `#wireframe`:
  - [ ] **Edit** is enabled when exactly one table item is selected.
  - [ ] **Delete** is enabled when one or more items are selected.
- [ ] The number of cards and reports per dashboard is defined in `#datamodel`.

## Subitem tables

- [ ] Subitem tables may group more than one table. See the current Events dashboard table in
  the prototype as an example of this grouping (group 1: Tasks; group 2: Tickets). The list of
  tables to render as subitems is defined by `subitem-tables` in `#datamodel`:

  ```json
  "subitem-tables": [
    "Tasks",
    "Tickets"
  ]
  ```

- [ ] Subitem tables may themselves contain a subitem table. This `nested` behaviour is
  declared in `#datamodel` as:

  ```json
  "subitem-tables": [
    "Product Scopes -> Competence"
  ]
  ```

  Here the Product Scopes subitem table has a nested Competence subitem table.

---

# Modules

## Quality

- [ ] **Remove this module entirely.** It will be part of a future release.

## Control

### Capacity

- [ ] Add a button on report A to filter forecasts, excluding all forecasts of type `Draft`.
  A radio button is acceptable.

## Overview

- [ ] The Overview table is a compilation of cards and data from the dashboards (tables) of
  each module.
- [ ] The cards and reports shown in Overview are determined by the `overview-display`
  parameter on each card or report in `#datamodel`.

  > [!NOTE] gh-task review/plan
  > The `#datamodel` currently spells this key `overview-dislay` in most places (and
  > `overview-display` in one). Normalize all occurrences to `overview-display` in
  > `data/datamodel.json` as part of this work.

- [ ] Every card and chart (report) in the Overview dashboard must have a **details** button
  linking to its source dashboard.
- [ ] Disable all chart (report) filters in the Overview dashboard. The **details** button
  takes the user to the source dashboard so they can apply filters and analyze the data there.

## Customers

### Factories

- [ ] Add reports as indicated in `#datamodel`.

#### Mockup data

> [!WARNING] Review existing mockup data
> Replace the Factories mockup data with the rows below. Do not add any additional rows —
> these are used for testing.

| Name | City | Country | Segment | Region |
| --- | --- | --- | --- | --- |
| PN | Nuremberg | Germany | LPT | EMEA |
| TUSA | Jundiaí | Brazil | LPT | Americas |
| STW | Weiz | Austria | LPT | EMEA |
| KPT | Zagreb | Croatia | LPT | EMEA |
| STGZ | Guangzhou | China | LPT | APAC |
| STDD | Dresden | Germany | MPT | EMEA |
| STL | Linz | Austria | MPT | EMEA |
| STN | Trento | Italy | MPT | EMEA |
| STCK | Jinan | China | MPT | APAC |
| STWH | Wuhan | China | MPT | APAC |
| STM | Guanajuato | Mexico | MPT | Americas |
| DB | Budapest | Hungary | DT | EMEA |
| DK | Kirchheim | Germany | DT | EMEA |
| TN | Nuremberg | Germany | DT | EMEA |
| JXN | Jackson | USA | DT | Americas |
| SAT | Bogotá | Colombia | DT | Americas |
| STCA | Trois-Rivières | Canada | DT | Americas |

### Forecasts

- [ ] Add a subitem table as indicated in `#datamodel`.
- [ ] Remove the reports from this dashboard.
- [ ] Update attributes per `#datamodel`.
- [ ] Report:
  - [ ] Add a report showing the monthly rate between budgeted hours from the forecasts
    (`usageQuota`) vs. the `estimatedHours` of the Tickets.

### Forecast Scopes

- [ ] Attributes:
  - Added `quantity` to compute the estimated time of the forecasts.

## Operation

- [ ] Update dashboards per the `#datamodel` revisions.

### Events

#### Mockup data

- [ ] Use the data stored in `#events-csv` as mockup for the Events table.

> [!WARNING] Review existing mockup data
> Replace the Events mockup data with the data from `#events-csv`.
> You may create additional rows for this table.
> Use this table as contextual reference when creating mockups for related tables.

### Process

- [ ] Subitem table:
  - [ ] Workflows (ordered by `identationID`) → nested with Tasks.

#### Mockup data

> [!WARNING] Review existing mockup data
> Include this item in the Process mockup table. You should create additional rows for this
> table.

| ID | Event | Name | Description | Registry ID |
|---|---|---|---|---|
| PC01 | Offer Calculation Request | Offer Electrical Design | | ZXPTO0001-T |

### Activities

#### Mockup data

> [!WARNING] Review existing mockup data
> Include the items below in the Activities mockup table. Create additional rows based on the
> context established by the example below.

| ID | Activity |
|---|---|
| ACT01 | Allocation |
| ACT02 | Technical Assessment |
| ACT03 | Technical Clarification |
| ACT04 | Data Collection |
| ACT05 | Offer Design |
| ACT06 | Operational Clarification |
| ACT07 | Technical Specification |

### Actions

#### Mockup data

> [!WARNING] Review existing mockup data
> Replace the Actions mockup items with the items below. Do **not** create additional rows for
> this table.

| Name | Description |
| --- | --- |
| Approval | Go / No-Go decision on whether an activity should move into the workflow |
| Assignment | Planning who should execute an activity |
| Check | Review the execution of a given activity |
| Execution | Developing a given activity |
| Followup | Check activity status to update a plan |
| Registration | Insert a given activity into an inventory following certain rules |
| Release | Input the data generated during the execution of a given activity into a system |

### Workflows

- [ ] Attributes:
  - `identationID` — describes the relationship between activities:
    - Example 1: an item with `identationID` `2.1` has a `finish-to-finish` relationship with item `2`.
    - Example 2: an item with `identationID` `2` has a `start-to-finish` relationship with item `1`.
    - Example 3: an item with `identationID` `2-1` has a `start-to-start` relationship with item `2`.

#### Mockup data

> [!WARNING] Review existing mockup data
> Include the items below in the Workflows mockup table. Create additional rows based on the
> context established by the example below.

| ID | Process | Activity | Parent Step | Identation |
|---|---|---|---|---|
| WF01 | Offer Electrical Design | Allocation | | 1 |
| WF02 | Offer Electrical Design | Technical Assessment | WF01 | 2 |
| WF03 | Offer Electrical Design | Technical Clarification | WF02 | 2.1 |
| WF04 | Offer Electrical Design | Data Collection | WF02 | 2.2 |
| WF05 | Offer Electrical Design | Offer Design | WF02 | 3 |
| WF06 | Offer Electrical Design | Operational Clarification | WF05 | 3.1 |
| WF07 | Offer Electrical Design | Technical Specification | WF05 | 4 |

## Inventory

### Product Scopes

- [ ] Attributes:
  - `constraintID` (FK → Constraints; display: `constraintName`)

### Scopes

#### Mockup data

> [!WARNING] Review existing mockup data
> Replace the Scopes mockup data with the rows below. Do not add any additional rows — these
> are used for testing.

| Code | Name | Opportunity |
| --- | --- | --- |
| A.1 | Temperature Reduction | Lifetime Extension |
| A.2 | Uprating | Increase Capability |
| A.3 | Uprating with Windings Replacement | Increase Capability |
| A.4 | Repair with Windings Replacement | Dielectric Failure |
| B | Reduction of the volume of gases and moisture in the insulating oil | Lifetime Extension |
| C | Renewal of the paper/oil insulation system | Lifetime Extension |
| D | Protection devices, wiring/cabling, cubicles, monitoring | Lifetime Extension |
| E | Renovation of External Parts | Lifetime Extension |
| F | Replacement of bushings, shields/electrodes and CTs | Lifetime Extension |
| G | Electrical and/or materials testing, inspection, evaluation and diagnosis | Lifetime Extension |

### Products

#### Mockup data

> [!WARNING] Review existing mockup data
> Replace the Products mockup data with the rows below. Do not add any additional rows — these
> are used for testing.

| ID | Name |
| --- | --- |
| P01 | LPT |
| P02 | Autotransformer |
| P03 | Phase Shifter |
| P04 | HVDC |
| P05 | Reactors |
| P06 | MPT |
| P07 | IND |
| P08 | LDT |
| P09 | CRT |
| P10 | LIDT |
| P11 | TRAC |
| P12 | VR |
| P13 | CP |
| P14 | RENEW |

### Product Groups

#### Mockup data

> [!WARNING] Review existing mockup data
> Replace the Product Groups mockup data with the rows below. Do not add any additional rows —
> these are used for testing.

| ID | Product | Segment | Class |
| --- | --- | --- | --- |
| P01 | LPT | LPT | CLS03, CLS04 |
| P02 | Autotransformer | LPT | CLS03, CLS04 |
| P03 | Phase Shifter | LPT | CLS07 |
| P04 | HVDC | LPT | CLS08 |
| P05 | Reactors | LPT | CLS06 |
| P06 | MPT | MPT | CLS01, CLS02 |
| P07 | IND | MPT | CLS05 |
| P08 | LDT | MPT | CLS01, CLS02 |
| P09 | CRT | DT | CLS09 |
| P10 | LIDT | DT | CLS12, CLS13 |
| P11 | TRAC | DT | CLS14 |
| P12 | VR | DT | CLS10 |
| P13 | CP | DT | CLS09 |
| P14 | RENEW | DT | CLS01, CLS12, CLS13 |

### Product Class

#### Mockup data

> [!WARNING] Review existing mockup data
> Replace the Product Class mockup data with the rows below. Do not add any additional rows —
> these are used for testing.

| ID | Voltage Rating | Power Rating |
| --- | --- | --- |
| CLS01 | <=145 | <=100 |
| CLS02 | <=300 | <=250 |
| CLS03 | <=550 | <=400 |
| CLS04 | >550 | >400 |
| CLS05 | ALL | ALL |
| CLS06 | ALL | ALL |
| CLS07 | ALL | ALL |
| CLS08 | ALL | ALL |
| CLS09 | ALL | ALL |
| CLS10 | ALL | ALL |
| CLS11 | ALL | ALL |
| CLS12 | <=36 | <=10 |
| CLS13 | <=72.5 | <=30 |
| CLS14 | ALL | ALL |
| CLS15 | ALL | ALL |

## Workload

### Tickets

- [ ] Attributes:
  - `ticketID`
  - `customerName`
  - `projectID`
  - `ticketDescription`
  - `eventID` (display: `eventName`)
  - `productScopeID` (display: `productScopeName`)
  - `ticketStatus` (`InProgress`, `Open`, `Resolved`, `Closed`, `Escalated`)
  - `ticketDueDate`
  - `taskId` (rollup → Tasks via: `ticketID` → `eventID` → `productScopeID.scopeID` → `productScopeID.productGroupID`)
  - `ticketExecutionTime` (via: `rollup.taskID.executionTime`)

- [ ] Subitem table:
  - Jobs (display: status = `Active`, `Queued`)

#### Mockup data

- [ ] Use the data stored in `#tickets-csv` as mockup for the Tickets table.

> [!WARNING] Review existing mockup data
> Replace the Tickets mockup data with the data from `#tickets-csv`.
> Replace the `Forecast Scope` column of the CSV with the mockup data from the Forecast Scope
> table.
> You may create additional rows for this table.
> Use this table as contextual reference when creating mockups for related tables.
