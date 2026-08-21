# EDQMS — Assessment de modelagem: Forecasts, Forecast Scopes, Jobs e Control

**Division Governance Portal · rodada de schema pré-mockup**
Versão 1.0 · 21/08/2026 · Pré-requisito da F1 do `MOCKUP_DEMO_PLAN.md`

---

## 1. Escopo, método e conclusão em uma frase

**Escopo.** As três entidades cujas features estão desabilitadas no MVP e nunca foram validadas
com stakeholders — **CRM → Forecasts, Forecast Scopes** e **Workspace → Jobs** — mais o módulo
**Control** (Capacity e Performance), que permanece desabilitado nos dois ambientes mas cujos
cards e reports são consumidos pelo Overview.

**Método.** Auditoria cruzada de quatro fontes: o catálogo (`datamodel.json`), o dataset
(`mockup_data_prototype.json`, 1.700 registros), o motor (`queries.js`, `forms.js`, `app.js`) e o
histórico de decisões (`prototype_v3-review.md`, `stakeholders_test_results.md`). Cada achado
abaixo é acompanhado da evidência numérica que o produziu — nenhum é opinião sobre o desenho.

**Conclusão.** As três entidades **precisam de mudanças de relacionamento antes do mockup**, e a
razão é uma só: **o ciclo demanda → execução → consumo não fecha**. O Forecast projeta horas, o
Ticket executa e o Job consome — mas não existe nenhuma chave que ligue um ao outro. Sem esse elo,
`Forecast Scopes.consumption` é inexequível, `Capacity` e `Performance` só podem ser inventados
(e foram), e o Overview exibe números que se contradizem entre um card e o gráfico ao lado.

> Estado atual dos gates (confirmado em `js/app.js:177-184`):
> `DEMO_DISABLED_MODULES = {Control}` · `BLANK_DISABLED_MODULES = {Overview, Control}` ·
> `BLANK_DISABLED_TABS = {CRM: [Forecasts, Forecast Scopes], Workspace: [Jobs]}`.
> A regra que você pediu — Control desabilitado nos dois ambientes, com as tabelas ainda
> catalogadas para alimentar o Overview — **já é o comportamento implementado**. O que falta não
> é gate: é a coerência dos dados que esses cards e reports leem (§5).

### Nota de nomenclatura

Você citou "reports de **Capability** e **Productivity**". No catálogo as duas abas de Control são
**Capacity** (capacidade/utilização) e **Performance** (PK `usageID`, herdada da antiga aba
"Usage"; o README ainda cita "Capacity / Usage / Productivity"). Assumi que se trata dessas duas.
Vale padronizar o nome em uma das rodadas — hoje a mesma coisa tem três rótulos no repositório.

---

## 2. Sumário dos achados

| # | Achado | Evidência | Severidade |
|---|---|---|---|
| **A1** | **Não existe elo Ticket ↔ Forecast Scope.** `Forecast Scopes.consumption` declara "+1 cada vez que um forecastScopeID é adicionado a um Ticket", mas Tickets não tem esse atributo | `Tickets` tem 16 campos armazenados, nenhum de forecast; `consumption ≠ forecastScopeQuantity` em **390/390** linhas (consumo 24–38 contra quantidade 1–5) | 🔴 Bloqueia |
| **A2** | **`Tickets.productScopeID` está vazio em 135/135 linhas**, e Jobs deriva `scopeID`/`productGroupID` dele | Jobs tem apenas **6 valores distintos de `taskID`** em 187 registros — o rollup `Tasks (via customerID + productGroupID + scopeID)` colapsa | 🔴 Bloqueia |
| **A3** | **Capacity e Performance são semeadas à mão e contradizem suas fontes** | `Capacity.allocatedHours` ≠ Σ `Forecast Scopes.estimatedHours` em **60/60** células (ago/2025 · Analysis: 320 h de forecast contra 114 h registradas). `Performance.plannedHours` = **516 h em todos os 12 meses**, enquanto os Jobs do mesmo mês somam 54/84/120 h | 🔴 Bloqueia |
| **A4** | **Entidade `Contract` decidida mas não modelada** — você registrou em `prototype_v3-review.md` que Contract relaciona Product Scopes, Branches e Forecasts | Nenhuma tabela `Contract` no catálogo; `Forecasts` pendura direto em `Customers` | 🔴 Decisão de sequenciamento |
| **A5** | **O ciclo de vida do Job não tem interface** — o form tem 6 campos (Project, Ticket, Task, Responsible, Delivery Date, Status); não há como registrar `realStartDate`, `realEndDate` nem a parada | `stoppedAt` nulo em **187/187** linhas, embora 2 jobs estejam `Stoped` e `jobBufferExecution` tenha 5 valores distintos | 🟠 Impede validação |
| **A6** | **Dependências de Job existem no código e não no modelo** — `forms.js:19` mapeia `predecesorJob: 'Jobs'`, o catálogo não tem o atributo; o README ainda descreve um wizard de 4 passos que não existe mais | `Jobs` tem 23 atributos, nenhum de dependência | 🟠 Impede validação |
| **A7** | **Só o período mensal foi exercitado** — `forecastPeriod` = `"Monthly"` em 156/156 | As regras de `periodFinish`, `periodBusinessDays` e `weeklyUsageQuota` para Annual e Quarter nunca rodaram sobre dado nenhum | 🟠 Impede validação |
| **A8** | **`Jobs.roleID` contradiz a pessoa alocada** — a regra é `mirror: DISTINCT(People.roleID)` | `job.roleID == people.roleID` em **0/187** linhas; `Jobs::Report-B` agrupa horas reais por esse campo | 🟠 Impede validação |
| **A9** | **`plannedExecutionTime` não rastreia até o procedimento** — a regra diz "igual ao executionTime do procedimento da tarefa, congelado no planejamento" | Divergência em **187/187** jobs; `forecastScopeQuantity` também não multiplica `estimatedHours` | 🟠 Impede validação |
| **A10** | Deriva de enum: dado grava `"Monthly"`, catálogo declara `Annual/Quarter/Month` (em Forecasts, Capacity e Performance) | 156 + 60 + 36 linhas | 🟡 Limpeza |
| **A11** | Regra de form obsoleta: `Forecasts.Customer → "SelectLabel = Customers.region"`, mas geografia saiu de Customers para Branches (#191) | `Customers` não tem `regionID` | 🟡 Limpeza |
| **A12** | Gate silenciosamente errado: `Forecast Scopes` gateia Notes e Quantity em `"Product Scope IS NOT NULL"`, campo que não existe no form; o matcher difuso (`forms.js:1599`) casa com o campo **Scope** | Funciona por acidente, com semântica trocada | 🟡 Limpeza |
| **A13** | Notas invertidas: `Jobs.deliveryDate` = "Planned start date" e `Jobs.startDate` = "Planned end date" | Nos dados, `startDate` é sempre 1 dia **antes** de `deliveryDate` | 🟡 Limpeza |
| **A14** | `Jobs.projectID` é FK NOT NULL redundante (derivável do ticket) | 0/187 divergências — duplicação sem conflito hoje, drift garantido amanhã | 🟡 Limpeza |
| **A15** | O botão **Details** dos itens de Control no Overview aponta para um módulo desabilitado | `Capacity Card 1-1`, `Capacity Report-A`, `Performance Card 1-2`, `Performance Report-A` têm `overview-display: true` | 🟡 UX |

---

## 3. CRM — Forecasts e Forecast Scopes

### 3.1 Cardinalidade atual (medida no dataset)

```
Customers (17) ──1:N──> Forecasts (156)  ──1:N──> Forecast Scopes (390)
                         13 clientes                2 ou 3 filhos por pai
                         12 meses cada              (78 pais com 2, 78 com 3)
                         4 clientes sem forecast
Forecast Scopes ──N:1──> Events (31) · Scopes (10) · Product Groups (14)
                ──computed──> Product Scopes (via 4 chaves, incl. requirementName)
                ──string────> functionName  (5 valores, sem FK)
                                    ✗ nenhuma relação com Tickets/Jobs
```

### 3.2 O que precisa mudar

| Item | Hoje | Proposto | Por quê |
|---|---|---|---|
| **Elo com a execução** | inexistente | **`Tickets.forecastScopeID`** — FK nullable → Forecast Scopes. Cardinalidade **Forecast Scope 1:N Tickets** | Torna `consumption` uma contagem real (`rollup COUNT(Tickets)`), habilita "saldo do forecast" e permite derivar Control de verdade |
| **`consumption`** | INT armazenado, incoerente | `rollup → Tickets (via: forecastScopeID)` (contagem) + atributo derivado **`remaining` = `forecastScopeQuantity − consumption`** | Um número que o usuário pode conferir somando as linhas filhas |
| **Chave de portfólio** | 3 FKs (`eventID`, `scopeID`, `productGroupID`) + `productScopeID` computado por 4 chaves incluindo `requirementName` | **`productScopeID` vira FK armazenada** (N:1 Product Scopes); `scopeID` e `productGroupID` viram mirrors dele | Alinha Forecast Scope com **Payload** (Event × Product Scope), que já é a unidade de despacho do SLA. Hoje as duas pontas do mesmo conceito usam chaves diferentes |
| **`functionName`** | string livre | **`functionID`** FK → Functions (N:1), com `functionName` como mirror | É a chave de agregação de `Capacity::Report-A`; join por nome é a classe de fragilidade que a rodada D6 mandou eliminar |
| **`estimatedHours`** | DECIMAL armazenado | `computed: SUM(tasks.executionTime) × forecastScopeQuantity` | Hoje a quantidade não multiplica nada — pedir 3 unidades de um escopo projeta as mesmas horas que pedir 1 |
| **`forecastPeriod`** | só `"Monthly"` | Semear os três valores do enum (`Month`, `Quarter`, `Annual`) e corrigir o rótulo | As regras de `periodFinish`/`periodBusinessDays`/`weeklyUsageQuota` de Quarter e Annual nunca foram executadas — é literalmente feature não testada |
| **Pai do Forecast** | `Customers` | **decisão A4** — ver §6 | Se `Contract` entrar, o pai muda e a cadeia CRM inteira é re-semeada |

### 3.3 O que **não** deve mudar

A granularidade Forecast → Forecast Scopes (1:N, 2–3 filhos) está correta e é didática: o pai
carrega o período e o status, o filho carrega o par Evento × Escopo de Produto. Manter.

---

## 4. Workspace — Jobs

### 4.1 Cardinalidade atual (medida no dataset)

```
Projects (8) ──1:N──> Tickets (135) ──1:N──> Jobs (187)
                       17 tickets/projeto      114 tickets com job (21 sem)
                       productScopeID VAZIO    1 a 6 jobs por ticket
Jobs ──N:1──> People (24 distintos) · Tasks (apenas 6 distintos!) · Projects (redundante)
     ──✗────> dependências (predecesorJob existe só no código)
     ──✗────> nenhum campo de execução no formulário
```

### 4.2 O que precisa mudar

| Item | Hoje | Proposto | Por quê |
|---|---|---|---|
| **Origem do escopo** | `Jobs.scopeID`/`productGroupID` = rollup por `ticketID` → Product Scopes, que está vazio no ticket | Tornar **`Tickets.productScopeID` NOT NULL** e semeá-lo | É a causa-raiz de A2: sem ele o rollup de `taskID` colapsa em 6 tarefas e `jobName` (derivado da tarefa) repete em todo o dataset |
| **`taskID`** | rollup de 3 chaves, degenerado | **FK armazenada** N:1 Tasks, com as opções filtradas por `tasksForJob(ticket)` — que já existe em `forms.js:586` | O valor precisa ser estável no registro (é a base de `plannedExecutionTime`); a filtragem é papel do form, não da chave |
| **`plannedExecutionTime`** | armazenado, divergente | Congelado **a partir do procedimento** no momento do planejamento, com o validador conferindo contra Σ `Procedures.executionTime` da tarefa | Sem isso, Performance mede um plano que nunca existiu |
| **`roleID`** | mirror inconsistente (0/187) | Derivar de `userID → People.roleID` no motor e **remover do armazenamento** | Um job não tem papel próprio: quem tem papel é a pessoa |
| **`projectID`** | FK NOT NULL duplicada | Mirror de `ticketID → Projects` | Elimina a possibilidade de um job apontar para projeto diferente do seu ticket |
| **Ciclo de vida** | `Queued/Active/Done/Stoped` sem UI | Ações de transição no drawer (**Start · Pause · Resume · Finish**) gravando `realStartDate`, `stoppedAt`, acumulando `jobBufferExecution` e fechando `realExecutionTime` | É a feature central da entidade e a única fonte de dado real do Control. Enquanto não existir, "Jobs" não pode ser validado com stakeholder — não há o que demonstrar |
| **Dependências** | `predecesorJob` órfão no código | **`predecessorJobID`** — self-FK nullable (N:1 Jobs), com `dependencyType` reusando o enum de `Workflows.indentationRule` | Ou modelar, ou remover do código. O README descreve um wizard de 4 passos que não existe mais — documentação e implementação divergiram |
| **`deliveryDate` / `startDate`** | notas invertidas | `startDate` = início planejado, `deliveryDate` = entrega planejada | Trivial, mas hoje qualquer leitura do dado está invertida |

---

## 5. Control — Capacity e Performance (absorção no Overview)

### 5.1 O problema, medido

O Overview puxa quatro itens de Control (`overview-display: true`): **Capacity Card 1-1** e
**Report-A**, **Performance Card 1-2** e **Report-A**. Eles leem fontes diferentes:

| Item do Overview | Fonte real (`queries.js`) |
|---|---|
| Capacity **Card 1-1** ("Capacity Utilization", 62%) | tabela `Capacity` armazenada |
| Capacity **Report-A** ("Available vs Allocated") | **recalculado ao vivo** de `People.workingHours` e `Forecast Scopes.estimatedHours` |
| Performance **Card 1-2** ("Job Execution Performance") | tabela `Performance` armazenada |
| Performance **Card 1-1** (não vai ao Overview) | **`Jobs` ao vivo** |

Como a tabela armazenada não bate com a fonte viva — `allocatedHours` diverge em 60/60 células,
`plannedHours` é constante em 516 h nos 12 meses enquanto os Jobs somam 54/84/120 h — **o card e o
gráfico ao lado dele descrevem realidades diferentes**. Numa demonstração para cliente, essa é a
pergunta que ninguém quer receber.

### 5.2 Proposta: Capacity e Performance viram views materializadas pelo gerador

Não como tabelas mantidas à mão, e não como cálculo puramente em runtime (o motor precisa das
tabelas catalogadas — são alvo de rollup e o validador exige paridade). O caminho é o meio-termo:

> **Regra:** `Capacity` e `Performance` são **saídas do gerador de seed**, nunca dados de entrada.
> O `build_seed.py` as calcula a partir de People/Forecast Scopes (capacidade) e Jobs
> (desempenho), e o validador **recalcula e compara** — divergência derruba o build.

**Grão proposto** (hoje é ambíguo: Capacity mistura departamento × papel × função × cliente):

| Tabela | Grão proposto | Fórmulas |
|---|---|---|
| **Capacity** | `functionID × ano × mês` (+ `customerID` opcional para o Card 1-2) | `availableHours` = Σ `People.workingHours` da função × semanas do mês · `allocatedHours` = Σ `Forecast Scopes.estimatedHours` da função nos forecasts do período · `utilization` = alocado / disponível |
| **Performance** | `functionID × customerID × ano × mês` | `plannedHours` = Σ `Jobs.plannedExecutionTime` dos jobs concluídos no mês · `realExecutionTime` = Σ `Jobs.realExecutionTime` · `efficiency` = (planned/real − 1) × 100 · `variance` = variância dos jobs do grupo |

**Consequência boa:** com A1 e A2 resolvidos, o Overview passa a contar uma história encadeada —
o convênio projetou X horas (CRM), abriu Y tickets contra aquele forecast scope (Workspace), os
jobs consumiram Z horas (Control) — e os três números se reconciliam na tela.

### 5.3 Gates e navegação

- **Manter** `Control` desabilitado em DEMO e em MVP: já é o comportamento (`app.js:177-180`), e
  as tabelas continuam catalogadas — é o que faz os quatro itens do Overview funcionarem.
- **Resolver A15:** o botão *Details* desses itens leva a um módulo inacessível. Duas saídas:
  ocultar o botão quando o módulo de origem está desabilitado, ou redirecionar para a fonte real
  (Capacity → CRM · Forecast Scopes; Performance → Workspace · Jobs). Prefiro a segunda: mantém a
  promessa do Overview ("clique para investigar") sem abrir o módulo.
- **Rumo do módulo:** você já registrou em `prototype_v3-review.md` que Control deve virar o
  módulo de **Qualidade** (não conformidade + KPI builder). A proposta acima não atrapalha esse
  destino — ao contrário, libera Capacity/Performance de serem "tabelas de teste de query", que é
  como nasceram, segundo seu próprio comentário no review.

---

## 6. A decisão que precede tudo: `Contract` (A4)

Você registrou no v3-review que um **Contract** relaciona **Product Scopes**, **Branches** e
**Forecasts** — e que é o Contract, não o Branch, que conecta o Customer à operação. Isso muda o
pai do Forecast:

```
hoje:      Customers ──1:N──> Forecasts
proposto:  Customers ──1:N──> Contracts ──1:N──> Forecasts
                              └─N:M──> Product Scopes
                              └─N:M──> Branches
```

Duas rotas possíveis, e a escolha define quando o mockup pode começar:

| Rota | O que acontece | Custo |
|---|---|---|
| **R1 · Modelar Contract agora** (recomendada) | A rodada de schema entrega Contract junto com A1–A3; o gerador nasce com a cadeia definitiva | +2 dias na rodada; **zero** retrabalho de seed |
| **R2 · Adiar Contract** | Forecast segue pendurado em Customer; quando Contract entrar, a cadeia CRM inteira (Forecasts, Forecast Scopes, SLA, Tickets) é re-semeada e o `clinic.yaml` reescrito | ~4 dias de retrabalho depois, mais o risco de a demo pública mudar de forma |

O argumento decisivo: no domínio clínico escolhido, **Contract é a entidade que o visitante
reconhece imediatamente** — é o contrato com o convênio, que define quais exames (product scopes)
estão cobertos em quais unidades (branches) e quanto volume foi projetado (forecasts). Sem ele, o
convênio "compra" exames por um SLA sem contrato, o que é justamente a parte do modelo que soa
artificial para quem conhece o setor.

---

## 7. Impacto no plano do mockup e no `clinic.yaml`

O `clinic.yaml` **ainda não foi escrito** — e este assessment é a razão pela qual ele não deve ser
escrito antes das decisões da §8. Mudanças confirmadas no plano:

### 7.1 Nova fase, antes da F1

| Fase | Conteúdo | Esforço |
|---|---|---|
| **F0.5 · Rodada de schema R6** (nova) | A1 (elo Ticket↔Forecast Scope), A2 (`Tickets.productScopeID` NOT NULL), A3 (Capacity/Performance derivados), A4 (Contract, se R1), A5–A9 (ciclo de vida do Job, dependências, período do forecast, roleID, plannedExecutionTime), A10–A15 (limpeza) | 4–5 d |

Motivo: o dicionário de domínio e o gerador são escritos **contra** a cardinalidade. Escrevê-los
antes significa reescrevê-los depois — o custo de fazer na ordem errada é maior que a rodada.

### 7.2 Volumetria revista (§7 do plano)

| Entidade | Antes | Agora | Motivo |
|---|---|---|---|
| Contracts | — | **14** | Nova entidade (rota R1) |
| Forecasts | 120 | **144** | 12 contratos × 12 meses, cobrindo **os três períodos** do enum (A7) |
| Forecast Scopes | 320 | **340** | Mantém 2–3 filhos por forecast |
| Tickets | 140 | **160** | ~60% ligados a um forecast scope (A1), o restante fora do previsto — é o que torna "consumo vs. previsto" visível |
| Jobs | 200 | **240** | Precisa cobrir os 4 status **com histórico**: parados com `stoppedAt` e buffer, ativos, concluídos, na fila |
| Capacity | 72 | **72 (derivadas)** | 6 funções × 12 meses, calculadas pelo gerador |
| Performance | 48 | **72 (derivadas)** | 6 funções × 12 meses, calculadas dos Jobs |

### 7.3 Narrativa revista (§5.4 do plano)

As cinco histórias continuam, com duas correções e uma adição:

- **História 1 (gargalo de laudo)** passa a ser *derivável*: o gargalo aparece porque os Jobs
  daquela função consumiram mais horas do que a capacidade calculada — não porque uma linha de
  Capacity foi escrita à mão dizendo isso.
- **História 4 (forecast subestimado)** ganha rastro: o convênio projetou 900 h em N forecast
  scopes, abriu M tickets contra eles, e os jobs consumiram 1.180 h — os três números se ligam
  pela chave nova de A1.
- **Nova história 6 — saldo de contrato:** um contrato com 78% do volume previsto já consumido no
  terceiro mês do trimestre. É a demonstração mais direta do valor da plataforma para um gestor
  comercial, e só existe com A1 + A4 resolvidos.

### 7.4 Regras novas para o gerador

1. `Capacity` e `Performance` **nunca** são semeadas — são calculadas (§5.2) e reconferidas pelo validador.
2. Todo Job concluído deve fechar a conta: `realExecutionTime = (realEndDate − realStartDate) − jobBufferExecution`.
3. Nenhuma data no futuro em registros concluídos — o dataset atual tem jobs `Done` com
   `realStartDate` em **setembro e outubro de 2026** (posterior a hoje), o que reforça a
   necessidade da âncora de datas já prevista no plano.
4. `plannedExecutionTime` de todo job = Σ `Procedures.executionTime` da sua tarefa, no instante do planejamento.

---

## 8. Decisões necessárias

> **Decididas em 21/08/2026 (Rafael)** — implementação na rodada R6, milestone
> "R6 — Forecast/Jobs/Control schema round", issues #241–#246:
>
> 1. **Contract (A4):** o Contract **é a entidade SLA existente** — não nasce tabela nova.
>    Os Forecasts dão a dimensão temporal do contrato: **SLA 1:N Forecasts** (`Forecasts.slaID`,
>    issue #241). Forecast Scopes limitam Evento/Product Scope aos payloads do SLA.
> 2. **Elo A1:** `Tickets.forecastScopeID` como **FK única nullable** (um ticket consome no
>    máximo um forecast scope — coerente com o `productScopeID` único do #214). Select leniente,
>    agrupado por período, sem travar por data (issue #243).
> 3. **Ciclo de vida do Job (A5): nesta rodada** — ações Start/Pause/Resume/Finish no drawer
>    (issue #245).
> 4. **Dependências (A6): modelar** `predecessorJobID` + `dependencyType` (issue #244).
> 5. **Escopo: A1–A15 completo** (issues #241–#246).

1. **Contract (A4)** — modelar agora (R1, recomendado) ou adiar (R2)?
2. **Elo Ticket ↔ Forecast Scope (A1)** — `Tickets.forecastScopeID` como FK nullable é a forma
   que você quer? A alternativa é uma tabela de ligação (N:M), caso um ticket possa consumir mais
   de um forecast scope.
3. **Ciclo de vida do Job (A5)** — entra nesta rodada (com botões de transição no drawer) ou fica
   para depois do MVP? Se ficar, `Performance` continua sem fonte real e o Overview segue exibindo
   número inventado.
4. **Dependências de Job (A6)** — modelar `predecessorJobID` ou remover o resíduo do código?
5. **Escopo da rodada** — A1–A4 (mínimo para o mockup fechar) ou A1–A15 (limpa também a dívida de
   consistência antes de o gerador congelar o formato)?
