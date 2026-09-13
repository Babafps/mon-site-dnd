// =====================================================
// cimetiere.js — le cimetière des héros (LOT 8.5, docs/cimetiere.sql)
//
// Après trois échecs aux jets contre la mort, la fiche PROPOSE de rejoindre le
// panthéon (script.js) : rien n'est jamais inhumé d'office. Le joueur choisit
// ce que garde la tombe — portrait, nom, classe, niveau, espèce, épitaphe de
// 280 caractères, date, cause — et qui la voit :
//   · publique : tous les joueurs connectés ;
//   · privée   : lui seul, et les joueurs connectés à qui il confie le lien
//                secret, révocable (`?tombe=JETON`, gardé par auth.js).
//
// L'écran #cimetiere-screen a deux vues : le cimetière public, et mes tombes
// (avec celles qu'on m'a confiées). Chaque tombe a sa carte « in memoriam »
// (style `memoriam`, hero-card-styles.js). La modération est tenue par la
// BASE : un signalement par joueur, masquage automatique au troisième,
// masquage ou rétablissement par un administrateur, limites de texte, quota
// de tombes et de portraits.
//
// Chargé à la demande (charger.js). En ligne seulement : c'est un lieu partagé.
// =====================================================
(function () {
    'use strict';

    const BUCKET = 'tombes';
    // Jamais `*` : le jeton du lien secret n'est pas lisible (docs/cimetiere.sql).
    const COLONNES = 'id,user_id,character_id,nom,classe,niveau,espece,epitaphe,cause,date_mort,portrait,visibilite,signalements,masquee,created_at';
    const LIMITES = { nom: 60, classe: 80, espece: 60, epitaphe: 280, cause: 120 };
    const SEUIL = 3;          // tombes_seuil_signalements() : la base décide, l'écran ne fait que l'afficher
    const PAGE = 24;
    const JETON = /^[0-9a-f]{64}$/;
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const client = () => window.SupaAuth && window.SupaAuth.client;
    const utilisateur = () => window.SupaAuth && window.SupaAuth.currentUser;
    const toast = (m, t) => { if (window.showAppToast) window.showAppToast(m, t); };
    const valeur = (id) => { const e = $(id); return e && e.value != null ? String(e.value).trim() : ''; };
    const idPerso = () => { try { return localStorage.getItem('dnd-active-char') || ''; } catch (e) { return ''; } };
    const visible = (id) => { const e = $(id); return !!(e && !e.classList.contains('hidden')); };
    const deuxChiffres = (n) => String(n).padStart(2, '0');
    const aujourdhui = () => { const t = new Date(); return `${t.getFullYear()}-${deuxChiffres(t.getMonth() + 1)}-${deuxChiffres(t.getDate())}`; };
    function dateLisible(iso) {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
        return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    }
    const slug = (s) => String(s || 'heros').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'heros';
    const lienDe = (jeton) => { const u = new URL(location.origin + location.pathname); u.searchParams.set('tombe', jeton); return u.toString(); };

    function messageErreur(error) {
        const code = error && error.code;
        const texte = String((error && error.message) || '') + ' ' + String((error && error.hint) || '');
        if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(code)) {
            console.warn('[cimetière] docs/cimetiere.sql n’est pas appliqué dans Supabase.', error);
            return 'Le cimetière n’est pas encore ouvert. Reviens bientôt !';
        }
        if (/quota/.test(texte)) return 'Tu as déjà 20 tombes : retires-en une pour en graver une nouvelle.';
        if (/rythme|aujourd/.test(texte)) return 'Cinq tombes en un jour, c’est beaucoup de deuils. Reviens demain.';
        if (code === '23514') return 'Un texte dépasse la longueur permise, ou la date est dans le futur.';
        if (code === '42501') return 'Cette action ne t’est pas permise.';
        if (code === 'P0002') return 'Cette tombe n’existe plus.';
        return 'Le serveur ne répond pas. Vérifie ta connexion, puis réessaie.';
    }

    // =====================================================
    // LES PORTRAITS — un seau privé : on les télécharge avec la session
    // =====================================================
    const portraits = new Map();              // chemin -> promesse d'adresse blob:
    function urlPortrait(chemin) {
        if (!chemin || !client()) return Promise.resolve(null);
        if (!portraits.has(chemin)) {
            const p = client().storage.from(BUCKET).download(chemin)
                .then(({ data, error }) => (error || !data ? null : URL.createObjectURL(data)))
                .catch(() => null)
                .then((u) => { if (!u) portraits.delete(chemin); return u; });
            portraits.set(chemin, p);
        }
        return portraits.get(chemin);
    }
    function oublierPortrait(chemin) {
        const p = portraits.get(chemin);
        portraits.delete(chemin);
        if (p) p.then(u => { if (u) URL.revokeObjectURL(u); });
    }

    /** Le portrait de la fiche réduit à 400 px, en JPEG sous 190 Ko (le stockage refuse au-delà de 200). */
    function compresser(source) {
        return new Promise((tenir) => {
            const img = new Image();
            img.onload = () => {
                const echelle = Math.min(1, 400 / Math.max(img.width, img.height));
                const cv = document.createElement('canvas');
                cv.width = Math.max(1, Math.round(img.width * echelle));
                cv.height = Math.max(1, Math.round(img.height * echelle));
                const ctx = cv.getContext('2d');
                ctx.fillStyle = '#1a1714';                 // le JPEG n'a pas de transparence
                ctx.fillRect(0, 0, cv.width, cv.height);
                ctx.drawImage(img, 0, 0, cv.width, cv.height);
                const essayer = (q) => cv.toBlob((b) => {
                    if (b && b.size > 190000 && q > 0.45) essayer(Math.round((q - 0.1) * 100) / 100);
                    else tenir(b && b.size <= 200000 ? b : null);
                }, 'image/jpeg', q);
                try { essayer(0.85); } catch (e) { tenir(null); }
            };
            img.onerror = () => tenir(null);
            img.src = source;
        });
    }

    /** La carte « in memoriam » d'une tombe, dessinée par hero-card.js. */
    function dessinerCarte(t, avatar, echelle) {
        if (!window.HeroCard || !window.HeroCard.dessinerPour) return Promise.resolve(null);
        const date = dateLisible(t.date_mort);
        return window.HeroCard.dessinerPour({
            style: 'memoriam', format: '4:5', echelle: echelle || 0.5, sansBlocs: true, devise: t.epitaphe || '',
            donnees: {
                nom: t.nom, classe: t.classe, niveau: String(t.niveau == null ? 1 : t.niveau), race: t.espece,
                historique: [date ? '† ' + date : '', t.cause].filter(Boolean).join(' · '), avatar
            }
        }).catch(() => null);
    }

    // =====================================================
    // LE STYLE (porté par le module)
    // =====================================================
    let stylesPoses = false;
    function poserStyles() {
        if (stylesPoses) return;
        stylesPoses = true;
        const s = document.createElement('style');
        s.id = 'cimetiere-styles';
        s.textContent = `
        .cim-ecran { min-height: 100vh; box-sizing: border-box; padding: 18px 16px 70px; color: #2b2622;
            background: radial-gradient(ellipse at 50% 0%, rgba(120,120,135,.2), transparent 60%), linear-gradient(180deg, #ece8e1, #d6d0c5); }
        body.theme-dark .cim-ecran { color: #e9e5dc; background: radial-gradient(ellipse at 50% 0%, rgba(160,160,190,.12), transparent 60%), linear-gradient(180deg, #1e1d22, #111013); }
        .cim-wrap { max-width: 1000px; margin: 0 auto; }
        .cim-tete { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; }
        .cim-tete h1 { flex: 1 1 220px; margin: 0; padding: 0; border: 0; background: none; font-family: 'Cinzel', Georgia, serif; font-size: clamp(1.3rem, 4.2vw, 1.9rem); color: inherit; text-transform: none; }
        .cim-bouton { min-height: 44px; padding: 8px 14px; border-radius: 999px; cursor: pointer; font: inherit; font-family: 'Cinzel', Georgia, serif; font-size: .88rem;
            color: inherit; background: rgba(255,255,255,.55); border: 1px solid rgba(60,50,40,.3); }
        .cim-bouton:hover { background: rgba(255,255,255,.8); }
        .cim-bouton[hidden] { display: none; }
        body.theme-dark .cim-bouton { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.18); }
        body.theme-dark .cim-bouton:hover { background: rgba(255,255,255,.12); }
        .cim-intro { margin: 8px 0 14px; font-family: 'Lora', Georgia, serif; font-style: italic; opacity: .8; }
        .cim-onglets { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; border-bottom: 1px solid rgba(60,50,40,.2); }
        .cim-onglet { min-height: 44px; padding: 8px 14px; margin-bottom: -1px; cursor: pointer; font: inherit; font-family: 'Cinzel', Georgia, serif; font-size: .88rem; color: inherit;
            background: transparent; border: 1px solid transparent; border-bottom: 0; border-radius: 10px 10px 0 0; }
        .cim-onglet[aria-selected="true"] { background: rgba(255,255,255,.6); border-color: rgba(60,50,40,.2); }
        .cim-onglet[hidden] { display: none; }
        body.theme-dark .cim-onglet[aria-selected="true"] { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.15); }
        .cim-ecran button:focus-visible { outline: 2px solid var(--accent-color, #C49B35); outline-offset: 2px; }
        .cim-statut { min-height: 1.4em; margin: 0 0 10px; font-style: italic; }
        .cim-statut[data-type="erreur"] { font-style: normal; color: #9b1c1c; }
        body.theme-dark .cim-statut[data-type="erreur"] { color: #ff9b8f; }
        .cim-liste { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 16px; }
        .cim-sous-titre { grid-column: 1 / -1; margin: 12px 0 0; padding: 0; border: 0; background: none; font-family: 'Cinzel', Georgia, serif; font-size: 1rem; color: inherit; text-transform: none; }
        .cim-tombe { display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 26px 16px 16px; text-align: center; border-radius: 130px 130px 14px 14px;
            background: linear-gradient(180deg, #f5f2ed, #d5cfc4); border: 1px solid rgba(60,50,40,.25); box-shadow: inset 0 2px 0 rgba(255,255,255,.6), 0 8px 18px rgba(0,0,0,.14);
            animation: cimApparait .35s ease-out both; }
        body.theme-dark .cim-tombe { background: linear-gradient(180deg, #3b3a40, #26252b); border-color: rgba(255,255,255,.1); box-shadow: inset 0 2px 0 rgba(255,255,255,.06), 0 8px 18px rgba(0,0,0,.4); }
        .cim-tombe[hidden] { display: none; }
        .cim-tombe.est-masquee { outline: 2px dashed rgba(160,60,40,.55); outline-offset: -7px; }
        @keyframes cimApparait { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .cim-portrait { display: grid; place-items: center; width: 96px; height: 96px; overflow: hidden; border-radius: 50%; border: 3px solid rgba(120,110,100,.55);
            background: #6f6a63; color: #f2eee6; font-family: 'Cinzel', Georgia, serif; font-size: 2.2rem; filter: grayscale(.8); }
        .cim-portrait img { width: 100%; height: 100%; object-fit: cover; }
        .cim-nom { margin: 0; padding: 0; border: 0; background: none; font-family: 'Cinzel', Georgia, serif; font-size: 1.18rem; line-height: 1.25; color: inherit; text-transform: none; overflow-wrap: anywhere; }
        .cim-identite, .cim-date, .cim-motifs { margin: 0; font-size: .88rem; opacity: .85; overflow-wrap: anywhere; }
        .cim-epitaphe { margin: 4px 0; padding: 0; border: 0; font-family: 'Lora', Georgia, serif; font-style: italic; line-height: 1.5; overflow-wrap: anywhere; }
        .cim-badges { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; margin: 0; }
        .cim-badges span { padding: 2px 9px; border-radius: 999px; font-size: .74rem; background: rgba(0,0,0,.08); }
        body.theme-dark .cim-badges span { background: rgba(255,255,255,.1); }
        .cim-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin-top: 4px; }
        .cim-actions .btn-small { min-height: 38px; }
        .cim-danger { color: #9b1c1c !important; }
        body.theme-dark .cim-danger { color: #ff9b8f !important; }
        .cim-actions .btn-small.cim-danger { background: transparent !important; box-shadow: none !important; text-shadow: none !important; border: 1px solid rgba(155,28,28,.55) !important; }
        body.theme-dark .cim-actions .btn-small.cim-danger { border-color: rgba(255,155,143,.5) !important; }
        .cim-plus { display: block; margin: 18px auto 0; }
        .cim-form-grille { display: grid; grid-template-columns: 170px 1fr; gap: 14px; align-items: start; }
        .cim-apercu canvas { display: block; width: 100%; height: auto; border-radius: 10px; box-shadow: 0 6px 16px rgba(0,0,0,.25); }
        .cim-form .dlg-champ > span { font-family: 'Cinzel', Georgia, serif; font-size: .74rem; letter-spacing: .06em; text-transform: uppercase; opacity: .85; }
        .cim-form .dlg-champ > span i { text-transform: none; letter-spacing: 0; }
        .cim-form textarea.dlg-saisie { resize: vertical; min-height: 76px; font-family: 'Lora', Georgia, serif; }
        .cim-rang { display: flex; flex-wrap: wrap; gap: 0 10px; }
        .cim-rang > * { flex: 1 1 150px; min-width: 0; }
        .cim-rang > .cim-etroit { flex: 0 1 120px; }
        .cim-compte { align-self: flex-end; font-size: .78rem; opacity: .75; }
        .cim-case, .cim-visibilite label { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 8px; cursor: pointer; }
        .cim-case input, .cim-visibilite input { margin-top: 3px; accent-color: var(--primary-color, #7A2828); }
        .cim-visibilite { margin: 0 0 10px; padding: 8px 10px 2px; border: 1px solid rgba(122,40,40,.25); border-radius: 10px; }
        .cim-visibilite legend { padding: 0 4px; font-family: 'Cinzel', Georgia, serif; font-size: .8rem; }
        .cim-rappel { margin: 0; font-size: .82rem; font-style: italic; opacity: .8; }
        .cim-carte img { display: block; width: 100%; max-width: 420px; height: auto; margin: 0 auto 12px; border-radius: 12px; }
        .cim-carte .dlg-btn { display: inline-flex; text-decoration: none; }
        .cim-lien { display: flex; flex-direction: column; gap: 10px; }
        .cim-ligne { display: flex; flex-wrap: wrap; gap: 8px; }
        .cim-ligne .dlg-saisie { flex: 1 1 220px; min-width: 0; font-size: .85rem; }
        @media (max-width: 560px) { .cim-form-grille { grid-template-columns: 1fr; } .cim-apercu { max-width: 190px; margin: 0 auto; } }
        /* Le bouton ☰ reste en haut à gauche, par-dessus les écrans : l'en-tête passe dessous quand la place manque. */
        @media (max-width: 1140px) { .cim-ecran { padding-top: 72px; } }
        @media (prefers-reduced-motion: reduce) { .cim-tombe { animation: none; } }
        @media print { #cimetiere-screen { display: none !important; } }`;
        document.head.appendChild(s);
    }

    // =====================================================
    // INHUMER — le formulaire de la tombe
    // =====================================================
    /** Ce que la fiche ouverte propose de graver. Le joueur retouche tout. */
    function instantane() {
        let avatar = null;
        try { avatar = typeof window.HeroCardAvatar === 'function' ? window.HeroCardAvatar() : null; } catch (e) {}
        const n = parseInt(valeur('char-level'), 10);
        const classe = [valeur('char-class'), valeur('char-subclass') ? '(' + valeur('char-subclass') + ')' : ''].filter(Boolean).join(' ');
        return {
            nom: valeur('char-name').slice(0, LIMITES.nom),
            classe: classe.slice(0, LIMITES.classe),
            niveau: isNaN(n) ? 1 : Math.max(0, Math.min(30, n)),
            espece: valeur('char-race').slice(0, LIMITES.espece),
            avatar: avatar || null,
            character_id: UUID.test(idPerso()) ? idPerso() : null
        };
    }

    function formulaire(depart) {
        poserStyles();                      // le formulaire peut s'ouvrir depuis la fiche, avant l'écran
        let boite = null, minuteur = null, jeton = 0;
        const champ = (n) => boite.querySelector(`[name="${n}"]`);
        const lire = () => ({
            nom: champ('nom').value.trim(), classe: champ('classe').value.trim(),
            niveau: parseInt(champ('niveau').value, 10), espece: champ('espece').value.trim(),
            date_mort: champ('date').value, cause: champ('cause').value.trim(), epitaphe: champ('epitaphe').value.trim(),
            visibilite: (boite.querySelector('[name="visibilite"]:checked') || {}).value === 'publique' ? 'publique' : 'privee',
            portrait: !!(depart.avatar && champ('portrait') && champ('portrait').checked)
        });
        async function apercu() {
            const zone = boite && boite.querySelector('.cim-apercu');
            if (!zone) return;
            const d = lire(), mien = ++jeton;
            const cv = await dessinerCarte({ nom: d.nom || 'Héros sans nom', classe: d.classe, niveau: isNaN(d.niveau) ? 1 : d.niveau, espece: d.espece, date_mort: d.date_mort, cause: d.cause, epitaphe: d.epitaphe },
                d.portrait ? depart.avatar : null, 0.3);
            if (!cv || mien !== jeton || !boite.isConnected) return;
            cv.setAttribute('role', 'img');
            cv.setAttribute('aria-label', 'Aperçu de la carte in memoriam');
            zone.replaceChildren(cv);
        }
        return window.Dialogue.fenetre({
            titre: 'Rejoindre le panthéon', icone: '🪦', large: true,
            confirmer: 'Graver la tombe', annuler: 'Annuler', annule: null,
            message: 'Choisis ce que la tombe gardera de ton héros. Rien ne part tant que tu n’as pas gravé la tombe.',
            corps() {
                boite = document.createElement('div');
                boite.className = 'cim-form';
                boite.innerHTML = `<div class="cim-form-grille">
                    <div class="cim-apercu"></div>
                    <div class="cim-champs">
                        ${depart.avatar ? '<label class="cim-case"><input type="checkbox" name="portrait" checked> <span>Graver son portrait</span></label>' : ''}
                        <label class="dlg-champ"><span>Nom</span><input class="dlg-saisie" name="nom" maxlength="${LIMITES.nom}" autocomplete="off" required></label>
                        <div class="cim-rang">
                            <label class="dlg-champ"><span>Classe</span><input class="dlg-saisie" name="classe" maxlength="${LIMITES.classe}" autocomplete="off"></label>
                            <label class="dlg-champ cim-etroit"><span>Niveau</span><input class="dlg-saisie" name="niveau" type="number" min="0" max="30" inputmode="numeric"></label>
                        </div>
                        <label class="dlg-champ"><span>Espèce</span><input class="dlg-saisie" name="espece" maxlength="${LIMITES.espece}" autocomplete="off"></label>
                        <div class="cim-rang">
                            <label class="dlg-champ cim-etroit"><span>Date de sa mort</span><input class="dlg-saisie" name="date" type="date" max="${aujourdhui()}"></label>
                            <label class="dlg-champ"><span>Cause <i>(facultative)</i></span><input class="dlg-saisie" name="cause" maxlength="${LIMITES.cause}" autocomplete="off" placeholder="Tombé face à un dragon rouge"></label>
                        </div>
                        <label class="dlg-champ"><span>Épitaphe</span>
                            <textarea class="dlg-saisie" name="epitaphe" maxlength="${LIMITES.epitaphe}" rows="3" placeholder="Il n’a jamais reculé. Sauf une fois." aria-describedby="cim-compte"></textarea>
                            <small class="cim-compte" id="cim-compte" aria-live="polite">0 / ${LIMITES.epitaphe}</small></label>
                        <fieldset class="cim-visibilite"><legend>Qui peut la voir ?</legend>
                            <label><input type="radio" name="visibilite" value="privee" checked> <span><b>🔒 Privée</b> — toi, et les joueurs à qui tu confies son lien secret</span></label>
                            <label><input type="radio" name="visibilite" value="publique"> <span><b>🌍 Publique</b> — tous les joueurs connectés</span></label>
                        </fieldset>
                        <p class="cim-rappel">Une tombe publique respecte les conditions d’utilisation : ni contenu choquant, ni données personnelles. Chacun peut la signaler.</p>
                    </div>
                </div>`;
                champ('nom').value = depart.nom;
                champ('classe').value = depart.classe;
                champ('niveau').value = String(depart.niveau);
                champ('espece').value = depart.espece;
                champ('date').value = aujourdhui();
                const compte = () => { boite.querySelector('.cim-compte').textContent = `${champ('epitaphe').value.length} / ${LIMITES.epitaphe}`; };
                const plusTard = () => { compte(); clearTimeout(minuteur); minuteur = setTimeout(apercu, 350); };
                boite.addEventListener('input', plusTard);
                boite.addEventListener('change', plusTard);
                // Entrée passe à la ligne dans l'épitaphe, au lieu de graver la tombe.
                champ('epitaphe').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.stopPropagation(); });
                setTimeout(apercu, 60);
                return boite;
            },
            resultat(signaler) {
                const d = lire();
                if (!d.nom) { signaler('Donne un nom au héros.'); champ('nom').focus(); return undefined; }
                if (isNaN(d.niveau) || d.niveau < 0 || d.niveau > 30) { signaler('Le niveau va de 0 à 30.'); champ('niveau').focus(); return undefined; }
                if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date_mort)) { signaler('Choisis la date de sa mort.'); champ('date').focus(); return undefined; }
                if (d.date_mort > aujourdhui()) { signaler('La date ne peut pas être dans le futur.'); champ('date').focus(); return undefined; }
                const trop = Object.keys(LIMITES).find(k => String(d[k] || '').length > LIMITES[k]);
                if (trop) { signaler('Un texte dépasse la longueur permise.'); return undefined; }
                return d;
            }
        });
    }

    async function creer(d, depart) {
        const c = client(), u = utilisateur();
        const ligne = {
            character_id: depart.character_id, nom: d.nom, classe: d.classe, niveau: d.niveau, espece: d.espece,
            epitaphe: d.epitaphe, cause: d.cause, date_mort: d.date_mort, visibilite: d.visibilite
        };
        let r;
        try { r = await c.from('tombes').insert(ligne).select(COLONNES).single(); }
        catch (e) { r = { error: e }; }
        if (r.error || !r.data) {
            await window.Dialogue.informer({ titre: 'La tombe n’a pas pu être gravée', type: 'erreur', message: messageErreur(r.error) });
            return null;
        }
        let tombe = r.data;
        if (d.portrait && depart.avatar) {
            const image = await compresser(depart.avatar);
            let grave = false;
            if (image) {
                const chemin = `${u.id}/${tombe.id}.jpg`;
                try {
                    const envoi = await c.storage.from(BUCKET).upload(chemin, await image.arrayBuffer(), { contentType: 'image/jpeg', upsert: false });
                    if (!envoi.error) {
                        const m = await c.from('tombes').update({ portrait: chemin }).eq('id', tombe.id).select(COLONNES).single();
                        if (!m.error && m.data) { tombe = m.data; grave = true; }
                    }
                } catch (e) { /* la tombe reste, sans portrait */ }
            }
            if (!grave) toast('Le portrait n’a pas pu être gravé : la tombe reste sans portrait.', 'info');
        }
        if (window.Exploits) window.Exploits.debloquer('pantheon');
        try { document.dispatchEvent(new CustomEvent('cimetiere:tombe', { detail: { id: tombe.id } })); } catch (e) {}
        return tombe;
    }

    let inhumationEnCours = false;
    const ficheChargee = () => !!(idPerso() && $('char-name') && (visible('app-screen') || retour === 'app-screen'));
    /** Propose de graver la tombe du héros ouvert. Rend la tombe créée, ou null. */
    async function inhumer() {
        if (inhumationEnCours || !window.Dialogue) return null;
        if (!utilisateur() || !client()) {
            await window.Dialogue.informer({ titre: 'Cimetière des héros', icone: '🪦', message: 'Connecte-toi pour graver une tombe : le cimetière vit en ligne.' });
            return null;
        }
        if (!ficheChargee()) { toast('Ouvre la fiche du héros à inhumer.', 'info'); return null; }
        inhumationEnCours = true;
        try {
            const depart = instantane();
            const d = await formulaire(depart);
            if (!d) return null;
            const tombe = await creer(d, depart);
            if (!tombe) return null;
            toast(`🕯️ ${tombe.nom} repose désormais au cimetière des héros.`, 'reussite');
            await ouvrir('mes');
            return tombe;
        } finally {
            inhumationEnCours = false;
        }
    }

    // =====================================================
    // L'ÉCRAN
    // =====================================================
    let ecran = null, vue = 'publique', retour = 'home-screen', decalage = 0, admin = false, tombeLien = null, jetonVue = 0;
    const VUES = [
        { id: 'publique', libelle: '⚱️ Cimetière public' },
        { id: 'mes', libelle: '🪦 Mes tombes' },
        { id: 'moderation', libelle: '🛡 Signalées' }
    ];

    function construire() {
        if (ecran) return;
        // navTo ne connaît que les écrans déclarés (auth.js) : le cimetière s'y ajoute, comme les tarifs.
        if (typeof APP_SCREENS !== 'undefined' && !APP_SCREENS.includes('cimetiere-screen')) APP_SCREENS.push('cimetiere-screen');
        poserStyles();
        ecran = document.createElement('div');
        ecran.id = 'cimetiere-screen';
        ecran.className = 'screen-view hidden cim-ecran no-print';
        ecran.innerHTML = `<div class="cim-wrap">
            <header class="cim-tete">
                <button type="button" class="cim-bouton" data-cim="retour">← Retour</button>
                <h1>🪦 Cimetière des héros</h1>
                <button type="button" class="cim-bouton" data-cim="inhumer" hidden>🕯️ Inhumer ce héros</button>
            </header>
            <p class="cim-intro">Ici reposent les héros tombés. Chaque tombe garde ce que son joueur a voulu graver.</p>
            <div class="cim-onglets" role="tablist" aria-label="Vues du cimetière">
                ${VUES.map(v => `<button type="button" class="cim-onglet" role="tab" id="cim-onglet-${v.id}" data-vue="${v.id}" aria-controls="cim-liste" aria-selected="false" tabindex="-1"${v.id === 'moderation' ? ' hidden' : ''}>${v.libelle}</button>`).join('')}
            </div>
            <p class="cim-statut" role="status" aria-live="polite"></p>
            <div class="cim-liste" id="cim-liste" role="tabpanel" tabindex="-1"></div>
            <button type="button" class="cim-bouton cim-plus" data-cim="plus" hidden>Voir plus de tombes</button>
        </div>`;
        document.body.appendChild(ecran);

        ecran.addEventListener('click', (e) => {
            const b = e.target.closest('button');
            if (!b || !ecran.contains(b)) return;
            if (b.dataset.cim === 'retour') { window.navTo(retour); return; }
            if (b.dataset.cim === 'inhumer') { inhumer(); return; }
            if (b.dataset.cim === 'plus') { afficher(vue, true); return; }
            if (b.dataset.vue) { afficher(b.dataset.vue); return; }
            const article = b.closest('.cim-tombe');
            if (article && b.dataset.act) agir(b.dataset.act, article);
        });
        // Les onglets au clavier : flèches, Début, Fin.
        ecran.querySelector('.cim-onglets').addEventListener('keydown', (e) => {
            const onglets = [...ecran.querySelectorAll('.cim-onglet:not([hidden])')];
            const i = onglets.indexOf(document.activeElement);
            if (i < 0) return;
            let j = null;
            if (e.key === 'ArrowRight') j = (i + 1) % onglets.length;
            else if (e.key === 'ArrowLeft') j = (i - 1 + onglets.length) % onglets.length;
            else if (e.key === 'Home') j = 0;
            else if (e.key === 'End') j = onglets.length - 1;
            if (j == null) return;
            e.preventDefault();
            onglets[j].focus();
            afficher(onglets[j].dataset.vue);
        });
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape' || !visible('cimetiere-screen') || document.querySelector('.dlg-voile, .hc-annonce')) return;
            window.navTo(retour);
        });
    }

    function statut(texte, erreur) {
        const p = ecran.querySelector('.cim-statut');
        p.textContent = texte || '';
        if (erreur) p.dataset.type = 'erreur'; else delete p.dataset.type;
    }
    function majOnglets() {
        ecran.querySelectorAll('.cim-onglet').forEach(b => {
            const on = b.dataset.vue === vue;
            b.setAttribute('aria-selected', on ? 'true' : 'false');
            b.tabIndex = on || (vue === 'lien' && b.dataset.vue === 'publique') ? 0 : -1;
        });
        ecran.querySelector('[data-vue="moderation"]').hidden = !admin;
        const liste = ecran.querySelector('.cim-liste');
        const actif = ecran.querySelector(`.cim-onglet[data-vue="${vue}"]`);
        if (actif) liste.setAttribute('aria-labelledby', actif.id); else liste.removeAttribute('aria-labelledby');
    }

    async function verifierAdmin() {
        try {
            await window.charger('admin');
            admin = !!(window.Admin && await window.Admin.verifier());
        } catch (e) { admin = false; }
    }

    const VIDES = {
        publique: 'Aucune tombe publique pour l’instant. Les héros sont coriaces.',
        mes: 'Tu n’as encore inhumé aucun héros. Longue vie à eux !',
        moderation: 'Aucune tombe à examiner.',
        lien: 'Ce lien ne mène à aucune tombe : il a peut-être été révoqué, ou la tombe retirée.'
    };

    async function afficher(nouvelle, suite) {
        vue = nouvelle;
        majOnglets();
        const liste = ecran.querySelector('.cim-liste');
        const plus = ecran.querySelector('.cim-plus');
        const mien = ++jetonVue;
        if (!suite) { decalage = 0; liste.replaceChildren(); }
        plus.hidden = true;
        const c = client(), u = utilisateur();
        if (!c || !u) { statut('Connecte-toi pour visiter le cimetière des héros.'); return; }
        statut('Les brumes se lèvent…');
        let lignes = [], confiees = [], erreur = null;
        try {
            if (vue === 'moderation') {
                const r = await c.rpc('tombes_signalees');
                erreur = r.error;
                lignes = Array.isArray(r.data) ? r.data : [];
            } else if (vue === 'lien') {
                if (tombeLien) {
                    const r = await c.from('tombes').select(COLONNES).eq('id', tombeLien).limit(1);
                    erreur = r.error;
                    lignes = r.data || [];
                }
            } else {
                let q = c.from('tombes').select(COLONNES);
                q = vue === 'publique'
                    ? q.eq('visibilite', 'publique').eq('masquee', false).lt('signalements', SEUIL)
                    : q.eq('user_id', u.id);
                const r = await q.order('created_at', { ascending: false }).range(decalage, decalage + PAGE - 1);
                erreur = r.error;
                lignes = r.data || [];
                if (vue === 'mes' && !suite && !erreur) {
                    // Les tombes privées qu'on m'a confiées par leur lien
                    const a = await c.from('tombes_acces').select('tombe_id').eq('user_id', u.id);
                    const ids = (a.data || []).map(x => x.tombe_id).filter(id => UUID.test(String(id)));
                    if (!a.error && ids.length) {
                        const r2 = await c.from('tombes').select(COLONNES).in('id', ids).order('created_at', { ascending: false }).limit(PAGE);
                        if (!r2.error) confiees = (r2.data || []).filter(t => t.user_id !== u.id);
                    }
                }
            }
        } catch (e) { erreur = e; }
        if (mien !== jetonVue) return;
        if (erreur) { statut(messageErreur(erreur), true); return; }
        if (vue === 'lien' && lignes.length) {
            const h = document.createElement('h2');
            h.className = 'cim-sous-titre';
            h.textContent = 'Une tombe qu’on t’a confiée';
            liste.appendChild(h);
        }
        lignes.forEach(t => liste.appendChild(stele(t)));
        if (confiees.length) {
            const h = document.createElement('h2');
            h.className = 'cim-sous-titre';
            h.textContent = 'Confiées par leur lien secret';
            liste.appendChild(h);
            confiees.forEach(t => liste.appendChild(stele(t)));
        }
        decalage += vue === 'publique' || vue === 'mes' ? lignes.length : 0;
        statut(!liste.querySelector('.cim-tombe') ? VIDES[vue] : '');
        plus.hidden = !((vue === 'publique' || vue === 'mes') && lignes.length === PAGE);
    }

    function stele(t) {
        const u = utilisateur();
        const moi = !!(u && t.user_id === u.id);
        const masquee = !!t.masquee || (Number(t.signalements) || 0) >= SEUIL;
        const a = document.createElement('article');
        a.className = 'cim-tombe' + (masquee ? ' est-masquee' : '');
        a.dataset.id = t.id;
        a.setAttribute('aria-labelledby', 'cim-nom-' + t.id);
        const identite = [t.classe, t.niveau != null ? 'niveau ' + t.niveau : '', t.espece].filter(Boolean).join(' · ');
        const badges = [];
        if (moi || vue === 'moderation') badges.push(t.visibilite === 'publique' ? '🌍 Publique' : '🔒 Privée');
        if (t.masquee) badges.push('🛡 Masquée par la modération');
        else if (masquee) badges.push('⚠ Masquée après signalements');
        else if ((moi || vue === 'moderation') && t.signalements > 0) badges.push(`⚑ ${t.signalements} signalement${t.signalements > 1 ? 's' : ''}`);
        const motifs = vue === 'moderation' && Array.isArray(t.motifs) ? t.motifs.filter(Boolean) : [];
        const initiale = (String(t.nom || '?').trim().charAt(0) || '?').toUpperCase();
        a.innerHTML = `
            <div class="cim-portrait" aria-hidden="true"><span>${esc(initiale)}</span></div>
            <h2 class="cim-nom" id="cim-nom-${esc(t.id)}">${esc(t.nom)}</h2>
            ${identite ? `<p class="cim-identite">${esc(identite)}</p>` : ''}
            <p class="cim-date">† ${esc(dateLisible(t.date_mort))}${t.cause ? ' — ' + esc(t.cause) : ''}</p>
            ${t.epitaphe ? `<blockquote class="cim-epitaphe">« ${esc(t.epitaphe)} »</blockquote>` : ''}
            ${badges.length ? `<p class="cim-badges">${badges.map(b => `<span>${esc(b)}</span>`).join('')}</p>` : ''}
            ${motifs.length ? `<p class="cim-motifs">Motifs : ${motifs.map(esc).join(' · ')}</p>` : ''}
            <div class="cim-actions">
                <button type="button" class="btn-small" data-act="carte">🃏 Carte in memoriam</button>
                ${moi ? `${t.visibilite === 'privee' ? '<button type="button" class="btn-small" data-act="lien">🔗 Lien secret</button>' : ''}
                    <button type="button" class="btn-small" data-act="visibilite">${t.visibilite === 'publique' ? '🔒 Rendre privée' : '🌍 Rendre publique'}</button>
                    <button type="button" class="btn-small" data-act="revivre">✨ Ramener à la vie</button>
                    <button type="button" class="btn-small cim-danger" data-act="retirer">🗑 Retirer</button>`
                : '<button type="button" class="btn-small" data-act="signaler">⚑ Signaler</button>'}
                ${admin && !t.masquee ? '<button type="button" class="btn-small" data-act="masquer">🛡 Masquer</button>' : ''}
                ${admin && (masquee || t.signalements > 0) ? '<button type="button" class="btn-small" data-act="retablir">↩ Rétablir</button>' : ''}
            </div>`;
        a._tombe = t;
        if (t.portrait) {
            urlPortrait(t.portrait).then((url) => {
                if (!url) return;
                const img = new Image();
                img.alt = '';
                img.src = url;
                a.querySelector('.cim-portrait').replaceChildren(img);
            });
        }
        return a;
    }

    // =====================================================
    // LES GESTES SUR UNE TOMBE
    // =====================================================
    function agir(act, article) {
        const t = article._tombe;
        if (!t) return null;
        switch (act) {
            case 'carte': return montrerCarte(t);
            case 'signaler': return signalerTombe(t);
            case 'lien': return gererLien(t);
            case 'visibilite': return basculerVisibilite(t, article);
            case 'revivre': return retirer(t, article, true);
            case 'retirer': return retirer(t, article, false);
            case 'masquer': return moderer(t, true);
            case 'retablir': return moderer(t, false);
        }
        return null;
    }

    async function montrerCarte(t) {
        poserStyles();
        const avatar = t.portrait ? await urlPortrait(t.portrait) : null;
        const cv = await dessinerCarte(t, avatar, 1);
        if (!cv) { toast('La carte n’a pas pu être dessinée.', 'erreur'); return; }
        let image = '';
        try { image = cv.toDataURL('image/jpeg', 0.9); } catch (e) {}
        return window.Dialogue.fenetre({
            titre: 'In memoriam', icone: '🕯️', large: true, confirmer: 'Fermer', annuler: null, annule: null,
            corps() {
                const b = document.createElement('div');
                b.className = 'cim-carte';
                b.innerHTML = image
                    ? `<img src="${image}" alt="Carte in memoriam de ${esc(t.nom)}"><a class="dlg-btn dlg-secondaire" href="${image}" download="in-memoriam-${esc(slug(t.nom))}.jpg">💾 Enregistrer l’image</a>`
                    : '<p>La carte n’a pas pu être préparée.</p>';
                return b;
            },
            resultat: () => true
        });
    }

    async function signalerTombe(t) {
        const motif = await window.Dialogue.choisir({
            titre: 'Signaler cette tombe', icone: '⚑', confirmer: 'Signaler',
            message: 'Qu’est-ce qui ne va pas ? Au troisième signalement, la tombe est masquée en attendant un administrateur.',
            options: [
                { valeur: 'Contenu choquant ou haineux', titre: 'Contenu choquant ou haineux' },
                { valeur: 'Harcèlement', titre: 'Harcèlement ou moquerie envers quelqu’un' },
                { valeur: 'Données personnelles', titre: 'Données personnelles', detail: 'Un vrai nom, une adresse, un numéro…' },
                { valeur: 'Portrait inapproprié', titre: 'Portrait inapproprié' },
                { valeur: 'Publicité ou spam', titre: 'Publicité ou spam' }
            ]
        });
        if (!motif) return;
        const { data, error } = await client().rpc('tombe_signaler', { p_id: t.id, p_motif: motif });
        if (error) { toast(messageErreur(error), 'erreur'); return; }
        const MESSAGES = {
            signale: 'Merci : la tombe est signalée.', deja: 'Tu as déjà signalé cette tombe.',
            limite: 'Tu as beaucoup signalé aujourd’hui : réessaie demain.', introuvable: 'Cette tombe n’est plus visible.',
            connexion: 'Connecte-toi pour signaler une tombe.'
        };
        toast(MESSAGES[data] || MESSAGES.signale, data === 'signale' ? 'reussite' : 'info');
    }

    async function gererLien(t) {
        poserStyles();
        let jeton = null;
        try {
            const r = await client().rpc('tombe_lien', { p_id: t.id });
            if (r.error) { toast(messageErreur(r.error), 'erreur'); return; }
            jeton = String(r.data || '');
        } catch (e) { toast(messageErreur(e), 'erreur'); return; }
        if (!JETON.test(jeton)) { toast(messageErreur(null), 'erreur'); return; }
        const url = lienDe(jeton);
        let boite = null, revoquer = false;
        await window.Dialogue.fenetre({
            titre: 'Lien secret', icone: '🔗', confirmer: 'Fermer', annuler: null, annule: null,
            message: `Les joueurs connectés qui reçoivent ce lien peuvent voir la tombe de ${t.nom}. Tu peux le révoquer quand tu veux.`,
            corps() {
                boite = document.createElement('div');
                boite.className = 'cim-lien';
                boite.innerHTML = `<span class="cim-ligne">
                        <input type="text" class="dlg-saisie cim-lien-url" readonly value="${esc(url)}" aria-label="Lien secret de la tombe">
                        <button type="button" class="dlg-btn dlg-secondaire" data-lien="copier">📋 Copier</button>
                        ${navigator.share ? '<button type="button" class="dlg-btn dlg-secondaire" data-lien="partager">📤 Partager</button>' : ''}
                    </span>
                    <p class="cim-rappel" role="status" aria-live="polite"></p>
                    <button type="button" class="dlg-btn dlg-secondaire cim-danger" data-lien="revoquer">🚫 Révoquer ce lien</button>`;
                const dire = (m) => { boite.querySelector('[role="status"]').textContent = m; };
                boite.addEventListener('click', async (ev) => {
                    const b = ev.target.closest('[data-lien]');
                    if (!b) return;
                    if (b.dataset.lien === 'copier') {
                        try { await navigator.clipboard.writeText(url); dire('Lien copié.'); }
                        catch (e) { const champ = boite.querySelector('.cim-lien-url'); champ.focus(); champ.select(); dire('Sélectionne le lien, puis copie-le.'); }
                    } else if (b.dataset.lien === 'partager') {
                        try { await navigator.share({ title: 'In memoriam — ' + t.nom, url }); } catch (e) { /* partage annulé */ }
                    } else if (b.dataset.lien === 'revoquer') {
                        revoquer = true;
                        const valider = boite.closest('.dlg') && boite.closest('.dlg').querySelector('[data-dlg="valider"]');
                        if (valider) valider.click();
                    }
                });
                return boite;
            },
            resultat: () => true
        });
        if (!revoquer) return;
        const ok = await window.Dialogue.confirmer({
            titre: 'Révoquer le lien ?', icone: '🚫', danger: true, confirmer: 'Révoquer',
            message: 'L’ancien lien cessera de fonctionner, et les joueurs qui l’avaient ouvert ne verront plus la tombe. Un nouveau lien pourra être créé ensuite.'
        });
        if (!ok) return;
        const r = await client().rpc('tombe_revoquer_lien', { p_id: t.id });
        if (r.error) toast(messageErreur(r.error), 'erreur');
        else toast('Lien révoqué.', 'reussite');
    }

    async function basculerVisibilite(t, article) {
        const publique = t.visibilite !== 'publique';
        if (publique && !await window.Dialogue.confirmer({
            titre: 'Rendre la tombe publique ?', icone: '🌍', confirmer: 'Rendre publique',
            message: `Tous les joueurs connectés pourront voir la tombe de ${t.nom}, et la signaler. Elle doit respecter les conditions d’utilisation.`
        })) return;
        const r = await client().from('tombes').update({ visibilite: publique ? 'publique' : 'privee' }).eq('id', t.id).select(COLONNES).single();
        if (r.error || !r.data) { toast(messageErreur(r.error), 'erreur'); return; }
        article.replaceWith(stele(r.data));
        toast(publique ? 'La tombe est publique.' : 'La tombe est privée : seuls les détenteurs de son lien la voient encore.', 'reussite');
    }

    async function retirer(t, article, revivre) {
        const ok = await window.Dialogue.confirmer(revivre
            ? { titre: 'Ramener à la vie ?', icone: '✨', confirmer: 'Ramener à la vie',
                message: `${t.nom} quitte le cimetière : sa tombe, son épitaphe et son portrait gravé disparaissent. La fiche du personnage, elle, ne change pas.` }
            : { titre: 'Retirer la tombe ?', icone: '🗑', danger: true, confirmer: 'Retirer',
                message: `La tombe de ${t.nom}, son épitaphe et son portrait gravé seront effacés.` });
        if (!ok) return;
        article.hidden = true;
        let annule = false;
        const message = revivre ? `✨ ${t.nom} revient parmi les vivants` : `Tombe de ${t.nom} retirée`;
        if (!window.showUndoToast) { effacer(t, article, revivre); return; }
        // Le vrai retrait attend la fin du délai d'annulation.
        const minuteur = setTimeout(() => { if (!annule) effacer(t, article, revivre); }, 6300);
        window.showUndoToast(message, () => { annule = true; clearTimeout(minuteur); article.hidden = false; }, 6);
    }
    async function effacer(t, article, revivre) {
        const c = client();
        try {
            if (t.portrait) {
                const rm = await c.storage.from(BUCKET).remove([t.portrait]);
                if (rm.error) throw rm.error;
                oublierPortrait(t.portrait);
            }
            const r = await c.from('tombes').delete().eq('id', t.id);
            if (r.error) throw r.error;
            article.remove();
            if (revivre) toast(`✨ ${t.nom} a quitté le cimetière. Les dieux ont changé d’avis.`, 'reussite');
            if (ecran && !ecran.querySelector('.cim-tombe')) statut(VIDES[vue] || '');
        } catch (e) {
            article.hidden = false;
            toast(messageErreur(e), 'erreur');
        }
    }

    async function moderer(t, masquer) {
        const r = await client().rpc('tombe_moderer', { p_id: t.id, p_masquer: masquer });
        if (r.error) { toast(messageErreur(r.error), 'erreur'); return; }
        toast(masquer ? 'Tombe masquée.' : 'Tombe rétablie : ses signalements sont effacés.', 'reussite');
        afficher(vue);
    }

    // =====================================================
    // OUVRIR
    // =====================================================
    /** Ouvre l'écran du cimetière sur une vue : publique (défaut), mes, moderation, lien. */
    async function ouvrir(v) {
        construire();
        const d = ['app-screen', 'home-screen', 'rules-screen'].find(visible);
        if (d) retour = d;
        const menu = $('settings-dropdown');
        if (menu) menu.classList.add('hidden');
        window.navTo('cimetiere-screen');
        try { window.scrollTo(0, 0); } catch (e) {}
        ecran.querySelector('[data-cim="inhumer"]').hidden = !(retour === 'app-screen' && idPerso());
        if (client() && utilisateur()) await verifierAdmin();
        await afficher(['mes', 'moderation', 'lien'].includes(v) && (v !== 'moderation' || admin) ? v : 'publique');
        const cible = ecran.querySelector('.cim-onglet[aria-selected="true"]') || ecran.querySelector('[data-cim="retour"]');
        try { cible.focus({ preventScroll: true }); } catch (e) {}
    }

    /** La tombe d'un lien secret suivi avant la connexion (auth.js garde le jeton). */
    async function ouvrirLien() {
        let o = null;
        try { o = JSON.parse(localStorage.getItem('dnd-tombe-lien') || 'null'); } catch (e) {}
        const oublier = () => { try { localStorage.removeItem('dnd-tombe-lien'); } catch (e) {} };
        if (!o || !JETON.test(String(o.jeton || '')) || Date.now() - (Number(o.date) || 0) > 7 * 86400000) { oublier(); return null; }
        if (!client() || !utilisateur()) return null;
        let r;
        try { r = await client().rpc('tombe_ouvrir_lien', { p_jeton: o.jeton }); }
        catch (e) { return null; }
        // Hors ligne : le lien attend la prochaine connexion.
        if (r.error && !['PGRST202', 'PGRST205', '42883'].includes(r.error.code)) return null;
        oublier();
        tombeLien = !r.error && UUID.test(String(r.data || '')) ? r.data : null;
        await ouvrir('lien');
        return tombeLien;
    }

    window.Cimetiere = { ouvrir, inhumer, ouvrirLien, dessinerCarte, lien: lienDe };
})();
