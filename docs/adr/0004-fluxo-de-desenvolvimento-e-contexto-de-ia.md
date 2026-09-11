# ADR-0004 — Fluxo de desenvolvimento e contexto de IA compartilhado

- **Status:** Aceito
- **Data:** 2026-09-11
- **Decisores:** Rafael Bova (proprietário do projeto)
- **Relacionados:** ADR-0001 (stack), ADR-0002 (datamodel), ADR-0003 (migração)

## Contexto

O EDQMS v1 será **open source**, e a contribuição externa importa já nesta fase. O projeto é **poliglota**: aplicação em TypeScript (Vue/Express/Node — ADR-0001), especificação em TypeScript compilada (ADR-0002) e ferramentas de dados/ETL/validação em **Python** (ADR-0003). Os contribuidores — desenvolvedores, UX e frontend designers — usarão **ferramentas de IA distintas** (Claude Code, Cursor, Copilot, Fable, entre outras) e precisam partir do **mesmo entendimento** do projeto para que suas contribuições sejam coerentes.

Há também um pedido específico: materializar o contexto de desenvolvimento do Claude Code (skills, agents e documentação correlata) de forma que qualquer contribuidor use o mesmo ambiente. A ideia inicial eram *gists*; este ADR decide como tratar isso de forma sustentável.

## Decisão

**Tornar o repositório a fonte única do fluxo de trabalho e do contexto de IA — versionado com o código, agnóstico de ferramenta e com todos os scripts documentados.**

**1. Todo script é documentado, não só o código de aplicação.** Cada ferramenta em `tools/` (scripts Python de parse de dados, ETL, validação; scripts de teste em Node) tem: um cabeçalho de docstring explicando propósito, entradas e saídas; uma entrada em `tools/README.md` com o comando de execução e um exemplo; e, quando gera ou consome dados, a referência ao contrato/Model correspondente. O objetivo é que UX e frontend designers **entendam o pipeline** e possam pedir ajuda às suas próprias ferramentas de IA sem depender de conhecimento tribal.

**2. Contexto de IA vive em `.claude/` no repositório — não em gists.** A pasta `.claude/` versionada contém `agents/`, `skills/` e `commands/`, e um `CLAUDE.md` na raiz descreve a arquitetura, as convenções e os pontos de entrada do projeto. Assim o contexto é descoberto automaticamente pelo Claude Code de qualquer clone, evolui em PRs junto com o código e nunca desatualiza em relação a ele. *Gists* foram descartados por ficarem desacoplados do repositório, sem versionamento conjunto e propensos a divergir.

**3. Contexto agnóstico de ferramenta.** Como nem todos usam Claude Code, o entendimento essencial (arquitetura, glossário do domínio, decisões — este ADR log) mora em Markdown neutro em `docs/`, que qualquer assistente de IA consegue ingerir. O `.claude/` é a *materialização específica* desse contexto para Claude Code; a fonte conceitual é a documentação neutra, evitando duplicação divergente.

**4. Convenções mínimas de contribuição.** Um `CONTRIBUTING.md` define: setup do monorepo (pnpm, Python), como rodar app/tests/ETL, padrão de branches e Conventional Commits, exigência de testes verdes (Vitest para o motor, pytest para o ETL) e revisão de PR. `LICENSE`, `README.md` e `CODE_OF_CONDUCT.md` completam o pacote open source.

**5. Base para a aba "Desenvolvedores".** A futura aba de Desenvolvedores na documentação de Stakeholders **deriva** deste repositório (este ADR, o `CONTRIBUTING.md`, o `tools/README.md` e o `CLAUDE.md`), em vez de ser mantida à parte — a documentação para humanos e o contexto para IA saem da mesma fonte.

## Consequências

**Positivas.** Um único lugar de verdade para código, decisões e contexto de IA, versionado em conjunto. Contribuidores de qualquer ferramenta de IA partem do mesmo entendimento. O pipeline Python fica acessível a perfis não-backend. A aba de Desenvolvedores não vira um documento paralelo que envelhece.

**Negativas / custos.** Exige disciplina de manter `.claude/`, `docs/` e docstrings atualizados nos PRs (mitigável com um item de checklist de PR e, futuramente, verificação em CI). Há custo inicial de escrever a documentação de cada script existente.

**Neutras.** A escolha não obriga ninguém a usar Claude Code; apenas oferece o contexto pronto a quem usa, e o equivalente neutro a quem não usa.

## Alternativas consideradas

**Gists para skills/agents/documentação.** Proposta inicial. Descartada: gists ficam fora do fluxo de PR, não versionam junto com o código e tendem a divergir da realidade do repositório.

**Repositório-companheiro só para contexto de IA.** Mantém o contexto separado do código de aplicação; descartado pelo mesmo motivo dos gists (desincronização) e por dobrar o overhead de manutenção.

**Wiki do GitHub como fonte da documentação de dev.** Útil para navegação, mas a wiki vive fora do versionamento do código-fonte; adotamos `docs/` no repositório como fonte e deixamos a wiki (se usada) como espelho gerado, não como verdade.
