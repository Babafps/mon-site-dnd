// =====================================================
// confort.js — le mode nuit et le confort de lecture, côté menu ☰
//
// Les réglages eux-mêmes sont appliqués avant le premier affichage par le
// script de démarrage d'index.html (window.Demarrage) : ce module ne fait que
// câbler les commandes du menu. Il est chargé à la demande, à l'ouverture du
// menu (menu.js).
//
//   · Mode nuit : Clair, Sombre ou Auto (suit l'appareil, même quand il change) ;
//   · Taille du texte : de 90 à 130 %, par pas de 5 ;
//   · Police adaptée à la dyslexie (OpenDyslexic, servie en local).
//
// Tout est réglé PAR APPAREIL : un téléphone et un ordinateur n'ont pas les
// mêmes besoins. Les images générées (carte de héros, impression) ne changent pas.
// =====================================================
(function () {
    'use strict';

    const D = () => window.Demarrage;
    const LIBELLES = { clair: 'Clair', sombre: 'Sombre', auto: 'Auto' };

    function majTheme() {
        if (!D()) return;
        const mode = D().modeTheme();
        document.querySelectorAll('[data-theme-mode]').forEach(b => {
            const on = b.dataset.themeMode === mode;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-checked', on ? 'true' : 'false');
            b.tabIndex = on ? 0 : -1;
        });
        const aide = document.getElementById('menu-theme-hint');
        if (aide) {
            aide.textContent = mode === 'auto'
                ? 'Auto suit le réglage de ton appareil, même quand il change : en ce moment, ' + (D().estSombre() ? 'sombre.' : 'clair.')
                : 'Mode ' + LIBELLES[mode].toLowerCase() + ', quel que soit le réglage de ton appareil.';
        }
    }

    function majConfort() {
        if (!D()) return;
        const t = D().tailleTexte();
        const curseur = document.getElementById('confort-texte');
        const sortie = document.getElementById('confort-texte-val');
        if (curseur && document.activeElement !== curseur) curseur.value = String(t);
        if (curseur) curseur.setAttribute('aria-valuetext', t + ' %');
        if (sortie) sortie.textContent = t + ' %';
        const police = document.getElementById('confort-dyslexie');
        if (police) police.checked = D().dyslexie();
    }

    function maj() { majTheme(); majConfort(); }

    function brancher() {
        const groupe = document.querySelector('.menu-themes');
        if (groupe && !groupe.dataset.branche) {
            groupe.dataset.branche = '1';
            groupe.addEventListener('click', (e) => {
                const b = e.target.closest('[data-theme-mode]');
                if (!b || !D()) return;
                D().definirTheme(b.dataset.themeMode);
            });
            // Un groupe de boutons radio se parcourt aux flèches (ARIA APG).
            groupe.addEventListener('keydown', (e) => {
                const sens = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
                if (!sens || !D()) return;
                e.preventDefault();
                const boutons = [...groupe.querySelectorAll('[data-theme-mode]')];
                const i = boutons.findIndex(x => x.dataset.themeMode === D().modeTheme());
                const suivant = boutons[(i + sens + boutons.length) % boutons.length];
                D().definirTheme(suivant.dataset.themeMode);
                suivant.focus();
            });
        }

        const curseur = document.getElementById('confort-texte');
        if (curseur && !curseur.dataset.branche) {
            curseur.dataset.branche = '1';
            curseur.addEventListener('input', () => { if (D()) D().definirTexte(curseur.value); });
        }

        const police = document.getElementById('confort-dyslexie');
        if (police && !police.dataset.branche) {
            police.dataset.branche = '1';
            police.addEventListener('change', () => { if (D()) D().definirDyslexie(police.checked); });
        }
    }

    document.addEventListener('theme:change', majTheme);
    document.addEventListener('confort:change', majConfort);

    brancher();
    maj();
    window.Confort = { maj };
})();
