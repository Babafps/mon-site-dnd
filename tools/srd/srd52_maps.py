# -*- coding: utf-8 -*-
"""
Correspondances et utilitaires partagés par les scripts srd52_*.py.

Les données gardent des identifiants anglais (communs aux éditions et aux
langues) ; l'affichage, lui, reste celui du PDF français.
"""

import json
import re
from pathlib import Path

from srd52_pdf import SOURCE, fold, slug, squash

ROOT = Path(__file__).resolve().parents[2]
DATA_2014 = ROOT / 'data' / 'srd' / '2014' / 'fr'
DATA_2024 = ROOT / 'data' / 'srd' / '2024' / 'fr'

CLASS_IDS = {
    'barbare': 'barbarian', 'barde': 'bard', 'clerc': 'cleric', 'druide': 'druid',
    'ensorceleur': 'sorcerer', 'guerrier': 'fighter', 'magicien': 'wizard', 'moine': 'monk',
    'occultiste': 'warlock', 'paladin': 'paladin', 'rodeur': 'ranger', 'roublard': 'rogue',
}
SCHOOL_IDS = {
    'abjuration': 'abjuration', 'invocation': 'conjuration', 'divination': 'divination',
    'enchantement': 'enchantment', 'evocation': 'evocation', 'illusion': 'illusion',
    'necromancie': 'necromancy', 'transmutation': 'transmutation',
}
DAMAGE_IDS = {
    'acide': 'acid', 'contondant': 'bludgeoning', 'froid': 'cold', 'feu': 'fire',
    'force': 'force', 'foudre': 'lightning', 'necrotique': 'necrotic', 'perforant': 'piercing',
    'poison': 'poison', 'psychique': 'psychic', 'radiant': 'radiant', 'tranchant': 'slashing',
    'tonnerre': 'thunder',
}
ABILITY_IDS = {
    'force': 'str', 'dexterite': 'dex', 'constitution': 'con',
    'intelligence': 'int', 'sagesse': 'wis', 'charisme': 'cha',
}
ABBR_IDS = {'for': 'str', 'dex': 'dex', 'con': 'con', 'int': 'int', 'sag': 'wis', 'cha': 'cha'}
ABBR_FR = {'str': 'FOR', 'dex': 'DEX', 'con': 'CON', 'int': 'INT', 'wis': 'SAG', 'cha': 'CHA'}


# ------------------------------------------------------------- identifiants

def key(name):
    """Clé de rapprochement : sans accents, casse ni différence d'apostrophe."""
    return re.sub(r'\s+', ' ', fold(name).replace('’', "'")).strip()


def ids_2014(category):
    """Nom français replié -> identifiant, d'après les données 2014."""
    path = DATA_2014 / (category + '.json')
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding='utf-8'))
    out = {}

    def add(e):
        if e.get('name') and e.get('id'):
            out.setdefault(key(e['name']), e['id'])
        for k in ('subclasses', 'subraces', 'children'):
            for s in e.get(k) or []:
                add(s)
    for e in data.get('entries') or data.get('sections') or []:
        add(e)
    return out


class IdMaker:
    """Reprend l'identifiant 2014 quand le nom français est inchangé — les
    fiches enregistrées pointent vers ces identifiants — sinon le nom en ASCII."""

    def __init__(self, category, extra=None):
        self.known = ids_2014(category) if category else {}
        self.known.update({key(k): v for k, v in (extra or {}).items()})
        self.used = set()
        self.unmatched = []

    def __call__(self, name):
        id_ = self.known.get(key(name))
        if not id_:
            id_ = slug(name)
            self.unmatched.append(name)
        base, n = id_, 2
        while id_ in self.used:
            id_ = '%s-%d' % (base, n)
            n += 1
        self.used.add(id_)
        return id_


# ------------------------------------------------------------ mise à plat

def after_runin(b):
    """Texte d'un paragraphe sans son intitulé en gras."""
    t, r = b['text'], b.get('runin') or ''
    if r and t.startswith(r):
        return t[len(r):].strip()
    return t


def abilities(sbabl):
    """Lignes de caractéristiques d'un profil -> {str: (valeur, mod, js)}."""
    txt = ' '.join(l.text for l in sbabl['lines']).replace('−', '-')
    out = {}
    for m in re.finditer(r'\b(For|Dex|Con|Int|Sag|Cha)\s+(\d+)\s+([+-]\d+)\s+([+-]?\d+)', txt):
        mod, save = int(m.group(3)), m.group(4)
        # Le PDF omet parfois le signe (« −2 2 ») : même valeur, même signe.
        js = int(save) if save[0] in '+-' else (mod if int(save) == abs(mod) else int(save))
        out[ABBR_IDS[m.group(1).lower()]] = (int(m.group(2)), mod, js)
    return out


def table_lines(t):
    out = []
    if t.get('title'):
        out.append(t['title'])
    if t.get('headers'):
        out.append(' — '.join(t['headers']))
    for r in t['rows']:
        out.append(' — '.join(c for c in r if c))
    return out


def table_obj(t):
    return {'table': {'title': t.get('title'), 'headers': t.get('headers') or [], 'rows': t['rows']}}


def flat_block(b):
    """N'importe quel bloc -> lignes de texte (pour les champs texte seul)."""
    t = b['t']
    if t == 'table':
        return table_lines(b)
    if t == 'sbprop':
        return ['%s %s' % (b['label'], b['value'])]
    if t == 'field':
        return ['%s : %s' % (b['label'], b['value'])]
    if t == 'sbabl':
        ab = abilities(b)
        return [' · '.join('%s %d (%+d)' % (ABBR_FR[k], v[0], v[1]) for k, v in ab.items())] if ab else []
    txt = squash(b.get('text') or '')
    return [txt] if txt else []


# ------------------------------------------------------------------ écriture

def write_json(category, items, key='entries'):
    DATA_2024.mkdir(parents=True, exist_ok=True)
    data = {'edition': '2024', 'lang': 'fr', 'category': category, 'source': SOURCE}
    if key == 'entries':
        data['count'] = len(items)
    data[key] = items
    path = DATA_2024 / (category + '.json')
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    return path
