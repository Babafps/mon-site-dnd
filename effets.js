// =====================================================
// effets.js — les effets visuels de la fiche
//
// Deux familles, toutes deux déclenchées par TA fiche, sans réseau :
//   · RollFX : la pluie d'étincelles d'un 20 naturel, la secousse d'un 1 (les
//     séries de trois 20 ou de trois 1 vivent dans secrets.js) ;
//   · les voiles d'état plein écran : UNE COUCHE PAR ÉTAT, cumulables, qui
//     suivent les états en cours sur la fiche (etats.js). Chaque état a son
//     coin d'écran et son langage propre — teinte, particules, givre,
//     chaînes, paupières — pour qu'on les distingue tous d'un coup d'œil.
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
    // UNE COUCHE PAR ÉTAT, et elles se superposent : trois états actifs, ce
    // sont trois effets visibles en même temps. Pour qu'ils ne se noient pas
    // les uns dans les autres, chacun occupe une PLACE différente de l'écran —
    // les bords, le bas, le haut, un coin — ou un canal différent (teinte,
    // particules, désaturation). On ne voit jamais deux brouillards identiques.
    //
    // Une couche est une SURIMPRESSION : elle ne touche pas au contenu de la
    // fiche et ne capte aucun clic (`pointer-events: none`). L'interrupteur
    // « Effets d'état » du menu ☰ les éteint toutes.
    //
    // Invisible fait exception : ce n'est pas une surimpression mais la fiche
    // elle-même qui s'efface — elle se cumule donc naturellement au reste.
    //
    // Sous `prefers-reduced-motion`, plus aucune particule ni pulsation : les
    // teintes et les formes restent, immobiles.
    const CLE = 'dnd-fx-fullscreen';

    // L'ordre compte : c'est l'ordre de peinture. Pétrifié passe en premier
    // parce qu'il grise ce qui est DERRIÈRE lui (backdrop-filter) — les
    // couches suivantes gardent donc leurs couleurs.
    const COUCHES = ['petrified', 'blinded', 'unconscious', 'exhaustion', 'frightened',
                     'deafened', 'prone', 'poisoned', 'restrained', 'grappled',
                     'paralyzed', 'stunned', 'charmed', 'incapacitated', 'invisible', 'fire'];
    const PARTICULES = {
        charmed:  { n: 14, signes: ['💗', '💖', '💕'], classe: 'sfx-coeur' },
        poisoned: { n: 12, signes: ['●'],              classe: 'sfx-bulle' },
        stunned:  { n: 9,  signes: ['✦', '✧'],         classe: 'sfx-etoile' }
    };

    let voilesStyles = false;
    function stylesVoiles() {
        if (voilesStyles) return; voilesStyles = true;
        injecter(`
        #status-fx { position: fixed; inset: 0; pointer-events: none; z-index: 9960; overflow: hidden; }
        .sfx-c { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity .5s ease; }
        .sfx-c.on { opacity: 1; }
        .sfx-c::before, .sfx-c::after { content: ''; position: absolute; inset: 0; pointer-events: none; }

        /* — Aveuglé : l'obscurité se referme, il ne reste qu'une lucarne. — */
        .sfx-blinded::before {
            background: radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 22%, rgba(0,0,0,.55) 54%, rgba(0,0,0,.88) 100%);
            animation: sfxRespire 3.4s ease-in-out infinite;
        }

        /* — Inconscient : deux paupières noires qui se ferment. — */
        .sfx-unconscious::before {
            inset: auto 0 auto 0; top: 0; height: 42vh; transform-origin: top;
            background: linear-gradient(to bottom, rgba(0,0,0,.93), rgba(0,0,0,0));
            animation: sfxPaupiere 5s ease-in-out infinite;
        }
        .sfx-unconscious::after {
            inset: auto 0 0 0; height: 42vh; transform-origin: bottom;
            background: linear-gradient(to top, rgba(0,0,0,.93), rgba(0,0,0,0));
            animation: sfxPaupiere 5s ease-in-out infinite;
        }

        /* — Épuisement : une poussière brune, de plus en plus lourde. — */
        .sfx-exhaustion::before {
            background: radial-gradient(ellipse at 50% 50%, rgba(90,70,45,0) 30%, rgba(70,52,32,.95) 100%);
            opacity: calc(.13 * var(--n, 1));
        }
        .sfx-exhaustion::after {
            inset: auto 0 0 0; height: 26vh;
            background: linear-gradient(to top, rgba(60,44,26,.5), rgba(60,44,26,0));
            opacity: calc(.16 * var(--n, 1));
            animation: sfxRespire 6s ease-in-out infinite;
        }

        /* — Effrayé : un battement rouge sombre, rapide. — */
        .sfx-frightened::before {
            box-shadow: inset 0 0 170px 70px rgba(125,8,8,.62);
            animation: sfxPeur 1.5s ease-in-out infinite;
        }

        /* — Assourdi : le son s'éteint aux deux oreilles, ondes arrêtées net. — */
        .sfx-deafened::before, .sfx-deafened::after {
            top: 0; bottom: 0; width: 25vw;
            background:
                repeating-radial-gradient(circle at 0% 50%, rgba(188,214,246,0) 0 22px, rgba(188,214,246,.7) 22px 27px, rgba(188,214,246,0) 27px 52px),
                linear-gradient(to right, rgba(48,62,90,.6), rgba(48,62,90,0));
            animation: sfxOuate 3s ease-in-out infinite;
        }
        .sfx-deafened::before { left: 0; right: auto; }
        .sfx-deafened::after { right: 0; left: auto; transform: scaleX(-1); }

        /* — À terre : le sol monte, l'horizon bascule. — */
        .sfx-prone::before {
            inset: auto 0 0 0; height: 52vh;
            background: linear-gradient(to top, rgba(68,40,10,.88), rgba(96,60,20,.38) 48%, rgba(96,60,20,0));
        }
        .sfx-prone::after {
            inset: auto 0 51vh 0; height: 3px;
            background: linear-gradient(to right, transparent, rgba(200,150,70,.9), transparent);
        }

        /* — Empoisonné : une mare verte au fond, des bulles qui remontent. — */
        .sfx-poisoned::before {
            inset: auto 0 0 0; height: 40vh;
            background: linear-gradient(to top, rgba(36,110,28,.6), rgba(56,140,40,.10) 60%, rgba(56,140,40,0));
            animation: sfxRespire 3.2s ease-in-out infinite;
        }
        .sfx-bulle {
            position: absolute; bottom: -6vh; width: var(--t,12px); height: var(--t,12px);
            border-radius: 50%; background: radial-gradient(circle at 35% 32%, rgba(200,255,180,.95), rgba(60,150,40,.45) 70%, rgba(40,110,25,.15));
            box-shadow: 0 0 8px rgba(90,200,60,.5);
            animation: sfxMonte var(--d,7s) linear var(--r,0s) infinite;
        }

        /* — Entravé : des chaînes tendues le long des bords. — */
        .sfx-restrained::before, .sfx-restrained::after {
            top: 0; bottom: 0; width: clamp(26px, 7vw, 52px);
            background:
                repeating-radial-gradient(circle at 50% 0, rgba(46,50,60,0) 0 13px, rgba(46,50,60,.92) 13px 18px, rgba(46,50,60,0) 18px 38px),
                linear-gradient(to right, rgba(34,38,48,.55), rgba(34,38,48,0));
            background-size: 52px 38px, 100% 100%;
        }
        .sfx-restrained::before { left: 0; right: auto; }
        .sfx-restrained::after { right: 0; left: auto; transform: scaleX(-1); }

        /* — Agrippé : deux poignes vertes qui se resserrent. — */
        .sfx-grappled::before, .sfx-grappled::after {
            top: 12vh; bottom: 12vh; width: 17vw;
            animation: sfxPoigne 2.4s ease-in-out infinite;
        }
        .sfx-grappled::before { left: 0; right: auto; transform-origin: left center;
            background: linear-gradient(to right, rgba(22,104,48,.85), rgba(30,130,62,.3) 52%, rgba(30,130,62,0)); }
        .sfx-grappled::after { right: 0; left: auto; transform-origin: right center;
            background: linear-gradient(to left, rgba(22,104,48,.85), rgba(30,130,62,.3) 52%, rgba(30,130,62,0)); }

        /* — Paralysé : le givre prend les coins, des arcs bleus figés. — */
        .sfx-paralyzed::before {
            background:
                radial-gradient(farthest-side at 0% 0%, rgba(38,132,205,.62), rgba(38,132,205,0)),
                radial-gradient(farthest-side at 100% 0%, rgba(38,132,205,.62), rgba(38,132,205,0)),
                radial-gradient(farthest-side at 0% 100%, rgba(38,132,205,.62), rgba(38,132,205,0)),
                radial-gradient(farthest-side at 100% 100%, rgba(38,132,205,.62), rgba(38,132,205,0));
            background-size: 40% 40%; background-repeat: no-repeat;
            background-position: left top, right top, left bottom, right bottom;
        }
        .sfx-paralyzed::after {
            background:
                linear-gradient(84deg, transparent 47.6%, rgba(120,200,255,.85) 47.9%, rgba(120,200,255,.85) 48.2%, transparent 48.5%),
                linear-gradient(-68deg, transparent 27.6%, rgba(120,200,255,.6) 27.9%, rgba(120,200,255,.6) 28.15%, transparent 28.4%),
                linear-gradient(112deg, transparent 72.6%, rgba(120,200,255,.6) 72.9%, rgba(120,200,255,.6) 73.15%, transparent 73.4%);
            animation: sfxArc 2.2s steps(1, end) infinite;
        }

        /* — Étourdi : des étoiles tournent au-dessus de la tête. — */
        .sfx-stunned::before {
            inset: 0 0 auto 0; height: 38vh;
            background: linear-gradient(to bottom, rgba(226,152,16,.5), rgba(226,152,16,0));
            animation: sfxRespire 2s ease-in-out infinite;
        }
        .sfx-etoile {
            position: absolute; top: 12vh; left: 50%; font-size: var(--t,30px); line-height: 1;
            color: #ffc21f; text-shadow: 0 0 14px rgba(255,180,20,1), 0 0 3px rgba(120,70,0,.8);
            transform-origin: 0 0;
            animation: sfxTourne var(--d,3s) linear var(--r,0s) infinite;
        }

        /* — Charmé : une lueur rose, des cœurs qui montent. — */
        .sfx-charmed::before {
            background: radial-gradient(ellipse at 50% 115%, rgba(255,120,180,.42), rgba(255,120,180,0) 62%);
            box-shadow: inset 0 0 150px 45px rgba(233,80,150,.3);
            animation: sfxRespire 4s ease-in-out infinite;
        }
        .sfx-coeur {
            position: absolute; bottom: -8vh; font-size: var(--t,18px); line-height: 1;
            animation: sfxMonte var(--d,9s) linear var(--r,0s) infinite;
        }

        /* — Neutralisé : un sceau d'interdiction, en haut à gauche. — */
        .sfx-incapacitated::before {
            inset: 0 0 auto 0; height: 18vh;
            background: linear-gradient(to bottom, rgba(170,20,20,.3), rgba(170,20,20,0));
        }
        .sfx-incapacitated::after {
            right: auto; bottom: auto; top: 10vh; left: 3vw;
            width: clamp(64px, 13vw, 104px); height: clamp(64px, 13vw, 104px); border-radius: 50%;
            border: clamp(6px, 1.2vw, 9px) solid rgba(200,35,35,.8);
            background: linear-gradient(135deg, transparent 45.5%, rgba(200,35,35,.8) 45.5%, rgba(200,35,35,.8) 54.5%, transparent 54.5%);
            animation: sfxRespire 2.6s ease-in-out infinite;
        }

        /* — Pétrifié : la couleur s'en va, la pierre se fendille. — */
        .sfx-petrified {
            -webkit-backdrop-filter: grayscale(.92) contrast(.96);
            backdrop-filter: grayscale(.92) contrast(.96);
        }
        .sfx-petrified::before {
            background: rgba(138,134,128,.24);
            box-shadow: inset 0 0 200px 70px rgba(60,58,55,.45);
        }
        .sfx-petrified::after {
            opacity: .42;
            background:
                linear-gradient(103deg, transparent 49.7%, rgba(30,28,26,.55) 49.85%, rgba(30,28,26,.55) 50.1%, transparent 50.25%),
                linear-gradient(58deg,  transparent 29.7%, rgba(30,28,26,.4) 29.85%, rgba(30,28,26,.4) 30.05%, transparent 30.2%),
                linear-gradient(-72deg, transparent 69.7%, rgba(30,28,26,.45) 69.85%, rgba(30,28,26,.45) 70.05%, transparent 70.2%),
                linear-gradient(24deg,  transparent 79.8%, rgba(30,28,26,.3) 79.9%, rgba(30,28,26,.3) 80.05%, transparent 80.2%),
                repeating-linear-gradient(117deg, rgba(255,255,255,.05) 0 2px, transparent 2px 26px);
        }

        /* — Invisible : un liseré hachuré ; la fiche, elle, s'efface. — */
        .sfx-invisible::before {
            inset: 10px; border-radius: 14px;
            border: 2px dashed rgba(150,190,225,.6);
            background: repeating-linear-gradient(135deg, rgba(160,190,220,.07) 0 8px, transparent 8px 18px);
        }
        body.fx-invisible #app-screen { opacity: .5; transition: opacity .5s ease; }

        /* — « En feu » : un état personnalisé courant. — */
        .sfx-fire::before {
            background: radial-gradient(ellipse at 50% 100%, rgba(255,120,30,.3), rgba(0,0,0,0) 55%);
            box-shadow: inset 0 0 150px 45px rgba(200,70,20,.5);
            animation: sfxFlamme .5s ease-in-out infinite;
        }

        @keyframes sfxRespire { 0%,100% { opacity: .7; } 50% { opacity: 1; } }
        @keyframes sfxPeur    { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
        @keyframes sfxOuate   { 0%,100% { opacity: .7; } 50% { opacity: 1; } }
        @keyframes sfxFlamme  { 0%,100% { opacity: .8; } 25% { opacity: 1; } 50% { opacity: .7; } 75% { opacity: .95; } }
        @keyframes sfxPaupiere { 0%,100% { transform: scaleY(.82); } 50% { transform: scaleY(1); } }
        @keyframes sfxPoigne  { 0%,100% { transform: scaleX(.82); opacity: .75; } 50% { transform: scaleX(1); opacity: 1; } }
        @keyframes sfxArc     { 0%,100% { opacity: .25; } 50% { opacity: .9; } }
        @keyframes sfxMonte {
            0%   { transform: translateY(0) rotate(-8deg) scale(.85); opacity: 0; }
            12%  { opacity: .9; }
            88%  { opacity: .55; }
            100% { transform: translateY(-118vh) rotate(10deg) scale(1.05); opacity: 0; }
        }
        @keyframes sfxTourne {
            from { transform: rotate(0deg) translateX(var(--x,90px)) rotate(0deg); }
            to   { transform: rotate(360deg) translateX(var(--x,90px)) rotate(-360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
            .sfx-c, .sfx-c::before, .sfx-c::after { animation: none !important; }
            .sfx-coeur, .sfx-bulle, .sfx-etoile { display: none !important; }
            .sfx-c { transition: none !important; }
            body.fx-invisible #app-screen { transition: none !important; }
        }
        /* Rien de tout cela ne s'imprime, et la fiche retrouve son opacité. */
        @media print {
            #status-fx { display: none !important; }
            body.fx-invisible #app-screen { opacity: 1 !important; }
        }`);
    }

    /** Les états en cours : identifiants du SRD, niveaux, et noms des états personnalisés. */
    function mesEtats() {
        if (window.Etats && typeof window.Etats.actifs === 'function') {
            const a = window.Etats.actifs();
            return {
                ids: a.filter(e => !e.perso).map(e => e.srd),
                noms: a.map(e => String(e.nom || '').toLowerCase()),
                epuisement: (a.find(e => e.srd === 'exhaustion') || {}).niveau || 0
            };
        }
        // Repli : les cases de la fiche, si etats.js n'est pas chargé.
        const ids = [];
        try {
            document.querySelectorAll('#conditions-track-container input[type="checkbox"]:checked')
                .forEach(cb => { if (cb.id) ids.push(cb.id); });
        } catch (e) {}
        return { ids: ids, noms: [], epuisement: 0 };
    }

    /** Toutes les couches à afficher — pas une seule : elles se cumulent. */
    function couchesPour(etats) {
        const mot = (kw) => etats.noms.some(n => n.indexOf(kw) !== -1);
        const voulues = COUCHES.filter(id => etats.ids.indexOf(id) !== -1);
        // « En feu » n'est pas un état du SRD : il vient des états personnalisés.
        if (mot('feu') || mot('enflamm') || mot('brûl') || mot('brul')) voulues.push('fire');
        return voulues;
    }

    function actifs() { try { return localStorage.getItem(CLE) !== '0'; } catch (e) { return true; } }

    /** Les particules d'une couche — jamais sous mouvement réduit. */
    function particules(couche, id) {
        const p = PARTICULES[id];
        if (!p || calme()) return;
        for (let i = 0; i < p.n; i++) {
            const el = document.createElement('span');
            el.className = p.classe;
            el.setAttribute('aria-hidden', 'true');
            if (id !== 'poisoned') el.textContent = p.signes[i % p.signes.length];
            if (id === 'stunned') {
                // Les étoiles tournent autour d'un centre, à des rayons différents.
                el.style.setProperty('--x', (75 + Math.random() * 95).toFixed(0) + 'px');
                el.style.setProperty('--t', (24 + Math.random() * 16).toFixed(0) + 'px');
                el.style.setProperty('--d', (2.4 + Math.random() * 1.8).toFixed(1) + 's');
                el.style.setProperty('--r', (-Math.random() * 3).toFixed(1) + 's');
            } else {
                el.style.left = (4 + Math.random() * 92).toFixed(1) + '%';
                el.style.setProperty('--t', (id === 'poisoned' ? 7 + Math.random() * 14 : 14 + Math.random() * 16).toFixed(0) + 'px');
                el.style.setProperty('--d', (6 + Math.random() * 8).toFixed(1) + 's');
                el.style.setProperty('--r', (-Math.random() * 12).toFixed(1) + 's');
            }
            couche.appendChild(el);
        }
    }

    function maj() {
        const app = document.getElementById('app-screen');
        const surFiche = !!(app && !app.classList.contains('hidden'));
        const permis = surFiche && actifs();
        const etats = permis ? mesEtats() : { ids: [], noms: [], epuisement: 0 };
        const voulues = permis ? couchesPour(etats) : [];

        // Invisible : la fiche elle-même s'efface, en plus des couches.
        document.body.classList.toggle('fx-invisible', voulues.indexOf('invisible') !== -1);

        let boite = document.getElementById('status-fx');
        if (!voulues.length) {
            if (boite) boite.remove();
            return;
        }
        stylesVoiles();
        if (!boite) {
            boite = document.createElement('div');
            boite.id = 'status-fx';
            boite.className = 'no-print';
            boite.setAttribute('aria-hidden', 'true');
            document.body.appendChild(boite);
        }
        // Ce qui n'a plus lieu d'être s'en va…
        [...boite.children].forEach(c => {
            const id = c.dataset.etat;
            if (voulues.indexOf(id) === -1) c.remove();
        });
        // …et ce qui manque arrive, dans l'ordre de peinture voulu.
        voulues.forEach(id => {
            let c = boite.querySelector(`[data-etat="${id}"]`);
            if (!c) {
                c = document.createElement('div');
                c.className = 'sfx-c sfx-' + id;
                c.dataset.etat = id;
                boite.appendChild(c);
                particules(c, id);
                void c.offsetWidth;                  // joue la transition d'arrivée
                c.classList.add('on');
            }
            if (id === 'exhaustion') c.style.setProperty('--n', etats.epuisement || 1);
        });
    }

    /** L'interrupteur vit à deux endroits du menu : les deux disent la même chose. */
    function syncInterrupteurs(on) {
        document.querySelectorAll('#toggle-status-fx, [data-fx-etats]').forEach(el => {
            if (el.checked !== on) el.checked = on;
        });
    }

    document.addEventListener('change', (e) => {
        const t = e.target; if (!t) return;
        if (t.id === 'toggle-status-fx' || (t.dataset && t.dataset.fxEtats !== undefined)) {
            try { localStorage.setItem(CLE, t.checked ? '1' : '0'); } catch (err) {}
            syncInterrupteurs(t.checked);
            maj();
            if (window.showAppToast) window.showAppToast(t.checked ? '💥 Effets d’état activés' : '🚫 Effets d’état désactivés');
            return;
        }
        if (t.type === 'checkbox' && t.closest && t.closest('#conditions-track-container')) maj();
    });
    document.addEventListener('screen:change', maj);

    function init() {
        syncInterrupteurs(actifs());
        // La fiche remplit ses conditions pendant son propre chargement : on
        // laisse passer ce tour avant le premier calcul.
        setTimeout(maj, 0);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
    window.addEventListener('load', maj);

    window.StatusFX = { refresh: maj };
})();
