# -*- coding: utf-8 -*-
"""Monstres et animaux du SRD 5.2.1 FR -> data/srd/2024/fr/monsters.json"""

import re

from srd52_pdf import fold, squash
from srd52_maps import IdMaker, abilities, after_runin, flat_block

SECTIONS = {
    'traits': 'traits', 'actions': 'actions', 'actions bonus': 'bonus_actions',
    'reactions': 'reactions', 'actions legendaires': 'legendary_actions',
}
CONDITIONS = {'a terre', 'agrippe', 'assourdi', 'aveugle', 'charme', 'effraye', 'empoisonne',
              'entrave', 'epuisement', 'etourdi', 'inconscient', 'invisible', 'neutralise',
              'paralyse', 'petrifie'}
SIZES = ('TP', 'P', 'M', 'G', 'TG', 'Gig')
ABBR = {'str': 'For', 'dex': 'Dex', 'con': 'Con', 'int': 'Int', 'wis': 'Sag', 'cha': 'Cha'}


def parse_type(line):
    """« Dragon (Chromatique) de taille TG, Chaotique Mauvais »."""
    t = squash(line)
    align = ''
    if ', ' in t:
        t, align = t.rsplit(', ', 1)
    size = ''
    m = re.search(r'\bde taille ((?:%s)(?: ou (?:%s))?)\b' % ('|'.join(SIZES), '|'.join(SIZES)), t)
    kind = t
    if m:
        size = m.group(1)
        kind = (t[:m.start()] + t[m.end():]).strip()
    sub = re.search(r'\(([^()]*)\)', kind)
    subtype = sub.group(1) if sub else ''
    kind = squash(re.sub(r'\s*\([^()]*\)', '', kind))
    return kind, subtype, size, align


def num(s):
    m = re.match(r'\s*(\d+)', s or '')
    return int(m.group(1)) if m else 0


def parse_cr(text):
    """« 13 (10 000 PX, ou 11 500 dans son antre ; BM +5) »."""
    t = squash(text)
    disp = t.split(' (')[0].strip()
    if '/' in disp:
        a, b = disp.split('/', 1)
        cr = int(a) / int(b)
    else:
        cr = float(disp) if re.fullmatch(r'\d+', disp) else 0
        cr = int(cr)
    m = re.search(r'(\d[\d ]*)\s*PX|PX\s*(\d[\d ]*)', t)
    xp = int((m.group(1) or m.group(2)).replace(' ', '')) if m else 0
    return disp, cr, xp


def split_immunities(value):
    v = squash(value)
    if ' ; ' in v:
        dmg, cond = v.split(' ; ', 1)
        return dmg.strip(), cond.strip()
    parts = [fold(p.strip()) for p in v.split(',')]
    if parts and all(p in CONDITIONS for p in parts):
        return '', v
    return v, ''


def parse(doc, report):
    blocks = doc.blocks(272, 380)
    raw, cur = [], None
    for b in blocks:
        t = b['t']
        if t == 'sbname':
            cur = {'name': b['text'], 'page': b['page'], 'type': None, 'props': {}, 'abil': {},
                   'sec': None, 'items': {k: [] for k in SECTIONS.values()}, 'leg': None}
            raw.append(cur)
            continue
        if cur is None:
            continue
        if t == 'h' or (t == 'p' and b['fam'] != 'O'):
            cur = None                                    # fin du profil
            continue
        if t == 'sbital':
            if cur['type'] is None and not cur['props']:
                cur['type'] = b['text']
            else:
                cur['leg'] = squash((cur['leg'] or '') + ' ' + b['text'])
        elif t == 'sbprop':
            cur['props'][fold(b['label'])] = squash(b['value'])
        elif t == 'sbabl':
            cur['abil'].update(abilities(b))
        elif t == 'sbsec':
            cur['sec'] = SECTIONS.get(fold(b['text']).strip())
            if cur['sec'] is None:
                report.append('!! section inconnue « %s » (%s)' % (b['text'], cur['name']))
        elif t == 'p' and cur['sec']:
            items = cur['items'][cur['sec']]
            if b.get('runin'):
                items.append({'name': b['runin'].strip().rstrip('.').strip(), 'text': after_runin(b)})
            elif items:
                items[-1]['text'] = squash(items[-1]['text'] + ' ' + b['text'])
        elif cur['sec'] and cur['items'][cur['sec']]:
            last = cur['items'][cur['sec']][-1]
            last['text'] = squash(last['text'] + ' ' + ' '.join(flat_block(b)))

    ids = IdMaker('monsters')
    out = []
    for m in raw:
        kind, subtype, size, align = parse_type(m['type'] or '')
        p = m['props']
        ac_raw = p.get('ca', '')
        acm = re.match(r'\s*(\d+)\s*(?:\((.*)\))?', ac_raw)
        hpm = re.match(r'\s*(\d+)\s*(?:\((.*)\))?', p.get('pv', ''))
        disp, cr, xp = parse_cr(p.get('fp', ''))
        e = {'id': ids(m['name']), 'name': m['name'], 'size': size, 'type': kind,
             'alignment': align, 'ac': int(acm.group(1)) if acm else 0,
             'hp': int(hpm.group(1)) if hpm else 0, 'hp_roll': (hpm.group(2) or '') if hpm else '',
             'speed': p.get('vitesse', ''),
             'abilities': {k: v[0] for k, v in m['abil'].items()},
             'cr': cr, 'cr_display': disp, 'xp': xp, 'cr_text': p.get('fp', ''),
             'senses': p.get('sens', ''), 'languages': p.get('langues', '')}
        if acm and acm.group(2):
            e['ac_desc'] = acm.group(2)
        if subtype:
            e['subtype'] = subtype
        if p.get('initiative'):
            e['initiative'] = p['initiative']
        saves = ['%s %+d' % (ABBR[k], v[2]) for k, v in m['abil'].items() if v[2] != v[1]]
        if saves:
            e['saves'] = ', '.join(saves)
        for fr, key in (('competences', 'skills'), ('resistances', 'resistances'),
                        ('vulnerabilites', 'vulnerabilities'), ('equipement', 'gear')):
            if p.get(fr):
                e[key] = p[fr]
        if p.get('immunites'):
            dmg, cond = split_immunities(p['immunites'])
            if dmg:
                e['immunities'] = dmg
            if cond:
                e['condition_immunities'] = cond
        for key, items in m['items'].items():
            if items:
                e[key] = items
        if m['leg']:
            e['legendary_intro'] = m['leg']
        unknown = set(p) - {'ca', 'initiative', 'pv', 'vitesse', 'competences', 'resistances',
                            'vulnerabilites', 'equipement', 'immunites', 'sens', 'langues', 'fp'}
        if unknown:
            report.append('!! %s : propriétés non reprises %s' % (m['name'], sorted(unknown)))
        bad = [k for k in ('size', 'type', 'ac', 'hp', 'speed', 'senses', 'cr_text')
               if not e.get(k)]
        if not any(e.get(k) for k in ('actions', 'bonus_actions', 'reactions')):
            bad.append('aucune action')
        if len(e['abilities']) != 6:
            bad.append('caractéristiques (%d/6)' % len(e['abilities']))
        if bad:
            report.append('!! monstre « %s » (p%d) : %s' % (m['name'], m['page'], ', '.join(bad)))
        out.append(e)
    report.append('   monstres : %d (%d identifiants hors 2014)' % (len(out), len(ids.unmatched)))
    out.sort(key=lambda e: fold(e['name']))
    return out, ids.unmatched
