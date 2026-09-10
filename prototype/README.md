# EDQMS — Vitalis Governance Portal (Interactive Prototype)

A **data-driven** prototype of the EDQMS portal. Every table, chart and KPI is computed
**live in the browser** from `data/mockup_data_prototype.json` — nothing is a static image.
Filters recompute both the datasets (tables) and the graphics together. The database is
**non-persistent**: data lives in memory and resets on reload.

The public demo dataset is the **Vitalis Health Network** — a fictitious chain of
diagnostic clinics generated deterministically by `tools/seed/build_seed.py` from the
`tools/seed/domains/clinic.yaml` domain pack (dates are anchored: the demo never ages).
The original power-transformers dataset remains republishable from the
`demo-transformers-v1` git tag.

## Run locally

The app loads JSON via `fetch`, so it must be served over HTTP (not opened as `file://`):

```bash
cd prototype
python3 -m http.server 8080
# open http://localhost:8080
```

## Host it (share a link)

The whole `prototype/` folder is static — deploy it as-is to any static host
(GitHub Pages, Netlify, Azure Static Web Apps, an S3 bucket, etc.) and send the URL.
This repo auto-publishes it to GitHub Pages under `/app/` on every push to `main`
(`.github/workflows/deploy-prototype.yml`).

## MVP mode (stakeholder walkthroughs)

The deployed copy under **`/app/mvp/`** — or, locally, appending **`?data=empty`** to the
URL — boots every table empty instead of loading the mockup dataset: the full experience
from a blank QMS, for continuity/usability testing:

- All modules, tabs, forms, cascades and dashboards render from the datamodel as usual;
  stakeholders create Regions → Business Units → … themselves and hit any gaps live.
- Records created in blank mode **persist in the browser's localStorage**, so the
  session survives reloads and can continue across days (per browser/participant).
- **Save / Save As** (Chromium): Save **overwrites the session file in place** — no
  timestamped copies; the first save asks for the folder once (the file is created there
  as `edqms_session.json`). Save As writes a new version through one native save dialog
  (opens in the session folder). Import makes the picked file the new Save target, and
  the header chip shows `folder/file.json` of the current target.
- **`?reset=1`** wipes the saved session and starts over (remove it afterwards, or
  every reload starts blank again).
- The header badge shows **MVP** (vs. DEMO DATA). There is no login gate — the project
  is open source and neither mode holds anything sensitive.
- **Walkthrough scope:** the analytics surfaces that only make sense with seeded data —
  the **Overview**, **Workspace** and **Control** modules, plus the CRM **Forecasts** /
  **Forecast Scopes** dashboards — stay visible but disabled (opaque, not selectable);
  the session lands on Organization instead of Overview. KPI **cards** and **report
  charts** are hidden on every tab — stakeholders see only the record tables and forms.

Hosted: `https://neun-design.github.io/Nance/app/mvp/` (published by `deploy_pages.sh`)

## What's inside

- **Overview** — executive KPI cards + headline charts (landing page).
- **7 modules** — Organization, Portfolio, CRM, Talent, Operation, Workspace, Control.
  Each tab shows its entity table (with sort, search, collapsible rollup rows, mirror
  fields) plus filters and charts computed from the same filtered rows.
- **Control** tabs are read-only (Capacity / Usage / Productivity), per the design rules.
- **New Item** — every editable tab has a "New Item" button that opens a slide-in form
  drawer demonstrating how a record is inserted: foreign keys become dropdowns, enums/dates/
  numbers get the right control, the primary key is auto-suggested, and auto-calculated
  (mirror) fields are shown as derived. Submitting adds the row to the table for the session.
- **Nested rollup forms** — where a tab has rollup relationships (e.g. Process → Activities /
  Tasks), the form shows a "New &lt;child&gt;" button per relationship. Clicking it opens a
  stacked form with its own left-edge **spine tab** (exactly like the wireframe); the child is
  auto-linked to the parent being created. "Add" returns to the parent, "Save" commits the root.
- **Cascading / stepped forms** — two tabs use bespoke forms instead of the generic one:
  - **Task Templates** — Event → Process → Workflow → Activity cascade; each selection narrows
    the next dropdown (disabled with a "no options" message when empty), the Activity is
    auto-set, and Task Name / Role auto-populate.
  - **Jobs** — a single planning drawer (Ticket → Task → Responsible → dates → optional
    predecessor with dependency type).
    The Assignee dropdown is filtered to people whose role matches the chosen task template, and
    Role / Squad / Job Name auto-fill from the selections.

## Structure

| Path | Purpose |
|---|---|
| `index.html` | App shell (header + sidebar + tabs) |
| `assets/_ds/` | nance Design System tokens (colours, type, spacing, shape) |
| `assets/app.css` | Layout + component styles (references `--se-*` tokens only) |
| `vendor/echarts.min.js` | Charting library |
| `data/` | Mockup dataset + data model |
| `js/registry.js` | Declarative per-tab config (columns, filters, rollups, charts) |
| `js/data.js` · `compute.js` | Load/index data + derive computed/mirror/rollup fields |
| `js/table.js` · `charts.js` · `filters.js` | Generic UI components |
| `js/app.js` · `router.js` · `overview.js` | Bootstrap, routing, dashboard |

To add or change a tab, edit its object in `js/registry.js` — rendering is generic.
