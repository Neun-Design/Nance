#!/usr/bin/env python3
"""Projects form slim-down (Rafael's logical correction, sv111).

Since #350/sv110 the ticket's contract universe is the Applicant →
Supplier → Branch basis over ALL active SLAs, and since sv108 the only
branch trace of inheritance is the ticket's OUTPUT branch — so pointing
an SLA (or a branch) at PROJECT registration was a dead input that could
only confuse the user. The Branch and SLA inputs leave the Projects form
and their stored keys retire entirely:

- `Projects.branchID` (#316, sv72) — sole reader was the retired
  `slasForProject` picker; 0/10 demo rows carried a value.
- `Projects.slaID` (#192) — sole readers were the picker and the
  `productScopeName` coverage mirror (also retired: a coverage column
  sourced from a no-longer-editable link would mislead).

The Customer input STAYS — it filters the ticket's Project options and
feeds the inheritance parties (project customer + applicant, Rule 2 of
INHERITANCE_CONTRACT.md). Parity requires removed attrs to leave the
data: this purges both keys from every Projects row in both copies.
`productScopeName` was derived (never stored) — nothing to purge.

The frozen transformers testdata stays unmigrated (#284).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COPIES = [
    ROOT / 'data' / 'mockup_data_prototype.json',
    ROOT.parent / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 111
DROP = ('branchID', 'slaID', 'productScopeName')


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
    stats = {'projects': 0, 'purged': 0}
    for p in tables.get('Projects', []):
        stats['projects'] += 1
        for key in DROP:
            if key in p:
                del p[key]
                stats['purged'] += 1
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
