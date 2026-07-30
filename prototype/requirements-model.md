Na versao atual os requirements sao aplicados para 
- Customer
- Scope
- Product Group


Desta forma, sempre que um novo ticket for criado, eh possivel mapear todos os requirements pois no ticket temos como input: customer, product scope (scope + product group)

No entanto, eu preciso que os requirements tambem sejam aplicados para `Regions`, pois pode acontecer de uma regiao especifica possuir requisitos unicos para execucao dos eventos.

Dessa forma, preciso que o modelo de dados seja alterado para

- Criar uma nova entidade para `Regions` com os seguintes atributos:
  - regionID: auto
  - regionName: VARCHAR
  - regionDescription: TEXT
  - regionOwner: rollup.userID


- Incluir o input `Region` (multivalued) no formulario de `Requests`
- Incluir o input de `Business Unit` (multivalued) no formulario de `Requests`, filtrado pelo input em `Region`
- Alterar o input de `Customer` (multivalued) no formulario de `Requests` para ser filtrado pelo input em `Business Unit`
- Alterar o input de `Scope` (multivalued) no formulario de `Requests` para ser filtrado pelo input em `Business Unit`
- Alterar o input de `Product Group` (multivalued) no formulario de `Requests` para ser filtrado pelo input em `Business Unit`


Alem disso, verificar as mudancas em datamodel para as demais alteracoes no prototipo.

---

## Resolucao (2026-07-30) — implementado

- **`Regions`** criada no modulo Organization (`regionID`, `regionName`, `regionDescription`, `regionOwner`) com subitem-table de Customers. *Nota:* o pedido dizia `regionOwner: rollup.userID`; foi mantido o padrao de owner do modelo (`FK → People`, ISO §5.3). Seed: `tools/migrate_regions.py` cria uma regiao por valor do antigo enum `Customers.region` (EMEA/Americas/APAC) e converte `Customers.region` → `regionID`.
- **Formulario de Requirements** (o "Requests" citado acima): cadeia `Region (multi)` → `Business Unit (multi, filtrada pela Region via clientes da regiao)` → `Customer / Scope / Product Group (filtrados pela Business Unit)`. Region e Business Unit vazios = requirement aplica-se a todas (semantica de curinga Q1).
- **Applicability nas cadeias operacionais**: os rollups de requirements ganharam as chaves de regiao e unidade —
  - `Workflows.requirements`: `via: customerID + customerID.regionID + customerID.businessUnitID + productScopeID.productGroupID + productScopeID.scopeID`
  - `Forecast Scopes.requirementID`: idem via `forecastID.customerID…`
  - `Product Scopes.requirementID`: `+ businessUnitID`
  Assim, ao abrir um ticket, os requirements mapeados ja consideram a regiao do customer.
- **Motor**: `findDep` do form engine tambem casa regras que citam o *atributo* ("filtered by businessUnitID selected"); dependencias multivalued unem os filhos de todos os valores selecionados (Region multi → uniao das units). Testes: `tools/test_engine_regions.mjs`.



