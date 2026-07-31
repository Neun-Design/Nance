# Interface
- Permitir que o drawer de edit seja acionado sempre que o usuario clicar em cima de um item na lista.
- Mudar de "OMTERRA GOVERNANCE PORTAL" to "POWERGRID GOVERNANCE PORTAL"
- alguns campos de input de formularios abrem automaticamente o drawer para cadastro de um novo item sempre que clicados. Isso acontece, principalmente no campo para input de "Regions". O drawer soh deve abrir qdo o botao com sinal de plus (+) for clicado.
- O drawer fecha sempre que o usuario clica fora do drawer. Modificar esse compartamento para o drawer fechar apenas quando o icone de fechar for clicado, ou o botao discard, cancel ou save.
- Existe um loop no drawer sempre que um novo item tenta ser criado que possui um campo relacionado ao formulario de origem.
  - Exemplo: Cadastro de Region 
    - caso o Owner ainda nao tenha sido cadastrado, ao clicar no simbolo de Plus para cadastrar novo People, o primeiro input eh a region, o que cria um loop eterno.
      - Uma solucao interessante seria habilitar o campo "Owner" apenas quando o regionName for inserido, e quando o usuario clicar em criar novo usuario pelo botao de plus, o campo de region desse novo drawer para people ja seja preenchido automaticamente pela Region do drawer anterior.

# Data Model 

## Customers

- a primeira coluna da tabela deve ser "CUSTOMER NAME"


## Onboarding

- No formulario, substituir o input de Business Unit por Department (grouped by businessUnitName)

## Product Specs

- Eliminar input Business Unit do formulario. Este parametro sera definido atraves do produto selecionado, sem necessidade de escolha do usuario.


## Product Groups 

- Adicionar um novo atributo:
  - classCodeName: VARCHAR.

- Adicionar um novo input (Class Code) no formulario, acima de Business Segment para o atributo classCodeName

## Product Scopes 

- Elminar input Business Unit do formulario. Essa atributo sera preenchido automaticamente apos a escolha de Scope e Product Group.

## Regions 

- subitem-tables: Business Units


## Departments 

- subitem-tables: Squads

## Business Units

- subitem-tables: Departments
