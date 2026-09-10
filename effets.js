// =====================================================
// effets.js — les effets visuels de la fiche
//
// Deux familles, toutes deux déclenchées par TA fiche, sans réseau :
//   · RollFX : la pluie d'étincelles d'un 20 naturel, la secousse d'un 1 ;
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

    window.RollFX = { crit, fumble };

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
