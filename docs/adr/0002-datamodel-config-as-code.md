# ADR-0002 — Datamodel como config-as-code (Model / View / Behavior)

- **Status:** Aceito
- **Data:** 2026-09-11
- **Decisores:** Rafael Bova (proprietário do projeto)
- **Relacionados:** ADR-0001 (stack), ADR-0003 (migração), ADR-0004 (fluxo de dev)

## Contexto

No protótipo, um único `datamodel.json` descreve todo o sistema — módulos, tabelas, atributos, cards, reports, formulários, filtros e subitens — e um motor (`model.js` + `resolve.js` + `queries.js`) o interpreta e renderiza genericamente. Esse desenho orientado a metadados é o maior ativo do projeto e deve ser preservado. Porém, autorar em JSON puro revelou três problemas:

**Sem mecanismo de abstração.** JSON não tem variáveis, referências, herança nem funções. Não há como fatorar repetição: adicionar um parâmetro a todos os campos de `form` exige editar cada instância manualmente. As instâncias carregam a especificação inteira em vez de apenas *overrides*.

**Comportamento como prosa.** As `rule`, os `check` ("Disable this field until Ticket has been selected"), os `field-rule` de cascata e o `rule` dos reports são, na prática, código escrito em inglês, interpretado por um parser tolerante ou mapeado à mão em `queries.js`. É lógica disfarçada de dado — frágil, não verificável e sem apoio de editor.

**Model, View e Controller conflados.** Schema (atributos, tipos, FKs), layout (grid de cards, colunas, passos do drawer, tipo de gráfico) e comportamento (regras, cascatas, queries) convivem nos mesmos nós, sem costura entre camadas.

O guia do datamodel já documenta bugs de *drift* decorrentes disso (ex.: a chave `overview-dislay` grafada errada em vários lugares; inconsistências de caixa), sintomas típicos de uma configuração sem validação nem tipos.

## Decisão

**Autorar o datamodel como config-as-code em TypeScript, separado em três camadas, e compilá-lo para um artefato JSON consumido em runtime.**

**Três camadas** (no pacote `packages/spec`, uma pasta cada):

- **Model** — entidades, atributos, tipos e **relações estruturadas** (FK/rollup/mirror como objetos tipados, não frases). É a fonte de verdade da forma dos dados e alimenta a geração do schema Postgres (ADR-0001) e o contrato de export/validação da migração (ADR-0003).
- **View** — layout por tela (colunas visíveis, grid de cards, passos do drawer, escolha de gráfico), referenciando campos do Model por id e **composta a partir de presets**.
- **Behavior** — cascatas (`check`), filtros de opções (`field-rule`) e definições de query de cards/reports, como **funções TypeScript**, não prosa.

**Derivar, não repetir.** A maior parte da View é *deduzida* do Model: um atributo FK vira um select cujas opções vêm da tabela-alvo; um numérico alinha à direita e entra na linha Σ. Cada tela declara apenas exceções. Um formulário é "os campos do Model, menos estes, nestes passos, com estes overrides" — não N specs completas.

**Presets reutilizáveis.** Arquétipos de campo (`fkSelect`, `dateRange`, `moneyInput`) definidos uma vez como funções-fábrica; instâncias os aplicam com overrides pontuais. Adicionar um parâmetro a todos os campos de um tipo passa a ser uma alteração em **um** lugar.

**Compilar para JSON.** Um passo de build serializa a spec resolvida em um `datamodel.json` (agora um artefato *gerado*, não escrito à mão), consumido pelo motor em runtime e pelo gerador de schema. Assim preserva-se o benefício do "artefato único" e a possibilidade de inspecionar a spec efetiva, sem pagar o custo de autorar JSON à mão.

**Validar por tipos + zod.** O compilador de tipos impede omitir chave obrigatória ou grafar nome errado; um schema `zod` valida invariantes de domínio no build (ex.: toda tabela tem exatamente uma PK; todo FK aponta para entidade existente). Os bugs de drift documentados deixam de ser possíveis.

Exemplo ilustrativo do padrão-alvo:

```ts
// behavior/presets.ts — arquétipos definidos UMA vez
const fkSelect = (target: Entity, opts: Partial<Field> = {}): Field => ({
  component: "shadcn-vue:combobox",
  source: target,          // opções e display derivam do Model
  createNew: true,         // botão "+ criar novo" aninhado, por padrão
  ...opts,
});

// view/tickets.form.ts — o form é DERIVAÇÃO + overrides
export const TicketForm = formFor(Ticket, {
  steps: ["SELECT TEMPLATE", "SCHEDULE"],
  fields: {
    taskTemplate: {
      step: "SELECT TEMPLATE",
      check: (f) => f.ticket != null,               // cascata como FUNÇÃO
      options: (f) => tasksForTicket(f.ticket),     // filtro como FUNÇÃO
    },
    // demais campos herdam do Model — não são redeclarados
  },
});
```

## Consequências

**Positivas.** A dor de DRY desaparece: mudanças globais são feitas no preset ou no `formFor`. O comportamento vira código verificável e autocompletável, testável com Vitest (os testes já existentes de `resolve`/`queries` migram para cá como rede de segurança). A separação de camadas torna o Model reutilizável pela migração e pela geração de schema. O motor permanece agnóstico de framework (ADR-0001).

**Negativas / custos.** Introduz um passo de build (spec TS → JSON). Editar a spec exige TypeScript, não apenas JSON — barreira pequena para desenvolvedores, mas relevante se um não-programador precisasse editá-la (mitigado pela documentação do ADR-0004). A migração do `datamodel.json` atual para as três camadas é trabalho pontual e deve ser feita com os testes de resolução verdes.

**Neutras.** O runtime continua consumindo um `datamodel.json`; muda apenas *como* ele nasce (compilado, não escrito).

## Alternativas consideradas

**Permanecer em JSON com presets + `$ref` + JSON Schema.** Resolve parte do DRY (reuso de dados) e trava o drift via validação, mas não resolve o comportamento-como-prosa e é desconfortável de autorar à mão (sem tipos, sem funções, sem comentários). Fica como caminho de menor esforço se a equipe rejeitar o passo de build.

**Lua (ou outra DSL embarcada).** Reconhece corretamente a necessidade de uma linguagem real na configuração (funções, composição). Descartado por introduzir um runtime e um idioma adicionais numa stack inteiramente JS/TS, com fronteira de FFI e perda de integração de tipos — custo sem ganho sobre o que o TypeScript já oferece nativamente.
