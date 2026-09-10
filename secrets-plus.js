// =====================================================
// secrets-plus.js — encore des easter eggs (3/3)
//
//   · l'onglet délaissé, le crâne de la console ;
//   · le 31 octobre (toiles d'araignée), le 1er avril (poisson de parchemin) ;
//   · la pleine lune et le vendredi 13 (et leurs styles de carte) ;
//   · des noms qui font réagir, un seul PV, une corde, un poulet, 42 po ;
//   · une pluie de dés, un 100 sur le d100, un vieux code de triche ;
//   · la Mimique, cachée dans la recherche des Règles (et son style).
// Mêmes règles que secrets.js : jamais bloquant, jamais sur les données.
// =====================================================
(function () {
    'use strict';

    const UI = () => window.SecretsUI;
    const debloquer = (id, o) => (window.Exploits ? window.Exploits.debloquer(id, o) : null);
    const toast = (m) => { if (window.showAppToast) window.showAppToast(m); };
    const idPerso = () => { try { return localStorage.getItem('dnd-active-char') || ''; } catch (e) { return ''; } };
    const calme = () => !!(UI() && UI().calme());
    const normal = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const horsSaisie = (t) => !(t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName || '')));
    const surFiche = (fn, delai) => document.addEventListener('screen:change', (e) => {
        if (e.detail && e.detail.id === 'app-screen') setTimeout(fn, delai || 0);
    });

    const TOILE = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none" stroke="rgba(215,215,215,.6)" stroke-width="1"><path d="M0 0L120 120M0 0L120 60M0 0L60 120M0 0L120 18M0 0L18 120"/><path d="M30 0Q25 25 0 30M60 0Q50 50 0 60M90 0Q75 75 0 90M120 0Q100 100 0 120"/></svg>');

    let stylesPoses = false;
    function styles() {
        if (stylesPoses || !UI()) return; stylesPoses = true;
        UI().injecter(`
        @keyframes sxIn { from { opacity: 0; } to { opacity: 1; } }
        .sx-toile { position: fixed; width: 150px; height: 150px; z-index: 9940; pointer-events: none; opacity: .75; background: url("${TOILE}") no-repeat; background-size: contain; }
        .sx-poisson { position: fixed; right: 26px; bottom: 96px; width: 110px; height: 55px; padding: 0; border: 0; background: none; cursor: pointer; z-index: 9945; transform: rotate(-12deg); filter: drop-shadow(0 3px 4px rgba(0,0,0,.3)); }
        .sx-poisson svg { width: 100%; height: 100%; display: block; }
        .sx-poisson.decolle { transition: transform .5s, opacity .5s; transform: rotate(30deg) translateY(-40px); opacity: 0; }
        .sx-poulet { position: fixed; bottom: 14px; left: -60px; font-size: 44px; z-index: 100020; pointer-events: none; transform: scaleX(-1); animation: sxPoulet 3s linear forwards, sxSaut .22s ease-in-out infinite alternate; }
        @keyframes sxPoulet { to { left: calc(100vw + 60px); } }
        @keyframes sxSaut { to { transform: translateY(-12px) scaleX(-1); } }
        .sx-pluie { position: fixed; inset: 0; pointer-events: none; z-index: 100020; overflow: hidden; }
        .sx-pluie i { position: absolute; top: -60px; font-style: normal; animation: sxPluie 1.6s cubic-bezier(.5,0,.8,1) forwards; }
        @keyframes sxPluie { to { transform: translateY(115vh) rotate(540deg); } }
        .sx-mimique { position: fixed; inset: 0; z-index: 100040; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; cursor: pointer; background: rgba(10,6,3,.78); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); animation: sxIn .3s ease both; }
        .sx-coffre { position: relative; width: 210px; height: 170px; margin-bottom: 22px; animation: sxTremble .12s linear 6 .15s; }
        @keyframes sxTremble { 50% { transform: translateX(3px) rotate(1deg); } }
        .sx-caisse { position: absolute; left: 0; right: 0; bottom: 0; height: 104px; border-radius: 10px 10px 14px 14px; background: linear-gradient(#8a5a2b, #5a3616); border: 5px solid #3a2410; box-shadow: inset 0 0 0 6px rgba(200,160,80,.35); }
        .sx-couvercle { position: absolute; left: -4px; right: -4px; top: 0; height: 72px; z-index: 2; border-radius: 42px 42px 8px 8px; background: linear-gradient(#9a6a36, #6a4420); border: 5px solid #3a2410; transform-origin: 20% 100%; animation: sxCouvercle 1.1s cubic-bezier(.3,1.6,.5,1) .9s both; }
        @keyframes sxCouvercle { 0% { transform: none; } 100% { transform: translateY(-30px) rotate(-16deg); } }
        .sx-dents-h, .sx-dents-b { position: absolute; left: 12px; right: 12px; height: 16px; background-size: 16px 16px; background-repeat: repeat-x; }
        .sx-dents-h { bottom: -21px; background-image: linear-gradient(135deg, #f4efe2 25%, transparent 25%), linear-gradient(225deg, #f4efe2 25%, transparent 25%); }
        .sx-dents-b { top: -16px; background-image: linear-gradient(45deg, #f4efe2 25%, transparent 25%), linear-gradient(315deg, #f4efe2 25%, transparent 25%); }
        .sx-langue { position: absolute; left: 50%; top: -6px; width: 46px; height: 62px; margin-left: -23px; border-radius: 23px 23px 30px 30px; background: #c2415a; transform-origin: 50% 0; transform: scaleY(0); animation: sxLangue .45s ease-in-out 1.5s 4 alternate both; }
        @keyframes sxLangue { from { transform: scaleY(.2); } to { transform: scaleY(1) rotate(9deg); } }
        .sx-mimique p { margin: 0; text-align: center; color: #f6ead0; text-shadow: 0 2px 10px rgba(0,0,0,.9); }
        .sx-mim-titre { font-family: 'Cinzel', Georgia, serif; font-weight: 700; font-size: clamp(1.6rem, 5vw, 2.6rem); }
        .sx-mim-sous { font-family: 'Lora', Georgia, serif; font-style: italic; opacity: .85; }
        .sx-mim-sous b { font-style: normal; color: #e8c16a; }
        @media (prefers-reduced-motion: reduce) { .sx-coffre, .sx-couvercle, .sx-langue, .sx-poulet, .sx-pluie i { animation: none !important; } .sx-couvercle { transform: translateY(-30px) rotate(-16deg); } .sx-langue { transform: none; } }`);
    }

    // ---------- L'onglet délaissé ----------
    let titreAvant = '', minuteurTitre = null;
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            titreAvant = document.title;
            minuteurTitre = setTimeout(() => { document.title = '💀 Ton héros s’impatiente…'; }, 60000);
        } else {
            clearTimeout(minuteurTitre);
            if (document.title.indexOf('💀') === 0 && titreAvant) document.title = titreAvant;
        }
    });

    // ---------- Pour les curieux qui ouvrent la console ----------
    try {
        console.log('%c' + String.raw`
      .-"""-.
     / _   _ \
     |(_) (_)|
     \   ^   /
      |'''''|
      '-----'`, 'color:#c49b35;font-family:monospace;font-size:13px;line-height:1.1');
        console.log('%cTu fouilles le code ? Jet de Discrétion… raté. Bienvenue quand même, aventurier.', 'color:#c49b35;font-style:italic');
    } catch (e) {}

    // ---------- Le calendrier ----------
    function uneFoisParJour(cle) {
        const jour = new Date().toDateString();
        try { if (localStorage.getItem('dnd-vu-' + cle) === jour) return false; localStorage.setItem('dnd-vu-' + cle, jour); } catch (e) {}
        return true;
    }
    function phaseLune(d) {
        const synodique = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
        const jours = (d.getTime() - ref) / 86400000;
        return ((jours % synodique) + synodique) % synodique;
    }
    function calendrier() {
        const t = new Date(), m = t.getMonth() + 1, j = t.getDate(), h = t.getHours();
        if (m === 10 && j === 31 && !document.querySelector('.sx-toile')) {
            styles();
            [['0', '0', ''], ['auto', '0', 'scaleX(-1)'], ['0', 'auto', 'scaleY(-1)'], ['auto', 'auto', 'scale(-1,-1)']].forEach(([l, tp, tr], i) => {
                const el = document.createElement('i');
                el.className = 'sx-toile no-print'; el.setAttribute('aria-hidden', 'true');
                el.style.left = i % 2 ? 'auto' : '0'; el.style.right = i % 2 ? '0' : 'auto';
                el.style.top = i < 2 ? '0' : 'auto'; el.style.bottom = i < 2 ? 'auto' : '0';
                el.style.transform = tr;
                document.body.appendChild(el);
            });
        }
        if (m === 4 && j === 1) poisson();
        // La pleine lune, à un jour près, le soir venu
        if (Math.abs(phaseLune(t) - 14.77) < 1 && (h >= 19 || h < 5) && uneFoisParJour('lune')) {
            debloquer('pleine-lune');
            setTimeout(() => toast('🌕 La lune est pleine ce soir. Les lycanthropes du groupe sont nerveux.'), 2600);
        }
        if (t.getDay() === 5 && j === 13 && uneFoisParJour('treize')) {
            debloquer('vendredi13');
            setTimeout(() => toast('🪞 Vendredi 13. Tes dés tremblent un peu.'), 2600);
        }
    }
    function poisson() {
        try { if (sessionStorage.getItem('dnd-poisson') || document.querySelector('.sx-poisson')) return; } catch (e) {}
        styles();
        const el = document.createElement('button');
        el.type = 'button'; el.className = 'sx-poisson no-print'; el.title = 'Hmm ?';
        el.innerHTML = '<svg viewBox="0 0 120 60"><path d="M8 30 Q40 0 80 22 L112 6 L104 30 L112 54 L80 38 Q40 60 8 30Z" fill="#f3e6c4" stroke="#6b4a2a" stroke-width="2.5"/><circle cx="28" cy="27" r="3.5" fill="#6b4a2a"/><path d="M52 18 Q58 30 52 42" stroke="#6b4a2a" stroke-width="2" fill="none"/></svg>';
        el.addEventListener('click', () => {
            el.classList.add('decolle');
            toast('🐟 Poisson d’avril !');
            try { sessionStorage.setItem('dnd-poisson', '1'); } catch (e) {}
            setTimeout(() => el.remove(), 600);
        });
        document.body.appendChild(el);
    }
    surFiche(calendrier, 900);
    window.addEventListener('load', () => setTimeout(calendrier, 1200));

    // ---------- Des noms qui font réagir ----------
    const NOMS = [
        [/^bob\b/, 'Encore un Bob ? Le cimetière du village en compte déjà trois.'],
        [/^personne$/, 'Personne ? Le cyclope du coin s’en souviendra.'],
        [/^merlin\b/, 'Merlin ? Ton grimoire date un peu, non ?']
    ];
    let minuteurNom = null;
    document.addEventListener('input', (e) => {
        if (!e.target || e.target.id !== 'char-name') return;
        clearTimeout(minuteurNom);
        const champ = e.target;
        minuteurNom = setTimeout(() => {
            const n = normal(champ.value);
            const trouve = NOMS.find(([re]) => re.test(n));
            if (!trouve) return;
            try { const cle = 'dnd-nom-vu-' + idPerso() + '-' + n; if (sessionStorage.getItem(cle)) return; sessionStorage.setItem(cle, '1'); } catch (x) {}
            toast('😏 ' + trouve[1]);
        }, 1200);
    });

    // ---------- Un seul PV ----------
    let pvAvant = null;
    document.addEventListener('focusin', (e) => { if (e.target && e.target.id === 'hp-current') pvAvant = parseInt(e.target.value, 10); });
    document.addEventListener('input', (e) => {
        if (!e.target || e.target.id !== 'hp-current') return;
        const pv = parseInt(e.target.value, 10);
        if (pv === 1 && pvAvant !== 1) toast('🪦 Un PV. Le barde compose déjà ton épitaphe.');
        pvAvant = pv;
    });

    // ---------- Le sac : une corde, un poulet ----------
    const objets = () => { try { const a = JSON.parse(localStorage.getItem(idPerso() + '_dnd-inventory') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
    let sacConnu = null;
    surFiche(() => { sacConnu = new Set(objets().map(o => normal(o && o.name))); }, 300);
    // Filet : une fiche déjà ouverte au chargement n'annonce pas toujours son écran.
    window.addEventListener('load', () => setTimeout(() => { if (!sacConnu) sacConnu = new Set(objets().map(o => normal(o && o.name))); }, 900));
    document.addEventListener('fiche:inventaire', () => {
        const noms = objets().map(o => normal(o && o.name));
        const nouveaux = sacConnu ? noms.filter(n => !sacConnu.has(n)) : [];
        sacConnu = new Set(noms);
        if (nouveaux.some(n => /\bcorde\b/.test(n))) toast('🪢 Une corde. Ton MJ est secrètement fier de toi.');
        if (nouveaux.some(n => /\b(poulet|poule|coq)\b/.test(n))) poulet();
    });
    function poulet() {
        toast('🐔 Cot cot ! Il s’est échappé du sac.');
        if (calme()) return;
        styles();
        const el = document.createElement('div');
        el.className = 'sx-poulet no-print'; el.setAttribute('aria-hidden', 'true'); el.textContent = '🐔';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3200);
    }

    // ---------- 42 pièces d'or ----------
    let minuteur42 = null;
    document.addEventListener('input', (e) => {
        if (!e.target || e.target.id !== 'coin-po') return;
        clearTimeout(minuteur42);
        const champ = e.target;
        if (String(champ.value).trim() === '42') minuteur42 = setTimeout(() => { if (String(champ.value).trim() === '42') toast('🌌 42 pièces d’or. La réponse, apparemment.'); }, 900);
    });

    // ---------- Le plateau de dés (script.js prévient à chaque lancer) ----------
    document.addEventListener('plateau:lance', (e) => {
        const d = e.detail || {}, des = d.des || [], scores = d.scores || [];
        if (des.length >= 20) pluie();
        else if (des.length === 1 && des[0] === 100 && scores[0] === 100) toast('💯 Un 100 sur le d100. Centenaire !');
    });
    function pluie() {
        toast('🎲 Vingt dés d’un coup ? Tu cherches un 20, toi.');
        if (calme()) return;
        styles();
        const zone = document.createElement('div');
        zone.className = 'sx-pluie no-print'; zone.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < 26; i++) {
            const s = document.createElement('i');
            s.textContent = '🎲';
            s.style.left = (Math.random() * 100).toFixed(1) + '%';
            s.style.animationDelay = (Math.random() * 0.9).toFixed(2) + 's';
            s.style.fontSize = Math.round(18 + Math.random() * 22) + 'px';
            zone.appendChild(s);
        }
        document.body.appendChild(zone);
        setTimeout(() => zone.remove(), 2700);
    }

    // ---------- Un vieux code de triche ----------
    let frappe = '';
    document.addEventListener('keydown', (e) => {
        if (!horsSaisie(e.target) || !e.key || e.key.length !== 1) return;
        frappe = (frappe + e.key.toLowerCase()).slice(-5);
        if (frappe === 'iddqd') { frappe = ''; toast('🛡️ Mode dieu refusé. Ceci est un jeu de rôle, pas un jeu de tir.'); }
    });

    // ---------- La Mimique, cachée dans la recherche des Règles ----------
    let minuteurCoffre = null;
    document.addEventListener('input', (e) => {
        if (!e.target || e.target.id !== 'rules-search') return;
        clearTimeout(minuteurCoffre);
        if (/^coffres?( au tresor)?$/.test(normal(e.target.value))) minuteurCoffre = setTimeout(mimique, 700);
    });
    function mimique() {
        if (!UI() || document.querySelector('.sx-mimique')) return;
        styles();
        const r = debloquer('mimique', { silencieux: true });
        const el = document.createElement('div');
        el.className = 'sx-mimique no-print'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Mimique');
        el.innerHTML = `<div class="sx-coffre" aria-hidden="true">
                <div class="sx-couvercle"><span class="sx-dents-h"></span></div>
                <div class="sx-caisse"><span class="sx-dents-b"></span><span class="sx-langue"></span></div>
            </div>
            <p class="sx-mim-titre">C’était une Mimique !</p>
            <p class="sx-mim-sous">Aucun coffre n’est digne de confiance.${r && r.nouveau ? ' Style <b>Mimique</b> débloqué pour tous tes personnages.' : ''}</p>`;
        document.body.appendChild(el);
        let fini = false;
        const fin = () => {
            if (fini) return; fini = true;
            el.remove();
            // La recherche montre alors la vraie coupable
            const champ = document.getElementById('rules-search');
            if (champ) { champ.value = 'Mimique'; champ.dispatchEvent(new Event('input', { bubbles: true })); }
        };
        el.addEventListener('click', fin);
        setTimeout(fin, 3400);
    }
})();
