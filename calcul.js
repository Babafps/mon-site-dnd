// =====================================================
// calcul.js — le moteur de calcul de la fiche
//
// Chaque valeur calculée — attaque, sauvegarde, compétence, CA, DD,
// initiative, vitesse — est une SOMME DE SOURCES NOMMÉES :
//     { libelle: 'DEX', valeur: 3, origine: 'carac' }
// Origines : base, carac, maitrise, objet, effet, etat, edition, classe, manuel.
// Le même résultat sert à l'affichage, aux jets et à « D'où vient ce chiffre ? »
// (Calcul.detail → « +3 DEX · +2 maîtrise · +1 bonus de l'arme »).
//
// Le moteur LIT la fiche (champs et stockage du personnage actif) et n'écrit
// jamais : l'appelant affiche. Les effets, états et éditions à venir s'y
// greffent par `Calcul.fournisseur(fn)` sans toucher aux calculs.
//
// Les formules sont celles que la fiche appliquait déjà (script.js, armor.js),
// réunies ici à l'identique ; les valeurs par défaut aussi (caractéristique
// vide = 10, bonus de maîtrise vide = +2).
// =====================================================
(function () {
    'use strict';

    const CARACS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    const ABREGE = { str: 'FOR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'SAG', cha: 'CHA' };
    const NOM = { str: 'Force', dex: 'Dextérité', con: 'Constitution', int: 'Intelligence', wis: 'Sagesse', cha: 'Charisme' };
    const ORIGINES = ['base', 'carac', 'maitrise', 'objet', 'effet', 'etat', 'edition', 'classe', 'manuel'];
    const TYPE_ARMURE = { light: 'Légère', medium: 'Intermédiaire', heavy: 'Lourde', shield: 'Bouclier' };
    const FORMATION = { light: 'prof-armor-light', medium: 'prof-armor-med', heavy: 'prof-armor-heavy', shield: 'prof-armor-shield' };

    const $ = (id) => document.getElementById(id);
    const entier = (v, defaut) => { const n = parseInt(v, 10); return isNaN(n) ? defaut : n; };
    const modificateur = (score) => Math.floor((score - 10) / 2);
    const signe = (n) => (n < 0 ? '−' : '+') + Math.abs(n);
    /** « +1 », « -2 », « 1d4+1 » : le premier entier signé, 0 sinon (lecture de la fiche). */
    const lireMod = (brut) => { const m = String(brut == null ? '' : brut).match(/[+-]?\d+/); return m ? parseInt(m[0], 10) : 0; };

    // ---------- Lecture de la fiche ----------
    const brut = (cle) => (window.SheetStore && typeof window.SheetStore.raw === 'function') ? window.SheetStore.raw(cle) : null;
    const lecteurFiche = {
        score: (k) => entier(($('stat-' + k) || {}).value, 10) || 10,
        maitrise: () => entier(($('prof-bonus') || {}).value, 2) || 2,
        /** 0 aucune · 1 maîtrise · 2 expertise */
        niveauMaitrise: (id) => entier(($('prof-' + id) || {}).value, 0) || 0,
        caracDe: (id) => {
            const el = $('prof-' + id);
            if (el && el.dataset.stat) return el.dataset.stat;
            const m = /^save-(\w+)$/.exec(id);
            return m ? m[1] : null;
        },
        nomCompetence: (id) => ((document.querySelector(`[data-target="skill-val-${id}"]`) || {}).dataset || {}).name || id,
        bonusManuel: (id) => entier(brut('dnd-sheet-skill-bonus-' + id), 0) || 0,
        caracIncantation: () => ($('spellcasting-ability') || {}).value || '',
        armure: () => {
            const d = window.SheetStore && window.SheetStore.get ? window.SheetStore.get('dnd-armor') : null;
            return d && typeof d === 'object' ? d : null;
        },
        forme: (idCase) => { const el = $(idCase); return !el || !!el.checked; },
        texte: (id) => String(($(id) || {}).value || '')
    };
    let lecteur = lecteurFiche;

    // ---------- Sources et résultats ----------
    const fournisseurs = [];
    function source(libelle, valeur, origine, base) {
        const s = { libelle: String(libelle), valeur: Number(valeur) || 0, origine: ORIGINES.includes(origine) ? origine : 'effet' };
        if (base) s.base = true;
        return s;
    }
    /** Sources ajoutées par les modules greffés (effets, états…) pour une clé donnée. */
    function supplements(cle, ctx) {
        const out = [];
        fournisseurs.forEach(fn => {
            try {
                (fn(cle, ctx || {}, lecteur) || []).forEach(s => {
                    if (s && Number.isFinite(Number(s.valeur))) out.push(source(s.libelle, s.valeur, s.origine || 'effet'));
                });
            } catch (e) { console.warn('[calcul] une source greffée a échoué :', e); }
        });
        return out;
    }
    function resultat(cle, libelle, sources, ctx, extra) {
        const toutes = sources.concat(supplements(cle, ctx));
        return Object.assign({
            cle, libelle,
            total: toutes.reduce((t, s) => t + s.valeur, 0),
            sources: toutes,
            avertissements: []
        }, extra || {});
    }
    const sourceCarac = (k) => source(ABREGE[k], modificateur(lecteur.score(k)), 'carac');

    // ---------- Caractéristiques, compétences, sauvegardes ----------
    function carac(k, ctx) {
        return resultat('carac:' + k, NOM[k], [sourceCarac(k)], ctx, { carac: k, score: lecteur.score(k) });
    }

    function competence(id, ctx) {
        const k = lecteur.caracDe(id);
        if (!CARACS.includes(k)) return null;
        const sauvegarde = /^save-/.test(id);
        const sources = [sourceCarac(k)];
        const niveau = lecteur.niveauMaitrise(id);
        const pm = lecteur.maitrise();
        if (niveau === 2) sources.push(source('expertise', pm * 2, 'maitrise'));
        else if (niveau === 1) sources.push(source('maîtrise', pm, 'maitrise'));
        const manuel = lecteur.bonusManuel(id);
        if (manuel) sources.push(source('bonus manuel', manuel, 'manuel'));
        return resultat(sauvegarde ? 'sauvegarde:' + k : 'competence:' + id,
            sauvegarde ? 'Sauvegarde de ' + NOM[k] : lecteur.nomCompetence(id),
            sources, ctx, { carac: k, niveauMaitrise: niveau, manuel });
    }

    function passif(id, ctx) {
        const c = competence(id, ctx);
        if (!c) return null;
        return resultat('passif:' + id, c.libelle + ' passive', [source('base', 10, 'base', true)].concat(c.sources), ctx);
    }

    // ---------- Magie ----------
    function sorts(genre, ctx) {
        const k = lecteur.caracIncantation();
        if (!CARACS.includes(k)) return null;                 // vide ou « Aucune »
        const pm = source('maîtrise', lecteur.maitrise(), 'maitrise');
        if (genre === 'dd-sorts') return resultat(genre, 'DD des sorts', [source('base', 8, 'base', true), pm, sourceCarac(k)], ctx, { carac: k });
        if (genre === 'attaque-sorts') return resultat(genre, 'Attaque de sort', [pm, sourceCarac(k)], ctx, { carac: k });
        return resultat(genre, 'Modificateur d’incantation', [sourceCarac(k)], ctx, { carac: k });
    }

    // ---------- Initiative et vitesse ----------
    function initiative(ctx) {
        return resultat('initiative', 'Initiative', [sourceCarac('dex')], ctx);
    }
    function vitesse(ctx) {
        const txt = lecteur.texte('speed');
        const m = txt.match(/\d+(?:[.,]\d+)?/);
        const unite = /\b(ft|pieds?)\b/i.test(txt) ? 'ft' : 'm';
        const sources = m ? [source('Vitesse de base', parseFloat(m[0].replace(',', '.')), 'base', true)] : [];
        const r = resultat('vitesse', 'Vitesse', sources, ctx, { unite });
        if (!m && !r.sources.length) r.total = null;
        return r;
    }

    // ---------- Classe d'armure ----------
    /** Les données du widget d'armure, complétées comme armor.js les lit. */
    function normaliserArmure(d) {
        const x = Object.assign({ auto: false, unarmored: 'base', customBase: 13, misc: [], armors: [] }, d && typeof d === 'object' ? d : {});
        x.armors = Array.isArray(x.armors) ? x.armors : [];
        x.misc = Array.isArray(x.misc) ? x.misc : [];
        return x;
    }

    function caArmure(donnees, ctx) {
        const d = normaliserArmure(donnees);
        const dex = modificateur(lecteur.score('dex'));
        const corps = d.armors.find(a => a.equipped && a.kind !== 'shield') || null;
        const bouclier = d.armors.find(a => a.equipped && a.kind === 'shield') || null;
        const sources = [], avert = [];
        if (corps) {
            sources.push(source(corps.name || 'Armure', entier(corps.base, 10), 'objet', true));
            if (corps.kind === 'light') sources.push(source('DEX', dex, 'carac'));
            else if (corps.kind === 'medium') {
                const plafond = corps.dexMax === '' || corps.dexMax == null ? 2 : entier(corps.dexMax, 2);
                sources.push(source(`DEX (max ${plafond})`, Math.min(dex, plafond), 'carac'));
            }
            if (corps.isMagic && entier(corps.magic, 0)) sources.push(source('Magie', entier(corps.magic, 0), 'objet'));
            const mini = entier(corps.strMin, 0), force = lecteur.score('str');
            if (mini && force < mini) avert.push(`Force ${force} sous les ${corps.strMin} requis : Vitesse réduite de 3 m.`);
            if (corps.stealthDis) avert.push('Désavantage aux tests de Dextérité (Discrétion).');
            if (!lecteur.forme(FORMATION[corps.kind])) {
                avert.push(`Pas de formation aux armures ${String(TYPE_ARMURE[corps.kind] || '').toLowerCase()}s (module Maîtrises) : Désavantage aux tests de Force et de Dextérité, et pas de sorts.`);
            }
        } else if (d.unarmored === 'barbarian') {
            sources.push(source('Base', 10, 'base', true), source('DEX', dex, 'carac'), sourceCarac('con'));
        } else if (d.unarmored === 'monk' && !bouclier) {
            sources.push(source('Base', 10, 'base', true), source('DEX', dex, 'carac'), sourceCarac('wis'));
        } else if (d.unarmored === 'custom') {
            sources.push(source('Base', entier(d.customBase, 10), 'base', true), source('DEX', dex, 'carac'));
        } else {
            sources.push(source('Base', 10, 'base', true), source('DEX', dex, 'carac'));
            if (d.unarmored === 'monk') avert.push('La Défense sans armure du Moine ne s’applique pas avec un bouclier.');
        }
        if (bouclier) {
            sources.push(source(bouclier.name || 'Bouclier', entier(bouclier.base, 2) + (bouclier.isMagic ? entier(bouclier.magic, 0) : 0), 'objet'));
            if (!lecteur.forme(FORMATION.shield)) avert.push('Pas de formation au bouclier (module Maîtrises) : il n’apporte normalement pas son bonus.');
        }
        d.misc.forEach(m => { const v = entier(m.value, 0); if (v) sources.push(source(m.label || 'Bonus', v, 'manuel')); });
        const r = resultat('ca', 'Classe d’armure', sources, ctx, { auto: !!d.auto, armure: corps, bouclier });
        r.avertissements = avert;
        return r;
    }

    /** La CA telle que la fiche l'affiche : calculée si le widget est en automatique, sinon la saisie. */
    function caFiche(ctx) {
        const d = lecteur.armure();
        if (d && d.auto) return caArmure(d, ctx);
        const saisie = entier(lecteur.texte('armor-class'), NaN);
        const r = resultat('ca', 'Classe d’armure',
            isNaN(saisie) ? [] : [source('Saisie sur la fiche', saisie, 'manuel', true)], ctx, { auto: false });
        if (isNaN(saisie) && !r.sources.length) r.total = null;
        return r;
    }

    // ---------- Armes ----------
    /** Corps à corps, distance ou lancer : déclaré, sinon déduit des propriétés et de la portée. */
    function typeArme(atk) {
        if (atk.wtype) return atk.wtype;
        const props = String(atk.props || '');
        if (/lanc/i.test(props)) return 'thrown';
        if (/munition|portée/i.test(props)) return 'ranged';
        if (/\d\s*\/\s*\d/.test(String(atk.range || ''))) return 'ranged';
        return 'melee';
    }
    /** Caractéristique de l'arme, ou null si le toucher est saisi à la main. */
    function caracArme(atk) {
        const mode = atk.autoAbility || 'manual';
        if (mode === 'str' || mode === 'dex') return mode;
        const meilleure = () => (modificateur(lecteur.score('dex')) >= modificateur(lecteur.score('str')) ? 'dex' : 'str');
        if (mode === 'best') return meilleure();
        if (mode !== 'auto') return null;
        if (/finesse/i.test(String(atk.props || ''))) return meilleure();
        return typeArme(atk) === 'ranged' ? 'dex' : 'str';
    }
    /** { carac, type, toucher, degats } — toucher et degats valent null en saisie manuelle. */
    function arme(atk, ctx) {
        if (!atk) return null;
        const k = caracArme(atk), type = typeArme(atk);
        if (!k) return { carac: null, type, toucher: null, degats: null };
        const c = Object.assign({}, ctx, { arme: atk });
        const toucher = [sourceCarac(k)];
        if (!atk.noProf) toucher.push(source('maîtrise', lecteur.maitrise(), 'maitrise'));
        const bonusToucher = lireMod(atk.hitExtra || 0);
        if (bonusToucher) toucher.push(source('bonus de l’arme', bonusToucher, 'objet'));
        const degats = [sourceCarac(k)];
        const bonusDegats = lireMod(atk.dmgExtra || 0);
        if (bonusDegats) degats.push(source('bonus de l’arme', bonusDegats, 'objet'));
        const nom = atk.name || 'arme';
        return {
            carac: k, type,
            toucher: resultat('attaque', 'Attaque : ' + nom, toucher, c, { carac: k }),
            degats: resultat('degats', 'Dégâts : ' + nom, degats, c, { carac: k })
        };
    }

    // ---------- Point d'entrée ----------
    /**
     * cle : 'carac:dex' · 'competence:stealth' · 'sauvegarde:dex' · 'passif:perception'
     *       · 'initiative' · 'vitesse' · 'ca' · 'dd-sorts' · 'attaque-sorts' · 'mod-sorts'
     *       · 'attaque' / 'degats' (contexte { arme })
     */
    function valeur(cle, ctx) {
        const [genre, arg] = String(cle || '').split(':');
        switch (genre) {
            case 'carac': return CARACS.includes(arg) ? carac(arg, ctx) : null;
            case 'sauvegarde': return CARACS.includes(arg) ? competence('save-' + arg, ctx) : null;
            case 'competence': return arg ? competence(arg, ctx) : null;
            case 'passif': return arg ? passif(arg, ctx) : null;
            case 'initiative': return initiative(ctx);
            case 'vitesse': return vitesse(ctx);
            case 'ca': return caFiche(ctx);
            case 'dd-sorts': case 'attaque-sorts': case 'mod-sorts': return sorts(genre, ctx);
            case 'attaque': case 'degats': {
                const r = arme(ctx && ctx.arme, ctx);
                return r ? (genre === 'attaque' ? r.toucher : r.degats) : null;
            }
        }
        return null;
    }

    /** « +3 DEX · +2 maîtrise · +1 bonus de l’arme » — la réponse à « D'où vient ce chiffre ? ». */
    function detail(r) {
        if (!r || !Array.isArray(r.sources)) return '';
        return r.sources
            .filter(s => s.base || s.origine === 'carac' || s.valeur !== 0)
            .map(s => (s.base ? String(s.valeur) : signe(s.valeur)) + ' ' + s.libelle)
            .join(' · ');
    }

    window.Calcul = {
        ORIGINES, CARACS, ABREGE, NOM,
        modificateur, signe, lireMod,
        /** Le bonus de maîtrise lu sur la fiche. */
        maitrise: () => lecteur.maitrise(),
        valeur, detail, arme, typeArme, caracArme,
        ca: caArmure,
        /** Greffe une source : fn(cle, contexte, lecteur) → [{ libelle, valeur, origine }]. Renvoie de quoi la retirer. */
        fournisseur(fn) {
            if (typeof fn !== 'function') return () => {};
            fournisseurs.push(fn);
            return () => { const i = fournisseurs.indexOf(fn); if (i >= 0) fournisseurs.splice(i, 1); };
        },
        /** Remplace une partie de la lecture de la fiche (tests) ; sans argument, rétablit la lecture normale. */
        lecteur(partiel) { lecteur = partiel ? Object.assign({}, lecteurFiche, partiel) : lecteurFiche; }
    };
})();
