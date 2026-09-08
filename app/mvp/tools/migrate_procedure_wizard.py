#!/usr/bin/env python3
"""Procedure drawer wizard round (issue #353, schemaVersion 90).

The Procedures form becomes a four-step wizard (Registry / Application /
Constraints / Inputs & Outputs — the issue's reference mockup, first
consumer of the form-spec `steps`). Data side of the round:

- Procedures gain two APPLICABILITY keys (wizard step Application):
  `branchID[]` and `customerID[]` — multivalued FKs, EMPTY = applies to all
  (Q1). Session decision: applicability is DECLARED only — the
  ticket→procedure match does not gate on these yet (the #332 posture:
  gating comes in its own round with a flip census). Seeded EMPTY on every
  row (honest: no demo procedure was ever pinned; parity requires the keys
  on every row).

- `Requirements.branchID` (stored-but-inert since the Branches round) is
  ACTIVATED in the engine (matchRequirements branch gate on the ticket's
  project branch; forecastID.slaID.branchID leg on the Forecast Scopes
  rollup; the wizard's Branches Requirements facet). No data change — the
  key already sits on every row of both copies (clinic 18/18 empty → zero
  flips at rest; the legacy developer CN9 carries a branch and now bites
  only where a project branch context exists).

Runs on both mockup copies; the frozen transformers testdata stays
unmigrated by design (missing keys read as blank = Q1 — legacy tolerance).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COPIES = [
    ROOT / 'data' / 'mockup_data_prototype.json',
    ROOT.parent / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 90


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
    stats = {'procedures': 0, 'keys_added': 0, 'requirements_with_branch': 0}
    for pr in tables.get('Procedures', []):
        stats['procedures'] += 1
        for key in ('branchID', 'customerID'):
            if key not in pr:
                pr[key] = []
                stats['keys_added'] += 1
    for r in tables.get('Requirements', []):
        v = r.get('branchID')
        if v not in (None, '', []):
            stats['requirements_with_branch'] += 1
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
