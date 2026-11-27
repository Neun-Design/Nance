@module-control @report @issue-473
Feature: Capacity Report-A — available vs allocated hours by function
  The Control module charts the weekly people capacity (Available) against
  the forecast demand (Allocated), grouped by function. Derivation contract:
  prototype/ASSESSMENT_FORECAST-JOBS-CONTROL.md (issue #246).

  Background:
    Given the engine is loaded with the clinic mockup dataset
    And the schema version is at least 115

  Scenario: The report matches its structural fixture
    When I run report "Capacity::Report-A"
    Then the report satisfies the invariants in fixture "reports/capacity-report-a.expected.json"

  Scenario: Categories resolve to function names
    When I run report "Capacity::Report-A"
    Then every report category is a label from the "Functions" table

  Scenario: Capacity is never degenerate on the demo dataset
    When I run report "Capacity::Report-A"
    Then every value of series "Available" is greater than 0
    And the total of series "Allocated" is greater than 0

  Scenario: The Exclude-Draft radio never increases allocated demand
    When I run report "Capacity::Report-A"
    And I remember the total of series "Allocated" as "baseline"
    When I run report "Capacity::Report-A" with radio "nodraft"
    Then the total of series "Allocated" is at most the remembered "baseline"
