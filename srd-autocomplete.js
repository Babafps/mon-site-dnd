// =====================================================
// Autocomplétion SRD — un seul composant pour tous les formulaires.
//
// S'attache à un champ texte : propose les entrées du SRD pendant la frappe,
// et remplit le formulaire quand on en choisit une. La saisie libre reste
// toujours possible — la liste est une suggestion, jamais une contrainte.
//
//   SRDAuto.attach(input, {
//       categories: ['spells'],          // catégories interrogées
//       onPick: (full, meta) => { … }    // entrée complète + métadonnées d'index
//   });
// =====================================================
(function () {
    'use strict';

    const MIN_CHARS = 2;
    const MAX_RESULTS = 8;
    const DEBOUNCE = 160;

    function attach(input, opts) {
        if (!input || input.dataset.srdAuto) return;
        input.dataset.srdAuto = '1';
        input.setAttribute('autocomplete', 'off');

        const cats = opts.categories || [];
        let box = null, items = [], active = -1, timer = null, token = 0;

        const close = () => { if (box) { box.remove(); box = null; } items = []; active = -1; };

        function ensureBox() {
            // Si la boîte a été retirée du DOM par ailleurs, la référence en
            // mémoire pointe vers un élément détaché : on la ré-attache.
            if (box && !box.isConnected) document.body.appendChild(box);
            if (box) return box;
            box = document.createElement('div');
            box.className = 'srd-auto no-print';
            box.setAttribute('role', 'listbox');
            document.body.appendChild(box);
            position();
            return box;
        }

        // Positionné en `fixed` sur le body : les formulaires vivent dans des
        // modales qui rognent leur contenu, une liste en absolute serait coupée.
        function position() {
            if (!box) return;
            const r = input.getBoundingClientRect();
            box.style.left = r.left + 'px';
            box.style.width = r.width + 'px';
            const below = window.innerHeight - r.bottom;
            if (below < 200 && r.top > below) {
                box.style.top = 'auto';
                box.style.bottom = (window.innerHeight - r.top + 4) + 'px';
            } else {
                box.style.bottom = 'auto';
                box.style.top = (r.bottom + 4) + 'px';
            }
        }

        function render() {
            const b = ensureBox();
            if (!items.length) { close(); return; }
            b.innerHTML = items.map((it, i) =>
                `<button type="button" class="srd-auto-item${i === active ? ' is-active' : ''}" data-i="${i}" role="option">
                    <span class="srd-auto-name">${it.icon || ''} ${window.SRD.esc(it.name)}</span>
                    ${it.subtitle ? `<span class="srd-auto-sub">${window.SRD.esc(it.subtitle)}</span>` : ''}
                </button>`).join('');
            position();
        }

        async function pick(i) {
            const meta = items[i];
            if (!meta) return;
            close();
            input.value = meta.name;
            try {
                const full = await window.SRD.entry(meta.category, meta.id);
                if (full) opts.onPick(full, meta);
            } catch (e) {
                if (window.showAppToast) window.showAppToast('Fiche indisponible : ' + e.message, '#c0392b');
            }
        }

        async function query() {
            const q = input.value.trim();
            if (q.length < MIN_CHARS || !window.SRD) { close(); return; }
            const mine = ++token;
            try {
                const res = await window.SRD.search(q, { limit: 60 });
                if (mine !== token) return;   // la fermeture au blur suffit à masquer la liste
                items = res.filter(r => cats.includes(r.category)).slice(0, MAX_RESULTS);
                active = -1;
                render();
            } catch (e) { close(); }
        }

        input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(query, DEBOUNCE); });
        input.addEventListener('focus', () => { if (input.value.trim().length >= MIN_CHARS) query(); });
        input.addEventListener('blur', () => setTimeout(close, 150));   // laisse le clic aboutir

        input.addEventListener('keydown', (e) => {
            if (!items.length) return;
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
                render();
            } else if (e.key === 'Enter' && active >= 0) {
                e.preventDefault(); pick(active);
            } else if (e.key === 'Escape') {
                close();
            }
        });

        document.addEventListener('click', (e) => {
            if (!box) return;
            const b = e.target.closest('.srd-auto-item');
            if (b && box.contains(b)) { e.preventDefault(); pick(parseInt(b.dataset.i, 10)); }
            else if (e.target !== input) close();
        });

        window.addEventListener('resize', position);
        window.addEventListener('scroll', position, true);
    }

    // Traductions ponctuelles : les données mécaniques gardent les identifiants
    // anglais (communs à toutes les langues), mais l'affichage doit être français.
    const DMG_FR = {
        acid: 'acide', bludgeoning: 'contondants', cold: 'de froid', fire: 'de feu',
        force: 'de force', lightning: 'de foudre', necrotic: 'nécrotiques',
        piercing: 'perforants', poison: 'de poison', psychic: 'psychiques',
        radiant: 'radiants', slashing: 'tranchants', thunder: 'de tonnerre'
    };
    const PROP_FR = {
        ammunition: 'munitions', finesse: 'finesse', heavy: 'lourde', light: 'légère',
        loading: 'rechargement', range: 'à distance', reach: 'allonge', special: 'spéciale',
        'thrown': 'lancer', 'two-handed': 'à deux mains', versatile: 'polyvalente',
        monk: 'moine'
    };

    window.SRDAuto = { attach, DMG_FR, PROP_FR };
})();
