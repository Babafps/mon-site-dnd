# -*- coding: utf-8 -*-
"""Règles du SRD 5.2.1 FR -> rules.json (arbre) et conditions.json (états)

L'arbre reprend les chapitres de règles pures (« Comment jouer », « Création
de personnage », glossaire, boîte à outils) et l'introduction des chapitres
dont les entrées vivent ailleurs (dons, équipement, sorts, objets, monstres).
Les tableaux restent des tableaux : {"table": {title, headers, rows}}.
"""

import re

from srd52_pdf import CHAPTERS, fold, slug
from srd52_maps import flat_block, table_obj

CONDITION_IDS = {
    'a terre': 'prone', 'agrippe': 'grappled', 'assourdi': 'deafened', 'aveugle': 'blinded',
    'charme': 'charmed', 'effraye': 'frightened', 'empoisonne': 'poisoned', 'entrave': 'restrained',
    'epuisement': 'exhaustion', 'etourdi': 'stunned', 'inconscient': 'unconscious',
    'invisible': 'invisible', 'neutralise': 'incapacitated', 'paralyse': 'paralyzed',
    'petrifie': 'petrified',
}
INCLUDED = ['comment-jouer', 'creation-de-personnage', 'origines', 'dons', 'equipement', 'sorts',
            'glossaire', 'boite-a-outils', 'objets-magiques', 'monstres']


def skipped(chapter, path):
    """Parties déjà publiées dans une autre catégorie. `path` : titres repliés
    de niveau 2, 3, 4 en cours."""
    h2, h3 = (path + ['', ''])[:2]
    if chapter == 'origines':
        return h3.startswith(('description des historiques', 'description des especes'))
    if chapter == 'dons':
        return h3.startswith('dons ')
    if chapter == 'equipement':
        return ((h2 == 'materiel d’aventurier' and len(path) >= 3)
                or (h2 == 'outils' and h3 in ('outils d’artisan', 'autres outils')))
    return False


def stops(chapter, b):
    if b['t'] in ('sbname', 'sbprop', 'sbabl'):
        return True
    if b['t'] != 'h' or b['lvl'] != 2:
        return False
    f = fold(b['text'])
    return ((chapter == 'sorts' and f == 'description des sorts')
            or (chapter == 'objets-magiques' and f.startswith('objets magiques de a a z'))
            or (chapter == 'monstres' and f.startswith('monstres de a a z')))


class Tree:
    def __init__(self):
        self.ids = set()

    def node(self, name, parent=None):
        base = slug(name) or 'section'
        id_ = base
        if id_ in self.ids and parent:
            id_ = '%s-%s' % (parent['id'], base)
        n = 2
        while id_ in self.ids:
            id_ = '%s-%d' % (base, n)
            n += 1
        self.ids.add(id_)
        return {'id': id_, 'name': name, 'content': [], 'children': []}


def content_of(b):
    if b['t'] == 'table':
        return [table_obj(b)]
    return flat_block(b)


def parse(doc, report):
    tree = Tree()
    sections = []
    for cid, title, first, last in CHAPTERS:
        if cid not in INCLUDED:
            continue
        root = tree.node(title)
        stack = [(1, root)]                               # (niveau, nœud)
        path = []
        for b in doc.blocks(first, last):
            if stops(cid, b):
                break
            if b['t'] == 'h' and b['lvl'] == 1:
                continue
            if b['t'] == 'h' and b['lvl'] <= 5:
                lvl = b['lvl']
                path = path[:max(0, lvl - 2)] + [fold(b['text'])]
                if skipped(cid, path):
                    continue
                while stack and stack[-1][0] >= lvl:
                    stack.pop()
                parent = stack[-1][1]
                n = tree.node(b['text'], parent)
                parent['children'].append(n)
                stack.append((lvl, n))
                continue
            if skipped(cid, path):
                continue
            # Un tableau pleine largeur arrive en fin de page : il rejoint la
            # section qui porte son nom (« Armures »), pas le dernier sous-titre.
            if b['t'] == 'table' and b.get('title'):
                owner = next((n for _, n in reversed(stack) if fold(n['name']) == fold(b['title'])), None)
                if owner is not None:
                    owner['content'].extend(content_of(b))
                    continue
            stack[-1][1]['content'].extend(content_of(b))
        sections.append(root)

    def prune(n):
        n['children'] = [c for c in n['children'] if prune(c)]
        return n['content'] or n['children']
    sections = [s for s in sections if prune(s)]

    count = [0]

    def walk(n):
        count[0] += 1
        for c in n['children']:
            walk(c)
    for s in sections:
        walk(s)
    report.append('   règles : %d chapitres, %d sections' % (len(sections), count[0]))
    return sections


def conditions(doc, report):
    blocks = doc.chapter('glossaire')
    out, cur = [], None
    for b in blocks:
        if b['t'] == 'h' and b['lvl'] <= 4:
            cur = None
            m = re.match(r'^(.*?)\s*\[État\]\s*$', b['text'])
            if m and b['lvl'] == 4:
                name = m.group(1)
                cid = CONDITION_IDS.get(fold(name))
                if not cid:
                    report.append('!! état inconnu « %s »' % name)
                    cid = slug(name)
                cur = {'id': cid, 'name': name, 'desc': []}
                out.append(cur)
            continue
        if cur is None:
            continue
        if b['t'] == 'table' and b['headers'] and 'table' not in cur:
            cur['table'] = {'headers': b['headers'], 'rows': b['rows']}
            continue
        cur['desc'].extend(flat_block(b))
    if len(out) != 15:
        report.append('!! %d états trouvés (15 attendus)' % len(out))
    report.append('   états : %d' % len(out))
    out.sort(key=lambda e: fold(e['name']))
    return out
