Neste documento vou apresentar de forma resumida o roadmap do projeto.

> [!NOTE] Claude Code 
> Sua tarefa eh usar este documento para definir as issues necessarias para resolver os itens do roadmap.
> Incorpore/Organize as issues ja existentes no repo dentro das milestones abaixo

# Milestones

| ID | Nome | Descricao |
| --- | --- | --- |
| A0 | MVP |Implementacao de todos os modulos no MVP|
| A1 | Web App |Desenvolvimento da versao do aplicativo web responsivo|
| A2 | Claude-Native Version | Versao para que clientes possam implementar a ferramenta em seus servidores garantindo controle de versoes |
| B1 | AI-Readiness |Desenvolvimento de features e Agentes de IA.|
| C1 |  API|Desenvolvimento das APIs para conexao com outras ferramentas|


## MVP

- Implementacao dos modulos faltantes no MVP:
  - CRM:
    - Forecast
    - Forecast Scopes
  - Workspace:
    - Jobs: baseado (fork) no [ClokinIt](https://github.com/Fudge/clockingit)
      Para o MVP basta ser uma versao que viabilize os relatorios e cards, quando formos para o Webapp podemos avaliar a transformacao integral do modulo `Workspace` em ClockinIt
  - Control:
    - Gestao de issues:
      Opportunities
      Risks
    - KPI: baseado nas abas do tipo [Dashboard](https://monday.com/lang/pt/features/dashboards) do monday.com 
  - Overview:
    Todos os indicadores e graficos de Control/KPI possuirao uma opcao de `Display on Overview` e `Display on a Table`
    - Display on Overview: o grafico (e seus filtros) aparecerao na tela de Overview
    - Display on Table: o usuario podera selecionar uma tabela (eg Portfolio/Products) para mostrar o grafico e seus filtros.

## Web App 
Desenvolvimento do projeto com banco de dados e interface de usario seguindo as ADR em ../../../docs/adr/

- Perfis de Usuario (RBAC)
- Interface de setup e configuracoes do site (adm)
  - Pagina para configuracao da empresa: atualmente o mvp esta no contexto da Divisao de uma empresa (Business Segment esta dentro de uma Divisao)
  eh necessario criar pagina anterior para inserir dados da empresa, seus adm e usuarios, etc.
  - Configuracao dos acessos e perfis de usuarios
- Desenvolvimento de todos os modulos de acordo com o MVP:
- Implementacao de Micro FrontEnd:
  Dividir as interfaces de usuario, exemplo: as subtabelas (subitem-tables) terao seu proprio frontEnd.

## Claude-Native Version

A implementacao da cultura DevOps para preparar o aplicativo para:
- Implementacao via Container (Docker)
- Implementacao via Ansible
- pipeline usando github actions e Jenkins.

A ideia aqui eh que o time de clientes enterprise possam escolher a alternativa que melhor lhes convem de implementacao:
1. Fazer o fork no repositorio e preparar o ambiente do 0;
2. Utilizar o container (ou docker compose)
3. Configurar .yml para implementacao via Ansible na provedor de escolha.

## AI-Readiness

Verifique a documentacao existente no projeto em busca de contexto onde a utilizacao de IA pode ser desenvolvida.

> [!NOTE] Claude Code 
> Conto com suas sugestoes para definir possiveis features nessa milestone

## API

REST API and webhooks para que outras ferramentas possam se conectar com o Nance.

> [!NOTE] Claude Code 
> Conto com suas sugestoes para definir possiveis features nessa milestone

# Capacidade e Planejamento

Devemos considerar um desenvolvedor Full Stack dedicado 30 horas semanais responsavel pela implementacao de todas as milestones.
Isso eh importante para que Sponsors e Stakeholders possam avaliar as issues ou features onde devem investir para agilizar o desenvovlimento da plataforma.


> [!NOTE] Claude Code 
> Construa um roadmap com prazos considerando que vou implementa-lo em https://github.com/orgs/Neun-Design/projects/1
