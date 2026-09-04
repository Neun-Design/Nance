#!/usr/bin/env python3
"""Project-SLA ticket chain round (issue #325, schemaVersion 76).

The PROJECT's contracts become the universe of the ticket's Event/Product
Scope options, and the Event x Product Scope pick alone does not guarantee a
payload — so `Tickets.payloadID`/`slaID` turn from display rollups into
STORED multivalued FKs resolved from the chain (parity: every ticket row
must carry both keys).

Survival semantics (session decision — union of two exact pairs): a project
SLA (Projects.slaID, Active only) survives when
  leg 1 — SLA.customerID = the ticket's customerID, OR
  leg 2 — SLA.customerID = the applicantID AND SLA.supplierID = supplierID
          (no applicant = leg inert; no supplier = the leg ignores the
          supplier dimension; the supplier does NOT narrow leg 1).

Stored keys (same first-seen ordering as applyDerivedUnits in forms.js and
build_seed.py):
  payloadID = the survivors' payloads (survivor order, then the SLA's
              payloadID order, deduped) carrying the ticket's event and
              packaging its product scope (EMPTY packaging = wildcard, Q1 —
              always survives the scope filter);
  slaID     = the survivors that purchased at least one resolved payload.

Legacy developer copy: its projects carry no customerID (the #192 name
lookup matched nothing) nor slaID — backfilled first: customerID = the
MAJORITY customer of the project's tickets (first-seen tiebreak, the #310
majority-rule precedent; no tickets = honest null), then slaID = that
customer's Active SLAs surviving the project's branch filter
(slasForProject rule: SLA.branchID empty or = the project's). Its SLAs also
carry EMPTY payloadID purchase lists — backfilled with the whole Payload
registry (the #179 "all unit payloads" seed rule; the unit dimension is
unknowable here — legacy payloads carry no unit key). Tickets whose
customer still differs from the project customer resolve honest [] (the
derived inheritance chain keeps a legacy-fallback rung — resolve.js).

Runs on both mockup copies; the frozen transformers testdata stays
unmigrated by design.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COPIES = [
    ROOT / 'data' / 'mockup_data_prototype.json',
    ROOT.parent / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 76


def tables_of(mock):
    """The mockup nests tables by module (false 0-rows trap) — walk it."""
    out = {}
    for mod, tabs in mock.items():
        if mod.startswith('_') or not isinstance(tabs, dict):
            continue
        for name, rows in tabs.items():
            if isinstance(rows, list):
                out[name] = rows
    return out


def as_list(v):
    if v is None or v == '':
        return []
    return v if isinstance(v, list) else [v]


def is_active(row):
    return str(row.get('isActive') or 'Active') != 'Inactive'


def seed_project_customers(projects, tickets):
    """Legacy-copy backfill: a project without customerID takes the MAJORITY
    customer of its tickets (first-seen tiebreak — #310 precedent)."""
    seeded = 0
    for p in projects:
        if p.get('customerID') not in (None, ''):
            continue
        votes = {}
        for t in tickets:
            if str(t.get('projectID')) != str(p['projectID']):
                continue
            cid = t.get('customerID')
            if cid in (None, ''):
                continue
            votes.setdefault(str(cid), [0, len(votes)])[0] += 1
        if votes:
            p['customerID'] = max(votes.items(),
                                  key=lambda kv: (kv[1][0], -kv[1][1]))[0]
            seeded += 1
    return seeded


def seed_project_slas(projects, slas):
    """Legacy-copy backfill: a project without slaID takes its customer's
    Active SLAs surviving the project's branch filter (deterministic)."""
    seeded = 0
    for p in projects:
        if as_list(p.get('slaID')):
            continue
        cid = p.get('customerID')
        branch = p.get('branchID')
        picks = [s['slaID'] for s in slas
                 if is_active(s) and cid is not None
                 and str(cid) in [str(x) for x in as_list(s.get('customerID'))]
                 and (branch in (None, '') or s.get('branchID') in (None, '')
                      or str(s.get('branchID')) == str(branch))]
        p['slaID'] = picks
        if picks:
            seeded += 1
    return seeded


def seed_sla_payloads(slas, payloads):
    """Legacy-copy backfill: an SLA with an EMPTY purchase list takes the
    whole Payload registry (#179 "all unit payloads" rule — the unit
    dimension is unknowable in the legacy copy, its payloads carry no unit
    key)."""
    seeded = 0
    all_ids = [p['payloadID'] for p in payloads]
    for s in slas:
        if as_list(s.get('payloadID')) or not all_ids:
            continue
        s['payloadID'] = list(all_ids)
        seeded += 1
    return seeded


def survivors_for(ticket, project, sla_by_id):
    if not project:
        return []
    cid = ticket.get('customerID')
    aid = ticket.get('applicantID')
    sup = ticket.get('supplierID')
    out = []
    for sid in as_list(project.get('slaID')):
        s = sla_by_id.get(str(sid))
        if not s or not is_active(s):
            continue
        buyers = [str(x) for x in as_list(s.get('customerID'))]
        leg1 = cid not in (None, '') and str(cid) in buyers
        leg2 = aid not in (None, '') and str(aid) in buyers \
            and (sup in (None, '') or str(s.get('supplierID') or '') == str(sup))
        if leg1 or leg2:
            out.append(s)
    return out


def resolve_keys(ticket, project, sla_by_id, payload_by_id):
    surv = survivors_for(ticket, project, sla_by_id)
    ev = ticket.get('eventID')
    scope = ticket.get('productScopeID')
    seen, payload_ids = set(), []
    for s in surv:
        for pid in as_list(s.get('payloadID')):
            if str(pid) in seen:
                continue
            seen.add(str(pid))
            p = payload_by_id.get(str(pid))
            if not p or ev in (None, '') or str(p.get('eventID')) != str(ev):
                continue
            packs = [str(x) for x in as_list(p.get('productScopeID'))]
            if scope not in (None, '') and packs and str(scope) not in packs:
                continue
            payload_ids.append(pid)
    pl_set = {str(x) for x in payload_ids}
    sla_ids = [s['slaID'] for s in surv
               if any(str(pid) in pl_set for pid in as_list(s.get('payloadID')))]
    return payload_ids, sla_ids


def migrate(path):
    raw = path.read_text(encoding='utf-8')
    mock = json.loads(raw)
    tables = tables_of(mock)
    projects = {str(p['projectID']): p for p in tables.get('Projects', [])}
    sla_by_id = {str(s['slaID']): s for s in tables.get('SLA', [])}
    payload_by_id = {str(p['payloadID']): p for p in tables.get('Payload', [])}
    seeded_customers = seed_project_customers(list(projects.values()),
                                              tables.get('Tickets', []))
    seeded_projects = seed_project_slas(list(projects.values()),
                                        list(sla_by_id.values()))
    seeded_payload_lists = seed_sla_payloads(list(sla_by_id.values()),
                                             tables.get('Payload', []))
    stats = {'customers_seeded': seeded_customers,
             'projects_seeded': seeded_projects,
             'sla_purchases_seeded': seeded_payload_lists, 'tickets': 0,
             'resolved': 0, 'empty': 0, 'multi_sla': 0}
    for t in tables.get('Tickets', []):
        prj = projects.get(str(t.get('projectID') or ''))
        payload_ids, sla_ids = resolve_keys(t, prj, sla_by_id, payload_by_id)
        t['payloadID'] = payload_ids
        t['slaID'] = sla_ids
        stats['tickets'] += 1
        stats['resolved' if payload_ids else 'empty'] += 1
        if len(sla_ids) > 1:
            stats['multi_sla'] += 1
    mock.setdefault('_meta', {})['schemaVersion'] = SCHEMA_VERSION
    path.write_text(json.dumps(mock, indent=1, ensure_ascii=False)
                    + ('\n' if raw.endswith('\n') else ''), encoding='utf-8')
    return stats


def main():
    for path in COPIES:
        if not path.exists():
            print(f'skip (missing): {path}')
            continue
        print(f'{path.name}: {migrate(path)}')


if __name__ == '__main__':
    sys.exit(main())
