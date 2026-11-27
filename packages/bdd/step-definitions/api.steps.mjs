import { Given, Then, When } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { readFixture } from '../support/fixtures.mjs';

async function post(world, path, body) {
  const res = await fetch(world.apiBaseUrl + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': world.clientIp },
    body: JSON.stringify(body),
  });
  world.lastResponse = res;
  world.lastBody = await res.json().catch(() => null);
  return res;
}

Given('the chat API is reachable', async function () {
  // a fresh identity per scenario isolates the per-IP rate limiter
  this.clientIp = `10.77.${randomInt(256)}.${randomInt(256)}`;
  let res;
  try {
    res = await fetch(`${this.apiBaseUrl}/healthz`);
  } catch (err) {
    throw new Error(`chat API not reachable at ${this.apiBaseUrl} — boot it first `
      + `(see packages/bdd/README.md): ${err.message}`);
  }
  assert.equal(res.status, 200, `healthz returned ${res.status}`);
});

When('I GET {string}', async function (path) {
  this.lastResponse = await fetch(this.apiBaseUrl + path, {
    headers: { 'x-forwarded-for': this.clientIp },
  });
  this.lastBody = await this.lastResponse.json().catch(() => null);
});

When('I POST the fixture {string} to {string}', async function (rel, path) {
  await post(this, path, readFixture(rel));
});

// Empty-messages bodies fail validation (400) and never reach the Anthropic
// client; the limiter runs BEFORE validation, so it engages all the same.
When('I exhaust the rate limit with invalid requests', async function () {
  const cap = 60; // CI boots with EDQMS_RATE_LIMIT_REQUESTS=5; the default is 20
  for (let i = 0; i < cap; i += 1) {
    const res = await post(this, '/api/chat', { messages: [] });
    if (res.status === 429) return;
  }
  throw new Error(`rate limiter never engaged within ${cap} requests`);
});

Then('the next request is rejected with status {int}', async function (code) {
  const res = await post(this, '/api/chat', { messages: [] });
  assert.equal(res.status, code, `body: ${JSON.stringify(this.lastBody)}`);
});

Then('the response status is {int}', function (code) {
  assert.equal(this.lastResponse.status, code, `body: ${JSON.stringify(this.lastBody)}`);
});

Then('the response JSON field {string} is {string}', function (field, want) {
  assert.ok(this.lastBody, 'response had no JSON body');
  assert.equal(String(this.lastBody[field]), want);
});
