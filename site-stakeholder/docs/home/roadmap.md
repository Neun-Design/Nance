---
title: "The shared roadmap"
audience: stakeholder
purpose: "How each adopting unit strengthens the platform for every other one"
---

# Every business unit makes Nance stronger

The [upstream-first policy](business-model.md#6-upstream-first-and-what-it-means-for-what-you-fund)
has a compounding effect that is easy to state and easy to underestimate.

```
Your unit's modelling needs        surface missing capabilities
            ↓
Funded development                 support hours become features
            ↓
Shipped to the open core           maintained forever, for everyone
            ↓
Every unit benefits                the roadmap accelerates for all
```

**More units on board means shorter time-to-feature, a stronger shared roadmap, and a
platform that outlives any single project.**

## Why modelling is what drives the roadmap

Features here are not invented in a product meeting. They are discovered when a real
organisation tries to model something real and finds the model will not hold it.

The Requirements architecture is the clearest example. It grew multi-dimensional
applicability — region, business unit, customer, scope, product group — because a large industrial enterprise's equipment repair & services unit needed to express obligations that varied
along all of those axes at once. That capability now exists for every adopter, including ones
whose requirements are far simpler — in the [public demo](https://neun-design.github.io/Nance/app/#/4/1), for instance, ANVISA RDC 611
Compliance applies only to the Brazilian regions, while HealthFirst Insurance's reporting
template applies only to that insurer's contracts.

Your unit's modelling session is therefore not just implementation work. It is the product
discovery that decides what the platform can express next.

## What this means when you join

**Early adopters shape the model.** The vocabulary of the system — what counts as an entity,
what an event dispatches, how competence gates staffing — is still being decided by the
operations being modelled in it. A unit that joins now influences that vocabulary; a unit that
joins in three years inherits it.

**Nothing you fund becomes orphaned.** The failure mode of enterprise customisation is the
private fork that nobody maintains after the consultant leaves. Upstream-first removes that
category of risk: what you fund is maintained by the project, not by you.

**You inherit everyone else's work.** The other side of not buying exclusivity is that you did
not pay for most of what you receive.

## What is on the roadmap now

The roadmap is organised as five public milestones on the
[issue tracker](https://github.com/Neun-Design/Nance/milestones), each with a dated target
and a costed backlog. The plan assumes one dedicated full-stack developer at 30 hours per
week — which is exactly why sponsored hours move dates — and the
[project board](https://github.com/orgs/Neun-Design/projects/1) carries the live,
issue-by-issue schedule.

| Milestone | Target | What it delivers |
|-----------|--------|------------------|
| [A0 — MVP Completion](https://github.com/Neun-Design/Nance/milestone/6) | Dec 2026 | All seven modules usable in the MVP: forecasting, execution tracking, issue management (opportunities and risks), the KPI builder and the Overview screen |
| [A1 — Web App (Beta)](https://github.com/Neun-Design/Nance/milestone/2) | Jul 2027 | The production web application: real database, role-based access control, company setup, and migration of the data accumulated in the MVP |
| [A2 — Cloud-Native](https://github.com/Neun-Design/Nance/milestone/7) | Aug 2027 | Self-hosting for enterprise clients — container, Ansible and CI/CD paths, with versioned releases and safe upgrades |
| [C1 — API & Integrations](https://github.com/Neun-Design/Nance/milestone/8) | Oct 2027 | A public REST API and webhooks, so planning tools such as MS Planner and monday.com consume the model instead of copying it |
| [B1 — AI-Readiness](https://github.com/Neun-Design/Nance/milestone/9) | Jan 2028 | The agents described under [AI readiness](ai-readiness.md), operating on the governed graph — always proposing, never silently deciding |

Two capabilities a mature governance system needs are **not yet scheduled**, and it is better
that you read that here than discover it in a workshop: an **immutable audit log**
(tamper-evident retention of the evidence that is already captured) and **temporal
versioning** (reconstructing what the model looked like on a given past date). They are
candidates for sponsorship, not silent assumptions.

Governance claims will not outrun the product on this site. Where something is planned rather
than present, it is labelled as planned.

## How priorities are decided

The roadmap is public, and so is the issue tracker. Priority follows two inputs: what the
modelling work in active engagements has proven necessary, and what supported units fund
directly through their engineering hours.

When two units need different things, the deciding question is which capability makes the
model more expressive for everyone — a feature that generalises beats a feature that only
serves one operation, and the second one gets reshaped until it generalises.
