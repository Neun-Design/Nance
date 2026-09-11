# ADR-0001 — v1 technology stack: Vue + Express + Node + Postgres

- **Status:** Accepted
- **Date:** 2026-09-11
- **Deciders:** Rafael Bova (project owner)
- **Related:** ADR-0002 (datamodel), ADR-0003 (migration), ADR-0004 (dev workflow)

## Context

The prototype is a vanilla JavaScript SPA, with no build step, in-memory data, and a fixed login. nance.it v1 will be **cloud-hosted** (provider-agnostic — any adopter deploys where they choose), with real persistence, a **pluggable authentication layer**, and will be **open source** (Apache-2.0). Three forces shape the stack choice:

First, the project must be **accessible to human developers** (and to UX/designers) and friendly to whatever AI tools each one chooses. This favors mainstream, explicit, low-"magic" technologies.

Second, there is an explicit **preference for Vue** over React, for being less opinionated and because single-file components (SFCs) favor more modular work — which tends to produce smaller, more focused files, easier to handle with AI assistants.

Third, the original UI requirement calls for **shadcn components**. shadcn/ui is React-only; the Vue equivalent is **shadcn-vue**, with the same philosophy (the component is copied into the project and stays under the team's control), built on Reka UI.

## Decision

Adopt the following stack for v1:

**Frontend.** Vue 3 with the Composition API and `<script setup>`, in **TypeScript**, bundled with Vite. UI components via **shadcn-vue** (Reka UI) on **Tailwind CSS**, with design tokens applied through the Tailwind theme (dark mode by default; the token set is theme-configurable per deployment). Charts via shadcn-vue *charts* (Unovis); ECharts (`vue-echarts`) remains an exception for charts the default library does not cover well. The frontend is a **REST API client**, with no duplicated business logic.

**Backend.** Node.js with **Express** in TypeScript, exposing a versioned **REST API** (`/api/v1/...`) documented in OpenAPI. The backend hosts the **metadata engine** (ADR-0002), which resolves derived values, joins, cards, and reports on the server side — the client only renders.

**Authentication (pluggable).** The reference implementation ships **email OTP/magic link**, with session in an httpOnly cookie and store in Postgres. Because nance.it is open source and any organization can fork and deploy it in its own environment, **nothing is tied to a specific identity provider or email domain**: each deployment plugs in its own auth — an email-domain allowlist, corporate SSO, OIDC, SAML, or similar — and applies whatever security restrictions it requires. The auth layer is isolated behind a small interface so swapping providers does not touch the rest of the application.

**Persistence.** **PostgreSQL**. Data access via **Drizzle** (schema-in-TypeScript and migrations via drizzle-kit), chosen for being SQL-transparent and for letting the schema be **generated from the datamodel's Model layer** (ADR-0002), avoiding a second source of truth. Derived fields are not persisted (recomputed by the engine). Arrays/multivalued fields use JSONB or association tables per cardinality.

**Monorepo.** pnpm workspaces + Turborepo, separating the engine (reusable and testable in isolation) from the framework-specific shells:

```
nance/
├─ apps/
│  ├─ web/         # Vue 3 + shadcn-vue (renderer)
│  └─ api/         # Express + Node (REST + engine + auth)
├─ packages/
│  ├─ engine/      # metadata engine in TS (framework-agnostic)
│  ├─ spec/        # datamodel config-as-code → compiled JSON (ADR-0002)
│  └─ db/          # Drizzle schema (generated from the spec) + migrations
├─ tools/          # Python data/ETL/validation scripts (ADR-0003)
├─ docs/adr/       # this log
└─ .claude/        # shared AI context (ADR-0004)
```

## Consequences

**Positive.** Vue 3 + SFC yields cohesive, small files, good for human review and for AI assistants. REST + OpenAPI is the most portable common denominator for contributors and for adopters integrating nance.it into their environment. Drizzle keeps SQL visible and the schema derivable from the spec. The engine on the backend eliminates data leakage to the client and centralizes computation. A pluggable auth layer lets each adopter meet its own security requirements without forking core code. Splitting into packages makes the engine testable without Vue or Postgres.

**Negative / costs.** shadcn-vue has a smaller ecosystem than React's shadcn/ui — some blocks (e.g. `dashboard-01`, `sidebar-07`) may require manual adaptation instead of a direct install. Separating frontend and backend (instead of a full-stack Next) adds a network boundary and CORS to manage. Contributors need familiarity with Vue 3 / Composition API.

**Neutral.** The framework choice is confined to the `apps/web` and `apps/api` shells; the core (`packages/engine` and `packages/spec`) stays agnostic, so a future change of renderer or server does not touch the domain logic.

## Considered alternatives

**React + Next.js (full-stack) + tRPC.** Discarded for contradicting the preference for Vue and for being more opinionated; tRPC also couples the client to TypeScript and is less familiar to open source contributors than REST.

**Nuxt (instead of Vue + plain Vite).** Brings useful conventions, but is more opinionated and "magical" than the low-friction goal calls for; Vue + Vite gives more explicit control.

**Prisma (instead of Drizzle).** Excellent DX, but its own schema DSL would create a second source of truth competing with the spec's Model layer. Knex (pure SQL-first) was considered as an equally valid, "less opinionated" alternative; it is recorded as an acceptable substitute if the team prefers hand-written SQL migrations.
