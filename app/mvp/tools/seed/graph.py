#!/usr/bin/env python3
"""graph.py — catalogue utilities for the seed pipeline (MOCKUP_DEMO_PLAN F2).

The generator is CATALOGUE-DRIVEN (plan §5.2, principle 1): this module reads
data/datamodel.json and exposes, per table, the exact STORED attribute set
(type ∉ {rollup, computed, mirror} — the same definition validate_mockup.py
enforces), the PK and the NOT NULL anchors. After the builders run,
check_dataset() compares every produced row against that contract and raises
SeedError on ANY divergence — a catalogue attribute without a seed rule
breaks the BUILD, never the demo in production.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]          # prototype/
DERIVED_TYPES = {'rollup', 'computed', 'mirror'}


class SeedError(Exception):
    """The generated dataset violates the catalogue contract."""


def load_datamodel(path=None):
    return json.loads((path or ROOT / 'data' / 'datamodel.json').read_text(encoding='utf-8'))


def catalog(dm):
    """{tableName: {module, stored, pk, required, system}} for every table."""
    out = {}
    for mname, m in dm['modules'].items():
        for tname, t in m['tables'].items():
            attrs = t['attributes']
            out[tname] = {
                'module': mname,
                'system': bool(t.get('system-registry')),
                'stored': [a['name'] for a in attrs if a['type'] not in DERIVED_TYPES],
                'pk': next((a['name'] for a in attrs if a.get('constraints') == 'PK'), None),
                'required': [a['name'] for a in attrs
                             if 'NOT NULL' in str(a.get('constraints') or '')
                             and a.get('constraints') != 'PK'],
            }
    return out


def blank(v):
    return v is None or v == '' or (isinstance(v, list) and not v)


def make_ids(prefix, n, width=2, start=1):
    """Deterministic id sequence: PRD01, PRD02, … (width grows as needed)."""
    width = max(width, len(str(start + n - 1)))
    return [f'{prefix}{i:0{width}d}' for i in range(start, start + n)]


def check_table(tname, rows, spec):
    """Contract check for one table's rows. Returns a list of failure strings."""
    fails = []
    stored = set(spec['stored'])
    for i, r in enumerate(rows):
        missing = stored - set(r)
        extra = set(r) - stored
        if missing:
            fails.append(f'{tname}[{i}]: missing stored attrs {sorted(missing)}')
        if extra:
            fails.append(f'{tname}[{i}]: extra non-canonical fields {sorted(extra)}')
    pk = spec['pk']
    if pk and rows:
        ids = [r.get(pk) for r in rows]
        if len(ids) != len(set(ids)):
            fails.append(f'{tname}: duplicate {pk} values')
    for attr in spec['required']:
        bad = sum(1 for r in rows if blank(r.get(attr)))
        if bad:
            fails.append(f'{tname}: NOT NULL {attr} blank on {bad} rows')
    return fails


def check_dataset(dm, dataset):
    """Verify the whole generated dataset against the catalogue. Raises
    SeedError listing every divergence (module presence, stored-attr parity,
    PK uniqueness, NOT NULL anchors)."""
    cat = catalog(dm)
    fails = []
    for tname, spec in cat.items():
        if spec['system']:
            continue
        rows = (dataset.get(spec['module']) or {}).get(tname)
        if rows is None:
            fails.append(f'{spec["module"]}/{tname}: table missing from dataset')
            continue
        if not rows:
            continue  # registries may start blank — validator warns, not fails
        fails.extend(check_table(tname, rows, spec))
    if fails:
        raise SeedError('catalogue contract violated:\n  ' + '\n  '.join(fails))
    return True


def fk_resolvable(dataset, table_rows, field, target_rows, target_pk):
    """Helper for spot checks: every non-blank FK value exists in the target."""
    ids = {r.get(target_pk) for r in target_rows}
    bad = []
    for r in table_rows:
        v = r.get(field)
        vals = v if isinstance(v, list) else [v]
        for x in vals:
            if not blank(x) and x not in ids:
                bad.append(x)
    return bad
