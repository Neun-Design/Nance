---
title: "Performance"
audience: stakeholder
purpose: "Performance — what the view shows and where its numbers come from"
---

# Performance

**What it is:** how much the organisation *did* execute, and at what adherence. The view
compares the real execution times recorded on [Jobs](../workspace/jobs.md) against the
planned times that derive from each task's [Procedures](../operation/procedures.md).

**Register when:** never — this is a computed view. It only becomes meaningful once Jobs are
being closed with real start and end times.

**What to look for:** a task that consistently overruns its planned time is rarely a people
problem — it usually means the [Procedure](../operation/procedures.md) does not describe the
work as it is really done, or that the requirement set bound to it changed. That conclusion
is exactly what gets registered as an [Issue](issues.md).

!!! note "Roadmap: the Quality module"
    Control is evolving into the Quality module: a **Nonconformity flow** (deviations
    investigated and, when the cause routes to the risk class, elevated automatically to
    [Issues](issues.md)) and a **KPI builder** where managers define the indicators shown on
    each dashboard's Report section — see GitHub issues #124 and #125.
