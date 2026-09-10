# -*- coding: utf-8 -*-
"""
SRD 5.2.1 (règles 2024), version française officielle — lecture du PDF.

Le PDF de Wizards of the Coast est très régulier : chaque rôle a son style
(police, corps, couleur). Ce module transforme les lignes du PDF en BLOCS
typés, que les scripts srd52_*.py assemblent ensuite par catégorie :

  h       titre (lvl 1 à 4 ; 5 = titre d'encadré)
  sub     ligne en italique sous un titre (école d'un sort, type d'objet…)
  p       paragraphe recollé (césures et retours à la ligne), avec son
          intitulé en gras éventuel (`runin`) et sa famille de police (`fam`)
  field   « Libellé : valeur » (en-tête de sort, outils, historiques…)
  table   tableau : titre, en-têtes, lignes
  sbname / sbital / sbprop / sbabl / sbsec   pièces d'un profil de monstre

Rien n'est traduit ni réécrit : le texte est celui du PDF.
"""

import re
import sys
import unicodedata
import urllib.request
from collections import namedtuple
from pathlib import Path

try:
    import pymupdf
except ImportError:                                   # pragma: no cover
    sys.exit('PyMuPDF est requis : pip install pymupdf')

PDF_URL = 'https://media.dndbeyond.com/compendium-images/srd/5.2/FR_SRD_CC_v5.2.1.pdf'
PDF_NAME = 'FR_SRD_CC_v5.2.1.pdf'
SOURCE = 'SRD 5.2.1 (version française officielle, Wizards of the Coast LLC) — CC-BY-4.0'

RED, BROWN = 0x8c2220, 0x540000
GREY_HEAD, GREY_SB, GREY_SBH = 0x808285, 0x636466, 0x8e9093

# (identifiant, titre, première page, dernière page) — sommaire du PDF
CHAPTERS = [
    ('comment-jouer', 'Comment jouer', 5, 19),
    ('creation-de-personnage', 'Création de personnage', 20, 29),
    ('classes', 'Classes', 30, 86),
    ('origines', 'Origines des personnages', 87, 91),
    ('dons', 'Dons', 92, 94),
    ('equipement', 'Équipement', 95, 110),
    ('sorts', 'Sorts', 111, 186),
    ('glossaire', 'Glossaire de règles', 187, 202),
    ('boite-a-outils', 'Boîte à outils ludique', 203, 214),
    ('objets-magiques', 'Objets magiques', 215, 266),
    ('monstres', 'Monstres', 267, 360),
    ('animaux', 'Animaux', 360, 380),
]
CHAPTER = {c[0]: c for c in CHAPTERS}


# ------------------------------------------------------------------ utilitaires

def slug(name):
    s = unicodedata.normalize('NFD', str(name)).encode('ascii', 'ignore').decode('ascii')
    return re.sub(r'[^a-zA-Z0-9]+', '-', s).strip('-').lower()


def fold(s):
    s = unicodedata.normalize('NFD', str(s or ''))
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower()


def clean(s):
    return (s.replace('\t', ' ').replace(' ', ' ').replace(' ', ' ')
             .replace(' ', ' ').replace('­', ''))


def squash(s):
    return re.sub(r' {2,}', ' ', s).strip()


def fetch_pdf(dest):
    dest = Path(dest)
    if not dest.exists():
        print('Téléchargement du SRD 5.2.1 FR depuis', PDF_URL)
        dest.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(PDF_URL, dest)
    return dest


# --------------------------------------------------------------------- lignes

Span = namedtuple('Span', 'text fam weight ital size color caps x')


class Line:
    __slots__ = ('page', 'x', 'y', 'x1', 'spans', 'kind')

    def __init__(self, page, x, y, spans, x1=None):
        self.page, self.x, self.y, self.spans, self.kind = page, x, y, spans, None
        self.x1 = x1 if x1 is not None else x

    @property
    def text(self):
        return ''.join(s.text for s in self.spans)

    @property
    def sig(self):
        """Spans porteurs de sens (sans espaces ni exposants)."""
        big = [s for s in self.spans if s.text.strip() and s.size >= 7.2]
        return big or [s for s in self.spans if s.text.strip()]

    def __repr__(self):
        return '<%s p%d %.0f,%.0f %r>' % (self.kind, self.page, self.x, self.y, self.text[:50])


def bold(s):
    return s.weight != ''


def classify(l):
    sig = l.sig
    s0 = sig[0]
    txt = l.text.strip()
    if s0.color == GREY_HEAD:
        return None
    if s0.fam == 'G':
        if s0.color == GREY_SBH:
            return None                                   # « MOD JS » des profils
        if s0.color == BROWN:
            return 'SBABL'
        if s0.color == RED:
            if not bold(s0):
                return 'SBSEC'
            if s0.size >= 22:
                return 'H1'
            if s0.size >= 16.5:
                return 'H2'
            if s0.size >= 14.4:
                return 'SB'
            if s0.size >= 13:
                return 'H3'
            return 'H4'
        if s0.caps:
            return 'SIDET'
        if s0.weight == 'semi':
            all_bold = all(bold(s) for s in sig)
            if s0.size >= 10.3:
                return 'TT' if all_bold and len(txt) > 3 else 'TD'
            if s0.size < 9.35 and not s0.ital:
                return 'TH'
            head = ''.join(s.text for s in _leading(sig, bold))
            if not all_bold and head.rstrip().endswith(':'):
                return 'FIELD'
            return 'TD'
        if s0.weight == 'bold':
            return 'SIDE' if s0.size < 9.8 else 'TD'
        if s0.size >= 9.3:
            return 'TD'
        return 'SIDE' if s0.size >= 8.6 else 'FOOT'
    if s0.fam == 'O':
        if s0.color == GREY_SB:
            return 'SBITAL'
        if s0.color == BROWN:
            return 'SBPROP' if bold(s0) else 'SBPROPC'
        return 'SBTEXT'
    if s0.ital and s0.size >= 9.8 and all(s.ital for s in sig):
        return 'SUB'
    return 'BODY'


def _leading(spans, pred):
    out = []
    for s in spans:
        if not s.text.strip():
            if out:
                out.append(s)
            continue
        if not pred(s):
            break
        out.append(s)
    return out


# ------------------------------------------------------------------- césures

WORD = r"[A-Za-zÀ-ÖØ-öø-ÿœŒ]+"
KEEP_RIGHT = {'même', 'mêmes', 'ci', 'là', 'delà', 'dessus', 'dessous', 'ce', 'être'}


class Joiner:
    """Recolle deux lignes. Une césure en fin de ligne est retirée, sauf si le
    mot composé existe tel quel ailleurs dans le document (« demi-dégâts »)."""

    def __init__(self, texts):
        self.words, self.pairs = set(), set()
        for t in texts:
            t = t.rstrip()
            toks = re.findall(WORD + r"(?:-" + WORD + r")*", t)
            if t.endswith('-') and toks:
                toks = toks[:-1]
            for tok in toks:
                parts = tok.lower().split('-')
                if len(parts) == 1:
                    self.words.add(parts[0])
                for a, b in zip(parts, parts[1:]):
                    self.pairs.add(a + '-' + b)

    def join(self, a, b):
        a = a.rstrip(' ')
        b = b.lstrip(' ')
        if not a:
            return b
        if not b:
            return a
        m = re.search('(' + WORD + ')-$', a)
        n = re.match(WORD, b)
        if m and n:
            left, right = m.group(1), n.group(0)
            hyph = (left + '-' + right).lower()
            joined = (left + right).lower()
            if right.lower() in KEEP_RIGHT or (hyph in self.pairs and joined not in self.words):
                return a + b
            return a[:-1] + b
        if a.endswith(('’', "'", '/', '—')):
            return a + b
        return a + ' ' + b


# -------------------------------------------------------------------- document

class Doc:
    def __init__(self, path):
        self.pdf = pymupdf.open(str(path))
        self._lines = {}
        self.joiner = Joiner(l.text for p in range(5, self.pdf.page_count + 1)
                             for l in self.page_lines(p))

    def page_lines(self, pno):
        if pno in self._lines:
            return self._lines[pno]
        out = []
        for b in self.pdf[pno - 1].get_text('dict')['blocks']:
            for ln in b.get('lines', []):
                spans = []
                for s in ln['spans']:
                    t = clean(s['text'])
                    if not t:
                        continue
                    f = s['font']
                    fam = 'C' if f.startswith('Cambria') else 'O' if f.startswith('Optima') else 'G'
                    weight = 'semi' if 'SemiBold' in f else 'bold' if 'Bold' in f else ''
                    spans.append(Span(t, fam, weight, 'Italic' in f, s['size'], s['color'],
                                      'SC700' in f, s['bbox'][0]))
                if not ''.join(s.text for s in spans).strip():
                    continue
                first = next(s for s in spans if s.text.strip())
                line = Line(pno, first.x, ln['bbox'][1], spans, ln['bbox'][2])
                if line.y > 738:
                    continue                              # en-tête / pied de page
                line.kind = classify(line)
                if line.kind:
                    out.append(line)
        out = reading_order(out)
        self._lines[pno] = out
        return out

    def lines(self, first, last):
        return [l for p in range(first, last + 1) for l in self.page_lines(p)]

    def blocks(self, first, last):
        return Builder(self.joiner).run(self.lines(first, last))

    def chapter(self, cid):
        _, _, first, last = CHAPTER[cid]
        return self.blocks(first, last)


def reading_order(lines):
    """Colonne de gauche, colonne de droite, puis tableaux pleine largeur.

    Le flux du PDF suit les blocs de texte d'InDesign, qui placent parfois la
    colonne de droite en premier (p. 138) : le texte d'un sort se retrouvait
    alors dans le sort suivant. L'ordre est conservé à l'intérieur de chaque
    groupe — c'est lui qui met un titre avant son texte."""
    keyed, i = [], 0
    while i < len(lines):
        if lines[i].kind in TABLE_KINDS:
            j = i
            while j < len(lines) and lines[j].kind in TABLE_KINDS:
                j += 1
            run = lines[i:j]
            # Pleine largeur : une même ligne du tableau enjambe les deux
            # colonnes. Un tableau simplement réparti sur deux colonnes
            # (« Babioles », « Couches prismatiques ») suit chaque colonne.
            full = sum(1 for a, b in zip(run, run[1:])
                       if (a.x < 300) != (b.x < 300) and abs(a.y - b.y) < 3) >= 2
            keyed.extend((2 if full else (0 if x.x < 300 else 1), k, x)
                         for k, x in enumerate(run, start=i))
            i = j
        else:
            keyed.append((0 if lines[i].x < 300 else 1, i, lines[i]))
            i += 1
    return [x for _, _, x in sorted(keyed, key=lambda t: (t[0], t[1]))]


# ------------------------------------------------------------------- les blocs

def col_left(x):
    return 313 if x >= 300 else 63


def indent(l):
    return l.x - col_left(l.x)


FAM = {'BODY': 'C', 'SUB': 'C', 'SBTEXT': 'O', 'SIDE': 'S', 'FOOT': 'F'}
TABLE_KINDS = ('TT', 'TH', 'TD')


class Builder:
    def __init__(self, joiner):
        self.j = joiner
        self.out = []
        self.cur = None

    # ---- flux principal
    def run(self, lines):
        for l in lines:
            self.feed(l)
        self.flush()
        return self.out

    def flush(self):
        c, self.cur = self.cur, None
        if c is None:
            return
        if c['t'] == 'tbl':
            t = assemble_table(c['lines'], self.j)
            prev = self.out[-1] if self.out else None
            if (t and t['t'] == 'table' and prev and prev['t'] == 'table' and not t['title']
                    and t['headers'] and t['headers'] == prev['headers']):
                prev['rows'].extend(t['rows'])            # suite en colonne de droite
                prev['lines'] = prev['lines'] + t['lines']
            elif t:
                self.out.append(t)
            return
        if 'text' in c:
            c['text'] = squash(c['text'])
        if 'value' in c:
            c['value'] = squash(c['value'])
        for k in ('last', 'n', 'ind', 'hanging', 'runin_open'):
            c.pop(k, None)
        self.out.append(c)

    def feed(self, l):
        k, c = l.kind, self.cur
        text = l.text

        if k in ('H1', 'H2', 'H3', 'H4', 'SIDET'):
            lvl = {'H1': 1, 'H2': 2, 'H3': 3, 'H4': 4, 'SIDET': 5}[k]
            if (c and c['t'] == 'h' and c['lvl'] == lvl and c['page'] == l.page
                    and 0 < l.y - c['last'].y < (40 if lvl <= 2 else 26)):
                c['text'] = self.j.join(c['text'], text)
                c['last'] = l
                return
            self.flush()
            self.cur = {'t': 'h', 'lvl': lvl, 'text': text, 'page': l.page, 'last': l}
            return

        if k == 'SUB' and c and c['t'] in ('h', 'sub'):
            if c['t'] == 'sub':
                c['text'] = self.j.join(c['text'], text)
                c['last'] = l
                return
            self.flush()
            self.cur = {'t': 'sub', 'text': text, 'page': l.page, 'last': l}
            return

        if k == 'SB':
            self.flush()
            self.cur = {'t': 'sbname', 'text': text, 'page': l.page, 'last': l}
            return
        if k == 'SBSEC':
            self.flush()
            self.cur = {'t': 'sbsec', 'text': text, 'page': l.page, 'last': l}
            return
        if k == 'SBITAL':
            if c and c['t'] == 'sbital':
                c['text'] = self.j.join(c['text'], text)
                c['last'] = l
                return
            self.flush()
            self.cur = {'t': 'sbital', 'text': text, 'page': l.page, 'last': l}
            return
        if k in ('SBPROP', 'SBPROPC'):
            if k == 'SBPROPC' and c and c['t'] == 'sbprop':
                c['value'] = self.j.join(c['value'], text)
                c['last'] = l
                return
            self.flush()
            head = ''.join(s.text for s in _leading(l.sig, bold))
            self.cur = {'t': 'sbprop', 'label': head.strip(), 'value': text[len(head):] if text.startswith(head) else text,
                        'page': l.page, 'last': l}
            if not text.startswith(head):
                self.cur['value'] = text.replace(head, '', 1)
            return
        if k == 'SBABL':
            if c and c['t'] == 'sbabl':
                c['lines'].append(l)
                return
            self.flush()
            self.cur = {'t': 'sbabl', 'lines': [l], 'page': l.page}
            return

        if k == 'FIELD':
            self.flush()
            head = ''.join(s.text for s in _leading(l.sig, bold))
            idx = text.find(head.strip())
            value = text[idx + len(head.strip()):] if idx >= 0 else text
            self.cur = {'t': 'field', 'label': head.strip().rstrip(':').strip(), 'value': value,
                        'page': l.page, 'x': l.x, 'last': l}
            return
        if k == 'TD' and c and c['t'] == 'field' and c['page'] == l.page \
                and 0 < l.y - c['last'].y < 15 and l.x >= c['x'] - 1 and abs(l.x - c['x']) < 40:
            c['value'] = self.j.join(c['value'], text)
            c['last'] = l
            return

        if k in TABLE_KINDS:
            if c and c['t'] == 'tbl' and not self.new_table(c, l):
                c['lines'].append(l)
                return
            self.flush()
            self.cur = {'t': 'tbl', 'lines': [l]}
            return

        # ---- paragraphes
        fam = FAM.get(k, 'C')
        if c and c['t'] == 'p' and self.continues(c, l, fam):
            self.extend_para(c, l)
            return
        self.flush()
        self.cur = self.new_para(l, fam)

    # ---- tableaux
    @staticmethod
    def new_table(c, l):
        lines = c['lines']
        if l.kind == 'TT':
            return True
        if l.kind == 'TH' and any(x.kind == 'TD' for x in lines):
            first = lines[0] if lines[0].kind != 'TT' else (lines[1] if len(lines) > 1 else lines[0])
            if abs(l.x - first.x) > 150 or l.page != lines[-1].page or l.y < lines[-1].y - 40:
                return True
        return False

    # ---- paragraphes
    @staticmethod
    def runin_of(l, fam):
        if fam == 'O':
            pred = lambda s: bold(s) and s.ital and s.fam == 'O'
        else:
            pred = bold
        lead = _leading(l.sig, pred)
        txt = ''.join(s.text for s in lead).strip()
        rest = [s for s in l.sig if s not in lead]
        return (txt or None), bool(lead) and not rest

    def new_para(self, l, fam):
        runin, open_ = self.runin_of(l, fam)
        text = l.text
        return {'t': 'p', 'fam': fam, 'text': text, 'runin': runin, 'runin_open': open_,
                'bullet': text.lstrip().startswith('•'), 'page': l.page, 'ind': indent(l),
                'n': 1, 'hanging': False, 'last': l}

    def extend_para(self, c, l):
        if c['runin_open']:
            r, open_ = self.runin_of(l, c['fam'])
            if r:
                c['runin'] = self.j.join(c['runin'] or '', r)
            c['runin_open'] = open_
        c['text'] = self.j.join(c['text'], l.text)
        c['n'] += 1
        c['last'] = l

    def continues(self, c, l, fam):
        if c['fam'] != fam:
            return False
        if c['runin_open']:
            return True
        t = l.text.lstrip()
        if t.startswith('•'):
            return False
        last = c['last']
        dy = l.y - last.y
        same_col = l.page == last.page and (l.x >= 300) == (last.x >= 300)
        if fam == 'O':
            return self.runin_of(l, 'O')[0] is None
        if fam in ('S', 'F'):
            return same_col and 0 < dy < 14.5 and not ends_runin(self.runin_of(l, fam)[0])
        if same_col and dy > 16.5:
            return False
        ind = indent(l)
        if 5 <= ind <= 11:
            if c['bullet']:
                return False
            if c['n'] == 1 and c['ind'] < 5 and c['runin']:
                c['hanging'] = True
            return c['hanging']
        if ind > 11:
            return True
        r, _ = self.runin_of(l, fam)
        if ends_runin(r) and c['runin'] and c['ind'] < 5:
            return False
        return True


def ends_runin(r):
    """« Durée. », « Prérequis : », « « Vous. » » : un intitulé en gras."""
    return bool(r) and re.search(r'[.:][\s»"]*$', r) is not None


# ---------------------------------------------------------------- tableaux

def assemble_table(lines, j):
    title = None
    if lines and lines[0].kind == 'TT':
        title = squash(lines[0].text)
        lines = lines[1:]
    if not lines:
        return {'t': 'h', 'lvl': 6, 'text': title} if title else None
    first_td = next((i for i, l in enumerate(lines) if l.kind != 'TH'), len(lines))
    heads, cells = lines[:first_td], lines[first_td:]
    if any(l.kind == 'TH' for l in cells):           # libellés de ligne en gras
        heads, cells = [], lines

    # Colonnes : groupes d'en-têtes, ou à défaut groupes d'abscisses des cellules.
    groups = []
    for l in heads:
        if re.fullmatch(r'\s*—.*—\s*', l.text):
            continue                                  # sur-titre (« —Emplacements… — »)
        for g in groups:
            if any(abs(x.x - l.x) < 14 for x in g):
                g.append(l)
                break
        else:
            groups.append([l])
    if groups:
        groups.sort(key=lambda g: min(x.x for x in g))
        cols = [min(x.x for x in g) for g in groups]
        headers = []
        for g in groups:
            txt = ''
            for x in sorted(g, key=lambda x: x.y):
                txt = j.join(txt, x.text)
            headers.append(squash(txt))
    else:
        xs = sorted(l.x for l in cells)
        cols = []
        for x in xs:
            if not cols or x - cols[-1][-1] > 14:
                cols.append([x])
            else:
                cols[-1].append(x)
        cols = [c[0] for c in cols]
        headers = []

    ivals = [(min(x.x for x in g), max(x.x1 for x in g)) for g in groups]

    def by_start(x):
        idx = 0
        for i, cx in enumerate(cols):
            if cx <= x + 12:
                idx = i
        return idx

    def col_of(l):
        """Colonne dont l'en-tête est le plus proche du centre de la cellule
        (les prix sont alignés à droite) — sauf si la cellule commence bien
        avant cette colonne : c'est alors un nom qui déborde."""
        if not ivals:
            return by_start(l.x)
        c = (l.x + l.x1) / 2
        best, bd = 0, 1e9
        for i, (a, b) in enumerate(ivals):
            dist = 0 if a - 6 <= c <= b + 6 else min(abs(c - a), abs(c - b))
            if dist < bd:
                best, bd = i, dist
        return best if l.x >= ivals[best][0] - 30 else by_start(l.x)

    rows, last_y, group_open = [], {}, False
    for l in cells:
        c = col_of(l)
        italic_row = c == 0 and all(s.ital for s in l.sig)
        dy = l.y - last_y[c] if c in last_y else 999
        new_row = (not rows or group_open or italic_row
                   or (dy >= 12.6 or dy < -3) and (c == 0 or rows[-1][c]))
        if new_row:
            rows.append([''] * len(cols))
            last_y = {}
            group_open = italic_row
            if italic_row:
                rows[-1] = [squash(l.text)]
                continue
        row = rows[-1]
        if len(row) == 1:                             # ligne de groupe déjà close
            rows.append([''] * len(cols))
            row = rows[-1]
        row[c] = squash(j.join(row[c], l.text))
        last_y[c] = l.y
    rows = [r for r in rows if any(x for x in r)]
    return {'t': 'table', 'title': title, 'headers': headers, 'rows': rows,
            'page': lines[0].page, 'lines': lines}
