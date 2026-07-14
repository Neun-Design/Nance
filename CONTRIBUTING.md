# Contributing to EDQMS

EDQMS welcomes contributions from developers, project managers, documentation writers,
and stakeholders. This guide explains how to collaborate without stepping on each other.

---

## Branch naming

Every change must live on a branch before it reaches `main`. Direct pushes to `main` are
blocked.

| Type | Pattern | Who uses it |
|---|---|---|
| New feature | `feat/<scope>/<slug>` | Developers |
| Bug fix | `fix/<scope>/<slug>` | Developers |
| Documentation | `docs/<audience>/<slug>` | Docs writers, PMs, stakeholders |
| Prototype / UI | `design/<slug>` | Designers, developers |
| Data model | `data/<slug>` | Architects, developers |
| Tooling / CI | `chore/<slug>` | Developers |

**Scope tokens for `feat/` and `fix/`:** `prototype` · `docs` · `data` · `ci` · `infra`

Examples:
```
feat/prototype/add-quality-module
fix/prototype/filter-recompute-bug
docs/stakeholder/update-risk-section
design/drawer-spine-animation
data/add-nonconformity-entity
chore/upgrade-mkdocs
```

---

## PR title — Conventional Commits

PR titles must follow this format:

```
type(scope): short description in present tense
```

Examples: `feat(prototype): add Quality module tabs` · `fix(data): correct risk RPN formula` ·
`docs(stakeholder): update Event Engine section`

The `validate-pr` Action will post a comment if your branch name or PR title does not match.

---

## Opening a pull request

1. Push your branch and open a PR against `main`.
2. Add `?template=code_change.md` or `?template=docs_update.md` to the PR URL to load
   the right checklist.
3. Fill in the template. The `label-pr` Action will automatically tag the PR by the files changed.
4. CODEOWNERS assigns reviewers automatically.

---

## Issue templates

Open an issue and choose from:

| Template | Use when |
|---|---|
| **Bug report** | Something broken in the prototype or CI |
| **Feature request** | New capability for any part of the system |
| **Docs feedback** | Error or gap in the stakeholder or developer site |
| **Design feedback** | UI/UX issue in the interactive prototype |
| **Data model change** | ER diagram or entity-level modification |

Blank issues are disabled — if none of the templates fit, open a Discussion instead.

---

## Label taxonomy

Labels are applied automatically where possible. Manually add status labels to track progress:

| Label | Meaning |
|---|---|
| `status: triage` | Newly opened; not yet reviewed |
| `status: in-progress` | Being worked on |
| `status: blocked` | Waiting on a dependency or decision |
| `status: ready` | Ready for review or merge |

---

## Setting up labels (first time)

Run this script once after cloning (requires the `gh` CLI and repo write access):

```bash
# Type labels
gh label create "type: bug"        --color d73a4a --force
gh label create "type: feature"    --color 0075ca --force
gh label create "type: docs"       --color 0075ca --force
gh label create "type: design"     --color e4e669 --force
gh label create "type: data-model" --color 7057ff --force
gh label create "type: chore"      --color ffffff --force

# Status labels
gh label create "status: triage"      --color ededed --force
gh label create "status: in-progress" --color fbca04 --force
gh label create "status: blocked"     --color b60205 --force
gh label create "status: ready"       --color 0e8a16 --force

# Audience labels
gh label create "audience: dev"          --color 1d76db --force
gh label create "audience: pm"           --color 5319e7 --force
gh label create "audience: stakeholder"  --color f9d0c4 --force

# Priority labels
gh label create "priority: high"   --color d93f0b --force
gh label create "priority: medium" --color fbca04 --force
gh label create "priority: low"    --color c2e0c6 --force

# Module labels
for m in customers operation inventory workload control talent quality; do
  gh label create "module: $m" --color bfd4f2 --force
done
```

---

## Code review — on demand

Before opening a PR for any `feat/` or `fix/` branch, run a multi-agent code review:

```bash
/code-review ultra
```

For a PR that's already open on GitHub:

```bash
/code-review ultra <PR-number>
```

This runs parallel review agents that check code correctness, design-token compliance
(`--se-*` only), ISO 9001:2015 alignment (via `CLAUDE.md`), and security. Results appear
as a structured report in the terminal. Requires Claude Code CLI.

---

## Running the prototype locally

```bash
cd prototype
python3 -m http.server 8080
# open http://localhost:8080
```

The prototype is a static folder — no build step, no npm install.

---

## Running the docs site locally

```bash
pip install "mkdocs>=1.6" "mkdocs-material>=9.6"
cd site-stakeholder
mkdocs serve
# open http://localhost:8000
```
