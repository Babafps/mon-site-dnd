// =====================================================
// help.js — « Découvrir la fiche »
//
// Deux parcours : INTÉGRAL (toute la fiche, point par point) ou PARTIEL
// (les thèmes de son choix : Magie, Remplissage, Règles, Dés, Forge, Notes,
// Cartes de héros). Chaque étape éclaire un module, explique à quoi il sert
// et donne un exemple concret. On peut passer l'explication en cours ou
// quitter la visite à tout moment ; la progression est gardée.
//
// Récompense : deux styles de carte de héros gagnés en chemin — « Explorateur »
// après trois thèmes découverts, « Cartographe » quand les sept l'ont été.
// Ils passent par les exploits du compte (exploits.js) et suivent le joueur
// d'un appareil à l'autre.
//
// Ouverture : menu ☰ → Aide & raccourcis → « Découvrir la fiche »
// (tout bouton [data-discover]), ou window.Discover.open().
// =====================================================
(function () {
    'use strict';

    const DONE_KEY = 'dnd-discover-themes';      // { thème: date } — pour tout le compte
    const OFFER_KEY = 'dnd-discover-offered';
    const REWARDS = [
        { exploit: 'decouverte-1', need: 3, icon: '🧭', nom: 'Explorateur', label: 'Trois thèmes découverts' },
        { exploit: 'decouverte-2', need: 7, icon: '🗺️', nom: 'Cartographe', label: 'Les sept thèmes découverts' }
    ];

    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const toast = (m) => { if (window.showAppToast) window.showAppToast(m); };
    const onSheet = () => { const app = $('app-screen'); return !!app && !app.classList.contains('hidden'); };
    const visible = (el) => !!(el && el.getClientRects().length);

    // `sel` : ce que l'étape éclaire (rien = bulle centrée).
    const THEMES = [
        {
            id: 'remplissage', icon: '✍️', title: 'Remplissage',
            pitch: 'Identité, caractéristiques, sac, capacités, assistant.',
            steps: [
                { sel: '.sheet-header', title: 'L’identité du héros',
                  text: 'Nom, niveau, classe, sous-classe, race et historique. Tout s’enregistre pendant que tu écris : il n’y a pas de bouton « Sauvegarder ».',
                  example: 'Écris « Guerrier » dans Classe : la montée de niveau saura quelles aptitudes te proposer.' },
                { sel: '#btn-level-up', title: 'Monter de niveau',
                  text: 'Le bouton ▲ fait passer au niveau suivant et annonce ce que tu gagnes : points de vie, aptitudes, emplacements de sorts.',
                  example: 'Au niveau 3, un Guerrier y choisit sa sous-classe parmi celles connues.' },
                { sel: '#widget-stats', title: 'Caractéristiques & compétences',
                  text: 'Saisis les valeurs : modificateurs et compétences se calculent seuls. Le rond devant une compétence passe de ○ à ● (maîtrise) puis ★ (expertise).',
                  example: 'Dextérité 16 donne +3. Avec la maîtrise en Discrétion au niveau 1, la compétence affiche +5.' },
                { sel: '#widget-inventory', title: 'Le sac à dos',
                  text: 'La ligne du haut ajoute un objet en un geste. Taper le début d’un nom propose les objets des règles, avec poids, prix et description.',
                  example: 'Tape « Corde » puis ＋ : elle arrive dans le sac avec son poids. Le crayon ✎ ouvre sa fiche complète.' },
                { sel: '#widget-traits', title: 'Capacités & dons',
                  text: 'Tes aptitudes de classe, traits d’espèce et dons, chacun avec sa description dépliable. L’assistant et la montée de niveau les ajoutent pour toi.',
                  example: '« Second souffle » du Guerrier : une ligne, et sa règle à portée de clic en pleine partie.' },
                { sel: '#btn-settings-toggle', title: 'L’assistant de création',
                  text: 'Menu ☰ → Aide & raccourcis → « Relancer l’assistant » : il reprend la fiche pas à pas, du nom jusqu’à la magie.',
                  example: 'Choisis Magicien puis Elfe : il propose l’équipement de départ, les sorts et remplit les capacités.' }
            ]
        },
        {
            id: 'des', icon: '🎲', title: 'Dés',
            pitch: 'Lancer d’un clic, plateau, formules, macros.',
            steps: [
                { sel: '#widget-stats', title: 'Tout ce qui se clique se lance',
                  text: 'Clique sur le NOM d’une caractéristique, d’une compétence ou d’un jet de sauvegarde : le d20 roule en 3D avec le bon modificateur.',
                  example: 'Clic sur « Perception » à +5 : 1d20 + 5, et le détail rejoint l’historique des jets.' },
                { sel: '#btn-toggle-dice', title: 'Le plateau de dés',
                  text: 'Le bouton 🎲 ouvre le plateau : compose une poignée de dés, choisis Normal, Avantage ou Désavantage, puis lance. Le bouton se déplace où tu veux.',
                  example: 'Avec l’Avantage, deux d20 partent : le meilleur est gardé, l’autre barré.' },
                { sel: '#widget-calculator', title: 'Le lanceur d’expression',
                  text: 'Écris n’importe quelle formule, avec plusieurs sortes de dés et des modificateurs.',
                  example: '« 8d6 » pour une boule de feu, « 1d8+2d6+3 » pour une attaque sournoise.' },
                { sel: '#widget-macros', title: 'Les macros',
                  text: 'Enregistre une formule que tu relances souvent : elle devient un bouton.',
                  example: 'Macro « Châtiment » = 2d8 : un clic à chaque coup qui touche.' },
                { sel: '#widget-hp', title: 'Jets contre la mort',
                  text: 'À 0 point de vie, clique sur « Jets contre la mort » : le d20 est lancé, il ne reste qu’à cocher succès ou échecs.',
                  example: 'Un 20 naturel te relève avec 1 point de vie.' }
            ]
        },
        {
            id: 'forge', icon: '⚒️', title: 'Forge',
            pitch: 'Armes, attaques, armure et CA, bourse.',
            steps: [
                { sel: '#widget-attacks', title: 'Armes & attaques',
                  text: 'Chaque arme devient un bouton : un clic enchaîne le jet pour toucher et les dégâts, doublés tout seuls sur un critique.',
                  example: 'Épée longue à +5 : clic sur son nom, 1d20 + 5 puis 1d8 + 3 tranchants.' },
                { sel: '#btn-open-attack-modal', title: 'Forger une arme',
                  text: '« ➕ Ajouter » ouvre la forge : cherche une arme des règles, et dégâts, portée, propriétés et botte d’arme se remplissent. Tu peux aussi partir de zéro.',
                  example: 'Tape « Rapière » : 1d8 perforants, Finesse, botte Ouverture. Rends-la magique à +1.' },
                { sel: '.ac-cell', title: 'Armure & classe d’armure',
                  text: 'Le bouton 🛡️ CA ouvre le widget d’armure : ajoute tes armures, porte-en une, et la CA se calcule avec ta Dextérité. Armure magique, résistances et immunités y ont leur place.',
                  example: 'Cotte de mailles (16) et bouclier (+2) : CA 18, écrite toute seule sur la fiche.' },
                { sel: '#widget-currency', title: 'La bourse',
                  text: 'Tes pièces, du cuivre au platine. Ajoute ou paye un montant, puis « Convertir » regroupe la bourse dans la monnaie de ton choix.',
                  example: 'Tu vends un butin 45 po : « Ajouter », 45, PO, et le total se met à jour.' }
            ]
        },
        {
            id: 'magie', icon: '✨', title: 'Magie',
            pitch: 'Grimoire, emplacements, concentration, repos.',
            steps: [
                { sel: '#widget-magic', title: 'Le grimoire',
                  text: 'Ouvre le livre pour ajouter tes sorts : la recherche des règles remplit niveau, portée, durée, composantes et description. Prépare-les d’un clic.',
                  example: 'Ajoute « Projectile magique » : tout arrive seul, prêt à être lancé.' },
                { sel: '#spell-slots-grid', title: 'Les emplacements de sorts',
                  text: 'Chaque pastille est un emplacement : un clic le dépense, le repos long les rend. « ⚙️ Gérer » règle leur nombre.',
                  example: 'Magicien de niveau 3 : quatre emplacements du 1er niveau et deux du 2e.' },
                { sel: '#widget-concentration', title: 'La concentration',
                  text: 'Coche « Active » quand tu maintiens un sort : l’écran s’illumine pour ne pas l’oublier. Le titre lance le jet de Constitution.',
                  example: 'Tu subis 22 dégâts pendant « Bénédiction » : jet de Constitution DD 11 pour la garder.' },
                { sel: '#widget-abilities', title: 'Les capacités limitées',
                  text: 'Rage, Conduit divin, Inspiration bardique… Chaque utilisation se coche et revient au repos indiqué.',
                  example: 'Rage 3 fois par repos long : trois cases, rendues au réveil.' },
                { sel: '#widget-rests', title: 'Les repos',
                  text: 'Repos court : on dépense des dés de vie. Repos long : points de vie, emplacements et capacités reviennent.',
                  example: 'Repos court avec deux dés de vie d10 et Constitution +2 : 2d10 + 4 points de vie.' }
            ]
        },
        {
            id: 'regles', icon: '📖', title: 'Règles',
            pitch: 'Recherche, états, base de règles, contenu perso.',
            steps: [
                { sel: '#btn-global-search-trigger', title: 'La recherche',
                  text: 'La loupe fouille ta fiche et toute la base de règles : sorts, monstres, objets, états.',
                  example: 'Cherche « Agrippé » : la définition s’ouvre sans quitter la fiche.' },
                { sel: '#conditions-track-container', title: 'Les états',
                  text: 'Coche un état subi par ton personnage : un voile coloré te le rappelle à l’écran tant qu’il dure.',
                  example: 'Empoisonné : un voile vert, jusqu’à ce que tu décoches la case.' },
                { title: 'Les règles du jeu',
                  text: 'Depuis l’accueil, « 📖 Règles du jeu » ouvre la base complète, en édition 2014 ou 2024 : filtres, vue tableau, fiches détaillées.',
                  example: 'Les sorts de Magicien de niveau 3, triés par école, en deux clics.' },
                { title: 'Mon contenu',
                  text: 'Dans les règles, « ✍️ Mon contenu » crée tes classes, espèces, sorts, objets et monstres. Ils apparaissent ensuite partout, comme le contenu officiel.',
                  example: 'Copie le Guerrier, renomme-le « Chevalier-mage » et ajoute ses aptitudes : l’assistant le proposera.' }
            ]
        },
        {
            id: 'notes', icon: '📜', title: 'Notes',
            pitch: 'Quêtes, PNJ, notes rapides, journal, histoire.',
            steps: [
                { sel: '#widget-quests', title: 'Quêtes & PNJ',
                  text: 'Garde la trace des quêtes en cours et des personnages rencontrés.',
                  example: 'Quête « Les disparus de la route de l’Est », PNJ « Maître Orin, forgeron ».' },
                { sel: '#widget-notes', title: 'Notes rapides',
                  text: 'Des cartes courtes pour ce qui doit rester sous les yeux. Attrape une carte par son en-tête pour la déplacer.',
                  example: '« Mot de passe de la guilde : Corbeau d’argent. »' },
                { sel: '#btn-open-journal', title: 'Le journal',
                  text: 'Le récit de tes séances, chapitre par chapitre, avec mise en forme. « 📕 Ouvrir » le feuillette comme un livre.',
                  example: 'Chapitre 3, « Rencontre avec le Roi », écrit à la fin de la séance.' },
                { sel: '#widget-appearance', title: 'Identité & histoire',
                  text: 'Portrait, alignement, langues, apparence et histoire : le cœur roleplay du personnage.',
                  example: 'Recadre le portrait : il sert aussi sur la carte de héros.' }
            ]
        },
        {
            id: 'cartes', icon: '🃏', title: 'Cartes de héros',
            pitch: 'Ta carte à partager et ses styles à gagner.',
            steps: [
                { sel: '#btn-hero-card', title: 'Ta carte de héros',
                  text: 'Une image de ton personnage à partager : portrait, caractéristiques, classe et niveau mis en scène.',
                  example: 'Exporte-la en image pour la poster sur le salon de ta table.' },
                { title: 'Des styles à gagner',
                  text: 'Chaque style de carte se débloque par un exploit, pour tous tes personnages. Les indices t’attendent dans l’atelier de la carte.',
                  example: 'Style « Légende » : trois 20 naturels d’affilée.' },
                { sel: '#btn-settings-toggle', title: 'Où la retrouver',
                  text: 'Menu ☰ → Ma fiche → « Créer ma carte de héros », ou le bouton 🃏 du module Identité.',
                  example: 'Cette visite t’en offre deux : Explorateur et Cartographe.' }
            ]
        }
    ];
    const ORDER = THEMES.map(t => t.id);

    // ---------- Progression ----------
    function done() {
        try { const o = JSON.parse(localStorage.getItem(DONE_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; }
        catch (e) { return {}; }
    }
    const doneCount = () => ORDER.filter(id => done()[id]).length;
    function markDone(id) {
        const o = done();
        if (!o[id]) { o[id] = Date.now(); try { localStorage.setItem(DONE_KEY, JSON.stringify(o)); } catch (e) {} }
        return doneCount();
    }
    const won = (r) => !!(window.Exploits && window.Exploits.a(r.exploit));

    // =====================================================
    // LA FENÊTRE DE CHOIX
    // =====================================================
    let modal = null;
    function buildModal() {
        if (modal) return;
        modal = document.createElement('div');
        modal.id = 'discover-modal';
        modal.className = 'modal-overlay hidden no-print';
        modal.innerHTML = `
            <div class="modal-box dc-box" role="dialog" aria-modal="true" aria-labelledby="dc-title">
                <div class="modal-header">
                    <h2 id="dc-title">🧭 Découvrir la fiche</h2>
                    <button type="button" class="btn-close-modal" data-dc="close" aria-label="Fermer">✕</button>
                </div>
                <div class="dc-body"></div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) { close(); return; }
            const b = e.target.closest('[data-dc]');
            if (!b) return;
            if (b.dataset.dc === 'close') close();
            else if (b.dataset.dc === 'full') start('all');
            else if (b.dataset.dc === 'partial') {
                const ids = [...modal.querySelectorAll('[data-theme]:checked')].map(i => i.dataset.theme);
                if (ids.length) start(ids);
            }
        });
        modal.addEventListener('change', () => {
            const n = modal.querySelectorAll('[data-theme]:checked').length;
            const go = modal.querySelector('[data-dc="partial"]');
            if (go) { go.disabled = !n || !onSheet(); go.textContent = n ? `Lancer la visite (${n} thème${n > 1 ? 's' : ''})` : 'Choisis au moins un thème'; }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) close();
        });
    }

    function renderModal() {
        const d = done(), n = doneCount();
        const steps = THEMES.reduce((s, t) => s + t.steps.length, 0);
        const sheet = onSheet();
        modal.querySelector('.dc-body').innerHTML = `
            <p class="dc-intro">Une visite guidée, module par module, avec un exemple concret à chaque étape.
                Tu peux passer une explication ou quitter quand tu veux : ta progression est gardée.</p>
            <div class="dc-paths">
                <button type="button" class="dc-path" data-dc="full"${sheet ? '' : ' disabled'}>
                    <span class="dc-path-ico" aria-hidden="true">🗺️</span>
                    <b>Visite intégrale</b>
                    <small>Toute la fiche, point par point : ${THEMES.length} thèmes, ${steps} étapes, quelques minutes.</small>
                </button>
                <div class="dc-path dc-partial">
                    <span class="dc-path-ico" aria-hidden="true">🧭</span>
                    <b>Visite partielle</b>
                    <small>Choisis les thèmes qui t’intéressent.</small>
                    <div class="dc-themes" role="group" aria-label="Thèmes">${THEMES.map(t => `
                        <label class="dc-theme" title="${esc(t.pitch)}"><input type="checkbox" data-theme="${t.id}">
                            <span>${t.icon} ${esc(t.title)}</span>${d[t.id] ? '<span class="dc-done" aria-label="déjà découvert">✓</span>' : ''}</label>`).join('')}
                    </div>
                    <button type="button" class="dt-btn dt-primary dc-go" data-dc="partial" disabled>Choisis au moins un thème</button>
                </div>
            </div>
            ${sheet ? '' : '<p class="dc-note">Ouvre une fiche de personnage pour lancer la visite.</p>'}
            <div class="dc-rewards">
                <h3>🃏 Deux cartes de héros à gagner</h3>
                ${REWARDS.map(r => `
                    <div class="dc-reward${won(r) ? ' is-won' : ''}">
                        <span class="dc-reward-ico" aria-hidden="true">${r.icon}</span>
                        <div><b>Style « ${esc(r.nom)} »</b><small>${esc(r.label)}</small></div>
                        <span class="dc-reward-state">${won(r) ? '✅ Gagnée' : `🔒 ${Math.min(n, r.need)} / ${r.need}`}</span>
                    </div>`).join('')}
                <div class="dc-meter" role="progressbar" aria-valuemin="0" aria-valuemax="${THEMES.length}" aria-valuenow="${n}" aria-label="Thèmes découverts"><i style="width:${Math.round(n / THEMES.length * 100)}%"></i></div>
            </div>`;
    }

    function open() {
        buildModal();
        document.getElementById('settings-dropdown')?.classList.add('hidden');
        $('discover-offer')?.remove();
        renderModal();
        modal.classList.remove('hidden');
        setTimeout(() => modal.querySelector('.dc-path')?.focus({ preventScroll: true }), 60);
    }
    function close() { if (modal) modal.classList.add('hidden'); }

    // =====================================================
    // LA VISITE
    // =====================================================
    let tour = null;       // { steps, i }

    function buildSteps(ids, integral) {
        const steps = [];
        if (integral) {
            steps.push({ icon: '🧭', title: 'Bienvenue sur ta fiche',
                text: 'Chaque étape éclaire un module et montre à quoi il sert. « Passer l’explication » saute l’étape en cours, « Quitter le tutoriel » arrête la visite : ta progression est gardée.',
                example: 'Au clavier : → pour avancer, ← pour revenir, Échap pour quitter.' });
        }
        ids.forEach(id => {
            const t = THEMES.find(x => x.id === id);
            t.steps.forEach((s, k) => steps.push(Object.assign({ theme: t, n: k + 1, of: t.steps.length, last: k === t.steps.length - 1 }, s)));
        });
        steps.push({ outro: true });
        return steps;
    }

    function start(ids) {
        if (!onSheet()) { toast('Ouvre une fiche de personnage pour lancer la visite.'); return; }
        const integral = ids === 'all';
        const list = integral ? ORDER.slice() : ORDER.filter(x => ids.includes(x));
        if (!list.length) return;
        close();
        document.getElementById('settings-dropdown')?.classList.add('hidden');
        $('discover-offer')?.remove();
        try { localStorage.setItem(OFFER_KEY, '1'); } catch (e) {}
        tour = { steps: buildSteps(list, integral), i: 0 };
        let ov = $('discover-tour');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'discover-tour';
            ov.className = 'no-print';
            ov.innerHTML = '<div class="dt-spot is-none"></div><div class="dt-card" role="dialog" aria-modal="false" aria-live="polite"></div>';
            document.body.appendChild(ov);
            ov.addEventListener('click', onTourClick);
        }
        document.addEventListener('keydown', onTourKey, true);
        window.addEventListener('resize', onResize);
        show();
    }

    function end() {
        tour = null;
        document.removeEventListener('keydown', onTourKey, true);
        window.removeEventListener('resize', onResize);
        $('discover-tour')?.remove();
    }

    function onTourKey(e) {
        if (!tour) return;
        if (e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    }
    let resizeTimer = null;
    function onResize() { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (tour) show(); }, 150); }

    function onTourClick(e) {
        const b = e.target.closest('[data-dt]');
        if (!b || !tour) return;
        const act = b.dataset.dt;
        if (act === 'quit') end();
        else if (act === 'prev') prev();
        else if (act === 'next' || act === 'skip') next();
        else if (act === 'card') { end(); if (window.HeroCard) window.HeroCard.open(); }
    }

    function next() {
        const st = tour.steps[tour.i];
        if (st && st.theme && st.last) {
            const n = markDone(st.theme.id);
            // Les récompenses tombent en chemin, dans la visite elle-même.
            REWARDS.filter(r => n >= r.need && !won(r)).forEach((r, k) => {
                if (window.Exploits) window.Exploits.debloquer(r.exploit, { silencieux: true });
                tour.steps.splice(tour.i + 1 + k, 0, { reward: r });
            });
        }
        if (st && st.outro) { end(); return; }
        tour.i = Math.min(tour.i + 1, tour.steps.length - 1);
        show();
    }
    function prev() {
        if (tour.i <= 0) return;
        tour.i--;
        show();
    }

    /** L'élément à éclairer, rendu visible (section mobile, module replié). */
    function target(st) {
        if (!st.sel) return null;
        let el = document.querySelector(st.sel);
        if (!el) return null;
        const sec = el.closest('.mob-section');
        if (sec && document.body.classList.contains('mobile-sheet') && window.__switchMobileTab) window.__switchMobileTab(sec.dataset.msec);
        if (!visible(el)) {
            const w = el.closest('.draggable-widget');
            el = visible(w) ? w : null;
        }
        return el;
    }

    function cardHtml(st) {
        const total = tour.steps.length;
        const progress = `<div class="dt-bar"><i style="width:${Math.round((tour.i + 1) / total * 100)}%"></i></div>`;
        const back = tour.i > 0 ? '<button type="button" class="dt-btn dt-ghost" data-dt="prev" aria-label="Étape précédente">←</button>' : '';
        const quitX = '<button type="button" class="dt-x" data-dt="quit" aria-label="Quitter le tutoriel" title="Quitter le tutoriel">✕</button>';

        if (st.reward) {
            const r = st.reward;
            return `<div class="dt-top"><span class="dt-theme">🃏 Récompense</span>${quitX}</div>
                <div class="dt-reward"><span class="dt-reward-ico" aria-hidden="true">${r.icon}</span>
                    <div><b>Style « ${esc(r.nom)} » débloqué !</b><small>${esc(r.label)}. Il t’attend dans l’atelier de la carte de héros, pour tous tes personnages.</small></div></div>
                ${progress}
                <div class="dt-btns">${back}<button type="button" class="dt-btn" data-dt="card">🃏 Voir ma carte</button>
                    <button type="button" class="dt-btn dt-primary" data-dt="next">Continuer →</button></div>`;
        }
        if (st.outro) {
            const n = doneCount();
            return `<div class="dt-top"><span class="dt-theme">🎉 Visite terminée</span>${quitX}</div>
                <h3 class="dt-title">Bravo, aventurier !</h3>
                <p class="dt-text">${n} thème${n > 1 ? 's' : ''} sur ${THEMES.length} découvert${n > 1 ? 's' : ''}.
                    ${n < THEMES.length ? 'Les autres t’attendent dans « Découvrir la fiche », avec les cartes qui restent à gagner.' : 'Toute la fiche est à toi.'}</p>
                <div class="dt-rewards-mini">${REWARDS.map(r => `<span class="${won(r) ? 'is-won' : ''}">${won(r) ? r.icon : '🔒'} ${esc(r.nom)}</span>`).join('')}</div>
                ${progress}
                <div class="dt-btns">${back}<button type="button" class="dt-btn dt-primary" data-dt="next">Terminer ✓</button></div>`;
        }
        const t = st.theme;
        return `<div class="dt-top">
                <span class="dt-theme">${t ? `${t.icon} ${esc(t.title)}` : `${st.icon || '🧭'} Découverte`}</span>
                ${t ? `<span class="dt-count">${st.n} / ${st.of}</span>` : ''}
                ${quitX}
            </div>
            <h3 class="dt-title">${esc(st.title)}</h3>
            <p class="dt-text">${esc(st.text)}</p>
            ${st.example ? `<div class="dt-example"><span>Exemple</span><p>${esc(st.example)}</p></div>` : ''}
            ${progress}
            <div class="dt-btns">${back}
                <button type="button" class="dt-btn" data-dt="skip">Passer l’explication</button>
                <button type="button" class="dt-btn dt-primary" data-dt="next">${st.theme && st.last ? 'Thème suivant →' : 'Suivant →'}</button>
            </div>
            <button type="button" class="dt-quit" data-dt="quit">Quitter le tutoriel</button>`;
    }

    function show() {
        const ov = $('discover-tour');
        if (!tour || !ov) return;
        const st = tour.steps[tour.i];
        const spot = ov.querySelector('.dt-spot'), card = ov.querySelector('.dt-card');
        const el = target(st);
        let r = null;
        if (el) {
            try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) {}
            r = el.getBoundingClientRect();
        }
        spot.classList.toggle('is-none', !r);
        if (r) {
            const pad = 6;
            Object.assign(spot.style, {
                left: (r.left - pad) + 'px', top: (r.top - pad) + 'px',
                width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px'
            });
        }
        card.innerHTML = cardHtml(st);

        // Bulle à côté de la cible sans déborder, sinon centrée.
        const vw = window.innerWidth, vh = window.innerHeight;
        const cw = card.offsetWidth, ch = card.offsetHeight, M = 14;
        let cx = (vw - cw) / 2, cy = (vh - ch) / 2;
        if (r) {
            if (r.right + M + cw <= vw - 8) { cx = r.right + M; cy = r.top; }
            else if (r.left - M - cw >= 8) { cx = r.left - M - cw; cy = r.top; }
            else if (r.bottom + M + ch <= vh - 8) { cx = r.left; cy = r.bottom + M; }
            else if (r.top - M - ch >= 8) { cx = r.left; cy = r.top - M - ch; }
            else { cy = vh - ch - 8; }
        }
        card.style.left = Math.max(8, Math.min(cx, vw - cw - 8)) + 'px';
        card.style.top = Math.max(8, Math.min(cy, vh - ch - 8)) + 'px';
        setTimeout(() => card.querySelector('[data-dt="next"]')?.focus({ preventScroll: true }), 30);
    }

    // =====================================================
    // L'INVITATION — une seule fois, à la première fiche ouverte
    // =====================================================
    function offer() {
        if (!onSheet() || tour || $('discover-offer') || $('pj-wizard')) return;
        try {
            if (localStorage.getItem(OFFER_KEY) || localStorage.getItem('dnd-pj-tuto-done')) return;
            localStorage.setItem(OFFER_KEY, '1');
        } catch (e) { return; }
        const b = document.createElement('div');
        b.id = 'discover-offer';
        b.className = 'no-print';
        b.setAttribute('role', 'status');
        b.innerHTML = `<span class="do-ico" aria-hidden="true">🧭</span>
            <span class="do-txt"><b>Première visite ?</b> Découvre la fiche en quelques minutes : deux cartes de héros à gagner.</span>
            <button type="button" class="dt-btn dt-primary" data-do="go">Découvrir</button>
            <button type="button" class="dt-btn dt-ghost" data-do="later">Plus tard</button>`;
        document.body.appendChild(b);
        b.addEventListener('click', (e) => {
            const x = e.target.closest('[data-do]');
            if (!x) return;
            b.remove();
            if (x.dataset.do === 'go') open();
        });
    }

    document.addEventListener('click', (e) => {
        const b = e.target.closest('[data-discover]');
        if (!b) return;
        e.preventDefault();
        open();
    });
    document.addEventListener('DOMContentLoaded', () => { setTimeout(offer, 1800); });

    window.Discover = { open, close, start, offer, THEMES, REWARDS };
    // Compatibilité : d'anciens liens appelaient window.Help.open(sujet).
    window.Help = { open: () => open(), close };
})();
