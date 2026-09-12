// =====================================================
// dialogues.js — confirmer, demander, informer
//
// Remplace confirm(), prompt() et alert() par des fenêtres au style du site.
// Chargé à la demande : charger.js pose la façade `Dialogue`, ce fichier la
// remplace au premier appel.
//
//   Dialogue.confirmer(o) → Promise<boolean>
//   Dialogue.demander(o)  → Promise<string | null>     (null : annulé)
//   Dialogue.informer(o)  → Promise<void>
//
// `o` est un texte (le message) ou un objet :
//   confirmer : { titre, message, icone, confirmer, annuler, danger,
//                 saisie: { attendu, etiquette } }  — il faut retaper `attendu`
//   demander  : { titre, message, etiquette, valeur, placeholder,
//                 type: 'text' | 'number', min, max, obligatoire,
//                 valider(texte) → message d'erreur ou '' , confirmer, annuler }
//   informer  : { titre, message, icone, bouton, type: 'info' | 'erreur' | 'reussite' }
//
// Le focus reste piégé dans la fenêtre et revient à l'élément d'origine à la
// fermeture. Échap annule, Entrée valide (sauf sur un bouton, qui fait son
// propre clic). Sous 700 px, la fenêtre devient une feuille posée en bas de
// l'écran. Une seule fenêtre à la fois : les suivantes attendent leur tour.
// =====================================================
(function () {
    'use strict';

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const calme = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
    const plier = (s) => String(s == null ? '' : s).normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr');
    const FOCUSABLES = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
    const SCEAUX = { info: '✦', erreur: '!', reussite: '✓' };

    const CSS = `
    .dlg-voile { position: fixed; inset: 0; z-index: 100010; display: flex; align-items: center; justify-content: center; padding: 20px;
        background: rgba(12, 8, 6, .62); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); animation: dlgFondu .18s ease-out both; }
    .dlg-voile.sort { animation: dlgSortie .16s ease-in forwards; }
    .dlg { position: relative; box-sizing: border-box; width: min(460px, 100%); max-height: calc(100vh - 40px); overflow: auto; padding: 22px 22px 18px;
        color: var(--text-color, #2c1a10); background: linear-gradient(158deg, var(--sheet-bg-color, #FAF3E0) 0%, #eee2c4 100%);
        border: 1.5px solid rgba(122, 40, 40, .38); border-radius: 18px; box-shadow: 0 24px 60px rgba(0, 0, 0, .5);
        animation: dlgEntree .22s cubic-bezier(.2, .8, .2, 1) both; }
    .dlg-tete { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
    .dlg-sceau { flex: 0 0 auto; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; font-size: 1.1rem; font-weight: 700; color: #fff6e0;
        background: radial-gradient(circle at 35% 30%, rgba(255, 255, 255, .35), transparent 45%), var(--primary-color, #7A2828); box-shadow: 0 3px 8px rgba(0, 0, 0, .3); }
    .dlg-titre { margin: 0; padding: 0; border: 0; font-family: 'Cinzel', Georgia, serif; font-size: 1.12rem; line-height: 1.3; letter-spacing: .02em; text-transform: none; color: var(--primary-color, #7A2828); }
    .dlg-message { margin: 0 0 14px; font-family: 'Lora', Georgia, serif; font-size: .98rem; line-height: 1.55; white-space: pre-line; overflow-wrap: anywhere; }
    .dlg-champ { display: flex; flex-direction: column; gap: 6px; margin: 0 0 12px; }
    .dlg-champ label { font-family: 'Cinzel', Georgia, serif; font-size: .74rem; letter-spacing: .06em; text-transform: uppercase; opacity: .85; }
    .dlg-saisie { font: inherit; font-size: 1rem; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(122, 40, 40, .35); background: rgba(255, 255, 255, .78); color: inherit; }
    .dlg-saisie:focus-visible { outline: 2px solid var(--accent-color, #C49B35); outline-offset: 1px; }
    .dlg-saisie[aria-invalid="true"] { border-color: #b3261e; }
    .dlg-erreur { margin: -4px 0 12px; font-size: .88rem; color: #9b1c1c; }
    .dlg-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; }
    .dlg-btn { min-height: 44px; padding: 9px 18px; border-radius: 10px; font-family: 'Cinzel', Georgia, serif; font-weight: 600; font-size: .9rem; letter-spacing: .03em; cursor: pointer; }
    .dlg-principal { color: var(--accent-color, #C49B35); background: linear-gradient(180deg, var(--primary-hover, #9c3333), var(--primary-color, #7A2828)); border: 1px solid rgba(196, 155, 53, .45); }
    .dlg-principal:disabled { opacity: .45; cursor: not-allowed; }
    .dlg-secondaire { color: var(--primary-color, #7A2828); background: transparent; border: 1px solid rgba(122, 40, 40, .35); }
    .dlg-btn:focus-visible { outline: 2px solid var(--accent-color, #C49B35); outline-offset: 2px; }
    .dlg.is-danger .dlg-principal { color: #fff; background: linear-gradient(180deg, #b3322c, #8a1c1c); border-color: #6d1414; }
    .dlg.is-danger .dlg-sceau, .dlg.t-erreur .dlg-sceau { background: #8a1c26; }
    .dlg.t-reussite .dlg-sceau { background: #3d7a3d; }
    body.theme-dark .dlg { background: linear-gradient(158deg, #2a211a 0%, #1d1712 100%); border-color: rgba(196, 155, 53, .3); }
    body.theme-dark .dlg-titre { color: var(--accent-color, #C49B35); }
    body.theme-dark .dlg-saisie { background: rgba(255, 255, 255, .06); border-color: rgba(196, 155, 53, .3); }
    body.theme-dark .dlg-secondaire { color: var(--accent-color, #C49B35); border-color: rgba(196, 155, 53, .35); }
    body.theme-dark .dlg-erreur { color: #ff9b8f; }
    @keyframes dlgFondu { from { opacity: 0; } }
    @keyframes dlgSortie { to { opacity: 0; } }
    @keyframes dlgEntree { from { opacity: 0; transform: translateY(8px) scale(.97); } }
    @keyframes dlgMonte { from { transform: translateY(100%); } }
    @media (max-width: 700px) {
        .dlg-voile { align-items: flex-end; padding: 0; }
        .dlg { width: 100%; max-height: 88vh; border-radius: 18px 18px 0 0; padding: 20px 18px calc(16px + env(safe-area-inset-bottom, 0px)); animation-name: dlgMonte; }
        .dlg-actions { flex-direction: column-reverse; }
        .dlg-btn { width: 100%; }
    }
    @media (prefers-reduced-motion: reduce) { .dlg-voile, .dlg-voile.sort, .dlg { animation: none !important; } }
    /* Un message qui arrive pendant une fenêtre ne doit pas couvrir ses boutons :
       sur téléphone, la fenêtre est posée en bas de l’écran. */
    @media (max-width: 700px) { body.dlg-ouvert .tst-pile-bas { bottom: calc(var(--dlg-hauteur, 60vh) + 12px); } }
    @media print { .dlg-voile { display: none !important; } }`;

    let stylesPoses = false;
    function styles() {
        if (stylesPoses) return;
        stylesPoses = true;
        const s = document.createElement('style');
        s.id = 'dialogues-styles';
        s.textContent = CSS;
        document.head.appendChild(s);
    }

    // Une fenêtre à la fois : chaque demande attend la fermeture de la précédente.
    let tour = Promise.resolve();
    function enFile(ouvrir) {
        const p = tour.then(() => new Promise(ouvrir));
        tour = p.then(() => {}, () => {});
        return p;
    }

    const options = (o, defauts) => Object.assign({}, defauts, typeof o === 'string' ? { message: o } : (o || {}));
    let numero = 0;

    /**
     * cfg : { role, titre, message, icone, type, danger, champ, actif(v),
     *         libelleValider, libelleAnnuler, annule, resultat(v, erreur) }
     * `resultat` renvoie la valeur à tenir, ou `undefined` pour rester ouvert.
     */
    function monter(cfg, tenir) {
        styles();
        const id = 'dlg-' + (++numero);
        const avant = document.activeElement;
        const c = cfg.champ;
        const voile = document.createElement('div');
        voile.className = 'dlg-voile no-print';
        voile.innerHTML = `<div class="dlg t-${cfg.type || 'info'}${cfg.danger ? ' is-danger' : ''}" role="${cfg.role || 'dialog'}" aria-modal="true" aria-labelledby="${id}-titre"${cfg.message ? ` aria-describedby="${id}-message"` : ''}>
            <div class="dlg-tete">
                <span class="dlg-sceau" aria-hidden="true">${esc(cfg.icone)}</span>
                <h2 class="dlg-titre" id="${id}-titre">${esc(cfg.titre)}</h2>
            </div>
            ${cfg.message ? `<p class="dlg-message" id="${id}-message">${esc(cfg.message)}</p>` : ''}
            ${c ? `<div class="dlg-champ">
                <label for="${id}-champ">${esc(c.etiquette)}</label>
                <input id="${id}-champ" class="dlg-saisie" type="text" autocomplete="off" spellcheck="false" aria-describedby="${id}-erreur"${c.placeholder ? ` placeholder="${esc(c.placeholder)}"` : ''}>
            </div>` : ''}
            <p class="dlg-erreur" id="${id}-erreur" role="alert" hidden></p>
            <div class="dlg-actions">
                ${cfg.libelleAnnuler ? `<button type="button" class="dlg-btn dlg-secondaire" data-dlg="annuler">${esc(cfg.libelleAnnuler)}</button>` : ''}
                <button type="button" class="dlg-btn dlg-principal" data-dlg="valider">${esc(cfg.libelleValider)}</button>
            </div>
        </div>`;
        const boite = voile.querySelector('.dlg');
        const champ = voile.querySelector('.dlg-saisie');
        const erreur = voile.querySelector('.dlg-erreur');
        const principal = voile.querySelector('[data-dlg="valider"]');
        if (champ && c.valeur != null) champ.value = String(c.valeur);

        let fini = false;
        let observateur = null;      // suit la hauteur de la fenêtre : les messages se rangent au-dessus
        function fermer(valeur) {
            if (fini) return;
            fini = true;
            document.removeEventListener('focusin', garderFocus, true);
            voile.classList.add('sort');
            if (avant && avant.isConnected && typeof avant.focus === 'function') {
                try { avant.focus({ preventScroll: true }); } catch (e) { /* élément devenu inerte */ }
            }
            // La promesse n’est tenue qu’une fois la fenêtre RETIRÉE : jamais deux
            // fenêtres à la fois dans la page (ni pour les lecteurs d’écran), et la
            // suivante de la file s’ouvre sur un écran propre.
            if (observateur) { observateur.disconnect(); observateur = null; }
            document.documentElement.style.removeProperty('--dlg-hauteur');
            const partir = () => { voile.remove(); document.body.classList.remove('dlg-ouvert'); tenir(valeur); };
            if (calme()) partir(); else setTimeout(partir, 170);
        }
        function signaler(msg) {
            erreur.textContent = msg || '';
            erreur.hidden = !msg;
            if (champ) champ.setAttribute('aria-invalid', msg ? 'true' : 'false');
        }
        const majBouton = () => { if (cfg.actif) principal.disabled = !cfg.actif(champ ? champ.value : ''); };
        function valider() {
            if (principal.disabled) return;
            const r = cfg.resultat(champ ? champ.value : undefined, signaler);
            if (r !== undefined) fermer(r);
        }

        voile.addEventListener('click', (e) => {
            const b = e.target.closest('[data-dlg]');
            if (b) { if (b.dataset.dlg === 'annuler') fermer(cfg.annule); else valider(); return; }
            if (e.target === voile) fermer(cfg.annule);
        });
        voile.addEventListener('keydown', (e) => {
            // Aucun raccourci de la fiche, ni aucune autre fenêtre, ne doit réagir derrière.
            e.stopPropagation();
            if (e.key === 'Escape') { e.preventDefault(); fermer(cfg.annule); return; }
            if (e.key === 'Enter' && !e.isComposing) {
                const t = e.target;
                if (t.tagName === 'BUTTON' || t.tagName === 'TEXTAREA') return;
                e.preventDefault();
                valider();
                return;
            }
            if (e.key === 'Tab') {
                const liste = [...boite.querySelectorAll(FOCUSABLES)].filter(x => x.getClientRects().length);
                if (!liste.length) { e.preventDefault(); return; }
                const premier = liste[0], dernier = liste[liste.length - 1];
                if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
                else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
            }
        });
        if (champ) champ.addEventListener('input', () => { signaler(''); majBouton(); });
        // Le focus ne quitte jamais la fenêtre, même par un clic ailleurs.
        function garderFocus(e) {
            if (fini || voile.contains(e.target)) return;
            (champ || principal).focus({ preventScroll: true });
        }
        document.addEventListener('focusin', garderFocus, true);

        document.body.appendChild(voile);
        document.body.classList.add('dlg-ouvert');
        // Un message qui arrive pendant une fenêtre se range juste au-dessus d’elle
        // (sur téléphone, la fenêtre est posée en bas de l’écran).
        const mesurer = () => document.documentElement.style.setProperty('--dlg-hauteur', boite.offsetHeight + 'px');
        mesurer();
        if (window.ResizeObserver) { observateur = new ResizeObserver(mesurer); observateur.observe(boite); }
        majBouton();
        (champ || principal).focus({ preventScroll: true });
        if (champ && champ.value) champ.select();
    }

    function confirmer(o) {
        const c = options(o, { titre: 'Confirmer ?', confirmer: 'Confirmer', annuler: 'Annuler', danger: false });
        const attendu = c.saisie && c.saisie.attendu != null ? String(c.saisie.attendu) : null;
        return enFile((tenir) => monter({
            role: c.danger ? 'alertdialog' : 'dialog',
            titre: c.titre, message: c.message, icone: c.icone || (c.danger ? '⚠' : '?'),
            type: 'info', danger: !!c.danger,
            libelleValider: c.confirmer, libelleAnnuler: c.annuler, annule: false,
            champ: attendu == null ? null : {
                etiquette: (c.saisie && c.saisie.etiquette) || `Retape « ${attendu} » pour confirmer`,
                placeholder: attendu, valeur: ''
            },
            actif: attendu == null ? null : (v) => plier(v) === plier(attendu),
            resultat: (v) => (attendu == null || plier(v) === plier(attendu)) ? true : undefined
        }, tenir));
    }

    function demander(o) {
        const c = options(o, { titre: 'Ta réponse', confirmer: 'Valider', annuler: 'Annuler', valeur: '', type: 'text', obligatoire: false });
        return enFile((tenir) => monter({
            titre: c.titre, message: c.message, icone: c.icone || '✎', type: 'info',
            libelleValider: c.confirmer, libelleAnnuler: c.annuler, annule: null,
            champ: { etiquette: c.etiquette || c.titre, placeholder: c.placeholder, valeur: c.valeur },
            resultat: (v, erreur) => {
                const texte = String(v == null ? '' : v);
                if (c.obligatoire && !texte.trim()) { erreur('Ce champ ne peut pas rester vide.'); return undefined; }
                if (c.type === 'number' && texte.trim() !== '') {
                    const n = Number(texte.trim().replace(',', '.'));
                    if (!Number.isFinite(n)) { erreur('Entre un nombre (ex : 2 ou -1).'); return undefined; }
                    if (c.min != null && n < c.min) { erreur(`Au moins ${c.min}.`); return undefined; }
                    if (c.max != null && n > c.max) { erreur(`Au plus ${c.max}.`); return undefined; }
                }
                if (typeof c.valider === 'function') {
                    const msg = c.valider(texte);
                    if (msg) { erreur(msg); return undefined; }
                }
                return texte;
            }
        }, tenir));
    }

    function informer(o) {
        const c = options(o, { titre: 'Information', bouton: 'Compris', type: 'info' });
        const type = SCEAUX[c.type] ? c.type : 'info';
        return enFile((tenir) => monter({
            role: type === 'erreur' ? 'alertdialog' : 'dialog',
            titre: c.titre, message: c.message, icone: c.icone || SCEAUX[type], type,
            libelleValider: c.bouton, libelleAnnuler: null, annule: true,
            resultat: () => true
        }, tenir)).then(() => undefined);
    }

    window.Dialogue = {
        confirmer, demander, informer,
        ouvert: () => !!document.querySelector('.dlg-voile:not(.sort)')
    };
})();
