# Contributing

Obrigado por contribuir com o EDQMS. Esta página resume como trabalhamos. A política de fundo está no **ADR-0004**; o arquivo `CONTRIBUTING.md` no repositório é a versão normativa (esta página é a porta de entrada amigável).

## Fluxo de trabalho

1. Abra ou comente uma *issue* descrevendo o que pretende fazer.
2. Crie um branch a partir do padrão do projeto (ex.: `feat/...`, `fix/...`, `docs/...`).
3. Faça as mudanças com **testes** e **documentação** correspondentes.
4. Rode `pnpm test` e `pytest tools/` — ambos verdes.
5. Abra um PR seguindo o checklist abaixo.

## Convenções

- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`…).
- Mudou o **Model** do datamodel? Gere a migração de banco e rode `pnpm spec:build` (ver [[Working with the Datamodel]]).
- Criou um **script** (Python ou Node)? Documente-o: docstring de cabeçalho + entrada em `tools/README.md` com comando e exemplo.
- Mudou **documentação de contribuidor**? Edite os arquivos em `docs/wiki/` (não direto no wiki do GitHub) e abra PR — o wiki é publicado a partir de `docs/wiki/` (ver ADR-0005).

## Checklist de PR

- [ ] Testes relevantes adicionados/atualizados e verdes (`pnpm test`, `pytest tools/`).
- [ ] Documentação atualizada (wiki em `docs/wiki/`, `tools/README.md`, docstrings).
- [ ] Se decisão de arquitetura mudou, um ADR foi adicionado em `docs/adr/`.
- [ ] Commits no padrão Conventional Commits.

## Contexto de IA compartilhado

Contribuidores usam ferramentas de IA diferentes (Claude Code, Cursor, Copilot, Fable, entre outras). Para todos partirem do mesmo entendimento:

- **`.claude/`** no repositório traz *agents*, *skills* e *commands* para quem usa Claude Code; o **`CLAUDE.md`** na raiz descreve arquitetura, convenções e pontos de entrada. É descoberto automaticamente ao clonar.
- **Documentação neutra** (este wiki e `docs/adr/`) é Markdown que qualquer assistente de IA consegue ingerir — é a fonte conceitual; o `.claude/` é a materialização dela para o Claude Code.

Ao contribuir com IA, alimente seu assistente com este wiki e o ADR log, e **revise a saída** — o padrão de qualidade (testes verdes, decisões respeitadas) é o mesmo, com ou sem IA.

## Código de conduta e licença

Ver `CODE_OF_CONDUCT.md` e `LICENSE` no repositório.
