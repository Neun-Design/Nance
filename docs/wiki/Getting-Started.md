# Getting Started

Guide to get EDQMS running on your machine. If any step fails, open an *issue* — fixing this guide is a valid contribution.

## Prerequisites

The project is polyglot: the application is TypeScript (Vue/Express/Node) and the data tooling is Python. You will need:

- **Node.js** (current LTS) and **pnpm** — the monorepo package manager.
- **Python 3.11+** — data, ETL, and validation scripts (see [[Data and Migration Pipeline]]).
- **PostgreSQL** — the application database (local via Docker is enough for development).
- **Git**.

## Monorepo layout

```
edqms/
├─ apps/
│  ├─ web/     # Vue 3 + shadcn-vue (the renderer / SPA)
│  └─ api/     # Express + Node (REST + engine + authentication)
├─ packages/
│  ├─ engine/  # metadata engine in TS (framework-agnostic)
│  ├─ spec/    # datamodel config-as-code → compiled JSON
│  └─ db/      # Drizzle schema (generated from the spec) + migrations
├─ tools/      # Python scripts: data parsing, ETL, validation
├─ docs/       # documentation (adr/ and wiki/)
└─ .claude/    # shared AI context
```

Why it is split this way: the **core** (`packages/engine` and `packages/spec`) is pure TypeScript, **with no framework dependency**, so it runs and is tested without spinning up Vue or Postgres. Only the `apps/web` and `apps/api` shells know about the concrete technology.

## Step by step

```bash
# 1. Clone and install
git clone <repo-url>
cd edqms
pnpm install

# 2. Start a local Postgres (example with Docker)
docker run --name edqms-db -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres

# 3. Configure environment variables
cp .env.example .env        # adjust DATABASE_URL, email credentials, etc.

# 4. Build the spec and generate/apply the schema
pnpm spec:build             # datamodel config-as-code -> datamodel.json
pnpm db:migrate             # applies the Drizzle migrations to Postgres

# 5. (Optional) Seed sample data
pnpm db:seed

# 6. Run in development
pnpm dev                    # starts apps/web and apps/api together
```

Open the address that `apps/web` prints in the console. The API answers at `/api/v1`.

## Running the tests

```bash
pnpm test          # Vitest: engine and TS layers
pytest tools/      # Python data/ETL tests
```

Keep both green before opening a PR (see [[Contributing]]).

## Working with data

To try migrating a JSON snapshot without touching the database, use the ETL *dry-run* mode — details in [[Data and Migration Pipeline]].

> The `pnpm ...` commands above are the target standard for the v1 monorepo. If a script does not exist yet in your checkout, check `package.json` and `tools/README.md`, and feel free to open a PR standardizing it.
