// =====================================================
// secrets-monde.js — les easter eggs du monde (2/2)
//
//   · un Sac sans fond rangé dans un Sac sans fond → faille astrale ;
//   · la Tarasque dans les Règles fait trembler l'écran, le Cube gélatineux gigote ;
//   · cinq clics sur la signature du menu ☰ → le générique de fin ;
//   · plus de 10 000 po dans la Bourse → l'œil du dragon.
// Mêmes règles que secrets.js : jamais bloquant, jamais sur les données.
// =====================================================
(function () {
    'use strict';

    const UI = () => window.SecretsUI;
    const idPerso = () => { try { return localStorage.getItem('dnd-active-char') || ''; } catch (e) { return ''; } };
    const debloquer = (id) => { if (window.Exploits) window.Exploits.debloquer(id); };
    const calme = () => !!(UI() && UI().calme());
    const surFiche = (fn, delai) => document.addEventListener('screen:change', (e) => {
        if (e.detail && e.detail.id === 'app-screen') setTimeout(fn, delai || 0);
    });

    let stylesPoses = false;
    function styles() {
        if (stylesPoses || !UI()) return; stylesPoses = true;
        UI().injecter(`
        .sx-faille { position: fixed; inset: 0; z-index: 100035; pointer-events: none; overflow: hidden; background: radial-gradient(circle, rgba(10,6,30,0) 0, rgba(10,6,30,.55) 60%, rgba(4,2,14,.92)); animation: sxIn 1.9s ease-in both; }
        .sx-faille::before { content: ''; position: absolute; left: 50%; top: 50%; width: 160vmax; height: 160vmax; border-radius: 50%;
            background: conic-gradient(from 0deg, #1b1050, #6d5cff, #b9aaff, #2a1a7a, #ff7ad9, #1b1050, #6d5cff, #1b1050);
            -webkit-mask-image: radial-gradient(circle, #000 0 6%, rgba(0,0,0,.8) 14%, transparent 42%); mask-image: radial-gradient(circle, #000 0 6%, rgba(0,0,0,.8) 14%, transparent 42%);
            animation: sxVortex 1.9s cubic-bezier(.5,0,.3,1) forwards; }
        .sx-faille::after { content: ''; position: absolute; left: 50%; top: 50%; width: 30px; height: 30px; margin: -15px; border-radius: 50%; background: #fff; box-shadow: 0 0 60px 30px rgba(200,190,255,.9); animation: sxCoeur 1.9s ease-in forwards; }
        @keyframes sxVortex { 0% { transform: translate(-50%,-50%) scale(.05); opacity: 0; } 30% { opacity: 1; } 100% { transform: translate(-50%,-50%) scale(1) rotate(-720deg); opacity: 1; } }
        @keyframes sxCoeur { 0% { transform: scale(0); } 70% { transform: scale(1); } 100% { transform: scale(3); opacity: 0; } }

        @keyframes sxIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sxOut { from { opacity: 1; } to { opacity: 0; } }
        body.sx-pas { animation: sxPas .42s cubic-bezier(.2,.8,.3,1); }
        @keyframes sxPas { 0%, 100% { transform: none; } 12% { transform: translateY(7px); } 30% { transform: translateY(-3px); } 50% { transform: translateY(2px); } }
        .sx-poussiere { position: fixed; left: 0; right: 0; bottom: 0; height: 30vh; z-index: 100030; pointer-events: none; transform-origin: bottom;
            background: radial-gradient(ellipse at 50% 100%, rgba(150,120,80,.38), transparent 70%); animation: sxPoussiere .9s ease-out forwards; }
        @keyframes sxPoussiere { 0% { opacity: 0; transform: scaleY(.4); } 30% { opacity: 1; } 100% { opacity: 0; transform: scaleY(1.2); } }

        .sx-gelee { position: relative; transform-origin: 50% 100%; animation: sxGelee 2.8s ease-in-out;
            background-image: linear-gradient(rgba(140,210,110,.14), rgba(140,210,110,.14)) !important; box-shadow: inset 0 0 80px rgba(110,190,80,.35) !important; }
        .sx-gelee > *:not(.sx-bulle) { opacity: .88; }
        @keyframes sxGelee { 0%, 100% { transform: none; } 12% { transform: scale(1.03, .96); } 24% { transform: scale(.97, 1.04); } 36% { transform: scale(1.02, .98) skewX(1.5deg); } 50% { transform: scale(.99, 1.01) skewX(-1deg); } 70% { transform: scale(1.005, .995); } }
        .sx-bulle { position: absolute; bottom: 8px; width: var(--t, 7px); height: var(--t, 7px); border-radius: 50%; pointer-events: none; opacity: 0;
            background: radial-gradient(circle at 35% 35%, rgba(255,255,255,.9), rgba(150,220,120,.35) 60%, transparent 70%); animation: sxBulle 3.6s ease-in infinite; }
        @keyframes sxBulle { 0% { transform: none; opacity: 0; } 15% { opacity: .9; } 100% { transform: translate(8px, -260px); opacity: 0; } }

        .sx-generique { position: fixed; inset: 0; z-index: 100045; background: #050404; color: #efe6d2; overflow: hidden; animation: sxIn .6s ease both; }
        .sx-generique.sort { animation: sxOut .4s ease forwards; }
        .sx-gen-defile { position: absolute; left: 0; right: 0; top: 100%; text-align: center; padding: 0 24px 40px; animation: sxDefile 34s linear .6s forwards; }
        @keyframes sxDefile { from { transform: translateY(0); } to { transform: translateY(calc(-100% - 100vh)); } }
        .sx-gen-logo { width: 110px; height: 110px; margin-bottom: 12px; }
        .sx-generique h2 { margin: 0; padding: 0; border: 0; font-family: 'Cinzel', Georgia, serif; font-size: clamp(2rem, 6vw, 3.4rem); color: #e8c16a; letter-spacing: .06em; background: none; }
        .sx-gen-tag { margin: 6px 0 80px; font-family: 'Lora', Georgia, serif; font-style: italic; opacity: .7; }
        .sx-gen-role { margin: 0 auto 46px; max-width: 540px; }
        .sx-gen-role span { display: block; margin-bottom: 8px; font-family: 'Cinzel', Georgia, serif; font-size: .78rem; letter-spacing: .28em; text-transform: uppercase; color: #c8a24e; }
        .sx-gen-role b { display: block; font-family: 'Lora', Georgia, serif; font-weight: 600; font-size: 1.45rem; line-height: 1.4; }
        .sx-gen-note { margin: 80px 0 18px; font-family: 'Lora', Georgia, serif; font-style: italic; opacity: .6; }
        .sx-gen-fin { margin: 100px 0 10px; font-family: 'Lora', Georgia, serif; font-size: 1.2rem; }
        .sx-gen-fin2 { margin: 0; font-family: 'Cinzel', Georgia, serif; font-size: 1.6rem; color: #e8c16a; }
        .sx-gen-passer { position: absolute; right: 18px; bottom: 18px; min-height: 40px; padding: 8px 16px; border-radius: 999px; cursor: pointer; color: #efe6d2; background: rgba(255,255,255,.08); border: 1px solid rgba(239,230,210,.3); font-family: 'Lora', Georgia, serif; }

        .sx-oeil { position: absolute; top: 2px; left: 50%; width: 110px; margin-left: -55px; z-index: 5; pointer-events: none; text-align: center; filter: drop-shadow(0 0 14px rgba(255,140,40,.55)); animation: sxOeil 4.8s ease forwards; }
        .sx-oeil svg { width: 110px; height: 55px; display: block; overflow: visible; }
        .sx-oeil em { display: block; margin-top: 2px; font-family: 'Lora', Georgia, serif; font-size: .75rem; color: #e08a1e; opacity: 0; animation: sxOeilMot 4.8s ease forwards; }
        .sx-paupiere { transform-box: view-box; animation: sxPaupiereH 4.8s ease-in-out forwards; }
        .sx-oeil .sx-bas { animation-name: sxPaupiereB; }
        .sx-regard { animation: sxRegard 4.8s ease-in-out forwards; }
        @keyframes sxPaupiereH { 0%, 8% { transform: none; } 20%, 48% { transform: translateY(-62px); } 53% { transform: none; } 58%, 84% { transform: translateY(-62px); } 96%, 100% { transform: none; } }
        @keyframes sxPaupiereB { 0%, 8% { transform: none; } 20%, 48% { transform: translateY(62px); } 53% { transform: none; } 58%, 84% { transform: translateY(62px); } 96%, 100% { transform: none; } }
        @keyframes sxRegard { 0%, 22% { transform: none; } 32% { transform: translateX(-12px); } 44% { transform: translateX(12px); } 62%, 80% { transform: translateY(6px); } 100% { transform: none; } }
        @keyframes sxOeil { 0% { opacity: 0; transform: translateY(10px); } 8%, 92% { opacity: 1; transform: none; } 100% { opacity: 0; } }
        @keyframes sxOeilMot { 0%, 60% { opacity: 0; } 68%, 88% { opacity: 1; } 100% { opacity: 0; } }

        body.sx-liche { --primary-color: #1f4a33; --primary-hover: #2b6346; --accent-color: #7dffa8; }
        #sx-liche-voile { position: fixed; inset: 0; z-index: 9950; pointer-events: none; box-shadow: inset 0 0 200px 70px rgba(40,200,110,.3);
            background: radial-gradient(ellipse at 50% 120%, rgba(60,255,140,.12), transparent 60%); animation: sxLiche 5s ease-in-out infinite; }
        @keyframes sxLiche { 0%, 100% { opacity: .75; } 50% { opacity: 1; } }
        .sx-rire { animation: sxRire .09s linear 10; }
        @keyframes sxRire { 0%, 100% { transform: none; } 50% { transform: translateY(-4px) rotate(-3deg); } }
        .sx-bulle-crane { position: fixed; z-index: 100020; padding: 8px 14px; border-radius: 16px; background: #fffaf0; color: #2b1d14; pointer-events: none; transform: translate(-50%, -100%);
            font-family: 'Lora', Georgia, serif; font-style: italic; font-size: .95rem; box-shadow: 0 6px 18px rgba(0,0,0,.25); animation: sxIn .25s ease both; }
        .sx-bulle-crane::after { content: ''; position: absolute; left: 50%; bottom: -7px; margin-left: -7px; border: 7px solid transparent; border-top-color: #fffaf0; border-bottom: 0; }

        @media (prefers-reduced-motion: reduce) {
            .sx-rire, #sx-liche-voile { animation: none !important; }
            .sx-faille, .sx-faille::before, .sx-faille::after, .sx-gelee, .sx-bulle, .sx-oeil, .sx-oeil * { animation: none !important; }
            .sx-paupiere { display: none; } .sx-oeil em { opacity: 1; }
            .sx-generique { overflow-y: auto; } .sx-gen-defile { position: static; animation: none; padding-top: 60px; }
        }`);
    }

    // =====================================================
    // SAC SANS FOND DANS UN SAC SANS FOND
    // =====================================================
    // L'inventaire n'imbrique pas les objets : on « range » un objet dans une
    // catégorie. Le secret se déclenche donc quand un espace extradimensionnel
    // (Sac sans fond, Havresac, Trou portatif) atterrit dans une catégorie qui
    // en porte le nom. script.js prévient à chaque écriture du sac.
    const EXTRA = /sac sans fond|havresac|trou portati|puits portati/i;
    function sacDansSac() {
        let inv = [];
        try { inv = JSON.parse(localStorage.getItem(idPerso() + '_dnd-inventory') || '[]') || []; } catch (e) {}
        return Array.isArray(inv) && inv.some(it => it && EXTRA.test(String(it.name || '')) && EXTRA.test(String(it.category || '')));
    }
    let sacAvant = null;
    surFiche(() => { sacAvant = sacDansSac(); }, 300);
    document.addEventListener('fiche:inventaire', () => {
        const maintenant = sacDansSac();
        if (sacAvant !== true && maintenant) faille();
        sacAvant = maintenant;
    });

    function faille() {
        if (!UI()) return;
        const r = window.Exploits ? window.Exploits.debloquer('astral', { silencieux: true }) : { nouveau: false };
        styles();
        const suite = () => UI().banniere({
            theme: 'astral', rayons: false, surtitre: '✦ Faille astrale ✦', titre: 'Un sac dans un sac ?!',
            phrase: 'Selon les règles, ranger un Sac sans fond dans un autre espace extradimensionnel détruit les deux objets et ouvre un portail vers le plan Astral, qui aspire tout ce qui se trouve à 3 mètres. Ici, on te les laisse. <b>Pour cette fois.</b>' + (r.nouveau ? ' Le style <b>Astral</b> de la carte de héros est débloqué pour tous tes personnages.' : ''),
            actions: [{ label: 'Ouf. Continuer', principal: true }]
        });
        if (calme()) { suite(); return; }
        const vortex = document.createElement('div');
        vortex.className = 'sx-faille no-print'; vortex.setAttribute('aria-hidden', 'true');
        document.body.appendChild(vortex);
        setTimeout(() => { vortex.remove(); suite(); }, 1900);
    }

    // =====================================================
    // MONSTRES VIVANTS (écran Règles et recherche globale)
    // =====================================================
    document.addEventListener('regles:fiche', (e) => {
        const d = e.detail || {};
        document.querySelectorAll('.sx-gelee').forEach(b => b.classList.remove('sx-gelee'));
        if (d.id === 'tarrasque') tarasque();
        else if (d.id === 'gelatinous-cube' && d.box) cube(d.box);
    });

    function tarasque() {
        debloquer('tarasque');
        if (calme()) return;
        styles();
        [400, 1350, 2300, 3250].forEach(t => setTimeout(() => {
            document.body.classList.remove('sx-pas'); void document.body.offsetWidth; document.body.classList.add('sx-pas');
            const p = document.createElement('div'); p.className = 'sx-poussiere no-print';
            document.body.appendChild(p); setTimeout(() => p.remove(), 900);
        }, t));
        setTimeout(() => document.body.classList.remove('sx-pas'), 3800);
    }

    function cube(box) {
        debloquer('cube');
        styles();
        box.classList.add('sx-gelee');
        if (calme()) return;
        for (let i = 0; i < 9; i++) {
            const b = document.createElement('i');
            b.className = 'sx-bulle';
            b.style.left = (8 + Math.random() * 84) + '%';
            b.style.animationDelay = (Math.random() * 3).toFixed(2) + 's';
            b.style.setProperty('--t', (5 + Math.random() * 5).toFixed(1) + 'px');
            box.appendChild(b);
        }
    }

    // =====================================================
    // LE GÉNÉRIQUE — cinq clics sur la signature du menu ☰
    // =====================================================
    let clics = [];
    document.addEventListener('click', (e) => {
        if (!e.target || !e.target.closest || !e.target.closest('#menu-signature')) return;
        const t = Date.now();
        clics = clics.filter(x => t - x < 3000);
        clics.push(t);
        if (clics.length >= 5) { clics = []; generique(); }
    });

    function generique() {
        if (!UI() || document.querySelector('.sx-generique')) return;
        styles();
        const menu = document.getElementById('settings-dropdown'); if (menu) menu.classList.add('hidden');
        const esc = UI().esc;
        const srd = (window.SRD && window.SRD.attribution) || 'SRD 5.1 (Wizards of the Coast) — CC-BY-4.0';
        const role = (titre, ...noms) => `<div class="sx-gen-role"><span>${titre}</span>${noms.map(n => `<b>${esc(n)}</b>`).join('')}</div>`;
        const el = document.createElement('div');
        el.className = 'sx-generique no-print'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Générique de fin');
        el.innerHTML = `<div class="sx-gen-defile">
                <img src="IMG/logo-256.png" alt="" class="sx-gen-logo">
                <h2>Bones &amp; Blades</h2>
                <p class="sx-gen-tag">Fiches de personnage, forgées dé après dé.</p>
                ${role('Imaginé et forgé par', 'Charlie', 'Baptiste')}
                ${role('Code, sueur et café', 'Charlie', 'Baptiste')}
                ${role('Tests en conditions réelles', 'Charlie', 'Baptiste')}
                ${role('Jets de dés ratés pendant le développement', 'Beaucoup trop')}
                ${role('Maître du jeu', 'Le hasard')}
                ${role('Voix du crâne', 'Lui-même')}
                ${role('Cascades', 'Un gobelin très courageux')}
                ${role('Dés 3D', 'dice-box', 'et la gravité')}
                ${role('Règles', srd)}
                ${role('Avec l’aide de', 'Supabase', 'Quill')}
                <p class="sx-gen-note">Aucun kobold n’a été maltraité pendant le développement.</p>
                <p class="sx-gen-fin">Merci à toi, qui as tenu jusqu’au bout du générique.</p>
                <p class="sx-gen-fin2">Et maintenant… lance un d20.</p>
            </div>
            <button type="button" class="sx-gen-passer">Passer ✕</button>`;
        document.body.appendChild(el);
        const touche = (e) => { if (e.key === 'Escape') fermer(); };
        function fermer() {
            if (el.classList.contains('sort')) return;
            debloquer('generique');
            document.removeEventListener('keydown', touche);
            el.classList.add('sort');
            setTimeout(() => el.remove(), 400);
        }
        document.addEventListener('keydown', touche);
        el.querySelector('.sx-gen-passer').addEventListener('click', fermer);
        el.querySelector('.sx-gen-defile').addEventListener('animationend', fermer);
        try { el.querySelector('.sx-gen-passer').focus({ preventScroll: true }); } catch (e) {}
    }

    // =====================================================
    // L'ŒIL DU DRAGON — plus de 10 000 po dans la Bourse
    // =====================================================
    const SEUIL = 10000;
    function fortune() {
        const v = (k) => parseFloat(String((document.getElementById('coin-' + k) || {}).value || '0').replace(',', '.')) || 0;
        return v('pp') * 10 + v('po') + v('pe') * 0.5 + v('pa') * 0.1 + v('pc') * 0.01;
    }
    let richeAvant = null, guetteur = null;
    // Filet : une fiche déjà ouverte au chargement n'annonce pas toujours son écran.
    window.addEventListener('load', () => setTimeout(() => {
        if (sacAvant == null) sacAvant = sacDansSac();
        if (richeAvant == null) richeAvant = fortune() > SEUIL;
    }, 900));
    surFiche(() => {
        richeAvant = fortune() > SEUIL;
        // Une fiche déjà riche : l'œil s'ouvre une fois par session, quand la Bourse passe à l'écran.
        if (!('IntersectionObserver' in window)) return;
        const w = document.getElementById('widget-currency'); if (!w) return;
        if (guetteur) guetteur.disconnect();
        guetteur = new IntersectionObserver((entrees) => {
            if (!entrees.some(x => x.isIntersecting)) return;
            guetteur.disconnect();
            if (fortune() > SEUIL) setTimeout(oeil, 700);
        }, { threshold: 0.6 });
        guetteur.observe(w);
    }, 500);
    document.addEventListener('input', (e) => {
        if (!e.target || !/^coin-(pc|pa|pe|po|pp)$/.test(e.target.id)) return;
        const riche = fortune() > SEUIL;
        if (richeAvant === false && riche) oeil(true);
        richeAvant = riche;
    });

    function oeil(force) {
        const cle = 'dnd-oeil-vu-' + idPerso();
        try { if (!force && sessionStorage.getItem(cle)) return; sessionStorage.setItem(cle, '1'); } catch (e) {}
        const hote = document.querySelector('#widget-currency .dynamic-box');
        if (!hote || !UI()) return;
        debloquer('dragon');
        styles();
        if (getComputedStyle(hote).position === 'static') hote.style.position = 'relative';
        const ancien = hote.querySelector('.sx-oeil'); if (ancien) ancien.remove();
        const el = document.createElement('div');
        el.className = 'sx-oeil no-print'; el.setAttribute('aria-hidden', 'true');
        el.innerHTML = `<svg viewBox="0 0 120 60">
                <defs>
                    <radialGradient id="sxIris" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff0a0"/><stop offset=".45" stop-color="#f0a42a"/><stop offset="1" stop-color="#6e2408"/></radialGradient>
                    <clipPath id="sxOeilForme"><path d="M4 30 Q60 -8 116 30 Q60 68 4 30Z"/></clipPath>
                </defs>
                <g clip-path="url(#sxOeilForme)">
                    <rect x="0" y="0" width="120" height="60" fill="#140a05"/>
                    <g class="sx-regard"><circle cx="60" cy="30" r="21" fill="url(#sxIris)"/><ellipse cx="60" cy="30" rx="3.4" ry="18" fill="#080302"/><circle cx="53" cy="23" r="3" fill="#fff" opacity=".75"/></g>
                    <rect class="sx-paupiere sx-haut" x="-2" y="-62" width="124" height="92" fill="#4a1f10"/>
                    <rect class="sx-paupiere sx-bas" x="-2" y="30" width="124" height="92" fill="#3a170b"/>
                </g>
                <path d="M4 30 Q60 -8 116 30 Q60 68 4 30Z" fill="none" stroke="#b8561f" stroke-width="2.4"/>
            </svg><em>…tant d’or.</em>`;
        hote.appendChild(el);
        setTimeout(() => el.remove(), calme() ? 3000 : 4800);
    }
    // =====================================================
    // LE CODE KONAMI — le mode Liche, le temps d'une séance
    // =====================================================
    const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
    let saisie = [];
    document.addEventListener('keydown', (e) => {
        const t = e.target;
        if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName || ''))) return;
        saisie.push(String(e.key || '').toLowerCase());
        saisie = saisie.slice(-KONAMI.length);
        if (saisie.join() === KONAMI.join()) { saisie = []; liche(); }
    });
    function liche() {
        styles();
        const actif = document.body.classList.toggle('sx-liche');
        let voile = document.getElementById('sx-liche-voile');
        if (actif && !voile) {
            voile = document.createElement('div');
            voile.id = 'sx-liche-voile'; voile.className = 'no-print'; voile.setAttribute('aria-hidden', 'true');
            document.body.appendChild(voile);
        }
        if (!actif && voile) voile.remove();
        if (window.showAppToast) window.showAppToast(actif ? '☠️ Mode Liche. Refais le code pour revenir parmi les vivants.' : '🌅 Retour parmi les vivants.');
        if (actif) setTimeout(() => debloquer('konami'), 2600);
    }

    // =====================================================
    // LE CRÂNE CHATOUILLEUX — sept clics sur le logo de l'accueil
    // =====================================================
    let clicsCrane = [];
    document.addEventListener('click', (e) => {
        const logo = e.target && e.target.closest && e.target.closest('.brand-logo');
        if (!logo) return;
        const t = Date.now();
        clicsCrane = clicsCrane.filter(x => t - x < 4000);
        clicsCrane.push(t);
        if (clicsCrane.length < 7) return;
        clicsCrane = [];
        styles();
        logo.classList.remove('sx-rire'); void logo.offsetWidth; logo.classList.add('sx-rire');
        const r = logo.getBoundingClientRect();
        const bulle = document.createElement('div');
        bulle.className = 'sx-bulle-crane no-print'; bulle.setAttribute('role', 'status');
        bulle.textContent = 'Arrête, ça chatouille !';
        bulle.style.left = (r.left + r.width / 2) + 'px'; bulle.style.top = Math.max(40, r.top - 8) + 'px';
        document.body.appendChild(bulle);
        setTimeout(() => { bulle.remove(); logo.classList.remove('sx-rire'); }, 2400);
        debloquer('crane7');
    });
})();
