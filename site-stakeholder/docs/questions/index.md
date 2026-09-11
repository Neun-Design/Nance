---
title: "Q&A"
audience: stakeholder
purpose: "Common questions about nance.it — what it is, how it works, and how to use this documentation"
---

# Questions and Answers

The questions stakeholders ask most often when they first meet nance.it. If something you
need is not answered here, the module tabs above carry the operational detail.

---

## What is nance.it, in one paragraph?

An open-source platform where governance, quality management and operational knowledge are
**executed**, not just documented. Obligations, processes, procedures and people's competences
are registered as connected objects, so that every task is executed by certified people under
the right procedure — and the audit evidence is produced by the execution itself rather than
reconstructed afterwards.

---

## What does "Knowledge Driven Governance" actually mean?

It means the governance system runs on knowledge that has been made **explicit** — written
down, owned, and linked to the work it governs — instead of knowledge that lives in a few
experienced heads.

The practical test is simple: can someone who joined last month execute a critical task
correctly, without asking a colleague? If the answer depends on who is available that day,
the knowledge is not explicit and the governance is not real.

---

## Why event-driven, and not a periodic audit cycle?

A purely reactive operation responds to problems after they occur. A purely predictive one
tries to anticipate every scenario in advance, which in practice produces process libraries
nobody uses.

nance.it enables a third mode: **structured reactivity**. When an operational event occurs —
a customer request, a technical deviation, a handover between teams — the system already
knows which process applies, what requirements are in scope, and who is certified to execute
the response. Controls fire when the work happens, not at the next quarterly audit.

---

## How is this different from a document management system?

A DMS stores the procedure. nance.it **connects** it: to the requirement that makes it
mandatory, to the task it governs, to the competence that certifies who may run it, and to
the execution record that proves it was followed.

That difference is what turns a document library into governance. A procedure sitting in a
folder cannot stop an uncertified person from being staffed on critical work; a procedure
linked into the staffing chain can.

---

## What is the chain from obligation to evidence?

```
Requirement  →  Procedure  →  Competence  →  Execution  →  Evidence
```

- **[Requirement](../operation/requirements.md)** — norms, contracts and design limits registered per scope and product
- **[Procedure](../operation/procedures.md)** — the documented method for each task under its requirement set
- **[Competence](../talent/competence.md)** — who is certified to execute each procedure
- **[Execution](../workspace/tickets.md)** — tickets staffed only with certified people
- **Evidence** — who, when, under which procedure, captured automatically

Every module in this documentation is a segment of that chain.

---

## Is this an ISO 9001 certification project?

No. ISO 9001:2015 is used as the **architectural reference**, not the objective: risk-based
thinking, process decomposition, knowledge management, and accountability at every
operational node.

Traditional quality programmes treat the standard as the goal. They produce documentation for
audits, layer compliance checks on top of existing operations, and create a parallel structure
that does not change how work is actually done. nance.it inverts that logic — governance is
built into the execution architecture, so when an engineer responds to an event they are not
*consulting* the quality system, they are *using* it. ISO alignment becomes a consequence of a
well-designed governance structure rather than its cause, and the path to certification is
significantly shorter when it is needed.

---

## Why does the documentation insist on a registration order?

Because the data model does. Every mandatory field in a form points at something registered
earlier — a Branch needs its Business Unit, a Process needs its triggering Event, a Competence
needs the Product Scope it certifies.

Follow the order on the **[Start here](../start-here.md)** page and no selector will ever be
unexpectedly empty. You can always come back and add more records to an earlier module; the
order only matters for the first pass.

---

## Why is each module tab organised entity by entity?

Because that is how you will use it. When you are filling in a form in the app, you have one
question: *what is this dashboard for, when do I create a record here, and which field
unlocks which?* Each entity page answers exactly those three, and the "📖 Guide" link inside
the app opens the matching page directly.

---

## What is MVP mode, and where is my data stored?

Opening the app at `/app/mvp/` starts from a blank system so you can model your own
operation instead of browsing demo data.

Your records live in the **browser**, which is a cache and not a database. Use the `Save`
button in the top bar at every milestone and keep the downloaded file in a shared folder;
`Import` loads a saved session back. The app warns you if a file was saved under a different
schema version.

---

## Who owns what inside the system?

Every object carries an owner. That is deliberate — ISO 9001:2015 §5.3 requires
accountability at each node, and an unowned procedure is a procedure nobody maintains.

Some owners are chosen by you, others are seeded from the structure around them: a Payload
takes the Broker role from its event's owner, an SLA takes the quality manager of its
business unit. The module pages state which is which.

---

## How does the system improve itself?

Through the [Control](../control/index.md) module — the PDCA cycle of the governance system
itself. [Capacity](../control/capacity.md) and [Performance](../control/performance.md) show
what actually happened; investigating the gaps produces an [Issue](../control/issues.md), a
mapped opportunity or risk; and that Issue justifies the next new Scope, Requirement, Event
or revised Procedure.

A task that consistently overruns its planned time, for instance, is rarely a people problem —
it usually means the procedure does not describe the work as it is really done. That
conclusion is what gets registered, and the model changes because of it.

---

## Is the platform open source?

Yes — Apache 2.0. The code and the roadmap are public, so your IT organisation can inspect,
audit, extend and integrate everything, and it runs on a standard web stack that fits an
existing automation landscape. There is no per-seat cost and no vendor lock-in.

Neun Design maintains the open project and provides implementation, engineering and quality
management services around it. Features funded through that support are shipped to the open
core and maintained there for everyone.

---

## Why does this matter for AI?

You cannot delegate to AI what is not structured. A language model pointed at scattered PDFs
hallucinates with confidence; an agent operating over nance.it works on a **governed graph**
of requirements, procedures, competences and evidence.

That structure is the substrate every AI initiative needs, and the skeleton that frameworks
like ISO/IEC 42001 and the EU AI Act ask for. Modelling your system now is what makes the
useful cases — an internal audit agent, a compliance check before execution, an onboarding
tutor answering from *your* procedures — possible later.

---

## Where can I see it running?

A live demo with sample data is published at
[neun-design.github.io/Nance/app/](https://neun-design.github.io/Nance/app/) — no login required.
The demo shows **Vitalis Health Network**, a fictitious chain of diagnostic-imaging and
clinical-analysis clinics (12 branches across Brazil and Argentina), so any visitor can
navigate a fully populated system without industry background. The platform itself is
sector-agnostic: it is in implementation at a large industrial enterprise's equipment repair & services unit. The previous transformer dataset is preserved under the git tag
`demo-transformers-v1`.
