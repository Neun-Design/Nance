#!/usr/bin/env python3
"""migrate_requirements.py — one-off deterministic migration for the
Constraints → Requirements restructure (sourceFiles/developer/prototype_restructure.md).

Run from prototype/:  python3 tools/migrate_requirements.py

Idempotent: re-running after a successful pass is a no-op (guards on the
presence of the Requirements table / migrated keys).

What it does
  datamodel.json
    - token-renames constrain*/constraint* inside STRING VALUES only (the
      attribute metadata key "constraints" — the PK/FK marker — is untouched)
    - moves the entity Operation.Constraints → Portfolio.Requirements (order 6)
    - creates Portfolio."Requirement Type" (dashboard-order 0, hidden tab)
    - structural reworks: Requirements, Product Scopes, Tasks, Competence,
      Jobs, Forecast Scopes forms/attributes per the restructure doc
  mockup_data_prototype.json
    - module key Inventory → Portfolio; Constraints block → Portfolio.Requirements
    - Requirement Type records RT1–RT5 (from the old CT enum values)
    - Requirements gain multivalued scopeID[]/productGroupID[]
    - Competence gains eventID/processID/taskID/productGroupID/requirementID/levelRank
    - Tasks gain customerName (factory names, correlated with Tickets)
    - Jobs gain projectID/taskID/jobBufferExecution/stoppedAt + datetime upgrade
    - Workflows data key constraints → requirements; Onboarding key rename
"""
import json
import re
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DM_PATH = ROOT / 'data' / 'datamodel.json'
MOCK_PATH = ROOT / 'data' / 'mockup_data_prototype.json'

# token map — longest first so partial names never mangle longer ones
TOKENS = [
    ('constrainTypeName', 'requirementTypeName'),
    ('constrainTypeID', 'requirementTypeID'),
    ('constrainDescription', 'requirementDescription'),
    ('constraintTitle', 'requirementTitle'),
    ('constraintName', 'requirementName'),
    ('constraintOwner', 'requirementOwner'),
    ('constrainID', 'requirementID'),
    ('constrainName', 'requirementName'),   # datamodel typo variant
    ('Constraints', 'Requirements'),
    ('Constraint', 'Requirement'),
    ('constraints', 'requirements'),
    ('constraint', 'requirement'),
    ('constrains', 'requirements'),
    ('constrain', 'requirement'),
]
TOKEN_RES = [(re.compile(r'\b' + re.escape(a) + r'\b'), b) for a, b in TOKENS]


def rename_str(s):
    for rx, repl in TOKEN_RES:
        s = rx.sub(repl, s)
    return s


def rename_values(node):
    """Rename tokens in every string VALUE and in dict keys (form labels,
    filter field names, entity names) — EXCEPT the exact lowercase key
    'constraints', which is the attribute PK/FK metadata marker."""
    if isinstance(node, dict):
        out = {}
        for k, v in node.items():
            nk = k if k == 'constraints' else rename_str(k)
            out[nk] = rename_values(v)
        return out
    if isinstance(node, list):
        return [rename_values(x) for x in node]
    if isinstance(node, str):
        return rename_str(node)
    return node


def attr(name, typ, rule=None, notes=None, td=False, sd=False, constraints=None, **extra):
    a = {'name': name, 'type': typ, 'rule': rule, 'notes': notes,
         'table-display': td, 'subitem-display': sd, 'constraints': constraints}
    a.update(extra)
    return a


def form_field(ftype, attribute, tooltip=None, step=None, check=None, rule=None):
    return {'field-type': ftype, 'attribute': attribute, 'tooltip': tooltip,
            'step': step, 'check': check, 'field-rule': rule}


def find_attr(table, name):
    for a in table['attributes']:
        if a['name'] == name:
            return a
    return None


def drop_attr(table, name):
    table['attributes'] = [a for a in table['attributes'] if a['name'] != name]


# ---------------------------------------------------------------- datamodel
def migrate_datamodel():
    dm = json.load(open(DM_PATH))
    portfolio = dm['modules']['Portfolio']['tables']
    if 'Requirements' in portfolio:
        print('datamodel: already migrated — skipping')
        return json.load(open(DM_PATH))

    operation = dm['modules']['Operation']['tables']
    reqs = rename_values(operation.pop('Constraints'))
    dm = rename_values(dm)
    # rename_values rebuilt dicts — refetch handles
    portfolio = dm['modules']['Portfolio']['tables']
    dm['modules']['Operation']['tables'].pop('Requirements', None)

    # ---- Requirements (moved to Portfolio, order 6) ----
    reqs['dashboard-order'] = 6
    reqs['description'] = ('Requirements applicable to scopes and product groups — regulatory, '
                           'design and commercial obligations any engineering department can '
                           'register and reuse (ISO 9001:2015 §4.3, §8.2).')
    t = find_attr(reqs, 'requirementTypeID')
    t['type'] = 'INT'
    t['rule'] = 'FK → Requirement Type (display: requirementTypeName)'
    t['notes'] = 'Type registry lives in the hidden Requirement Type table (dashboard-order 0)'
    t['constraints'] = 'FK'
    find_attr(reqs, 'requirementTitle')['rule'] = \
        "computed: CONCAT(requirementName,'-',requirementTypeName)"
    idx = next(i for i, a in enumerate(reqs['attributes']) if a['name'] == 'requirementTypeID')
    reqs['attributes'][idx + 1:idx + 1] = [
        attr('scopeID', 'VARCHAR', 'FK → Scopes (display: scopeName)',
             'multivalued — scopes this requirement applies to', td=True, sd=True, constraints='FK'),
        attr('productGroupID', 'VARCHAR',
             "FK → Product Groups (display: CONCAT(productName,' | ',specsSummary))",
             'multivalued — product groups this requirement applies to', td=True, sd=True, constraints='FK'),
    ]
    f = reqs['form']['fields']
    f['Description']['check'] = None
    new_fields = {}
    for k, v in f.items():
        new_fields[k] = v
        if k == 'Type':
            new_fields['Scope'] = form_field({'select': 'shadcn-select'}, 'scopeID',
                                             tooltip='Scopes this requirement applies to',
                                             rule='Allow multiple values')
            new_fields['Product Group'] = form_field({'select': 'shadcn-select'}, 'productGroupID',
                                                     tooltip='Product groups this requirement applies to',
                                                     rule='Allow multiple values')
    reqs['form']['fields'] = new_fields
    portfolio['Requirements'] = reqs

    # ---- Requirement Type (new, hidden from the tab strip) ----
    portfolio['Requirement Type'] = {
        'visibility': 'show',
        'dashboard-order': 0,
        'description': 'Registry of requirement types selectable when creating a Requirement '
                       '(created inline via the "+" on the Type select).',
        'attributes': [
            attr('requirementTypeID', 'INT', notes='Auto-generated primary key', constraints='PK'),
            attr('requirementTypeName', 'VARCHAR', td=True, sd=True),
            attr('requirementTypeDescription', 'TEXT', td=True, sd=False),
            attr('requirementTypeOwner', 'email', 'FK → People (display: userName)',
                 'Accountability owner (ISO 9001:2015 §5.3, §6.2.2(c))', constraints='FK'),
        ],
        'reports': None,
        'form': {'steps': None, 'fields': {
            'Name': form_field({'input': 'shadcn-input'}, 'requirementTypeName'),
            'Description': form_field({'field': 'shadcn-textarea'}, 'requirementTypeDescription'),
        }},
        'cards': None,
        'table-filters': False,
    }

    # ---- Product Scopes: one compound-rollup requirement column ----
    ps = portfolio['Product Scopes']
    drop_attr(ps, 'requirementTitle')
    rn = find_attr(ps, 'requirementName')
    rn['name'] = 'requirementID'
    rn['type'] = 'rollup'
    rn['rule'] = 'rollup → Requirements (via: productGroupID + scopeID) (display: requirementName)'
    rn['notes'] = 'Requirements linked to this scope + product group pair'
    rn['display-name'] = 'REQUIREMENTS'
    rn['table-display'] = True
    rn['subitem-display'] = True
    ps['form']['fields'].pop('Requirements', None)

    # ---- Tasks ----
    tasks = dm['modules']['Operation']['tables']['Tasks']
    cn = find_attr(tasks, 'customerName')
    cn['type'] = 'VARCHAR'
    cn['rule'] = 'FK → Factories (via: factoryName) (display: factoryName)'
    cn['notes'] = 'Customer (factory) this task template serves; stores the factory name'
    cn['constraints'] = 'FK'
    cn['table-display'] = True
    cn['subitem-display'] = True
    rq = find_attr(tasks, 'requirementName')
    rq['type'] = 'computed'
    rq['rule'] = 'computed → Competence (via: taskID) (display: requirementName)'
    rq['notes'] = 'Requirements certified by the competences that reference this task'
    fn = find_attr(tasks, 'functionID')
    fn['rule'] = 'computed → Competence (via: taskID) (display: functionName)'
    fn['notes'] = 'multivalued — derived from the competences referencing this task'
    drop_attr(tasks, 'productScopeID')
    drop_attr(tasks, 'products')
    tf = tasks['form']['fields']
    for k in ('Requirements', 'Product Scope', 'Function'):
        tf.pop(k, None)
    new_tf = {}
    for k, v in tf.items():
        new_tf[k] = v
        if k == 'Action':
            new_tf['Customer'] = form_field({'select': 'shadcn-select'}, 'customerName',
                                            tooltip='Customer (factory) this task serves')
    tasks['form']['fields'] = new_tf

    # ---- Competence ----
    comp = dm['modules']['Talent']['tables']['Competence']
    sl = find_attr(comp, 'skillLevelID')
    sl['rule'] = 'FK → Skill Levels (display: levelName)'  # data stores levelName (guide §10 drift)
    sl['notes'] = 'Required proficiency'
    sl['constraints'] = 'FK'
    rl = find_attr(comp, 'roleID')
    rl['rule'] = 'FK → Roles (display: roleName)'
    rl['notes'] = 'Filtered by the selected function + skill level in the form'
    rl['constraints'] = 'FK'
    drop_attr(comp, 'productGroupName')
    pg = find_attr(comp, 'productGroupID')
    pg['type'] = 'INT'
    pg['rule'] = "FK → Product Groups (display: CONCAT(productName,' | ',specsSummary))"
    pg['notes'] = 'Product group this competence certifies'
    pg['constraints'] = 'FK'
    pg['table-display'] = True
    pg['subitem-display'] = True
    rq = find_attr(comp, 'requirementID')
    rq['type'] = 'VARCHAR'
    rq['rule'] = 'FK → Requirements (display: requirementName)'
    rq['notes'] = 'multivalued — requirements this competence certifies'
    rq['constraints'] = 'FK'
    tk = find_attr(comp, 'taskID')
    tk['type'] = 'INT'
    tk['rule'] = 'rollup → Tasks (via: eventID + processID) (display: taskName)'
    tk['notes'] = 'Task this competence certifies; options filtered by event + process'
    idx = next(i for i, a in enumerate(comp['attributes']) if a['name'] == 'eventID')
    comp['attributes'][idx + 1:idx + 1] = [
        attr('processID', 'VARCHAR', 'FK → Processes (display: processName)',
             'Process context for the certified task', sd=True, constraints='FK'),
    ]
    find_attr(comp, 'competenceName')['rule'] = (
        "computed: CONCAT([taskName],' for ',[scopeName],' of ',[productGroupName],"
        "' applied to ',[{requirementTypeName: requirementName}])")
    comp['form']['fields'] = {
        'Function': form_field({'select': 'shadcn-select'}, 'functionID'),
        'Skill Level': form_field({'select': 'shadcn-select'}, 'skillLevelID'),
        'Role': form_field({'select': 'shadcn-select'}, 'roleID',
                           check='Skill Level IS NOT NULL',
                           rule='filtered by Skill Level + Function selected'),
        'Scope': form_field({'select': 'shadcn-select'}, 'scopeID'),
        'Product Group': form_field({'select': 'shadcn-select'}, 'productGroupID'),
        'Requirements': form_field({'select': 'shadcn-select'}, 'requirementID',
                                   check='Scope && Product Group IS NOT NULL',
                                   rule=['Allow multiple values',
                                         'filtered by Scope + Product Group selected']),
        'Event': form_field({'select': 'shadcn-select'}, 'eventID'),
        'Process': form_field({'select': 'shadcn-select'}, 'processID',
                              check='Event IS NOT NULL', rule='filtered by Event selected'),
        'Task': form_field({'select': 'shadcn-select'}, 'taskID',
                           check='Process IS NOT NULL',
                           rule='filtered by Event + Process selected'),
        'Skill Rank': form_field({'select': 'shadcn-select'}, 'levelRank'),
    }

    # ---- Jobs ----
    jobs = dm['modules']['Workload']['tables']['Jobs']
    idx = next(i for i, a in enumerate(jobs['attributes']) if a['name'] == 'ticketID')
    jobs['attributes'][idx:idx] = [
        attr('projectID', 'INT', 'FK → Projects (display: projectName)',
             'Project the job belongs to (via its ticket)', constraints='FK'),
    ]
    find_attr(jobs, 'projectName')['rule'] = 'mirror: Projects via: projectID (display: projectName)'
    jt = find_attr(jobs, 'taskID')
    jt['type'] = 'INT'
    jt['rule'] = 'FK → Tasks (display: taskName)'
    jt['notes'] = 'Task template; options filtered by the ticket\'s process + customer'
    jt['constraints'] = 'FK'
    ret = find_attr(jobs, 'realExecutionTime')
    ret['rule'] = 'computed: (realEndDate − realStartDate) − jobBufferExecution (DECIMAL hours)'
    ret['notes'] = 'Stored when the job transitions to Done: elapsed minus Stoped buffer'
    idx = next(i for i, a in enumerate(jobs['attributes']) if a['name'] == 'realExecutionTime')
    jobs['attributes'][idx + 1:idx + 1] = [
        attr('jobBufferExecution', 'DECIMAL',
             'computed: accumulates elapsed time whenever jobStatus leaves Stoped',
             'Decimal hours the job sat in Stoped; subtracted from realExecutionTime',
             td=True),
        attr('stoppedAt', 'DATETIME', None,
             'Bookkeeping: timestamp of the last transition INTO Stoped'),
    ]
    jobs['form']['fields'] = {
        'Project': form_field({'select': 'shadcn-select'}, 'projectID',
                              rule='SelectLabel = clientName'),
        'Ticket': form_field({'combobox': 'shadcn-comboboxGroups'}, 'ticketID',
                             check='Project IS NOT NULL',
                             rule=['SelectLabel = customerName', 'filtered by Project selected']),
        'Task': form_field({'select': 'shadcn-select'}, 'taskID',
                           check='Ticket IS NOT NULL',
                           rule='filtered by Ticket.processID + customerName'),
        'Responsible': form_field({'certified-responsible': 'custom'}, 'userID',
                                  tooltip='Certified people for the ticket\'s scope, product '
                                          'group and requirements (narrowed by the task)',
                                  check='Ticket IS NOT NULL'),
        'Delivery Date': form_field({'datetime': 'shadcn-date picker'}, 'deliveryDate'),
        'Status': form_field({'select': 'shadcn-select'}, 'jobStatus'),
    }

    # ---- Forecast Scopes ----
    fs = dm['modules']['Customers']['tables']['Forecast Scopes']
    rn = find_attr(fs, 'requirementName')
    rn['rule'] = 'rollup → Requirements (via: scopeID + productGroupID) (display: requirementName)'
    rn['notes'] = 'Requirements linked to the row\'s scope + product group'
    fsf = fs['form']['fields'].get('Requirements')
    if fsf:
        fsf['field-rule'] = ['SelectLabel = requirementTypeName',
                            'filtered by Scope + Product Group selected']

    json.dump(dm, open(DM_PATH, 'w'), indent=2, ensure_ascii=False)
    with open(DM_PATH, 'a') as fh:
        fh.write('\n')
    print('datamodel: migrated')
    return dm


# ------------------------------------------------------------------ mockup
def migrate_mockup():
    d = json.load(open(MOCK_PATH))
    if 'Portfolio' in d and 'Requirements' in d.get('Portfolio', {}):
        print('mockup: already migrated — skipping')
        return

    # module key parity with the datamodel
    if 'Inventory' in d:
        d['Portfolio'] = d.pop('Inventory')
    inv = d['Portfolio']

    # ---- Requirements block moves + key renames ----
    cons = d['Operation'].pop('Constraints')
    reqs = []
    for r in cons:
        reqs.append({
            'requirementID': r['constrainID'],
            'requirementName': r['constraintName'],
            'requirementDescription': r.get('constrainDescription'),
            'requirementTypeID': 'RT' + str(r.get('constrainTypeID', 'CT0'))[-1],
            'scopeID': [],
            'productGroupID': [],
            'isActive': r.get('isActive', True),
            'regulatoryReference': r.get('regulatoryReference'),
            'requirementOwner': r.get('constraintOwner', 'U01'),
        })

    # scope/product-group assignments: every Product Scopes pair must roll up
    # at least one requirement (CN7/CN8 are broad catch-alls)
    all_scopes = [s['scopeID'] for s in inv['Scopes']]
    all_pgs = [g['productGroupID'] for g in inv['Product Groups']]
    ASSIGN = {
        'CN1': (['A.1', 'A.2', 'A.3', 'A.4'], ['PG01', 'PG02', 'PG03', 'PG04', 'PG05', 'PG06']),
        'CN2': (['A.2', 'A.3'], ['PG01', 'PG03', 'PG05']),
        'CN3': (['A.2', 'A.3', 'A.4'], ['PG02', 'PG03', 'PG06']),
        'CN4': (['A.1', 'B'], ['PG02', 'PG03']),
        'CN5': (['G'], ['PG04']),
        'CN6': (['A.1', 'A.2'], ['PG05']),
        'CN7': (all_scopes, all_pgs),
        'CN8': (all_scopes, all_pgs),
    }
    for r in reqs:
        sc, pg = ASSIGN.get(r['requirementID'], (all_scopes, all_pgs))
        r['scopeID'] = sc
        r['productGroupID'] = pg
    inv['Requirements'] = reqs

    # coverage assert: every Product Scopes (productGroupID, scopeID) pair matches
    for ps in inv['Product Scopes']:
        hits = [r for r in reqs
                if ps['scopeID'] in r['scopeID'] and ps['productGroupID'] in r['productGroupID']]
        assert hits, f"no requirement covers {ps['productScopeID']}"

    inv['Requirement Type'] = [
        {'requirementTypeID': f'RT{i}', 'requirementTypeName': n,
         'requirementTypeDescription': dsc, 'requirementTypeOwner': f'U0{i}'}
        for i, (n, dsc) in enumerate([
            ('Operational', 'Constraints arising from operating conditions and site limits'),
            ('Design', 'Engineering design rules and dimensional limits'),
            ('Testing', 'Test, inspection and acceptance criteria'),
            ('Technical', 'Normative technical standards (IEC, IEEE, ...)'),
            ('Commercial', 'Contractual and commercial obligations'),
        ], start=1)]

    # ---- Workflows data key ----
    for w in d['Operation']['Workflows']:
        if 'constraints' in w:
            w['requirements'] = w.pop('constraints')

    # ---- Onboarding key rename ----
    for ob in d['Talent']['Onboarding']:
        if 'constraintName' in ob:
            ob['requirementName'] = ob.pop('constraintName')

    # ---- Tickets / anything else storing constraintName ----
    for t in d['Workload']['Tickets']:
        if 'constraintName' in t:
            t['requirementName'] = t.pop('constraintName')

    # ---- Competence enrichment ----
    tasks = d['Operation']['Tasks']
    ps_rows = inv['Product Scopes']
    for c in d['Talent']['Competence']:
        task = next((t for t in tasks if t.get('competenceID') == c['competenceID']), None)
        if task:
            c.setdefault('eventID', task['eventID'])
            c['processID'] = task['processID']
            c['taskID'] = task['taskID']
        pair = next((p for p in ps_rows if p['scopeID'] == c.get('scopeID')), None)
        c['productGroupID'] = pair['productGroupID'] if pair else all_pgs[0]
        c['requirementID'] = [r['requirementID'] for r in reqs
                              if c.get('scopeID') in r['scopeID']
                              and c['productGroupID'] in r['productGroupID']][:2] \
            or [reqs[-1]['requirementID']]
        if 'levelRank' not in c and c.get('skillLevelID'):
            c['levelRank'] = int(str(c['skillLevelID'])[-1])

    # ---- Tasks: customerName correlated with the tickets of the same process ----
    tickets = d['Workload']['Tickets']
    by_process = {}
    for t in tickets:
        by_process.setdefault(t['processID'], []).append(t['customerName'])
    counters = {}
    factories = [f['factoryName'] for f in d['Customers']['Factories']]
    for i, t in enumerate(tasks):
        names = by_process.get(t.get('processID'))
        if names:
            k = t['processID']
            t['customerName'] = names[counters.get(k, 0) % len(names)]
            counters[k] = counters.get(k, 0) + 1
        else:
            t['customerName'] = factories[i % len(factories)]
        t.pop('products', None)

    # ---- Jobs enrichment + datetime upgrade ----
    tk_by_id = {t['ticketID']: t for t in tickets}
    task_by_name = {}
    for t in tasks:
        task_by_name.setdefault(t.get('taskName'), t['taskID'])
    done_count = 0
    for i, j in enumerate(d['Workload']['Jobs']):
        tkt = tk_by_id.get(j.get('ticketID'))
        if tkt:
            j['projectID'] = tkt['projectID']
        if j.get('jobName') in task_by_name:
            j['taskID'] = task_by_name[j['jobName']]
        elif tkt:
            match = next((t['taskID'] for t in tasks if t.get('processID') == tkt.get('processID')), None)
            if match:
                j['taskID'] = match
        j['stoppedAt'] = None
        buf = 0.0
        if j.get('jobStatus') == 'Done':
            done_count += 1
            if done_count % 5 == 0:
                buf = 1.5 + (done_count % 4) * 0.5
        j['jobBufferExecution'] = buf
        # date-only history → datetimes that illustrate (end − start) − buffer
        if j.get('realStartDate') and len(str(j['realStartDate'])) == 10 \
                and isinstance(j.get('realExecutionTime'), (int, float)):
            start = datetime.fromisoformat(str(j['realStartDate']) + 'T08:00:00')
            j['realStartDate'] = start.isoformat()
            if j.get('realEndDate'):
                end = start + timedelta(hours=float(j['realExecutionTime']) + buf)
                j['realEndDate'] = end.isoformat()

    d['_meta']['note2'] = ('2026-07-28 migrate_requirements.py: Constraints→Requirements '
                           'restructure — module key Inventory→Portfolio, Requirement Type '
                           'RT1–RT5, requirements bound to scope/product-group pairs, '
                           'Competence/Tasks/Jobs enriched for the new forms.')
    json.dump(d, open(MOCK_PATH, 'w'), indent=1, ensure_ascii=True)
    with open(MOCK_PATH, 'a') as fh:
        fh.write('\n')
    print('mockup: migrated')


if __name__ == '__main__':
    migrate_datamodel()
    migrate_mockup()
    # residue check (word-boundary, excluding the metadata key "constraints")
    dm_txt = open(DM_PATH).read()
    residue = [m for m in re.findall(r'"[^"\n]*\bconstr[a-z]*[^"\n]*"', dm_txt)
               if m != '"constraints"']
    print('datamodel residue:', residue[:5] if residue else 'none')
    mock_txt = open(MOCK_PATH).read()
    residue2 = re.findall(r'\bconstrain\w*', mock_txt)
    print('mockup residue:', sorted(set(residue2)) if residue2 else 'none')
