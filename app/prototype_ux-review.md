Version 1.1 — Created 02/08/2026 by Claude Code; v1.1 same day after Rafael's answers: every
agreed item is now **[implemented]** (see the *Implemented* notes under each Rafael block).
UI/UX review of the EDQMS prototype (`prototype/`), companion to `prototype_v3-review.md`
(architecture/data-model). Findings are numbered **U1–U9** — same debate convention: each ends
with a `**Rafael:**` block.

**Scope agreed with Rafael (02/08/2026):** desktop-only — device portability is out of scope by
design; accessibility auditing is also out of scope. The subitem-tables **tab feature** requested
in the same session was implemented in this round and is evaluated in Part 3.

---

# Methodology

Four complementary techniques were used; every finding cites which one produced it.

### M1 — Heuristic evaluation (Nielsen)
The interface was walked against Nielsen's 10 usability heuristics (accessibility-specific checks
excluded per scope): visibility of system status, match with the real world, user control,
consistency, error prevention, recognition over recall, flexibility, aesthetic/minimalist design,
error recovery, help & documentation. Each finding is tagged with the heuristic it violates.

### M2 — Cognitive walkthrough
Three task scenarios drawn from the app's own registration chain, asking at each step: *will the
user know what to do, see how to do it, and understand the feedback?*

| Journey | Steps exercised |
|---|---|
| J1 First-session orientation | login → Overview → find where to register a Squad |
| J2 Register a Requirement | Portfolio → Requirements → New Item → Region/Unit/Branch cascade |
| J3 Work a ticket | Workspace → Tickets → expand Jobs → row-click edit |

### M3 — Instrumented visual inspection
A headless-Chrome screenshot harness was added at `tools/uxshot.html`: it bypasses the login gate
(same-origin `sessionStorage`), routes by hash, and can script one interaction per shot
(`act=expand|form|filters|edit`, `sub=<n>` to switch subitem tabs). Reproduce any evidence with:

```bash
cd prototype && python3 -m http.server 8123 &
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --window-size=1680,1050 --virtual-time-budget=20000 --screenshot=out.png \
  "http://localhost:8123/tools/uxshot.html?hash=/0/4&act=expand&sub=1"
```

Screens inspected: login, Overview, Organization/Squads (expanded, both tabs, form),
Portfolio/Product Groups, Portfolio/Requirements (filters drawer, edit drawer),
Operation/Tasks (stacked Handouts groups), Workspace/Tickets (Jobs subitem).

### M4 — Spec/code audit as UI audit
Because every screen derives from `datamodel.json` (DATAMODEL_GUIDE.md is the contract), display
conventions were audited at the source: `table-display`/`subitem-display` sets, label rules,
form field order, filter behaviour in `filters.js`, cell rendering in `table.js`.

**Severity scale** (Nielsen ratings): **S1** blocker · **S2** major (hurts a core journey) ·
**S3** minor (friction, has workaround) · **S4** polish.

**Not evaluated:** real-user testing (the consulting workshops are the right venue — feed results
back here the way `stakeholders_test_results.md` did), accessibility, responsive layout.

---

# Part 1 — What works well (preserve these)

- **Design-token discipline** — every colour/spacing/type value goes through the Northwind Energy
  `--se-*` tokens; the dark theme is consistent across all seven modules.
- **Orientation is never lost**: sidebar module + active tab underline + tab title + record count
  (`5 of 5 records`) + per-table description line. J1 completed without hesitation.
- **Table ergonomics**: sticky headers, sortable columns, Σ summation row, pagination,
  Customize Columns, row-click-to-edit, count badges on expandable rows.
- **Filter drawer** (Microsoft Lists style) with live "N of M records match" — good status
  visibility (M1-h1) — and per-column checkbox sections.
- **Forms teach the model**: gated cascades, grouped multi-check pickers with `SelectLabel`
  headers, the "+" inline-create button, wildcard hints ("leave empty for all regions" — the Q1
  semantics made visible), and the AUTO/RELATED RECORDS sections.
- **Honest system status**: DEMO DATA / BLANK MODE badges, drawer subtitle "saved to this session
  only, resets on reload", schema-drift warning on snapshot import, per-page 📖 Guide links.

---

# Part 2 — Findings

## U1 — Product Groups' identity column is empty (S2 · M3/M4 · recognition over recall)

The first visible column, **Class Code Name** (`classCodeName`), is `null` in all 14 mockup rows,
while `productGroupName` — which holds the actual names (LPT, Autotransformer, HVDC…) — has
`table-display: false`. Every row of the dashboard therefore renders with a blank identity cell;
the user must infer the record from Product + SPECS. Side risk (M4): the engine's label heuristic
picks the first `*Name` attribute as the table's display label, so anything falling back to the
label of Product Groups resolves to an empty string (today masked by explicit CONCAT display
rules on the referencing tables).

**Recommendation:** either display `productGroupName` (set `table-display: true`, drop the empty
column) or seed `classCodeName` and keep it — but not the current halfway state. One-line
datamodel change + optional seed migration.

> **Rafael:**
> Seed `classCodeName`

> **Implemented (02/08):** `tools/migrate_class_codes.py` — deterministic codes
> `PC-<segment>-<nn>` (sequence within segment by `productGroupID`): PG01 → `PC-LPT-01`,
> PG06 → `PC-MPT-01`. Idempotent, applied to both mockup copies; the identity column now
> renders on every row.

## U2 — Multivalued columns render as repeated mega-strings (S2 · M3/M4 · minimalist design)

Tickets (J3) shows the pattern at its worst: scope/product columns repeat
"Reactors - Uprating, LPT - Uprating, Phase Shifter - Uprating, …" on nearly every row —
hundreds of characters that carry one bit of information ("this ticket spans many scopes"), and
push meaningful columns off-screen. The same joined strings leak into the **filter drawer**
(`filters.js` counts distinct *joined* values): the Requirements Scope section offers truncated
near-duplicates ("Temperature Reduction, Uprating, Uprati…") that are impossible to tell apart,
and an array column whose combinations exceed 25 distinct joined values silently stops being
filterable at all.

**Recommendation (two independent fixes):**
1. *Table cells*: cap array rendering at ~2 items + a `+n` count badge (full list on tooltip
   title text — cheap, no new component).
2. *Filter sections*: for array-valued columns, count **individual values** instead of joined
   strings, and match with `array.includes(value)` in the predicate. This is a ~10-line change in
   `filters.js` and makes multivalued columns genuinely filterable.

> **Rafael:**
> Agreed with both fixes

> **Implemented (02/08):** (1) multivalued FK cells cap at 2 items + a `+n` count badge,
> full list on hover (`table.js`; accessors in `app.js` now keep arrays as arrays instead of
> letting `fkDisplay` pre-join them); every long cell also gets a CSS ellipsis cap
> (`max-width` + title tooltip) which covers the *derived* rollup columns whose joins happen
> inside `resolve.js`. (2) filter sections count **individual** values of array columns and
> match with "any selected value present" (`filters.js`) — the Requirements Scope section now
> lists real scope names, and array columns can't silently exceed the 25-value cap anymore.

## U3 — Broken singularization in button labels (S3 · M3 · consistency) — [implemented]

The related-records launcher rendered "**+ New Processe**" (naive `/s$/` strip on "Processes";
"Classes" would give "Classe"). Fixed this round in `forms.js` (`singularTitle` now handles
`…sses` → `…ss`); re-captured to confirm "+ New Process".

> **Rafael:**
> Agreed

## U4 — Wide child tables stretch the whole row scroll (S3 · M3/M4 · flexibility/efficiency) — [implemented]

Squads → Processes exposes 8+ `subitem-display` columns; the expanded child table widens the
outer table's horizontal scroll, so panning to read the child also pans the parent columns
off-screen (evidence: Processes tab cut at "PRODUCT NA…"). Subitem column sets were tuned per
table, but several (Processes, Tasks) are still near-full width.

**Recommendation:** trim `subitem-display` sets to the identification + status columns (the row
is one click from its full dashboard), and/or give the expanded cell its own
`overflow-x: auto` wrapper so the child scrolls independently of the parent.

> **Rafael:**
> Agreed

> **Implemented (02/08):** both — Processes' subitem columns trimmed to
> `processName / eventID / processOwner / processStatus` (datamodel), and every child table
> now renders inside a `.subitem-scroll` wrapper that scrolls independently of the parent
> table (`table.js` + `app.css`).

## U5 — Gated selects don't say what unlocks them (S3 · M2-J2 · error prevention, help)

Cascade gating is the prototype's signature interaction, but a disabled select gives no clue
*which* field opens it — the scribe discovers the order by trial (the workshop-facing version of
v3-review **D10**). The information already exists in the spec: `check:` and
`field-rule: "filtered by X selected"` name the dependencies.

**Recommendation:** derive an automatic hint on disabled dependent fields from the spec —
e.g. Owner disabled → hint "Select Department first". Pure `forms.js` render change, no schema
work; complements (not replaces) the D10 setup checklist.

> **Rafael:**
> Agreed

> **Implemented (02/08):** every `check:`-gated field now shows a `form-hint` while disabled,
> derived from its own condition — "Select X and Y first" for `IS NOT NULL` gates,
> `Requires X = "value"` for equality gates; the hint disappears the moment the gate opens
> (`forms.js`).

## U6 — Destructive delete relies on native confirm() (S3 · M1 · error recovery)

Delete uses the browser dialog, breaking the visual language, and there is no undo. Acceptable in
a demo whose data resets on reload — but in **blank mode** the records are real client mapping
data, and one misclick-plus-Enter erases them from the session.

**Recommendation:** minimum: include record labels (not just the count) in the confirm text.
Nicer: styled dialog + "Deleted N records — Undo" toast (records are in memory; restoring is
cheap). Priority rises with blank-mode usage.

> **Rafael:**
> Agreed

> **Implemented (02/08):** the confirm now names the records (first 5 labels + "… and N
> more"), and deletion shows a "Deleted N record(s) — **Undo**" toast for 6 s that restores
> them in place (`app.js`; MVP-mode persistence included). The styled replacement for the
> native dialog stays open as future polish.

## U7 — Auto PK occupies the prime form slot (S4 · M3 · minimalist design)

Every drawer opens with the read-only auto PK ("Squad (auto)" — SQ6) as its first field, and in
Squads the Name field comes third, after Department. First position is the strongest slot in a
form; an auto-generated value the user can't act on may not deserve it.

**Question rather than defect:** if showing the PK first is deliberate pedagogy (teaching clients
that records are ID-keyed), keep it — otherwise move PKs into the AUTO section at the bottom and
lead with the record's name.

> **Rafael:**
> lead with the record's name.

> **Implemented (02/08):** the auto PK moved into the "Auto-calculated on save" section at
> the bottom of every drawer, and stepless forms hoist the field bound to the table's label
> attribute to the first slot (`forms.js`) — New Squad now opens Name → Department → Type →
> Owner → AUTO → Related records. Stepped forms keep their spec-declared order.

## U8 — Login screen offers no demo credentials (S4 · M2-J1)

The gate (`se-admin` / fixed password) protects nothing sensitive — data is client-side — and the
login card gives no hint. A stakeholder opening the Pages URL without the accompanying note is
stopped cold.

**Question:** is the friction intentional (only invited viewers get credentials)? If not, the
demo-mode note line could carry the credentials; blank mode can keep them out.

> **Rafael:**
> demo-mode note line CAN carry the credentials; blank mode can keep visitors out 
> >[!tip] URL fix to MVP
> > Lets change the URL to access the "blank mode" (./app/?data=empty) to display `./app/mvp/`
> > And lets change the BLANK MODE tag in the top bar to MVP as well

> **Implemented (02/08):** demo login note now reads "sign in with se-admin / …"; the MVP
> walkthrough note keeps the credentials out. MVP URL: `deploy_pages.sh` publishes a second
> copy of the app under **`/app/mvp/`** and `data.js` boots blank whenever the path contains
> `/mvp/` (the `?data=empty` param still works locally); the header badge and login note now
> say **MVP**, the in-app Guide links resolve from the deeper path, and README /
> offline_database.md / the App Guide intro point at the new URL. Goes live on the next
> `./deploy_pages.sh` run.

## U9 — "—" as a filter value contradicts the wildcard semantics (S4 · M4 · match with real world)

Empty cells surface in filter sections as "—" (e.g. Requirements → Branch). But per decision Q1
an empty applicability key means **"applies to all"** — the most inclusive value in the model
reads as the most dismissive symbol in the UI, and checking "—" filters *down* to the wildcard
rows, which is semantically upside-down for an applicability column.

**Recommendation:** label empties "(all — no restriction)" on the applicability columns
(Requirements region/unit/branch/customer/scope/product-group) and plain "(empty)" elsewhere.

> **Rafael:**
> Agreed

> **Implemented (02/08):** in `filters.js`, an **empty array** (the Q1 wildcard shape on
> multivalued applicability keys) labels as "(all — no restriction)"; a scalar empty cell
> labels "(empty)". No per-column configuration needed — the value shape carries the
> semantics.

---

# Part 3 — Feature: tabbed subitem tables — [implemented this round]

**Request (Rafael, 02/08):** when a table has 2+ subitem lists (Squads → People + Processes),
stacked lists are hard to navigate; the new object form of `subitem-tables` on Squads specifies
tabs. **Assessment: the right call** — it applies progressive disclosure to the expanded row
(one child list at a time, the strip advertising what else exists), reuses a navigation idiom the
user already knows from the dashboard tab strip, and the count badges preserve the "what's in
here" signal without rendering everything. The stacked layout stays correct for the 1-subitem
majority (19 of 21 declarations).

**Contract** (now in DATAMODEL_GUIDE.md §9): entries may be objects —
`{ "tab-order": 1, "rule": null, "tab-name": "people", "tab-table": "People" }`. `tab-name` is
humanized for display, `tab-order` sorts the strip, `rule` accepts exactly the directive grammar
of string entries (`ordered by …` / `only f=v` / `rollup via T.f` / `(via: f)`).

**Design decisions** (flag anything you'd change):

| Decision | Rationale |
|---|---|
| Tabs render only when **every** entry is an object and there are 2+ | Opt-in per table via the datamodel — no silent relayout of the 19 string declarations; mixed lists fall back to stacked. |
| Tab = humanized `tab-name` + count badge; active tab underlined | Same idiom as the dashboard tab strip (`.subtab` mirrors `.tab-chip`); counts keep the closed-state information of the stacked headers. |
| Empty tab shows "No records." in place | The tab stays visible so the user learns the relationship exists (recognition), instead of the group vanishing. |
| Group headers suppressed inside a pane | The tab already names the group — no duplicated label. |
| Forms unaffected | The Squads drawer still offers "+ New People" / "+ New Process" from the same declarations. |

**Where it landed:** `model.js` (`normalizeSubitem` + tab-order sort), `table.js`
(`renderSubTabs`), `app.js` (tab marker pass-through), `assets/app.css` (`.subtab*`),
DATAMODEL_GUIDE.md §9. Proof: `tools/test_engine_subtabs.mjs` (14 checks — object parsing, rule
directives, ordering, join resolution of both Squads tabs, string backward-compat); full suite
of 11 test files + `validate_mockup.py` green; screenshots of both tabs via the M3 harness.

**Follow-up candidates** (your call, not done):
- **Tasks → Handouts Inputs/Outputs** is the other 2-group table — migrate to
  `tab-name: "inputs"/"outputs"`? The grouped-by directive already works inside object `rule`.
- Child tables inside tabs still inherit U4 (width) — the two fixes compose.

> **Rafael:**
> Yes, create the tabs for inputs and outputs

> **Implemented (02/08):** Tasks' `subitem-tables` migrated to the object form —
> `{tab-name: "inputs"/"outputs", rule: "(grouped by inputs/outputs)"}`; expanded Task rows
> now show an **Inputs | Outputs** tab strip with count badges. Covered in
> `tools/test_engine_subtabs.mjs`.

---

# Part 4 — Suggested sequencing

1. **Data-facing, pre-workshop:** U1 (empty identity column — a client *will* ask), U5 (gated
   selects hint — directly serves the workshop scribe), U2.2 (per-value filters).
2. **Quality of life:** U2.1 (array cell capping), U4 (subitem width), U9 (wildcard label).
3. **Decisions needed from Rafael:** U7 (PK slot), U8 (credentials on login), Tasks-tabs
   migration (Part 3).
4. U3 and the tab feature itself are already in.

> **Rafael:**
> Agreed

> **Status (02/08, v1.1):** all of the above are implemented — every U-item, the Tasks tabs
> and the MVP URL/badge change. Proof: 11 engine test suites + `validate_mockup.py` green;
> re-captured M3 screenshots of the Squads/Tasks tabs, the reordered Squads form, the
> per-value filter drawer with the "(all — no restriction)" label, the seeded Product Groups
> codes and the demo login note. Remaining backlog from this review: styled delete dialog
> (U6 "nicer" half) and any further `subitem-display` trims beyond Processes.
