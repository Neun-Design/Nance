#!/usr/bin/env python3
"""Deterministic migration: the demand→execution link (issue #243, A1+A2).

1. `Tickets.productScopeID` seeded (A2 — empty in 135/135): the first
   product scope admitted by the ticket's event under the customer's
   active-SLA payloads (wildcard payload = the event's applicability),
   replicating productScopesForTicket. The `processID` snapshot re-stamps
   to the event's processes narrowed by the chosen scope (#214 equation).
2. `Tickets.forecastScopeID` linked (A1): candidates are the demand lines
   matching event + product scope + the customer's SLA; ~2/3 of tickets
   with candidates link (index % 3 != 0), the rest stay NULL — visibly
   "outside the forecast" (assessment §7.2 rationale). Pick rotates over
   the candidates (index % len) so consumption spreads.
3. `Forecast Scopes.consumption` stored values DROPPED — the attribute is
   a real rollup COUNT(Tickets) now; the invented 24–38 numbers go.
4. `Jobs.taskID` re-seeded from the ticket's event chain (the old 3-key
   rollup collapsed to 6 tasks): tasks of the ticket's event, rotated by
   job index; jobs whose event chains no tasks keep their value.

Idempotent: seeded/linked/dropped states are recognised and skipped.
Applies to both mockup copies (the legacy copy lacks most chains and
degrades to the consumption drop).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGETS = [
    ROOT / 'prototype' / 'data' / 'mockup_data_prototype.json',
    ROOT / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]


def find_table(data, name):
    for tables in data.values():
        if isinstance(tables, dict) and name in tables:
            return tables[name]
    return None


def as_list(v):
    if isinstance(v, list):
        return [x for x in v if x not in (None, '')]
    return [v] if v not in (None, '') else []


def migrate(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    tickets = find_table(data, 'Tickets')
    scopes = find_table(data, 'Forecast Scopes') or []
    if tickets is None:
        print(f'{path.name}: no Tickets table — skipped')
        return
    slas = find_table(data, 'SLA') or []
    payloads = {p.get('payloadID'): p for p in (find_table(data, 'Payload') or [])}
    events = {e.get('eventID'): e for e in (find_table(data, 'Events') or [])}
    pss = find_table(data, 'Product Scopes') or []
    pgs = {g.get('productGroupID'): g for g in (find_table(data, 'Product Groups') or [])}
    forecasts = {f.get('forecastID'): f for f in (find_table(data, 'Forecasts') or [])}
    processes = find_table(data, 'Processes') or []
    tasks = find_table(data, 'Tasks') or []

    def event_applicability(ev_id):
        ev = events.get(ev_id) or {}
        ev_scopes, ev_products = as_list(ev.get('scopeID')), as_list(ev.get('productID'))
        out = []
        for ps in pss:
            if ev_scopes and not (set(as_list(ps.get('scopeID'))) & set(ev_scopes)):
                continue
            if ev_products:
                pg = pgs.get(ps.get('productGroupID'))
                if not pg or not (set(as_list(pg.get('productID'))) & set(ev_products)):
                    continue
            out.append(ps.get('productScopeID'))
        return out

    def sla_ids_of(customer):
        return {s.get('slaID') for s in slas
                if customer in as_list(s.get('customerID'))
                and str(s.get('isActive') or 'Active') != 'Inactive'}

    def admitted_scopes(ticket):
        cust_slas = sla_ids_of(ticket.get('customerID'))
        ids = []
        for s in slas:
            if s.get('slaID') not in cust_slas:
                continue
            for pid in as_list(s.get('payloadID')):
                p = payloads.get(pid)
                if not p or str(p.get('eventID')) != str(ticket.get('eventID')):
                    continue
                packaged = as_list(p.get('productScopeID')) or event_applicability(p.get('eventID'))
                for x in packaged:
                    if x not in ids:
                        ids.append(x)
        return ids or event_applicability(ticket.get('eventID'))

    seeded = linked = restamped = 0
    for i, t in enumerate(tickets):
        if not t.get('productScopeID'):
            adm = sorted(admitted_scopes(t))
            if adm:
                t['productScopeID'] = adm[0]
                seeded += 1
        chosen = t.get('productScopeID')
        procs = [p.get('processID') for p in processes
                 if str(p.get('eventID')) == str(t.get('eventID'))
                 and (not as_list(p.get('productScopeID'))
                      or (chosen and chosen in as_list(p.get('productScopeID'))))]
        if procs and t.get('processID') != procs:
            t['processID'] = procs
            restamped += 1
        if 'forecastScopeID' not in t:
            cust_slas = sla_ids_of(t.get('customerID'))
            cands = [s for s in scopes
                     if str(s.get('eventID')) == str(t.get('eventID'))
                     and (not chosen or not s.get('productScopeID')
                          or str(s.get('productScopeID')) == str(chosen))
                     and (forecasts.get(s.get('forecastID')) or {}).get('slaID') in cust_slas]
            if cands and i % 3 != 0:
                t['forecastScopeID'] = cands[i % len(cands)].get('forecastScopeID')
                linked += 1
            else:
                t['forecastScopeID'] = None

    dropped = 0
    for s in scopes:
        if 'consumption' in s:
            s.pop('consumption')
            dropped += 1

    jobs = find_table(data, 'Jobs') or []
    tickets_by_id = {t.get('ticketID'): t for t in tickets}
    tasks_by_event = {}
    for tk in tasks:
        tasks_by_event.setdefault(str(tk.get('eventID')), []).append(tk.get('taskID'))
    for evk in tasks_by_event:
        tasks_by_event[evk].sort()
    reseeded = 0
    for j, job in enumerate(jobs):
        tkt = tickets_by_id.get(job.get('ticketID'))
        chain = tasks_by_event.get(str((tkt or {}).get('eventID')), [])
        if chain:
            new = chain[j % len(chain)]
            if job.get('taskID') != new:
                job['taskID'] = new
                reseeded += 1

    if seeded or linked or restamped or dropped or reseeded:
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
        print(f'{path.name}: productScope seeded={seeded}, forecast linked={linked}, '
              f'process restamped={restamped}, consumption dropped={dropped}, jobs retasked={reseeded}')
    else:
        print(f'{path.name}: no changes')


def main():
    for target in TARGETS:
        if target.exists():
            migrate(target)
        else:
            print(f'{target}: not found — skipped')


if __name__ == '__main__':
    sys.exit(main())
