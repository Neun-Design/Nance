#!/usr/bin/env python3
"""test_seed_pipeline.py — proof of the two F2 acceptance criteria
(MOCKUP_DEMO_PLAN §6):

  1. DETERMINISM — two builds produce byte-identical JSON.
  2. EXPLICIT FAILURE — a catalogue attribute without a seed rule (here: a
     stored attribute the builders never filled) raises graph.SeedError
     instead of shipping a broken dataset.

Also re-runs the narrative/hygiene assertions in strict mode.
Run from prototype/:  python3 tools/seed/test_seed_pipeline.py
"""
import copy
import json
import sys
from pathlib import Path

SEED_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SEED_DIR))
sys.path.insert(0, str(SEED_DIR.parent))
import yaml                                          # noqa: E402
import graph                                         # noqa: E402
import narrative                                     # noqa: E402
from build_seed import Builder                       # noqa: E402

fails = 0


def check(cond, msg):
    global fails
    print(f'  {"✓" if cond else "✗"} {msg}')
    if not cond:
        fails += 1


dm = graph.load_datamodel()
domain = yaml.safe_load((SEED_DIR / 'domains' / 'clinic.yaml').read_text(encoding='utf-8'))

print('== determinism: two builds, identical bytes ==')
a = json.dumps(Builder(dm, domain).build(), sort_keys=True)
b = json.dumps(Builder(dm, domain).build(), sort_keys=True)
check(a == b, 'byte-identical output across runs (fixed seed, no wall clock)')

print('== catalogue contract: unseeded attribute breaks the BUILD ==')
dataset = Builder(dm, domain).build()
graph.check_dataset(dm, dataset)
check(True, 'the real build honors the stored-attribute contract')
dm2 = copy.deepcopy(dm)
dm2['modules']['CRM']['tables']['Customers']['attributes'].append(
    {'name': 'creditRating', 'type': 'VARCHAR', 'rule': None, 'notes': None,
     'table-display': False, 'subitem-display': False, 'constraints': None})
try:
    graph.check_dataset(dm2, dataset)
    check(False, 'a catalogue attribute without a seed rule must raise SeedError')
except graph.SeedError as e:
    check('creditRating' in str(e), 'new catalogue attribute without a rule fails explicitly')

print('== narrative + hygiene: strict ==')
flat = {}
for mod, tables in dataset.items():
    if mod != '_meta':
        flat.update(tables)
nar_fails = narrative.assert_narrative(flat, domain)
for f in nar_fails:
    print(f'    ~ {f}')
check(not nar_fails, 'all six stories and H1–H6 hold on the generated dataset')

print(f'\n{"FAIL" if fails else "ALL GREEN"}')
sys.exit(1 if fails else 0)
