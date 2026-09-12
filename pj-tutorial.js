// =====================================================
// pj-tutorial.js — ASSISTANT DE CRÉATION du personnage
//
// Pas à pas : Nom → Niveau → Classe & sous-classe → Origine (espèce ou race,
// historique) → Caractéristiques, maîtrises & expertises → Équipement (sac,
// armes, armure) → Magie, si la classe en a à ce niveau.
//
// • Chaque option se consulte avant d'être retenue : un panneau d'aperçu
//   affiche sa fiche de règles, et les classes se comparent côte à côte.
// • « Remplissage automatique » (activé par défaut, mémorisé) déduit de la
//   règle ce qui peut l'être : jets de sauvegarde, PV, dés de vie, vitesse,
//   taille, formations, aptitudes et traits, emplacements de sorts, CA.
//   Désactivé, seuls les choix explicites sont écrits sur la fiche.
// • Chaque étape peut être passée : elle n'écrit alors rien.
//
// Les données viennent de window.SRD (l'édition choisie sur la page Règles)
// et du contenu personnel : une classe maison se comporte comme une officielle.
// Écriture : champs simples par setField (valeur + événements, la sauvegarde du
// site fait le reste) ; listes par window.SheetApi (script.js) ; armures par
// window.ArmorWidget (armor.js).
// =====================================================
(function () {
    'use strict';

    const WIZ_FLAG = 'dnd-pj-wizard-pending';   // posé par script.js à la création d'une fiche
    const AUTO_KEY = 'dnd-pj-wizard-auto';      // préférence du remplissage automatique

    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const num = (v, d = 0) => { const n = parseInt(v, 10); return isNaN(n) ? d : n; };
    const signed = (n) => (n < 0 ? '−' : '+') + Math.abs(n);
    const modOf = (v) => Math.floor((num(v, 10) - 10) / 2);
    const uniq = (arr) => [...new Set(arr)];
    const toast = (m) => { if (window.showAppToast) window.showAppToast(m); };
    const onSheet = () => { const a = $('app-screen'); return !!a && !a.classList.contains('hidden'); };
    const is2024 = () => !!(window.SRD && window.SRD.getEdition && window.SRD.getEdition() === '2024');
    // L'édition retenue dans l'assistant. Elle pilote les listes (SRD y est
    // posé par Edition.consulter) et n'est écrite sur le personnage qu'à la fin.
    const edWiz = () => wiz.data.edition || (window.Edition ? window.Edition.active() : '2024');
    const raceWord = () => (is2024() ? 'Espèce' : 'Race');

    function setField(id, value) {
        const el = $(id);
        if (!el || value === '' || value == null) return;
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function setCheck(id, on) {
        const el = $(id);
        if (!el || el.checked === !!on) return;
        el.checked = !!on;
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // ---------- Règles et libellés ----------
    const STATS = [['str', 'Force', 'FOR'], ['dex', 'Dextérité', 'DEX'], ['con', 'Constitution', 'CON'],
                   ['int', 'Intelligence', 'INT'], ['wis', 'Sagesse', 'SAG'], ['cha', 'Charisme', 'CHA']];
    const STAT_NAME = Object.fromEntries(STATS.map(s => [s[0], s[1]]));
    const ABIL = { force: 'str', dexterite: 'dex', constitution: 'con', intelligence: 'int', sagesse: 'wis', charisme: 'cha' };
    // [nom, identifiant du champ sur la fiche]
    const SKILLS = [['Acrobaties', 'acrobatics'], ['Arcanes', 'arcana'], ['Athlétisme', 'athletics'],
        ['Discrétion', 'stealth'], ['Dressage', 'animal'], ['Escamotage', 'sleight'], ['Histoire', 'history'],
        ['Intimidation', 'intimidation'], ['Intuition', 'insight'], ['Investigation', 'investigation'],
        ['Médecine', 'medicine'], ['Nature', 'nature'], ['Perception', 'perception'], ['Persuasion', 'persuasion'],
        ['Religion', 'religion'], ['Représentation', 'performance'], ['Survie', 'survival'], ['Tromperie', 'deception']];
    const SKILL = Object.fromEntries(SKILLS.map(s => [fold(s[0]), s]));
    const ALIGNEMENTS = ['Loyal Bon', 'Neutre Bon', 'Chaotique Bon', 'Loyal Neutre', 'Neutre',
                         'Chaotique Neutre', 'Loyal Mauvais', 'Neutre Mauvais', 'Chaotique Mauvais'];
    const POINT_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
    const STANDARD = [15, 14, 13, 12, 10, 8];
    const ICONS = {
        barbarian: '🪓', bard: '🎻', cleric: '☀️', druid: '🌿', fighter: '⚔️', monk: '👊', paladin: '🛡️',
        ranger: '🏹', rogue: '🗡️', sorcerer: '🔥', warlock: '👁️', wizard: '📜',
        dragonborn: '🐉', dwarf: '⛏️', elf: '🧝', gnome: '⚙️', goliath: '🗻', halfling: '🍀', human: '🧑',
        orc: '🐗', tiefling: '😈', 'half-elf': '🌗', 'half-orc': '💪',
        acolyte: '🕯️', criminal: '🗝️', sage: '📚', soldier: '🎖️'
    };
    // Ce que le SRD 5.1 ne donne pas en clair (le 5.2 le porte dans ses données).
    const SAVES = { barbarian: ['str', 'con'], bard: ['dex', 'cha'], cleric: ['wis', 'cha'], druid: ['int', 'wis'],
        fighter: ['str', 'con'], monk: ['str', 'dex'], paladin: ['wis', 'cha'], ranger: ['str', 'dex'],
        rogue: ['dex', 'int'], sorcerer: ['con', 'cha'], warlock: ['wis', 'cha'], wizard: ['int', 'wis'] };
    const SKILL_COUNT = { barbarian: 2, bard: 3, cleric: 2, druid: 2, fighter: 2, monk: 2, paladin: 2,
        ranger: 3, rogue: 4, sorcerer: 2, warlock: 2, wizard: 2 };
    // Formations : l légère, m intermédiaire, h lourde, s bouclier, S armes courantes, M armes de guerre
    const TRAINING = { barbarian: 'lmsSM', bard: 'lS', cleric: 'lmsS', druid: 'lmsS', fighter: 'lmhsSM',
        monk: 'S', paladin: 'lmhsSM', ranger: 'lmsSM', rogue: 'lS', sorcerer: '', warlock: 'lS', wizard: '' };
    const GENERIC_TRAITS = ['age', 'alignement', 'categorie de taille', 'taille', 'vitesse', 'langues',
        'augmentation de caracteristique', 'augmentation de caracteristiques'];

    // =====================================================
    // Indicateur de complétion — mesuré sur la VRAIE fiche : il sert à
    // proposer de reprendre une fiche inachevée.
    // =====================================================
    const COMPLETION = [
        { id: 'char-name', label: 'Nom' }, { id: 'char-class', label: 'Classe' },
        { id: 'char-race', label: 'Race' }, { id: 'char-background', label: 'Historique' },
        { id: 'char-alignment', label: 'Alignement' }, { key: 'stats', label: 'Caractéristiques' },
        { key: 'skills', label: 'Compétences maîtrisées' }, { id: 'hp-max', label: 'Points de vie' },
        { id: 'armor-class', label: 'Classe d’armure' }, { id: 'speed', label: 'Vitesse' },
        { id: 'hd-size', label: 'Dé de vie' }
    ];
    function completion() {
        const missing = [];
        COMPLETION.forEach(c => {
            let ok;
            if (c.key === 'stats') ok = STATS.some(s => (num(($('stat-' + s[0]) || {}).value, 8)) !== 8 && (num(($('stat-' + s[0]) || {}).value, 10)) !== 10);
            else if (c.key === 'skills') ok = SKILLS.some(s => num(($('prof-' + s[1]) || {}).value, 0) > 0);
            else { const el = $(c.id); ok = !!(el && String(el.value).trim()); }
            if (!ok) missing.push(c.label);
        });
        return { pct: Math.round((COMPLETION.length - missing.length) / COMPLETION.length * 100), missing };
    }

    // =====================================================
    // ÉTAT
    // =====================================================
    function newState() {
        let auto = true;
        try { auto = localStorage.getItem(AUTO_KEY) !== 'false'; } catch (e) {}
        return {
            step: 0, auto, skipped: new Set(), confirm: false,
            data: { name: '', level: 1, alignment: '', edition: '' },
            ids: { cls: '', sub: '', race: '', subrace: '', bg: '' },
            focus: null, compare: [],
            method: 'standard', base: {}, pool: null, addBonuses: true,
            boost: { mode: '21', plus2: '', plus1: '' },
            skills: [], expertise: [],
            gear: { cls: 'A', bg: 'A', extra: [] },
            spells: [], spellLevel: 'all', spellCache: {},
            lists: {}
        };
    }
    let wiz = newState();
    let root = null;

    const L = () => Math.max(1, Math.min(20, num(wiz.data.level, 1)));
    const pb = (l) => Math.floor((l - 1) / 4) + 2;
    const list = (name) => wiz.lists[name] || [];
    async function load(names) {
        await Promise.all(names.filter(n => !wiz.lists[n]).map(async n => {
            let l = [];
            try { l = await window.SRD.category(n); } catch (e) { l = []; }
            wiz.lists[n] = l || [];
        }));
    }
    const byName = (arr, name) => {
        const q = fold(name);
        if (!q) return null;
        return arr.find(e => fold(e.name) === q) || arr.find(e => q.length > 2 && fold(e.name).startsWith(q)) || null;
    };
    const cls = () => list('classes').find(c => c.id === wiz.ids.cls) || null;
    const sub = () => { const c = cls(); return c ? (c.subclasses || []).find(s => s.id === wiz.ids.sub) || null : null; };
    const race = () => list('races').find(r => r.id === wiz.ids.race) || null;
    const subrace = () => { const r = race(); return r ? (r.subraces || []).find(s => s.id === wiz.ids.subrace) || null : null; };
    const bg = () => list('backgrounds').find(b => b.id === wiz.ids.bg) || null;
    const info = (l, c) => {
        const k = c || cls();
        return k && window.SRD && window.SRD.levelInfo ? window.SRD.levelInfo(k, l || L(), c ? null : sub()) : null;
    };

    /** Niveau où la classe choisit sa sous-classe. */
    function subclassLevel(c) {
        const lv = (c.subclasses || []).flatMap(s => (s.features || []).map(f => num(f.level, 0))).filter(Boolean);
        if (lv.length) return Math.min(...lv);
        const row = (c.levels || []).find(r => (r.feature_labels || []).some(x =>
            /sous-classe|archetype|archétype|tradition|serment|college|collège|domaine|cercle|origine|voie|pacte|protecteur/i.test(x)));
        return row ? row.level : 3;
    }
    function savesOf(c) {
        const p = (c && c.proficiencies) || {};
        if ((p.saves || []).length) return p.saves.map(n => ABIL[fold(n)]).filter(Boolean);
        return (c && SAVES[c.id]) || [];
    }
    function classFacts(c) {
        const p = c.proficiencies || {};
        const cast = { full: 'Lanceur de sorts', half: 'Demi-lanceur', pact: 'Magie de pacte', third: 'Tiers-lanceur' }[(c.spellcasting || {}).type] || '';
        const sk = p.skills;
        return {
            die: c.hit_die ? 'd' + c.hit_die : '—',
            primary: c.primary_ability || '',
            saves: savesOf(c).map(k => STAT_NAME[k]).join(', '),
            cast,
            armor: p.armor || '',
            weapons: p.weapons || '',
            // « 4 au choix » plutôt que la liste entière : elle écraserait la comparaison.
            skills: sk ? (sk.choose ? sk.choose + ' au choix' : (sk.text || '')) : (SKILL_COUNT[c.id] ? SKILL_COUNT[c.id] + ' au choix' : '')
        };
    }

    // ---------- Magie ----------
    function magicInfo() {
        const i = info();
        if (!i) return null;
        const cs = i.class_specific || {};
        const slots = i.spell_slots || (cs.spell_slots_count ? { [cs.slot_level]: num(cs.spell_slots_count) } : null);
        const maxRank = slots ? Math.max(...Object.keys(slots).map(Number)) : 0;
        return {
            cantrips: i.cantrips_known != null && i.cantrips_known !== '' ? num(i.cantrips_known) : null,
            known: i.spells_known != null && i.spells_known !== '' ? num(i.spells_known) : null,
            slots, maxRank
        };
    }
    function isCaster() {
        if (!cls()) return false;
        const m = magicInfo();
        return !!(m && (m.cantrips || m.known || m.slots));
    }
    async function spellList() {
        const c = cls(), m = magicInfo();
        if (!c || !m) return [];
        const key = c.id + ':' + m.maxRank;
        if (!wiz.spellCache[key]) {
            try { wiz.spellCache[key] = await window.SRD.spellsForClass(c.id, m.maxRank); } catch (e) { wiz.spellCache[key] = []; }
        }
        return wiz.spellCache[key];
    }

    // ---------- Bonus de caractéristiques ----------
    function raceBonuses() {
        const out = {};
        const add = (k, v) => { if (k && v) out[k] = (out[k] || 0) + v; };
        [race(), subrace()].forEach(src => {
            if (!src) return;
            if (src.ability_bonuses) { Object.entries(src.ability_bonuses).forEach(([k, v]) => add(k, num(v))); return; }
            const t = (src.traits || []).find(x => /augmentation de caract/i.test(x.name));
            const txt = t ? [].concat(t.text).join(' ') : '';
            const all = txt.match(/chacune de vos valeurs de caract[ée]ristique augmente de (\d)/i);
            if (all) { STATS.forEach(s => add(s[0], num(all[1]))); return; }
            for (const m of txt.matchAll(/valeur (?:de |d[’'])(force|dext[ée]rit[ée]|constitution|intelligence|sagesse|charisme) augmente de (\d)/gi)) {
                add(ABIL[fold(m[1])], num(m[2]));
            }
        });
        return out;
    }
    /** 2024 : l'historique donne +2/+1 ou +1/+1/+1 parmi trois caractéristiques. */
    const boostChoices = () => ((bg() || {}).ability_scores || []).map(n => ABIL[fold(n)]).filter(Boolean);
    function bgBoosts() {
        const allowed = boostChoices();
        const out = {};
        if (allowed.length !== 3) return out;
        if (wiz.boost.mode === '111') { allowed.forEach(k => { out[k] = 1; }); return out; }
        if (allowed.includes(wiz.boost.plus2)) out[wiz.boost.plus2] = 2;
        if (allowed.includes(wiz.boost.plus1) && wiz.boost.plus1 !== wiz.boost.plus2) out[wiz.boost.plus1] = 1;
        return out;
    }
    function bonuses() {
        if (!wiz.addBonuses) return {};
        const a = raceBonuses(), b = bgBoosts(), out = {};
        STATS.forEach(([k]) => { const v = (a[k] || 0) + (b[k] || 0); if (v) out[k] = v; });
        return out;
    }
    const final = (k) => (wiz.base[k] == null ? null : Math.min(20, wiz.base[k] + (bonuses()[k] || 0)));
    const pointsSpent = () => STATS.reduce((n, s) => n + (POINT_COST[wiz.base[s[0]]] || 0), 0);
    const roll4d6 = () => {
        const d = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6)).sort((a, b) => b - a);
        return d[0] + d[1] + d[2];
    };

    // ---------- Compétences ----------
    function skillChoice() {
        const c = cls();
        const sk = ((c && c.proficiencies) || {}).skills || {};
        const from = sk.from && sk.from.length
            ? sk.from.map(n => (SKILL[fold(n)] || [])[0]).filter(Boolean)
            : SKILLS.map(s => s[0]);
        return { n: num(sk.choose, 0) || (c ? SKILL_COUNT[c.id] || 0 : 0), from };
    }
    const bgSkills = () => (((bg() || {}).proficiencies || {}).skills || []).map(n => (SKILL[fold(n)] || [])[0]).filter(Boolean);
    const proficientSkills = () => uniq([...bgSkills(), ...wiz.skills]);
    function expertiseSlots() {
        if (!cls()) return 0;
        let n = 0;
        for (let l = 1; l <= L(); l++) {
            const i = info(l);
            if (i) i.features.forEach(f => { if (/^expertise\b/i.test(f.name)) n += 2; });
        }
        return n;
    }

    // ---------- Équipement ----------
    /** ["(A) Hache, 4 hachettes et 15 po", "(B) 75 po"] -> options découpées. */
    function gearOptions(src) {
        const items = (src && src.equipment && src.equipment.items) || [];
        return items.map((raw, i) => {
            const m = String(raw).match(/^\(([A-Z])\)\s*(.*)$/);
            const text = m ? m[2] : String(raw);
            return { key: m ? m[1] : String.fromCharCode(65 + i), text, parts: splitGear(text) };
        });
    }
    const splitGear = (text) => String(text)
        .replace(/\s+et\s+(?=[^,;]*$)/, ', ')
        .split(/\s*[,;+]\s*/).map(s => s.trim()).filter(Boolean);

    function matchEquipment(label) {
        const eq = list('equipment');
        const base = fold(String(label).replace(/\s*\(.*?\)\s*/g, ' '));
        const tries = [base, base.replace(/s\b/g, ''), base.replace(/x\b/g, ''), base.replace(/(e?s|x)$/, '')];
        for (const t of tries) { const e = eq.find(x => fold(x.name) === t); if (e) return e; }
        return null;
    }
    /** Morceaux d'équipement -> armes, armures, objets, pièces. */
    function classify(parts) {
        const out = { weapons: [], armors: [], gear: [], coins: {} };
        parts.forEach(tok => {
            const coin = tok.match(/^(\d[\d\s]*)\s*(pc|pa|pe|po|pp)$/i);
            if (coin) { const k = coin[2].toLowerCase(); out.coins[k] = (out.coins[k] || 0) + num(coin[1].replace(/\s/g, '')); return; }
            const q = tok.match(/^(\d+)\s+(.+)$/);
            const label = q ? q[2] : tok;
            const srd = matchEquipment(label);
            const entry = { label: label.charAt(0).toUpperCase() + label.slice(1), qty: q ? num(q[1], 1) : 1, srd };
            if (srd && srd.category === 'weapon') out.weapons.push(entry);
            else if (srd && srd.category === 'armor') out.armors.push(entry);
            else out.gear.push(entry);
        });
        return out;
    }
    function chosenGear() {
        const parts = [];
        [['cls', cls()], ['bg', bg()]].forEach(([who, src]) => {
            const o = gearOptions(src).find(x => x.key === wiz.gear[who]);
            if (o) parts.push(...o.parts);
        });
        const g = classify(parts);
        wiz.gear.extra.forEach(id => {
            const e = list('equipment').find(x => x.id === id);
            if (!e) return;
            const entry = { label: e.name, qty: 1, srd: e };
            (e.category === 'weapon' ? g.weapons : e.category === 'armor' ? g.armors : g.gear).push(entry);
        });
        // La classe et l'historique peuvent donner le même objet (2 dagues + 2 dagues) : on additionne.
        ['weapons', 'armors', 'gear'].forEach(kind => {
            const merged = [];
            g[kind].forEach(x => {
                const same = merged.find(y => (x.srd && y.srd) ? x.srd.id === y.srd.id : fold(y.label) === fold(x.label));
                if (same) same.qty += x.qty; else merged.push(Object.assign({}, x));
            });
            g[kind] = merged;
        });
        return g;
    }
    const itemOf = (x) => ({
        name: x.label, qty: x.qty,
        weight: x.srd && x.srd.weight_kg != null ? x.srd.weight_kg : '',
        value: x.srd ? (x.srd.cost || '') : '',
        desc: x.srd && x.srd.desc ? [].concat(x.srd.desc).join('\n\n') : ''
    });

    // ---------- Traits et dons ----------
    function findFeat(label) {
        const base = fold(String(label || '').replace(/\(.*?\)/g, ''));
        return list('feats').find(f => fold(f.name) === base) || null;
    }
    function classTraits() {
        const out = [], seen = new Set();
        for (let l = 1; l <= L(); l++) {
            const i = info(l);
            if (!i) continue;
            i.features.forEach(f => {
                const text = Array.isArray(f.text) ? f.text : (f.text ? [f.text] : []);
                if (!text.length && /aptitude de sous-classe/i.test(f.name)) return;
                if (seen.has(f.name)) return;
                seen.add(f.name);
                out.push({ name: f.name, type: 'class', level: l, desc: text });
            });
        }
        return out;
    }
    const speciesTraits = () => [race(), subrace()].filter(Boolean).flatMap(src =>
        (src.traits || []).filter(t => !GENERIC_TRAITS.includes(fold(t.name)))
            .map(t => ({ name: t.name, type: 'race', desc: t.text })));
    function featTraits() {
        const b = bg();
        if (!b || !b.feat) return [];
        const ft = findFeat(b.feat);
        const precision = (String(b.feat).match(/\(.*?\)/) || [''])[0];
        return [{ name: (ft ? ft.name : b.feat.replace(/\(.*?\)/g, '').trim()) + (precision ? ' ' + precision : ''),
                  type: FEAT_TYPE, desc: ft ? ft.desc : [`Don accordé par l’historique ${b.name}.`] }];
    }
    const FEAT_TYPE = 'feat';
    function traitValue(srcs, nameRx, valueRx) {
        for (const s of srcs) {
            const t = (s.traits || []).find(x => nameRx.test(fold(x.name)));
            const m = t && [].concat(t.text).join(' ').match(valueRx);
            if (m) return m[1];
        }
        return '';
    }
    function sizeCode(txt) {
        const t = String(txt || '');
        const first = t.match(/^(TP|P|M|G|TG|Gig)\b/);
        if (first) return first[1] + ((t.match(/\bou (P|M)\b/) || [])[1] ? ' ou ' + t.match(/\bou (P|M)\b/)[1] : '');
        if (/moyenne/i.test(t)) return 'M';
        if (/petite/i.test(t)) return 'P';
        return '';
    }

    // =====================================================
    // RENDU
    // =====================================================
    function steps() {
        const s = [
            { key: 'name', label: 'Nom', icon: '✒️', hint: 'Entrée pour continuer.' },
            { key: 'level', label: 'Niveau', icon: '📈', hint: 'Le niveau fixe les aptitudes, les PV et la magie disponibles.' },
            { key: 'class', label: 'Classe', icon: '⚔️', hint: 'Clique une classe pour lire sa fiche · coche « Comparer » pour en voir plusieurs côte à côte.' },
            { key: 'origin', label: 'Origine', icon: '🧬', hint: 'Chaque option se lit dans l’aperçu avant d’être retenue.' },
            { key: 'abilities', label: 'Caractéristiques', icon: '💪', hint: 'Caractéristiques, jets de sauvegarde, compétences et expertises.' },
            { key: 'gear', label: 'Équipement', icon: '🎒', hint: 'Sac, armes et armure : clique un objet souligné pour lire sa fiche.' }
        ];
        if (isCaster()) s.push({ key: 'magic', label: 'Magie', icon: '✨', hint: 'Clique le nom d’un sort pour le lire, ✓ pour le retenir.' });
        return s;
    }

    const optCard = (pick, x, subtitle, on, extra) => `
        <button type="button" class="pjw-opt${on ? ' is-on' : ''}" data-pick="${pick}" data-id="${esc(x.id)}" aria-pressed="${on}">
            <span class="pjw-opt-ico" aria-hidden="true">${ICONS[x.id] || '📘'}</span>
            <span class="pjw-opt-txt"><b>${esc(x.name)}</b>${subtitle ? `<small>${esc(subtitle)}</small>` : ''}</span>
            ${x.source === 'perso' ? '<span class="pjw-tag">perso</span>' : (extra || '')}
        </button>`;

    function findEntry(cat, id) {
        if (cat === 'classes') {
            for (const c of list('classes')) {
                if (c.id === id) return c;
                const s = (c.subclasses || []).find(x => x.id === id);
                if (s) return Object.assign({}, s, { parent: c.id, parent_name: c.name });
            }
            return null;
        }
        if (cat === 'races') {
            for (const r of list('races')) {
                if (r.id === id) return r;
                const s = (r.subraces || []).find(x => x.id === id);
                if (s) return Object.assign({}, s, { parent: r.id, parent_name: r.name });
            }
            return null;
        }
        if (cat === 'spells') return Object.values(wiz.spellCache).flat().find(s => s.id === id) || null;
        return list(cat).find(x => x.id === id) || null;
    }
    const KICKER = { classes: 'Classe', races: 'Origine', backgrounds: 'Historique', feats: 'Don', spells: 'Sort', equipment: 'Équipement' };

    function previewHtml() {
        const f = wiz.focus;
        const entry = f && findEntry(f.cat, f.id);
        if (!entry || !window.SRD) {
            return `<div class="pjw-preview-empty"><span aria-hidden="true">👁️</span>
                <p>Clique une option pour lire sa fiche de règles avant de la choisir.</p></div>`;
        }
        let top = '', extra = '';
        if (f.cat === 'classes' && entry.levels) {
            const rows = [];
            for (let l = 1; l <= L(); l++) {
                const i = window.SRD.levelInfo(entry, l, entry.id === wiz.ids.cls ? sub() : null);
                const names = i ? i.features.map(x => x.name) : [];
                if (names.length) rows.push(`<li><em>niv. ${l}</em> ${esc(names.join(', '))}</li>`);
            }
            if (rows.length) top = `<div class="pjw-atlevel"><b>Jusqu’au niveau ${L()}</b><ul>${rows.join('')}</ul></div>`;
        }
        if (f.cat === 'backgrounds' && entry.feat) {
            const ft = findFeat(entry.feat);
            if (ft) extra = `<h4 class="rw-h">Don : ${esc(ft.name)}</h4><div class="pjw-rules">${window.SRD.renderEntry('feats', ft)}</div>`;
        }
        const kicker = entry.parent_name ? `${KICKER[f.cat]} · ${entry.parent_name}` : KICKER[f.cat];
        return `<div class="pjw-preview-head"><span class="pjw-preview-kicker">${esc(kicker)}</span><h3>${esc(entry.name)}</h3></div>
            ${top}<div class="pjw-rules">${window.SRD.renderEntry(f.cat, entry)}</div>${extra}`;
    }

    function compareHtml() {
        const cs = wiz.compare.map(id => list('classes').find(c => c.id === id)).filter(Boolean);
        const rows = [
            ['Dé de vie', c => classFacts(c).die],
            ['Caractéristique principale', c => classFacts(c).primary || '—'],
            ['Jets de sauvegarde', c => classFacts(c).saves || '—'],
            ['Compétences', c => classFacts(c).skills || '—'],
            ['Armures', c => classFacts(c).armor || '—'],
            ['Armes', c => classFacts(c).weapons || '—'],
            ['Magie', c => classFacts(c).cast || 'Aucune'],
            ['Sous-classe', c => ((c.subclasses || []).length ? 'au niveau ' + subclassLevel(c) : '—')],
            ['Au niveau 1', c => { const i = info(1, c); return i && i.features.length ? i.features.map(f => f.name).join(', ') : '—'; }]
        ];
        return `<div class="pjw-preview-head"><span class="pjw-preview-kicker">Comparaison</span>
                <h3>${cs.map(c => esc(c.name)).join(' · ')}</h3></div>
            <div class="rw-scroll"><table class="pjw-compare">
                <thead><tr><th></th>${cs.map(c => `<th scope="col">${ICONS[c.id] || '📘'} ${esc(c.name)}</th>`).join('')}</tr></thead>
                <tbody>${rows.map(([lbl, fn]) => `<tr><th scope="row">${lbl}</th>${cs.map(c => `<td>${esc(fn(c))}</td>`).join('')}</tr>`).join('')}</tbody>
            </table></div>
            <button type="button" class="pjw-btn" data-pjw="compare-clear">Fermer la comparaison</button>`;
    }

    // ---------- Étape 1 : nom ----------
    function nameStep() {
        return `<section class="pjw-solo">
            <p class="pjw-lead">Chaque grande aventure commence par un nom.</p>
            <label class="pjw-lbl" for="pjw-name">Nom du personnage</label>
            <input id="pjw-name" class="pjw-in pjw-in-xl" data-field="name" value="${esc(wiz.data.name)}" placeholder="Thorgrim, Lyra Vent-d’Argent…" autocomplete="off">
            <p class="pjw-note">Tout reste modifiable ensuite, directement sur la fiche.</p>
            ${editionChoice()}
            <div class="pjw-card-auto">
                <b>⚙️ Remplissage automatique : ${wiz.auto ? 'activé' : 'désactivé'}</b><br>
                ${wiz.auto
                    ? 'À la fin, l’assistant déduit de la règle ce qui peut l’être : jets de sauvegarde, points de vie, dés de vie, vitesse, taille, formations, aptitudes, traits, emplacements de sorts et classe d’armure.'
                    : 'Seuls tes choix explicites seront écrits : identité, caractéristiques, compétences, équipement et sorts retenus.'}
                Le bouton en haut à droite le règle à tout moment.
            </div>
            <p class="pjw-note">Ton contenu personnel (classes, espèces, sorts créés dans « Mon contenu ») est proposé comme le contenu officiel.</p>
        </section>`;
    }

    /** Les règles de ce héros : 2014 ou 2024. Présélection 2024 pour un nouveau
     *  personnage ; une fiche qui a déjà choisi garde son choix. Le reste du site
     *  (loupe, montée de niveau, impression, bottes d'armes) suivra. */
    function editionChoice() {
        if (!window.Edition) return '';
        const cur = edWiz();
        const opt = (id, titre, sous) =>
            `<button type="button" class="pjw-ed${id === cur ? ' is-on' : ''}" data-pick="edition" data-id="${id}"
                     role="radio" aria-checked="${id === cur}"><b>${titre}</b><small>${sous}</small></button>`;
        return `<div class="pjw-edbox">
            <span class="pjw-lbl">Édition des règles</span>
            <div class="pjw-eds" role="radiogroup" aria-label="Édition des règles">
                ${opt('2024', 'Règles 2024', 'Espèces, dons d’origine, bottes d’armes')}
                ${opt('2014', 'Règles 2014', 'Races, historiques classiques')}
            </div>
            <p class="pjw-note">Elle vaut pour ce personnage seul, et se change plus tard dans les options de la fiche.</p>
        </div>`;
    }

    // ---------- Étape 2 : niveau ----------
    function levelStep() {
        const l = L();
        const tier = l <= 4 ? ['Apprenti', 'Les premières aventures, au service d’un village ou d’une guilde.']
            : l <= 10 ? ['Héros', 'Des menaces qui pèsent sur des royaumes entiers.']
            : l <= 16 ? ['Maître', 'Le destin des nations entre tes mains.']
            : ['Légende', 'Les plans, et les dieux eux-mêmes.'];
        return `<section class="pjw-solo">
            <p class="pjw-lead">À quel niveau commence ton personnage ?</p>
            <div class="pjw-levels" role="radiogroup" aria-label="Niveau">${Array.from({ length: 20 }, (_, i) => i + 1).map(n =>
                `<button type="button" class="pjw-lvl${n === l ? ' is-on' : ''}" data-pick="level" data-id="${n}" role="radio" aria-checked="${n === l}">${n}</button>`).join('')}</div>
            <div class="pjw-facts">
                <div><span>Bonus de maîtrise</span><b>${signed(pb(l))}</b></div>
                <div><span>Palier</span><b>${tier[0]}</b></div>
            </div>
            <p class="pjw-note">${tier[1]} ${l > 1
                ? 'Avec le remplissage automatique, les points de vie et les aptitudes de tous les niveaux gagnés sont calculés.'
                : 'La plupart des tables commencent au niveau 1.'}</p>
        </section>`;
    }

    // ---------- Étape 3 : classe & sous-classe ----------
    function classStep() {
        const classes = list('classes'), c = cls(), l = L();
        const cards = classes.map(x => {
            const f = classFacts(x), on = x.id === wiz.ids.cls, cmp = wiz.compare.includes(x.id);
            return `<div class="pjw-optwrap">
                ${optCard('class', x, [f.die, f.primary].filter(Boolean).join(' · ') || 'Classe', on, f.cast ? '<span class="pjw-tag" title="Lance des sorts">✨</span>' : '')}
                <label class="pjw-cmp"><input type="checkbox" data-compare="${esc(x.id)}"${cmp ? ' checked' : ''}${!cmp && wiz.compare.length >= 3 ? ' disabled' : ''}> Comparer</label>
            </div>`;
        }).join('');
        let subs = '';
        if (c && (c.subclasses || []).length) {
            const at = subclassLevel(c);
            subs = l >= at
                ? `<h3 class="pjw-h">Sous-classe <small>dès le niveau ${at}</small></h3>
                   <div class="pjw-grid pjw-grid-sm">${c.subclasses.map(s => optCard('sub', Object.assign({}, s, { id: s.id }),
                        (s.features || []).length ? `${s.features.length} aptitude${s.features.length > 1 ? 's' : ''}` : 'Sous-classe', s.id === wiz.ids.sub)).join('')}</div>
                   <p class="pjw-note">Le SRD ne publie qu’une sous-classe par classe ; les tiennes (« Mon contenu ») apparaissent aussi.</p>`
                : `<p class="pjw-note">🔒 ${esc(c.name)} choisit sa sous-classe au niveau ${at}. Tu es niveau ${l} : elle viendra avec la montée de niveau.</p>`;
        }
        return `<div class="pjw-split">
            <section class="pjw-pane">
                <p class="pjw-lead">Quelle voie suis-tu ?</p>
                <div class="pjw-grid">${cards || '<p class="pjw-note">Les règles ne sont pas disponibles hors connexion : écris ta classe directement sur la fiche.</p>'}</div>
                ${subs}
            </section>
            <aside class="pjw-preview" aria-live="polite">${wiz.compare.length >= 2 ? compareHtml() : previewHtml()}</aside>
        </div>`;
    }

    // ---------- Étape 4 : origine ----------
    function raceSubtitle(x) {
        if (x.size || x.speed) return [x.size ? 'Taille ' + sizeCode(x.size) : '', x.speed || ''].filter(Boolean).join(' · ');
        const saved = { race: wiz.ids.race, subrace: wiz.ids.subrace };
        wiz.ids.race = x.id; wiz.ids.subrace = '';
        const b = raceBonuses();
        wiz.ids.race = saved.race; wiz.ids.subrace = saved.subrace;
        return Object.entries(b).map(([k, v]) => `${STATS.find(s => s[0] === k)[2]} ${signed(v)}`).join(', ');
    }
    function originStep() {
        const r = race();
        const bgSub = (x) => (x.ability_scores || []).length
            ? `${x.ability_scores.map(n => (STATS.find(s => s[0] === ABIL[fold(n)]) || [])[2]).filter(Boolean).join(', ')}${x.feat ? ' · ' + x.feat.replace(/\s*\(cf\..*$/, '') : ''}`
            : 'Historique';
        return `<div class="pjw-split">
            <section class="pjw-pane">
                <h3 class="pjw-h">${raceWord()}</h3>
                <div class="pjw-grid pjw-grid-sm">${list('races').map(x => optCard('race', x, raceSubtitle(x), x.id === wiz.ids.race)).join('')
                    || '<p class="pjw-note">Aucune donnée : écris-la sur la fiche.</p>'}</div>
                ${r && (r.subraces || []).length ? `<h3 class="pjw-h">Sous-race</h3>
                    <div class="pjw-grid pjw-grid-sm">${r.subraces.map(x => optCard('subrace', x, raceSubtitle(x), x.id === wiz.ids.subrace)).join('')}</div>` : ''}
                <h3 class="pjw-h">Historique</h3>
                <div class="pjw-grid pjw-grid-sm">${list('backgrounds').map(x => optCard('bg', x, bgSub(x), x.id === wiz.ids.bg)).join('')}</div>
                <p class="pjw-note">Le SRD ne publie qu’une partie des ${is2024() ? 'espèces' : 'races'} et des historiques ; ceux de « Mon contenu » apparaissent ici aussi.</p>
                <label class="pjw-lbl" for="pjw-align">Alignement</label>
                <select id="pjw-align" class="pjw-in" data-field="alignment">
                    <option value="">— Non précisé —</option>
                    ${ALIGNEMENTS.map(a => `<option${a === wiz.data.alignment ? ' selected' : ''}>${a}</option>`).join('')}
                </select>
            </section>
            <aside class="pjw-preview" aria-live="polite">${previewHtml()}</aside>
        </div>`;
    }

    // ---------- Étape 5 : caractéristiques, maîtrises, expertises ----------
    function methodNote() {
        if (wiz.method === 'points') {
            const left = 27 - pointsSpent();
            return `Achat à 27 points : chaque valeur va de 8 à 15 (14 coûte 7, 15 coûte 9).
                <b class="${left < 0 ? 'pjw-warn' : ''}">Reste ${left} point${Math.abs(left) > 1 ? 's' : ''}.</b>`;
        }
        if (wiz.method === 'standard') return 'Place <b>15, 14, 13, 12, 10 et 8</b>, une valeur par caractéristique.';
        if (wiz.method === 'roll') {
            return wiz.pool
                ? `Tirage : <b>${wiz.pool.join(', ')}</b>. Place ces valeurs où tu veux. <button type="button" class="pjw-btn pjw-mini" data-pjw="reroll">🎲 Relancer</button>`
                : `<button type="button" class="pjw-btn pjw-mini" data-pjw="reroll">🎲 Lancer 6 × 4d6 (on garde les 3 meilleurs)</button>`;
        }
        return `Saisis tes valeurs de 3 à 20. <label class="pjw-inline"><input type="checkbox" data-pjw-bonuses${wiz.addBonuses ? ' checked' : ''}> Ajouter les bonus d’origine</label>`;
    }
    function statRow([k, label, abbr], b) {
        const base = wiz.base[k];
        let ctl;
        if (wiz.method === 'points' || wiz.method === 'manual') {
            const [min, max] = wiz.method === 'points' ? [8, 15] : [3, 20];
            ctl = `<div class="pjw-stepper">
                <button type="button" data-pjw="stat-dec" data-k="${k}" aria-label="Diminuer ${label}">−</button>
                <input type="number" class="pjw-in" data-score="${k}" min="${min}" max="${max}" value="${base == null ? '' : base}" aria-label="${label}">
                <button type="button" data-pjw="stat-inc" data-k="${k}" aria-label="Augmenter ${label}">+</button></div>`;
        } else {
            const pool = wiz.method === 'standard' ? STANDARD : (wiz.pool || []);
            const avail = pool.slice();
            STATS.filter(o => o[0] !== k).map(o => wiz.base[o[0]]).filter(v => v != null)
                .forEach(v => { const i = avail.indexOf(v); if (i >= 0) avail.splice(i, 1); });
            const opts = uniq((base != null ? [base] : []).concat(avail)).sort((x, y) => y - x);
            ctl = `<select class="pjw-in" data-score="${k}" aria-label="${label}"${pool.length ? '' : ' disabled'}>
                <option value="">—</option>${opts.map(v => `<option value="${v}"${v === base ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
        }
        const total = final(k);
        return `<div class="pjw-statrow">
            <span class="pjw-stat-name"><b>${abbr}</b> ${label}</span>${ctl}
            <span class="pjw-bonus">${b[k] ? signed(b[k]) : ''}</span>
            <b class="pjw-total">${total == null ? '—' : total}</b>
            <span class="pjw-mod">${total == null ? '' : signed(modOf(total))}</span>
        </div>`;
    }
    function boostHtml() {
        const allowed = boostChoices(), b = bg();
        if (allowed.length === 3) {
            const opt = (sel) => `<option value="">—</option>${allowed.map(k => `<option value="${k}"${sel === k ? ' selected' : ''}>${STAT_NAME[k]}</option>`).join('')}`;
            return `<div class="pjw-boost"><b>Historique ${esc(b.name)}</b> : augmente ${allowed.map(k => STAT_NAME[k]).join(', ')}.
                <div class="pjw-boost-modes" role="radiogroup">
                    <label><input type="radio" name="pjw-boost" data-boost-mode="21"${wiz.boost.mode !== '111' ? ' checked' : ''}> +2 et +1</label>
                    <label><input type="radio" name="pjw-boost" data-boost-mode="111"${wiz.boost.mode === '111' ? ' checked' : ''}> +1 à chacune</label>
                </div>
                ${wiz.boost.mode !== '111' ? `<div class="pjw-2col">
                    <label class="pjw-lbl">+2<select class="pjw-in" data-boost="plus2">${opt(wiz.boost.plus2)}</select></label>
                    <label class="pjw-lbl">+1<select class="pjw-in" data-boost="plus1">${opt(wiz.boost.plus1)}</select></label></div>` : ''}
            </div>`;
        }
        const rb = raceBonuses();
        return Object.keys(rb).length
            ? `<div class="pjw-boost"><b>${raceWord()}</b> : ${Object.entries(rb).map(([k, v]) => `${STAT_NAME[k]} ${signed(v)}`).join(', ')}, ajouté automatiquement.</div>`
            : '';
    }
    function abilitiesStep() {
        const b = bonuses(), c = cls(), choice = skillChoice(), fromBg = bgSkills();
        const expSlots = expertiseSlots();
        const saves = c ? savesOf(c) : [];
        const chosen = wiz.skills.filter(s => !fromBg.includes(s));
        const tabs = [['standard', 'Tableau standard'], ['points', 'Achat (27 points)'], ['roll', '4d6'], ['manual', 'Saisie libre']];
        const skillChip = ([name]) => {
            if (fromBg.includes(name)) return `<span class="pjw-chip is-on is-locked" title="Apportée par l’historique">● ${name} <small>historique</small></span>`;
            const on = wiz.skills.includes(name);
            const allowed = choice.from.includes(name);
            const full = choice.n && chosen.length >= choice.n;
            return `<button type="button" class="pjw-chip${on ? ' is-on' : ''}" data-pick="skill" data-id="${esc(name)}" aria-pressed="${on}"${!on && (!allowed || full) ? ' disabled' : ''}>${on ? '●' : '○'} ${name}</button>`;
        };
        return `<div class="pjw-split pjw-split-even">
            <section class="pjw-pane">
                <h3 class="pjw-h">Caractéristiques</h3>
                <div class="pjw-tabs" role="tablist">${tabs.map(([k, l]) =>
                    `<button type="button" class="pjw-tab${wiz.method === k ? ' is-on' : ''}" data-pjw="method" data-method="${k}" role="tab" aria-selected="${wiz.method === k}">${l}</button>`).join('')}</div>
                <p class="pjw-note">${methodNote()}</p>
                ${boostHtml()}
                <div class="pjw-stats">
                    <div class="pjw-stats-head"><span></span><span>Valeur</span><span>Bonus</span><span>Total</span><span>Mod.</span></div>
                    ${STATS.map(s => statRow(s, b)).join('')}
                </div>
            </section>
            <section class="pjw-pane">
                <h3 class="pjw-h">Jets de sauvegarde</h3>
                <div class="pjw-chips">${STATS.map(([k, label]) => saves.includes(k)
                    ? `<span class="pjw-chip is-on is-locked">● ${label}</span>` : `<span class="pjw-chip is-off">○ ${label}</span>`).join('')}</div>
                <p class="pjw-note">${c ? `Maîtrises de ${esc(c.name)}${wiz.auto ? ', cochées automatiquement.' : ' (remplissage automatique désactivé : à cocher sur la fiche).'}` : 'Choisis une classe pour connaître tes jets de sauvegarde.'}</p>
                <h3 class="pjw-h">Compétences <small>${choice.n ? `${chosen.length} / ${choice.n} au choix` : 'au choix'}</small></h3>
                <div class="pjw-chips">${SKILLS.map(skillChip).join('')}</div>
                <h3 class="pjw-h">Expertises <small>${expSlots ? `${wiz.expertise.length} / ${expSlots}` : ''}</small></h3>
                ${expSlots
                    ? `<div class="pjw-chips">${proficientSkills().map(name => {
                        const on = wiz.expertise.includes(name);
                        return `<button type="button" class="pjw-chip${on ? ' is-on' : ''}" data-pick="exp" data-id="${esc(name)}" aria-pressed="${on}"${!on && wiz.expertise.length >= expSlots ? ' disabled' : ''}>${on ? '★' : '☆'} ${name}</button>`;
                    }).join('') || '<span class="pjw-note">Choisis d’abord des compétences.</span>'}</div>
                       <p class="pjw-note">L’Expertise double le bonus de maîtrise de la compétence.</p>`
                    : `<p class="pjw-note">${c ? 'Ta classe n’accorde pas d’Expertise à ce niveau.' : 'Certaines classes (Roublard, Barde) accordent des Expertises.'}</p>`}
            </section>
        </div>`;
    }

    // ---------- Étape 6 : équipement ----------
    function gearChips(g) {
        const chip = (x, cls2, ico) => x.srd
            ? `<span class="pjw-gi ${cls2}" data-preview-eq="${esc(x.srd.id)}" title="Lire la fiche">${ico} ${x.qty > 1 ? x.qty + ' × ' : ''}${esc(x.label)}</span>`
            : `<span class="pjw-gi">${ico} ${x.qty > 1 ? x.qty + ' × ' : ''}${esc(x.label)}</span>`;
        return [
            ...g.weapons.map(x => chip(x, 'is-weapon', '⚔️')),
            ...g.armors.map(x => chip(x, 'is-armor', '🛡️')),
            ...g.gear.map(x => chip(x, '', '🎒')),
            ...Object.entries(g.coins).map(([k, n]) => `<span class="pjw-gi is-coin">🪙 ${n} ${k}</span>`)
        ].join('');
    }
    function gearSection(who, src, title) {
        const opts = gearOptions(src);
        if (!src) return `<h3 class="pjw-h">${title}</h3><p class="pjw-note">Choisis d’abord ${who === 'cls' ? 'une classe' : 'un historique'}.</p>`;
        if (!opts.length) return `<h3 class="pjw-h">${title}</h3><p class="pjw-note">Les règles de cette édition ne détaillent pas cet équipement de départ : ajoute le tien ci-dessous.</p>`;
        return `<h3 class="pjw-h">${title}</h3><div class="pjw-gearopts">
            ${opts.map(o => { const on = wiz.gear[who] === o.key; return `<div class="pjw-gearopt${on ? ' is-on' : ''}" data-pick="gear-${who}" data-id="${o.key}" role="button" tabindex="0" aria-pressed="${on}">
                <span class="pjw-gearkey">${o.key}</span><span class="pjw-gearlist">${gearChips(classify(o.parts))}</span></div>`; }).join('')}
            <div class="pjw-gearopt pjw-gearnone${wiz.gear[who] === 'none' ? ' is-on' : ''}" data-pick="gear-${who}" data-id="none" role="button" tabindex="0" aria-pressed="${wiz.gear[who] === 'none'}">Rien : je m’équipe moi-même</div>
        </div>`;
    }
    function gearSummary() {
        const g = chosenGear();
        const block = (title, items) => items.length ? `<div class="pjw-sum-block"><h4>${title}</h4><ul>${items.join('')}</ul></div>` : '';
        const li = (x) => `<li>${x.qty > 1 ? x.qty + ' × ' : ''}${x.srd ? `<a href="#" data-preview-eq="${esc(x.srd.id)}">${esc(x.label)}</a>` : esc(x.label)}</li>`;
        const coins = Object.entries(g.coins).map(([k, n]) => `<li>${n} ${k}</li>`);
        const html = block('⚔️ Armes → Attaques', g.weapons.map(li)) + block('🛡️ Armure → widget CA', g.armors.map(li))
            + block('🎒 Sac à dos', g.gear.map(li)) + block('🪙 Bourse', coins);
        return `<div class="pjw-preview-head"><span class="pjw-preview-kicker">Ce qui sera ajouté</span><h3>Ton paquetage</h3></div>
            <div class="pjw-sum">${html || '<p class="pjw-note">Rien pour l’instant : choisis une option ou ajoute des objets.</p>'}</div>
            ${g.armors.length && wiz.auto ? '<p class="pjw-note">L’armure sera portée et la CA calculée automatiquement.</p>' : ''}`;
    }
    function gearStep() {
        const eq = list('equipment');
        const extras = wiz.gear.extra.map(id => eq.find(x => x.id === id)).filter(Boolean);
        return `<div class="pjw-split">
            <section class="pjw-pane">
                ${gearSection('cls', cls(), 'Équipement de classe')}
                ${gearSection('bg', bg(), 'Équipement d’historique')}
                <h3 class="pjw-h">Ajouter une arme, une armure ou un objet</h3>
                <div class="pjw-extra">
                    <input type="text" class="pjw-in" data-extra-query list="pjw-eq-list" placeholder="🔍 Épée longue, cotte de mailles, corde…" aria-label="Objet des règles">
                    <datalist id="pjw-eq-list">${eq.map(x => `<option value="${esc(x.name)}">`).join('')}</datalist>
                    <button type="button" class="pjw-btn" data-pjw="extra-add">Ajouter</button>
                </div>
                ${extras.length ? `<div class="pjw-chips pjw-extras">${extras.map(x =>
                    `<span class="pjw-chip is-on"><span data-preview-eq="${esc(x.id)}">${x.category === 'weapon' ? '⚔️' : x.category === 'armor' ? '🛡️' : '🎒'} ${esc(x.name)}</span>
                     <button type="button" class="pjw-chip-x" data-pick="extra-del" data-id="${esc(x.id)}" aria-label="Retirer ${esc(x.name)}">✕</button></span>`).join('')}</div>` : ''}
            </section>
            <aside class="pjw-preview" aria-live="polite">${wiz.focus && wiz.focus.cat === 'equipment' ? previewHtml() + '<button type="button" class="pjw-btn" data-pjw="unfocus">← Récapitulatif</button>' : gearSummary()}</aside>
        </div>`;
    }

    // ---------- Étape 7 : magie ----------
    async function magicStep() {
        const c = cls(), m = magicInfo();
        const spells = await spellList();
        const chosen = wiz.spells.map(id => spells.find(s => s.id === id)).filter(Boolean);
        const nCantrips = chosen.filter(s => num(s.level) === 0).length;
        const nSpells = chosen.length - nCantrips;
        const ability = (c.spellcasting || {}).ability;
        const levels = uniq(spells.map(s => num(s.level))).sort((a, b) => a - b);
        const shown = spells.filter(s => wiz.spellLevel === 'all' || String(num(s.level)) === wiz.spellLevel);
        const counter = (label, n, max) => `<span class="pjw-counter${max != null && n >= max ? ' is-full' : ''}">${label} ${n}${max != null ? ' / ' + max : ''}</span>`;
        const canPick = (s) => (num(s.level) === 0 ? (m.cantrips == null || nCantrips < m.cantrips) : (m.known == null || nSpells < m.known));
        const slotsTxt = m.slots ? Object.entries(m.slots).map(([r, n]) => `${n} × niv. ${r}`).join(', ') : 'aucun';
        return `<div class="pjw-split">
            <section class="pjw-pane">
                <div class="pjw-counters">
                    ${m.cantrips ? counter('Sorts mineurs', nCantrips, m.cantrips) : ''}
                    ${counter(m.known != null ? (is2024() ? 'Sorts préparés' : 'Sorts connus') : 'Sorts retenus', nSpells, m.known)}
                    <span class="pjw-counter">Emplacements : ${slotsTxt}</span>
                </div>
                <p class="pjw-note">${m.known == null && m.maxRank
                    ? `${esc(c.name)} prépare ses sorts chaque jour (en général modificateur de ${esc(ability || 'caractéristique')} + niveau) : retiens ceux que tu veux sur la fiche.`
                    : `Caractéristique d’incantation : ${esc(ability || '—')}.`} Sorts jusqu’au niveau ${m.maxRank || 0}.</p>
                <div class="pjw-tabs">
                    <button type="button" class="pjw-tab${wiz.spellLevel === 'all' ? ' is-on' : ''}" data-pjw="spell-level" data-level="all">Tous</button>
                    ${levels.map(l => `<button type="button" class="pjw-tab${wiz.spellLevel === String(l) ? ' is-on' : ''}" data-pjw="spell-level" data-level="${l}">${l === 0 ? 'Mineurs' : 'Niveau ' + l}</button>`).join('')}
                </div>
                <input type="search" class="pjw-in" data-filter="spells" placeholder="🔍 Filtrer par nom…" aria-label="Filtrer les sorts">
                <div class="pjw-spells">${shown.map(s => {
                    const on = wiz.spells.includes(s.id);
                    const school = (window.SRD && s.school) ? s.school : '';
                    return `<div class="pjw-spell${on ? ' is-on' : ''}" data-spell-row data-name="${esc(fold(s.name))}">
                        <button type="button" class="pjw-spell-pick" data-pick="spell" data-id="${esc(s.id)}" aria-pressed="${on}" aria-label="${on ? 'Retirer' : 'Retenir'} ${esc(s.name)}"${!on && !canPick(s) ? ' disabled' : ''}>${on ? '✓' : '+'}</button>
                        <button type="button" class="pjw-spell-name${wiz.focus && wiz.focus.id === s.id ? ' is-focus' : ''}" data-preview="spells" data-id="${esc(s.id)}">
                            <b>${esc(s.name)}</b><small>${num(s.level) === 0 ? 'Sort mineur' : 'Niveau ' + num(s.level)}${school ? ' · ' + esc(schoolFr(school)) : ''}${s.concentration ? ' · concentration' : ''}${s.ritual ? ' · rituel' : ''}</small>
                        </button></div>`;
                }).join('') || '<p class="pjw-note">Aucun sort de cette liste dans les règles.</p>'}</div>
            </section>
            <aside class="pjw-preview" aria-live="polite">${previewHtml()}</aside>
        </div>`;
    }
    const SCHOOL_FR = { abjuration: 'Abjuration', conjuration: 'Invocation', divination: 'Divination', enchantment: 'Enchantement',
        evocation: 'Évocation', illusion: 'Illusion', necromancy: 'Nécromancie', transmutation: 'Transmutation' };
    const schoolFr = (s) => SCHOOL_FR[s] || s;

    // ---------- Ossature ----------
    function headHtml(st, cur) {
        return `<header class="pjw-head">
                <span class="pjw-seal" aria-hidden="true">✨</span>
                <div class="pjw-titles"><h2 id="pjw-title">Assistant de création</h2>
                    <span>Étape ${wiz.step + 1} sur ${st.length} · ${esc(cur.label)}</span></div>
                <label class="pjw-auto" title="Déduit de la règle : jets de sauvegarde, PV, dés de vie, vitesse, taille, formations, aptitudes, traits, emplacements de sorts et CA.">
                    <input type="checkbox" data-pjw="auto" aria-label="Remplissage automatique"${wiz.auto ? ' checked' : ''}><span>Remplissage automatique</span></label>
                <button type="button" class="pjw-x" data-pjw="close" aria-label="Fermer l’assistant">✕</button>
            </header>
            <nav class="pjw-steps" aria-label="Étapes">${st.map((s, i) => {
                const done = i < wiz.step && !wiz.skipped.has(s.key), skipped = i < wiz.step && wiz.skipped.has(s.key);
                return `<button type="button" class="pjw-stepbtn${i === wiz.step ? ' is-on' : ''}${done ? ' is-done' : ''}${skipped ? ' is-skipped' : ''}" data-pjw="goto" data-step="${i}"${i === wiz.step ? ' aria-current="step"' : ''}>
                    <span class="pjw-stepnum">${done ? '✓' : i + 1}</span><span class="pjw-steplbl">${s.icon} ${esc(s.label)}</span></button>`;
            }).join('')}</nav>`;
    }
    function footHtml(st, cur) {
        const last = wiz.step === st.length - 1;
        return `<footer class="pjw-foot">
            ${wiz.step > 0 ? '<button type="button" class="pjw-btn" data-pjw="prev">← Précédent</button>' : '<span></span>'}
            <span class="pjw-foot-hint">${esc(cur.hint || '')}</span>
            <button type="button" class="pjw-btn pjw-ghost" data-pjw="skip">${last ? 'Passer et terminer' : 'Passer cette étape'}</button>
            <button type="button" class="pjw-btn pjw-primary" data-pjw="next">${last ? 'Terminer et remplir la fiche ✓' : 'Suivant →'}</button>
        </footer>`;
    }
    const confirmHtml = () => `<div class="pjw-confirm" role="alertdialog" aria-labelledby="pjw-confirm-t">
        <div class="pjw-confirm-box">
            <h3 id="pjw-confirm-t">Quitter l’assistant ?</h3>
            <p>Tu peux écrire sur la fiche ce qui a déjà été choisi, ou tout laisser en l’état.</p>
            <div>
                <button type="button" class="pjw-btn pjw-primary" data-pjw="apply-close">Appliquer et quitter</button>
                <button type="button" class="pjw-btn" data-pjw="discard">Quitter sans rien changer</button>
                <button type="button" class="pjw-btn pjw-ghost" data-pjw="stay">Continuer</button>
            </div>
        </div></div>`;

    let token = 0, lastStep = -1, lastFocus = '';
    async function render() {
        if (!root) return;
        const my = ++token;
        // Ce que l'écran garde d'un rendu à l'autre : le curseur et le défilement.
        const act = document.activeElement;
        const keep = act && root.contains(act) && act.dataset
            ? ['field', 'score', 'boost', 'filter', 'pjw', 'pick'].map(k => act.dataset[k] != null ? `[data-${k}="${act.dataset[k]}"]` : '').join('')
              + (act.dataset.id ? `[data-id="${act.dataset.id}"]` : '') + (act.dataset.k ? `[data-k="${act.dataset.k}"]` : '')
            : '';
        const scrolls = [...root.querySelectorAll('.pjw-pane, .pjw-preview, .pjw-solo')].map(el => el.scrollTop);
        const filterVal = (root.querySelector('[data-filter]') || {}).value || '';

        await load(['classes', 'races', 'backgrounds', 'feats', 'equipment']);
        if (my !== token || !root) return;
        const st = steps();
        if (wiz.step >= st.length) wiz.step = st.length - 1;
        const cur = st[wiz.step];
        let main = '';
        switch (cur.key) {
            case 'name': main = nameStep(); break;
            case 'level': main = levelStep(); break;
            case 'class': main = classStep(); break;
            case 'origin': main = originStep(); break;
            case 'abilities': main = abilitiesStep(); break;
            case 'gear': main = gearStep(); break;
            case 'magic': main = await magicStep(); break;
        }
        if (my !== token || !root) return;
        const box = root.querySelector('.pjw');
        box.innerHTML = headHtml(st, cur) + `<main class="pjw-main">${main}</main>` + footHtml(st, cur) + (wiz.confirm ? confirmHtml() : '');

        const focusId = wiz.focus ? wiz.focus.cat + ':' + wiz.focus.id : '';
        if (wiz.step === lastStep) {
            root.querySelectorAll('.pjw-pane, .pjw-preview, .pjw-solo').forEach((el, i) => {
                if (el.classList.contains('pjw-preview') && focusId !== lastFocus) return;
                el.scrollTop = scrolls[i] || 0;
            });
        }
        lastStep = wiz.step; lastFocus = focusId;
        if (filterVal) { const f = root.querySelector('[data-filter]'); if (f) { f.value = filterVal; filterRows(filterVal); } }
        if (wiz.confirm) root.querySelector('[data-pjw="apply-close"]')?.focus({ preventScroll: true });
        else if (keep) root.querySelector(keep)?.focus({ preventScroll: true });
        else if (cur.key === 'name') setTimeout(() => $('pjw-name')?.focus({ preventScroll: true }), 30);
    }

    function filterRows(q) {
        const f = fold(q);
        root.querySelectorAll('[data-spell-row]').forEach(r => { r.hidden = !!f && !r.dataset.name.includes(f); });
    }

    // =====================================================
    // INTERACTIONS
    // =====================================================
    const currentKey = () => (steps()[wiz.step] || {}).key;

    function pickEdition(id) {
        if (!window.Edition || window.Edition.EDITIONS.indexOf(id) === -1 || id === edWiz()) return;
        const perdus = [];
        if (wiz.ids.cls) perdus.push('la classe');
        if (wiz.ids.race || wiz.ids.bg) perdus.push('l’origine');
        if (wiz.skills.length) perdus.push('les compétences');
        if (wiz.spells.length) perdus.push('les sorts');
        const poser = async () => {
            wiz.data.edition = id;
            window.Edition.consulter(id, false);      // rien n'est enregistré avant la fin
            wiz.lists = {}; wiz.spellCache = {};
            wiz.ids = { cls: '', sub: '', race: '', subrace: '', bg: '' };
            wiz.skills = []; wiz.expertise = []; wiz.spells = [];
            wiz.gear = { cls: 'A', bg: 'A', extra: [] };
            wiz.focus = null; wiz.compare = [];
            await load(['classes', 'races', 'backgrounds', 'feats', 'equipment']);
            render();
        };
        if (!perdus.length) { poser(); return; }
        window.Dialogue.confirmer({
            titre: 'Changer d’édition ?',
            message: 'Les règles ' + id + ' ne proposent pas les mêmes classes, origines et sorts : '
                   + perdus.join(', ') + ' ' + (perdus.length > 1 ? 'seront remis' : 'sera remis') + ' à zéro.',
            confirmer: 'Passer en ' + id, annuler: 'Garder ' + edWiz(), icone: '📜'
        }).then(ok => { if (ok) poser(); });
    }

    function pick(kind, id) {
        // Changer d'édition change les DONNÉES : classes, espèces, historiques et
        // sorts n'ont pas les mêmes identifiants d'une édition à l'autre. On repart
        // donc des listes de la nouvelle édition, en prévenant si des choix seraient
        // perdus. Le nom, le niveau et les caractéristiques, eux, restent.
        if (kind === 'edition') { pickEdition(id); return; }
        switch (kind) {
            case 'level': wiz.data.level = num(id, 1); break;
            case 'class':
                if (wiz.ids.cls !== id) {
                    wiz.ids.cls = id; wiz.ids.sub = ''; wiz.skills = []; wiz.expertise = []; wiz.spells = []; wiz.gear.cls = 'A';
                }
                wiz.focus = { cat: 'classes', id };
                break;
            case 'sub': wiz.ids.sub = wiz.ids.sub === id ? '' : id; wiz.focus = { cat: 'classes', id }; break;
            case 'race':
                if (wiz.ids.race !== id) { wiz.ids.race = id; wiz.ids.subrace = ''; }
                wiz.focus = { cat: 'races', id };
                break;
            case 'subrace': wiz.ids.subrace = wiz.ids.subrace === id ? '' : id; wiz.focus = { cat: 'races', id }; break;
            case 'bg':
                if (wiz.ids.bg !== id) {
                    wiz.ids.bg = id; wiz.boost = { mode: '21', plus2: '', plus1: '' }; wiz.gear.bg = 'A';
                    wiz.skills = wiz.skills.filter(s => !bgSkills().includes(s));
                }
                wiz.focus = { cat: 'backgrounds', id };
                break;
            case 'gear-cls': wiz.gear.cls = id; break;
            case 'gear-bg': wiz.gear.bg = id; break;
            case 'extra-del': wiz.gear.extra = wiz.gear.extra.filter(x => x !== id); break;
            case 'spell': {
                if (wiz.spells.includes(id)) wiz.spells = wiz.spells.filter(x => x !== id);
                else wiz.spells.push(id);
                wiz.focus = { cat: 'spells', id };
                break;
            }
            case 'skill': {
                const choice = skillChoice(), fromBg = bgSkills();
                if (wiz.skills.includes(id)) { wiz.skills = wiz.skills.filter(x => x !== id); wiz.expertise = wiz.expertise.filter(x => x !== id); }
                else if (!fromBg.includes(id) && choice.from.includes(id)
                         && (!choice.n || wiz.skills.filter(s => !fromBg.includes(s)).length < choice.n)) wiz.skills.push(id);
                break;
            }
            case 'exp': {
                if (wiz.expertise.includes(id)) wiz.expertise = wiz.expertise.filter(x => x !== id);
                else if (proficientSkills().includes(id) && wiz.expertise.length < expertiseSlots()) wiz.expertise.push(id);
                break;
            }
            default: return;
        }
        wiz.skipped.delete(currentKey());
        render();
    }

    function setMethod(m) {
        wiz.method = m;
        wiz.addBonuses = true;
        STATS.forEach(([k]) => { wiz.base[k] = m === 'points' ? 8 : (m === 'manual' ? (wiz.base[k] != null ? wiz.base[k] : 10) : null); });
        render();
    }
    function stepStat(k, d) {
        const [min, max] = wiz.method === 'points' ? [8, 15] : [3, 20];
        const cur = wiz.base[k] == null ? (wiz.method === 'points' ? 8 : 10) : wiz.base[k];
        const next = Math.max(min, Math.min(max, cur + d));
        if (wiz.method === 'points' && d > 0) {
            const before = wiz.base[k]; wiz.base[k] = next;
            if (pointsSpent() > 27) { wiz.base[k] = before; toast('Plus assez de points : baisse une autre valeur d’abord.'); return; }
        }
        wiz.base[k] = next;
        render();
    }
    function addExtra() {
        const q = root.querySelector('[data-extra-query]');
        const name = q ? q.value.trim() : '';
        if (!name) { if (q) q.focus(); return; }
        const e = list('equipment').find(x => fold(x.name) === fold(name));
        if (!e) { toast('Objet introuvable dans les règles : ajoute-le directement sur la fiche.'); return; }
        if (!wiz.gear.extra.includes(e.id)) wiz.gear.extra.push(e.id);
        wiz.focus = { cat: 'equipment', id: e.id };
        render();
    }

    function act(a, el) {
        const st = steps();
        switch (a) {
            case 'next': wiz.skipped.delete(st[wiz.step].key); advance(); break;
            case 'skip': wiz.skipped.add(st[wiz.step].key); advance(); break;
            case 'prev': wiz.step = Math.max(0, wiz.step - 1); wiz.focus = null; render(); break;
            case 'goto': wiz.step = Math.max(0, Math.min(st.length - 1, num(el.dataset.step, wiz.step))); wiz.focus = null; render(); break;
            case 'close': wiz.confirm = true; render(); break;
            case 'stay': wiz.confirm = false; render(); break;
            case 'discard': finish(false); break;
            case 'apply-close': finish(true); break;
            case 'method': setMethod(el.dataset.method); break;
            case 'reroll':
                wiz.pool = Array.from({ length: 6 }, roll4d6).sort((x, y) => y - x);
                STATS.forEach(([k]) => { wiz.base[k] = null; });
                render();
                break;
            case 'stat-inc': stepStat(el.dataset.k, 1); break;
            case 'stat-dec': stepStat(el.dataset.k, -1); break;
            case 'compare-clear': wiz.compare = []; render(); break;
            case 'extra-add': addExtra(); break;
            case 'spell-level': wiz.spellLevel = el.dataset.level; render(); break;
            case 'unfocus': wiz.focus = null; render(); break;
        }
    }
    function advance() {
        const st = steps();
        if (wiz.step >= st.length - 1) { finish(true); return; }
        wiz.step++;
        wiz.focus = null;
        render();
    }

    function onClick(e) {
        if (!root) return;
        const t = e.target;
        // Liens internes des fiches de règles : ils ouvrent l'entrée dans l'aperçu.
        const link = t.closest('.pjw-rules .rw-link');
        if (link) {
            e.preventDefault();
            if (findEntry(link.dataset.cat, link.dataset.id)) { wiz.focus = { cat: link.dataset.cat, id: link.dataset.id }; render(); }
            return;
        }
        const eqChip = t.closest('[data-preview-eq]');
        if (eqChip) {
            e.preventDefault();
            wiz.focus = { cat: 'equipment', id: eqChip.dataset.previewEq };
            if (!t.closest('[data-pick]')) { render(); return; }
        }
        const pickEl = t.closest('[data-pick]');
        if (pickEl && !pickEl.disabled) { pick(pickEl.dataset.pick, pickEl.dataset.id); return; }
        const prev = t.closest('[data-preview]');
        if (prev) { wiz.focus = { cat: prev.dataset.preview, id: prev.dataset.id }; render(); return; }
        const a = t.closest('[data-pjw]');
        if (a && !a.matches('input, select')) act(a.dataset.pjw, a);
    }
    function onChange(e) {
        const t = e.target, d = t.dataset || {};
        if (d.pjw === 'auto') {
            wiz.auto = t.checked;
            try { localStorage.setItem(AUTO_KEY, String(t.checked)); } catch (err) {}
            toast(t.checked ? '⚙️ Remplissage automatique activé' : '✍️ Remplissage automatique désactivé : seuls tes choix seront écrits.');
            render();
            return;
        }
        if (d.compare != null) {
            wiz.compare = t.checked ? uniq([...wiz.compare, d.compare]).slice(0, 3) : wiz.compare.filter(x => x !== d.compare);
            render();
            return;
        }
        if (d.score != null) {
            const [min, max] = wiz.method === 'points' ? [8, 15] : [3, 20];
            wiz.base[d.score] = t.value === '' ? null : Math.max(min, Math.min(max, num(t.value)));
            if (wiz.method === 'points' && pointsSpent() > 27) toast('Budget de 27 points dépassé.');
            render();
            return;
        }
        if (d.boost != null) {
            wiz.boost[d.boost] = t.value;
            const other = d.boost === 'plus2' ? 'plus1' : 'plus2';
            if (wiz.boost[other] === t.value) wiz.boost[other] = '';
            render();
            return;
        }
        if (d.boostMode != null) { wiz.boost.mode = d.boostMode; render(); return; }
        if (t.hasAttribute('data-pjw-bonuses')) { wiz.addBonuses = t.checked; render(); return; }
        if (d.field === 'alignment') wiz.data.alignment = t.value;
    }
    function onInput(e) {
        const t = e.target, d = t.dataset || {};
        if (d.field === 'name') wiz.data.name = t.value;
        else if (d.filter != null) filterRows(t.value);
    }
    function onKey(e) {
        const t = e.target;
        if (e.key === 'Escape') { e.preventDefault(); wiz.confirm = !wiz.confirm; render(); return; }
        if (e.key !== 'Enter') return;
        if (t.dataset && t.dataset.field === 'name') { e.preventDefault(); act('next'); }
        else if (t.hasAttribute && t.hasAttribute('data-extra-query')) { e.preventDefault(); addExtra(); }
        else if (t.matches && t.matches('[role="button"][data-pick]')) { e.preventDefault(); pick(t.dataset.pick, t.dataset.id); }
    }

    // =====================================================
    // APPLICATION SUR LA FICHE
    // =====================================================
    async function applyAll() {
        const api = window.SheetApi;
        const skip = (k) => wiz.skipped.has(k);
        const c = cls(), s = sub(), r = race(), sr = subrace(), b = bg(), l = L();

        // L'édition d'abord : le reste de la fiche (bottes d'armes, loupe,
        // impression) doit se lire avec les bonnes règles dès la fermeture.
        if (window.Edition && wiz.data.edition) window.Edition.definir(wiz.data.edition);

        if (!skip('name') && wiz.data.name.trim()) setField('char-name', wiz.data.name.trim());
        if (!skip('level')) setField('char-level', l);
        if (!skip('class') && c) { setField('char-class', c.name); if (s) setField('char-subclass', s.name); }
        if (!skip('origin')) {
            if (r) setField('char-race', sr ? `${r.name} (${sr.name})` : r.name);
            if (b) setField('char-background', b.name);
            if (wiz.data.alignment) setField('char-alignment', wiz.data.alignment);
        }
        if (!skip('abilities')) {
            STATS.forEach(([k]) => { const v = final(k); if (v != null) setField('stat-' + k, v); });
            if (api) {
                if (wiz.auto && c) savesOf(c).forEach(k => api.setSkillProf('save-' + k, 1));
                proficientSkills().forEach(n => {
                    const sk = SKILL[fold(n)];
                    if (sk) api.setSkillProf(sk[1], wiz.expertise.includes(n) ? 2 : 1);
                });
            }
        }

        const unarmored = c && c.id === 'barbarian' ? 'barbarian' : (c && c.id === 'monk' ? 'monk' : undefined);
        if (wiz.auto) {
            if (c && !skip('class')) {
                const die = num(c.hit_die, 8);
                const con = modOf(final('con') != null ? final('con') : ($('stat-con') || {}).value);
                const hp = Math.max(1, die + con + (l - 1) * (Math.floor(die / 2) + 1 + con));
                setField('hp-max', hp); setField('hp-current', hp);
                setField('hd-size', die); setField('hd-max', l);
                training(c);
                const ab = ABIL[fold((c.spellcasting || {}).ability)];
                if (ab) setField('spellcasting-ability', ab);
                const m = magicInfo();
                if (m && m.slots && api) api.setSpellSlots(m.slots);
                if (api) api.addTraits(classTraits());
            }
            if (!skip('origin')) {
                const srcs = [sr, r].filter(Boolean);
                let speed = (r && r.speed) || traitValue(srcs, /^vitesse/, /(\d+(?:[,.]\d+)?)\s*m/);
                if (speed) setField('speed', /m\s*$/.test(speed) ? speed : speed + ' m');
                const size = r && r.size ? sizeCode(r.size) : sizeCode(traitValue(srcs, /taille/, /(moyenne|petite|grande)/i));
                if (size) setField('char-size', size);
                if (b) addTools((b.proficiencies || {}).tools);
                if (api) api.addTraits(speciesTraits().concat(featTraits()));
            }
        }

        if (!skip('gear')) {
            const g = chosenGear();
            if (api) {
                api.addSrdWeapons(g.weapons.map(x => x.srd));
                api.addItems(g.gear.map(itemOf).concat(g.weapons.filter(x => x.qty > 1).map(itemOf)));
                api.addCoins(g.coins);
            }
            if (window.ArmorWidget && (g.armors.length || (wiz.auto && c))) {
                window.ArmorWidget.add(g.armors.map(x => x.srd), { equip: true, auto: wiz.auto, unarmored });
            }
        } else if (wiz.auto && c && window.ArmorWidget) {
            window.ArmorWidget.add([], { auto: true, unarmored });
        }

        if (!skip('magic') && isCaster() && api && wiz.spells.length) {
            const spells = await spellList();
            api.addSrdSpells(wiz.spells.map(id => spells.find(x => x.id === id)).filter(Boolean));
        }
        if (api) api.refresh();
        if (window.ArmorWidget) window.ArmorWidget.refresh();
    }

    function training(c) {
        const p = c.proficiencies || {};
        let code = '';
        if (p.armor || p.weapons) {
            const a = fold(p.armor), w = fold(p.weapons);
            if (/leger/.test(a)) code += 'l';
            if (/intermediaire/.test(a)) code += 'm';
            if (/lourde/.test(a)) code += 'h';
            if (/bouclier/.test(a)) code += 's';
            if (/courante/.test(w)) code += 'S';
            // « armes de guerre dotées de la propriété Finesse » (Roublard) : pas toutes les armes de guerre.
            if (/de guerre(?!\s+dotee)/.test(w)) code += 'M';
        } else {
            code = TRAINING[c.id] || '';
        }
        [['l', 'prof-armor-light'], ['m', 'prof-armor-med'], ['h', 'prof-armor-heavy'], ['s', 'prof-armor-shield'],
         ['S', 'prof-weapon-simple'], ['M', 'prof-weapon-martial']].forEach(([ch, id]) => { if (code.includes(ch)) setCheck(id, true); });
        addTools(p.tools);
    }
    /** Ajoute une maîtrise d'outils sans écraser ce qui est déjà écrit. */
    function addTools(txt) {
        const t = String(txt || '').replace(/\s*\(cf\..*?\)/g, '').trim();
        const el = $('prof-tools');
        if (!t || !el) return;
        const cur = String(el.value || '').trim();
        if (fold(cur).includes(fold(t))) return;
        setField('prof-tools', cur ? cur + ', ' + t : t);
    }

    // =====================================================
    // OUVERTURE / FERMETURE
    // =====================================================
    function mount() {
        let ov = $('pj-wizard');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'pj-wizard';
            ov.className = 'no-print';
            ov.innerHTML = '<div class="pjw" role="dialog" aria-modal="true" aria-labelledby="pjw-title"></div>';
            document.body.appendChild(ov);
            ov.addEventListener('click', onClick);
            ov.addEventListener('change', onChange);
            ov.addEventListener('input', onInput);
            ov.addEventListener('keydown', onKey);
        }
        root = ov;
        document.body.classList.add('pjw-open');
        $('settings-dropdown')?.classList.add('hidden');
        $('discover-offer')?.remove();
        $('pj-resume')?.remove();
    }
    function unmount() {
        // Quitter sans appliquer : SRD retrouve l'édition du personnage.
        window.Edition?.appliquer(true);
        $('pj-wizard')?.remove();
        root = null;
        lastStep = -1;
        document.body.classList.remove('pjw-open');
    }

    async function finish(apply) {
        if (apply) {
            try { await applyAll(); toast('✨ La fiche est remplie : tout reste modifiable.'); }
            catch (err) { console.warn('assistant : application partielle', err); toast('⚠️ L’assistant n’a pu remplir qu’une partie de la fiche.'); }
        }
        unmount();
        dismissResume();
        setTimeout(() => { if (window.Discover) window.Discover.offer(); }, 700);
    }

    /** Reprend ce que la fiche contient déjà : relancer l'assistant ne repart pas de zéro. */
    async function startWizard(neuve) {
        if (!onSheet()) { toast('Ouvre une fiche de personnage pour lancer l’assistant.'); return; }
        if (!window.SRD) { toast('Les règles ne sont pas chargées : réessaie dans un instant.'); return; }
        wiz = newState();
        mount();
        root.querySelector('.pjw').innerHTML = '<div class="pjw-loading">Ouverture du grimoire…</div>';
        // L'édition AVANT les listes : ce sont elles qui en dépendent. Une fiche
        // neuve part sur la 2024 ; une fiche qui a déjà choisi garde son choix ;
        // une fiche d'avant garde l'édition qu'on lui a déduite (edition.js).
        if (window.Edition) {
            wiz.data.edition = window.Edition.choisie() ? window.Edition.active()
                             : (neuve ? window.Edition.NOUVELLE : window.Edition.active());
            window.Edition.consulter(wiz.data.edition, false);
        }
        await load(['classes', 'races', 'backgrounds', 'feats', 'equipment']);
        const val = (id) => String(($(id) || {}).value || '').trim();
        wiz.data.name = val('char-name');
        wiz.data.level = num(val('char-level'), 1);
        wiz.data.alignment = ALIGNEMENTS.includes(val('char-alignment')) ? val('char-alignment') : '';
        const c = byName(list('classes'), val('char-class'));
        if (c) { wiz.ids.cls = c.id; const s = byName(c.subclasses || [], val('char-subclass')); if (s) wiz.ids.sub = s.id; }
        const raceTxt = val('char-race'), m = raceTxt.match(/^(.*?)\s*\((.*)\)\s*$/);
        const r = byName(list('races'), m ? m[1] : raceTxt);
        if (r) { wiz.ids.race = r.id; if (m) { const sr = byName(r.subraces || [], m[2]); if (sr) wiz.ids.subrace = sr.id; } }
        const b = byName(list('backgrounds'), val('char-background'));
        if (b) wiz.ids.bg = b.id;
        // Des valeurs déjà saisies : on les reprend telles quelles, bonus compris.
        const typed = STATS.map(([k]) => num(val('stat-' + k), 0));
        if (typed.some(v => v && v !== 10 && v !== 8)) {
            wiz.method = 'manual';
            wiz.addBonuses = false;
            STATS.forEach(([k], i) => { wiz.base[k] = typed[i] || 10; });
        }
        render();
    }

    // ---------- Reprise d'une fiche inachevée ----------
    // Pas de relance automatique : une bannière discrète, qu'on peut écarter.
    const resumeKey = () => (localStorage.getItem('dnd-active-char') || '') + '_dnd-pj-wizard-off';
    function dismissResume() {
        try { localStorage.setItem(resumeKey(), '1'); } catch (e) {}
        $('pj-resume')?.remove();
    }
    function offerResume() {
        try {
            if ($('pj-resume') || localStorage.getItem(resumeKey())) return;
            // La première fois, c'est l'invitation à découvrir la fiche qui s'affiche.
            if (!localStorage.getItem('dnd-discover-offered') && !localStorage.getItem('dnd-pj-tuto-done')) return;
        } catch (e) { return; }
        const c = completion();
        if (c.pct >= 85) return;
        const bar = document.createElement('div');
        bar.id = 'pj-resume';
        bar.className = 'no-print';
        bar.innerHTML = `<span>Fiche remplie à <b>${c.pct}%</b> — il manque ${esc(c.missing.slice(0, 3).join(', '))}${c.missing.length > 3 ? '…' : ''}</span>
            <button type="button" class="pjw-btn pjw-primary" data-resume>✨ Terminer avec l’assistant</button>
            <button type="button" class="pjw-btn" data-resume-off aria-label="Masquer">✕</button>`;
        document.body.appendChild(bar);
        bar.querySelector('[data-resume]').addEventListener('click', () => { bar.remove(); startWizard(); });
        bar.querySelector('[data-resume-off]').addEventListener('click', dismissResume);
    }

    document.addEventListener('DOMContentLoaded', () => {
        // Le bouton du menu ☰ vit dans index.html, présent aussi hors fiche.
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#btn-pj-wizard-replay')) return;
            $('settings-dropdown')?.classList.add('hidden');
            startWizard();
        });
        setTimeout(() => {
            if (!onSheet()) return;
            let pending = false;
            try { pending = !!localStorage.getItem(WIZ_FLAG); if (pending) localStorage.removeItem(WIZ_FLAG); } catch (e) {}
            if (pending) startWizard(true);             // fiche fraîchement créée → assistant
            else offerResume();                         // fiche inachevée → reprise proposée
        }, 900);
    });

    window.PjTutorial = {
        startWizard, completion,
        // Compatibilité : l'ancienne visite guidée est devenue « Découvrir la fiche » (help.js).
        startTutorial: () => { if (window.Discover) window.Discover.open(); }
    };
})();
