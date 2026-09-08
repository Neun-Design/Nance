#!/usr/bin/env python3
"""Ticket SLA cascade re-source (issue #350, schemaVersion 89).

The APPLICANT -> SUPPLIER contracts become the basis of the ticket's
Event/Product Scope options and of the stored payloadID/slaID resolution,
superseding the #325 project universe (keeping it would re-introduce the
Customer -> Applicant cascade the issue removes: the project's SLAs ARE the
customer's contracts).

New survival rule (session decisions recorded with the round): a ticket's
surviving SLAs = every Active SLA matching the exact pair
  SLA.customerID names the Applicant AND SLA.supplierID = the Supplier,
with a BLANK context side SKIPPING its dimension (multiViaJoin posture —
the #308 null-applicant cohort keeps resolving; blank both sides = every
Active SLA). The Customer no longer participates in SLA survival and the
Project no longer restricts the contract set.

Seed alignment (the #344 census-first method — without it 149/160 clinic
tickets would lose their stored event from the pickers, the form-integrity
trap): tickets carrying BOTH an applicant and a supplier re-key the
supplier to the one of the applicant's first covering Active SLA (table
order; covering = purchases a payload carrying the ticket's event and
packaging its scope, empty packaging = wildcard Q1) — under #350 the
governing contract is the applicant's, so the demo supplier follows it.
Null cohorts (applicant i%3, supplier n%3 — #308/#272 postures) stay null.
Then payloadID/slaID re-derive for EVERY ticket under the new rule (same
first-seen ordering as applyDerivedUnits in forms.js and build_seed.py).

Edit-integrity alignment (#281 posture — a supplier serving a unit's
contracts serves that unit): each re-keyed supplier's businessUnitID
unions the units of the tickets now naming it, so the unit-filtered
Supplier select keeps offering every stored pick.

Census after (asserted in tools/test_engine_ticket_sla_cascade.mjs): clinic
160/160 resolved, stored event/scope/supplier picks survive their pickers,
and the admitted-scope CONTEXT is identical to the pre-#350 chain on all
160 tickets — the derived inheritance chain (requirements,
TICKET-PROCEDURE, TICKET-INPUTS, staffing) does not flip at rest.

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
SCHEMA_VERSION = 89


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


def payload_covers(payload, ticket):
    """Payload carries the ticket's event and packages its scope (empty
    packaging = wildcard, Q1)."""
    ev, scope = ticket.get('eventID'), ticket.get('productScopeID')
    if not payload or ev in (None, '') or str(payload.get('eventID')) != str(ev):
        return False
    packs = [str(x) for x in as_list(payload.get('productScopeID'))]
    return scope in (None, '') or not packs or str(scope) in packs


def survivors_for(ticket, sla_rows):
    """Issue #350 rule: exact (Applicant, Supplier) pair over every Active
    SLA; a blank context side skips its dimension."""
    aid = ticket.get('applicantID')
    sup = ticket.get('supplierID')
    out = []
    for s in sla_rows:
        if not is_active(s):
            continue
        buyers = [str(x) for x in as_list(s.get('customerID'))]
        if aid not in (None, '') and str(aid) not in buyers:
            continue
        if sup not in (None, '') and str(s.get('supplierID') or '') != str(sup):
            continue
        out.append(s)
    return out


def rekey_supplier(ticket, sla_rows, payload_by_id):
    """Applicant + supplier both set: the supplier follows the applicant's
    first covering Active contract (table order). No covering contract =
    keep (honest no-op, counted)."""
    aid, sup = ticket.get('applicantID'), ticket.get('supplierID')
    if aid in (None, '') or sup in (None, ''):
        return None
    for s in sla_rows:
        if not is_active(s):
            continue
        if str(aid) not in [str(x) for x in as_list(s.get('customerID'))]:
            continue
        if any(payload_covers(payload_by_id.get(str(pid)), ticket)
               for pid in as_list(s.get('payloadID'))):
            new_sup = s.get('supplierID')
            changed = str(new_sup or '') != str(sup)
            ticket['supplierID'] = new_sup
            return 'rekeyed' if changed else 'same'
    return 'no_cover'  # no covering contract — supplier kept


def resolve_keys(ticket, sla_rows, payload_by_id):
    """Stored payloadID/slaID under the new rule — same first-seen ordering
    as applyDerivedUnits (forms.js) and build_seed.py."""
    surv = survivors_for(ticket, sla_rows)
    seen, payload_ids = set(), []
    for s in surv:
        for pid in as_list(s.get('payloadID')):
            if str(pid) in seen:
                continue
            seen.add(str(pid))
            if payload_covers(payload_by_id.get(str(pid)), ticket):
                payload_ids.append(pid)
    pl_set = {str(x) for x in payload_ids}
    sla_ids = [s['slaID'] for s in surv
               if any(str(pid) in pl_set for pid in as_list(s.get('payloadID')))]
    return payload_ids, sla_ids


def migrate(path):
    raw = path.read_text(encoding='utf-8')
    mock = json.loads(raw)
    tables = tables_of(mock)
    sla_rows = tables.get('SLA', [])
    payload_by_id = {str(p['payloadID']): p for p in tables.get('Payload', [])}
    stats = {'tickets': 0, 'suppliers_rekeyed': 0, 'suppliers_same': 0,
             'no_cover': 0, 'resolved': 0, 'empty': 0}
    for t in tables.get('Tickets', []):
        stats['tickets'] += 1
        rk = rekey_supplier(t, sla_rows, payload_by_id)
        if rk == 'rekeyed':
            stats['suppliers_rekeyed'] += 1
        elif rk == 'same':
            stats['suppliers_same'] += 1
        elif rk == 'no_cover':
            stats['no_cover'] += 1
        payload_ids, sla_ids = resolve_keys(t, sla_rows, payload_by_id)
        t['payloadID'] = payload_ids
        t['slaID'] = sla_ids
        stats['resolved' if payload_ids else 'empty'] += 1
    # edit-integrity (#281 posture): the unit-filtered Supplier select must
    # keep offering every stored pick — union the supplier's units with the
    # units of the tickets naming it (first-seen, ticket order)
    cust_by_id = {str(c['customerID']): c for c in tables.get('Customers', [])}
    stats['supplier_units_unioned'] = 0
    for t in tables.get('Tickets', []):
        sup, unit = t.get('supplierID'), t.get('businessUnitID')
        c = cust_by_id.get(str(sup)) if sup not in (None, '') else None
        if not c or unit in (None, ''):
            continue
        units = as_list(c.get('businessUnitID'))
        if unit not in units:
            c['businessUnitID'] = units + [unit]
            stats['supplier_units_unioned'] += 1
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
