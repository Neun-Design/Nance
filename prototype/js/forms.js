// forms.js — "New Item" drawer with a stacked-form spine, mirroring the wireframe.
// A form exposes a "New <child>" button for each rollup relationship; clicking it pushes a
// nested form onto the stack (its own left-edge spine tab) and links the child to the parent
// (childKey = parent's generated PK). Saving a child pops back; saving the root closes.
// Records are added in-memory (non-persistent, resets on reload).

import { getEntity, getById, getBaseFields, addRecord, updateRecord, FK_MAP, ENTITY_META, lookup } from './data.js';
import { enrichAll } from './compute.js';
import { getCatalog, resolveTable, columnsFor, childKeyFor, parseRule } from './model.js';
import { resolveDisplay } from './resolve.js';

// Fields that reference another entity but aren't named like its PK.
const REF_OVERRIDE = {
  processOwner: 'People', projectOwner: 'People', ticketOwner: 'People', riskOwner: 'People',
  sourceOwner: 'People', createdBy: 'People', changedBy: 'People', reportedBy: 'People',
  customerName: 'Factories', location: 'Factories', activities: 'Activities',
  products: 'Products', taskInputID: 'Handouts', taskOutputID: 'Handouts',
  parentStepID: 'Workflows', parentProcessID: 'Processes', predecesorJob: 'Jobs',
  escalatedToEventID: 'Events',
};
const ENUM_FIELDS = new Set([
  'status', 'ticketStatus', 'projectStatus', 'jobStatus', 'processStatus', 'channelStatus',
  'riskStatus', 'forecastPeriod', 'periodType', 'requirementType', 'riskCategory',
  'businessSegment', 'region', 'squadType', 'type', 'scopeOpportunity', 'dependencyType',
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
  return cat.subitems.map(si => {
    const child = resolveTable(si.table);
    const key = child && childKeyFor(child, entity);
    if (!child || !key) return null; // via-through chains can't be linked from a form
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

// table whose configured label field is `field` (e.g. constraintName → Constraints)
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
// attributes stored as names (e.g. constraintName).
export function optionsForAttr(entity, attrName, ruleText = '') {
  const cat = getCatalog(entity);
  const a = cat && cat.byName[attrName];
  const r = (a && parseRule(a.rule)) || null;
  const multi = !!(a && /multivalued/i.test(a.notes || ''));
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
  const valueField = attrName !== tCat.pk && getEntity(target).some(rec => attrName in rec)
    ? attrName : tCat.pk;
  // parent rows storing names rather than ids keep storing names
  const sample0 = sampleOf(entity, attrName);
  const sampleVal = Array.isArray(sample0) ? sample0[0] : sample0;
  const asLabel = valueField === tCat.pk && attrName === tCat.label
    && (sampleVal == null || !getById(target, sampleVal));

  const seen = new Map();
  for (const rec of getEntity(target)) {
    const v0 = rec[valueField];
    if (v0 == null || v0 === '') continue;
    let lblRaw = resolveDisplay(target, rec, display || tCat.label);
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

  function pushForm(cfg, entity, link, record) {
    const ctx = buildFormCtx(cfg, entity, link, record);
    stack.push(ctx);
    activeIdx = stack.length - 1;
    render();
  }

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
      buildSpecFields(entity, spec, form, ctx, skip, record);
    } else {
      for (const f of getBaseFields(entity)) {
        if (skip.has(f)) continue;
        const c = classify(entity, f);
        const { node, get } = buildControl(entity, f, c);
        if (record) setControlValue(node, c, record[f]);
        ctx.controls[f] = get;
        form.appendChild(fieldRow(humanize(f), node, hintFor(c)));
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
    if (ctx.editing) updateRecord(ctx.entity, ctx.newId, rec);
    else addRecord(ctx.entity, rec);
    enrichAll();
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

// ================= control builders =================
function buildControl(entity, field, c) {
  if (c.type === 'bool') { const s = mkSelect([{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]); return { node: s, get: () => s.value === 'true' }; }
  if (c.type === 'enum') { const s = mkSelect([{ value: '', label: '— select —' }, ...c.options.map(o => ({ value: o, label: o }))]); return { node: s, get: () => s.value }; }
  if (c.type === 'fk') { const s = mkSelect([{ value: '', label: '— select —' }, ...(c.options || fkOptions(c.ref))]); return { node: s, get: () => s.value }; }
  if (c.type === 'multiselect') { const s = mkSelect(c.options || fkOptions(c.ref), true); s.size = Math.min(5, s.options.length || 1); return { node: s, get: () => [...s.selectedOptions].map(o => o.value) }; }
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
// Prefill a control built by buildControl with an existing record's value (edit mode).
function setControlValue(node, c, v) {
  if (v == null) return;
  if (c.type === 'bool') { node.value = String(v); return; }
  if (c.type === 'multiselect') {
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

function buildSpecFields(entity, spec, form, ctx, skip, record) {
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
      const { options, target, multi: noteMulti } = specOptions(entity, attrName, ruleText);
      const multi = /allow multiple|multivalued/i.test(ruleText) || noteMulti;
      node = document.createElement('select'); node.className = 'form-input';
      if (multi) { node.multiple = true; node.size = Math.min(5, options.length || 1); }
      fillOptions(node, options, groupField, target, multi ? null : undefined);
      get = multi ? () => [...node.selectedOptions].map((o) => o.value).filter(Boolean)
                  : () => node.value;
      // cascade: "filtered by the <X> selected"
      const filtM = ruleText.match(/filtered by (?:the )?([A-Za-z ]+?)(?: selected| field|$)/i);
      if (filtM && target) {
        const depName = filtM[1].trim().toLowerCase();
        node._refilter = () => {
          const dep = Object.entries(byLabel).find(([l]) => l.toLowerCase().includes(depName) || depName.includes(l.toLowerCase()));
          if (!dep) return;
          const depVal = dep[1].get();
          const depAttr = spec.fields[dep[0]] && spec.fields[dep[0]].attribute;
          const depTarget = depAttr ? specOptions(entity, depAttr, '').target : null;
          let opts = specOptions(entity, attrName, ruleText).options;
          if (depVal && depTarget) {
            const key = childKeyFor(target, depTarget);
            if (key) opts = opts.filter((o) => { const rec = getById(target, o.value); return rec && (Array.isArray(rec[key]) ? rec[key].includes(depVal) : rec[key] === depVal); });
          }
          fillOptions(node, opts, groupField, target);
        };
      }
    } else if (typeKey === 'switch') {
      node = document.createElement('input'); node.type = 'checkbox'; node.className = 'form-switch';
      get = () => node.checked;
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

    if (record && attrName) setControlValue(node, { type: node.multiple ? 'multiselect' : 'text' }, record[attrName]);
    if (attrName) ctx.controls[attrName] = get;
    byLabel[label] = { node, get };

    const host = stepHosts[fv.step] || defaultHost;
    host.appendChild(fieldRow(label, node, (fv.tooltip || '').trim()));
  }

  // ---- check conditions: "<Label> IS NOT NULL" gates this field ----
  for (const [label, fv] of entries) {
    const chk = fv.check && String(fv.check).match(/^(.+?)\s+IS NOT NULL$/i);
    if (!chk || !byLabel[label]) continue;
    const depLabel = chk[1].trim().toLowerCase();
    const dep = Object.entries(byLabel).find(([l]) => l.toLowerCase() === depLabel
      || l.toLowerCase().includes(depLabel) || depLabel.includes(l.toLowerCase()));
    if (!dep) continue;
    const target = byLabel[label].node;
    const update = () => {
      const has = !!dep[1].get() && String(dep[1].get()).length > 0;
      target.disabled = !has;
      if (has && target._refilter) target._refilter();
    };
    dep[1].node.addEventListener('change', update);
    dep[1].node.addEventListener('input', update);
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
