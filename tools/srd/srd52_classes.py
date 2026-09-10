# -*- coding: utf-8 -*-
"""Classes et sous-classes du SRD 5.2.1 FR -> data/srd/2024/fr/classes.json

Même forme que le 2014 (features[], levels[], level_columns[], subclasses[]),
plus ce que le SRD 5.2 donne enfin en clair : les « Traits de base »
(proficiencies, equipment, primary_ability), que l'assistant de création lit.
"""

import re

from srd52_pdf import fold, slug, squash
from srd52_maps import CLASS_IDS, IdMaker, flat_block, key

CASTERS = {
    'bard': ('full', 'Charisme'), 'cleric': ('full', 'Sagesse'), 'druid': ('full', 'Sagesse'),
    'sorcerer': ('full', 'Charisme'), 'wizard': ('full', 'Intelligence'),
    'warlock': ('pact', 'Charisme'), 'paladin': ('half', 'Charisme'), 'ranger': ('half', 'Sagesse'),
}
SUBCLASS_IDS = {'Sorcellerie draconique': 'draconic', 'Évocateur': 'evocation',
                'Credo de la Paume': 'open-hand', 'Protecteur Fiélon': 'fiend'}
LEVEL_RX = re.compile(r'^Niveau\s+(\d+)\s*:\s*(.+)$')


def split_list(text):
    return [p.strip(' .') for p in re.split(r',\s*|\s+et\s+', text or '') if p.strip(' .')]


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
    parts.append(buf.strip())
    return [p for p in parts if p and p != '—']


def num(v):
    v = (v or '').strip()
    return int(v) if re.fullmatch(r'\d+', v) else v


def core_traits(table, e):
    prof = e.setdefault('proficiencies', {})
    for r in table['rows']:
        if len(r) < 2:
            continue
        label, value = fold(r[0]), squash(r[1])
        if label.startswith('caracteristique'):
            e['primary_ability'] = value
        elif label.startswith('de de vie'):
            m = re.search(r'd(\d+)', value)
            if m:
                e['hit_die'] = int(m.group(1))
        elif 'sauvegarde' in label:
            prof['saves'] = split_list(value)
        elif 'competence' in label:
            m = re.match(r'\s*(\d+)\s', value)
            rest = value.split(':', 1)[1] if ':' in value else ''
            prof['skills'] = {'text': value, 'choose': int(m.group(1)) if m else 0,
                              'from': split_list(rest)}
        elif 'outil' in label:
            prof['tools'] = value
        elif 'armure' in label:
            prof['armor'] = value
        elif 'arme' in label:
            prof['weapons'] = value
        elif 'equipement' in label:
            intro, body = '', value
            if fold(value).startswith('choisissez') and ':' in value:
                intro, body = value.split(':', 1)
                intro = intro.strip() + ' :'
            items = [re.sub(r'^ou\s+', '', x.strip()) for x in body.split(';') if x.strip()]
            e['equipment'] = {'intro': intro, 'items': items}


def assign_ids(features):
    names = [key(f['name']) for f in features]
    for f in features:
        f['id'] = slug(f['name']) if names.count(key(f['name'])) == 1 \
            else '%s-%d' % (slug(f['name']), f['level'])


def build_levels(cls, table, report):
    heads = [fold(h) for h in table['headers']]
    feats = cls['features']
    cols, used = [], {}
    for i, h in enumerate(table['headers'][3:], 3):
        f = heads[i]
        if re.fullmatch(r'\d', f):
            continue
        if f.startswith('sorts mineurs'):
            cols.append({'label': h, 'key': 'cantrips_known'})
        elif f.startswith('sorts prepares'):
            cols.append({'label': h, 'key': 'spells_known'})
        elif f.startswith('emplacements'):
            cols.append({'label': h, 'key': 'spell_slots_count', 'field': 'class_specific'})
        elif f.startswith('niveau des emplacements'):
            cols.append({'label': h, 'key': 'slot_level', 'field': 'class_specific'})
        else:
            cols.append({'label': h, 'key': slug(h).replace('-', '_'), 'field': 'class_specific'})
        used[i] = cols[-1]
    rows = []
    for r in table['rows']:
        if len(r) < 3 or not re.fullmatch(r'\d+', r[0].strip()):
            continue
        lv = int(r[0])
        row = {'level': lv, 'prof_bonus': int(r[1].replace('+', '')) if re.search(r'\d', r[1]) else (lv - 1) // 4 + 2}
        ids, labels = [], []
        for label in split_top(r[2]):
            k = key(label)
            f = (next((x for x in feats if key(x['name']) == k and x['level'] == lv), None)
                 or next((x for x in feats if key(x['name']) == k), None))
            if f is None and not k.startswith('aptitude de sous-classe'):
                free = [x for x in feats if x['level'] == lv and x['id'] not in ids
                        and not any(key(y) == key(x['name']) for y in split_top(r[2]))]
                if len(free) == 1:
                    f = free[0]
                    report.append('   %s niv. %d : table « %s » = aptitude « %s »'
                                  % (cls['id'], lv, label, f['name']))
            if f is not None:
                ids.append(f['id'])
                labels.append(f['name'])
                if lv != f['level']:
                    f.setdefault('levels', [f['level']])
                    if lv not in f['levels']:
                        f['levels'].append(lv)
            else:
                ids.append(slug(label))
                labels.append(label)
        if ids:
            row['features'], row['feature_labels'] = ids, labels
        slots = {h: int(r[i]) for i, h in enumerate(heads)
                 if re.fullmatch(r'\d', h) and i < len(r) and re.fullmatch(r'\d+', r[i].strip())}
        if slots:
            row['spell_slots'] = slots
        cs = {}
        for i, col in used.items():
            if i >= len(r) or r[i].strip() in ('', '—'):
                continue
            if col.get('field') == 'class_specific':
                cs[col['key']] = num(r[i])
            else:
                row[col['key']] = num(r[i])
        if cs:
            row['class_specific'] = cs
        rows.append(row)
    if len(rows) != 20:
        report.append('!! %s : table de progression à %d niveaux' % (cls['id'], len(rows)))
    for f in feats:
        if 'levels' in f:
            f['levels'].sort()
    cls['level_columns'] = cols
    cls['levels'] = rows


def parse(doc, report):
    blocks = doc.chapter('classes')
    ids = IdMaker('classes', SUBCLASS_IDS)
    classes, cls, mode, sub, feat = [], None, None, None, None
    for b in blocks:
        t = b['t']
        if t == 'h' and b['lvl'] <= 2:
            cid = CLASS_IDS.get(fold(b['text']))
            if b['lvl'] == 2 and cid:
                cls = {'id': cid, 'name': b['text'], 'desc': [], 'features': [], 'subclasses': [],
                       '_table': None, '_options': {}}
                ids.used.add(cid)
                classes.append(cls)
                mode, sub, feat = 'intro', None, None
            continue
        if cls is None:
            continue
        if t == 'table':
            title = fold(b.get('title') or '')
            if title.startswith('traits de base'):
                core_traits(b, cls)
                continue
            if title.startswith('aptitudes d') and b['headers'] and cls['_table'] is None:
                cls['_table'] = b
                continue
        if t == 'h' and b['lvl'] == 3:
            f = fold(b['text'])
            feat = None
            if f.startswith('sous-classe'):
                name = b['text'].split(':', 1)[1].strip() if ':' in b['text'] else b['text']
                sub = {'id': ids(name), 'name': name, 'desc': [], 'features': []}
                cls['subclasses'].append(sub)
                mode = 'sub'
            elif f.startswith('liste des sorts'):
                mode = 'skip'
            elif f.startswith('options de'):
                mode = 'options:' + f
            elif f.startswith('aptitudes de classe'):
                mode = 'features'
            elif f.startswith('devenir'):
                mode = 'devenir'
            else:
                mode = 'features' if mode == 'features' else mode
                report.append('   %s : section « %s » rattachée à « %s »' % (cls['id'], b['text'], mode))
            continue
        if t == 'h' and b['lvl'] == 4:
            m = LEVEL_RX.match(b['text'])
            if m and mode in ('features', 'sub'):
                feat = {'name': squash(m.group(2)), 'level': int(m.group(1)), 'text': []}
                (cls['features'] if mode == 'features' else sub['features']).append(feat)
                continue
            if mode and mode.startswith('options:'):
                feat = {'id': slug(b['text']), 'name': b['text'], 'text': []}
                cls['_options'].setdefault(mode, []).append(feat)
                continue
            if mode == 'devenir':
                cls['desc'].append(b['text'] + ' :')
                continue
        if mode == 'skip':
            continue
        lines = flat_block(b)
        if feat is not None:
            feat['text'].extend(lines)
        elif mode == 'sub' and sub is not None:
            sub['desc'].extend(lines)
        elif mode in ('intro', 'devenir'):
            cls['desc'].extend(lines)

    for cls in classes:
        assign_ids(cls['features'])
        for s in cls['subclasses']:
            assign_ids(s['features'])
        for sec, opts in cls.pop('_options').items():
            word = 'metamagie' if 'metamagie' in sec else 'manifestation'
            target = next((f for f in cls['features'] if word in fold(f['name'])), None)
            if target:
                target['options'] = opts
            else:
                report.append('!! %s : options « %s » sans aptitude' % (cls['id'], sec))
        table = cls.pop('_table')
        if table:
            build_levels(cls, table, report)
        else:
            report.append('!! %s : table de progression introuvable' % cls['id'])
        if cls['id'] in CASTERS:
            cls['spellcasting'] = {'type': CASTERS[cls['id']][0], 'ability': CASTERS[cls['id']][1]}
        for k in ('hit_die', 'proficiencies', 'equipment'):
            if not cls.get(k):
                report.append('!! %s : %s manquant' % (cls['id'], k))
        if not cls['subclasses']:
            report.append('!! %s : aucune sous-classe' % cls['id'])
    report.append('   classes : %d, sous-classes : %d, aptitudes : %d' % (
        len(classes), sum(len(c['subclasses']) for c in classes),
        sum(len(c['features']) for c in classes)))
    return classes, ids.unmatched
