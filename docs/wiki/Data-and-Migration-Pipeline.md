# Data and Migration Pipeline

Como os dados entram no EDQMS e como o banco da v1 será populado a partir do que o cliente já usa hoje. As ferramentas de dados são **Python** e estão documentadas para que qualquer perfil (dev, UX, designer) entenda o pipeline e use suas próprias ferramentas de IA. Decisão de fundo: **ADR-0003**.

## Contexto

O cliente já usa o MVP e sua base é salva como **JSON** (estrutura `módulo → entidade → linhas`). No lançamento da v1, esses dados vão para o **PostgreSQL**, cujo schema é **gerado da camada Model** do datamodel. Campos derivados (rollup/mirror/computed) **não** são armazenados — o motor os recalcula —, então a migração só carrega **campos base**.

## Contrato de export (versionado)

O JSON exportado carrega metadados: `export_schema_version`, data/hora, versão do app e versão do datamodel que o gerou. **Congelar esse formato agora** é o que torna migráveis os dados acumulados daqui até o lançamento. Cada versão de export tem um adaptador correspondente no estágio de *Extract*.

## O ETL em quatro estágios

Os scripts vivem em `tools/etl/`.

1. **Extract** — lê um snapshot JSON e escolhe o adaptador pela `export_schema_version`.
2. **Validate** — confere o snapshot contra o schema derivado do Model (o mesmo `zod`/JSON Schema da spec, exportado para Python). Falhas viram um **relatório legível**, sem tocar no banco.
3. **Transform** — descarta campos derivados; mapeia multivalorados/arrays para JSONB ou tabelas de associação conforme o Model; normaliza tipos; preserva as PKs originais (estabilidade de identidade e integridade referencial).
4. **Load** — insere em ordem topológica de FK (pais antes de filhos), numa **transação**, via **upsert idempotente** (`INSERT ... ON CONFLICT (pk) DO UPDATE`). Rodar o mesmo snapshot duas vezes produz o mesmo estado — sem duplicar.

## Modos de uso

```bash
python -m tools.etl --snapshot export.json --dry-run   # valida e simula, não escreve
python -m tools.etl --snapshot export.json --load      # executa de verdade
python -m tools.etl --snapshot export.json --report    # resumo: linhas/entidade, rejeições, FKs órfãs
```

Cada execução real fica registrada num **log de migração** (versão do snapshot, contagens, resultado).

## Cutover no lançamento

Como o ETL é idempotente: congelar escritas no protótipo → exportar o snapshot final → `--dry-run` → `--load` → validar → apontar a v1 para o Postgres. Se algo falhar, corrige-se e recarrega-se o **mesmo** snapshot sem efeitos colaterais.

## Testes

Em `tools/` com **pytest**, cobrindo idempotência (2× = mesmo estado), integridade referencial e round-trip (export do protótipo → ETL → consulta no Postgres bate com o esperado). Rode `pytest tools/`.

## Outras ferramentas de dados

Scripts herdados/relacionados de geração e validação de mockups também vivem em `tools/` e são documentados em `tools/README.md` (propósito, entradas, saídas, exemplo de execução). Se você criar um script novo, documente-o lá — é parte da política do **ADR-0004**.
