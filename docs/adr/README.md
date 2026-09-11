# Architecture Decision Records (ADR) — EDQMS

Este diretório registra as **decisões de arquitetura** do EDQMS (Global Engineering Portal). Cada ADR documenta *uma* decisão: o contexto que a motivou, a decisão tomada, as consequências e as alternativas descartadas. ADRs são **imutáveis depois de aceitos** — quando uma decisão muda, cria-se um novo ADR que *substitui* (`supersedes`) o anterior, preservando o histórico.

O objetivo deste log é duplo. Primeiro, dar rastreabilidade: qualquer contribuidor (ou ferramenta de IA) entende *por que* o projeto é como é sem arqueologia de commits. Segundo, servir de contexto compartilhado num projeto **open source** onde desenvolvedores, UX e frontend designers usam ferramentas de IA distintas — os ADRs são a fonte de verdade que todos alimentam em seus assistentes.

## Índice

| ADR | Título | Status |
|---|---|---|
| [0001](0001-stack-tecnologica-v1.md) | Stack tecnológica da v1: Vue + Express + Node + Postgres | Aceito |
| [0002](0002-datamodel-config-as-code.md) | Datamodel como config-as-code (Model / View / Behavior) | Aceito |
| [0003](0003-migracao-json-postgres.md) | Migração de dados JSON → Postgres via ETL idempotente | Aceito |
| [0004](0004-fluxo-de-desenvolvimento-e-contexto-de-ia.md) | Fluxo de desenvolvimento e contexto de IA compartilhado | Aceito (refinado por 0005) |
| [0005](0005-documentacao-de-contribuidores-no-github-wiki.md) | Documentação de contribuidores no GitHub Wiki | Aceito |

## Formato

Seguimos o **MADR** (Markdown Any Decision Records), enxuto: `Status`, `Contexto`, `Decisão`, `Consequências`, `Alternativas consideradas`. Numeração sequencial de quatro dígitos; nome do arquivo em kebab-case. Um novo ADR começa com status `Proposto`, vira `Aceito` após revisão, e pode terminar `Substituído por 00NN` ou `Descontinuado`.

Para propor uma decisão nova, copie um ADR existente como molde, preencha as seções, abra um PR e referencie a issue/discussão que a originou.

## Escopo e sequência

Estes ADRs cobrem a fundação da v1. Uma entrega depende da **implementação** deles e será tratada em seguida, não neste log:

1. **Materialização do contexto de IA** (`.claude/` com agents, skills e commands + `CLAUDE.md`) — a política está no ADR-0004; os arquivos em si entram quando o repositório v1 for criado.

> A antiga "aba Desenvolvedores na documentação de Stakeholders" foi **cancelada** pelo ADR-0005: a documentação de contribuidores passa a viver no **GitHub Wiki**, escrita e versionada em `docs/wiki/`. O conteúdo inicial do wiki já está em `docs/wiki/`.

## Princípio transversal

Uma decisão atravessa todos os ADRs e vale destacar de saída: **a especificação do sistema (o datamodel) e o motor que a interpreta são agnósticos de framework**. São TypeScript puro, sem dependência de Vue, Express ou Postgres. Só as camadas finas — o *renderer* (Vue), a *API* (Express) e o *loader/persistência* (Postgres) — conhecem a tecnologia concreta. Isso mantém baixo o custo de qualquer troca futura de framework e é o que permite tratar cada decisão abaixo de forma relativamente independente.
