# ADR-0001 — Stack tecnológica da v1: Vue + Express + Node + Postgres

- **Status:** Aceito
- **Data:** 2026-09-11
- **Decisores:** Rafael Bova (proprietário do projeto)
- **Relacionados:** ADR-0002 (datamodel), ADR-0003 (migração), ADR-0004 (fluxo de dev)

## Contexto

O protótipo do EDQMS é uma SPA em JavaScript vanilla, sem build, com dados em memória e login fixo. A v1 será hospedada em nuvem (Azure, conforme documento de arquitetura do MVP), com persistência real, autenticação por e-mail restrita ao domínio `@northwind-energy.com` e será **open source**. Três forças moldam a escolha de stack:

Primeiro, o projeto precisa ser **acessível a desenvolvedores humanos** (e a UX/frontend designers) e amigável às ferramentas de IA que cada um escolher usar. Isso pesa a favor de tecnologias mainstream, explícitas e pouco "mágicas".

Segundo, há uma **preferência explícita por Vue** em vez de React, por ser menos opinativo e por a organização em componentes de arquivo único (SFC) favorecer um trabalho mais modular — o que tende a produzir arquivos menores e mais focados, mais fáceis de manusear com assistentes de IA.

Terceiro, o requisito original de UI menciona **componentes shadcn**. shadcn/ui é exclusivo de React; o equivalente para Vue é o **shadcn-vue**, com a mesma filosofia (o componente é copiado para dentro do projeto e fica sob controle do time), construído sobre a Reka UI.

## Decisão

Adotar a seguinte stack para a v1:

**Frontend.** Vue 3 com Composition API e `<script setup>`, em **TypeScript**, empacotado com Vite. Componentes de UI via **shadcn-vue** (Reka UI) sobre **Tailwind CSS**, aplicando os tokens do nance Design System no tema do Tailwind, com modo escuro por padrão. Gráficos via os *charts* do shadcn-vue (Unovis); ECharts (`vue-echarts`) permanece como exceção para gráficos que a biblioteca padrão não cubra bem. O frontend é um **cliente da API REST**, sem lógica de negócio duplicada.

**Backend.** Node.js com **Express** em TypeScript, expondo uma **API REST** versionada (`/api/v1/...`) documentada em OpenAPI. O backend hospeda o **motor de metadados** (ADR-0002), que resolve valores derivados, joins, cards e reports do lado do servidor — o cliente só renderiza. Autenticação por **e-mail OTP/magic link** com allowlist de domínio imposta no servidor (integração `@auth/express` do Auth.js ou implementação mínima equivalente), sessão em cookie httpOnly e store no Postgres; desenhada para trocar por Entra ID no handoff futuro sem reescrever a aplicação.

**Persistência.** **PostgreSQL**. Camada de acesso via **Drizzle** (schema-em-TypeScript e migrações via drizzle-kit), escolhida por ser SQL-transparente e por permitir que o schema seja **gerado a partir da camada Model** do datamodel (ADR-0002), evitando uma segunda fonte de verdade. Campos derivados não são persistidos (recalculados pelo motor). Arrays/multivalorados usam JSONB ou tabelas de associação conforme a cardinalidade.

**Monorepo.** pnpm workspaces + Turborepo, separando o motor (reutilizável e testável isoladamente) das cascas específicas de framework:

```
edqms/
├─ apps/
│  ├─ web/         # Vue 3 + shadcn-vue (renderer)
│  └─ api/         # Express + Node (REST + motor + auth)
├─ packages/
│  ├─ engine/      # motor de metadados em TS (agnóstico de framework)
│  ├─ spec/        # datamodel config-as-code → JSON compilado (ADR-0002)
│  └─ db/          # schema Drizzle (gerado da spec) + migrações
├─ tools/          # scripts Python de dados/ETL/validação (ADR-0003)
├─ docs/adr/       # este log
└─ .claude/        # contexto de IA compartilhado (ADR-0004)
```

## Consequências

**Positivas.** Vue 3 + SFC dá arquivos coesos e pequenos, bons para revisão humana e para assistentes de IA. REST + OpenAPI é o denominador comum mais portável para contribuidores e para o handoff ao TI. Drizzle mantém o SQL visível e o schema derivável da spec. O motor no backend elimina o vazamento de dados para o cliente e centraliza a computação. A separação em pacotes torna o motor testável sem subir Vue nem Postgres.

**Negativas / custos.** shadcn-vue tem ecossistema menor que o shadcn/ui de React — alguns blocos (ex.: `dashboard-01`, `sidebar-07`) podem exigir adaptação manual em vez de instalação direta. Separar frontend e backend (em vez de um full-stack Next) adiciona uma fronteira de rede e CORS a gerenciar. Contribuidores precisam de familiaridade com Vue 3/Composition API.

**Neutras.** A escolha de framework fica confinada às cascas `apps/web` e `apps/api`; o núcleo (`packages/engine` e `packages/spec`) permanece agnóstico, então uma futura troca de renderer ou de servidor não toca a lógica de domínio.

## Alternativas consideradas

**React + Next.js (full-stack) + tRPC** — o desenho do documento de arquitetura do MVP. Descartado por contrariar a preferência por Vue e por ser mais opinativo; tRPC ainda acopla o cliente ao TypeScript e é menos familiar a contribuidores open source do que REST.

**Nuxt (em vez de Vue + Vite puro)** — traz convenções úteis, mas é mais opinativo e "mágico" do que o objetivo de baixa fricção pede; Vue + Vite dá controle mais explícito.

**Prisma (em vez de Drizzle)** — DX excelente, porém seu schema DSL próprio criaria uma segunda fonte de verdade concorrendo com a camada Model da spec. Knex (SQL-first puro) foi considerado como alternativa igualmente válida e "menos opinativa"; fica registrado como substituto aceitável se o time preferir migrações SQL escritas à mão.
