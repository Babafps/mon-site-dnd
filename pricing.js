// =====================================================
// pricing.js — la page tarifs et les boutons d'achat
//
// Le site est statique : il n'a aucun serveur et surtout aucune clé secrète.
// Un bouton d'achat ne fait donc qu'une chose : ouvrir une page de paiement
// HÉBERGÉE PAR STRIPE, en lui passant l'identifiant du compte. C'est Stripe
// qui encaisse, et la fonction Edge `stripe-webhook` qui accorde le droit.
// Rien de ce qui se passe ici ne débloque quoi que ce soit par soi-même.
//
// Les CGU/CGV du lot 3 promettent deux choses que cette page doit tenir :
//   · avant tout paiement, DEUX cases distinctes — demande de mise à
//     disposition immédiate, et renoncement exprès au droit de rétractation
//     (art. L. 221-28 13° du code de la consommation) ;
//   · une résiliation d'abonnement en quelques clics (art. L. 215-1-1),
//     assurée par le portail client Stripe.
//
// Tant qu'un lien de paiement n'est pas renseigné ci-dessous, le bouton reste
// inactif et le dit. Aucun tunnel cassé, aucune promesse en l'air.
// =====================================================
(function () {
    'use strict';

    // =====================================================
    // À REMPLIR — un lien de paiement Stripe par produit
    //
    // Dans Stripe : Produits → créer le produit → « Lien de paiement ».
    // Dans les MÉTADONNÉES du produit Stripe, ajouter impérativement
    //     product_key = <la clé ci-dessous>
    // c'est elle que la fonction Edge lit pour savoir quoi débloquer.
    //
    // Le prix affiché ici n'est qu'un texte : celui qui fait foi est celui de
    // Stripe. Garder les deux d'accord.
    // =====================================================
    const PORTAL_URL = '';   // [À COMPLÉTER : lien du portail client Stripe, pour résilier]

    const CATALOGUE = [
        {
            groupe: 'Achats définitifs',
            note: 'Payé une fois, acquis pour toujours. Uniquement du décor : '
                + 'rien ici ne change une règle du jeu.',
            articles: [
                { key: 'des-os', nom: 'Dés en os', prix: '[À COMPLÉTER : prix]', lien: '',
                  texte: 'Un jeu de dés 3D taillés dans l’os, sur le plateau qui existe déjà.' },
                { key: 'des-obsidienne', nom: 'Dés d’obsidienne', prix: '[À COMPLÉTER : prix]', lien: '',
                  texte: 'Verre volcanique noir, arêtes qui accrochent la lumière.' },
                { key: 'des-laiton', nom: 'Dés de laiton', prix: '[À COMPLÉTER : prix]', lien: '',
                  texte: 'Métal chaud et patiné, dans les ors de la maison.' },
                { key: 'des-cristal', nom: 'Dés de cristal', prix: '[À COMPLÉTER : prix]', lien: '',
                  texte: 'Translucides, avec la lumière qui traverse.' },
                { key: 'fonds-de-page', nom: 'Arrière-plans', prix: '[À COMPLÉTER : prix]', lien: '',
                  texte: 'Une collection de fonds pour le site, plus l’envoi de ton propre fond.' },
                { key: 'palette-libre', nom: 'Palette libre', prix: '[À COMPLÉTER : prix]', lien: '',
                  texte: 'Choisis chaque couleur du thème et garde tes réglages. '
                       + 'Trois thèmes prédéfinis restent gratuits.' },
                { key: 'cadres', nom: 'Cadres de portrait', prix: '[À COMPLÉTER : prix]', lien: '',
                  texte: 'Des encadrements pour le portrait et pour la fiche.' }
            ]
        },
        {
            groupe: 'Abonnement',
            note: 'Ce qui consomme des ressources sur les serveurs. Résiliable en '
                + 'quelques clics, à tout moment, sans avoir à écrire à personne.',
            articles: [
                { key: 'abonnement', nom: 'Abonnement', prix: '[À COMPLÉTER : prix par mois]', lien: '',
                  abo: true,
                  texte: 'Fiches synchronisées en nombre illimité (3 sans abonnement, et le LOCAL '
                       + 'reste illimité), synchronisation de ton contenu perso, quota d’images, '
                       + 'sauvegardes automatiques et synchro VTT continue.' }
            ]
        }
    ];

    // Ce qui ne sera jamais payant. C'est écrit dans les CGU, donc opposable.
    const GRATUIT = [
        'Les règles, les sorts, les monstres, tout le SRD',
        'La fiche de personnage entière, sans limite de fonctions',
        'Les dés de base et le plateau 3D',
        'L’usage hors connexion',
        'L’export et l’import de tes fiches',
        'Trois fiches synchronisées, et un nombre illimité de fiches locales'
    ];

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    // Même convention que les pages légales : ce qui manque se voit.
    const txt = (s) => esc(s).replace(/\[À COMPLÉTER[^\]]*\]/g,
        (m) => `<mark class="legal-todo">${m}</mark>`);

    let built = false;
    let lastScreen = 'home-screen';
    let pending = null;              // l'article en cours d'achat

    // =====================================================
    // Rendu
    // =====================================================

    function articleHtml(a) {
        const owned = window.Ent ? window.Ent.has(a.key) : false;
        const ready = !!a.lien;
        const exp = owned && window.Ent ? window.Ent.expiresAt(a.key) : null;
        return `<div class="pr-card${owned ? ' is-owned' : ''}">
            <div class="pr-card-head">
                <span class="pr-name">${txt(a.nom)}</span>
                <span class="pr-price">${txt(a.prix)}</span>
            </div>
            <p class="pr-text">${txt(a.texte)}</p>
            <div class="pr-card-foot">
                ${owned
                    ? `<span class="pr-owned">✓ Débloqué${exp
                        ? ' — jusqu’au ' + esc(new Date(exp).toLocaleDateString('fr-FR')) : ''}</span>
                       ${a.abo ? `<button type="button" class="pr-link" data-pr-act="portal">Gérer ou résilier</button>` : ''}`
                    : ready
                        ? `<button type="button" class="pr-btn" data-pr-buy="${esc(a.key)}">Acheter</button>`
                        : `<button type="button" class="pr-btn is-off" disabled
                                   title="Le lien de paiement n’est pas encore configuré">Bientôt</button>`}
            </div>
        </div>`;
    }

    function markup() {
        const q = window.Ent ? window.Ent.characterQuota() : null;
        const connecte = !!window.SupaAuth?.currentUser;
        return `<div class="pr-wrap">
            <header class="pr-top no-print">
                <button type="button" class="legal-back" data-pr-act="back">← Retour</button>
                <h1>Tarifs</h1>
            </header>

            <section class="pr-free">
                <h2 class="pr-h">Gratuit, définitivement</h2>
                <ul class="pr-free-list">${GRATUIT.map(g => `<li>${txt(g)}</li>`).join('')}</ul>
                <p class="pr-free-note">Ce n’est pas une offre de lancement. C’est écrit dans les
                    conditions d’utilisation, et ça n’en bougera pas.</p>
            </section>

            ${!connecte ? `<div class="pr-warn">Un achat est lié à un compte : il faut être connecté
                pour acheter, et pour retrouver ce que tu as acheté sur un autre appareil.</div>` : ''}

            ${q && connecte && !q.unlimited ? `<div class="pr-quota">
                Fiches synchronisées : <b>${q.used} sur ${q.max}</b>.
                Les fiches enregistrées sur cet appareil, elles, ne sont pas comptées.</div>` : ''}

            ${CATALOGUE.map(g => `<section class="pr-group">
                <h2 class="pr-h">${txt(g.groupe)}</h2>
                <p class="pr-group-note">${txt(g.note)}</p>
                <div class="pr-cards">${g.articles.map(articleHtml).join('')}</div>
            </section>`).join('')}

            <p class="pr-foot-note">
                Le paiement est traité par Stripe, sur ses pages. Ce site ne voit jamais ton numéro
                de carte et n’en garde aucune trace.
                <button type="button" class="pr-link" data-legal-open="cgv">Conditions générales de vente</button>
            </p>
        </div>`;
    }

    /** L'écran de confirmation : c'est lui qui porte les deux cases. */
    function confirmMarkup(a) {
        return `<div class="pr-modal-panel" role="document">
            <h2 class="pr-modal-title">${txt(a.nom)}</h2>
            <p class="pr-modal-price">${txt(a.prix)}</p>
            <p class="pr-modal-text">${txt(a.texte)}</p>

            <div class="pr-consent">
                <label><input type="checkbox" class="pr-ck-now">
                    <span>Je demande que ${a.abo ? 'mon abonnement démarre' : 'le contenu soit mis à disposition'}
                    <b>immédiatement</b>, sans attendre la fin du délai de quatorze jours.</span></label>
                <label><input type="checkbox" class="pr-ck-waive">
                    <span>Je reconnais qu’en le demandant, je <b>perds mon droit de rétractation</b>
                    une fois la mise à disposition faite (art. L. 221-28 13° du code de la consommation).</span></label>
            </div>
            <p class="pr-consent-note">Tu préfères garder ton droit de rétractation ? Ne coche rien et
                écris à <mark class="legal-todo">[À COMPLÉTER : adresse de contact]</mark> :
                l’achat sera activé au bout de quatorze jours.</p>

            <div class="pr-modal-foot">
                <button type="button" class="pr-btn-ghost" data-pr-act="cancel">Annuler</button>
                <button type="button" class="pr-btn" data-pr-act="pay" disabled>Payer chez Stripe</button>
            </div>
        </div>`;
    }

    // =====================================================
    // L'écran
    // =====================================================

    function build() {
        if (built) return;
        built = true;
        const scr = document.createElement('div');
        scr.id = 'pricing-screen';
        scr.className = 'screen-view hidden';
        document.body.appendChild(scr);

        scr.addEventListener('click', (e) => {
            const buy = e.target.closest('[data-pr-buy]');
            if (buy) { openConfirm(buy.dataset.prBuy); return; }
            const act = e.target.closest('[data-pr-act]')?.dataset.prAct;
            if (act === 'back') { window.navTo(lastScreen); return; }
            if (act === 'portal') { openPortal(); return; }
        });

        // La page se redessine quand les droits changent : un achat fait dans
        // un autre onglet doit se voir en revenant sur celui-ci.
        window.Ent?.onChange(() => { if (!scr.classList.contains('hidden')) render(); });
    }

    function render() {
        const scr = document.getElementById('pricing-screen');
        if (scr) scr.innerHTML = markup();
    }

    function allArticles() {
        return CATALOGUE.reduce((a, g) => a.concat(g.articles), []);
    }

    function openPortal() {
        if (!PORTAL_URL) {
            alert('Le portail de gestion d’abonnement n’est pas encore configuré.\n\n'
                + 'En attendant, écris-nous : la résiliation est traitée à la main.');
            return;
        }
        window.open(PORTAL_URL, '_blank', 'noopener');
    }

    // =====================================================
    // L'achat
    // =====================================================

    function openConfirm(key) {
        const a = allArticles().find(x => x.key === key);
        if (!a) return;
        const user = window.SupaAuth?.currentUser;
        if (!user) {
            alert('Il faut être connecté pour acheter : c’est le compte qui garde le droit d’accès.');
            window.navTo('login-screen');
            return;
        }
        pending = a;
        document.getElementById('pr-modal')?.remove();
        const ov = document.createElement('div');
        ov.id = 'pr-modal';
        ov.className = 'no-print';
        ov.setAttribute('role', 'dialog');
        ov.setAttribute('aria-modal', 'true');
        ov.setAttribute('aria-label', 'Confirmer l’achat');
        ov.innerHTML = confirmMarkup(a);
        document.body.appendChild(ov);

        const now = ov.querySelector('.pr-ck-now');
        const waive = ov.querySelector('.pr-ck-waive');
        const pay = ov.querySelector('[data-pr-act="pay"]');
        // Les deux cases commandent le bouton : c'est la seule façon de tenir
        // ce que les CGV annoncent.
        const sync = () => { pay.disabled = !(now.checked && waive.checked); };
        ov.addEventListener('change', sync);

        const close = () => { ov.remove(); pending = null; document.removeEventListener('keydown', onKey, true); };
        const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
        document.addEventListener('keydown', onKey, true);

        ov.addEventListener('click', (e) => {
            const act = e.target.closest('[data-pr-act]')?.dataset.prAct;
            if (act === 'cancel') { close(); return; }
            if (act === 'pay') {
                if (pay.disabled) return;
                go(a, user);
                close();
            }
        });
    }

    /** Ouvre la page de paiement Stripe. L'identifiant du compte voyage dans
     *  `client_reference_id` : c'est ce que la fonction Edge relira pour savoir
     *  à qui accorder le droit. */
    function go(a, user) {
        if (!a.lien) return;
        let url;
        try { url = new URL(a.lien); }
        catch (e) { alert('Le lien de paiement de cet article est mal formé.'); return; }
        url.searchParams.set('client_reference_id', user.id);
        if (user.email) url.searchParams.set('prefilled_email', user.email);
        window.open(url.toString(), '_blank', 'noopener');
        if (window.showAppToast) {
            window.showAppToast('Le paiement s’ouvre dans un onglet. Reviens ici une fois payé : '
                + 'le droit apparaît tout seul.', '#2e7d4f');
        }
    }

    // =====================================================
    // Portes d'entrée
    // =====================================================

    function open(from) {
        build();
        const visible = ['home-screen', 'app-screen', 'rules-screen', 'homebrew-screen', 'legal-screen']
            .find(id => { const el = document.getElementById(id); return el && !el.classList.contains('hidden'); });
        lastScreen = from || (visible || 'home-screen');
        render();
        window.navTo('pricing-screen');
        window.Ent?.refresh(true);
    }

    document.addEventListener('click', (e) => {
        const b = e.target.closest('[data-pricing-open]');
        if (!b) return;
        e.preventDefault();
        document.getElementById('settings-dropdown')?.classList.add('hidden');
        open();
    });

    function mountMenu() {
        const menu = document.getElementById('settings-dropdown');
        if (!menu || menu.querySelector('.pr-menu-cat')) return;
        const cat = document.createElement('details');
        cat.className = 'menu-cat pr-menu-cat';
        cat.innerHTML = `<summary>✨ Tarifs</summary>
            <div class="menu-cat-body">
                <p class="menu-hint">Ce qui reste gratuit, et ce qui ne l’est pas.</p>
                <button type="button" class="btn-menu-item" data-pricing-open="1">✨ Voir les tarifs</button>
            </div>`;
        // Juste avant les informations légales : les deux vont ensemble.
        const legal = menu.querySelector('.legal-menu-cat');
        if (legal) menu.insertBefore(cat, legal); else menu.appendChild(cat);
    }

    function mountHome() {
        const list = document.querySelector('#home-screen .home-container');
        const rules = document.getElementById('btn-open-rules');
        if (!list || !rules || document.getElementById('btn-open-pricing')) return;
        const b = document.createElement('button');
        b.id = 'btn-open-pricing';
        b.type = 'button';
        b.className = 'btn home-rules pr-home-btn';
        b.dataset.pricingOpen = '1';
        b.textContent = '✨ Tarifs';
        rules.insertAdjacentElement('afterend', b);
    }

    function init() {
        if (typeof APP_SCREENS !== 'undefined' && !APP_SCREENS.includes('pricing-screen')) {
            APP_SCREENS.push('pricing-screen');
        }
        build();
        mountMenu();
        mountHome();
        if (/^#tarifs$/.test(location.hash || '')) setTimeout(() => open('home-screen'), 0);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.Pricing = { open, CATALOGUE, PORTAL_URL };
})();
