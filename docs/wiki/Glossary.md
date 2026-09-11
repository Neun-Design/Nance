# Glossary

Termos do domínio e da arquitetura do EDQMS. Útil especialmente para quem chega de UX/design ou de fora do backend. Os conceitos de renderização derivam do *datamodel* — ver [[Working with the Datamodel]].

## Domínio e telas

- **EDQMS** — Engineering Data Quality Management System; o Global Engineering Portal.
- **Module** — uma entrada do menu lateral (Customers, Operation, Inventory/Portfolio, Workload, Control, Talent). Ordenado por `sidebar-position`.
- **Dashboard / Tab** — uma tela dentro de um módulo. Renderiza, de cima para baixo: cards → tabela de dados → reports.
- **Overview** — dashboard especial montado automaticamente a partir de cards e reports marcados com `overview-display: true`.
- **Card** — um KPI acima da tabela (valor principal, tendência, detalhe), posicionado por coordenada de grid `Card R-C`.
- **Report** — um gráfico abaixo da tabela; seu tipo e regra vêm do datamodel.
- **Subitem table** — tabela-filha expansível por linha (a seta/chevron), filtrada pelos filhos daquela linha.

## Datamodel e motor

- **Datamodel** — a especificação canônica do sistema. Na v1, escrita em TypeScript (config-as-code) e compilada para `datamodel.json`.
- **Model / View / Behavior** — as três camadas da spec: forma dos dados / layout / comportamento (ver [[Working with the Datamodel]]).
- **Engine (motor)** — o código (TS, agnóstico de framework) que interpreta a spec e resolve valores em tempo de execução.
- **Attribute** — uma coluna/campo de uma entidade, com `type`, `rule` e restrições.
- **FK (foreign key)** — referência a outra entidade; exibe o *nome* do alvo, nunca o id cru.
- **Rollup** — valor derivado que agrega registros filhos (não armazenado; recalculado).
- **Mirror** — valor espelhado de registros relacionados (não armazenado).
- **Computed** — valor calculado por expressão/caminho (não armazenado).
- **Derive, don't repeat** — princípio: a View é deduzida do Model; instâncias declaram só exceções.

## Dados e infraestrutura

- **Export contract** — o formato versionado do JSON exportado pelo app (`export_schema_version`), base da migração.
- **ETL** — pipeline Extract/Validate/Transform/Load que carrega snapshots JSON no Postgres, de forma idempotente (ver [[Data and Migration Pipeline]]).
- **Idempotente** — rodar a mesma carga N vezes resulta no mesmo estado, sem duplicar.
- **ADR** — Architecture Decision Record; uma decisão registrada em `docs/adr/`.
- **shadcn-vue** — a implementação para Vue dos componentes no estilo shadcn (o shadcn/ui original é React-only).
