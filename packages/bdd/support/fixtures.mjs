import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const FIXTURES = new URL('../fixtures/', import.meta.url);

export function readFixture(rel) {
  return JSON.parse(fs.readFileSync(fileURLToPath(new URL(rel, FIXTURES)), 'utf8'));
}
