// =====================================================
// parrainage.js — inviter un ami (LOT 8.4, docs/parrainage.sql)
//
// Le filleul : le code d'un lien `?parrain=CODE` est gardé par auth.js dès
// l'arrivée sur le site (`dnd-parrain`). Il traverse l'inscription (dans les
// métadonnées du compte et dans l'adresse du mail de confirmation), puis
// `appliquer` l'enregistre une fois le compte connecté. C'est la base qui
// refuse l'auto-parrainage : son propre code, un parrainage croisé, un compte
// trop ancien.
//
// Le parrain : `ouvrir` montre son lien et ses filleuls. Au premier parrainage
// validé (adresse confirmée, premier personnage créé), son navigateur débloque
// un style de carte de héros — un cosmétique : ça ne coûte rien à personne.
//
// Chargé à la demande (charger.js).
// =====================================================
(function () {
    'use strict';

    const CLE = 'dnd-parrain';
    const CODE = /^[A-HJ-NP-Z2-9]{8}$/;
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const client = () => window.SupaAuth && window.SupaAuth.client;
    const utilisateur = () => window.SupaAuth && window.SupaAuth.currentUser;
    const toast = (m, t) => { if (window.showAppToast) window.showAppToast(m, t); };

    function messageErreur(error) {
        const code = error && error.code;
        if (code === 'PGRST202' || code === '42883') {
            console.warn('[parrainage] docs/parrainage.sql n’est pas appliqué dans Supabase.');
            return 'Le parrainage n’est pas encore ouvert. Reviens bientôt !';
        }
        if (code === '42501') return 'Connecte-toi pour obtenir ton lien de parrainage.';
        return 'Le serveur ne répond pas. Vérifie ta connexion, puis réessaie.';
    }

    /** Le code en attente : celui du lien suivi sur cet appareil, sinon celui des métadonnées du compte. */
    function codeEnAttente(user) {
        try {
            const o = JSON.parse(localStorage.getItem(CLE) || 'null');
            if (o && CODE.test(o.code)) return o.code;
        } catch (e) {}
        const meta = user && user.user_metadata ? String(user.user_metadata.parrain || '') : '';
        return CODE.test(meta) ? meta : null;
    }

    // =====================================================
    // LE FILLEUL
    // =====================================================
    /** Enregistre le parrain du compte connecté. Rend la réponse de la base, ou null (réessayé plus tard). */
    async function appliquer(user) {
        const u = user || utilisateur();
        const code = codeEnAttente(u);
        if (!u || !code || !client()) return null;
        let reponse;
        try {
            const { data, error } = await client().rpc('parrainage_enregistrer', { p_code: code });
            // Hors ligne, ou fonction pas encore installée : le code attend la prochaine connexion.
            if (error) return null;
            reponse = data;
        } catch (e) { return null; }
        try { localStorage.removeItem(CLE); } catch (e) {}
        if (u.user_metadata && u.user_metadata.parrain) {
            try { await client().auth.updateUser({ data: { parrain: null } }); } catch (e) {}
        }
        if (reponse === 'ok') toast('🤝 Bienvenue ! Ton arrivée par le lien d’un ami est bien notée.', 'reussite');
        else if (reponse === 'soi-meme') toast('Ce lien de parrainage est le tien : on ne se parraine pas soi-même.', 'info');
        return reponse;
    }

    // =====================================================
    // LE PARRAIN
    // =====================================================
    /** { code, inscrits, valides } — ou { erreur }. `creer` : obtient le code s'il n'existe pas encore. */
    async function etat(creer) {
        if (!client() || !utilisateur()) return { erreur: 'Connecte-toi pour obtenir ton lien de parrainage.' };
        try {
            if (creer) {
                const r = await client().rpc('parrainage_mon_code');
                if (r.error) return { erreur: messageErreur(r.error) };
            }
            const { data, error } = await client().rpc('parrainage_etat');
            if (error) return { erreur: messageErreur(error) };
            const e = data || {};
            return { code: CODE.test(String(e.code || '')) ? e.code : null, inscrits: Number(e.inscrits) || 0, valides: Number(e.valides) || 0 };
        } catch (err) {
            return { erreur: messageErreur(null) };
        }
    }

    /** Débloque la récompense du parrain dès qu'un filleul est validé. */
    function recompenser(e) {
        if (e && !e.erreur && e.valides > 0 && window.Exploits && !window.Exploits.a('parrain')) window.Exploits.debloquer('parrain');
    }
    /** Appelé après la connexion d'un compte qui a déjà un lien : un filleul a-t-il été validé ? */
    async function verifier() {
        if (window.Exploits && window.Exploits.a('parrain')) return null;
        const e = await etat(false);
        recompenser(e);
        return e;
    }

    const lien = (code) => { const u = new URL(location.origin + location.pathname); u.searchParams.set('parrain', code); return u.toString(); };

    // =====================================================
    // LA FENÊTRE
    // =====================================================
    let stylesPoses = false;
    function poserStyles() {
        if (stylesPoses) return;
        stylesPoses = true;
        const s = document.createElement('style');
        s.id = 'parrainage-styles';
        s.textContent = `
        .par { display: flex; flex-direction: column; gap: 12px; }
        .par-statut { margin: 0; font-style: italic; }
        .par-statut[data-type="erreur"] { font-style: normal; color: #9b1c1c; }
        .par-champ { display: flex; flex-direction: column; gap: 6px; }
        .par-champ > span { font-family: 'Cinzel', Georgia, serif; font-size: .74rem; letter-spacing: .06em; text-transform: uppercase; opacity: .85; }
        .par-ligne { display: flex; gap: 8px; flex-wrap: wrap; }
        .par-ligne .dlg-saisie { flex: 1 1 220px; min-width: 0; font-size: .9rem; }
        .par-chiffres { display: flex; gap: 10px; margin: 0; padding: 0; list-style: none; }
        .par-chiffres li { flex: 1 1 0; padding: 10px; text-align: center; border-radius: 12px; border: 1px solid rgba(196,155,53,.5); background: rgba(255,250,236,.6); }
        .par-chiffres b { display: block; font-family: 'Cinzel', Georgia, serif; font-size: 1.5rem; }
        .par-aide { margin: 0; font-size: .86rem; opacity: .85; }
        body.theme-dark .par-chiffres li { background: rgba(255,255,255,.05); border-color: rgba(196,155,53,.35); }
        body.theme-dark .par-statut[data-type="erreur"] { color: #ff9b8f; }`;
        document.head.appendChild(s);
    }

    async function ouvrir() {
        if (!window.Dialogue) return null;
        if (!utilisateur()) {
            return window.Dialogue.informer({ titre: 'Parrainer un ami', icone: '🤝', message: 'Connecte-toi pour obtenir ton lien de parrainage.' });
        }
        poserStyles();
        let corps = null, dernier = null;
        const peindre = () => {
            if (!corps) return;
            const e = dernier;
            if (!e) { corps.innerHTML = '<p class="par-statut" role="status" aria-live="polite">Préparation de ton lien…</p>'; return; }
            if (e.erreur || !e.code) {
                corps.innerHTML = `<p class="par-statut" role="status" aria-live="polite" data-type="erreur">${esc(e.erreur || messageErreur(null))}</p>`;
                return;
            }
            const url = lien(e.code);
            const partage = !!navigator.share;
            corps.innerHTML = `
                <label class="par-champ"><span>Ton lien d’invitation</span>
                    <span class="par-ligne">
                        <input type="text" class="dlg-saisie par-lien" readonly value="${esc(url)}" aria-describedby="par-aide">
                        <button type="button" class="dlg-btn dlg-secondaire" data-par="copier">📋 Copier</button>
                        ${partage ? '<button type="button" class="dlg-btn dlg-secondaire" data-par="partager">📤 Partager</button>' : ''}
                    </span>
                </label>
                <ul class="par-chiffres" aria-label="Tes parrainages">
                    <li><b>${e.inscrits}</b>ami${e.inscrits > 1 ? 's' : ''} inscrit${e.inscrits > 1 ? 's' : ''}</li>
                    <li><b>${e.valides}</b>parrainage${e.valides > 1 ? 's' : ''} validé${e.valides > 1 ? 's' : ''}</li>
                </ul>
                <p class="par-aide" id="par-aide">Un parrainage est validé quand ton ami a confirmé son adresse e-mail et créé son premier personnage. Une petite surprise attend les bons guides.</p>
                <p class="par-statut" role="status" aria-live="polite"></p>`;
        };
        const statut = (texte) => { const p = corps && corps.querySelector('.par-statut'); if (p) p.textContent = texte; };

        const promesse = window.Dialogue.fenetre({
            titre: 'Parrainer un ami', icone: '🤝', confirmer: 'Fermer', annuler: null, annule: null,
            message: 'Invite un ami à forger son héros sur Bones & Blades.',
            corps() {
                corps = document.createElement('div');
                corps.className = 'par';
                peindre();
                corps.addEventListener('click', async (ev) => {
                    const b = ev.target.closest('[data-par]');
                    if (!b || !dernier || !dernier.code) return;
                    const url = lien(dernier.code);
                    if (b.dataset.par === 'copier') {
                        try { await navigator.clipboard.writeText(url); statut('Lien copié.'); }
                        catch (err) { const champ = corps.querySelector('.par-lien'); if (champ) { champ.focus(); champ.select(); } statut('Sélectionne le lien, puis copie-le.'); }
                    } else if (b.dataset.par === 'partager') {
                        try { await navigator.share({ title: 'Bones & Blades', text: 'Viens forger ton héros avec moi sur Bones & Blades !', url }); }
                        catch (err) { /* partage annulé */ }
                    }
                });
                return corps;
            },
            resultat: () => true
        });

        dernier = await etat(true);
        peindre();
        if (!dernier.erreur) {
            // Le compte a désormais un lien : la connexion suivante vérifiera ses filleuls (auth.js).
            const u = utilisateur();
            if (u && !(u.user_metadata && u.user_metadata.bnb_parrain)) {
                try { await client().auth.updateUser({ data: { bnb_parrain: true } }); } catch (e) {}
            }
            recompenser(dernier);
        }
        return promesse;
    }

    window.Parrainage = { ouvrir, appliquer, verifier, etat, lien, codeEnAttente };
})();
