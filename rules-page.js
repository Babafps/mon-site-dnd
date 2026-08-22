// =====================================================
// Page Règles — consultation de tout le SRD, dans l'esprit d'AideDD.
//
// Écran à part entière (#rules-screen), affiché par window.navTo comme
// l'accueil et la fiche : on reste en page unique. Le rendu des fiches est
// celui de SRD.renderEntry, partagé avec la loupe de la fiche de personnage.
//
// Parcours : accueil → « Règles » (1 clic) → catégorie → entrée (2 clics).
// =====================================================
(function () {
    'use strict';

    let built = false;
    let currentCat = null;
    let currentList = [];       // entrées de l'index pour la catégorie courante
    let rulesTrail = [];        // fil d'Ariane dans l'arbre des règles
    let lastScreen = 'home-screen';

    const $ = (id) => document.getElementById(id);
    const esc = (s) => window.SRD.esc(s);

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
                    <input type="search" id="rules-search" placeholder="🔍 Rechercher dans toutes les règles…" autocomplete="off">
                </header>
                <nav id="rules-cats" class="rules-cats"></nav>
                <div class="rules-body">
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
            document.querySelectorAll('.rules-cat.is-on').forEach(b => b.classList.remove('is-on'));
            renderList(res, `${res.length} résultat${res.length > 1 ? 's' : ''} pour « ${esc(q)} »`);
        });

        // Clic sur une entrée de la liste
        $('rules-list').addEventListener('click', (e) => {
            const row = e.target.closest('.rules-item'); if (!row) return;
            openEntry(row.dataset.cat, row.dataset.id, row.dataset.name, row.dataset.sub);
        });

        // Liens internes rendus par SRD.renderEntry (sous-classes, sections filles)
        $('rules-detail').addEventListener('click', (e) => {
            const a = e.target.closest('.rw-link'); if (!a) return;
            e.preventDefault();
            openEntry(a.dataset.cat, a.dataset.id, a.textContent, '');
        });

        $('rules-foot').innerHTML =
            `Contenu du <b>System Reference Document 5.1</b> (version française officielle) — `
            + `Wizards of the Coast, sous licence <a href="https://creativecommons.org/licenses/by/4.0/deed.fr" target="_blank" rel="noopener">CC-BY-4.0</a>. `
            + `Compatible avec la 5<sup>e</sup> édition ; ce site n'est pas un produit officiel D&amp;D.`;
    }

    function showListMessage(msg) {
        $('rules-list').innerHTML = `<div class="rules-empty">${esc(msg)}</div>`;
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
            currentCat = null;
            $('rules-search').value = '';
            $('rules-detail').innerHTML = '<div class="rules-empty">Choisis une catégorie, puis une entrée.</div>';
            openCategory('spells');
        });
    }
    // ---------- Liste ----------
    function renderList(items, heading) {
        const list = $('rules-list');
        if (!items.length) { showListMessage('Aucun résultat.'); return; }
        list.innerHTML = `<div class="rules-list-head">${heading}</div>`
            + items.map(it => `<button type="button" class="rules-item" data-cat="${it.category}" data-id="${esc(it.id)}" data-name="${esc(it.name)}" data-sub="${esc(it.subtitle || '')}">
                    <span class="rules-item-name">${it.icon || ''} ${esc(it.name)}</span>
                    ${it.subtitle ? `<span class="rules-item-sub">${esc(it.subtitle)}</span>` : ''}
                </button>`).join('');
        list.scrollTop = 0;
    }

    async function openCategory(cat) {
        currentCat = cat;
        rulesTrail = [];
        document.querySelectorAll('.rules-cat').forEach(b => b.classList.toggle('is-on', b.dataset.cat === cat));
        showListMessage('Chargement…');
        try {
            const idx = await window.SRD.index();
            const meta = window.SRD.CATEGORIES.find(c => c.id === cat) || {};
            currentList = idx.filter(e => e.c === cat)
                .map(e => ({ id: e.i, name: e.n, subtitle: e.s || '', category: cat, icon: meta.icon }))
                .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
            renderList(currentList, `${meta.label} — ${currentList.length} entrées`);
        } catch (err) {
            showListMessage('Règles indisponibles : ' + err.message);
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
            box.innerHTML = trail
                + `<h2>${esc(e.name || name)}</h2>`
                + (sub ? `<p class="rules-detail-sub">${esc(sub)}</p>` : '')
                + window.SRD.renderEntry(cat, e);
        } catch (err) {
            box.innerHTML = `<h2>${esc(name)}</h2><p style="color:#c0392b;">Impossible de charger cette fiche.<br><small>${esc(err.message)}</small></p>`;
        }
    }

    // ---------- Ouverture ----------
    function open(fromScreen) {
        build();
        lastScreen = fromScreen || (document.getElementById('app-screen') &&
            !document.getElementById('app-screen').classList.contains('hidden') ? 'app-screen' : 'home-screen');
        window.navTo('rules-screen');
        if (!currentCat) openCategory('spells');
        setTimeout(() => $('rules-search')?.focus(), 60);
    }

    window.RulesPage = { open };

    // Bouton d'accueil (l'écran existe déjà dans index.html)
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('btn-open-rules')?.addEventListener('click', () => open('home-screen'));
    });
})();
