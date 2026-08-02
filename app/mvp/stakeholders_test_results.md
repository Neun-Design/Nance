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
- atributos:
  - inserir atributos:
    - continent: enum (list with all continents)

## Departments 

- subitem-tables: Squads

## Business Units

- subitem-tables: Departments


## Issues 

- Enviar dashboard Issues para o modulo Organization.
- Form:
  - alterar o input Business Unit para Business Segment

- subitem-tables: Scopes

## Scopes 

- atributos:
  - adicionar atributo scopeClassID (display: scopeClassName), multivalued

- Form:
  - alterar a ordem dos inputs na seguinte sequencia: Code, Name, Business Unit, Opportunity
  - Opportunity input: deve mostrar as opcoes de rollup dos business segments pertencentes a business unit selecionada. agrupar as opcoes por issueType
  - adicionar input "Classification" para listar os itens da tabela Scope Classes (multivalued)


# Modulos 

## Organization

- criar nova tabela (dashboard) chamada "Branches"
  - atributo de Branches:
    - branchID: auto generated
    - businessSegmentID: FK -> Business Segments (display: businessSegmentName)
      - form:
        - input name: Segment
        - input type: select
    - businessUnitID: FK ->  Business Units (display: businessUnitName)
      - form:
        - input name: Country
        - input type: select
        - rule: filtered by businessSegmentID
    - branchName: VARCHAR
      - form:
        - input name: Name
    - cityName: VARCHAR
      - form:
        - input name: City
    - regionID: FK -> Regions (display: regionName)
    - countryName: select from list of countries filtered and grouped by the continents selected in regionID
      - Please, append a table with all the countries for all continents so that the prototype can search. it can be a json file
      - form:
        - input name: Country
        - rule: grouped by continent
    - userID: FK -> People (display: userName)
      - form:
        - input name: Owner
        - rule: filtered by the functionName("Manager")

- Ordem das dashboards neste modulo:
  1. Business segments
  2. Issues
  3. Business Units
  4. Departments
  5. Squads
  6. Regions
  7. Branches

## CRM

Deixar esse modulo "inativo" da mesma que forma dos modulos "Overview", "Workspace" e "Control"


## Portfolio

- Ordem das dashboards neste modulo:
  1. Classes
  2. Scopes
  3. Products
  4. Product Specs
  5. Product Groups
  6. Requirements
  7. Product Scopes

### Requirements

- Form:
  - Alterar o input "Customer" para listar os itens da tabela "Branches", filtrados pela business Unit selecionada e agrupados por 

### Classes

- Atributos:
  - scopeClassID: auto generated
  - scopeClassName: VARCHAR (form input: text input)
  - scopeClassDefinition: VARCHAR (form input: TEXT box)
  - issueID: FK -> Issues (display: issueName) (input: select; grouped by businessSegmentName)

- subitem-tables: scopes


## Talent

### People

- atributo:
  - alterar atributo customerID para branchID (display: branchName)

- Form:
  - alterar input Branch para consultar a tabelas Branches ao inves de Customers











