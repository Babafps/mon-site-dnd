// =====================================================
// toasts.js — les messages éphémères, sur parchemin
//
// Deux piles, un seul parchemin : en bas les messages de l'application
// (`showAppToast`), en haut les murmures des secrets (`SecretsUI.murmure`,
// exploits.js). Chaque pile a sa file d'attente : quand elle est pleine, le
// message suivant patiente au lieu d'en chasser un autre. Un message identique
// déjà à l'écran ne s'empile pas : il reste simplement affiché plus longtemps.
//
// `showAppToast(msg, couleur)` garde sa signature. Les couleurs des anciens
// appels deviennent des types — réussite, erreur, info — qui fixent le sceau,
// la durée et l'annonce aux lecteurs d'écran (une erreur est annoncée tout de
// suite). On peut aussi passer le type lui-même : showAppToast('…', 'erreur').
// Un emoji en tête du message devient le sceau.
//
// Le style vit dans style.css (« Toasts sur parchemin »).
// =====================================================
(function () {
    'use strict';

    const TYPES = {
        reussite: { sceau: '✓', duree: 3200 },
        info:     { sceau: '✦', duree: 3600 },
        erreur:   { sceau: '!', duree: 6000 }
    };
    // Les couleurs employées par les appels existants.
    const COULEURS = {
        '#27ae60': 'reussite', '#2ecc71': 'reussite', '#3d7a3d': 'reussite',
        '#c0392b': 'erreur', '#e74c3c': 'erreur',
        '#8a6320': 'info', '#7a6050': 'info', '#2c3e50': 'info', '#7a2828': 'info', '#b8862c': 'info'
    };
    const MAX_VISIBLES = { bas: 2, haut: 3 };
    const EMOJI_TETE = /^\s*(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}️?)*)\s*/u;

    const calme = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
    const attente = { bas: [], haut: [] };
    const piles = {};

    /** Le type d'un appel : une couleur héritée, un nom de type, ou rien (info). */
    function typeDe(couleur) {
        const c = String(couleur || '').trim().toLowerCase();
        if (TYPES[c]) return c;
        return COULEURS[c] || 'info';
    }

    function pile(nom) {
        let el = piles[nom];
        if (el && el.isConnected) return el;
        el = document.createElement('div');
        el.className = 'tst-pile tst-pile-' + nom + ' no-print';
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-relevant', 'additions');
        (document.body || document.documentElement).appendChild(el);
        piles[nom] = el;
        return el;
    }
    const enVue = (nom) => [...pile(nom).children].filter(x => !x.classList.contains('sort'));

    /**
     * o : { texte, titre, icone, type, humeur, duree, pile: 'bas' | 'haut' }
     * Renvoie tout de suite { el, fermer }, même si le message attend son tour.
     */
    function afficher(o) {
        o = o || {};
        const nom = o.pile === 'haut' ? 'haut' : 'bas';
        const type = TYPES[o.type] ? o.type : 'info';
        let texte = String(o.texte == null ? '' : o.texte);
        let icone = o.icone;
        if (!icone) {
            const m = texte.match(EMOJI_TETE);
            if (m && m[0].length < texte.length) { icone = m[1]; texte = texte.slice(m[0].length); }
        }
        const cle = [nom, type, o.humeur || '', o.titre || '', texte].join('|');

        const affiche = enVue(nom).find(x => x._cle === cle);
        if (affiche) { affiche._armer(); return affiche._api; }
        const patiente = attente[nom].find(x => x._cle === cle);
        if (patiente) return patiente._api;

        const el = document.createElement('div');
        el.className = 'tst t-' + type + (o.humeur ? ' h-' + o.humeur : '');
        el.setAttribute('role', type === 'erreur' ? 'alert' : 'status');
        const sceau = document.createElement('span');
        sceau.className = 'tst-sceau';
        sceau.setAttribute('aria-hidden', 'true');
        sceau.textContent = icone || TYPES[type].sceau;
        const corps = document.createElement('span');
        corps.className = 'tst-texte';
        if (o.titre) {
            const t = document.createElement('span');
            t.className = 'tst-titre';
            t.textContent = o.titre;
            corps.appendChild(t);
        }
        const phrase = document.createElement('span');
        phrase.className = 'tst-phrase';
        phrase.textContent = texte;
        corps.appendChild(phrase);
        el.appendChild(sceau);
        el.appendChild(corps);

        const duree = o.duree || (TYPES[type].duree + (texte.length > 80 ? 2000 : 0));
        let minuteur = null;
        el._cle = cle;
        el._armer = () => { clearTimeout(minuteur); minuteur = setTimeout(fermer, duree); };
        function fermer() {
            clearTimeout(minuteur);
            const i = attente[nom].indexOf(el);
            if (i >= 0) { attente[nom].splice(i, 1); return; }
            if (!el.isConnected || el.classList.contains('sort')) return;
            el.classList.add('sort');
            setTimeout(() => { el.remove(); suivant(nom); }, calme() ? 0 : 380);
        }
        el._api = { el, fermer };
        el.addEventListener('click', fermer);
        // Survoler un message le garde ouvert : le temps de le lire.
        el.addEventListener('pointerenter', () => clearTimeout(minuteur));
        el.addEventListener('pointerleave', () => el._armer());

        if (enVue(nom).length < MAX_VISIBLES[nom]) montrer(nom, el);
        else attente[nom].push(el);
        return el._api;
    }

    function montrer(nom, el) {
        pile(nom).appendChild(el);
        el._armer();
    }
    function suivant(nom) {
        while (attente[nom].length && enVue(nom).length < MAX_VISIBLES[nom]) montrer(nom, attente[nom].shift());
    }

    window.Toasts = { afficher, typeDe };
    window.showAppToast = function (msg, couleur) {
        return afficher({ texte: msg, type: typeDe(couleur) });
    };
})();
