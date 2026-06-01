As intrucoes neste arquivo devem ser usadas para desenvolver a documentacao do projeto utilizando o MKdocs.

# Estrutura de Sites 

Um projeto pode ter mais de um tipo de documentacao podendo ser dividida em mais de um site Mkdocs. 
Os sites para documentacao do projeto serao divididos em pastas com a seguinte nomenclatura:

`project path`./site-{{target-audience}}/

Dentro de cada pasta de site existira a seguinte extrutura

```files
site-{{target_audience}}
  ./docs/
  index.md
  site.config.jason
  mkdocs.yml
```

## index

O arquivo index.md deve ser utilizado para criar a estrutura da documentacao no mkdocs. este arquivo possui 2 sessoes:

### Site map
Uma tabela para construcao da nevagacao do site

The site map table have four columns:

1. **Page**: the name of the page that needs to appear on the `nav` bar.
2. **Subpage**: a estrutura de subpastas dentro da pagina principal
3. **Subjects**: servem para indexar conteudos de referencia e contextualizacao 
4. **Purpose**: general description of what the subpage ultimate goal is.

### Subpages Drivers
Nesta sessao, cada subpage sera divida em bullet points que podem representar topicos a serem desenvolvidos ou referencias extras a serem consideradas que para o desenvolvimento do conteudo de cada pagina e subpagina.

```example
subpage A:
  - topico 1
  - topico 2 
```

# Content Development

1. Caso exista um arquivo chamado `index.md` dentro da pasta do site
  1.1. Iterar as linhas da tabela para identificar os dados de `subpage`
  1.2. Desenvolver o conteudo para cada subpage da seguinte forma:
    1.2.1. Aplicando o `goal`, o `role` e as `reference` do {{target-audience}} de acordo com o arquivo ./guideline-communication.json ao:
      1.2.1.1. O `purpose` de cada subpagina
      1.2.1.2. Para analisar os documentos em ../site-stakeholder/site.config.json que possuirem em seu yaml header o parametro `subject` definido na subpagina
      1.2.1.3. Verificar se existe subpage drivers para aplicar ao que foi contextualizado no passo anterior
      1.2.1.4. criar uma pasta dentro do folder ../site-{{target-audience}}/docs/ do site de acordo com o endereco definido na linha da pagina, na coluna subfolder (ex ./project) 
      1.2.1.5. criar um arquivo `.md` com o resultado da analise dentro da pasta criada
      1.2.1.6. atualizar o indice do site dentro do arquivo `mkdocs.yml` que esta dentro da pasta do site 
2. Caso NAO exista um arquivo chamado index.md
  2.1. Desenvolver o conteudo da seguinte forma:
    1.2.1. Aplicando o `goal`, o `role` e as `reference` do {{target-audience}} de acordo com o arquivo ./guideline-communication.json para:
      1.2.1.1. Definir a estrutura de paginas e subpaginas
      1.2.1.2. Alterar a navegacao no arquivo mkdocs.yml de acordo com a estrutura definida 
      1.2.1.3. Criar os arquivos .md dentro de uma unica pasta no folder ../site-stakeholder/docs/ chamada `content`

# Deployment
No arquivo chamado `site.config.json`  dentro da pasta `project path`./{{target-audience}}-site/ estao armazenadas as instrucoes para configuracao do site

- knowledge-base (datatype -> list): locais onde estarao armazenados os arquivos que serao usados como referencia ou contexto para o desenvolvimento das subpaginas e paginas.
- auth-user (datatype -> list): lista com endereco de emails de quem pode acessar o site
- github-page (datatype -> array): array com as variaveis de ambiente para fazer deploy do site.
  - branch (datype -> string): the name of the branch used to update the page
  - action (datapype -> string): relative path for the file with the github action to build the mkdocs page
