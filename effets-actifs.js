// =====================================================
// effets-actifs.js — les effets en cours, avec leur durée (LOT 4.8)
//
// Bénédiction, Hâte, Rage… : un effet ACTIF modifie la fiche le temps qu'il
// dure. Le moteur de calcul (calcul.js) reçoit ses bonus chiffrés ; la fiche
// lui demande, au moment d'un jet, les dés en plus et l'avantage.
//
// Chargé à la demande (charger.js) : au clic sur « ✦ Effet », ou dès
// l'ouverture d'une fiche qui porte déjà des effets.
//
// LE STOCKAGE. Clé de personnage `dnd-effets-actifs` (synchronisée, exportée) :
//   [{ id, preset, nom, icone, desc,
//      mods: [{ cible, type, valeur }],
//      duree: { unite: 'round'|'minute'|'heure'|'repos-court'|'repos-long'|'illimitee', valeur },
//      restant,            // en rounds (1 minute = 10 rounds) ; null = sans compte
//      concentration, finEtats: ['incapacitated'], pvTempTour, pvTempFin, forme, debut }]
//
// Les CIBLES d'un modificateur :
//   'attaque' (armes et sorts) · 'attaque-arme' · 'sauvegarde' · 'sauvegarde:dex'
//   · 'tests:str' (tests de caractéristique ET de compétence de cette carac)
//   · 'ca' · 'vitesse' · 'initiative'
//   · 'degats-arme' · 'degats-attaque' · 'degats-force' (lignes de dégâts en plus)
// Les TYPES : 'bonus' (nombre) · 'des' ('1d4') · 'avantage' · 'desavantage'
//   · 'resistance' (types de dégâts) · 'multiplier' (vitesse) · 'minimum' (CA).
//
// LES PRÉRÉGLAGES viennent des données du dépôt (règle 6) : le nom, la durée
// et la concentration sont lus dans data/srd/<édition>/fr/spells.json (et
// classes.json pour la Rage) ; un sort absent d'une édition n'est pas proposé.
// La MÉCANIQUE de chaque préréglage cite, en commentaire, la phrase du texte
// officiel qui la fonde, pour les deux éditions.
//
// LE TEMPS. « Round suivant » retire un round à chaque effet. Un repos fait
// passer le temps qu'il dure selon les deux éditions (« Repos court » : au
// moins 1 heure ; « Repos long » : au moins 8 heures) : un effet qui ne tient
// pas jusque-là prend fin, et le récapitulatif du repos le dit.
// =====================================================
(function () {
    'use strict';

    const CLE = 'dnd-effets-actifs';
    const ROUNDS = { round: 1, minute: 10, heure: 600 };
    const REPOS = { court: 600, long: 4800 };      // 1 heure, 8 heures (en rounds de 6 s)

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const $ = (id) => document.getElementById(id);
    const edition = () => (window.Edition ? window.Edition.active() : '2024');
    const plier = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const toast = (m, t) => { if (window.showAppToast) window.showAppToast(m, t); };

    // =====================================================
    // LES PRÉRÉGLAGES
    // =====================================================
    // `sort` : le nom exact dans spells.json (comparé sans accents).
    // `mods` : une fonction de l'édition, pour les textes qui diffèrent.
    const PRESETS = [
        { id: 'benediction', sort: 'Bénédiction', icone: '✚',
          // 2014 : « elle peut lancer un d4 et en ajouter le résultat au jet d’attaque ou jet de sauvegarde »
          // 2024 : « elle ajoute 1d4 au résultat correspondant » (jet d’attaque ou jet de sauvegarde)
          mods: () => [{ cible: 'attaque', type: 'des', valeur: '1d4' }, { cible: 'sauvegarde', type: 'des', valeur: '1d4' }] },
        { id: 'fleau', sort: 'Fléau', icone: '✖',
          // 2014 : « doit lancer un d4 qu’elle retranche au résultat du jet d’attaque ou de sauvegarde »
          mods: () => [{ cible: 'attaque', type: 'des', valeur: '-1d4' }, { cible: 'sauvegarde', type: 'des', valeur: '-1d4' }] },
        { id: 'hate', sort: 'Hâte', icone: '⚡',
          // 2014 et 2024 : « sa vitesse doubler, sa CA reçoit un bonus de +2, elle est avantagée
          // aux jets de sauvegarde de Dextérité »
          mods: () => [{ cible: 'vitesse', type: 'multiplier', valeur: 2 }, { cible: 'ca', type: 'bonus', valeur: 2 },
                       { cible: 'sauvegarde:dex', type: 'avantage' }] },
        { id: 'lenteur', sort: 'Lenteur', icone: '🐌',
          // 2014 et 2024 : « vitesse réduite de moitié, subit un malus de –2 à la CA et aux jets de
          // sauvegarde de Dextérité »
          mods: () => [{ cible: 'vitesse', type: 'multiplier', valeur: 0.5 }, { cible: 'ca', type: 'bonus', valeur: -2 },
                       { cible: 'sauvegarde:dex', type: 'bonus', valeur: -2 }] },
        { id: 'bouclier-de-la-foi', sort: 'Bouclier de la foi', icone: '🛡',
          // 2014 et 2024 : « un bonus de +2 à la CA pour toute la durée »
          mods: () => [{ cible: 'ca', type: 'bonus', valeur: 2 }] },
        { id: 'faveur-divine', sort: 'Faveur divine', icone: '☀',
          // 2014 : « vos attaques d’arme infligent 1d4 dégâts radiants supplémentaires »
          // 2024 : « vos attaques avec une arme infligent 1d4 dégâts radiants supplémentaires »
          mods: () => [{ cible: 'degats-arme', type: 'des', valeur: '1d4', degat: 'radiant' }] },
        { id: 'marque-du-chasseur', sort: 'Marque du chasseur', icone: '🎯',
          // 2014 : « 1d6 dégâts supplémentaires à la cible chaque fois que vous la touchez avec une attaque d’arme »
          // 2024 : « 1d6 dégâts de force à la cible chaque fois que vous la touchez avec un jet d’attaque »
          mods: (ed) => [ed === '2014'
              ? { cible: 'degats-arme', type: 'des', valeur: '1d6', degat: '' }
              : { cible: 'degats-attaque', type: 'des', valeur: '1d6', degat: 'force' }],
          note: 'Seulement contre la créature marquée.' },
        { id: 'malefice', sort: 'Maléfice', icone: '🜏',
          // 2024 : « 1d6 dégâts nécrotiques supplémentaires à la cible chaque fois que vous la touchez avec un jet d’attaque »
          mods: () => [{ cible: 'degats-attaque', type: 'des', valeur: '1d6', degat: 'nécrotique' }],
          note: 'Seulement contre la créature maudite.' },
        { id: 'agrandissement', sort: 'Agrandissement/Rapetissement', nom: 'Agrandissement', icone: '⬆',
          // 2014 : « avantagée aux tests de Force et aux jets de sauvegarde de Force » ; « les attaques
          //        associées de la cible infligent 1d4 dégâts supplémentaires »
          // 2024 : « l’Avantage aux tests de Force et aux jets de sauvegarde de Force. Les attaques que la
          //        cible effectue avec une arme agrandie ou à mains nues infligent 1d4 dégâts supplémentaires »
          mods: () => [{ cible: 'tests:str', type: 'avantage' }, { cible: 'sauvegarde:str', type: 'avantage' },
                       { cible: 'degats-arme', type: 'des', valeur: '1d4', degat: '' }] },
        { id: 'rapetissement', sort: 'Agrandissement/Rapetissement', nom: 'Rapetissement', icone: '⬇',
          // 2014 : « désavantagée aux tests de Force et aux jets de sauvegarde de Force » ; « infligent 1d4 dégâts
          //        de moins (ce qui ne peut réduire les dégâts en dessous de 1) » ; 2024 : « Désavantage aux tests
          //        de Force et aux jets de sauvegarde de Force » ; « 1d4 dégâts de moins quand elles touchent
          //        (minimum de 1 dégât) ». Ce minimum ne se chiffre pas ligne à ligne : il est rappelé.
          mods: () => [{ cible: 'tests:str', type: 'desavantage' }, { cible: 'sauvegarde:str', type: 'desavantage' },
                       { cible: 'degats-arme', type: 'des', valeur: '-1d4', degat: '' }],
          note: 'Les dégâts de l’arme ne descendent pas sous 1.' },
        { id: 'peau-decorce', sort: 'Peau d’écorce', icone: '🌳',
          // 2014 : « sa CA ne peut être inférieure à 16 » ; 2024 : « sa classe d’armure passe à 17 si elle est inférieure »
          mods: (ed) => [{ cible: 'ca', type: 'minimum', valeur: ed === '2014' ? 16 : 17 }] },
        { id: 'heroisme', sort: 'Héroïsme', icone: '🦁',
          // 2014 et 2024 : « reçoit autant de points de vie temporaires que votre modificateur de caractéristique
          // d’incantation au début de chacun de ses tours » ; 2014 seul : « Quand le sort prend fin, la cible perd
          // tous les points de vie temporaires restants issus du sort »
          mods: () => [], pvTempTour: true, pvTempFin: (ed) => ed === '2014',
          note: 'Immunisé contre l’état Effrayé.' },
        { id: 'rage', classe: 'Barbare', aptitude: 'Rage', icone: '💢',
          // 2014 : « avantagé aux tests de Force et aux jets de sauvegarde de Force » ; « attaque d’arme de corps à
          //        corps basée sur la Force […] bonus au jet de dégâts » (colonne « Dégâts de rage ») ;
          //        « résistance aux dégâts contondants, perforants et tranchants » ; « Votre rage dure 1 minute » ;
          //        fin si « vous subissez l’état inconscient ».
          // 2024 : « Avantage aux tests de Force et aux jets de sauvegarde de Force » ; « attaque basée sur la Force,
          //        que ce soit avec une arme ou à mains nues » ; « Résistance aux dégâts contondants, perforants et
          //        tranchants » ; « maximum de 10 minutes » ; fin si « subissez l’état Neutralisé ».
          mods: (ed, extra) => [{ cible: 'tests:str', type: 'avantage' }, { cible: 'sauvegarde:str', type: 'avantage' },
                                { cible: 'resistance', type: 'resistance', valeur: ['contondants', 'perforants', 'tranchants'] }]
              .concat(extra && extra.degatsRage ? [{ cible: 'degats-force', type: 'bonus', valeur: extra.degatsRage, melee: ed === '2014' }] : []),
          finEtats: (ed) => (ed === '2014' ? ['unconscious'] : ['incapacitated']),
          note: 'Ni sorts, ni concentration.' }
    ];

    // ---------- Lecture des données ----------
    /** « concentration, jusqu’à 1 minute », « 8 heures », « 1 minute »… → { unite, valeur } */
    function lireDuree(txt) {
        const m = String(txt || '').match(/(\d+)\s*(round|minute|heure)s?/i);
        if (!m) return /instantan/i.test(String(txt || '')) ? null : { unite: 'illimitee', valeur: 0 };
        return { unite: m[2].toLowerCase(), valeur: parseInt(m[1], 10) };
    }

    async function sortsDeLEdition() {
        try { return await window.SRD.category('spells'); } catch (e) { return []; }
    }
    async function classesDeLEdition() {
        try { return await window.SRD.category('classes'); } catch (e) { return []; }
    }
    /** Le niveau atteint dans une classe (multiclassage compris). */
    async function niveauDeClasse(nom) {
        try {
            await window.charger('multiclasse');
            const e = window.Multiclasse.liste().find(c => plier(c.nom) === plier(nom));
            if (e) return parseInt(e.niveau, 10) || 0;
        } catch (e) { /* sans le module : le champ de la fiche */ }
        const cls = String(($('char-class') || {}).value || '');
        return plier(cls).includes(plier(nom)) ? (parseInt(($('char-level') || {}).value, 10) || 1) : 0;
    }

    /** Les préréglages disponibles dans l'édition du personnage, complétés par les données. */
    async function presetsDisponibles() {
        const ed = edition();
        const [sorts, classes] = await Promise.all([sortsDeLEdition(), classesDeLEdition()]);
        const out = [];
        for (const p of PRESETS) {
            if (p.sort) {
                const s = sorts.find(x => plier(x.name) === plier(p.sort));
                if (!s) continue;
                const duree = lireDuree(s.duration);
                if (!duree) continue;
                out.push({ p, nom: p.nom || s.name, source: 'Sort de niveau ' + s.level, duree,
                           concentration: !!s.concentration, mods: p.mods(ed), desc: [].concat(s.desc || []).join('\n') });
            } else if (p.classe) {
                const c = classes.find(x => plier(x.name) === plier(p.classe));
                const f = c && (c.features || []).find(x => plier(x.name) === plier(p.aptitude));
                if (!f) continue;
                const texte = [].concat(f.text || []).join('\n');
                // « Votre rage dure 1 minute » (2014) · « un maximum de 10 minutes » (2024)
                const m = texte.match(/dure\s+(\d+)\s+minute/i) || texte.match(/maximum de\s+(\d+)\s+minutes/i);
                const duree = m ? { unite: 'minute', valeur: parseInt(m[1], 10) } : { unite: 'illimitee', valeur: 0 };
                // La colonne « Dégâts de rage » de la table de classe, au niveau atteint.
                let degatsRage = 0;
                const niv = await niveauDeClasse(p.classe);
                const col = (c.level_columns || []).find(x => /d[ée]g[âa]ts de rage/i.test(x.label || ''));
                if (col && niv > 0) {
                    (c.levels || []).filter(r => Number(r.level) <= niv).forEach(r => {
                        const v = col.field === 'class_specific' ? (r.class_specific || {})[col.key] : r[col.key];
                        if (v != null && /[+-]?\d+/.test(String(v))) degatsRage = parseInt(String(v).replace('+', ''), 10);
                    });
                }
                out.push({ p, nom: f.name, source: 'Aptitude de ' + c.name, duree, concentration: false,
                           mods: p.mods(ed, { degatsRage }), desc: texte, degatsRage });
            }
        }
        return out;
    }

    // =====================================================
    // L'ÉTAT
    // =====================================================
    const store = () => window.SheetStore;
    function liste() {
        const l = store() && store().get(CLE);
        return Array.isArray(l) ? l.filter(e => e && typeof e === 'object') : [];
    }
    function poser(l) {
        if (store()) store().set(CLE, l);
        apresChangement();
    }
    function apresChangement() {
        rendre();
        if (window.SheetApi && window.SheetApi.refresh) window.SheetApi.refresh();
        // CA automatique : le widget d'armure recalcule avec les effets (calcul.js les compte).
        if (window.ArmorWidget && window.ArmorWidget.refresh) window.ArmorWidget.refresh();
        document.dispatchEvent(new CustomEvent('effets:change'));
    }
    const nouvelId = () => 'e-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    const enRounds = (d) => (d && ROUNDS[d.unite] ? d.valeur * ROUNDS[d.unite] : null);

    /** « 8 r. », « 9 min », « 2 h », « repos long »… */
    function restantTexte(e) {
        if (e.restant == null) {
            if (e.duree && e.duree.unite === 'repos-court') return 'jusqu’au repos court';
            if (e.duree && e.duree.unite === 'repos-long') return 'jusqu’au repos long';
            return '';
        }
        const r = e.restant;
        if (r <= 10) return r + ' r.';                 // une minute se compte encore en rounds
        if (r < 600) return Math.ceil(r / 10) + ' min';
        const h = r / 600;
        return (Number.isInteger(h) ? h : h.toFixed(1).replace('.', ',')) + ' h';
    }

    // ---------- Ajouter, retirer ----------
    async function ajouter(o) {
        const e = Object.assign({ id: nouvelId(), preset: null, nom: 'Effet', icone: '✦', desc: '', mods: [],
                                  duree: { unite: 'illimitee', valeur: 0 }, concentration: false, finEtats: [],
                                  pvTempTour: null, pvTempFin: false, forme: false, debut: Date.now() }, o || {});
        e.restant = o && o.restant != null ? o.restant : enRounds(e.duree);
        const l = liste();
        // Un préréglage déjà actif se relance : on remplace, on n'empile pas.
        const idem = l.findIndex(x => (e.preset && x.preset === e.preset) || (e.forme && x.forme));
        if (idem !== -1) l.splice(idem, 1);
        // Une seule concentration à la fois (et elle est partagée avec le grimoire).
        if (e.concentration) {
            const autres = l.filter(x => x.concentration);
            const sortGrimoire = (store() && store().raw('dnd-concentration-spell')) || '';
            const occupe = autres.length ? autres[0].nom : (sortGrimoire && plier(sortGrimoire) !== plier(e.nom) ? sortGrimoire : '');
            if (occupe) {
                const ok = await window.Dialogue.confirmer({
                    titre: 'Changer de concentration ?', icone: '◈', confirmer: 'Continuer',
                    message: `Tu te concentres déjà sur « ${occupe} ».\n\nActiver « ${e.nom} » y met fin.`
                });
                if (!ok) return null;
                autres.forEach(x => { const i = l.indexOf(x); if (i !== -1) l.splice(i, 1); finir(x, 'concentration', true); });
            }
            poserConcentration(e.nom);
        }
        // Héroïsme : les PV temporaires arrivent « au début de chacun de ses tours » — le premier tout de suite.
        if (e.pvTempTour) donnerPvTemp(e.pvTempTour);
        const silencieux = !!e.silencieux;
        delete e.silencieux;
        l.push(e);
        poser(l);
        if (!silencieux) toast(`${e.icone} ${e.nom} : effet actif${restantTexte(e) ? ' (' + restantTexte(e) + ')' : ''}.`, 'reussite');
        return e;
    }

    function poserConcentration(nom) {
        // Le grimoire lit cette clé en texte brut (script.js, setConcentration).
        if (store() && store().setRaw) store().setRaw('dnd-concentration-spell', nom);
        const cb = $('is-concentrating');
        if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
    }

    function donnerPvTemp(n) {
        const el = $('hp-temp'); if (!el || !(n > 0)) return;
        // PV temporaires « non cumulables » (les deux éditions) : on garde le plus élevé.
        const avant = parseInt(el.value, 10) || 0;
        if (n <= avant) return;
        el.value = n;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /** Termine un effet. `raison` : 'manuel' | 'expire' | 'repos' | 'concentration' | 'etat'. */
    function finir(e, raison, silencieux) {
        if (e.pvTempFin && e.pvTempTour) {
            const el = $('hp-temp');
            if (el && (parseInt(el.value, 10) || 0) > 0) { el.value = 0; el.dispatchEvent(new Event('input', { bubbles: true })); }
        }
        if (e.concentration) {
            const cb = $('is-concentrating');
            const actuel = (store() && store().raw('dnd-concentration-spell')) || '';
            if (cb && cb.checked && (!actuel || plier(actuel) === plier(e.nom)) && raison !== 'concentration') {
                cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        if (e.forme && raison !== 'forme') {
            const revenir = () => window.Formes && window.Formes.reprendre({ raison: 'effet', silencieux: true, depuisEffet: true });
            if (window.Formes) revenir();
            else if (window.charger) window.charger('formes').then(revenir).catch(() => {});
        }
        if (!silencieux) {
            const pourquoi = { expire: 'prend fin', repos: 'prend fin avec le repos', concentration: 'prend fin : concentration rompue', etat: 'prend fin' }[raison] || 'retiré';
            toast(`${e.icone} ${e.nom} ${pourquoi}.`, 'info');
        }
        document.dispatchEvent(new CustomEvent('effet:fin', { detail: { id: e.id, nom: e.nom, raison } }));
    }

    function retirer(id, opts) {
        const l = liste();
        const i = l.findIndex(e => e.id === id);
        if (i === -1) return null;
        const [e] = l.splice(i, 1);
        finir(e, (opts && opts.raison) || 'manuel', true);
        poser(l);
        if (!(opts && opts.sansAnnuler) && window.showUndoToast) {
            window.showUndoToast(`${e.icone} « ${e.nom} » retiré`, () => {
                const l2 = liste(); l2.push(e); poser(l2);
                if (e.concentration) poserConcentration(e.nom);
            });
        }
        return e;
    }

    /** Termine les effets qui répondent à `test`, et rend leurs noms. */
    function terminerSi(test, raison) {
        const l = liste();
        const finis = l.filter(test);
        if (!finis.length) return [];
        finis.forEach(e => finir(e, raison, true));
        poser(l.filter(e => !finis.includes(e)));
        return finis.map(e => e.nom);
    }

    // ---------- Le temps qui passe ----------
    function roundSuivant() {
        const l = liste();
        if (!l.length) return [];
        const finis = [];
        l.forEach(e => {
            if (e.restant != null) { e.restant -= 1; if (e.restant <= 0) finis.push(e); }
            if (e.pvTempTour && !finis.includes(e)) donnerPvTemp(e.pvTempTour);
        });
        finis.forEach(e => finir(e, 'expire'));
        poser(l.filter(e => !finis.includes(e)));
        document.dispatchEvent(new CustomEvent('effets:round', { detail: { finis: finis.map(e => e.nom) } }));
        return finis.map(e => e.nom);
    }

    /** Un repos fait passer 1 heure (court) ou 8 heures (long). Rend les noms des effets terminés. */
    function finRepos(type) {
        const duree = REPOS[type] || 0;
        const l = liste();
        const finis = l.filter(e => (e.duree && e.duree.unite === 'repos-court')
            || (type === 'long' && e.duree && e.duree.unite === 'repos-long')
            || (e.restant != null && e.restant <= duree));
        l.forEach(e => { if (!finis.includes(e) && e.restant != null) e.restant -= duree; });
        finis.forEach(e => finir(e, 'repos', true));
        poser(l.filter(e => !finis.includes(e)));
        return finis.map(e => e.nom);
    }

    // =====================================================
    // CE QUE LA FICHE DEMANDE
    // =====================================================
    /** La clé du moteur correspond-elle à la cible d'un modificateur ? */
    function correspond(cible, cle) {
        const k = String(cle || '');
        switch (true) {
            case cible === 'attaque': return k === 'attaque' || k === 'attaque-sorts';
            case cible === 'attaque-arme': return k === 'attaque';
            case cible === 'sauvegarde': return k.startsWith('sauvegarde:') || k === 'mort';
            case cible.startsWith('sauvegarde:'): return k === cible;
            case cible.startsWith('tests:'): {
                const carac = cible.slice(6);
                if (k === 'carac:' + carac) return true;
                if (k === 'initiative') return carac === 'dex';
                if (k.startsWith('competence:') && window.Calcul) {
                    const r = window.Calcul.valeur(k);
                    return !!(r && r.carac === carac);
                }
                return false;
            }
            default: return cible === k;
        }
    }

    /** Les sources chiffrées pour le moteur de calcul. */
    let sansMinimum = false;
    function sourcesMoteur(cle, ctx) {
        const out = [];
        liste().forEach(e => (e.mods || []).forEach(m => {
            if (m.type === 'bonus' && typeof m.valeur === 'number' && !String(m.cible).startsWith('degats') && correspond(m.cible, cle)) {
                out.push({ libelle: e.nom, valeur: m.valeur, origine: 'effet' });
            }
            if (m.type === 'multiplier' && cle === 'vitesse' && ctx && typeof ctx.base === 'number' && ctx.base > 0) {
                out.push({ libelle: `${e.nom} (×${String(m.valeur).replace('.', ',')})`, valeur: ctx.base * (Number(m.valeur) - 1), origine: 'effet' });
            }
        }));
        // « Minimum » de CA (Peau d'écorce) : ce qui manque pour l'atteindre, calculé sans lui.
        if (cle === 'ca' && !sansMinimum) {
            const minis = liste().flatMap(e => (e.mods || []).filter(m => m.type === 'minimum' && m.cible === 'ca').map(m => ({ e, m })));
            if (minis.length && window.Calcul) {
                sansMinimum = true;
                let total = null;
                try { const r = window.Calcul.valeur('ca', ctx); total = r ? r.total : null; } finally { sansMinimum = false; }
                const plusHaut = minis.reduce((a, b) => (b.m.valeur > a.m.valeur ? b : a));
                if (total != null && total < plusHaut.m.valeur) {
                    out.push({ libelle: `${plusHaut.e.nom} (minimum ${plusHaut.m.valeur})`, valeur: plusHaut.m.valeur - total, origine: 'effet' });
                }
            }
        }
        return out;
    }

    /** Pour un jet de d20 : les dés à ajouter et l'avantage / le désavantage. */
    function pourJet(cle) {
        const r = { des: [], avantage: [], desavantage: [] };
        liste().forEach(e => (e.mods || []).forEach(m => {
            if (String(m.cible).startsWith('degats') || !correspond(m.cible, cle)) return;
            if (m.type === 'des' && m.valeur) r.des.push({ libelle: e.nom, expr: String(m.valeur) });
            if (m.type === 'avantage') r.avantage.push(e.nom);
            if (m.type === 'desavantage') r.desavantage.push(e.nom);
        }));
        return r;
    }

    /** Les dégâts en plus d'une attaque. `o` : { arme, genre: 'arme' | 'sort' }. */
    function degatsPour(o) {
        const out = [];
        const atk = o && o.arme;
        const C = window.Calcul;
        liste().forEach(e => (e.mods || []).forEach(m => {
            if (!String(m.cible).startsWith('degats')) return;
            let ok = false;
            if (m.cible === 'degats-attaque') ok = true;
            else if (m.cible === 'degats-arme') ok = o.genre === 'arme';
            else if (m.cible === 'degats-force') {
                // « basée sur la Force » : la carac de l'arme, lue par le moteur. Saisie à la main : inconnue.
                ok = o.genre === 'arme' && !!(atk && C && C.caracArme(atk) === 'str')
                    && (!m.melee || C.typeArme(atk) === 'melee');
            }
            if (!ok) return;
            const expr = m.type === 'bonus' ? String(m.valeur) : String(m.valeur || '');
            if (expr) out.push({ libelle: e.nom, expr, type: m.degat || '' });
        }));
        return out;
    }

    /** Les résistances accordées en ce moment, pour une clé de défense ('resist'…). */
    function resistances(k) {
        if (k !== 'resist') return [];
        return liste().flatMap(e => (e.mods || []).filter(m => m.type === 'resistance').flatMap(m => [].concat(m.valeur || [])));
    }

    /** Les effets actifs, pour la carte de résultat et les autres modules. */
    const actifs = () => liste().map(e => ({ id: e.id, nom: e.nom, icone: e.icone, restant: restantTexte(e), concentration: !!e.concentration, forme: !!e.forme }));

    // =====================================================
    // L'AFFICHAGE : des pastilles, à côté des états
    // =====================================================
    function resume(e) {
        const bouts = [];
        (e.mods || []).forEach(m => {
            const cibles = { attaque: 'attaques', 'attaque-arme': 'attaques d’arme', sauvegarde: 'sauvegardes', ca: 'CA', vitesse: 'Vitesse',
                             initiative: 'initiative', 'degats-arme': 'dégâts des armes', 'degats-attaque': 'dégâts des attaques',
                             'degats-force': 'dégâts (attaques de Force)', resistance: 'résistance' };
            const nomCible = cibles[m.cible] || String(m.cible).replace('sauvegarde:', 'sauvegarde ').replace('tests:', 'tests ')
                .replace(/\b(str|dex|con|int|wis|cha)\b/, (x) => (window.Calcul ? window.Calcul.ABREGE[x] : x));
            if (m.type === 'bonus') bouts.push(`${m.valeur > 0 ? '+' : ''}${m.valeur} ${nomCible}`);
            else if (m.type === 'des') bouts.push(`${/^-/.test(m.valeur) ? '−' + String(m.valeur).slice(1) : '+' + m.valeur} ${nomCible}${m.degat ? ' ' + m.degat : ''}`);
            else if (m.type === 'avantage') bouts.push('Avantage ' + nomCible);
            else if (m.type === 'desavantage') bouts.push('Désavantage ' + nomCible);
            else if (m.type === 'resistance') bouts.push('Résistance : ' + [].concat(m.valeur).join(', '));
            else if (m.type === 'multiplier') bouts.push(`Vitesse ×${String(m.valeur).replace('.', ',')}`);
            else if (m.type === 'minimum') bouts.push(`CA au moins ${m.valeur}`);
        });
        if (e.pvTempTour) bouts.push(`${e.pvTempTour} PV temporaires par round`);
        if (e.note) bouts.push(e.note);
        if (e.concentration) bouts.push('Concentration');
        const reste = restantTexte(e);
        if (reste) bouts.push('Reste : ' + reste);
        return bouts.join(' · ') || (e.desc ? String(e.desc).slice(0, 160) : 'Effet en cours.');
    }

    function rendre() {
        const boite = $('effets-pastilles');
        if (!boite) return;
        const l = liste();
        boite.classList.toggle('est-vide', !l.length);
        boite.innerHTML = l.map(e => {
            const txt = resume(e);
            const reste = restantTexte(e);
            return `<span class="etat-pastille effet-pastille${e.concentration ? ' est-conc' : ''}${e.forme ? ' est-forme' : ''}"
                          data-effet="${esc(e.id)}" data-resume="${esc(txt)}" tabindex="0"
                          aria-label="${esc('Effet : ' + e.nom + '. ' + txt)}">
                <span class="etat-ico" aria-hidden="true">${esc(e.icone)}</span>
                <span class="etat-nom">${esc(e.nom)}</span>
                ${reste ? `<span class="effet-reste" aria-hidden="true">${esc(reste)}</span>` : ''}
                ${e.concentration ? '<span class="effet-conc" aria-hidden="true" title="Concentration">◈</span>' : ''}
                <button type="button" class="etat-x no-print" data-effet-retirer="${esc(e.id)}" aria-label="Retirer l’effet ${esc(e.nom)}">✕</button>
            </span>`;
        }).join('');
        const round = $('btn-round-suivant');
        if (round) round.hidden = !l.some(e => e.restant != null || e.pvTempTour);
        // Les résistances des effets s'affichent sous le champ « Résistances », sans jamais
        // y être écrites : la saisie du joueur reste la sienne.
        const champ = $('dmg-resist');
        if (champ) {
            const hote = champ.closest('.defense-field') || champ.parentNode;
            let note = hote.querySelector('.def-effets');
            const r = [...new Set(resistances('resist'))];
            if (!r.length) { if (note) note.remove(); }
            else {
                if (!note) { note = document.createElement('span'); note.className = 'def-effets no-print'; hote.appendChild(note); }
                note.textContent = 'Par tes effets : ' + r.join(', ');
            }
        }
    }

    // =====================================================
    // LA FENÊTRE « ✦ EFFET »
    // =====================================================
    const CIBLES_PERSO = [
        ['attaque', 'Jets d’attaque'], ['sauvegarde', 'Jets de sauvegarde'], ['ca', 'Classe d’armure'],
        ['vitesse', 'Vitesse'], ['initiative', 'Initiative'], ['degats-arme', 'Dégâts des armes'],
        ['tests:str', 'Tests de Force'], ['tests:dex', 'Tests de Dextérité'], ['tests:con', 'Tests de Constitution'],
        ['tests:int', 'Tests d’Intelligence'], ['tests:wis', 'Tests de Sagesse'], ['tests:cha', 'Tests de Charisme']
    ];
    const TYPES_PERSO = [['bonus', 'Bonus (nombre)'], ['des', 'Dé en plus (1d4…)'], ['avantage', 'Avantage'], ['desavantage', 'Désavantage'], ['resistance', 'Résistance']];

    async function ouvrir() {
        let presets = [];
        try { presets = await presetsDisponibles(); } catch (e) { presets = []; }
        let choix = null;          // { preset } | { perso } | { forme }
        const ed = edition();
        const resultat = await window.Dialogue.fenetre({
            titre: 'Ajouter un effet', icone: '✦', large: true, confirmer: 'Activer', annuler: 'Annuler',
            corps(boite) {
                const div = document.createElement('div');
                div.className = 'effets-fenetre';
                div.innerHTML = `
                    <p class="effets-aide">Règles ${esc(ed)} · les chiffres viennent du texte officiel de chaque sort ou aptitude.</p>
                    <div class="dlg-choix effets-presets" role="radiogroup" aria-label="Préréglages">
                        ${presets.map((x, i) => `<label class="dlg-choix-opt"><input type="radio" name="effet-choix" value="p${i}">
                            <span class="dlg-choix-carte"><span class="dlg-choix-ico" aria-hidden="true">${esc(x.p.icone)}</span>
                            <span class="dlg-choix-txt"><b>${esc(x.nom)}</b><i>${esc(resume({ mods: x.mods, note: x.p.note, pvTempTour: x.p.pvTempTour ? 'mod.' : null }))}</i></span>
                            <span class="dlg-choix-note">${esc(dureeTexte(x.duree))}${x.concentration ? ' ◈' : ''}</span></span></label>`).join('')
                            || '<p class="effets-aide">Les règles ne sont pas disponibles hors ligne : crée un effet personnalisé.</p>'}
                        <label class="dlg-choix-opt"><input type="radio" name="effet-choix" value="forme-sauvage">
                            <span class="dlg-choix-carte"><span class="dlg-choix-ico" aria-hidden="true">🐾</span>
                            <span class="dlg-choix-txt"><b>Forme sauvage…</b><i>Prendre la forme d’une bête du bestiaire</i></span></span></label>
                        <label class="dlg-choix-opt"><input type="radio" name="effet-choix" value="metamorphose">
                            <span class="dlg-choix-carte"><span class="dlg-choix-ico" aria-hidden="true">🦎</span>
                            <span class="dlg-choix-txt"><b>Métamorphose…</b><i>Le sort, lancé sur toi-même</i></span></span></label>
                        <label class="dlg-choix-opt"><input type="radio" name="effet-choix" value="perso">
                            <span class="dlg-choix-carte"><span class="dlg-choix-ico" aria-hidden="true">✎</span>
                            <span class="dlg-choix-txt"><b>Effet personnalisé</b><i>Objet, potion, aptitude, règle maison…</i></span></span></label>
                    </div>
                    <fieldset class="effets-perso" hidden>
                        <legend>Effet personnalisé</legend>
                        <label>Nom <input type="text" class="ef-nom" maxlength="40" placeholder="Potion de géant"></label>
                        <div class="ef-ligne">
                            <label>Durée <input type="number" class="ef-duree" min="1" max="9999" value="1"></label>
                            <label>Unité <select class="ef-unite">
                                <option value="round">rounds</option><option value="minute" selected>minutes</option><option value="heure">heures</option>
                                <option value="repos-court">jusqu’au repos court</option><option value="repos-long">jusqu’au repos long</option>
                                <option value="illimitee">sans limite</option></select></label>
                            <label class="ef-case"><input type="checkbox" class="ef-conc"> Concentration</label>
                        </div>
                        <div class="ef-mods"></div>
                        <button type="button" class="btn-small ef-ajout-mod">＋ Un modificateur</button>
                    </fieldset>`;
                const perso = div.querySelector('.effets-perso');
                const mods = div.querySelector('.ef-mods');
                const ligneMod = () => {
                    const l = document.createElement('div');
                    l.className = 'ef-mod';
                    l.innerHTML = `<select class="ef-cible" aria-label="Ce qui est modifié">${CIBLES_PERSO.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('')}</select>
                        <select class="ef-type" aria-label="Type de modificateur">${TYPES_PERSO.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('')}</select>
                        <input type="text" class="ef-valeur" aria-label="Valeur" placeholder="+1, 1d4, feu…">
                        <button type="button" class="etat-x ef-suppr" aria-label="Retirer ce modificateur">✕</button>`;
                    mods.appendChild(l);
                };
                ligneMod();
                div.addEventListener('click', (e) => {
                    if (e.target.closest('.ef-ajout-mod')) { ligneMod(); mods.lastElementChild.querySelector('select').focus(); }
                    const s = e.target.closest('.ef-suppr'); if (s) s.closest('.ef-mod').remove();
                });
                div.addEventListener('change', (e) => {
                    if (e.target.name === 'effet-choix') {
                        perso.hidden = e.target.value !== 'perso';
                        if (!perso.hidden) div.querySelector('.ef-nom').focus();
                    }
                });
                return div;
            },
            resultat(signaler) {
                const boite = document.querySelector('.effets-fenetre');
                const coche = boite && boite.querySelector('input[name="effet-choix"]:checked');
                if (!coche) { signaler('Choisis un effet.'); return undefined; }
                if (coche.value.startsWith('p')) { choix = { preset: presets[parseInt(coche.value.slice(1), 10)] }; return true; }
                if (coche.value === 'forme-sauvage' || coche.value === 'metamorphose') { choix = { forme: coche.value }; return true; }
                const nom = boite.querySelector('.ef-nom').value.trim();
                if (!nom) { signaler('Donne un nom à l’effet.'); return undefined; }
                const unite = boite.querySelector('.ef-unite').value;
                const valeurDuree = Math.max(1, parseInt(boite.querySelector('.ef-duree').value, 10) || 1);
                const lus = [];
                for (const l of boite.querySelectorAll('.ef-mod')) {
                    const cible = l.querySelector('.ef-cible').value, type = l.querySelector('.ef-type').value;
                    const brut = l.querySelector('.ef-valeur').value.trim();
                    if (type === 'bonus') {
                        const n = parseInt(brut.replace('−', '-'), 10);
                        if (!brut) continue;
                        if (isNaN(n)) { signaler('Un bonus s’écrit comme un nombre : +1, -2…'); return undefined; }
                        lus.push({ cible: cible === 'degats-arme' ? 'degats-arme' : cible, type: 'bonus', valeur: n });
                    } else if (type === 'des') {
                        if (!/^[+-−]?\d*d\d+$/i.test(brut.replace(/\s+/g, ''))) { signaler('Un dé s’écrit 1d4, 2d6, -1d4…'); return undefined; }
                        lus.push({ cible, type: 'des', valeur: brut.replace(/\s+/g, '').replace('−', '-').replace(/^\+/, '') });
                    } else if (type === 'resistance') {
                        if (brut) lus.push({ cible: 'resistance', type: 'resistance', valeur: brut.split(/[,;]/).map(x => x.trim()).filter(Boolean) });
                    } else lus.push({ cible, type });
                }
                choix = { perso: { nom, icone: '✦', mods: lus, duree: { unite, valeur: valeurDuree },
                                   concentration: boite.querySelector('.ef-conc').checked } };
                return true;
            }
        });
        if (!resultat || !choix) return null;
        if (choix.forme) {
            await window.charger('formes');
            return window.Formes.ouvrir(choix.forme);
        }
        if (choix.perso) return ajouter(choix.perso);
        const x = choix.preset;
        let pvTempTour = null;
        if (x.p.pvTempTour) {
            const mod = window.Calcul ? window.Calcul.valeur('mod-sorts') : null;
            pvTempTour = mod ? Math.max(0, mod.total) : 0;
            if (!mod) toast('Choisis ta caractéristique d’incantation : Héroïsme en a besoin.', 'info');
        }
        return ajouter({
            preset: x.p.id, nom: x.nom, icone: x.p.icone, desc: x.desc, mods: x.mods, duree: x.duree,
            concentration: x.concentration, note: x.p.note || '',
            finEtats: x.p.finEtats ? x.p.finEtats(edition()) : [],
            pvTempTour, pvTempFin: x.p.pvTempFin ? x.p.pvTempFin(edition()) : false
        });
    }
    function dureeTexte(d) {
        if (!d) return '';
        if (d.unite === 'illimitee') return 'sans limite';
        const u = { round: ['round', 'rounds'], minute: ['minute', 'minutes'], heure: ['heure', 'heures'] }[d.unite];
        return u ? `${d.valeur} ${d.valeur > 1 ? u[1] : u[0]}` : '';
    }

    // =====================================================
    // BRANCHEMENTS
    // =====================================================
    document.addEventListener('click', (e) => {
        const x = e.target.closest && e.target.closest('[data-effet-retirer]');
        if (x) { e.preventDefault(); retirer(x.getAttribute('data-effet-retirer')); return; }
        if (e.target.closest && e.target.closest('#btn-round-suivant')) { e.preventDefault(); roundSuivant(); }
    });
    // Décocher « Concentration » rompt les effets qui en dépendent.
    document.addEventListener('change', (e) => {
        const t = e.target;
        if (t && t.id === 'is-concentrating' && !t.checked) {
            terminerSi(x => x.concentration, 'concentration').forEach(n => toast(`◈ ${n} prend fin : concentration rompue.`, 'info'));
        }
        // Un état qui met fin à un effet (Rage : inconscient en 2014, Neutralisé en 2024).
        if (t && /^cond-/.test(t.id || '') && t.checked && window.Etats) {
            terminerSi(x => (x.finEtats || []).some(s => window.Etats.estActif(s)), 'etat').forEach(n => toast(`${n} prend fin.`, 'info'));
        }
    });
    // Le grimoire prend la concentration pour un autre sort : l'effet précédent s'arrête.
    document.addEventListener('sort:lance', () => {
        setTimeout(() => {
            const actuel = (store() && store().raw('dnd-concentration-spell')) || '';
            if (!actuel) return;
            terminerSi(x => x.concentration && plier(x.nom) !== plier(actuel), 'concentration')
                .forEach(n => toast(`◈ ${n} prend fin : concentration sur « ${actuel} ».`, 'info'));
        }, 0);
    });
    document.addEventListener('edition:change', rendre);

    if (window.Calcul && window.Calcul.fournisseur) window.Calcul.fournisseur(sourcesMoteur);

    window.EffetsActifs = {
        PRESETS, ouvrir, ajouter, retirer, liste, actifs, rendre,
        roundSuivant, finRepos, terminerSi,
        pourJet, degatsPour, resistances, resume, restantTexte, presetsDisponibles, lireDuree,
        aDesResistances: () => resistances('resist').length > 0
    };

    rendre();
    if (window.SheetApi && window.SheetApi.refresh) window.SheetApi.refresh();
    if (liste().length && window.ArmorWidget && window.ArmorWidget.refresh) window.ArmorWidget.refresh();
})();
