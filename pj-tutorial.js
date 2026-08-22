// =====================================================
// pj-tutorial.js — Côté JOUEUR :
//   1. ASSISTANT DE CRÉATION : à la première ouverture d'une fiche
//      fraîchement créée, un guide pas-à-pas la remplit jusqu'au bout.
//      Il ne se contente pas de recopier ce qu'on tape : dès qu'une race
//      ou une classe est choisie, il en déduit tout ce qui est déductible
//      — bonus de caractéristiques, vitesse, langues, dé de vie, PV,
//      maîtrises, équipement de départ, aptitudes gagnées.
//      Les données viennent de SRD.* : une classe créée dans l'éditeur de
//      contenu personnel se comporte donc exactement comme une officielle.
//   2. TUTORIEL DE LA FICHE : visite guidée (spotlight) des
//      fonctionnalités. Skippable, revisionnable depuis le menu ☰.
//
// Écriture sur la fiche : champs simples par `setField` (valeur + événement,
// la sauvegarde du site fait le reste) ; listes (maîtrises, capacités,
// inventaire, emplacements) par `window.SheetApi`, exposé par script.js.
// =====================================================
(function () {
    'use strict';

    const WIZ_FLAG = 'dnd-pj-wizard-pending';   // posé par script.js à la création d'une fiche
    const TUTO_FLAG = 'dnd-pj-tuto-done';       // tuto de la fiche déjà vu (global)

    function byId(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    const fold = (s) => window.SRD ? window.SRD.fold(s)
        : String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

    // Écrit une valeur dans un champ RÉEL de la fiche + déclenche la sauvegarde du site.
    function setField(id, value) {
        const el = byId(id);
        if (!el || value === '' || value == null) return;
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const STATS = [['str', 'Force'], ['dex', 'Dextérité'], ['con', 'Constitution'],
                   ['int', 'Intelligence'], ['wis', 'Sagesse'], ['cha', 'Charisme']];
    const ALIGNEMENTS = ['Loyal Bon', 'Neutre Bon', 'Chaotique Bon', 'Loyal Neutre', 'Neutre',
                         'Chaotique Neutre', 'Loyal Mauvais', 'Neutre Mauvais', 'Chaotique Mauvais'];
    // Repli si les règles ne sont pas chargeables (hors connexion au 1er lancement).
    const FALLBACK_CLASSES = ['Barbare', 'Barde', 'Clerc', 'Druide', 'Ensorceleur', 'Guerrier',
                              'Magicien', 'Moine', 'Occultiste', 'Paladin', 'Rôdeur', 'Roublard'];
    const FALLBACK_RACES = ['Humain', 'Elfe', 'Demi-elfe', 'Nain', 'Halfelin', 'Gnome',
                            'Drakéide', 'Demi-orc', 'Tieffelin'];

    // Nom français d'une compétence -> identifiant du champ sur la fiche.
    const SKILL_ID = {};
    [['Acrobaties', 'acrobatics'], ['Arcanes', 'arcana'], ['Athlétisme', 'athletics'],
     ['Discrétion', 'stealth'], ['Dressage', 'animal'], ['Escamotage', 'sleight'],
     ['Histoire', 'history'], ['Intimidation', 'intimidation'], ['Intuition', 'insight'],
     ['Investigation', 'investigation'], ['Médecine', 'medicine'], ['Nature', 'nature'],
     ['Perception', 'perception'], ['Persuasion', 'persuasion'], ['Religion', 'religion'],
     ['Représentation', 'performance'], ['Survie', 'survival'], ['Tromperie', 'deception']
    ].forEach(([fr, id]) => { SKILL_ID[fold(fr)] = id; });
    const ALL_SKILLS = Object.keys(SKILL_ID);
    const SKILL_LABEL = {};
    [['Acrobaties'], ['Arcanes'], ['Athlétisme'], ['Discrétion'], ['Dressage'], ['Escamotage'],
     ['Histoire'], ['Intimidation'], ['Intuition'], ['Investigation'], ['Médecine'], ['Nature'],
     ['Perception'], ['Persuasion'], ['Religion'], ['Représentation'], ['Survie'], ['Tromperie']
    ].forEach(([fr]) => { SKILL_LABEL[fold(fr)] = fr; });

    const SAVE_ID = { force: 'save-str', dexterite: 'save-dex', constitution: 'save-con',
                      intelligence: 'save-int', sagesse: 'save-wis', charisme: 'save-cha' };
    const ABIL_KEY = { force: 'str', dexterite: 'dex', constitution: 'con',
                       intelligence: 'int', sagesse: 'wis', charisme: 'cha' };

    const mod = (v) => Math.floor(((parseInt(v, 10) || 10) - 10) / 2);
    const signed = (n) => (n >= 0 ? '+' : '') + n;

    // =====================================================
    // Indicateur de complétion — mesuré sur la VRAIE fiche, pas sur
    // l'assistant : il reste juste après coup, et sert à proposer une reprise.
    // =====================================================
    const COMPLETION = [
        { id: 'char-name', label: 'Nom' },
        { id: 'char-class', label: 'Classe' },
        { id: 'char-race', label: 'Race' },
        { id: 'char-background', label: 'Historique' },
        { id: 'char-alignment', label: 'Alignement' },
        { key: 'stats', label: 'Caractéristiques' },
        { key: 'skills', label: 'Compétences maîtrisées' },
        { id: 'hp-max', label: 'Points de vie' },
        { id: 'armor-class', label: 'Classe d’armure' },
        { id: 'speed', label: 'Vitesse' },
        { id: 'hd-size', label: 'Dé de vie' }
    ];

    function completion() {
        const missing = [];
        COMPLETION.forEach(c => {
            let ok;
            if (c.key === 'stats') {
                // Toutes les caractéristiques à 8 = valeurs par défaut, jamais saisies.
                ok = STATS.some(s => (parseInt((byId('stat-' + s[0]) || {}).value, 10) || 8) !== 8);
            } else if (c.key === 'skills') {
                ok = ALL_SKILLS.some(k => (parseInt((byId('prof-' + SKILL_ID[k]) || {}).value, 10) || 0) > 0);
            } else {
                const el = byId(c.id);
                ok = !!(el && String(el.value).trim());
            }
            if (!ok) missing.push(c.label);
        });
        return { pct: Math.round((COMPLETION.length - missing.length) / COMPLETION.length * 100), missing };
    }

    // =====================================================
    // 1. ASSISTANT DE CRÉATION
    // =====================================================
    const wiz = {
        step: 0,
        data: {},          // saisies libres
        base: {},          // caractéristiques avant bonus raciaux
        method: 'points',
        pool: null,        // valeurs tirées (méthode 4d6)
        cls: null, sub: null, race: null, subrace: null, bg: null,
        skills: [],        // compétences cochées
        lists: {}
    };

    async function catList(cat) {
        if (wiz.lists[cat]) return wiz.lists[cat];
        let list = [];
        try { list = await window.SRD.category(cat); } catch (e) { list = []; }
        wiz.lists[cat] = list;
        return list;
    }

    /** Retrouve une entrée par son nom saisi (SRD ou perso, accents ignorés). */
    function byName(list, name) {
        const q = fold(name).trim();
        if (!q) return null;
        return list.find(e => fold(e.name) === q)
            || list.find(e => q.length > 2 && fold(e.name).startsWith(q))
            || null;
    }

    /** Recalcule les objets choisis à partir des noms saisis. */
    async function resolve() {
        const classes = await catList('classes');
        const races = await catList('races');
        wiz.cls = byName(classes, wiz.data.class);
        wiz.sub = wiz.cls ? byName(wiz.cls.subclasses || [], wiz.data.subclass) : null;
        wiz.race = byName(races, wiz.data.race);
        wiz.subrace = wiz.race ? byName(wiz.race.subraces || [], wiz.data.subrace) : null;
        wiz.bg = byName(await catList('backgrounds'), wiz.data.background);
    }

    /** Bonus raciaux cumulés (race + sous-race). */
    function racialBonuses() {
        const out = {};
        [wiz.race, wiz.subrace].forEach(src => {
            const b = src && src.ability_bonuses;
            if (!b) return;
            Object.keys(b).forEach(k => { out[k] = (out[k] || 0) + b[k]; });
        });
        return out;
    }

    const finalScore = (k) => (wiz.base[k] || 8) + (racialBonuses()[k] || 0);
    const charLevel = () => Math.max(1, Math.min(20, parseInt(wiz.data.level, 10) || 1));

    // ---------- Caractéristiques ----------
    const POINT_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
    const STANDARD = [15, 14, 13, 12, 10, 8];

    function pointsSpent() {
        return STATS.reduce((n, s) => n + (POINT_COST[wiz.base[s[0]]] || 0), 0);
    }
    function roll4d6() {
        const d = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6))
            .sort((a, b) => b - a);
        return d[0] + d[1] + d[2];
    }

    // ---------- Étapes ----------
    function datalist(id, arr) {
        return `<datalist id="${id}">${arr.map(v => `<option value="${esc(v)}">`).join('')}</datalist>`;
    }
    const inputRow = (key, label, opts) => {
        const o = opts || {};
        return `<label class="pjw-lbl">${esc(label)}</label>
            <input class="pjw-in" data-wiz="${key}" value="${esc(wiz.data[key] || '')}"
                ${o.list ? ` list="${o.list}"` : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}
                ${o.type ? ` type="${o.type}"` : ''}${o.min ? ` min="${o.min}"` : ''}${o.max ? ` max="${o.max}"` : ''}>`;
    };

    function steps() {
        return [
            { key: 'intro', title: '🧙 Bienvenue, aventurier !', choice: true, html: introHtml },
            { key: 'who',   title: '⚔️ Qui es-tu ?',             html: whoHtml },
            { key: 'from',  title: '🌍 D’où viens-tu ?',          html: fromHtml },
            { key: 'stats', title: '💪 Tes caractéristiques',      html: statsHtml },
            { key: 'prof',  title: '🎯 Tes maîtrises',             html: profHtml },
            { key: 'hp',    title: '❤️ Points de vie & défense',   html: hpHtml },
            { key: 'gear',  title: '🎒 Équipement & aptitudes',    html: gearHtml },
            { key: 'done',  title: '🎉 C’est prêt !',              html: doneHtml }
        ];
    }

    function introHtml() {
        const c = completion();
        return `<p>Je remplis ta fiche avec toi. Dès que tu choisis une race et une classe,
            j'en déduis <b>tout ce qui peut l'être</b> : bonus de caractéristiques, vitesse,
            langues, dé de vie, PV, maîtrises, équipement de départ et aptitudes gagnées.</p>
            ${c.pct > 0 && c.pct < 100
                ? `<div class="pjw-meter"><div class="pjw-meter-bar"><i style="width:${c.pct}%"></i></div>
                   <span>${c.pct}% de la fiche est déjà rempli</span></div>
                   <p class="pjw-note">Il manque : ${esc(c.missing.join(', '))}.</p>`
                : `<p class="pjw-note">Tu peux passer à tout moment ; rien de ce que tu as saisi n'est perdu,
                   et tout reste modifiable sur la fiche ensuite.</p>`}
            <p class="pjw-note">Ton contenu personnel (classes, races, sorts créés dans « Mon contenu »)
            est proposé au même titre que le contenu officiel.</p>`;
    }

    async function whoHtml() {
        const classes = await catList('classes');
        const names = classes.length ? classes.map(c => c.name) : FALLBACK_CLASSES;
        await resolve();
        const subs = wiz.cls ? (wiz.cls.subclasses || []).map(s => s.name) : [];
        return inputRow('name', 'Nom du personnage', { ph: 'Ex : Thorgrim' })
            + inputRow('class', 'Classe', { list: 'pjw-classes', ph: 'Ex : Guerrier' })
            + datalist('pjw-classes', names)
            + `<div class="pjw-2col">
                <div>${inputRow('subclass', 'Sous-classe', { list: 'pjw-subs', ph: subs.length ? 'Facultatif' : 'Vide si niveau < 3' })}
                    ${datalist('pjw-subs', subs)}</div>
                <div>${inputRow('level', 'Niveau', { type: 'number', min: '1', max: '20' })}</div>
               </div>`
            + (wiz.cls ? classSummary(wiz.cls) : `<p class="pjw-note">Choisis une classe : son dé de vie,
                ses maîtrises et son équipement de départ apparaîtront ici.</p>`);
    }

    function classSummary(c) {
        const p = c.proficiencies || {};
        const bits = [];
        if (c.hit_die) bits.push(`dé de vie <b>d${c.hit_die}</b>`);
        if ((p.saves || []).length) bits.push(`sauvegardes <b>${esc(p.saves.join(' et '))}</b>`);
        const cast = { full: 'lanceur complet', half: 'demi-lanceur', pact: 'magie de pacte',
                       third: 'tiers-lanceur' }[(c.spellcasting || {}).type];
        if (cast) bits.push(cast);
        return `<p class="pjw-found">✓ ${esc(c.name)}${c.source === 'perso' ? ' <i>(ton contenu)</i>' : ''}
            — ${bits.join(', ')}.</p>`;
    }

    async function fromHtml() {
        const races = await catList('races');
        const names = races.length ? races.map(r => r.name) : FALLBACK_RACES;
        await resolve();
        const subs = wiz.race ? (wiz.race.subraces || []).map(s => s.name) : [];
        const bg = (await catList('backgrounds')).map(b => b.name);
        const b = racialBonuses();
        const bonusTxt = Object.keys(b).map(k =>
            `${(STATS.find(s => s[0] === k) || [])[1]} ${signed(b[k])}`).join(', ');
        return inputRow('race', 'Espèce / race', { list: 'pjw-races', ph: 'Ex : Nain' })
            + datalist('pjw-races', names)
            + (subs.length ? inputRow('subrace', 'Sous-race', { list: 'pjw-subraces' })
                             + datalist('pjw-subraces', subs) : '')
            + inputRow('background', 'Historique', { list: 'pjw-bg', ph: 'Ex : Acolyte' })
            + datalist('pjw-bg', bg.length ? bg : ['Acolyte'])
            + inputRow('alignment', 'Alignement', { list: 'pjw-align', ph: 'Ex : Chaotique Bon' })
            + datalist('pjw-align', ALIGNEMENTS)
            + (wiz.race ? `<p class="pjw-found">✓ ${esc(wiz.race.name)}
                ${wiz.race.source === 'perso' ? '<i>(ton contenu)</i>' : ''}
                ${bonusTxt ? '— ' + esc(bonusTxt) : ''}
                ${wiz.race.speed ? ` · vitesse ${esc(wiz.race.speed)}` : ''}
                ${wiz.race.size ? ` · taille ${esc(wiz.race.size)}` : ''}</p>` : '');
    }

    function statsHtml() {
        const b = racialBonuses();
        const tabs = [['points', '27 points'], ['standard', 'Tableau standard'], ['roll', '4d6, garde 3']];
        const rows = STATS.map(s => {
            const k = s[0];
            const bonus = b[k] || 0;
            return `<div class="pjw-srow" data-stat="${k}">
                <label>${s[1]}</label>
                <span class="pjw-sctl" data-ctl="${k}"></span>
                <span class="pjw-sbonus">${bonus ? signed(bonus) : ''}</span>
                <b class="pjw-stotal" data-total="${k}">—</b>
                <span class="pjw-smod" data-mod="${k}"></span>
            </div>`;
        }).join('');
        return `<div class="pjw-tabs">${tabs.map(t =>
                `<button type="button" class="pjw-tab${wiz.method === t[0] ? ' is-on' : ''}" data-method="${t[0]}">${t[1]}</button>`).join('')}</div>
            <p class="pjw-note" data-method-note></p>
            <div class="pjw-srows">${rows}</div>
            <div class="pjw-shead"><span>Valeur</span><span>Race</span><span>Total</span><span>Mod</span></div>`;
    }

    async function profHtml() {
        await resolve();
        const p = (wiz.cls && wiz.cls.proficiencies) || {};
        const sk = p.skills || {};
        const from = (sk.from && sk.from.length) ? sk.from : ALL_SKILLS.map(k => SKILL_LABEL[k]);
        const n = sk.choose || 0;
        const bgSkills = (wiz.bg && wiz.bg.proficiencies && wiz.bg.proficiencies.skills) || [];
        return ((p.saves || []).length
                ? `<p class="pjw-found">✓ Jets de sauvegarde maîtrisés : <b>${esc(p.saves.join(', '))}</b>
                   — je les coche pour toi.</p>` : '')
            + (n ? `<label class="pjw-lbl">Compétences — choisis-en ${n}
                    <span class="pjw-count" data-skill-count></span></label>`
                 : `<label class="pjw-lbl">Compétences maîtrisées</label>`)
            + `<div class="pjw-chips" data-skills>` + from.map(s => {
                const key = fold(s);
                return `<label class="pjw-chip"><input type="checkbox" data-skill="${esc(s)}"
                    ${wiz.skills.includes(s) ? 'checked' : ''}${SKILL_ID[key] ? '' : ' disabled'}> ${esc(s)}</label>`;
              }).join('') + `</div>`
            + (bgSkills.length ? `<p class="pjw-note">Ton historique t'apporte aussi :
                ${esc(bgSkills.join(', '))} — je les ajoute.</p>` : '')
            + (p.armor || p.weapons ? `<p class="pjw-note">Maîtrises de la classe :
                ${esc([p.armor, p.weapons, p.tools].filter(x => x && x !== 'aucun').join(' · '))}</p>` : '');
    }

    async function hpHtml() {
        await resolve();
        const lvl = charLevel();
        const die = (wiz.cls && wiz.cls.hit_die) || 8;
        const conMod = mod(finalScore('con'));
        const avg = Math.floor(die / 2) + 1;
        const suggested = Math.max(1, die + conMod + (lvl - 1) * (avg + conMod));
        if (!wiz.data.hpmax) wiz.data.hpmax = String(suggested);
        if (!wiz.data.ac) wiz.data.ac = String(10 + mod(finalScore('dex')));
        if (!wiz.data.speed && wiz.race && wiz.race.speed) wiz.data.speed = wiz.race.speed;
        return `<div class="pjw-2col">
                <div>${inputRow('hpmax', 'PV maximum', { type: 'number', min: '1' })}</div>
                <div>${inputRow('ac', 'Classe d’armure', { type: 'number', min: '1' })}</div>
            </div>
            ${inputRow('speed', 'Vitesse', { ph: '9 m' })}
            <p class="pjw-note">Calcul proposé : <b>d${die}</b> ${signed(conMod)} (Constitution)
            ${lvl > 1 ? ` puis ${lvl - 1} × (${avg} ${signed(conMod)})` : ''} = <b>${suggested} PV</b>.
            La CA part de 10 ${signed(mod(finalScore('dex')))} (Dextérité) : ajuste-la selon ton armure.</p>`;
    }

    async function gearHtml() {
        await resolve();
        const lvl = charLevel();
        const items = ((wiz.cls && wiz.cls.equipment) || {}).items || [];
        const feats = gainedFeatures(lvl);
        const traits = raceTraits();
        const slots = spellSlotsAt(lvl);
        const block = (key, title, list, note) => list.length
            ? `<label class="pjw-check pjw-block"><input type="checkbox" data-add="${key}" checked>
                 <b>${title}</b></label>
               <ul class="pjw-ul">${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
               ${note ? `<p class="pjw-note">${note}</p>` : ''}`
            : '';
        if (!items.length && !feats.length && !traits.length && !slots) {
            return `<p>Rien à pré-remplir ici : choisis une classe et une race pour que je
                puisse te proposer l'équipement de départ et les aptitudes.</p>`;
        }
        return block('gear', 'Équipement de départ → inventaire', items,
                     'Les choix « (a) ou (b) » sont ajoutés tels quels : garde la ligne qui te convient.')
            + block('feats', `Aptitudes jusqu'au niveau ${lvl} → capacités`, feats.map(f =>
                    `${f.name} (niv. ${f.level}${f.subclass ? ' · ' + f.from : ''})`))
            + block('traits', 'Traits raciaux → capacités', traits.map(t => t.name))
            + (slots ? `<label class="pjw-check pjw-block"><input type="checkbox" data-add="slots" checked>
                 <b>Emplacements de sorts</b></label>
               <p class="pjw-note">${esc(Object.keys(slots).sort((a, b) => a - b)
                    .map(r => `niveau ${r} : ${slots[r]}`).join(' · '))}</p>` : '');
    }

    /** Toutes les aptitudes obtenues du niveau 1 au niveau choisi. */
    function gainedFeatures(lvl) {
        if (!wiz.cls || !window.SRD.levelInfo) return [];
        const out = [], seen = new Set();
        for (let i = 1; i <= lvl; i++) {
            const info = window.SRD.levelInfo(wiz.cls, i, wiz.sub);
            (info ? info.features : []).forEach(f => {
                if (seen.has(f.name + '@' + i)) return;
                seen.add(f.name + '@' + i);
                out.push(Object.assign({ level: i }, f));
            });
        }
        return out;
    }

    function raceTraits() {
        const skip = ['age', 'alignement', 'categorie de taille', 'vitesse', 'langues',
                      'augmentation de caracteristique'];
        const all = [];
        [wiz.race, wiz.subrace].forEach(src => {
            (src && src.traits || []).forEach(t => {
                if (skip.includes(fold(t.name))) return;
                all.push(t);
            });
        });
        return all;
    }

    function spellSlotsAt(lvl) {
        if (!wiz.cls || !window.SRD.levelInfo) return null;
        const info = window.SRD.levelInfo(wiz.cls, lvl, wiz.sub);
        if (info && info.spell_slots) return info.spell_slots;
        const cs = info && info.class_specific;
        if (cs && cs.spell_slots_count) {
            const o = {}; o[cs.slot_level] = cs.spell_slots_count; return o;
        }
        return null;
    }

    function doneHtml() {
        const c = completion();
        return `<p>Je reporte tout ça sur ta fiche. Tu pourras <b>tout modifier</b> directement dessus,
            à tout moment.</p>
            <div class="pjw-meter"><div class="pjw-meter-bar"><i style="width:${c.pct}%"></i></div>
            <span>${c.pct}% avant application</span></div>
            <p class="pjw-note">Juste après, je te fais visiter la fiche en 1 minute (ça aussi, tu peux passer 😉).</p>`;
    }

    // ---------- Collecte ----------
    function collectWizInputs() {
        const ov = byId('pj-wizard'); if (!ov) return;
        ov.querySelectorAll('[data-wiz]').forEach(inp => { wiz.data[inp.dataset.wiz] = inp.value.trim(); });
        const skillBox = ov.querySelector('[data-skills]');
        if (skillBox) {
            wiz.skills = [...skillBox.querySelectorAll('[data-skill]:checked')].map(i => i.dataset.skill);
        }
        ov.querySelectorAll('[data-add]').forEach(i => { wiz.data['add-' + i.dataset.add] = i.checked; });
    }

    // ---------- Application sur la fiche ----------
    async function applyWizData() {
        await resolve();
        const d = wiz.data;
        const lvl = charLevel();

        setField('char-name', d.name);
        setField('char-class', wiz.cls ? wiz.cls.name : d.class);
        setField('char-subclass', wiz.sub ? wiz.sub.name : d.subclass);
        setField('char-level', lvl);
        setField('char-race', wiz.subrace ? `${wiz.race.name} (${wiz.subrace.name})`
                                          : (wiz.race ? wiz.race.name : d.race));
        setField('char-background', wiz.bg ? wiz.bg.name : d.background);
        setField('char-alignment', d.alignment);

        STATS.forEach(s => { if (wiz.base[s[0]]) setField('stat-' + s[0], finalScore(s[0])); });

        if (wiz.race) {
            setField('char-size', wiz.race.size);
            setField('speed', d.speed || wiz.race.speed);
            setField('char-languages', wiz.race.languages);
        } else {
            setField('speed', d.speed);
        }
        setField('hp-max', d.hpmax);
        setField('hp-current', d.hpmax);
        setField('armor-class', d.ac);
        if (wiz.cls && wiz.cls.hit_die) {
            setField('hd-size', wiz.cls.hit_die);
            setField('hd-max', lvl);
        }
        const ability = (wiz.cls && wiz.cls.spellcasting || {}).ability;
        if (ability && ABIL_KEY[fold(ability)]) setField('spellcasting-ability', ABIL_KEY[fold(ability)]);

        const api = window.SheetApi;
        if (!api) return;

        // Jets de sauvegarde de la classe + compétences choisies + historique
        ((wiz.cls && wiz.cls.proficiencies || {}).saves || []).forEach(s => {
            const id = SAVE_ID[fold(s)];
            if (id) api.setSkillProf(id, 1);
        });
        const skills = wiz.skills.slice();
        ((wiz.bg && wiz.bg.proficiencies || {}).skills || []).forEach(s => {
            if (!skills.includes(s)) skills.push(s);
        });
        skills.forEach(s => {
            const id = SKILL_ID[fold(s)];
            if (id) api.setSkillProf(id, 1);
        });

        if (d['add-gear'] !== false) {
            api.addInventory(((wiz.cls && wiz.cls.equipment) || {}).items || []);
        }
        if (d['add-feats'] !== false) {
            api.addTraits(gainedFeatures(lvl).map(f => ({
                name: f.name, type: 'class', level: f.level, desc: f.text
            })));
        }
        if (d['add-traits'] !== false) {
            api.addTraits(raceTraits().map(t => ({ name: t.name, type: 'race', desc: t.text })));
        }
        if (d['add-slots'] !== false) {
            const slots = spellSlotsAt(lvl);
            if (slots) api.setSpellSlots(slots);
        }
        api.refresh();
    }

    async function closeWizard(applyThenTuto) {
        collectWizInputs();
        try { await applyWizData(); }          // même en passant : rien de saisi n'est perdu
        catch (e) { console.warn('assistant : application partielle', e); }
        const ov = byId('pj-wizard'); if (ov) ov.remove();
        dismissResume();
        if (applyThenTuto !== false) startPjTutorial(false);   // enchaîne sur la visite (si jamais vue)
    }

    async function showWizStep() {
        // Choisir une classe redessine l'étape : on relit d'abord ce qui est à
        // l'écran, sinon une saisie faite juste avant serait écrasée au rendu.
        collectWizInputs();
        const list = steps();
        if (wiz.step >= list.length) { closeWizard(); return; }
        const st = list[wiz.step];
        let ov = byId('pj-wizard');
        if (!ov) {
            ov = document.createElement('div'); ov.id = 'pj-wizard'; ov.className = 'no-print';
            ov.innerHTML = '<div class="pjw-card" role="dialog" aria-label="Assistant de création"></div>';
            document.body.appendChild(ov);
        }
        const card = ov.querySelector('.pjw-card');
        const last = wiz.step === list.length - 1;
        const dots = list.map((_, i) => `<span class="pjw-dot${i === wiz.step ? ' is-on' : ''}"></span>`).join('');
        const body = await st.html();
        card.innerHTML = `
            <div class="pjw-head">${st.title}</div>
            <div class="pjw-body">${body}</div>
            <div class="pjw-dots">${dots}</div>
            <div class="pjw-btns">` + (st.choice
                ? `<button class="pjw-btn pjw-skip" data-pjw="skip">Passer — je remplis moi-même</button>
                   <button class="pjw-btn pjw-primary" data-pjw="next">✨ Me guider</button>`
                : `<button class="pjw-btn pjw-skip" data-pjw="skip">Passer le guide</button>
                   <span class="pjw-spacer"></span>
                   ${wiz.step > 1 ? '<button class="pjw-btn" data-pjw="prev">← Précédent</button>' : ''}
                   <button class="pjw-btn pjw-primary" data-pjw="next">${last ? 'Terminer ✓' : 'Suivant →'}</button>`) +
            `</div>`;
        card.scrollTop = 0;

        if (st.key === 'stats') wireStats(card);
        if (st.key === 'prof') wireSkills(card);

        // Choisir une classe / une race change ce qui est déduit : on redessine.
        ['class', 'subclass', 'race', 'subrace', 'background', 'level'].forEach(k => {
            const inp = card.querySelector(`[data-wiz="${k}"]`);
            if (!inp) return;
            inp.addEventListener('change', async () => { collectWizInputs(); await showWizStep(); });
        });

        card.querySelectorAll('[data-pjw]').forEach(b => b.addEventListener('click', async () => {
            collectWizInputs();
            const act = b.dataset.pjw;
            if (act === 'skip') { closeWizard(); return; }
            if (act === 'prev') { wiz.step = Math.max(1, wiz.step - 1); await showWizStep(); return; }
            wiz.step++; await showWizStep();
        }));
        // Entrée dans un champ = étape suivante (confort clavier)
        card.querySelectorAll('input.pjw-in').forEach(inp => inp.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') { e.preventDefault(); collectWizInputs(); wiz.step++; await showWizStep(); }
        }));
        const first = card.querySelector('input.pjw-in:not([type=checkbox])');
        if (first) setTimeout(() => first.focus(), 60);
    }

    // ---------- Étape caractéristiques : trois méthodes ----------
    function wireStats(card) {
        const note = card.querySelector('[data-method-note]');

        function draw() {
            const b = racialBonuses();
            STATS.forEach(s => {
                const k = s[0];
                const ctl = card.querySelector(`[data-ctl="${k}"]`);
                if (wiz.method === 'points') {
                    ctl.innerHTML = `<input type="number" class="pjw-in pjw-stat-in" min="8" max="15"
                        data-score="${k}" value="${wiz.base[k] || 8}">`;
                } else {
                    const pool = wiz.method === 'standard' ? STANDARD : (wiz.pool || []);
                    const used = STATS.filter(o => o[0] !== k).map(o => wiz.base[o[0]]).filter(v => v != null);
                    const avail = pool.slice();
                    used.forEach(v => { const i = avail.indexOf(v); if (i >= 0) avail.splice(i, 1); });
                    const mine = wiz.base[k];
                    const opts = (mine != null ? [mine] : []).concat(avail)
                        .map(v => `<option value="${v}"${v === mine ? ' selected' : ''}>${v}</option>`).join('');
                    ctl.innerHTML = `<select class="pjw-in pjw-stat-in" data-score="${k}">
                        <option value="">—</option>${opts}</select>`;
                }
                const total = wiz.base[k] != null ? finalScore(k) : null;
                card.querySelector(`[data-total="${k}"]`).textContent = total == null ? '—' : total;
                card.querySelector(`[data-mod="${k}"]`).textContent = total == null ? '' : signed(mod(total));
                const bo = card.querySelector(`.pjw-srow[data-stat="${k}"] .pjw-sbonus`);
                if (bo) bo.textContent = b[k] ? signed(b[k]) : '';
            });
            if (wiz.method === 'points') {
                const left = 27 - pointsSpent();
                note.innerHTML = `Répartition à 27 points : chaque valeur va de 8 à 15
                    (14 en coûte 7, 15 en coûte 9). <b class="${left < 0 ? 'pjw-bad' : ''}">Reste ${left} point${Math.abs(left) > 1 ? 's' : ''}.</b>`;
            } else if (wiz.method === 'standard') {
                note.innerHTML = `Tableau standard : place <b>15, 14, 13, 12, 10, 8</b>,
                    une valeur par caractéristique.`;
            } else {
                note.innerHTML = wiz.pool
                    ? `Tirage : <b>${wiz.pool.join(', ')}</b>. Place-les où tu veux.
                       <button type="button" class="pjw-btn pjw-mini" data-reroll>🎲 Relancer</button>`
                    : `<button type="button" class="pjw-btn pjw-mini" data-reroll>🎲 Lancer 6 × 4d6</button>`;
            }
            bind();
        }

        function bind() {
            card.querySelectorAll('[data-score]').forEach(el => {
                el.addEventListener('change', () => {
                    const v = el.value === '' ? null : parseInt(el.value, 10);
                    wiz.base[el.dataset.score] = v;
                    draw();
                });
                if (el.tagName === 'INPUT') el.addEventListener('input', () => {
                    const v = Math.max(8, Math.min(15, parseInt(el.value, 10) || 8));
                    wiz.base[el.dataset.score] = v;
                    draw();
                });
            });
            const rr = card.querySelector('[data-reroll]');
            if (rr) rr.addEventListener('click', () => {
                wiz.pool = Array.from({ length: 6 }, roll4d6).sort((a, b) => b - a);
                STATS.forEach(s => { wiz.base[s[0]] = null; });
                draw();
            });
        }

        card.querySelectorAll('[data-method]').forEach(b => b.addEventListener('click', () => {
            wiz.method = b.dataset.method;
            card.querySelectorAll('[data-method]').forEach(x => x.classList.toggle('is-on', x === b));
            STATS.forEach(s => { wiz.base[s[0]] = wiz.method === 'points' ? 8 : null; });
            if (wiz.method === 'roll' && !wiz.pool) wiz.pool = null;
            draw();
        }));
        if (wiz.method === 'points') STATS.forEach(s => { if (wiz.base[s[0]] == null) wiz.base[s[0]] = 8; });
        draw();
    }

    // ---------- Étape maîtrises : limite le nombre de choix ----------
    function wireSkills(card) {
        const box = card.querySelector('[data-skills]'); if (!box) return;
        const max = ((wiz.cls && wiz.cls.proficiencies || {}).skills || {}).choose || 0;
        const counter = card.querySelector('[data-skill-count]');
        const update = () => {
            const checked = [...box.querySelectorAll('[data-skill]:checked')];
            if (counter) counter.textContent = max ? `(${checked.length}/${max})` : '';
            box.querySelectorAll('[data-skill]').forEach(i => {
                i.disabled = !SKILL_ID[fold(i.dataset.skill)]
                          || (!!max && !i.checked && checked.length >= max);
            });
        };
        box.addEventListener('change', () => { collectWizInputs(); update(); });
        update();
    }

    function startWizard() { wiz.step = 0; showWizStep(); }

    // ---------- Reprise sur une fiche inachevée ----------
    // Pas de relance automatique : une bannière discrète, qu'on peut écarter.
    const resumeKey = () => (localStorage.getItem('dnd-active-char') || '') + '_dnd-pj-wizard-off';
    function dismissResume() {
        try { localStorage.setItem(resumeKey(), '1'); } catch (e) {}
        byId('pj-resume')?.remove();
    }
    function offerResume() {
        if (byId('pj-resume') || localStorage.getItem(resumeKey())) return;
        const c = completion();
        if (c.pct >= 85) return;
        const bar = document.createElement('div');
        bar.id = 'pj-resume'; bar.className = 'no-print';
        bar.innerHTML = `<span>Fiche remplie à <b>${c.pct}%</b> — il manque ${esc(c.missing.slice(0, 3).join(', '))}
            ${c.missing.length > 3 ? '…' : ''}</span>
            <button type="button" class="pjw-btn pjw-primary" data-resume>✨ Terminer avec l'assistant</button>
            <button type="button" class="pjw-btn" data-resume-off aria-label="Masquer">✕</button>`;
        document.body.appendChild(bar);
        bar.querySelector('[data-resume]').addEventListener('click', () => { bar.remove(); startWizard(); });
        bar.querySelector('[data-resume-off]').addEventListener('click', dismissResume);
    }

    // =====================================================
    // 2. TUTORIEL DE LA FICHE (spotlight)
    // =====================================================
    let tutoIdx = 0, tutoSteps = [];
    function buildTutoSteps() {
        const all = [
            { icon: '📜', title: 'Voici ta fiche !', text: 'Petite visite guidée (1 minute). Tout se sauvegarde automatiquement pendant que tu écris. Tu peux revoir cette visite à tout moment via le menu ☰ en haut à droite.' },
            { sel: '#widget-hp', icon: '❤️', title: 'Tes points de vie', text: 'La barre suit tes PV. Saisis un montant puis 💥 (dégâts) ou 💚 (soins) — les PV temporaires ont leur propre case.' },
            { sel: '#widget-stats', icon: '💪', title: 'Caractéristiques & compétences', text: 'Clique sur le NOM d\'une caractéristique ou d\'une compétence pour lancer le d20 correspondant ! Le bouton ○ devant chaque compétence = maîtrise (●) puis expertise (★) en double-cliquant.' },
            { sel: '#widget-combat', icon: '🛡️', title: 'Le combat', text: 'CA, initiative, vitesse… tout est là. Ces valeurs sont visibles par ton MJ quand tu es connecté à sa session.' },
            { sel: '#widget-attacks', icon: '⚔️', title: 'Tes attaques', text: 'Ajoute tes armes et sorts d\'attaque : un clic lance le jet complet (toucher + dégâts), rangeables par onglets.' },
            { sel: '#widget-spells', icon: '✨', title: 'Tes sorts', text: 'Ton grimoire : ajoute tes sorts, prépare-les, suis tes emplacements. Les caractéristiques de magie (DD, bonus) se calculent automatiquement.' },
            { sel: '#widget-inventory', icon: '🎒', title: 'Ton sac à dos', text: 'Objets, pièces, encombrement… avec des onglets personnalisables pour t\'organiser.' },
            { sel: '#widget-rests', icon: '🌙', title: 'Les repos', text: 'Repos court (dés de vie) ou long (récupération complète) en un clic. Ton MJ est prévenu si tu es en session.' },
            { sel: '#btn-settings-toggle', icon: '☰', title: 'Le menu', text: 'Thème et couleurs, disposition de la fiche, connexion à la session de ton MJ (code à 6 caractères)… et le bouton pour REVOIR ce tutoriel. Bonne aventure ! 🎲' }
        ];
        // On ne garde que les étapes dont la cible existe et est visible (selon la disposition)
        return all.filter(s => !s.sel || (document.querySelector(s.sel) && document.querySelector(s.sel).offsetParent !== null));
    }
    function onTutoKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); endPjTutorial(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); tutoIdx++; showTutoStep(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); tutoIdx = Math.max(0, tutoIdx - 1); showTutoStep(); }
    }
    function startPjTutorial(force) {
        if (!force && localStorage.getItem(TUTO_FLAG)) return;
        const app = byId('app-screen');
        if (!app || app.classList.contains('hidden')) return;      // pas sur la fiche
        tutoSteps = buildTutoSteps(); tutoIdx = 0;
        let ov = byId('pj-tuto');
        if (!ov) {
            ov = document.createElement('div'); ov.id = 'pj-tuto'; ov.className = 'no-print';
            ov.innerHTML = '<div class="pj-tuto-spot"></div><div class="pjw-card pj-tuto-card" role="dialog" aria-label="Tutoriel de la fiche"></div>';
            document.body.appendChild(ov);
        }
        document.addEventListener('keydown', onTutoKey, true);
        showTutoStep();
    }
    function endPjTutorial() {
        try { localStorage.setItem(TUTO_FLAG, '1'); } catch (e) {}
        document.removeEventListener('keydown', onTutoKey, true);
        const ov = byId('pj-tuto'); if (ov) ov.remove();
    }
    function showTutoStep() {
        if (tutoIdx >= tutoSteps.length) { endPjTutorial(); return; }
        const st = tutoSteps[tutoIdx];
        const ov = byId('pj-tuto'); if (!ov) return;
        const spot = ov.querySelector('.pj-tuto-spot'), card = ov.querySelector('.pj-tuto-card');
        let r = null;
        if (st.sel) {
            const el = document.querySelector(st.sel);
            if (el && el.offsetParent !== null) {
                try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
                r = el.getBoundingClientRect();
            }
        }
        spot.classList.toggle('pj-tuto-spot-none', !r);
        if (r) {
            const pad = 6;
            spot.style.left = (r.left - pad) + 'px'; spot.style.top = (r.top - pad) + 'px';
            spot.style.width = (r.width + pad * 2) + 'px'; spot.style.height = (r.height + pad * 2) + 'px';
        } else { spot.style.left = '50%'; spot.style.top = '50%'; spot.style.width = '0'; spot.style.height = '0'; }
        const last = tutoIdx === tutoSteps.length - 1;
        const dots = tutoSteps.map((_, i) => `<span class="pjw-dot${i === tutoIdx ? ' is-on' : ''}"></span>`).join('');
        card.innerHTML = `
            <div class="pjw-head">${st.icon} ${esc(st.title)}</div>
            <div class="pjw-body"><p>${esc(st.text)}</p></div>
            <div class="pjw-dots">${dots}</div>
            <div class="pjw-btns">
                <button class="pjw-btn pjw-skip" data-pjt="skip">Passer</button>
                <span class="pjw-spacer"></span>
                ${tutoIdx > 0 ? '<button class="pjw-btn" data-pjt="prev">← Précédent</button>' : ''}
                <button class="pjw-btn pjw-primary" data-pjt="next">${last ? 'Terminer ✓' : 'Suivant →'}</button>
            </div>`;
        card.querySelectorAll('[data-pjt]').forEach(b => b.addEventListener('click', () => {
            const act = b.dataset.pjt;
            if (act === 'skip') { endPjTutorial(); return; }
            if (act === 'prev') { tutoIdx = Math.max(0, tutoIdx - 1); showTutoStep(); return; }
            tutoIdx++; showTutoStep();
        }));
        // Position de la bulle : à côté de la cible sans déborder, sinon centrée
        const vw = window.innerWidth, vh = window.innerHeight;
        const cw = card.offsetWidth, chh = card.offsetHeight;
        let cx = (vw - cw) / 2, cy = (vh - chh) / 2;
        if (r) {
            const M = 14;
            if (r.right + M + cw <= vw - 8) { cx = r.right + M; cy = r.top; }
            else if (r.left - M - cw >= 8) { cx = r.left - M - cw; cy = r.top; }
            else if (r.bottom + M + chh <= vh - 8) { cx = r.left; cy = r.bottom + M; }
            else if (r.top - M - chh >= 8) { cx = r.left; cy = r.top - M - chh; }
            cx = Math.max(8, Math.min(cx, vw - cw - 8));
            cy = Math.max(8, Math.min(cy, vh - chh - 8));
        }
        card.style.left = cx + 'px'; card.style.top = cy + 'px';
    }

    // =====================================================
    // Bouton « Revoir » dans le menu ☰ + déclenchement au chargement
    // =====================================================
    function injectMenuButtons() {
        const dd = byId('settings-dropdown'); if (!dd || byId('btn-pj-tuto-replay')) return;
        const wrap = document.createElement('div');
        wrap.className = 'player-only-setting';
        wrap.innerHTML = `<hr>
            <label style="font-weight:bold; font-size:0.85rem; color:var(--primary-color);">🎓 Aide :</label>
            <button id="btn-pj-tuto-replay" class="btn-small" style="width:100%; margin-top:4px;">🎓 Revoir le tutoriel de la fiche</button>
            <button id="btn-pj-wizard-replay" class="btn-small" style="width:100%; margin-top:5px;">✨ Relancer l'assistant de création</button>`;
        dd.appendChild(wrap);
        byId('btn-pj-tuto-replay').addEventListener('click', () => { dd.classList.add('hidden'); startPjTutorial(true); });
        byId('btn-pj-wizard-replay').addEventListener('click', () => { dd.classList.add('hidden'); startWizard(); });
    }

    function injectStyles() {
        const css = `
        #pj-wizard, #pj-tuto { position: fixed; inset: 0; z-index: 99990; }
        #pj-wizard { background: rgba(20, 12, 4, 0.55); backdrop-filter: blur(2px); }
        .pjw-card { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(460px, calc(100vw - 24px)); max-height: calc(100vh - 30px); overflow: auto;
            background: var(--sheet-bg-color, #FAF3E0); border: 1px solid var(--accent-color, #C49B35); border-radius: 14px; padding: 16px 18px;
            box-shadow: 0 14px 44px rgba(0,0,0,0.5); font-family: 'Lora', serif; color: var(--text-color, #3a2e1f); }
        .pjw-head { font-family: 'Cinzel', serif; font-weight: bold; font-size: 1.08rem; color: var(--primary-color, #7A2828); margin-bottom: 10px; }
        .pjw-body p { margin: 0 0 8px; font-size: 0.9rem; line-height: 1.5; }
        .pjw-note { font-size: 0.78rem; color: #8a7a5e; font-style: italic; }
        .pjw-bad { color: #c0392b; }
        .pjw-found { font-size: 0.82rem; color: #3d7a3d; background: rgba(61,122,61,0.08);
            border-radius: 8px; padding: 6px 9px; margin: 8px 0 0 !important; }
        .pjw-lbl { display: block; font-size: 0.8rem; font-weight: bold; color: var(--primary-color, #7A2828); margin: 8px 0 3px; }
        .pjw-in { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid rgba(122,40,40,0.3); border-radius: 8px; font-family: 'Lora', serif; font-size: 0.9rem; background: rgba(255,255,255,0.75); color: inherit; }
        .pjw-in:focus { outline: none; border-color: var(--accent-color, #C49B35); box-shadow: 0 0 0 2px rgba(196,155,53,0.2); }
        .pjw-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .pjw-tabs { display: flex; gap: 4px; margin-bottom: 8px; flex-wrap: wrap; }
        .pjw-tab { flex: 1 1 auto; padding: 6px 8px; border-radius: 8px; cursor: pointer; font-family: 'Lora', serif;
            font-size: 0.78rem; border: 1px solid rgba(122,40,40,0.3); background: rgba(255,255,255,0.6); color: inherit; }
        .pjw-tab.is-on { background: linear-gradient(160deg, #d9af45, #b8862c); border-color: transparent; color: #2a1c0a; font-weight: bold; }
        .pjw-srows { display: flex; flex-direction: column; gap: 5px; margin-top: 6px; }
        .pjw-srow { display: grid; grid-template-columns: 1fr 84px 34px 34px 34px; align-items: center; gap: 6px; font-size: 0.84rem; }
        .pjw-shead { display: grid; grid-template-columns: 1fr 84px 34px 34px 34px; gap: 6px; font-size: 0.66rem;
            text-transform: uppercase; letter-spacing: .05em; color: #8a7a5e; margin-top: 4px; }
        .pjw-shead span:first-child { grid-column: 2; }
        .pjw-srow .pjw-in { padding: 5px 6px; text-align: center; font-size: 0.85rem; }
        .pjw-sbonus { text-align: center; font-size: 0.78rem; color: #3d7a3d; }
        .pjw-stotal { text-align: center; font-family: 'Cinzel', serif; }
        .pjw-smod { text-align: center; color: var(--accent-color, #C49B35); font-family: 'Cinzel', serif; font-size: 0.82rem; }
        .pjw-mini { padding: 3px 8px !important; font-size: 0.75rem !important; }
        .pjw-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 4px; }
        .pjw-chip { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; padding: 4px 10px;
            border-radius: 20px; font-size: 0.78rem; border: 1px solid rgba(122,40,40,0.25); background: rgba(255,255,255,0.5); }
        .pjw-chip:has(input:checked) { background: rgba(196,155,53,0.28); border-color: var(--accent-color, #C49B35); }
        .pjw-chip:has(input:disabled) { opacity: 0.45; cursor: not-allowed; }
        .pjw-count { font-weight: normal; color: var(--accent-color, #C49B35); }
        .pjw-check { display: flex; align-items: center; gap: 7px; font-size: 0.85rem; cursor: pointer; }
        .pjw-block { margin-top: 10px; }
        .pjw-ul { margin: 4px 0 6px 22px; padding: 0; font-size: 0.82rem; line-height: 1.45; }
        .pjw-meter { display: flex; align-items: center; gap: 8px; margin: 10px 0; font-size: 0.8rem; }
        .pjw-meter-bar { flex: 1 1 auto; height: 8px; border-radius: 6px; background: rgba(122,40,40,0.15); overflow: hidden; }
        .pjw-meter-bar i { display: block; height: 100%; background: linear-gradient(90deg, #b8862c, #d9af45); transition: width .3s; }
        .pjw-dots { display: flex; gap: 5px; justify-content: center; margin: 12px 0 10px; }
        .pjw-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(122,40,40,0.2); transition: background 0.2s, transform 0.2s; }
        .pjw-dot.is-on { background: var(--accent-color, #C49B35); transform: scale(1.25); }
        .pjw-btns { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .pjw-spacer { flex: 1; }
        .pjw-btn { padding: 8px 12px; border-radius: 9px; border: 1px solid rgba(122,40,40,0.3); background: rgba(255,255,255,0.6); font-family: 'Lora', serif; font-size: 0.84rem; cursor: pointer; color: inherit; }
        .pjw-btn:hover { border-color: var(--accent-color, #C49B35); }
        .pjw-primary { background: linear-gradient(160deg, #d9af45, #b8862c); border: none; color: #2a1c0a; font-weight: bold; }
        .pjw-skip { opacity: 0.75; }
        /* Bannière de reprise d'une fiche inachevée */
        #pj-resume { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 9500;
            display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center;
            max-width: min(560px, calc(100vw - 20px)); padding: 9px 13px; border-radius: 12px;
            background: var(--sheet-bg-color, #FAF3E0); border: 1px solid var(--accent-color, #C49B35);
            box-shadow: 0 8px 26px rgba(0,0,0,0.35); font-family: 'Lora', serif; font-size: 0.82rem;
            color: var(--text-color, #3a2e1f); }
        /* Tuto fiche : spotlight (assombrit tout sauf la cible) + bulle positionnée */
        .pj-tuto-spot { position: fixed; border-radius: 10px; box-shadow: 0 0 0 200vmax rgba(12, 8, 3, 0.72); border: 2px solid var(--accent-color, #C49B35); pointer-events: none; transition: left 0.28s ease, top 0.28s ease, width 0.28s ease, height 0.28s ease; }
        .pj-tuto-spot-none { border: none; }
        .pj-tuto-card { transform: none; transition: left 0.28s ease, top 0.28s ease; }
        body.theme-dark .pjw-card, body.theme-dark #pj-resume { background: #241c16; color: #ece3d2; }
        body.theme-dark .pjw-in, body.theme-dark .pjw-chip { background: #2a221b; color: #ece3d2; }
        body.theme-dark .pjw-btn, body.theme-dark .pjw-tab { background: #2a221b; color: #ece3d2; }
        body.theme-dark .pjw-note, body.theme-dark .pjw-shead { color: #9a8a70; }
        body.theme-dark .pjw-head, body.theme-dark .pjw-lbl { color: var(--accent-color, #C49B35); }
        @media (max-width: 480px) {
            .pjw-2col { grid-template-columns: 1fr; }
            .pjw-srow, .pjw-shead { grid-template-columns: 1fr 70px 28px 30px 30px; }
        }`;
        const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    }

    document.addEventListener('DOMContentLoaded', () => {
        injectStyles();
        // Sur la fiche uniquement (pas l'accueil)
        setTimeout(() => {
            const app = byId('app-screen');
            const onSheet = app && !app.classList.contains('hidden');
            if (!onSheet) return;
            injectMenuButtons();
            if (localStorage.getItem(WIZ_FLAG)) {
                try { localStorage.removeItem(WIZ_FLAG); } catch (e) {}
                startWizard();                                   // fiche fraîchement créée → assistant
            } else if (!localStorage.getItem(TUTO_FLAG)) {
                // Fiche existante mais tuto jamais vu : on le propose sans forcer (1er affichage)
                startPjTutorial(false);
            } else {
                offerResume();                                   // fiche inachevée : reprise proposée
            }
        }, 900);
    });

    // Accès debug / autres modules
    window.PjTutorial = { startWizard, startTutorial: startPjTutorial, completion };
})();
