---
title: "The business model"
audience: stakeholder
purpose: "How an Apache-2.0 platform and the Neun Design services around it fit together"
---

# Open-source platform, professionally maintained

**You never pay for the software. You invest in the expertise to make it yours.**

That sentence is the whole model, and it is worth unpacking, because it inverts what
procurement usually expects.

## 1. The separation

There are two things on the table, and only one of them is sold.

| | The platform | The services |
|---|---|---|
| **What it is** | nance.it — the engine | Implementation, engineering and quality-management expertise |
| **Who provides it** | The open-source project | Neun Design |
| **What it costs** | Nothing. Ever. | The engagement you choose |
| **What you get** | The full product — no tier, no feature gate, no limits | People who know how to model a governance system inside it |

There is **no proprietary tier, no feature gate, no open-core split**. The version running in
production at an enterprise client is the version in the public repository. Nothing is held
back to be sold later.

**What is never charged for:** licences, seats, upgrades, feature unlocks, support for using
what already exists, or the right to run the software wherever you want.

**What is charged for:** the work of translating your obligations into a working operating
model, and the engineering hours to build capabilities the platform does not have yet.

## 2. Why the software is not the product

The insight this model is built on came from watching what clients actually struggle with.

The pain is not *"we lack a tool."* Plenty of tools exist. The pain is:

> *"We cannot translate our obligations — ISO 9001, IEC standards, contractual requirements,
> internal governance — into an operating model."*

That translation is difficult, domain-specific work. It is where the value is, and it is not
something a licence key delivers. So it is what Neun sells, and the platform is given away
because a better platform makes that work easier for everyone, including future clients.

## 3. What Apache 2.0 means in practice

The entire codebase is licensed **Apache 2.0**. For your IT and legal organisations that means:

- **Your legal review is short.** Apache 2.0 is one of the most widely accepted permissive
  licences in enterprise software. It carries an **explicit patent grant**.
- **No copyleft contamination.** You can integrate the platform with proprietary internal
  systems without any obligation to open your own code — a real concern with GPL/AGPL-licensed
  alternatives.
- **You can inspect everything.** Code and roadmap are public. Nothing about how your
  governance system behaves is opaque to the people accountable for it.
- **You can fork it.** If you ever need to go your own way, the licence permits it outright.
- **It runs on a standard web stack**, so it fits an existing automation landscape instead of
  demanding one.
- **No procurement wall.** A business unit can pilot the platform without a purchase order,
  and buy services later on demonstrated value rather than on a promise.

## 4. Your model is yours; the engine is everyone's

This is the distinction that makes "fully open" safe for an enterprise adopter, and it is
worth stating precisely.

**The engine is public.** The data model, the rules, the forms, the chain from requirement to
evidence — all of it is open source and shared.

**Your modelled content is yours and stays confidential.** Your processes, your requirement
registers, your procedures, your competence matrices, your customers and contracts are your
data. They are not published, not contributed upstream, and not visible to anyone else.

Open source applies to *how the system works*, never to *what you put in it*.

## 5. The services

Three lines, usually engaged in that order.

### Implementation and onboarding

A fixed-scope engagement that deploys the platform and stands up your first modelled domain —
one business unit, one process family. It covers installation, seeding the data model,
integrating with your identity and document infrastructure, and training the internal roles
that will own the system afterwards (the Broker and Quality Manager functions).

This is the [7-week playbook](implementation.md), already proven in the Power Transformer
Repairs & Services unit.

### Support plans

Recurring capacity, combining two kinds of hours drawn from the same pool:

| | What it covers | Who delivers it |
|---|---|---|
| **Engineering hours** | New features, integrations, upgrades, priority on bugs — all shipped upstream | Core developers |
| **Modelling hours** | Help modelling your QMS and governance inside the platform: requirement registers, procedures, competence matrices, event and payload design, audit preparation | Quality-management and process consultants |

The pairing is the point. A conventional open-source support plan sells insurance — someone to
call when something breaks. These plans sell the solution to the actual difficulty
(*modelling*), with engineering capacity attached for when modelling reveals something the
platform cannot yet do.

### Standalone consulting

Audit preparation, governance-gap assessments, process redesign — available independently of
the platform, for organisations that are not ready to deploy anything yet.

## 6. Upstream-first, and what it means for what you fund

Features requested by a client are **developed in the open by default** and land in the
public core.

That has a consequence worth stating plainly, because it is unusual: **when you fund a
feature, you do not buy exclusivity.** Another business unit — another company, even — gets
it too.

What you buy instead is:

- **Speed.** The capability exists when you need it, not when the roadmap eventually reaches it.
- **Perpetual maintenance.** Once a feature is in the core, it is maintained there forever, by
  the project. It does not become your private fork to keep alive.
- **A platform that keeps improving underneath you.** The same mechanism means every other
  adopter's funded work arrives in your instance too. See
  [The shared roadmap](roadmap.md).

The alternative — a private, closed customisation — is not a product line here. Exclusivity
applies to your modelled content, never to engine code.

## 7. Who maintains it, and what happens if Neun stops

The honest answer to the question every IT lead asks.

**Today:** Neun Design maintains the open project and stands behind it. The roadmap, the
issue tracker and the release history are public, so the level of activity is something you
can verify rather than take on trust.

**If that ever changed**, the Apache 2.0 licence is your continuity insurance, and this is not
a theoretical comfort:

- You already have the complete source code, with the right to run, modify and distribute it.
- You already have the documentation of the model, publicly published — this site.
- Your data is in your instance, in a documented schema, not in a vendor's cloud.
- Any competent engineering organisation — yours, or an integrator you choose — can take over
  maintenance. Nothing needs to be reverse-engineered or renegotiated.

This is the structural difference from a proprietary eQMS. There, vendor failure is an
existential event: the product stops, the data is hostage to an export format, and the
migration project is unplanned and expensive. Here, the worst case is that you need to source
maintenance from somewhere else.

## 8. How to start

The entry point is not a contract. It is the
[discovery workshop](implementation.md#step-1-discovery-workshop) — one week of scoping with
your key users, from which everything else follows.

Before that, you can install nothing, sign nothing, and still evaluate the whole product: the
[public demo](https://bovarafa.github.io/EDQMS/app/) is the real application, and
[Start here](../start-here.md) walks you through modelling your own operation in a blank
instance.
