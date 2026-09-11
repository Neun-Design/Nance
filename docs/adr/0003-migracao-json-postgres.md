# ADR-0003 — Migração de dados JSON → Postgres via ETL idempotente

- **Status:** Aceito
- **Data:** 2026-09-11
- **Decisores:** Rafael Bova (proprietário do projeto)
- **Relacionados:** ADR-0001 (stack), ADR-0002 (datamodel), ADR-0004 (fluxo de dev)

## Contexto

O cliente final **já usa o MVP atual em produção** e a sua base de dados é persistida como **JSON** (o store em memória do protótipo serializado, na estrutura `módulo → entidade → linhas`, como em `mockup_data_prototype.json`). Esse uso continua **até o lançamento da v1 na nuvem**. No lançamento, os dados reais acumulados precisam ser carregados no **PostgreSQL** da v1, cujo schema é **gerado a partir da camada Model** do datamodel (ADR-0002).

Fatos que orientam a solução: campos derivados (rollup/mirror/computed) **não são armazenados** — são recalculados pelo motor —, logo a migração só precisa dos **campos base**. O lançamento pode escorregar de data, e correções de última hora podem exigir recarregar. E o projeto valoriza **ferramentas de dados em Python** documentadas, de modo que desenvolvedores, UX e frontend designers entendam o pipeline e usem seus próprios assistentes de IA (ADR-0004).

## Decisão

**Definir agora um contrato de export versionado e implementar a migração como um ETL idempotente e re-executável em Python.**

**1. Congelar e versionar o contrato de export — imediatamente.** Como o cliente acumula dados a cada dia, define-se já um formato de exportação estável e versionado (`export_schema_version`), com metadados (data/hora, versão do app, versão do datamodel que o gerou). O protótipo passa a exportar nesse formato. Isso protege os dados gerados daqui até o lançamento e torna a migração previsível, em vez de perseguir um formato que muda pelo caminho.

**2. ETL em quatro estágios** (`tools/etl/`, Python), executável quantas vezes for preciso:

- **Extract.** Ler um snapshot JSON exportado; identificar `export_schema_version` e escolher o adaptador correspondente.
- **Validate.** Conferir o snapshot contra o **schema derivado da camada Model** (o mesmo `zod`/JSON Schema do ADR-0002, exportado para consumo em Python como JSON Schema). Falhas viram um **relatório de validação** legível, sem carregar nada — descobre-se o problema antes de tocar o banco.
- **Transform.** Descartar campos derivados; mapear multivalorados/arrays para JSONB ou tabelas de associação conforme o Model; normalizar tipos (datas ISO, enums); preservar chaves primárias originais para manter estabilidade de identidade e integridade referencial.
- **Load.** Inserir em ordem topológica de FK (pais antes de filhos), tudo dentro de **uma transação**, via **upsert idempotente** (`INSERT ... ON CONFLICT (pk) DO UPDATE`). Rodar duas vezes o mesmo snapshot produz exatamente o mesmo estado — nenhuma duplicação.

**3. Modos de operação.** `--dry-run` (valida e simula, reportando contagens e diferenças, sem escrever); `--load` (executa de verdade); `--report` (gera um resumo: linhas por entidade, rejeições, FKs órfãs). Um **log de migração** em tabela própria registra cada execução (versão do snapshot, contagens, resultado).

**4. Testabilidade.** Testes (pytest) com snapshots-fixtura cobrindo: idempotência (rodar 2× = mesmo estado), integridade referencial, e round-trip (export do protótipo → ETL → consulta no Postgres bate com o esperado). Reaproveitam a intenção dos testes já existentes (`validate_mockup.py`, `test_resolve.mjs`).

**5. Cutover no lançamento.** Como o ETL é idempotente, o lançamento é: congelar escritas no protótipo → exportar o snapshot final → `--dry-run` → `--load` → validar → apontar a v1 para o Postgres. Se algo falhar, corrige-se e recarrega-se o mesmo snapshot sem efeitos colaterais.

## Consequências

**Positivas.** Re-executável e seguro: a data de lançamento pode mudar e correções podem ser reaplicadas sem risco de duplicar dados. A validação contra o Model antecipa problemas de qualidade. Reaproveita o Model como fonte única (schema do banco, validação do ETL e regras do app saem do mesmo lugar). Escrito em Python e documentado, é acessível a todo o time.

**Negativas / custos.** Exige disciplina para manter o contrato de export estável e evoluí-lo por versão (com adaptador por versão no Extract). Estabilidade de PK depende de o protótipo não reusar/renumerar ids — precisa ser garantido no export. Divergências entre o formato acumulado pelo cliente e o Model atual precisarão de regras de mapeamento explícitas (documentadas junto ao adaptador de versão).

**Neutras.** Campos derivados ausentes no banco são esperados e recalculados pelo motor; a migração não os considera.

## Alternativas consideradas

**Cutover único (big-bang) sem idempotência.** Mais simples de escrever, porém frágil: qualquer falha ou escorregão de data obriga a limpeza manual antes de recarregar. Descartado pela assimetria entre o custo baixo da idempotência e o risco alto do one-shot.

**Sincronização contínua / dual-write** entre JSON e Postgres durante uma janela de transição. Robusto para zero-downtime, mas exige manter dois sistemas de escrita em paralelo e reconciliá-los — complexidade desproporcional para a escala de um MVP com cutover planejado. Descartado.
