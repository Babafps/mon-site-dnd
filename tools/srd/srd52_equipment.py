# -*- coding: utf-8 -*-
"""Équipement du SRD 5.2.1 FR -> data/srd/2024/fr/equipment.json

Armes et armures viennent de leurs tableaux ; outils et matériel d'aventurier
de leurs descriptions (« Nom (prix) » puis texte), complétées par le poids
du tableau « Matériel d'aventurier » ; montures et véhicules de leurs tableaux.
"""

import re

from srd52_pdf import fold, squash
from srd52_maps import DAMAGE_IDS, IdMaker, flat_block, key

PROPS = {'finesse': 'finesse', 'lancer': 'thrown', 'legere': 'light', 'polyvalente': 'versatile',
         'munitions': 'ammunition', 'chargement': 'loading', 'deux mains': 'two-handed',
         'allonge': 'reach', 'lourde': 'heavy', 'speciale': 'special'}
MASTERY = {'coup double': 'coup_double', 'ecorchure': 'ecorchure', 'enchainement': 'enchainement',
           'ouverture': 'ouverture', 'poussee': 'poussee', 'ralentissement': 'ralentissement',
           'renversement': 'renversement', 'sape': 'sape'}
# Noms changés depuis 2014 : on garde l'identifiant (fiches, bottes d'arme).
EXTRA_IDS = {
    'Mousquet': 'musket', 'Pistolet': 'pistol',
    'Armure matelassée': 'padded-armor', 'Armure de cuir': 'leather-armor',
    'Armure de cuir clouté': 'studded-leather-armor', 'Armure de peaux': 'hide-armor',
    'Armure d’écailles': 'scale-mail',
}
COST_RX = re.compile(r'\((\s*(?:[\d  ,]+\s*(?:pc|pa|pe|po|pp)|variable)\s*)\)\s*$')


def kg(s):
    t = fold(s).replace(',', '.')
    m = re.search(r'([\d.]+)\s*(kg|g)\b', t)
    if not m:
        return None
    v = float(m.group(1))
    return round(v / 1000, 3) if m.group(2) == 'g' else v


def meters(s):
    return float(s.replace(',', '.'))


def split_top(text):
    parts, depth, buf = [], 0, ''
    for ch in text:
        depth += ch == '('
        depth -= ch == ')'
        if ch == ',' and depth == 0:
            parts.append(buf.strip())
            buf = ''
        else:
            buf += ch
    if buf.strip():
        parts.append(buf.strip())
    return [p for p in parts if p and p != '—']


def weapons(table, ids, report):
    out, cat, rng = [], 'Simple', 'Melee'
    for r in table['rows']:
        if len(r) == 1:
            g = fold(r[0])
            cat = 'Martial' if 'guerre' in g else 'Simple'
            rng = 'Ranged' if 'distance' in g else 'Melee'
            continue
        name, dmg, props, mastery, weight, cost = (list(r) + [''] * 6)[:6]
        if not dmg:                                    # « Hache à deux mains 1d12 tranchants »
            m = re.match(r'^(.*?)\s+(\d+d\d+|\d+)\s+(\S+)$', name)
            if m:
                name, dmg = m.group(1), m.group(2) + ' ' + m.group(3)
        e = {'id': ids(name), 'name': name, 'category': 'weapon',
             'weapon_category': cat, 'weapon_range': rng}
        dm = re.match(r'(\d+(?:d\d+)?)\s+(\S+)', dmg)
        if dm:
            t = fold(dm.group(2))
            e['damage'] = {'dice': dm.group(1), 'type': DAMAGE_IDS.get(t.rstrip('s'), t)}
        keys = []
        e['range_m'] = {'normal': 1.5}
        for p in split_top(props):
            pf = fold(p)
            k = PROPS.get(re.sub(r'\s*\(.*', '', pf).strip())
            if k and k not in keys:
                keys.append(k)
            par = re.search(r'\(([^()]*)\)', p)
            if k == 'versatile' and par:
                e['versatile_damage'] = par.group(1)
            rm = re.search(r'portee\s+([\d,]+)/([\d,]+)', pf)
            if rm:
                rr = {'normal': meters(rm.group(1)), 'long': meters(rm.group(2))}
                if k == 'thrown' and rng == 'Melee':
                    e['throw_range_m'] = rr
                else:
                    e['range_m'] = rr
        if 'reach' in keys and rng == 'Melee':
            e['range_m'] = {'normal': 3.0}
        e['properties'] = keys
        if props and props != '—':
            e['properties_text'] = props
        mk = MASTERY.get(fold(mastery))
        if mk:
            e['mastery'] = mk
            e['mastery_name'] = mastery
        w = kg(weight)
        if w is not None:
            e['weight_kg'] = w
        e['cost'] = cost
        if not dm or not mk:
            report.append('!! arme « %s » : dégâts ou botte illisibles' % name)
        out.append(e)
    return out


def armors(table, ids, report):
    out, cat = [], None
    for r in table['rows']:
        if len(r) == 1:
            g = fold(r[0])
            cat = ('Light' if 'legere' in g else 'Medium' if 'intermediaire' in g
                   else 'Heavy' if 'lourde' in g else 'Shield')
            continue
        name, ca, force, disc, weight, cost = (list(r) + [''] * 6)[:6]
        m = re.match(r'\s*\+?(\d+)', ca)
        if not m:
            report.append('!! armure « %s » : CA illisible' % name)
            continue
        e = {'id': ids(name), 'name': name, 'category': 'armor', 'armor_category': cat,
             'armor_class': {'base': int(m.group(1)), 'dex_bonus': 'dex' in fold(ca)},
             'armor_class_text': ca, 'cost': cost}
        mx = re.search(r'max\s*(\d+)', fold(ca))
        if mx:
            e['armor_class']['max_bonus'] = int(mx.group(1))
        sm = re.search(r'(\d+)', force)
        if sm:
            e['str_minimum'] = int(sm.group(1))
        if 'desavantage' in fold(disc):
            e['stealth_disadvantage'] = True
        w = kg(weight)
        if w is not None:
            e['weight_kg'] = w
        out.append(e)
    return out


def described(blocks, section, category, ids):
    """Entrées « Nom (prix) » d'une section de niveau 2."""
    out, on, cur = [], False, None
    for b in blocks:
        if b['t'] == 'h' and b['lvl'] <= 2:
            on, cur = fold(b['text']) == fold(section), None
            continue
        if not on:
            continue
        if b['t'] == 'h' and b['lvl'] == 3:
            cur = None
            continue
        if b['t'] == 'h' and b['lvl'] == 4:
            m = COST_RX.search(b['text'])
            if m:
                name = b['text'][:m.start()].strip()
                cur = {'id': ids(name), 'name': name, 'category': category,
                       'cost': squash(m.group(1)), 'desc': []}
                out.append(cur)
                continue
        if cur is None:
            continue
        if b['t'] == 'field' and fold(b['label']) == 'poids':
            w = kg(b['value'])
            if w is not None:
                cur['weight_kg'] = w
            continue
        if b['t'] == 'table' and b.get('title') is None and not b['headers']:
            continue
        cur['desc'].extend(flat_block(b))
    for e in out:
        if not e['desc']:
            del e['desc']
    return out


def mounts(tables, ids):
    out = []
    for t in tables:
        title = fold(t.get('title') or '')
        group = None
        for r in t['rows']:
            if len(r) == 1:
                group = r[0]
                continue
            name = r[0]
            if group and name[:1].islower():
                name = '%s %s' % (group, name)
            else:
                group = None
            e = {'id': ids(name), 'name': name, 'category': 'mounts-and-vehicles', 'cost': r[-1]}
            if title.startswith('montures'):
                e['capacity'] = r[1]
            elif title.startswith('harnachement'):
                w = kg(r[1])
                if w is not None:
                    e['weight_kg'] = w
            else:
                e['speed'] = r[1]
                e['desc'] = [' · '.join('%s : %s' % (h, v) for h, v in zip(t['headers'][2:-1], r[2:-1]))]
            out.append(e)
    return out


def parse(doc, report):
    blocks = doc.chapter('equipement')
    tables = [b for b in blocks if b['t'] == 'table']
    ids = IdMaker('equipment', EXTRA_IDS)
    out = []
    wt = next(t for t in tables if t.get('title') == 'Armes')
    at = next(t for t in tables if t.get('title') == 'Armures')
    out += weapons(wt, ids, report)
    out += armors(at, ids, report)
    out += described(blocks, 'Outils', 'tools', ids)
    gear = described(blocks, 'Matériel d’aventurier', 'adventuring-gear', ids)

    # Poids du tableau « Matériel d'aventurier » (deux colonnes, deux tableaux).
    i = tables.index(next(t for t in tables if t.get('title') == 'Matériel d’aventurier'))
    weights = {}
    for t in tables[i:i + 2]:
        hk = [fold(h) for h in t['headers']]
        if 'poids' not in hk:
            continue
        for r in t['rows']:
            if len(r) > hk.index('poids'):
                weights[key(r[0])] = r[hk.index('poids')]
    for e in gear:
        w = weights.get(key(e['name']))
        if w and 'weight_kg' not in e and kg(w) is not None:
            e['weight_kg'] = kg(w)
    out += gear
    out += mounts([t for t in tables if fold(t.get('title') or '').startswith(
        ('montures', 'harnachement', 'vehicules'))], ids)
    report.append('   équipement : %d (armes %d, armures %d, outils %d, matériel %d)' % (
        len(out), sum(e['category'] == 'weapon' for e in out), sum(e['category'] == 'armor' for e in out),
        sum(e['category'] == 'tools' for e in out), len(gear)))
    out.sort(key=lambda e: fold(e['name']))
    return out, ids.unmatched
