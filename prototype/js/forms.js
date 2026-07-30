// forms.js — "New Item" drawer with a stacked-form spine, mirroring the wireframe.
// A form exposes a "New <child>" button for each rollup relationship; clicking it pushes a
// nested form onto the stack (its own left-edge spine tab) and links the child to the parent
// (childKey = parent's generated PK). Saving a child pops back; saving the root closes.
// Records are added in-memory (non-persistent, resets on reload).

import { getEntity, getById, getBaseFields, addRecord, updateRecord, FK_MAP, ENTITY_META, lookup } from './data.js';
import { enrichAll } from './compute.js';
import { getCatalog, resolveTable, columnsFor, childKeyFor, parseRule } from './model.js';
import { resolveDisplay, computedConcat, childrenOf } from './resolve.js';

// Fields that reference another entity but aren't named like its PK.
const REF_OVERRIDE = {
  processOwner: 'People', projectOwner: 'People', ticketOwner: 'People', riskOwner: 'People',
  sourceOwner: 'People', createdBy: 'People', changedBy: 'People', reportedBy: 'People',
  customerName: 'Customers', location: 'Customers', activities: 'Activities',
  products: 'Products', taskInput: 'Handouts', taskOutput: 'Handouts',
  parentStepID: 'Workflows', parentProcessID: 'Processes', predecesorJob: 'Jobs',
  escalatedToEventID: 'Events',
};
const ENUM_FIELDS = new Set([
  'status', 'ticketStatus', 'projectStatus', 'jobStatus', 'processStatus', 'channelStatus',
  'riskStatus', 'forecastPeriod', 'periodType', 'requirementType', 'riskCategory',
  'businessSegment', 'region', 'squadType', 'type', 'dependencyType',
  'previousStatus', 'newStatus',
]);

const isDateField = (f) => /(date|at)$/i.test(f);
const humanize = (f) => f.replace(/IDs$/, 's').replace(/ID$/, '')
  .replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
const singularTitle = (tab) => tab.replace(/ies$/, 'y').replace(/s$/, '');

// tab config for an entity (to reuse its columns/mirror + rollups in nested forms)
// Interim engine bridge: rollups come from the datamodel's subitem-tables;
// the full form spec (steps/fields/check/field-rule) lands in P6-E.
const cfgForEntity = (entity) => {
  const cat = getCatalog(entity);
  return cat ? { tab: entity, entity, columns: [] } : null;
};
const rollupsForEntity = (entity) => {
  const cat = getCatalog(entity);
  if (!cat) return [];
  const seen = new Set(); // grouped subitem views (inputs/outputs) share one create button
  return cat.subitems.map(si => {
    const child = resolveTable(si.table);
    const key = child && childKeyFor(child, entity);
    if (!child || !key) return null; // via-through chains can't be linked from a form
    if (seen.has(child)) return null;
    seen.add(child);
    return { label: child, childEntity: child, childKey: key, columns: columnsFor(child, 'sub') };
  }).filter(Boolean);
};

function sampleOf(entity, field) {
  for (const r of getEntity(entity)) if (r[field] != null && r[field] !== '') return r[field];
  return null;
}
function distinct(entity, field) {
  return [...new Set(getEntity(entity).map(r => r[field]).filter(v => v != null && v !== ''))]
    .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
}
function classify(entity, field) {
  const pk = ENTITY_META[entity]?.pk;
  const sample = sampleOf(entity, field);
  const singular = field.endsWith('IDs') ? field.slice(0, -1) : null;
  if (Array.isArray(sample) || singular) {
    const ref = singular && FK_MAP[singular];
    return ref ? { type: 'multiselect', ref } : { type: 'tags' };
  }
  if (typeof sample === 'boolean') return { type: 'bool' };
  if (ENUM_FIELDS.has(field)) return { type: 'enum', options: distinct(entity, field) };
  if (REF_OVERRIDE[field]) return { type: 'fk', ref: REF_OVERRIDE[field] };
  // datamodel rule / label-field / pk-name reference (names, never ids)
  if (field !== pk) {
    const { options, target, multi } = optionsForAttr(entity, field);
    if (target) return { type: multi ? 'multiselect' : 'fk', ref: target, options };
  }
  if (isDateField(field)) return { type: 'date' };
  if (typeof sample === 'number') return { type: 'number' };
  return { type: 'text' };
}
function fkOptions(ref, display = null) {
  const meta = ENTITY_META[ref];
  return getEntity(ref).map(r => {
    const lbl = resolveDisplay(ref, r, display && display !== meta.pk ? display : meta.label);
    return { value: r[meta.pk], label: `${lbl !== '' ? lbl : r[meta.pk]}` };
  });
}

// table whose configured label field is `field` (e.g. requirementName → Requirements)
let _labelOwners = null;
function labelOwner(field) {
  if (!_labelOwners) {
    _labelOwners = {};
    for (const [t, m] of Object.entries(ENTITY_META)) {
      if (m.label && !(m.label in _labelOwners)) _labelOwners[m.label] = t;
    }
  }
  return _labelOwners[field] || null;
}

// Options for a select bound to `attrName`, derived from the datamodel rule
// (guide §3.3 / §6.2). Selects always list display NAMES; the option value is
// the id the parent rows actually store — or the name itself for label-named
// attributes stored as names (e.g. requirementName).
export function optionsForAttr(entity, attrName, ruleText = '') {
  const cat = getCatalog(entity);
  const a = cat && cat.byName[attrName];
  const r = (a && parseRule(a.rule)) || null;
  // notes saying "not multivalued" / "single valued" mean single-select
  const notes = (a && a.notes) || '';
  const multi = /multivalued/i.test(notes) && !/not multivalued/i.test(notes);
  const none = { options: null, target: null, multi };
  if (!attrName) return none;

  const em = ruleText && String(ruleText).match(/enum:\s*(.+)$/);
  if (em) return { options: em[1].split(',').map(s => ({ value: s.trim(), label: s.trim() })), target: null, multi };
  if (r && r.kind === 'enum') return { options: r.values.map(v => ({ value: v, label: v })), target: null, multi };

  const owner = labelOwner(attrName);
  let target = (r && r.target && resolveTable(r.target))
    || (FK_MAP[attrName] && FK_MAP[attrName] !== entity ? FK_MAP[attrName] : null)
    || (owner && owner !== entity ? owner : null);
  if (!target) return none;

  let tCat = getCatalog(target);
  const storedOnTarget = attrName !== tCat.pk && getEntity(target).some(rec => attrName in rec);
  // rule target can't answer for this attribute — fall back to the table that owns the label
  if (!storedOnTarget && attrName !== tCat.pk && owner && owner !== target && owner !== entity
      && !(r && r.display)) {
    target = owner;
    tCat = getCatalog(target);
  }

  const display = r && r.display && r.display !== tCat.pk ? r.display : null;
  // "FK → T (via: field)" stores that target field's value instead of the pk
  const viaField = r && r.kind === 'fk' && r.via && r.via !== tCat.pk
    && getEntity(target).some(rec => r.via in rec) ? r.via : null;
  const valueField = viaField
    || (attrName !== tCat.pk && getEntity(target).some(rec => attrName in rec) ? attrName : tCat.pk);
  // parent rows storing names rather than ids keep storing names
  const sample0 = sampleOf(entity, attrName);
  const sampleVal = Array.isArray(sample0) ? sample0[0] : sample0;
  const asLabel = valueField === tCat.pk && attrName === tCat.label
    && (sampleVal == null || !getById(target, sampleVal));

  const seen = new Map();
  for (const rec of getEntity(target)) {
    // "FK: Issues (filtered by issueType='Opportunity')" — only matching
    // target records become options
    if (r && r.filter && String(rec[r.filter.field] ?? '').toLowerCase()
        !== r.filter.value.toLowerCase()) continue;
    const v0 = rec[valueField];
    if (v0 == null || v0 === '') continue;
    // CONCAT displays (e.g. "productName | specsSummary") resolve cross-table
    let lblRaw = r && r.concat
      ? computedConcat(target, r.concat, rec, 0).replace(/\s+/g, ' ').trim()
      : resolveDisplay(target, rec, display || tCat.label);
    // display field unresolvable for this record — degrade to the target's
    // own label rather than a raw id
    if (lblRaw === '' && display) lblRaw = resolveDisplay(target, rec, tCat.label);
    const label = String(lblRaw !== '' ? lblRaw : v0);
    const value = asLabel ? label : v0;
    if (!seen.has(String(value))) seen.set(String(value), { value, label });
  }
  const options = [...seen.values()]
    .sort((x, y) => x.label.localeCompare(y.label, undefined, { numeric: true }));
  return { options, target, multi };
}
function genId(entity) {
  const pk = ENTITY_META[entity].pk;
  const ids = getEntity(entity).map(r => String(r[pk]));
  let prefix = '', width = 0, max = 0, ok = ids.length > 0;
  for (const id of ids) {
    const m = id.match(/^([A-Za-z]*)(\d+)$/);
    if (!m) { ok = false; break; }
    if (prefix === '' && max === 0) prefix = m[1];
    if (m[1] !== prefix) { ok = false; break; }
    width = Math.max(width, m[2].length); max = Math.max(max, Number(m[2]));
  }
  return ok ? prefix + String(max + 1).padStart(width, '0') : `${entity.slice(0, 3).toUpperCase()}-${ids.length + 1}`;
}

// Custom stepped forms can't be prefilled generically; Edit is limited to generic forms.
export const supportsEdit = (entity) => !CUSTOM_FORMS[entity];

// ================= Drawer stack =================
// editRecord (optional): open the root form prefilled and save via update instead of insert.
export function openForm(rootCfg, onSaved, editRecord = null) {
  const stack = [];       // array of form contexts
  let activeIdx = 0;

  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  const shell = document.createElement('div');
  shell.className = 'drawer-stack';
  overlay.appendChild(shell);

  const spineCol = document.createElement('div'); spineCol.className = 'spine';
  const panel = document.createElement('div'); panel.className = 'drawer';
  shell.append(spineCol, panel);

  const head = document.createElement('div'); head.className = 'drawer-head';
  const bodyHost = document.createElement('div'); bodyHost.className = 'drawer-body';
  const foot = document.createElement('div'); foot.className = 'drawer-foot';
  panel.append(head, bodyHost, foot);

  const closeAll = () => { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 180); };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAll(); });

  function pushForm(cfg, entity, link, record, opts = {}) {
    const ctx = buildFormCtx(cfg, entity, link, record);
    ctx.onSavedCb = opts.onSaved || null;
    stack.push(ctx);
    activeIdx = stack.length - 1;
    render();
  }

  // "+ create new item" on a rollup select (wireframe drawer parity):
  // pushes a nested form for the select's target table; on save the select
  // refreshes its options and picks the new record.
  const addNewFor = (target, onSaved) =>
    pushForm(cfgForEntity(target), target, null, null, { onSaved });

  // Build a form context (its body DOM is kept alive so inputs persist across spine switches).
  function buildFormCtx(cfg, entity, link, record = null) {
    const pk = ENTITY_META[entity].pk;
    const newId = record ? record[pk] : genId(entity);
    const verb = record ? 'Edit ' : 'New ';
    const ctx = { cfg, entity, pk, newId, link, editing: !!record, controls: {}, badges: [], title: verb + singularTitle(cfg ? cfg.tab : entity), spine: singularTitle(cfg ? cfg.tab : entity) };

    const body = document.createElement('div');
    const form = document.createElement('form'); form.className = 'stack-form';
    body.appendChild(form);

    // PK — generated for new records, locked for edits
    form.appendChild(fieldRow(humanize(pk) + (record ? '' : ' (auto)'), roInput(newId),
      record ? 'Primary key — read-only' : 'Primary key — generated automatically'));

    // Bespoke stepped/cascading forms (Jobs, Task Templates) own the whole field area.
    if (CUSTOM_FORMS[entity]) {
      ctx.collect = CUSTOM_FORMS[entity](form, ctx, link);
      ctx.body = body;
      return ctx;
    }

    // linked parent field (locked)
    if (link) {
      const parentLabel = lookup(link.parentEntity, link.value) || link.value;
      form.appendChild(fieldRow(humanize(link.field), roInput(parentLabel + '  (' + link.value + ')'),
        `Linked to the ${singularTitle(link.parentTab)} being created`));
    }

    const skip = new Set([pk, link ? link.field : null]);
    const spec = getCatalog(entity)?.form;
    if (spec && spec.fields && typeof spec.fields === 'object') {
      buildSpecFields(entity, spec, form, ctx, skip, record, addNewFor);
    } else {
      for (const f of getBaseFields(entity)) {
        if (skip.has(f)) continue;
        const c = classify(entity, f);
        const { node, get } = buildControl(entity, f, c);
        if (record) setControlValue(node, c, record[f]);
        ctx.controls[f] = get;
        let control = node;
        if (c.ref) {
          control = withAddNew(node, c.ref, addNewFor, (newId) => {
            const { options } = optionsForAttr(entity, f);
            refillSelect(node, options || fkOptions(c.ref), c.ref, newId);
          });
        }
        form.appendChild(fieldRow(humanize(f), control, hintFor(c)));
      }
    }

    // mirror / auto-calculated fields (read-only, so the client sees what's derived)
    const mirrors = (cfg?.columns || []).filter(col => col.mirror);
    if (mirrors.length) {
      form.appendChild(sectionNote('Auto-calculated on save'));
      for (const col of mirrors) form.appendChild(fieldRow(col.label || col.key, roInput('— derived —'), 'Computed from related records'));
    }

    // rollups → "New <child>" buttons that push a nested form linked to this record
    // (table-level subitems + any form-level subitem-tables from the spec)
    const rollups = [...rollupsForEntity(entity)];
    for (const child of (ctx.formSubitems || [])) {
      if (rollups.some(rl => rl.childEntity === child)) continue;
      const key = childKeyFor(child, entity);
      if (key) rollups.push({ label: child, childEntity: child, childKey: key, columns: columnsFor(child, 'sub') });
    }
    if (rollups.length) {
      form.appendChild(sectionNote('Related records'));
      for (const rl of rollups) {
        const childCfg = cfgForEntity(rl.childEntity);
        const row = document.createElement('div');
        row.className = 'rollup-add';
        const badge = document.createElement('span'); badge.className = 'count-badge';
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'btn-secondary';
        const plus = document.createElement('span'); plus.textContent = '+';
        btn.append(plus, ` New ${singularTitle(rl.label)}`);
        btn.addEventListener('click', () => pushForm(childCfg, rl.childEntity, {
          field: rl.childKey, value: newId, parentEntity: entity, parentTab: cfg ? cfg.tab : entity,
        }));
        const lbl = document.createElement('span'); lbl.className = 'rollup-add-label'; lbl.textContent = rl.label;
        row.append(lbl, badge, btn);
        form.appendChild(row);
        ctx.badges.push({ el: badge, childEntity: rl.childEntity, childKey: rl.childKey, parentId: newId });
      }
    }

    ctx.body = body;
    return ctx;
  }

  function render() {
    // spine tabs
    spineCol.innerHTML = '';
    stack.forEach((ctx, i) => {
      const tab = document.createElement('button');
      tab.className = 'spine-tab' + (i === activeIdx ? ' active' : '');
      tab.textContent = ctx.spine;
      tab.addEventListener('click', () => { activeIdx = i; render(); });
      spineCol.appendChild(tab);
    });

    // active form body
    const ctx = stack[activeIdx];
    head.innerHTML = '';
    const hd = document.createElement('div');
    const ht = document.createElement('div'); ht.className = 'drawer-title'; ht.textContent = ctx.title;
    const hs = document.createElement('div'); hs.className = 'drawer-sub';
    hs.textContent = 'Demo form — saved to this session only, resets on reload';
    hd.append(ht, hs); head.appendChild(hd);
    const x = document.createElement('button'); x.className = 'drawer-x'; x.textContent = '✕';
    x.addEventListener('click', closeAll); head.appendChild(x);

    bodyHost.innerHTML = ''; bodyHost.appendChild(ctx.body);
    // refresh rollup count badges from live data
    ctx.badges.forEach(b => {
      const n = getEntity(b.childEntity).filter(c => c[b.childKey] === b.parentId).length;
      b.el.textContent = n; b.el.style.visibility = n ? 'visible' : 'hidden';
    });

    // footer
    foot.innerHTML = '';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn-secondary';
    cancel.textContent = activeIdx > 0 ? 'Discard' : 'Cancel';
    cancel.addEventListener('click', () => { if (activeIdx > 0) { stack.splice(activeIdx, 1); activeIdx -= 1; render(); } else closeAll(); });
    const save = document.createElement('button'); save.type = 'button'; save.className = 'btn-primary';
    save.textContent = activeIdx > 0 ? 'Add' : 'Save';
    save.addEventListener('click', () => commit(ctx));
    foot.append(cancel, save);
  }

  function commit(ctx) {
    const rec = { [ctx.pk]: ctx.newId };
    if (ctx.collect) Object.assign(rec, ctx.collect());
    else for (const [f, get] of Object.entries(ctx.controls)) rec[f] = get();
    if (ctx.link) rec[ctx.link.field] = ctx.link.value; // link wins over any cascade choice
    applyJobTransition(ctx.entity, rec, ctx.editing ? getById(ctx.entity, ctx.newId) : null);
    if (ctx.editing) updateRecord(ctx.entity, ctx.newId, rec);
    else addRecord(ctx.entity, rec);
    enrichAll();
    if (ctx.onSavedCb) ctx.onSavedCb(ctx.newId);
    toast(`${ctx.editing ? 'Updated' : 'Added'} ${ctx.newId} ${ctx.editing ? 'in' : 'to'} ${ctx.cfg ? ctx.cfg.tab : ctx.entity}`);
    if (activeIdx > 0) {
      stack.splice(activeIdx, 1); activeIdx -= 1; render();   // pop back to parent
    } else {
      closeAll(); onSaved && onSaved();
    }
  }

  pushForm(rootCfg, rootCfg.entity, null, editRecord);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
}

// value-vs-value match where either side may be an array (multivalued FKs)
function arrOverlap(a, b) {
  if (a == null || b == null || a === '' || b === '') return false;
  const A = Array.isArray(a) ? a : [a];
  const B = Array.isArray(b) ? b : [b];
  return A.some((x) => B.includes(x));
}

// Options for the Jobs "Responsible" control: certified Onboarding rows whose
// Competence matches the selected Ticket's scope / product group / linked
// requirements, and the selected Task when present. Conditions the Competence
// record doesn't declare are skipped (lenient — demo data is sparse).
function certifiedResponsibles(ticketId, taskId) {
  const tickets = resolveTable('Tickets');
  const ticket = ticketId && tickets ? getById(tickets, ticketId) : null;
  let scope = null, pg = null, reqIds = null;
  if (ticket) {
    scope = ticket.scopes || ticket.scopeID || null;
    const pgTable = resolveTable('Product Groups');
    const pgRec = pgTable && getEntity(pgTable).find((g) => arrOverlap(g.productID, ticket.products));
    pg = pgRec ? pgRec.productGroupID : null;
    const reqTable = resolveTable('Requirements');
    if (reqTable && (scope || pg)) {
      const reqCat = getCatalog(reqTable);
      reqIds = getEntity(reqTable)
        .filter((r) => (!scope || arrOverlap(r.scopeID, scope)) && (!pg || arrOverlap(r.productGroupID, pg)))
        .map((r) => r[reqCat.pk]);
    }
  }
  const out = [], seen = new Set();
  const obTable = resolveTable('Onboarding');
  const compTable = resolveTable('Competence');
  if (!obTable || !compTable) return out;
  for (const ob of getEntity(obTable)) {
    if (ob.isCertified !== true) continue;
    const comp = getById(compTable, ob.competenceID);
    if (!comp) continue;
    if (scope && comp.scopeID && !arrOverlap(comp.scopeID, scope)) continue;
    if (pg && comp.productGroupID && !arrOverlap(comp.productGroupID, pg)) continue;
    if (reqIds && reqIds.length && comp.requirementID && !arrOverlap(comp.requirementID, reqIds)) continue;
    if (taskId && comp.taskID && !arrOverlap(comp.taskID, taskId)) continue;
    const uid = ob.userID;
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    out.push({ value: uid, label: lookup('People', uid) || uid });
  }
  return out;
}

// Options for the Jobs "Task" select — the datamodel chain
// `rollup → Tasks (via: customerID + productGroupID + scopeID)` resolved
// through the selected Ticket: ticket → scopes / products → product group /
// customer, task → workflow → customerID / productScopeID. Irreducibly
// multi-hop (like certifiedResponsibles), so it lives here rather than in
// the generic join engine. Workflow applicability keys left EMPTY mean
// "applies to all" (Q1 wildcard); tasks without a workflow pass (lenient).
// Exported for tools/test_engine_org.mjs.
export function tasksForJob(ticketId) {
  const tasksT = resolveTable('Tasks');
  if (!tasksT) return [];
  const meta = ENTITY_META[tasksT];
  const asOption = (t) => ({ value: t[meta.pk], label: t.taskName || t[meta.pk] });
  const tickets = resolveTable('Tickets');
  const ticket = ticketId && tickets ? getById(tickets, ticketId) : null;
  if (!ticket) return getEntity(tasksT).map(asOption);
  const wfT = resolveTable('Workflows');
  const psT = resolveTable('Product Scopes');
  const scope = ticket.scopes || ticket.scopeID || null;
  const cust = ticket.customerID || ticket.customerName || null;
  const pgTable = resolveTable('Product Groups');
  const pgRec = pgTable && getEntity(pgTable).find((g) => arrOverlap(g.productID, ticket.products));
  const pg = pgRec ? pgRec.productGroupID : null;
  const out = [];
  for (const t of getEntity(tasksT)) {
    const wf = wfT && t.workflowID ? getById(wfT, t.workflowID) : null;
    if (wf) {
      const wfCust = wf.customerID;
      if (cust && wfCust != null && wfCust !== '' && !(Array.isArray(wfCust) && !wfCust.length)
          && !arrOverlap(wfCust, cust)) continue;
      const psIds = wf.productScopeID;
      if ((scope || pg) && psIds != null && psIds !== '' && !(Array.isArray(psIds) && !psIds.length) && psT) {
        const pss = (Array.isArray(psIds) ? psIds : [psIds]).map((id) => getById(psT, id)).filter(Boolean);
        if (pss.length) {
          if (scope && !pss.some((ps) => arrOverlap(ps.scopeID, scope))) continue;
          if (pg && !pss.some((ps) => arrOverlap(ps.productGroupID, pg))) continue;
        }
      }
    }
    out.push(asOption(t));
  }
  return out;
}

// Options for the Tasks "Inputs" / "Outputs" pickers (decision 2026-07-30,
// "filtered selection"): a Handout stays selectable while UNLINKED (no task
// references it yet — e.g. just created from this form's "New Handout"
// button); once linked, it is only offered to tasks on the same
// Process → Activity → Action chain as its owning task(s). Exported for
// tools/test_engine_indentation.mjs.
export function handoutsForTask(processID, workflowID, actionID) {
  const hT = resolveTable('Handouts');
  if (!hT) return [];
  const hMeta = ENTITY_META[hT];
  const tT = resolveTable('Tasks');
  const tasks = tT ? getEntity(tT) : [];
  const tPk = tT ? ENTITY_META[tT].pk : null;
  const filters = [['processID', processID], ['workflowID', workflowID], ['actionID', actionID]]
    .filter(([, v]) => v != null && v !== '');
  const out = [];
  for (const h of getEntity(hT)) {
    const hid = h[hMeta.pk];
    const owners = tasks.filter((t) => arrOverlap(t.taskInput, hid)
      || arrOverlap(t.taskOutput, hid) || (tPk && arrOverlap(h.taskID, t[tPk])));
    const ok = !owners.length
      || !filters.length
      || owners.some((t) => filters.every(([f, v]) => arrOverlap(t[f], v)));
    if (!ok) continue;
    const lbl = resolveDisplay(hT, h, ENTITY_META[hT].label);
    out.push({ value: hid, label: String(lbl !== '' ? lbl : hid) });
  }
  return out;
}

// Jobs status transitions drive the real-clock timestamps (restructure spec):
// Queued→Active stamps realStartDate; entering Stoped stamps stoppedAt and
// leaving it accrues the pause into jobBufferExecution (decimal hours);
// Active→Done stamps realEndDate and STORES realExecutionTime =
// elapsed − buffer (consumers read the stored field; the datamodel rule is
// documentation). Exported for tools/test_jobs.mjs.
export function applyJobTransition(entity, rec, prev, nowISO = null) {
  if (entity !== 'Jobs') return;
  const before = prev ? prev.jobStatus : null;
  const after = rec.jobStatus;
  if (!after || after === before) return;
  const now = nowISO || new Date().toISOString();
  const hrs = (a, b) => Math.round(((Date.parse(a) - Date.parse(b)) / 36e5) * 100) / 100;
  if (after === 'Active' && !(prev && prev.realStartDate)) rec.realStartDate = now;
  if (before === 'Stoped') {
    const buf = Number(prev && prev.jobBufferExecution) || 0;
    const since = prev && prev.stoppedAt;
    rec.jobBufferExecution = Math.max(0, buf + (since ? hrs(now, since) : 0));
    rec.stoppedAt = null;
  }
  if (after === 'Stoped') rec.stoppedAt = now;
  if (after === 'Done') {
    rec.realEndDate = now;
    const start = rec.realStartDate || (prev && prev.realStartDate);
    const buf = rec.jobBufferExecution ?? (prev && prev.jobBufferExecution) ?? 0;
    if (start) rec.realExecutionTime = Math.max(0, hrs(now, start) - Number(buf));
  }
}

// ================= control builders =================
// checkbox multi-picker. A native <select multiple> needs cmd/ctrl-click to
// assign more than one value — a plain click replaces the selection — which
// hides multi-assignment. Each row here toggles independently, so users can
// assign multiple values (e.g. several input/output handouts) at once.
function mkMultiCheck(options) {
  const wrap = document.createElement('div');
  wrap.className = 'form-multicheck';
  let boxes = [];
  const render = (opts) => {
    // cascade refilters re-render the rows; already-checked values survive
    const keep = new Set(boxes.filter((c) => c.checked).map((c) => c.value));
    wrap.innerHTML = '';
    boxes = [];
    for (const o of (opts || [])) {
      if (o.header != null) {
        const h = document.createElement('div');
        h.className = 'form-multicheck-group';
        h.textContent = o.header;
        wrap.appendChild(h);
        continue;
      }
      if (o.value === '' || o.value == null) continue;
      const row = document.createElement('label');
      row.className = 'form-multicheck-row';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.value = String(o.value);
      cb.checked = keep.has(cb.value);
      const span = document.createElement('span');
      span.textContent = o.label;
      row.append(cb, span);
      wrap.appendChild(row);
      boxes.push(cb);
    }
  };
  render(options);
  const get = () => boxes.filter((c) => c.checked).map((c) => c.value);
  const set = (v) => {
    const s = new Set((Array.isArray(v) ? v : [v]).map(String));
    boxes.forEach((c) => { c.checked = s.has(c.value); });
  };
  wrap._setMulti = set;
  wrap._rebuild = render;
  return { node: wrap, get, set };
}
function buildControl(entity, field, c) {
  if (c.type === 'bool') { const s = mkSelect([{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]); return { node: s, get: () => s.value === 'true' }; }
  if (c.type === 'enum') { const s = mkSelect([{ value: '', label: '— select —' }, ...c.options.map(o => ({ value: o, label: o }))]); return { node: s, get: () => s.value }; }
  if (c.type === 'fk') { const s = mkSelect([{ value: '', label: '— select —' }, ...(c.options || fkOptions(c.ref))]); return { node: s, get: () => s.value }; }
  if (c.type === 'multiselect') { const m = mkMultiCheck(c.options || fkOptions(c.ref)); return { node: m.node, get: m.get }; }
  if (c.type === 'tags') { const i = mkInput('text'); i.placeholder = 'comma,separated'; return { node: i, get: () => i.value.split(',').map(x => x.trim()).filter(Boolean) }; }
  if (c.type === 'date') { const i = mkInput('date'); return { node: i, get: () => i.value }; }
  if (c.type === 'number') { const i = mkInput('number'); return { node: i, get: () => (i.value === '' ? null : Number(i.value)) }; }
  const i = mkInput('text'); return { node: i, get: () => i.value };
}
function hintFor(c) {
  if (c.type === 'fk') return `Foreign key → ${c.ref}`;
  if (c.type === 'multiselect') return `Multiple → ${c.ref}`;
  return '';
}
// select + a "+" button that opens a nested form for the select's target table
function withAddNew(node, target, addNew, refresh) {
  const wrap = document.createElement('div');
  wrap.className = 'select-add';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-secondary select-add-btn';
  btn.title = `Create a new ${singularTitle(target)}`;
  btn.textContent = '+';
  btn.addEventListener('click', () => addNew(target, refresh));
  wrap.append(node, btn);
  return wrap;
}

// rebuild a select's option list and pick the freshly created record —
// by id, or by its label for name-valued selects
function refillSelect(node, options, target, newId) {
  const keep = node.multiple
    ? new Set([...node.selectedOptions].map((o) => o.value)) : new Set([node.value]);
  node.innerHTML = '';
  if (!node.multiple) node.appendChild(new Option('— select —', ''));
  (options || []).forEach((o) => node.appendChild(new Option(o.label, o.value)));
  const tCat = getCatalog(target);
  const rec = getById(target, newId);
  const wanted = new Set([String(newId), rec && tCat ? String(rec[tCat.label] ?? '') : '']);
  [...node.options].forEach((o) => {
    if (wanted.has(o.value) || keep.has(o.value)) o.selected = true;
  });
}

// Prefill a control built by buildControl with an existing record's value (edit mode).
function setControlValue(node, c, v) {
  if (v == null) return;
  if (node.type === 'datetime-local') { node.value = String(v).slice(0, 16); return; }
  if (c.type === 'bool') { node.value = String(v); return; }
  if (c.type === 'multiselect') {
    if (node._setMulti) { node._setMulti(v); return; }
    const vals = new Set((Array.isArray(v) ? v : [v]).map(String));
    [...node.options].forEach(o => { o.selected = vals.has(o.value); });
    return;
  }
  if (c.type === 'tags') { node.value = Array.isArray(v) ? v.join(',') : String(v); return; }
  node.value = String(v);
}

// Bespoke stepped forms were retired with the registry; the datamodel
// form spec declares cascading behaviour via check/field-rule.
const CUSTOM_FORMS = {};

// ============ Spec-driven form builder (DATAMODEL_GUIDE §6) ============
// steps: named sections ordered by step-order; fields: field-type mapped to
// vanilla controls; check "<Label> IS NOT NULL" gates a field on another;
// field-rule handles "filtered by <X> selected", "Allow multiple values" /
// "Multivalued field", "SelectLabel = <field>" (optgroups) and "enum: A, B".

function firstTypeKey(ft) {
  if (Array.isArray(ft)) ft = ft.find((x) => x && typeof x === 'object') || {};
  if (ft && typeof ft === 'object') return (Object.keys(ft)[0] || 'input').toLowerCase();
  return 'input';
}

function specOptions(entity, attrName, ruleText) {
  const res = optionsForAttr(entity, attrName, ruleText);
  if (res.options) return res;
  return {
    options: distinct(entity, attrName).map((v) => ({ value: v, label: String(v) })),
    target: null, multi: res.multi,
  };
}

// grouped variant for checkbox pickers: interleave {header} rows per the
// group field resolved on each option's target record ("SelectLabel = X"
// parity for multi-selects, e.g. Scopes.Opportunity grouped by issueType)
function withGroupHeaders(options, target, groupField) {
  if (!groupField || !target || !options || !options.length) return options || [];
  const tCat = getCatalog(target);
  const byLabelVal = new Map(getEntity(target).map((r) => [String(r[tCat.label] ?? ''), r]));
  const groups = new Map();
  for (const o of options) {
    const rec = getById(target, o.value) || byLabelVal.get(String(o.value));
    const g = rec ? String(resolveDisplay(target, rec, groupField) || '—') : '—';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(o);
  }
  const out = [];
  for (const [g, list] of [...groups.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
    out.push({ header: g });
    out.push(...list);
  }
  return out;
}

function fillOptions(sel, options, groupField, target, placeholder) {
  sel.innerHTML = '';
  const ph = document.createElement('option');
  ph.value = ''; ph.textContent = placeholder || '— select —';
  sel.appendChild(ph);
  if (groupField && target) {
    const tCat = getCatalog(target);
    const byLabelVal = new Map(getEntity(target).map((r) => [String(r[tCat.label] ?? ''), r]));
    const groups = new Map();
    for (const o of options) {
      const rec = getById(target, o.value) || byLabelVal.get(String(o.value));
      const g = rec ? (resolveDisplay(target, rec, groupField) || '') : '';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(o);
    }
    for (const [g, list] of [...groups.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
      const og = document.createElement('optgroup'); og.label = String(g || '—');
      list.forEach((o) => { const el = document.createElement('option'); el.value = o.value; el.textContent = o.label; og.appendChild(el); });
      sel.appendChild(og);
    }
  } else {
    options.forEach((o) => { const el = document.createElement('option'); el.value = o.value; el.textContent = o.label; sel.appendChild(el); });
  }
}

function buildSpecFields(entity, spec, form, ctx, skip, record, addNew = null) {
  // ---- steps ordered by step-order ----
  const steps = [];
  if (spec.steps && typeof spec.steps === 'object') {
    for (const [title, s] of Object.entries(spec.steps)) {
      steps.push({ title, order: (s && s['step-order']) || 99, description: s && s['step-description'] });
    }
    steps.sort((a, b) => a.order - b.order);
  }
  const stepHosts = {};
  for (const st of steps) {
    form.appendChild(sectionNote(st.title + (st.description ? ` — ${st.description}` : '')));
    const host = document.createElement('div');
    form.appendChild(host);
    stepHosts[st.title] = host;
  }
  const defaultHost = document.createElement('div');
  form.appendChild(defaultHost);

  const byLabel = {};   // field label -> { node, get, refilter }
  const entries = Object.entries(spec.fields).filter(([, fv]) => fv && typeof fv === 'object');

  for (const [label, fv] of entries) {
    const attrName = fv.attribute;
    if (attrName && skip.has(attrName)) continue;
    const typeKey = firstTypeKey(fv['field-type']);
    const ruleText = Array.isArray(fv['field-rule']) ? fv['field-rule'].join('; ') : (fv['field-rule'] || '');
    const groupM = String(ruleText).match(/SelectLabel\s*=\s*([A-Za-z.]+)/);
    const groupField = groupM ? groupM[1].split('.').pop() : null;

    let node, get;
    if (['select', 'selectgroups', 'combobox', 'comboboxgroups', 'radio'].includes(typeKey)) {
      const { options: rawOptions, target, multi: noteMulti } = specOptions(entity, attrName, ruleText);
      // "WHERE <field> >= current month" (e.g. Forecast Scopes → Forecast):
      // drop options whose target record's date field precedes the current
      // month. Dotted spellings keep the last segment.
      const whereM = ruleText.match(/WHERE\s+([A-Za-z_.]+)\s*>=\s*current month/i);
      const applyWhere = (opts) => {
        if (!whereM || !target) return opts || [];
        const f = whereM[1].split('.').pop();
        const now = new Date();
        const floor = new Date(now.getFullYear(), now.getMonth(), 1);
        return (opts || []).filter((o) => {
          const rec = getById(target, o.value);
          const v = rec && rec[f];
          if (v == null || v === '') return false;
          const d = new Date(String(v));
          return !Number.isNaN(d.getTime()) && d >= floor;
        });
      };
      const options = applyWhere(rawOptions);
      const multi = /allow multiple|multivalued/i.test(ruleText) || noteMulti;
      if (multi) {
        // multi-assignment: a checkbox list (each row toggles), not a native
        // <select multiple> which requires cmd-click and hides multi-select.
        // "SelectLabel = <field>" renders as group header rows.
        const picker = mkMultiCheck(withGroupHeaders(options, target, groupField));
        node = picker.node; node.classList.add('form-input');
        get = picker.get;
      } else {
        node = document.createElement('select'); node.className = 'form-input';
        fillOptions(node, options, groupField, target, undefined);
        get = () => node.value;
      }
      // cascade: "filtered by <A> [+ <B>…] selected" — ANDs option filtering
      // across every dependency; selects refill, multi-checks rebuild. A part
      // spelled "Dep.field" (e.g. "Ticket.processID") switches to record
      // matching: the option's record must share `field` (and any following
      // bare field names) with the SELECTED dep record.
      const filtM = ruleText.match(/filtered by (?:the )?([A-Za-z .+&,]+?)(?: selected| field|$)/i);
      if (filtM && target) {
        const parts = filtM[1].split(/\s*(?:\+|&&|,|\band\b)\s*/i).map((s) => s.trim()).filter(Boolean);
        // group parts: "Ticket.processID" starts a record-dep; bare parts that
        // don't match a form label attach to the previous record-dep as fields
        const deps = [];
        for (const p of parts) {
          if (p.includes('.')) {
            const [head, field] = p.split('.').map((s) => s.trim());
            deps.push({ label: head, fields: [field] });
          } else {
            const isLabel = Object.keys(spec.fields).some((l) => l.toLowerCase() === p.toLowerCase()
              || l.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(l.toLowerCase()));
            const last = deps[deps.length - 1];
            if (!isLabel && last && last.fields) last.fields.push(p);
            else deps.push({ label: p });
          }
        }
        const applyOpts = (opts) => {
          if (node._rebuild) node._rebuild(withGroupHeaders(opts, target, groupField));
          else fillOptions(node, opts, groupField, target);
        };
        node._refilterDepSpecs = deps;
        node._refilter = () => {
          // Jobs "Task": the ticket-driven chain (customer + product group +
          // scope through the task's workflow) is bespoke — see tasksForJob.
          if (entity === 'Jobs' && attrName === 'taskID') {
            const dep = deps.map((d) => findDep(d.label)).find(Boolean);
            applyOpts(tasksForJob(dep ? dep[1].get() : null));
            return;
          }
          // Tasks "Inputs"/"Outputs": linked handouts follow their owning
          // task's Process → Activity → Action chain — see handoutsForTask.
          if (entity === 'Tasks' && (attrName === 'taskInput' || attrName === 'taskOutput')) {
            const val = (name) => { const dep = findDep(name); return dep ? dep[1].get() : null; };
            applyOpts(handoutsForTask(val('Process'), val('Activity'), val('Action')));
            return;
          }
          let opts = applyWhere(specOptions(entity, attrName, ruleText).options);
          for (const d of deps) {
            const depName = d.label.toLowerCase();
            const dep = Object.entries(byLabel).find(([l]) => l.toLowerCase() === depName
              || l.toLowerCase().includes(depName) || depName.includes(l.toLowerCase()));
            if (!dep) continue;
            const depVal = dep[1].get();
            if (depVal == null || depVal === '' || (Array.isArray(depVal) && !depVal.length)) continue;
            const depAttr = spec.fields[dep[0]] && spec.fields[dep[0]].attribute;
            const depTarget = depAttr ? specOptions(entity, depAttr, '').target : null;
            if (d.fields && depTarget) {
              // record matching: compare listed fields of the dep record
              const depRec = getById(depTarget, depVal);
              if (!depRec) continue;
              for (const f of d.fields) {
                if (depRec[f] == null || depRec[f] === '') continue;
                opts = opts.filter((o) => {
                  const rec = getById(target, o.value);
                  return rec && arrOverlap(rec[f], depRec[f]);
                });
              }
            } else if (depTarget) {
              const key = childKeyFor(target, depTarget);
              const stored = key && getEntity(target).some((rec) => rec[key] != null && rec[key] !== '');
              if (stored) {
                opts = opts.filter((o) => {
                  const rec = getById(target, o.value);
                  return rec && arrOverlap(rec[key], depVal);
                });
              } else {
                // option records don't store the key — derive membership
                // through the join engine instead (e.g. Squads.Owner: People
                // of the chosen Department via the shared business unit)
                const depRec = getById(depTarget, Array.isArray(depVal) ? depVal[0] : depVal);
                if (depRec) {
                  const tCat = getCatalog(target);
                  const allowed = new Set(childrenOf(depTarget, depRec, target)
                    .map((r) => String(r[tCat.pk])));
                  if (allowed.size) opts = opts.filter((o) => allowed.has(String(o.value)));
                }
              }
            }
          }
          applyOpts(opts);
        };
      }
    } else if (typeKey === 'dynamic-specs') {
      // dynamic attribute inputs: one control per Product Spec assigned to the
      // product picked in the sibling field ("specs of the <Product> selected");
      // values collect into an { productSpecID: value } map stored on the record
      const wrap = document.createElement('div');
      wrap.className = 'form-specs';
      const pending = { ...((record && record[attrName]) || {}) };
      let live = new Map();                 // spec id -> get()
      const collect = () => {
        const out = {};
        for (const [id, g] of live) {
          const v = g();
          if (v != null && v !== '') out[id] = v;
        }
        return out;
      };
      const depM = ruleText.match(/specs of (?:the )?([A-Za-z ]+?)(?: selected| field|$)/i);
      const depName = (depM ? depM[1] : 'product').trim().toLowerCase();
      const note = (txt) => {
        const d = document.createElement('div');
        d.className = 'form-hint'; d.textContent = txt;
        wrap.appendChild(d);
      };
      const rebuild = () => {
        Object.assign(pending, collect()); // typed values survive product switches
        live = new Map();
        wrap.innerHTML = '';
        const dep = Object.entries(byLabel).find(([l]) => l.toLowerCase() === depName
          || l.toLowerCase().includes(depName) || depName.includes(l.toLowerCase()));
        const depRaw = dep ? dep[1].get() : null;
        const selIds = (Array.isArray(depRaw) ? depRaw : [depRaw]).filter((v) => v != null && v !== '');
        const specTable = resolveTable('Product Specs');
        const sCat = specTable && getCatalog(specTable);
        if (!selIds.length || !sCat) { note('Select a Product to enter its specs'); return; }
        const depAttr = dep && spec.fields[dep[0]] && spec.fields[dep[0]].attribute;
        const depTarget = depAttr ? specOptions(entity, depAttr, '').target : null;
        const key = (depTarget && childKeyFor(specTable, depTarget)) || 'productID';
        const specs = getEntity(specTable).filter((s) => {
          const p = Array.isArray(s[key]) ? s[key] : [s[key]];
          return selIds.some((id) => p.includes(id));
        });
        if (!specs.length) { note('No specs assigned to this product'); return; }
        for (const s of specs) {
          let ctl, getVal;
          const t = String(s.specInputType || '').toLowerCase();
          if (t === 'int' || t === 'decimal') {
            ctl = mkInput('number'); ctl.step = t === 'int' ? '1' : 'any';
            getVal = () => (ctl.value === '' ? null : Number(ctl.value));
          } else if (t === 'list') {
            const opts = String(s.specOptions || '').split(/[;,]/)
              .map((x) => x.trim()).filter(Boolean)
              .map((x) => ({ value: x, label: x }));
            ctl = mkSelect([{ value: '', label: '— select —' }, ...opts]);
            getVal = () => ctl.value;
          } else {
            ctl = mkInput('text'); getVal = () => ctl.value;
          }
          const id = String(s[sCat.pk]);
          const prev = pending[id];
          if (prev != null && prev !== '') ctl.value = String(prev);
          live.set(id, getVal);
          wrap.appendChild(fieldRow(s[sCat.label] || id, ctl, String(s.specDescription || '').trim()));
        }
      };
      node = wrap;
      node._refilter = rebuild;
      node._skipSet = true; // prefill handled per-control from the value map
      get = collect;
      rebuild();
    } else if (typeKey === 'certified-responsible') {
      // Jobs "Responsible": Onboarding-certified people whose Competence
      // matches the selected Ticket's scope / product group / requirements
      // (and the selected Task, when one is picked). Irreducibly multi-hop —
      // lives here rather than in the generic join engine.
      const sel = document.createElement('select');
      sel.className = 'form-input';
      const rebuild = () => {
        const depVal = (name) => {
          const d = Object.entries(byLabel).find(([l]) => l.toLowerCase() === name
            || l.toLowerCase().includes(name));
          return d ? d[1].get() : null;
        };
        const keep = sel.value;
        const opts = certifiedResponsibles(depVal('ticket'), depVal('task'));
        fillOptions(sel, opts, null, null);
        if (opts.some((o) => String(o.value) === keep)) sel.value = keep;
      };
      node = sel;
      get = () => sel.value;
      node._refilter = rebuild;
      node._refilterDepSpecs = [{ label: 'Ticket' }, { label: 'Task' }];
      rebuild();
    } else if (typeKey === 'readonly') {
      // read-only derived field (decision Q4): the shown value resolves from
      // the OTHER controls' current values through the attribute's rule (e.g.
      // Customers.Segment auto-fills from the chosen Business Unit) and is
      // never stored — render-time resolution owns it.
      const inp = mkInput('text');
      inp.readOnly = true;
      inp.classList.add('form-ro');
      inp.placeholder = '— derived —';
      const rebuild = () => {
        const draft = {};
        for (const [f, g] of Object.entries(ctx.controls)) {
          const v = g();
          if (v != null && v !== '') draft[f] = v;
        }
        inp.value = String(resolveDisplay(entity, draft, attrName) || '');
      };
      node = inp;
      node._refilter = rebuild;
      node._refilterAll = true; // re-derive whenever any sibling field changes
      node._skipSet = true;
      get = () => undefined;
    } else if (typeKey === 'switch') {
      node = document.createElement('input'); node.type = 'checkbox'; node.className = 'form-switch';
      get = () => node.checked;
    } else if (typeKey === 'datetime') {
      node = mkInput('datetime-local'); get = () => node.value;
    } else if (typeKey === 'date' || typeKey === 'date picker') {
      node = mkInput('date'); get = () => node.value;
    } else if (typeKey === 'month') {
      node = mkInput('month'); get = () => node.value;
    } else if (typeKey === 'field') {
      node = document.createElement('textarea'); node.className = 'form-input'; node.rows = 3;
      get = () => node.value;
    } else {
      const a = getCatalog(entity)?.byName[attrName];
      node = mkInput(a && ['INT', 'DECIMAL'].includes(a.type) ? 'number' : 'text');
      get = () => (node.type === 'number' ? (node.value === '' ? null : Number(node.value)) : node.value);
    }

    if (record && attrName && !node._skipSet) setControlValue(node, { type: (node.multiple || node._setMulti) ? 'multiselect' : 'text' }, record[attrName]);
    if (attrName) ctx.controls[attrName] = get;
    byLabel[label] = { node, get };

    // wireframe drawer parity: every rollup select can create its target item
    let control = node;
    if (addNew && node.tagName === 'SELECT') {
      const { target } = specOptions(entity, attrName, ruleText);
      if (target) {
        control = withAddNew(node, target, addNew, (newId) => {
          const fresh = specOptions(entity, attrName, ruleText);
          refillSelect(node, fresh.options, target, newId);
        });
      }
    }

    const host = stepHosts[fv.step] || defaultHost;
    host.appendChild(fieldRow(label, control, (fv.tooltip || '').trim()));
  }

  // ---- cascade listeners: refilter when any declared dependency changes ----
  const findDep = (name) => {
    const n = String(name).trim().toLowerCase();
    return Object.entries(byLabel).find(([l]) => l.toLowerCase() === n
      || l.toLowerCase().includes(n) || n.includes(l.toLowerCase()));
  };
  for (const [label, ctl] of Object.entries(byLabel)) {
    const specs = ctl.node && ctl.node._refilterDepSpecs;
    const all = ctl.node && ctl.node._refilterAll;
    if (!specs && !all) continue;
    const deps = all
      ? Object.entries(byLabel).filter(([l]) => l !== label)
      : specs.map((d) => findDep(d.label)).filter((dep) => dep && dep[0] !== label);
    for (const dep of deps) {
      const fire = () => ctl.node._refilter && ctl.node._refilter();
      dep[1].node.addEventListener('change', fire);
      dep[1].node.addEventListener('input', fire);
    }
    if (ctl.node._refilter) ctl.node._refilter();
  }

  // ---- check conditions: "<Label> IS NOT NULL" (presence, "A && B" allowed)
  // or "<Label> = Value" (equality) gate this field on others ----
  for (const [label, fv] of entries) {
    const raw = fv.check && String(fv.check).trim();
    const chk = raw && raw.match(/^(.+?)\s+IS NOT NULL$/i);
    const eq = !chk && raw && raw.match(/^(.+?)\s*=\s*'?([^']+?)'?\s*$/);
    if ((!chk && !eq) || !byLabel[label]) continue;
    const depLabels = (chk ? chk[1] : eq[1]).split(/\s*&&\s*/).map((s) => s.trim()).filter(Boolean);
    const deps = depLabels.map(findDep).filter(Boolean);
    if (!deps.length) continue;
    const target = byLabel[label].node;
    const filled = (v) => v != null && String(v).length > 0 && !(Array.isArray(v) && !v.length);
    const update = () => {
      const has = chk
        ? deps.every((dep) => filled(dep[1].get()))
        : String(deps[0][1].get() ?? '').trim().toLowerCase() === eq[2].trim().toLowerCase();
      target.disabled = !has;
      // dynamic containers re-render even when the gate closes (to empty out);
      // selects keep the old behaviour (refilter only with a value present)
      if (target._refilter && (has || target.tagName !== 'SELECT')) target._refilter();
    };
    for (const dep of deps) {
      dep[1].node.addEventListener('change', update);
      dep[1].node.addEventListener('input', update);
    }
    update();
  }

  // ---- form-level subitem-tables: extra "New <child>" launchers ----
  const extra = Array.isArray(spec['subitem-tables']) ? spec['subitem-tables'] : [];
  ctx.formSubitems = extra.map((e) => resolveTable(String(e).split(':')[0])).filter(Boolean);
}

// ================= DOM helpers =================
function fieldRow(label, control, hint) {
  const w = document.createElement('label'); w.className = 'form-field';
  const l = document.createElement('span'); l.className = 'form-label'; l.textContent = label;
  w.append(l, control);
  if (hint) { const h = document.createElement('span'); h.className = 'form-hint'; h.textContent = hint; w.appendChild(h); }
  return w;
}
function sectionNote(text) { const d = document.createElement('div'); d.className = 'form-auto-note'; d.textContent = text; return d; }
function mkInput(type) { const i = document.createElement('input'); i.type = type; i.className = 'form-input'; return i; }
function mkSelect(options, multi = false) {
  const s = document.createElement('select'); s.className = 'form-input'; if (multi) s.multiple = true;
  for (const o of options) { const opt = document.createElement('option'); opt.value = o.value; opt.textContent = o.label; s.appendChild(opt); }
  return s;
}
function roInput(text) { const i = document.createElement('input'); i.className = 'form-input form-ro'; i.value = text; i.disabled = true; return i; }
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 200); }, 2600);
}
