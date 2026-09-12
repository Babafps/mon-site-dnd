// =====================================================
// etats.js — les états du personnage (LOT 2.3, 2.4 et l'épuisement de 2.2)
//
// Ce qui est affiché : des PASTILLES. Ce qui est stocké : exactement ce qui
// l'était avant — une case à cocher `dnd-sheet-cond-*` par état officiel,
// `dnd-custom-conditions` pour les états personnalisés. Les cases existent
// toujours dans la fiche, hors écran : la sauvegarde globale, l'export,
// l'import et les anciennes fiches continuent de fonctionner sans rien savoir
// de cette page. Seul l'épuisement est nouveau (`dnd-sheet-exhaustion-level`),
// et vaut 0 tant que personne n'y touche.
//
// Les TEXTES viennent des données : `data/srd/<édition>/fr/conditions.json`.
// Le résumé d'une ligne est écrit d'après cette entrée-là, édition par
// édition ; la description complète, elle, est lue telle quelle dans le
// widget « 📖 Tous les états ». Aucune règle de mémoire.
//
// Ce que le MOTEUR applique (calcul.js, par `Calcul.fournisseur`) :
//   · Épuisement 2024 — « Lorsque vous effectuez un Test d20, le résultat est
//     réduit de 2 fois votre niveau » et « Votre Vitesse est réduite de
//     1,50 m x votre niveau » ;
//   · Épuisement 2014 — vitesse de moitié (niveau 2) puis 0 (niveau 5) ; le
//     reste (désavantages, PV max de moitié) n'est pas un nombre : on le dit,
//     on ne l'invente pas ;
//   · « Votre Vitesse est de 0 » des états qui l'imposent.
// Le désavantage n'a pas de valeur chiffrée : il apparaît en avertissement.
// =====================================================
(function () {
    'use strict';

    // ---------- Le catalogue ----------
    // `srd` est l'identifiant de l'entrée dans conditions.json : c'est lui qui
    // relie une pastille à sa description officielle. `case` est l'identifiant
    // de la case à cocher de la fiche — les dix premières existaient déjà et
    // ne changent pas, sous peine de perdre l'état des fiches enregistrées.
    // Le nom affiché est celui des données (2014 et 2024 le donnent identique) ;
    // `majNoms()` le recale sur le fichier dès qu'il est chargé.
    const CATALOGUE = [
        { srd: 'blinded',       case: 'cond-blind',  nom: 'Aveuglé',    icone: '👁️' },
        { srd: 'charmed',       case: 'cond-charm',  nom: 'Charmé',     icone: '💖' },
        { srd: 'deafened',      case: 'cond-deaf',   nom: 'Assourdi',   icone: '🙉' },
        { srd: 'frightened',    case: 'cond-fright', nom: 'Effrayé',    icone: '👻' },
        { srd: 'grappled',      case: 'cond-grap',   nom: 'Agrippé',    icone: '✊' },
        { srd: 'poisoned',      case: 'cond-pois',   nom: 'Empoisonné', icone: '🧪' },
        { srd: 'prone',         case: 'cond-prone',  nom: 'À terre',    icone: '⏬' },
        { srd: 'restrained',    case: 'cond-restr',  nom: 'Entravé',    icone: '⛓️' },
        { srd: 'stunned',       case: 'cond-stun',   nom: 'Étourdi',    icone: '💫' },
        { srd: 'unconscious',   case: 'cond-uncon',  nom: 'Inconscient', icone: '💤' },
        // Les quatre que la fiche ne proposait pas encore (§ 2.3).
        { srd: 'invisible',     case: 'cond-invis',  nom: 'Invisible',  icone: '🌫️' },
        { srd: 'paralyzed',     case: 'cond-para',   nom: 'Paralysé',   icone: '🧊' },
        { srd: 'petrified',     case: 'cond-petri',  nom: 'Pétrifié',   icone: '🗿' },
        { srd: 'incapacitated', case: 'cond-incap',  nom: 'Neutralisé', icone: '🚫' }
    ];
    const EPUISEMENT = { srd: 'exhaustion', nom: 'Épuisement', icone: '🕯️', max: 6 };
    const PAR_SRD = Object.fromEntries(CATALOGUE.map(e => [e.srd, e]));

    // Le résumé d'UNE ligne, écrit d'après l'entrée de conditions.json de
    // chaque édition (§ 2.3 : « l'effet de l'état en une ligne, selon
    // l'édition »). Le texte intégral reste à un clic, dans le widget.
    const RESUME = {
        '2014': {
            blinded: 'Tu ne vois rien : tests liés à la vue ratés, désavantage à tes attaques, avantage à celles qu’on te porte.',
            charmed: 'Tu ne peux pas attaquer ton charmeur ; il est avantagé à ses interactions sociales avec toi.',
            deafened: 'Tu n’entends rien : tu rates tout test de caractéristique demandant l’ouïe.',
            frightened: 'Tant que tu vois la source : désavantage aux tests et aux attaques, et tu ne peux pas t’en rapprocher.',
            grappled: 'Ta vitesse tombe à 0 et aucun bonus de vitesse ne s’applique.',
            poisoned: 'Désavantage à tes jets d’attaque et à tes tests de caractéristique.',
            prone: 'Tu ne te déplaces qu’en rampant ; désavantage à tes attaques, avantage à celles portées à 1,50 m.',
            restrained: 'Vitesse 0, désavantage à tes attaques et aux sauvegardes de Dextérité, avantage à celles qu’on te porte.',
            stunned: 'Neutralisé et immobile ; sauvegardes de Force et de Dextérité ratées, attaques avantagées contre toi.',
            unconscious: 'Neutralisé, à terre, sans conscience ; sauvegardes de Force et de Dextérité ratées, critiques à 1,50 m.',
            invisible: 'On ne te voit pas : avantage à tes attaques, désavantage à celles qu’on te porte.',
            paralyzed: 'Neutralisé, immobile et muet ; sauvegardes de Force et de Dextérité ratées, critiques à 1,50 m.',
            petrified: 'Changé en pierre : neutralisé, résistance à tous les dégâts, sauvegardes de Force et de Dextérité ratées.',
            incapacitated: 'Tu ne peux entreprendre aucune action ni jouer de réaction.',
            exhaustion: 'Six niveaux : 1 désavantage aux tests, 2 vitesse de moitié, 3 désavantage aux attaques et sauvegardes, 4 PV max de moitié, 5 vitesse 0, 6 mort.'
        },
        '2024': {
            blinded: 'Tu ne vois rien : tests reposant sur la vue ratés, désavantage à tes attaques, avantage à celles qu’on te porte.',
            charmed: 'Tu ne peux pas nuire à ton charmeur ; il a l’Avantage à ses interactions sociales avec toi.',
            deafened: 'Tu n’entends rien : tu rates tous les tests qui reposent sur l’ouïe.',
            frightened: 'Tant que tu vois la source : désavantage aux tests et aux attaques, et tu ne peux pas t’en rapprocher.',
            grappled: 'Vitesse 0 ; désavantage à tes attaques contre toute cible hormis l’agrippeur.',
            poisoned: 'Désavantage à tes jets d’attaque et à tes tests de caractéristique.',
            prone: 'Tu rampes, ou te relèves pour la moitié de ta Vitesse ; désavantage à tes attaques, avantage à celles portées à 1,50 m.',
            restrained: 'Vitesse 0, désavantage à tes attaques et aux sauvegardes de Dextérité, avantage à celles qu’on te porte.',
            stunned: 'Neutralisé ; sauvegardes de Force et de Dextérité ratées, attaques avantagées contre toi.',
            unconscious: 'À terre, Neutralisé, Vitesse 0, sans conscience ; sauvegardes ratées et critiques à 1,50 m.',
            invisible: 'Dissimulé : Avantage à l’initiative et à tes attaques, Désavantage à celles qu’on te porte.',
            paralyzed: 'Neutralisé, Vitesse 0 ; sauvegardes de Force et de Dextérité ratées, critiques à 1,50 m.',
            petrified: 'Changé en pierre : Neutralisé, Vitesse 0, Résistance à tous les dégâts, Immunité contre Empoisonné.',
            incapacitated: 'Ni action, ni action Bonus, ni Réaction ; Concentration brisée et tu ne peux pas parler.',
            exhaustion: 'Chaque niveau retire 2 à tes Tests d20 et 1,50 m à ta Vitesse ; à 6 niveaux, tu meurs.'
        }
    };

    // « Votre Vitesse est de 0 et ne peut pas augmenter » — les états qui
    // l'imposent, d'après conditions.json de chaque édition.
    const VITESSE_ZERO = {
        '2014': ['grappled', 'restrained'],
        '2024': ['grappled', 'restrained', 'paralyzed', 'petrified', 'unconscious']
    };

    const $ = (id) => document.getElementById(id);
    const edition = () => (window.Edition ? window.Edition.active() : '2024');
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const calme = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

    // ---------- Lecture et écriture ----------
    // Tout passe par les cases de la fiche : elles sont la source de vérité,
    // et c'est leur événement `change` que la sauvegarde globale écoute déjà.
    const laCase = (srd) => { const e = PAR_SRD[srd]; return e ? $(e.case) : null; };
    const estActif = (srd) => { const c = laCase(srd); return !!(c && c.checked); };

    function basculer(srd, on) {
        const c = laCase(srd); if (!c) return false;
        const veut = on == null ? !c.checked : !!on;
        if (c.checked === veut) return false;
        c.checked = veut;
        c.dispatchEvent(new Event('change', { bubbles: true }));   // sauvegarde + rendu
        return true;
    }

    function niveauEpuisement() {
        const el = $('exhaustion-level');
        const n = parseInt(el ? el.value : 0, 10);
        return isNaN(n) ? 0 : Math.max(0, Math.min(EPUISEMENT.max, n));
    }
    function definirEpuisement(n) {
        const el = $('exhaustion-level'); if (!el) return;
        const v = Math.max(0, Math.min(EPUISEMENT.max, parseInt(n, 10) || 0));
        if (String(el.value) === String(v)) return;
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));    // sauvegarde globale
        rendre();
        if (window.SheetApi && window.SheetApi.refresh) window.SheetApi.refresh();
    }

    /** Les états personnalisés du joueur : [{ name, active, desc }]. */
    function perso() {
        const l = (window.SheetStore && window.SheetStore.get) ? window.SheetStore.get('dnd-custom-conditions') : null;
        return Array.isArray(l) ? l : [];
    }
    function poserPerso(liste) {
        if (window.SheetStore && window.SheetStore.set) window.SheetStore.set('dnd-custom-conditions', liste);
    }

    /** Ce qui est actif en ce moment — officiels puis personnalisés. */
    function actifs() {
        const out = [];
        CATALOGUE.forEach(e => { if (estActif(e.srd)) out.push({ srd: e.srd, nom: e.nom, icone: e.icone, perso: false }); });
        const n = niveauEpuisement();
        if (n > 0) out.push({ srd: 'exhaustion', nom: EPUISEMENT.nom, icone: EPUISEMENT.icone, perso: false, niveau: n });
        perso().forEach((c, i) => {
            if (c && c.active) out.push({ srd: 'perso-' + i, nom: c.name || 'État', icone: c.icone || '✨', perso: true, index: i, desc: c.desc || '' });
        });
        return out;
    }

    /** Le résumé d'une ligne, dans l'édition en vigueur. */
    function resume(srd, ed) {
        const table = RESUME[ed || edition()] || RESUME['2024'];
        return table[srd] || '';
    }

    // ---------- Les noms, recalés sur les données ----------
    // Le catalogue porte les noms pour que les pastilles s'affichent tout de
    // suite, sans attendre un fichier. Dès que conditions.json est là, on les
    // remplace par les siens : si une traduction change, l'écran suit.
    let nomsRecales = '';
    function majNoms() {
        const ed = edition();
        if (nomsRecales === ed || !window.SRD || !window.SRD.category) return;
        nomsRecales = ed;
        window.SRD.category('conditions').then(liste => {
            if (nomsRecales !== ed) return;                 // l'édition a changé entre-temps
            let bouge = false;
            (liste || []).forEach(e => {
                const c = PAR_SRD[e.id];
                if (c && e.name && c.nom !== e.name) { c.nom = e.name; bouge = true; }
                if (e.id === 'exhaustion' && e.name && EPUISEMENT.nom !== e.name) { EPUISEMENT.nom = e.name; bouge = true; }
            });
            if (bouge) rendre();
        }).catch(() => { nomsRecales = ''; });               // hors ligne : on réessaiera
    }

    // =====================================================
    // LES PASTILLES
    // =====================================================
    function pastille(e) {
        const txt = e.perso ? (e.desc || 'État personnalisé.') : resume(e.srd);
        const nom = e.niveau ? e.nom + ' ' + e.niveau : e.nom;
        const lu = 'État : ' + nom + (txt ? '. ' + txt.replace(/<[^>]*>/g, '') : '');
        return `<span class="etat-pastille${e.perso ? ' est-perso' : ''}" data-srd="${esc(e.srd)}"
                      data-resume="${esc(txt)}" tabindex="0" aria-label="${esc(lu)}">
            <span class="etat-ico" aria-hidden="true">${e.icone}</span>
            <span class="etat-nom">${esc(e.nom)}</span>
            ${e.niveau ? `<span class="etat-niv" aria-hidden="true">${e.niveau}</span>` : ''}
            ${e.srd === 'exhaustion' ? `
                <button type="button" class="etat-pm no-print" data-epuise="-1" aria-label="Réduire l’épuisement">−</button>
                <button type="button" class="etat-pm no-print" data-epuise="1" aria-label="Augmenter l’épuisement">+</button>` : ''}
            <button type="button" class="etat-x no-print" data-retirer="${esc(e.srd)}"
                    aria-label="Retirer l’état ${esc(nom)}">✕</button>
        </span>`;
    }

    function rendre() {
        const boite = $('etats-pastilles');
        if (!boite) return;
        const liste = actifs();
        boite.innerHTML = liste.length
            ? liste.map(pastille).join('')
            : '<span class="etats-vide">Aucun état en cours</span>';
        boite.classList.toggle('est-vide', !liste.length);
        majNoms();
        if (window.StatusFX && window.StatusFX.refresh) window.StatusFX.refresh();
    }

    // ---------- Retirer, avec retour en arrière ----------
    function retirer(srd) {
        if (srd === 'exhaustion') {
            const avant = niveauEpuisement();
            definirEpuisement(0);
            window.showUndoToast('« Épuisement » retiré', () => definirEpuisement(avant));
            return;
        }
        if (srd.indexOf('perso-') === 0) {
            const i = parseInt(srd.slice(6), 10);
            const liste = perso();
            const c = liste[i]; if (!c) return;
            // Un état perso décoché n'est pas supprimé : c'est une étiquette que
            // le joueur a créée, il la réutilisera. On la supprime pour de bon
            // depuis le widget, là aussi avec un retour en arrière.
            liste[i] = Object.assign({}, c, { active: false });
            poserPerso(liste); rendre();
            window.showUndoToast(`« ${c.name || 'État'} » retiré`, () => {
                const l = perso(); if (l[i]) { l[i] = Object.assign({}, l[i], { active: true }); poserPerso(l); rendre(); }
            });
            return;
        }
        const e = PAR_SRD[srd]; if (!e) return;
        basculer(srd, false);
        window.showUndoToast(`« ${e.nom} » retiré`, () => basculer(srd, true));
    }

    // =====================================================
    // LA BULLE (survol au bureau, appui long sur mobile)
    // =====================================================
    let bulle = null, minuteurAppui = null;
    function montrerBulle(cible) {
        const txt = cible.getAttribute('data-resume');
        if (!txt) return;
        if (!bulle) {
            bulle = document.createElement('div');
            bulle.className = 'etat-bulle no-print';
            bulle.setAttribute('role', 'tooltip');
            document.body.appendChild(bulle);
        }
        bulle.textContent = txt;
        bulle.classList.add('est-on');
        // Posée au-dessus de la pastille, ramenée dans l'écran si elle déborde.
        const r = cible.getBoundingClientRect();
        bulle.style.visibility = 'hidden';
        bulle.style.left = '0px'; bulle.style.top = '0px';
        const b = bulle.getBoundingClientRect();
        const marge = 8;
        let x = r.left + r.width / 2 - b.width / 2;
        x = Math.max(marge, Math.min(x, window.innerWidth - b.width - marge));
        let y = r.top - b.height - 10;
        if (y < marge) y = r.bottom + 10;                     // pas de place au-dessus
        bulle.style.left = Math.round(x) + 'px';
        bulle.style.top = Math.round(y) + 'px';
        bulle.style.visibility = '';
    }
    function cacherBulle() {
        if (bulle) bulle.classList.remove('est-on');
        clearTimeout(minuteurAppui);
    }

    // =====================================================
    // LE CHOIX RAPIDE : « ＋ État »
    // =====================================================
    let menu = null;
    function fermerMenu() {
        if (menu) { menu.remove(); menu = null; }
        document.removeEventListener('click', surClicDehors, true);
    }
    function surClicDehors(e) {
        if (menu && !menu.contains(e.target) && !e.target.closest('#btn-etat-ajouter')) fermerMenu();
    }
    function ouvrirMenu(bouton) {
        if (menu) { fermerMenu(); return; }
        const dispo = CATALOGUE.filter(e => !estActif(e.srd));
        const lignes = dispo.map(e =>
            `<button type="button" class="etat-choix" data-ajouter="${esc(e.srd)}">
                <span aria-hidden="true">${e.icone}</span> ${esc(e.nom)}</button>`).join('');
        menu = document.createElement('div');
        menu.className = 'etat-menu no-print';
        menu.setAttribute('role', 'menu');
        menu.innerHTML =
            (lignes || '<p class="etat-menu-vide">Tous les états officiels sont déjà en cours.</p>')
            + (niveauEpuisement() === 0
                ? `<button type="button" class="etat-choix" data-ajouter="exhaustion">
                     <span aria-hidden="true">${EPUISEMENT.icone}</span> ${esc(EPUISEMENT.nom)} 1</button>` : '')
            + `<div class="etat-menu-bas">
                 <button type="button" class="etat-choix est-lien" data-etats-perso="1">✨ État personnalisé…</button>
                 <button type="button" class="etat-choix est-lien" data-etats-tous="1">📖 Tous les états</button>
               </div>`;
        document.body.appendChild(menu);
        const r = bouton.getBoundingClientRect();
        const b = menu.getBoundingClientRect();
        const marge = 8;
        let x = Math.min(r.left, window.innerWidth - b.width - marge);
        menu.style.left = Math.round(Math.max(marge, x)) + 'px';
        menu.style.top = Math.round(r.bottom + 6 + b.height > window.innerHeight
            ? Math.max(marge, r.top - b.height - 6) : r.bottom + 6) + 'px';
        const premier = menu.querySelector('button');
        if (premier) premier.focus({ preventScroll: true });
        setTimeout(() => document.addEventListener('click', surClicDehors, true), 0);
    }

    // =====================================================
    // LE WIDGET « 📖 TOUS LES ÉTATS »
    // =====================================================
    let panneau = null, rendeurFocus = null;

    function fermerPanneau() {
        if (!panneau) return;
        panneau.remove(); panneau = null;
        document.body.classList.remove('etats-panneau-ouvert');
        if (rendeurFocus && rendeurFocus.focus) rendeurFocus.focus({ preventScroll: true });
        rendeurFocus = null;
    }

    async function ouvrirTous(srdACentrer) {
        if (panneau) fermerPanneau();
        rendeurFocus = document.activeElement;
        panneau = document.createElement('div');
        panneau.className = 'modal-overlay etats-panneau no-print';
        panneau.innerHTML = `
            <div class="modal-box etats-box" role="dialog" aria-modal="true" aria-labelledby="etats-titre">
                <div class="modal-header">
                    <h2 id="etats-titre">📖 Tous les états ${window.Edition ? window.Edition.badge() : ''}</h2>
                    <button class="btn-close-modal" type="button" data-etats-fermer="1" aria-label="Fermer">✕</button>
                </div>
                <p class="etats-lede">Coche ce que ton personnage subit. Le texte est celui des règles ${esc(edition())}.</p>
                <div class="etats-liste" id="etats-liste"><p class="etats-chargement">Chargement des règles…</p></div>
                <form class="etats-perso-form" id="etats-perso-form">
                    <h3>✨ Ton propre état</h3>
                    <label for="etat-perso-nom">Nom</label>
                    <input type="text" id="etat-perso-nom" maxlength="40" placeholder="Bénédiction du village, Malédiction…" autocomplete="off" required>
                    <label for="etat-perso-desc">Effet (une ligne)</label>
                    <input type="text" id="etat-perso-desc" maxlength="160" placeholder="+1 aux jets de sauvegarde jusqu’à l’aube" autocomplete="off">
                    <button type="submit" class="btn-small">Ajouter cet état</button>
                </form>
            </div>`;
        document.body.appendChild(panneau);
        document.body.classList.add('etats-panneau-ouvert');
        remplirPanneau();
        const box = panneau.querySelector('.etats-box');
        const premier = panneau.querySelector('.btn-close-modal');
        if (premier) premier.focus({ preventScroll: true });

        // Fermeture au clic sur le voile, et piège à focus (Échap est géré plus bas).
        panneau.addEventListener('mousedown', (e) => { if (e.target === panneau) fermerPanneau(); });
        box.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;
            const f = [...box.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])')]
                .filter(el => !el.disabled && el.offsetParent !== null);
            if (!f.length) return;
            const premierEl = f[0], dernier = f[f.length - 1];
            if (e.shiftKey && document.activeElement === premierEl) { e.preventDefault(); dernier.focus(); }
            else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premierEl.focus(); }
        });

        if (srdACentrer) {
            setTimeout(() => {
                const l = panneau.querySelector(`[data-fiche="${srdACentrer}"]`);
                if (l) l.scrollIntoView({ block: 'center', behavior: calme() ? 'auto' : 'smooth' });
            }, 120);
        }
    }

    /** Le corps du widget : chaque état, son texte intégral, son interrupteur. */
    async function remplirPanneau() {
        const boite = panneau && $('etats-liste');
        if (!boite) return;
        let data = [];
        try { data = await window.SRD.category('conditions'); }
        catch (e) {
            boite.innerHTML = '<p class="etats-chargement">Les règles ne sont pas accessibles hors connexion '
                            + 'tant qu’elles n’ont pas été consultées une première fois.</p>';
            return;
        }
        if (!panneau) return;                                  // fermé pendant le chargement
        const parId = Object.fromEntries((data || []).map(e => [e.id, e]));
        const bloc = (e, corps, extra) => `
            <section class="etat-fiche" data-fiche="${esc(e.srd)}">
                <div class="etat-fiche-h">
                    <span class="etat-ico" aria-hidden="true">${e.icone}</span>
                    <h3>${esc(e.nom)}</h3>
                    ${extra || ''}
                </div>
                <div class="etat-fiche-txt">${corps}</div>
            </section>`;

        const html = CATALOGUE.map(e => {
            const src = parId[e.srd];
            const corps = src && src.desc
                ? src.desc.map(p => `<p>${esc(p)}</p>`).join('')
                : `<p>${esc(resume(e.srd))}</p>`;
            const on = estActif(e.srd);
            const inter = `<button type="button" class="etat-inter${on ? ' est-on' : ''}"
                    role="switch" aria-checked="${on}" data-basculer="${esc(e.srd)}">
                    <span aria-hidden="true"></span><b>${on ? 'En cours' : 'Appliquer'}</b></button>`;
            return bloc(e, corps, inter);
        }).join('');

        // L'épuisement a des niveaux, pas un interrupteur.
        const srcEp = parId.exhaustion;
        const n = niveauEpuisement();
        const corpsEp = (srcEp && srcEp.desc ? srcEp.desc.map(p => `<p>${esc(p)}</p>`).join('') : `<p>${esc(resume('exhaustion'))}</p>`)
            + (srcEp && srcEp.table ? tableau(srcEp.table) : '');
        const interEp = `<span class="etat-niveaux" role="group" aria-label="Niveau d’épuisement">
                <button type="button" class="etat-pm" data-epuise="-1" aria-label="Réduire l’épuisement">−</button>
                <b id="etats-niv-epuise">${n}</b>
                <button type="button" class="etat-pm" data-epuise="1" aria-label="Augmenter l’épuisement">+</button>
            </span>`;
        const htmlEp = bloc({ srd: 'exhaustion', nom: EPUISEMENT.nom, icone: EPUISEMENT.icone }, corpsEp, interEp);

        // Les états du joueur, avec leur suppression définitive.
        const mesEtats = perso();
        const htmlPerso = mesEtats.length ? `<h3 class="etats-sous-titre">✨ Tes états</h3>` + mesEtats.map((c, i) => {
            const on = !!c.active;
            return `<section class="etat-fiche est-perso" data-fiche="perso-${i}">
                <div class="etat-fiche-h">
                    <span class="etat-ico" aria-hidden="true">${esc(c.icone || '✨')}</span>
                    <h3>${esc(c.name || 'État')}</h3>
                    <button type="button" class="etat-inter${on ? ' est-on' : ''}" role="switch"
                            aria-checked="${on}" data-basculer-perso="${i}">
                        <span aria-hidden="true"></span><b>${on ? 'En cours' : 'Appliquer'}</b></button>
                    <button type="button" class="etat-suppr" data-suppr-perso="${i}"
                            aria-label="Supprimer l’état ${esc(c.name || '')}">🗑</button>
                </div>
                <div class="etat-fiche-txt"><p>${esc(c.desc || 'Pas de description.')}</p></div>
            </section>`;
        }).join('') : '';

        boite.innerHTML = html + htmlEp + htmlPerso
            + (window.Edition ? `<p class="rw-attrib">${window.Edition.attributionHtml()}</p>` : '');
    }

    function tableau(t) {
        if (!t || !t.rows) return '';
        return '<table class="rw-table">'
            + (t.headers && t.headers.length ? '<tr>' + t.headers.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>' : '')
            + t.rows.map(r => '<tr>' + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>').join('')
            + '</table>';
    }

    /** Ajoute un état personnalisé depuis le formulaire du widget (§ 2.4). */
    function ajouterPerso(nom, desc) {
        const n = String(nom || '').trim();
        if (!n) return false;
        const liste = perso();
        if (liste.some(c => c && String(c.name || '').toLowerCase() === n.toLowerCase())) {
            window.Dialogue.informer({ titre: 'Déjà là', message: `Tu as déjà un état « ${n} ».`, type: 'info' });
            return false;
        }
        liste.push({ name: n, desc: String(desc || '').trim(), active: true, icone: '✨' });
        poserPerso(liste);
        rendre();
        remplirPanneau();
        window.showAppToast('✨ État « ' + n + ' » ajouté', 'reussite');
        return true;
    }

    function supprimerPerso(i) {
        const liste = perso();
        if (!liste[i]) return;
        window.deleteWithUndo(liste, i, liste[i].name || 'cet état',
            () => poserPerso(liste),
            () => { rendre(); remplirPanneau(); });
    }

    // =====================================================
    // LE MOTEUR (calcul.js)
    // =====================================================
    // Les clés que le moteur produit et qui servent à un Test d20 : c'est
    // exactement sur elles que porte la pénalité d'épuisement 2024.
    const TEST_D20 = /^(carac|competence|sauvegarde|initiative|attaque|attaque-sorts)/;

    function sourcesEtats(cle, ctx) {
        const out = [];
        const ed = ctx && ctx.edition ? ctx.edition : edition();
        const n = niveauEpuisement();

        // ---- Épuisement ----
        if (n > 0) {
            if (ed === '2024') {
                // « Lorsque vous effectuez un Test d20, le résultat est réduit de
                //   2 fois votre niveau actuel d'Épuisement. » (conditions.json 2024)
                if (TEST_D20.test(cle)) out.push({ libelle: 'épuisement ' + n, valeur: -2 * n, origine: 'etat' });
                // « Votre Vitesse est réduite de 1,50 m x votre niveau actuel. »
                // La fiche se tient en mètres ; en pieds, le SRD français emploie
                // partout l'équivalence 1,50 m = 5 ft.
                if (cle === 'vitesse') {
                    const pas = (ctx && ctx.unite === 'ft') ? 5 : 1.5;
                    out.push({ libelle: 'épuisement ' + n, valeur: -pas * n, origine: 'etat' });
                }
            } else if (cle === 'vitesse' && ctx && typeof ctx.base === 'number') {
                // 2014 : la table donne « vitesse réduite de moitié » (niveau 2)
                // puis « vitesse réduite à 0 » (niveau 5). Les autres paliers
                // sont des désavantages : voir les avertissements plus bas.
                if (n >= 5) out.push({ libelle: 'épuisement 5', valeur: -ctx.base, origine: 'etat' });
                else if (n >= 2) out.push({ libelle: 'épuisement ' + n, valeur: -Math.floor(ctx.base / 2), origine: 'etat' });
            }
        }

        // ---- « Votre Vitesse est de 0 » ----
        if (cle === 'vitesse' && ctx && typeof ctx.base === 'number' && ctx.base > 0) {
            const bloquant = (VITESSE_ZERO[ed] || []).filter(estActif);
            if (bloquant.length) {
                const dejaAZero = out.reduce((t, s) => t + s.valeur, 0) <= -ctx.base;
                if (!dejaAZero) {
                    const e = PAR_SRD[bloquant[0]];
                    out.push({ libelle: (e ? e.nom : 'état') + ' : Vitesse 0',
                               valeur: -(ctx.base + out.reduce((t, s) => t + s.valeur, 0)), origine: 'etat' });
                }
            }
        }
        return out;
    }

    /** Ce que le moteur ne peut pas chiffrer, mais qu'il doit dire. */
    function avertissements(cle) {
        const out = [];
        const ed = edition(), n = niveauEpuisement();
        if (n > 0 && ed === '2014') {
            if (n >= 1 && /^(carac|competence)/.test(cle)) out.push('Épuisement 1 : Désavantage aux tests de caractéristique.');
            if (n >= 3 && /^(sauvegarde|attaque)/.test(cle)) out.push('Épuisement 3 : Désavantage aux jets d’attaque et aux jets de sauvegarde.');
            if (n >= 4 && cle === 'ca') out.push('Épuisement 4 : maximum de points de vie réduit de moitié.');
            if (n >= 6) out.push('Épuisement 6 : la créature meurt.');
        }
        return out;
    }

    // =====================================================
    // BRANCHEMENTS
    // =====================================================
    function brancher() {
        if (!$('etats-pastilles')) return;                     // pas sur la fiche

        // Clics : pastilles, menu, widget. Un seul écouteur, délégué.
        document.addEventListener('click', (e) => {
            const t = e.target;
            const retirerBtn = t.closest && t.closest('[data-retirer]');
            if (retirerBtn) { retirer(retirerBtn.getAttribute('data-retirer')); cacherBulle(); return; }

            const pm = t.closest && t.closest('[data-epuise]');
            if (pm) {
                definirEpuisement(niveauEpuisement() + parseInt(pm.getAttribute('data-epuise'), 10));
                const aff = $('etats-niv-epuise'); if (aff) aff.textContent = niveauEpuisement();
                if (panneau) remplirPanneau();
                return;
            }
            if (t.closest && t.closest('#btn-etat-ajouter')) { ouvrirMenu(t.closest('#btn-etat-ajouter')); return; }
            if (t.closest && t.closest('#btn-etats-tous')) { fermerMenu(); ouvrirTous(); return; }

            const ajout = t.closest && t.closest('[data-ajouter]');
            if (ajout) {
                const srd = ajout.getAttribute('data-ajouter');
                if (srd === 'exhaustion') definirEpuisement(1); else basculer(srd, true);
                fermerMenu();
                return;
            }
            if (t.closest && t.closest('[data-etats-tous]')) { fermerMenu(); ouvrirTous(); return; }
            if (t.closest && t.closest('[data-etats-perso]')) {
                fermerMenu();
                ouvrirTous().then(() => setTimeout(() => $('etat-perso-nom')?.focus(), 150));
                return;
            }
            if (t.closest && t.closest('[data-etats-fermer]')) { fermerPanneau(); return; }

            const bascule = t.closest && t.closest('[data-basculer]');
            if (bascule) { basculer(bascule.getAttribute('data-basculer')); remplirPanneau(); return; }

            const basculeP = t.closest && t.closest('[data-basculer-perso]');
            if (basculeP) {
                const i = parseInt(basculeP.getAttribute('data-basculer-perso'), 10);
                const liste = perso();
                if (liste[i]) { liste[i] = Object.assign({}, liste[i], { active: !liste[i].active }); poserPerso(liste); rendre(); remplirPanneau(); }
                return;
            }
            const supprP = t.closest && t.closest('[data-suppr-perso]');
            if (supprP) { supprimerPerso(parseInt(supprP.getAttribute('data-suppr-perso'), 10)); return; }
        });

        // Le formulaire d'état personnalisé.
        document.addEventListener('submit', (e) => {
            if (!e.target || e.target.id !== 'etats-perso-form') return;
            e.preventDefault();
            if (ajouterPerso($('etat-perso-nom').value, $('etat-perso-desc').value)) {
                const n = $('etat-perso-nom'), d = $('etat-perso-desc');
                if (n) n.value = ''; if (d) d.value = '';
                if (n) n.focus();
            }
        });

        // Échap ferme d'abord le menu, puis le widget.
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (menu) { fermerMenu(); return; }
                if (panneau) { fermerPanneau(); return; }
                cacherBulle();
            }
        });

        // La bulle : survol et focus au clavier, appui long au doigt.
        const cible = (e) => e.target && e.target.closest && e.target.closest('.etat-pastille');
        document.addEventListener('mouseover', (e) => { const p = cible(e); if (p) montrerBulle(p); });
        document.addEventListener('mouseout', (e) => { if (cible(e)) cacherBulle(); });
        document.addEventListener('focusin', (e) => { const p = cible(e); if (p) montrerBulle(p); });
        document.addEventListener('focusout', (e) => { if (cible(e)) cacherBulle(); });
        document.addEventListener('touchstart', (e) => {
            const p = cible(e); if (!p) return;
            clearTimeout(minuteurAppui);
            minuteurAppui = setTimeout(() => montrerBulle(p), 450);
        }, { passive: true });
        ['touchend', 'touchcancel', 'touchmove'].forEach(ev =>
            document.addEventListener(ev, () => clearTimeout(minuteurAppui), { passive: true }));
        document.addEventListener('scroll', cacherBulle, true);

        // Le niveau d'épuisement saisi ailleurs (import, cloud) redessine.
        const champ = $('exhaustion-level');
        if (champ) champ.addEventListener('input', rendre);

        // Changer d'édition change les textes et les effets appliqués.
        document.addEventListener('edition:change', () => {
            nomsRecales = '';
            rendre();
            if (panneau) remplirPanneau();
        });

        // Le moteur de calcul : l'épuisement et les « Vitesse 0 ».
        if (window.Calcul && window.Calcul.fournisseur) window.Calcul.fournisseur(sourcesEtats);

        rendre();
    }

    window.Etats = {
        CATALOGUE, EPUISEMENT,
        actifs, estActif, basculer, resume,
        niveauEpuisement, definirEpuisement,
        perso, ajouterPerso,
        rendre, ouvrirTous, fermerPanneau,
        avertissements,
        /** Les identifiants SRD actifs — ce que lisent les voiles (effets.js). */
        idsActifs: () => actifs().map(e => e.srd)
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', brancher);
    else brancher();
})();
