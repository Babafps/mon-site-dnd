// =====================================================
// multiclasse.js — plusieurs classes sur une seule fiche
//
// Chargé à la demande (charger.js) : la fiche ne le paie qu'au moment où le
// joueur ouvre la fenêtre des classes, ou monte de niveau.
//
// Le MODÈLE. Une fiche multiclassée garde la liste de ses classes dans la clé
// de personnage `dnd-classes` :
//     [{ id, nom, niveau, sousClasse, sousClasseId }, …]
// Le champ « Classe » de la fiche continue d'afficher « Guerrier 3 / Roublard 2 »
// et le champ « Niveau » la somme : l'export, l'impression, la carte de héros et
// l'accueil, qui lisent ces deux champs, n'ont rien à changer.
//
// MIGRATION SANS PERTE. Une fiche d'avant n'a pas `dnd-classes` : sa liste est
// alors DÉDUITE du texte du champ « Classe » et du niveau. Cette déduction n'est
// jamais écrite d'office — comme pour l'édition (edition.js), seul un geste du
// joueur enregistre. Tant qu'il ne touche à rien, la fiche reste exactement
// celle qu'il connaît, sur tous ses appareils.
//
// LES RÈGLES viennent du dépôt, jamais de la mémoire (règle 6). Tout est lu
// dans `data/srd/<édition>/fr/` :
//   · la table des emplacements d'incantateur multiclassé — structurée en 2024,
//     à plat dans le texte en 2014, reconstituée ici puis VÉRIFIÉE (20 lignes de
//     9 rangs, croissantes) ; au moindre doute on ne propose rien plutôt que de
//     proposer faux ;
//   · les prérequis — table dédiée en 2014, `primary_ability` de chaque classe
//     en 2024, avec le minimum (13) lu dans le texte de la règle ;
//   · l'arrondi de la moitié des niveaux de Paladin et de Rôdeur, qui change
//     d'une édition à l'autre : lu dans la phrase elle-même ;
//   · les maîtrises de multiclassage — table dédiée en 2014. La 2024 renvoie à
//     la description de chaque classe, que le SRD ne détaille pas : on affiche
//     alors les maîtrises de départ, en le disant.
//
// Ce module PROPOSE, il n'impose pas : les emplacements calculés ne remplacent
// ceux de la fiche que si le joueur clique dessus. Une saisie manuelle (objet,
// don, règle maison) n'est jamais écrasée en silence.
// =====================================================
(function () {
    'use strict';

    const CLE = 'dnd-classes';
    const MAX_CLASSES = 6;          // au-delà, ce n'est plus une fiche, c'est une farce

    const CARACS = {
        force: 'str', dexterite: 'dex', constitution: 'con',
        intelligence: 'int', sagesse: 'wis', charisme: 'cha'
    };
    const NOM_CARAC = {
        str: 'Force', dex: 'Dextérité', con: 'Constitution',
        int: 'Intelligence', wis: 'Sagesse', cha: 'Charisme'
    };

    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const entier = (v, d) => { const n = parseInt(v, 10); return isNaN(n) ? (d || 0) : n; };
    /** Comparaison insensible aux accents, à la casse et aux espaces. */
    const plier = (s) => String(s == null ? '' : s).normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, "'").trim().toLowerCase();

    const champ = (id) => String(($(id) || {}).value || '');
    const poser = (id, valeur, evenements) => {
        const el = $(id);
        if (!el || String(el.value) === String(valeur)) return false;
        el.value = valeur;
        (evenements || ['input']).forEach(t => el.dispatchEvent(new Event(t, { bubbles: true })));
        return true;
    };
    const lire  = (cle) => (window.SheetStore && window.SheetStore.get) ? window.SheetStore.get(cle) : null;
    const ecrire = (cle, v) => { if (window.SheetStore && window.SheetStore.set) window.SheetStore.set(cle, v); };

    // =====================================================
    // 1. LE MODÈLE — la liste des classes du personnage
    // =====================================================

    function normaliser(x) {
        if (!x) return null;
        const nom = String(x.nom || x.name || '').trim();
        if (!nom) return null;
        return {
            id: String(x.id || '') || null,
            nom,
            niveau: Math.max(1, Math.min(20, entier(x.niveau != null ? x.niveau : x.level, 1))),
            sousClasse: String(x.sousClasse || x.subclass || '').trim(),
            sousClasseId: String(x.sousClasseId || '') || null
        };
    }

    /** « Guerrier 3 / Roublard 2 », « Magicien », « Barde 5 » → liste de classes.
     *  C'est la migration des fiches d'avant : rien n'est perdu, même un nom
     *  inconnu des règles (classe maison tapée à la main) devient une entrée. */
    function analyserTexte(texte, niveauTotal) {
        const brut = String(texte || '').trim();
        if (!brut) return [];
        const morceaux = brut.split(/\s*(?:\/|\||,|·|;)\s*/).map(s => s.trim()).filter(Boolean);
        const out = [];
        morceaux.forEach(m => {
            // Le niveau peut être collé au nom : « Guerrier 3 », « Guerrier niv. 3 ».
            const r = /^(.*?)[\s,]*(?:niv\.?|niveau)?\s*(\d{1,2})\s*$/i.exec(m);
            const nom = (r ? r[1] : m).trim().replace(/[\s,]+$/, '');
            if (!nom) return;
            out.push({ nom, niveau: r ? Math.max(1, Math.min(20, entier(r[2], 1))) : 0 });
        });
        if (!out.length) return [];
        // Une seule classe sans chiffre : elle porte tout le niveau du personnage.
        const sansChiffre = out.filter(c => !c.niveau);
        if (sansChiffre.length === 1 && out.length === 1) {
            out[0].niveau = Math.max(1, Math.min(20, entier(niveauTotal, 1)));
        } else {
            // Plusieurs classes dont certaines sans chiffre : on répartit ce qui
            // reste, à parts égales, plutôt que de perdre la classe.
            const connu = out.reduce((t, c) => t + c.niveau, 0);
            const reste = Math.max(0, entier(niveauTotal, 1) - connu);
            const part = sansChiffre.length ? Math.max(1, Math.floor(reste / sansChiffre.length)) : 0;
            sansChiffre.forEach(c => { c.niveau = Math.max(1, part); });
        }
        return out.slice(0, MAX_CLASSES).map(normaliser).filter(Boolean);
    }

    /** La liste des classes : celle qui est enregistrée, sinon celle qu'on déduit
     *  de la fiche. Cette déduction n'est jamais écrite toute seule. */
    function liste() {
        const brut = lire(CLE);
        if (Array.isArray(brut) && brut.length) {
            const l = brut.map(normaliser).filter(Boolean).slice(0, MAX_CLASSES);
            if (l.length) return l;
        }
        const l = analyserTexte(champ('char-class'), entier(champ('char-level'), 1));
        // La sous-classe de la fiche appartient à la première classe.
        const sub = champ('char-subclass').trim();
        if (l.length && sub && !l[0].sousClasse) l[0].sousClasse = sub;
        return l;
    }

    /** Vrai si la liste est déjà enregistrée (et pas seulement déduite). */
    const enregistree = () => Array.isArray(lire(CLE)) && (lire(CLE) || []).length > 0;

    const total = (l) => (l || liste()).reduce((t, c) => t + c.niveau, 0);
    const multi  = (l) => (l || liste()).length > 1;

    /** « Guerrier 3 / Roublard 2 » — et simplement « Guerrier » quand il n'y a
     *  qu'une classe, pour ne rien changer aux fiches qui n'ont pas bougé. */
    function texte(l) {
        const c = l || liste();
        if (!c.length) return '';
        if (c.length === 1) return c[0].nom;
        return c.map(x => `${x.nom} ${x.niveau}`).join(' / ');
    }

    /** Enregistre la liste ET remet la fiche d'accord avec elle (champ Classe,
     *  champ Niveau, sous-classe de la classe principale). */
    function definir(l) {
        const propre = (l || []).map(normaliser).filter(Boolean).slice(0, MAX_CLASSES);
        if (!propre.length) return false;
        ecrire(CLE, propre);
        poser('char-class', texte(propre));
        poser('char-level', total(propre));
        poser('char-subclass', propre[0].sousClasse || '', ['input', 'change']);
        try {
            document.dispatchEvent(new CustomEvent('classes:change', { detail: { classes: propre } }));
        } catch (e) { /* un navigateur sans CustomEvent ne bloque pas l'écriture */ }
        return true;
    }

    // =====================================================
    // 2. LES RÈGLES — lues dans data/srd/, vérifiées, jamais devinées
    // =====================================================

    const cacheTables = new Map();      // édition → promesse

    const editionSRD = () => (window.SRD && window.SRD.getEdition) ? window.SRD.getEdition() : '2024';

    function parcourir(n, visite) {
        if (!n || typeof n !== 'object') return;
        visite(n);
        (n.children || []).forEach(c => parcourir(c, visite));
    }
    /** Tous les paragraphes de texte d'un nœud et de sa descendance. */
    function paragraphes(racine) {
        const out = [];
        parcourir(racine, n => (n.content || []).forEach(c => { if (typeof c === 'string') out.push(c); }));
        return out;
    }

    // ---------- 2a. Table des emplacements d'incantateur multiclassé ----------

    /** Une grille brute (20 lignes de 10 cellules) → [null, {1:2}, {1:3}, …].
     *  Refuse tout ce qui ne ressemble pas à la table officielle : mieux vaut ne
     *  rien proposer que proposer des emplacements faux. */
    function grilleValide(lignes) {
        if (!Array.isArray(lignes) || lignes.length !== 20) return null;
        const out = [null];
        let precedent = 0;
        for (let i = 0; i < 20; i++) {
            const ligne = (lignes[i] || []).map(x => String(x == null ? '' : x).trim());
            if (ligne.length !== 10) return null;
            if (entier(ligne[0], -1) !== i + 1) return null;          // colonne « Niveau »
            const rangs = {};
            let somme = 0;
            for (let r = 1; r <= 9; r++) {
                const cellule = ligne[r];
                if (/^[—–-]+$/.test(cellule) || cellule === '') continue;
                const n = entier(cellule, -1);
                if (n < 0 || n > 9) return null;
                if (n) { rangs[r] = n; somme += n; }
            }
            if (somme < precedent) return null;                       // le total ne redescend jamais
            precedent = somme;
            out.push(rangs);
        }
        // Le premier niveau donne des emplacements, le vingtième plus que le premier.
        if (!out[1] || !out[1][1] || !out[20] || !out[20][9]) return null;
        return out;
    }

    /** Le texte à plat du PDF 2014 : « Niveau 1er 2e … 1 2 ———————— 2 3 … ».
     *  Les tirets peuvent être collés les uns aux autres : on les redéploie. */
    function grilleDepuisTexte(brut) {
        const sansEntete = String(brut || '').replace(/Niveau(?:\s+\d+\s*(?:er|e|re)\b)+/gi, ' ');
        const cellules = [];
        sansEntete.trim().split(/\s+/).forEach(jeton => {
            if (/^[—–-]+$/.test(jeton)) { for (let i = 0; i < jeton.length; i++) cellules.push('—'); }
            else if (jeton) cellules.push(jeton);
        });
        if (cellules.length !== 200) return null;
        const lignes = [];
        for (let i = 0; i < 20; i++) lignes.push(cellules.slice(i * 10, i * 10 + 10));
        return grilleValide(lignes);
    }

    function tableEmplacements(racine) {
        // 1) Une vraie table structurée (2024) : en-têtes « Niveau », 1 à 9.
        let lignes = null;
        parcourir(racine, n => (n.content || []).forEach(c => {
            if (lignes || !c || typeof c !== 'object' || !c.table) return;
            const h = (c.table.headers || []).map(x => String(x).trim());
            if (h.length !== 10 || !/niveau/i.test(h[0])) return;
            if (h.slice(1).join(',') !== '1,2,3,4,5,6,7,8,9') return;
            lignes = c.table.rows;
        }));
        if (lignes) { const g = grilleValide(lignes); if (g) return g; }

        // 2) Le texte à plat (2014), sous le titre qui l'annonce.
        let brut = '';
        parcourir(racine, n => {
            if (brut || !/emplacements?\s+par\s+niveau\s+de\s+sort/i.test(n.name || '')) return;
            brut = (n.content || []).filter(c => typeof c === 'string').join(' ');
        });
        return brut ? grilleDepuisTexte(brut) : null;
    }

    // ---------- 2b. Arrondi de la moitié des niveaux ----------

    /** 2014 « arrondir à l'inférieur », 2024 « arrondir au supérieur ». La phrase
     *  elle-même tranche : aucune des deux valeurs n'est écrite ici en dur. */
    function arrondiDemi(racine) {
        const t = paragraphes(racine).join(' ');
        if (/moiti[ée][^.]{0,80}arrondir\s+au\s+sup[ée]rieur/i.test(t)) return 'sup';
        if (/moiti[ée][^.]{0,80}arrondir\s+[àa]\s+l[’']inf[ée]rieur/i.test(t)) return 'inf';
        if (/arrondir\s+au\s+sup[ée]rieur/i.test(t)) return 'sup';
        if (/arrondir\s+[àa]\s+l[’']inf[ée]rieur/i.test(t)) return 'inf';
        return null;
    }

    // ---------- 2c. Prérequis ----------

    /** « Force 13 ou Dextérité 13 », « Dextérité et Sagesse » → { mode, caracs, valeur } */
    function analyserPrerequis(txt, minimumParDefaut) {
        const s = String(txt || '');
        const caracs = [];
        let valeur = 0;
        const rx = /(Force|Dext[ée]rit[ée]|Constitution|Intelligence|Sagesse|Charisme)\s*(\d{1,2})?/gi;
        let m;
        while ((m = rx.exec(s))) {
            const k = CARACS[plier(m[1])];
            if (k && caracs.indexOf(k) === -1) caracs.push(k);
            if (m[2]) valeur = Math.max(valeur, entier(m[2], 0));
        }
        if (!caracs.length) return null;
        const mode = /\bou\b/i.test(s) ? 'ou' : 'et';
        return { mode, caracs, valeur: valeur || entier(minimumParDefaut, 0) };
    }

    /** La valeur minimale exigée, lue dans le texte de la règle (13). */
    function minimumPrerequis(racine) {
        let valeur = 0;
        parcourir(racine, n => {
            if (valeur || !/pr[ée]requis/i.test(n.name || '')) return;
            const t = (n.content || []).filter(c => typeof c === 'string').join(' ');
            const m = /valeur\s+(?:minimale\s+)?de\s+(\d{1,2})\b/i.exec(t) || /\b(\d{1,2})\b/.exec(t);
            if (m) valeur = entier(m[1], 0);
        });
        return valeur;
    }

    /** La table « Prérequis de multiclassage » (2014) : deux lignes à plat,
     *  les noms de classes d'un côté, les valeurs de l'autre, dans le même ordre. */
    function prerequisDepuisTable(racine) {
        let noeud = null;
        parcourir(racine, n => {
            if (!noeud && /pr[ée]requis\s+de\s+multiclassage/i.test(n.name || '')) noeud = n;
        });
        if (!noeud) return null;
        const lignes = (noeud.content || []).filter(c => typeof c === 'string');
        if (lignes.length < 2) return null;
        const noms = lignes.slice(0, -1).join(' ').replace(/^\s*Classe\s+/i, '').trim().split(/\s+/);
        const valeurs = lignes[lignes.length - 1].replace(/^\s*Valeur[^A-ZÀ-Ý]*/i, '');
        const rx = /(Force|Dext[ée]rit[ée]|Constitution|Intelligence|Sagesse|Charisme)\s+(\d{1,2})(?:\s+(ou|et)\s+(Force|Dext[ée]rit[ée]|Constitution|Intelligence|Sagesse|Charisme)\s+(\d{1,2}))?/gi;
        const trouves = [];
        let m;
        while ((m = rx.exec(valeurs))) trouves.push(m[0]);
        if (!noms.length || noms.length !== trouves.length) return null;   // désaccord : on n'invente pas
        const map = new Map();
        noms.forEach((nom, i) => {
            const p = analyserPrerequis(trouves[i], 0);
            if (p) map.set(plier(nom), p);
        });
        return map.size === noms.length ? map : null;
    }

    // ---------- 2d. Maîtrises de multiclassage ----------

    /** La table « Maîtrises de multiclassage » (2014) : les noms de classes
     *  répartis sur plusieurs lignes, puis une seule ligne qui les enchaîne. */
    function maitrisesDepuisTable(racine) {
        let noeud = null;
        parcourir(racine, n => {
            if (!noeud && /ma[îi]trises\s+de\s+multiclassage/i.test(n.name || '')) noeud = n;
        });
        if (!noeud) return null;
        const lignes = (noeud.content || []).filter(c => typeof c === 'string');
        if (lignes.length < 2) return null;
        const noms = lignes.slice(0, -1).join(' ').replace(/^\s*Classe\s+/i, '').trim().split(/\s+/);
        const brut = lignes[lignes.length - 1].replace(/^\s*Ma[îi]trises\s+acquises\s+/i, '');
        // Chaque entrée commence par un mot capitalisé (Bouclier, Armures, Armes)
        // ou par un tiret pour « rien ». C'est la seule frontière que le PDF laisse.
        const parts = brut.split(/(?=(?:Bouclier |Armures |Armes |[—–] ))/)
            .map(s => s.trim()).filter(s => s.length);
        if (!noms.length || noms.length !== parts.length) return null;
        const map = new Map();
        noms.forEach((nom, i) => map.set(plier(nom), parts[i]));
        return map;
    }

    // ---------- 2e. Assemblage ----------

    async function construire() {
        const ed = editionSRD();
        const t = {
            edition: ed, racine: null,
            emplacements: null, arrondi: null,
            prerequis: null, prerequisSource: null, minimum: 0,
            maitrises: null,
            avertissements: []
        };
        if (!window.SRD || !window.SRD.entry) {
            t.avertissements.push('La base de règles n’est pas chargée : rien ne peut être calculé.');
            return t;
        }
        let racine = null;
        try { racine = await window.SRD.entry('rules', 'multiclassage'); }
        catch (e) { racine = null; }
        if (!racine) {
            t.avertissements.push('La section « Multiclassage » est introuvable dans les règles '
                + (ed === '2024' ? '2024' : '2014') + ' : les emplacements ne sont pas calculés.');
            return t;
        }
        t.racine = racine;

        t.emplacements = tableEmplacements(racine);
        if (!t.emplacements) {
            t.avertissements.push('La table « Incantateur multiclassé » n’a pas pu être relue '
                + 'telle quelle : les emplacements ne sont pas proposés. Saisis-les à la main.');
        }

        t.arrondi = arrondiDemi(racine);
        if (!t.arrondi) {
            t.avertissements.push('La règle d’arrondi des demi-lanceurs n’a pas été retrouvée : '
                + 'les niveaux de Paladin et de Rôdeur ne sont pas comptés.');
        }

        t.minimum = minimumPrerequis(racine);
        const parTable = prerequisDepuisTable(racine);
        if (parTable) { t.prerequis = parTable; t.prerequisSource = 'table'; }
        else {
            // 2024 : la caractéristique principale de chaque classe fait foi.
            const map = new Map();
            try {
                (await window.SRD.category('classes')).forEach(c => {
                    if (!c || !c.primary_ability) return;
                    const p = analyserPrerequis(c.primary_ability, t.minimum);
                    if (p) map.set(plier(c.name), p);
                });
            } catch (e) { /* liste indisponible : on le dira plus bas */ }
            if (map.size) { t.prerequis = map; t.prerequisSource = 'classe'; }
            else t.avertissements.push('Les prérequis de multiclassage ne sont pas lisibles dans '
                + 'cette édition : vérifie-les toi-même.');
        }

        t.maitrises = maitrisesDepuisTable(racine);
        return t;
    }

    function tables() {
        const ed = editionSRD();
        if (!cacheTables.has(ed)) {
            const p = construire().catch(e => { cacheTables.delete(ed); throw e; });
            cacheTables.set(ed, p);
        }
        return cacheTables.get(ed);
    }
    // Changer d'édition change les règles : le cache est par édition, mais la
    // fenêtre ouverte, elle, doit être refaite.
    document.addEventListener('edition:change', () => { fermerSiOuverte(); });

    // =====================================================
    // 3. LES CALCULS
    // =====================================================

    /** Retrouve la fiche de règle d'une classe d'après son nom saisi.
     *  Renvoie une Map(plier(nom) → entrée SRD ou perso). */
    async function catalogue() {
        try { return await window.SRD.category('classes'); }
        catch (e) { return []; }
    }
    function trouverClasse(cat, entree) {
        if (!entree) return null;
        if (entree.id) { const parId = cat.find(c => c.id === entree.id); if (parId) return parId; }
        const q = plier(entree.nom);
        if (!q) return null;
        let meilleur = null, longueur = 0;
        cat.forEach(c => {
            const f = plier(c.name);
            if (f && (q === f || q.indexOf(f) !== -1) && f.length > longueur) { meilleur = c; longueur = f.length; }
        });
        return meilleur;
    }

    /** Le niveau d'incantateur à porter dans la table multiclassée.
     *  Les classes comptées sont celles que les données déclarent : `full` en
     *  entier, `half` pour moitié. La magie de pacte a sa propre réserve et
     *  n'entre pas ici — c'est ce que dit la règle. */
    function niveauIncantateur(entrees, cat, t) {
        let entierNiv = 0, demi = 0, tiers = 0;
        const notes = [];
        entrees.forEach(e => {
            const cls = trouverClasse(cat, e);
            const type = (cls && cls.spellcasting && cls.spellcasting.type) || null;
            if (type === 'full') entierNiv += e.niveau;
            else if (type === 'half') demi += e.niveau;
            else if (type === 'third') { tiers += e.niveau; notes.push(e.nom); }
        });
        if (!t.arrondi) return { niveau: entierNiv, notes, demiIgnore: demi > 0 || tiers > 0 };
        const arr = t.arrondi === 'sup' ? Math.ceil : Math.floor;
        return { niveau: entierNiv + arr(demi / 2) + arr(tiers / 3), notes, demiIgnore: false };
    }

    /** La magie de pacte : elle vient de la table de SA classe, pas de la table
     *  multiclassée. Le niveau qui compte est celui de cette classe seule. */
    function magieDePacte(entrees, cat) {
        let meilleur = null;
        entrees.forEach(e => {
            const cls = trouverClasse(cat, e);
            if (!cls || !cls.spellcasting || cls.spellcasting.type !== 'pact') return;
            const inf = window.SRD.levelInfo(cls, e.niveau, null);
            const cs = inf && inf.class_specific;
            if (!cs || !entier(cs.spell_slots_count, 0)) return;
            const p = { classe: cls.name, rang: entier(cs.slot_level, 1), nombre: entier(cs.spell_slots_count, 0) };
            if (!meilleur || p.rang > meilleur.rang) meilleur = p;
        });
        return meilleur;
    }

    /** Les dés de vie, regroupés par taille : « 3d10 + 2d8 ». */
    function desDeVie(entrees, cat) {
        const parDe = new Map();
        const inconnues = [];
        entrees.forEach(e => {
            const cls = trouverClasse(cat, e);
            const de = cls && entier(cls.hit_die, 0);
            if (!de) { inconnues.push(e.nom); return; }
            parDe.set(de, (parDe.get(de) || 0) + e.niveau);
        });
        const groupes = [...parDe.entries()].sort((a, b) => b[0] - a[0])
            .map(([de, n]) => ({ de, nombre: n }));
        return { groupes, texte: groupes.map(g => `${g.nombre}d${g.de}`).join(' + '), inconnues };
    }

    /** Ce que les règles proposent comme emplacements pour cette liste de classes. */
    async function proposition(entrees) {
        const l = (entrees && entrees.length) ? entrees : liste();
        const t = await tables();
        const cat = await catalogue();
        const inc = niveauIncantateur(l, cat, t);
        const pacte = magieDePacte(l, cat);
        const avert = t.avertissements.slice();
        if (inc.demiIgnore) avert.push('Les demi-lanceurs ne sont pas comptés faute de règle d’arrondi lisible.');
        if (inc.notes.length) avert.push(`Les tiers-lanceurs (${inc.notes.join(', ')}) ne figurent pas dans la `
            + 'table officielle : ils sont comptés au tiers, à vérifier avec ton MJ.');
        const parRang = (t.emplacements && inc.niveau >= 1 && inc.niveau <= 20)
            ? Object.assign({}, t.emplacements[inc.niveau]) : null;
        return {
            edition: t.edition,
            niveauIncantateur: inc.niveau,
            parRang, pacte,
            arrondi: t.arrondi,
            desDeVie: desDeVie(l, cat),
            avertissements: avert
        };
    }

    /** Les prérequis manquants, d'après les caractéristiques de la fiche.
     *  La règle exige la valeur dans CHAQUE classe que l'on cumule. */
    async function prerequisManquants(entrees) {
        const l = (entrees && entrees.length) ? entrees : liste();
        if (l.length < 2) return [];                 // une seule classe : rien à remplir
        const t = await tables();
        if (!t.prerequis) return [];
        const score = (k) => entier(champ('stat-' + k), 10) || 10;
        const out = [];
        l.forEach(e => {
            const p = t.prerequis.get(plier(e.nom))
                || [...t.prerequis.entries()].filter(([n]) => plier(e.nom).indexOf(n) !== -1)
                    .sort((a, b) => b[0].length - a[0].length).map(([, v]) => v)[0];
            if (!p) return;                          // classe maison : aucun prérequis connu
            const ok = p.mode === 'ou'
                ? p.caracs.some(k => score(k) >= p.valeur)
                : p.caracs.every(k => score(k) >= p.valeur);
            if (ok) return;
            const detail = p.caracs.map(k => `${NOM_CARAC[k]} ${p.valeur} (tu as ${score(k)})`)
                .join(p.mode === 'ou' ? ' ou ' : ' et ');
            out.push(`${e.nom} demande ${detail}.`);
        });
        return out;
    }

    /** Les maîtrises gagnées en prenant une classe en cours de route. */
    async function maitrisesDe(entree) {
        const t = await tables();
        const cat = await catalogue();
        const cls = trouverClasse(cat, entree);
        if (t.maitrises) {
            const direct = t.maitrises.get(plier(entree.nom))
                || (cls ? t.maitrises.get(plier(cls.name)) : null);
            if (direct) return { texte: direct, source: 'multiclassage' };
        }
        // La 2024 renvoie à la description de la classe, que le SRD ne détaille
        // pas côté multiclassage : on montre les maîtrises de départ, en le disant.
        const p = cls && cls.proficiencies;
        if (!p) return null;
        const bouts = [];
        if (p.armor) bouts.push('Armures : ' + p.armor);
        if (p.weapons) bouts.push('Armes : ' + p.weapons);
        if (p.tools) bouts.push('Outils : ' + p.tools);
        return bouts.length ? { texte: bouts.join(' · '), source: 'depart' } : null;
    }

    // =====================================================
    // 4. LA FENÊTRE — gérer les classes
    // =====================================================

    let stylesPoses = false;
    const CSS = `
    .mc-liste { display: flex; flex-direction: column; gap: 9px; margin: 0 0 12px; }
    .mc-ligne { display: grid; grid-template-columns: minmax(0,1fr) 74px 34px; gap: 8px; align-items: start; }
    .mc-ligne .mc-sous { grid-column: 1 / -1; }
    .mc-ligne input { font: inherit; font-size: .95rem; width: 100%; box-sizing: border-box; padding: 8px 10px;
        border-radius: 9px; border: 1px solid rgba(122,40,40,.32); background: rgba(255,255,255,.78); color: inherit; }
    .mc-ligne input:focus-visible { outline: 2px solid var(--accent-color,#C49B35); outline-offset: 1px; }
    .mc-ligne .mc-niv { text-align: center; }
    .mc-sup { min-height: 38px; border-radius: 9px; cursor: pointer; font-size: 1rem; line-height: 1;
        color: #8a1c1c; background: transparent; border: 1px solid rgba(122,40,40,.28); }
    .mc-sup:disabled { opacity: .3; cursor: not-allowed; }
    .mc-ajout { width: 100%; min-height: 42px; margin: 0 0 12px; border-radius: 10px; cursor: pointer;
        font-family: 'Cinzel', Georgia, serif; font-size: .86rem; color: var(--primary-color,#7A2828);
        background: transparent; border: 1px dashed rgba(122,40,40,.45); }
    .mc-ajout:disabled { opacity: .4; cursor: not-allowed; }
    .mc-bilan { font-family: 'Lora', Georgia, serif; font-size: .9rem; line-height: 1.55;
        padding: 10px 12px; border-radius: 10px; background: rgba(122,40,40,.07);
        border: 1px solid rgba(122,40,40,.18); }
    .mc-bilan b { font-family: 'Cinzel', Georgia, serif; font-size: .82rem; letter-spacing: .04em; }
    .mc-bilan p { margin: 0 0 5px; }
    .mc-bilan p:last-child { margin-bottom: 0; }
    .mc-gemmes { display: flex; flex-wrap: wrap; gap: 5px; margin: 3px 0 7px; }
    .mc-gemme { font-size: .8rem; padding: 2px 8px; border-radius: 999px;
        background: rgba(196,155,53,.2); border: 1px solid rgba(196,155,53,.5); }
    .mc-appliquer { min-height: 40px; width: 100%; margin-top: 6px; border-radius: 9px; cursor: pointer;
        font-family: 'Cinzel', Georgia, serif; font-size: .84rem; color: var(--accent-color,#C49B35);
        background: linear-gradient(180deg, var(--primary-hover,#9c3333), var(--primary-color,#7A2828));
        border: 1px solid rgba(196,155,53,.45); }
    .mc-alerte { margin: 8px 0 0; padding: 8px 10px; border-radius: 9px; font-size: .86rem; line-height: 1.5;
        color: #7a2020; background: rgba(179,50,44,.1); border: 1px solid rgba(179,50,44,.3); }
    .mc-alerte p { margin: 0 0 4px; } .mc-alerte p:last-child { margin-bottom: 0; }
    .mc-note { margin: 6px 0 0; font-size: .82rem; opacity: .75; line-height: 1.45; }
    body.theme-dark .mc-ligne input { background: rgba(255,255,255,.06); border-color: rgba(196,155,53,.3); }
    body.theme-dark .mc-bilan { background: rgba(196,155,53,.08); border-color: rgba(196,155,53,.22); }
    body.theme-dark .mc-alerte { color: #ffb4a8; background: rgba(179,50,44,.16); }
    body.theme-dark .mc-sup { color: #ff9b8f; border-color: rgba(196,155,53,.3); }
    body.theme-dark .mc-ajout, body.theme-dark .mc-bilan b { color: var(--accent-color,#C49B35); }
    @media (max-width: 700px) { .mc-ligne { grid-template-columns: minmax(0,1fr) 66px 34px; } }
    @media (prefers-reduced-motion: reduce) { .mc-ligne, .mc-bilan { transition: none !important; } }
    @media print { .mc-liste, .mc-bilan { display: none !important; } }`;

    function styles() {
        if (stylesPoses) return;
        stylesPoses = true;
        const s = document.createElement('style');
        s.id = 'multiclasse-styles';
        s.textContent = CSS;
        document.head.appendChild(s);
    }

    let fenetreOuverte = false;
    function fermerSiOuverte() {
        if (!fenetreOuverte) return;
        const b = document.querySelector('.dlg-voile:not(.sort) [data-dlg="annuler"]');
        if (b) b.click();
    }

    /** La fenêtre de gestion des classes. Rend true si quelque chose a changé. */
    async function ouvrir() {
        if (fenetreOuverte) return false;
        if (!window.Dialogue || !window.Dialogue.fenetre) return false;
        styles();
        fenetreOuverte = true;

        const cat = await catalogue();
        let brouillon = liste().map(c => Object.assign({}, c));
        if (!brouillon.length) brouillon = [{ id: null, nom: '', niveau: 1, sousClasse: '', sousClasseId: null }];

        let corps = null, redessiner = null;
        const idListe = 'mc-datalist-classes';

        const lireBrouillon = () => {
            if (!corps) return;
            [...corps.querySelectorAll('.mc-ligne')].forEach((ligne, i) => {
                if (!brouillon[i]) return;
                const nom = ligne.querySelector('.mc-nom').value.trim();
                if (plier(nom) !== plier(brouillon[i].nom)) { brouillon[i].id = null; brouillon[i].sousClasseId = null; }
                brouillon[i].nom = nom;
                brouillon[i].niveau = Math.max(1, Math.min(20, entier(ligne.querySelector('.mc-niv').value, 1)));
                const sous = ligne.querySelector('.mc-sous');
                brouillon[i].sousClasse = sous ? sous.value.trim() : '';
                // L'identifiant suit le nom tant qu'il désigne bien la même classe.
                const cls = trouverClasse(cat, brouillon[i]);
                brouillon[i].id = cls ? cls.id : null;
                // La reconnaissance de la sous-classe passe par le meme lecteur que
                // la montee de niveau : « Ecole d'evocation » retrouve « Ecole de l'Evocation ».
                if (cls && brouillon[i].sousClasse && window.SRD && window.SRD.subclassByName) {
                    const s = window.SRD.subclassByName(cls, brouillon[i].sousClasse);
                    brouillon[i].sousClasseId = s ? s.id : null;
                }
            });
        };

        const ligneHtml = (c, i) => {
            const cls = trouverClasse(cat, c);
            const sousOpts = (cls && (cls.subclasses || []).length)
                ? `<datalist id="mc-sous-${i}">${(cls.subclasses || [])
                    .map(s => `<option value="${esc(s.name)}"></option>`).join('')}</datalist>` : '';
            return `<div class="mc-ligne" data-i="${i}">
                <input class="mc-nom" list="${idListe}" value="${esc(c.nom)}"
                       placeholder="Classe" aria-label="Classe ${i + 1}" autocomplete="off">
                <input class="mc-niv" type="number" min="1" max="20" value="${entier(c.niveau, 1)}"
                       aria-label="Niveau de la classe ${i + 1}">
                <button type="button" class="mc-sup" data-sup="${i}"
                        title="Retirer cette classe" aria-label="Retirer la classe ${i + 1}"
                        ${brouillon.length <= 1 ? 'disabled' : ''}>✕</button>
                <input class="mc-sous" list="mc-sous-${i}" value="${esc(c.sousClasse)}"
                       placeholder="Sous-classe (facultatif)" aria-label="Sous-classe de ${esc(c.nom || 'la classe ' + (i + 1))}"
                       autocomplete="off">${sousOpts}
            </div>`;
        };

        const bilanHtml = async () => {
            const prop = await proposition(brouillon.filter(c => c.nom));
            const manques = await prerequisManquants(brouillon.filter(c => c.nom));
            const niv = total(brouillon.filter(c => c.nom));
            const maitrise = Math.floor((Math.max(1, niv) - 1) / 4) + 2;
            const rangs = prop.parRang ? Object.keys(prop.parRang).map(Number).sort((a, b) => a - b) : [];

            let html = `<p><b>Niveau ${niv}</b> · maîtrise +${maitrise}`;
            if (prop.desDeVie.texte) html += ` · dés de vie ${esc(prop.desDeVie.texte)}`;
            html += '</p>';
            if (prop.desDeVie.inconnues.length) {
                html += `<p class="mc-note">Dé de vie inconnu pour ${esc(prop.desDeVie.inconnues.join(', '))}
                    — renseigne-le dans le bloc Repos.</p>`;
            }
            if (rangs.length) {
                html += `<p><b>Emplacements proposés</b> — incantateur de niveau ${prop.niveauIncantateur}</p>
                    <div class="mc-gemmes">${rangs.map(r =>
                        `<span class="mc-gemme">niv. ${r} × ${prop.parRang[r]}</span>`).join('')}</div>`;
            } else if (prop.niveauIncantateur > 0) {
                html += `<p class="mc-note">Aucun emplacement à proposer pour cette combinaison.</p>`;
            }
            if (prop.pacte) {
                html += `<p><b>Magie de pacte</b> — ${prop.pacte.nombre} emplacement${prop.pacte.nombre > 1 ? 's' : ''}
                    de niveau ${prop.pacte.rang} (${esc(prop.pacte.classe)}), réserve à part.</p>`;
            }
            if (rangs.length || prop.pacte) {
                html += `<button type="button" class="mc-appliquer">⬦ Appliquer ces emplacements à la fiche</button>
                    <p class="mc-note">Rien n’est écrit tant que tu ne cliques pas. Les emplacements
                    que tu as réglés toi-même seront remplacés par ceux-ci.</p>`;
            }
            // Les maîtrises que le multiclassage accorde : seulement pour les
            // classes prises en cours de route, la première donnant tout.
            const secondaires = brouillon.filter(c => c.nom).slice(1);
            if (secondaires.length) {
                const lots = [];
                for (const c of secondaires) {
                    const m = await maitrisesDe(c);
                    if (m) lots.push({ nom: c.nom, texte: m.texte, source: m.source });
                }
                if (lots.length) {
                    html += `<p><b>Maîtrises gagnées en multiclassant</b></p>`
                        + lots.map(l => `<p class="mc-note"><b>${esc(l.nom)}</b> — ${esc(l.texte)}`
                            + (l.source === 'depart'
                                ? ' <i>(maîtrises de départ de la classe : le SRD 2024 renvoie à sa description '
                                  + 'sans détailler ce que le multiclassage en retire — vérifie avec ton MJ)</i>' : '')
                            + '</p>').join('')
                        + `<p class="mc-note">Coche-les toi-même dans le module « Maîtrises & Outils » : la fiche
                            ne décide pas à ta place de ce que tu sais faire.</p>`;
                }
            }
            const alertes = manques.concat(prop.avertissements);
            if (alertes.length) {
                html += `<div class="mc-alerte">${alertes.map(a => `<p>⚠ ${esc(a)}</p>`).join('')}</div>`;
            }
            return { html, prop };
        };

        let derniereProp = null;
        const majBilan = async () => {
            if (!corps) return;
            const boite = corps.querySelector('.mc-bilan');
            if (!boite) return;
            boite.setAttribute('aria-busy', 'true');
            const { html, prop } = await bilanHtml();
            derniereProp = prop;
            boite.innerHTML = html;
            boite.removeAttribute('aria-busy');
        };

        redessiner = (garderFocus) => {
            if (!corps) return;
            const zone = corps.querySelector('.mc-liste');
            zone.innerHTML = brouillon.map(ligneHtml).join('');
            corps.querySelector('.mc-ajout').disabled = brouillon.length >= MAX_CLASSES;
            if (garderFocus != null) {
                const el = zone.querySelector(`.mc-ligne[data-i="${garderFocus}"] .mc-nom`);
                if (el) el.focus();
            }
            majBilan();
        };

        const resultat = await window.Dialogue.fenetre({
            titre: 'Les classes de ce héros',
            icone: '⚔',
            message: 'Ajoute une classe pour multiclasser. Le champ « Classe » de la fiche et le '
                   + 'niveau total suivent tout seuls.',
            large: true,
            confirmer: 'Enregistrer',
            annuler: 'Annuler',
            annule: null,
            corps() {
                corps = document.createElement('div');
                corps.innerHTML = `
                    <datalist id="${idListe}">${cat.map(c => `<option value="${esc(c.name)}"></option>`).join('')}</datalist>
                    <div class="mc-liste"></div>
                    <button type="button" class="mc-ajout">➕ Ajouter une classe</button>
                    <div class="mc-bilan" role="status" aria-live="polite"></div>`;

                corps.addEventListener('input', (e) => {
                    if (!e.target.closest('.mc-ligne')) return;
                    lireBrouillon();
                    // Changer de classe change la liste des sous-classes : on
                    // refait la ligne, mais seulement quand le nom a vraiment bougé.
                    if (e.target.classList.contains('mc-nom')) {
                        const i = entier(e.target.closest('.mc-ligne').dataset.i, 0);
                        const cls = trouverClasse(cat, brouillon[i]);
                        const dl = corps.querySelector(`#mc-sous-${i}`);
                        const attendu = cls ? (cls.subclasses || []).length : 0;
                        if ((dl ? dl.children.length : 0) !== attendu) {
                            const pos = e.target.selectionStart;
                            redessiner();
                            const rendu = corps.querySelector(`.mc-ligne[data-i="${i}"] .mc-nom`);
                            if (rendu) { rendu.focus(); try { rendu.setSelectionRange(pos, pos); } catch (err) {} }
                            return;
                        }
                    }
                    majBilan();
                });
                corps.addEventListener('click', (e) => {
                    const sup = e.target.closest('[data-sup]');
                    if (sup) {
                        lireBrouillon();
                        const i = entier(sup.dataset.sup, 0);
                        if (brouillon.length > 1) brouillon.splice(i, 1);
                        redessiner(Math.max(0, i - 1));
                        return;
                    }
                    if (e.target.closest('.mc-ajout')) {
                        lireBrouillon();
                        if (brouillon.length < MAX_CLASSES) {
                            brouillon.push({ id: null, nom: '', niveau: 1, sousClasse: '', sousClasseId: null });
                        }
                        redessiner(brouillon.length - 1);
                        return;
                    }
                    if (e.target.closest('.mc-appliquer')) {
                        appliquerEmplacements(derniereProp);
                        e.target.closest('.mc-appliquer').textContent = '✓ Emplacements appliqués';
                        e.target.closest('.mc-appliquer').disabled = true;
                    }
                });
                setTimeout(() => redessiner(), 0);
                return corps;
            },
            resultat(signaler) {
                lireBrouillon();
                const propre = brouillon.filter(c => c.nom);
                if (!propre.length) { signaler('Il faut au moins une classe.'); return undefined; }
                const doublon = propre.find((c, i) => propre.some((d, j) => j < i && plier(d.nom) === plier(c.nom)));
                if (doublon) { signaler(`« ${doublon.nom} » apparaît deux fois : regroupe ses niveaux.`); return undefined; }
                if (total(propre) > 20) { signaler('Le total dépasse le niveau 20.'); return undefined; }
                return propre;
            }
        });

        fenetreOuverte = false;
        if (!resultat) return false;
        definir(resultat);
        if (window.showAppToast) {
            window.showAppToast(resultat.length > 1
                ? `⚔️ ${texte(resultat)} — niveau ${total(resultat)}`
                : `⚔️ ${resultat[0].nom} — niveau ${resultat[0].niveau}`, 'reussite');
        }
        return true;
    }

    /** Écrit les emplacements proposés sur la fiche. La magie de pacte garde sa
     *  marque : un recalcul ultérieur ne la confondra pas avec les autres. */
    function appliquerEmplacements(prop) {
        if (!prop || !window.SheetApi || !window.SheetApi.setSpellSlots) return 0;
        // L'état actuel de la fiche : il dit ce qu'on peut remplacer sans dégât.
        const actuels = (window.SheetApi.emplacements && window.SheetApi.emplacements()) || [];
        const estPacte = new Set(actuels.filter(r => r.pacte).map(r => r.rang));
        const map = {};
        for (let r = 1; r <= 9; r++) {
            // Une réserve marquée « pacte » que la proposition ne reconnaît pas
            // n'est PAS remise à zéro : elle vient d'ailleurs, on n'y touche pas.
            if (estPacte.has(r) && !(prop.pacte && prop.pacte.rang === r)) continue;
            map[r] = (prop.parRang && prop.parRang[r]) || 0;
        }
        if (prop.pacte) {
            map[prop.pacte.rang] = { total: Math.max(prop.pacte.nombre, entier(map[prop.pacte.rang], 0)), pacte: true };
        }
        const n = window.SheetApi.setSpellSlots(map);
        if (n && window.showAppToast) window.showAppToast('⬦ Emplacements mis à jour.', 'reussite');
        return n;
    }

    window.Multiclasse = {
        // Modèle
        liste, definir, texte, total, multi, enregistree, analyserTexte,
        // Règles et calculs
        tables, proposition, prerequisManquants, maitrisesDe,
        niveauIncantateur, magieDePacte, desDeVie, trouverClasse, catalogue,
        appliquerEmplacements,
        // Interface
        ouvrir
    };
})();
