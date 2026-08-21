# Vitalis Health Network — the planted narrative (F1)

**MOCKUP_DEMO_PLAN.md §5.4 deliverable · 21/08/2026 · pairs with `domains/clinic.yaml`**

Demo data is a sales argument in table form (plan §1). Each story below is
planted by the generator (F2), revealed by an existing card or report, and
**asserted** in the validator's `== narrative ==` block (F3) — a re-seed that
breaks a story fails the build instead of silently regressing the demo.

The `clinic.yaml → narrative:` section carries the machine-readable anchors;
this document is the human contract: what the visitor sees, why it sells, and
what the assert checks.

---

## Story 1 — Radiologist bottleneck at Vitalis Campinas

**What the visitor sees.** In the Overview, Capacity Utilization trends up and
the *Available vs Allocated Hours by Function* chart shows **Radiologist**
allocated above available for the last 3 months; the Workspace shows the
ticket queue growing on the imaging flows.

**Why it sells.** This is the platform's headline promise: capacity problems
visible *before* they become missed deadlines — and **derived, not asserted**
(R6): the bottleneck exists because the Done/Active jobs of that function
consumed more hours than `derive_control.py` computes as available.

**Assert.** For the last 3 anchored months: `Capacity.allocatedHours >
availableHours` for functionID = Radiologist, and the same relation
reproduces when recomputed from Forecast Scopes/People (the derivation gate
already guarantees the second half).

## Story 2 — A new CT protocol with a certification gap

**What the visitor sees.** Talent → Onboarding: the "CT Contrast Adult
certification" group appears with **2 certified people and 6 in onboarding**
(`isCertified = false`). Opening a Job on the new protocol's tasks, the
Responsible select offers only the 2 certified names; the Tasks tab Users
column shows the same pair.

**Why it sells.** Competence/Onboarding — the hardest module to explain in
the transformer domain — becomes self-evident: *an uncertified technician
cannot be scheduled on that machine*.

**Assert.** Exactly 2 Onboarding rows covering the story-2 protocol's
competences have `isCertified = true` and ≥6 have `false`;
`certifiedUsersForTask` on the protocol's tasks returns exactly the certified
pair's userIDs.

## Story 3 — A regulation lands mid-history

**What the visitor sees.** `ANVISA RDC 611 Compliance` becomes effective two
months before the anchor. Tickets opened after that month show it in their
requirement column (INHERITED-REQUIREMENTS, live since #229); older tickets
don't. No one re-entered anything.

**Why it sells.** The living requirement inheritance is the QMS argument in
one glance: regulation changes, the operation's obligations update themselves.

**Assert.** Every ticket whose `ticketCreatedAt` ≥ effective month and whose
chain matches the requirement's applicability lists it in
`ticketRequirements`; at least one older ticket demonstrably doesn't.

## Story 4 — The underestimated insurer forecast

**What the visitor sees.** HealthFirst Insurance approved **900 h** across its
forecast lines; the linked tickets' jobs consumed **1 180 h**. The
budgeted-vs-executed report shows the gap month by month, and since R6 the
trail is complete: forecast line → linked tickets (`forecastScopeID`) → job
hours.

**Why it sells.** Answers the question every operations manager asks — "which
contract is eating more than it bought?" — with drill-down, not a hunch.

**Assert.** Σ `totalEstimatedHours` of HealthFirst's approved forecasts ≈ 900
(±5%); Σ `realExecutionTime` of Done jobs under tickets linked to those
forecasts' lines ≈ 1 180 (±5%).

## Story 5 — One action recurring across processes

**What the visitor sees.** The Tasks card "top recurring actions" leads with
**Check**: `Elaborate Report-Check` exists in the Imaging Exam Flow, the
Urgent Care Lane and the Second Opinion Flow.

**Why it sells.** Standardization made visible: the same quality action,
formalized once, applied across different flows — the ISO §4.4 process
approach without saying "ISO".

**Assert.** The Check action appears in tasks of ≥3 distinct processes
(the #216 card query returns it in the top 3).

## Story 6 — The contract balance (born in R6)

**What the visitor sees.** CRM → Forecast Scopes: the lines of the
"HealthFirst × Radiology Operations" contract show `consumption` (a real
COUNT of linked tickets) at **78% of quantity** in the third month of the
quarter, `remaining` still positive — the most direct commercial reading the
platform offers.

**Why it sells.** A commercial manager sees contract burn-down without a
spreadsheet; and clicking a line shows exactly WHICH tickets consumed it.

**Assert.** For the story-6 SLA's current-quarter lines:
`Σ consumption / Σ forecastScopeQuantity` ∈ [0.7, 0.85] and every line has
`remaining ≥ 0`.

---

## Seed hygiene (plan §7.1 — same validator block)

The R6 migrations fixed the **model**; these residues of the migrated dataset
must be impossible by construction in the generated one:

| # | Rule | Assert |
|---|---|---|
| H1 | ≥55% of tickets consume a demand line, spread over ≥60 distinct lines | link rate + distinct `forecastScopeID` count |
| H2 | `consumption ≤ forecastScopeQuantity` on every line (overflow becomes an unlinked ticket) | no negative `remaining` |
| H3 | No real date after `_meta.anchorDate`, in any job status | max(realStartDate, realEndDate, stoppedAt) ≤ anchor |
| H4 | `realExecutionTime` only on `Done` jobs | Active/Queued/Stoped carry none |
| H5 | `Stoped` shape: `stoppedAt` set, `jobBufferExecution > 0`, no `realEndDate` | per-row check |
| H6 | Real mass in every forecast period: 144 Month · 8 Quarter · 4 Annual | counts per `forecastPeriod` |

---

*Review milestone (plan §6): this dictionary + narrative is where the demo is
won or lost — four-eyes review before F2 starts.*
