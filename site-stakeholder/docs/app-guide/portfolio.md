---
title: "App Guide — Portfolio"
audience: stakeholder
purpose: "What to register in the Portfolio module and in which order"
---

# Portfolio

What the organisation offers (ISO 9001:2015 §4.3, §8.1): scopes of work, products, their
technical specifications and the requirements that bind them.

## Classes

**What it is:** a registry classifying scopes (e.g. Thermal).
**Register when:** before Scopes.

## Scopes

**What it is:** the work scope boundaries applicable to products (e.g. Uprating, Redesign).
**Register when:** after Issues — each scope names the Opportunity that justifies it.
**Key fields:** Code, Name; `Business Unit *` (multi) → unlocks Opportunity (issues of the
unit's segments, grouped by type); Classification.

## Products

**What it is:** the product/service families quality events refer to (e.g. Autotransformer).
**Register when:** after Units.
**Key fields:** Name; `Business Unit *` → filters the Owner options.

## Product Specs

**What it is:** *dynamic attribute definitions* — each row defines a field (name, input type,
allowed values) that Product Groups of the chosen products must fill in.
**Register when:** after Products, before Product Groups.
**Key fields:** Spec name; `Input type *` (INT/DECIMAL/String/List — List unlocks Allowed
Values); `Products *` (multi) the spec applies to.

## Product Groups

**What it is:** a product variant defined by concrete spec values (e.g. "Autotransformer |
Voltage Rate: <=145").
**Register when:** after Product Specs.
**Key fields:** Class Code; `Business Unit` → unlocks `Product *` (the unit's products) → the
form grows one input per spec assigned to that product. **Expanding a group row lists its
specs** (name + value); the one-line SPECS summary column is hidden by default (Customize
Columns brings it back) but still feeds the group displays elsewhere. The segment derives
from the unit — there is no segment input.

## Events

**What it is:** the business occurrences that drive the QMS — the architectural pivot of the
model (moved here from Operation, 2026-08-12).
**Register when:** after Product Groups — Processes (Operation module) and Competence
(phase 6) anchor on events.
**Key fields:** Title, Description; `Business Unit *` → unlocks **Scopes** and **Products**
(multi — the event's applicability, distributed from the ER-model Payload; leave empty to
apply to all). The department is not registered here anymore — it moved down to the Process.
Expanding an event lists its Processes and the Product Scopes its applicability admits.

## Product Scopes

**What it is:** the executable combination scope × product group for a business unit — the
thing Forecast Scopes and Workflows point at.
**Register when:** last in the module.
**Key fields:** `Business Unit *` → unlocks `Product Group *` (shown as product | SPECS) and
`Scope *`. The applicable Requirements derive automatically from the pair.
