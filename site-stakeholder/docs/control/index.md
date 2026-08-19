---
title: "Control"
audience: stakeholder
purpose: "The governance PDCA module: monitor execution, investigate process and procedure problems, and register the risks and opportunities that come out of them"
---

# Control

**Where the governance loop closes.** Every other module describes how work *should* run;
Control is where you look at how it *actually* ran, investigate what went wrong — or what
could go better — and turn that investigation into a registered **Issue**.

That Issue is not the end of the loop. It is the input to the next turn of it: a mapped
opportunity justifies a new [Scope](../portfolio/scopes.md), a mapped risk drives a new
[Requirement](../operation/requirements.md), a new [Event](../portfolio/events.md), a
revised [Procedure](../operation/procedures.md). This is the PDCA cycle of the governance
system itself (ISO 9001:2015 §9.1, §10.1) — the QMS auditing and improving its own model.

```
Capacity · Performance   →   investigation   →   Issue   →   new Event / Scope / Requirement / Procedure
     (Check)                     (Act)         (opportunity or risk)              (Plan → Do)
```

!!! note "Nothing to register for the dashboards"
    **Capacity** and **Performance** are computed views — they read what the other modules
    already contain and there are no forms to fill in. **Issues** is the one registered
    entity in this module, and today it is a hidden registry created inline from the Scopes
    form rather than from its own tab.

## Entities in this module

- [**Capacity**](capacity.md) — how much the organisation *can* execute: role and department capacity aggregated from People, working hours and squads.
- [**Performance**](performance.md) — how much it *did* execute, and at what adherence: real job execution times against planned task times.
- [**Issues**](issues.md) — the positive and negative factors carried forward from investigation (ISO §4.1/§4.2): Opportunities and Risks, the seed of the next modelling cycle.
