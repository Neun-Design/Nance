#!/usr/bin/env python3
"""Ticket Constraints redefinition (issue #359 redefined, schemaVersion 96).

Rafael's redefinition of the #359 flag application: the Selectable-on-
Tickets requirements are NOT manual additions to the ticket's requirement
set — they are an additional FILTER layer for the ticket's Product Scope
options. The Request-step input is renamed CONSTRAINTS, moves BEFORE
Product Scope, and offers the flagged requirements of the ticket's
business unit; the picks narrow the Product Scope options to the scopes
whose comprehensive PS-REQUIREMENTS set covers them (AND). The #359
manual-union in ticketRequirements is retired — inheritance is the only
requirement source again (the original constraint of the issue).

Data steps:

- Tickets: `addedRequirementID` RENAMED `constraintID` (parity — removed
  attrs must leave the data); every seed was [] so the rename is a pure
  key move, zero at-rest changes.

- Requirements: `businessUnitID` becomes MANDATORY (pre-RBAC correction —
  every requirement must declare its unit). The 18 clinic rows carried an
  EMPTY key, which under Q1 meant "applies to every unit" — the seed makes
  that explicit: businessUnitID := ALL units (row order). Chain-preserving
  by construction: matchRequirements' unit gate, requirementsForUnit
  (#304), the PS-REQUIREMENTS exclusion gates and the forecast rollup all
  treat an all-units key exactly like the empty one — zero flips at rest
  (TICKET-INPUTS 137/160 guard in the proof). Narrowing a row to its real
  owning unit is a data decision made in the UI.

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
SCHEMA_VERSION = 96


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


def migrate(path):
    raw = path.read_text(encoding='utf-8')
    mock = json.loads(raw)
    tables = tables_of(mock)
    all_units = [u['businessUnitID'] for u in tables.get('Business Units', [])]
    stats = {'tickets_renamed': 0, 'requirements_units_seeded': 0,
             'requirements_already_keyed': 0}
    for t in tables.get('Tickets', []):
        if 'addedRequirementID' in t:
            t['constraintID'] = t.pop('addedRequirementID')
            stats['tickets_renamed'] += 1
        elif 'constraintID' not in t:
            t['constraintID'] = []
            stats['tickets_renamed'] += 1
    for r in tables.get('Requirements', []):
        if r.get('businessUnitID') in (None, '', []):
            r['businessUnitID'] = list(all_units)
            stats['requirements_units_seeded'] += 1
        else:
            stats['requirements_already_keyed'] += 1
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
