// Boots the prototype engine headless, porting the proof-suite pattern
// (prototype/tools/test_queries.mjs): fetch is mocked to read local files.
// Two deviations from the proofs, both required because cucumber runs from
// packages/bdd instead of prototype/:
//   1. relative fetch paths are resolved against prototype/ by URL, never CWD;
//   2. http(s) URLs delegate to the real fetch — the @api scenarios share the
//      same global.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const PROTO = new URL('../../../prototype/', import.meta.url);

const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (resource, init) => {
  const target = String(resource);
  if (/^https?:\/\//.test(target)) return realFetch(resource, init);
  return new Response(fs.readFileSync(fileURLToPath(new URL(target, PROTO))));
};

let handle = null;

export async function loadEngine() {
  if (handle) return handle;
  const model = await import(new URL('js/model.js', PROTO).href);
  const data = await import(new URL('js/data.js', PROTO).href);
  const { catalog } = await model.loadModel();
  data.initMeta(catalog);
  await data.loadData();
  const resolve = await import(new URL('js/resolve.js', PROTO).href);
  const queries = await import(new URL('js/queries.js', PROTO).href);
  handle = { model, data, resolve, queries, catalog };
  return handle;
}
