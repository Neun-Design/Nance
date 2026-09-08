#!/usr/bin/env python3
"""productScopeName goes live-derived (issue #372 follow-up, schemaVersion 102).

The picker hints (psOption) read `productScopeName`, but the authored rule
used the 'X from FK' CONCAT spelling — never implemented by computedConcat
(the #179 trap) — so UI-created product scopes rendered the dash. The rule
is re-pointed to the implemented sibling-hop spelling with Rafael's format:

    productGroupName | <specs summary> | scopeName

and the attr becomes a validator-safe `mirror` (derived). Stored values win
over CONCAT rules (#214), so this migration DROPS the stored demo copies —
demo and MVP rows now resolve identically through the live rule. The seed
builder keeps the name in memory for its anchors (pack_of, name index) and
strips the key at assembly.

The frozen transformers testdata stays unmigrated (#284) — its stored names
keep rendering (stored wins is the tolerance there).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COPIES = [
    ROOT / 'data' / 'mockup_data_prototype.json',
    ROOT.parent / 'sourceFiles' / 'developer' / 'mockup_data_prototype.json',
]
SCHEMA_VERSION = 102


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
    stats = {'dropped': 0, 'rows': 0}
    for ps in tables.get('Product Scopes', []):
        stats['rows'] += 1
        if 'productScopeName' in ps:
            del ps['productScopeName']
            stats['dropped'] += 1
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
