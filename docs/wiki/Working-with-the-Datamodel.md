# Working with the Datamodel

Esta é a página mais importante para quem vai mexer no comportamento do EDQMS. O *datamodel* é a especificação que descreve o sistema; quase toda mudança de tela, campo ou regra acontece aqui — não em código de UI espalhado. A decisão de fundo está no **ADR-0002**.

## Config-as-code, não JSON à mão

A especificação é escrita em **TypeScript** (em `packages/spec`) e **compilada** para um `datamodel.json` que o motor consome. Escrever em TS — e não em JSON puro — dá três coisas que o JSON não oferece: **reuso** (funções e composição), **tipos** (o compilador impede omitir ou grafar errado uma chave) e **comportamento como código** (funções, não frases em inglês).

## As três camadas

**Model** — entidades, atributos, tipos e relações estruturadas (FK/rollup/mirror como objetos, não prosa). É a fonte da forma dos dados: alimenta o schema do Postgres e a validação da migração.

**View** — o layout por tela: colunas visíveis, grid de cards, passos do formulário, tipo de gráfico. Referencia campos do Model por id e é **composta a partir de presets**.

**Behavior** — cascatas (`check`), filtros de opções e as queries de cards/reports, como **funções**.

## Derivar, não repetir

A regra de ouro: **não redeclare o que o Model já sabe.** Um formulário é "os campos do Model, menos estes, nestes passos, com estes overrides". Um atributo FK já rende um select cujas opções vêm da tabela-alvo; um numérico já entra na linha Σ. Você só escreve as exceções.

```ts
// presets definidos UMA vez
const fkSelect = (target, opts = {}) => ({
  component: "shadcn-vue:combobox",
  source: target,        // opções/label derivam do Model
  createNew: true,       // botão "+ criar novo" aninhado, por padrão
  ...opts,
});

// um form é derivação + overrides
export const TicketForm = formFor(Ticket, {
  steps: ["SELECT TEMPLATE", "SCHEDULE"],
  fields: {
    taskTemplate: {
      step: "SELECT TEMPLATE",
      check: (f) => f.ticket != null,             // cascata como função
      options: (f) => tasksForTicket(f.ticket),   // filtro como função
    },
  },
});
```

Consequência prática: **para adicionar um parâmetro a todos os campos de um tipo, você muda o preset (ou o `formFor`) em um lugar** — não cada instância.

## Tarefas comuns

**Adicionar um campo a uma entidade.** Declare o atributo no Model (nome, tipo, `rule` se for relação). Ele já aparece nas telas por derivação; ajuste a View só se quiser esconder/reordenar. Se for campo armazenado, gere a migração de banco (`pnpm db:generate`).

**Adicionar uma entidade nova.** Crie o arquivo de Model; adicione-a a um módulo na View; defina Behavior (cards/reports) se houver. Rode `pnpm spec:build` e os testes.

**Mudar uma regra de cascata.** Edite a função `check`/`options` no Behavior — com autocomplete e checagem de tipos, em vez de reescrever uma frase.

**Alterar uma query de card/report.** Edite a função correspondente no Behavior; garanta o teste Vitest verde.

## Compilar e validar

```bash
pnpm spec:build     # spec (TS) -> datamodel.json
pnpm test           # Vitest: motor + resolução + queries
pnpm db:generate    # (quando mudou o Model) gera migração Drizzle
```

A spec é validada por tipos e por um schema `zod` no build (ex.: toda tabela tem exatamente uma PK; todo FK aponta para entidade existente). Erros que antes viravam bugs silenciosos de *drift* passam a falhar o build.

## Referência

Decisão completa e alternativas descartadas (inclusive por que **não** usamos Lua nem JSON puro): **ADR-0002** em `docs/adr/`.
