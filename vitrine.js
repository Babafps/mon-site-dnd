// =====================================================
// vitrine.js — la page d'accueil publique (LOT 9.3)
//
// Ce que voit un visiteur avant d'avoir un compte : la fiche, les dés, des
// styles de carte qui ne sont pas secrets, les règles, le hors-ligne, les
// tarifs et les mentions légales. Le balisage vit dans index.html (lisible par
// les moteurs de recherche, affiché avant les scripts) ; ce fichier ne fait que
// le rendre vivant. Qui la voit : le script de démarrage en décide
// (Demarrage.ecranVisiteur), et auth.js suit son avis.
//
// Chargé en `async` juste après la vitrine : ses boutons répondent avant que
// le reste du site soit arrivé. Ce qui a besoin du reste attend `pret()`.
//
// Les dés 3D ne se chargent qu'au premier lancer, avec le moteur de la fiche
// (des3d.js). Rien n'est consigné : pas de personnage, pas d'historique, aucun
// secret, aucun compteur. Avec « mouvement réduit », le d20 se tire sans 3D.
// =====================================================
(function () {
    'use strict';

    const NOMS_SAISON = { hiver: 'Hiver', printemps: 'Printemps', ete: 'Été', automne: 'Automne' };
    const calme = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

    /** `fn` quand les scripts de la page sont là (auth.js, charger.js, pricing.js…). */
    function pret(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => fn(), { once: true });
        else fn();
    }

    /** Change d'écran. Avant auth.js, on bascule à la main les écrans du visiteur. */
    function aller(id) {
        if (typeof window.navTo === 'function') { window.navTo(id); return; }
        ['loading-screen', 'vitrine-screen', 'login-screen'].forEach(s => {
            const el = document.getElementById(s);
            if (el) el.classList.toggle('hidden', s !== id);
        });
    }

    function versConnexion(onglet) {
        aller('login-screen');
        if (window.AuthEcran) window.AuthEcran.onglet(onglet);
        const suite = () => {
            if (window.AuthEcran) window.AuthEcran.onglet(onglet);
            const champ = document.getElementById(onglet === 'inscription' ? 'signup-email' : 'signin-email');
            if (champ) champ.focus({ preventScroll: true });
        };
        if (window.AuthEcran && window.AuthEcran.pret) { suite(); return; }
        // Le formulaire est à l'écran, mais auth.js ne l'a pas encore branché : ses
        // boutons patientent, plutôt que d'avaler un clic sans rien faire.
        const boutons = ['btn-signin', 'btn-signup', 'btn-send-reset']
            .map(id => document.getElementById(id)).filter(Boolean);
        boutons.forEach(b => { b.disabled = true; b.setAttribute('aria-busy', 'true'); });
        document.addEventListener('auth:pret', () => {
            boutons.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); });
            suite();
        }, { once: true });
    }

    function versVitrine() {
        aller('vitrine-screen');
        window.scrollTo(0, 0);
        const titre = document.getElementById('vit-titre');
        if (titre) titre.focus({ preventScroll: true });
    }

    // ---------- Le d20 de démonstration ----------
    let lancerEnCours = false;
    let effacer = null;

    /** Un d20 lancé en 3D ; null si la 3D n'est pas là. */
    async function d20En3D(dire) {
        await new Promise(pret);
        if (!window.charger) return null;
        await window.charger('des3d');
        const boite = await window.MoteurDes.creer();
        dire('Ça roule…');
        clearTimeout(effacer);
        try { boite.clear(); } catch (e) {}
        try {
            const res = await Promise.race([
                boite.roll('1d20'),
                new Promise((_, non) => setTimeout(() => non(new Error('Le lancer 3D ne répond pas.')), 9000))
            ]);
            const d20 = (res || []).find(d => d && d.sides === 20);
            return d20 ? d20.value : null;
        } finally {
            effacer = setTimeout(() => { try { boite.clear(); } catch (e) {} }, 4500);
        }
    }

    async function lancerD20(bouton) {
        if (lancerEnCours) return;
        lancerEnCours = true;
        const sortie = document.getElementById('vit-d20-resultat');
        const dire = (html, classe) => {
            if (!sortie) return;
            sortie.className = 'vit-resultat' + (classe ? ' ' + classe : '');
            sortie.innerHTML = html;
        };
        bouton.disabled = true;
        bouton.setAttribute('aria-busy', 'true');

        let valeur = null;
        if (!calme()) {
            dire('Les dés arrivent…');
            try { valeur = await d20En3D(dire); }
            catch (e) { /* pas de 3D (WebGL absent, fichier manquant, hors ligne) : repli ci-dessous */ }
        }
        if (!(valeur >= 1 && valeur <= 20)) valeur = 1 + Math.floor(Math.random() * 20);

        if (valeur === 20) dire('<b>20</b> Vingt naturel : réussite critique !', 'est-critique');
        else if (valeur === 1) dire('<b>1</b> Un naturel… échec critique.', 'est-echec');
        else dire(`<b>${valeur}</b> Sur ta fiche, le bonus s’ajoute tout seul.`);

        bouton.removeAttribute('aria-busy');
        bouton.disabled = false;
        bouton.textContent = 'Relancer le d20';
        lancerEnCours = false;
    }

    // ---------- Ce qui dépend du reste du site ----------

    /** Le style de la saison en cours : celui que le défi du mois fait gagner (exploits-suivi.js). */
    function montrerSaison() {
        const li = document.querySelector('#vitrine-screen .vit-saison');
        if (!li || !window.Defis || typeof window.Defis.saisonDe !== 'function') return;
        const saison = window.Defis.saisonDe(new Date().getMonth() + 1);
        if (!NOMS_SAISON[saison]) return;
        const img = li.querySelector('img');
        img.src = 'IMG/vitrine/style-' + saison + '.webp';
        img.alt = 'Carte de héros au style ' + NOMS_SAISON[saison];
        li.querySelector('.vit-saison-nom').textContent = NOMS_SAISON[saison];
        li.hidden = false;
    }

    /** Arrivé par un lien de parrainage : la vitrine le dit (le code est gardé par auth.js). */
    function montrerInvitation() {
        const el = document.getElementById('vit-invitation');
        if (!el) return;
        let code = null;
        try {
            code = new URLSearchParams(location.search).get('parrain')
                || (JSON.parse(localStorage.getItem('dnd-parrain') || 'null') || {}).code;
        } catch (e) {}
        el.hidden = !code;
    }

    document.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('[data-vitrine]');
        if (!b) return;
        switch (b.dataset.vitrine) {
            case 'inscription':
            case 'connexion':
                versConnexion(b.dataset.vitrine);
                break;
            case 'decouvrir':
                versVitrine();
                break;
            case 'd20':
                lancerD20(b);
                break;
            case 'regles':
                pret(() => { if (window.RulesPage) window.RulesPage.open('vitrine-screen'); });
                break;
            case 'tarifs':
                pret(() => { if (window.Pricing) window.Pricing.open('vitrine-screen'); });
                break;
        }
    });

    montrerInvitation();
    pret(() => { montrerInvitation(); montrerSaison(); });

    window.Vitrine = { versConnexion, versVitrine };
})();
