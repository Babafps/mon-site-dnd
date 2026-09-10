// =====================================================
// effets.js — les effets visuels de la fiche
//
// Deux familles, toutes deux déclenchées par TA fiche, sans réseau :
//   · RollFX : la pluie d'étincelles d'un 20 naturel, la secousse d'un 1, et le
//     secret des trois 20 naturels d'affilée ;
//   · les voiles d'état plein écran — empoisonné, aveuglé, effrayé, en feu,
//     étourdi, à terre — qui suivent les conditions cochées sur la fiche.
//
// Ils vivaient dans l'ancien module de partie en ligne, retiré du site ; ces
// effets, eux, servaient aussi en solo.
// Tout respecte prefers-reduced-motion.
// =====================================================
(function () {
    'use strict';

    const calme = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
    function injecter(css) { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }

    // ---------- 20 naturel / 1 naturel ----------
    let jetsStyles = false;
    function stylesJets() {
        if (jetsStyles) return; jetsStyles = true;
        injecter(`
        .rfx-burst { position: fixed; inset: 0; pointer-events: none; z-index: 100050; overflow: hidden; }
        .rfx-p { position: absolute; width: 10px; height: 10px; border-radius: 2px; opacity: .95; animation: rfxFall var(--d,1.6s) ease-out forwards; }
        @keyframes rfxFall { 0% { transform: translate(0,0) rotate(0deg); opacity: 1; } 100% { transform: translate(var(--dx,0), var(--dy,80vh)) rotate(var(--rot,540deg)); opacity: 0; } }
        .rfx-flash { position: fixed; inset: 0; pointer-events: none; z-index: 100049; background: radial-gradient(circle at 50% 45%, rgba(255,220,120,.4), rgba(255,220,120,0) 60%); animation: rfxFlash .9s ease-out forwards; }
        @keyframes rfxFlash { 0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; } }
        .rfx-fumble { position: fixed; inset: 0; pointer-events: none; z-index: 100049; box-shadow: inset 0 0 120px 30px rgba(160,20,20,.55); animation: rfxFlash 1.1s ease-out forwards; }
        body.rfx-shake { animation: rfxShake .5s ease-in-out; }
        @keyframes rfxShake { 0%,100% { transform: translate(0,0); } 20% { transform: translate(-7px,3px); } 40% { transform: translate(6px,-4px); } 60% { transform: translate(-5px,2px); } 80% { transform: translate(4px,-2px); } }`);
    }
    const OR = ['#f5c542', '#e2a13a', '#fff2b2', '#c49b35', '#ffdf7e'];

    function crit() {
        if (calme()) return;
        stylesJets();
        const gerbe = document.createElement('div'); gerbe.className = 'rfx-burst no-print';
        for (let i = 0; i < 26; i++) {
            const p = document.createElement('i'); p.className = 'rfx-p';
            p.style.left = (35 + Math.random() * 30) + '%';
            p.style.top = (30 + Math.random() * 12) + '%';
            p.style.background = OR[i % OR.length];
            p.style.setProperty('--dx', (Math.random() * 60 - 30) + 'vw');
            p.style.setProperty('--dy', (35 + Math.random() * 45) + 'vh');
            p.style.setProperty('--rot', Math.round(Math.random() * 900 - 450) + 'deg');
            p.style.setProperty('--d', (1.2 + Math.random() * 0.9) + 's');
            gerbe.appendChild(p);
        }
        const eclair = document.createElement('div'); eclair.className = 'rfx-flash no-print';
        document.body.appendChild(eclair); document.body.appendChild(gerbe);
        setTimeout(() => { gerbe.remove(); eclair.remove(); }, 2300);
    }

    function fumble() {
        if (calme()) return;
        stylesJets();
        const voile = document.createElement('div'); voile.className = 'rfx-fumble no-print';
        document.body.appendChild(voile);
        document.body.classList.add('rfx-shake');
        setTimeout(() => { voile.remove(); document.body.classList.remove('rfx-shake'); }, 1200);
    }

    // ---------- Chaque d20 naturel passe par ici ----------
    // Appelé par l'historique des jets de la fiche (script.js, pushRollHistory)
    // pour TOUT jet de d20 : caractéristique, sauvegarde, attaque, sort, d20
    // lancé seul sur le plateau. Un jet sans d20 (dégâts, expression) n'y vient pas.
    //
    // Le secret du site vit ici : trois 20 naturels d'affilée sur le même
    // personnage — une chance sur 8 000. Un autre d20 entre deux, et la série
    // repart de zéro. Elle vit dans sessionStorage : elle survit à un
    // rechargement de la page, pas à la fermeture de l'onglet, et ne quitte
    // jamais l'appareil.
    const SERIE = 'dnd-serie-20';
    const idPerso = () => { try { return localStorage.getItem('dnd-active-char') || ''; } catch (e) { return ''; } };
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    function serieEnCours() {
        try {
            const s = JSON.parse(sessionStorage.getItem(SERIE) || 'null');
            return s && s.id === idPerso() ? (s.n || 0) : 0;
        } catch (e) { return 0; }
    }
    function noterSerie(n) { try { sessionStorage.setItem(SERIE, JSON.stringify({ id: idPerso(), n })); } catch (e) {} }

    function jet(nat) {
        const n = nat === 20 ? serieEnCours() + 1 : 0;
        if (n >= 3) { noterSerie(0); legende(); return; }
        noterSerie(n);
        if (nat === 20) crit(); else if (nat === 1) fumble();
    }

    // ---------- Trois 20 naturels : les dieux te regardent ----------
    // La récompense : une triple pluie d'or, une bannière, et le style « Légende »
    // de la carte de héros, débloqué pour CE personnage. La clé `dnd-legende`
    // garde la date du premier exploit et le nombre de fois.
    function legende() {
        const id = idPerso();
        if (!id) return;
        const cle = id + '_dnd-legende';
        let avant = null;
        try { avant = JSON.parse(localStorage.getItem(cle) || 'null'); } catch (e) {}
        const etat = { date: (avant && avant.date) || Date.now(), fois: ((avant && avant.fois) || 0) + 1 };
        const val = JSON.stringify(etat);
        try { localStorage.setItem(cle, val); } catch (e) {}
        // Même règle que les écritures de la fiche (DB.set dans script.js) : le
        // trophée suit le personnage dans le cloud, jusque sur ses autres appareils.
        try { if (window.SupaAuth && window.SupaAuth.currentUser && window.SyncQueue) window.SyncQueue.push(id, 'dnd-legende', val); } catch (e) {}

        if (!calme()) { crit(); setTimeout(crit, 420); setTimeout(crit, 840); }
        banniere(etat);
    }

    let legendeStyles = false;
    function stylesLegende() {
        if (legendeStyles) return; legendeStyles = true;
        // Sous la pluie d'or (100050) : les paillettes tombent PAR-DESSUS la bannière.
        injecter(`
        .rfx-legende { position: fixed; inset: 0; z-index: 100040; display: flex; align-items: center; justify-content: center; padding: 24px; overflow: hidden;
            background: radial-gradient(ellipse at 50% 45%, rgba(34,24,8,.86), rgba(0,0,0,.93) 72%); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); animation: rfxLegIn .45s ease-out both; }
        .rfx-legende.sort { animation: rfxLegOut .34s ease-in forwards; }
        @keyframes rfxLegIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rfxLegOut { from { opacity: 1; } to { opacity: 0; } }
        .rfx-leg-rayons { position: absolute; left: 50%; top: 46%; width: 170vmax; height: 170vmax; pointer-events: none; transform: translate(-50%, -50%);
            background: repeating-conic-gradient(rgba(255,214,120,.2) 0deg 3deg, rgba(255,214,120,0) 3deg 12deg);
            -webkit-mask-image: radial-gradient(circle, #000 0%, rgba(0,0,0,.55) 16%, transparent 46%); mask-image: radial-gradient(circle, #000 0%, rgba(0,0,0,.55) 16%, transparent 46%);
            animation: rfxLegRays 40s linear infinite; }
        @keyframes rfxLegRays { to { transform: translate(-50%, -50%) rotate(360deg); } }
        .rfx-legende .rfx-leg-boite { position: relative; max-width: 660px; text-align: center; color: #f6ead0; animation: rfxLegPop .9s cubic-bezier(.2,.9,.25,1.12) .12s both; }
        @keyframes rfxLegPop { from { opacity: 0; transform: scale(.8) translateY(16px); filter: blur(8px); } to { opacity: 1; transform: none; filter: none; } }
        .rfx-legende .rfx-leg-surtitre { font-family: 'Cinzel', Georgia, serif; font-size: .78rem; font-weight: 600; letter-spacing: .3em; text-transform: uppercase; color: #e8c16a; }
        .rfx-legende .rfx-leg-titre { margin: .3em 0 .35em; padding: 0; border: 0; font-family: 'Cinzel', Georgia, serif; font-weight: 700; font-size: clamp(2.1rem, 7.2vw, 4.6rem); line-height: 1.04; letter-spacing: .01em; text-transform: none;
            background: linear-gradient(100deg, #8a6420 0%, #f3d27a 26%, #fff4cc 44%, #c8962f 62%, #f0cd72 80%, #8a6420 100%); background-size: 240% 100%;
            -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent;
            filter: drop-shadow(0 0 22px rgba(255,196,90,.45)); animation: rfxLegOr 3.6s ease-in-out infinite; }
        @keyframes rfxLegOr { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        .rfx-legende .rfx-leg-phrase { margin: 0 auto 1.5em; max-width: 32em; font-family: 'Lora', Georgia, serif; font-style: italic; font-size: 1.06rem; line-height: 1.6; color: rgba(246,234,208,.86); }
        .rfx-legende .rfx-leg-phrase b { font-style: normal; color: #f3d27a; }
        .rfx-legende .rfx-leg-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
        .rfx-legende .rfx-leg-actions button { min-height: 44px; padding: 10px 22px; border-radius: 999px; cursor: pointer; font-family: 'Cinzel', Georgia, serif; font-size: .9rem; font-weight: 600; letter-spacing: .04em; text-transform: none; }
        .rfx-legende .rfx-leg-carte { color: #2a1c06; background: linear-gradient(180deg, #f6dc8c, #c8962f); border: 1px solid #f9e7b0; box-shadow: 0 0 24px rgba(255,200,90,.45); }
        .rfx-legende .rfx-leg-carte:hover { filter: brightness(1.08); }
        .rfx-legende .rfx-leg-fermer { color: #f6ead0; background: rgba(255,255,255,.06); border: 1px solid rgba(246,234,208,.32); box-shadow: none; }
        .rfx-legende .rfx-leg-fermer:hover { background: rgba(255,255,255,.12); }
        .rfx-legende button:focus-visible { outline: 2px solid #f6dc8c; outline-offset: 3px; }
        @media (prefers-reduced-motion: reduce) { .rfx-legende, .rfx-legende .rfx-leg-boite, .rfx-leg-rayons, .rfx-legende .rfx-leg-titre { animation: none !important; } }`);
    }

    // La bannière reste lisible sans animation : avec « moins d'animations »,
    // pas de pluie ni de rayons qui tournent, mais le déblocage s'annonce quand même.
    function banniere(etat) {
        stylesLegende();
        const deja = document.getElementById('rfx-legende'); if (deja) deja.remove();
        const nom = String((document.getElementById('char-name') || {}).value || '').trim() || 'Ton héros';
        const phrase = etat.fois > 1
            ? `Encore ! ${esc(nom)} a remis ça : ${etat.fois} fois à ce jour. Les dieux n’en reviennent pas.`
            : `${esc(nom)} entre dans la légende. Le style <b>Légende</b> de la carte de héros est débloqué.`;
        const el = document.createElement('div');
        el.id = 'rfx-legende'; el.className = 'rfx-legende no-print';
        el.setAttribute('role', 'dialog'); el.setAttribute('aria-labelledby', 'rfx-leg-titre');
        el.innerHTML = `<div class="rfx-leg-rayons" aria-hidden="true"></div>
            <div class="rfx-leg-boite">
                <div class="rfx-leg-surtitre">✦ Trois 20 naturels d’affilée ✦</div>
                <h2 id="rfx-leg-titre" class="rfx-leg-titre">Les dieux te regardent</h2>
                <p class="rfx-leg-phrase">${phrase}</p>
                <div class="rfx-leg-actions">
                    <button type="button" class="rfx-leg-carte">🃏 Voir ma carte Légende</button>
                    <button type="button" class="rfx-leg-fermer">Continuer</button>
                </div>
            </div>`;
        document.body.appendChild(el);

        const boite = el.querySelector('.rfx-leg-boite');
        let minuteur = null;
        const armer = () => { clearTimeout(minuteur); minuteur = setTimeout(fermer, 15000); };
        const surTouche = (e) => { if (e.key === 'Escape') fermer(); };
        function fermer() {
            if (el.classList.contains('sort')) return;
            clearTimeout(minuteur);
            document.removeEventListener('keydown', surTouche);
            el.classList.add('sort');
            setTimeout(() => el.remove(), calme() ? 0 : 340);
        }
        document.addEventListener('keydown', surTouche);
        el.addEventListener('click', (e) => {
            if (e.target.closest('.rfx-leg-carte')) { fermer(); if (window.HeroCard) window.HeroCard.open({ style: 'legende' }); return; }
            if (e.target.closest('.rfx-leg-fermer') || !boite.contains(e.target)) fermer();
        });
        // Elle se retire seule si on l'ignore, mais jamais sous le pointeur.
        boite.addEventListener('pointerenter', () => clearTimeout(minuteur));
        boite.addEventListener('pointerleave', armer);
        armer();
        const principal = el.querySelector('.rfx-leg-carte');
        if (principal) try { principal.focus({ preventScroll: true }); } catch (e) {}
    }

    window.RollFX = { crit, fumble, jet };

    // ---------- Voiles d'état plein écran ----------
    const CLE = 'dnd-fx-fullscreen';
    let voilesStyles = false;
    function stylesVoiles() {
        if (voilesStyles) return; voilesStyles = true;
        injecter(`
        #status-fx { position: fixed; inset: 0; pointer-events: none; z-index: 9960; opacity: 0; transition: opacity .6s ease; }
        #status-fx.on { opacity: 1; }
        #status-fx.fx-poison { box-shadow: inset 0 0 150px 40px rgba(70,150,40,.42); background: radial-gradient(ellipse at 50% 50%, rgba(90,170,50,0) 55%, rgba(60,130,30,.18)); animation: sfxPulse 3.4s ease-in-out infinite; }
        #status-fx.fx-fire { box-shadow: inset 0 0 150px 45px rgba(200,70,20,.5); background: radial-gradient(ellipse at 50% 100%, rgba(255,120,30,.22), rgba(0,0,0,0) 55%); animation: sfxFlicker .5s ease-in-out infinite; }
        #status-fx.fx-fear { box-shadow: inset 0 0 170px 60px rgba(120,10,10,.55); animation: sfxPulse 2.2s ease-in-out infinite; }
        #status-fx.fx-blind { box-shadow: inset 0 0 250px 130px rgba(0,0,0,.9); background: rgba(0,0,0,.35); }
        #status-fx.fx-stun { box-shadow: inset 0 0 160px 55px rgba(120,110,60,.5); filter: saturate(.6); animation: sfxPulse 1.6s ease-in-out infinite; }
        #status-fx.fx-down { box-shadow: inset 0 0 230px 110px rgba(0,0,0,.82); background: rgba(20,20,25,.4); }
        @keyframes sfxPulse { 0%,100% { opacity: .72; } 50% { opacity: 1; } }
        @keyframes sfxFlicker { 0%,100% { opacity: .8; } 25% { opacity: 1; } 50% { opacity: .7; } 75% { opacity: .95; } }
        @media (prefers-reduced-motion: reduce) { #status-fx { animation: none !important; } }`);
    }

    /** Les conditions cochées sur la fiche, en minuscules. */
    function mesConditions() {
        const out = [];
        try {
            document.querySelectorAll('#conditions-track-container input[type="checkbox"]:checked, #custom-conditions-container input[type="checkbox"]:checked').forEach(cb => {
                const lbl = (cb.parentElement ? cb.parentElement.textContent : '').replace(/\s+/g, ' ').trim();
                if (lbl) out.push(lbl.toLowerCase());
            });
        } catch (e) {}
        return out;
    }

    /** Un seul voile à la fois : le plus grave l'emporte. */
    function effetPour(conds) {
        const a = (kw) => conds.some(c => c.indexOf(kw) !== -1);
        if (a('inconscient')) return 'fx-down';
        if (a('pétrifi') || a('petrifi') || a('paralys')) return 'fx-stun';
        if (a('aveugl')) return 'fx-blind';
        if (a('feu') || a('enflamm') || a('brûl') || a('brul')) return 'fx-fire';
        if (a('empoisonn') || a('poison') || a('intoxiqu')) return 'fx-poison';
        if (a('effray') || a('terroris') || a('apeur') || a('épouvant') || a('epouvant')) return 'fx-fear';
        if (a('étourdi') || a('etourdi') || a('assomm') || a('neutralis')) return 'fx-stun';
        if (a('à terre') || a('a terre')) return 'fx-down';
        return null;
    }

    function actifs() { try { return localStorage.getItem(CLE) !== '0'; } catch (e) { return true; } }

    function maj() {
        const app = document.getElementById('app-screen');
        const surFiche = !!(app && !app.classList.contains('hidden'));
        let ov = document.getElementById('status-fx');
        const effet = (surFiche && actifs()) ? effetPour(mesConditions()) : null;
        if (!effet) {
            // Retrait : les voiles animés pilotent l'opacité par keyframes ; retirer
            // seulement « on » laissait le voile affiché. On coupe d'abord l'animation.
            if (ov) { ov.style.animation = 'none'; ov.classList.remove('on'); }
            return;
        }
        stylesVoiles();
        if (!ov) { ov = document.createElement('div'); ov.id = 'status-fx'; ov.className = 'no-print'; document.body.appendChild(ov); }
        ov.style.animation = '';
        ov.className = 'no-print ' + effet;
        void ov.offsetWidth;            // rejoue la transition au changement d'effet
        ov.classList.add('on');
    }

    document.addEventListener('change', (e) => {
        const t = e.target; if (!t) return;
        if (t.id === 'toggle-status-fx') {
            try { localStorage.setItem(CLE, t.checked ? '1' : '0'); } catch (err) {}
            maj();
            if (window.showAppToast) window.showAppToast(t.checked ? '💥 Effets d’état plein écran activés' : '🚫 Effets d’état plein écran désactivés');
            return;
        }
        if (t.type === 'checkbox' && t.closest && t.closest('#conditions-track-container, #custom-conditions-container')) maj();
    });
    document.addEventListener('screen:change', maj);

    function init() {
        const caseMenu = document.getElementById('toggle-status-fx');
        if (caseMenu) caseMenu.checked = actifs();
        // La fiche remplit ses conditions pendant son propre chargement : on
        // laisse passer ce tour avant le premier calcul.
        setTimeout(maj, 0);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
    window.addEventListener('load', maj);

    window.StatusFX = { refresh: maj };
})();
