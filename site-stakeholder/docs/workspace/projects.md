---
title: "Projects"
audience: stakeholder
purpose: "Projects — what it is, when to register one, and its key fields"
---

# Projects

**What it is:** a customer engagement grouping tickets, executed under the customer's
contracts.
**Register when:** phase 8, once CRM (including [SLAs](../crm/sla.md)) exists.
**Key fields:** Registry ID; Name; `Unit *` (grouped by segment) → unlocks `Customer *`
(the unit's customers) → **Branch** (optional — the customer's branches) → **SLA**
(multi — the customer's contracts this project executes under, narrowed to the chosen
Branch; a contract without a branch is not branch-specific and stays offered); Owner;
Status. The coverage column (product scopes) derives from the linked SLAs.
