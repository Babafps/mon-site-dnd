// =====================================================
// coffre.js — un petit coffre IndexedDB, partagé par les modules
//
// Le stockage local du navigateur (localStorage) est petit et précieux : les
// fiches y vivent. Ce qui est lourd et propre à l'appareil va ici :
//   · 'vignettes' — l'aperçu de la carte de héros, affiché sur l'accueil ;
//   · 'musique'   — les fichiers audio ajoutés au lecteur, pour les retrouver
//                   après un rechargement.
// Rien de ce coffre ne part au cloud, ni dans l'export : ce n'est qu'un cache.
//
//   Coffre.lire(rayon, cle)          → Promise<valeur | undefined>
//   Coffre.ecrire(rayon, cle, valeur)→ Promise<void>
//   Coffre.effacer(rayon, cle)       → Promise<void>
//   Coffre.cles(rayon)               → Promise<string[]>
//
// Sans IndexedDB (navigation privée de certains navigateurs), chaque appel est
// rompu : les modules retombent alors sur leur comportement sans cache.
// Chargé à la demande : charger('coffre').
// =====================================================
(function () {
    'use strict';

    const NOM = 'bnb-coffre';
    const VERSION = 1;
    const RAYONS = ['vignettes', 'musique'];
    let ouverture = null;

    function ouvrir() {
        if (ouverture) return ouverture;
        ouverture = new Promise((tenir, rompre) => {
            if (!window.indexedDB) { rompre(new Error('IndexedDB indisponible')); return; }
            let req;
            try { req = indexedDB.open(NOM, VERSION); } catch (e) { rompre(e); return; }
            req.onupgradeneeded = () => {
                const db = req.result;
                RAYONS.forEach(r => { if (!db.objectStoreNames.contains(r)) db.createObjectStore(r); });
            };
            req.onsuccess = () => {
                const db = req.result;
                // Une autre version de la page veut mettre le coffre à jour : on lui laisse la place.
                db.onversionchange = () => { db.close(); ouverture = null; };
                tenir(db);
            };
            req.onerror = () => rompre(req.error || new Error('Coffre inaccessible'));
            req.onblocked = () => rompre(new Error('Coffre bloqué par un autre onglet'));
        });
        ouverture.catch(() => { ouverture = null; });
        return ouverture;
    }

    function operation(rayon, mode, faire) {
        if (!RAYONS.includes(rayon)) return Promise.reject(new Error('Rayon inconnu : ' + rayon));
        return ouvrir().then(db => new Promise((tenir, rompre) => {
            const tx = db.transaction(rayon, mode);
            const req = faire(tx.objectStore(rayon));
            tx.oncomplete = () => tenir(req ? req.result : undefined);
            tx.onerror = () => rompre(tx.error || new Error('Opération refusée'));
            tx.onabort = () => rompre(tx.error || new Error('Opération annulée'));
        }));
    }

    window.Coffre = {
        lire: (rayon, cle) => operation(rayon, 'readonly', s => s.get(String(cle))),
        ecrire: (rayon, cle, valeur) => operation(rayon, 'readwrite', s => s.put(valeur, String(cle))).then(() => undefined),
        effacer: (rayon, cle) => operation(rayon, 'readwrite', s => s.delete(String(cle))).then(() => undefined),
        cles: (rayon) => operation(rayon, 'readonly', s => s.getAllKeys()).then(k => (k || []).map(String))
    };
})();
