// =====================================================
// homebrew.js — Éditeur de contenu personnel.
//
// Le SRD ne publie qu'une sous-classe par classe, un historique et un don :
// le reste appartient au Manuel des Joueurs et n'est pas redistribuable. La
// réponse n'est pas d'aller le chercher ailleurs, c'est de laisser chacun
// saisir ce qu'il possède. Ce contenu vit dans le navigateur et le compte du
// joueur — jamais dans data/.
//
// Tout ce qui est créable ici prend EXACTEMENT la forme des données du SRD.
// L'intégration est faite une fois pour toutes dans srd-data.js : la page
// Règles, la loupe, l'autocomplétion et l'assistant de création traitent une
// entrée perso comme une entrée de plus.
//
// Écran #homebrew-screen, ouvert depuis la page Règles (« ✍️ Mon contenu »).
// =====================================================
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const esc = (s) => window.SRD.esc(s);
    const HB = () => window.SRD.homebrew;

    let built = false;
    let currentType = 'classes';
    let editing = null;          // { type, entry, isNew }
    let lastScreen = 'rules-screen';
    let srdClasses = null;       // classes.json, pour les parents et les emplacements de sort

    const ABILITIES = [['str', 'Force'], ['dex', 'Dextérité'], ['con', 'Constitution'],
                       ['int', 'Intelligence'], ['wis', 'Sagesse'], ['cha', 'Charisme']];
    const SKILLS = ['Acrobaties', 'Arcanes', 'Athlétisme', 'Discrétion', 'Dressage', 'Escamotage',
                    'Histoire', 'Intimidation', 'Intuition', 'Investigation', 'Médecine', 'Nature',
                    'Perception', 'Persuasion', 'Religion', 'Représentation', 'Survie', 'Tromperie'];
    const SCHOOLS = ['Abjuration', 'Divination', 'Enchantement', 'Évocation', 'Illusion',
                     'Invocation', 'Nécromancie', 'Transmutation'];
    const CASTER_TYPES = [
        ['none', 'Aucun'], ['full', 'Complet (magicien, clerc…)'],
        ['half', 'Demi-lanceur (paladin, rôdeur)'], ['third', 'Tiers-lanceur'],
        ['pact', 'Magie de pacte (occultiste)']
    ];
    // Classe du SRD dont on recopie la table d'emplacements pour chaque type.
    const SLOT_MODEL = { full: 'wizard', half: 'paladin', pact: 'warlock' };

    // =====================================================
    // Schémas de formulaire — un par type, dans l'ordre d'affichage.
    // t : text · num · check · select · tags · paras · line · named · abil
    // =====================================================
    const SCHEMAS = {
        spells: [
            { k: 'level', t: 'select', label: 'Niveau', num: true, opts: [[0, 'Sort mineur (0)'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [7, '7'], [8, '8'], [9, '9']], def: 1 },
            { k: 'school', t: 'select', label: 'École', opts: SCHOOLS.map(s => [s, s]), free: true },
            { k: 'casting_time', t: 'text', label: 'Temps d’incantation', ph: '1 action' },
            { k: 'range', t: 'text', label: 'Portée', ph: '18 mètres' },
            { k: 'components', t: 'text', label: 'Composantes', ph: 'V, S, M (une pincée de soufre)' },
            { k: 'duration', t: 'text', label: 'Durée', ph: 'Instantanée' },
            { k: 'ritual', t: 'check', label: 'Rituel' },
            { k: 'concentration', t: 'check', label: 'Concentration' },
            { k: 'classes', t: 'tags', label: 'Classes', ph: 'Magicien, Ensorceleur' },
            { k: 'desc', t: 'paras', label: 'Description', rows: 6 },
            { k: 'higher_levels', t: 'line', label: 'À plus haut niveau' }
        ],
        monsters: [
            { k: 'size', t: 'text', label: 'Taille', ph: 'Créature de taille M' },
            { k: 'type', t: 'text', label: 'Type', ph: 'humanoïde (gobelinoïde)' },
            { k: 'alignment', t: 'text', label: 'Alignement' },
            { k: 'ac', t: 'text', label: 'Classe d’armure', ph: '15' },
            { k: 'ac_desc', t: 'text', label: 'Détail de la CA', ph: 'armure de cuir, bouclier' },
            { k: 'hp', t: 'text', label: 'Points de vie', ph: '7' },
            { k: 'hp_roll', t: 'text', label: 'Dés de vie', ph: '2d6' },
            { k: 'speed', t: 'text', label: 'Vitesse', ph: '9 m' },
            { k: 'abilities', t: 'abil', label: 'Caractéristiques' },
            { k: 'saves', t: 'text', label: 'Jets de sauvegarde' },
            { k: 'skills', t: 'text', label: 'Compétences', ph: 'Discrétion +6' },
            { k: 'resistances', t: 'text', label: 'Résistances' },
            { k: 'immunities', t: 'text', label: 'Immunités' },
            { k: 'condition_immunities', t: 'text', label: 'Immunités (états)' },
            { k: 'senses', t: 'text', label: 'Sens', ph: 'vision dans le noir 18 m, Perception passive 9' },
            { k: 'languages', t: 'text', label: 'Langues' },
            { k: 'cr_display', t: 'text', label: 'Facteur de puissance', ph: '1/4' },
            { k: 'xp', t: 'num', label: 'Points d’expérience' },
            { k: 'traits', t: 'named', label: 'Traits' },
            { k: 'actions', t: 'named', label: 'Actions' },
            { k: 'reactions', t: 'named', label: 'Réactions' },
            { k: 'legendary_actions', t: 'named', label: 'Actions légendaires' }
        ],
        'magic-items': [
            { k: 'type', t: 'text', label: 'Type', ph: 'Arme (épée longue)' },
            { k: 'rarity', t: 'text', label: 'Rareté', ph: 'rare' },
            { k: 'attunement', t: 'check', label: 'Harmonisation requise' },
            { k: 'attunement_note', t: 'text', label: 'Précision sur l’harmonisation', ph: '(par un magicien)' },
            { k: 'desc', t: 'paras', label: 'Description', rows: 6 }
        ],
        equipment: [
            { k: 'type', t: 'text', label: 'Catégorie', ph: 'Arme de guerre de corps à corps' },
            { k: 'cost', t: 'text', label: 'Prix', ph: '15 po' },
            { k: 'weight_kg', t: 'num', label: 'Poids (kg)', step: '0.1' },
            { k: 'damage_dice', t: 'text', label: 'Dégâts', ph: '1d8' },
            { k: 'damage_type', t: 'text', label: 'Type de dégâts', ph: 'tranchants' },
            { k: 'versatile_damage', t: 'text', label: 'Polyvalente', ph: '1d10' },
            { k: 'properties', t: 'tags', label: 'Propriétés', ph: 'légère, finesse' },
            { k: 'desc', t: 'paras', label: 'Description' }
        ],
        conditions: [
            { k: 'desc', t: 'paras', label: 'Description', rows: 6 }
        ],
        backgrounds: [
            { k: 'skills', t: 'tags', label: 'Compétences', ph: 'Histoire, Intuition' },
            { k: 'tools', t: 'text', label: 'Outils' },
            { k: 'languages', t: 'text', label: 'Langues' },
            { k: 'equipment_text', t: 'text', label: 'Équipement' },
            { k: 'desc', t: 'paras', label: 'Description', rows: 6 }
        ],
        feats: [
            { k: 'prerequisite', t: 'text', label: 'Prérequis' },
            { k: 'desc', t: 'paras', label: 'Description', rows: 6 }
        ],
        races: [
            { k: 'ability_bonuses', t: 'abil', label: 'Bonus de caractéristiques', bonus: true },
            { k: 'speed', t: 'text', label: 'Vitesse', ph: '9 m' },
            { k: 'size', t: 'text', label: 'Taille', ph: 'Moyenne' },
            { k: 'languages', t: 'text', label: 'Langues', ph: 'commun et une langue au choix' },
            { k: 'desc', t: 'paras', label: 'Description' },
            { k: 'traits', t: 'named', label: 'Traits' }
        ],
        subraces: [
            { k: 'parent', t: 'parent', label: 'Race parente', of: 'races' },
            { k: 'ability_bonuses', t: 'abil', label: 'Bonus de caractéristiques', bonus: true },
            { k: 'desc', t: 'paras', label: 'Description' },
            { k: 'traits', t: 'named', label: 'Traits' }
        ],
        classes: [
            { k: 'hit_die', t: 'select', label: 'Dé de vie', num: true, opts: [[6, 'd6'], [8, 'd8'], [10, 'd10'], [12, 'd12']], def: 8 },
            { k: 'saves', t: 'saves', label: 'Jets de sauvegarde' },
            { k: 'armor', t: 'text', label: 'Maîtrise des armures', ph: 'armures légères, boucliers' },
            { k: 'weapons', t: 'text', label: 'Maîtrise des armes', ph: 'armes courantes' },
            { k: 'tools', t: 'text', label: 'Maîtrise des outils', ph: 'aucun' },
            { k: 'skill_choose', t: 'num', label: 'Compétences au choix', ph: '2', min: 0, max: 6 },
            { k: 'skill_from', t: 'skills', label: 'Parmi' },
            { k: 'equipment_items', t: 'lines', label: 'Équipement de départ', ph: 'Une ligne par choix' },
            { k: 'caster', t: 'select', label: 'Lanceur de sorts', opts: CASTER_TYPES, def: 'none' },
            { k: 'cast_ability', t: 'select', label: 'Caractéristique d’incantation',
              opts: [['', '—']].concat(ABILITIES.map(a => [a[1], a[1]])) },
            { k: 'desc', t: 'paras', label: 'Description' },
            { k: 'features', t: 'named', label: 'Aptitudes de classe', level: true },
            { k: 'levels', t: 'levels', label: 'Table de progression' }
        ],
        subclasses: [
            { k: 'parent', t: 'parent', label: 'Classe parente', of: 'classes' },
            { k: 'desc', t: 'paras', label: 'Description' },
            { k: 'features', t: 'named', label: 'Aptitudes', level: true }
        ]
    };

    // =====================================================
    // Écran
    // =====================================================
    function build() {
        if (built) return;
        built = true;
        const scr = document.createElement('div');
        scr.id = 'homebrew-screen';
        scr.className = 'screen-view hidden';
        scr.innerHTML = `
            <div class="rules-wrap hb-wrap">
                <header class="rules-top hb-top">
                    <button id="hb-back" class="rules-back" type="button">← Retour</button>
                    <h1>Mon contenu</h1>
                    <div class="hb-tools">
                        <button id="hb-export" class="hb-tool" type="button" title="Enregistrer un fichier de sauvegarde">⬇️ Exporter</button>
                        <button id="hb-import" class="hb-tool" type="button" title="Charger un fichier partagé">⬆️ Importer</button>
                        <input type="file" id="hb-file" accept="application/json,.json" hidden>
                    </div>
                </header>
                <nav id="hb-types" class="rules-cats hb-types"></nav>
                <div class="rules-body hb-body">
                    <div class="rules-list hb-list">
                        <div class="hb-newrow">
                            <button id="hb-new" class="hb-btn hb-primary" type="button">➕ Créer</button>
                            <button id="hb-dup" class="hb-btn" type="button" title="Partir d’une entrée officielle">📋 Copier du SRD</button>
                        </div>
                        <div id="hb-entries"></div>
                    </div>
                    <article id="hb-editor" class="rules-detail hb-editor"></article>
                </div>
                <footer class="rules-foot hb-foot">
                    Ce contenu reste dans ton navigateur et ton compte. Il n'est ni publié ni distribué
                    par le site : n'y recopie que ce que tu as le droit d'utiliser à ta table.
                </footer>
            </div>`;
        document.body.appendChild(scr);

        $('hb-types').innerHTML = HB().TYPES.map(t =>
            `<button type="button" class="rules-cat hb-type" data-type="${t.id}">${t.icon} ${esc(t.label)}</button>`).join('');
        $('hb-types').addEventListener('click', (e) => {
            const b = e.target.closest('.hb-type'); if (!b) return;
            openType(b.dataset.type);
        });
        $('hb-back').addEventListener('click', () => window.navTo(lastScreen));
        $('hb-new').addEventListener('click', () => startNew());
        $('hb-dup').addEventListener('click', () => openDuplicate());
        $('hb-export').addEventListener('click', doExport);
        $('hb-import').addEventListener('click', () => $('hb-file').click());
        $('hb-file').addEventListener('change', doImport);
        $('hb-entries').addEventListener('click', onListClick);
    }

    function openType(type) {
        currentType = type;
        editing = null;
        document.querySelectorAll('.hb-type').forEach(b => b.classList.toggle('is-on', b.dataset.type === type));
        renderList();
        const t = HB().TYPES.find(x => x.id === type) || {};
        $('hb-editor').innerHTML = `<div class="rules-empty">`
            + `${esc(t.label || '')} — choisis une entrée à modifier, ou crée‑en une.</div>`;
    }

    function renderList() {
        const list = HB().list(currentType);
        const box = $('hb-entries');
        if (!list.length) {
            box.innerHTML = `<div class="rules-empty">Rien pour l'instant.</div>`;
            return;
        }
        box.innerHTML = list.slice()
            .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
            .map(e => `<div class="hb-row${editing && editing.entry.id === e.id ? ' is-on' : ''}" data-id="${esc(e.id)}">
                    <button type="button" class="hb-row-main" data-act="edit" data-id="${esc(e.id)}">
                        <span class="rules-item-name">${esc(e.name)}</span>
                        <span class="rules-item-sub">${esc(HB().subtitle(currentType, e))}</span>
                    </button>
                    <button type="button" class="hb-row-del" data-act="del" data-id="${esc(e.id)}" title="Supprimer">🗑</button>
                </div>`).join('');
    }

    function onListClick(e) {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const entry = HB().get(currentType, b.dataset.id);
        if (!entry) return;
        if (b.dataset.act === 'edit') { openEditor(currentType, entry, false); return; }
        const type = currentType;
        const index = HB().indexOf(type, entry.id);
        HB().remove(type, entry.id);
        if (editing && editing.entry.id === entry.id) { editing = null; openType(type); }
        renderList();
        const undo = () => { HB().restore(type, entry, index); renderList(); };
        if (window.showUndoToast) window.showUndoToast(`« ${entry.name} » supprimé.`, undo);
        else if (window.showAppToast) window.showAppToast(`« ${entry.name} » supprimé.`, '#8a6320');
    }

    function startNew() {
        openEditor(currentType, { name: '' }, true);
    }

    // =====================================================
    // Formulaire
    // =====================================================
    function openEditor(type, entry, isNew) {
        editing = { type, entry: JSON.parse(JSON.stringify(entry)), isNew };
        // Une classe est rangée comme dans le SRD (proficiencies{}, equipment{},
        // spellcasting{}) ; le formulaire, lui, travaille à plat. Sans cette
        // remise à plat, rouvrir une classe pour la modifier reviendrait à vider
        // ses maîtrises et son équipement à l'enregistrement suivant.
        if (type === 'classes') flattenClass(editing.entry);
        entry = editing.entry;
        const t = HB().TYPES.find(x => x.id === type) || {};
        const box = $('hb-editor');
        box.innerHTML = `
            <div class="hb-form" data-type="${type}">
                <h2>${t.icon} ${isNew ? 'Nouveau' : 'Modifier'} — ${esc(t.label)}</h2>
                <div class="hb-field">
                    <label class="hb-lbl">Nom</label>
                    <input class="hb-in" data-k="name" value="${esc(entry.name || '')}" placeholder="Nom de l'entrée">
                </div>
                ${SCHEMAS[type].map(f => field(f, editing.entry)).join('')}
                <div class="hb-actions">
                    <button type="button" class="hb-btn hb-primary" data-hb="save">💾 Enregistrer</button>
                    <button type="button" class="hb-btn" data-hb="cancel">Annuler</button>
                    <span class="hb-msg" id="hb-msg"></span>
                </div>
            </div>`;
        box.scrollTop = 0;
        wireForm(box, type);
        renderList();
    }

    function field(f, e) {
        const v = e[f.k];
        const lbl = `<label class="hb-lbl">${esc(f.label)}</label>`;
        const ph = f.ph ? ` placeholder="${esc(f.ph)}"` : '';
        let inner = '';
        switch (f.t) {
            case 'text':
                inner = `<input class="hb-in" data-k="${f.k}" value="${esc(v || '')}"${ph}>`; break;
            case 'num':
                inner = `<input class="hb-in hb-num" type="number" data-k="${f.k}" value="${v == null ? '' : esc(v)}"`
                      + `${f.step ? ` step="${f.step}"` : ''}${f.min != null ? ` min="${f.min}"` : ''}`
                      + `${f.max != null ? ` max="${f.max}"` : ''}${ph}>`; break;
            case 'check':
                return `<div class="hb-field hb-inline"><label class="hb-check"><input type="checkbox" data-k="${f.k}"`
                     + `${v ? ' checked' : ''}> ${esc(f.label)}</label></div>`;
            case 'select': {
                const cur = v == null ? f.def : v;
                inner = `<select class="hb-in" data-k="${f.k}">`
                    + (f.free && cur && !f.opts.some(o => String(o[0]) === String(cur))
                        ? `<option value="${esc(cur)}" selected>${esc(cur)}</option>` : '')
                    + f.opts.map(o => `<option value="${esc(o[0])}"${String(o[0]) === String(cur) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')
                    + '</select>'; break;
            }
            case 'tags':
                inner = `<input class="hb-in" data-k="${f.k}" data-join="1" value="${esc((v || []).join(', '))}"${ph}>`; break;
            case 'lines':
                inner = `<textarea class="hb-in hb-ta" rows="4" data-k="${f.k}" data-split="line"${ph}>${esc((v || []).join('\n'))}</textarea>`; break;
            case 'paras':
                inner = `<textarea class="hb-in hb-ta" rows="${f.rows || 4}" data-k="${f.k}" data-split="para"${ph}>${esc((v || []).join('\n\n'))}</textarea>`; break;
            case 'line':
                inner = `<textarea class="hb-in hb-ta" rows="2" data-k="${f.k}"${ph}>${esc(v || '')}</textarea>`; break;
            case 'abil':
                inner = `<div class="hb-abil">` + ABILITIES.map(a =>
                    `<label><span>${a[1]}</span><input type="number" class="hb-in hb-num" data-abil="${f.k}" data-a="${a[0]}" `
                    + `value="${(v && v[a[0]] != null) ? esc(v[a[0]]) : (f.bonus ? '' : 10)}"${f.bonus ? ' placeholder="0"' : ''}></label>`).join('')
                    + `</div>`; break;
            case 'saves':
                inner = `<div class="hb-chips">` + ABILITIES.map(a =>
                    `<label class="hb-chip"><input type="checkbox" data-save="${a[1]}"`
                    + `${(v || []).includes(a[1]) ? ' checked' : ''}> ${a[1]}</label>`).join('') + `</div>`; break;
            case 'skills':
                inner = `<div class="hb-chips">` + SKILLS.map(s =>
                    `<label class="hb-chip"><input type="checkbox" data-skill="${esc(s)}"`
                    + `${(v || []).includes(s) ? ' checked' : ''}> ${esc(s)}</label>`).join('') + `</div>`; break;
            case 'parent':
                inner = `<select class="hb-in" data-k="${f.k}" data-parent="${f.of}"><option value="">Chargement…</option></select>`; break;
            case 'named':
                return namedList(f, v || []);
            case 'levels':
                return `<div class="hb-field hb-levels-field" data-levels="1">${lbl}
                    <p class="hb-note">Les aptitudes se placent d'elles-mêmes à partir du niveau indiqué
                    sur chacune. Les emplacements de sort suivent le type de lanceur choisi plus haut.</p>
                    <div class="hb-cols">
                        <label class="hb-lbl-sm">Colonnes propres à la classe</label>
                        <input class="hb-in" data-k="_cols" value="${esc((e.level_columns || []).map(c => c.label).join(', '))}"
                               placeholder="Ex : Rages, Dégâts de rage">
                    </div>
                    <div class="hb-scroll" id="hb-levels-grid"></div></div>`;
            default:
                inner = '';
        }
        return `<div class="hb-field">${lbl}${inner}</div>`;
    }

    function namedList(f, items) {
        return `<div class="hb-field hb-named" data-named="${f.k}"${f.level ? ' data-level="1"' : ''}>
            <label class="hb-lbl">${esc(f.label)}</label>
            <div class="hb-named-rows">${items.map(it => namedRow(f, it)).join('')}</div>
            <button type="button" class="hb-btn hb-add" data-hb="add-named">➕ Ajouter</button>
        </div>`;
    }

    function namedRow(f, it) {
        it = it || {};
        const text = Array.isArray(it.text) ? it.text.join('\n\n') : (it.text || '');
        return `<div class="hb-named-row">
            <div class="hb-named-head">
                <input class="hb-in hb-named-name" data-nk="name" value="${esc(it.name || '')}" placeholder="Nom">
                ${f.level ? `<input class="hb-in hb-num hb-named-lvl" type="number" min="1" max="20" data-nk="level"
                    value="${it.level || ''}" placeholder="Niv." title="Niveau d'obtention">` : ''}
                <button type="button" class="hb-row-del" data-hb="del-named" title="Retirer">🗑</button>
            </div>
            <textarea class="hb-in hb-ta" rows="3" data-nk="text" placeholder="Description">${esc(text)}</textarea>
        </div>`;
    }

    function wireForm(box, type) {
        box.querySelectorAll('[data-hb]').forEach(b => b.addEventListener('click', (ev) => {
            const act = b.dataset.hb;
            if (act === 'save') { saveForm(box, type); return; }
            if (act === 'cancel') { editing = null; openType(type); return; }
            if (act === 'add-named') {
                const wrap = b.closest('.hb-named');
                const f = SCHEMAS[type].find(x => x.k === wrap.dataset.named) || {};
                wrap.querySelector('.hb-named-rows').insertAdjacentHTML('beforeend', namedRow(f, {}));
                wireNamedDeletes(wrap);
                wrap.querySelector('.hb-named-row:last-child .hb-named-name')?.focus();
                refreshLevels(box, type);
                return;
            }
            if (act === 'del-named') {
                ev.preventDefault();
                b.closest('.hb-named-row').remove();
                refreshLevels(box, type);
            }
        }));
        box.querySelectorAll('.hb-named').forEach(wireNamedDeletes);
        fillParents(box, type);
        if (type === 'classes') {
            refreshLevels(box, type);
            box.addEventListener('input', (e) => {
                if (e.target.matches('[data-k="_cols"], [data-k="caster"], [data-nk="level"], [data-nk="name"]')) {
                    refreshLevels(box, type);
                }
            });
            box.addEventListener('change', (e) => {
                if (e.target.matches('[data-k="caster"]')) refreshLevels(box, type);
            });
        }
    }

    function wireNamedDeletes(wrap) {
        wrap.querySelectorAll('[data-hb="del-named"]').forEach(b => {
            if (b.dataset.wired) return;
            b.dataset.wired = '1';
            b.addEventListener('click', () => { b.closest('.hb-named-row').remove(); });
        });
    }

    /** Remplit les listes déroulantes « classe / race parente » (SRD + perso). */
    async function fillParents(box, type) {
        const sel = box.querySelector('[data-parent]');
        if (!sel) return;
        const cat = sel.dataset.parent === 'classes' ? 'classes' : 'races';
        let opts = [];
        try {
            const list = await window.SRD.category(cat);
            opts = list.map(e => [e.id, e.name + (e.source === 'perso' ? ' (perso)' : '')]);
        } catch (err) {
            opts = HB().list(cat).map(e => [e.id, e.name + ' (perso)']);
        }
        const cur = editing && editing.entry.parent;
        sel.innerHTML = '<option value="">— à choisir —</option>'
            + opts.map(o => `<option value="${esc(o[0])}"${o[0] === cur ? ' selected' : ''}>${esc(o[1])}</option>`).join('');
    }

    // ---------- Table de progression ----------
    async function slotsFor(caster) {
        if (!SLOT_MODEL[caster]) return null;
        if (!srdClasses) {
            try { srdClasses = await window.SRD.category('classes'); } catch (e) { return null; }
        }
        const model = srdClasses.find(c => c.id === SLOT_MODEL[caster]);
        return model ? model.levels : null;
    }

    async function refreshLevels(box, type) {
        const grid = box.querySelector('#hb-levels-grid');
        if (!grid) return;
        const cols = parseCols(box);
        const feats = readNamed(box, 'features', true);
        const caster = box.querySelector('[data-k="caster"]')?.value || 'none';
        const model = await slotsFor(caster);
        const prev = editing && editing.entry.levels ? editing.entry.levels : [];
        const ranks = model
            ? [...new Set(model.flatMap(l => Object.keys(l.spell_slots || {})))].map(Number).sort((a, b) => a - b)
            : [];
        const pact = caster === 'pact' && model;

        const head = '<tr><th>Niv.</th><th>Maît.</th><th class="hb-col-feat">Aptitudes</th>'
            + cols.map(c => `<th>${esc(c.label)}</th>`).join('')
            + (caster !== 'none' ? '<th>Sorts mineurs</th><th>Sorts connus</th>' : '')
            + (pact ? '<th>Empl.</th><th>Rang</th>' : ranks.map(n => `<th>${n}</th>`).join(''))
            + '</tr>';

        const rows = [];
        for (let lv = 1; lv <= 20; lv++) {
            const old = prev.find(p => p.level === lv) || {};
            const m = model ? model.find(x => x.level === lv) : null;
            const names = feats.filter(f => Number(f.level) === lv).map(f => f.name).filter(Boolean);
            rows.push('<tr>'
                + `<td class="hb-lv">${lv}</td>`
                + `<td>+${Math.floor((lv - 1) / 4) + 2}</td>`
                + `<td class="hb-col-feat">${esc(names.join(', ')) || '—'}</td>`
                + cols.map(c => `<td><input class="hb-in hb-cell" data-lvcol="${esc(c.key)}" data-lv="${lv}"`
                    + ` value="${esc((old.class_specific || {})[c.key] ?? '')}"></td>`).join('')
                + (caster !== 'none'
                    ? `<td><input class="hb-in hb-cell" data-lvnum="cantrips_known" data-lv="${lv}" value="${esc(old.cantrips_known ?? (m ? m.cantrips_known ?? '' : ''))}"></td>`
                      + `<td><input class="hb-in hb-cell" data-lvnum="spells_known" data-lv="${lv}" value="${esc(old.spells_known ?? (m ? m.spells_known ?? '' : ''))}"></td>`
                    : '')
                + (pact
                    ? `<td class="hb-auto">${esc((m && m.class_specific && m.class_specific.spell_slots_count) ?? '—')}</td>`
                      + `<td class="hb-auto">${esc((m && m.class_specific && m.class_specific.slot_level) ?? '—')}</td>`
                    : ranks.map(n => `<td class="hb-auto">${esc((m && m.spell_slots && m.spell_slots[n]) ?? '—')}</td>`).join(''))
                + '</tr>');
        }
        grid.innerHTML = `<table class="hb-table"><thead>${head}</thead><tbody>${rows.join('')}</tbody></table>`;
    }

    function parseCols(box) {
        const raw = box.querySelector('[data-k="_cols"]')?.value || '';
        return raw.split(',').map(s => s.trim()).filter(Boolean).map(label => ({
            key: window.SRD.fold(label).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'col',
            label, field: 'class_specific'
        }));
    }

    function readNamed(box, key, withLevel) {
        const wrap = box.querySelector(`.hb-named[data-named="${key}"]`);
        if (!wrap) return [];
        return [...wrap.querySelectorAll('.hb-named-row')].map(r => {
            const name = r.querySelector('[data-nk="name"]').value.trim();
            const text = r.querySelector('[data-nk="text"]').value.trim();
            const out = { name, text: text ? text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean) : [] };
            if (withLevel) {
                const lv = parseInt(r.querySelector('[data-nk="level"]')?.value, 10);
                if (lv >= 1 && lv <= 20) out.level = lv;
            }
            out.id = window.SRD.fold(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            return out;
        }).filter(x => x.name);
    }

    // =====================================================
    // Enregistrement
    // =====================================================
    function saveForm(box, type) {
        const out = {};
        if (editing && editing.entry.id) out.id = editing.entry.id;

        box.querySelectorAll('[data-k]').forEach(el => {
            const k = el.dataset.k;
            if (k.startsWith('_')) return;
            if (el.type === 'checkbox') { out[k] = el.checked; return; }
            let v = el.value;
            if (el.dataset.join) { out[k] = v.split(',').map(s => s.trim()).filter(Boolean); return; }
            if (el.dataset.split === 'line') { out[k] = v.split('\n').map(s => s.trim()).filter(Boolean); return; }
            if (el.dataset.split === 'para') { out[k] = v.split(/\n{2,}/).map(s => s.trim()).filter(Boolean); return; }
            if (el.type === 'number') { out[k] = v === '' ? null : Number(v); return; }
            out[k] = v.trim();
        });
        box.querySelectorAll('[data-abil]').forEach(el => {
            const k = el.dataset.abil;
            out[k] = out[k] || {};
            if (el.value !== '') out[k][el.dataset.a] = Number(el.value);
        });
        const saves = [...box.querySelectorAll('[data-save]:checked')].map(el => el.dataset.save);
        if (box.querySelector('[data-save]')) out.saves = saves;
        const skills = [...box.querySelectorAll('[data-skill]:checked')].map(el => el.dataset.skill);
        box.querySelectorAll('.hb-named').forEach(w => {
            const f = SCHEMAS[type].find(x => x.k === w.dataset.named) || {};
            out[w.dataset.named] = readNamed(box, w.dataset.named, !!f.level);
        });

        // Les <select> rendent toujours une chaîne : on rétablit les nombres,
        // sinon `hit_die` vaudrait "10" et les comparaisons numériques rateraient.
        SCHEMAS[type].filter(f => f.num).forEach(f => {
            if (out[f.k] !== '' && out[f.k] != null) out[f.k] = Number(out[f.k]);
        });

        if (!out.name) { msg('Il faut au moins un nom.', true); return; }

        // Mises en forme propres à certains types : on range les champs comme
        // le fait le SRD, pour que renderEntry n'ait pas de cas particulier.
        if (type === 'equipment') {
            if (out.damage_dice) out.damage = { dice: out.damage_dice, type: out.damage_type || '' };
            else delete out.damage;
            delete out.damage_dice; delete out.damage_type;
        }
        if (type === 'subclasses' || type === 'subraces') {
            if (!out.parent) { msg('Choisis d’abord le parent.', true); return; }
            const sel = box.querySelector('[data-parent]');
            out.parent_name = sel.options[sel.selectedIndex].text.replace(/ \(perso\)$/, '');
        }
        if (type === 'classes') {
            out.proficiencies = {
                armor: out.armor || '', weapons: out.weapons || '', tools: out.tools || '',
                saves: saves,
                skills: { choose: out.skill_choose || 0, from: skills,
                          text: (out.skill_choose ? out.skill_choose + ' au choix' : '')
                                + (skills.length ? ' parmi : ' + skills.join(', ') : '') }
            };
            out.equipment = { intro: 'Vous débutez avec l’équipement suivant :',
                              items: out.equipment_items || [] };
            out.spellcasting = { type: out.caster || 'none', ability: out.cast_ability || '' };
            ['armor', 'weapons', 'tools', 'skill_choose', 'equipment_items', 'cast_ability', 'saves']
                .forEach(k => delete out[k]);
            out.level_columns = parseCols(box);
            out.levels = collectLevels(box, out);
            delete out.caster;
        }
        if (type === 'backgrounds' && Array.isArray(out.skills)) {
            out.proficiencies = { skills: out.skills, tools: out.tools || '', languages: out.languages || '' };
        }

        try {
            const saved = HB().save(type, out);
            editing = { type, entry: saved, isNew: false };
            renderList();
            msg('Enregistré. Ton entrée est maintenant dans la page Règles, la loupe et l’assistant.');
            if (window.showAppToast) window.showAppToast(`« ${saved.name} » enregistré.`, '#3d7a3d');
        } catch (e) {
            msg(e.message, true);
        }
    }

    /** Fabrique levels[] : le squelette officiel (maîtrise, emplacements) plus
     *  ce que l'utilisateur a saisi ; les aptitudes viennent de leur niveau. */
    function collectLevels(box, out) {
        const cols = out.level_columns || [];
        const feats = out.features || [];
        const caster = (out.spellcasting || {}).type;
        const model = srdClasses ? (srdClasses.find(c => c.id === SLOT_MODEL[caster]) || {}).levels : null;
        const levels = [];
        for (let lv = 1; lv <= 20; lv++) {
            const m = model ? model.find(x => x.level === lv) : null;
            const mine = feats.filter(f => Number(f.level) === lv);
            const row = {
                level: lv,
                prof_bonus: Math.floor((lv - 1) / 4) + 2,
                features: mine.map(f => f.id),
                feature_labels: mine.map(f => f.name)
            };
            const cs = {};
            cols.forEach(c => {
                const el = box.querySelector(`[data-lvcol="${c.key}"][data-lv="${lv}"]`);
                const v = el && el.value.trim();
                if (v) cs[c.key] = /^\d+$/.test(v) ? Number(v) : v;
            });
            if (caster && caster !== 'none') {
                ['cantrips_known', 'spells_known'].forEach(k => {
                    const el = box.querySelector(`[data-lvnum="${k}"][data-lv="${lv}"]`);
                    const v = el && el.value.trim();
                    if (v) row[k] = /^\d+$/.test(v) ? Number(v) : v;
                });
                if (m && m.spell_slots) row.spell_slots = Object.assign({}, m.spell_slots);
                if (m && m.class_specific && m.class_specific.spell_slots_count != null) {
                    cs.spell_slots_count = m.class_specific.spell_slots_count;
                    cs.slot_level = m.class_specific.slot_level;
                }
            }
            if (Object.keys(cs).length) row.class_specific = cs;
            levels.push(row);
        }
        return levels;
    }

    function msg(text, bad) {
        const el = $('hb-msg');
        if (!el) return;
        el.textContent = text;
        el.className = 'hb-msg' + (bad ? ' is-bad' : ' is-ok');
    }

    // =====================================================
    // Copier une entrée du SRD comme point de départ
    // =====================================================
    function openDuplicate() {
        const t = HB().TYPES.find(x => x.id === currentType) || {};
        const box = $('hb-editor');
        box.innerHTML = `<div class="hb-form">
            <h2>📋 Copier une entrée officielle</h2>
            <p class="hb-note">Pratique pour partir du Guerrier officiel et en faire une variante.
            La copie devient un contenu personnel : l'originale n'est pas touchée.</p>
            <div class="hb-field">
                <label class="hb-lbl">Chercher dans « ${esc(t.label)} »</label>
                <input class="hb-in" id="hb-dup-q" placeholder="Deux lettres suffisent…" autocomplete="off">
            </div>
            <div id="hb-dup-res" class="hb-dup-res"></div>
            <div class="hb-actions"><button type="button" class="hb-btn" id="hb-dup-cancel">Annuler</button></div>
        </div>`;
        $('hb-dup-cancel').addEventListener('click', () => openType(currentType));
        let token = 0;
        $('hb-dup-q').addEventListener('input', async (e) => {
            const q = e.target.value.trim();
            const mine = ++token;
            if (q.length < 2) { $('hb-dup-res').innerHTML = ''; return; }
            let res = [];
            try { res = await window.SRD.search(q, { limit: 40, category: t.cat }); }
            catch (err) { $('hb-dup-res').innerHTML = `<div class="rules-empty">${esc(err.diagnostic || err.message)}</div>`; return; }
            if (mine !== token) return;
            const wanted = res.filter(r => !r.perso && matchesType(currentType, r));
            $('hb-dup-res').innerHTML = wanted.length
                ? wanted.map(r => `<button type="button" class="rules-item" data-id="${esc(r.id)}">
                        <span class="rules-item-name">${esc(r.name)}</span>
                        <span class="rules-item-sub">${esc(r.subtitle)}</span></button>`).join('')
                : `<div class="rules-empty">Aucun résultat.</div>`;
            $('hb-dup-res').querySelectorAll('.rules-item').forEach(b =>
                b.addEventListener('click', () => duplicateFrom(t.cat, b.dataset.id)));
        });
        setTimeout(() => $('hb-dup-q').focus(), 50);
    }

    /** Sous-classes et sous-races partagent la catégorie de leur parent :
     *  on les distingue au sous-titre de l'index. */
    function matchesType(type, r) {
        const isSub = /^Sous-/.test(r.subtitle || '');
        if (type === 'subclasses' || type === 'subraces') return isSub;
        if (type === 'classes' || type === 'races') return !isSub;
        return true;
    }

    async function duplicateFrom(cat, id) {
        let src;
        try { src = await window.SRD.entry(cat, id); }
        catch (e) { msg(e.message, true); return; }
        if (!src) return;
        const copy = JSON.parse(JSON.stringify(src));
        delete copy.id; delete copy.source; delete copy._type;
        copy.name = (copy.name || '') + ' (variante)';
        // Les sous-entrées se créent séparément : on ne les recopie pas.
        delete copy.subclasses; delete copy.subraces;
        if (currentType === 'classes') flattenClass(copy);
        if (currentType === 'subclasses' || currentType === 'subraces') {
            copy.parent = src.parent || '';
            copy.parent_name = src.parent_name || '';
        }
        openEditor(currentType, copy, true);
    }

    /** Remet les champs imbriqués du SRD à plat, comme les attend le formulaire. */
    function flattenClass(c) {
        const p = c.proficiencies || {};
        c.armor = p.armor || ''; c.weapons = p.weapons || ''; c.tools = p.tools || '';
        c.saves = p.saves || [];
        c.skill_choose = (p.skills || {}).choose || 0;
        c.skill_from = (p.skills || {}).from || [];
        c.equipment_items = (c.equipment || {}).items || [];
        c.caster = (c.spellcasting || {}).type || 'none';
        c.cast_ability = (c.spellcasting || {}).ability || '';
    }

    // =====================================================
    // Export / import
    // =====================================================
    function doExport() {
        if (!HB().count()) {
            if (window.showAppToast) window.showAppToast('Rien à exporter pour l’instant.', '#8a6320');
            return;
        }
        const blob = new Blob([HB().exportText()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `mon-contenu-dnd-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }

    function doImport(e) {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            let r;
            try { r = HB().importText(String(reader.result), 'merge'); }
            catch (err) {
                if (window.showAppToast) window.showAppToast(err.message, '#c0392b');
                else alert(err.message);
                return;
            }
            renderList();
            const txt = `${r.added} ajout${r.added > 1 ? 's' : ''}`
                      + (r.replaced ? `, ${r.replaced} mise${r.replaced > 1 ? 's' : ''} à jour` : '');
            if (window.showAppToast) window.showAppToast('Import terminé : ' + txt + '.', '#3d7a3d');
        };
        reader.onerror = () => {
            if (window.showAppToast) window.showAppToast('Lecture du fichier impossible.', '#c0392b');
        };
        reader.readAsText(file);
    }

    // =====================================================
    function open(fromScreen, type) {
        build();
        lastScreen = fromScreen || 'rules-screen';
        window.navTo('homebrew-screen');
        openType(type || currentType);
    }

    window.Homebrew = { open };
})();
