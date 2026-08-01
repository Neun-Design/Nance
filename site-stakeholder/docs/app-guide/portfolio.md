---
title: "App Guide — Portfolio"
audience: stakeholder
purpose: "What to register in the Portfolio module and in which order"
---

# Portfolio

What the organisation offers (ISO 9001:2015 §4.3, §8.1): scopes of work, products, their
technical specifications and the requirements that bind them.

## Classes

**What it is:** a registry classifying scopes (e.g. Thermal), each tied to an Issue.
**Register when:** with the Issues, before Scopes.

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
**Key fields:** `Product *` → the form grows one input per spec assigned to that product; the
values become the group's SPECS summary shown everywhere.

## Requirements

**What it is:** the regulatory/design/commercial limits that bind scopes and product groups
(e.g. "IEC 60076 Compliance"). Applicability is multi-dimensional: region, unit, branch,
customer, scope, product group — **an empty dimension means "applies to all"**.
**Register when:** after Scopes and Product Groups.
**Key fields:** Name, Type (create new types inline with the "+" button); the applicability
cascade Region → Business Unit → Branch/Customer/Scope/Product Group; regulatory reference/URL.

## Product Scopes

**What it is:** the executable combination scope × product group for a business unit — the
thing Forecast Scopes and Workflows point at.
**Register when:** last in the module.
**Key fields:** `Business Unit *` → unlocks `Product Group *` (shown as product | SPECS) and
`Scope *`. The applicable Requirements derive automatically from the pair.
