# EDQMS — Plano de implementação do banco de dados demo (mockup de domínio)

**Division Governance Portal · protótipo → demo pública**
Versão 1.0 · 21/08/2026 · **CONCLUÍDO** — F1–F6 executadas (decisões registradas na §10)

> **Status de encerramento (21/08/2026).** As seis fases foram entregues no milestone
> "Mockup Demo — Vitalis (F1–F6)": F1 dicionário+narrativa (#254/PR #255) · F2 pipeline
> determinístico `tools/seed/` (#256/#257) · F3 swap com validador estendido, datas
> ancoradas e tag `demo-transformers-v1` (#258/#259) · F4 copy+branding e painel "About
> this demo" (#260/#261) · F5 varredura automatizada `tools/sweep_screens.mjs`, zero abas
> vazias / zero cards degenerados (#262/#263) · F6 deploy + regressão no publicado +
> screenshots de referência (`tools/reference-shots/`). A demo pública em `/app/` é a
> **Vitalis Health Network**; o MVP em branco segue neutro e intacto. Gates permanentes:
> paridade de catálogo no build (SeedError), `== narrative ==` e `== control derivation ==`
> no validador, e a sweep de telas — um re-seed que quebre uma história derruba o build.

> **Bloqueio liberado (21/08/2026, fim do dia).** A rodada de schema R6 foi implementada —
> `schemaVersion` **44 → 49**, issues #241 a #246. As decisões da §8 do
> `ASSESSMENT_FORECAST-JOBS-CONTROL.md` foram tomadas com uma mudança relevante em relação ao
> proposto: **não foi criada a entidade `Contract`. O papel de contrato passou para a `SLA`**
> (`SLA 1:N Forecasts`, issue #241). O modelo ficou uma entidade mais enxuto e a §7 abaixo foi
> refeita por causa disso. Estado verificado nesta sessão: `validate_mockup.py` **PASS**
> (0 falhas, 17 avisos) e as 8 suítes relevantes verdes, incluindo as 6 novas.
>
> **A F1 está liberada.** O que resta da R6 não é modelagem, é **higiene de seed** (§7.4) — e é
> trabalho do gerador, não de mais uma migração.

> **Decisões tomadas em 21/08/2026**
>
> 1. **Domínio:** A · Rede de clínicas e diagnóstico por imagem (*Vitalis Health Network*).
> 2. **Idioma dos dados:** inglês, coerente com a interface e com o catálogo.
> 3. **Coexistência:** o dataset de transformadores é **substituído** — a demo pública passa a
>    ter um único domínio (o dataset atual permanece no histórico do git e no build marcado).
> 4. **Pipeline:** o gerador é **reconstruído** (`tools/seed/`), determinístico e dirigido pelo catálogo.
>
> As seções §4.2, §8 e §10 já refletem essas decisões; as demais seções valem como analisadas.

---

## 1. Objetivo e critério de sucesso

O dataset atual (`data/mockup_data_prototype.json`, ~1.700 registros) descreve uma divisão de
engenharia de **transformadores de potência**. Quem abre o site demo sem contexto encontra
`LPT/MPT/DT`, `Uprating`, `Max Tank Weight`, `Product Scopes` — vocabulário que só faz sentido
para quem já conhece o negócio. O visitante não consegue inferir *para que serve a plataforma*.

A proposta é gerar um **novo dataset ambientado em uma operação de conhecimento popular**,
preservando 100% da estrutura do modelo (nenhuma tabela, atributo ou regra muda de forma).

> **Critério de sucesso.** Um visitante leigo, percorrendo Overview → Portfolio → Operation →
> Workspace → Control por ~90 segundos, consegue explicar em voz alta o que a plataforma faz:
> *"ela padroniza como uma organização presta um serviço, quem está certificado para executá-lo,
> quanto de trabalho vem pela frente e quanto foi realmente consumido."*

Esse critério é o filtro de todas as decisões abaixo. Dado de demo não é dado aleatório com
rótulo novo: é **argumento de venda em forma de tabela**.

---

## 2. Diagnóstico técnico — o que a troca realmente envolve

### 2.1 O motor é agnóstico; o acoplamento de domínio é pequeno

O runtime deriva cada tela de `data/datamodel.json` (7 módulos, 40 tabelas). Trocar o domínio
**não toca no código de renderização**. O vocabulário de transformadores aparece em apenas
7 pontos textuais do catálogo:

| Local | Texto acoplado |
|---|---|
| `Customers.description` | "…LPT (Large Power Transformers), MT (Medium Transformers), DT (Distribution Transformers)" |
| `Products.description` | "Power transformer products and services…" |
| `Scopes.description` | "…(e.g., Uprating, Temperature Reduction, Redesign)" |
| `Business Segments` (dados) | códigos LPT/MPT/DT |
| `_meta` / README / textos de cabeçalho | menções à Northwind Energy |

Os **enums são todos agnósticos** (`Open/InProgress/Resolved`, `Queued/Active/Done/Stoped`,
`Active/Inactive`, `Opportunity/Risk`, `outsource/internal`…). Nenhum precisa mudar.

### 2.2 A suíte de testes quase não trava a troca

Dos 29 `tools/test_*.mjs`, a maioria roda sobre fixtures próprias. Apenas dois pontos são
sensíveis ao dataset real:

- `test_engine_branches.mjs` — lê o mockup só para confirmar que `Countries` **não** viaja nele;
- `test_resolve.mjs:157` — procura o requisito literal `'Max Tank Weight'`. **Única asserção
  acoplada ao domínio em toda a suíte**; deve ser parametrizada.

### 2.3 O gate real é o validador

`tools/validate_mockup.py` é o contrato que o novo dataset precisa honrar. Seis blocos:

1. **Paridade de schema** — todas as tabelas presentes, atributos armazenados exatos, PKs únicas, `_meta.schemaVersion` presente;
2. **NOT NULL** — âncoras estruturais preenchidas em toda linha (senão o registro some de subitens/rollups/cascatas);
3. **Geografia single-sourced** — `Customers` sem `city/country/regionID` (quem manda é `Branches`);
4. **FK resolvível** — todo valor de FK existe como PK ou como valor de display no alvo;
5. **Cobertura de rollup ≥ 70%** — pais com filhos, senão as tabelas de subitem nascem vazias;
6. **Suficiência de reports e cards** — 12 meses de `Capacity`/`Performance`, ≥10 meses de
   conclusões em `Jobs`, ≥3 forecasts `Draft`, ações recorrentes em ≥2 processos, totais de
   dois períodos diferentes (setas de tendência), e **fixtures de contagem fixa**
   (`Customers 17, Actions 7, Scopes 10, Products 14, Product Groups 14, Product Specs 2,
   Events 31, Tickets 135`).

### 2.4 Achado importante: não existe hoje um gerador reprodutível

`tools/generate_mockup.py` está **obsoleto**: foi escrito para o schema anterior (fala em
`Factories`, `Product Class`, `constraints`) e reconstrói o dataset *a partir do dataset antigo*
(`OLD = json.load(...)`). O dataset vigente é o resultado acumulado de ~50 scripts
`migrate_*.py` aplicados em sequência ao longo de meses.

Consequência prática: **não é possível "regerar" o mockup hoje**, só migrá-lo incrementalmente.
Por isso a recomendação central deste plano:

> Tratar a troca de domínio como a oportunidade de **reconstruir o pipeline de seed** —
> um gerador determinístico, dirigido pelo catálogo e parametrizado por domínio — em vez de
> escrever mais um `migrate_*.py`. O custo marginal é de 2 a 3 dias e elimina uma dívida
> que só cresce (cada PR de schema hoje exige um script de migração manual).

### 2.5 Volumetria atual (referência)

| Módulo | Tabelas com dados |
|---|---|
| Organization | Segments 4 · Units 3 · Departments 3 · Squads 5 · Regions 3 · Branches 17 · Issues 4 |
| Portfolio | Products 14 · Product Groups 14 · Product Specs 2 · Scopes 10 · **Classes 0** · Product Scopes 15 · Events 31 |
| CRM | Customers 17 · SLA 17 · Forecasts 156 · Forecast Scopes 390 |
| Operation | Processes 6 · Activities 21 · Workflows 21 · Actions 7 · Tasks 50 · Procedures 50 · Handouts 10 · Channels 4 · Requirements 9 · Requirement Type 5 · Payload 31 |
| Talent | Functions 6 · Roles 10 · Job Family 4 · Skill Levels 4 · People 30 · Competence 12 · Onboarding 32 |
| Workspace | Projects 8 · Tickets 135 · Jobs 187 |
| Control | Capacity 60 · Performance 36 |

Dois vazios comprometem a demo hoje: **Classes (0 linhas)** e **Product Specs (2 linhas)** —
a aba Classes nasce vazia e o formulário dinâmico de Product Groups fica sem o que demonstrar.

---

## 3. Critérios para escolher a operação-exemplo

O modelo só "acende" inteiro se o domínio acomodar naturalmente estas 12 estruturas. Cada uma
corresponde a abas que ficariam vazias — ou artificiais — se o domínio não a tiver:

| # | Estrutura exigida pelo modelo | Onde aparece |
|---|---|---|
| 1 | Organização multi-site, em ≥2 países | Segments → Units → Departments → Squads, Branches, Regions |
| 2 | Uma **divisão central que presta serviço** a sites internos *e* clientes externos | Customers (`Internal Client / External Client / Supplier`) |
| 3 | **Contrato formal** cliente ↔ departamento autorizando pacotes de serviço | SLA, Payload (Event × Product Scope) |
| 4 | Catálogo em duas dimensões: **o que** × **até onde** | Products/Product Groups/Product Specs × Scopes/Classes → Product Scopes |
| 5 | Um **gatilho de execução** nomeável ("o que faz o trabalho começar") | Events |
| 6 | Processo padronizado decomponível em passos, com documentos e canais | Processes → Workflows → Activities × Actions → Tasks, Handouts, Channels |
| 7 | **Método documentado com tempo por tarefa** | Procedures.executionTime — base de toda a matemática de capacidade |
| 8 | Obrigações **regulatórias/contratuais reutilizáveis**, variáveis por região/cliente/produto | Requirements, Requirement Type |
| 9 | Trabalho executado por **pessoas certificadas**, com níveis | Functions → Roles → Competence → Onboarding.isCertified |
| 10 | **Demanda projetada em horas** antes de acontecer | Forecasts → Forecast Scopes |
| 11 | Execução rastreável em **três níveis**, com plano vs. real | Projects → Tickets → Jobs |
| 12 | Consumo mensurável em **horas/mês por 12+ meses** | Capacity, Performance |

Regra de corte: um domínio que não tenha **7, 9 e 12** de forma natural não sustenta a demo —
sobra ficção onde deveria haver evidência.

---

## 4. Opções de operação

Quatro candidatos, todos de conhecimento popular. Nomes são fictícios de propósito (§9).

| | **A · Rede de clínicas e diagnóstico** | **B · Rede de fast food** | **C · Rede de concessionárias / serviço autorizado** | **D · Rede de livrarias com CD** |
|---|---|---|---|---|
| Nome fictício | *Rede Vitalis* | *Bom Burger* | *AutoPrime* | *Página Viva* |
| A "divisão" do sistema | Diretoria de Operações Clínicas e Qualidade, que padroniza e atende as unidades | Central de Operações e Qualidade da franqueadora, que atende as lojas | Divisão de Serviço Técnico da montadora, que atende as concessionárias | Central de Operações de Loja, que atende filiais e o CD |
| Reconhecimento popular | Alto | **Muito alto** | Alto | Alto |
| Aderência aos 12 critérios | **11/12** | 8/12 | **11/12** | 7/12 |
| Ponto fraco | tema sensível (usar dados 100% fictícios) | forecast/SLA menos naturais; risco de confundir "ticket" com "pedido do cliente" | risco de parecer nicho automotivo | pouca certificação e pouca regulação → Talent e Requirements ficam magros |

### 4.1 Mapeamento entidade → domínio

| Entidade EDQMS | A · Clínicas | B · Fast food | C · Concessionárias | D · Livrarias |
|---|---|---|---|---|
| Business Segments | Diagnóstico por Imagem · Análises Clínicas · Ambulatorial | Restaurante · Delivery · Drive-thru | Mecânica · Funilaria · Elétrica/Diagnóstico | Loja de Rua · Shopping · Online |
| Business Units | Imagem SP · Imagem Sul · Laboratório · Ambulatório | Operações BR · Operações LatAm | Pós-venda BR · Pós-venda LatAm | Varejo BR · E-commerce |
| Departments | Radiologia · Laudos · Enfermagem · Faturamento | Cozinha · Salão · Suprimentos | Oficina · Diagnóstico · Garantia | Loja · Estoque · Curadoria |
| Squads | equipes de plantão (internas) e cooperativas de laudo (outsource) | equipes de turno e auditores terceirizados | equipes de box e assistência móvel | equipes de loja e repositores terceirizados |
| Branches | unidades físicas (12 clínicas, 2 países) | lojas | concessionárias | filiais + CD |
| Regions / Countries | Sudeste · Sul · Cone Sul | idem | idem | idem |
| Issues (Risk/Opportunity) | "Fila de laudo acima de 48 h" (risco) · "Teleradiologia" (oportunidade) | "Perda por desperdício" · "Novo canal delivery" | "Recall de lote" · "Revisão programada" | "Ruptura de estoque" · "Clube de assinatura" |
| **Products** | exames e procedimentos (Tomografia, Ressonância, Raio-X, Hemograma…) | itens do cardápio (linha de sanduíches, bebidas, sobremesas) | modelos/sistemas atendidos (motor, câmbio, suspensão, elétrica) | categorias de título (didático, literatura, importado) |
| **Product Specs** | contraste? · sedação? · faixa etária · tempo de sala · equipamento | tamanho · proteína · alérgenos · tempo de preparo | motorização · ano · cobertura de garantia | formato · idioma · fornecedor |
| **Product Groups** | produto + specs (ex.: "Tomografia · com contraste · adulto") | "Sanduíche · linha premium · 200 g" | "Motor 1.6 · garantia estendida" | "Importado · capa dura" |
| **Scopes** (até onde vai o trabalho) | Rotina · Urgência · Segunda opinião · Laudo em 24 h · Reprocessamento | Implantação · Auditoria de BPF · Treinamento · Correção de desvio · Lançamento de item | Revisão programada · Garantia · Diagnóstico · Recall · Retrabalho | Reposição · Inventário · Curadoria · Devolução |
| **Classes** (classificação do escopo) | Assistencial · Regulatório · Melhoria | Segurança alimentar · Marca · Eficiência | Segurança · Contratual · Satisfação | Estoque · Experiência |
| **Product Scopes** | "Tomografia com contraste × Urgência" | "Sanduíche premium × Lançamento" | "Motor 1.6 × Revisão programada" | "Importado × Reposição" |
| **Events** (gatilho) | Pedido médico recebido · Solicitação de segunda opinião · Auditoria de imagem | Abertura de loja · Lançamento de item · Auditoria trimestral | Entrada de veículo na oficina · Acionamento de garantia · Campanha de recall | Pedido de reposição · Abertura de filial |
| **Payload** (Event × Product Scope) | pacote contratado pelo convênio (ex.: "urgência de imagem") | pacote de suporte da franqueadora à loja | pacote de serviço coberto pelo contrato de rede | pacote de serviço do CD à filial |
| **Customers** | convênios e hospitais parceiros (externos) + as próprias unidades (internos) | franqueados (internos) + agregadores de delivery (externos) | concessionárias (internas) + frotistas/seguradoras (externas) | filiais (internas) + editoras (fornecedores) |
| **SLA** *(o contrato — pai dos Forecasts desde a R6)* | contrato do convênio: quais exames, em quais unidades, com qual volume previsto | contrato de suporte franqueadora ↔ loja | contrato de rede montadora ↔ concessionária | acordo de nível de serviço CD ↔ filial |
| **Forecasts / Forecast Scopes** | volume mensal de exames projetado por convênio, convertido em horas de sala e de laudo | demanda de suporte por loja (auditorias, treinamentos, lançamentos) | horas técnicas projetadas por concessionária | horas de reposição/inventário por filial |
| **Processes → Workflows → Activities × Actions → Tasks** | Fluxo do exame: agendar → preparar → adquirir imagem → laudar → liberar | Fluxo do turno: abertura → produção → higienização → fechamento | Fluxo da OS: recepção → diagnóstico → execução → teste → entrega | Fluxo da reposição: pedido → separação → transporte → exposição |
| **Handouts / Channels** | pedido médico, protocolo, laudo assinado · PACS, portal do convênio | checklist de BPF, relatório de auditoria · app de loja, e-mail | OS, laudo técnico, termo de garantia · sistema da montadora | pedido, romaneio · ERP, WhatsApp |
| **Procedures** (método + tempo) | protocolo de aquisição por equipamento, com tempo de sala | POP de preparo/limpeza, com tempo padrão | tempária oficial da montadora (a "hora técnica" literal) | tempo padrão de separação/exposição |
| **Requirements + Requirement Type** | RDC/ANVISA, resoluções do CFM, LGPD, protocolo do convênio, acreditação | RDC 216 (BPF), rotulagem, alergênicos, padrão de marca | norma técnica da montadora, garantia legal (CDC), segurança | fiscal/tributário, direitos autorais, padrão de marca |
| **Functions / Roles / Skill Levels / Job Family** | Radiologista, Técnico em radiologia, Enfermeiro, Recepção · níveis 1–3 | Gerente de loja, Líder de turno, Manipulador de alimentos | Mecânico, Eletricista, Consultor técnico · certificação por sistema | Livreiro, Repositor, Curador |
| **Competence / Onboarding** | certificação do técnico por equipamento e protocolo (obrigatória para executar) | certificação de manipulador de alimentos e de auditor interno | certificação do mecânico por sistema/modelo (exigida pela garantia) | treinamento de curadoria e de inventário |
| **Projects → Tickets → Jobs** | Projeto (contrato/campanha) → atendimento/exame → execução por profissional | Projeto (implantação de loja) → chamado da loja → visita/atividade do consultor | Projeto (campanha/frota) → **OS** → apontamento do mecânico | Projeto (reforma/temporada) → chamado da filial → tarefa executada |
| **Capacity / Performance** | horas de sala e de laudo por função e mês | horas de consultor de campo por mês | **horas técnicas por box e mês** | horas de equipe por filial e mês |

### 4.2 Recomendação — **decidido: A** (21/08/2026)

**Escolha: A · Rede de clínicas e diagnóstico** — *Vitalis Health Network*, nome fictício, dados
em inglês. Motivos:

1. É o único domínio popular em que **a certificação de quem executa é obrigatória e óbvia**
   para qualquer pessoa — o que torna o módulo Talent (Competence/Onboarding), hoje o mais
   difícil de explicar, autoevidente: "o técnico não certificado naquele equipamento não pode
   ser alocado".
2. A camada de **Requirements** (ANVISA, CFM, LGPD, protocolo do convênio) explica sozinha por
   que uma plataforma de QMS existe — a herança viva de requisitos em Tickets vira demonstração.
3. Demanda em horas é natural (hora de sala, hora de laudo), o que preenche Forecasts,
   Capacity e Performance sem ficção.
4. Estruturalmente é o análogo mais fiel ao modelo atual: uma **divisão central que atende
   sites internos** (as unidades) e cobra de **clientes externos** (convênios) — exatamente a
   relação divisão de engenharia ↔ fábricas do dataset de hoje.

*As avaliações abaixo ficam registradas como fundamentação da escolha.*

**Alternativa forte: C · Concessionárias.** Vence a A em um ponto: a *hora técnica* é
literalmente o que a oficina vende, então `Procedures.executionTime` → `Jobs` → `Performance`
fica cristalino. Perde em amplitude de público. Se a audiência do site for majoritariamente
industrial, C comunica melhor que A.

**B (fast food)** tem o maior reconhecimento imediato, mas exige aceitar uma abstração: o
"cliente" da plataforma é a loja (franqueado), não o consumidor final — e um visitante desatento
pode ler `Tickets` como "pedidos", entendendo a plataforma como um PDV. **D (livrarias)** é a
opção mais simples e a mais fraca: Talent e Requirements ficam magros.

---

## 5. Arquitetura da solução de seed

### 5.1 Estrutura proposta

```
tools/seed/
├─ build_seed.py          # orquestrador: datamodel.json + domain pack → dataset
├─ graph.py               # ordem topológica de FKs, geração de ids, NOT NULL, arrays
├─ narrative.py           # planta as histórias (§5.4) e expõe asserções
└─ domains/
   └─ clinic.yaml         # vocabulário + parâmetros do domínio (Vitalis Health Network)
```

O diretório `domains/` continua plural por desenho: como o domínio vive em YAML, um segundo
pacote (setorial, de outro cliente, de outro idioma) passa a ser um arquivo, não um projeto.
Nenhum será escrito agora — a decisão de 21/08 é publicar **um** domínio.

### 5.2 Cinco princípios de projeto

1. **Dirigido pelo catálogo.** O gerador itera as tabelas do `datamodel.json` e preenche apenas
   atributos armazenados (`type ∉ {rollup, computed, mirror}`). Um atributo novo no catálogo sem
   regra de seed **quebra o build**, não a demo em produção.
2. **Determinístico.** `random.Random(SEED)` fixa: rodar duas vezes gera bytes idênticos, então
   o diff do dataset é revisável em PR (hoje é ruído).
3. **Domínio é dado, não código.** Todo texto vive no YAML. Trocar de operação = escrever um YAML
   novo, sem tocar no gerador — a decisão de publicar um único domínio deixa de ser irreversível.
4. **Datas ancoradas.** O seed grava `_meta.anchorDate` e as datas como offsets a partir dela;
   `js/data.js` desloca tudo para a data corrente no load. **A demo nunca envelhece** — sem isso,
   em três meses o Overview mostra "últimos 12 meses" terminando no passado. Custo: ~20 linhas.
   (Alternativa: regerar mensalmente no CI — mais frágil.)
   **Correção issue #306 (2026-09-03):** o deslocamento por posição de calendário muda a DURAÇÃO
   de intervalos que cruzam meses de tamanhos diferentes — e Jobs armazenam essa duração
   (`realExecutionTime`, equação do #245). Pares registrados em `SHIFT_PAIRS` (Jobs:
   `realStartDate` → `realEndDate`/`stoppedAt`) deslocam a âncora pelo calendário e os
   dependentes caem em âncora + offset ORIGINAL, preservando toda duração armazenada em
   qualquer rollover. Suítes comparam com `anchorToday()`, nunca com constante pinada.
5. **Narrativa antes de volume.** O seed planta histórias verificáveis; cards e reports existem
   para revelá-las. Volume sem narrativa produz gráficos bonitos que não respondem "e daí?".

### 5.3 Ordem de construção (topológica)

Camadas, nesta ordem — cada uma só depende das anteriores:

1. Organização e geografia (Segments → Units → Departments → Squads, Regions, Branches)
2. Talento estrutural (Job Family, Functions, Skill Levels, Roles, People)
3. Portfólio (Products → Product Specs → Product Groups; Scopes → Classes; Product Scopes)
4. Requisitos (Requirement Type → Requirements, com chaves de aplicabilidade variando por região/cliente/produto/escopo)
5. Processo (Processes → Activities, Actions, Workflows → Tasks → Procedures; Handouts, Channels)
6. Gatilhos (Events → Payload)
7. CRM (Customers → SLA → Forecasts → Forecast Scopes)
8. Competência (Competence 1:1 com Procedures → Onboarding)
9. Execução (Projects → Tickets → Jobs)
10. Controle (Capacity, Performance)

> **Regra crítica:** as camadas 9 e 10 são **derivadas, não sorteadas**. `Jobs` consomem o
> `executionTime` do `Procedure` da tarefa; `Performance` e `Capacity` somam Jobs por função e
> mês. Só assim os números "fecham" e a demo aguenta a pergunta que todo cliente faz —
> *"de onde saiu esse número?"*. Dado sorteado por tabela é o defeito clássico de mockup:
> cada tela é plausível, o conjunto é incoerente.

### 5.4 As cinco histórias plantadas (exemplo no domínio A)

| # | História | Onde o visitante vê | Sustenta |
|---|---|---|---|
| 1 | Gargalo de laudo na unidade Vitalis Campinas nos últimos 3 meses | Capacity: alocado > disponível para a função Radiologista; fila de tickets crescendo | Control, Overview |
| 2 | Nova certificação obrigatória em tomografia: só 2 pessoas certificadas, 6 em onboarding | Talent: Onboarding com `isCertified=false`; Jobs sem responsável elegível | Competence/Onboarding, seleção `certified-responsible` |
| 3 | Requisito regulatório novo entra em vigor no mês M | Tickets abertos depois de M herdam o requisito automaticamente (INHERITED-REQUIREMENTS) | Requirements, Workspace |
| 4 | Convênio com forecast subestimado: 900 h aprovadas vs. 1.180 h executadas | Report orçado vs. estimado; Performance | CRM, Control |
| 5 | Ação recorrente ("conferência de laudo") em ≥2 processos | Card top-3 de ações recorrentes em Tasks | Operation, Overview |
| 6 | **Saldo do contrato (SLA):** 78% do volume previsto já consumido no 3º mês do trimestre | Forecast Scopes: `consumption` (rollup de Tickets) vs. `forecastScopeQuantity`, com `remaining` positivo | CRM, Workspace |

As histórias 1 e 4 mudaram de natureza com a rodada R6: passam a ser **derivadas** em vez de
escritas. O gargalo da história 1 aparece porque os Jobs daquela função consumiram mais horas do
que a capacidade calculada — não porque uma linha de Capacity foi semeada dizendo isso; e a
história 4 ganha rastro completo (horas previstas → tickets abertos contra aquele forecast scope →
horas consumidas).

Cada história vira um **assert** em um bloco novo `== narrative ==` do validador. Uma história
que deixe de ser verdadeira depois de um re-seed derruba o build — é assim que a demo não
regride silenciosamente.

### 5.5 Ajustes necessários no contrato de validação

| Item | Ação |
|---|---|
| `FIX{}` com contagens fixas (Customers 17, Events 31, Tickets 135…) | Passa a ser lido do domain pack, não hard-coded no validador |
| `test_resolve.mjs:157` — `requirementName === 'Max Tank Weight'` | Parametrizar: pegar o primeiro requisito com `productGroupID` **e** `scopeID` preenchidos |
| `Classes` com 0 linhas | Preencher (5 classes) — hoje a aba nasce vazia |
| `Product Specs` com 2 linhas | Subir para 8 — o formulário dinâmico de Product Groups precisa de material |
| Checks agnósticos (geografia single-sourced, `taskName = activityName-actionName`, tendência de dois períodos) | Mantidos como estão |
| Bloco `== control derivation ==` (novo na R6: recalcula Capacity e Performance e compara) | Mantido e estendido — passa a rodar como estágio do `build_seed.py`, não como script à parte |
| Bloco `== narrative ==` | A criar, com as histórias da §5.4 e a higiene da §7.1 |

---

## 6. Fases, entregáveis e critérios de aceite

| Fase | Entregável | Aceite | Esforço |
|---|---|---|---|
| **F0 · Decisão** | Domínio, idioma, coexistência e volumetria definidos (§10) | Registrado no repositório | 0,5 d |
| ~~**F0.5 · Rodada de schema R6**~~ **✅ CONCLUÍDA em 21/08** | #241 SLA-as-Contract (`Forecasts.slaID`) · #242 Forecast Scope ancorado em Product Scope + `functionID` + `estimatedHours × quantity` · #243 `Tickets.forecastScopeID` e `productScopeID` NOT NULL, `consumption` como rollup + `remaining` · #244 higiene de Jobs (`roleID` mirror, `projectID` derivado, `plannedExecutionTime` congelado do procedimento, `predecessorJobID` + `dependencyType`, notas A13) · #245 ciclo de vida do Job (Start/Pause/Resume/Finish) · #246 Capacity/Performance derivadas por `tools/derive_control.py` + redirecionamento do botão Details | `schemaVersion` 49; `validate_mockup.py` PASS com bloco novo *control derivation*; 6 suítes novas verdes | — |
| **F1 · Dicionário e narrativa** | `tools/seed/domains/<dominio>.yaml` com todo o vocabulário + `narrative.md` com as 5 histórias | Revisão a 4 olhos: cada uma das 40 tabelas tem termo de domínio definido; nenhuma "sobra" | 2 d |
| **F2 · Pipeline de seed** | `build_seed.py`, `graph.py`, `narrative.py` | Roda 2× e produz bytes idênticos; falha explicitamente ao encontrar atributo do catálogo sem regra | 3 d |
| **F3 · Geração e validação** | `data/mockup_data_prototype.json` novo + validador estendido | `validate_mockup.py` PASS (0 falhas); `test_resolve`/`test_queries`/`test_jobs` + 29 `test_engine_*` verdes | 2 d |
| **F4 · Catálogo e copy** | `datamodel.json` com as 5 descrições reescritas; painel "Sobre esta demonstração"; badge `DEMO DATA · <domínio>` | Nenhuma menção residual a transformadores (`grep -i` limpo); painel revisado | 1,5 d |
| **F5 · Varredura de telas** | Checklist tab a tab (40 abas): tabela, cards, reports, filtros, formulário, subitens | Zero aba vazia (exceto registries de sistema); zero card ou gráfico degenerado (valor único, série plana, "sem dados") | 1,5 d |
| **F6 · Deploy e regressão** | Publicação em `/app/`, MVP em branco intacto, screenshots de referência | Demo pública navegável; `?data=` alternando datasets se a coexistência for aprovada | 1 d |

**Total restante: 11,5 dias úteis** (a F0.5 já foi executada), ≈ 2,5 semanas com revisões.

Marcos de revisão sugeridos: fim de F1 (o dicionário é onde a demo é ganha ou perdida) e fim de
F3 (dado coerente antes de investir em copy).

---

## 7. Volumetria proposta

Refeita em 21/08 depois da R6 — **sem a entidade `Contract`**: quem faz o papel de contrato é a
**SLA**, então o módulo CRM ganha profundidade em vez de largura.

| Módulo | Proposta (vs. atual) |
|---|---|
| Organization | Segments 3 · Units 4 · Departments 6 · Squads 6 · Regions 3 · Branches 12 · Issues 6 |
| Portfolio | Products 12 · Product Specs **8** (2) · Product Groups 14 · Scopes 8 · Classes **5** (0) · Product Scopes 24 · Events 20 · Payload 26 (movido de Operation, 2026-09-07) |
| CRM | Customers 18 · **SLA 20** (o contrato — 12 a 16 com forecasts) · Forecasts **156** (144 mensais + 8 trimestrais + 4 anuais) · Forecast Scopes **360** |
| Operation | Processes 6 · Activities 22 · Workflows 24 · Actions 8 · Tasks 48 · Procedures 52 · Handouts 14 · Channels 5 · Requirements **18** (9) · Requirement Type 5 |
| Talent | Functions 6 · Roles 12 · Job Family 4 · Skill Levels 4 · People 36 · Competence **28** (12) · Onboarding **60** (32) |
| Workspace | Projects 10 · Tickets **160** (≈ 96 ligados a demand lines) · Jobs **240** |
| Control | Capacity **72 derivadas** (6 funções × 12 meses) · Performance **90 a 140 derivadas** (função × cliente × mês, só grupos com jobs `Done`) |

**≈ 1.700 registros** — mesma ordem de grandeza do atual (o dataset é carregado inteiro no
navegador; não convém crescer). Os aumentos são deliberados: Requirements, Competence e
Onboarding sustentam as histórias 2 e 3; Classes e Product Specs eliminam as abas vazias;
Forecasts cobre os três períodos do enum **com massa em cada um** — o dataset de hoje tem 156
mensais contra **2 trimestrais e 2 anuais**, o que exercita o código mas não sustenta um gráfico;
e Jobs cobre os quatro status com histórico de parada. Capacity e Performance não entram no
dicionário de domínio: são **calculadas pelo gerador** (o `derive_control.py` da R6 vira um
estágio do `build_seed.py`) e reconferidas pelo validador.

---

### 7.1 Higiene de seed — o que a R6 deixou para o gerador

As migrações da R6 corrigiram o **modelo**; o dataset atual ainda carrega resíduos que o gerador
precisa impedir por construção. Levantados nesta sessão sobre o dataset em `schemaVersion` 49:

| Resíduo | Medida atual | Regra do gerador |
|---|---|---|
| Elo demanda↔execução quase vazio | **30 de 135** tickets ligados, concentrados em **2** das 398 demand lines | ≥ 55% dos tickets ligados, espalhados por ≥ 60 linhas distintas |
| `remaining` negativo | FS026 com 27 tickets contra `quantity = 1` (**remaining −26**) | `consumption ≤ forecastScopeQuantity` em toda linha; o excedente vira ticket fora do forecast |
| Jobs em execução com data futura | **14** jobs `Active`/`Stoped` com `realStartDate` até nov/2026 (âncora: 21/08/2026) | nenhuma data real posterior à âncora, em nenhum status |
| Horas reais antes do fim | **14** jobs `Active`/`Stoped` com `realExecutionTime` preenchido e `realEndDate` nulo | `realExecutionTime` só existe em job `Done` |
| Parada mal formada | 2 jobs `Stoped` com `realEndDate` preenchido e `jobBufferExecution = 0` | `Stoped` ⇒ sem `realEndDate`, com `stoppedAt` e buffer > 0 |
| Períodos de forecast simbólicos | 156 mensais · **2** trimestrais · **2** anuais | massa suficiente em cada período para o gráfico ler (§7) |

Cada linha vira um assert no bloco `== narrative ==` do validador. São todas verificações baratas
— e são exatamente o tipo de incoerência que um cliente encontra ao clicar em um registro
qualquer durante a demonstração.

---

## 8. Modos publicados e navegação da demo

Decisão de 21/08: **substituição**. Ficam **dois modos**:

| Modo | URL | Conteúdo |
|---|---|---|
| Demo pública | `/app/` | Vitalis Health Network — o único dataset publicado |
| MVP em branco | `/app/mvp/` | Vazio + localStorage (workshops de consultoria) — inalterado |

O dataset de transformadores sai do ar, mas não se perde: fica no histórico do git e deve ser
preservado em um **build marcado** (`git tag demo-transformers-v1`, conforme o item 4 do
"working agreement" em `offline_database.md`, que já recomenda congelar builds por engajamento).
Se um stakeholder da Northwind Energy precisar da versão setorial, ela é republicável a partir da
tag sem reconstrução.

Duas adições de UI pagam sozinhas o esforço da troca:

1. **Badge no cabeçalho**: `DEMO DATA · Rede Vitalis` — deixa explícito que os dados são fictícios.
2. **Painel "Sobre esta demonstração"** (drawer, 6 linhas): quem é a organização fictícia, o que
   ela vende, e **o que olhar em cada módulo**. É o que converte um visitante frio; sem ele, o
   dado novo é apenas um rótulo diferente.

---

## 9. Riscos e cuidados

| Risco | Mitigação |
|---|---|
| Uso de marcas reais (hospitais, redes, montadoras) | Nomes 100% fictícios; nenhum logotipo real; rodapé "dados fictícios para demonstração" |
| Dados que pareçam pessoais (área de saúde) | Pessoas fictícias, e-mails `@exemplo.com`, nenhum paciente nominal — o modelo não tem entidade "paciente"; o Ticket é o atendimento, não a pessoa |
| Demo esconder a origem industrial do produto (substituição aprovada) | Build marcado `demo-transformers-v1` republicável (§8) + uma linha no painel "Sobre esta demonstração" declarando que o modelo nasceu em uma divisão de engenharia industrial e é agnóstico de setor |
| Dados em inglês com nomes de pessoas | Nomes fictícios de origens variadas, e-mails `@exemplo.com`; nenhuma correspondência com pessoas reais da organização |
| Envelhecimento do dataset | Datas ancoradas + deslocamento no load (§5.2, princípio 4) |
| Dívida de manutenção | O gerador determinístico é a mitigação: cada PR de schema roda `build_seed.py` + `validate_mockup.py` no CI |
| Perda de fidelidade a ISO 9001 nas descrições | Manter as citações de cláusula (§4.1, §7.2, §8.2…) nas descrições — elas são agnósticas e reforçam o propósito |

---

## 10. Decisões registradas e próximo passo

| # | Decisão | Efeito no plano |
|---|---|---|
| 1 | **Domínio A** — Vitalis Health Network (rede de clínicas e diagnóstico por imagem) | §4.1 vira o dicionário base da F1 |
| 2 | **Dados em inglês** | Vocabulário do YAML em EN; descrições do catálogo reescritas em EN |
| 3 | **Substituição** do dataset de transformadores | §8 com dois modos; build marcado antes do merge |
| 4 | **Gerador reconstruído** (`tools/seed/`) | F2 confirmada com 3 dias; `generate_mockup.py` e os ~50 `migrate_*.py` passam a ser histórico |
| 5 | **R6 executada com SLA no papel de Contract** (#241–#246) | Sem entidade nova: `SLA 1:N Forecasts`. §7 refeita; F0.5 encerrada; resíduos de seed movidos para a §7.1 |

**Próximo passo — F1, liberada.** Produzir `tools/seed/domains/clinic.yaml` (dicionário das 40
tabelas) e `narrative.md` com as seis histórias. O dicionário já nasce contra o modelo definitivo
— três entradas mudam de natureza em relação ao rascunho da §4.1:

- **SLA** deixa de ser "acordo de nível de serviço" e passa a ser **o contrato com o convênio**:
  define quais exames (product scopes) estão cobertos, em qual unidade, e é o pai dos forecasts.
- **Forecast Scope** deixa de nomear três chaves soltas e passa a nomear **um par Exame × Escopo
  já contratado** (product scope do payload da SLA) mais a **função** que executa — que é o
  vocabulário que um gestor de clínica usa ("horas de radiologista para tomografia de urgência").
- **Capacity e Performance saem do dicionário**: nada a nomear, são cálculo.

Duas perguntas ficam abertas para a F1 e não bloqueiam o início:

- **Escala da rede fictícia** — 12 unidades em 2 países (Brasil/Argentina, coerente com o
  registry de Countries e com Regions) ou uma rede monopaís mais densa?
- **Marca do painel de demo** — manter a identidade visual Northwind Energy no cabeçalho (é o
  design system do protótipo) ou neutralizá-la para a demo pública, dado que a operação
  retratada passa a ser fictícia e de outro setor.
