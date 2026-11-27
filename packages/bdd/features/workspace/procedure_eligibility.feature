@module-workspace @doctrine @sv71 @sv103 @issue-473
Feature: Procedure eligibility — certified onboarding and Approved-procedure gates
  Doctrine (sv71, hardened by sv101 #368 and sv103 #376): a person may only be
  staffed on work whose METHOD is exercisable — a certified onboarding is not
  enough while the competence's procedure group awaits approval. The doctrine
  bites at ticket/task dispatch, which is why it lives under workspace even
  though the raw records belong to Talent and Operation.

  Background:
    Given the engine is loaded with the clinic mockup dataset
    And the schema version is at least 115

  Scenario: A procedure without a status key counts as Approved (legacy tolerance)
    Given a procedure with no status key
    Then the procedure is considered approved

  Scenario Outline: Only the Approved status makes a procedure exercisable
    Given a procedure with status "<status>"
    Then the procedure is considered <verdict>

    Examples:
      | status      | verdict      |
      | Approved    | approved     |
      | In Progress | not approved |
      | To Do       | not approved |

  Scenario: A competence with no procedure link is inert
    Given a competence with no procedure links
    Then the competence is not exercisable

  @mutating
  Scenario: Unapproving a staffed procedure group drops eligibility until re-approval
    Given a task staffed through a certified competence chain
    When the whole procedure group of that competence flips to "In Progress"
    Then the competence becomes inert
    And the certified holder drops out of the task eligibility
    When the procedure group flips back to its original statuses
    Then the certified holder is eligible for the task again
