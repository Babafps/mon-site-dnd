# -*- coding: utf-8 -*-
"""Objets magiques du SRD 5.2.1 FR -> data/srd/2024/fr/magic-items.json"""

import re

from srd52_pdf import fold, squash
from srd52_maps import IdMaker, flat_block

CATEGORY = [  # début du type (replié) -> catégorie, comme en 2014
    ('objet merveilleux', 'wondrous-items'), ('armure', 'armor'), ('arme', 'weapon'),
    ('anneau', 'ring'), ('baguette', 'wand'), ('baton', 'staff'), ('sceptre', 'rod'),
    ('potion', 'potion'), ('parchemin', 'scroll'), ('bouclier', 'armor'),
    ('munition', 'ammunition'),
]


def split_top(text):
    """Type, rareté : coupe à la première virgule hors parenthèses
    (« peu courante (+1), rare (+2) ou très rare (+3) » reste entier)."""
    depth = 0
    for i, ch in enumerate(text):
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
        elif ch == ',' and depth == 0:
            return text[:i].strip(), text[i + 1:].strip()
    m = re.match(r'^(.*\))\s+(\S.*)$', text)          # « Armure (…) rare » : virgule absente
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return text.strip(), ''


def parse_sub(sub):
    """« Arme (toute arme de guerre), rare (Harmonisation requise par un Paladin) »."""
    t = squash(sub)
    attune, note = False, ''
    m = re.search(r'\((Harmonisation requise[^()]*)\)\s*$', t)
    if m:
        attune = True
        note = m.group(1)[len('Harmonisation requise'):].strip()
        t = t[:m.start()].strip()
    kind, rarity = split_top(t)
    f = fold(kind)
    cat = next((c for prefix, c in CATEGORY if f.startswith(prefix)), 'wondrous-items')
    return kind, rarity, attune, note, cat


def parse(doc, report):
    blocks = doc.chapter('objets-magiques')
    start = next(i for i, b in enumerate(blocks)
                 if b['t'] == 'h' and fold(b['text']).startswith('objets magiques de a a z'))
    raw, cur = [], None
    for i in range(start + 1, len(blocks)):
        b = blocks[i]
        nxt = blocks[i + 1] if i + 1 < len(blocks) else {}
        if b['t'] == 'h' and b['lvl'] == 4 and nxt.get('t') == 'sub':
            cur = {'name': b['text'], 'page': b['page'], 'sub': None, 'desc': []}
            raw.append(cur)
            continue
        if cur is None:
            continue
        if b['t'] == 'sub' and cur['sub'] is None:
            cur['sub'] = b['text']
        else:
            cur['desc'].extend(flat_block(b))

    ids = IdMaker('magic-items')
    out = []
    for r in raw:
        kind, rarity, attune, note, cat = parse_sub(r['sub'] or '')
        e = {'id': ids(r['name']), 'name': r['name'], 'type': kind, 'rarity': rarity,
             'attunement': attune, 'category': cat, 'desc': r['desc']}
        if note:
            e['attunement_note'] = note
        bad = [k for k in ('type', 'rarity', 'desc') if not e[k]]
        if bad:
            report.append('!! objet « %s » (p%d) : %s' % (r['name'], r['page'], ', '.join(bad)))
        out.append(e)
    report.append('   objets magiques : %d (%d identifiants hors 2014)' % (len(out), len(ids.unmatched)))
    out.sort(key=lambda e: fold(e['name']))
    return out, ids.unmatched
