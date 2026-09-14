// =====================================================
// des3d.js — le moteur de dés 3D, prêt à lancer (LOT 9.3)
//
// dice-box est hébergé EN LOCAL (lib/dice-box/) : un Web Worker ne peut pas
// venir d'un autre domaine. Ce module crée le plateau une seule fois, avec les
// réglages de la maison, pour ceux qui en ont besoin :
//   · la fiche (script.js), qui y ajoute ses matières et ses couleurs ;
//   · la vitrine (vitrine.js), qui lance un d20 de démonstration.
//
// Chargé à la demande : `charger('des3d')`, puis `MoteurDes.creer()`.
// Un échec (ouverture en file://, WebGL absent, fichier manquant) rompt la
// promesse ; l'appel suivant réessaie, et chacun garde son repli sans 3D.
// =====================================================
(function () {
    'use strict';

    const REGLAGES = { theme: 'default', scale: 7, gravity: 2, throwForce: 6 };
    let promesse = null;

    function creer() {
        if (promesse) return promesse;
        promesse = (async () => {
            if (location.protocol === 'file:') throw new Error('Dés 3D indisponibles en ouverture fichier (file://).');
            const lib = new URL('lib/dice-box/', document.baseURI);
            const mod = await import(lib.href + 'dice-box.es.min.js');
            let overlay = document.getElementById('dice-box-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'dice-box-overlay';
                overlay.className = 'no-print';
                document.body.appendChild(overlay);
            }
            const box = new mod.default(Object.assign({
                container: '#dice-box-overlay',
                assetPath: new URL('lib/dice-box/assets/', document.baseURI).pathname
            }, REGLAGES));
            await box.init();
            return box;
        })();
        promesse.catch(() => { promesse = null; });
        return promesse;
    }

    window.MoteurDes = { creer, REGLAGES };
})();
