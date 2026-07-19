// forms.js — "New Item" drawer with a stacked-form spine, mirroring the wireframe.
// A form exposes a "New <child>" button for each rollup relationship; clicking it pushes a
// nested form onto the stack (its own left-edge spine tab) and links the child to the parent
// (childKey = parent's generated PK). Saving a child pops back; saving the root closes.
// Records are added in-memory (non-persistent, resets on reload).

import { getEntity, getById, getBaseFields, addRecord, updateRecord, FK_MAP, ENTITY_META, lookup } from './data.js';
import { enrichAll } from './compute.js';
import { getCatalog, resolveTable, columnsFor, childKeyFor } from './model.js';

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
  if (FK_MAP[field] && field !== pk) return { type: 'fk', ref: FK_MAP[field] };
  if (isDateField(field)) return { type: 'date' };
  if (typeof sample === 'number') return { type: 'number' };
  return { type: 'text' };
}
function fkOptions(ref) {
  const meta = ENTITY_META[ref];
  return getEntity(ref).map(r => ({ value: r[meta.pk], label: `${r[meta.label] ?? r[meta.pk]}` }));
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
    for (const f of getBaseFields(entity)) {
      if (skip.has(f)) continue;
      const c = classify(entity, f);
      const { node, get } = buildControl(entity, f, c);
      if (record) setControlValue(node, c, record[f]);
      ctx.controls[f] = get;
      form.appendChild(fieldRow(humanize(f), node, hintFor(c)));
    }

    // mirror / auto-calculated fields (read-only, so the client sees what's derived)
    const mirrors = (cfg?.columns || []).filter(col => col.mirror);
    if (mirrors.length) {
      form.appendChild(sectionNote('Auto-calculated on save'));
      for (const col of mirrors) form.appendChild(fieldRow(col.label || col.key, roInput('— derived —'), 'Computed from related records'));
    }

    // rollups → "New <child>" buttons that push a nested form linked to this record
    const rollups = rollupsForEntity(entity);
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
  if (c.type === 'fk') { const s = mkSelect([{ value: '', label: '— select —' }, ...fkOptions(c.ref)]); return { node: s, get: () => s.value }; }
  if (c.type === 'multiselect') { const s = mkSelect(fkOptions(c.ref), true); s.size = Math.min(5, s.options.length || 1); return { node: s, get: () => [...s.selectedOptions].map(o => o.value) }; }
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
// form spec (P6-E) declares cascading behaviour via check/field-rule.
const CUSTOM_FORMS = {};

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
