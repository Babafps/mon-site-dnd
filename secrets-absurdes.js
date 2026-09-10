// =====================================================
// secrets-absurdes.js — les easter eggs idiots (et fiers de l'être)
//
//   · une tarte à la crème qui s'écrase sur l'écran, une chaussette orpheline,
//     de la mayonnaise, du ketchup interdit, une baguette pas magique ;
//   · un objet de poids négatif, et le sac qui s'envole ;
//   · des caractéristiques à 1, une vitesse de 0, un niveau 0 ;
//   · Kevin, Jean-Michel, Gérard, Brigitte et Jean-Claude ;
//   · un chat sur le clavier, un cri de guerre en majuscules, des moutons ;
//   · le héros qui ronfle quand on ne touche plus à rien ;
//   · Ctrl+S, le d1, le d0, et le d20 qui fait grève.
// Même règle que les autres secrets : ça fait rire, ça ne bloque rien, et ça
// ne touche ni aux données de la fiche ni au hasard. Les messages passent par
// le murmure de exploits.js.
// =====================================================
(function () {
    'use strict';

    const UI = () => window.SecretsUI;
    const calme = () => !!(UI() && UI().calme());
    const idPerso = () => { try { return localStorage.getItem('dnd-active-char') || ''; } catch (e) { return ''; } };
    const normal = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const horsSaisie = (t) => !(t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName || '')));
    const dire = (icone, texte, o) => { const u = UI(); if (u && u.murmure) u.murmure(Object.assign({ icone, texte, titre: 'Hmm.' }, o || {})); };
    const unParSession = (cle) => {
        try { const k = 'dnd-absurde-' + idPerso() + '-' + cle; if (sessionStorage.getItem(k)) return false; sessionStorage.setItem(k, '1'); } catch (e) {}
        return true;
    };
    const dernieresFois = {};
    const pasAvant = (cle, ms) => { const n = Date.now(); if (dernieresFois[cle] && n - dernieresFois[cle] < ms) return false; dernieresFois[cle] = n; return true; };
    const surFiche = (fn, delai) => document.addEventListener('screen:change', (e) => {
        if (e.detail && e.detail.id === 'app-screen') setTimeout(fn, delai || 0);
    });

    let stylesPoses = false;
    function styles() {
        if (stylesPoses || !UI()) return; stylesPoses = true;
        UI().injecter(`
        .ab-tarte { position: fixed; top: 38%; right: -140px; z-index: 100022; width: 120px; pointer-events: none; animation: abTarteVol .55s cubic-bezier(.5,0,.9,.6) forwards; }
        .ab-tarte svg, .ab-splat svg { display: block; width: 100%; height: 100%; overflow: visible; }
        @keyframes abTarteVol { to { transform: translate(calc(-50vw - 60px), 0) rotate(-540deg) scale(1.6); opacity: 0; } }
        .ab-splat { position: fixed; left: 50%; top: 42%; z-index: 100022; width: min(460px, 80vw); aspect-ratio: 1; pointer-events: none; opacity: 0; transform: translate(-50%, -50%) scale(.2);
            filter: drop-shadow(0 6px 10px rgba(0,0,0,.25)); animation: abSplat .25s cubic-bezier(.2,1.4,.4,1) .5s forwards, abGlisse 3.4s ease-in 1.2s forwards; }
        @keyframes abSplat { to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
        @keyframes abGlisse { from { transform: translate(-50%, -50%) scale(1); opacity: 1; } to { transform: translate(-50%, -18%) scale(1, 1.15); opacity: 0; } }
        .ab-pattes { position: fixed; left: 0; right: 0; bottom: 18px; height: 44px; z-index: 100022; pointer-events: none; }
        .ab-pattes i { position: absolute; font-style: normal; font-size: 26px; opacity: 0; animation: abPatte 1.8s ease forwards; }
        @keyframes abPatte { 10%, 70% { opacity: .9; } 100% { opacity: 0; } }
        .ab-zzz { position: fixed; z-index: 100021; width: 60px; height: 60px; pointer-events: none; font-family: 'Cinzel', Georgia, serif; font-weight: 700; font-size: 18px; color: #7a8bd8; text-shadow: 0 2px 6px rgba(0,0,0,.35); }
        .ab-zzz b { position: absolute; left: 0; bottom: 0; opacity: 0; animation: abZ 2.4s ease-in-out infinite; }
        .ab-zzz b:nth-child(2) { animation-delay: .8s; font-size: 1.3em; }
        .ab-zzz b:nth-child(3) { animation-delay: 1.6s; font-size: 1.6em; }
        @keyframes abZ { 0% { opacity: 0; transform: none; } 30% { opacity: 1; } 100% { opacity: 0; transform: translate(26px, -48px) rotate(12deg); } }
        body.ab-secousse { animation: abSecousse .08s linear 8; }
        @keyframes abSecousse { 50% { transform: translate(4px, -3px); } }
        .ab-flotte { animation: abFlotte 4.2s ease-in-out; }
        @keyframes abFlotte { 0%, 100% { transform: none; } 30% { transform: translateY(-22px) rotate(-1.5deg); } 60% { transform: translateY(-14px) rotate(1deg); } }
        .ab-mouton { position: fixed; left: -80px; z-index: 100022; pointer-events: none; font-size: 46px; transform: scaleX(-1); animation: abTroupeau 2.8s linear forwards, abSaut .28s ease-in-out infinite alternate; }
        @keyframes abTroupeau { to { left: calc(100vw + 80px); } }
        @keyframes abSaut { to { margin-top: -16px; } }
        @media (prefers-reduced-motion: reduce) {
            .ab-tarte, .ab-mouton, .ab-pattes { display: none; }
            .ab-splat, .ab-zzz b, body.ab-secousse, .ab-flotte { animation: none !important; }
            .ab-splat { opacity: 1; transform: translate(-50%, -50%); }
            .ab-zzz b { opacity: 1; }
        }`);
    }

    // =====================================================
    // LE SAC
    // =====================================================
    function tarte() {
        dire('🥧', 'Une tarte à la crème dans un sac ? Elle n’a pas tenu. Splotch.', { titre: 'Splotch' });
        if (calme()) return;
        styles();
        const vol = document.createElement('div');
        vol.className = 'ab-tarte no-print'; vol.setAttribute('aria-hidden', 'true');
        vol.innerHTML = '<svg viewBox="0 0 120 60"><ellipse cx="60" cy="40" rx="56" ry="16" fill="#c98a3c"/><ellipse cx="60" cy="32" rx="50" ry="16" fill="#fffdf3"/><circle cx="60" cy="20" r="7" fill="#d1344a"/></svg>';
        // Une éclaboussure jamais deux fois la même
        const pts = [];
        for (let i = 0; i < 18; i++) {
            const a = Math.PI * 2 * i / 18, r = 110 + Math.random() * 50 + (i % 2 ? 38 : 0);
            pts.push([200 + Math.cos(a) * r, 200 + Math.sin(a) * r]);
        }
        // Des courbes qui passent par les milieux : une vraie flaque, pas un polygone
        const milieu = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const xy = (q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1);
        let chemin = 'M' + xy(milieu(pts[17], pts[0]));
        pts.forEach((q, i) => { chemin += 'Q' + xy(q) + ' ' + xy(milieu(q, pts[(i + 1) % 18])); });
        const coulures = [0, 1, 2, 3].map(() => `<rect x="${Math.round(120 + Math.random() * 160)}" y="250" width="${Math.round(14 + Math.random() * 12)}" height="${Math.round(60 + Math.random() * 90)}" rx="10" fill="#fffdf3"/>`).join('')
            + [0, 1, 2, 3, 4, 5, 6].map(() => { const a = Math.random() * Math.PI * 2, r = 185 + Math.random() * 40; return `<circle cx="${Math.round(200 + Math.cos(a) * r)}" cy="${Math.round(200 + Math.sin(a) * r)}" r="${Math.round(5 + Math.random() * 9)}" fill="#fffdf3"/>`; }).join('');
        const splat = document.createElement('div');
        splat.className = 'ab-splat no-print'; splat.setAttribute('aria-hidden', 'true');
        splat.innerHTML = `<svg viewBox="0 0 400 400"><path d="${chemin}Z" fill="#fffdf3" stroke="#efe6cf" stroke-width="4" stroke-linejoin="round"/>${coulures}<circle cx="170" cy="180" r="18" fill="#d1344a"/><circle cx="240" cy="222" r="10" fill="#c98a3c"/><circle cx="210" cy="150" r="6" fill="#c98a3c"/></svg>`;
        document.body.appendChild(vol);
        document.body.appendChild(splat);
        setTimeout(() => vol.remove(), 700);
        setTimeout(() => splat.remove(), 5000);
    }

    const objets = () => { try { const a = JSON.parse(localStorage.getItem(idPerso() + '_dnd-inventory') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
    const photo = () => new Set(objets().map(o => normal(o && o.name)));
    let connus = null;
    surFiche(() => { connus = photo(); }, 300);
    window.addEventListener('load', () => setTimeout(() => { if (!connus) connus = photo(); }, 900));
    document.addEventListener('fiche:inventaire', () => {
        const liste = objets();
        const noms = liste.map(o => normal(o && o.name));
        const nouveaux = connus ? noms.filter(n => !connus.has(n)) : [];
        connus = new Set(noms);
        const ajout = (re) => nouveaux.some(n => re.test(n));
        if (ajout(/\btartes?\b/)) tarte();
        else if (ajout(/\bchaussettes?\b/)) dire('🧦', 'Chaussette ajoutée. Sa jumelle a été vue pour la dernière fois dans le plan Astral.', { titre: 'Inventaire' });
        else if (ajout(/\bketchup\b/)) dire('🍅', 'Le ketchup est formellement interdit à la table des aventuriers. Le MJ a été prévenu.', { titre: 'Règlement de la taverne', humeur: 'sang' });
        else if (ajout(/\bmayo(nnaise)?\b/)) dire('🫙', 'Potion de mayonnaise ajoutée. Effet : aucun. Goût : discutable.', { titre: 'Inventaire' });
        else if (nouveaux.some(n => /\bbaguettes?\b/.test(n) && !/magique/.test(n))) dire('🥖', 'Une baguette. Pas magique. Mais croustillante.', { titre: 'Inventaire' });

        // Un objet au poids négatif : le sac s'allège… un peu trop
        if (liste.some(o => o && parseFloat(String(o.weight || '').replace(',', '.')) < 0) && unParSession('sac-flotte')) {
            dire('🎈', 'Un objet de poids négatif. Ton sac flotte. Attache-le avant qu’il s’envole.', { titre: 'Physique', humeur: 'arcane' });
            const w = document.getElementById('widget-inventory');
            if (w && !calme()) { styles(); w.classList.remove('ab-flotte'); void w.offsetWidth; w.classList.add('ab-flotte'); setTimeout(() => w.classList.remove('ab-flotte'), 4400); }
        }
    });

    // =====================================================
    // LA FICHE
    // =====================================================
    const DIAGNOSTICS = {
        'stat-str': ['💪', 'Force 1. Ton héros ne peut plus soulever sa cuillère.'],
        'stat-dex': ['🍌', 'Dextérité 1. Ton héros vient de trébucher sur le mot « trébucher ».'],
        'stat-con': ['🤧', 'Constitution 1. Ton héros s’est enrhumé en lisant « courant d’air ».'],
        'stat-int': ['🥄', 'Intelligence 1. Ton héros vient d’essayer de manger sa carte de héros.'],
        'stat-wis': ['📜', 'Sagesse 1. Ton héros a signé un pacte avec un diable. Deux fois. Le même.'],
        'stat-cha': ['🦨', 'Charisme 1. Même les gobelins changent de trottoir.']
    };
    const NOMS = [
        [/^kevin\b/, '🧙', 'Kevin le Nécromancien refuse qu’on l’appelle Kev.'],
        [/^jean[- ]?michel\b/, '🪓', 'Jean-Michel le Barbare. Les contrées lointaines tremblent un peu.'],
        [/^gerard\b/, '🌋', 'Gérard, Destructeur de Mondes, préfère qu’on le vouvoie.'],
        [/^brigitte\b/, '🗂️', 'Brigitte l’Implacable a déjà rangé ton inventaire. Par ordre alphabétique.'],
        [/^jean[- ]?claude\b/, '😴', 'Jean-Claude, paladin du dimanche, n’attaque qu’après la sieste.']
    ];
    const minuteurs = {};
    // En capture : on voit passer la frappe de tous les champs, journal compris.
    document.addEventListener('input', (e) => {
        const t = e.target; if (!t) return;
        const plusTard = (fn) => { clearTimeout(minuteurs[t.id]); minuteurs[t.id] = setTimeout(fn, 900); };
        if (DIAGNOSTICS[t.id]) plusTard(() => { if (String(t.value).trim() === '1' && unParSession(t.id)) dire(DIAGNOSTICS[t.id][0], DIAGNOSTICS[t.id][1], { titre: 'Diagnostic' }); });
        else if (t.id === 'speed') plusTard(() => { if (/^0([.,]0+)?\s*(m|ft)?$/i.test(String(t.value).trim()) && unParSession('vitesse0')) dire('🪴', 'Vitesse 0 m. Ton héros est officiellement une plante verte. Pense à l’arroser.', { titre: 'Diagnostic' }); });
        else if (t.id === 'char-level') plusTard(() => {
            const n = parseInt(String(t.value).trim(), 10);
            if (isNaN(n) || n > 0 || !unParSession(n < 0 ? 'niveau-negatif' : 'niveau-0')) return;
            dire('🍼', n < 0 ? 'Niveau négatif. Ton héros a réussi à régresser. C’est presque un exploit.' : 'Niveau 0. Ton héros est encore en train de lire le manuel.', { titre: 'Diagnostic' });
        });
        else if (t.id === 'char-name') plusTard(() => {
            const n = normal(t.value), x = NOMS.find(([re]) => re.test(n));
            if (x && unParSession('nom-' + n)) dire(x[1], x[2], { titre: 'Registre des héros' });
        });
        // Un cri de guerre en majuscules, dans n'importe quel champ
        const texte = t.isContentEditable ? t.textContent : t.value;
        if (typeof texte === 'string' && /A{6,}/.test(texte) && pasAvant('cri', 20000)) criDeGuerre();
    }, true);

    function criDeGuerre() {
        dire('📣', 'Ton héros charge en hurlant. Personne ne sait vers quoi.', { titre: 'Cri de guerre', humeur: 'sang' });
        if (calme()) return;
        styles();
        document.body.classList.remove('ab-secousse'); void document.body.offsetWidth; document.body.classList.add('ab-secousse');
        setTimeout(() => document.body.classList.remove('ab-secousse'), 800);
    }

    // =====================================================
    // LE CLAVIER
    // =====================================================
    const RANGEES = ['azertyuiop', 'qsdfghjklm', 'wxcvbn', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    let frappes = [], mot = '';
    document.addEventListener('keydown', (e) => {
        // Ctrl+S : la fiche s'enregistre déjà toute seule, mais le geste mérite un jet
        if ((e.ctrlKey || e.metaKey) && !e.altKey && String(e.key).toLowerCase() === 's') {
            if (e.defaultPrevented) return;
            e.preventDefault();
            if (pasAvant('ctrl-s', 8000)) dire('💾', 'Jet de sauvegarde réussi ! (Ta fiche s’enregistre toute seule, tu sais.)', { titre: 'Sauvegarde contre la mort', humeur: 'or' });
            return;
        }
        if (e.ctrlKey || e.metaKey || e.altKey || !e.key || e.key.length !== 1) return;
        const n = Date.now();
        frappes.push({ k: e.key.toLowerCase(), t: n });
        frappes = frappes.filter(f => n - f.t < 1400).slice(-14);
        // Un chat sur le clavier : six touches voisines, tapées d'une traite
        const suite = frappes.map(f => f.k).join('');
        let chatDetecte = false;
        for (let i = 0; i + 6 <= suite.length && !chatDetecte; i++) {
            const bout = suite.slice(i, i + 6), envers = [...bout].reverse().join('');
            chatDetecte = RANGEES.some(r => r.includes(bout) || r.includes(envers));
        }
        if (chatDetecte && pasAvant('chat', 30000)) { frappes = []; chat(); return; }
        // « moutons », tapé hors des champs (aucune de ses lettres n'est un raccourci du site)
        if (horsSaisie(e.target)) {
            mot = (mot + e.key.toLowerCase()).slice(-7);
            if (mot === 'moutons') { mot = ''; moutons(); }
        }
    });

    function chat() {
        dire('🐈', 'Un chat vient de marcher sur ton clavier. Il gagne +2 en Discrétion et refuse de s’excuser.', { titre: 'Intrusion féline' });
        if (calme()) return;
        styles();
        const trace = document.createElement('div');
        trace.className = 'ab-pattes no-print'; trace.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < 9; i++) {
            const p = document.createElement('i');
            p.textContent = '🐾';
            p.style.left = (6 + i * 10.5) + '%';
            p.style.bottom = (i % 2 ? 14 : 0) + 'px';
            p.style.animationDelay = (i * 0.12).toFixed(2) + 's';
            trace.appendChild(p);
        }
        document.body.appendChild(trace);
        setTimeout(() => trace.remove(), 3200);
    }

    function moutons() {
        dire('🐑', 'Tu comptais les moutons ? Il y en a sept. Le huitième est coincé quelque part dans ta fiche.', { titre: 'Insomnie', humeur: 'nuit' });
        if (calme()) return;
        styles();
        for (let i = 0; i < 7; i++) {
            setTimeout(() => {
                const m = document.createElement('div');
                m.className = 'ab-mouton no-print'; m.setAttribute('aria-hidden', 'true'); m.textContent = '🐑';
                m.style.top = (58 + Math.random() * 24).toFixed(1) + '%';
                document.body.appendChild(m);
                setTimeout(() => m.remove(), 3000);
            }, i * 260);
        }
    }

    // =====================================================
    // LES DÉS
    // =====================================================
    function desImpossibles(expr) {
        const v = normal(expr).replace(/\s+/g, '');
        if (/(^|[+-])\d*d0+(?!\d)/.test(v)) dire('🕳️', 'Un dé à zéro face. Il a disparu. Le MJ te le facture 5 po.', { titre: 'Physique', humeur: 'arcane' });
        else if (/(^|[+-])\d*d1(?!\d)/.test(v)) dire('🎲', 'Un dé à une face. Suspense insoutenable… c’est un 1.', { titre: 'Suspense' });
    }
    document.addEventListener('click', (e) => {
        if (e.target && e.target.closest && e.target.closest('#btn-expr-roll')) desImpossibles((document.getElementById('expr-input') || {}).value);
    }, true);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target && e.target.id === 'expr-input') desImpossibles(e.target.value);
    }, true);

    // Huit d20 en un quart de minute : le dé se syndique
    let lancers = [];
    document.addEventListener('jet:consigne', (e) => {
        if (typeof (e.detail && e.detail.nat) !== 'number') return;
        const n = Date.now();
        lancers = lancers.filter(t => n - t < 15000);
        lancers.push(n);
        if (lancers.length >= 8 && pasAvant('greve', 90000)) {
            lancers = [];
            dire('🪧', 'Ton d20 fait grève. Revendications : moins de jets, plus de 20.', { titre: 'Syndicat des dés' });
        }
    });

    // =====================================================
    // LE HÉROS QUI RONFLE — cinq minutes sans toucher à rien
    // =====================================================
    let derniereActivite = Date.now(), ronfle = null, debutRonflement = 0;
    function reveil() {
        derniereActivite = Date.now();
        if (!ronfle) return;
        ronfle.remove(); ronfle = null;
        if (Date.now() - debutRonflement > 4000) dire('😪', 'Hein ? Quoi ? J’étais pas endormi. Je surveillais la fiche.', { titre: 'Réveil en sursaut', humeur: 'nuit' });
    }
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => document.addEventListener(ev, reveil, { passive: true, capture: true }));
    document.addEventListener('pointermove', () => { if (ronfle || Date.now() - derniereActivite > 1000) reveil(); }, { passive: true });
    setInterval(() => {
        const app = document.getElementById('app-screen');
        if (ronfle || document.hidden || !app || app.classList.contains('hidden')) return;
        if (Date.now() - derniereActivite < 5 * 60000) return;
        const avatar = document.getElementById('header-avatar');
        const r = avatar ? avatar.getBoundingClientRect() : null;
        if (!r || !r.width) return;
        styles();
        ronfle = document.createElement('div');
        ronfle.className = 'ab-zzz no-print'; ronfle.setAttribute('aria-hidden', 'true');
        ronfle.style.left = Math.round(r.right - 8) + 'px';
        ronfle.style.top = Math.round(r.top - 30) + 'px';
        ronfle.innerHTML = '<b>z</b><b>z</b><b>Z</b>';
        document.body.appendChild(ronfle);
        debutRonflement = Date.now();
    }, 15000);
})();
