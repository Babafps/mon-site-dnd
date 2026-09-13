// =====================================================
// menu.js — le menu ☰ : tiroir latéral, une rubrique ouverte à la fois
//
// Le contenu vit dans index.html, et des modules y ajoutent leurs entrées
// (cosmetics.js, pricing.js, legal.js) : ce fichier ne gère que le
// comportement. L'ouverture elle-même reste dans script.js (classe `hidden`,
// que plusieurs modules posent aussi) : on l'observe plutôt que la dupliquer.
// =====================================================
(function () {
    'use strict';

    const KEY = 'dnd-menu-last-cat';

    document.addEventListener('DOMContentLoaded', () => {
        const menu = document.getElementById('settings-dropdown');
        const btn = document.getElementById('btn-settings-toggle');
        const scrim = document.querySelector('.settings-container .menu-scrim');
        if (!menu || !btn) return;

        const close = () => menu.classList.add('hidden');
        let wasOpen = false;

        function sync() {
            const open = !menu.classList.contains('hidden');
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (scrim) scrim.classList.toggle('hidden', !open);
            document.body.classList.toggle('menu-open', open);
            if (open && !wasOpen) {
                // On retrouve la rubrique consultée en dernier.
                let last = null;
                try { last = sessionStorage.getItem(KEY); } catch (e) {}
                if (last && !menu.querySelector('.menu-cat[open]')) {
                    const d = menu.querySelector(`.menu-cat[data-cat="${last}"]`);
                    if (d) d.open = true;
                }
                menu.scrollTop = 0;
                // Mode nuit et confort de lecture : leurs commandes se chargent à la demande.
                if (window.charger) window.charger('confort').catch(() => {});
                // L'outil d'administration : chargé pour un joueur connecté, montré aux seuls administrateurs.
                if (window.charger && window.SupaAuth && window.SupaAuth.currentUser) {
                    window.charger('admin').then(() => window.Admin && window.Admin.verifier()).catch(() => {});
                }
                setTimeout(() => menu.querySelector('.menu-close')?.focus({ preventScroll: true }), 40);
            }
            wasOpen = open;
        }
        new MutationObserver(sync).observe(menu, { attributes: true, attributeFilter: ['class'] });
        sync();

        // Une seule rubrique ouverte : le tiroir reste court et lisible.
        // `toggle` ne remonte pas : on l'écoute en phase de capture.
        menu.addEventListener('toggle', (e) => {
            const d = e.target;
            if (!(d instanceof HTMLDetailsElement) || !d.open) return;
            menu.querySelectorAll('.menu-cat[open]').forEach(x => { if (x !== d) x.open = false; });
            try { if (d.dataset.cat) sessionStorage.setItem(KEY, d.dataset.cat); } catch (err) {}
        }, true);

        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-menu-close]')) close();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape' || menu.classList.contains('hidden')) return;
            close();
            btn.focus({ preventScroll: true });
        });
    });

    // ---------- Trophées et communauté (LOT 8) ----------
    // La salle des trophées, le parrainage et le cimetière naissent chargés à la
    // demande (charger.js leur pose une façade) : un bouton `data-communaute`
    // les ouvre, du menu comme de l'accueil.
    const COMMUNAUTE = {
        trophees: () => window.Trophees.ouvrir(),
        parrainage: () => window.Parrainage.ouvrir(),
        cimetiere: () => window.Cimetiere.ouvrir()
    };
    document.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('[data-communaute]');
        if (!b || !COMMUNAUTE[b.dataset.communaute]) return;
        const menu = document.getElementById('settings-dropdown');
        if (menu) menu.classList.add('hidden');
        Promise.resolve().then(COMMUNAUTE[b.dataset.communaute]).catch(() => {
            if (window.showAppToast) window.showAppToast('Ce module n’a pas pu se charger. Vérifie ta connexion, puis réessaie.', 'erreur');
        });
    });
    // L'accueil montre la carte du défi du mois : son module arrive après l'affichage.
    document.addEventListener('screen:change', (e) => {
        if (!e.detail || e.detail.id !== 'home-screen' || !window.charger) return;
        setTimeout(() => window.charger('trophees').then(() => window.Trophees.accueil()).catch(() => {}), 300);
    });
})();
