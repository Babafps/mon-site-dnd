// =====================================================
// charger.js — les modules chargés à la demande
//
// `charger('dialogues')` insère dialogues.js dans la page une seule fois et
// renvoie une promesse, tenue quand le script a été exécuté. Deux appels
// simultanés partagent la même promesse. En cas d'échec (hors ligne, fichier
// absent), la promesse est rompue et l'appel suivant réessaie.
//
// Les nouveaux modules naissent ainsi : ils ne pèsent rien au premier
// affichage. Un module qu'on appelle directement (Dialogue.confirmer…) reçoit
// ici une façade : chaque méthode charge le vrai module à son premier appel,
// qui prend alors la place de la façade.
// =====================================================
(function () {
    'use strict';

    // Nom court → fichier, relatif à index.html.
    const MODULES = {
        dialogues: 'dialogues.js'
    };
    const promesses = new Map();        // fichier -> promesse

    function fichierDe(nom) {
        const f = MODULES[nom] || (/\.js$/.test(nom) ? nom : nom + '.js');
        // Un module est un fichier du site : ni adresse, ni remontée de dossier.
        if (!/^[\w-]+(\/[\w-]+)*\.js$/.test(f)) throw new Error('Nom de module invalide : ' + nom);
        return f;
    }

    function charger(nom) {
        let fichier;
        try { fichier = fichierDe(String(nom || '')); }
        catch (e) { return Promise.reject(e); }
        if (promesses.has(fichier)) return promesses.get(fichier);

        let p;
        if (document.querySelector(`script[src="${fichier}"]:not([data-module])`)) {
            // Écrit en dur dans index.html : le navigateur l'a déjà exécuté.
            p = Promise.resolve();
        } else {
            p = new Promise((tenir, rompre) => {
                const s = document.createElement('script');
                s.src = fichier;
                s.async = true;
                s.dataset.module = nom;
                s.onload = () => tenir();
                s.onerror = () => {
                    promesses.delete(fichier);
                    s.remove();
                    rompre(new Error(`Le module « ${nom} » n’a pas pu se charger.`));
                };
                document.head.appendChild(s);
            });
        }
        promesses.set(fichier, p);
        return p;
    }

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
        window[global] = f;
    }

    window.charger = charger;
    facade('Dialogue', 'dialogues', ['confirmer', 'demander', 'informer']);
})();
