// =====================================================
// charger.js — les modules chargés à la demande
//
// `charger('dialogues')` insère dialogues.js dans la page une seule fois et
// renvoie une promesse, tenue quand le script a été exécuté. Deux appels
// simultanés partagent la même promesse. En cas d'échec (hors ligne, fichier
// absent), la promesse est rompue et l'appel suivant réessaie.
//
// Un module peut compter plusieurs fichiers (exécutés dans l'ordre), sa propre
// feuille de style (posée AVANT le script : ce qu'il dessine est habillé dès
// le premier affichage) et des modules à charger d'abord (`apres`).
//
// Les nouveaux modules naissent ainsi : ils ne pèsent rien au premier
// affichage (LOT 10). Un module qu'on appelle directement (Dialogue.confirmer,
// HeroCard.open…) reçoit ici une façade : chaque méthode charge le vrai module
// à son premier appel, qui prend alors la place de la façade. Un bouton qui
// ouvre un module non chargé passe par les « portes d'entrée », plus bas.
//
// Les secrets et le suivi des exploits arrivent juste après le premier
// affichage. Ce qu'ils auraient entendu entre-temps (jets, saisies, écrans…)
// est gardé dans un petit tampon, puis rejoué à LEURS seuls écouteurs, dans
// l'ordre : aucun événement n'est perdu, aucun n'est entendu deux fois.
// =====================================================
(function () {
    'use strict';

    // Nom court → fichiers, relatifs à index.html.
    const MODULES = {
        dialogues: { js: ['dialogues.js'] },
        multiclasse: { js: ['multiclasse.js'], css: ['style-multiclasse.css'] },
        'lancer-sort': { js: ['lancer-sort.js'] },
        jets: { js: ['jets.js'], css: ['style-jets.css'] },
        des3d: { js: ['des3d.js'] },
        'effets-actifs': { js: ['effets-actifs.js'], css: ['style-effets-actifs.css'] },
        formes: { js: ['formes.js'], css: ['style-formes.css'] },
        'stats-des': { js: ['stats-des.js'], css: ['style-stats-des.css'] },
        bourse: { js: ['bourse.js'] },
        macros: { js: ['macros.js'] },
        bestiaire: { js: ['bestiaire.js'] },
        carnet: { js: ['carnet.js'] },
        confort: { js: ['confort.js'] },
        coffre: { js: ['coffre.js'] },
        seance: { js: ['seance.js'] },
        admin: { js: ['admin.js'], css: ['style-admin.css'] },
        'impression-suite': { js: ['impression-suite.js'] },
        trophees: { js: ['trophees.js'], apres: ['secrets'] },
        parrainage: { js: ['parrainage.js'], apres: ['secrets'] },
        cimetiere: { js: ['cimetiere.js'], apres: ['secrets'] },
        // LOT 10 — sortis du premier chargement
        // (les styles de carte se gagnent par exploits : le registre d'abord)
        'carte-heros': { js: ['hero-card.js', 'hero-card-styles.js'], css: ['style-carte-heros.css'], apres: ['secrets'] },
        regles: { js: ['rules-page.js'], css: ['style-regles.css'] },
        'contenu-perso': { js: ['homebrew.js'], css: ['style-contenu-perso.css'] },
        'export-import': { js: ['sheet-io.js'], css: ['style-export-import.css'] },
        impression: { js: ['fiche-layout.js', 'print-sheet.js'] },
        'cartes-sorts': { js: ['cartes-sorts.js'], apres: ['impression'] },
        musique: { js: ['music-player.js'], css: ['music-player.css'] },
        // Les mentions légales lisent l'état de la boutique (Pricing.etat) en s'affichant.
        legal: { js: ['legal.js'], css: ['style-legal.css'], apres: ['tarifs'] },
        tarifs: { js: ['pricing.js'], css: ['style-tarifs.css'] },
        vitrine: { js: ['vitrine.js'] },
        imprimer: { css: ['style-imprimer.css'] },
        aide: { js: ['help.js'], css: ['style-aide.css'], apres: ['secrets'] },
        assistant: { js: ['pj-tutorial.js'], css: ['style-assistant.css'] },
        // Le registre des exploits d'abord : les secrets s'en servent en s'exécutant.
        secrets: { js: ['exploits.js', 'secrets.js', 'secrets-monde.js', 'exploits-suivi.js', 'secrets-plus.js', 'secrets-absurdes.js'], tampon: true },
        // L'éditeur du journal, depuis son CDN habituel : seul adresse extérieure admise.
        quill: { js: ['https://cdn.quilljs.com/1.3.7/quill.min.js'], css: ['https://cdn.quilljs.com/1.3.7/quill.snow.css'] }
    };
    const EXTERIEURS = new Set(['https://cdn.quilljs.com/1.3.7/quill.min.js', 'https://cdn.quilljs.com/1.3.7/quill.snow.css']);

    const parFichier = new Map();       // fichier -> promesse
    const parModule = new Map();        // nom -> promesse
    const prets = new Set();            // noms des modules chargés

    function definition(nom) {
        const d = MODULES[nom] || { js: [/\.js$/.test(nom) ? nom : nom + '.js'] };
        [...(d.js || []), ...(d.css || [])].forEach(f => {
            // Un module est un fichier du site : ni adresse, ni remontée de dossier.
            if (!EXTERIEURS.has(f) && !/^[\w-]+(\/[\w-]+)*\.(js|css)$/.test(f)) throw new Error('Nom de module invalide : ' + nom);
        });
        return d;
    }

    /** Un fichier, une fois. `async = false` : les scripts d'un module s'exécutent dans l'ordre. */
    function fichier(f, nom, tampon) {
        if (parFichier.has(f)) return parFichier.get(f);
        const css = /\.css$/.test(f);
        let p;
        if (css ? document.querySelector(`link[rel="stylesheet"][href="${f}"]:not([data-module])`)
                : document.querySelector(`script[src="${f}"]:not([data-module])`)) {
            // Écrit en dur dans index.html : le navigateur l'a déjà exécuté.
            p = Promise.resolve();
        } else {
            p = new Promise((tenir, rompre) => {
                const el = document.createElement(css ? 'link' : 'script');
                if (css) { el.rel = 'stylesheet'; el.href = f; }
                else { el.src = f; el.async = false; if (tampon) el.dataset.tampon = '1'; }
                el.dataset.module = nom;
                el.onload = () => tenir();
                el.onerror = () => {
                    parFichier.delete(f);
                    el.remove();
                    rompre(new Error(`Le module « ${nom} » n’a pas pu se charger.`));
                };
                document.head.appendChild(el);
            });
        }
        parFichier.set(f, p);
        return p;
    }

    function charger(nom) {
        nom = String(nom || '');
        if (parModule.has(nom)) return parModule.get(nom);
        let d;
        try { d = definition(nom); } catch (e) { return Promise.reject(e); }
        const tampon = !!d.tampon;
        const p = Promise.all((d.apres || []).map(charger))
            .then(() => Promise.all((d.css || []).map(f => fichier(f, nom))))
            .then(() => {
                if (tampon) Tampon.ecouter();
                return Promise.all((d.js || []).map(f => fichier(f, nom, tampon)));
            })
            .then(() => {
                prets.add(nom);
                if (tampon) Tampon.rejouer();
            }, (err) => {
                parModule.delete(nom);
                if (tampon) Tampon.relacher();
                throw err;
            });
        parModule.set(nom, p);
        return p;
    }

    // =====================================================
    // LE TAMPON D'ÉVÉNEMENTS (modules marqués `tampon`)
    // Chaque événement de ces types est noté dès maintenant. Pendant l'exécution
    // du module, ses écouteurs de document et de window sont repérés
    // (document.currentScript) ; une fois le module chargé, chacun reçoit les
    // événements notés AVANT qu'il ne s'inscrive, puis le tampon se tait.
    // `plusTard` y range aussi des appels (Secrets.d20…), à leur place dans le fil.
    // =====================================================
    const Tampon = (function () {
        const DOC = ['DOMContentLoaded', 'screen:change', 'visibilitychange', 'click', 'change', 'input', 'focusin', 'keydown', 'pointermove',
            'fiche:ecrite', 'fiche:inventaire', 'regles:fiche', 'jet:consigne', 'jet:paire', 'des:lances', 'plateau:lance',
            'sort:lance', 'degats:jet', 'pv:change', 'repos:termine', 'repos:des-de-vie', 'bourse:operation', 'carte:exportee', 'exploit:peine'];
        const WIN = ['load'];
        const MAX = 600;
        const fil = [];                  // { cible, ev } ou { appel }
        const inscrits = [];             // { cible, type, fn, once, depuis }
        let actif = true;
        let origines = null;

        const noter = (cible) => (ev) => {
            if (!actif) return;
            if (ev.type === 'pointermove') {
                // Le mouvement ne compte que par sa dernière position : un seul suffit.
                const dernier = fil[fil.length - 1];
                if (dernier && dernier.ev && dernier.ev.type === 'pointermove') { dernier.ev = ev; return; }
            }
            if (fil.length < MAX) fil.push({ cible, ev });
        };
        DOC.forEach(t => document.addEventListener(t, noter(document), true));
        WIN.forEach(t => window.addEventListener(t, noter(window), true));

        /** Pendant le chargement : repère les écouteurs posés par les scripts du module. */
        function ecouter() {
            if (origines) return;
            origines = [];
            [document, window].forEach(cible => {
                const types = new Set(cible === document ? DOC : WIN);
                const origine = cible.addEventListener;
                origines.push([cible, Object.prototype.hasOwnProperty.call(cible, 'addEventListener') ? origine : null]);
                cible.addEventListener = function (type, fn, opts) {
                    const s = document.currentScript;
                    if (actif && fn && types.has(type) && s && s.dataset && s.dataset.tampon) {
                        inscrits.push({ cible, type, fn, once: !!(opts && typeof opts === 'object' && opts.once), depuis: fil.length });
                    }
                    return origine.call(this, type, fn, opts);
                };
            });
        }
        function relacher() {
            if (!origines) return;
            origines.forEach(([cible, propre]) => { if (propre) cible.addEventListener = propre; else delete cible.addEventListener; });
            origines = null;
        }
        function rejouer() {
            relacher();
            actif = false;
            const evenements = fil.splice(0);
            evenements.forEach((x, i) => {
                if (x.appel) { try { x.appel(); } catch (e) { setTimeout(() => { throw e; }); } return; }
                inscrits.forEach(c => {
                    if (c.cible !== x.cible || c.type !== x.ev.type || i >= c.depuis || c.fait) return;
                    try { if (typeof c.fn === 'function') c.fn.call(x.cible, x.ev); else c.fn.handleEvent(x.ev); }
                    catch (e) { setTimeout(() => { throw e; }); }
                    if (c.once) c.fait = true;
                });
            });
            inscrits.length = 0;
        }
        /** Un appel à faire quand le module sera là, à sa place parmi les événements. */
        function plusTard(fn) {
            if (!actif) { fn(); return; }
            if (fil.length < MAX) fil.push({ appel: fn });
        }
        return { ecouter, relacher, rejouer, plusTard };
    })();

    /**
     * Fait `fn` quand le module est prêt : tout de suite s'il l'est, sinon
     * après son chargement — pour un module à tampon, à sa place dans le fil.
     */
    function plusTard(nom, fn) {
        if (prets.has(nom)) { fn(); return; }
        const d = MODULES[nom];
        if (d && d.tampon) Tampon.plusTard(fn);
        else charger(nom).then(fn).catch(() => {});
    }

    // =====================================================
    // APRÈS LE PREMIER AFFICHAGE
    // Le premier écran montré (la fiche, l'accueil, la connexion, la vitrine…)
    // passe avant tout ce qui peut attendre. Les tâches notées ici partent juste
    // après qu'il a été peint.
    // =====================================================
    let affiche = false;
    const enAttente = [];
    const auRepos = (fn, delai) => (window.requestIdleCallback
        ? window.requestIdleCallback(fn, { timeout: delai || 2000 })
        : setTimeout(fn, 200));
    function apresAffichage(fn) {
        if (affiche) { setTimeout(fn, 0); return; }
        enAttente.push(fn);
    }
    function marquerAffiche() {
        if (affiche) return;
        affiche = true;
        // Deux images plus tard : l'écran est à l'écran, pas seulement dans le DOM.
        // Un onglet qu'on ne peint pas (ouvert en arrière-plan) ne donne aucune image :
        // au bout d'une seconde, on n'attend plus.
        let parti = false;
        const partir = () => { if (parti) return; parti = true; enAttente.splice(0).forEach(fn => setTimeout(fn, 0)); };
        requestAnimationFrame(() => requestAnimationFrame(partir));
        setTimeout(partir, 1000);
    }
    document.addEventListener('screen:change', (e) => { if (e.detail && e.detail.id && e.detail.id !== 'loading-screen') marquerAffiche(); });
    // La vitrine s'affiche sans passer par navTo ; et si rien ne s'affiche (connexion
    // bloquée hors ligne), la page chargée depuis 4 s suffit.
    window.addEventListener('load', () => {
        const vitrine = document.getElementById('vitrine-screen');
        if (vitrine && !vitrine.classList.contains('hidden')) marquerAffiche();
        else setTimeout(marquerAffiche, 4000);
    });

    // Les exploits et les secrets d'abord (ils écoutent la partie), puis au repos la
    // boutique et les mentions légales (entrées du menu, pieds de page) et la feuille
    // d'impression du site.
    const chargerSecrets = () => charger('secrets').catch(() => { window.addEventListener('online', chargerSecrets, { once: true }); });
    apresAffichage(chargerSecrets);
    apresAffichage(() => auRepos(() => { charger('legal').catch(() => {}); charger('imprimer').catch(() => {}); }));
    // La vitrine ne sert qu'au visiteur : elle est déjà peinte (script de démarrage),
    // son script arrive tout de suite. Un écran vitrine montré plus tard la fait venir aussi.
    if (window.Demarrage && window.Demarrage.visiteur && window.Demarrage.visiteur()) charger('vitrine').catch(() => {});
    document.addEventListener('screen:change', (e) => { if (e.detail && e.detail.id === 'vitrine-screen') charger('vitrine').catch(() => {}); });

    // =====================================================
    // FAÇADES
    // =====================================================
    /** Pose `window[global]` : des méthodes qui chargent le module puis lui passent la main. */
    function facade(global, nom, methodes) {
        if (window[global]) return;
        const f = {};
        methodes.forEach(m => {
            f[m] = (...args) => charger(nom).then(() => {
                const vrai = window[global];
                if (!vrai || vrai === f || typeof vrai[m] !== 'function') {
                    throw new Error(`${global}.${m} est absent de « ${nom} ».`);
                }
                return vrai[m](...args);
            });
        });
        Object.defineProperty(f, 'facade', { value: true });
        window[global] = f;
    }

    window.charger = charger;
    charger.pret = (nom) => prets.has(nom);
    charger.plusTard = plusTard;
    charger.apresAffichage = apresAffichage;

    facade('Dialogue', 'dialogues', ['confirmer', 'demander', 'informer', 'choisir', 'fenetre']);
    // Trophées et communauté (LOT 8)
    facade('Trophees', 'trophees', ['ouvrir', 'accueil', 'etat', 'catalogue']);
    facade('Parrainage', 'parrainage', ['ouvrir', 'appliquer', 'verifier', 'etat']);
    facade('Cimetiere', 'cimetiere', ['ouvrir', 'inhumer', 'ouvrirLien']);
    // LOT 10
    facade('HeroCard', 'carte-heros', ['open', 'annoncer', 'vignette', 'dessinerPour', 'collection', 'exploits']);
    facade('RulesPage', 'regles', ['open', 'ouvrirListe']);
    facade('Homebrew', 'contenu-perso', ['open']);
    facade('SheetIO', 'export-import', ['open', 'download']);
    facade('PrintSheet', 'impression', ['print', 'demander', 'preparer']);
    facade('Legal', 'legal', ['open', 'exportAll']);
    facade('Pricing', 'tarifs', ['open']);
    facade('Vitrine', 'vitrine', ['versConnexion', 'versVitrine']);
    facade('Discover', 'aide', ['open', 'offer']);
    facade('Help', 'aide', ['open']);
    facade('PjTutorial', 'assistant', ['startWizard', 'startTutorial', 'demarrer']);

    // =====================================================
    // PORTES D'ENTRÉE
    // Les boutons qui ouvrent un module pas encore chargé. Une fois là, le module
    // écoute ses boutons lui-même : la porte s'efface (sauf `toujours`).
    // =====================================================
    const fermerMenu = () => { const m = document.getElementById('settings-dropdown'); if (m) m.classList.add('hidden'); };
    const PORTES = [
        { sel: '#btn-hero-card, #btn-menu-hero-card', module: 'carte-heros', faire: () => window.HeroCard.open() },
        { sel: '#btn-open-rules', module: 'regles', toujours: true, faire: () => window.RulesPage.open('home-screen') },
        { sel: '[data-discover]', module: 'aide', faire: () => window.Discover.open() },
        { sel: '#btn-pj-wizard-replay', module: 'assistant', faire: () => { fermerMenu(); return window.PjTutorial.startWizard(); } },
        { sel: '[data-legal-open]', module: 'legal', faire: (b) => { fermerMenu(); return window.Legal.open(b.dataset.legalOpen); } },
        { sel: '[data-pricing-open]', module: 'tarifs', faire: () => { fermerMenu(); return window.Pricing.open(); } },
        { sel: '[data-vitrine="decouvrir"]', module: 'vitrine', faire: () => window.Vitrine.versVitrine() }
    ];
    document.addEventListener('click', (e) => {
        if (!e.target || !e.target.closest) return;
        for (const p of PORTES) {
            const b = e.target.closest(p.sel);
            if (!b || (!p.toujours && prets.has(p.module))) continue;
            e.preventDefault();
            Promise.resolve().then(() => p.faire(b)).catch(() => {
                if (window.showAppToast) window.showAppToast('Ce module n’a pas pu se charger. Vérifie ta connexion, puis réessaie.', 'erreur');
            });
            return;
        }
    });

    // Sur la fiche : l'invitation « Découvrir » (première visite) et l'assistant
    // (fiche neuve, ou inachevée). Leurs modules ne viennent que s'ils ont à dire.
    const lu = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    let ficheVue = false;
    document.addEventListener('screen:change', (e) => {
        if (!e.detail || e.detail.id !== 'app-screen' || ficheVue) return;
        ficheVue = true;
        const id = lu('dnd-active-char') || '';
        const decouverte = !!(lu('dnd-discover-offered') || lu('dnd-pj-tuto-done'));
        setTimeout(() => {
            if (lu('dnd-pj-wizard-pending') || (decouverte && !lu(id + '_dnd-pj-wizard-off'))) {
                window.PjTutorial.demarrer().catch(() => {});
            }
        }, 900);
        if (!decouverte) setTimeout(() => window.Discover.offer().catch(() => {}), 1800);
    });
})();
