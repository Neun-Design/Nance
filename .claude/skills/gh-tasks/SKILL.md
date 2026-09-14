---
name: gh-tasks
description: Manages GitHub collaboration for nance.it (Neun-Design/Nance) — code reviews, PR creation, issue filing, status checks, and conflict-safe backlog planning. Invoked as /gh-tasks [subcommand] [args]. Subcommands: review, plan, pr, issue <type>, status.
user-invocable: true
allowed-tools: Bash(gh *), Bash(git *)
---

# nance.it GitHub Tasks

You are the GitHub collaboration manager for the nance.it project (repository `Neun-Design/Nance`; EDQMS is its quality-management engine). When invoked via `/gh-tasks`, parse the first argument as a subcommand and execute the corresponding workflow below. If no subcommand is given, show a brief help menu listing the five subcommands.

---

## Subcommand: `review`

Runs a structured code review of the current branch against `main`.

**Steps:**

1. **Gather context**
   ```bash
   git branch --show-current
   git diff main...HEAD --stat
   git log main..HEAD --oneline
   ```

2. **Read the full diff**
   ```bash
   git diff main...HEAD
   ```

3. **Review against these criteria (check each):**

   | Criterion | What to look for |
   |---|---|
   | **Branch name** | Must match `feat/<scope>/<slug>`, `fix/<scope>/<slug>`, `docs/<audience>/<slug>`, `design/<slug>`, `data/<slug>`, or `chore/<slug>` |
   | **ISO 9001 alignment** | Any new entity or attribute must map to an ISO 9001:2015 clause. Check CLAUDE.md for the clause table. |
   | **Design tokens** | CSS must only use the nance design tokens — `--n-*` from `prototype/assets/tokens/nance-tokens.css` (the legacy `--se-*` names are compatibility aliases mapped to them). No raw hex, RGB, or Tailwind color utilities. |
   | **No console.log** | Scan JS/TS files for stray `console.log` calls (build/CLI scripts under `packages/*/scripts/` may print to stdout by design). |
   | **Prototype correctness** | If `prototype/` changed: data keys, chart config, drawer/form structure. |
   | **Data model integrity** | If the datamodel changed — always in `packages/spec/` (config-as-code, ADR-0002; every module is migrated since the cutover): every entity must have `*Owner` FK → User/Role; PK naming (`entityNameID`); relationships consistent across modules; `_meta.schemaVersion` bumped; and the compiled `datamodel.json` committed (the CI `spec` job's drift guard fails otherwise). Never hand-edit the JSON. |
   | **Security** | No hardcoded credentials, no `eval`, no `innerHTML` with unescaped user data. |

4. **Output a structured report:**

   ```
   ## Code Review — <branch-name>

   ### Summary
   <1-2 sentences on what the branch does>

   ### Findings
   | # | Severity | File | Finding |
   |---|---|---|---|
   | 1 | 🔴 Critical / 🟡 Warning / 🔵 Info | path/to/file:line | Description |

   ### ISO 9001 Alignment
   <List each new entity/change and its ISO clause, or "No data model changes">

   ### Verdict
   [ ] Ready to open PR   [ ] Needs fixes before PR
   ```

5. **After the report**, ask: "Open a PR now, or file issues for each finding first?"

---

## Subcommand: `plan`

Takes the findings from a previous `review` output and produces a conflict-safe, sequenced backlog of issues and PRs. The goal is to ensure no two branches ever touch the same file simultaneously.

**Input:** Paste the findings table from a `/gh-tasks review` run, or run `plan` immediately after `review` in the same session and it will use the findings already in context.

**Steps:**

1. **Load the findings.** Extract each row from the findings table: severity, file path, and description.

2. **Load the current GitHub state** to avoid duplicating work already in flight:
   ```bash
   gh issue list --state open --json number,title,labels,url
   gh pr list --state open --json number,title,headRefName,files,url
   ```

3. **Extract the file touch-list for every open PR:**
   ```bash
   gh pr diff <number> --name-only
   ```
   Run this for each open PR. Build a map: `filename → [open PR numbers that touch it]`.

4. **Group findings into work packages.**

   Apply these rules in order:
   - Findings that touch the **same file** must go into the **same work package** (they cannot live on parallel branches).
   - Findings in the **same module or ISO clause** are candidates for the same package even if they touch different files — group them unless the file count would make the PR too large (>10 files changed is a signal to split).
   - Findings of type `data` (entity/attribute changes) must be in their own package, isolated from `prototype` or `docs` changes, because data model PRs change the datamodel (`packages/spec/` and the compiled `prototype/data/datamodel.json`), which is a shared dependency of every screen.

5. **Detect conflicts with open PRs.**

   For each work package, check if any of its files appear in the open-PR touch-list built in step 3. If yes:
   - Mark the package as `⛔ BLOCKED — conflicts with PR #<number>`
   - The blocked package cannot start until that PR merges.

6. **Sequence the work packages into phases.**

   - **Phase 1** — packages with no file conflicts and no dependencies on other packages. These can be worked in parallel.
   - **Phase N** — packages that depend on a Phase N-1 package merging first (because they touch the same files or build on its output).
   - Blocked packages (conflicting with open PRs) are listed separately with the blocking PR called out.

7. **For each work package, propose:**
   - A **branch name** following the convention (`feat/<scope>/<slug>`, `data/<slug>`, etc.)
   - An **issue title** (one issue per work package, typed correctly: `bug`, `feature`, `data`, `design`, or `docs`)
   - The **severity** of the highest-severity finding in the package
   - The **files affected**

8. **Output the full plan:**

   ```
   ## EDQMS — Work Plan from Review

   ### Conflict map — open PRs
   | PR | Branch | Files it owns |
   |---|---|---|
   | #12 | feat/prototype/quality-module | prototype/js/module-loader.js, prototype/index.html |

   ### Phase 1 — parallel (no conflicts)
   | Package | Branch to create | Issue type | Severity | Files |
   |---|---|---|---|---|
   | P1-A | data/add-nonconformity-entity | data | 🔴 Critical | packages/spec/model/… → prototype/data/datamodel.json |
   | P1-B | fix/prototype/token-violations | bug | 🟡 Warning | prototype/css/drawer.css |

   ### Phase 2 — after Phase 1 merges
   | Package | Branch to create | Issue type | Severity | Depends on |
   |---|---|---|---|---|
   | P2-A | docs/stakeholder/reflect-nonconformity | docs | 🔵 Info | P1-A |

   ### Blocked — waiting on open PRs
   | Package | Blocked by | Files in conflict |
   |---|---|---|
   | P3-A (feat/prototype/drawer-fix) | PR #12 | prototype/js/module-loader.js |

   ### Recommended next actions
   1. File issues for Phase 1 packages → run `/gh-tasks issue <type>` for each.
   2. Open PRs for Phase 1 packages → run `/gh-tasks pr` on each branch.
   3. Once PR #12 merges, unblock P3-A.
   ```

9. **After showing the plan**, ask: "Shall I file the Phase 1 issues now, or do you want to adjust the groupings first?"

---

## Subcommand: `pr`

Creates or updates a GitHub Pull Request for the current branch.

**Steps:**

1. Check current branch and verify it is not `main`:
   ```bash
   git branch --show-current
   ```

2. Validate the branch name against the convention:
   - `feat/<scope>/<slug>` · `fix/<scope>/<slug>` · `docs/<audience>/<slug>` · `design/<slug>` · `data/<slug>` · `chore/<slug>`
   - Valid scopes for `feat/`/`fix/`: `prototype`, `docs`, `data`, `ci`, `infra`, `spec` (the config-as-code datamodel, ADR-0002); reserved for v1 (ADR-0001): `engine`, `db`, `api`, `web`
   - If invalid, warn and ask for confirmation before proceeding.

3. Determine the PR template:
   - Branch starts with `feat/`, `fix/`, `design/`, `data/`, `chore/` → use `code_change.md`
   - Branch starts with `docs/` → use `docs_update.md`

4. Build the PR title from the branch name following Conventional Commits:
   - `feat/prototype/add-quality-module` → `feat(prototype): add quality module`
   - `docs/stakeholder/update-risk-section` → `docs(stakeholder): update risk section`
   - `data/add-nonconformity-entity` → `data: add nonconformity entity`

5. Read the diff summary and the last few commits to draft the PR body:
   ```bash
   git log main..HEAD --oneline
   git diff main...HEAD --stat
   ```

6. Check if a PR already exists:
   ```bash
   gh pr list --head $(git branch --show-current) --json number,title,url
   ```
   - If it exists: offer to update the body with `gh pr edit`.
   - If not: create it.

7. Create the PR:
   ```bash
   gh pr create \
     --title "<title>" \
     --body "$(cat <<'EOF'
   ## What changed
   <summary from diff>

   ## Type of change
   - [x] <type>

   ## Checklist
   - [ ] Branch name follows convention
   - [ ] PR title follows Conventional Commits
   - [ ] prototype/ changes tested locally
   - [ ] No hardcoded colours — only nance --n-* tokens
   - [ ] No console.log in production paths
   - [ ] Datamodel changed? spec built, datamodel.json committed, schemaVersion bumped
   - [ ] CODEOWNERS review requested

   ## Related issues
   Closes #
   EOF
   )"
   ```

8. Print the PR URL.

---

## Subcommand: `issue <type>`

Files a GitHub issue using the correct template. `<type>` must be one of:

| type | Template used | Audience |
|---|---|---|
| `bug` | bug_report | dev |
| `feature` | feature_request | dev / pm |
| `docs` | docs_feedback | stakeholder / pm |
| `design` | design_feedback | designer |
| `data` | data_model_change | dev / architect |
| `chore` | *(no template — plain body)* | dev |

**Steps:**

1. If `<type>` is missing or invalid, list the valid types and ask which to use.

2. Ask for:
   - **Title** (must follow the template's prefix — e.g. `fix: ` for bug, `feat: ` for feature, `chore: ` for chore)
   - **Description** — what is wrong or needed
   - **Priority** — `high`, `medium`, or `low`
   - **Module** (optional) — `organization`, `portfolio`, `crm`, `talent`, `operation`, `workspace`, `control`

3. Map the type to labels:
   ```
   bug     → type: bug, status: triage, audience: dev
   feature → type: feature, status: triage
   docs    → type: docs, status: triage, audience: stakeholder
   design  → type: design, status: triage
   data    → type: data-model, status: triage, audience: dev
   chore   → type: chore, status: triage, audience: dev
   ```
   Always add `priority: <priority>`. Add `module: <module>` if provided.

4. Create the issue:
   ```bash
   gh issue create \
     --title "<title>" \
     --body "<description>" \
     --label "<label1>,<label2>,..."
   ```

5. Print the issue URL.

---

## Subcommand: `status`

Shows the current collaboration state of the repository.

**Steps:**

Run the following and format the output as a clean summary table:

```bash
# Open PRs
gh pr list --state open --json number,title,headRefName,labels,assignees,url

# Open issues by status
gh issue list --state open --json number,title,labels,assignees,url

# Draft PRs
gh pr list --state open --draft --json number,title,headRefName,url
```

**Output format:**

```
## EDQMS — Collaboration Status

### Open Pull Requests
| # | Title | Branch | Labels |
|---|---|---|---|
| ... | ... | ... | ... |

### Open Issues
| # | Title | Type | Priority | Status |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |

### Action items
<Any PRs waiting for review, issues with no assignee, blocked items>
```

---

## Conventions reference (always enforce)

**Branch naming:**
```
feat/<scope>/<slug>    fix/<scope>/<slug>    docs/<audience>/<slug>
design/<slug>          data/<slug>           chore/<slug>
```
Scopes: `prototype` · `docs` · `data` · `ci` · `infra` · `spec` (ADR-0002) — reserved for v1: `engine` · `db` · `api` · `web`

**Datamodel (ADR-0002) rules:**
- The datamodel is config-as-code in `packages/spec`, compiled to `prototype/data/datamodel.json`.
- Every module is edited **only** in `packages/spec/src/modules/` (then `npm run build` there); the JSON is a generated artifact. The CI `spec` job rejects hand edits (drift guard). A change to stored data needs a `prototype/tools/migrate_<slug>.py` and a seed update (wiki *Data and Migration Pipeline*).
- Any PR that changes modules/tables/attributes/rules bumps `_meta.schemaVersion` by 1 and commits the rebuilt `datamodel.json`.

**PR title (Conventional Commits):**
```
type(scope): short description in present tense
```

**Label taxonomy:**

| Group | Labels |
|---|---|
| Type | `type: bug` `type: feature` `type: docs` `type: design` `type: data-model` `type: chore` |
| Status | `status: triage` `status: in-progress` `status: blocked` `status: ready` |
| Audience | `audience: dev` `audience: pm` `audience: stakeholder` |
| Priority | `priority: high` `priority: medium` `priority: low` |
| Module | `module: organization` `module: portfolio` `module: crm` `module: talent` `module: operation` `module: workspace` `module: control` |
| Scope | `scope: mvp` (Organization/Portfolio/Operation/Talent) `scope: post-mvp` (Overview/CRM/Workspace/Control) |

**ISO 9001:2015 entity rules (for `review` and `issue data`):**
- Every entity must have `*Owner` FK → `User` or `Role`
- PKs follow `entityNameID` pattern
- New entities must map to a clause in the PDCA table in CLAUDE.md
- `riskCategory` is always `Threat | Opportunity` — never `negative | positive`
