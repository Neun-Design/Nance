Version 1.0 Created in 19/07/2026 at 13:45

>[!note] For Claude Code
>You should check if any documentation used to support the development of the prototype
>(e.g. DATAMODEL_GUIDE.md) should be reviewed based on the updates cited in this document.

# UI Interface

- Use /Volumes/Projetos/EDQMS/sourceFiles/developer/standalone_wireframe.html every time #standalone_wireframe is mentioned
- the text inside the inputs on the Forms are black, making it hard to read in dark mode. Please review that
- The delete button should follow the same pattern as the Edit button when activated. Currently is 
- Reports:
  - I am having problems rendering the reports. They either became to small or to big, messing with the visualization. When I move the bronswer to another screen the reports render correctly.
- table-filters:
  - check the #standalone_wireframe and apply the same type of filter, based on the columns (inspired by Microsoft Lists filters)
  - table-filters should not influence the reports or card filters when activated or selected
- sidebar:
  - use the same style of the #standalone_wireframe, with the same icons, size, etc.
- table items checkbox: 
  - use the same style of the #standalone_wireframe.
- Forms:
  - the #standalone_wireframe drawer has a functionality to create a new item for every rollup input (select). I would like you to implement that in the prototype as well.
- Font size and styles: please follow the #standalone_wireframe for font sizes and style (example, drawer title font size)

# Modules

## Customers

### Factories

#### Datamodel Updates

- added `subitem-tables` to display `forecasts` with status Approved only
- updated subitem-display for various attributes.

### Forecasts

#### Datamodel Updates

- subitem-tables:
  - COMSUPTION must be hidden
- weeklyUsageQuota:
  - changed the formula in #datamodel rule to "computed: divide 'totalEstimatedHours' by the number of weeks in 'periodFrame'"

#### Datamodel nonconformity

- Table:
  - Column `Factory` should display `factoryName + city` but display `factoryID`
    - see #datamodel attribute.rule on line 194

- subitem-tables:
  - FORECAST column should be renamed to FORECAST SCOPE and must display the `forecastScopeID` conforming the #datamodel subitem-display parameter for this attribute.
  - PRODUCT GROUP column should display `productGroupName`, as mentioned in #datamodel, not `productGroupID`
  - PRODUCT SCOPE column should not be display based on the attribute productScopeID in the Forecast Scopes table in the #datamodel (Tables.Forecast_Scopes.attributes.productSocpeID.subitem-display(false))
  - CONSTRAIN NAME have a bug, its showing `0` for all records instead of `constraintName` as defined in #datamodel
  - PROCESS should display `processName` instead of `processID` according to #datamodel (Tables.Forecast_Scopes.attributes.processID.subitem-display(false))

### Forecast Scopes

#### UI nonconformity

- Table:
  - CONSTRAINT NAME: not showing `constraintName`, just zeros

#### Datamodel Updates

- updated subitem-display for various attributes.
- added attributes:
  - factoryName
  - periodFrame

#### Forms nonconformity
- Product Group field should display `productGroupName` as options, like defined in its #datamodel attribute `rule` parameter ("rollup → Product Scopes (via: scopeID); display: productGroupName")
- Constraints input: not showing `constraintName` options.

#### Reports nonconformity

- There is something wrong with the reports for this dashboard. They dont render the bars/lines.

## Operation

### Tasks

#### Datamodel Update

- subitem-tables:
  - updated to display the handouts instead of product scopes
  - the handouts should be grouped in two diferent subitems list, See bellow:
    - 012 | Offer Calculation Request | ...
      - Handouts - Inputs
        - INPUT NAME | CHANNEL | Template URL
          - Requirement Spec | Portal | https://portal.example/templates/HO01
          - Electrical Datasheet | Portal | https://portal.example/templates/HO02
          - Offer Document | Salesforce | https://portal.example/templates/HO03
      - Handouts - Outputs
        - OUTPUT NAME | CHANNEL | Template URL
          -  Review Report| Outlook | https://portal.example/templates/HO06

#### Datamodel nonconformity

  - Produc Scopes:
    - CONSTRAINT NAME not displaying `constraintName`, just 0
  - Competence:
    - see competence datamodel updates for subitem-display changes

#### Form nonconformity

- Process field should display processName in the options fields.Process.processID.rule("display: processName")
- Activity field should display activityName in the options fields.Activity.workflowID.rule("display: processName")
- contraints input not showing any option at all
- In general, all inputs must show the Name of the attribute, not the ID


### Activities

- Table:
  - ACTIVITY columns should display `activityName` and is displaying only 0.

#### Datamodel Update

- modules.Operation.tables.Activities.attribute.inputs.subitem-display(false)
- modules.Operation.tables.Activities.attribute.outputs.subitem-display(false)
- modules.Operation.tables.Activities.attribute.scopes.subitem-display(false)
- modules.Operation.tables.Activities.attribute.customer.subitem-display(false)
- modules.Operation.tables.Activities.attribute.constraints.subitem-display(false)
- modules.Operation.tables.Activities.attribute.inputs.table-display(false)
- modules.Operation.tables.Activities.attribute.outputs.table-display(false)
- modules.Operation.tables.Activities.attribute.scopes.table-display(false)
- modules.Operation.tables.Activities.attribute.customer.table-display(false)
- modules.Operation.tables.Activities.attribute.constraints.table-display(false)

#### Form nonconformity

- Activity inputs does not show options. Should show `activityName` options


### Actions

#### Datamodel Update

- modules.Operation.tables.Actions.attribute.workflowID.table-display(false)


### Constraints

#### Datamodel nonconformity

- subitem-tables:
  - it should display a list of subitems for each constraint record containing the related Product Scope
    - modules.Operation.tables.Constraints.subitem-tables.(["Product Scopes"])


## Inventory

### Product Scopes

#### Datamodel Update

- modules.Inventory.tables.Product_Scopes.attribute.scopeID.notes("multivalued")
- modules.Inventory.tables.Product_Scopes.subitem-tables(["Scopes (via: scopeID)"])
- subitem-tables:
  - list the scopes for each product Scope item

#### Datamodel nonconformity

- table:
  - CONSTRAINT NAME: should display `constraintName`, but display 0

#### Forms nonconformity

- Constraints input: should show a option list to select multiple `constraintName`, but is showing none

### Product Class

#### Datamodel Update
- Eliminated `productClassOwner`

### Product Groups

#### Datamodel nonconformity
- Table:
  - PRODUCT column: should display `productName`, but displays `productID`
    - modules.Inventory.tables.Product_Groups.attribute.productID.rules("FK -> Product (display: productName)")
  - PRODUCT CLASS column: does not display any value, should display `productClassName`
    - modules.Inventory.tables.Product_Groups.attribute.productClassID.rules("FK -> Product Class (display: productClassName)")

#### Forms nonconformity
- Product input: should show a list of options with `productName`, but displays a list with `productID`
- Product Class input: does not display the list of options with `productClassName`, and should allow multiple selection
    - modules.Inventory.tables.Product_Groups.attribute.productClassID.notes("multivalued")

## Talent

### Squad

#### Mockup Update
- add a new squad called "NEUN Design", Type = OUtsource, Manager Name = Rafael Bova, Manager Email = bova@neun-design.com.br
  - insert users to this squad
- add a new squad called "INDIA Hub", Type = internal, Manager Name = Hajesh Niran , Manager Email = hajesh.niran@northwind-energy.com
  - insert users to this squad

#### Datamodel nonconformity
- tables:
  - subitem-tables:
    - ROLE column: does not display any value, should display `roleName`

### Roles

#### Datamodel Update
- subitem-tables: updated to display `Competences`
    - modules.Talent.tables.Roles.subitem-tables(["Competence"])

### Skill Levels

#### Datamodel Update

- added attribute:
  - modules.Talent.tables.Sill_Levels.attribute.skillLevelTitle


### Graduation

#### Datamodel Update
- modules.Talent.tables.Graduation.attribute.graduationTitle.subitem-display(false)
- modules.Talent.tables.Graduation.attribute.field.subitem-display(false)
- modules.Talent.tables.Graduation.attribute.institutionName.subitem-display(false)
- modules.Talent.tables.Graduation.attribute.graduationName.subitem-display(true)


### People


#### Datamodel nonconformity
- Table:
  - ROLE column: does not display the `roleName`. Should display a list of all roles connected to the `userID` via `onboardID`
  - subitem-tables:
    - should display the following columns according to #datamodel:
      - 

#### Datamodel Update
- roleID: updated rule
- subitem-tables:
  - USER column: hide
    - modules.Talent.tables.People.attribute.userID.subitem-display(false)
  - FUNCTION column: hide
    - modules.Talent.tables.People.attribute.functionID.subitem-display(false)
  - ROLE column: hide
    - modules.Talent.tables.People.attribute.roleID.subitem-display(false)
  - COMPETENCE column: show (display: competenceName)
    - modules.Talent.tables.People.attribute.competenceID.subitem-display(false)
- added attribute `graduationID`

#### Form Update
- added new form input `Graduation` 
- Eliminated Role input field


### Onboarding

#### Datamodel Update
- Table:
  - FUNCTION column: should display `functionName`, not `functionID`
    - modules.Talent.tables.Onboarding.attribute.functionID.rule("computed: People via userID **(display: functionID)** ")
- updated roleID atribute: display the list of roleName for the competence selected
  - modules.Talent.tables.Onboarding.attribute.roleID.rule("mirror: Competence (via: competenceID) (display: roleName)")
- updated competenceID atribute: must ne filtered by functionID from Competence table
  - modules.Talent.tables.Onboarding.attribute.competenceID.rule("rollup → Competence (via: functionID) (display: competenceName)")
- added `productClassName` attribute


#### Form Update
- eliminated Function input field
- eliminated Role input field

### Competence

#### Datamodel Update
- roleID.subitem-display(false)
- competenceName.subitem-display(false)
- resources.subitem-display(false)
- table-filters: updated to `true`
- competenceName.table-display(false)
- competenceName.subitem-display(true)
- constrainIDt.table-display(true)

#### Form nonconformity
- Role input: it should display the `roleName`, but shows `roleID`
- Task input: does not show any option to select, it must display `taskName`
- Constraint: must display a list with `constraintName`

#### Datamodel nonconformity
- Table:
  - ROLE column: should display `roleName`, but shows `roleID`
  - ACTION column: should display `actionName`, but shows `actionID` 
  - ACTIVITY column: should display `activityName`, but shows `activityID`
  - CONSTRAINTS: must display a list of `constraintName`
