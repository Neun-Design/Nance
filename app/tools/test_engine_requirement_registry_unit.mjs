#!/usr/bin/env node
// test_engine_requirement_registry_unit.mjs — the Registry-unit split
// (Rafael, sv107): the #359 mandate mixed the pre-RBAC FILTER role into
// the unit APPLICABILITY dimension, making every requirement
// unit-constrained. The split: `registryUnitID` (NOT NULL, wizard Registry
// step) only narrows the Applicability options and is NEVER read by the
// inheritance chains; `businessUnitID` returns to NULLABLE — the optional
// unit-applicability dimension (declared constrains, undeclared does not).
// Regions are offered from the Registry unit's SERVED regions (the direct
// Business Units.regionID read — the generic join-engine membership
// resolves through the customer-branch chain and over-offers); the
// applicability "Business Units" multicheck offers exactly the Registry
// unit (bespoke — the #309 own-domain-dep trap).
// Run from prototype/:  node tools/test_engine_requirement_registry_unit.mjs

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
const asList = (v) => (Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]));

const dm = JSON.parse(fs.readFileSync('data/datamodel.json', 'utf-8'));

console.log('== schema: sv107, the two unit roles split ==');
{
  eq(dm._meta.schemaVersion >= 107, true, `schemaVersion ${dm._meta.schemaVersion} >= 107`);
  const by = catalog['Requirements'].byName;
  eq(/NOT NULL/.test(String(by.registryUnitID.constraints)), true,
    'registryUnitID: the pre-RBAC filter, NOT NULL');
  eq(/#334|pre-RBAC/.test(String(by.registryUnitID.notes)), true,
    'registryUnitID notes record the filter doctrine');
  eq(/NOT NULL/.test(String(by.businessUnitID.constraints || '')), false,
    'businessUnitID: NULLABLE again (the #359 mandate moved to the filter key)');
  eq(forms.requiredAttrs('Requirements').has('registryUnitID'), true, 'registry unit form-required');
  eq(forms.requiredAttrs('Requirements').has('businessUnitID'), false,
    'applicability unit NOT form-required');
}

console.log('== form spec: Registry filter + Applicability deps re-pointed ==');
{
  const f = catalog['Requirements'].form.fields;
  eq(f['Business Unit'] && f['Business Unit'].attribute, 'registryUnitID',
    'Registry step carries the Business Unit filter (registryUnitID)');
  eq(f['Business Unit'].step, 'Registry', 'on the Registry step');
  eq(f['Business Units'] && f['Business Units'].attribute, 'businessUnitID',
    'the Applicability multicheck binds businessUnitID ("Business Units")');
  const CASCADE = /filtered by (?:the )?([A-Za-z .+&,]+?)(?: selected| field|$)/i;
  for (const label of ['Region', 'Business Units', 'Branch', 'Customer', 'Scope', 'Product Group', 'Product Scope']) {
    const rule = String(f[label]['field-rule'] || '');
    eq(CASCADE.test(rule) && /registryUnitID/.test(rule), true,
      `${label}: cascade wired to registryUnitID (#274 spelling)`);
    eq(f[label].step, 'Applicability', `${label} on the Applicability step`);
  }
}

console.log('== wiring: bespoke region/unit options (source asserts) ==');
{
  const src = fs.readFileSync('js/forms.js', 'utf-8');
  eq(/entity === 'Requirements' && attrName === 'regionID'/.test(src), true,
    'Region options: bespoke branch (served regions — the direct unit.regionID read)');
  eq(/entity === 'Requirements' && attrName === 'businessUnitID'/.test(src), true,
    'Business Units options: bespoke branch (offers exactly the Registry unit — #309 trap)');
}

console.log('== the filter NEVER constrains inheritance ==');
{
  // Rafael's goal: a requirement registered UNDER unit BU01 (registry) with
  // NO unit applicability inherits into ANOTHER unit's tickets when its
  // declared dimensions trace there
  const t = data.getEntity('Tickets').find((tk) => String(asList(tk.businessUnitID)[0]) !== 'BU01'
    && resolve.ticketAdmittedScopeIds(tk).length);
  const ps = data.getById('Product Scopes', resolve.ticketAdmittedScopeIds(t)[0]);
  data.addRecord('Requirements', { requirementID: 'RQ-REG', requirementName: 'Registry probe (t)',
    isActive: 'Active', registryUnitID: 'BU01', businessUnitID: [],
    regionID: [], branchID: [], customerID: [], productGroupID: [], productScopeID: [],
    scopeID: [asList(ps.scopeID)[0]] });
  eq(resolve.ticketRequirements(t).map(String).includes('RQ-REG'), true,
    `registered under BU01, scope-pinned, NO unit applicability → inherits into a ${asList(t.businessUnitID)[0]} ticket (cross-unit)`);
  // declaring the unit applicability constrains again
  data.getById('Requirements', 'RQ-REG').businessUnitID = ['BU01'];
  eq(resolve.ticketRequirements(t).map(String).includes('RQ-REG'), false,
    'declaring businessUnitID [BU01] keeps it out of other units\' tickets');
  data.removeRecords('Requirements', ['RQ-REG']);
}

console.log('== Constraints picker: blank applicability unit = every unit (sv106 posture) ==');
{
  data.addRecord('Requirements', { requirementID: 'RQ-REG2', requirementName: 'Constraint probe (t)',
    isActive: 'Active', ticketSelectable: true, registryUnitID: 'BU01', businessUnitID: [] });
  eq(forms.constraintsForTicketUnit('BU02').some((o) => String(o.value) === 'RQ-REG2'), true,
    'blank-unit selectable requirement offered as Constraint for ANY unit');
  data.getById('Requirements', 'RQ-REG2').businessUnitID = ['BU01'];
  eq(forms.constraintsForTicketUnit('BU02').some((o) => String(o.value) === 'RQ-REG2'), false,
    'declared unit still filters the Constraints picker');
  data.removeRecords('Requirements', ['RQ-REG2']);
}

console.log('== seeds: every row carries the filter key ==');
{
  const rows = data.getEntity('Requirements');
  eq(rows.filter((r) => r.registryUnitID == null || r.registryUnitID === '').length, 0,
    `all ${rows.length} rows seed registryUnitID (NOT NULL satisfied)`);
  eq(rows.every((r) => String(r.registryUnitID) === String(asList(r.businessUnitID)[0] ?? r.registryUnitID)), true,
    'seed rule: the first unit of the applicability key (migration ≡ builder)');
}

console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
