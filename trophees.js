// =====================================================
// trophees.js — la salle des trophées (LOT 8.2) et le défi du mois (LOT 8.3)
//
// Chargé à la demande : par le menu ☰ ou le bouton de l'accueil, et par
// l'accueil lui-même, qui montre la carte du défi du mois une fois affiché.
//
// La salle montre :
//   · le défi du mois et sa progression (exploits-suivi.js, `Defis`) ;
//   · chaque secret, trouvé (nom, date) ou « ??? » avec un indice vague. Aucune
//     condition exacte : un indice reste une devinette ;
//   · les compteurs au long cours, tenus sur cet appareil (`dnd-compteurs`) ;
//   · le chemin vers la vitrine des styles, le parrainage et le cimetière.
// Les registres vivent dans exploits.js (`Exploits.trouver`, `Exploits.defi`) :
// ce fichier ne fait que les lire.
// =====================================================
(function () {
    'use strict';

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const $ = (id) => document.getElementById(id);
    const E = () => window.Exploits || null;

    // =====================================================
    // LE CATALOGUE DES SECRETS
    // `exploit` : le secret se lit dans le registre des exploits. Sinon, dans le
    // registre des secrets, sous son id ou sous l'une de ses `variantes`.
    // =====================================================
    const SECRETS = [
        { id: 'triple20', exploit: 'triple20', icone: '👑', nom: 'Les dieux te regardent', indice: 'Les dieux aiment les séries.' },
        { id: 'triple1', exploit: 'triple1', icone: '☠️', nom: 'Ton d20 est maudit', indice: 'Les dés, eux aussi, savent haïr.' },
        { id: 'epique', exploit: 'epique', icone: '⚜️', nom: 'Héros épique', indice: 'Le sommet d’une carrière.' },
        { id: 'revenant', exploit: 'revenant', icone: '💀', nom: 'La Mort t’a recraché', indice: 'Frôler la mort… et refuser.' },
        { id: 'nuit-blanche', exploit: 'nuit-blanche', icone: '🌙', nom: 'Nuit blanche', indice: 'Les bardes dorment. Toi, non.' },
        { id: 'astral', exploit: 'astral', icone: '🌌', nom: 'Faille astrale', indice: 'Certains sacs n’aiment pas être rangés ensemble.' },
        { id: 'tarasque', exploit: 'tarasque', icone: '🦖', nom: 'Pas de géant', indice: 'Le plus grand monstre des règles.' },
        { id: 'cube', exploit: 'cube', icone: '🧊', nom: 'Gelée tremblante', indice: 'Un monstre qu’on voit à travers.' },
        { id: 'generique', exploit: 'generique', icone: '🎬', nom: 'Générique de fin', indice: 'Tout film a une fin.' },
        { id: 'dragon', exploit: 'dragon', icone: '🐉', nom: 'L’œil du dragon', indice: 'Une fortune qui attire les regards.' },
        { id: 'konami', exploit: 'konami', icone: '🧟', nom: 'Mode Liche', indice: 'Un vieux code de joueur.' },
        { id: 'crane7', exploit: 'crane7', icone: '🤭', nom: 'Crâne chatouilleux', indice: 'Le crâne de l’accueil a ses faiblesses.' },
        { id: 'pleine-lune', exploit: 'pleine-lune', icone: '🌕', nom: 'Nuit de pleine lune', indice: 'Quand la lune est ronde…' },
        { id: 'vendredi13', exploit: 'vendredi13', icone: '🪞', nom: 'Vendredi 13', indice: 'Un jour où il vaut mieux ne pas sortir.' },
        { id: 'mimique', exploit: 'mimique', icone: '📦', nom: 'C’était une Mimique !', indice: 'Méfie-toi de ce que tu cherches dans les règles.' },
        { id: 'onglet', icone: '⏳', nom: 'Héros impatient', indice: 'Il n’aime pas qu’on le laisse seul.' },
        { id: 'toiles', icone: '🕸️', nom: 'Toiles d’araignée', indice: 'Une nuit d’automne, les araignées s’invitent.' },
        { id: 'poisson', icone: '🐟', nom: 'Poisson de parchemin', indice: 'Un jour où rien n’est sérieux. Regarde bien partout.' },
        { id: 'noms', icone: '📛', nom: 'Registre des héros', indice: 'Certains noms ne passent pas inaperçus.',
          variantes: ['nom:bob', 'nom:personne', 'nom:merlin', 'nom:kevin', 'nom:jean-michel', 'nom:gerard', 'nom:brigitte', 'nom:jean-claude'] },
        { id: 'un-pv', icone: '🪦', nom: 'Épitaphe en préparation', indice: 'Au bord du gouffre.' },
        { id: 'corde', icone: '🪢', nom: 'Fierté du MJ', indice: 'Tout aventurier prévoyant l’emporte.' },
        { id: 'poulet', icone: '🐔', nom: 'Évasion à plumes', indice: 'Certains passagers du sac ne tiennent pas en place.' },
        { id: 'quarante-deux', icone: '🌠', nom: 'La grande réponse', indice: 'Un nombre qui répond à tout.' },
        { id: 'averse', icone: '🎲', nom: 'Averse de dés', indice: 'Qui a dit qu’il fallait lancer peu de dés ?' },
        { id: 'centenaire', icone: '💯', nom: 'Centenaire', indice: 'Le plus gros dé, au plus haut.' },
        { id: 'iddqd', icone: '🛡️', nom: 'Mode dieu refusé', indice: 'Un vieux code, venu d’un autre genre de jeu.' },
        { id: 'tarte', icone: '🥧', nom: 'Splotch', indice: 'Ce qui est fragile n’aime pas le sac.' },
        { id: 'sac', icone: '🧦', nom: 'Inventaire douteux', indice: 'Le sac accepte tout. Il commente aussi.',
          variantes: ['sac:chaussette', 'sac:ketchup', 'sac:mayonnaise', 'sac:baguette'] },
        { id: 'sac-flotte', icone: '🎈', nom: 'Sac aérostatique', indice: 'Défier la pesanteur, objet par objet.' },
        { id: 'diagnostics', icone: '🩺', nom: 'Diagnostics', indice: 'Une fiche au plus bas inquiète le médecin.',
          variantes: ['diagnostic:str', 'diagnostic:dex', 'diagnostic:con', 'diagnostic:int', 'diagnostic:wis', 'diagnostic:cha', 'diagnostic:vitesse', 'diagnostic:niveau0', 'diagnostic:niveau-negatif'] },
        { id: 'cri', icone: '📣', nom: 'Cri de guerre', indice: 'Certains textes se crient.' },
        { id: 'chat', icone: '🐈', nom: 'Intrusion féline', indice: 'Un visiteur à quatre pattes passe parfois par le clavier.' },
        { id: 'moutons', icone: '🐑', nom: 'Insomnie', indice: 'Compter, pour trouver le sommeil.' },
        { id: 'ronfle', icone: '😴', nom: 'Le héros s’assoupit', indice: 'Un héros qu’on néglige finit par piquer du nez.' },
        { id: 'ctrl-s', icone: '💾', nom: 'Jet de sauvegarde', indice: 'Un réflexe de bureau.' },
        { id: 'des', icone: '🕳️', nom: 'Dés impossibles', indice: 'Tous les dés n’existent pas.', variantes: ['de:0', 'de:1'] },
        { id: 'greve', icone: '🪧', nom: 'Syndicat des dés', indice: 'Même un d20 a ses limites.' }
    ];

    // Les compteurs au long cours (exploits-suivi.js) : un palier chacun.
    const COMPTEURS = [
        { cle: 'jets', icone: '🎲', nom: 'Jets de dés', objectif: 1000, exploit: 'jets1000' },
        { cle: 'nat20', icone: '✨', nom: '20 naturels', objectif: 50, exploit: 'nat20x50' },
        { cle: 'nat1', icone: '💥', nom: '1 naturels', objectif: 50, exploit: 'nat1x50' },
        { cle: 'soins', icone: '💗', nom: 'PV soignés', objectif: 500, exploit: 'soigneur' },
        { cle: 'degats', icone: '🛡️', nom: 'Dégâts encaissés', objectif: 1000, exploit: 'increvable' },
        { cle: 'reposLongs', icone: '🌙', nom: 'Repos longs', objectif: 25, exploit: 'dormeur' },
        { cle: 'reposCourts', icone: '🔥', nom: 'Repos courts', objectif: 25, exploit: 'feudecamp' },
        { cle: 'regles', icone: '📖', nom: 'Fiches de règles lues', objectif: 100, exploit: 'erudit' },
        { cle: 'monstres', icone: '👹', nom: 'Créatures différentes consultées', objectif: 30, exploit: 'bestiaire', liste: true },
        { cle: 'inspirations', icone: '⭐', nom: 'Inspirations reçues', objectif: 20, exploit: 'inspire' },
        { cle: 'boulesDeFeu', icone: '☄️', nom: 'Boules de feu lancées', objectif: 10, exploit: 'pyromane' },
        { cle: 'jours', icone: '📆', nom: 'Jours de visite', objectif: 30, exploit: 'fidele30', liste: true }
    ];

    // =====================================================
    // CE QUE DISENT LES REGISTRES
    // =====================================================
    const FORMAT_DATE = { day: 'numeric', month: 'long', year: 'numeric' };
    /** Un jour du registre des secrets (jours depuis 1970, comptés en UTC) en date lisible. */
    const dateDuJour = (j) => new Date(j * 86400000).toLocaleDateString('fr-FR', Object.assign({ timeZone: 'UTC' }, FORMAT_DATE));
    const dateExploit = (ms) => new Date(ms).toLocaleDateString('fr-FR', FORMAT_DATE);
    const nomDuMois = (cle) => { const [a, m] = cle.split('-').map(Number); return new Date(a, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); };

    function etatSecret(s) {
        const ex = E();
        if (s.exploit) {
            const info = ex ? ex.info(s.exploit) : null;
            return { id: s.id, trouve: !!(info && info.date), date: info && info.date ? dateExploit(info.date) : '' };
        }
        const reg = ex && ex.secrets ? ex.secrets() : {};
        const cles = s.variantes || [s.id];
        const jours = cles.map(k => parseInt(reg[k], 10)).filter(j => j > 0);
        return {
            id: s.id, trouve: jours.length > 0, date: jours.length ? dateDuJour(Math.min(...jours)) : '',
            variantes: s.variantes ? { trouvees: jours.length, total: cles.length } : null
        };
    }
    function etatCompteurs() {
        let c = {};
        try { c = window.Compteurs ? window.Compteurs.lire() : JSON.parse(localStorage.getItem('dnd-compteurs') || '{}'); } catch (e) { c = {}; }
        const ex = E();
        return COMPTEURS.map(x => {
            const brut = c[x.cle];
            const n = x.liste ? (Array.isArray(brut) ? brut.length : 0) : (parseInt(brut, 10) || 0);
            return { cle: x.cle, n, objectif: x.objectif, atteint: n >= x.objectif || !!(ex && ex.a(x.exploit)) };
        });
    }
    /** Tout ce que montre la salle, sans le dessiner (les tests le lisent). */
    function etat() {
        const secrets = SECRETS.map(etatSecret);
        let styles = null;
        try { if (window.HeroCard && window.HeroCard.collection) { const col = window.HeroCard.collection(); styles = { gagnes: col.filter(x => x.gagne).length, total: col.length }; } } catch (e) {}
        return {
            secrets, trouves: secrets.filter(x => x.trouve).length, total: secrets.length,
            compteurs: etatCompteurs(), defi: window.Defis ? window.Defis.actuel() : null, styles
        };
    }

    // =====================================================
    // LE STYLE (porté par le module, comme dialogues.js)
    // =====================================================
    let stylesPoses = false;
    function poserStyles() {
        if (stylesPoses) return;
        stylesPoses = true;
        const s = document.createElement('style');
        s.id = 'trophees-styles';
        s.textContent = `
        .tr { display: flex; flex-direction: column; gap: 16px; }
        .tr-resume { margin: 0; font-style: italic; opacity: .85; }
        .tr-bloc { margin: 0; }
        .tr-bloc > h3 { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin: 0 0 8px; padding: 0 0 4px; border: 0; border-bottom: 1px solid rgba(122,40,40,.22);
            font-family: 'Cinzel', Georgia, serif; font-size: .95rem; letter-spacing: .03em; text-transform: none; color: var(--primary-color, #7A2828); background: none; }
        .tr-bloc > h3 small { font-family: 'Lora', Georgia, serif; font-size: .8rem; font-weight: 400; font-style: italic; color: inherit; opacity: .75; }
        .tr-barre { position: relative; height: 10px; border-radius: 999px; overflow: hidden; background: rgba(122,40,40,.14); box-shadow: inset 0 1px 2px rgba(0,0,0,.18); }
        .tr-barre > i { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: linear-gradient(90deg, #b8862c, #e8c16a); transition: width .5s ease; }
        .tr-barre.est-plein > i { background: linear-gradient(90deg, #3d7a3d, #7fbf6a); }
        .tr-defi { display: flex; gap: 12px; align-items: flex-start; padding: 12px; border-radius: 14px; border: 1px solid rgba(196,155,53,.55);
            background: linear-gradient(135deg, rgba(255,250,236,.75), rgba(240,226,190,.55)); }
        .tr-defi-ico { flex: 0 0 auto; font-size: 1.9rem; line-height: 1; }
        .tr-defi-corps { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
        .tr-defi-corps b { font-family: 'Cinzel', Georgia, serif; font-size: .92rem; }
        .tr-defi-corps p { margin: 0; }
        .tr-defi-corps small { font-size: .82rem; opacity: .85; }
        .tr-defi-ok { color: #2f6b2f; font-weight: 700; }
        .tr-reussis { margin: 6px 0 0; font-size: .82rem; opacity: .8; }
        .tr-secrets { display: grid; grid-template-columns: repeat(auto-fill, minmax(165px, 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none; }
        .tr-secret { display: grid; grid-template-columns: auto 1fr; column-gap: 8px; align-items: center; min-height: 52px; padding: 7px 9px; border-radius: 11px;
            border: 1px dashed rgba(122,40,40,.3); background: rgba(255,255,255,.3); }
        .tr-secret.est-trouve { border-style: solid; border-color: rgba(196,155,53,.6); background: rgba(255,248,225,.7); }
        .tr-secret .tr-ico { grid-row: span 2; font-size: 1.35rem; line-height: 1; }
        .tr-secret:not(.est-trouve) .tr-ico { filter: grayscale(1); opacity: .55; }
        .tr-secret b { font-family: 'Cinzel', Georgia, serif; font-size: .8rem; line-height: 1.25; }
        .tr-secret small { font-size: .76rem; line-height: 1.3; opacity: .8; }
        .tr-secret:not(.est-trouve) small { font-style: italic; }
        .tr-compteurs { display: flex; flex-direction: column; gap: 9px; margin: 0; padding: 0; list-style: none; }
        .tr-compteur { display: grid; grid-template-columns: auto 1fr auto; gap: 4px 8px; align-items: center; font-size: .86rem; }
        .tr-compteur .tr-barre { grid-column: 1 / -1; height: 7px; }
        .tr-compteur span:last-of-type { font-variant-numeric: tabular-nums; opacity: .85; }
        .tr-liens { display: flex; flex-wrap: wrap; gap: 8px; }
        .tr-liens .dlg-btn { flex: 1 1 180px; }
        .tr-note { margin: 4px 0 0; font-size: .8rem; font-style: italic; opacity: .75; }
        body.theme-dark .tr-bloc > h3 { color: var(--accent-color, #C49B35); border-color: rgba(196,155,53,.3); }
        body.theme-dark .tr-defi { background: linear-gradient(135deg, rgba(60,46,30,.8), rgba(36,28,20,.8)); border-color: rgba(196,155,53,.45); }
        body.theme-dark .tr-secret { background: rgba(255,255,255,.04); border-color: rgba(196,155,53,.25); }
        body.theme-dark .tr-secret.est-trouve { background: rgba(196,155,53,.12); }
        body.theme-dark .tr-barre { background: rgba(255,255,255,.1); }
        body.theme-dark .tr-defi-ok { color: #8fd18a; }

        .home-defi { display: flex; align-items: center; gap: 10px; width: 100%; margin-top: 10px; padding: 10px 12px; text-align: left; cursor: pointer; font: inherit; color: inherit;
            border-radius: var(--radius-sm, 12px); border: 1px solid rgba(196,155,53,.55); background: linear-gradient(135deg, rgba(255,250,236,.85), rgba(240,226,190,.6)); }
        .home-defi[hidden] { display: none; }
        .home-defi:hover { border-color: var(--accent-color, #C49B35); }
        .home-defi:focus-visible { outline: 2px solid var(--accent-color, #C49B35); outline-offset: 2px; }
        .home-defi-ico { font-size: 1.6rem; line-height: 1; }
        .home-defi-txt { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .home-defi-txt b { font-family: 'Cinzel', Georgia, serif; font-size: .82rem; }
        .home-defi-txt small { font-size: .78rem; opacity: .85; overflow-wrap: anywhere; }
        .home-defi .tr-barre { height: 6px; }
        body.theme-dark .home-defi { background: linear-gradient(135deg, rgba(60,46,30,.85), rgba(36,28,20,.85)); border-color: rgba(196,155,53,.4); }
        @media (prefers-reduced-motion: reduce) { .tr-barre > i { transition: none; } }
        @media print { .home-defi { display: none !important; } }`;
        document.head.appendChild(s);
    }

    const pourcent = (n, max) => Math.max(0, Math.min(100, Math.round((n / (max || 1)) * 100)));
    const nombre = (n) => Number(n).toLocaleString('fr-FR');
    function barre(n, max, libelle) {
        const plein = n >= max;
        return `<div class="tr-barre${plein ? ' est-plein' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${Math.min(n, max)}" aria-label="${esc(libelle)}"><i style="width:${pourcent(n, max)}%"></i></div>`;
    }

    // =====================================================
    // LA SALLE
    // =====================================================
    function blocDefi(d) {
        if (!d) return '';
        const f = d.defi, saison = window.Defis ? window.Defis.SAISONS[d.saison] : '';
        const styleGagne = !!(E() && E().a('saison-' + d.saison));
        const reussis = d.reussis.filter(m => m !== d.mois).slice(-6).reverse().map(nomDuMois);
        return `<section class="tr-bloc" aria-labelledby="tr-h-defi">
            <h3 id="tr-h-defi">Défi du mois <small>${esc(nomDuMois(d.mois))}</small></h3>
            <div class="tr-defi">
                <span class="tr-defi-ico" aria-hidden="true">${f.icone}</span>
                <div class="tr-defi-corps">
                    <b>${esc(f.titre)}</b>
                    <p>${esc(f.texte)}.</p>
                    ${barre(d.n, f.objectif, 'Progression du défi du mois')}
                    <small>${d.fini ? '<span class="tr-defi-ok">✓ Défi réussi</span>' : `${nombre(d.n)} / ${nombre(f.objectif)} ${esc(f.unite)}`}</small>
                    <small>${styleGagne
                        ? `Le style de carte « ${esc(saison)} » est déjà dans ta collection.`
                        : `Récompense : le style de carte « ${esc(saison)} », gagné pour toujours.`}</small>
                    ${reussis.length ? `<p class="tr-reussis">Défis réussis : ${reussis.map(esc).join(' · ')}</p>` : ''}
                </div>
            </div>
            <p class="tr-note">La progression suit ton compte, sur tous tes appareils.</p>
        </section>`;
    }

    function blocSecrets(e) {
        const lignes = SECRETS.map((s, i) => {
            const x = e.secrets[i];
            if (!x.trouve) {
                return `<li class="tr-secret"><span class="tr-ico" aria-hidden="true">🔒</span><b>???</b><small>${esc(s.indice)}</small></li>`;
            }
            const v = x.variantes ? ` · ${x.variantes.trouvees} / ${x.variantes.total}` : '';
            return `<li class="tr-secret est-trouve"><span class="tr-ico" aria-hidden="true">${s.icone}</span><b>${esc(s.nom)}</b><small>Trouvé le ${esc(x.date)}${v}</small></li>`;
        }).join('');
        return `<section class="tr-bloc" aria-labelledby="tr-h-secrets">
            <h3 id="tr-h-secrets">Secrets <small>${e.trouves} / ${e.total}</small></h3>
            <ul class="tr-secrets">${lignes}</ul>
        </section>`;
    }

    function blocCompteurs(e) {
        const lignes = COMPTEURS.map((c, i) => {
            const x = e.compteurs[i];
            return `<li class="tr-compteur"><span aria-hidden="true">${c.icone}</span><span>${esc(c.nom)}</span>`
                + `<span>${x.atteint ? '✓ ' : ''}${nombre(Math.min(x.n, c.objectif))} / ${nombre(c.objectif)}</span>`
                + barre(x.atteint ? c.objectif : x.n, c.objectif, c.nom) + '</li>';
        }).join('');
        return `<section class="tr-bloc" aria-labelledby="tr-h-compteurs">
            <h3 id="tr-h-compteurs">Au long cours <small>sur cet appareil</small></h3>
            <ul class="tr-compteurs">${lignes}</ul>
        </section>`;
    }

    const ficheOuverte = () => { const a = $('app-screen'); let id = ''; try { id = localStorage.getItem('dnd-active-char') || ''; } catch (e) {} return !!(a && !a.classList.contains('hidden') && id); };

    async function ouvrir() {
        if (!window.Dialogue) return;
        // La collection de styles (carte de héros) et les compteurs (suivi des
        // exploits) se chargent à la demande (LOT 10) : on les attend.
        try { await Promise.all([window.charger('carte-heros'), window.charger('secrets')]); } catch (e) {}
        poserStyles();
        const e = etat();
        const resume = [`${e.trouves} secret${e.trouves > 1 ? 's' : ''} sur ${e.total}`];
        if (e.styles) resume.push(`${e.styles.gagnes} style${e.styles.gagnes > 1 ? 's' : ''} de carte sur ${e.styles.total}`);
        let boite = null;
        const fermerPuis = (faire) => {
            const b = boite && boite.closest('.dlg');
            const valider = b && b.querySelector('[data-dlg="valider"]');
            if (valider) valider.click();
            setTimeout(faire, 60);
        };
        return window.Dialogue.fenetre({
            titre: 'Salle des trophées', icone: '🏆', large: true,
            confirmer: 'Fermer', annuler: null, annule: null,
            corps() {
                boite = document.createElement('div');
                boite.className = 'tr';
                const fiche = ficheOuverte();
                boite.innerHTML = `<p class="tr-resume">${esc(resume.join(' · '))}.</p>`
                    + blocDefi(e.defi) + blocSecrets(e) + blocCompteurs(e)
                    + `<section class="tr-bloc" aria-labelledby="tr-h-liens">
                        <h3 id="tr-h-liens">Et aussi</h3>
                        <div class="tr-liens">
                            <button type="button" class="dlg-btn dlg-secondaire" data-tr="vitrine"${fiche ? '' : ' disabled aria-describedby="tr-vitrine-note"'}>🃏 Vitrine des styles</button>
                            <button type="button" class="dlg-btn dlg-secondaire" data-tr="parrainage">🤝 Parrainer un ami</button>
                            <button type="button" class="dlg-btn dlg-secondaire" data-tr="cimetiere">🪦 Cimetière des héros</button>
                        </div>
                        ${fiche ? '' : '<p class="tr-note" id="tr-vitrine-note">Ouvre une fiche pour voir la vitrine des styles sur ton héros.</p>'}
                    </section>`;
                boite.addEventListener('click', (ev) => {
                    const b = ev.target.closest('[data-tr]');
                    if (!b || b.disabled) return;
                    const quoi = b.dataset.tr;
                    if (quoi === 'vitrine') fermerPuis(() => window.HeroCard && window.HeroCard.open());
                    else if (quoi === 'parrainage') fermerPuis(() => window.Parrainage && window.Parrainage.ouvrir());
                    else if (quoi === 'cimetiere') fermerPuis(() => window.Cimetiere && window.Cimetiere.ouvrir());
                });
                return boite;
            },
            resultat: () => true
        });
    }

    // =====================================================
    // L'ACCUEIL : la carte du défi du mois
    // =====================================================
    function accueil() {
        const panneau = $('home-panel-player');
        if (!panneau) return;
        // Le défi du mois vit dans exploits-suivi.js, chargé après le premier affichage.
        if (!window.Defis) { if (window.charger) window.charger('secrets').then(() => { if (window.Defis) accueil(); }).catch(() => {}); return; }
        poserStyles();
        let carte = $('home-defi');
        if (!carte) {
            carte = document.createElement('button');
            carte.type = 'button';
            carte.id = 'home-defi';
            carte.className = 'home-defi no-print';
            carte.addEventListener('click', () => ouvrir());
            const repere = $('home-actions') || $('btn-open-trophees') || $('btn-open-rules');
            if (repere && repere.parentNode === panneau) repere.insertAdjacentElement('afterend', carte);
            else panneau.appendChild(carte);
        }
        const d = window.Defis.actuel(), f = d.defi;
        const etatTexte = d.fini ? '✓ Réussi' : `${nombre(d.n)} / ${nombre(f.objectif)} ${f.unite}`;
        carte.setAttribute('aria-label', `Défi du mois : ${f.titre}, ${f.texte}. ${d.fini ? 'Réussi' : nombre(d.n) + ' sur ' + nombre(f.objectif)}. Ouvrir la salle des trophées.`);
        carte.innerHTML = `<span class="home-defi-ico" aria-hidden="true">${f.icone}</span>
            <span class="home-defi-txt"><b>Défi de ${esc(nomDuMois(d.mois).replace(/\s\d{4}$/, ''))} · ${esc(f.titre)}</b>
            ${barre(d.n, f.objectif, 'Progression du défi du mois')}
            <small>${esc(f.texte)} — ${esc(etatTexte)}</small></span>`;
        carte.hidden = false;
    }
    let minuteurAccueil = null;
    const rafraichir = () => {
        clearTimeout(minuteurAccueil);
        minuteurAccueil = setTimeout(() => { const h = $('home-screen'); if (h && !h.classList.contains('hidden')) accueil(); }, 150);
    };
    ['defi:progres', 'exploits:maj', 'secret:trouve'].forEach(ev => document.addEventListener(ev, rafraichir));
    document.addEventListener('screen:change', (ev) => { if (ev.detail && ev.detail.id === 'home-screen') rafraichir(); });

    window.Trophees = { ouvrir, accueil, etat, catalogue: () => SECRETS.map(s => Object.assign({}, s)) };
    rafraichir();
})();
