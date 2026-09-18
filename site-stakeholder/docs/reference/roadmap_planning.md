# Roadmap Planning — Milestones, Issues & Timeline

> **Working document** — planning workspace for the detailed roadmap, derived from
> [`roadmap_plan.md`](roadmap_plan.md). Not stakeholder-facing content; once agreed, the
> outcome is materialized as GitHub milestones + issues in
> [Neun-Design/Nance](https://github.com/Neun-Design/Nance) and the timeline view in
> [org project #1](https://github.com/orgs/Neun-Design/projects/1).
>
> **Planning assumptions:** one dedicated full-stack developer at **30 h/week (~130 h/month)**,
> starting **2026-10-01**. All estimates are single-dev sequential; sponsor-funded hours
> parallelize work and pull target dates forward (see [Capacity](#capacity--sponsorship)).

---

## 1. Milestones overview

| ID | Name | Goal | Exit criteria | Start | Target |
|----|------|------|---------------|-------|--------|
| **A0** | MVP Completion | All seven modules usable in MVP mode | Overview, Control, Jobs, Forecasts/Forecast Scopes enabled in `/app/mvp/`; KPI builder shipping charts | 2026-10-01 | 2026-12-18 |
| **A1** | Web App (v1 / Beta) | Production web app per ADR-0001..0004: Vue 3 + Express + Postgres, RBAC, admin setup | Client data migrated via ETL (ADR-0003); beta deployed; feature parity with MVP | 2027-01-04 | 2027-07-30 |
| **A2** | Cloud-Native Version | Self-hosting for enterprise clients: containers, Ansible, CI/CD | The three adoption paths (fork-from-zero / Docker / Ansible) documented and tested | 2027-08-02 | 2027-08-31 |
| **C1** | API & Integrations | Public REST API + webhooks so other tools connect to Nance | `/api/v1` public with keys/scopes; webhook subscriptions live; first external consumer (MS Planner or monday.com) | 2027-09-01 | 2027-10-29 |
| **B1** | AI-Readiness | AI features and agents on the governed graph | Ask AI v2 grounded on live data; MCP server; first two agents shipped | 2027-11-01 | 2028-01-29 |

> **Naming note (A2):** the source plan says *"Claude-Native Version"* but describes Docker,
> Ansible and CI/CD pipelines — this document assumes **Cloud-Native** was intended.
> If "Claude-Native" is deliberate (deep Claude integration), it belongs in B1 instead —
> flag it and we re-split.

> **Ordering note (C1 before B1):** the source plan lists B1 before C1, but the agents in B1
> consume the API surface that C1 builds (an agent acts through the same authenticated,
> scoped endpoints as any other client). Building C1 first also unlocks integration value
> for sponsors earlier. If a sponsor funds AI work specifically, B1 items that only need
> read access (Ask AI v2, Procedure assistant) can start in parallel with C1.

### Dependency chain

```
A0 (MVP complete) ──► A1 (Web App)──► A2 (Cloud-Native packaging)
       │                   │
       │                   └──► C1 (public API + webhooks) ──► B1 (agents on the API)
       │
       └── data hygiene (#424, #177) + export-contract freeze feed the A1 migration
```

### Existing GitHub milestone

`Beta Version Release` (1 open / 1 closed) currently holds #178 (RBAC). **Recommendation:**
rename it to **`A1 — Web App (Beta)`** and let it absorb the A1 backlog below; create the
other four milestones (`A0 — MVP Completion`, `A2 — Cloud-Native`, `B1 — AI-Readiness`,
`C1 — API & Integrations`) fresh.

### Project #1 setup reminder

Use **custom `Date` fields** (e.g. `Start`, `Target`) in the org project rather than the
built-in *Start date / Target date* fields — the built-in ones are restricted fields that
block project visibility changes (hit on 2026-09-18). Custom date fields drive the roadmap
layout the same way.

---

## 2. A0 — MVP Completion (est. ~230 h ≈ 2.5 months)

**Current gap** (from `js/app.js` MVP-mode gating): `BLANK_DISABLED_MODULES = {Overview,
Control}`, `BLANK_DISABLED_TABS = {CRM: Forecasts + Forecast Scopes, Workspace: Jobs}`.
Everything else is already live in MVP mode.

### Existing issues → A0

| Issue | Title | Fit |
|-------|-------|-----|
| [#124](https://github.com/Neun-Design/Nance/issues/124) | Nonconformity flow in the Control (Quality) module | Control / issue management — the bottom-up path that elevates deviations to Issues (Risks) |
| [#125](https://github.com/Neun-Design/Nance/issues/125) | KPI builder for dashboards and Overview | Control / KPI — the plan's monday.com-style dashboards item, verbatim |
| [#149](https://github.com/Neun-Design/Nance/issues/149) | Promotion signal — flag a userID at rank 3 | Talent polish inside the MVP |
| [#140](https://github.com/Neun-Design/Nance/issues/140) | Trim remaining subitem-display column sets | MVP polish |
| [#139](https://github.com/Neun-Design/Nance/issues/139) | Styled delete dialog to replace native confirm() | MVP polish |

Note: #124 and #125 carry the `scope: post-mvp` label — the new plan pulls them **into** the
MVP milestone; drop the label when assigning.

### New issues to create

> **Created 2026-09-18:** A0-1 → [#428](https://github.com/Neun-Design/Nance/issues/428), A0-2 → [#429](https://github.com/Neun-Design/Nance/issues/429), A0-3 → [#430](https://github.com/Neun-Design/Nance/issues/430), A0-4 → [#431](https://github.com/Neun-Design/Nance/issues/431), A0-5 → [#432](https://github.com/Neun-Design/Nance/issues/432)

| # | Draft title | Scope | Est. |
|---|-------------|-------|------|
| A0-1 | `feat(crm): enable Forecasts + Forecast Scopes in MVP mode` | Remove the two tabs from `BLANK_DISABLED_TABS`; verify the form cascades (#346 chains) hold on a blank dataset; stakeholder pages already exist | 20 h |
| A0-2 | `feat(workspace): Jobs in MVP mode — minimal execution tracking` | ClockingIt-inspired ([Fudge/clockingit](https://github.com/Fudge/clockingit)) but **minimal for MVP**: the existing lifecycle (Queued→Active→Stoped→Done, `realStartDate`/`realEndDate`/`jobBufferExecution`) is enough to feed reports and cards. Full ClockingIt-style transformation of Workspace is re-evaluated in A1 | 40 h |
| A0-3 | `feat(control): issue management — Opportunities & Risks` | Promote Issues from hidden registry (`dashboard-order: 0`) to a managed Control dashboard: triage states, owner, linkage to Events/Scopes; pairs with the #124 nonconformity intake | 32 h |
| A0-4 | `feat(overview): "Display on Overview" / "Display on a Table" toggles` | Every KPI chart built in #125 carries the two flags; Overview screen renders the flagged charts + filters; table-level placement renders the chart above the chosen dashboard | 24 h |
| A0-5 | `feat(app): enable Overview + Control modules in MVP mode` | Final integration — drop both from `BLANK_DISABLED_MODULES` once A0-3/#125/A0-4 land; walkthrough + Guide pages updated | 8 h |

**Sizing:** #125 KPI builder is the anchor (~60 h). Sequence: A0-1 → A0-2 → A0-3/#124 →
#125 → A0-4 → A0-5, with #149/#140/#139 as fillers.

---

## 3. A1 — Web App (est. ~840 h ≈ 7 months)

Everything per the accepted ADRs: [ADR-0001](../../../docs/adr/0001-v1-technology-stack.md)
stack (Vue 3 + shadcn-vue / Express / Drizzle / Postgres, monorepo),
[ADR-0002](../../../docs/adr/0002-datamodel-config-as-code.md) spec-as-source,
[ADR-0003](../../../docs/adr/0003-json-to-postgres-migration.md) ETL migration,
[ADR-0004](../../../docs/adr/0004-development-workflow-and-ai-context.md) workflow.

### Existing issues → A1

| Issue | Title | Fit |
|-------|-------|-----|
| [#178](https://github.com/Neun-Design/Nance/issues/178) | RBAC | Explicit A1 item ("Perfis de Usuario"); already in the Beta milestone. All the pre-RBAC filter-input FKs (#334 doctrine) become removal candidates here |
| [#158](https://github.com/Neun-Design/Nance/issues/158) | Design System | nance tokens applied through the Tailwind theme (ADR-0001) |
| [#177](https://github.com/Neun-Design/Nance/issues/177) | Naming convention | **Blocker for schema generation** — names freeze before Drizzle schemas are generated from the spec |
| [#424](https://github.com/Neun-Design/Nance/issues/424) | Remove dead attributes / Jobs::Report-A raw-key coupling | **Pre-migration data hygiene** — dead attrs must leave the model before the export contract freezes |
| [#5](https://github.com/Neun-Design/Nance/issues/5) | Settings calendar configurator | Admin/settings area |
| [#4](https://github.com/Neun-Design/Nance/issues/4) | Light/dark theme toggle | ADR-0001 ships dark-by-default with configurable tokens |

### New issues to create

> **Created 2026-09-18:** A1-1..8 → [#433](https://github.com/Neun-Design/Nance/issues/433)–[#440](https://github.com/Neun-Design/Nance/issues/440), A1-9..15 (module UIs, MVP walkthrough order) → [#441](https://github.com/Neun-Design/Nance/issues/441)–[#447](https://github.com/Neun-Design/Nance/issues/447), A1-16 → [#448](https://github.com/Neun-Design/Nance/issues/448)

| # | Draft title | Scope | Est. |
|---|-------------|-------|------|
| A1-1 | `chore(v1): freeze and version the prototype export contract` | ADR-0003 step 1 — `export_schema_version` + metadata in the prototype's export **now** (client accumulates production data daily). Depends on #424/#177 | 24 h |
| A1-2 | `chore(v1): monorepo scaffold` | pnpm + Turborepo; `apps/web`, `apps/api`, `packages/engine|spec|db`; CI base | 24 h |
| A1-3 | `feat(engine): port the metadata engine to a TS package` | `model.js`/`resolve.js`/rule mini-DSL → `packages/engine`, framework-agnostic, Vitest suite ported from the ~80-proof battery | 120 h |
| A1-4 | `feat(db): generate Drizzle schema from the spec Model layer` | Single source of truth: `packages/spec` → Drizzle schemas + drizzle-kit migrations; arrays → JSONB/association tables per cardinality | 40 h |
| A1-5 | `feat(etl): JSON → Postgres idempotent ETL` | ADR-0003 four-stage pipeline (`tools/etl/`, Python, pytest); `--dry-run`/`--load`/`--report`; migration log table | 60 h |
| A1-6 | `feat(api): Express REST API /api/v1 + OpenAPI` | Server-side engine resolution (derived values, joins, cards, reports); the client only renders. Internal in A1; C1 makes it public | 80 h |
| A1-7 | `feat(auth): pluggable auth — email OTP reference implementation` | httpOnly session, Postgres store, small provider interface (SSO/OIDC/SAML swappable per deployment) | 40 h |
| A1-8 | `feat(admin): company setup & site configuration pages` | The page *before* the current model: company → divisions (a Business Segment lives inside a Division) → admins & users. Includes access/profile configuration UI (pairs with #178) | 48 h |
| A1-9..15 | `feat(web): <module> UI in Vue 3 + shadcn-vue` (×7) | One issue per module (Organization, Portfolio, CRM, Talent, Operation, Workspace, Control+Overview); forms, dashboards, subitem tabs, cards — parity with the MVP | ~280 h |
| A1-16 | `feat(web): micro-frontend architecture for subitem tables` | Subitem-tables get their own frontend units, per the plan's micro-frontend requirement | 40 h |

**Sequencing:** #177 + #424 + A1-1 first (they protect the client's accumulating data), then
scaffold → engine → db → api → auth in a walking skeleton, then module UIs in the same order
as the MVP walkthrough. #178 RBAC lands after auth + admin (A1-7/A1-8).

---

## 4. A2 — Cloud-Native Version (est. ~130 h ≈ 1 month)

Three adoption paths for enterprise teams, each independently viable:

1. **Fork from zero** — repo + docs are sufficient to build the environment from scratch;
2. **Container** — Docker / docker-compose;
3. **Ansible** — `.yml` config deployed to the provider of choice.

### New issues to create

> **Created 2026-09-18:** A2-1..6 → [#449](https://github.com/Neun-Design/Nance/issues/449)–[#454](https://github.com/Neun-Design/Nance/issues/454)

| # | Draft title | Scope | Est. |
|---|-------------|-------|------|
| A2-1 | `feat(devops): Dockerfile + docker-compose (app + Postgres)` | Multi-stage build, production compose with volumes/backup notes | 24 h |
| A2-2 | `feat(devops): GitHub Actions CI/CD — build, test, publish images` | Test battery + image publishing to GHCR on release tags | 24 h |
| A2-3 | `feat(devops): Jenkins pipeline reference` | Jenkinsfile mirroring the Actions pipeline, for enterprises standardized on Jenkins | 16 h |
| A2-4 | `feat(devops): Ansible playbook for provider-agnostic deployment` | Roles for app, Postgres, reverse proxy, TLS; sample inventories | 32 h |
| A2-5 | `docs(devops): self-hosting guide — the three adoption paths` | One page per path + upgrade guidance | 16 h |
| A2-6 | `chore(release): versioned releases & upgrade path` | Semver + changelog; upgrades carry drizzle migrations and datamodel `schemaVersion` bumps together | 16 h |

---

## 5. C1 — API & Integrations (est. ~250 h ≈ 2 months)

Externalizes the A1-6 internal API. The platform is *event-driven* — webhooks are the natural
outward face of the same engine.

### New issues to create

> **Created 2026-09-18:** C1-1..6 → [#455](https://github.com/Neun-Design/Nance/issues/455)–[#460](https://github.com/Neun-Design/Nance/issues/460)

| # | Draft title | Scope | Est. |
|---|-------------|-------|------|
| C1-1 | `feat(api): public API v1 — keys, scopes, rate limiting` | API keys with RBAC-aligned scopes; per-key rate limits; published OpenAPI portal | 60 h |
| C1-2 | `feat(api): webhook subscriptions on state transitions` | Subscribe to ticket status changes, job lifecycle stamps, SLA changes, GAP detected, procedure approval flips; signed deliveries + retry | 60 h |
| C1-3 | `feat(integrations): Gantt/planning consumers — MS Planner & monday.com` | The `TASKORDER` fixed-depth outline (issue #302) was designed for exactly these consumers; push ticket task chains as plans | 48 h |
| C1-4 | `feat(api): import/export endpoints on the versioned export contract` | The ADR-0003 contract as an API surface — snapshot export, validated import | 32 h |
| C1-5 | `feat(integrations): notification channels — email + Teams/Slack` | Event-driven notifications riding the C1-2 webhook engine | 32 h |
| C1-6 | `feat(integrations): Zapier/n8n connector` | Stretch — lowest-effort long-tail integration once C1-1/C1-2 exist | 24 h |

---

## 6. B1 — AI-Readiness (est. ~330 h ≈ 2.5 months for the first wave)

Grounding: the stakeholder site already commits to a vision
([AI readiness](../home/ai-readiness.md) — *"an agent operating over nance.it works on a
governed graph"*) and names four agents. An **Ask AI chatbot already exists**
(issue #224, `edqms-chat-api` on Render, static CLAUDE.md-in-prompt). B1 turns the promise
into features, in this order:

### New issues to create

> **Created 2026-09-18:** B1-1..7 → [#461](https://github.com/Neun-Design/Nance/issues/461)–[#467](https://github.com/Neun-Design/Nance/issues/467)

| # | Draft title | Scope | Est. |
|---|-------------|-------|------|
| B1-1 | `feat(ai): Ask AI v2 — ground the chatbot on the governed graph` | Replace the static embedded context with retrieval over the live datamodel spec + wiki/docs + (scoped) instance data through the C1 API; answers cite the entities they read | 48 h |
| B1-2 | `feat(ai): MCP server for Nance` | Expose the public API as MCP tools (query entities, traverse requirement/competence chains, create tickets) so any MCP client — Claude, Cursor, enterprise agents — operates on Nance with RBAC-scoped keys | 40 h |
| B1-3 | `feat(ai): compliance agent — pre-execution staffing & procedure checks` | The engine already computes the gates (certified-responsible, `procedureApproved`, GAP columns); the agent watches transitions and *explains* violations before execution, instead of next month's report | 48 h |
| B1-4 | `feat(ai): procedure assistant — draft SOPs from tribal knowledge` | Interview-style drafting of Procedures from task/workflow context; attacks the original bottleneck (writing procedures). Output = draft rows for human approval, never auto-published | 56 h |
| B1-5 | `feat(ai): internal audit agent — traceability walker` | Walks requirement → procedure → competence → evidence chains, verifies coverage, drafts findings into the Control module (pairs with #124's nonconformity flow) | 56 h |
| B1-6 | `feat(ai): onboarding tutor` | Answers new hires strictly from the instance's procedures/requirements; refuses to invent — scoped retrieval only | 40 h |
| B1-7 | `feat(ai): modelling assistant — natural language → datamodel spec drafts` | From a modelling-workshop transcript, draft `packages/spec` module changes as a PR (ADR-0002 config-as-code makes the spec itself AI-writable). Longer-term; may slip past the milestone | 40 h |

**Governance guardrail (applies to every B1 issue):** agents propose, humans approve —
drafts and flags, never silent writes. This keeps the ISO/IEC 42001 / EU AI Act posture the
stakeholder site claims: provenance, ownership, traceability, human accountability.

---

## 7. Capacity & sponsorship

**Base capacity:** 1 full-stack dev × 30 h/week ≈ 130 h/month ≈ 1,560 h/year.

| Milestone | Est. hours | Months (single dev) | Window |
|-----------|-----------|---------------------|--------|
| A0 | ~230 h | 2.5 | Oct – Dec 2026 |
| A1 | ~840 h | 7 | Jan – Jul 2027 |
| A2 | ~130 h | 1 | Aug 2027 |
| C1 | ~250 h | 2 | Sep – Oct 2027 |
| B1 | ~330 h | 2.5 | Nov 2027 – Jan 2028 |
| **Total** | **~1,780 h** | **~15 months** | **Oct 2026 – Jan 2028** |

**What sponsorship changes.** The [business model](../home/business-model.md) converts
support hours into upstream features. On this plan that is concrete: a sponsor funding a
second developer during A1 compresses the critical path by ~3 months (module UIs
parallelize cleanly after the walking skeleton); funding a specific B1/C1 item pulls it
forward without displacing the A-track, since those tracks touch different surfaces.
Estimates carry ±30 % — they are re-baselined at each milestone close.

---

## 8. Next actions

- [x] Review this plan — approved 2026-09-18 (A2 naming = Cloud-Native confirmed; C1 before B1 confirmed)
- [x] Rename `Beta Version Release` → `A1 — Web App (Beta)`; create milestones A0, A2, B1, C1 (due dates set; GitHub milestone numbers 6/2/7/8/9)
- [x] Re-label #124/#125 (`scope: post-mvp` → `scope: mvp`) and assign all 11 open issues to milestones per the tables above
- [x] Create the new issues — 40 created 2026-09-18 ([#428–#467](https://github.com/Neun-Design/Nance/issues?q=is%3Aissue+created%3A2026-09-18)); milestone totals: A0 10, A1 22, A2 6, C1 6, B1 7
- [ ] Add all issues to [project #1](https://github.com/orgs/Neun-Design/projects/1) with custom `Start`/`Target` date fields and build the roadmap layout
- [ ] Update the stakeholder page [`home/roadmap.md`](../home/roadmap.md) — its "what is on the roadmap now" list should reference these milestones once they are public
