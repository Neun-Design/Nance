---
title: "Competence"
audience: stakeholder
purpose: "Competence — what it is, when to register one, and its key fields"
---

# Competence

*(phase 6)* **What it is:** a certified capability: a role/level certified for a task chain
(event → process → task) on a **product scope** (the scope × product-group pair in one key —
the separate Scope / Product Group selects are gone). The competence certifies a **group of
procedures** of its task (1:many, 2026-08-26) and inherits the **union** of their requirement
sets — a requirement never joins a competence automatically: the quality manager decides on
each [Procedure](../operation/procedures.md) (whose Requirements picker offers the Active
requirements aligned to the product scopes), and every competence certifying that procedure
inherits the decision. A user-given **Title** names the competence — with the group
cardinality, the title is what distinguishes and groups competences (it is the label shown
wherever a competence is listed, e.g. the Onboarding picker).
**Register when:** after Operation exists (including the task's Procedures).
**Key fields:** `Title *` (free text); `Function *` + `Skill Level *` → unlock Role;
`Event *` → unlocks Process → **Product Scope** (offered from the process's list; scope and
product group derive from it) → Task → Procedure (multi — the task's procedures this
competence certifies, restricted to the selected task). The competence's department derives
from the chosen process automatically.
