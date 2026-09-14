# nance.it

***Govern·nance.it*** — an open-source, **knowledge-driven governance** platform.

**License:** Apache-2.0 · **Docs:** [Developer Wiki](https://github.com/Neun-Design/Nance/wiki) · [Architecture Decisions](docs/adr/)

> nance.it is a governance **execution** layer: an event-driven system where quality and governance obligations are *executed*, not just documented — producing audit evidence as a by-product of daily operations.

## The idea

Most quality and governance tools help you *write down* obligations — policies, procedures, requirement registers — and then hope they are followed. nance.it starts from the opposite end: obligations are modeled as **events and tasks executed by the right people**, and the record of that execution *is* the audit trail. Governance becomes "knowledge-driven" when decisions about processes and portfolio are informed by what the organization actually knows and does.

nance.it is built from two connected halves:

- **EDQMS — the quality-management engine.** Governs how the organization is structured and how work is controlled, through the **Organization**, **Portfolio**, and **Operation** modules (aligned with ISO 9001-style quality management).
- **Knowledge management.** Connects **task execution (Workload)** with **user competencies (Talent)** — so every obligation is matched to someone competent to execute it, and completion is captured as evidence.

## How it works

nance.it is **metadata-driven**: a single specification (the *datamodel*) describes modules, tables, cards, charts, forms, and filters, and an engine renders the whole application generically. Adding or changing a screen is a change to the spec, not scattered UI code. See the **[developer wiki](https://github.com/Neun-Design/Nance/wiki)** and the **[Architecture Decision Records](docs/adr/)** for the full picture.

## Try it live

nance.it runs in your browser — no install, no login. Three things are published as GitHub Pages:

- **[The Guide](https://neun-design.github.io/Nance/)** — a plain-language walkthrough of the platform's concepts and each module (Organization, Portfolio, CRM/SLAs, Talent, Operation, Workspace). Start here to understand *what* nance.it governs and *how* the pieces connect; new visitors should read the **[Start here](https://neun-design.github.io/Nance/start-here/)** page first.
- **[The demo app](https://neun-design.github.io/Nance/app/)** — the full application, pre-loaded with the **Vitalis** demo dataset (below). Navigate a completely populated governance portal to see how modules, cards, reports, and workflows behave with realistic data.
- **[The blank MVP](https://neun-design.github.io/Nance/app/mvp/)** — the same application, empty. Use it to model your own operation from scratch, following the **[Start here](https://neun-design.github.io/Nance/start-here/)** guide.

### The Vitalis demo

Governance only makes sense once there is something to govern — an organization, a portfolio, people, operations, and a history of work. Reproducing all of that by hand just to evaluate the platform is a lot of effort, so the demo app ships with it already in place.

**Vitalis Health Network** is a fictitious chain of diagnostic-imaging and clinical-analysis clinics across Brazil and Argentina. Its Clinical Operations & Quality division standardizes how every exam is performed, certifies who may perform it, forecasts demand per insurer contract, and measures what was actually consumed — the same governance loop nance.it models for any sector. Every clinic, person, contract, and ticket is invented for demonstration; the header carries a **DEMO DATA · Vitalis** badge and an "About this demo" panel.

Vitalis lets you explore the platform end to end — dashboards, competencies, SLAs, forecasts, audit trails — **without creating a single record yourself**. The model is sector-agnostic (it was born in an industrial-engineering division); clinics are simply the most self-explanatory dataset to walk through. When you want to see the empty starting point instead, open the [blank MVP](https://neun-design.github.io/Nance/app/mvp/).

## Tech stack

Vue 3 + shadcn-vue (frontend) · Node + Express REST API (backend) · PostgreSQL + Drizzle · a framework-agnostic TypeScript engine · Python data/ETL tooling. Rationale in [ADR-0001](docs/adr/0001-v1-technology-stack.md).

Authentication is **pluggable**: the reference build ships email OTP/magic link, and every deployment configures its own identity provider and access rules (domain allowlist, SSO, OIDC, …). Nothing is tied to a specific organization.

## Status

nance.it is moving from an interactive prototype to a cloud v1. The prototype validated the metadata-driven engine end to end; v1 re-implements it on the stack above with real persistence and pluggable auth.

## Getting started

Developers: start with **[Getting Started](https://github.com/Neun-Design/Nance/wiki/Getting-Started)** in the wiki.

## Documentation

- **[Developer wiki](https://github.com/Neun-Design/Nance/wiki)** — how to work on nance.it.
- **[Architecture Decision Records](docs/adr/)** — why the project is the way it is.
- **[Contributing guide](CONTRIBUTING.md)** — workflow, conventions, and shared AI context.

## Project model

nance.it is **100% open source** under **Apache-2.0** — no proprietary tier, no feature gate. The project is sustained by services around it (implementation, quality/process modeling, and support), and every client-funded capability lands upstream in the public core. The **code is free to use and fork**; the **"nance" name and the `nance.it` domain are reserved** — anyone may run the software, but only the project may sell it as "nance".

## Contributing

Contributions are welcome already at this stage. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) and the wiki, keep tests green (`pnpm test`, `pytest tools/`), and open a PR. Architecture changes should be accompanied by an ADR under [`docs/adr/`](docs/adr/).

## License

Licensed under the [Apache License 2.0](LICENSE).
