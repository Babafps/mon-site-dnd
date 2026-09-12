// =====================================================
// edition.js — quelle édition des règles s'applique, et à qui
//
// L'édition n'est plus un réglage du site : elle appartient au PERSONNAGE.
// Deux valeurs vivent côte à côte, et ne se mélangent jamais :
//
//   · `dnd-edition` — clé DU PERSONNAGE, synchronisée comme le reste de sa
//     fiche. C'est elle qui commande l'assistant, la montée de niveau, le
//     moteur de calcul, la loupe, la recherche, l'impression et les bottes
//     d'armes. Un héros garde ses règles où qu'on ouvre sa fiche.
//
//   · `dnd-srd-edition` — clé globale, déjà lue par srd-data.js. C'est
//     l'édition que l'on CONSULTE hors d'une fiche : accueil, page Règles
//     ouverte depuis l'accueil. Feuilleter l'autre édition ne change jamais
//     un personnage.
//
// Fiches d'avant. Elles n'ont rien choisi : on leur met la 2014, SAUF si
// elles portent une trace des règles 2024 (une botte d'arme enregistrée sur
// une attaque) — sinon cette botte disparaîtrait de leur fiche.
// Cette déduction n'est JAMAIS écrite d'office : elle donne le même résultat
// sur tous les appareils, et écrire au démarrage risquerait d'écraser le
// choix venu du cloud, qui arrive quelques instants plus tard (auth.js).
// Seul un choix du joueur s'enregistre.
//
// Ce module ne dessine rien : il décide, puis prévient par `edition:change`.
// =====================================================
(function () {
    'use strict';

    const EDITIONS = ['2014', '2024'];
    const NOUVELLE = '2024';               // présélection de l'assistant
    const ANCIENNE = '2014';               // fiche créée avant l'édition par personnage
    const CLE_PERSO = 'dnd-edition';
    const CLE_VUE   = 'dnd-srd-edition';   // déjà lue par srd-data.js

    const NOM   = { '2014': 'Règles 2014', '2024': 'Règles 2024' };
    const LABEL = { '2014': '5e (2014)',   '2024': '5.5e (2024)' };
    const DOC   = { '2014': 'SRD 5.1',     '2024': 'SRD 5.2.1' };

    // L'attribution EXACTE exigée par le document officiel, recopiée mot pour
    // mot depuis la page « Informations légales » du SRD 5.2.1 français
    // (tools/srd/srd52_pdf.py télécharge ce même PDF). La licence CC-BY-4.0
    // impose cette déclaration ; le document demande par ailleurs de n'ajouter
    // AUCUNE autre attribution à Wizards of the Coast que celle-ci.
    // La 2014 garde le texte court déjà en place sur le site : sa source
    // officielle n'est pas dans le dépôt, on n'invente pas à sa place.
    const ATTRIBUTION = {
        '2024': 'Cette œuvre inclut du matériel issu du System Reference Document 5.2.1 '
              + '(« SRD 5.2.1 ») de Wizards of the Coast LLC, disponible à l’adresse '
              + 'https://www.dndbeyond.com/srd. Le SRD 5.2.1 est régi par la Licence Creative '
              + 'Commons Attribution 4.0 International, disponible à l’adresse '
              + 'https://creativecommons.org/licenses/by/4.0/legalcode.',
        '2014': 'SRD 5.1 (Wizards of the Coast) — CC-BY-4.0'
    };
    const LIENS = [
        'https://www.dndbeyond.com/srd',
        'https://creativecommons.org/licenses/by/4.0/legalcode'
    ];

    const valide = (e) => EDITIONS.indexOf(e) !== -1 ? e : null;
    const actif  = () => { try { return localStorage.getItem('dnd-active-char') || null; } catch (e) { return null; } };

    /** Lit une clé de personnage, qu'elle ait été écrite en JSON ou en brut. */
    function lire(charId, cle) {
        let v = null;
        try { v = localStorage.getItem(charId + '_' + cle); } catch (e) { return null; }
        if (v == null || v === '' || v === 'undefined') return null;
        try {
            const j = JSON.parse(v);
            return (j && typeof j === 'object') || typeof j === 'string' ? j : v;
        } catch (e) { return v; }
    }

    /** Une botte d'arme enregistrée : la fiche a été bâtie avec les règles 2024. */
    function traces2024(charId) {
        if (!charId) return false;
        const atks = lire(charId, 'dnd-attacks');
        return Array.isArray(atks) && atks.some(a => a && Array.isArray(a.masteries) && a.masteries.length > 0);
    }

    /** L'édition d'un personnage : son choix, sinon la déduction (jamais écrite). */
    function du(charId) {
        if (!charId) return consultation();
        return valide(lire(charId, CLE_PERSO)) || (traces2024(charId) ? '2024' : ANCIENNE);
    }

    /** A-t-il choisi lui-même, ou est-ce encore la déduction ? */
    function choisie(charId) {
        const id = charId || actif();
        return !!(id && valide(lire(id, CLE_PERSO)));
    }

    function consultation() {
        try { return valide(localStorage.getItem(CLE_VUE)) || NOUVELLE; } catch (e) { return NOUVELLE; }
    }
    function definirConsultation(ed) {
        if (!valide(ed)) return false;
        try { localStorage.setItem(CLE_VUE, ed); } catch (e) {}
        return true;
    }

    /** L'édition en vigueur : celle du personnage ouvert, sinon la consultation. */
    function active() {
        const id = actif();
        return id ? du(id) : consultation();
    }

    /** Change l'édition du personnage ouvert (enregistrée et synchronisée). */
    function definir(ed) {
        if (!valide(ed)) return false;
        const id = actif();
        if (!id) return definirConsultation(ed);
        // Par SheetStore : la clé part dans la file de synchro comme le reste
        // de la fiche, et l'export l'emporte sans code supplémentaire.
        if (window.SheetStore && typeof window.SheetStore.set === 'function') window.SheetStore.set(CLE_PERSO, ed);
        else { try { localStorage.setItem(id + '_' + CLE_PERSO, JSON.stringify(ed)); } catch (e) {} }
        definirConsultation(ed);          // la page Règles s'ouvrira là-dessus
        appliquer(true);
        return true;
    }

    // ---------- Mise en vigueur ----------
    let derniere = null;

    /** Pose l'édition en vigueur sur SRD et sur <html>, puis prévient — mais
     *  seulement si quelque chose a bougé : l'événement redessine la fiche et il
     *  partirait à chaque changement d'écran. `force` sert au tout premier appel. */
    function appliquer(force) {
        const ed = active();
        const srdDecale = !!(window.SRD && typeof window.SRD.getEdition === 'function'
                             && window.SRD.getEdition() !== ed);
        const bouge = ed !== derniere || srdDecale;
        if (!force && !bouge) return ed;
        derniere = ed;
        if (srdDecale) window.SRD.setEdition(ed);
        try { document.documentElement.dataset.edition = ed; } catch (e) {}
        try { document.dispatchEvent(new CustomEvent('edition:change', { detail: { edition: ed } })); } catch (e) {}
        return ed;
    }

    /** Relit tout : le cloud vient de poser ses clés (auth.js l'appelle). */
    function relire() { return appliquer(); }

    /** Pose une édition sur SRD le temps de feuilleter, sans toucher au personnage.
     *  `memoriser` (vrai par défaut) garde ce choix comme préférence de
     *  consultation ; l’assistant, lui, ne mémorise rien tant que le joueur
     *  n’a pas validé. */
    function consulter(ed, memoriser) {
        if (!valide(ed)) return false;
        if (memoriser !== false) definirConsultation(ed);
        if (window.SRD && window.SRD.getEdition() !== ed) window.SRD.setEdition(ed);
        derniere = null;                  // la prochaine `appliquer()` remettra la vraie
        return true;
    }

    // Quitter la page Règles remet l'édition du personnage : feuilleter la
    // 2014 ne doit pas laisser la loupe et la montée de niveau en 2014.
    document.addEventListener('screen:change', (e) => {
        if (e && e.detail && e.detail.id === 'rules-screen') return;
        appliquer();
    });

    // ---------- Habillage ----------
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    /** La pastille d'édition, posée sur une fiche de règle ou sur la fiche. */
    function badge(ed, titre) {
        const e = valide(ed) || active();
        return '<span class="edition-badge" data-ed="' + e + '" title="'
             + esc(titre || (DOC[e] + ' — ' + LABEL[e])) + '">' + esc(NOM[e]) + '</span>';
    }

    function attribution(ed) { return ATTRIBUTION[valide(ed) || active()]; }

    /** L'attribution, adresses cliquables. Le texte lui-même n'est pas modifié. */
    function attributionHtml(ed) {
        let t = esc(attribution(ed));
        LIENS.forEach(u => {
            t = t.split(esc(u)).join('<a href="' + u + '" target="_blank" rel="noopener">' + esc(u) + '</a>');
        });
        return t;
    }

    window.Edition = {
        EDITIONS, NOUVELLE, ANCIENNE,
        active, du, choisie, definir, traces2024,
        consultation, definirConsultation, consulter,
        appliquer, relire,
        est2024: (ed) => (valide(ed) || active()) === '2024',
        nom: (ed) => NOM[valide(ed) || active()],
        label: (ed) => LABEL[valide(ed) || active()],
        doc: (ed) => DOC[valide(ed) || active()],
        badge, attribution, attributionHtml
    };

    appliquer(true);
})();
