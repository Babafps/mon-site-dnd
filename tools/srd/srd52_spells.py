# -*- coding: utf-8 -*-
"""Sorts du SRD 5.2.1 FR -> data/srd/2024/fr/spells.json"""

import re

from srd52_pdf import fold, squash
from srd52_maps import CLASS_IDS, SCHOOL_IDS, IdMaker, after_runin, flat_block

HIGHER = ('emplacement de niveau superieur', 'amelioration de sort mineur')
HEADER_FIELDS = ('temps', 'portee', 'composantes', 'duree')


def parse_header(sub):
    """« Transmutation du 2e niveau (Barde, Druide) » -> niveau, école, classes."""
    t = squash(sub)
    m = re.search(r'\(([^()]*)\)\s*$', t)
    classes = []
    if m:
        for c in re.split(r',|\bet\b', m.group(1)):
            cid = CLASS_IDS.get(fold(c.strip()))
            if cid and cid not in classes:
                classes.append(cid)
    head = fold(t[:m.start()] if m else t)
    lv = re.search(r'(\d)\s*(?:er|e)\s+niveau', head)
    level = int(lv.group(1)) if lv else 0
    school = next((sid for fr, sid in SCHOOL_IDS.items() if fr in head), None)
    return level, school, classes, bool(lv) or 'mineur' in head


def field(fields, prefix):
    return next((v for k, v in fields.items() if k.startswith(prefix)), '')


def parse(doc, report):
    blocks = doc.chapter('sorts')
    start = next(i for i, b in enumerate(blocks)
                 if b['t'] == 'h' and fold(b['text']) == 'description des sorts')
    raw, cur = [], None
    for i in range(start + 1, len(blocks)):
        b = blocks[i]
        nxt = blocks[i + 1] if i + 1 < len(blocks) else {}
        if b['t'] == 'h' and b['lvl'] == 4 and nxt.get('t') == 'sub':
            cur = {'name': b['text'], 'page': b['page'], 'sub': None, 'fields': {},
                   'desc': [], 'higher': None}
            raw.append(cur)
            continue
        if cur is None:
            continue
        if b['t'] == 'sub' and cur['sub'] is None:
            cur['sub'] = b['text']
        elif b['t'] == 'field' and (not cur['desc'] or (
                fold(b['label']).startswith(HEADER_FIELDS) and fold(b['label']) not in cur['fields'])):
            cur['fields'][fold(b['label'])] = b['value']      # en-tête coupé par une page
        elif b['t'] == 'p' and b.get('runin') and fold(b['runin']).strip(' .') in HIGHER:
            cur['higher'] = after_runin(b)
        else:
            cur['desc'].extend(flat_block(b))

    ids = IdMaker('spells')
    out = []
    for s in raw:
        level, school, classes, ok = parse_header(s['sub'] or '')
        f = s['fields']
        ct, rg = field(f, 'temps'), field(f, 'portee')
        comp, dur = field(f, 'composantes'), field(f, 'duree')
        e = {'id': ids(s['name']), 'name': s['name'], 'level': level, 'school': school,
             'ritual': 'rituel' in fold(ct), 'concentration': fold(dur).startswith('concentration'),
             'casting_time': ct, 'range': rg, 'components': comp, 'duration': dur,
             'classes': classes, 'desc': s['desc']}
        if s['higher']:
            e['higher_levels'] = s['higher']
        out.append(e)
        missing = [k for k in ('school', 'casting_time', 'range', 'components', 'duration',
                               'classes', 'desc') if not e[k]]
        if missing or not ok:
            report.append('!! sort « %s » (p%d) : %s' % (s['name'], s['page'],
                                                        ', '.join(missing) or 'en-tête illisible'))
    report.append('   sorts : %d (%d identifiants hors 2014)' % (len(out), len(ids.unmatched)))
    out.sort(key=lambda e: fold(e['name']))
    return out, ids.unmatched
