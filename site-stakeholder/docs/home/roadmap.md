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
applicability — region, business unit, customer, scope, product group — because a transformer
repair department needed to express obligations that varied along all of those axes at once.
That capability now exists for every adopter, including ones whose requirements are far
simpler.

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

The platform is honest about its stage. Several capabilities that a mature governance system
needs are **funded roadmap items rather than shipped features**, and it is better that you
read that here than discover it in a workshop:

- **Immutable audit log** — evidence is captured today, but tamper-evident retention is still
  being built
- **Temporal versioning** — the ability to reconstruct what the model looked like on a given
  past date
- **Role-based access control** — beyond the current ownership model
- **The Quality module** — a nonconformity flow that investigates deviations and elevates them
  automatically to [Issues](../control/issues.md), plus a KPI builder for the dashboards

Governance claims will not outrun the product on this site. Where something is planned rather
than present, it is labelled as planned.

## How priorities are decided

The roadmap is public, and so is the issue tracker. Priority follows two inputs: what the
modelling work in active engagements has proven necessary, and what supported units fund
directly through their engineering hours.

When two units need different things, the deciding question is which capability makes the
model more expressive for everyone — a feature that generalises beats a feature that only
serves one operation, and the second one gets reshaped until it generalises.
