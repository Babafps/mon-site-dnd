// =====================================================
// effets.js — les effets visuels de la fiche
//
// Deux familles, toutes deux déclenchées par TA fiche, sans réseau :
//   · RollFX : la pluie d'étincelles d'un 20 naturel, la secousse d'un 1 (les
//     séries de trois 20 ou de trois 1 vivent dans secrets.js) ;
//   · les voiles d'état plein écran — charmé, invisible, pétrifié, empoisonné,
//     aveuglé, effrayé, en feu, étourdi, à terre — qui suivent les états en
//     cours sur la fiche (etats.js).
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
    // Appelé par l'historique des jets (script.js, pushRollHistory) pour TOUT jet
    // de d20. Les secrets (secrets.js) passent d'abord : trois 20 ou trois 1
    // d'affilée ont leur propre mise en scène, qui remplace l'effet simple.
    function jet(nat) {
        try { if (window.Secrets && window.Secrets.d20(nat)) return; } catch (err) {}
        if (nat === 20) crit(); else if (nat === 1) fumble();
    }

    window.RollFX = { crit, fumble, jet };

    // ---------- Voiles d'état plein écran ----------
    //
    // Un voile est une SURIMPRESSION : il ne touche jamais au contenu de la
    // fiche, ne capte aucun clic (`pointer-events: none`) et disparaît si le
    // joueur coupe l'interrupteur « Effets d'état plein écran » du menu ☰.
    // Un seul voile à la fois : le plus grave l'emporte.
    //
    // Invisible fait exception : ce n'est pas un voile mais la fiche elle-même
    // qui s'efface, avec un liseré hachuré. Il peut donc se cumuler avec un
    // voile — on peut être invisible ET empoisonné.
    //
    // Tout s'éteint sous `prefers-reduced-motion` : les cœurs de Charmé ne
    // tombent plus, les pulsations s'arrêtent, les teintes restent.
    const CLE = 'dnd-fx-fullscreen';
    let voilesStyles = false;
    function stylesVoiles() {
        if (voilesStyles) return; voilesStyles = true;
        injecter(`
        #status-fx { position: fixed; inset: 0; pointer-events: none; z-index: 9960; opacity: 0; transition: opacity .6s ease; }
        #status-fx.on { opacity: 1; }
        #status-fx::before, #status-fx::after { content: ''; position: absolute; inset: 0; pointer-events: none; }
        #status-fx.fx-poison { box-shadow: inset 0 0 150px 40px rgba(70,150,40,.42); background: radial-gradient(ellipse at 50% 50%, rgba(90,170,50,0) 55%, rgba(60,130,30,.18)); animation: sfxPulse 3.4s ease-in-out infinite; }
        #status-fx.fx-fire { box-shadow: inset 0 0 150px 45px rgba(200,70,20,.5); background: radial-gradient(ellipse at 50% 100%, rgba(255,120,30,.22), rgba(0,0,0,0) 55%); animation: sfxFlicker .5s ease-in-out infinite; }
        #status-fx.fx-fear { box-shadow: inset 0 0 170px 60px rgba(120,10,10,.55); animation: sfxPulse 2.2s ease-in-out infinite; }
        #status-fx.fx-blind { box-shadow: inset 0 0 250px 130px rgba(0,0,0,.9); background: rgba(0,0,0,.35); }
        #status-fx.fx-stun { box-shadow: inset 0 0 160px 55px rgba(120,110,60,.5); filter: saturate(.6); animation: sfxPulse 1.6s ease-in-out infinite; }
        #status-fx.fx-down { box-shadow: inset 0 0 230px 110px rgba(0,0,0,.82); background: rgba(20,20,25,.4); }

        /* Charmé : une teinte rosée, et des cœurs qui montent doucement. */
        #status-fx.fx-charme { box-shadow: inset 0 0 170px 55px rgba(233,80,150,.34); background: radial-gradient(ellipse at 50% 110%, rgba(255,140,190,.20), rgba(255,140,190,0) 60%); }
        .sfx-coeur { position: absolute; bottom: -8vh; font-size: var(--t,18px); line-height: 1; opacity: 0; will-change: transform, opacity;
                     animation: sfxCoeur var(--d,9s) linear var(--r,0s) infinite; }
        @keyframes sfxCoeur {
            0%   { transform: translateY(0) rotate(-8deg) scale(.85); opacity: 0; }
            12%  { opacity: .85; }
            88%  { opacity: .55; }
            100% { transform: translateY(-118vh) rotate(10deg) scale(1.05); opacity: 0; }
        }

        /* Pétrifié : la couleur s'en va, la pierre se fendille. La fiche reste
           lisible — on grise ce qui est derrière, on ne le recouvre pas. */
        #status-fx.fx-petrifie {
            box-shadow: inset 0 0 200px 70px rgba(60,58,55,.5);
            background: rgba(138,134,128,.26);
            -webkit-backdrop-filter: grayscale(.92) contrast(.96);
            backdrop-filter: grayscale(.92) contrast(.96);
        }
        #status-fx.fx-petrifie::after {
            opacity: .4;
            background:
                linear-gradient(103deg, transparent 49.7%, rgba(30,28,26,.55) 49.85%, rgba(30,28,26,.55) 50.1%, transparent 50.25%),
                linear-gradient(58deg,  transparent 29.7%, rgba(30,28,26,.4) 29.85%, rgba(30,28,26,.4) 30.05%, transparent 30.2%),
                linear-gradient(-72deg, transparent 69.7%, rgba(30,28,26,.45) 69.85%, rgba(30,28,26,.45) 70.05%, transparent 70.2%),
                linear-gradient(24deg,  transparent 79.8%, rgba(30,28,26,.3) 79.9%, rgba(30,28,26,.3) 80.05%, transparent 80.2%),
                repeating-linear-gradient(117deg, rgba(255,255,255,.05) 0 2px, transparent 2px 26px);
        }

        /* Invisible : la fiche s'efface, un liseré hachuré dit qu'elle est là. */
        body.fx-invisible #app-screen { opacity: .5; transition: opacity .5s ease; }
        body.fx-invisible #app-screen > .sheet-container,
        body.fx-invisible #app-screen > .app-main { position: relative; }
        #sfx-invisible {
            position: fixed; inset: 10px; pointer-events: none; z-index: 9955; border-radius: 14px;
            border: 2px dashed rgba(150,180,210,.55);
            background: repeating-linear-gradient(135deg, rgba(160,190,220,.07) 0 8px, transparent 8px 18px);
            opacity: 0; transition: opacity .5s ease;
        }
        #sfx-invisible.on { opacity: 1; }

        @keyframes sfxPulse { 0%,100% { opacity: .72; } 50% { opacity: 1; } }
        @keyframes sfxFlicker { 0%,100% { opacity: .8; } 25% { opacity: 1; } 50% { opacity: .7; } 75% { opacity: .95; } }
        @media (prefers-reduced-motion: reduce) {
            #status-fx, #status-fx.on { animation: none !important; }
            .sfx-coeur { display: none !important; }
            body.fx-invisible #app-screen, #sfx-invisible { transition: none !important; }
        }
        /* Rien de tout cela ne s'imprime, et la fiche retrouve son opacité. */
        @media print {
            #status-fx, #sfx-invisible { display: none !important; }
            body.fx-invisible #app-screen { opacity: 1 !important; }
        }`);
    }

    /** Les états en cours : identifiants du SRD, et noms des états personnalisés. */
    function mesEtats() {
        if (window.Etats && typeof window.Etats.actifs === 'function') {
            const a = window.Etats.actifs();
            return {
                ids: a.filter(e => !e.perso).map(e => e.srd),
                noms: a.map(e => String(e.nom || '').toLowerCase())
            };
        }
        // Repli : les cases de la fiche, si etats.js n'est pas chargé.
        const ids = [];
        try {
            document.querySelectorAll('#conditions-track-container input[type="checkbox"]:checked')
                .forEach(cb => { if (cb.id) ids.push(cb.id); });
        } catch (e) {}
        return { ids: ids, noms: [] };
    }

    /** Un seul voile à la fois : le plus grave l'emporte. */
    function effetPour(etats) {
        const a = (id) => etats.ids.indexOf(id) !== -1;
        const mot = (kw) => etats.noms.some(n => n.indexOf(kw) !== -1);
        if (a('unconscious')) return 'fx-down';
        if (a('petrified')) return 'fx-petrifie';
        if (a('paralyzed')) return 'fx-stun';
        if (a('blinded')) return 'fx-blind';
        // « en feu » n'est pas un état du SRD : il vient des états personnalisés.
        if (mot('feu') || mot('enflamm') || mot('brûl') || mot('brul')) return 'fx-fire';
        if (a('poisoned') || mot('intoxiqu')) return 'fx-poison';
        if (a('frightened') || mot('terroris') || mot('apeur') || mot('épouvant')) return 'fx-fear';
        if (a('stunned') || a('incapacitated') || mot('assomm')) return 'fx-stun';
        if (a('charmed')) return 'fx-charme';
        if (a('prone')) return 'fx-down';
        return null;
    }

    function actifs() { try { return localStorage.getItem(CLE) !== '0'; } catch (e) { return true; } }

    /** Les cœurs de Charmé — jamais sous mouvement réduit. */
    function coeurs(ov, on) {
        const dedans = ov.querySelector('.sfx-coeurs');
        if (!on || calme()) { if (dedans) dedans.remove(); return; }
        if (dedans) return;
        const boite = document.createElement('div');
        boite.className = 'sfx-coeurs';
        boite.style.cssText = 'position:absolute; inset:0; overflow:hidden;';
        const SIGNES = ['💗', '💖', '💕', '🩷'];
        for (let i = 0; i < 14; i++) {
            const c = document.createElement('span');
            c.className = 'sfx-coeur';
            c.setAttribute('aria-hidden', 'true');
            c.textContent = SIGNES[i % SIGNES.length];
            c.style.left = (4 + Math.random() * 92).toFixed(1) + '%';
            c.style.setProperty('--t', (14 + Math.random() * 16).toFixed(0) + 'px');
            c.style.setProperty('--d', (8 + Math.random() * 7).toFixed(1) + 's');
            c.style.setProperty('--r', (-Math.random() * 12).toFixed(1) + 's');
            boite.appendChild(c);
        }
        ov.appendChild(boite);
    }

    /** Invisible : la fiche s'efface. Ce n'est pas un voile, elle reste utilisable. */
    function invisible(on) {
        document.body.classList.toggle('fx-invisible', !!on);
        let cadre = document.getElementById('sfx-invisible');
        if (!on) { if (cadre) cadre.classList.remove('on'); return; }
        stylesVoiles();
        if (!cadre) {
            cadre = document.createElement('div');
            cadre.id = 'sfx-invisible';
            cadre.className = 'no-print';
            cadre.setAttribute('aria-hidden', 'true');
            document.body.appendChild(cadre);
        }
        void cadre.offsetWidth;
        cadre.classList.add('on');
    }

    function maj() {
        const app = document.getElementById('app-screen');
        const surFiche = !!(app && !app.classList.contains('hidden'));
        const permis = surFiche && actifs();
        const etats = permis ? mesEtats() : { ids: [], noms: [] };
        let ov = document.getElementById('status-fx');

        invisible(permis && etats.ids.indexOf('invisible') !== -1);

        const effet = permis ? effetPour(etats) : null;
        if (!effet) {
            // Retrait : les voiles animés pilotent l'opacité par keyframes ; retirer
            // seulement « on » laissait le voile affiché. On coupe d'abord l'animation.
            if (ov) { ov.style.animation = 'none'; ov.classList.remove('on'); coeurs(ov, false); }
            return;
        }
        stylesVoiles();
        if (!ov) { ov = document.createElement('div'); ov.id = 'status-fx'; ov.className = 'no-print'; ov.setAttribute('aria-hidden', 'true'); document.body.appendChild(ov); }
        ov.style.animation = '';
        ov.className = 'no-print ' + effet;
        coeurs(ov, effet === 'fx-charme');
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
        if (t.type === 'checkbox' && t.closest && t.closest('#conditions-track-container')) maj();
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
