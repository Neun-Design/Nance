@module-control @doctrine @issue-473
Feature: Control derivation contracts — Capacity and Performance
  Control tables are DERIVED, never hand-seeded (prototype/tools/derive_control.py;
  the mockup validator recomputes on every build). Grain and equations from
  issue #246: Capacity = function x year x month, Performance = function x
  customer x year x month over completed work.

  Background:
    Given the engine is loaded with the clinic mockup dataset
    And the schema version is at least 115

  Scenario: Capacity rows carry the derivation grain
    Then every "Capacity" row has values for "functionID", "periodYear" and "periodMonth"
    And no two "Capacity" rows share the same "functionID", "periodYear" and "periodMonth"

  Scenario: Capacity utilization is the allocated share of available hours
    Then every "Capacity" row derives utilization as allocated hours over available hours

  Scenario: Performance rows carry the derivation grain
    Then every "Performance" row has values for "functionID", "customerID", "periodYear" and "periodMonth"

  Scenario: Performance efficiency is derived from planned over real hours
    Then every "Performance" row derives efficiency from planned hours over real execution time
