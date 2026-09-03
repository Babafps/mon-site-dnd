// =====================================================
// SRD — accès aux règles (chargement à la demande + cache hors ligne)
//
// Rien n'est téléchargé au démarrage du site. L'index de recherche (~320 Ko)
// n'arrive qu'à la première recherche ; une fiche complète (ex. les 317
// monstres) qu'à la première consultation de sa catégorie. Tout ce qui a été
// chargé une fois reste disponible hors connexion via l'API Cache.
//
// Données : SRD 5.1 — version française officielle (Wizards of the Coast),
// sous licence CC-BY-4.0. Voir data/srd/README.md.
//
// Le CONTENU PERSONNEL (§ « Contenu personnel » plus bas) se greffe ici, et
// nulle part ailleurs : index(), category() et entry() renvoient les entrées
// du joueur mêlées à celles du SRD, avec la même forme. La page Règles, la
// loupe et l'autocomplétion en profitent sans une ligne de code spécifique.
// =====================================================
(function () {
    'use strict';

    const CACHE_NAME = 'srd-data-v1';
    const memory = new Map();          // url -> données déjà analysées
    const inflight = new Map();        // url -> promesse en cours (évite les doublons)

    let edition = '2014';
    let lang = 'fr';
    const base = () => `data/srd/${edition}/${lang}/`;

    async function fromCache(url) {
        if (!('caches' in window)) return null;
        try {
            const c = await caches.open(CACHE_NAME);
            const r = await c.match(url);
            return r ? await r.json() : null;
        } catch (e) { return null; }
    }

    async function toCache(url, response) {
        if (!('caches' in window)) return;
        try { (await caches.open(CACHE_NAME)).put(url, response); } catch (e) {}
    }

    // Réseau d'abord, cache en secours : les données sont figées, mais on veut
    // profiter d'une mise à jour du fichier sans vider le cache à la main.
    function load(url) {
        if (memory.has(url)) return Promise.resolve(memory.get(url));
        if (inflight.has(url)) return inflight.get(url);

        const p = (async () => {
            try {
                const res = await fetch(url, { cache: 'no-cache' });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                toCache(url, res.clone());
                const data = await res.json();
                memory.set(url, data);
                return data;
            } catch (err) {
                const cached = await fromCache(url);
                if (cached) { memory.set(url, cached); return cached; }
                // Message actionnable : un « 404 » brut ne dit pas quoi corriger.
                const e = new Error(err.message);
                e.url = url;
                e.diagnostic = /404/.test(err.message)
                    ? `Le fichier « ${url} » est introuvable sur le serveur.
`
                      + `Le dossier data/ n'a probablement pas été téléversé avec le site : `
                      + `vérifie qu'il est bien présent à côté d'index.html.`
                    : (location.protocol === 'file:'
                        ? `Le site est ouvert en file:// — le navigateur y bloque le chargement des données. `
                          + `Lance serve.ps1 puis ouvre http://localhost:8123.`
                        : `Impossible de charger « ${url} » (${err.message}).`);
                throw e;
            } finally {
                inflight.delete(url);
            }
        })();
        inflight.set(url, p);
        return p;
    }

    const fold = (s) => String(s || '').normalize('NFD')
        .replace(/[̀-ͯ]/g, '').toLowerCase();

    const CATEGORIES = [
        { id: 'spells',      label: 'Sorts',           icon: '✨' },
        { id: 'monsters',    label: 'Monstres',        icon: '🐉' },
        { id: 'magic-items', label: 'Objets magiques', icon: '💎' },
        { id: 'equipment',   label: 'Équipement',      icon: '🎒' },
        { id: 'rules',       label: 'Règles',          icon: '📖' },
        { id: 'classes',     label: 'Classes',         icon: '⚔️' },
        { id: 'races',       label: 'Races',           icon: '🧝' },
        { id: 'conditions',  label: 'États',           icon: '🌀' },
        { id: 'backgrounds', label: 'Historiques',     icon: '📜' },
        { id: 'feats',       label: 'Dons',            icon: '⭐' }
    ];
    const CAT_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

    // =====================================================
    // Contenu personnel (« homebrew »)
    //
    // Vit dans le navigateur et le compte du joueur, JAMAIS dans data/ : le SRD
    // ne publie qu'une sous-classe par classe, un historique et un don, le reste
    // appartient au Manuel des Joueurs et n'est pas redistribuable. Chacun
    // saisit ici ce qu'il possède, pour sa table.
    //
    // Stockage : clé globale `dnd-homebrew`, partagée par tous les personnages
    // du compte. Hors de `memory`, que setEdition/setLang vident.
    // =====================================================
    const HB_KEY = 'dnd-homebrew';
    const HB_PREFIX = 'perso-';

    // Chaque type d'entrée créable, et la catégorie SRD dans laquelle il se fond.
    const HOMEBREW_TYPES = [
        { id: 'classes',     cat: 'classes',     label: 'Classe',        icon: '⚔️' },
        { id: 'subclasses',  cat: 'classes',     label: 'Sous-classe',   icon: '⚔️', parent: 'classes' },
        { id: 'races',       cat: 'races',       label: 'Race',          icon: '🧝' },
        { id: 'subraces',    cat: 'races',       label: 'Sous-race',     icon: '🧝', parent: 'races' },
        { id: 'backgrounds', cat: 'backgrounds', label: 'Historique',    icon: '📜' },
        { id: 'feats',       cat: 'feats',       label: 'Don',           icon: '⭐' },
        { id: 'spells',      cat: 'spells',      label: 'Sort',          icon: '✨' },
        { id: 'magic-items', cat: 'magic-items', label: 'Objet magique', icon: '💎' },
        { id: 'equipment',   cat: 'equipment',   label: 'Équipement',    icon: '🎒' },
        { id: 'monsters',    cat: 'monsters',    label: 'Monstre',       icon: '🐉' },
        { id: 'conditions',  cat: 'conditions',  label: 'État',          icon: '🌀' }
    ];
    const HB_BY_TYPE = Object.fromEntries(HOMEBREW_TYPES.map(t => [t.id, t]));
    // Types dont les entrées s'affichent d'elles-mêmes dans une catégorie
    // (les sous-classes et sous-races, elles, vivent dans leur parent).
    const HB_MAIN = HOMEBREW_TYPES.filter(t => !t.parent);
    const HB_SUB = HOMEBREW_TYPES.filter(t => t.parent);

    let hb = null;

    function hbAll() {
        if (hb) return hb;
        let raw = null;
        try { raw = JSON.parse(localStorage.getItem(HB_KEY) || 'null'); } catch (e) { raw = null; }
        hb = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
        HOMEBREW_TYPES.forEach(t => { if (!Array.isArray(hb[t.id])) hb[t.id] = []; });
        return hb;
    }

    function hbPersist() {
        try {
            localStorage.setItem(HB_KEY, JSON.stringify(hbAll()));
        } catch (e) {
            if (window.DBQuota) window.DBQuota();
            throw new Error('Mémoire du navigateur pleine : le contenu n’a pas pu être enregistré.');
        }
        document.dispatchEvent(new CustomEvent('srd-homebrew-change'));
    }

    function hbSlug(name) {
        const s = fold(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        return s || 'entree';
    }

    /** Identifiant unique, toujours préfixé : aucune collision possible avec le SRD. */
    function hbNewId(type, name) {
        const list = hbAll()[type] || [];
        const root = HB_PREFIX + hbSlug(name);
        let id = root, n = 2;
        while (list.some(e => e.id === id)) id = root + '-' + (n++);
        return id;
    }

    const isHb = (id) => String(id || '').startsWith(HB_PREFIX);

    /** Sous-titre affiché dans les listes et la recherche. */
    function hbSubtitle(type, e) {
        const t = HB_BY_TYPE[type] || {};
        if (t.parent) return `${t.label} · ${e.parent_name || '?'}`;
        if (type === 'spells') {
            const lv = Number(e.level) || 0;
            return (lv ? `Sort de niveau ${lv}` : 'Sort mineur') + (e.school ? ` · ${e.school}` : '');
        }
        if (type === 'monsters') return [e.size, e.type].filter(Boolean).join(' ') || 'Monstre';
        if (type === 'magic-items') return [e.type, e.rarity].filter(Boolean).join(' · ') || 'Objet magique';
        if (type === 'equipment') return e.type || 'Équipement';
        return t.label || '';
    }

    function hbSnippet(e) {
        const src = Array.isArray(e.desc) ? e.desc.join(' ')
                  : (e.desc || (Array.isArray(e.text) ? e.text.join(' ') : e.text) || '');
        return String(src).slice(0, 110);
    }

    /** Entrées perso à la forme compacte de l'index — `f` est obligatoire,
     *  une entrée sans lui serait invisible à la recherche. */
    function hbIndexEntries() {
        const all = hbAll(), out = [];
        HOMEBREW_TYPES.forEach(t => {
            (all[t.id] || []).forEach(e => {
                const s = hbSubtitle(t.id, e);
                out.push({ i: e.id, n: e.name, c: t.cat, s, t: hbSnippet(e),
                           f: fold(e.name + ' ' + s), p: 1 });
            });
        });
        return out;
    }

    /** Sous-classes / sous-races perso rattachées à une entrée (SRD ou perso). */
    function hbChildrenOf(cat, parentId) {
        const sub = HB_SUB.find(t => t.cat === cat);
        if (!sub) return [];
        return (hbAll()[sub.id] || []).filter(e => e.parent === parentId);
    }

    /** Greffe les enfants perso sur une entrée du SRD, sans toucher au cache. */
    function withHbChildren(cat, e) {
        if (!e) return e;
        const kids = hbChildrenOf(cat, e.id);
        if (!kids.length) return e;
        const key = cat === 'races' ? 'subraces' : 'subclasses';
        return Object.assign({}, e, { [key]: (e[key] || []).concat(kids) });
    }

    function hbFind(cat, id) {
        const all = hbAll();
        for (const t of HOMEBREW_TYPES) {
            if (t.cat !== cat) continue;
            const hit = (all[t.id] || []).find(e => e.id === id);
            if (hit) return Object.assign({}, hit, { source: 'perso', _type: t.id });
        }
        return null;
    }

    const HOMEBREW = {
        TYPES: HOMEBREW_TYPES,
        all: () => hbAll(),
        list: (type) => (hbAll()[type] || []).slice(),
        get: (type, id) => (hbAll()[type] || []).find(e => e.id === id) || null,
        newId: hbNewId,
        isPerso: isHb,
        subtitle: hbSubtitle,
        /** Crée ou remplace une entrée. Renvoie l'entrée enregistrée. */
        save(type, entry) {
            if (!HB_BY_TYPE[type]) throw new Error('Type inconnu : ' + type);
            const list = hbAll()[type];
            const e = Object.assign({}, entry, { source: 'perso' });
            if (!e.name || !String(e.name).trim()) throw new Error('Il faut au moins un nom.');
            e.name = String(e.name).trim();
            if (!e.id) e.id = hbNewId(type, e.name);
            const i = list.findIndex(x => x.id === e.id);
            if (i >= 0) list[i] = e; else list.push(e);
            hbPersist();
            return e;
        },
        remove(type, id) {
            const list = hbAll()[type];
            const i = list.findIndex(e => e.id === id);
            if (i < 0) return null;
            const [gone] = list.splice(i, 1);
            hbPersist();
            return gone;
        },
        /** Réinsère une entrée supprimée à sa place (annulation). */
        restore(type, entry, index) {
            const list = hbAll()[type];
            list.splice(Math.max(0, Math.min(index, list.length)), 0, entry);
            hbPersist();
        },
        indexOf(type, id) {
            return (hbAll()[type] || []).findIndex(e => e.id === id);
        },
        count() {
            return HOMEBREW_TYPES.reduce((n, t) => n + (hbAll()[t.id] || []).length, 0);
        },
        exportText() {
            return JSON.stringify({
                format: 'bones-and-blades/homebrew', version: 1,
                exported: new Date().toISOString(),
                content: hbAll()
            }, null, 1);
        },
        /** Import d'un fichier exporté. `mode` : 'merge' (défaut) ou 'replace'.
         *  Renvoie le nombre d'entrées ajoutées / remplacées. */
        importText(text, mode) {
            let data;
            try { data = JSON.parse(text); }
            catch (e) { throw new Error('Ce fichier n’est pas du JSON valide.'); }
            const content = (data && data.content) || data;
            if (!content || typeof content !== 'object') throw new Error('Fichier illisible.');
            const known = HOMEBREW_TYPES.filter(t => Array.isArray(content[t.id]));
            if (!known.length) throw new Error('Aucun contenu personnel reconnu dans ce fichier.');
            if (mode === 'replace') { hb = null; hbAll(); HOMEBREW_TYPES.forEach(t => { hb[t.id] = []; }); }
            let added = 0, replaced = 0;
            known.forEach(t => {
                const list = hbAll()[t.id];
                content[t.id].forEach(raw => {
                    if (!raw || !raw.name) return;
                    const e = Object.assign({}, raw, { source: 'perso' });
                    if (!isHb(e.id)) e.id = hbNewId(t.id, e.name);
                    const i = list.findIndex(x => x.id === e.id);
                    if (i >= 0) { list[i] = e; replaced++; } else { list.push(e); added++; }
                });
            });
            hbPersist();
            return { added, replaced };
        }
    };

    // =====================================================
    // Lecture — SRD + contenu personnel
    // =====================================================

    /** Recherche dans l'index léger. Retourne au plus `limit` résultats,
     *  les correspondances en début de nom d'abord. */
    async function search(query, opts) {
        const o = opts || {};
        const q = fold(query).trim();
        if (q.length < 2) return [];
        const idx = await index();
        const cat = o.category;
        const out = [];
        for (const e of idx) {
            if (cat && e.c !== cat) continue;
            const pos = e.f.indexOf(q);
            if (pos === -1) continue;
            out.push({ entry: e, rank: pos === 0 ? 0 : (e.f[pos - 1] === ' ' ? 1 : 2) });
            if (out.length > 600) break;
        }
        out.sort((a, b) => a.rank - b.rank || a.entry.n.localeCompare(b.entry.n, 'fr'));
        return out.slice(0, o.limit || 40).map(r => decorate(r.entry));
    }

    function decorate(e) {
        const c = CAT_BY_ID[e.c] || { label: e.c, icon: '📄' };
        return { id: e.i, name: e.n, category: e.c, categoryLabel: c.label,
                 icon: c.icon, subtitle: e.s || '', snippet: e.t || '',
                 perso: !!e.p };
    }

    let lastIndex = null;              // dernier index chargé, pour les liens croisés

    async function index() {
        const srd = (await load(base() + 'index.json')).entries;
        lastIndex = srd;
        linkRx = undefined;            // l'index a pu changer d'édition
        return srd.concat(hbIndexEntries());
    }

    /** Fiche complète d'une catégorie (télécharge le fichier une seule fois). */
    async function category(cat) {
        const d = await load(base() + cat + '.json');
        const srd = d.entries || d.sections || [];
        if (cat === 'rules') return srd;
        const mine = HB_MAIN.filter(t => t.cat === cat)
            .flatMap(t => (hbAll()[t.id] || []).map(e => Object.assign({}, e, { source: 'perso' })));
        return srd.map(e => withHbChildren(cat, e)).concat(mine);
    }

    /** Une entrée complète, par catégorie + identifiant.
     *  Le contenu personnel est consulté en premier : ses identifiants sont
     *  préfixés, il n'y a donc jamais d'ambiguïté. */
    async function entry(cat, id) {
        const mine = hbFind(cat, id);
        if (mine) {
            if (mine._type === 'classes' || mine._type === 'races') return withHbChildren(cat, mine);
            return mine;
        }
        const list = await category(cat);
        if (cat === 'rules') {
            let found = null;
            (function walk(nodes) {
                for (const n of nodes) {
                    if (found) return;
                    if (n.id === id) { found = n; return; }
                    walk(n.children || []);
                }
            })(list);
            return found;
        }
        const direct = list.find(e => e.id === id);
        if (direct) return direct;
        // sous-classes et sous-races vivent dans leur parent
        for (const e of list) {
            const sub = (e.subclasses || []).find(s => s.id === id)
                     || (e.subraces || []).find(s => s.id === id);
            if (sub) return Object.assign({}, sub, { parent: e.id, parent_name: e.name });
        }
        return null;
    }

    // ---------- Progression : ce qui se débloque à quel niveau ----------
    // Utilisé par l'assistant de création et par le bouton de montée de niveau.
    // Ces deux-là ne doivent RIEN savoir de la provenance des données : une
    // classe créée dans l'éditeur se comporte exactement comme une officielle,
    // parce qu'elle a la même forme.

    /** Retrouve une classe d'après le texte libre saisi sur la fiche
     *  (« Guerrier », « Guerrier 3 / Roublard 2 »…). SRD et perso confondus. */
    async function classByName(name) {
        const q = fold(name).trim();
        if (!q) return null;
        let list;
        try { list = await category('classes'); } catch (e) { return null; }
        let best = null, bestLen = 0;
        for (const c of list) {
            const f = fold(c.name);
            if (f && q.includes(f) && f.length > bestLen) { best = c; bestLen = f.length; }
        }
        return best;
    }

    /** Sous-classe d'une classe donnée, d'après le texte saisi. */
    function subclassByName(cls, name) {
        const q = fold(name).trim();
        if (!cls || !q) return null;
        let best = null, bestLen = 0;
        for (const s of (cls.subclasses || [])) {
            const f = fold(s.name);
            if (f && (q.includes(f) || f.includes(q)) && f.length > bestLen) { best = s; bestLen = f.length; }
        }
        return best;
    }

    /** Ce que la classe apporte à un niveau donné : ligne de la table de
     *  progression + aptitudes résolues (nom et texte complets). */
    function levelInfo(cls, level, subclass) {
        if (!cls) return null;
        const lv = Number(level) || 1;
        const row = (cls.levels || []).find(r => r.level === lv) || null;
        const byId = new Map((cls.features || []).map(f => [f.id, f]));
        const seen = new Set();
        const features = [];
        // D'abord les aptitudes nommées par la table (elles sont dans l'ordre),
        // puis celles qui portent simplement `level` — une classe perso peut
        // n'avoir que ça.
        (row ? row.features || [] : []).forEach((id, i) => {
            const f = byId.get(id);
            const label = (row.feature_labels || [])[i] || (f && f.name) || id;
            if (seen.has(label)) return;
            seen.add(label);
            features.push({ name: label, text: f ? f.text : [], id, from: cls.name });
        });
        (cls.features || []).forEach(f => {
            const hit = (f.levels || (f.level ? [f.level] : [])).includes(lv);
            if (!hit || seen.has(f.name)) return;
            seen.add(f.name);
            features.push({ name: f.name, text: f.text, id: f.id, from: cls.name });
        });
        (subclass ? subclass.features || [] : []).forEach(f => {
            if (Number(f.level) !== lv) return;
            features.push({ name: f.name, text: f.text, id: f.id, from: subclass.name, subclass: true });
        });
        return {
            level: lv,
            prof_bonus: row && row.prof_bonus != null ? row.prof_bonus : Math.floor((lv - 1) / 4) + 2,
            spell_slots: (row && row.spell_slots) || null,
            class_specific: (row && row.class_specific) || null,
            cantrips_known: row ? row.cantrips_known : undefined,
            spells_known: row ? row.spells_known : undefined,
            features
        };
    }

    /** Les sorts qu'une classe peut apprendre, jusqu'à un rang donné.
     *  L'identifiant est le même des deux côtés (« wizard ») : chaque sort
     *  déclare les listes auxquelles il appartient. Un sort perso qui ne
     *  déclare aucune classe est toujours proposé — son auteur est le seul à
     *  savoir à qui il appartient, on ne le lui cache pas. */
    async function spellsForClass(classId, maxRank) {
        if (!classId) return [];
        const max = (maxRank == null) ? 9 : Number(maxRank);
        let list;
        try { list = await category('spells'); } catch (e) { return []; }
        return list
            .filter(s => {
                if ((Number(s.level) || 0) > max) return false;
                const cl = s.classes;
                if (!Array.isArray(cl) || !cl.length) return s.source === 'perso';
                return cl.includes(classId);
            })
            .sort((a, b) => (Number(a.level) || 0) - (Number(b.level) || 0)
                         || String(a.name || '').localeCompare(String(b.name || ''), 'fr'));
    }

    /** Précharge en tâche de fond, sans bloquer (pour le mode hors connexion). */
    function preload(cats) {
        (cats || ['index']).forEach(c => {
            const url = base() + (c === 'index' ? 'index.json' : c + '.json');
            load(url).catch(() => {});
        });
    }


    // ---------- Rendu d'une entrée, formaté par catégorie ----------
    // Vit ici (et non dans script.js) pour être disponible sur les trois écrans :
    // accueil, page Règles et fiche de personnage.
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // ---------- Liens croisés ----------
    // Un sort cité dans une aptitude, un état cité dans l'action d'un monstre :
    // le nom devient cliquable vers sa fiche. La détection se fait sur l'index
    // déjà chargé — jamais de requête réseau au moment du rendu, et si l'index
    // n'est pas là, le texte reste simplement du texte.
    // Seuls les noms sans ambiguïté sont retenus : les états (« empoigné »)
    // quelle que soit leur longueur, mais uniquement les sorts et objets en
    // plusieurs mots. « Bouclier » ou « Lumière » sont d'abord des mots
    // courants — les lier renverrait sans cesse vers le mauvais sort.
    const LINK_CATS = ['spells', 'conditions', 'magic-items'];
    const MIN_LINK = 5;
    const linkable = (e) => e.n.length >= MIN_LINK
        && (e.c === 'conditions' || /\s/.test(e.n.trim()));
    let linkRx, linkMap;

    function buildLinkIndex() {
        linkRx = null; linkMap = null;
        if (!lastIndex) {
            // L'index n'a pas encore servi (fiche ouverte directement depuis
            // l'autocomplétion) : on le charge en tâche de fond, le prochain
            // rendu aura ses liens. Le texte reste lisible entre-temps.
            index().catch(() => {});
            return;
        }
        // Le motif est bâti sur les noms ACCENTUÉS : le texte du SRD l'est aussi,
        // et « paralysé » ne se reconnaîtrait pas dans un motif replié.
        // La table de correspondance, elle, reste repliée (recherche insensible).
        const map = new Map(), raw = [];
        const add = (e) => {
            if (!LINK_CATS.includes(e.c) || !linkable(e)) return;
            const k = fold(e.n);
            if (map.has(k)) return;
            map.set(k, { cat: e.c, id: e.i });
            raw.push(e.n.trim());
        };
        lastIndex.forEach(add);
        hbIndexEntries().forEach(add);
        if (!map.size) return;
        const names = raw.sort((a, b) => b.length - a.length)
            .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        // Bornes de mot tolérantes aux accents (\b ne les reconnaît pas) et
        // accord facultatif : « la cible est paralysée » doit pointer sur
        // l'état « paralysé ».
        linkRx = new RegExp('(?<![\\wÀ-ÿ])(' + names.join('|') + ')(e|es|s)?(?![\\wÀ-ÿ])', 'gi');
        linkMap = map;
    }

    /** Transforme en liens les noms reconnus d'un fragment DÉJÀ échappé. */
    function linkify(html, skipId) {
        if (linkRx === undefined) buildLinkIndex();
        if (!linkRx || !html || html.length > 20000) return html;
        linkRx.lastIndex = 0;
        return html.replace(linkRx, (m, base) => {
            const hit = linkMap.get(fold(base));
            if (!hit || hit.id === skipId) return m;
            return `<a href="#" class="rw-link rw-xref" data-cat="${hit.cat}" data-id="${esc(hit.id)}">${m}</a>`;
        });
    }

    let renderSkipId = null;                       // ne pas s'auto-lier
    const txt = (s) => linkify(esc(s), renderSkipId);

    const P = (arr) => (Array.isArray(arr) ? arr : (arr ? [arr] : []))
        .map(t => `<p>${txt(t)}</p>`).join('');
    // Les lignes de caractéristiques restent du texte brut : « vision dans le
    // noir 18 m » est un sens, pas le sort du même nom.
    const KV = (label, val) => val ? `<p><b>${label} :</b> ${esc(val)}</p>` : '';
    const NAMED = (list, title) => (list && list.length)
        ? (title ? `<h4 class="rw-h">${title}</h4>` : '') + list.map(x =>
            `<p><b>${esc(x.name)}${x.level ? ` <span class="rw-lvl">niv. ${esc(x.level)}</span>` : ''}.</b> `
            + `${txt(Array.isArray(x.text) ? x.text.join(' ') : x.text)}</p>`
            + (x.options && x.options.length
                ? `<div class="rw-opts">${x.options.map(o =>
                    `<p><i>${esc(o.name)}.</i> ${txt(Array.isArray(o.text) ? o.text.join(' ') : o.text)}</p>`).join('')}</div>`
                : '')).join('')
        : '';

    const PERSO_BADGE = '<span class="rw-perso" title="Contenu personnel, absent du SRD">perso</span>';

    // ---------- Table de progression d'une classe ----------
    // Le SRD la donne en tête de chaque classe ; c'est elle qui dit ce qu'on
    // gagne à quel niveau. Même rendu pour une classe officielle et une classe
    // créée dans l'éditeur : la forme des données est la même.
    function levelTable(e) {
        const rows = e.levels || [];
        if (!rows.length) return '';
        const extra = e.level_columns || [];
        const slotRanks = [...new Set(rows.flatMap(r => Object.keys(r.spell_slots || {})))]
            .map(Number).sort((a, b) => a - b);
        const cell = (v) => (v === 0 || v) ? esc(v) : '—';
        const head = ['<th>Niveau</th>', '<th>Maîtrise</th>', '<th class="rw-col-feat">Aptitudes</th>']
            .concat(extra.map(c => `<th>${esc(c.label)}</th>`))
            .concat(slotRanks.length
                ? [`<th class="rw-slots-head" colspan="${slotRanks.length}">Emplacements par niveau de sort</th>`]
                : []);
        const sub = slotRanks.length
            ? `<tr><th colspan="${3 + extra.length}"></th>`
              + slotRanks.map(n => `<th>${n}<sup>${n === 1 ? 'er' : 'e'}</sup></th>`).join('') + '</tr>'
            : '';
        const body = rows.map(r => '<tr>'
            + `<td class="rw-lv">${esc(r.level)}</td>`
            + `<td>+${esc(r.prof_bonus == null ? Math.floor((r.level - 1) / 4) + 2 : r.prof_bonus)}</td>`
            + `<td class="rw-col-feat">${esc((r.feature_labels || []).join(', ')) || '—'}</td>`
            + extra.map(c => `<td>${cell(c.field === 'class_specific'
                ? (r.class_specific || {})[c.key] : r[c.key])}</td>`).join('')
            + slotRanks.map(n => `<td>${cell((r.spell_slots || {})[n])}</td>`).join('')
            + '</tr>').join('');
        return '<h4 class="rw-h">Progression</h4>'
            + `<div class="rw-scroll"><table class="rw-table rw-levels">`
            + `<thead><tr>${head.join('')}</tr>${sub}</thead><tbody>${body}</tbody></table></div>`;
    }

    function classHeader(e) {
        const p = e.proficiencies || {};
        const eq = e.equipment || {};
        const sk = p.skills;
        const cast = { full: 'lanceur de sorts complet', half: 'demi-lanceur de sorts',
                       pact: 'magie de pacte', third: 'tiers-lanceur de sorts' }[(e.spellcasting || {}).type];
        return (e.hit_die ? KV('Dé de vie', 'd' + e.hit_die + (e.hp && e.hp.level1 ? ` · PV au niveau 1 : ${e.hp.level1}` : '')) : '')
             + (p.saves && p.saves.length ? KV('Jets de sauvegarde', p.saves.join(', ')) : '')
             + KV('Armures', p.armor) + KV('Armes', p.weapons) + KV('Outils', p.tools)
             + (sk ? KV('Compétences', sk.text || (sk.from || []).join(', ')) : '')
             + (cast ? KV('Magie', cast + ((e.spellcasting || {}).ability ? ` · ${e.spellcasting.ability}` : '')) : '')
             + ((eq.items || []).length
                ? `<h4 class="rw-h">Équipement de départ</h4>`
                  + (eq.intro ? `<p>${txt(eq.intro)}</p>` : '')
                  + `<ul class="rw-list">${eq.items.map(i => `<li>${txt(i)}</li>`).join('')}</ul>`
                : '');
    }

    function renderEntry(cat, e) {
        if (!e) return '<p>Entrée introuvable.</p>';
        renderSkipId = e.id || null;
        try {
            return (e.source === 'perso' ? `<p class="rw-perso-line">${PERSO_BADGE} Créé par toi, absent du SRD.</p>` : '')
                 + renderBody(cat, e);
        } finally { renderSkipId = null; }
    }

    function renderBody(cat, e) {
        if (cat === 'spells') {
            return KV('Temps d’incantation', e.casting_time) + KV('Portée', e.range)
                 + KV('Composantes', e.components) + KV('Durée', e.duration)
                 + '<hr class="rw-sep">' + P(e.desc)
                 + (e.higher_levels ? `<p><b>À plus haut niveau.</b> ${txt(e.higher_levels)}</p>` : '');
        }
        if (cat === 'monsters') {
            const ab = e.abilities || {};
            const m = (v) => { const x = Math.floor((v - 10) / 2); return `${v} (${x >= 0 ? '+' : ''}${x})`; };
            const stats = ['str', 'dex', 'con', 'int', 'wis', 'cha'].map((k, i) =>
                `<span class="rw-ab"><b>${['FOR','DEX','CON','INT','SAG','CHA'][i]}</b>${m(ab[k] || 10)}</span>`).join('');
            return KV('Classe d’armure', e.ac + (e.ac_desc ? ` (${e.ac_desc})` : ''))
                 + KV('Points de vie', `${e.hp}${e.hp_roll ? ` (${e.hp_roll})` : ''}`) + KV('Vitesse', e.speed)
                 + `<div class="rw-abs">${stats}</div>`
                 + KV('Jets de sauvegarde', e.saves) + KV('Compétences', e.skills)
                 + KV('Vulnérabilités', e.vulnerabilities) + KV('Résistances', e.resistances)
                 + KV('Immunités', e.immunities) + KV('Immunités (états)', e.condition_immunities)
                 + KV('Sens', e.senses) + KV('Langues', e.languages)
                 + KV('Facteur de puissance', `${e.cr_display || e.cr}${e.xp ? ` (${e.xp} PX)` : ''}`)
                 + NAMED(e.traits, '') + NAMED(e.actions, 'Actions')
                 + NAMED(e.reactions, 'Réactions')
                 + (e.legendary_intro ? `<h4 class="rw-h">Actions légendaires</h4><p>${txt(e.legendary_intro)}</p>` : '')
                 + NAMED(e.legendary_actions, e.legendary_intro ? '' : 'Actions légendaires');
        }
        if (cat === 'magic-items') {
            return KV('Type', e.type) + KV('Rareté', e.rarity)
                 + (e.attunement ? `<p><b>Harmonisation requise</b>${e.attunement_note ? ' ' + esc(e.attunement_note) : ''}</p>` : '')
                 + '<hr class="rw-sep">' + P(e.desc);
        }
        if (cat === 'equipment') {
            return KV('Prix', e.cost) + (e.weight_kg != null ? KV('Poids', e.weight_kg + ' kg') : '')
                 + (e.damage ? KV('Dégâts', `${e.damage.dice} ${e.damage.type}`) : '')
                 + (e.versatile_damage ? KV('Polyvalente', e.versatile_damage) : '')
                 + (e.armor_class ? KV('CA', e.armor_class.base + (e.armor_class.dex_bonus ? ' + mod. Dex' : '')) : '')
                 + (e.str_minimum ? KV('Force minimale', e.str_minimum) : '')
                 + (e.stealth_disadvantage ? '<p><b>Désavantage en Discrétion</b></p>' : '')
                 + (e.range_m ? KV('Portée', `${e.range_m.normal} m${e.range_m.long ? ' / ' + e.range_m.long + ' m' : ''}`) : '')
                 + (e.properties ? KV('Propriétés', e.properties.join(', ')) : '')
                 + P(e.desc);
        }
        if (cat === 'races' || cat === 'classes') {
            const subs = e.subraces || e.subclasses || [];
            return P(e.desc)
                 + (cat === 'classes' ? classHeader(e) : '')
                 + (cat === 'races' ? KV('Vitesse', e.speed) + KV('Taille', e.size)
                                    + KV('Langues', e.languages)
                                    + KV('Bonus de caractéristiques', abilityBonusText(e)) : '')
                 + (cat === 'classes' ? levelTable(e) : '')
                 + NAMED(e.traits, (e.traits || []).length ? 'Traits' : '')
                 + NAMED(e.features, (e.features || []).length ? 'Aptitudes' : '')
                 + (subs.length ? `<h4 class="rw-h">${cat === 'races' ? 'Sous-races' : 'Sous-classes'}</h4>`
                     + subs.map(s => `<p><a href="#" class="rw-link" data-cat="${cat}" data-id="${esc(s.id)}">${esc(s.name)}</a>`
                         + `${s.source === 'perso' ? ' ' + PERSO_BADGE : ''}</p>`).join('') : '');
        }
        if (cat === 'rules') {
            return P(e.content)
                 + ((e.children || []).length ? '<h4 class="rw-h">Sections</h4>'
                     + e.children.map(c => `<p><a href="#" class="rw-link" data-cat="rules" data-id="${esc(c.id)}">${esc(c.name)}</a></p>`).join('') : '');
        }
        if (cat === 'conditions' && e.table) {
            return P(e.desc) + '<table class="rw-table"><tr>'
                 + e.table.headers.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>'
                 + e.table.rows.map(r => '<tr>' + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>').join('')
                 + '</table>';
        }
        return P(e.desc || e.content) + NAMED(e.traits, (e.traits || []).length ? 'Traits' : '');
    }

    const ABILITY_LABELS = { str: 'Force', dex: 'Dextérité', con: 'Constitution',
                             int: 'Intelligence', wis: 'Sagesse', cha: 'Charisme' };

    function abilityBonusText(e) {
        const b = e.ability_bonuses;
        if (!b) return '';
        return Object.keys(b).filter(k => b[k])
            .map(k => `${ABILITY_LABELS[k] || k} ${b[k] > 0 ? '+' : ''}${b[k]}`).join(', ');
    }

    window.SRD = {
        CATEGORIES,
        search, index, category, entry, preload, fold, renderEntry, esc, linkify,
        classByName, subclassByName, levelInfo, spellsForClass,
        homebrew: HOMEBREW,
        ABILITY_LABELS,
        setEdition: (e) => { edition = e; memory.clear(); lastIndex = null; linkRx = undefined; },
        setLang: (l) => { lang = l; memory.clear(); lastIndex = null; linkRx = undefined; },
        getEdition: () => edition,
        getLang: () => lang,
        attribution: 'SRD 5.1 (Wizards of the Coast) — CC-BY-4.0'
    };
})();
