// =====================================================
// Export / import d'une fiche de personnage
//
// Gratuit, définitivement : une fiche appartient à qui l'a écrite, et doit
// pouvoir sortir d'ici sans rien demander à personne.
//
// TOUT se passe dans le navigateur. Le fichier déposé n'est envoyé nulle part,
// aucun service tiers n'est appelé — ni pour lire, ni pour convertir.
//
// Deux formats :
//   · « maison »  — un vidage fidèle du stockage de la fiche, versionné.
//                   L'aller-retour ne perd rien, par construction : on ne
//                   traduit pas, on recopie.
//   · Foundry VTT — système dnd5e. Là, il faut traduire, et une traduction
//                   perd toujours quelque chose. Ce qui ne passe pas est
//                   ÉCRIT À L'ÉCRAN, jamais avalé en silence.
//
// Le contenu hors SRD trouvé à l'import va dans la couche perso LOCALE
// (dnd-homebrew), jamais sur le cloud.
// =====================================================
(function () {
    'use strict';

    const FORMAT = 'bones-and-blades/character';
    const VERSION = 1;

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const num = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : (d == null ? 0 : d); };
    const str = (v) => (v == null ? '' : String(v));
    const jsonOr = (raw, fallback) => {
        if (raw == null || raw === '' || raw === 'undefined') return fallback;
        try { const v = JSON.parse(raw); return v == null ? fallback : v; } catch (e) { return fallback; }
    };
    const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

    function download(fileName, text, mime) {
        const blob = new Blob([text], { type: (mime || 'application/json') + ';charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
    const safeFileName = (s) => String(s || 'fiche').trim()
        .replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 80) || 'fiche';

    // =====================================================
    // Lecture d'une fiche
    // Le vidage brut du stockage n'est pas lisible : cette fonction en tire
    // une vue exploitable, utilisée par l'aperçu ET par l'export Foundry.
    // Un seul endroit qui sait où vit quoi.
    // =====================================================

    // Identifiant de compétence sur la fiche → abréviation dnd5e.
    const SKILLS = {
        athletics: 'ath', acrobatics: 'acr', sleight: 'slt', stealth: 'ste',
        arcana: 'arc', history: 'his', investigation: 'inv', nature: 'nat', religion: 'rel',
        animal: 'ani', insight: 'ins', medicine: 'med', perception: 'prc', survival: 'sur',
        deception: 'dec', intimidation: 'itm', performance: 'prf', persuasion: 'per'
    };
    const SKILL_FR = {
        athletics: 'Athlétisme', acrobatics: 'Acrobaties', sleight: 'Escamotage', stealth: 'Discrétion',
        arcana: 'Arcanes', history: 'Histoire', investigation: 'Investigation', nature: 'Nature',
        religion: 'Religion', animal: 'Dressage', insight: 'Intuition', medicine: 'Médecine',
        perception: 'Perception', survival: 'Survie', deception: 'Tromperie',
        intimidation: 'Intimidation', performance: 'Représentation', persuasion: 'Persuasion'
    };
    const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    const ABILITY_FR = { str: 'Force', dex: 'Dextérité', con: 'Constitution',
                         int: 'Intelligence', wis: 'Sagesse', cha: 'Charisme' };
    // Le sou français sur la fiche → la bourse dnd5e.
    const COINS = { 'coin-pc': 'cp', 'coin-pa': 'sp', 'coin-pe': 'ep', 'coin-po': 'gp', 'coin-pp': 'pp' };
    const SIZES = { 'très petite': 'tiny', petite: 'sm', moyenne: 'med', grande: 'lg',
                    'très grande': 'huge', gigantesque: 'grg' };

    function sheetView(d) {
        const f = (id) => str(d['dnd-sheet-' + id]);
        const v = {
            name: f('char-name') || 'Personnage',
            level: num(f('char-level'), 1) || 1,
            className: f('char-class'), subclass: f('char-subclass'),
            race: f('char-race'), background: f('char-background'),
            alignment: f('char-alignment'), xp: num(f('char-xp'), 0),
            size: f('char-size'), languages: f('char-languages'),
            appearance: f('char-appearance'), backstory: f('char-backstory'),
            ac: f('armor-class'), speed: f('speed'),
            initiative: f('initiative'), passive: f('passive-perception'),
            profBonus: num(f('prof-bonus'), 2),
            hp: { max: num(f('hp-max'), 0), value: num(f('hp-current'), 0), temp: num(f('hp-temp'), 0) },
            hitDice: { max: num(f('hd-max'), 0), size: f('hd-size'), spent: num(f('hd-spent'), 0) },
            spellcasting: f('spellcasting-ability'),
            spellDc: f('spell-save-dc'), spellAttack: f('spell-attack-bonus'),
            resist: f('dmg-resist'), immune: f('dmg-immune'), vulnerable: f('dmg-vulnerable'),
            abilities: {}, saves: {}, skills: {}, coins: {},
            spells: jsonOr(d['dnd-spells'], []),
            attacks: jsonOr(d['dnd-attacks'], []),
            inventory: jsonOr(d['dnd-inventory'], []),
            traits: jsonOr(d['dnd-traits'], []),
            feats: jsonOr(d['dnd-abilities'], []),
            companions: jsonOr(d['dnd-companions'], []),
            slots: jsonOr(d['dnd-spell-slots'], []),
            journal: jsonOr(d['dnd-journal'], []),
            avatar: str(d['dnd-avatar'])
        };
        ABILITIES.forEach(a => {
            v.abilities[a] = num(f('stat-' + a), 10) || 10;
            v.saves[a] = num(f('prof-save-' + a), 0);
        });
        Object.keys(SKILLS).forEach(k => { v.skills[k] = num(f('prof-' + k), 0); });
        Object.keys(COINS).forEach(k => { v.coins[COINS[k]] = num(f(k), 0); });
        return v;
    }

    /** Nombre d'objets réellement portés par la fiche — sert à l'aperçu. */
    function counts(view) {
        return [
            [view.spells.length, 'sort', 'sorts'],
            [view.attacks.length, 'attaque', 'attaques'],
            [view.inventory.length, 'objet', 'objets'],
            [view.traits.length, 'capacité', 'capacités'],
            [view.feats.length, 'aptitude', 'aptitudes'],
            [view.companions.length, 'compagnon', 'compagnons'],
            [view.journal.length, 'page de journal', 'pages de journal']
        ].filter(c => c[0] > 0).map(c => plural(c[0], c[1], c[2]));
    }

    // =====================================================
    // Format maison
    // =====================================================

    // Ce qui relève du carnet intime plutôt que de la fiche : on peut choisir
    // de ne pas l'emporter quand on partage.
    const PRIVATE_KEYS = ['dnd-journal', 'dnd-roll-history', 'dnd-quests', 'dnd-npcs'];

    function buildHome(dump, meta, opts) {
        const o = opts || {};
        const data = {};
        Object.keys(dump).forEach(k => {
            if (!o.withPrivate && PRIVATE_KEYS.includes(k)) return;
            // L'image source pleine résolution ne sert qu'au recadrage local :
            // elle double le poids du fichier pour rien.
            if (k === 'dnd-avatar-src') return;
            if (dump[k] == null) return;
            data[k] = String(dump[k]);
        });
        const view = sheetView(dump);
        const out = {
            format: FORMAT, version: VERSION,
            app: 'Bones & Blades',
            exported: new Date().toISOString(),
            character: {
                name: view.name, level: view.level,
                class: view.className, subclass: view.subclass, race: view.race
            },
            meta: meta || null,
            data: data
        };
        if (o.homebrew) out.homebrew = o.homebrew;
        return out;
    }

    /** Le contenu perso auquel CETTE fiche fait référence. On n'emporte pas
     *  toute la bibliothèque : seulement ce sans quoi la fiche serait bancale
     *  chez celui qui la reçoit. */
    function referencedHomebrew(view) {
        if (!window.SRD || !window.SRD.homebrew) return null;
        const fold = window.SRD.fold;
        const wanted = new Set([view.className, view.subclass, view.race, view.background]
            .map(s => fold(s || '')).filter(Boolean));
        const names = new Set([
            ...view.spells.map(s => fold(s.name || '')),
            ...view.attacks.map(s => fold(s.name || '')),
            ...view.inventory.map(s => fold(s.name || ''))
        ].filter(Boolean));
        const all = window.SRD.homebrew.all();
        const out = {};
        let n = 0;
        Object.keys(all || {}).forEach(type => {
            const keep = (all[type] || []).filter(e => {
                const fn = fold(e.name || '');
                if (!fn) return false;
                if (type === 'classes' || type === 'subclasses' || type === 'races' || type === 'backgrounds') {
                    return [...wanted].some(w => w.includes(fn) || fn.includes(w));
                }
                return names.has(fn);
            });
            if (keep.length) { out[type] = keep; n += keep.length; }
        });
        return n ? { content: out, count: n } : null;
    }

    // =====================================================
    // Foundry VTT — système dnd5e
    //
    // Schéma vérifié sur dnd5e 5.3.3 (mai 2026). Il bouge d'une version à
    // l'autre : partout où le système a renommé un champ en gardant une
    // migration, on écrit LES DEUX noms. Foundry ignore ce qu'il ne connaît
    // pas, donc écrire large ne casse rien et couvre les vieilles versions.
    //   · classe        hitDice/hitDiceUsed  →  hd.denomination/hd.spent
    //   · sort          preparation.{mode,prepared} → method/prepared
    //   · composantes   components.{vocal,…} → properties[]
    // Le niveau d'un personnage n'est PAS stocké sur l'acteur : il se déduit
    // de l'objet « classe ». Idem pour la race et l'historique, devenus des
    // objets référencés — on les émet en objets, pas en texte.
    // =====================================================

    const FOUNDRY_SIZE = (s) => SIZES[String(s || '').toLowerCase().trim()] || 'med';
    // La fiche range la taille du dé de vie en chiffres (« 12 », c'est la
    // valeur du menu déroulant) ; Foundry et D&D Beyond écrivent « d12 ».
    const hdDigits = (s) => (String(s == null ? '' : s).match(/\d+/) || [''])[0];
    const hdDie = (s) => { const n = hdDigits(s); return n ? 'd' + n : ''; };
    const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'sans-nom';
    const htmlOf = (s) => {
        const t = str(s).trim();
        if (!t) return '';
        return /<[a-z][\s\S]*>/i.test(t) ? t
            : t.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
    };

    function foundryItemDesc(text) { return { value: htmlOf(text), chat: '' }; }

    function foundrySpell(sp) {
        const comp = sp.comp || {};
        const conc = /concentration/i.test(str(sp.duration));
        const props = [];
        if (comp.v) props.push('vocal');
        if (comp.s) props.push('somatic');
        if (comp.m) props.push('material');
        if (conc) props.push('concentration');
        const lvl = num(sp.level, 0);
        return {
            name: str(sp.name) || 'Sort',
            type: 'spell',
            system: {
                description: foundryItemDesc(sp.desc),
                level: lvl,
                school: '',
                materials: { value: str(comp.mat), consumed: false, cost: 0, supply: 0 },
                properties: props,
                // dnd5e ≥ 4 : method + prepared. Avant : preparation.{mode,prepared}.
                method: 'prepared',
                prepared: sp.prepared ? 1 : 0,
                preparation: { mode: 'prepared', prepared: !!sp.prepared },
                // Anciennes versions : l'objet components existe encore.
                components: { vocal: !!comp.v, somatic: !!comp.s, material: !!comp.m,
                              concentration: conc, ritual: false },
                activation: { type: /bonus/i.test(str(sp.time)) ? 'bonus' : 'action', cost: 1,
                              condition: str(sp.time) },
                duration: { value: null, units: '', special: str(sp.duration) },
                range: { value: null, units: '', special: str(sp.range) }
            }
        };
    }

    function foundryWeapon(atk) {
        const bits = [];
        if (atk.bonus) bits.push(`Toucher : ${atk.bonus}`);
        if (atk.saveDC) bits.push(`DD ${atk.saveDC}${atk.saveAbility ? ' ' + atk.saveAbility : ''}`);
        if (atk.dmg) bits.push(`Dégâts : ${atk.dmg}${atk.dmgType ? ' ' + atk.dmgType : ''}`);
        if (atk.dmg2) bits.push(`À deux mains : ${atk.dmg2}`);
        if (atk.bonusDmg) bits.push(`Bonus : ${atk.bonusDmg} ${str(atk.bonusDmgType)}`);
        if (atk.range) bits.push(`Portée : ${atk.range}`);
        if (atk.props) bits.push(`Propriétés : ${atk.props}`);
        const head = bits.length ? `<p><em>${esc(bits.join(' · '))}</em></p>` : '';
        return {
            name: str(atk.name) || 'Attaque',
            type: 'weapon',
            system: {
                description: { value: head + htmlOf(atk.desc), chat: '' },
                quantity: 1, weight: { value: 0, units: 'kg' },
                equipped: !!atk.equipped,
                type: { value: atk.wtype === 'ranged' ? 'simpleR' : 'simpleM', baseItem: '' },
                properties: [],
                // Modèle « ancien » des dégâts : encore lu par dnd5e ≤ 3, ignoré
                // au-delà (où les dégâts vivent dans une « activité »). Le texte
                // ci-dessus, lui, survit partout.
                damage: { parts: atk.dmg ? [[str(atk.dmg), str(atk.dmgType)]] : [], versatile: str(atk.dmg2) },
                range: { value: null, long: null, units: '', special: str(atk.range) },
                attunement: atk.reqAttune ? 'required' : '',
                uses: atk.chargesMax
                    ? { value: num(atk.charges, 0), max: String(atk.chargesMax), per: 'day', spent: 0 }
                    : { value: null, max: '', per: null }
            }
        };
    }

    function foundryGear(it) {
        return {
            name: str(it.name) || 'Objet',
            type: 'loot',
            system: {
                description: foundryItemDesc([str(it.desc), str(it.notes)].filter(Boolean).join('\n\n')),
                quantity: num(it.qty, 1) || 1,
                weight: { value: parseFloat(String(it.weight).replace(',', '.')) || 0, units: 'kg' },
                price: { value: 0, denomination: 'gp' },
                rarity: '', equipped: !!it.equipped
            }
        };
    }

    function foundryFeat(t) {
        return {
            name: str(t.name) || 'Aptitude',
            type: 'feat',
            system: {
                description: foundryItemDesc(t.desc),
                type: { value: t.type === 'feat' ? 'feat' : 'class', subtype: '' },
                requirements: t.level ? 'Niveau ' + t.level : ''
            }
        };
    }

    function toFoundry(view) {
        const lost = [];
        const items = [];

        // La classe porte le niveau et les dés de vie : sans elle, l'acteur
        // arrive au niveau 0 chez Foundry.
        items.push({
            name: view.className || 'Classe',
            type: 'class',
            system: {
                description: foundryItemDesc(''),
                identifier: slug(view.className),
                levels: view.level,
                hitDice: hdDie(view.hitDice.size) || 'd8',
                hitDiceUsed: view.hitDice.spent,
                hd: { denomination: hdDie(view.hitDice.size) || 'd8', spent: view.hitDice.spent, additional: '' }
            }
        });
        if (view.subclass) items.push({
            name: view.subclass, type: 'subclass',
            system: { description: foundryItemDesc(''), identifier: slug(view.subclass),
                      classIdentifier: slug(view.className) }
        });
        if (view.race) items.push({ name: view.race, type: 'race',
            system: { description: foundryItemDesc(''), identifier: slug(view.race) } });
        if (view.background) items.push({ name: view.background, type: 'background',
            system: { description: foundryItemDesc('') } });

        view.spells.forEach(s => items.push(foundrySpell(s)));
        view.attacks.forEach(a => items.push(foundryWeapon(a)));
        view.inventory.forEach(i => items.push(foundryGear(i)));
        view.traits.forEach(t => items.push(foundryFeat(t)));
        view.feats.forEach(t => items.push(foundryFeat(t)));

        const abilities = {};
        ABILITIES.forEach(a => {
            abilities[a] = { value: view.abilities[a], proficient: view.saves[a] ? 1 : 0 };
        });
        const skills = {};
        Object.keys(SKILLS).forEach(k => { skills[SKILLS[k]] = { value: Math.min(2, view.skills[k] || 0) }; });

        const spells = {};
        (view.slots || []).forEach((s, i) => {
            const total = num(s && s.total, 0);
            if (!total) return;
            const used = Array.isArray(s.used) ? s.used.filter(Boolean).length : 0;
            spells['spell' + (i + 1)] = { value: Math.max(0, total - used), override: total };
        });

        // La vitesse est écrite en toutes lettres sur la fiche (« 9 m »).
        const speedNum = parseFloat(String(view.speed).replace(',', '.'));
        // L'apparence a son propre champ chez Foundry : la remettre dans la
        // biographie la ferait revenir en double à l'import.
        const bio = view.backstory;

        if (view.avatar) lost.push('le portrait (Foundry attend un fichier d’image, pas une image intégrée)');
        if (view.journal.length) lost.push('le journal de bord (pas d’équivalent sur un acteur)');
        if (view.companions.length) lost.push(plural(view.companions.length, 'compagnon', 'compagnons')
            + ' (Foundry en fait des acteurs séparés)');
        if ((view.attacks || []).some(a => a.dmg)) {
            lost.push('les jets de dégâts des attaques sur dnd5e 4 et plus, qui les range dans des '
                    + '« activités » : le détail reste écrit dans la description');
        }
        if (view.spellDc || view.spellAttack) lost.push('le DD des sorts et le bonus d’attaque magique, que Foundry recalcule');

        const actor = {
            name: view.name,
            type: 'character',
            system: {
                abilities: abilities,
                attributes: {
                    ac: { flat: num(view.ac, null), calc: view.ac ? 'flat' : 'default', formula: '' },
                    hp: { value: view.hp.value, max: view.hp.max, temp: view.hp.temp, tempmax: 0 },
                    init: { ability: 'dex', bonus: '' },
                    movement: { walk: Number.isFinite(speedNum) ? speedNum : null, units: 'm', hover: false },
                    spellcasting: (view.spellcasting || '').slice(0, 3).toLowerCase(),
                    death: { success: 0, failure: 0 },
                    exhaustion: 0, inspiration: false
                },
                details: {
                    biography: { value: htmlOf(bio), public: '' },
                    alignment: view.alignment,
                    xp: { value: view.xp },
                    appearance: view.appearance,
                    originalClass: slug(view.className)
                },
                traits: {
                    size: FOUNDRY_SIZE(view.size),
                    languages: { value: [], custom: view.languages },
                    dr: { value: [], custom: view.resist },
                    di: { value: [], custom: view.immune },
                    dv: { value: [], custom: view.vulnerable }
                },
                currency: view.coins,
                skills: skills,
                spells: spells
            },
            items: items,
            effects: [],
            flags: { 'bones-and-blades': { format: FORMAT, version: VERSION, exported: new Date().toISOString() } }
        };
        return { actor, lost };
    }

    // ---------- Lecture d'un acteur Foundry ----------

    const FOUNDRY_TO_SKILL = Object.fromEntries(Object.entries(SKILLS).map(([k, v]) => [v, k]));
    const FR_SIZE = Object.fromEntries(Object.entries(SIZES).map(([k, v]) => [v, k]));

    function fromFoundry(actor) {
        const notes = [];
        const sys = actor.system || {};
        const set = {};
        const put = (k, v) => { if (v !== '' && v != null) set['dnd-sheet-' + k] = String(v); };
        // Le HTML de Foundry redevient du texte : les fins de paragraphe
        // valent une ligne vide, sinon tout se recolle en un bloc.
        const plain = (h) => String(h == null ? '' : h)
            .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/\n{3,}/g, '\n\n').trim();

        put('char-name', actor.name);
        const ab = sys.abilities || {};
        ABILITIES.forEach(a => {
            if (ab[a] && ab[a].value != null) put('stat-' + a, num(ab[a].value, 10));
            if (ab[a] && ab[a].proficient) put('prof-save-' + a, 1);
        });
        const sk = sys.skills || {};
        Object.keys(sk).forEach(abbr => {
            const id = FOUNDRY_TO_SKILL[abbr];
            const val = num(sk[abbr] && sk[abbr].value, 0);
            if (id && val) put('prof-' + id, Math.min(2, Math.round(val)));
            else if (!id && val) notes.push(`compétence « ${abbr} » inconnue de la fiche`);
        });

        const at = sys.attributes || {};
        if (at.hp) { put('hp-max', num(at.hp.max, 0)); put('hp-current', num(at.hp.value, 0)); put('hp-temp', num(at.hp.temp, 0)); }
        if (at.ac && (at.ac.flat != null || at.ac.value != null)) put('armor-class', num(at.ac.flat != null ? at.ac.flat : at.ac.value, 0));
        if (at.movement && at.movement.walk != null) {
            const u = at.movement.units || 'ft';
            const walk = Number(at.movement.walk) || 0;
            put('speed', u === 'm' ? `${walk} m` : `${Math.round(walk * 0.3 * 10) / 10} m`);
        }
        if (at.spellcasting) put('spellcasting-ability', String(at.spellcasting).toLowerCase());

        const det = sys.details || {};
        if (det.alignment) put('char-alignment', det.alignment);
        if (det.xp && det.xp.value != null) put('char-xp', num(det.xp.value, 0));
        if (det.appearance) put('char-appearance', det.appearance);
        if (det.biography && det.biography.value) put('char-backstory', plain(det.biography.value));
        const tr = sys.traits || {};
        if (tr.size) put('char-size', FR_SIZE[tr.size] || tr.size);
        const traitText = (t) => {
            if (!t) return '';
            const list = Array.isArray(t.value) ? t.value : (t.value ? [...t.value] : []);
            return [list.join(', '), t.custom].filter(Boolean).join(', ');
        };
        put('char-languages', traitText(tr.languages));
        put('dmg-resist', traitText(tr.dr));
        put('dmg-immune', traitText(tr.di));
        put('dmg-vulnerable', traitText(tr.dv));

        const cur = sys.currency || {};
        Object.keys(COINS).forEach(k => { if (cur[COINS[k]] != null) put(k, num(cur[COINS[k]], 0)); });

        // Emplacements de sorts.
        const slots = [];
        for (let i = 1; i <= 9; i++) {
            const s = (sys.spells || {})['spell' + i] || {};
            const total = num(s.override != null ? s.override : s.max, 0);
            slots.push({ total, used: new Array(total).fill(false),
                         regenMode: 'long', longType: 'all', longAmount: 1, shortType: 'all', shortAmount: 1 });
        }
        if (slots.some(s => s.total)) set['dnd-spell-slots'] = JSON.stringify(slots);

        // Objets.
        const items = Array.isArray(actor.items) ? actor.items : [];
        const spells = [], attacks = [], inventory = [], traits = [];
        let level = 0, cls = '', sub = '', race = '', background = '', hdSize = '', hdSpent = 0;
        const skipped = new Map();

        items.forEach(it => {
            const s = it.system || {};
            const desc = plain(s.description && s.description.value);
            switch (it.type) {
                case 'class':
                    cls = it.name || cls;
                    level = Math.max(level, num(s.levels, 0));
                    hdSize = (s.hd && s.hd.denomination) || s.hitDice || hdSize;
                    hdSpent = num((s.hd && s.hd.spent) != null ? s.hd.spent : s.hitDiceUsed, 0);
                    break;
                case 'subclass': sub = it.name || sub; break;
                case 'race': case 'species': race = it.name || race; break;
                case 'background': background = it.name || background; break;
                case 'spell': {
                    const props = new Set(Array.isArray(s.properties) ? s.properties : []);
                    const comp = s.components || {};
                    const conc = props.has('concentration') || !!comp.concentration;
                    const c = { v: props.has('vocal') || !!comp.vocal,
                                s: props.has('somatic') || !!comp.somatic,
                                m: props.has('material') || !!comp.material,
                                mat: (s.materials && s.materials.value) || '' };
                    // La fiche garde les composantes SOUS DEUX FORMES : l'objet
                    // pour le formulaire, la chaîne pour l'affichage.
                    const res = [c.v && 'V', c.s && 'S', c.m && 'M'].filter(Boolean).join(', ')
                              + (c.m && c.mat ? ` (${c.mat})` : '');
                    spells.push({
                        name: it.name, level: num(s.level, 0),
                        time: (s.activation && (s.activation.condition || s.activation.type)) || '',
                        range: (s.range && (s.range.special || (s.range.value ? s.range.value + ' ' + (s.range.units || '') : ''))) || '',
                        duration: (s.duration && (s.duration.special
                            || (s.duration.value ? s.duration.value + ' ' + (s.duration.units || '') : ''))) || (conc ? 'Concentration' : ''),
                        comp: c, res: res,
                        desc: desc ? `<p>${esc(desc).replace(/\n/g, '<br>')}</p>` : '',
                        notes: '', mode: 'none', saveAbility: '', dmg: '', dmgType: '',
                        prepared: s.prepared != null ? !!s.prepared : !!(s.preparation && s.preparation.prepared),
                        pinned: false
                    });
                    break;
                }
                case 'weapon':
                    attacks.push({
                        name: it.name, category: 'Général', mode: 'attack',
                        bonus: '', dmg: (s.damage && s.damage.parts && s.damage.parts[0] && s.damage.parts[0][0]) || '',
                        dmgType: (s.damage && s.damage.parts && s.damage.parts[0] && s.damage.parts[0][1]) || '',
                        dmg2: (s.damage && s.damage.versatile) || '',
                        range: (s.range && (s.range.special || (s.range.value ? s.range.value + ' ' + (s.range.units || '') : ''))) || '',
                        crit: 20, props: '', desc: desc, notes: '',
                        equipped: !!s.equipped, pinned: false, autoAbility: 'manual', wtype: '',
                        reqAttune: false, isAttuned: false
                    });
                    break;
                case 'feat': case 'classfeature':
                    traits.push({ name: it.name, type: 'class', level: 0, desc: desc, pinned: false });
                    break;
                case 'equipment': case 'consumable': case 'loot': case 'tool':
                case 'container': case 'backpack':
                    inventory.push({
                        name: it.name, qty: num(s.quantity, 1) || 1,
                        weight: s.weight && s.weight.value != null ? String(s.weight.value) : String(s.weight || '-'),
                        category: 'Général', value: '', rarity: str(s.rarity),
                        desc: desc, notes: '', equipped: !!s.equipped, pinned: false
                    });
                    break;
                default:
                    skipped.set(it.type, (skipped.get(it.type) || 0) + 1);
            }
        });

        if (cls) put('char-class', cls);
        if (sub) put('char-subclass', sub);
        if (race) put('char-race', race);
        if (background) put('char-background', background);
        if (level) { put('char-level', level); put('hd-max', level); }
        if (hdSize) put('hd-size', hdDigits(hdSize));
        if (hdSpent) put('hd-spent', hdSpent);
        if (spells.length) set['dnd-spells'] = JSON.stringify(spells);
        if (attacks.length) set['dnd-attacks'] = JSON.stringify(attacks);
        if (inventory.length) set['dnd-inventory'] = JSON.stringify(inventory);
        if (traits.length) set['dnd-traits'] = JSON.stringify(traits);

        skipped.forEach((n, type) => notes.push(`${plural(n, 'objet', 'objets')} de type « ${type} » — pas d’équivalent sur la fiche`));
        if ((actor.effects || []).length) notes.push(plural(actor.effects.length, 'effet actif', 'effets actifs') + ' — non repris');
        if (actor.img && !/^icons\//.test(actor.img)) notes.push('le portrait (Foundry ne le met pas dans le fichier)');
        notes.push('les jets automatiques : la fiche recalcule les siens à partir des caractéristiques');

        return { data: set, notes, name: actor.name || 'Personnage', level: level || 1, className: cls };
    }

    // =====================================================
    // D&D Beyond
    //
    // Il n'existe aucun export officiel ni aucun schéma publié : ce que les
    // joueurs ont sous la main, c'est le JSON du service de personnages
    // (character-service), dont la forme n'est garantie par personne et change
    // sans prévenir. On lit donc ce qu'on reconnaît, et on ÉCRIT À L'ÉCRAN la
    // liste des rubriques qu'on n'a pas su lire — c'est la seule façon
    // honnête de proposer ça sans faire croire à un import complet.
    //
    // Rien n'est téléchargé depuis D&D Beyond : l'utilisateur dépose SON
    // fichier, déjà enregistré chez lui.
    // =====================================================

    const DDB_STAT = { 1: 'str', 2: 'dex', 3: 'con', 4: 'int', 5: 'wis', 6: 'cha' };
    // Les maîtrises de D&D Beyond arrivent en « modificateurs », nommés en
    // anglais, à plat. Voici celles qui correspondent à une ligne de la fiche.
    const DDB_SKILL = {
        acrobatics: 'acrobatics', 'animal-handling': 'animal', arcana: 'arcana',
        athletics: 'athletics', deception: 'deception', history: 'history',
        insight: 'insight', intimidation: 'intimidation', investigation: 'investigation',
        medicine: 'medicine', nature: 'nature', perception: 'perception',
        performance: 'performance', persuasion: 'persuasion', religion: 'religion',
        'sleight-of-hand': 'sleight', stealth: 'stealth', survival: 'survival'
    };
    const DDB_SAVE = {
        'strength-saving-throws': 'str', 'dexterity-saving-throws': 'dex',
        'constitution-saving-throws': 'con', 'intelligence-saving-throws': 'int',
        'wisdom-saving-throws': 'wis', 'charisma-saving-throws': 'cha'
    };
    // Rubriques du fichier qu'on sait lire : tout ce qui n'est pas là-dedans
    // est signalé à l'écran plutôt qu'ignoré en douce.
    const DDB_KNOWN = new Set([
        'id', 'name', 'stats', 'bonusStats', 'overrideStats', 'classes', 'race',
        'background', 'baseHitPoints', 'bonusHitPoints', 'removedHitPoints',
        'temporaryHitPoints', 'currencies', 'inventory', 'spells', 'classSpells', 'spellSlots',
        'modifiers', 'notes', 'traits', 'alignmentId', 'currentXp', 'preferences',
        'readonlyUrl', 'decorations', 'dateModified', 'campaign', 'username',
        'userId', 'characterValues', 'race.baseName', 'inspiration', 'lifestyleId'
    ]);
    const DDB_IGNORED_LABEL = {
        feats: 'les dons', actions: 'les actions', options: 'les options de classe',
        choices: 'les choix de classe', customItems: 'les objets sur mesure',
        creatures: 'les créatures liées', conditions: 'les états en cours',
        deathSaves: 'les jets contre la mort', customActions: 'les actions sur mesure',
        customDefenseAdjustments: 'les ajustements de défense',
        customProficiencies: 'les maîtrises sur mesure', pactMagic: 'la magie de pacte',
        activeSourceCategories: 'les sources actives'
    };
    const ALIGNMENTS = { 1: 'Loyal bon', 2: 'Neutre bon', 3: 'Chaotique bon',
                         4: 'Loyal neutre', 5: 'Neutre', 6: 'Chaotique neutre',
                         7: 'Loyal mauvais', 8: 'Neutre mauvais', 9: 'Chaotique mauvais' };

    function fromBeyond(root) {
        // Le service enveloppe le personnage dans `data` ; certains outils le
        // rangent sous `character`. Les deux arrivent ici.
        const c = root.data || root.character || root;
        const notes = [];
        const set = {};
        const put = (k, v) => { if (v !== '' && v != null) set['dnd-sheet-' + k] = String(v); };
        const plain = (h) => String(h == null ? '' : h)
            .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();

        put('char-name', c.name);
        if (c.currentXp != null) put('char-xp', num(c.currentXp, 0));
        if (c.alignmentId && ALIGNMENTS[c.alignmentId]) put('char-alignment', ALIGNMENTS[c.alignmentId]);

        // Caractéristiques : valeur de base, plus les bonus, moins les
        // remplacements manuels qui, eux, font foi.
        const byId = (arr) => { const o = {}; (arr || []).forEach(s => { o[s.id] = s.value; }); return o; };
        const base = byId(c.stats), bonus = byId(c.bonusStats), over = byId(c.overrideStats);
        const score = {};
        Object.keys(DDB_STAT).forEach(id => {
            const a = DDB_STAT[id];
            const val = over[id] != null ? over[id] : (num(base[id], 10) + num(bonus[id], 0));
            score[a] = num(val, 10) || 10;
            put('stat-' + a, score[a]);
        });
        const mod = (a) => Math.floor((score[a] - 10) / 2);

        // Classes : le niveau total, et la première classe pour l'affichage.
        let level = 0, first = null;
        (c.classes || []).forEach(cl => {
            level += num(cl.level, 0);
            if (!first) first = cl;
        });
        if (first) {
            put('char-class', (first.definition && first.definition.name) || '');
            const sub = first.subclassDefinition && first.subclassDefinition.name;
            if (sub) put('char-subclass', sub);
            const die = first.definition && first.definition.hitDice;
            if (die) put('hd-size', hdDigits(die));
        }
        if ((c.classes || []).length > 1) {
            notes.push('le multiclassage : seule « ' + ((first.definition && first.definition.name) || '?')
                + ' » est écrite dans le champ Classe, à compléter à la main');
        }
        if (level) { put('char-level', level); put('hd-max', level); }
        put('prof-bonus', Math.floor((Math.max(1, level) - 1) / 4) + 2);
        if (c.race) put('char-race', c.race.fullName || c.race.baseName || '');
        if (c.background && c.background.definition) put('char-background', c.background.definition.name || '');

        // Points de vie : D&D Beyond ne stocke pas le total, il le calcule.
        const hpMax = num(c.baseHitPoints, 0) + num(c.bonusHitPoints, 0) + mod('con') * Math.max(1, level);
        if (c.baseHitPoints != null) {
            put('hp-max', Math.max(1, hpMax));
            put('hp-current', Math.max(0, hpMax - num(c.removedHitPoints, 0)));
            if (c.temporaryHitPoints) put('hp-temp', num(c.temporaryHitPoints, 0));
        }

        // Maîtrises : elles arrivent en modificateurs, éparpillés par source.
        const mods = c.modifiers || {};
        const allMods = Object.keys(mods).reduce((a, k) => a.concat(mods[k] || []), []);
        allMods.forEach(m => {
            if (!m || !m.subType) return;
            const t = String(m.type || '');
            if (t !== 'proficiency' && t !== 'expertise') return;
            const skill = DDB_SKILL[m.subType];
            if (skill) { put('prof-' + skill, t === 'expertise' ? 2 : 1); return; }
            const save = DDB_SAVE[m.subType];
            if (save) put('prof-save-' + save, 1);
        });
        const langs = allMods.filter(m => m && m.type === 'language' && m.friendlySubtypeName)
            .map(m => m.friendlySubtypeName);
        if (langs.length) put('char-languages', [...new Set(langs)].join(', '));

        const cur = c.currencies || {};
        Object.keys(COINS).forEach(k => { if (cur[COINS[k]] != null) put(k, num(cur[COINS[k]], 0)); });

        const tr = c.traits || {};
        const bio = [tr.personalityTraits, tr.ideals, tr.bonds, tr.flaws,
                     (c.notes && c.notes.backstory)].filter(Boolean).join('\n\n');
        if (bio) put('char-backstory', plain(bio));
        if (tr.appearance) put('char-appearance', plain(tr.appearance));

        // Inventaire.
        const inventory = (c.inventory || []).map(it => {
            const def = it.definition || {};
            return {
                name: def.name || 'Objet', qty: num(it.quantity, 1) || 1,
                weight: def.weight != null ? String(def.weight) : '-',
                category: 'Général', value: '', rarity: str(def.rarity),
                desc: plain(def.description), notes: '',
                equipped: !!it.equipped, pinned: false
            };
        });
        if (inventory.length) set['dnd-inventory'] = JSON.stringify(inventory);

        // Sorts : ils vivent à deux endroits, par classe et par source.
        const rawSpells = [];
        (c.classSpells || []).forEach(cs => (cs.spells || []).forEach(s => rawSpells.push(s)));
        const sp = c.spells || {};
        ['class', 'race', 'item', 'feat', 'background'].forEach(k =>
            (sp[k] || []).forEach(s => rawSpells.push(s)));
        const seen = new Set();
        const spells = [];
        rawSpells.forEach(s => {
            const def = s.definition || s;
            const name = def.name;
            if (!name || seen.has(name)) return;
            seen.add(name);
            const comps = def.components || [];      // 1 = V, 2 = S, 3 = M
            spells.push({
                name, level: num(def.level, 0),
                time: '', range: '', duration: def.duration && def.duration.durationInterval
                    ? `${def.duration.durationInterval} ${def.duration.durationUnit || ''}`.trim()
                    : (def.concentration ? 'Concentration' : ''),
                comp: { v: comps.includes(1), s: comps.includes(2), m: comps.includes(3),
                        mat: str(def.componentsDescription) },
                res: [comps.includes(1) && 'V', comps.includes(2) && 'S', comps.includes(3) && 'M']
                    .filter(Boolean).join(', '),
                desc: def.description ? `<p>${esc(plain(def.description)).replace(/\n/g, '<br>')}</p>` : '',
                notes: '', mode: 'none', saveAbility: '', dmg: '', dmgType: '',
                prepared: !!s.prepared, pinned: false
            });
        });
        if (spells.length) set['dnd-spells'] = JSON.stringify(spells);

        // Emplacements de sorts : « available » est le total, « used » ce qui
        // est déjà dépensé.
        if (Array.isArray(c.spellSlots) && c.spellSlots.length) {
            const slots = [];
            for (let i = 1; i <= 9; i++) {
                const s = c.spellSlots.find(x => num(x.level, 0) === i) || {};
                const total = num(s.available, 0);
                const used = Math.min(total, num(s.used, 0));
                slots.push({ total, used: new Array(total).fill(false).map((_, k) => k < used),
                             regenMode: 'long', longType: 'all', longAmount: 1,
                             shortType: 'all', shortAmount: 1 });
            }
            if (slots.some(s => s.total)) set['dnd-spell-slots'] = JSON.stringify(slots);
        }

        // Ce qu'on n'a pas su lire — nommé, pas noyé.
        const unknown = Object.keys(c).filter(k => !DDB_KNOWN.has(k) && c[k] != null
            && !(Array.isArray(c[k]) && !c[k].length));
        unknown.forEach(k => {
            const label = DDB_IGNORED_LABEL[k];
            if (label) notes.push(label);
            else notes.push(`la rubrique « ${k} » (inconnue de ce lecteur)`);
        });
        notes.push('les attaques : D&D Beyond les calcule à la volée, elles ne sont pas dans le fichier');

        return { data: set, notes, name: c.name || 'Personnage', level: level || 1,
                 className: (first && first.definition && first.definition.name) || '' };
    }

    // =====================================================
    // Reconnaissance d'un fichier déposé
    // =====================================================

    function detect(obj) {
        if (!obj || typeof obj !== 'object') return { kind: null };
        if (obj.format === FORMAT && obj.data) return { kind: 'home', label: 'Bones & Blades' };
        if (obj.version === 'char-1.0' && obj.data) return { kind: 'home', label: 'Bones & Blades (ancien format)' };
        if (obj.type === 'character' && obj.system) return { kind: 'foundry', label: 'Foundry VTT — dnd5e' };
        if (obj.actor && obj.actor.type === 'character') return { kind: 'foundry', label: 'Foundry VTT — dnd5e', unwrap: 'actor' };
        // D&D Beyond : le personnage arrive nu, sous `data` (le service) ou
        // sous `character` (les outils tiers). La signature sûre, c'est le
        // tableau `stats` à six entrées numérotées.
        const ddb = obj.data || obj.character || obj;
        if (ddb && Array.isArray(ddb.stats) && ddb.stats.length === 6
            && ddb.stats.every(s => s && typeof s.id === 'number')) {
            return { kind: 'beyond', label: 'D&D Beyond', unwrap: obj.data ? 'data' : (obj.character ? 'character' : null) };
        }
        // Une sauvegarde complète n'est pas une fiche : elle a son propre
        // bouton, qui sait remettre tous les personnages en place.
        if (Array.isArray(obj.characters) || obj.allData) return { kind: 'backup' };
        return { kind: null };
    }

    /** Un fichier déposé → un plan d'import prêt à appliquer. */
    function parse(text) {
        let obj;
        try { obj = JSON.parse(text); }
        catch (e) { throw new Error('Ce fichier n’est pas du JSON lisible.'); }
        const d = detect(obj);
        if (d.unwrap) obj = obj[d.unwrap];

        if (d.kind === 'home') {
            const data = obj.data || {};
            const view = sheetView(data);
            return {
                kind: 'home', label: d.label, data,
                name: (obj.character && obj.character.name) || view.name,
                level: (obj.character && obj.character.level) || view.level,
                className: (obj.character && obj.character.class) || view.className,
                view, notes: [], homebrew: obj.homebrew || null,
                exported: obj.exported || null
            };
        }
        if (d.kind === 'foundry') {
            const r = fromFoundry(obj);
            return { kind: 'foundry', label: d.label, data: r.data, name: r.name,
                     level: r.level, className: r.className, view: sheetView(r.data),
                     notes: r.notes, homebrew: null, exported: null };
        }
        if (d.kind === 'beyond') {
            const r = fromBeyond(obj);
            return { kind: 'beyond', label: d.label, data: r.data, name: r.name,
                     level: r.level, className: r.className, view: sheetView(r.data),
                     notes: r.notes, homebrew: null, exported: null,
                     warn: 'D&D Beyond ne publie aucun format : ce lecteur suit la forme la plus '
                         + 'répandue, mais elle change sans prévenir. Vérifie l’aperçu avant d’importer.' };
        }
        if (d.kind === 'backup') {
            throw new Error('C’est une sauvegarde complète, pas une fiche. Utilise '
                + '« ♻️ Restaurer une sauvegarde » dans le menu ☰ : elle remet tous tes personnages.');
        }
        throw new Error('Format non reconnu. Cette fenêtre lit les fiches Bones & Blades, '
            + 'les acteurs Foundry VTT (système dnd5e) et les personnages D&D Beyond.');
    }

    // =====================================================
    // Application
    // =====================================================

    async function applyImport(plan, mode) {
        const S = window.SheetStore;
        if (!S) throw new Error('Le stockage n’est pas prêt.');
        const data = Object.assign({}, plan.data);
        data['dnd-sheet-char-name'] = plan.name;

        // Le contenu hors SRD reste LOCAL : la couche perso du navigateur,
        // jamais le cloud.
        let hb = null;
        if (plan.homebrew && window.SRD && window.SRD.homebrew) {
            try {
                hb = window.SRD.homebrew.importText(JSON.stringify(plan.homebrew), 'merge');
            } catch (e) { hb = { error: e.message }; }
        }

        let charId;
        if (mode === 'overwrite') {
            charId = S.activeId();
            if (!charId) throw new Error('Aucune fiche ouverte à écraser.');
            await S.clear(charId, Object.keys(data));
        } else {
            charId = await S.create(plan.name, { level: plan.level, class: plan.className });
        }
        await S.write(charId, data);
        return { charId, hb, mode };
    }

    // =====================================================
    // L'écran
    // =====================================================

    let pending = null;          // le plan d'import en attente de confirmation

    function close() {
        const ov = document.getElementById('sheet-io');
        if (!ov) return;
        ov.classList.add('is-closing');
        setTimeout(() => ov.remove(), 200);
        pending = null;
    }

    function markup(view, meta) {
        const c = counts(view);
        const hb = referencedHomebrew(view);
        return `<div class="sio-panel" role="document">
            <header class="sio-head">
                <div class="sio-kicker">Ta fiche t’appartient</div>
                <h2 class="sio-title">Exporter · Importer</h2>
                <button type="button" class="sio-x" data-act="close" aria-label="Fermer">✕</button>
            </header>
            <nav class="sio-tabs" role="tablist">
                <button type="button" class="sio-tab is-on" data-tab="export">📤 Exporter</button>
                <button type="button" class="sio-tab" data-tab="import">📥 Importer</button>
            </nav>

            <section class="sio-body" data-panel="export">
                <p class="sio-note">Tout se passe dans ton navigateur : le fichier est fabriqué ici,
                    il n’est envoyé à personne.</p>
                <div class="sio-sheet">
                    <b>${esc(view.name)}</b>
                    <span>niveau ${view.level}${view.className ? ' · ' + esc(view.className) : ''}${view.subclass ? ' · ' + esc(view.subclass) : ''}</span>
                    ${c.length ? `<span class="sio-counts">${esc(c.join(' · '))}</span>` : ''}
                </div>
                <div class="sio-cards">
                    <button type="button" class="sio-card" data-export="home">
                        <span class="sio-card-name">🪪 Fiche Bones &amp; Blades</span>
                        <span class="sio-card-text">Un JSON complet et fidèle. C’est le format à choisir
                            pour sauvegarder, transférer sur un autre appareil ou envoyer à quelqu’un
                            qui utilise le site. L’aller-retour ne perd rien.</span>
                    </button>
                    <button type="button" class="sio-card" data-export="foundry">
                        <span class="sio-card-name">🎲 Acteur Foundry VTT</span>
                        <span class="sio-card-text">Système <i>dnd5e</i>. À glisser dans la barre latérale
                            Acteurs de Foundry. Une traduction perd toujours quelque chose : la liste de
                            ce qui ne passe pas s’affiche avant le téléchargement.</span>
                    </button>
                </div>
                <div class="sio-opts">
                    <label><input type="checkbox" class="sio-private" checked>
                        Emporter le journal, les quêtes et l’historique des jets</label>
                    ${hb ? `<label><input type="checkbox" class="sio-hb" checked>
                        Joindre le contenu perso utilisé par la fiche (${hb.count})</label>` : ''}
                </div>
                <div class="sio-out" role="status"></div>
            </section>

            <section class="sio-body is-hidden" data-panel="import">
                <p class="sio-note">Dépose TON fichier. Il est lu ici, dans ton navigateur, et rien
                    n’en sort. Par défaut l’import crée un <b>nouveau personnage</b> : ta fiche
                    actuelle n’est pas touchée.</p>
                <div class="sio-drop" tabindex="0" role="button"
                     aria-label="Déposer un fichier de fiche">
                    <span class="sio-drop-ico" aria-hidden="true">📄</span>
                    <span class="sio-drop-main">Dépose un fichier ici</span>
                    <span class="sio-drop-sub">ou clique pour le choisir · .json</span>
                    <span class="sio-drop-fmt">Bones &amp; Blades · Foundry VTT (dnd5e) · D&amp;D Beyond</span>
                    <input type="file" class="sio-file" accept=".json,application/json" hidden>
                </div>
                <div class="sio-preview"></div>
            </section>
        </div>`;
    }

    function previewMarkup(plan) {
        const v = plan.view;
        const c = counts(v);
        const hasSheet = !!(window.SheetStore && window.SheetStore.activeId());
        return `<div class="sio-prev">
            <div class="sio-prev-head">
                <span class="sio-badge">${esc(plan.label)}</span>
                ${plan.exported ? `<span class="sio-prev-date">exporté le ${esc(new Date(plan.exported).toLocaleDateString('fr-FR'))}</span>` : ''}
            </div>
            <div class="sio-sheet">
                <b>${esc(plan.name)}</b>
                <span>niveau ${plan.level}${plan.className ? ' · ' + esc(plan.className) : ''}${v.subclass ? ' · ' + esc(v.subclass) : ''}</span>
                ${c.length ? `<span class="sio-counts">${esc(c.join(' · '))}</span>` : ''}
            </div>
            <dl class="sio-facts">
                ${[['Caractéristiques', ABILITIES.map(a => `${ABILITY_FR[a].slice(0, 3)} ${v.abilities[a]}`).join(' · ')],
                   ['Points de vie', v.hp.max ? `${v.hp.value} / ${v.hp.max}` : '—'],
                   ['Compétences maîtrisées', Object.keys(SKILLS).filter(k => v.skills[k]).map(k => SKILL_FR[k]).join(', ') || '—'],
                   ['Bourse', Object.keys(v.coins).filter(k => v.coins[k]).map(k => `${v.coins[k]} ${k}`).join(' · ') || '—']]
                    .map(([k, val]) => `<div><dt>${esc(k)}</dt><dd>${esc(val)}</dd></div>`).join('')}
            </dl>
            ${plan.warn ? `<p class="sio-warn">⚠️ ${esc(plan.warn)}</p>` : ''}
            ${plan.homebrew ? `<p class="sio-note">📚 Le fichier apporte du contenu perso : il ira dans
                <b>ta bibliothèque locale</b>, jamais sur le cloud.</p>` : ''}
            ${plan.notes.length ? `<div class="sio-lost">
                <div class="sio-lost-head">Ce qui ne sera pas repris</div>
                <ul>${plan.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
            </div>` : ''}
            <div class="sio-modes">
                <label><input type="radio" name="sio-mode" value="new" checked>
                    <b>Créer un nouveau personnage</b><i>Ta fiche actuelle n’est pas touchée.</i></label>
                <label class="${hasSheet ? '' : 'is-off'}">
                    <input type="radio" name="sio-mode" value="overwrite" ${hasSheet ? '' : 'disabled'}>
                    <b>Écraser la fiche ouverte</b><i>${hasSheet
                        ? 'Le contenu actuel de cette fiche est remplacé. Sans retour en arrière.'
                        : 'Aucune fiche n’est ouverte.'}</i></label>
            </div>
            <div class="sio-actions">
                <button type="button" class="sio-btn sio-btn-ghost" data-act="cancel-import">Annuler</button>
                <button type="button" class="sio-btn sio-btn-main" data-act="do-import">✦ Importer</button>
            </div>
        </div>`;
    }

    async function open(startTab) {
        const S = window.SheetStore;
        if (!S) { alert('Le stockage n’est pas prêt.'); return; }
        if (!S.activeId()) { alert('Ouvre d’abord une fiche de personnage.'); return; }

        document.getElementById('sheet-io')?.remove();
        const dump = await S.dump();
        const view = sheetView(dump);

        const ov = document.createElement('div');
        ov.id = 'sheet-io';
        ov.className = 'no-print';
        ov.setAttribute('role', 'dialog');
        ov.setAttribute('aria-modal', 'true');
        ov.setAttribute('aria-label', 'Exporter ou importer une fiche');
        ov.innerHTML = markup(view, S.meta());
        document.body.appendChild(ov);

        const out = ov.querySelector('.sio-out');
        const prev = ov.querySelector('.sio-preview');
        const say = (html, cls) => { out.className = 'sio-out' + (cls ? ' ' + cls : ''); out.innerHTML = html; };

        const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); document.removeEventListener('keydown', onKey, true); close(); } };
        document.addEventListener('keydown', onKey, true);

        // ---------- Export ----------
        const doExport = async (kind) => {
            const withPrivate = !!ov.querySelector('.sio-private')?.checked;
            const hbBox = ov.querySelector('.sio-hb');
            const fresh = await S.dump();
            const v = sheetView(fresh);
            if (kind === 'home') {
                const hb = (hbBox && hbBox.checked) ? referencedHomebrew(v) : null;
                const obj = buildHome(fresh, S.meta(), {
                    withPrivate, homebrew: hb ? { format: 'bones-and-blades/homebrew', version: 1, content: hb.content } : null
                });
                download('Fiche de ' + safeFileName(v.name) + '.json', JSON.stringify(obj, null, 1));
                say(`✅ <b>${esc(v.name)}</b> exportée. Rien n’a été laissé de côté : ce fichier
                     revient à l’identique par « Importer ».`, 'is-ok');
            } else {
                const { actor, lost } = toFoundry(v);
                download('fvtt-Actor-' + safeFileName(v.name) + '.json', JSON.stringify(actor, null, 1));
                say(`✅ Acteur Foundry téléchargé — glisse-le dans l’onglet <b>Acteurs</b>.`
                    + (lost.length ? `<div class="sio-lost"><div class="sio-lost-head">Ce que la traduction laisse derrière</div>
                        <ul>${lost.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>` : ''), 'is-ok');
            }
        };

        // ---------- Import ----------
        const showPlan = (plan) => {
            pending = plan;
            prev.innerHTML = previewMarkup(plan);
            prev.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        };
        const readFile = (file) => {
            if (!file) return;
            if (file.size > 25 * 1024 * 1024) { prev.innerHTML = `<p class="sio-err">Ce fichier fait plus de 25 Mo. Ce n’est pas une fiche.</p>`; return; }
            const fr = new FileReader();
            fr.onload = () => {
                try { showPlan(parse(String(fr.result))); }
                catch (err) { pending = null; prev.innerHTML = `<p class="sio-err">${esc(err.message)}</p>`; }
            };
            fr.onerror = () => { prev.innerHTML = `<p class="sio-err">Le fichier n’a pas pu être lu.</p>`; };
            fr.readAsText(file);
        };

        const drop = ov.querySelector('.sio-drop');
        const fileInput = ov.querySelector('.sio-file');
        drop.addEventListener('click', () => fileInput.click());
        drop.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
        });
        fileInput.addEventListener('change', () => { readFile(fileInput.files[0]); fileInput.value = ''; });
        ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, (e) => {
            e.preventDefault(); e.stopPropagation(); drop.classList.add('is-over');
        }));
        ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, (e) => {
            e.preventDefault(); e.stopPropagation(); drop.classList.remove('is-over');
        }));
        drop.addEventListener('drop', (e) => readFile(e.dataTransfer && e.dataTransfer.files[0]));

        // L'onglet d'ouverture suit l'entrée de menu cliquée.
        if (startTab === 'import') {
            ov.querySelectorAll('.sio-tab').forEach(t => t.classList.toggle('is-on', t.dataset.tab === 'import'));
            ov.querySelectorAll('.sio-body').forEach(b => b.classList.toggle('is-hidden', b.dataset.panel !== 'import'));
        }

        // ---------- Clics ----------
        ov.addEventListener('click', async (e) => {
            if (e.target === ov) return;
            const tab = e.target.closest('.sio-tab');
            if (tab) {
                ov.querySelectorAll('.sio-tab').forEach(t => t.classList.toggle('is-on', t === tab));
                ov.querySelectorAll('.sio-body').forEach(b =>
                    b.classList.toggle('is-hidden', b.dataset.panel !== tab.dataset.tab));
                return;
            }
            const card = e.target.closest('.sio-card');
            if (card) { await doExport(card.dataset.export); return; }

            const btn = e.target.closest('[data-act]');
            if (!btn) return;
            const act = btn.dataset.act;
            if (act === 'close') { document.removeEventListener('keydown', onKey, true); close(); return; }
            if (act === 'cancel-import') { pending = null; prev.innerHTML = ''; return; }
            if (act === 'do-import') {
                if (!pending) return;
                const mode = ov.querySelector('input[name="sio-mode"]:checked')?.value || 'new';
                if (mode === 'overwrite' && !confirm(
                    `Remplacer le contenu de la fiche ouverte par « ${pending.name} » ?\n\n`
                    + `C’est sans retour en arrière.`)) return;
                btn.disabled = true; btn.textContent = '⏳ Import…';
                try {
                    const r = await applyImport(pending, mode);
                    let msg = `✅ « ${pending.name} » importé.`;
                    if (r.hb && !r.hb.error) msg += ` ${plural((r.hb.added || 0) + (r.hb.replaced || 0), 'entrée perso ajoutée', 'entrées perso ajoutées')}.`;
                    if (r.hb && r.hb.error) msg += ` (contenu perso ignoré : ${r.hb.error})`;
                    prev.innerHTML = `<p class="sio-ok">${esc(msg)}</p>`;
                    setTimeout(() => S.open(r.charId), 900);
                } catch (err) {
                    btn.disabled = false; btn.textContent = '✦ Importer';
                    prev.insertAdjacentHTML('beforeend', `<p class="sio-err">${esc(err.message)}</p>`);
                }
            }
        });
    }

    // `buildHome` et `applyImport` sont exposés parce qu'ils resserviront :
    // le droit à la portabilité (RGPD) demande exactement ce fichier-là.
    window.SheetIO = { open, parse, buildHome, applyImport, toFoundry, sheetView,
                       referencedHomebrew, download, FORMAT, VERSION };
})();
