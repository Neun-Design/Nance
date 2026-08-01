---
title: "App Guide — Talent"
audience: stakeholder
purpose: "What to register in the Talent module and in which order"
---

# Talent

People, their functions and the certified competences that gate execution (ISO 9001:2015 §7.2).
Phase 4 covers the people basics; **Competence and Onboarding are phase 6** — they need the
Events registered in [Operation](operation.md).

## Skill Levels

**What it is:** proficiency levels (with rank) required by roles.
**Register when:** first in the module.

## Graduation

**What it is:** formal education records (title, field, institution).
**Register when:** before People (each person picks one).

## Functions

**What it is:** job functions inside a business unit (e.g. Design Engineer).
**Register when:** after Units.
**Key fields:** Name; `Business Unit *`; Owner.

## Roles

**What it is:** a function at a skill level with a graduation — the unit of competence
requirements.
**Register when:** after Functions and Skill Levels.
**Key fields:** Name; `Function *`; Skill Level; Graduation.

## People

**What it is:** the people registry — every `Owner`/`Manager` selector in the app points here.
**Register when:** end of phase 4 (many earlier owner fields become richer once people exist —
it is fine to register a few key people early and return).
**Key fields:** the cascade `Region *` → `Unit *` → `Department *` → Squad; Branch; Name,
Email; `Function *`; Graduation.

## Competence

*(phase 6)* **What it is:** a certified capability: a role/level certified for a task chain
(event → process → task) on a scope + product group, with the requirements it certifies.
**Register when:** after Operation exists.
**Key fields:** `Function *` + `Skill Level *` → unlock Role; `Scope *` + `Product Group *` →
unlock Requirements (multi); `Event *` → unlocks Process → Task. The competence's department
derives from the chosen event automatically.

## Onboarding

*(phase 6)* **What it is:** the certification record of a person on a competence (with
training material and the certified flag) — Jobs only offer certified people as responsibles.
**Register when:** after Competences.
**Key fields:** `Department *` → unlocks Talent (people of the department) and, with the Role,
the Competence options (only competences of that department and role); Skill Rank; Training
URL; Certified.
