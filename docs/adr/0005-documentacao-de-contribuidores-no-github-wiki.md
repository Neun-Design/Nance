# ADR-0005 — Documentação de contribuidores no GitHub Wiki

- **Status:** Aceito
- **Data:** 2026-09-11
- **Decisores:** Rafael Bova (proprietário do projeto)
- **Refina:** ADR-0004 (fluxo de desenvolvimento e contexto de IA)
- **Relacionados:** ADR-0001, ADR-0002, ADR-0003

## Contexto

O ADR-0004 previu que a documentação para desenvolvedores derivaria do repositório e mencionou a possibilidade de uma aba "Desenvolvedores" na documentação de *stakeholders*. Ao revisar, decidiu-se que **tratar o contribuidor open source como um stakeholder é conceitualmente errado**: são públicos distintos, com necessidades distintas. A documentação de contribuidores merece uma casa própria, separada e navegável.

Ao mesmo tempo, o ADR-0004 estabeleceu (com razão) que o que precisa acompanhar o código deve viver **no repositório**, versionado e revisado por PR — para não divergir. É preciso conciliar as duas coisas: uma casa acolhedora para o contribuidor **e** a garantia de que ela não descola do código.

Restrição técnica relevante: o **GitHub Wiki não tem API** e é um repositório git separado (`<owner>/<repo>.wiki.git`); a primeira página precisa ser criada pela interface web para inicializar, e a partir daí publica-se via `git push`.

## Decisão

**A documentação de contribuidores passa a viver no GitHub Wiki, mas é escrita e versionada em `docs/wiki/` no repositório e publicada no wiki a partir dali.**

Concretamente:

- **Fonte da verdade:** os arquivos Markdown em `docs/wiki/` no repositório. Edições entram por PR (revisão, versionamento, histórico) — nunca direto pela interface do wiki.
- **Publicação:** o conteúdo de `docs/wiki/` é espelhado no `<owner>/<repo>.wiki.git`. Manualmente no início; automatizável depois com uma GitHub Action que faz o push a cada mudança em `docs/wiki/` na branch principal.
- **Papel do wiki:** a camada de *apresentação* navegável e amigável para desenvolvedores, UX e designers — separada da documentação de stakeholders. Não substitui o repositório como fonte.
- **O que permanece no repositório (não migra para o wiki):** o **ADR log** (`docs/adr/`), o **`.claude/`** (agents/skills/commands) e o **`CONTRIBUTING.md`** normativo. Esses artefatos têm de acompanhar o código e passar por PR; o wiki os referencia, não os hospeda.
- **A "aba Desenvolvedores" na doc de stakeholders está cancelada** como conceito; seu propósito é atendido pelo wiki.

## Consequências

**Positivas.** Contribuidores ganham uma documentação própria e navegável, sem serem tratados como stakeholders. Como a fonte é `docs/wiki/` no repositório, a doc não diverge do código e evolui por PR. O ADR log e o `.claude/` seguem íntegros no repositório.

**Negativas / custos.** Há um passo de publicação (espelhar `docs/wiki/` → `.wiki.git`); enquanto não houver a Action, é manual. O wiki precisa ser **habilitado e ter a primeira página criada pela interface web** antes do primeiro push (limitação do GitHub). Contribuidores precisam lembrar de editar `docs/wiki/`, não o wiki diretamente (mitigado por aviso no rodapé de cada página e no `CONTRIBUTING.md`).

**Neutras.** Mantém-se o princípio do ADR-0004 ("repositório como fonte"); muda-se apenas a *superfície de apresentação* da documentação de contribuidores.

## Alternativas consideradas

**Aba "Desenvolvedores" na documentação de stakeholders** (proposta no ADR-0004). Descartada por misturar públicos distintos: contribuidor não é stakeholder.

**Wiki como fonte da verdade (editado direto pela interface).** Descartado: o wiki vive fora do versionamento do código, sem PR, e divergiria — exatamente o risco que o ADR-0004 quis evitar.

**Somente `docs/` no repositório, sem wiki.** Correto quanto ao versionamento, mas menos navegável e acolhedor para quem chega; o wiki agrega a camada de apresentação sem abrir mão da fonte versionada.
