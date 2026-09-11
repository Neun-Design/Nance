# EDQMS — Wiki de Desenvolvimento

Bem-vindo(a) à documentação para **desenvolvedores e contribuidores** do EDQMS (Global Engineering Portal). Este wiki é o ponto de partida de quem vai **escrever código, desenhar interface ou trabalhar com os dados** do projeto — é distinto e separado da documentação de *stakeholders*, que trata do produto do ponto de vista de negócio.

> Projeto **open source**. Contribuições são bem-vindas já nesta fase. Se é sua primeira vez aqui, comece por **[[Getting Started]]**.

## O que é o EDQMS

O EDQMS é um portal de engenharia orientado a metadados: uma **especificação** (o *datamodel*) descreve módulos, tabelas, cards, gráficos, formulários e filtros, e um **motor** interpreta essa especificação e renderiza a aplicação genericamente. Entender esse conceito é a chave para contribuir — veja **[[Architecture Overview]]** e **[[Working with the Datamodel]]**.

## Mapa da documentação

| Página | Para quê |
|---|---|
| [[Getting Started]] | Pré-requisitos, clonar, instalar, rodar app/API/testes/ETL. |
| [[Architecture Overview]] | Visão geral: spec → motor → renderer/API, stack e princípios. |
| [[Working with the Datamodel]] | Como o datamodel funciona (config-as-code) e como adicionar campos/entidades. |
| [[Data and Migration Pipeline]] | Formato de export, ETL JSON→Postgres e ferramentas de dados em Python. |
| [[Contributing]] | Fluxo de trabalho, convenções, PRs e contexto de IA compartilhado. |
| [[Glossary]] | Termos do domínio (module, dashboard, card, report, rollup, mirror, subitem…). |

## Onde vivem as decisões

As **decisões de arquitetura** ficam no repositório, em `docs/adr/` (o *ADR log*), não aqui — este wiki explica *como trabalhar*; os ADRs explicam *por que* o projeto é como é. Quando um "porquê" for relevante numa página, ela aponta para o ADR correspondente.

## Fonte deste wiki

Este conteúdo é **escrito e versionado em `docs/wiki/` no repositório** e publicado aqui no GitHub Wiki. Para corrigir ou ampliar uma página, edite o arquivo correspondente em `docs/wiki/` e abra um PR — não edite direto pela interface do wiki, para não divergir do código (ver ADR-0005).
