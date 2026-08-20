---
title: "Ask AI"
audience: stakeholder
purpose: "How to use the site's built-in AI assistant: what it knows, what to ask, and what to expect"
---

# Ask AI

Every page of this site carries a **💬 button** in the bottom-right corner. It opens
**Ask AI** — an assistant that answers questions about nance.it from this documentation,
not from the open internet.

It is a working example of the principle on the [AI readiness](ai-readiness.md) page:
an assistant grounded in governed, structured content. When a question falls outside
what is documented, it says so and points you to the project team instead of inventing
an answer.

## What it knows

The assistant reads three sources, in order of authority:

| Source | Role |
|---|---|
| **This site** | Primary — every module and dashboard page, exactly as published |
| **Technical reference documents** | The data-model design rationale behind the site |
| **Project knowledge base** | The architecture and design-decision history of the platform |

Its knowledge is rebuilt automatically every time the documentation changes, so the
answers track the site you are reading — there is no separate document to keep in sync.

## How to use it

1. Click the **💬** button (any page).
2. Type your question and press **Enter** — ask in whatever language you prefer;
   it answers in kind.
3. Follow up naturally: the assistant remembers the conversation, so "and why after
   Events?" works as a next question.

Questions it handles well:

- *"What is a Payload, in plain terms?"*
- *"Why must Customers be registered after Branches?"* — the registration-order
  logic from [Start here](../start-here.md)
- *"How does an SLA limit which events a ticket can trigger?"*
- *"Which dashboards does the Talent module have, and in what order do I fill them?"*

## What to expect

!!! note "First answer can be slow"
    The assistant's server sleeps when nobody is using it. The **first question after a
    quiet period can take up to a minute** while it wakes up — subsequent answers arrive
    in a few seconds. If you see "temporarily unavailable", wait a moment and try again.

!!! tip "One conversation per tab"
    The conversation lives in your browser tab; **reloading the page starts a fresh
    one**. Very long conversations hit a size limit — if that happens, reload and
    continue with a new question.

!!! warning "Judgement stays with you"
    The assistant answers from the documentation, but it can still misread a nuance.
    For anything contractual or decision-critical, treat the site pages as the
    authority and confirm with the project team. Avoid pasting confidential customer
    data into the chat — questions are processed by an external AI service (Anthropic's
    Claude).
