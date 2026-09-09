# Ticket Requirement Inheritance — the Executable Contract

**Purpose.** This is the specification of how a Ticket inherits Requirements — as a
map from each RULE to the test suite that proves it. Every suite runs in CI on every
push/PR (`.github/workflows/test-battery.yml`). When EDQMS is re-implemented "for
real" (database + frameworks), these suites ARE the acceptance contract: port the
rules, keep the tests passing.

The single entry point in the prototype engine is `ticketRequirements(ticket)`
(`prototype/js/resolve.js`), composed of `matchRequirements` (the dimension walk),
the context assembly (traces), and the deliberate-selection filter. The admission
side (`ticketAdmittedSLAs` → payloads → product scopes) feeds both the form options
and the inheritance context — one shared basis.

---

## Rule 1 — Declared constrains; undeclared does not (sv106, issue #382)

A Requirement declares its applicability across seven dimensions: `regionID`,
`businessUnitID`, `branchID`, `customerID`, `scopeID`, `productGroupID`,
`productScopeID`. A **declared** dimension must match the ticket's traces; an
**undeclared** (empty) dimension does not constrain. AND across dimensions. A blank
CONTEXT side (e.g. a ticket without parties) skips its dimension. Version-independent
— no legacy gate on this chain.

- Suite: `tools/test_engine_requirement_applicability.mjs` — per-dimension
  kill-switch walk (blank key → still inherits; declared-foreign → excluded),
  strip/tooltip wording, cardinality (customerID multivalued).
- Suite: `tools/test_engine_requirements_inheritance.mjs` (frozen reference rows) —
  the #226 chain end to end: scope/pg pairing, served regions, Inactive exclusion.

## Rule 2 — The exhaustive trace matrix (sv106/sv108)

**Comprehensiveness by construction:** every one of the 3⁷ = 2 187 combinations of
{declared-matching, declared-mismatching, undeclared} across the seven dimensions is
built as a real Requirement and checked against the oracle —
*inherits ⇔ no declared dimension mismatches*.

- Suite: `tools/test_engine_requirement_trace_matrix.mjs` — the matrix + explicit
  per-trace probes. Dimension → ticket trace map:
  | Requirement dimension | Ticket traces |
  |---|---|
  | `customerID` | project customer + applicant (the #308 pair). **Never the supplier** (Rule 5) |
  | `businessUnitID` | the ticket's unit |
  | `regionID` | the unit's served regions ∪ the OUTPUT branch's region |
  | `branchID` | the ticket's OUTPUT branch only (Rule 4) |
  | `scopeID` + `productGroupID` | paired against the SAME admitted product scope (#192 pairing) |
  | `productScopeID` | the admitted product scopes (payload chain ∩ chosen scope) |

## Rule 3 — The Registry unit never inherits (sv107, issue #384)

`Requirements.registryUnitID` (NOT NULL, wizard Registry step) is a pre-RBAC FILTER
only — it narrows the wizard options and is NEVER read by inheritance.
`businessUnitID` (nullable) is the optional unit-applicability dimension.

- Suite: `tools/test_engine_requirement_registry_unit.mjs` — the cross-unit probe
  (registered under BU01, scope-pinned, no unit applicability → inherits into a BU02
  ticket), role split, Constraints-picker posture (blank unit = every unit).

## Rule 4 — The OUTPUT branch is the branch context (sv108, issue #386)

`Tickets.branchID` — chosen below the Applicant, options = the Applicant's registered
branches — is the branch that RECEIVES the ticket's output and the ONLY branch trace.
Blank = dimension skipped. (Supersedes the project/party-branch union.)

- Suites: the trace matrix (branch arm) + `tools/test_engine_procedure_wizard.mjs`
  (the output-branch gate block) + the eligibility 1.2 branch case.

## Rule 5 — The supplier never imposes (sv108, issue #386)

A supplier answers its clients' requirements; it does not impose its own on a request
it must resolve. Supplier-pinned requirements are fully ignored by tickets.

- Suite: the trace matrix uses the SUPPLIER as the customer-dimension MISMATCH value
  — all 2 187 combinations actively prove the exclusion — plus explicit probes
  (supplier-pinned never inherits; a branch reachable only through Customer/Supplier
  registrations does not trace).

## Rule 6 — Constraints are a deliberate selection (sv109, issue #388)

Requirements flagged *Selectable on Tickets* appear as Constraints options. Once the
user picks **≥1**, the offered-but-unpicked ones leave the inheritance (deliberate
exclusion); never-offered requirements inherit normally. **Zero picks = no decision**
— inheritance untouched. Picks can only REMOVE, never add (#359 union retired).
Shared offered-set core: `selectableConstraintIds` (picker ↔ rule, no drift).

- Suite: `tools/test_engine_constraint_deliberate_selection.mjs` — the TIC-1 shape,
  zero-picks posture, the never-grows guarantee, unoffered passthrough.

## Rule 7 — The admission basis is Applicant → Supplier → Branch (sv110, issue #390)

`ticketAdmittedSLAs`: an SLA survives when the Applicant buys, the Supplier supplies
and the OUTPUT branch matches (an SLA without a branch is not branch-specific and
stays — #316; blank sides skip). Everything derives from this one basis: Event
options, Product Scope options, admitted scopes, the inheritance context and the
payload/SLA stored on save.

- Suite: `tools/test_engine_ticket_scope_sla_filter.mjs` — same pair across two
  branches + a branch-less contract: drops, survivals, skips; options/events/admitted
  all follow.

---

## Downstream consumers (guarded by their own contracts)

The inherited set (`need`) feeds the eligibility chain — same CI battery:

- **Procedure dispatch** (one Approved procedure covering ALL of `need`, redundancy
  named): `tools/test_engine_ticket_procedure_eligibility.mjs` — includes the LIVE
  re-evaluation loop (register a matching requirement → GAP → revisit → resolve).
- **User staffing** (certified onboarding → bound/exercisable competence → Approved
  procedures → AND coverage): `tools/test_engine_user_eligibility.mjs` — with a
  full-census independent re-derivation.

## Superseded readings (do NOT port)

- Q1 wildcard (*empty = applies to all, incl. future items*) — retired for coverage
  sets at sv98–101 (#364) and replaced by declared-constrains on Requirements at
  sv106. Empty COVERAGE sets (Procedures/Events/Payload/Processes/Handouts) cover
  nothing.
- The sv99 strict reading (*any undeclared dimension = inherits nowhere*).
- The sv105/sv106 branch union (project ∪ parties' branches) and the supplier as an
  inheritance party.
- The #359 manual union (Constraint picks ADDING requirements).

Frozen pre-sv98 snapshots keep their era's readings via `legacyWildcardData()` —
a prototype-only tolerance; the real implementation starts at the current semantics.
