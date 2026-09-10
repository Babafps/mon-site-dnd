# -*- coding: utf-8 -*-
"""Historiques, espèces et dons du SRD 5.2.1 FR
-> backgrounds.json, races.json (les « espèces » de 2024), feats.json"""

import re

from srd52_pdf import fold, squash
from srd52_maps import IdMaker, after_runin, flat_block

BACKGROUND_IDS = {'Criminel': 'criminal', 'Sage': 'sage', 'Soldat': 'soldier'}
SPECIES_IDS = {'Drakéide': 'dragonborn', 'Nain': 'dwarf', 'Elfe': 'elf', 'Gnome': 'gnome',
               'Goliath': 'goliath', 'Halfelin': 'halfling', 'Humain': 'human', 'Orc': 'orc',
               'Tieffelin': 'tiefling'}
FEAT_IDS = {'Doué': 'skilled', 'Initié à la magie': 'magic-initiate',
            'Sauvagerie martiale': 'savage-attacker', 'Vigilant': 'alert',
            'Amélioration de caractéristique': 'ability-score-improvement',
            'Empoigneur': 'grappler'}


def split_list(text):
    return [p.strip(' .') for p in re.split(r',\s*|\s+et\s+', text or '') if p.strip(' .')]


def section(blocks, title):
    """Blocs d'une section de niveau 3 (jusqu'au titre de niveau ≤ 3 suivant)."""
    out, on = [], False
    for b in blocks:
        if b['t'] == 'h' and b['lvl'] <= 3:
            if on:
                break
            on = fold(b['text']) == fold(title)
            continue
        if on:
            out.append(b)
    return out


def entries(blocks):
    """Découpe en entrées sur les titres de niveau 4."""
    out = []
    for b in blocks:
        if b['t'] == 'h' and b['lvl'] == 4:
            out.append({'name': b['text'], 'page': b['page'], 'blocks': []})
        elif out:
            out[-1]['blocks'].append(b)
    return out


def equipment(value):
    intro, body = '', value
    if fold(value).startswith('choisissez') and ':' in value:
        intro, body = value.split(':', 1)
        intro = intro.strip() + ' :'
    return {'intro': intro, 'items': [re.sub(r'^ou\s+', '', x.strip()) for x in body.split(';') if x.strip()]}


def backgrounds(doc, report):
    blocks = doc.chapter('origines')
    ids = IdMaker('backgrounds', BACKGROUND_IDS)
    out = []
    for ent in entries(section(blocks, 'Description des historiques')):
        f = {fold(b['label']): b['value'] for b in ent['blocks'] if b['t'] == 'field'}
        get = lambda p: next((v for k, v in f.items() if k.startswith(p)), '')
        e = {'id': ids(ent['name']), 'name': ent['name'],
             'ability_scores': split_list(get('valeurs')),
             'feat': re.sub(r'\s*\(cf\..*?\)\s*$', '', get('don')),
             'proficiencies': {'skills': split_list(get('maitrises de competence')),
                               'tools': get('maitrise d')},
             'equipment': equipment(get('equipement')),
             'desc': ['%s : %s' % (b['label'], b['value']) for b in ent['blocks'] if b['t'] == 'field']}
        e['desc'] += [x for b in ent['blocks'] if b['t'] != 'field' for x in flat_block(b)]
        if len(e['ability_scores']) != 3 or not e['feat'] or len(e['proficiencies']['skills']) != 2:
            report.append('!! historique « %s » incomplet' % ent['name'])
        out.append(e)
    report.append('   historiques : %d' % len(out))
    return out


def species(doc, report):
    blocks = doc.chapter('origines')
    ids = IdMaker('races', SPECIES_IDS)
    out = []
    for ent in entries(section(blocks, 'Description des espèces')):
        e = {'id': ids(ent['name']), 'name': ent['name'], 'desc': [], 'traits': [], 'subraces': []}
        trait = None
        for b in ent['blocks']:
            if b['t'] == 'field':
                k = fold(b['label'])
                if k.startswith('type'):
                    e['creature_type'] = b['value']
                elif 'taille' in k:
                    e['size'] = b['value']
                elif k.startswith('vitesse'):
                    e['speed'] = b['value']
                continue
            if b['t'] == 'p' and b.get('runin'):
                trait = {'name': b['runin'].strip().rstrip('.').strip(), 'text': [after_runin(b)]}
                e['traits'].append(trait)
                continue
            lines = flat_block(b)
            (trait['text'] if trait else e['desc']).extend(lines)
        if not (e.get('size') and e.get('speed') and e['traits']):
            report.append('!! espèce « %s » incomplète' % ent['name'])
        out.append(e)
    report.append('   espèces : %d' % len(out))
    return out


def feats(doc, report):
    blocks = doc.chapter('dons')
    ids = IdMaker('feats', FEAT_IDS)
    out, cat, cur = [], None, None
    for b in blocks:
        if b['t'] == 'h' and b['lvl'] <= 3:
            f = fold(b['text'])
            cat = f if f.startswith('dons ') else None
            cur = None
            continue
        if cat is None:
            continue
        if b['t'] == 'h' and b['lvl'] == 4:
            cur = {'id': ids(b['text']), 'name': b['text'], 'desc': [], 'repeatable': False}
            out.append(cur)
            continue
        if cur is None:
            continue
        if b['t'] == 'sub' and 'category' not in cur:
            sub = squash(b['text'])
            m = re.match(r'^Don\s+(?:d[’\']|de\s+|du\s+)?(.*?)\s*(?:\(prérequis\s*:\s*(.*)\))?$', sub)
            cur['category'] = (m.group(1) if m else sub).strip()
            cur['category'] = cur['category'][:1].upper() + cur['category'][1:]
            if m and m.group(2):
                cur['prerequisite'] = m.group(2).strip()
            cur['desc'].append(sub)
            continue
        if b['t'] == 'p' and b.get('runin') and fold(b['runin']).startswith('repetable'):
            cur['repeatable'] = True
        cur['desc'].extend(flat_block(b))
    for e in out:
        if 'category' not in e or len(e['desc']) < 2:
            report.append('!! don « %s » incomplet' % e['name'])
    report.append('   dons : %d' % len(out))
    return out
