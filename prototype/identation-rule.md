# Workflow step ordering (indentationID)

Eh necessario um indice para ordenar as atividades (Workflows) e formar o workflow do processo. A subitem-table de Processes ordena seus Workflows de forma crescente pelo `indentationID`. Essa sequencia sera a base para, no futuro, definir a ordem dos Jobs automaticamente quando um usuario abrir um ticket (fora do escopo atual — ver "Future work").

## Workflow Table example

| ID | Process | Activity | Parent Step | identationRule | identationID |
|---|---|---|---|---| --- |
| WF01 | Offer Electrical Design | Allocation |  |  | 1 |
| WF02 | Offer Electrical Design | Technical Assessment |WF01| start-to-finish | 2 |
| WF03 | Offer Electrical Design | Technical Clarification |WF02| finish-to-finish |  2.1 |
| WF04 | Offer Electrical Design |Data Collection|WF02|  finish-to-finish  | 2.2|
| WF05 | Offer Electrical Design |Offer Design|WF02| start-to-finish |3 |
| WF06 | Offer Electrical Design |Operational Clarification|WF05| finish-to-finish | 3.1|
| WF07 | Offer Electrical Design |Technical Spectification|WF05| start-to-finish | 4|

## Resolucao (2026-07-30) — valor derivado, nunca armazenado

A preocupacao original era o custo de consultar todos os workflows do banco a cada novo cadastro para calcular o `indentationID`, e a alternativa sugerida era mover o cadastro para dentro do formulario de Processes. **Decisao:** o `indentationID` nao eh armazenado — ele eh 100% derivavel de `parentStepID` + `indentationRule`, e o motor o calcula em tempo de renderizacao, sempre restrito aos steps de um unico processo:

- **Regra no datamodel:** `computed: STEPORDER(parentStepID, indentationRule) per processID` (Workflows.indentationID).
- **Algoritmo** (`stepOrderMap` em `js/resolve.js`): agrupa os workflows por `processID`, monta a arvore por `parentStepID` e numera em ordem de insercao — raiz → proximo inteiro major; dependencia **sequencial** (`start-to-finish`, `finish-to-start`) → proximo inteiro major; dependencia **paralela** (`finish-to-finish`, `start-to-start`) → sub-numero do pai (`2.1`, `2.2`, `2.1.1`…). Reproduz exatamente a tabela-exemplo acima.
  - *Premissa:* o exemplo so cobre `start-to-finish` e `finish-to-finish`; a classificacao de `finish-to-start` (sequencial) e `start-to-start` (paralela) eh generalizacao a validar quando esses casos aparecerem.
- **Formulario:** o campo manual "Identation" foi removido; o usuario informa apenas Parent Step (filtrado pelos steps do mesmo Process) e a Identation Rule. O cadastro tambem funciona pelo botao "New Workflow" dentro do formulario de Processes (subitem-list), como sugerido.
- **Custo:** a preocupacao de memoria se dissolve — nada eh recalculado globalmente. No prototipo (dados em memoria) a numeracao roda so sobre os irmaos do processo exibido; num banco real a consulta equivalente seria `WHERE processID = ?` sobre dezenas de linhas, trivial com indice em `processID`. Derivar tambem elimina o risco de renumeracao inconsistente ao inserir/remover steps no meio da cadeia.
- **Dados:** `tools/migrate_indentation.py` removeu os `indentationID` armazenados do mockup, inferindo o `indentationRule` legado a partir da numeracao antiga. `tools/test_engine_indentation.mjs` comprova que a derivacao reproduz os 21 valores legados.

## Future work

- Sequenciamento automatico de Jobs na abertura de tickets usando a cadeia `parentStepID`/`indentationRule` (mudancas em `tasksForJob`/`applyJobTransition`, `js/forms.js`).
- Renderizacao visual de arvore/indentacao na tabela (hoje o valor apenas ordena as linhas).
