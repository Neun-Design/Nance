#!/usr/bin/env node
// test_engine_ps_option_hints.mjs — proof for the Product Scope picker
// legibility round (2026-09-08 UX, Rafael's call): options label the
// compact productScopeID and carry the full productScopeName as `hint` —
// custom multicheck/radio rows render it as a 100ms hover tooltip
// (data-hint + app.css transition-delay), native <select> options carry
// the browser title (their open list is OS-rendered, out of CSS reach)
// and the closed control mirrors the selected option's hint. The
// registry-code pickers (#296 Requirements, #299 Payload) keep their
// labels — they were already legible — and gain the same hint. Pure
// engine/CSS round: the datamodel is untouched (no sv bump, #306
// precedent).
// Run from prototype/:  node tools/test_engine_ps_option_hints.mjs

import fs from 'fs';
globalThis.fetch = async (p) => new Response(fs.readFileSync(p));

const model = await import('../js/model.js');
const data = await import('../js/data.js');
const { catalog } = await model.loadModel();
data.initMeta(catalog);
await data.loadData();
const resolve = await import('../js/resolve.js');
const forms = await import('../js/forms.js');

let fails = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails += 1; console.log(`  ✗ ${m}`); };
const eq = (got, want, m) => (JSON.stringify(got) === JSON.stringify(want)
  ? ok(m) : fail(`${m} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));

console.log('== psOption: ID label + full-name hint (all consumers inherit) ==');
{
  const pr = data.getEntity('Processes')[0];
  const opts = forms.productScopesForProcess(pr.processID);
  eq(opts.length > 0, true, `probe picker offers ${opts.length} scopes`);
  eq(opts.every((o) => String(o.label) === String(o.value)), true,
    'every option labels the compact productScopeID');
  eq(opts.every((o) => typeof o.hint === 'string' && o.hint.length > 0
    && o.hint !== o.label), true, 'every option carries the full-name hint');
  eq(opts.every((o) => o.hint !== '—'), true,
    'no hint is the dash placeholder (the sv102 hardening — dash is truthy)');
  const first = data.getById('Product Scopes', opts[0].value);
  eq(opts[0].hint, String(resolve.resolveDisplay('Product Scopes', first, 'productScopeName')),
    'the hint IS productScopeName — LIVE-derived since sv102');
  // sv102: the rule resolves productGroupName | specs summary | scopeName
  eq(/^.+ \| .+ \| .+$/.test(opts[0].hint), true,
    `three-part format ("${opts[0].hint.slice(0, 60)}…")`);
  const nAttr = catalog['Product Scopes'].byName['productScopeName'];
  eq(nAttr.type, 'mirror', 'productScopeName is a validator-safe mirror (derived, sv102)');
  eq(/CONCAT\(productGroupName,' \| ',specsSummary,' \| ',scopeName\)/.test(String(nAttr.rule)), true,
    'the rule uses the IMPLEMENTED sibling-hop CONCAT spelling (the X-from-FK trap is gone)');
  eq(data.getEntity('Product Scopes').every((ps2) => !('productScopeName' in ps2)), true,
    'stored demo copies dropped (stored wins over CONCAT, #214 — live rule everywhere)');
  // a bare UI-shaped row (only FKs) resolves the same live format
  const bare = { productScopeID: 'PS-UI', productGroupID: first.productGroupID, scopeID: first.scopeID };
  eq(String(resolve.derivedValue('Product Scopes', nAttr, bare)) === opts[0].hint, true,
    'a UI-created row (no stored name) resolves the SAME hint — the reported dash is fixed');
  // the other psOption consumers ride the same helper
  const ev = data.getEntity('Events')[0];
  eq(forms.productScopesForEvent(ev.eventID)
    .every((o) => String(o.label) === String(o.value) && o.hint), true,
  'productScopesForEvent: same shape');
  const t = data.getEntity('Tickets').find((tk) => forms.productScopesForTicket(tk.eventID, tk).length);
  eq(forms.productScopesForTicket(t.eventID, t)
    .every((o) => String(o.label) === String(o.value) && o.hint), true,
  'productScopesForTicket: same shape');
}

console.log('== registry-code pickers: labels kept, hint gained ==');
{
  const pl = data.getEntity('Payload').find((p) => p.eventID != null);
  const opts = forms.productScopesForPayload(pl.eventID, pl.businessUnitID);
  eq(opts.length > 0, true, `payload picker offers ${opts.length} scopes`);
  eq(opts.every((o) => /^PSR/.test(String(o.label))), true,
    'Payload picker keeps the #299 registry-code labels');
  eq(opts.every((o) => o.hint && o.hint !== o.label), true,
    'and gains the full-name hint');
  // the #296 Requirements picker rides the generic path (display:
  // productScopeRegistry) — untouched by this round
  const rAttr = catalog['Requirements'].byName['productScopeID'];
  eq(/productScopeRegistry/.test(String(rAttr.rule)), true,
    'Requirements picker display stays the registry code (#296)');
}

console.log('== control wiring: tooltip DOM + CSS + native-select fallback ==');
{
  const src = fs.readFileSync('js/forms.js', 'utf-8');
  eq(/row\.dataset\.hint = o\.hint/.test(src), true,
    'mkMultiCheck rows carry data-hint (the CSS tooltip anchor)');
  eq(/mkRow\(o\.value, o\.label, o\.hint \|\| null\)/.test(src), true,
    'mkRadioList rows thread the hint');
  eq(/if \(o\.hint\) el\.title = o\.hint/.test(src), true,
    'native select options carry the browser title (desktop best-effort)');
  eq(/sel\.title = sel\.selectedOptions\[0\]\?\.title/.test(src), true,
    'the closed select mirrors the selected option\'s hint');
  eq(/if \(o\.hint\) opt\.title = o\.hint/.test(src), true,
    'refillSelect keeps titles across the add-new rebuild');
  const css = fs.readFileSync('assets/app.css', 'utf-8');
  eq(/\.form-multicheck-row\[data-hint\]:hover::after/.test(css), true,
    'the hover tooltip rule exists');
  eq(/transition-delay: 0\.1s/.test(css), true, 'the 100ms reveal delay');
}

console.log('== datamodel untouched (engine/CSS-only round) ==');
{
  eq(model.getSchemaVersion() >= 101, true,
    `schemaVersion ${model.getSchemaVersion()} — no bump needed (#306 precedent)`);
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
