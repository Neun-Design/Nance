// forms.js — "New Item" drawer with a stacked-form spine, mirroring the wireframe.
// A form exposes a "New <child>" button for each rollup relationship; clicking it pushes a
// nested form onto the stack (its own left-edge spine tab) and links the child to the parent
// (childKey = parent's generated PK). Saving a child pops back; saving the root closes.
// Records are added in-memory (non-persistent, resets on reload).

import { getEntity, getById, getBaseFields, addRecord, FK_MAP, ENTITY_META, lookup } from './data.js';
import { enrichAll } from './compute.js';
import { REGISTRY } from './registry.js';

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
const cfgForEntity = (entity) => {
  for (const mod of REGISTRY) for (const t of mod.tabs) if (t.entity === entity) return t;
  return null;
};
const rollupsForEntity = (entity) => (cfgForEntity(entity)?.rollups) || [];

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

// ================= Drawer stack =================
export function openForm(rootCfg, onSaved) {
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

  function pushForm(cfg, entity, link) {
    const ctx = buildFormCtx(cfg, entity, link);
    stack.push(ctx);
    activeIdx = stack.length - 1;
    render();
  }

  // Build a form context (its body DOM is kept alive so inputs persist across spine switches).
  function buildFormCtx(cfg, entity, link) {
    const pk = ENTITY_META[entity].pk;
    const newId = genId(entity);
    const ctx = { cfg, entity, pk, newId, link, controls: {}, badges: [], title: 'New ' + singularTitle(cfg ? cfg.tab : entity), spine: singularTitle(cfg ? cfg.tab : entity) };

    const body = document.createElement('div');
    const form = document.createElement('form'); form.className = 'stack-form';
    body.appendChild(form);

    // auto PK
    form.appendChild(fieldRow(humanize(pk) + ' (auto)', roInput(newId), 'Primary key — generated automatically'));

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
        btn.innerHTML = `<span>+</span> New ${singularTitle(rl.label)}`;
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
    head.innerHTML = `<div><div class="drawer-title">${ctx.title}</div>
      <div class="drawer-sub">Demo form — saved to this session only, resets on reload</div></div>`;
    const x = document.createElement('button'); x.className = 'drawer-x'; x.innerHTML = '✕';
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
    addRecord(ctx.entity, rec);
    enrichAll();
    toast(`Added ${ctx.newId} to ${ctx.cfg ? ctx.cfg.tab : ctx.entity}`);
    if (activeIdx > 0) {
      stack.splice(activeIdx, 1); activeIdx -= 1; render();   // pop back to parent
    } else {
      closeAll(); onSaved && onSaved();
    }
  }

  pushForm(rootCfg, rootCfg.entity, null);
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

// ================= Bespoke stepped / cascading forms =================
// Each returns a collect() -> record fields. mk*/fieldRow/roInput/sectionNote are hoisted.

const CUSTOM_FORMS = { Jobs: buildJobForm, Tasks: buildTaskForm };

function addOpt(sel, value, label) { const o = document.createElement('option'); o.value = value; o.textContent = label; sel.appendChild(o); }
function fillSelect(sel, options, thing, parent, emptyMsg) {
  sel.innerHTML = '';
  if (!options.length) { addOpt(sel, '', emptyMsg || `No ${thing} for selected ${parent}`); sel.disabled = true; return; }
  addOpt(sel, '', `— select ${thing} —`);
  options.forEach(o => addOpt(sel, o.value, o.label));
  sel.disabled = false;
}

// -------- Jobs: 4-step planning wizard (task → schedule → assign → dependencies) --------
function buildJobForm(form, ctx) {
  // Step 1 — Select template
  form.appendChild(sectionNote('Step 1 — Select template'));
  const taskSel = mkSelect([{ value: '', label: '— select task template —' },
    ...getEntity('Tasks').map(t => ({ value: t.taskID, label: t.taskName || t.taskID }))]);
  form.appendChild(fieldRow('Task Template', taskSel, 'The job executes this task'));
  const ticketSel = mkSelect([{ value: '', label: '— select ticket —' },
    ...getEntity('Tickets').map(t => ({ value: t.ticketID, label: `${t.ticketID} — ${lookup('Events', t.eventID, 'eventTitle')}` }))]);
  form.appendChild(fieldRow('Ticket', ticketSel, 'Work item this job belongs to'));
  const jobNameRO = roInput('— from template —');
  form.appendChild(fieldRow('Job Name (auto)', jobNameRO, 'Defaults to the activity name'));

  // Step 2 — Schedule
  form.appendChild(sectionNote('Step 2 — Schedule'));
  const startInp = mkInput('date'); form.appendChild(fieldRow('Planned Start Date', startInp));
  const endInp = mkInput('date'); form.appendChild(fieldRow('Planned End Date', endInp));

  // Step 3 — Assign (assignee filtered to the task's role; role/squad auto-fill)
  form.appendChild(sectionNote('Step 3 — Assign'));
  const userSel = mkSelect([{ value: '', label: '— select task template first —' }]); userSel.disabled = true;
  form.appendChild(fieldRow('Assignee', userSel, 'Only people whose role matches the task'));
  const roleRO = roInput('—'); form.appendChild(fieldRow('Role', roleRO, 'Auto from assignee'));
  const squadRO = roInput('—'); form.appendChild(fieldRow('Squad', squadRO, 'Auto from assignee'));

  // Step 4 — Dependencies (optional)
  form.appendChild(sectionNote('Step 4 — Dependencies (optional)'));
  const predSel = mkSelect([{ value: '', label: '— none —' },
    ...getEntity('Jobs').map(j => ({ value: j.jobID, label: `${j.projectName || '—'} — ${j.jobName || j.jobID}` }))]);
  form.appendChild(fieldRow('Predecessor Job', predSel));
  const depSel = mkSelect([{ value: '', label: '— none —' },
    ...['Start-to-Start', 'Start-to-Finish', 'Finish-to-Finish', 'Finish-to-Start'].map(x => ({ value: x, label: x }))]);
  form.appendChild(fieldRow('Dependency Type', depSel));

  // Execution & status
  form.appendChild(sectionNote('Execution & status'));
  const rStart = mkInput('date'); form.appendChild(fieldRow('Actual Start Date', rStart));
  const rEnd = mkInput('date'); form.appendChild(fieldRow('Actual End Date', rEnd));
  const rExecRO = roInput('—'); form.appendChild(fieldRow('Real Execution Time (h)', rExecRO, 'Actual end − start'));
  const statusSel = mkSelect(['Queued', 'Active', 'Done', 'Stoped'].map(s => ({ value: s, label: s === 'Stoped' ? 'Stopped' : s })));
  form.appendChild(fieldRow('Status', statusSel));

  function onTask() {
    const t = getById('Tasks', taskSel.value);
    jobNameRO.value = t ? (t.activityName || t.taskName) : '— from template —';
    const roleId = t ? t.roleID : null;
    const people = roleId ? getEntity('People').filter(p => p.roleID === roleId) : [];
    if (!roleId) fillSelect(userSel, [], 'assignee', 'task', '— select task template first —');
    else fillSelect(userSel, people.map(p => ({ value: p.userID, label: p.userName })), 'assignee', 'role',
      `No people with role ${lookup('Roles', roleId, 'roleName')}`);
    roleRO.value = roleId ? lookup('Roles', roleId, 'roleName') : '—';
    squadRO.value = '—';
  }
  function onUser() {
    const p = getById('People', userSel.value);
    if (!p) return;
    roleRO.value = lookup('Roles', p.roleID, 'roleName');
    squadRO.value = lookup('Squads', p.squadID, 'squadName') || '—';
  }
  function onActuals() {
    if (rStart.value && rEnd.value) {
      const h = Math.round((new Date(rEnd.value) - new Date(rStart.value)) / 3600000);
      rExecRO.value = isNaN(h) ? '—' : String(h);
    } else rExecRO.value = '—';
  }
  taskSel.addEventListener('change', onTask);
  userSel.addEventListener('change', onUser);
  rStart.addEventListener('change', onActuals);
  rEnd.addEventListener('change', onActuals);

  return () => {
    const t = getById('Tasks', taskSel.value);
    const tk = getById('Tickets', ticketSel.value);
    return {
      jobName: t ? (t.activityName || t.taskName) : '',
      taskID: taskSel.value, ticketID: ticketSel.value, userID: userSel.value,
      projectName: tk ? lookup('Projects', tk.projectID, 'projectName') : '',
      startDate: startInp.value, endDate: endInp.value,
      realStartDate: rStart.value, realEndDate: rEnd.value,
      realExecutionTime: (rExecRO.value && rExecRO.value !== '—') ? Number(rExecRO.value) : null,
      predecesorJob: predSel.value, dependencyType: depSel.value,
      jobStatus: statusSel.value || 'Queued',
    };
  };
}

// -------- Task Templates: Event → Process → Workflow → Activity cascade --------
function buildTaskForm(form, ctx, link) {
  form.appendChild(sectionNote('Cascading selection'));
  const eventSel = mkSelect([{ value: '', label: '— select event —' },
    ...getEntity('Events').map(e => ({ value: e.eventID, label: e.eventTitle }))]);
  form.appendChild(fieldRow('1 · Event', eventSel, 'Trigger for the task'));
  const procSel = mkSelect([{ value: '', label: '— select event first —' }]); procSel.disabled = true;
  form.appendChild(fieldRow('2 · Process', procSel, 'Processes triggered by the event'));
  const wfSel = mkSelect([{ value: '', label: '— select process first —' }]); wfSel.disabled = true;
  form.appendChild(fieldRow('3 · Workflow Step', wfSel, 'Steps within the process'));
  const actRO = roInput('—'); form.appendChild(fieldRow('4 · Activity (auto)', actRO, 'Set from the workflow step'));

  form.appendChild(sectionNote('Auto-populated'));
  const taskNameRO = roInput('—'); form.appendChild(fieldRow('Task Name', taskNameRO, 'action — activity — process'));
  const roleRO = roInput('—'); form.appendChild(fieldRow('Role', roleRO, 'From the activity'));

  form.appendChild(sectionNote('Work details'));
  const execInp = mkInput('number'); form.appendChild(fieldRow('Execution Time (h)', execInp));
  const psSel = mkSelect([{ value: '', label: '— select —' },
    ...getEntity('Product Scopes').map(ps => ({ value: ps.productScopeID, label: ps.productScopeName || ps.productScopeID }))]);
  form.appendChild(fieldRow('Product Scope', psSel, 'FK → Product Scopes'));
  const inSel = mkSelect([{ value: '', label: '— none —' }, ...getEntity('Handouts').map(h => ({ value: h.handoutID, label: h.handoutName }))]);
  form.appendChild(fieldRow('Input Handout', inSel));
  const outSel = mkSelect([{ value: '', label: '— none —' }, ...getEntity('Handouts').map(h => ({ value: h.handoutID, label: h.handoutName }))]);
  form.appendChild(fieldRow('Output Handout', outSel));
  const consSel = mkSelect(getEntity('Constraints').map(c => ({ value: c.constrainID, label: c.constrainName })), true);
  consSel.size = Math.min(5, consSel.options.length || 1);
  form.appendChild(fieldRow('Constraints', consSel, 'Multiple → Constraints'));

  let selAction = null;
  const activityIdFromWf = () => { const wf = getById('Workflows', wfSel.value); return wf ? wf.activities : ''; };
  function updateComputed() {
    const proc = getById('Processes', procSel.value);
    const act = getById('Activities', activityIdFromWf());
    const parts = [selAction ? lookup('Actions', selAction, 'actionName') : '',
      act ? act.activityName : '', proc ? proc.processName : ''].filter(Boolean);
    taskNameRO.value = parts.length ? parts.join(' — ') : '—';
    roleRO.value = act ? (lookup('Roles', act.roleID, 'roleName') || '—') : '—';
  }
  function onEvent() {
    const pids = [...new Set(getEntity('Tasks').filter(t => t.eventID === eventSel.value).map(t => t.processID))];
    fillSelect(procSel, pids.map(id => ({ value: id, label: lookup('Processes', id, 'processName') })), 'process', 'event');
    fillSelect(wfSel, [], 'workflow', 'process'); actRO.value = '—'; selAction = null; updateComputed();
  }
  function onProc() {
    const wfs = getEntity('Workflows').filter(w => w.processID === procSel.value);
    fillSelect(wfSel, wfs.map(w => ({ value: w.workflowID, label: `${w.workflowID} · ${lookup('Activities', w.activities, 'activityName')}` })), 'workflow', 'process');
    actRO.value = '—'; selAction = null; updateComputed();
  }
  function onWf() {
    const aid = activityIdFromWf();
    const act = getById('Activities', aid);
    actRO.value = act ? act.activityName : '—';
    const actions = getEntity('Actions').filter(a => a.activityID === aid);
    selAction = actions.length ? actions[0].actionID : null;
    updateComputed();
  }
  eventSel.addEventListener('change', onEvent);
  procSel.addEventListener('change', onProc);
  wfSel.addEventListener('change', onWf);

  // Nested creation (e.g. from a Process/Event rollup): preselect + lock the linked level.
  if (link && link.field === 'eventID') { eventSel.value = link.value; onEvent(); eventSel.disabled = true; }
  if (link && link.field === 'processID') {
    const ev = getEntity('Tasks').find(t => t.processID === link.value);
    if (ev) { eventSel.value = ev.eventID; onEvent(); eventSel.disabled = true; }
    procSel.value = link.value; onProc(); procSel.disabled = true;
  }

  return () => {
    const wf = getById('Workflows', wfSel.value);
    const act = getById('Activities', activityIdFromWf());
    return {
      eventID: eventSel.value, processID: procSel.value, activityID: activityIdFromWf(),
      actionID: selAction || '', roleID: act ? act.roleID : '',
      parentStepID: wf ? wf.workflowID : '',
      productScopeID: psSel.value, executionTime: execInp.value === '' ? null : Number(execInp.value),
      taskInputID: inSel.value, taskOutputID: outSel.value,
      constrainIDs: [...consSel.selectedOptions].map(o => o.value), customerName: '',
    };
  };
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
