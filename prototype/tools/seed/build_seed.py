#!/usr/bin/env python3
"""build_seed.py — deterministic, catalogue-driven seed generator (F2).

    python3 tools/seed/build_seed.py [--domain clinic] [--strict-narrative]

Reads data/datamodel.json + domains/<domain>.yaml and builds the full demo
dataset in the §5.3 topological order. Design principles (plan §5.2):

  1. Catalogue-driven — graph.check_dataset() compares every produced row
     against the stored-attribute contract; ANY divergence raises SeedError.
  2. Deterministic — random.Random(meta.seed); no wall clock anywhere. Two
     runs produce byte-identical output (the F2 acceptance test).
  3. Domain is data — every name/description comes from the YAML.
  4. Anchored dates — everything is computed from meta.anchorDate and stamped
     into _meta.anchorDate (the loader-side shift lands with F3).
  5. Narrative before volume — narrative.assert_narrative() runs at the end
     of every build; --strict-narrative turns failures into a non-zero exit
     (F3 flips the validator to strict).

Layers 9–10 are DERIVED, not drawn: Jobs consume the procedures' hours and
Capacity/Performance come from tools/derive_control.py (§5.3 critical rule).

Output: tools/seed/out/mockup_clinic.json (F3 swaps it into data/).
"""
import argparse
import calendar
import json
import random
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import yaml

SEED_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SEED_DIR))
sys.path.insert(0, str(SEED_DIR.parent))            # tools/ → derive_control
import graph                                        # noqa: E402
import narrative                                    # noqa: E402
import derive_control                               # noqa: E402


# --------------------------------------------------------------------------
# small helpers
# --------------------------------------------------------------------------

def month_add(d, n):
    y, m = d.year + (d.month - 1 + n) // 12, (d.month - 1 + n) % 12 + 1
    return date(y, m, 1)


def month_end(d):
    return date(d.year, d.month, calendar.monthrange(d.year, d.month)[1])


def business_days(a, b):
    n, d = 0, a
    while d <= b:
        if d.weekday() < 5:
            n += 1
        d += timedelta(days=1)
    return n


MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
          'August', 'September', 'October', 'November', 'December']


def frame(d):
    return f'{d.year}-{MONTHS[d.month - 1]}'


class Builder:
    def __init__(self, dm, domain):
        self.dm = dm
        self.domain = domain
        self.meta = domain['meta']
        self.rng = random.Random(self.meta['seed'])
        self.anchor = date.fromisoformat(str(self.meta['anchorDate']))
        self.data = {}          # module -> table -> rows
        self.ix = {}            # name -> id lookups per table
        cat = graph.catalog(dm)
        self.module_of = {t: s['module'] for t, s in cat.items()}

    # ---- plumbing ----
    def put(self, table, rows):
        self.data.setdefault(self.module_of[table], {})[table] = rows
        return rows

    def rows(self, table):
        return self.data[self.module_of[table]][table]

    def index(self, table, name_field, pk):
        self.ix[table] = {r[name_field]: r[pk] for r in self.rows(table)}
        return self.ix[table]

    def id_of(self, table, name):
        return self.ix[table][name]

    def pick(self, seq):
        return seq[self.rng.randrange(len(seq))]

    # ---- layer 1: organization & geography ----
    def build_org(self):
        d = self.domain
        segs = [{'businessSegmentID': f'BS{i+1:02d}', 'businessSegmentName': s['name'],
                 'businessSegmentDescription': s['description'], 'businessSegmentCode': s['code'],
                 'businessSegmentOwner': None} for i, s in enumerate(d['businessSegments'])]
        self.put('Business Segments', segs)
        self.index('Business Segments', 'businessSegmentName', 'businessSegmentID')

        regions = [{'regionID': f'RG{i+1:02d}', 'regionName': r['name'],
                    'regionDescription': r['description'], 'countryName': r['country'],
                    'regionOwner': None} for i, r in enumerate(d['regions'])]
        self.put('Regions', regions)
        self.index('Regions', 'regionName', 'regionID')

        units = [{'businessUnitID': f'BU{i+1:02d}', 'businessUnitName': u['name'],
                  'businessSegmentID': self.id_of('Business Segments', u['segment']),
                  'regionID': [self.id_of('Regions', r) for r in u['regions']],
                  'businessUnitCode': ''.join(w[0] for w in u['name'].split()).upper(),
                  'qualityManager': None, 'operationalManager': None}
                 for i, u in enumerate(d['businessUnits'])]
        self.put('Business Units', units)
        self.index('Business Units', 'businessUnitName', 'businessUnitID')

        deps = [{'departmentID': f'DPT{i+1:02d}', 'departmentName': dep['name'],
                 'businessUnitID': self.id_of('Business Units', dep['unit']),
                 'departmentCode': f'D{i+1:02d}', 'departmentManager': None}
                for i, dep in enumerate(d['departments'])]
        self.put('Departments', deps)
        self.index('Departments', 'departmentName', 'departmentID')

        squads = [{'squadID': f'SQ{i+1:02d}', 'squadName': s['name'], 'squadType': s['sourcing'],
                   'departmentID': self.id_of('Departments', s['department']), 'squadOwner': None}
                  for i, s in enumerate(d['squads'])]
        self.put('Squads', squads)
        self.index('Squads', 'squadName', 'squadID')

        issues = [{'issueID': f'IS{i+1:02d}', 'issueName': it['title'],
                   'issueDescription': it['title'], 'issueType': it['type'],
                   'businessUnitID': self.id_of('Business Units', it['unit']), 'issueOwner': None}
                  for i, it in enumerate(d['issues'])]
        self.put('Issues', issues)

    # ---- layer 2: structural talent ----
    def build_talent(self):
        d = self.domain
        fams = [{'jobFamilyID': f'JF{i+1:02d}', 'jobFamilyName': f['name'],
                 'field': f['description'], 'jobFamilyOwner': None}
                for i, f in enumerate(d['jobFamilies'])]
        self.put('Job Family', fams)
        self.index('Job Family', 'jobFamilyName', 'jobFamilyID')

        unit_ids = [u['businessUnitID'] for u in self.rows('Business Units')]
        # issue #298: a function belongs to a Job Family — same domain-pack
        # map that seeds the roles, so migrated and regenerated copies agree
        fns = [{'functionID': f'F{i+1}', 'functionName': f['name'],
                'functionDescription': f"{f['name']} function of the clinical operation",
                'businessUnitID': unit_ids[i % len(unit_ids)],
                'jobFamilyID': self.id_of('Job Family', f['family']),
                'functionOwner': None}
               for i, f in enumerate(d['functions'])]
        self.put('Functions', fns)
        self.index('Functions', 'functionName', 'functionID')
        fam_of_fn = {f['name']: f['family'] for f in d['functions']}

        levels = [{'skillLevelID': f'SL{i+1}', 'levelName': s['name'],
                   'levelDescription': f"Rank {s['rank']} — {s['name']}", 'skillLevelOwner': None}
                  for i, s in enumerate(d['skillLevels'])]
        self.put('Skill Levels', levels)
        self.index('Skill Levels', 'levelName', 'skillLevelID')

        squad_ids = [s['squadID'] for s in self.rows('Squads')]
        roles = [{'roleID': f'R{i+1:02d}', 'roleName': r['name'],
                  'functionID': self.id_of('Functions', r['function']),
                  'skillLevelID': levels[(i % 2) + 1]['skillLevelID'],
                  'jobFamilyID': [self.id_of('Job Family', fam_of_fn[r['function']])],
                  'quantity': 2 + (i % 4), 'squadID': squad_ids[i % len(squad_ids)],
                  'roleOwner': None} for i, r in enumerate(d['roles'])]
        self.put('Roles', roles)
        self.index('Roles', 'roleName', 'roleID')

        # people: functions distributed with radiologists deliberately scarce
        # (story 1 needs allocated > available on the tail months)
        p = d['people']
        firsts, lasts = p['namePools']['first'], p['namePools']['last']
        fn_cycle = ['Radiologist', 'Radiology Technician', 'Radiology Technician',
                    'Lab Analyst', 'Lab Analyst', 'Nurse', 'Nurse', 'Front Desk',
                    'Quality Analyst', 'Radiology Technician', 'Lab Analyst', 'Nurse']
        branches = self.domain['branches']
        people = []
        for i in range(p['count']):
            fn_name = fn_cycle[i % len(fn_cycle)]
            fid = self.id_of('Functions', fn_name)
            br = branches[i % len(branches)]
            dep = self.rows('Departments')[i % len(self.rows('Departments'))]
            people.append({
                'userID': f'U{i+1:02d}',
                'userName': f'{firsts[i % len(firsts)]} {lasts[(i * 3) % len(lasts)]}',
                'businessUnitID': dep['businessUnitID'],
                'departmentID': dep['departmentID'],
                'userEmail': f'user{i+1:02d}@example.com',
                'regionID': self.id_of('Regions', br['region']),
                'countryName': br['country'],
                'cityName': br['city'],
                'isActive': 'Active',
                'hireDate': (self.anchor - timedelta(days=180 + i * 37)).isoformat(),
                'functionID': fid,
                'squadID': squad_ids[i % len(squad_ids)],
                'branchID': f'BR{(i % len(branches)) + 1:02d}',
                'onboardID': None,
                'workingHours': p['weeklyHours'][i % len(p['weeklyHours'])],
                'personOwner': None,
            })
        self.put('People', people)

    # ---- customers + branches (customers own branches) ----
    def build_customers_branches(self):
        d = self.domain
        # customerType is Internal | External since the 2026-09-03 round (sv68)
        # — the supplier companies are external firms; the "suppliers" group
        # keeps its own role via self.supplier_ids (SLA rotation exclusion)
        cust_specs = ([(n, 'External') for n in d['customers']['insurers']]
                      + [(n, 'External') for n in d['customers']['partnerHospitals']]
                      + [(n, 'Internal') for n in d['customers']['internal']]
                      + [(n, 'External') for n in d['customers'].get('suppliers', [])])
        seg_ids = [s['businessSegmentID'] for s in self.rows('Business Segments')]
        unit_rows = self.rows('Business Units')
        customers = []
        for i, (name, ctype) in enumerate(cust_specs):
            units = [unit_rows[i % len(unit_rows)]['businessUnitID']]
            if i % 3 == 0:
                units.append(unit_rows[(i + 1) % len(unit_rows)]['businessUnitID'])
            segs = sorted({u['businessSegmentID'] for u in unit_rows
                           if u['businessUnitID'] in units})
            customers.append({'customerID': f'CUST{i+1:02d}', 'customerName': name,
                              'businessSegmentID': segs or [seg_ids[0]],
                              'businessUnitID': units, 'customerType': ctype,
                              'isActive': 'Active', 'customerOwner': None})
        self.put('Customers', customers)
        self.index('Customers', 'customerName', 'customerID')
        # the dedicated Supplier customerType left the enum (sv68) — the
        # supplying companies are tracked by id for _sla_supplier and the
        # rotation exclusion in build_crm
        self.supplier_ids = sorted(self.id_of('Customers', n)
                                   for n in d['customers'].get('suppliers', []))

        # branches belong to hospitals and internal customers, never insurers
        owners = d['customers']['partnerHospitals'] + d['customers']['internal']
        deps = self.rows('Departments')
        branches = []
        for i, b in enumerate(d['branches']):
            unit = unit_rows[i % len(unit_rows)]
            branches.append({'branchID': f'BR{i+1:02d}', 'branchName': b['name'],
                             'businessSegmentID': unit['businessSegmentID'],
                             'businessUnitID': unit['businessUnitID'],
                             'departmentID': deps[i % len(deps)]['departmentID'],
                             'customerID': self.id_of('Customers', owners[i % len(owners)]),
                             'cityName': b['city'],
                             'regionID': self.id_of('Regions', b['region']),
                             'countryName': b['country'], 'userID': None})
        self.put('Branches', branches)

    # ---- layer 3: portfolio ----
    def build_portfolio(self):
        d = self.domain
        unit_by_name = self.ix['Business Units']
        img = [unit_by_name['Imaging São Paulo'], unit_by_name['Imaging South Cone']]
        lab = [unit_by_name['Laboratory Network']]
        out = [unit_by_name['Outpatient & Homecare']]
        unit_of_product = {
            'CT Scan': img, 'MRI': img, 'X-Ray': img, 'Ultrasound': img,
            'Mammography': img, 'Bone Densitometry': img,
            'Complete Blood Count': lab, 'Lipid Panel': lab,
            'Molecular PCR Panel': lab, 'Urinalysis': lab,
            'Resting ECG': out, 'Echocardiogram': out,
        }
        products = [{'productID': f'PRD{i+1:02d}', 'productName': p['name'],
                     'productOwner': None, 'businessUnitID': unit_of_product[p['name']]}
                    for i, p in enumerate(d['products'])]
        self.put('Products', products)
        self.index('Products', 'productName', 'productID')

        specs = []
        for i, s in enumerate(d['productSpecs']):
            pids = [self.id_of('Products', p) for p in s['appliesTo']]
            specs.append({'productSpecID': f'SPEC{i+1:02d}', 'specName': s['name'],
                          'specInputType': s['inputType'], 'specDescription': s['description'],
                          'productID': pids,
                          'businessUnitID': unit_of_product[s['appliesTo'][0]][0],
                          'specOptions': '; '.join(s.get('options', [])),
                          'productSpecOwner': None})
        self.put('Product Specs', specs)
        self.index('Product Specs', 'specName', 'productSpecID')

        groups = []
        for i, g in enumerate(d['productGroups']):
            spec_values = {self.id_of('Product Specs', k): v for k, v in g['specs'].items()}
            groups.append({'productGroupID': f'PG{i+1:02d}', 'classCodeName': g['name'],
                           'businessUnitID': unit_of_product[g['product']][0],
                           'productID': [self.id_of('Products', g['product'])],
                           'specValues': spec_values, 'productGroupOwner': None})
        self.put('Product Groups', groups)
        self.index('Product Groups', 'classCodeName', 'productGroupID')

        classes = [{'scopeClassID': f'CLS{i+1:02d}', 'scopeClassName': c['name'],
                    'scopeClassDefinition': c['description']}
                   for i, c in enumerate(d['classes'])]
        self.put('Classes', classes)
        self.index('Classes', 'scopeClassName', 'scopeClassID')

        class_of_scope = {'Routine': 'Assistential', 'Urgent': 'Assistential',
                          'Second Opinion': 'Commercial', '24h Report': 'Commercial',
                          'Reprocessing': 'Improvement', 'Home Collection': 'Assistential',
                          'Screening Campaign': 'Preventive', 'Audit Support': 'Regulatory'}
        opp_issues = [r for r in self.rows('Issues') if r['issueType'] == 'Opportunity']
        scopes = []
        for i, s in enumerate(d['scopes']):
            scopes.append({'scopeID': f'SC{i+1:02d}', 'scopeCodeID': f'S-{i+1:02d}',
                           'scopeName': s['name'], 'scopeDescription': s['description'],
                           'scopeOpportunity': opp_issues[i % len(opp_issues)]['issueID'] if i % 3 == 0 else None,
                           'scopeClassID': self.id_of('Classes', class_of_scope[s['name']]),
                           'scopeOwner': None,
                           'businessUnitID': self.rows('Business Units')[i % 4]['businessUnitID']})
        self.put('Scopes', scopes)
        self.index('Scopes', 'scopeName', 'scopeID')

        # Classes.businessUnitID (issue #204) — union of the units of the
        # scopes carrying each class, first-seen order (the migration rule in
        # tools/migrate_class_units.py: regenerated and migrated copies agree)
        units_of_class = {}
        for s in scopes:
            bucket = units_of_class.setdefault(s['scopeClassID'], [])
            if s['businessUnitID'] not in bucket:
                bucket.append(s['businessUnitID'])
        for c in classes:
            c['businessUnitID'] = units_of_class.get(c['scopeClassID'], [])

        prod_of_group = {g['name']: g['product'] for g in d['productGroups']}
        pss = []
        for i, (gname, sname) in enumerate(d['productScopes']['pairs']):
            gid = self.id_of('Product Groups', gname)
            unit = unit_of_product[prod_of_group[gname]][0]
            seg = next(u for u in self.rows('Business Units') if u['businessUnitID'] == unit)
            seg_name = next(s['businessSegmentName'] for s in self.rows('Business Segments')
                            if s['businessSegmentID'] == seg['businessSegmentID'])
            pss.append({'productScopeID': f'PS{i+1:02d}', 'productScopeRegistry': f'PSR-{i+1:03d}',
                        'businessUnitID': unit, 'productGroupID': gid,
                        'scopeID': self.id_of('Scopes', sname),
                        'productScopeName': f'{gname} × {sname}',
                        'businessSegment': seg_name, 'isActive': 'Active',
                        'createdAt': (self.anchor - timedelta(days=400 + i)).isoformat(),
                        'productScopeOwner': None})
        self.put('Product Scopes', pss)
        self.index('Product Scopes', 'productScopeName', 'productScopeID')

        # events: applicability = the scopes/products their payloads will package
        events = []
        for i, e in enumerate(d['events']):
            events.append({'eventID': f'EV{i+1:02d}', 'eventTitle': e['title'],
                           'eventDescription': e['description'],
                           'businessUnitID': self.rows('Business Units')[i % 4]['businessUnitID'],
                           'scopeID': [], 'productID': [],
                           'eventCreatedAt': (self.anchor - timedelta(days=500 - i * 3)).isoformat(),
                           'customerName': None, 'productName': None, 'scopeName': None,
                           'eventOwner': None})
        self.put('Events', events)
        self.index('Events', 'eventTitle', 'eventID')

    # ---- layer 4: requirements ----
    def build_requirements(self):
        d = self.domain
        rts = [{'requirementTypeID': f'RT{i+1:02d}', 'requirementTypeName': t['name'],
                'requirementTypeDescription': t['description'], 'requirementTypeOwner': None}
               for i, t in enumerate(d['requirementTypes'])]
        self.put('Requirement Type', rts)
        self.index('Requirement Type', 'requirementTypeName', 'requirementTypeID')

        prod_groups = self.rows('Product Groups')
        reqs = []
        for i, r in enumerate(d['requirements']):
            pg_ids = []
            for pname in r.get('products', []):
                pid = self.id_of('Products', pname)
                pg_ids += [g['productGroupID'] for g in prod_groups if pid in g['productID']]
            reqs.append({'requirementID': f'RQ{i+1:02d}', 'requirementName': r['name'],
                         'requirementDescription': r['description'],
                         'regionID': [self.id_of('Regions', x) for x in r.get('regions', [])],
                         'businessUnitID': [],
                         'requirementTypeID': self.id_of('Requirement Type', r['type']),
                         'branchID': None,
                         'customerID': self.id_of('Customers', r['customers'][0]) if r.get('customers') else None,
                         'scopeID': [self.id_of('Scopes', x) for x in r.get('scopes', [])],
                         'productGroupID': sorted(set(pg_ids)),
                         # issue #294: direct product-scope targeting — honest
                         # empty (no demo requirement names specific product
                         # scopes); mirrors migrate_requirement_product_scopes.py
                         'productScopeID': [],
                         'isActive': 'Active',
                         'regulatoryReference': r.get('reference', ''),
                         'regulatoryURL': None})
        self.put('Requirements', reqs)
        self.index('Requirements', 'requirementName', 'requirementID')

    # ---- layer 5: process chain ----
    def build_process(self):
        d = self.domain
        channels = [{'channelID': f'CH{i+1:02d}', 'channelName': c['name'],
                     'channelOwner': None, 'channelStatus': 'Active'}
                    for i, c in enumerate(d['channels'])]
        self.put('Channels', channels)

        # customerFlag (issue #280): the documents the CUSTOMER provides upon
        # ticket creation, listed by name in the domain's `customer_inputs`
        # (mirrored by tools/migrate_ticket_input_flag.py)
        customer_inputs = set(d.get('customer_inputs', []))
        handouts = [{'handoutID': f'H{i+1:02d}', 'handoutName': h,
                     'handoutDescription': f'{h} — controlled document',
                     'createdAt': (self.anchor - timedelta(days=600 + i)).isoformat(),
                     'channelID': channels[i % len(channels)]['channelID'],
                     'customerFlag': h in customer_inputs,
                     'templateName': f'{h} v1', 'templateURL': None}
                    for i, h in enumerate(d['handouts'])]
        self.put('Handouts', handouts)

        actions = [{'actionID': f'AC{i+1:02d}', 'actionName': a,
                    'actionDescription': f'{a} quality intervention',
                    'activityID': None, 'workflowID': None, 'actionOwner': None}
                   for i, a in enumerate(d['actions'])]
        self.put('Actions', actions)
        self.index('Actions', 'actionName', 'actionID')

        # activities are unique per name across processes (shared catalog)
        act_names, seen = [], set()
        for p in d['processes']:
            for a in p['activities']:
                if a not in seen:
                    seen.add(a)
                    act_names.append(a)
        activities = [{'activityID': f'A{i+1:02d}', 'activityName': a,
                       'activityDescription': f'{a} activity', 'activityOwner': None}
                      for i, a in enumerate(act_names)]
        self.put('Activities', activities)
        self.index('Activities', 'activityName', 'activityID')

        # trigger events per process (first six operational triggers)
        trigger_of = {'Imaging Exam Flow': 'Medical Order Received',
                      'Laboratory Sample Flow': 'Sample Batch Arrived',
                      'Urgent Care Lane': 'Urgent Case Flagged',
                      'Second Opinion Flow': 'Second Opinion Requested',
                      'Quality Audit Flow': 'Accreditation Audit Scheduled',
                      'Home Collection Flow': 'Home Collection Requested'}
        deps = self.rows('Departments')
        squads = self.rows('Squads')
        processes, workflows, wf_n = [], [], 0
        for i, p in enumerate(d['processes']):
            pid = f'PR{i+1}'
            processes.append({'processID': pid, 'processSystemID': f'SYS-{i+1:02d}',
                              'processName': p['name'],
                              'eventID': self.id_of('Events', trigger_of[p['name']]),
                              'processOwner': None, 'processDescription': p['description'],
                              'parentProcessID': None,
                              'departmentID': deps[i % len(deps)]['departmentID'],
                              'productScopeID': [], 'squadID': squads[i % len(squads)]['squadID'],
                              'processStatus': 'Active', 'processVersion': '1.0',
                              'productName': None, 'scopeName': None})
            prev = None
            for j, aname in enumerate(p['activities']):
                wf_n += 1
                workflows.append({'workflowID': f'WF{wf_n:02d}', 'workflowName': aname,
                                  'processID': pid,
                                  'activityID': self.id_of('Activities', aname),
                                  'parentStepID': prev,
                                  'indentationRule': 'finish-to-start' if prev else None,
                                  'inputs': [self.rows('Handouts')[(wf_n - 1) % 14]['handoutID']],
                                  'outputs': [self.rows('Handouts')[wf_n % 14]['handoutID']]})
                prev = workflows[-1]['workflowID']
        self.put('Processes', processes)
        self.index('Processes', 'processName', 'processID')
        self.put('Workflows', workflows)

        # what each trigger event PACKAGES (used by procedures' served pairs,
        # event applicability and the payloads below)
        img_pairs = [p for p in self.rows('Product Scopes')
                     if p['businessSegment'] == 'Diagnostic Imaging']
        lab_pairs = [p for p in self.rows('Product Scopes')
                     if p['businessSegment'] == 'Clinical Analysis']
        out_pairs = [p for p in self.rows('Product Scopes')
                     if p['businessSegment'] == 'Outpatient Care']
        pack_of = {'Medical Order Received': [p for p in img_pairs if 'Urgent' not in p['productScopeName']],
                   'Urgent Case Flagged': [p for p in img_pairs if 'Urgent' in p['productScopeName']],
                   'Second Opinion Requested': [p for p in img_pairs if 'Second Opinion' in p['productScopeName']],
                   'Sample Batch Arrived': lab_pairs,
                   'Home Collection Requested': [p for p in lab_pairs + out_pairs
                                                 if 'Home Collection' in p['productScopeName']] or out_pairs,
                   'Accreditation Audit Scheduled': [p for p in img_pairs if 'Audit' in p['productScopeName']]}

        # tasks: activity × action pairs that make clinical sense; the Check
        # action recurs across processes (story 5)
        action_mix = ['Execution', 'Check', 'Approval', 'Registration', 'Assignment',
                      'Release', 'Followup', 'Escalation']
        fn_of_process = {'Imaging Exam Flow': 'Radiology Technician',
                         'Laboratory Sample Flow': 'Lab Analyst',
                         'Urgent Care Lane': 'Radiologist',
                         'Second Opinion Flow': 'Radiologist',
                         'Quality Audit Flow': 'Quality Analyst',
                         'Home Collection Flow': 'Nurse'}
        # scheduling/routing is front-desk work — without this, the Front
        # Desk function gets no demand lines and Capacity charts a zero bar
        fn_of_activity = {'Schedule Exam': 'Front Desk', 'Plan Route': 'Front Desk',
                          'Triage Order': 'Front Desk'}
        report_fn = {'Elaborate Report', 'Re-read Study', 'Validate Results'}
        tasks, t_n = [], 0
        for p in d['processes']:
            pid = self.id_of('Processes', p['name'])
            ev = next(r['eventID'] for r in processes if r['processID'] == pid)
            # predecessor chain per process in insertion order (issue #302) —
            # the demo workflows chain sequentially (finish-to-start), so
            # insertion order IS step order and this agrees with
            # migrate_task_indentation.py's (step outline, index) sort
            prev_task = None
            for j, aname in enumerate(p['activities']):
                # action diversity: Execution everywhere, a rotating second
                # action per activity — several actions recur across ≥2
                # processes (the Tasks recurrence card needs ≥3, story 5
                # pins Check on the report activities)
                acts = ['Execution', action_mix[1 + j % (len(action_mix) - 1)]]
                if aname in report_fn:
                    acts = ['Execution', 'Check']
                for act in acts:
                    t_n += 1
                    wf = next(w['workflowID'] for w in workflows
                              if w['processID'] == pid
                              and w['activityID'] == self.id_of('Activities', aname))
                    fn = ('Radiologist' if aname in report_fn
                          else fn_of_activity.get(aname, fn_of_process[p['name']]))
                    tasks.append({'taskID': f'T{t_n:03d}', 'eventID': ev, 'processID': pid,
                                  'workflowID': wf,
                                  'actionID': self.id_of('Actions', act),
                                  'predecessorTask': prev_task,
                                  'functionID': self.id_of('Functions', fn),
                                  'competenceID': None,
                                  'roles': [r['roleID'] for r in self.rows('Roles')
                                            if r['functionID'] == self.id_of('Functions', fn)][:2],
                                  'taskName': f'{aname}-{act}',
                                  'taskOwner': None})
                    prev_task = f'T{t_n:03d}'
        self.put('Tasks', tasks)

        # procedures: ≥1 per task; requirement sets bind here; times drive ALL math
        time_of_fn = {'Radiologist': 1.0, 'Radiology Technician': 0.75, 'Lab Analyst': 0.5,
                      'Nurse': 0.75, 'Front Desk': 0.25, 'Quality Analyst': 1.5}
        req_ix = self.ix['Requirements']
        fn_names = {f['functionID']: f['functionName'] for f in self.rows('Functions')}
        procedures = []
        for i, t in enumerate(tasks):
            reqs = []
            if 'Report' in t['taskName'] and 'Check' in t['taskName']:
                reqs = [req_ix['Report Double Signature']]
            elif t['processID'] == self.id_of('Processes', 'Laboratory Sample Flow'):
                reqs = [req_ix['ISO 15189 Lab Accreditation']]
            elif t['processID'] == self.id_of('Processes', 'Imaging Exam Flow') and i % 2 == 0:
                reqs = [req_ix['Contrast Administration Protocol']]
            base = time_of_fn[fn_names[t['functionID']]]
            # the SOP names the pair(s) it serves — the process's packaged
            # pairs (F5: the Product-scopes subitem tab must not be empty)
            ev_title = next(e['eventTitle'] for e in self.rows('Events')
                            if e['eventID'] == t['eventID'])
            served = [p['productScopeID'] for p in pack_of.get(ev_title, [])][:2]
            procedures.append({'procedureID': f'PRC{i+1:02d}',
                               'procedureRegistry': f'SOP-{i+1:03d}',
                               'processID': t['processID'], 'taskID': t['taskID'],
                               'procedureURL': None,
                               'businessUnitID': self.rows('Business Units')[0]['businessUnitID'],
                               'productScopeID': served, 'requirementID': reqs,
                               'taskInput': [self.rows('Handouts')[i % 14]['handoutID']],
                               'taskOutput': [self.rows('Handouts')[(i + 1) % 14]['handoutID']],
                               'executionTime': base + 0.25 * (i % 3),
                               'procedureOwner': None,
                               # demo SOPs are in use (they staff competences
                               # and drive times) — Approved is the honest
                               # status; variants copy it (issue #302 round)
                               'procedureStatus': 'Approved'})
        # variant SOPs (issue #284 follow-up) — same deterministic rule as
        # migrate_demo_procedure_groups.py, so regenerated and migrated
        # datasets agree: a variant copies its base SOP (same task — the
        # group stays task-scoped) with its own id/registry/requirement set.
        # PRC47/PRC49 are GENERAL (wildcard) variants of specific SOPs (their
        # tickets resolve again under the #270 ⊇ coverage); PRC48 is a
        # contrast-specific variant of a wildcard SOP (standalone ambiguity,
        # tickets untouched). Appended LAST — the competence build slices
        # procedures[:count] and story anchors index the base sequence.
        proc_by_id = {p['procedureID']: p for p in procedures}
        for vid, suffix, base_id, req_names in [
                ('PRC47', '-G', 'PRC01', []),
                ('PRC48', '-C', 'PRC02', ['Contrast Administration Protocol']),
                ('PRC49', '-G', 'PRC11', [])]:
            variant = dict(proc_by_id[base_id])
            variant['procedureID'] = vid
            variant['procedureRegistry'] = f"{proc_by_id[base_id]['procedureRegistry']}{suffix}"
            variant['requirementID'] = [req_ix[n] for n in req_names]
            procedures.append(variant)
        self.put('Procedures', procedures)

        # event applicability = the scopes/products its process's tasks serve
        groups_by_id = {g['productGroupID']: g for g in self.rows('Product Groups')}
        for ev in self.rows('Events'):
            pairs = pack_of.get(ev['eventTitle'], [])
            ev['scopeID'] = sorted({p['scopeID'] for p in pairs})
            ev['productID'] = sorted({pid for p in pairs
                                      for pid in groups_by_id[p['productGroupID']]['productID']})
        # supplying department of a payload (sv68): first non-empty department
        # among the processes chaining its event, in row order — same rule as
        # tools/migrate_sla_supplier_flow.py; honest null when no process
        dept_of_event = {}
        for pr in self.rows('Processes'):
            evs = pr.get('eventID')
            for ev in (evs if isinstance(evs, list) else [evs]):
                if ev and ev not in dept_of_event and pr.get('departmentID'):
                    dept_of_event[ev] = pr['departmentID']
        payloads, n = [], 0
        for title, pairs in pack_of.items():
            for chunk_start in range(0, len(pairs), 4):
                n += 1
                chunk = pairs[chunk_start:chunk_start + 4]
                payloads.append({'payloadID': f'PLD{n:02d}', 'payloadCode': f'PKG-{n:03d}',
                                 'businessUnitID': chunk[0]['businessUnitID'] if chunk else
                                 self.rows('Business Units')[0]['businessUnitID'],
                                 'departmentID': dept_of_event.get(self.id_of('Events', title)),
                                 'eventID': self.id_of('Events', title),
                                 'productScopeID': [p['productScopeID'] for p in chunk],
                                 'isActive': 'Active', 'payloadOwner': None})
        # administrative wildcard payloads (Q1) up to the target count
        admin_events = ['Protocol Update Published', 'Regulatory Change Notified',
                        'Complaint Registered', 'Equipment Calibration Due']
        while n < 26 - len(admin_events):
            n += 1
            src = payloads[n % max(1, len(payloads) - 1)]
            payloads.append({**src, 'payloadID': f'PLD{n:02d}', 'payloadCode': f'PKG-{n:03d}'})
        for title in admin_events:
            n += 1
            payloads.append({'payloadID': f'PLD{n:02d}', 'payloadCode': f'PKG-{n:03d}',
                             'businessUnitID': self.rows('Business Units')[0]['businessUnitID'],
                             'departmentID': dept_of_event.get(self.id_of('Events', title)),
                             'eventID': self.id_of('Events', title), 'productScopeID': [],
                             'isActive': 'Active', 'payloadOwner': None})
        self.put('Payload', payloads)

    # ---- layer 6: CRM ----
    # Supplying party of an SLA (issue #272) — shared deterministic rule,
    # mirrored by tools/migrate_sla_supplier.py: an Internal customer is
    # supplied by another Internal of the SLA's unit; everyone else by the
    # unit's supplier-group company (self.supplier_ids — the dedicated
    # Supplier customerType left the enum in sv68; fallbacks keep it total).
    def _sla_supplier(self, cust_id, unit):
        customers = self.rows('Customers')
        by_type = lambda t: sorted((c for c in customers if c['customerType'] == t),
                                   key=lambda c: c['customerID'])
        cust = next((c for c in customers if c['customerID'] == cust_id), None)
        sup_ids = set(getattr(self, 'supplier_ids', []))
        internals = by_type('Internal')
        sups = sorted((c for c in customers if c['customerID'] in sup_ids),
                      key=lambda c: c['customerID'])
        if cust and cust['customerType'] == 'Internal':
            for c in internals:
                if c['customerID'] != cust_id and unit in c['businessUnitID']:
                    return c['customerID']
        for pool in (
            [c for c in sups if unit in c['businessUnitID']],
            sups,
            [c for c in internals if unit in c['businessUnitID']],
            [c for c in sorted(customers, key=lambda c: c['customerID'])
             if c['customerID'] != cust_id],
        ):
            if pool:
                return pool[0]['customerID']
        return None

    def build_crm(self):
        d = self.domain
        payloads = self.rows('Payload')
        deps_by_unit = {}
        for dep in self.rows('Departments'):
            deps_by_unit.setdefault(dep['businessUnitID'], []).append(dep)
        # suppliers are the supplying side of contracts, never the contracting
        # customer — keeping them out of the rotation preserves the pre-#272
        # customer sequence (story anchors below index into it); keyed by id
        # since the Supplier customerType left the enum (sv68)
        sup_ids = set(getattr(self, 'supplier_ids', []))
        cust_rows = [c for c in self.rows('Customers') if c['customerID'] not in sup_ids]
        payload_dept = {p['payloadID']: p.get('departmentID') for p in payloads}

        def majority_dept(pids):
            # majority supplying department of the purchased payloads,
            # first-seen tiebreak — same rule as migrate_sla_supplier_flow.py
            counts, order = {}, []
            for pid in pids:
                dept = payload_dept.get(pid)
                if not dept:
                    continue
                if dept not in counts:
                    order.append(dept)
                counts[dept] = counts.get(dept, 0) + 1
            return max(order, key=lambda v: counts[v], default=None)
        slas = []
        for i in range(d['slas']['count']):
            cust = cust_rows[i % len(cust_rows)]
            unit = cust['businessUnitID'][0]
            dep = deps_by_unit.get(unit, self.rows('Departments'))[0]
            pl = [p['payloadID'] for p in payloads if p['businessUnitID'] == unit] \
                or [payloads[i % len(payloads)]['payloadID']]
            # the SLA's department is the SUPPLYING department (sv68) — the
            # majority department of its payloads keeps the Payloads picker
            # (filtered by department) offering the seeded set on edit
            slas.append({'slaID': f'SLA{i+1:02d}', 'slaCode': f'VHN-2026-{i+1:03d}',
                         'businessUnitID': unit, 'customerID': cust['customerID'],
                         'branchID': None,
                         'departmentID': majority_dept(pl) or dep['departmentID'],
                         'payloadID': pl, 'isActive': 'Active', 'slaOwner': None})
        # story anchors: SLA01 = HealthFirst (story 4); the Screening Program's
        # SLA gets the story-6 code (its 2 projects give the ticket mass the
        # 78% burn needs — see the F2 correction note in clinic.yaml)
        hf = self.id_of('Customers', d['narrative']['story4_forecast_gap']['customer'])
        slas[0]['customerID'] = hf
        screening = self.id_of('Customers', 'Vitalis Screening Program')
        s6_sla = next(s for s in slas if s['customerID'] == screening)
        s6_sla['slaCode'] = d['narrative']['story6_sla_balance']['sla']
        # supplying party (issue #272) — after the story-anchor customer swaps
        for s in slas:
            s['supplierID'] = self._sla_supplier(s['customerID'], s['businessUnitID'])
        # a supplier serving a unit's contracts serves that unit (issue #281):
        # union the supplier's units with its SLAs' — the Ticket Supplier
        # picker filters by unit and must keep offering the seeded pair
        # (mirrored by tools/migrate_ticket_supplier_decision.py). Since sv68
        # the SLA department's unit joins the union too: the Supplier
        # Department picker offers the departments of the supplier's units
        # and must keep offering the seeded department on edit
        cust_by_id = {c['customerID']: c for c in self.rows('Customers')}
        dept_unit = {dp['departmentID']: dp['businessUnitID']
                     for dp in self.rows('Departments')}
        for s in slas:
            sup = cust_by_id.get(s['supplierID'])
            if not sup:
                continue
            for u in (s['businessUnitID'], dept_unit.get(s['departmentID'])):
                if u and u not in sup['businessUnitID']:
                    sup['businessUnitID'].append(u)
        self.put('SLA', slas)
        self.s6_sla_id = s6_sla['slaID']

        # forecasts: 12 contracts × 12 months + quarterly/annual mass
        fc, fs, fc_n, fs_n = [], [], 0, 0
        months = [month_add(self.anchor.replace(day=1), -11 + i) for i in range(12)]
        payload_by_id = {p['payloadID']: p for p in payloads}
        pair_rows = {p['productScopeID']: p for p in self.rows('Product Scopes')}
        task_hours_by_event = self._task_hours_by_event()
        fn_radio = self.id_of('Functions', 'Radiologist')

        def add_forecast(sla, start, finish, period, label, status):
            nonlocal fc_n
            fc_n += 1
            bd = business_days(start, finish)
            fc.append({'forecastID': f'FRC{fc_n:03d}', 'slaID': sla['slaID'],
                       'customerID': sla['customerID'], 'forecastPeriod': period,
                       'periodStart': start.isoformat(), 'periodFinish': finish.isoformat(),
                       'periodBusinessDays': bd, 'periodFrame': label,
                       'weeklyUsageQuota': 0, 'totalEstimatedHours': 0.0,
                       'status': status, 'createdBy': 'U01',
                       'createdAt': (start - timedelta(days=20)).isoformat(),
                       'forecastOwner': None})
            return fc[-1]

        def add_line(forecast, sla, qty, prefer_fn=None):
            nonlocal fs_n
            packaged = [(pl, ps) for plid in sla['payloadID']
                        for pl in [payload_by_id[plid]]
                        for ps in pl['productScopeID']
                        if task_hours_by_event.get(pl['eventID'])]
            if not packaged:
                return None
            pl, ps_id = packaged[fs_n % len(packaged)]
            ps = pair_rows[ps_id]
            hours_map = task_hours_by_event[pl['eventID']]
            fn = prefer_fn if prefer_fn in hours_map else sorted(hours_map)[fs_n % len(hours_map)]
            fs_n += 1
            est = round(sum(hours_map.values()) * qty, 2)
            fs.append({'forecastScopeID': f'FS{fs_n:03d}',
                       'forecastScopeRegistry': f'FSR-2026-{fs_n:04d}',
                       'forecastID': forecast['forecastID'], 'eventID': pl['eventID'],
                       'productScopeID': ps_id, 'scopeID': ps['scopeID'],
                       'productGroupID': ps['productGroupID'],
                       'processID': [p['processID'] for p in self.rows('Processes')
                                     if p['eventID'] == pl['eventID']],
                       'functionID': fn, 'estimatedHours': est, 'region': None,
                       'forecastScopeQuantity': qty, 'notes': '',
                       'forecastScopeOwner': None})
            return fs[-1]

        # monthly contracts cover the PROJECT customers first (H1: their
        # tickets are the ones that can consume demand lines), topped up to 12
        proj_custs = []
        for p in d['projects']:
            cid = self.id_of('Customers', p['customer'])
            if cid not in proj_custs:
                proj_custs.append(cid)
        by_customer = {}
        for s in slas:
            by_customer.setdefault(s['customerID'], s)
        monthly_slas = [by_customer[c] for c in proj_custs if c in by_customer]
        for s in slas:
            if len(monthly_slas) >= 12:
                break
            if s not in monthly_slas:
                monthly_slas.append(s)
        statuses = ['Approved'] * 8 + ['Draft', 'Submitted', 'Approved', 'Archived']
        for si, sla in enumerate(monthly_slas):
            is_s6 = sla['slaID'] == self.s6_sla_id
            for mi, m in enumerate(months):
                # the story-6 contract stays fully Approved (its quarter is measured)
                status = 'Approved' if is_s6 else statuses[(si + mi) % len(statuses)]
                f = add_forecast(sla, m, month_end(m), 'Month', frame(m), status)
                lines = 2 + ((si + mi) % 2)
                for li in range(lines):
                    qty = 1 + ((si + mi + li) % 5)
                    # story 1: radiologist demand swells on the last 3 months —
                    # but never on the story-6 contract (its burn must stay
                    # reachable by one customer's ticket mass)
                    prefer = fn_radio if (mi >= 9 and li == 0 and not is_s6) else None
                    if prefer:
                        qty = 12 + (mi - 9) * 4
                    add_line(f, sla, qty, prefer)
        q_slas = slas[12:14]
        for si, sla in enumerate(q_slas):
            for qi in range(4):
                start = month_add(months[0], qi * 3)
                finish = month_end(month_add(start, 2))
                f = add_forecast(sla, start, finish, 'Quarter',
                                 f'{start.year}-Q{(start.month - 1) // 3 + 1}', 'Approved')
                for li in range(2):
                    add_line(f, sla, 6 + li * 2)
        for si, sla in enumerate(slas[14:18]):
            start = months[0].replace(month=1) if months[0].month != 1 else months[0]
            start = date(self.anchor.year, 1, 1)
            f = add_forecast(sla, start, date(self.anchor.year, 12, 31), 'Annual',
                             str(self.anchor.year), 'Approved')
            for li in range(3):
                add_line(f, sla, 10 + li * 5)

        # parent coherence
        for f in fc:
            kids = [s for s in fs if s['forecastID'] == f['forecastID']]
            total = round(sum(k['estimatedHours'] for k in kids), 2)
            start = date.fromisoformat(f['periodStart'])
            finish = date.fromisoformat(f['periodFinish'])
            weeks = max(1, round(((finish - start).days + 1) / 7))
            f['totalEstimatedHours'] = total
            f['weeklyUsageQuota'] = round(total / weeks) if total else 0
        self.put('Forecasts', fc)
        self.put('Forecast Scopes', fs)

    def _task_hours_by_event(self):
        """eventID -> {functionID: hours} over the event's chained tasks."""
        task_exec = {}
        for p in self.rows('Procedures'):
            task_exec[p['taskID']] = task_exec.get(p['taskID'], 0) + p['executionTime']
        out = {}
        for t in self.rows('Tasks'):
            if t['taskID'] not in task_exec:
                continue
            out.setdefault(t['eventID'], {}).setdefault(t['functionID'], 0)
            out[t['eventID']][t['functionID']] += task_exec[t['taskID']]
        return out

    # ---- layer 7: competence & onboarding ----
    def build_competence(self):
        d = self.domain
        procedures = self.rows('Procedures')
        tasks = {t['taskID']: t for t in self.rows('Tasks')}
        processes = {p['processID']: p for p in self.rows('Processes')}
        workflows = {w['workflowID']: w for w in self.rows('Workflows')}
        pairs = self.rows('Product Scopes')
        # story 2: the protocol's product scopes
        s2_pg = self.ix['Product Groups'][d['narrative']['story2_certification']['protocol']]
        s2_ps = [p['productScopeID'] for p in pairs if p['productGroupID'] == s2_pg]
        # story 2 exactness: the protocol's product scopes belong ONLY to the
        # story competences — any other competence landing there would inflate
        # the certified count the assert pins at exactly 2
        non_story_pairs = [p for p in pairs if p['productScopeID'] not in s2_ps]
        comp, n = [], 0
        for proc in procedures[:d['competences']['count']]:
            n += 1
            t = tasks[proc['taskID']]
            pr = processes[t['processID']]
            ps_id = (s2_ps[n % len(s2_ps)] if n <= 4 and s2_ps
                     else non_story_pairs[n % len(non_story_pairs)]['productScopeID'])
            role = next((r for r in self.rows('Roles') if r['functionID'] == t['functionID']),
                        self.rows('Roles')[0])
            # a competence certifies spec DEFINITIONS: the ones its product
            # scope's protocol fills in (Product Specs refactor doctrine)
            pair = next(p for p in pairs if p['productScopeID'] == ps_id)
            group = next(g for g in self.rows('Product Groups')
                         if g['productGroupID'] == pair['productGroupID'])
            spec_ids = sorted(group['specValues'].keys())[:3]
            # competenceTitle (issue #284) — same deterministic rule as
            # migrate_competence_procedure_group.py, so regenerated and
            # migrated datasets agree: "<task name> | <scope name>"
            scope = next(s for s in self.rows('Scopes')
                         if s['scopeID'] == pair['scopeID'])
            comp.append({'competenceID': f'CMP{n:02d}',
                         'competenceTitle': f"{t['taskName']} | {scope['scopeName']}",
                         'eventID': t['eventID'],
                         'departmentID': pr['departmentID'], 'processID': t['processID'],
                         'productScopeID': ps_id, 'functionID': t['functionID'],
                         'skillLevelID': role['skillLevelID'], 'roleID': role['roleID'],
                         'levelRank': 1 + n % 3, 'taskID': t['taskID'],
                         'actionID': t['actionID'],
                         'activityID': workflows[t['workflowID']]['activityID'],
                         'productSpecID': spec_ids,
                         # procedure GROUP (issue #284, 1:many) — honest
                         # singleton: the demo certifies one procedure per
                         # competence, grouping is a UI decision
                         'procedureID': [proc['procedureID']],
                         'resources': 'e-learning' if n % 2 else 'classroom',
                         'competenceOwner': None})
        # procedure GROUPS (issue #284 follow-up) — the certified competences
        # of the variant SOPs hold both method variants of their task; same
        # deterministic rule as migrate_demo_procedure_groups.py
        comp_by_id = {c['competenceID']: c for c in comp}
        for comp_id, vid in [('CMP01', 'PRC47'), ('CMP02', 'PRC48'), ('CMP11', 'PRC49')]:
            comp_by_id[comp_id]['procedureID'].append(vid)
        self.put('Competence', comp)

        # onboarding groups (issue #239): story 2 plants 2 certified + 6 pending
        # on the protocol competences; everyone else certifies other groups
        s2_comp = [c['competenceID'] for c in comp[:4]]
        other = [c for c in comp[4:]]
        people = self.rows('People')
        fn_of_person = {p['userID']: p['functionID'] for p in people}
        obs, n = [], 0
        s2 = d['narrative']['story2_certification']
        radios = [p for p in people if p['functionID'] == self.id_of('Functions', 'Radiologist')]
        techs = [p for p in people if p['functionID'] == self.id_of('Functions', 'Radiology Technician')]
        s2_people = (radios + techs)[:s2['certified'] + s2['inOnboarding']]
        for i, person in enumerate(s2_people):
            n += 1
            obs.append(self._onboarding(n, person, s2_comp,
                                        f"{s2['protocol']} Certification",
                                        certified=i < s2['certified']))
        i = 0
        while n < d['onboardings']['count']:
            n += 1
            person = people[n % len(people)]
            grp = [c['competenceID'] for c in other
                   if c['functionID'] == person['functionID']][:2] \
                or [other[n % len(other)]['competenceID']]
            certified = (n % 4) != 0            # ≈75% certified rate
            title = f"{next(f['functionName'] for f in self.rows('Functions') if f['functionID'] == person['functionID'])} Qualification {n:02d}"
            obs.append(self._onboarding(n, person, grp, title, certified))
            i += 1
        self.put('Onboarding', obs)
        ob_by_user = {}
        for ob in obs:
            ob_by_user.setdefault(ob['userID'], ob['onboardID'])
        for p in people:
            p['onboardID'] = ob_by_user.get(p['userID'])

    def _onboarding(self, n, person, comp_ids, title, certified):
        comp = {c['competenceID']: c for c in self.rows('Competence')}
        first = comp.get(comp_ids[0]) if comp_ids else None
        pair = None
        if first:
            pair = next((p for p in self.rows('Product Scopes')
                         if p['productScopeID'] == first['productScopeID']), None)
        return {'onboardID': f'ONB{n:03d}', 'onboardingTitle': title,
                'departmentID': person['departmentID'],
                'businessUnitID': person['businessUnitID'],
                'functionID': person['functionID'], 'userID': person['userID'],
                'levelRank': first['levelRank'] if first else 1,
                'competenceID': comp_ids, 'isCertified': certified,
                'scopeName': None, 'productName': None,
                'resources': first['resources'] if first else None,
                'requirementName': None, 'trainingURL': None,
                'onboardingOwner': None}

    # ---- layers 8–9: execution (derived from the chains) ----
    def build_execution(self):
        d = self.domain
        slas = {s['slaID']: s for s in self.rows('SLA')}
        cust = {c['customerID']: c for c in self.rows('Customers')}
        projects = []
        for i, p in enumerate(d['projects']):
            cid = self.id_of('Customers', p['customer'])
            sla_ids = [s['slaID'] for s in self.rows('SLA') if s['customerID'] == cid][:2]
            unit = cust[cid]['businessUnitID'][0]
            projects.append({'projectID': f'PJ{i+1:02d}', 'projectRegistryID': f'PRJ-2026-{i+1:03d}',
                             'projectName': p['name'], 'businessUnitID': unit,
                             'customerID': cid, 'slaID': sla_ids, 'projectOwner': None,
                             'projectStatus': 'Active' if i % 3 else 'Closed',
                             'jobID': None, 'estimatedTime': 120 + i * 40,
                             'executionTime': 90 + i * 35})
        self.put('Projects', projects)

        # tickets: consume demand lines (story H1 spread + story 6 burn)
        fs_rows = self.rows('Forecast Scopes')
        forecasts = {f['forecastID']: f for f in self.rows('Forecasts')}
        payloads = {p['payloadID']: p for p in self.rows('Payload')}
        lines_by_customer = {}
        for s in fs_rows:
            f = forecasts[s['forecastID']]
            if f['status'] == 'Approved':
                lines_by_customer.setdefault(f['customerID'], []).append(s)
        hours_by_event = self._task_hours_by_event()
        tickets, n = [], 0
        target = d['tickets']['count']
        link_rate = d['tickets']['linkedToForecastRate']
        statuses = (['Resolved'] * 6 + ['InProgress'] * 2 + ['Open'] * 2)
        line_cursor = {}
        consumption = {}
        while n < target:
            proj = projects[n % len(projects)]
            cid = proj['customerID']
            lines = lines_by_customer.get(cid) or []
            n += 1
            # 97 is coprime with 355 — creation dates sweep the FULL 12-month
            # window including the anchor month (Performance needs 12 periods)
            created = self.anchor - timedelta(days=3 + (n * 97) % 355)
            link = None
            if lines and (n % 10) < link_rate * 10:
                cur = line_cursor.get(cid, 0)
                # H1 spread: virgin lines first, then any line with capacity left
                for want_virgin in (True, False):
                    for probe in range(len(lines)):
                        cand = lines[(cur + probe) % len(lines)]
                        used = consumption.get(cand['forecastScopeID'], 0)
                        if (used == 0 if want_virgin else used < cand['forecastScopeQuantity']):
                            link = cand
                            line_cursor[cid] = (cur + probe + 1) % len(lines)
                            consumption[cand['forecastScopeID']] = used + 1
                            break
                    if link is not None:
                        break
            if link is not None:
                ev_id, ps_id = link['eventID'], link['productScopeID']
            else:
                sla = slas.get((proj['slaID'] or [None])[0])
                pls = [payloads[p] for p in (sla['payloadID'] if sla else [])
                       if payloads[p]['productScopeID']]
                pl = pls[n % len(pls)] if pls else None
                ev_id = pl['eventID'] if pl else self.rows('Events')[0]['eventID']
                ps_id = pl['productScopeID'][n % len(pl['productScopeID'])] if pl else \
                    self.rows('Product Scopes')[0]['productScopeID']
            pair = next(p for p in self.rows('Product Scopes') if p['productScopeID'] == ps_id)
            group = next(g for g in self.rows('Product Groups')
                         if g['productGroupID'] == pair['productGroupID'])
            status = statuses[n % len(statuses)]
            exec_hours = round(sum(hours_by_event.get(ev_id, {}).values()) or 2.0, 2)
            # supplying-party filter (issue #272): the governing SLA's supplier
            # on most tickets, with a visible wildcard cohort (n % 3 == 0)
            gov_sla = slas.get((proj['slaID'] or [None])[0])
            sup_id = gov_sla.get('supplierID') if (gov_sla and n % 3) else None
            tickets.append({'ticketID': f'TK{n:03d}',
                            'businessUnitID': cust[cid]['businessUnitID'][0],
                            'projectID': proj['projectID'], 'customerID': cid,
                            'supplierID': sup_id,
                            'eventID': ev_id, 'productScopeID': ps_id,
                            'forecastScopeID': link['forecastScopeID'] if link else None,
                            'ticketDescription': f'{pair["productScopeName"]} request',
                            'processID': [p['processID'] for p in self.rows('Processes')
                                          if p['eventID'] == ev_id],
                            'products': group['productID'],
                            'scopes': [pair['scopeID']],
                            'ticketExecutionTime': exec_hours,
                            'ticketOwner': None, 'ticketStatus': status,
                            'targetDate': (created + timedelta(days=14)).isoformat(),
                            'ticketCreatedAt': created.isoformat(),
                            'ticketClosedAt': (created + timedelta(days=10)).isoformat()
                            if status == 'Resolved' else None})
        self.put('Tickets', tickets)
        self._plant_story6(tickets)
        self._build_jobs(tickets)

    def _plant_story6(self, tickets):
        """Burn the story SLA's demand lines to ≈consumedRate (never past
        quantity — H2 holds on the story contract too)."""
        s6 = self.domain['narrative']['story6_sla_balance']
        sla = next(s for s in self.rows('SLA') if s['slaCode'] == s6['sla'])
        monthly = sorted((f for f in self.rows('Forecasts')
                          if f['slaID'] == sla['slaID'] and f['forecastPeriod'] == 'Month'
                          and f['status'] == 'Approved'),
                         key=lambda f: f['periodStart'])
        fc_ids = {f['forecastID'] for f in monthly[-3:]}   # the current quarter
        lines = [s for s in self.rows('Forecast Scopes') if s['forecastID'] in fc_ids]
        line_ids = {s['forecastScopeID'] for s in lines}
        qty = sum(s['forecastScopeQuantity'] for s in lines)
        target = round(s6['consumedRate'] * qty)
        used = {}
        for t in tickets:
            if t['forecastScopeID'] in line_ids:
                used[t['forecastScopeID']] = used.get(t['forecastScopeID'], 0) + 1
        need = target - sum(used.values())
        # donors: the customer's unlinked tickets first, then its tickets
        # linked to the SLA's OFF-quarter lines — the burn concentrates on
        # the current quarter, which is exactly what the story shows
        all_sla_fcs = {f['forecastID'] for f in self.rows('Forecasts')
                       if f['slaID'] == sla['slaID']}
        off_quarter = {s['forecastScopeID'] for s in self.rows('Forecast Scopes')
                       if s['forecastID'] in all_sla_fcs} - line_ids
        spare = [t for t in tickets
                 if t['customerID'] == sla['customerID'] and t['forecastScopeID'] is None]
        spare += [t for t in tickets
                  if t['customerID'] == sla['customerID']
                  and t['forecastScopeID'] in off_quarter]
        li = 0
        while need > 0 and spare:
            line = lines[li % len(lines)]
            li += 1
            if used.get(line['forecastScopeID'], 0) >= line['forecastScopeQuantity']:
                if li > len(lines) * 2:
                    break
                continue
            t = spare.pop(0)
            t['forecastScopeID'] = line['forecastScopeID']
            t['eventID'] = line['eventID']
            t['productScopeID'] = line['productScopeID']
            t['processID'] = [p['processID'] for p in self.rows('Processes')
                              if p['eventID'] == line['eventID']]
            used[line['forecastScopeID']] = used.get(line['forecastScopeID'], 0) + 1
            need -= 1

    def _build_jobs(self, tickets):
        d = self.domain
        tasks_by_event = {}
        for t in self.rows('Tasks'):
            tasks_by_event.setdefault(t['eventID'], []).append(t)
        proc_hours = {}
        for p in self.rows('Procedures'):
            proc_hours[p['taskID']] = proc_hours.get(p['taskID'], 0) + p['executionTime']
        certified = {}
        for ob in self.rows('Onboarding'):
            if ob['isCertified'] is True:
                for c in ob['competenceID']:
                    certified.setdefault(c, ob['userID'])
        comp_by_task = {}
        for c in self.rows('Competence'):
            comp_by_task.setdefault(c['taskID'], []).append(c)
        people = self.rows('People')
        cust_names = {c['customerID']: c['customerName'] for c in self.rows('Customers')}
        squads = {s['squadID']: s['squadName'] for s in self.rows('Squads')}
        person_squad = {p['userID']: squads.get(p['squadID']) for p in people}
        projects = {p['projectID']: p for p in self.rows('Projects')}
        statuses = ['Done'] * 11 + ['Active'] * 4 + ['Queued'] * 4 + ['Stoped']
        jobs, n = [], 0
        target = d['jobs']['count']
        ti = 0
        while n < target:
            tkt = tickets[ti % len(tickets)]
            ti += 1
            chain = tasks_by_event.get(tkt['eventID'], [])
            if not chain:
                continue
            per_ticket = 1 + (ti % 2)
            prev = None
            for k in range(per_ticket):
                if n >= target:
                    break
                n += 1
                task = chain[(ti + k) % len(chain)]
                comp = comp_by_task.get(task['taskID'], [])
                user = next((certified[c['competenceID']] for c in comp
                             if c['competenceID'] in certified),
                            people[n % len(people)]['userID'])
                status = statuses[n % len(statuses)]
                created = date.fromisoformat(tkt['ticketCreatedAt'])
                start = created + timedelta(days=2 + k)
                plan = round(proc_hours.get(task['taskID'], 1.0), 2)
                job = {'jobID': f'J{n:03d}', 'projectID': tkt['projectID'],
                       'ticketID': tkt['ticketID'],
                       'projectName': projects[tkt['projectID']]['projectName'],
                       'taskID': task['taskID'], 'jobName': task['taskName'],
                       'userID': user,
                       'deliveryDate': (start + timedelta(days=3)).isoformat(),
                       'startDate': start.isoformat(),
                       'plannedExecutionTime': plan,
                       'realStartDate': None, 'realEndDate': None,
                       'realExecutionTime': None, 'jobBufferExecution': 0.0,
                       'stoppedAt': None,
                       'customerName': cust_names[tkt['customerID']],
                       'squadName': person_squad.get(user),
                       'predecessorJobID': prev if k and (n % 5) < 2 else None,
                       'dependencyType': 'finish-to-start' if (k and (n % 5) < 2) else None,
                       'jobStatus': status, 'jobOwner': None}
                self._stamp_lifecycle(job, start, plan, n)
                jobs.append(job)
                prev = job['jobID']
        self.put('Jobs', jobs)
        self._plant_story4(jobs, tickets)

    def _stamp_lifecycle(self, job, start, plan, n):
        """Real clocks per status — H3/H4/H5 by construction."""
        rs = datetime.combine(min(start, self.anchor - timedelta(days=2)),
                              datetime.min.time()) + timedelta(hours=8)
        if job['jobStatus'] == 'Done':
            buffer_h = round(0.5 * (n % 3), 2)
            real = round(plan * (0.8 + 0.05 * (n % 9)), 2)
            job['realStartDate'] = rs.isoformat()
            job['realEndDate'] = (rs + timedelta(hours=real + buffer_h)).isoformat()
            job['jobBufferExecution'] = buffer_h
            job['realExecutionTime'] = real
        elif job['jobStatus'] == 'Active':
            job['realStartDate'] = rs.isoformat()
        elif job['jobStatus'] == 'Stoped':
            job['realStartDate'] = rs.isoformat()
            job['stoppedAt'] = (rs + timedelta(hours=2)).isoformat()
            job['jobBufferExecution'] = 1.0

    def _plant_story4(self, jobs, tickets):
        """Scale HealthFirst's forecasts to ≈approvedHours and its executed
        Done hours to ≈executedHours (±5% assert tolerance)."""
        s4 = self.domain['narrative']['story4_forecast_gap']
        cid = self.id_of('Customers', s4['customer'])
        fcs = [f for f in self.rows('Forecasts')
               if f['customerID'] == cid and f['status'] == 'Approved']
        lines = [s for s in self.rows('Forecast Scopes')
                 if s['forecastID'] in {f['forecastID'] for f in fcs}]
        total = sum(s['estimatedHours'] for s in lines)
        if total:
            factor = s4['approvedHours'] / total
            for s in lines:
                s['forecastScopeQuantity'] = max(1, round(s['forecastScopeQuantity'] * factor))
                unit = s['estimatedHours'] / max(1, s['forecastScopeQuantity'] / factor) \
                    if s['forecastScopeQuantity'] else s['estimatedHours']
            # recompute honestly: hours = per-qty hours × new qty
            by_event = self._task_hours_by_event()
            for s in lines:
                per = sum(by_event.get(s['eventID'], {}).values())
                s['estimatedHours'] = round(per * s['forecastScopeQuantity'], 2)
            drift = s4['approvedHours'] - sum(s['estimatedHours'] for s in lines)
            # absorb the residue on the smallest-hour line via quantity steps
            lines.sort(key=lambda s: s['estimatedHours'])
            per = sum(by_event.get(lines[0]['eventID'], {}).values()) or 1
            step = round(drift / per)
            lines[0]['forecastScopeQuantity'] = max(1, lines[0]['forecastScopeQuantity'] + step)
            lines[0]['estimatedHours'] = round(per * lines[0]['forecastScopeQuantity'], 2)
            for f in fcs:
                kids = [s for s in self.rows('Forecast Scopes')
                        if s['forecastID'] == f['forecastID']]
                f['totalEstimatedHours'] = round(sum(k['estimatedHours'] for k in kids), 2)
        # executed side: scale the Done jobs under the linked tickets
        line_ids = {s['forecastScopeID'] for s in lines}
        tkt_ids = {t['ticketID'] for t in tickets if t['forecastScopeID'] in line_ids}
        done = [j for j in jobs if j['ticketID'] in tkt_ids and j['jobStatus'] == 'Done']
        have = sum(j['realExecutionTime'] for j in done)
        if done and have:
            factor = s4['executedHours'] / have
            for j in done:
                real = round(j['realExecutionTime'] * factor, 2)
                j['realExecutionTime'] = real
                rs = datetime.fromisoformat(j['realStartDate'])
                j['realEndDate'] = (rs + timedelta(hours=real + j['jobBufferExecution'])).isoformat()

    # ---- layer 10: control (derived) + owner pass ----
    def build_control(self):
        flat = {}
        for tables in self.data.values():
            flat.update(tables)
        capacity, performance = derive_control.derive(flat)
        self.put('Capacity', capacity)
        self.put('Performance', performance)

    OWNERISH = ('Owner', 'Manager', 'createdBy', 'reportedBy', 'changedBy',
                'qualityManager', 'operationalManager', 'userID')

    def owner_pass(self):
        people = [p['userID'] for p in self.rows('People')]
        i = 0
        for tables in self.data.values():
            for tname, rows in tables.items():
                if tname in ('People', 'Jobs', 'Onboarding', 'Tickets'):
                    owner_fields = [k for k in (rows[0] if rows else {})
                                    if k.endswith('Owner') or k.endswith('Manager')
                                    or k in ('createdBy', 'reportedBy')]
                else:
                    owner_fields = [k for k in (rows[0] if rows else {})
                                    if k.endswith('Owner') or k.endswith('Manager')
                                    or k in ('createdBy', 'reportedBy', 'userID')]
                for r in rows:
                    for f in owner_fields:
                        if r.get(f) is None:
                            r[f] = people[i % len(people)]
                            i += 1

    # ---- orchestration ----
    def build(self):
        self.build_org()
        self.build_talent()
        self.build_customers_branches()
        self.build_portfolio()
        self.build_requirements()
        self.build_process()
        self.build_crm()
        self.build_competence()
        self.build_execution()
        self.build_control()
        self.owner_pass()
        dataset = {'_meta': {'schemaVersion': self.dm['_meta']['schemaVersion'],
                             'anchorDate': self.anchor.isoformat(),
                             'domain': self.meta['domain'],
                             'organization': self.meta['organization']}}
        order = ['Organization', 'CRM', 'Operation', 'Workspace', 'Control', 'Talent', 'Portfolio']
        for mod in order:
            if mod in self.data:
                dataset[mod] = self.data[mod]
        return dataset


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--domain', default='clinic')
    ap.add_argument('--out', default=None)
    ap.add_argument('--strict-narrative', action='store_true',
                    help='narrative/hygiene failures exit non-zero (F3 default)')
    args = ap.parse_args()

    dm = graph.load_datamodel()
    domain = yaml.safe_load((SEED_DIR / 'domains' / f'{args.domain}.yaml').read_text(encoding='utf-8'))
    dataset = Builder(dm, domain).build()

    graph.check_dataset(dm, dataset)          # catalogue contract — raises on ANY gap

    flat = {}
    for mod, tables in dataset.items():
        if mod != '_meta':
            flat.update(tables)
    fails = narrative.assert_narrative(flat, domain)
    for f in fails:
        print(f'  ~ narrative: {f}')
    if fails and args.strict_narrative:
        print(f'FAIL — {len(fails)} narrative/hygiene assertions')
        return 1

    out = Path(args.out) if args.out else SEED_DIR / 'out' / f'mockup_{args.domain}.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(dataset, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    n = sum(len(rows) for mod, tables in dataset.items() if mod != '_meta'
            for rows in tables.values())
    print(f'{out}: {n} rows, {len(fails)} narrative warnings, catalogue contract OK')
    return 0


if __name__ == '__main__':
    sys.exit(main())
