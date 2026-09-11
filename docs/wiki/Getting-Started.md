# Getting Started

Guia para colocar o EDQMS rodando na sua máquina. Se algum passo falhar, abra uma *issue* — corrigir este guia é uma contribuição válida.

## Pré-requisitos

O projeto é poliglota: a aplicação é TypeScript (Vue/Express/Node) e as ferramentas de dados são Python. Você vai precisar de:

- **Node.js** (LTS atual) e **pnpm** — gerenciador de pacotes do monorepo.
- **Python 3.11+** — scripts de dados, ETL e validação (ver [[Data and Migration Pipeline]]).
- **PostgreSQL** — banco da aplicação (local via Docker é suficiente para desenvolver).
- **Git**.

## Layout do monorepo

```
edqms/
├─ apps/
│  ├─ web/     # Vue 3 + shadcn-vue (o renderer / SPA)
│  └─ api/     # Express + Node (REST + motor + autenticação)
├─ packages/
│  ├─ engine/  # motor de metadados em TS (agnóstico de framework)
│  ├─ spec/    # datamodel config-as-code → JSON compilado
│  └─ db/      # schema Drizzle (gerado da spec) + migrações
├─ tools/      # scripts Python: parse de dados, ETL, validação
├─ docs/       # documentação (adr/ e wiki/)
└─ .claude/    # contexto de IA compartilhado
```

Por que separado assim: o **núcleo** (`packages/engine` e `packages/spec`) é TypeScript puro, **sem dependência de framework**, então roda e é testado sem subir Vue nem Postgres. Só as cascas `apps/web` e `apps/api` conhecem a tecnologia concreta.

## Passo a passo

```bash
# 1. Clonar e instalar
git clone <url-do-repo>
cd edqms
pnpm install

# 2. Subir um Postgres local (exemplo com Docker)
docker run --name edqms-db -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres

# 3. Configurar variáveis de ambiente
cp .env.example .env        # ajuste DATABASE_URL, credenciais de e-mail, etc.

# 4. Compilar a spec e gerar/migrar o schema
pnpm spec:build             # datamodel config-as-code -> datamodel.json
pnpm db:migrate             # aplica as migrações Drizzle no Postgres

# 5. (Opcional) Semear dados de exemplo
pnpm db:seed

# 6. Rodar em desenvolvimento
pnpm dev                    # sobe apps/web e apps/api juntos
```

Abra o endereço que o `apps/web` imprime no console. A API responde em `/api/v1`.

## Rodando os testes

```bash
pnpm test          # Vitest: motor (engine) e camadas TS
pytest tools/      # testes das ferramentas de dados/ETL em Python
```

Mantenha ambos verdes antes de abrir um PR (ver [[Contributing]]).

## Trabalhando com dados

Para experimentar a migração de um snapshot JSON sem tocar no banco, use o modo *dry-run* do ETL — detalhes em [[Data and Migration Pipeline]].

> Os comandos `pnpm ...` acima são o padrão-alvo do monorepo v1. Se algum script ainda não existir no seu checkout, confira `package.json` e `tools/README.md`, e sinta-se livre para abrir um PR padronizando.
