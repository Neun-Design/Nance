# F5 screen sweep — Vitalis demo dataset

## Organization
  - **Business Segments** — 3 rows (hidden registry)
  - **Regions** — 3 rows (hidden registry) · subitem Business Units ✓
  - **Business Units** — 4 rows (hidden registry) · subitem Branches ✓
  - **Departments** — 6 rows (hidden registry) · subitem Squads ✓
  - **Squads** — 6 rows (hidden registry) · subitem People ✓ · subitem Processes ✓
  - **Branches** — 12 rows (hidden registry) · subitem Departments ✓

## Portfolio
  - **Classes** — 5 rows (hidden registry) · subitem Scopes ✓
  - **Scopes** — 8 rows (hidden registry) · subitem Product Scopes ✓
  - **Products** — 12 rows (hidden registry)
  - **Product Specs** — 8 rows (hidden registry) · subitem Products ✓
  - **Product Groups** — 14 rows (hidden registry) · subitem Product Specs ✓
  - **Events** — 20 rows (hidden registry) · report Report-A → 6 cats, total 51 · report Report-B → 6 cats, total 46 · subitem Processes ✓ · subitem Product scopes ✓
  - **Product Scopes** — 24 rows (hidden registry)

## CRM
  - **Customers** — 18 rows (hidden registry) · report Report-A → 12 cats, total 151 · subitem SLA ✓
  - **SLA** — 20 rows (hidden registry) · subitem Forecasts ✓
  - **Forecasts** — 156 rows (hidden registry) · report Report-A → 17 cats, total 14932 · subitem Forecast Scopes ✓
  - **Forecast Scopes** — 388 rows (hidden registry) · report Report-A → 8 cats, total 15889

## Talent
  - **Roles** — 12 rows (hidden registry) · report Report-A → 6 cats, total 42 · subitem Competence ✓
  - **Skill Levels** — 4 rows (hidden registry) · card Card 1-1 → 24 · report Report-A → 2 cats, total 42
  - **Functions** — 6 rows (hidden registry) · report Report-A → 6 cats, total 42
  - **Job Family** — 4 rows (hidden registry) · report Report-A → 12 cats, total 42 · subitem people ✓
  - **People** — 36 rows (hidden registry) · report Report-A → 6 cats, total 36 · subitem Onboarding ✓
  - **Onboarding** — 60 rows (hidden registry) · subitem Competences ✓
  - **Competence** — 28 rows (hidden registry)

## Operation
  - **Tasks** — 46 rows (hidden registry) · card Card 1-1 → 3 recurrent · report Report-A → 6 cats, total 46 · report Report-B → 6 cats, total 46 · subitem Procedures ✓
  - **Requirements** — 18 rows (hidden registry) · subitem Product Scopes ✓
  - **Processes** — 6 rows (hidden registry) · report Report-A → 6 cats, total 46 · subitem Workflows ✓
  - **Workflows** — 23 rows (hidden registry)
  - **Payload** — 26 rows (hidden registry)
  - **Handouts** — 14 rows (hidden registry)
  - **Procedures** — 46 rows (hidden registry) · subitem Handouts - Inputs ✓ · subitem Handouts - Outputs ✓ · subitem Product scopes ✓

## Workspace
  - **Tickets** — 160 rows (hidden registry) · card Card 1-1 → 1 · report Report-A → 9 cats, total 160 · report Report-B → 160 cats, total 160 · subitem Processes ✓ · subitem Tasks ✓
  - **Projects** — 10 rows (hidden registry) · report Report-A → 4 cats, total 2190 · subitem tickets ✓
  - **Jobs** — 240 rows (hidden registry) · report Report-A → 9 cats, total 1496 · report Report-B → 1 cats, total 1282

## Control
  - **Capacity** — 72 rows (hidden registry) · card Card 1-1 → 20% · card Card 1-2 → Corporate Care Group · report Report-A → 6 cats, total 215080
  - **Performance** — 96 rows (hidden registry) · card Card 1-1 → 39.6 h σ · card Card 1-2 → -91.0% · report Report-A → 9 cats, total 1397 · report Report-B → 6 cats, total 6207

RESULT: PASS — zero empty tabs, zero degenerate cards/charts
