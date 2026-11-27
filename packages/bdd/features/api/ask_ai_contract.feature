@module-api @api @issue-473
Feature: Ask AI chat API contract — non-LLM paths
  Contract of site-stakeholder/api/server.py as deployed on Render. Only the
  paths that never reach the Anthropic client are exercised: the rate limiter
  runs before validation, and every fixture here fails validation — so the
  suite is safe to run with a dummy ANTHROPIC_API_KEY. Each scenario uses a
  distinct X-Forwarded-For identity, isolating the per-IP rate limiter.

  Background:
    Given the chat API is reachable

  Scenario: Health check
    When I GET "/healthz"
    Then the response status is 200
    And the response JSON field "status" is "ok"

  Scenario: An empty conversation is rejected
    When I POST the fixture "api/chat-empty.json" to "/api/chat"
    Then the response status is 400

  Scenario: A conversation with too many messages is rejected
    When I POST the fixture "api/chat-too-many-messages.json" to "/api/chat"
    Then the response status is 413

  Scenario: An oversized conversation is rejected
    When I POST the fixture "api/chat-oversize.json" to "/api/chat"
    Then the response status is 413

  Scenario: Requests beyond the rate limit are rejected
    When I exhaust the rate limit with invalid requests
    Then the next request is rejected with status 429
