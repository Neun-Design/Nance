#!/usr/bin/env python3
"""narrative.py — the planted stories as CODE (MOCKUP_DEMO_PLAN F2).

The six §5.4 stories and the H1–H6 seed-hygiene rules (§7.1) are the demo's
regression contract: assert_narrative(flat, domain) re-checks all of them
against a generated dataset and returns the list of failures. build_seed.py
runs it at the end of every build; in F3 the validator's `== narrative ==`
block calls the same function — a re-seed that breaks a story fails the
build instead of silently regressing the demo (see tools/seed/narrative.md
for the human-readable contract).

`flat` is {tableName: rows}; `domain` is the parsed clinic.yaml.
"""
from datetime import date


def _blank(v):
    return v is None or v == '' or (isinstance(v, list) and not v)


def _as_list(v):
    if isinstance(v, list):
        return [x for x in v if not _blank(x)]
    return [v] if not _blank(v) else []


def _by(rows, pk):
    return {r.get(pk): r for r in rows}


def _month_key(d):
    s = str(d or '')[:7]
    return s if len(s) == 7 else None


def assert_narrative(flat, domain):
    fails = []
    ok = fails.append  # readability: ok('msg') registers a FAILURE
    meta = domain['meta']
    anchor = str(meta['anchorDate'])
    nar = domain['narrative']
    hyg = meta['hygiene']

    tickets = flat.get('Tickets', [])
    jobs = flat.get('Jobs', [])
    fscopes = flat.get('Forecast Scopes', [])
    forecasts = _by(flat.get('Forecasts', []), 'forecastID')
    people = _by(flat.get('People', []), 'userID')
    functions = {f.get('functionName'): f.get('functionID') for f in flat.get('Functions', [])}
    customers = {c.get('customerName'): c.get('customerID') for c in flat.get('Customers', [])}

    # ---- H1: the demand↔execution link is alive and spread ----
    linked = [t for t in tickets if not _blank(t.get('forecastScopeID'))]
    rate = len(linked) / len(tickets) if tickets else 0
    if rate < hyg['ticketLinkRate']:
        ok(f'H1: only {rate:.0%} of tickets consume a demand line (floor {hyg["ticketLinkRate"]:.0%})')
    spread = len({t['forecastScopeID'] for t in linked})
    if spread < hyg['ticketLinkSpreadMin']:
        ok(f'H1: links concentrated in {spread} demand lines (floor {hyg["ticketLinkSpreadMin"]})')

    # ---- H2: consumption within quantity (no negative remaining) ----
    consumption = {}
    for t in linked:
        consumption[t['forecastScopeID']] = consumption.get(t['forecastScopeID'], 0) + 1
    over = [s for s in fscopes
            if consumption.get(s.get('forecastScopeID'), 0) > (s.get('forecastScopeQuantity') or 0)]
    if over:
        ok(f'H2: {len(over)} demand lines consumed beyond quantity (negative remaining)')

    # ---- H3/H4/H5: job lifecycle shape ----
    for j in jobs:
        status = j.get('jobStatus')
        for k in ('realStartDate', 'realEndDate', 'stoppedAt'):
            if not _blank(j.get(k)) and str(j[k])[:10] > anchor:
                ok(f'H3: {j.get("jobID")} {k} after the anchor'); break
    not_done = [j for j in jobs if j.get('jobStatus') != 'Done' and not _blank(j.get('realExecutionTime'))]
    if not_done:
        ok(f'H4: {len(not_done)} non-Done jobs carry realExecutionTime')
    bad_stop = [j for j in jobs if j.get('jobStatus') == 'Stoped'
                and (_blank(j.get('stoppedAt')) or not j.get('jobBufferExecution')
                     or not _blank(j.get('realEndDate')))]
    if bad_stop:
        ok(f'H5: {len(bad_stop)} Stoped jobs malformed (need stoppedAt + buffer, no end)')

    # ---- H6: real mass in every forecast period ----
    per = {}
    for f in flat.get('Forecasts', []):
        per[f.get('forecastPeriod')] = per.get(f.get('forecastPeriod'), 0) + 1
    for period, want in hyg['forecastPeriodMasses'].items():
        if per.get(period, 0) < want:
            ok(f'H6: {period} forecasts {per.get(period, 0)} < {want}')

    # ---- Story 1: function bottleneck in the last N months ----
    s1 = nar['story1_bottleneck']
    fid = functions.get(s1['function'])
    cap = [c for c in flat.get('Capacity', []) if c.get('functionID') == fid]
    cap.sort(key=lambda c: (c.get('periodYear'), c.get('periodMonth')))
    tail = cap[-s1['months']:]
    if len(tail) < s1['months'] or not all(
            (c.get('allocatedHours') or 0) > (c.get('availableHours') or 0) for c in tail):
        ok(f'S1: {s1["function"]} not over-allocated in the last {s1["months"]} months')

    # ---- Story 2: certification gap on the new protocol ----
    s2 = nar['story2_certification']
    pgid = next((g.get('productGroupID') for g in flat.get('Product Groups', [])
                 if g.get('classCodeName') == s2['protocol'] or g.get('productGroupID') == s2['protocol']), None)
    ps_ids = {p.get('productScopeID') for p in flat.get('Product Scopes', [])
              if p.get('productGroupID') == pgid}
    comp_ids = {c.get('competenceID') for c in flat.get('Competence', [])
                if c.get('productScopeID') in ps_ids}
    certified, pending = set(), set()
    for ob in flat.get('Onboarding', []):
        if not set(_as_list(ob.get('competenceID'))) & comp_ids:
            continue
        (certified if ob.get('isCertified') is True else pending).add(ob.get('userID'))
    if len(certified) != s2['certified'] or len(pending) < s2['inOnboarding']:
        ok(f'S2: protocol {s2["protocol"]} has {len(certified)} certified / {len(pending)} pending '
           f'(want {s2["certified"]} / ≥{s2["inOnboarding"]})')

    # ---- Story 3: the regulation shows on matching tickets only ----
    s3 = nar['story3_requirement']
    req = next((r for r in flat.get('Requirements', []) if r.get('requirementName') == s3['name']), None)
    if req is None or str(req.get('isActive')) != 'Active':
        ok(f'S3: requirement {s3["name"]} missing or inactive')

    # ---- Story 4: the underestimated insurer forecast ----
    s4 = nar['story4_forecast_gap']
    cid = customers.get(s4['customer'])
    fc_ids = {f for f, r in forecasts.items()
              if r.get('customerID') == cid and r.get('status') == 'Approved'}
    approved = sum(r.get('totalEstimatedHours') or 0 for f, r in forecasts.items() if f in fc_ids)
    line_ids = {s.get('forecastScopeID') for s in fscopes if s.get('forecastID') in fc_ids}
    tkt_ids = {t.get('ticketID') for t in tickets if t.get('forecastScopeID') in line_ids}
    executed = sum(j.get('realExecutionTime') or 0 for j in jobs
                   if j.get('ticketID') in tkt_ids and j.get('jobStatus') == 'Done')
    if not (s4['approvedHours'] * 0.95 <= approved <= s4['approvedHours'] * 1.05):
        ok(f'S4: {s4["customer"]} approved hours {approved:.0f} ∉ {s4["approvedHours"]}±5%')
    if not (s4['executedHours'] * 0.95 <= executed <= s4['executedHours'] * 1.05):
        ok(f'S4: {s4["customer"]} executed hours {executed:.0f} ∉ {s4["executedHours"]}±5%')

    # ---- Story 5: one action recurring across processes ----
    s5 = nar['story5_recurring_action']
    act_id = next((a.get('actionID') for a in flat.get('Actions', [])
                   if a.get('actionName') == s5['action']), None)
    procs = {t.get('processID') for t in flat.get('Tasks', []) if t.get('actionID') == act_id}
    if len(procs) < s5['minProcesses']:
        ok(f'S5: action {s5["action"]} spans {len(procs)} processes (want ≥{s5["minProcesses"]})')

    # ---- Story 6: the contract balance (current quarter of the story SLA) ----
    s6 = nar['story6_sla_balance']
    sla = next((s for s in flat.get('SLA', []) if s.get('slaCode') == s6['sla']
                or s.get('slaID') == s6['sla']), None)
    if sla is None:
        ok(f'S6: SLA {s6["sla"]} not found')
    else:
        monthly = sorted((r for r in forecasts.values()
                          if r.get('slaID') == sla.get('slaID')
                          and r.get('forecastPeriod') == 'Month'
                          and r.get('status') == 'Approved'),
                         key=lambda r: str(r.get('periodStart')))
        quarter_ids = {r['forecastID'] for r in monthly[-3:]}
        lines = [s for s in fscopes if s.get('forecastID') in quarter_ids]
        qty = sum(s.get('forecastScopeQuantity') or 0 for s in lines)
        cons = sum(consumption.get(s.get('forecastScopeID'), 0) for s in lines)
        rate6 = cons / qty if qty else 0
        lo, hi = s6['consumedRate'] - 0.08, s6['consumedRate'] + 0.07
        if not (lo <= rate6 <= hi):
            ok(f'S6: current-quarter burn {rate6:.0%} ∉ [{lo:.0%}, {hi:.0%}] (qty {qty}, consumed {cons})')
        if any(consumption.get(s.get('forecastScopeID'), 0) > (s.get('forecastScopeQuantity') or 0)
               for s in lines):
            ok('S6: a contract line ran negative (H2 must hold on the story SLA too)')

    return fails
