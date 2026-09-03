# -*- coding: utf-8 -*-
"""
Complète data/srd/<edition>/<lang>/classes.json avec la progression de classe.

L'extraction PDF d'origine n'avait gardé que les NOMS et le TEXTE des aptitudes.
Résultat : SRD.levelInfo() ne trouvait jamais rien, et l'écran de montée de
niveau restait vide. Ce script ajoute ce qui manquait, sans jamais réécrire le
texte du SRD :

  · hit_die, spellcasting (type + caractéristique) ;
  · levels[] : la table de progression (maîtrise, emplacements de sorts,
    colonnes propres à la classe, aptitudes gagnées) ;
  · level_columns[] : l'en-tête de ces colonnes, pour la page Règles ;
  · un `level` (ou `levels`) et un `id` sur chaque aptitude de classe ;
  · subclasses[].features[] : extraites du texte de la sous-classe, où elles
    étaient noyées dans desc[] sous forme « titre » puis « paragraphes ».

Les niveaux viennent des tables du SRD 5.1 ; les noms et le texte viennent du
fichier lui-même. Rien n'est inventé, rien n'est perdu : les paragraphes non
reconnus restent dans desc[].

    python tools/srd/build_class_levels.py [chemin/classes.json]
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

DEFAULT = Path('data/srd/2014/fr/classes.json')


# ---------------------------------------------------------------- utilitaires

def spread(bands):
    """[(1, 3, 'a'), (4, 20, 'b')] -> {1: 'a', 2: 'a', 3: 'a', 4: 'b', ...}"""
    out = {}
    for lo, hi, val in bands:
        for lv in range(lo, hi + 1):
            out[lv] = val
    return out


def by_level(pairs):
    """{1: 2, 2: 3, ...} écrit à plat, pour les colonnes irrégulières."""
    return dict(pairs)


def from_level(start, first=None):
    """« égal au niveau à partir du niveau 2 » : {1: '—', 2: 2, 3: 3, …}"""
    out = {lv: lv for lv in range(start, 21)}
    for lv in range(1, start):
        out[lv] = first
    return out


def slug(name):
    s = unicodedata.normalize('NFD', name).encode('ascii', 'ignore').decode('ascii')
    s = re.sub(r"[^a-zA-Z0-9]+", '-', s).strip('-').lower()
    return s


# ------------------------------------------------------- emplacements de sorts

def _slots(table):
    """[4, 3, 2] -> {"1": 4, "2": 3, "3": 2}"""
    return {str(i + 1): n for i, n in enumerate(table) if n}


FULL_CASTER = {lv: _slots(t) for lv, t in {
    1: [2], 2: [3], 3: [4, 2], 4: [4, 3], 5: [4, 3, 2], 6: [4, 3, 3],
    7: [4, 3, 3, 1], 8: [4, 3, 3, 2], 9: [4, 3, 3, 3, 1], 10: [4, 3, 3, 3, 2],
    11: [4, 3, 3, 3, 2, 1], 12: [4, 3, 3, 3, 2, 1],
    13: [4, 3, 3, 3, 2, 1, 1], 14: [4, 3, 3, 3, 2, 1, 1],
    15: [4, 3, 3, 3, 2, 1, 1, 1], 16: [4, 3, 3, 3, 2, 1, 1, 1],
    17: [4, 3, 3, 3, 2, 1, 1, 1, 1], 18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
    19: [4, 3, 3, 3, 3, 2, 1, 1, 1], 20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
}.items()}

HALF_CASTER = {lv: _slots(t) for lv, t in {
    2: [2], 3: [3], 4: [3], 5: [4, 2], 6: [4, 2], 7: [4, 3], 8: [4, 3],
    9: [4, 3, 2], 10: [4, 3, 2], 11: [4, 3, 3], 12: [4, 3, 3],
    13: [4, 3, 3, 1], 14: [4, 3, 3, 1], 15: [4, 3, 3, 2], 16: [4, 3, 3, 2],
    17: [4, 3, 3, 3, 1], 18: [4, 3, 3, 3, 1], 19: [4, 3, 3, 3, 2], 20: [4, 3, 3, 3, 2],
}.items()}

# Magie de pacte : (nombre d'emplacements, niveau des emplacements)
PACT = by_level({
    1: (1, 1), 2: (2, 1), 3: (2, 2), 4: (2, 2), 5: (2, 3), 6: (2, 3),
    7: (2, 4), 8: (2, 4), 9: (2, 5), 10: (2, 5), 11: (3, 5), 12: (3, 5),
    13: (3, 5), 14: (3, 5), 15: (3, 5), 16: (3, 5), 17: (4, 5), 18: (4, 5),
    19: (4, 5), 20: (4, 5),
})


# ------------------------------------------------------- colonnes des classes

CANTRIPS_3_4_5 = spread([(1, 3, 3), (4, 9, 4), (10, 20, 5)])
CANTRIPS_2_3_4 = spread([(1, 3, 2), (4, 9, 3), (10, 20, 4)])

COL_CANTRIPS = {'label': 'Sorts mineurs connus', 'key': 'cantrips_known'}
COL_SPELLS = {'label': 'Sorts connus', 'key': 'spells_known'}


# Chaque classe : dé de vie, magie, colonnes, et les niveaux de ses aptitudes.
# `features` associe le NOM exact de l'aptitude (tel qu'il est dans le fichier)
# aux niveaux où la table du SRD la mentionne.
CLASSES = {
    'barbarian': {
        'hit_die': 12,
        'columns': [
            {'label': 'Rages', 'key': 'rages', 'field': 'class_specific'},
            {'label': 'Dégâts de rage', 'key': 'rage_damage', 'field': 'class_specific'},
        ],
        'class_specific': {
            'rages': spread([(1, 2, 2), (3, 5, 3), (6, 11, 4), (12, 16, 5), (17, 19, 6), (20, 20, 'illimité')]),
            'rage_damage': spread([(1, 8, '+2'), (9, 15, '+3'), (16, 20, '+4')]),
        },
        'features': {
            'Rage': [1], 'Défense sans armure': [1], 'Témérité': [2], 'Sens du danger': [2],
            'Voie primitive': [3], 'Amélioration de caractéristique': [4, 8, 12, 16, 19],
            'Attaque supplémentaire': [5], 'Déplacement rapide': [5], 'Instinct sauvage': [7],
            'Critique brutal': [9, 13, 17], 'Rage implacable': [11], 'Rage persistante': [15],
            'Puissance indomptable': [18], 'Champion primitif': [20],
        },
    },
    'bard': {
        'hit_die': 8, 'caster': 'full', 'ability': 'Charisme',
        'columns': [COL_CANTRIPS, COL_SPELLS,
                    {'label': 'Inspiration bardique', 'key': 'bardic_die', 'field': 'class_specific'},
                    {'label': 'Chant reposant', 'key': 'song_die', 'field': 'class_specific'}],
        'cantrips_known': CANTRIPS_2_3_4,
        'spells_known': by_level({1: 4, 2: 5, 3: 6, 4: 7, 5: 8, 6: 9, 7: 10, 8: 11, 9: 12, 10: 14,
                                  11: 15, 12: 15, 13: 16, 14: 18, 15: 19, 16: 19, 17: 20, 18: 22,
                                  19: 22, 20: 22}),
        'class_specific': {
            'bardic_die': spread([(1, 4, 'd6'), (5, 9, 'd8'), (10, 14, 'd10'), (15, 20, 'd12')]),
            'song_die': spread([(2, 8, 'd6'), (9, 12, 'd8'), (13, 16, 'd10'), (17, 20, 'd12')]),
        },
        'features': {
            'Sorts': [1], 'Inspiration bardique': [1, 5, 10, 15], 'Touche-à-tout': [2],
            'Chant reposant': [2, 9, 13, 17], 'Collège bardique': [3], 'Expertise': [3, 10],
            'Amélioration de caractéristique': [4, 8, 12, 16, 19], 'Source d’inspiration': [5],
            'Contre-charme': [6], 'Secrets magiques': [10, 14, 18], 'Inspiration supérieure': [20],
        },
    },
    'cleric': {
        'hit_die': 8, 'caster': 'full', 'ability': 'Sagesse',
        'columns': [COL_CANTRIPS],
        'cantrips_known': CANTRIPS_3_4_5,
        'features': {
            'Sorts': [1], 'Domaine divin': [1], 'Conduit divin': [2, 6, 18],
            'Amélioration de caractéristique': [4, 8, 12, 16, 19],
            'Destruction des morts-vivants': [5, 8, 11, 14, 17], 'Intervention divine': [10, 20],
        },
    },
    'druid': {
        'hit_die': 8, 'caster': 'full', 'ability': 'Sagesse',
        'columns': [COL_CANTRIPS],
        'cantrips_known': CANTRIPS_2_3_4,
        'features': {
            'Druidique': [1], 'Sorts': [1], 'Forme sauvage': [2, 4, 8], 'Cercle druidique': [2],
            'Amélioration de caractéristique': [4, 8, 12, 16, 19], 'Jeunesse éternelle': [18],
            'Incantation animale': [18], 'Archidruide': [20],
        },
    },
    'sorcerer': {
        'hit_die': 6, 'caster': 'full', 'ability': 'Charisme',
        'columns': [COL_CANTRIPS, COL_SPELLS,
                    {'label': 'Points de sorcellerie', 'key': 'sorcery_points', 'field': 'class_specific'}],
        'cantrips_known': spread([(1, 3, 4), (4, 9, 5), (10, 20, 6)]),
        'spells_known': by_level({1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 11,
                                  11: 12, 12: 12, 13: 13, 14: 13, 15: 14, 16: 14, 17: 15, 18: 15,
                                  19: 15, 20: 15}),
        'class_specific': {
            'sorcery_points': from_level(2, '—'),
        },
        'features': {
            'Sorts': [1], 'Origine magique': [1], 'Réserve arcanique': [2], 'Métamagie': [3, 10, 17],
            'Amélioration de caractéristique': [4, 8, 12, 16, 19], 'Restauration ensorcelée': [20],
        },
    },
    'fighter': {
        'hit_die': 10,
        'features': {
            'Style de combat': [1], 'Second souffle': [1], 'Fougue': [2, 17], 'Archétype martial': [3],
            'Amélioration de caractéristique': [4, 6, 8, 12, 14, 16, 19],
            'Attaque supplémentaire': [5, 11, 20], 'Inflexible': [9, 13, 17],
        },
    },
    'wizard': {
        'hit_die': 6, 'caster': 'full', 'ability': 'Intelligence',
        'columns': [COL_CANTRIPS],
        'cantrips_known': CANTRIPS_3_4_5,
        'features': {
            'Sorts': [1], 'Restauration magique': [1], 'Tradition arcanique': [2],
            'Amélioration de caractéristique': [4, 8, 12, 16, 19], 'Maîtrise des sorts': [18],
            'Sorts de prédilection': [20],
        },
    },
    'monk': {
        'hit_die': 8,
        'columns': [
            {'label': 'Arts martiaux', 'key': 'martial_arts', 'field': 'class_specific'},
            {'label': 'Points de ki', 'key': 'ki_points', 'field': 'class_specific'},
            {'label': 'Déplacement sans armure', 'key': 'unarmored_movement', 'field': 'class_specific'},
        ],
        'class_specific': {
            'martial_arts': spread([(1, 4, '1d4'), (5, 10, '1d6'), (11, 16, '1d8'), (17, 20, '1d10')]),
            'ki_points': from_level(2, '—'),
            'unarmored_movement': spread([(1, 1, '—'), (2, 5, '+3 m'), (6, 9, '+4,50 m'),
                                          (10, 13, '+6 m'), (14, 17, '+7,50 m'), (18, 20, '+9 m')]),
        },
        'features': {
            'Défense sans armure': [1], 'Arts martiaux': [1], 'Le ki': [2],
            'Déplacement sans armure': [2, 9], 'Tradition monastique': [3], 'Parade de projectiles': [3],
            'Amélioration de caractéristique': [4, 8, 12, 16, 19], 'Chute ralentie': [4],
            'Attaque supplémentaire': [5], 'Frappe étourdissante': [5], 'Frappes de ki': [6],
            'Esquive totale': [7], 'Sérénité': [7], 'Pureté physique': [10],
            'Langage du soleil et de la lune': [13], 'Âme de diamant': [14],
            'Jeunesse éternelle': [15], 'Désertion de l’âme': [18], 'Perfection de l’être': [20],
        },
    },
    'warlock': {
        'hit_die': 8, 'caster': 'pact', 'ability': 'Charisme',
        'columns': [COL_CANTRIPS, COL_SPELLS,
                    {'label': 'Emplacements', 'key': 'spell_slots_count', 'field': 'class_specific'},
                    {'label': 'Niveau des emplacements', 'key': 'slot_level', 'field': 'class_specific'},
                    {'label': 'Manifestations connues', 'key': 'invocations_known', 'field': 'class_specific'}],
        'cantrips_known': CANTRIPS_2_3_4,
        'spells_known': by_level({1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 10,
                                  11: 11, 12: 11, 13: 12, 14: 12, 15: 13, 16: 13, 17: 14, 18: 14,
                                  19: 15, 20: 15}),
        'class_specific': {
            'invocations_known': by_level({1: '—', 2: 2, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5,
                                           10: 5, 11: 5, 12: 6, 13: 6, 14: 6, 15: 7, 16: 7, 17: 7,
                                           18: 8, 19: 8, 20: 8}),
        },
        'features': {
            'Protecteur d’outre-monde': [1], 'Magie de pacte': [1],
            'Manifestations occultes': [2, 5, 7, 9, 12, 15, 18], 'Pacte': [3],
            'Amélioration de caractéristique': [4, 8, 12, 16, 19],
            'Arcanum mystique': [11, 13, 15, 17], 'Maître de l’occulte': [20],
        },
    },
    'paladin': {
        'hit_die': 10, 'caster': 'half', 'ability': 'Charisme',
        'features': {
            'Perception divine': [1], 'Imposition des mains': [1], 'Style de combat': [2],
            'Sorts': [2], 'Châtiment divin': [2], 'Santé divine': [3], 'Serment sacré': [3],
            'Amélioration de caractéristique': [4, 8, 12, 16, 19], 'Attaque supplémentaire': [5],
            'Aura de protection': [6, 18], 'Aura de courage': [10, 18],
            'Châtiment divin amélioré': [11], 'Contact purificateur': [14],
        },
    },
    'ranger': {
        'hit_die': 10, 'caster': 'half', 'ability': 'Sagesse',
        'columns': [COL_SPELLS],
        'spells_known': by_level({2: 2, 3: 3, 4: 3, 5: 4, 6: 4, 7: 5, 8: 5, 9: 6, 10: 6, 11: 7,
                                  12: 7, 13: 8, 14: 8, 15: 9, 16: 9, 17: 10, 18: 10, 19: 11, 20: 11}),
        'features': {
            'Ennemi juré': [1, 6, 14], 'Explorateur-né': [1, 6, 10], 'Style de combat': [2],
            'Sorts': [2], 'Archétype de rôdeur': [3], 'Vigilance primitive': [3],
            'Amélioration de caractéristique': [4, 8, 12, 16, 19], 'Attaque supplémentaire': [5],
            'Foulée tellurique': [8], 'Camouflage naturel': [10], 'Disparition': [14],
            'Sens sauvages': [18], 'Tueur implacable': [20],
        },
    },
    'rogue': {
        'hit_die': 8,
        'columns': [{'label': 'Attaque sournoise', 'key': 'sneak_attack', 'field': 'class_specific'}],
        'class_specific': {
            'sneak_attack': {lv: '%dd6' % ((lv + 1) // 2) for lv in range(1, 21)},
        },
        'features': {
            'Expertise': [1, 6], 'Attaque sournoise': [1], 'Argot des voleurs': [1], 'Ruse': [2],
            'Archétype de roublard': [3], 'Amélioration de caractéristique': [4, 8, 10, 12, 16, 19],
            'Esquive instinctive': [5], 'Esquive totale': [7], 'Savoir-faire': [11],
            'Perception aveugle': [14], 'Esprit fuyant': [15], 'Insaisissable': [18],
            'Coup de chance': [20],
        },
    },
}


# Aptitudes de sous-classe : nom exact tel qu'il apparaît dans desc[], et le
# niveau auquel le SRD les octroie. Tout ce qui n'est pas listé ici reste dans
# desc[] — c'est ce qui protège des faux positifs de l'extraction PDF.
SUBCLASSES = {
    'berserker': [('Frénésie', 3), ('Rage aveugle', 6), ('Présence intimidante', 10),
                  ('Représailles', 14)],
    'lore': [('Maîtrises supplémentaires', 3), ('Mots cinglants', 3),
             ('Secrets magiques supplémentaires', 6), ('Compétence hors pair', 14)],
    'life': [('Sorts du domaine de la Vie', 1), ('Maîtrise supplémentaire', 1),
             ('Disciple de la Vie', 1), ('Conduit divin : Survivance', 2),
             ('Guérisseur béni', 6), ('Impact divin', 8), ('Guérison suprême', 17)],
    'land': [('Sort mineur supplémentaire', 2), ('Ressourcement', 2), ('Sorts de cercle', 3),
             ('Foulée tellurique', 6), ('Protégé de dame Nature', 10),
             ('Sanctuaire de dame Nature', 14)],
    'draconic': [('Ancêtre draconique', 1), ('Résistance draconique', 1),
                 ('Affinité élémentaire', 6), ('Ailes draconiques', 14),
                 ('Présence draconique', 18)],
    'champion': [('Critique amélioré', 3), ('Athlète accompli', 7),
                 ('Style de combat supplémentaire', 10), ('Critique supérieur', 15),
                 ('Survivant', 18)],
    'evocation': [('Évocateur érudit', 2), ('Façonneur de sorts', 2), ('Sort mineur appuyé', 6),
                  ('Évocation améliorée', 10), ('Surcharge magique', 14)],
    'open-hand': [('Technique de la Paume', 3), ('Plénitude physique', 6), ('Ataraxie', 11),
                  ('Paume vibratoire', 17)],
    'fiend': [('Liste de sorts étendue', 1), ('Bénédiction du ténébreux', 1),
              ('Chance du ténébreux', 6), ('Résistance fiélonne', 10),
              ('Traversée des enfers', 14)],
    'devotion': [('Sorts de serment', 3), ('Conduit divin', 3), ('Aura de dévotion', 7),
                 ('Pureté de l’esprit', 15), ('Nimbe sacré', 20)],
    'hunter': [('Proie du chasseur', 3), ('Tactiques défensives', 7), ('Attaques multiples', 11),
               ('Défense de chasseur supérieure', 15)],
    'thief': [('Mains lestes', 3), ('Monte-en-l’air', 3), ('Furtivité suprême', 9),
              ('Utilisation d’objets magiques', 13), ('Réflexes de voleur', 17)],
}


# ------------------------------------------------------------------ extraction

def is_heading(p):
    """Un titre d'aptitude : court, sans ponctuation finale."""
    p = p.strip()
    return bool(p) and len(p) < 70 and not p.endswith(('.', '…', '!', '?', ':', ';', ','))


def split_subclass(desc, wanted):
    """desc[] -> (desc restant, features[]).

    Le PDF alterne « titre » puis paragraphes. On ne découpe QUE sur les titres
    attendus : le reste (tables de sorts de domaine, sections parasites) est
    laissé intact dans desc.
    """
    names = {n: lv for n, lv in wanted}
    feats, rest = [], []
    i = 0
    while i < len(desc):
        p = desc[i].strip()
        if p in names:
            body, j = [], i + 1
            # Le corps court jusqu'au titre attendu suivant, ou jusqu'à un
            # titre inconnu (une section qui n'est pas une aptitude).
            while j < len(desc):
                nxt = desc[j].strip()
                if nxt in names or (is_heading(nxt) and nxt not in names):
                    break
                body.append(desc[j])
                j += 1
            feats.append({'id': slug(p), 'name': p, 'level': names[p], 'text': body})
            i = j
        else:
            rest.append(desc[i])
            i += 1
    return rest, feats


# --------------------------------------------------------------------- montage

def build_levels(spec, features):
    """La table de progression, ligne par ligne."""
    caster = spec.get('caster')
    rows = []
    for lv in range(1, 21):
        row = {'level': lv, 'prof_bonus': (lv - 1) // 4 + 2}

        gained = [f for f in features if lv in f['_levels']]
        if gained:
            row['features'] = [f['id'] for f in gained]
            row['feature_labels'] = [f['name'] for f in gained]

        if caster == 'full' and lv in FULL_CASTER:
            row['spell_slots'] = FULL_CASTER[lv]
        elif caster == 'half' and lv in HALF_CASTER:
            row['spell_slots'] = HALF_CASTER[lv]

        cs = {}
        for key, table in (spec.get('class_specific') or {}).items():
            if lv in table:
                cs[key] = table[lv]
        if caster == 'pact':
            count, rank = PACT[lv]
            cs['spell_slots_count'] = count
            cs['slot_level'] = rank
        if cs:
            row['class_specific'] = cs

        for key in ('cantrips_known', 'spells_known'):
            table = spec.get(key)
            if table and lv in table:
                row[key] = table[lv]

        rows.append(row)
    return rows


def main(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    report = []

    for entry in data['entries']:
        spec = CLASSES.get(entry['id'])
        if not spec:
            report.append('!! classe inconnue du script : %s' % entry['id'])
            continue

        entry['hit_die'] = spec['hit_die']
        if spec.get('caster'):
            entry['spellcasting'] = {'type': spec['caster'], 'ability': spec['ability']}
        if spec.get('columns'):
            entry['level_columns'] = spec['columns']

        # Aptitudes de classe : identifiant + niveaux.
        wanted = dict(spec['features'])
        for f in entry.get('features', []):
            levels = wanted.pop(f['name'], None)
            f['id'] = slug(f['name'])
            if levels is None:
                report.append('!! %s : aptitude sans niveau connu « %s »' % (entry['id'], f['name']))
                f['_levels'] = []
                continue
            f['_levels'] = levels
            if len(levels) == 1:
                f['level'] = levels[0]
            else:
                f['levels'] = levels
        if wanted:
            report.append('!! %s : aptitudes attendues absentes du fichier : %s'
                          % (entry['id'], ', '.join(wanted)))

        entry['levels'] = build_levels(spec, entry.get('features', []))
        for f in entry.get('features', []):
            f.pop('_levels', None)

        # Sous-classes.
        for sub in entry.get('subclasses', []):
            wanted_sub = SUBCLASSES.get(sub['id'])
            if not wanted_sub:
                report.append('!! sous-classe inconnue du script : %s' % sub['id'])
                continue
            rest, feats = split_subclass(sub.get('desc') or [], wanted_sub)
            if not feats:
                # Déjà découpé lors d'un passage précédent : on ne touche à rien
                # plutôt que d'effacer le travail fait.
                if not sub.get('features'):
                    report.append('!! %s : aucune aptitude trouvée dans le texte' % sub['id'])
                continue
            found = {f['name'] for f in feats}
            missing = [n for n, _ in wanted_sub if n not in found]
            if missing:
                report.append('!! %s : aptitudes introuvables dans le texte : %s'
                              % (sub['id'], ', '.join(missing)))
            sub['desc'] = rest
            sub['features'] = feats

    path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')

    print('classes.json mis à jour : %d classes' % len(data['entries']))
    for line in report:
        print(line)
    return 1 if report else 0


if __name__ == '__main__':
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    sys.exit(main(target))
