#!/usr/bin/env node
// wip-audit — the BDD-first law watched by CI (issue #475): features and
// fixtures are authored BEFORE step-definitions, parked under @wip until the
// Gherkin is validated and implemented. Every @wip feature/scenario must
// reference its round via @issue-NNN so the validated-pending backlog never
// goes orphan. Prints the inventory (and the GitHub job summary when
// available); exits 1 on an orphan @wip.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FEATURES = fileURLToPath(new URL('../features/', import.meta.url));

function* featureFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* featureFiles(full);
    else if (entry.name.endsWith('.feature')) yield full;
  }
}

const parseTags = (line) => line.split(/\s+/).filter((t) => t.startsWith('@'));

function auditFile(file) {
  const rel = path.relative(FEATURES, file);
  const entries = [];
  let featureTags = [];
  let pending = [];
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (line.startsWith('@')) { pending.push(...parseTags(line)); continue; }
    if (line.startsWith('Feature:')) {
      featureTags = pending; pending = [];
      entries.push({ rel, name: line, tags: featureTags, isFeature: true });
    } else if (/^(Scenario|Scenario Outline):/.test(line)) {
      entries.push({ rel, name: line, tags: [...featureTags, ...pending] });
      pending = [];
    } else if (line && !line.startsWith('#')) {
      pending = [];
    }
  }
  return entries;
}

const wip = [];
for (const file of featureFiles(FEATURES)) {
  for (const e of auditFile(file)) {
    if (!e.tags.includes('@wip')) continue;
    if (e.isFeature) continue; // feature-level @wip is reported through its scenarios
    wip.push({ ...e, issues: e.tags.filter((t) => /^@issue-\d+$/.test(t)) });
  }
}

const orphans = wip.filter((e) => e.issues.length === 0);

const lines = wip.length === 0
  ? ['wip-audit: no @wip scenarios — nothing pending implementation.']
  : [
    `wip-audit: ${wip.length} @wip scenario(s) awaiting step-definitions:`,
    ...wip.map((e) => `  ${e.issues.length ? '·' : '✗'} ${e.rel} — ${e.name}`
      + (e.issues.length ? `  [${e.issues.join(' ')}]` : '  [NO @issue-NNN TAG]')),
  ];
console.log(lines.join('\n'));

if (process.env.GITHUB_STEP_SUMMARY) {
  const md = ['## BDD @wip inventory', '', ...(wip.length === 0
    ? ['No `@wip` scenarios — nothing pending implementation.']
    : ['| Feature file | Scenario | Issue |', '|---|---|---|',
      ...wip.map((e) => `| \`${e.rel}\` | ${e.name.replace(/^[^:]+:\s*/, '')} | ${e.issues.join(' ') || '**missing**'} |`)]),
  '', ''].join('\n');
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}

if (orphans.length) {
  console.error(`wip-audit: ${orphans.length} @wip scenario(s) without an @issue-NNN tag — `
    + 'every pending specification must reference its round.');
  process.exit(1);
}
