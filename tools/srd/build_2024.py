# -*- coding: utf-8 -*-
"""
Régénère data/srd/2024/fr/ depuis le SRD 5.2.1, version française officielle
de Wizards of the Coast (règles 2024, licence CC-BY-4.0).

    pip install pymupdf
    python tools/srd/build_2024.py [--pdf chemin/FR_SRD_CC_v5.2.1.pdf]

Sans --pdf, le PDF est téléchargé une fois dans tools/srd/cache/.
Les fichiers ont la même forme que ceux de 2014 : srd-data.js, la page Règles,
l'assistant de création et la montée de niveau les lisent sans cas particulier.
Le script échoue (code 1) si une anomalie « !! » est signalée.
"""

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from srd52_pdf import PDF_NAME, Doc, fetch_pdf, fold  # noqa: E402
from srd52_maps import DATA_2024, write_json  # noqa: E402
import srd52_classes  # noqa: E402
import srd52_equipment  # noqa: E402
import srd52_items  # noqa: E402
import srd52_monsters  # noqa: E402
import srd52_origins  # noqa: E402
import srd52_rules  # noqa: E402
import srd52_spells  # noqa: E402

SCHOOL_FR = {'abjuration': 'Abjuration', 'conjuration': 'Invocation', 'divination': 'Divination',
             'enchantment': 'Enchantement', 'evocation': 'Évocation', 'illusion': 'Illusion',
             'necromancy': 'Nécromancie', 'transmutation': 'Transmutation'}
EQUIP_FR = {'weapon': 'Arme', 'armor': 'Armure', 'tools': 'Outils',
            'adventuring-gear': 'Équipement', 'mounts-and-vehicles': 'Monture et véhicule'}


def snippet(lines):
    txt = ' '.join(x for x in (lines or []) if isinstance(x, str)).strip()
    return txt if len(txt) <= 110 else txt[:110].rstrip() + '…'


def row(cat, id_, name, sub, text=None):
    e = {'c': cat, 'i': id_, 'n': name, 's': sub}
    t = snippet(text) if text else ''
    if t:
        e['t'] = t
    e['f'] = fold(name + ' ' + sub)
    return e


def build_index(d):
    idx = []
    for s in d['spells']:
        lv = 'Sort mineur' if s['level'] == 0 else 'Niveau %d' % s['level']
        idx.append(row('spells', s['id'], s['name'], '%s · %s' % (lv, SCHOOL_FR.get(s['school'], '')), s['desc']))
    for m in d['monsters']:
        idx.append(row('monsters', m['id'], m['name'],
                       '%s · FP %s · CA %s · %s PV' % (m['type'], m['cr_display'], m['ac'], m['hp'])))
    for e in d['magic-items']:
        idx.append(row('magic-items', e['id'], e['name'], ' · '.join(x for x in (e['type'], e['rarity']) if x), e['desc']))
    for e in d['equipment']:
        idx.append(row('equipment', e['id'], e['name'],
                       ' · '.join(x for x in (EQUIP_FR.get(e['category'], 'Équipement'), e.get('cost')) if x),
                       e.get('desc')))
    for e in d['conditions']:
        idx.append(row('conditions', e['id'], e['name'], 'État', e['desc']))
    for e in d['races']:
        idx.append(row('races', e['id'], e['name'], 'Espèce', e['desc'] + [t['text'][0] for t in e['traits'][:1]]))
    for c in d['classes']:
        idx.append(row('classes', c['id'], c['name'], 'Classe'))
        for s in c['subclasses']:
            idx.append(row('classes', s['id'], s['name'], 'Sous-classe · ' + c['name'], s['desc']))
    for e in d['backgrounds']:
        idx.append(row('backgrounds', e['id'], e['name'], 'Historique', e['desc']))
    for e in d['feats']:
        idx.append(row('feats', e['id'], e['name'], 'Don · ' + e.get('category', ''), e['desc'][1:]))

    def walk(n, parent):
        idx.append(row('rules', n['id'], n['name'], parent or 'Règles', n['content']))
        for ch in n['children']:
            walk(ch, n['name'])
    for s in d['rules']:
        walk(s, None)
    return idx


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--pdf', default=str(HERE / 'cache' / PDF_NAME))
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding='utf-8')

    doc = Doc(fetch_pdf(args.pdf))
    report = []
    data = {}
    data['spells'], _ = srd52_spells.parse(doc, report)
    data['monsters'], _ = srd52_monsters.parse(doc, report)
    data['magic-items'], _ = srd52_items.parse(doc, report)
    data['equipment'], _ = srd52_equipment.parse(doc, report)
    data['classes'], _ = srd52_classes.parse(doc, report)
    data['backgrounds'] = srd52_origins.backgrounds(doc, report)
    data['races'] = srd52_origins.species(doc, report)
    data['feats'] = srd52_origins.feats(doc, report)
    data['conditions'] = srd52_rules.conditions(doc, report)
    data['rules'] = srd52_rules.parse(doc, report)

    # Les sorts cités par les listes de classe doivent exister dans spells.json.
    for c in data['classes']:
        if c.get('spellcasting') and not any(c['id'] in s['classes'] for s in data['spells']):
            report.append('!! %s : aucun sort ne déclare cette classe' % c['id'])

    for cat, items in data.items():
        write_json(cat, items, 'sections' if cat == 'rules' else 'entries')
    idx = build_index(data)
    path = DATA_2024 / 'index.json'
    path.write_text(json.dumps({'edition': '2024', 'lang': 'fr', 'count': len(idx), 'entries': idx},
                               ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    print('\n'.join(report))
    print('index : %d entrées -> %s' % (len(idx), DATA_2024))
    return 1 if any(line.startswith('!!') for line in report) else 0


if __name__ == '__main__':
    sys.exit(main())
