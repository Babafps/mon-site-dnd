// =====================================================
// Page Règles — consultation de tout le SRD, dans l'esprit d'AideDD.
//
// Écran à part entière (#rules-screen), affiché par window.navTo comme
// l'accueil et la fiche : on reste en page unique. Le rendu des fiches est
// celui de SRD.renderEntry, partagé avec la loupe de la fiche de personnage.
//
// Parcours : accueil → « Règles » (1 clic) → catégorie → entrée (2 clics).
// Sur les grosses catégories, des filtres combinables et une vue tableau
// triable évitent de faire défiler trois cents entrées.
// =====================================================
(function () {
    'use strict';

    let built = false;
    let currentCat = null;
    let currentList = [];       // entrées de l'index pour la catégorie courante
    let rulesTrail = [];        // fil d'Ariane dans l'arbre des règles
    let lastScreen = 'home-screen';
    let meta = {};              // id -> champs filtrables de la catégorie courante
    let metaCat = null;
    const filters = {};         // catégorie -> {clé: valeur}
    let viewMode = 'list';      // 'list' | 'table'
    let sortBy = { key: 'name', dir: 1 };

    const $ = (id) => document.getElementById(id);
    const esc = (s) => window.SRD.esc(s);

    // ---------- Libellés ----------
    // Les données gardent les identifiants anglais (communs à toutes les
    // langues) ; l'affichage, lui, doit être français.
    const SCHOOL_FR = {
        abjuration: 'Abjuration', conjuration: 'Invocation', divination: 'Divination',
        enchantment: 'Enchantement', evocation: 'Évocation', illusion: 'Illusion',
        necromancy: 'Nécromancie', transmutation: 'Transmutation'
    };
    const CLASS_FR = {
        barbarian: 'Barbare', bard: 'Barde', cleric: 'Clerc', druid: 'Druide',
        fighter: 'Guerrier', monk: 'Moine', paladin: 'Paladin', ranger: 'Rôdeur',
        rogue: 'Roublard', sorcerer: 'Ensorceleur', warlock: 'Occultiste', wizard: 'Magicien'
    };
    const SIZE_FR = { TP: 'Très petite', P: 'Petite', M: 'Moyenne', G: 'Grande',
                      TG: 'Très grande', Gig: 'Gigantesque' };
    const EQUIP_FR = {
        'adventuring-gear': 'Matériel d’aventurier', tools: 'Outils', weapon: 'Armes',
        armor: 'Armures', 'mounts-and-vehicles': 'Montures et véhicules'
    };

    // ---------- Filtres proposés, par catégorie ----------
    // `get` extrait la valeur d'une entrée complète ; `label` l'habille.
    // Le SRD garde les identifiants anglais (`evocation`) ; une entrée perso est
    // saisie en français (`Évocation`). Sans cette remise au même dénominateur,
    // le filtre proposerait deux fois « Évocation ».
    const SCHOOL_KEY = Object.fromEntries(
        Object.entries(SCHOOL_FR).map(([id, fr]) => [window.SRD.fold(fr), id]));
    const schoolOf = (e) => SCHOOL_KEY[window.SRD.fold(e.school)] || e.school;

    const FILTERS = {
        spells: [
            { k: 'level', label: 'Niveau', get: e => e.level,
              label_of: v => Number(v) === 0 ? 'Sort mineur' : 'Niveau ' + v,
              sort: (a, b) => a - b },
            { k: 'school', label: 'École', get: schoolOf, label_of: v => SCHOOL_FR[v] || v },
            { k: 'class', label: 'Classe', multi: true, get: e => e.classes || [],
              label_of: v => CLASS_FR[v] || v }
        ],
        monsters: [
            { k: 'cr', label: 'Facteur de puissance', get: e => e.cr,
              label_of: (v, e) => 'FP ' + ((e && e.cr_display) || crLabel(v)), sort: (a, b) => a - b },
            { k: 'type', label: 'Type', get: e => capital(e.type) },
            { k: 'size', label: 'Taille', get: e => e.size, label_of: v => SIZE_FR[v] || v }
        ],
        'magic-items': [
            { k: 'kind', label: 'Type', get: e => String(e.type || '').split(' (')[0] },
            { k: 'rarity', label: 'Rareté', get: e => e.rarity }
        ],
        equipment: [
            { k: 'category', label: 'Catégorie', get: e => e.category || e.type,
              label_of: v => EQUIP_FR[v] || v }
        ]
    };

    // ---------- Colonnes de la vue tableau ----------
    const TABLES = {
        spells: [
            { k: 'name', label: 'Nom', main: true },
            { k: 'level', label: 'Niveau', val: e => e.level,
              show: e => Number(e.level) === 0 ? '—' : e.level, num: true },
            { k: 'school', label: 'École', val: e => SCHOOL_FR[schoolOf(e)] || e.school || '' },
            { k: 'casting_time', label: 'Incantation', val: e => e.casting_time || '' },
            { k: 'range', label: 'Portée', val: e => e.range || '' },
            { k: 'conc', label: 'C/R', val: e => (e.concentration ? 'C' : '') + (e.ritual ? 'R' : ''),
              title: 'C = concentration · R = rituel' }
        ],
        monsters: [
            { k: 'name', label: 'Nom', main: true },
            { k: 'cr', label: 'FP', val: e => e.cr, show: e => e.cr_display || crLabel(e.cr), num: true },
            { k: 'type', label: 'Type', val: e => capital(e.type) || '' },
            { k: 'size', label: 'Taille', val: e => SIZE_FR[e.size] || e.size || '' },
            { k: 'ac', label: 'CA', val: e => parseInt(e.ac, 10) || 0, show: e => e.ac, num: true },
            { k: 'hp', label: 'PV', val: e => parseInt(e.hp, 10) || 0, show: e => e.hp, num: true }
        ]
    };

    const capital = (s) => s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '';
    function crLabel(cr) {
        if (cr === 0.125) return '1/8';
        if (cr === 0.25) return '1/4';
        if (cr === 0.5) return '1/2';
        return String(cr == null ? '' : cr);
    }

    // ---------- Construction de l'écran (une seule fois) ----------
    function build() {
        if (built) return;
        built = true;
        const scr = document.createElement('div');
        scr.id = 'rules-screen';
        scr.className = 'screen-view hidden';
        scr.innerHTML = `
            <div class="rules-wrap">
                <header class="rules-top">
                    <button id="rules-back" class="rules-back" type="button">← Retour</button>
                    <h1>Règles du jeu</h1>
                    <select id="rules-edition" class="rules-edition" title="Édition des règles"></select>
                    <button id="rules-homebrew" class="rules-back" type="button"
                            title="Créer tes classes, sorts, monstres…">✍️ Mon contenu</button>
                    <input type="search" id="rules-search" placeholder="🔍 Rechercher dans toutes les règles…" autocomplete="off">
                </header>
                <nav id="rules-cats" class="rules-cats"></nav>
                <div id="rules-filters" class="rules-filters hidden"></div>
                <div class="rules-body" id="rules-body">
                    <div id="rules-list" class="rules-list"></div>
                    <article id="rules-detail" class="rules-detail">
                        <div class="rules-empty">Choisis une catégorie, puis une entrée.</div>
                    </article>
                </div>
                <footer class="rules-foot" id="rules-foot"></footer>
            </div>`;
        document.body.appendChild(scr);

        // Catégories
        $('rules-cats').innerHTML = window.SRD.CATEGORIES.map(c =>
            `<button type="button" class="rules-cat" data-cat="${c.id}">${c.icon} ${esc(c.label)}</button>`).join('');
        $('rules-cats').addEventListener('click', (e) => {
            const b = e.target.closest('.rules-cat'); if (!b) return;
            $('rules-search').value = '';
            openCategory(b.dataset.cat);
        });

        $('rules-back').addEventListener('click', () => window.navTo(lastScreen));
        $('rules-homebrew').addEventListener('click', () => {
            if (window.Homebrew) window.Homebrew.open('rules-screen');
        });
        initEditionPicker();

        // Recherche transversale
        let token = 0;
        $('rules-search').addEventListener('input', async (e) => {
            const q = e.target.value.trim();
            const mine = ++token;
            if (q.length < 2) { if (currentCat) openCategory(currentCat); else showListMessage('Tape au moins deux lettres.'); return; }
            const res = await window.SRD.search(q, { limit: 120 });
            if (mine !== token) return;
            currentCat = null;
            setFilterBar(null);
            document.querySelectorAll('.rules-cat.is-on').forEach(b => b.classList.remove('is-on'));
            renderList(res, `${res.length} résultat${res.length > 1 ? 's' : ''} pour « ${esc(q)} »`);
        });

        // Clic sur une entrée de la liste ou d'une ligne de tableau
        $('rules-list').addEventListener('click', (e) => {
            const row = e.target.closest('.rules-item, .rules-trow');
            if (row) { openEntry(row.dataset.cat, row.dataset.id, row.dataset.name, row.dataset.sub); return; }
            const th = e.target.closest('.rules-th[data-sort]');
            if (th) { toggleSort(th.dataset.sort); }
        });

        // Liens internes rendus par SRD.renderEntry (sous-classes, sections filles,
        // et les noms reconnus dans les textes)
        $('rules-detail').addEventListener('click', (e) => {
            const a = e.target.closest('.rw-link'); if (!a) return;
            e.preventDefault();
            openEntry(a.dataset.cat, a.dataset.id, a.textContent, '');
        });

        // Le contenu personnel a changé : la liste courante peut être périmée.
        document.addEventListener('srd-homebrew-change', () => {
            if (!$('rules-screen') || $('rules-screen').classList.contains('hidden')) return;
            if (currentCat) openCategory(currentCat);
        });

        $('rules-foot').innerHTML =
            `Contenu du <b>System Reference Document 5.1</b> (version française officielle) — `
            + `Wizards of the Coast, sous licence <a href="https://creativecommons.org/licenses/by/4.0/deed.fr" target="_blank" rel="noopener">CC-BY-4.0</a>. `
            + `Compatible avec la 5<sup>e</sup> édition ; ce site n'est pas un produit officiel D&amp;D.`;
    }

    function showListMessage(msg) {
        // Les diagnostics tiennent sur plusieurs lignes : on respecte les retours.
        $('rules-list').innerHTML =
            `<div class="rules-empty" style="white-space:pre-line;">${esc(msg)}</div>`;
    }

    // ---------- Choix de l'édition ----------
    // Le SRD 5.2 (règles 2024) n'existe officiellement qu'en anglais : tant qu'il
    // n'est pas traduit, on ne prétend pas l'avoir. Le sélecteur teste la présence
    // réelle des données et le dit franchement plutôt que d'ouvrir une page vide.
    // Éditions déclarées, pas sondées : une requête vers un fichier absent
    // remplirait la console de 404 à chaque ouverture. Passer `available` à true
    // le jour où data/srd/2024/fr/ existe.
    const EDITIONS = [
        { id: '2014', label: '5e (2014)', available: true },
        { id: '2024', label: '5.5e (2024)', available: false }
    ];
    const EDITION_KEY = 'dnd-srd-edition';
    const editionAvailable = (ed) => !!(EDITIONS.find(e => e.id === ed) || {}).available;

    function initEditionPicker() {
        const sel = $('rules-edition');
        if (!sel) return;
        sel.innerHTML = EDITIONS.map(e =>
            `<option value="${e.id}">${e.label}</option>`).join('');
        const saved = localStorage.getItem(EDITION_KEY) || '2014';
        sel.value = saved;
        window.SRD.setEdition(saved);

        EDITIONS.filter(e => !e.available).forEach(e => {
            const opt = sel.querySelector(`option[value="${e.id}"]`);
            if (opt) { opt.disabled = true; opt.textContent = e.label + ' — à traduire'; }
        });

        sel.addEventListener('change', () => {
            const ed = sel.value;
            if (!editionAvailable(ed)) {
                sel.value = window.SRD.getEdition();
                $('rules-detail').innerHTML =
                    `<div class="rules-empty">Les règles ${EDITIONS.find(x => x.id === ed).label} ne sont pas encore disponibles en français.<br>`
                    + `Le SRD officiel de cette édition n'est publié qu'en anglais : il doit être traduit avant d'être intégré.</div>`;
                return;
            }
            localStorage.setItem(EDITION_KEY, ed);
            window.SRD.setEdition(ed);
            currentCat = null; metaCat = null; meta = {};
            $('rules-search').value = '';
            $('rules-detail').innerHTML = '<div class="rules-empty">Choisis une catégorie, puis une entrée.</div>';
            openCategory('spells');
        });
    }

    // ---------- Filtres ----------
    // Les valeurs proposées sont celles réellement présentes dans les données :
    // pas de liste figée qui se désynchroniserait, et le contenu personnel y
    // apparaît naturellement.
    async function loadMeta(cat) {
        if (metaCat === cat) return true;
        if (!FILTERS[cat] && !TABLES[cat]) { metaCat = cat; meta = {}; return true; }
        const list = await window.SRD.category(cat);
        meta = {};
        list.forEach(e => { meta[e.id] = e; });
        metaCat = cat;
        return true;
    }

    function setFilterBar(cat) {
        const bar = $('rules-filters');
        const defs = cat && FILTERS[cat];
        const hasTable = cat && TABLES[cat];
        if (!defs && !hasTable) { bar.classList.add('hidden'); bar.innerHTML = ''; return; }
        const cur = filters[cat] || (filters[cat] = {});
        const parts = (defs || []).map(d => {
            const values = new Map();
            Object.values(meta).forEach(e => {
                const v = d.get(e);
                (Array.isArray(v) ? v : [v]).forEach(x => {
                    if (x == null || x === '') return;
                    if (!values.has(x)) values.set(x, d.label_of ? d.label_of(x, e) : String(x));
                });
            });
            const sorted = [...values.entries()].sort((a, b) =>
                d.sort ? d.sort(a[0], b[0]) : String(a[1]).localeCompare(String(b[1]), 'fr'));
            return `<label class="rules-filter"><span>${esc(d.label)}</span>
                <select data-filter="${d.k}">
                    <option value="">Tout</option>
                    ${sorted.map(([v, l]) => `<option value="${esc(v)}"${String(cur[d.k]) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}
                </select></label>`;
        });
        if (hasTable) {
            parts.push(`<div class="rules-viewtoggle" role="group" aria-label="Affichage">
                <button type="button" data-view="list" class="${viewMode === 'list' ? 'is-on' : ''}" title="Liste">☰</button>
                <button type="button" data-view="table" class="${viewMode === 'table' ? 'is-on' : ''}" title="Tableau">▦</button>
            </div>`);
        }
        parts.push(`<button type="button" class="rules-filter-reset" data-filter-reset="1">Réinitialiser</button>`);
        bar.innerHTML = parts.join('');
        bar.classList.remove('hidden');
        bar.querySelectorAll('[data-filter]').forEach(sel => sel.addEventListener('change', () => {
            cur[sel.dataset.filter] = sel.value;
            applyList();
        }));
        bar.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
            viewMode = b.dataset.view;
            localStorage.setItem('dnd-rules-view', viewMode);
            setFilterBar(currentCat);
            applyList();
        }));
        bar.querySelector('[data-filter-reset]').addEventListener('click', () => {
            filters[cat] = {};
            setFilterBar(cat);
            applyList();
        });
    }

    function passesFilters(cat, id) {
        const defs = FILTERS[cat]; if (!defs) return true;
        const cur = filters[cat] || {};
        const e = meta[id];
        return defs.every(d => {
            const want = cur[d.k];
            if (!want) return true;
            if (!e) return false;
            const v = d.get(e);
            return Array.isArray(v) ? v.some(x => String(x) === want) : String(v) === want;
        });
    }

    function toggleSort(key) {
        if (sortBy.key === key) sortBy.dir = -sortBy.dir;
        else sortBy = { key, dir: 1 };
        applyList();
    }

    // ---------- Liste ----------
    function renderList(items, heading) {
        const list = $('rules-list');
        if (!items.length) { showListMessage('Aucun résultat.'); return; }
        list.innerHTML = `<div class="rules-list-head">${heading}</div>`
            + items.map(it => `<button type="button" class="rules-item" data-cat="${it.category}" data-id="${esc(it.id)}" data-name="${esc(it.name)}" data-sub="${esc(it.subtitle || '')}">
                    <span class="rules-item-name">${it.icon || ''} ${esc(it.name)}${it.perso ? ' <span class="rw-perso">perso</span>' : ''}</span>
                    ${it.subtitle ? `<span class="rules-item-sub">${esc(it.subtitle)}</span>` : ''}
                </button>`).join('');
        list.scrollTop = 0;
    }

    function renderTable(cat, items, heading) {
        const cols = TABLES[cat];
        const list = $('rules-list');
        if (!items.length) { showListMessage('Aucun résultat.'); return; }
        const rows = items.map(it => {
            const e = meta[it.id] || {};
            return `<tr class="rules-trow" data-cat="${cat}" data-id="${esc(it.id)}" data-name="${esc(it.name)}" data-sub="${esc(it.subtitle || '')}">`
                + cols.map(c => c.main
                    ? `<td class="rules-tname">${esc(it.name)}${it.perso ? ' <span class="rw-perso">perso</span>' : ''}</td>`
                    : `<td>${esc(c.show ? c.show(e) : c.val(e))}</td>`).join('')
                + '</tr>';
        }).join('');
        list.innerHTML = `<div class="rules-list-head">${heading}</div>`
            + `<div class="rules-tscroll"><table class="rules-table">
                <thead><tr>${cols.map(c =>
                    `<th class="rules-th" data-sort="${c.k}"${c.title ? ` title="${esc(c.title)}"` : ''}>`
                    + `${esc(c.label)}${sortBy.key === c.k ? (sortBy.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
                <tbody>${rows}</tbody></table></div>`;
        list.scrollTop = 0;
    }

    /** Applique filtres, tri et mode d'affichage à la liste de la catégorie. */
    function applyList() {
        const cat = currentCat; if (!cat) return;
        const items = currentList.filter(it => passesFilters(cat, it.id));
        const cols = TABLES[cat] || [];
        const col = cols.find(c => c.k === sortBy.key);
        items.sort((a, b) => {
            if (col && !col.main) {
                const ea = meta[a.id] || {}, eb = meta[b.id] || {};
                const va = col.val(ea), vb = col.val(eb);
                const cmp = col.num ? (Number(va) || 0) - (Number(vb) || 0)
                                    : String(va).localeCompare(String(vb), 'fr');
                if (cmp) return cmp * sortBy.dir;
                return a.name.localeCompare(b.name, 'fr');
            }
            return a.name.localeCompare(b.name, 'fr') * (col ? sortBy.dir : 1);
        });
        const label = (window.SRD.CATEGORIES.find(c => c.id === cat) || {}).label || '';
        const total = currentList.length;
        const heading = items.length === total
            ? `${label} — ${total} entrées`
            : `${label} — ${items.length} sur ${total}`;
        const narrow = window.matchMedia('(max-width: 859px)').matches;
        const table = viewMode === 'table' && TABLES[cat] && !narrow;
        $('rules-body').classList.toggle('is-table', !!table);
        if (table) renderTable(cat, items, heading);
        else renderList(items, heading);
    }

    async function openCategory(cat) {
        currentCat = cat;
        rulesTrail = [];
        document.querySelectorAll('.rules-cat').forEach(b => b.classList.toggle('is-on', b.dataset.cat === cat));
        showListMessage('Chargement…');
        try {
            const idx = await window.SRD.index();
            const c = window.SRD.CATEGORIES.find(x => x.id === cat) || {};
            currentList = idx.filter(e => e.c === cat)
                .map(e => ({ id: e.i, name: e.n, subtitle: e.s || '', category: cat,
                             icon: c.icon, perso: !!e.p }))
                .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
            await loadMeta(cat);
            if (!TABLES[cat] || !meta[(currentList[0] || {}).id]) sortBy = { key: 'name', dir: 1 };
            setFilterBar(cat);
            applyList();
        } catch (err) {
            setFilterBar(null);
            showListMessage(err.diagnostic || err.message);
        }
    }

    // ---------- Fiche détaillée ----------
    async function openEntry(cat, id, name, sub) {
        const box = $('rules-detail');
        box.innerHTML = `<h2>${esc(name)}</h2><p class="rules-detail-sub">${esc(sub || '')}</p><p><i>Chargement…</i></p>`;
        box.scrollTop = 0;
        try {
            const e = await window.SRD.entry(cat, id);
            if (!e) throw new Error('entrée introuvable');
            // Fil d'Ariane dans l'arbre des règles
            if (cat === 'rules') {
                const i = rulesTrail.findIndex(t => t.id === id);
                if (i >= 0) rulesTrail = rulesTrail.slice(0, i + 1);
                else rulesTrail.push({ id, name: e.name || name });
            } else {
                rulesTrail = [];
            }
            const trail = rulesTrail.length > 1
                ? `<nav class="rules-trail">` + rulesTrail.map((t, i) =>
                    i === rulesTrail.length - 1
                        ? `<span>${esc(t.name)}</span>`
                        : `<a href="#" class="rw-link" data-cat="rules" data-id="${esc(t.id)}">${esc(t.name)}</a>`).join(' › ')
                  + `</nav>` : '';
            const parent = e.parent_name && e.parent
                ? `<p class="rules-detail-sub"><a href="#" class="rw-link" data-cat="${cat}" data-id="${esc(e.parent)}">↑ ${esc(e.parent_name)}</a></p>`
                : '';
            box.innerHTML = trail
                + `<h2>${esc(e.name || name)}</h2>`
                + (sub ? `<p class="rules-detail-sub">${esc(sub)}</p>` : '')
                + parent
                + window.SRD.renderEntry(cat, e);
            if (window.matchMedia('(max-width: 859px)').matches) {
                box.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } catch (err) {
            box.innerHTML = `<h2>${esc(name)}</h2><p style="color:#c0392b;">Impossible de charger cette fiche.<br><small>${esc(err.message)}</small></p>`;
        }
    }

    // ---------- Ouverture ----------
    function open(fromScreen, cat, id) {
        build();
        lastScreen = fromScreen || (document.getElementById('app-screen') &&
            !document.getElementById('app-screen').classList.contains('hidden') ? 'app-screen' : 'home-screen');
        viewMode = localStorage.getItem('dnd-rules-view') || 'list';
        window.navTo('rules-screen');
        if (cat) { openCategory(cat).then(() => { if (id) openEntry(cat, id, '', ''); }); }
        else if (!currentCat) openCategory('spells');
        setTimeout(() => $('rules-search')?.focus(), 60);
    }

    window.RulesPage = { open };

    // Bouton d'accueil (l'écran existe déjà dans index.html)
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('btn-open-rules')?.addEventListener('click', () => open('home-screen'));
    });
})();
