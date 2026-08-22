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
                throw new Error(`Règles indisponibles (${url}) : ${err.message}`);
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
                 icon: c.icon, subtitle: e.s || '', snippet: e.t || '' };
    }

    async function index() { return (await load(base() + 'index.json')).entries; }

    /** Fiche complète d'une catégorie (télécharge le fichier une seule fois). */
    async function category(cat) {
        const d = await load(base() + cat + '.json');
        return d.entries || d.sections || [];
    }

    /** Une entrée complète, par catégorie + identifiant. */
    async function entry(cat, id) {
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
            if (sub) return Object.assign({}, sub, { parent: e.name });
        }
        return null;
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
    const P = (arr) => (arr || []).map(t => `<p>${esc(t)}</p>`).join('');
    const KV = (label, val) => val ? `<p><b>${label} :</b> ${esc(val)}</p>` : '';
    const NAMED = (list, title) => (list && list.length)
        ? (title ? `<h4 class="rw-h">${title}</h4>` : '') + list.map(x =>
            `<p><b>${esc(x.name)}.</b> ${esc(Array.isArray(x.text) ? x.text.join(' ') : x.text)}</p>`).join('')
        : '';

    function renderEntry(cat, e) {
        if (!e) return '<p>Entrée introuvable.</p>';
        if (cat === 'spells') {
            return KV('Temps d’incantation', e.casting_time) + KV('Portée', e.range)
                 + KV('Composantes', e.components) + KV('Durée', e.duration)
                 + '<hr class="rw-sep">' + P(e.desc)
                 + (e.higher_levels ? `<p><b>À plus haut niveau.</b> ${esc(e.higher_levels)}</p>` : '');
        }
        if (cat === 'monsters') {
            const ab = e.abilities || {};
            const m = (v) => { const x = Math.floor((v - 10) / 2); return `${v} (${x >= 0 ? '+' : ''}${x})`; };
            const stats = ['str', 'dex', 'con', 'int', 'wis', 'cha'].map((k, i) =>
                `<span class="rw-ab"><b>${['FOR','DEX','CON','INT','SAG','CHA'][i]}</b>${m(ab[k] || 10)}</span>`).join('');
            return KV('Classe d’armure', e.ac + (e.ac_desc ? ` (${e.ac_desc})` : ''))
                 + KV('Points de vie', `${e.hp} (${e.hp_roll})`) + KV('Vitesse', e.speed)
                 + `<div class="rw-abs">${stats}</div>`
                 + KV('Jets de sauvegarde', e.saves) + KV('Compétences', e.skills)
                 + KV('Vulnérabilités', e.vulnerabilities) + KV('Résistances', e.resistances)
                 + KV('Immunités', e.immunities) + KV('Immunités (états)', e.condition_immunities)
                 + KV('Sens', e.senses) + KV('Langues', e.languages)
                 + KV('Facteur de puissance', `${e.cr_display} (${e.xp} PX)`)
                 + NAMED(e.traits, '') + NAMED(e.actions, 'Actions')
                 + NAMED(e.reactions, 'Réactions')
                 + (e.legendary_intro ? `<h4 class="rw-h">Actions légendaires</h4><p>${esc(e.legendary_intro)}</p>` : '')
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
                 + NAMED(e.traits, (e.traits || []).length ? 'Traits' : '')
                 + NAMED(e.features, (e.features || []).length ? 'Aptitudes' : '')
                 + (subs.length ? `<h4 class="rw-h">${cat === 'races' ? 'Sous-races' : 'Sous-classes'}</h4>`
                     + subs.map(s => `<p><a href="#" class="rw-link" data-cat="${cat}" data-id="${esc(s.id)}">${esc(s.name)}</a></p>`).join('') : '');
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
        return P(e.desc || e.content);
    }
    window.SRD = {
        CATEGORIES,
        search, index, category, entry, preload, fold, renderEntry, esc,
        setEdition: (e) => { edition = e; memory.clear(); },
        setLang: (l) => { lang = l; memory.clear(); },
        getEdition: () => edition,
        getLang: () => lang,
        attribution: 'SRD 5.1 (Wizards of the Coast) — CC-BY-4.0'
    };
})();
