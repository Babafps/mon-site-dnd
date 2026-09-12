// =====================================================
// lancer-sort.js — avec quel emplacement lance-t-on ce sort ?
//
// Chargé à la demande (charger.js) : un grimoire qu'on n'ouvre pas ne coûte
// rien, et un sort mineur n'appelle jamais ce module.
//
// Ce que la fenêtre propose, dans cet ordre :
//   · les emplacements du niveau du sort et au-dessus, tant qu'il en reste —
//     la Magie de pacte comprise, car ses emplacements lancent les mêmes sorts ;
//   · le rituel, qui ne dépense rien, seulement pour les sorts qui le portent ;
//   · « lancer quand même », quand il ne reste plus rien : la fiche ne décide
//     pas à la place du joueur, elle prévient et le laisse passer outre.
//
// Le module ne connaît PAS la fiche : il lit l'état des emplacements par
// `SheetApi.emplacements()` et rend simplement le choix. C'est l'appelant
// (script.js) qui dépense, affiche et propose d'annuler.
//
//   LancerSort.choisir({ nom, niveau, rituel, concentration })
//     → { mode: 'emplacement' | 'rituel' | 'sans', rang } | null (annulé)
// =====================================================
(function () {
    'use strict';

    const RANG_MAX = 9;
    const ordinal = (r) => r === 1 ? '1er' : r + 'e';
    const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

    /** Les rangs utilisables pour un sort de niveau `niveau` : le sien et
     *  au-dessus. Un rang que la fiche ne connaît pas n'apparaît pas. */
    function rangsPossibles(niveau) {
        const tous = (window.SheetApi && window.SheetApi.emplacements)
            ? window.SheetApi.emplacements() : [];
        return tous.filter(r => r.rang >= niveau && r.rang <= RANG_MAX);
    }

    function optionEmplacement(r, niveau) {
        const vide = r.libres <= 0;
        const bonus = r.rang > niveau ? ` · lancé au ${ordinal(r.rang)} niveau` : '';
        return {
            valeur: 'e' + r.rang,
            ico: r.pacte ? '◆' : '◇',
            titre: `Emplacement de niveau ${r.rang}${r.pacte ? ' (pacte)' : ''}`,
            detail: vide ? 'Aucun ne reste à ce rang' : `Il en reste ${r.libres} sur ${r.total}${bonus}`,
            note: `${r.libres}/${r.total}`,
            desactive: vide
        };
    }

    /**
     * @param {{nom:string, niveau:number, rituel:boolean, concentration:boolean}} sort
     * @returns {Promise<{mode:string, rang:number}|null>}
     */
    async function choisir(sort) {
        const s = sort || {};
        const niveau = Math.max(1, parseInt(s.niveau, 10) || 1);
        const nom = String(s.nom || 'ce sort');
        const rangs = rangsPossibles(niveau);
        const libres = rangs.filter(r => r.libres > 0);

        const options = rangs.map(r => optionEmplacement(r, niveau));
        if (s.rituel) {
            options.push({
                valeur: 'rituel', ico: '✧',
                titre: 'Le lancer en rituel',
                detail: 'Aucun emplacement dépensé — le temps d’incantation est rallongé de 10 minutes.'
            });
        }

        // Plus rien à ce rang ni au-dessus : on le dit, et on laisse passer outre.
        const aSec = !libres.length;
        if (aSec) {
            options.push({
                valeur: 'sans', ico: '⚠',
                titre: 'Lancer quand même',
                detail: 'Rien n’est dépensé. À toi de voir avec ton MJ — capacité, objet, règle maison…'
            });
        }

        if (!options.length) {
            // Aucun emplacement n'est configuré du tout : inutile de demander.
            return { mode: 'sans', rang: niveau };
        }

        const message = aSec
            ? `Il ne te reste aucun emplacement de niveau ${niveau} ou plus.`
            : `Avec quel emplacement lances-tu « ${nom} » ?`
              + (rangs.length > 1 ? ' Un rang supérieur renforce les sorts qui le prévoient.' : '');

        const choix = await window.Dialogue.choisir({
            titre: `✨ ${nom}`,
            icone: aSec ? '⚠' : '✨',
            message: message + (s.concentration ? '\nCe sort demande de la concentration.' : ''),
            confirmer: 'Lancer',
            annuler: 'Renoncer',
            valeur: libres.length ? 'e' + libres[0].rang : (s.rituel ? 'rituel' : 'sans'),
            options
        });

        if (choix == null) return null;
        if (choix === 'rituel') return { mode: 'rituel', rang: niveau };
        if (choix === 'sans') return { mode: 'sans', rang: niveau };
        const rang = parseInt(String(choix).slice(1), 10) || niveau;
        return { mode: 'emplacement', rang };
    }

    /** La phrase qui dit, dans la carte de résultat, ce que le lancement a coûté. */
    function libelle(choix, niveau) {
        if (!choix) return '';
        if (choix.mode === 'rituel') return 'Lancé en rituel — aucun emplacement dépensé.';
        if (choix.mode === 'sans') return 'Lancé sans dépenser d’emplacement.';
        const sup = choix.rang > niveau
            ? ` (au ${ordinal(choix.rang)} niveau, au lieu du ${ordinal(niveau)})` : '';
        return `Emplacement de niveau ${choix.rang} dépensé${sup}.`;
    }

    window.LancerSort = { choisir, libelle, pluriel };
})();
