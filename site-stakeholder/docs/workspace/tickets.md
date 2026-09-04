---
title: "Tickets"
audience: stakeholder
purpose: "Tickets — what it is, when to register one, and its key fields"
---

# Tickets

**What it is:** a request inside a project — the entry point of execution. The ticket
carries its dispatch context: the payload of the chosen event, the governing SLA, the
processes it triggers and the applicable requirement set.
**Register when:** after its Project.
**Key fields:** `Unit *` (grouped by segment) → **Applicant** (2026-09-03) — the internal
customer *opening* the ticket, always an `Internal`-type customer; optional — a ticket
without one inherits requirements through the project customer alone → `Customer *`
(unlocked by the Unit) — since 2026-09-04 it only **filters the projects offered below**:
the ticket's events and scopes follow the *project's* contracts → unlocks `Project *`
(the customer's projects), **Supplier** — the party responsible for resolving the issue,
picked among the unit's customers grouped by type (unlocked by the Unit) — and `Event *`
(unlocked by the Project) — **only events packaged by the project's surviving SLAs are
offered** (2026-09-04): a contract survives when the project customer holds it, or when
the *Applicant* buys from the chosen *Supplier* under it — the Applicant + Supplier pair
opens a second contract leg on top of the customer's; `Product Scope *` (unlocked by the
Event) — only scopes **co-packaged with the chosen event in a same payload** of those
contracts, so the pair always maps to a real dispatch package;
Details; Target date; Status. On save the app **resolves and stores the ticket's
payload(s) and governing SLA(s)** from that pair — the Payload and SLA columns show the
ticket's own dispatch context (a pair sold under two contracts lists both), nothing else
to select. A project without linked SLAs offers no events — link the contracts on the
[Project](projects.md) first. The **Forecast Scope** link is no
longer entered on the form (2026-09-03): existing links between tickets and the
contract's [Forecasts](../crm/forecast-scopes.md) demand lines stay in the data, and a
line's consumption keeps counting its linked tickets with the remaining balance
following. The requirement set is **live**
(2026-08-20): registering a new Active requirement whose applicability matches the ticket's
scopes, product scopes, unit, served regions or customer makes it appear on existing tickets
immediately — no re-entry; inactivating a requirement removes it everywhere. The set includes
customer-specific requirements registered against **either inheritance party** — the project
customer or the Applicant (2026-09-03: a requirement pinned to the internal customer opening
the ticket applies on top of the project customer's set) — and, since 2026-08-28,
follows the requirement's Product Scope dimension (a requirement naming specific
combinations inherits only into tickets that admit them).
Expanding a ticket row opens four tabs — the **Processes** the event dispatches into
(narrowed by the chosen product scope), the **Tasks** of those processes — sorted by
their derived **Indentation** (2026-09-03: the workflow-step outline extended one level
down, `1.0.1`, `1.1.2`, `2.0.1`…, so the planner reads the execution order directly on
the ticket), and carrying (2026-09-04) the **Users** column — the people eligible to
execute each task under THIS ticket's inherited requirements (certified onboarding +
Approved procedure, the staffing rule below) — and an **Execution Time** column with the
time of the procedure the ticket's context resolves for the task (an ambiguous or
missing method shows GAP, like the Procedure column) —, **Inputs**
(2026-08-26; per-procedure since 2026-09-04): the [Handouts](../operation/handouts.md)
each resolved procedure declares as **Customer Inputs** — for each task, the ticket's
requirement set narrows the procedures to exactly one, and the documents that procedure
marks as customer-provided are listed — and **Requirements** (2026-08-27): the ticket's live inherited
[Requirements](../operation/requirements.md) as full rows (type, reference, regulatory
link), replacing the joined-names column the table used to carry. It is the collection checklist for ticket intake: what the customer must hand over
before remote teams can start (a task whose procedure is ambiguous or missing contributes
nothing until the gap is closed). Staffing
eligibility is **ticket-aware** (2026-08-20; the Users column left the Tasks tab on
2026-08-28 and RETURNED on 2026-09-04): only people whose certified competences cover **every**
requirement the ticket inherits can be staffed, and (2026-09-03) only while the
competence's [Procedure](../operation/procedures.md) is **Approved** — a certified
person whose method is still `In Progress`/`To Do` waits for the approval. A new
requirement landing on the ticket narrows eligibility until certifications catch up
(bind it to the task's Procedure so the certified competences absorb it; the
procedure's own Users column keeps pointing at the eligible people).
