// =====================================================
// secrets.js — les easter eggs du héros (1/2)
//
//   · trois 20 naturels d'affilée → « Les dieux te regardent », style Légende ;
//   · trois 1 naturels d'affilée → « Ton d20 est maudit », style Maudit, et la
//     prison des dés : un dé neuf, d'une autre couleur, pour 10 jets ;
//   · niveau 20 → « Héros épique » ;
//   · trois jets contre la mort réussis → « La Mort t'a recraché » ;
//   · une fiche ouverte entre 3 h et 5 h → le barde, lui, dort.
// Le sac sans fond, les monstres, le générique et le dragon : secrets-monde.js.
//
// Règles communes : un secret ne bloque jamais la partie, ne touche ni aux
// données de la fiche ni au hasard, et se fait discret avec « moins d'animations ».
// Les bannières et les trophées viennent de exploits.js.
// =====================================================
(function () {
    'use strict';

    const UI = () => window.SecretsUI;
    const idPerso = () => { try { return localStorage.getItem('dnd-active-char') || ''; } catch (e) { return ''; } };
    const nom = () => (UI() && UI().nomPerso()) || 'Ton héros';
    const debloquer = (id, opts) => (window.Exploits ? window.Exploits.debloquer(id, opts) : { nouveau: false, info: { fois: 1 } });
    const ouvrirCarte = (style) => { if (window.HeroCard) window.HeroCard.open(style ? { style } : undefined); };
    const surFiche = (fn, delai) => document.addEventListener('screen:change', (e) => {
        if (e.detail && e.detail.id === 'app-screen') setTimeout(fn, delai || 0);
    });

    let stylesPoses = false;
    function styles() {
        if (stylesPoses || !UI()) return; stylesPoses = true;
        UI().injecter(`
        .sx-prison { position: relative; width: 116px; height: 116px; margin: 0 auto 12px; }
        .sx-d20 { width: 100%; height: 100%; filter: drop-shadow(0 0 18px rgba(150,220,90,.45)); animation: sxMaudit 2.4s ease-in-out infinite; }
        @keyframes sxMaudit { 0%, 100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } }
        .sx-barreaux { position: absolute; inset: -8px -10px; display: flex; justify-content: space-between; padding: 0 6px; transform: translateY(-140%); opacity: 0; transition: transform .7s cubic-bezier(.3,1.5,.5,1), opacity .15s; }
        .sx-barreaux i { width: 7px; border-radius: 4px; background: linear-gradient(90deg, #3a3f44, #aab3bb 45%, #3a3f44); box-shadow: 0 2px 6px rgba(0,0,0,.6); }
        .sx-barreaux b { position: absolute; left: 0; right: 0; top: 24%; height: 7px; border-radius: 4px; background: linear-gradient(#aab3bb, #3a3f44); }
        .sx-prison.enferme .sx-barreaux { transform: none; opacity: 1; }
        .sx-prison.enferme .sx-d20 { animation: sxSecoue .45s ease-in-out 3; filter: grayscale(.45) drop-shadow(0 0 10px rgba(150,220,90,.3)); }
        @keyframes sxSecoue { 0%, 100% { transform: none; } 25% { transform: translateX(-5px) rotate(-5deg); } 75% { transform: translateX(5px) rotate(5deg); } }

        .sx-revenant { position: fixed; left: 50%; bottom: 0; transform: translateX(-50%); z-index: 100030; pointer-events: none; text-align: center; padding-bottom: 28px; width: min(92vw, 560px); }
        .sx-crane { width: 132px; height: 132px; display: block; margin: 0 auto 8px; transform-origin: 50% 90%; filter: drop-shadow(0 8px 24px rgba(0,0,0,.6)); animation: sxCrane 4.4s ease-in-out forwards; }
        @keyframes sxCrane { 0% { transform: translateY(140%); } 16% { transform: translateY(0); } 30% { transform: translateY(-10px) rotate(-12deg); } 40% { transform: translateY(-2px) rotate(9deg); } 50% { transform: translateY(-12px) rotate(-6deg); } 60%, 84% { transform: none; opacity: 1; } 100% { transform: translateY(160%); opacity: 0; } }
        .sx-revenant p { margin: 0; color: #f6ead0; text-shadow: 0 2px 12px rgba(0,0,0,.95); animation: sxRevTexte 4.4s ease forwards; }
        .sx-rev-titre { font-family: 'Cinzel', Georgia, serif; font-weight: 700; font-size: clamp(1.4rem, 4vw, 2.2rem); }
        .sx-rev-sous { font-family: 'Lora', Georgia, serif; font-style: italic; font-size: 1rem; opacity: .85; }
        @keyframes sxRevTexte { 0%, 18% { opacity: 0; transform: translateY(8px); } 28%, 82% { opacity: 1; transform: none; } 100% { opacity: 0; } }

        .sx-lune { position: fixed; top: 18px; left: 50%; z-index: 100020; display: flex; align-items: center; gap: 12px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 12px 20px; border-radius: 999px; cursor: pointer;
            color: #e9e6ff; background: linear-gradient(135deg, rgba(20,22,54,.95), rgba(38,30,80,.95)); border: 1px solid rgba(190,180,255,.35);
            box-shadow: 0 10px 30px rgba(0,0,0,.45), 0 0 24px rgba(140,130,255,.25); transform: translateX(-50%); animation: sxLune .6s cubic-bezier(.2,.9,.3,1.2) both; }
        .sx-lune span { font-size: 1.5rem; }
        .sx-lune p { margin: 0; font-family: 'Lora', Georgia, serif; font-size: .95rem; }
        .sx-lune.sort { transition: opacity .5s, transform .5s; opacity: 0; transform: translate(-50%, -20px); }
        @keyframes sxLune { from { opacity: 0; transform: translate(-50%, -30px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @media (prefers-reduced-motion: reduce) { .sx-d20, .sx-crane, .sx-revenant p, .sx-lune { animation: none !important; } .sx-barreaux { transition: none; } }`);
    }

    // =====================================================
    // LES SÉRIES DE D20 — appelées par effets.js (RollFX.jet) pour chaque d20
    // =====================================================
    // La série vit dans sessionStorage : elle survit à un rechargement, pas à la
    // fermeture de l'onglet. Un autre d20 entre deux la remet à zéro.
    const SERIE = 'dnd-serie-d20';
    function lireSerie() {
        const vide = { id: idPerso(), n20: 0, n1: 0 };
        try { const s = JSON.parse(sessionStorage.getItem(SERIE) || 'null'); return s && s.id === vide.id ? Object.assign(vide, s) : vide; }
        catch (e) { return vide; }
    }
    function noterSerie(s) { try { sessionStorage.setItem(SERIE, JSON.stringify(s)); } catch (e) {} }

    /** Renvoie true quand un secret prend la main (l'effet simple du 20 ou du 1 est alors remplacé). */
    function d20(nat) {
        unJetDeRelais();
        const s = lireSerie();
        s.n20 = nat === 20 ? s.n20 + 1 : 0;
        s.n1 = nat === 1 ? s.n1 + 1 : 0;
        const secret = s.n20 >= 3 ? legende : s.n1 >= 3 ? maudit : null;
        if (secret) { s.n20 = 0; s.n1 = 0; }
        noterSerie(s);
        if (!secret || !UI()) return false;
        secret();
        return true;
    }

    // ---------- Trois 20 : les dieux te regardent ----------
    function legende() {
        const r = debloquer('triple20', { silencieux: true });
        if (window.RollFX) { window.RollFX.crit(); setTimeout(window.RollFX.crit, 420); setTimeout(window.RollFX.crit, 840); }
        UI().banniere({
            theme: 'or', surtitre: '✦ Trois 20 naturels d’affilée ✦', titre: 'Les dieux te regardent',
            phrase: r.nouveau
                ? `${UI().esc(nom())} entre dans la légende. Le style <b>Légende</b> de la carte de héros est débloqué pour tous tes personnages.`
                : `Encore ! ${r.info.fois} fois à ce jour. Les dieux n’en reviennent pas.`,
            actions: [
                { label: '🃏 Voir ma carte Légende', principal: true, faire: (b) => { b.fermer(); ouvrirCarte('legende'); } },
                { label: 'Continuer' }
            ]
        });
    }

    // ---------- Trois 1 : la prison des dés ----------
    // Le « dé neuf » ne change que la COULEUR des dés 3D (script.js demande
    // Secrets.couleurDeRelais()). Le tirage, lui, reste le même hasard.
    const RELAIS = 'dnd-de-neuf';
    const NEUFS = [['#2563c9', 'saphir'], ['#16a3a3', 'turquoise'], ['#1f8a4c', 'émeraude'], ['#e8e0cc', 'ivoire'], ['#e08a1e', 'ambre']];
    function lireRelais() { try { const r = JSON.parse(localStorage.getItem(RELAIS) || 'null'); return r && r.restants > 0 ? r : null; } catch (e) { return null; } }
    function couleurDeRelais() { const r = lireRelais(); return r ? r.couleur : null; }
    function unJetDeRelais() {
        const r = lireRelais(); if (!r) return;
        r.restants -= 1;
        try {
            if (r.restants > 0) { localStorage.setItem(RELAIS, JSON.stringify(r)); return; }
            localStorage.removeItem(RELAIS);
        } catch (e) { return; }
        setTimeout(() => { if (window.showAppToast) window.showAppToast('⚖️ Ton ancien d20 a purgé sa peine. Il reprend du service, repenti.'); }, 1800);
    }
    function emprisonner() {
        let actuelle = '';
        try { actuelle = (localStorage.getItem('dnd-dice-theme-color') || '').toLowerCase(); } catch (e) {}
        const choix = NEUFS.filter(([c]) => c !== actuelle);
        const [couleur, nomCouleur] = choix[Math.floor(Math.random() * choix.length)];
        try { localStorage.setItem(RELAIS, JSON.stringify({ couleur, nom: nomCouleur, restants: 10 })); } catch (e) {}
        return nomCouleur;
    }

    const D20 = `<div class="sx-prison" aria-hidden="true">
        <svg class="sx-d20" viewBox="0 0 100 100">
            <polygon points="50,3 94,27 94,73 50,97 6,73 6,27" fill="#1d2a17" stroke="#b6e36a" stroke-width="3"/>
            <polygon points="50,20 80,68 20,68" fill="none" stroke="#b6e36a" stroke-width="2" opacity=".7"/>
            <path d="M50 3V20M94 27L80 68M6 27L20 68M94 73L80 68M6 73L20 68M50 97V68" stroke="#b6e36a" stroke-width="1.5" opacity=".5"/>
            <text x="50" y="60" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="26" font-weight="700" fill="#eaffc2">1</text>
        </svg>
        <div class="sx-barreaux"><i></i><i></i><i></i><i></i><i></i><b></b></div>
    </div>`;

    function maudit() {
        const r = debloquer('triple1', { silencieux: true });
        if (window.RollFX) window.RollFX.fumble();
        styles();
        UI().banniere({
            theme: 'poison', visuel: D20, surtitre: '☠ Trois 1 naturels d’affilée ☠', titre: 'Ton d20 est maudit',
            phrase: (r.nouveau
                ? 'Les dés ont parlé, et ils te détestent. Le style <b>Maudit</b> de la carte de héros est débloqué pour tous tes personnages.'
                : `Encore ?! ${r.info.fois} fois à ce jour.`) + ' Ce d20 mérite peut-être la prison.',
            actions: [
                { label: '🔒 En prison !', principal: true, faire: (b) => {
                    const couleur = emprisonner();
                    const prison = b.el.querySelector('.sx-prison'); if (prison) prison.classList.add('enferme');
                    b.maj({
                        titre: 'Justice est faite',
                        phrase: `Ton d20 purge sa peine. Un dé neuf, couleur <b>${couleur}</b>, prend le relais pour tes 10 prochains jets de d20.`,
                        actions: [{ label: 'Continuer', principal: true }, { label: '🃏 Voir ma carte Maudite', faire: (bb) => { bb.fermer(); ouvrirCarte('maudit'); } }]
                    });
                } },
                { label: '🃏 Carte Maudite', faire: (b) => { b.fermer(); ouvrirCarte('maudit'); } },
                { label: 'Je le garde' }
            ]
        });
    }

    // =====================================================
    // NIVEAU 20 — héros épique
    // =====================================================
    // On garde le niveau d'avant : c'est le PASSAGE à 20 qui compte, pas une
    // fiche déjà au sommet qu'on rouvre.
    let niveauAvant = null;
    const lireNiveau = () => { const n = parseInt((document.getElementById('char-level') || {}).value, 10); return isNaN(n) ? 0 : n; };
    surFiche(() => { niveauAvant = lireNiveau(); }, 400);
    // Filet : une fiche déjà ouverte au chargement n'annonce pas toujours son écran.
    window.addEventListener('load', () => setTimeout(() => { if (niveauAvant == null) niveauAvant = lireNiveau(); }, 900));
    document.addEventListener('focusin', (e) => { if (e.target && e.target.id === 'char-level') niveauAvant = lireNiveau(); });
    document.addEventListener('input', (e) => {
        if (!e.target || e.target.id !== 'char-level') return;
        const avant = niveauAvant, apres = lireNiveau();
        niveauAvant = apres;
        if (avant != null && avant > 0 && avant < 20 && apres >= 20) epique();
    });

    function epique() {
        const cle = 'dnd-epique-vu-' + idPerso();
        try { if (sessionStorage.getItem(cle)) return; sessionStorage.setItem(cle, '1'); } catch (e) {}
        if (!UI()) return;
        debloquer('epique');
        if (window.RollFX) { window.RollFX.crit(); setTimeout(window.RollFX.crit, 520); }
        UI().banniere({
            theme: 'epique', surtitre: '✦ Niveau 20 ✦', titre: 'Héros épique',
            phrase: `${UI().esc(nom())} a atteint le sommet. Les bardes écriront des chansons : des mauvaises, mais des chansons. Sa carte de héros porte désormais la mention <b>Héros épique</b>.`,
            actions: [
                { label: '🃏 Voir ma carte', principal: true, faire: (b) => { b.fermer(); ouvrirCarte(); } },
                { label: 'Continuer' }
            ]
        });
    }

    // =====================================================
    // TROIS JETS CONTRE LA MORT RÉUSSIS
    // =====================================================
    const troisSucces = () => [1, 2, 3].every(i => { const c = document.getElementById('death-s' + i); return !!(c && c.checked); });
    document.addEventListener('change', (e) => {
        const t = e.target;
        if (t && /^death-s[123]$/.test(t.id) && t.checked && troisSucces()) revenant();
    });

    function revenant() {
        if (!UI()) return;
        debloquer('revenant');
        styles();
        const ancien = document.querySelector('.sx-revenant'); if (ancien) ancien.remove();
        const el = document.createElement('div');
        el.className = 'sx-revenant no-print'; el.setAttribute('role', 'status');
        el.innerHTML = '<img src="IMG/logo-256.png" alt="" class="sx-crane"><p class="sx-rev-titre">La Mort t’a recraché.</p><p class="sx-rev-sous">…bon, pas aujourd’hui.</p>';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 4600);
    }

    // =====================================================
    // 3 H DU MATIN
    // =====================================================
    surFiche(function nuitBlanche() {
        const t = new Date(), h = t.getHours();
        if (h < 3 || h >= 5 || !UI()) return;
        const nuit = `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`;
        try { if (localStorage.getItem('dnd-nuit-blanche') === nuit) return; localStorage.setItem('dnd-nuit-blanche', nuit); } catch (e) {}
        debloquer('nuit-blanche');
        styles();
        const el = document.createElement('div');
        el.className = 'sx-lune no-print'; el.setAttribute('role', 'status');
        el.innerHTML = `<span aria-hidden="true">🌙</span><p>Il est ${h} h ${String(t.getMinutes()).padStart(2, '0')}. <em>Le barde du groupe, lui, dort.</em></p>`;
        el.addEventListener('click', () => el.remove());
        document.body.appendChild(el);
        setTimeout(() => el.classList.add('sort'), 7000);
        setTimeout(() => el.remove(), 7600);
    }, 1200);

    window.Secrets = { d20, couleurDeRelais };
})();
