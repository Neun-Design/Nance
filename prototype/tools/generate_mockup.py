#!/usr/bin/env python3
"""generate_mockup.py — rebuild mockup_data_prototype.json keyed 1:1 to the
canonical datamodel (prototype/data/datamodel.json).

Deterministic (seeded): running twice yields identical output.

Coverage contract (issue #23 / DATAMODEL_GUIDE):
- exactly the datamodel's 30 tables, grouped by its modules
- every stored attribute present on every row; derived (rollup/computed) omitted
- all FK -> rules resolvable; 12 months of dated records ending 2026-07
- Draft forecasts; weeklyUsageQuota + ticket execution hours for the
  budget-vs-estimated report; task names recurring across processes (top-3 card);
- two periods of data wherever a card declares trend-data
- fixed fixtures preserved: Factories 17, Actions 7, Scopes 10, Products 14,
  Product Groups 14, Product Class 15, Events/Tickets CSV lineage
"""
import json
import random
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DM = json.load(open(ROOT / 'data' / 'datamodel.json'))
OLD = json.load(open(ROOT / 'data' / 'mockup_data_prototype.json'))
OUT_PATH = ROOT / 'data' / 'mockup_data_prototype.json'

rng = random.Random(9001)  # ISO joke intended; fixed seed => deterministic
TODAY = date(2026, 7, 19)
MONTHS = [date(2025, 8, 1) + timedelta(days=31 * i) for i in range(12)]
MONTHS = sorted({date(d.year, d.month, 1) for d in MONTHS})[:12]  # 2025-08 .. 2026-07

old_flat = {}
for mod, ents in OLD.items():
    if mod == '_meta':
        continue
    for name, rows in ents.items():
        old_flat[name] = rows

# ---------------- helpers ----------------
def iso(d): return d.isoformat()

def month_of(i): return MONTHS[i % len(MONTHS)]

def pick(seq, i): return seq[i % len(seq)]

def rand_date(i, spread=360):
    return iso(TODAY - timedelta(days=(i * 37) % spread))

PEOPLE = old_flat['People']
USER_IDS = [p['userID'] for p in PEOPLE]
def owner(i): return pick(USER_IDS, i)

# ---------------- stored-attribute catalogue ----------------
def stored_attrs(table):
    return [a for a in table['attributes'] if a['type'] not in ('rollup', 'computed')]

TABLES = {}   # name -> (module, spec)
for mname, m in DM['modules'].items():
    for tname, t in m['tables'].items():
        TABLES[tname] = (mname, t)

# ---------------- per-table builders ----------------
def carry(rows):
    return [dict(r) for r in rows]

new = {}

# --- Customers ---
new['Factories'] = [
    {**{k: r[k] for k in ('factoryID', 'factoryName', 'city', 'country',
                          'businessSegment', 'region', 'isActive')},
     'factoryOwner': owner(i)}
    for i, r in enumerate(old_flat['Factories'])]
FACTORY_IDS = [f['factoryID'] for f in new['Factories']]
FACTORY_NAMES = [f['factoryName'] for f in new['Factories']]

# Forecasts: 3 factories x 12 months, statuses incl. Draft (for the Capacity radio)
STATUSES_FC = ['Approved', 'Submitted', 'Draft', 'Approved', 'Submitted', 'Draft',
               'Approved', 'Approved', 'Submitted', 'Approved', 'Draft', 'Approved']
new['Forecasts'] = []
fc_n = 0
for fi, fac in enumerate(FACTORY_IDS[:13]):
    for mi, m0 in enumerate(MONTHS):
        fc_n += 1
        m1 = (m0.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        new['Forecasts'].append({
            'forecastID': f'FRC{fc_n:03d}', 'factoryID': fac, 'forecastPeriod': 'Monthly',
            'periodStart': iso(m0), 'periodFinish': iso(m1),
            'periodBusinessDays': 20 + (mi % 3), 'periodFrame': f'{m0.year}-M{m0.month:02d}',
            'weeklyUsageQuota': 120 + 15 * ((fi + mi) % 4),
            'status': STATUSES_FC[(fi * 5 + mi) % len(STATUSES_FC)],
            'createdBy': owner(fi + mi), 'createdAt': iso(m0 - timedelta(days=20)),
            'totalEstimatedHours': 0.0,  # filled after Forecast Scopes
            'forecastOwner': owner(fi)})
FORECAST_IDS = [f['forecastID'] for f in new['Forecasts']]

SCOPES_FIX = old_flat['Scopes']
SCOPE_IDS = [s['scopeID'] for s in SCOPES_FIX]
PG_ROWS = old_flat['Product Groups']
PG_IDS = [g['productGroupID'] for g in PG_ROWS]
EVENTS_OLD = old_flat['Events']
EVENT_IDS = [e['eventID'] for e in EVENTS_OLD]
PS_OLD = old_flat['Product Scopes']
PS_IDS = [p['productScopeID'] for p in PS_OLD]
FUNCTIONS = old_flat['Functions']
FUNC_NAMES = [f['functionName'] for f in FUNCTIONS]
PROC_OLD = old_flat['Processes']
PROC_IDS = [p['processID'] for p in PROC_OLD]

# Forecast Scopes: 2-3 children per forecast
new['Forecast Scopes'] = []
fs_n = 0
for i, fc in enumerate(new['Forecasts']):
    for j in range(2 + (i % 2)):
        fs_n += 1
        hours = 40.0 + 8 * ((i + j * 3) % 9)
        new['Forecast Scopes'].append({
            'forecastScopeID': f'FS{fs_n:03d}',
            'forecastScopeRegistry': f'FSR-{2025 + (i % 2)}-{fs_n:04d}',
            'forecastID': fc['forecastID'], 'scopeID': pick(SCOPE_IDS, i + j),
            'productGroupID': pick(PG_IDS, i * 2 + j), 'productScopeID': pick(PS_IDS, i + j),
            'eventID': pick(EVENT_IDS, i + j * 5), 'processID': pick(PROC_IDS, i + j),
            'functionName': pick(FUNC_NAMES, i + j), 'estimatedHours': hours,
            'region': fc and pick(['EMEA', 'Americas', 'APAC'], i),
            'forecastScopeQuantity': 1 + (i + j) % 5, 'consumption': int(hours * 0.6),
            'notes': '', 'forecastScopeOwner': owner(i + j)})
        fc['totalEstimatedHours'] += hours
FS_IDS = [f['forecastScopeID'] for f in new['Forecast Scopes']]

# --- Operation ---
new['Events'] = [
    {'eventID': e['eventID'], 'eventTitle': e['eventTitle'],
     'eventDescription': e['eventDescription'], 'eventCreatedAt': e['eventCreatedAt'],
     'factoryName': pick(FACTORY_NAMES, i), 'productName': pick([p['productName'] for p in old_flat['Products']], i),
     'scopeName': pick([s['scopeName'] for s in SCOPES_FIX], i), 'eventOwner': owner(i)}
    for i, e in enumerate(EVENTS_OLD)]

new['Processes'] = [
    {'processID': p['processID'], 'processSystemID': p.get('processSystemID') or f'SYS-{i:03d}',
     'processName': p['processName'], 'eventID': pick(EVENT_IDS, i * 3),
     'processOwner': p.get('processOwner') or owner(i),
     'processDescription': p.get('processDescription') or '',
     'parentProcessID': p.get('parentProcessID'), 'processStatus': p.get('processStatus') or 'Active',
     'processVersion': p.get('processVersion') or '1.0',
     'productName': pick([x['productName'] for x in old_flat['Products']], i),
     'scopeName': pick([s['scopeName'] for s in SCOPES_FIX], i)}
    for i, p in enumerate(PROC_OLD)]

new['Activities'] = [
    {'activityID': a['activityID'], 'activityName': a['activityName'],
     'activityDescription': f"{a['activityName']} within the assigned process step.",
     'activityOwner': owner(i)}
    for i, a in enumerate(old_flat['Activities'])]
ACT_IDS = [a['activityID'] for a in new['Activities']]

WF_OLD = old_flat['Workflows']
CONSTR = old_flat['Constraints']
def cname(c): return c.get('constraintName') or c.get('constrainName')
new['Workflows'] = [
    {'workflowID': w['workflowID'],
     'workflowName': w.get('workflowName') or next((a['activityName'] for a in new['Activities'] if a['activityID'] == w.get('activities')), w['workflowID']),
     'processID': w['processID'], 'parentStepID': w.get('parentStepID'),
     'indentationID': w.get('identationID') or w.get('indentationID') or '1',
     'inputs': f'HO{(i % 10) + 1:02d}', 'outputs': f'HO{((i + 1) % 10) + 1:02d}',
     'scopes': pick(SCOPE_IDS, i), 'customer': pick(FACTORY_NAMES, i),
     'procedures': f'PROC-{i + 1:03d}', 'products': pick([p['productID'] for p in old_flat['Products']], i),
     'constraints': pick([c['constrainID'] for c in CONSTR], i), 'workflowOwner': owner(i)}
    for i, w in enumerate(WF_OLD)]
WF_BY_PROC = {}
for w in new['Workflows']:
    WF_BY_PROC.setdefault(w['processID'], []).append(w['workflowID'])

new['Actions'] = [
    {'actionID': a['actionID'], 'actionName': a['actionName'],
     'actionDescription': a['actionDescription'], 'activityID': pick(ACT_IDS, i),
     'workflowID': pick([w['workflowID'] for w in new['Workflows']], i), 'actionOwner': owner(i)}
    for i, a in enumerate(old_flat['Actions'])]
ACTION_IDS = [a['actionID'] for a in new['Actions']]

new['Constraints'] = [
    {'constrainID': c['constrainID'], 'constraintName': cname(c),
     'constrainDescription': c['constrainDescription'], 'constrainTypeID': c['constrainTypeID'],
     'isActive': c['isActive'], 'regulatoryReference': c.get('regulatoryReference') or '',
     'constraintOwner': owner(i)}
    for i, c in enumerate(CONSTR)]

new['Handouts'] = [
    {'handoutID': h['handoutID'], 'handoutName': h['handoutName'],
     'handoutDescription': h['handoutDescription'], 'createdAt': h['createdAt'],
     'channelID': h['channelID'], 'templateName': h.get('templateName') or h.get('templateTitle') or h['handoutName'],
     'templateURL': f"https://portal.example/templates/{h['handoutID']}", 'handoutOwner': owner(i)}
    for i, h in enumerate(old_flat['Handouts'])]

new['Channels'] = carry(old_flat['Channels'])

# Tasks: canonical fields + recurrence across processes for the top-3 card
ROLES_OLD = old_flat['Roles']
ROLE_IDS = [r['roleID'] for r in ROLES_OLD]
COMP_OLD = old_flat['Competence']
COMP_IDS = [c['competenceID'] for c in COMP_OLD]
ACTIVITY_NAME = {a['activityID']: a['activityName'] for a in new['Activities']}
ACTION_NAME = {a['actionID']: a['actionName'] for a in new['Actions']}
PROC_NAME = {p['processID']: p['processName'] for p in new['Processes']}

new['Tasks'] = []
base_tasks = [t for t in old_flat['Tasks']
              if not (str(t['taskID']).isdigit() and int(t['taskID']) >= 900)]
for i, t in enumerate(base_tasks):
    act = t.get('activityID')
    name = t.get('taskName') or f"{ACTION_NAME.get(pick(ACTION_IDS, i), 'Execution')} — {ACTIVITY_NAME.get(act, act)}"
    new['Tasks'].append({
        'taskID': t['taskID'], 'eventID': t['eventID'], 'processID': t['processID'],
        'workflowID': pick(WF_BY_PROC.get(t['processID'], [new['Workflows'][0]['workflowID']]), i),
        'actionID': pick(ACTION_IDS, i), 'products': pick([p['productID'] for p in old_flat['Products']], i),
        'scopes': pick(SCOPE_IDS, i), 'functionID': pick([f['functionID'] for f in FUNCTIONS], i),
        'executionTime': t.get('executionTime') or 4, 'competenceID': pick(COMP_IDS, i),
        'roles': t.get('roles') or t.get('roleID') or pick(ROLE_IDS, i),
        'procedureName': f'Procedure {t["processID"]}-{i % 7 + 1}',
        'procedureURL': f'https://portal.example/procedures/{t["taskID"]}',
        'taskName': name, 'taskOwner': owner(i)})
# recurrence: clone three task names into other processes
recur_src = new['Tasks'][:3]
tn = 900
for src in recur_src:
    for proc in [p for p in PROC_IDS if p != src['processID']][:2]:
        tn += 1
        clone = dict(src)
        clone.update({'taskID': str(tn), 'processID': proc,
                      'workflowID': pick(WF_BY_PROC.get(proc, [src['workflowID']]), tn),
                      'taskOwner': owner(tn)})
        new['Tasks'].append(clone)
TASK_IDS = [t['taskID'] for t in new['Tasks']]

# --- Inventory (fixtures + canonical fields) ---
new['Scopes'] = [
    {'scopeID': s['scopeID'], 'scopeCodeID': s['scopeID'], 'scopeName': s['scopeName'],
     'scopeOpportunity': s['scopeOpportunity'], 'scopeOwner': owner(i)}
    for i, s in enumerate(SCOPES_FIX)]

new['Products'] = [
    {'productID': p['productID'], 'productName': p['productName'], 'productOwner': owner(i)}
    for i, p in enumerate(old_flat['Products'])]

new['Product Class'] = [
    {'productClassID': c['productClassID'], 'voltageRate': c['voltageRate'],
     'powerRating': c['powerRating'], 'productClassName': f"Class {c['productClassID'][-2:]}",
     'productClassOwner': owner(i)}
    for i, c in enumerate(old_flat['Product Class'])]

new['Product Groups'] = [
    {'productGroupID': g['productGroupID'],
     'productGroupName': next((p['productName'] for p in new['Products']
                               if p['productID'] == (g.get('products') or g.get('productID'))), g['productGroupID']),
     'businessSegment': g['businessSegment'], 'productID': g.get('products') or g.get('productID'),
     'productGroupOwner': owner(i)}
    for i, g in enumerate(PG_ROWS)]

new['Product Scopes'] = [
    {'productScopeID': p['productScopeID'],
     'productScopeRegistry': f'PSR-{i + 1:04d}',
     'productGroupID': p['productGroupID'], 'scopeID': p['scopeID'],
     'productScopeName': f"{next((g['productGroupName'] for g in new['Product Groups'] if g['productGroupID'] == p['productGroupID']), '')} · {next((s['scopeName'] for s in new['Scopes'] if s['scopeID'] == p['scopeID']), '')}",
     'productClassID': pick([c['productClassID'] for c in new['Product Class']], i),
     'businessSegment': pick(['LPT', 'MPT', 'DT'], i), 'isActive': p['isActive'],
     'createdAt': p['createdAt'], 'productScopeOwner': owner(i)}
    for i, p in enumerate(PS_OLD)]

# --- Workload ---
PROJ_OLD = old_flat['Projects']
new['Projects'] = [
    {'projectID': p['projectID'], 'projectRegistryID': f'N{730700 + i * 3}',
     'projectName': p['projectName'], 'clientName': p['clientName'],
     'customerName': p['customerName'], 'projectOwner': p['projectOwner'],
     'projectStatus': p['projectStatus'], 'jobID': '',
     'estimatedTime': 120.0 + 20 * (i % 5), 'executionTime': 90.0 + 25 * (i % 6)}
    for i, p in enumerate(PROJ_OLD)]
PROJ_IDS = [p['projectID'] for p in new['Projects']]

TK_OLD = old_flat['Tickets']
new['Tickets'] = []
for i, t in enumerate(TK_OLD):
    desc = t.get('ticketDescription') or ''
    req = t.get('requestID') or ''
    new['Tickets'].append({
        'ticketID': t['ticketID'], 'projectID': t['projectID'],
        'customerName': t['customerName'], 'eventID': t['eventID'],
        'ticketDescription': f'[{req}] {desc}'.strip() if req else desc,
        'processID': pick(PROC_IDS, i), 'products': pick([p['productID'] for p in new['Products']], i),
        'scopes': pick(SCOPE_IDS, i), 'constraintName': pick([c['constraintName'] for c in new['Constraints']], i),
        'ticketExecutionTime': 8 + (i * 7) % 120, 'ticketOwner': t['ticketOwner'],
        'ticketStatus': t['ticketStatus'], 'targetDate': t.get('targetDate'),
        'ticketCreatedAt': t.get('ticketCreatedAt'), 'ticketClosedAt': t.get('ticketClosedAt')})
TICKET_IDS = [t['ticketID'] for t in new['Tickets']]

SQUADS = old_flat['Squads']
SQUAD_NAMES = [s['squadName'] for s in SQUADS]
JOBS_OLD = [j for j in old_flat['Jobs']
            if not str(j['jobID']).startswith(('J5', 'JC'))]
new['Jobs'] = []
for i, j in enumerate(JOBS_OLD):
    start = j.get('startDate') or rand_date(i)
    new['Jobs'].append({
        'jobID': j['jobID'], 'ticketID': j['ticketID'], 'jobName': j['jobName'],
        'userID': j['userID'], 'roleID': pick(ROLE_IDS, i), 'projectName': j.get('projectName') or '',
        'deliveryDate': j.get('deliveryDate') or j.get('endDate') or rand_date(i + 3), 'startDate': start,
        'plannedExecutionTime': 8.0 + (i * 5) % 60,
        'realStartDate': j.get('realStartDate'), 'realEndDate': j.get('realEndDate'),
        'realExecutionTime': j.get('realExecutionTime'),
        'customerName': pick(FACTORY_NAMES, i), 'squadName': pick(SQUAD_NAMES, i),
        'jobStatus': j['jobStatus'], 'jobOwner': owner(i)})
# coverage jobs: one Active/Queued job for ~3 of every 4 tickets (Tickets.jobs rollup)
for i, tk in enumerate(TICKET_IDS):
    if i % 4 == 3:
        continue
    new['Jobs'].append({
        'jobID': f'JC{i:03d}', 'ticketID': tk, 'jobName': f'Ticket work {tk}',
        'userID': owner(i), 'roleID': pick(ROLE_IDS, i),
        'projectName': pick([p['projectName'] for p in new['Projects']], i),
        'deliveryDate': rand_date(i + 9), 'startDate': rand_date(i + 30),
        'plannedExecutionTime': 8.0 + (i * 3) % 40, 'realStartDate': None,
        'realEndDate': None, 'realExecutionTime': None,
        'customerName': pick(FACTORY_NAMES, i), 'squadName': pick(SQUAD_NAMES, i),
        'jobStatus': 'Active' if i % 2 else 'Queued', 'jobOwner': owner(i)})

# extra jobs across the last 12 months so weekly-completion lines + trends have shape
jn = 500
for mi, m0 in enumerate(MONTHS):
    for k in range(3 + (mi % 3)):
        jn += 1
        sd = m0 + timedelta(days=2 + k * 6)
        ed = sd + timedelta(days=3 + (k % 4))
        planned = 12.0 + 6 * (k % 5)
        new['Jobs'].append({
            'jobID': f'J{jn}', 'ticketID': pick(TICKET_IDS, jn), 'jobName': f'Execution batch {jn}',
            'userID': owner(jn), 'roleID': pick(ROLE_IDS, jn), 'projectName': pick([p['projectName'] for p in new['Projects']], jn),
            'deliveryDate': iso(ed + timedelta(days=2)), 'startDate': iso(sd),
            'plannedExecutionTime': planned, 'realStartDate': iso(sd),
            'realEndDate': iso(ed), 'realExecutionTime': planned * (0.8 + 0.05 * (k % 8)),
            'customerName': pick(FACTORY_NAMES, jn), 'squadName': pick(SQUAD_NAMES, jn),
            'jobStatus': 'Done', 'jobOwner': owner(jn)})

# --- Control ---
new['Capacity'] = []
cp_n = 0
for mi, m0 in enumerate(MONTHS):
    m1 = (m0.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    for ri, role in enumerate(ROLES_OLD[:5]):
        cp_n += 1
        avail = 140.0 + 10 * (ri % 3)
        alloc = avail * (0.62 + 0.045 * ((mi + ri) % 8))
        new['Capacity'].append({
            'capacityID': f'CAP{cp_n:03d}', 'departmentID': f'DPT{(ri % 3) + 1:02d}',
            'roleID': role['roleID'], 'functionName': pick(FUNC_NAMES, ri),
            'periodType': 'Monthly', 'periodYear': m0.year, 'periodQuarter': (m0.month - 1) // 3 + 1,
            'periodMonth': m0.month, 'periodStart': iso(m0), 'periodFinish': iso(m1),
            'availableHours': avail, 'allocatedHours': round(alloc, 1),
            'utilization': round(alloc / avail, 3), 'factoryID': pick(FACTORY_IDS, mi + ri),
            'capacityOwner': owner(ri)})

new['Performance'] = []
pf_n = 0
for mi, m0 in enumerate(MONTHS):
    for si, squad in enumerate(SQUAD_NAMES):
        pf_n += 1
        planned = 160.0 + 12 * (si % 4)
        real = planned * (0.85 + 0.06 * ((mi + si) % 6))
        new['Performance'].append({
            'usageID': f'PRF{pf_n:03d}', 'regionID': f'RG{(si % 3) + 1:02d}',
            'departmentID': f'DPT{(si % 3) + 1:02d}', 'ticketID': pick(TICKET_IDS, pf_n),
            'functionName': pick(FUNC_NAMES, si), 'customerName': pick(FACTORY_NAMES, pf_n),
            'squadName': squad, 'periodType': 'Monthly', 'periodYear': m0.year,
            'periodMonth': m0.month, 'plannedHours': planned,
            'realExecutionTime': round(real, 1),
            'efficiency': round(planned / real, 3), 'variance': round(real - planned, 1),
            'reportedAt': iso(m0 + timedelta(days=27)), 'reportedBy': owner(pf_n),
            'performanceOwner': owner(si)})

# --- Talent ---
new['Squads'] = [{**s, 'squadOwner': owner(i)} for i, s in enumerate(SQUADS)]
new['Roles'] = [
    {'roleID': r['roleID'], 'roleName': r['roleName'], 'functionID': r['functionID'],
     'skillLevelID': r['skillLevelID'], 'graduationID': r['graduationID'],
     'quantity': r['quantity'], 'isActive': r['isActive'],
     'squadID': pick([s['squadID'] for s in SQUADS], i), 'roleOwner': owner(i)}
    for i, r in enumerate(ROLES_OLD)]
new['Skill Levels'] = [{**s, 'skillLevelOwner': owner(i)} for i, s in enumerate(old_flat['Skill Levels'])]
new['Functions'] = [
    {'functionID': f['functionID'], 'functionName': f['functionName'],
     'functionDescription': f"{f['functionName']} function", 'functionOwner': owner(i)}
    for i, f in enumerate(FUNCTIONS)]
new['Graduation'] = [
    {'graduationID': g['graduationID'], 'graduationTitle': g.get('graduationTitle') or g['graduationName'],
     'field': g['field'], 'institutionName': pick(['TU München', 'USP', 'TU Wien', 'Zhejiang U'], i),
     'graduationName': g['graduationName'], 'graduationOwner': owner(i)}
    for i, g in enumerate(old_flat['Graduation'])]
ONB_OLD = old_flat['Onboarding']
new['People'] = [
    {'userID': p['userID'], 'userName': p['userName'], 'userEmail': p['userEmail'],
     'location': pick(FACTORY_IDS, i), 'isActive': p['isActive'], 'hireDate': p['hireDate'],
     'functionID': p['functionID'], 'squadID': p.get('squadID') or pick([s['squadID'] for s in SQUADS], i),
     'onboardID': next((o['onboardID'] for o in ONB_OLD if o['userID'] == p['userID']), ''),
     'workingHours': 28 if i % 5 == 0 else 35,  # 7 h/day × 5 = 35 h/week (0.8 FTE = 28)
     'personOwner': owner(i + 1)}
    for i, p in enumerate(PEOPLE)]
new['Onboarding'] = [
    {'onboardID': o['onboardID'], 'userID': o['userID'],
     'functionID': pick([f['functionID'] for f in FUNCTIONS], i),
     'isCertified': o['isCertified'],
     'scopeName': pick([s['scopeName'] for s in new['Scopes']], i),
     'productName': pick([p['productName'] for p in new['Products']], i),
     'resources': pick(['e-learning', 'mentoring', 'workshop'], i),
     'constraintName': pick([cname(c) for c in new['Constraints']], i),
     'onboardingOwner': owner(i)}
    for i, o in enumerate(ONB_OLD)]
new['Competence'] = [
    {'competenceID': c['competenceID'],
     'functionID': pick([f['functionID'] for f in FUNCTIONS], i),
     'scopeID': c.get('scopeID') or pick(SCOPE_IDS, i),
     'roleID': c['roleID'], 'skillLevelID': c['skillLevelID'],
     'actionID': pick(ACTION_IDS, i), 'activityID': pick(ACT_IDS, i),
     'competenceName': f"Competence {c['competenceID']}",
     'resources': pick(['e-learning', 'mentoring', 'workshop', 'certification'], i),
     'competenceOwner': owner(i)}
    for i, c in enumerate(COMP_OLD)]

# ---------------- assemble by datamodel module grouping ----------------
out = {'_meta': {
    'generatedAt': iso(TODAY),
    'generator': 'prototype/tools/generate_mockup.py (seeded, deterministic)',
    'note': 'Dataset keyed 1:1 to canonical datamodel stored attributes (issue #23). '
            'IDs remain human-readable strings by design; Departments/Regions FKs are '
            'code values (no such tables in the 30-table model).'}}
for mname, m in DM['modules'].items():
    out[mname] = {}
    for tname in m['tables']:
        if tname not in new:
            raise SystemExit(f'no builder for {tname}')
        out[mname][tname] = new[tname]

json.dump(out, open(OUT_PATH, 'w'), indent=1, ensure_ascii=False)
open(OUT_PATH, 'a').write('\n')
print('written', OUT_PATH)
for mname, m in out.items():
    if mname == '_meta':
        continue
    print(' ', mname, {k: len(v) for k, v in m.items()})
