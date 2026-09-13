// =====================================================
// admin.js — l'outil d'administration des droits (docs/admin.sql)
//
// Une adresse e-mail, les options à cocher, « Accorder » ou « Retirer » :
// les droits d'un compte se donnent à la main, sans passer par Stripe.
//
// Ce fichier est public, comme tout le site : il ne protège rien. Le bouton
// n'apparaît que si la base répond que ce compte est administrateur, et chaque
// fonction de la base refuse tous les autres comptes.
//
// Chargé à la demande, à l'ouverture du menu ☰ par un joueur connecté (menu.js).
// =====================================================
(function () {
    'use strict';

    let admin = null;           // null : pas encore demandé (ou réseau absent)

    const client = () => window.SupaAuth && window.SupaAuth.client;
    const connecte = () => !!(window.SupaAuth && window.SupaAuth.currentUser);
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const produits = () => Object.entries((window.Ent && window.Ent.products) || { abonnement: 'Abonnement' });
    const nomProduit = (p) => (window.Ent && window.Ent.label) ? window.Ent.label(p) : p;

    /** Montre le bouton du menu aux seuls administrateurs. */
    async function verifier() {
        const bouton = document.getElementById('btn-menu-admin');
        if (!bouton) return false;
        if (!connecte() || !client()) { bouton.hidden = true; return false; }
        if (admin === null) {
            try {
                const { data, error } = await client().rpc('admin_est_admin');
                // Hors ligne : on redemandera à la prochaine ouverture du menu.
                if (error && /fetch|network/i.test(error.message || '')) { bouton.hidden = true; return false; }
                admin = !error && data === true;
            } catch (e) {
                bouton.hidden = true;
                return false;
            }
        }
        bouton.hidden = !admin;
        return admin;
    }

    function messageErreur(error) {
        const code = error && error.code;
        if (code === '42501') return 'Ce compte n’est pas administrateur.';
        if (code === 'P0002') return 'Aucun compte n’utilise cette adresse.';
        if (code === 'PGRST202') return 'L’outil n’est pas installé : exécute docs/admin.sql dans Supabase.';
        if (code === '22023') return 'Demande refusée : ' + (error.message || 'valeur invalide') + '.';
        return 'Le serveur ne répond pas. Vérifie ta connexion, puis réessaie.';
    }

    function ouvrir() {
        if (!window.Dialogue) return;
        let corps = null;
        const adresse = () => corps.querySelector('.adm-email').value.trim();
        const cochees = () => [...corps.querySelectorAll('.adm-produit:checked')].map(c => c.value);
        const statut = (texte, type) => {
            const p = corps.querySelector('.adm-statut');
            p.textContent = texte;
            p.dataset.type = type || 'info';
        };
        const adresseValide = () => {
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adresse())) return true;
            statut('Indique une adresse e-mail valide.', 'erreur');
            corps.querySelector('.adm-email').focus();
            return false;
        };

        async function lister() {
            if (!adresseValide()) return;
            const liste = corps.querySelector('.adm-droits');
            const { data, error } = await client().rpc('admin_droits', { p_email: adresse() });
            if (error) { liste.innerHTML = ''; statut(messageErreur(error), 'erreur'); return; }
            if (!data || !data.length) {
                liste.innerHTML = '<li class="adm-vide">Aucun droit pour ce compte.</li>';
                return;
            }
            liste.innerHTML = data.map(d => {
                const fin = d.expires_at ? 'jusqu’au ' + new Date(d.expires_at).toLocaleDateString('fr-FR') : 'pour toujours';
                const origine = d.source === 'stripe' ? 'acheté' : 'accordé à la main';
                return `<li class="${d.active ? '' : 'est-inactif'}"><b>${esc(nomProduit(d.product))}</b>`
                    + `<span>${d.active ? esc(fin) + ' · ' + esc(origine) : 'retiré'}</span></li>`;
            }).join('');
        }

        async function agir(accorder) {
            if (!adresseValide()) return;
            const choix = cochees();
            if (!choix.length) { statut('Coche au moins une option.', 'erreur'); return; }
            const jours = corps.querySelector('.adm-duree').value;
            statut(accorder ? 'Envoi…' : 'Retrait…', 'info');
            const { data, error } = accorder
                ? await client().rpc('admin_accorder', { p_email: adresse(), p_produits: choix, p_jours: jours ? parseInt(jours, 10) : null })
                : await client().rpc('admin_retirer', { p_email: adresse(), p_produits: choix });
            if (error) { statut(messageErreur(error), 'erreur'); return; }
            const n = Number(data) || 0;
            statut(accorder
                ? `✓ ${n} option${n > 1 ? 's' : ''} accordée${n > 1 ? 's' : ''} à ${adresse()}.`
                : `✓ ${n} option${n > 1 ? 's' : ''} retirée${n > 1 ? 's' : ''} à ${adresse()}.`, 'reussite');
            // C'est ton propre compte : le site se met à jour sans attendre.
            const moi = (window.SupaAuth.currentUser.email || '').toLowerCase();
            if (moi === adresse().toLowerCase() && window.Ent && window.Ent.refresh) window.Ent.refresh(true);
            lister();
        }

        window.Dialogue.fenetre({
            titre: 'Administration des droits', icone: '🛡', large: true,
            confirmer: 'Accorder', annuler: 'Fermer', annule: null,
            message: 'Accorde ou retire les options payantes d’un compte, sans passer par Stripe. La base refuse tout compte qui n’est pas administrateur.',
            corps() {
                corps = document.createElement('div');
                corps.className = 'adm';
                corps.innerHTML = `
                    <div class="adm-recherche">
                        <label class="adm-champ"><span>Adresse e-mail du compte</span>
                            <input type="email" class="dlg-saisie adm-email" autocomplete="off" spellcheck="false" placeholder="joueur@exemple.fr"></label>
                        <button type="button" class="dlg-btn dlg-secondaire adm-voir">Voir ses droits</button>
                    </div>
                    <fieldset class="adm-produits">
                        <legend>Options</legend>
                        <label class="adm-tout"><input type="checkbox" class="adm-tout-case" checked> Tout</label>
                        ${produits().map(([cle, nom]) => `<label><input type="checkbox" class="adm-produit" value="${esc(cle)}" checked> ${esc(nom)}</label>`).join('')}
                    </fieldset>
                    <label class="adm-champ"><span>Durée</span>
                        <select class="dlg-saisie adm-duree">
                            <option value="">Pour toujours</option>
                            <option value="30">30 jours</option>
                            <option value="365">1 an</option>
                        </select></label>
                    <div class="adm-actions"><button type="button" class="dlg-btn dlg-secondaire adm-retirer">Retirer la sélection</button></div>
                    <p class="adm-statut" role="status" aria-live="polite"></p>
                    <ul class="adm-droits" aria-label="Droits du compte"></ul>`;

                const tout = corps.querySelector('.adm-tout-case');
                tout.addEventListener('change', () => corps.querySelectorAll('.adm-produit').forEach(c => { c.checked = tout.checked; }));
                corps.addEventListener('change', (e) => {
                    if (!e.target.classList.contains('adm-produit')) return;
                    const cases = [...corps.querySelectorAll('.adm-produit')];
                    tout.checked = cases.every(c => c.checked);
                    tout.indeterminate = !tout.checked && cases.some(c => c.checked);
                });
                corps.querySelector('.adm-voir').addEventListener('click', lister);
                corps.querySelector('.adm-retirer').addEventListener('click', () => agir(false));
                // Entrée dans l'adresse : on regarde d'abord ce que le compte possède.
                corps.querySelector('.adm-email').addEventListener('keydown', (e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    e.stopPropagation();
                    lister();
                });
                return corps;
            },
            resultat() { agir(true); return undefined; }
        });
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#btn-menu-admin')) return;
        const menu = document.getElementById('settings-dropdown');
        if (menu) menu.classList.add('hidden');
        ouvrir();
    });

    window.Admin = { verifier, ouvrir };
    verifier();
})();
