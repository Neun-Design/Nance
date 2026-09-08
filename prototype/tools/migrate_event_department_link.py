#!/usr/bin/env python3
"""Event ↔ Department link (issue #352 re-scoped, schemaVersion 92).

Rafael's re-scope (issue comment): the department flag belongs on EVENTS,
not Product Scopes — an event is fundamentally the request a DEPARTMENT
must fulfill for its clients; Event × Product Scope = the Payload. On the
Payload form the chosen Department now filters the Event options.

Seeds (census-first — the (a) decision transplanted from the PS plan):

- `Events.departmentID` (new single FK, nullable) = the first IN-UNIT
  department among the processes chaining the event (Processes row order,
  deduped; the payload sv68 signal always agrees with it — 6/6 clinic),
  else the event's unit's first department (Departments row order).
  Clinic: 20/20 keyed (4 in-unit signals, 2 cross-unit signals fall to
  the fallback — EV06/EV11, the #344 divergence family; re-keying the
  event's unit stays discarded), 14 no-signal fallbacks. Developer copy:
  honest nulls where the chain gives nothing.

- INVARIANT `payload.departmentID ≡ event.departmentID` — the payload
  mirrors its event's answering department, so the department-filtered
  Event picker keeps offering every stored pick (form-integrity; without
  it 3 clinic payloads would orphan: PLD07/PLD08 DPT02→DPT03, PLD10
  DPT05→DPT04; the 4 formerly-null admin payloads gain their key).

- `SLA.departmentID` re-keys to the new majority department of its
  payloads (first-seen tiebreak — the sv68 rule; unchanged rows kept).

Runs on both mockup copies; the frozen transformers testdata stays
unmigrated by design (missing keys read as blank — legacy tolerance).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COPIES = [
    ROOT / 'data' / 'mockup_data_prototype.json',
    ROOT.parent / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 92


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


def seed_events(tables, stats):
    dept_unit = {d['departmentID']: d.get('businessUnitID')
                 for d in tables.get('Departments', [])}
    by_unit = {}
    for d in tables.get('Departments', []):
        by_unit.setdefault(d.get('businessUnitID'), []).append(d['departmentID'])
    candidates = {}
    for pr in tables.get('Processes', []):
        for ev in as_list(pr.get('eventID')):
            d = pr.get('departmentID')
            if d and d not in candidates.setdefault(str(ev), []):
                candidates[str(ev)].append(d)
    for e in tables.get('Events', []):
        ev, unit = str(e['eventID']), e.get('businessUnitID')
        cands = candidates.get(ev, [])
        in_unit = [d for d in cands if dept_unit.get(d) == unit]
        if in_unit:
            e['departmentID'] = in_unit[0]
            stats['events_in_unit_signal'] += 1
        else:
            fallback = (by_unit.get(unit) or [None])[0]
            e['departmentID'] = fallback
            if cands:
                stats['events_cross_unit_fallback'] += 1
            elif fallback:
                stats['events_no_signal_fallback'] += 1
            else:
                stats['events_null'] += 1


def migrate(path):
    raw = path.read_text(encoding='utf-8')
    mock = json.loads(raw)
    tables = tables_of(mock)
    stats = {'events_in_unit_signal': 0, 'events_cross_unit_fallback': 0,
             'events_no_signal_fallback': 0, 'events_null': 0,
             'payloads_rekeyed': 0, 'payloads_newly_keyed': 0,
             'payloads_unchanged': 0, 'slas_rekeyed': 0}
    seed_events(tables, stats)
    ev_dept = {str(e['eventID']): e.get('departmentID')
               for e in tables.get('Events', [])}
    # invariant: payload.departmentID ≡ event.departmentID
    for p in tables.get('Payload', []):
        new = ev_dept.get(str(p.get('eventID')))
        old = p.get('departmentID')
        if old == new:
            stats['payloads_unchanged'] += 1
        elif old in (None, ''):
            stats['payloads_newly_keyed'] += 1
        else:
            stats['payloads_rekeyed'] += 1
        p['departmentID'] = new
    # SLA supplying department = majority of its payloads' departments
    # (first-seen tiebreak — the sv68 rule); kept when the majority is null
    pl_dept = {str(p['payloadID']): p.get('departmentID')
               for p in tables.get('Payload', [])}
    for s in tables.get('SLA', []):
        counts, order = {}, []
        for pid in as_list(s.get('payloadID')):
            d = pl_dept.get(str(pid))
            if not d:
                continue
            if d not in counts:
                order.append(d)
            counts[d] = counts.get(d, 0) + 1
        new = max(order, key=lambda v: counts[v], default=None)
        if new and new != s.get('departmentID'):
            s['departmentID'] = new
            stats['slas_rekeyed'] += 1
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
