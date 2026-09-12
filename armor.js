// =====================================================
// armor.js — Armure & classe d'armure
//
// Le bouton « CA » du module Combat ouvre ce widget. On y saisit une ou
// plusieurs armures (du SRD ou maison), on choisit ce qu'on porte — une armure
// et un bouclier à la fois —, et la CA se calcule puis s'écrit sur la fiche.
// Une armure magique ajoute son bonus. Les résistances, immunités et
// vulnérabilités du personnage, plus celles que confèrent les armures portées,
// alimentent les trois champs « Défenses » de la fiche.
//
// Données, par personnage (clé `dnd-armor`, via window.SheetStore) :
//   { auto, unarmored: 'base'|'barbarian'|'monk'|'custom', customBase,
//     misc: [{ label, value }], armors: [Armure], defenses: { resist, immune, vuln } }
//   Armure : { id, name, kind: 'light'|'medium'|'heavy'|'shield', base, dexMax,
//              isMagic, magic, equipped, strMin, stealthDis,
//              resist[], immune[], vuln[], notes, srdId }
// Tant que le widget n'a jamais servi, rien n'est écrit : une CA saisie à la
// main avant cette version reste intacte.
// =====================================================
(function () {
    'use strict';

    const KEY = 'dnd-armor';
    const KINDS = { light: 'Légère', medium: 'Intermédiaire', heavy: 'Lourde', shield: 'Bouclier' };
    const SRD_KIND = { Light: 'light', Medium: 'medium', Heavy: 'heavy', Shield: 'shield' };
    const UNARMORED = {
        base:      { label: 'Sans armure',                    formule: '10 + Dex' },
        barbarian: { label: 'Défense sans armure (Barbare)',  formule: '10 + Dex + Con, bouclier permis' },
        monk:      { label: 'Défense sans armure (Moine)',    formule: '10 + Dex + Sag, sans bouclier' },
        custom:    { label: 'Base personnalisée',             formule: 'base + Dex — Armure du mage : 13' }
    };
    // [clé des données, champ de la fiche, libellé, effet]
    const DEF = [
        ['resist', 'dmg-resist', '🛡️ Résistances', 'moitié des dégâts'],
        ['immune', 'dmg-immune', '✨ Immunités', 'aucun dégât'],
        ['vuln', 'dmg-vulnerable', '💥 Vulnérabilités', 'double des dégâts']
    ];

    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const num = (v, d = 0) => { const n = parseInt(v, 10); return isNaN(n) ? d : n; };
    const signed = (n) => (n < 0 ? '− ' : '+ ') + Math.abs(n);
    const splitList = (s) => String(s || '').split(/[,;]/).map(x => x.trim()).filter(Boolean);
    const uniq = (arr) => {
        const seen = new Set();
        return arr.filter(x => { const k = fold(x); if (!k || seen.has(k)) return false; seen.add(k); return true; });
    };
    const val = (id) => ($(id) || {}).value || '';
    const toast = (m) => { if (window.showAppToast) window.showAppToast(m); };
    const sameSlot = (a, b) => (a.kind === 'shield') === (b.kind === 'shield');

    // ---------- Données ----------
    const store = () => (window.SheetStore && window.SheetStore.get ? window.SheetStore : null);
    const hasData = () => { const s = store(); return !!(s && s.get(KEY)); };

    function load() {
        const s = store();
        const raw = s ? s.get(KEY) : null;
        const d = Object.assign({
            auto: false, unarmored: 'base', customBase: 13, misc: [], armors: [],
            // Premier usage : les défenses déjà saisies sur la fiche sont reprises.
            defenses: { resist: splitList(val('dmg-resist')), immune: splitList(val('dmg-immune')), vuln: splitList(val('dmg-vulnerable')) }
        }, raw && typeof raw === 'object' ? raw : {});
        d.armors = Array.isArray(d.armors) ? d.armors : [];
        d.misc = Array.isArray(d.misc) ? d.misc : [];
        d.defenses = Object.assign({ resist: [], immune: [], vuln: [] }, d.defenses || {});
        return d;
    }
    function save(d) { const s = store(); if (s) s.set(KEY, d); }

    function newArmor(o) {
        return Object.assign({
            id: 'arm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            name: '', kind: 'light', base: 11, dexMax: null, isMagic: false, magic: 0, equipped: false,
            strMin: '', stealthDis: false, resist: [], immune: [], vuln: [], notes: ''
        }, o);
    }
    /** Une armure du SRD (2014 ou 2024, même forme) -> entrée du widget. */
    function fromSrd(e) {
        const ac = e.armor_class || {};
        const kind = SRD_KIND[e.armor_category] || 'light';
        return newArmor({
            name: e.name, kind, srdId: e.id,
            base: ac.base != null ? ac.base : (kind === 'shield' ? 2 : 10),
            dexMax: kind === 'medium' ? (ac.max_bonus != null ? ac.max_bonus : 2) : null,
            strMin: e.str_minimum || '', stealthDis: !!e.stealth_disadvantage
        });
    }

    // ---------- Calcul ----------
    function granted(d, k) {
        return d.armors.filter(a => a.equipped).flatMap(a => Array.isArray(a[k]) ? a[k] : splitList(a[k]));
    }
    const effective = (d, k) => uniq([...(d.defenses[k] || []), ...granted(d, k)]);

    // Le calcul lui-même vit dans le moteur commun (calcul.js) : la CA, ses
    // sources et ses avertissements sortent du même endroit que les compétences
    // et les attaques. Ce widget ne fait que les montrer.
    function compute(d) {
        const r = window.Calcul.ca(d);
        return {
            total: r.total,
            parts: r.sources.map(s => ({ label: s.libelle, value: s.valeur, base: !!s.base })),
            warn: r.avertissements, body: r.armure, shield: r.bouclier
        };
    }

    // ---------- Écriture sur la fiche ----------
    let writing = false;   // nos propres événements ne doivent pas passer pour une saisie
    function setInput(id, v) {
        const el = $(id);
        if (!el || String(el.value) === String(v)) return;
        writing = true;
        try { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
        finally { writing = false; }
    }
    function setCheck(id, on) {
        const el = $(id);
        if (!el || el.checked === on) return;
        writing = true;
        try { el.checked = on; el.dispatchEvent(new Event('change', { bubbles: true })); }
        finally { writing = false; }
    }
    function badge(d) {
        const cell = document.querySelector('.ac-cell');
        if (cell) cell.classList.toggle('is-auto', !!d.auto);
        document.querySelector('.ac-auto-badge')?.classList.toggle('hidden', !d.auto);
    }
    function applyToSheet(d) {
        if (d.auto) {
            const r = compute(d);
            setInput('armor-class', r.total);
            setCheck('has-shield', !!r.shield);
        }
        DEF.forEach(([k, field]) => setInput(field, effective(d, k).join(', ')));
        badge(d);
    }

    // ---------- Fenêtre ----------
    let ov = null, srdArmors = [];
    const isOpen = () => !!ov && !ov.classList.contains('hidden');

    function build() {
        if (ov) return;
        ov = document.createElement('div');
        ov.id = 'armor-modal';
        ov.className = 'modal-overlay hidden no-print';
        ov.innerHTML = `
            <div class="modal-box ac-modal" role="dialog" aria-modal="true" aria-labelledby="ac-title">
                <div class="modal-header">
                    <h2 id="ac-title">🛡️ Armure &amp; classe d’armure</h2>
                    <button type="button" class="btn-close-modal" data-ac="close" aria-label="Fermer">✕</button>
                </div>
                <div class="ac-body"></div>
            </div>`;
        document.body.appendChild(ov);
        ov.addEventListener('click', onClick);
        ov.addEventListener('change', onChange);
        ov.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.dataset && e.target.dataset.ac === 'srd-query') { e.preventDefault(); addFromQuery(); }
        });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) close(); });
    }

    async function loadSrd() {
        if (!window.SRD) return;
        try {
            const all = await window.SRD.category('equipment');
            srdArmors = (all || []).filter(e => e.armor_class && (e.category === 'armor' || e.armor_category));
        } catch (e) { srdArmors = []; }
        const dl = ov && ov.querySelector('#ac-srd-list');
        if (dl) dl.innerHTML = srdArmors.map(a => `<option value="${esc(a.name)}">`).join('');
    }

    function open() {
        if (!$('armor-class')) return;
        build();
        ov.classList.remove('hidden');
        render();
        loadSrd();
        setTimeout(() => ov.querySelector('[data-ac="auto"]')?.focus({ preventScroll: true }), 60);
    }
    function close() { if (ov) ov.classList.add('hidden'); }

    const partsHtml = (parts) => parts.map((p, i) =>
        `<span class="ac-part"><em>${esc(p.label)}</em> ${i === 0 || p.base ? p.value : signed(p.value)}</span>`).join('');

    function armorCard(a, i) {
        const worn = !!a.equipped;
        const hasAdv = num(a.strMin) || a.stealthDis || (a.resist || []).length || (a.immune || []).length || (a.vuln || []).length || a.notes;
        return `<article class="ac-card${worn ? ' is-worn' : ''}" data-i="${i}">
            <div class="ac-card-top">
                <button type="button" class="ac-wear${worn ? ' is-on' : ''}" data-ac="wear" aria-pressed="${worn}">${worn ? '✔ Portée' : 'Porter'}</button>
                <input type="text" class="ac-in ac-name" data-ac="name" value="${esc(a.name)}" aria-label="Nom" placeholder="Nom de l’armure">
                <button type="button" class="ac-icon" data-ac="del" aria-label="Supprimer ${esc(a.name)}" title="Supprimer">🗑</button>
            </div>
            <div class="ac-grid">
                <label>Type<select class="ac-in" data-ac="kind">${Object.entries(KINDS).map(([k, l]) =>
                    `<option value="${k}"${a.kind === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
                <label>${a.kind === 'shield' ? 'Bonus de CA' : 'CA de base'}<input type="number" class="ac-in" data-ac="base" value="${esc(a.base)}"></label>
                ${a.kind === 'medium' ? `<label>Dex max<input type="number" class="ac-in" data-ac="dexMax" min="0" value="${esc(a.dexMax == null || a.dexMax === '' ? 2 : a.dexMax)}"></label>` : ''}
                <label class="ac-magic${a.isMagic ? ' is-on' : ''}"><span><input type="checkbox" data-ac="isMagic"${a.isMagic ? ' checked' : ''}> ✨ Armure magique</span>
                    ${a.isMagic ? `<select class="ac-in" data-ac="magic">${[1, 2, 3].map(n => `<option value="${n}"${num(a.magic, 1) === n ? ' selected' : ''}>+${n}</option>`).join('')}</select>` : ''}</label>
            </div>
            <details class="ac-adv"${hasAdv ? ' open' : ''}>
                <summary>Propriétés avancées</summary>
                <div class="ac-grid">
                    <label>Force minimale<input type="number" class="ac-in" data-ac="strMin" min="0" value="${esc(a.strMin || '')}" placeholder="—"></label>
                    <label class="ac-check"><input type="checkbox" data-ac="stealthDis"${a.stealthDis ? ' checked' : ''}> Désavantage en Discrétion</label>
                </div>
                ${DEF.map(([k, , label]) => `<label class="ac-wide">${label} conférées<input type="text" class="ac-in" data-ac="arm-def" data-k="${k}" value="${esc((a[k] || []).join(', '))}" placeholder="ex : feu, froid"></label>`).join('')}
                <label class="ac-wide">Notes<input type="text" class="ac-in" data-ac="notes" value="${esc(a.notes || '')}" placeholder="Origine, malédiction, harmonisation…"></label>
            </details>
        </article>`;
    }

    function render() {
        if (!ov) return;
        const body = ov.querySelector('.ac-body');
        // Garde le curseur là où il était : chaque modification redessine la fenêtre.
        const act = document.activeElement;
        const focus = act && body.contains(act) && act.dataset.ac
            ? { ac: act.dataset.ac, i: act.closest('[data-i]')?.dataset.i, k: act.dataset.k, v: act.type === 'radio' ? act.value : null }
            : null;

        const d = load(), r = compute(d);
        const shown = d.auto ? r.total : (val('armor-class') || '—');
        body.innerHTML = `
            <section class="ac-hero">
                <div class="ac-shield${d.auto ? ' is-auto' : ''}"><span class="ac-shield-val">${esc(shown)}</span><span class="ac-shield-lbl">CA</span></div>
                <div class="ac-hero-main">
                    <label class="ac-switch"><input type="checkbox" data-ac="auto"${d.auto ? ' checked' : ''}><span>Calcul automatique</span></label>
                    <p class="ac-formula">${d.auto
                        ? `${partsHtml(r.parts)} <span class="ac-eq">= <b>${r.total}</b></span>`
                        : 'La CA reste celle que tu saisis sur la fiche. Active le calcul pour qu’elle suive tes armures et tes caractéristiques.'}</p>
                    ${r.warn.length ? `<ul class="ac-warn">${r.warn.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
                </div>
            </section>

            <section class="ac-sec">
                <h3>Armures &amp; boucliers</h3>
                <div class="ac-list">${d.armors.length
                    ? d.armors.map(armorCard).join('')
                    : '<p class="ac-empty">Aucune armure pour l’instant. Ajoute celle du SRD ou crée la tienne.</p>'}</div>
                <div class="ac-add">
                    <input type="text" class="ac-in" data-ac="srd-query" list="ac-srd-list" placeholder="🔍 Cotte de mailles, bouclier, armure de cuir…" aria-label="Armure du SRD">
                    <datalist id="ac-srd-list">${srdArmors.map(a => `<option value="${esc(a.name)}">`).join('')}</datalist>
                    <button type="button" class="ac-btn ac-primary" data-ac="add-srd">Ajouter</button>
                    <button type="button" class="ac-btn" data-ac="add-custom">✚ Armure maison</button>
                </div>
            </section>

            <section class="ac-sec">
                <h3>Sans armure</h3>
                <div class="ac-unarmored">${Object.entries(UNARMORED).map(([k, u]) =>
                    `<label class="ac-radio${d.unarmored === k ? ' is-on' : ''}"><input type="radio" name="ac-unarmored" data-ac="unarmored" value="${k}"${d.unarmored === k ? ' checked' : ''}>
                        <span><b>${u.label}</b><small>${u.formule}</small></span></label>`).join('')}</div>
                ${d.unarmored === 'custom' ? `<label class="ac-inline">Base <input type="number" class="ac-in" data-ac="custom-base" value="${esc(d.customBase)}"> + modificateur de Dextérité</label>` : ''}
                <p class="ac-hint">S’applique quand aucune armure n’est portée.</p>
            </section>

            <section class="ac-sec">
                <h3>Bonus divers</h3>
                <div class="ac-misc">${d.misc.map((m, i) => `<div class="ac-misc-row" data-i="${i}">
                    <input type="text" class="ac-in" data-ac="misc-label" value="${esc(m.label)}" placeholder="Anneau de protection, style Défense…" aria-label="Origine du bonus">
                    <input type="number" class="ac-in ac-num" data-ac="misc-value" value="${esc(m.value)}" aria-label="Valeur">
                    <button type="button" class="ac-icon" data-ac="misc-del" aria-label="Retirer ce bonus" title="Retirer">🗑</button>
                </div>`).join('')}</div>
                <button type="button" class="ac-btn" data-ac="misc-add">＋ Ajouter un bonus</button>
            </section>

            <section class="ac-sec">
                <h3>Résistances, immunités &amp; vulnérabilités</h3>
                ${DEF.map(([k, , label, effet]) => {
                    const g = uniq(granted(d, k));
                    return `<div class="ac-def">
                        <label>${label} <small>${effet}</small><input type="text" class="ac-in" data-ac="def" data-k="${k}" value="${esc(d.defenses[k].join(', '))}" placeholder="feu, froid, poison…"></label>
                        ${g.length ? `<div class="ac-granted">Par l’armure portée : ${g.map(x => `<span class="ac-tag">${esc(x)}</span>`).join('')}</div>` : ''}
                    </div>`;
                }).join('')}
                <p class="ac-hint">Les champs « Défenses » du module Combat affichent l’ensemble : les tiennes et celles de l’armure portée.</p>
            </section>`;

        if (focus) {
            const sel = `[data-ac="${focus.ac}"]` + (focus.k ? `[data-k="${focus.k}"]` : '') + (focus.v ? `[value="${focus.v}"]` : '');
            const scope = focus.i != null ? body.querySelector(`[data-i="${focus.i}"]`) : body;
            const el = scope && scope.querySelector(sel);
            if (el) el.focus({ preventScroll: true });
        }
    }

    function mutate(fn) {
        const d = load();
        if (fn(d) === false) return;
        save(d);
        applyToSheet(d);
        render();
    }
    function autoOn(d) {
        if (d.auto) return;
        d.auto = true;
        toast('🛡️ CA calculée automatiquement à partir de ton armure.');
    }
    function wear(d, a, on) {
        if (on) d.armors.forEach(x => { if (x !== a && sameSlot(x, a)) x.equipped = false; });
        a.equipped = on;
        if (on) autoOn(d);
    }

    function addFromQuery() {
        const q = ov.querySelector('[data-ac="srd-query"]');
        const name = q ? q.value.trim() : '';
        if (!name) { if (q) q.focus(); return; }
        const e = srdArmors.find(x => fold(x.name) === fold(name));
        mutate(d => {
            const a = e ? fromSrd(e) : newArmor({ name });
            d.armors.push(a);
            if (!d.armors.some(x => x !== a && x.equipped && sameSlot(x, a))) wear(d, a, true);
        });
    }

    function onClick(e) {
        if (e.target === ov) { close(); return; }
        const b = e.target.closest('[data-ac]');
        if (!b || b.matches('input, select')) return;
        const card = b.closest('.ac-card');
        const i = card ? num(card.dataset.i, -1) : -1;
        switch (b.dataset.ac) {
            case 'close': close(); break;
            case 'wear': mutate(d => { const a = d.armors[i]; if (!a) return false; wear(d, a, !a.equipped); }); break;
            case 'del': {
                const a = load().armors[i];
                if (a && confirm(`Supprimer « ${a.name || 'cette armure'} » ?`)) mutate(d => { d.armors.splice(i, 1); });
                break;
            }
            case 'add-srd': addFromQuery(); break;
            case 'add-custom': mutate(d => { d.armors.push(newArmor({ name: 'Armure maison' })); }); break;
            case 'misc-add': mutate(d => { d.misc.push({ label: '', value: 1 }); autoOn(d); }); break;
            case 'misc-del': mutate(d => { d.misc.splice(num(b.closest('.ac-misc-row').dataset.i, -1), 1); }); break;
        }
    }

    function onChange(e) {
        const t = e.target;
        const act = t.dataset && t.dataset.ac;
        if (!act || act === 'srd-query') return;
        const i = num((t.closest('.ac-card') || {}).dataset?.i, -1);
        const row = num((t.closest('.ac-misc-row') || {}).dataset?.i, -1);
        mutate(d => {
            const a = d.armors[i];
            switch (act) {
                case 'auto': d.auto = t.checked; return;
                case 'unarmored': d.unarmored = t.value; autoOn(d); return;
                case 'custom-base': d.customBase = num(t.value, 10); return;
                case 'misc-label': if (d.misc[row]) d.misc[row].label = t.value.trim(); return;
                case 'misc-value': if (d.misc[row]) d.misc[row].value = num(t.value); return;
                case 'def': d.defenses[t.dataset.k] = uniq(splitList(t.value)); return;
            }
            if (!a) return false;
            switch (act) {
                case 'name': a.name = t.value.trim(); break;
                case 'notes': a.notes = t.value.trim(); break;
                case 'base': a.base = num(t.value, a.kind === 'shield' ? 2 : 10); break;
                case 'dexMax': a.dexMax = t.value === '' ? null : num(t.value, 2); break;
                case 'strMin': a.strMin = t.value === '' ? '' : num(t.value); break;
                case 'magic': a.magic = num(t.value, 1); break;
                case 'isMagic': a.isMagic = t.checked; if (t.checked && !num(a.magic)) a.magic = 1; break;
                case 'stealthDis': a.stealthDis = t.checked; break;
                case 'arm-def': a[t.dataset.k] = uniq(splitList(t.value)); break;
                case 'kind':
                    a.kind = t.value;
                    if (a.kind === 'shield' && num(a.base, 99) > 5) a.base = 2;
                    if (a.equipped) d.armors.forEach(x => { if (x !== a && x.equipped && sameSlot(x, a)) x.equipped = false; });
                    break;
                default: return false;
            }
        });
    }

    // ---------- La fiche bouge : on suit ----------
    function onSheetEvent(e) {
        if (writing || !hasData()) return;
        const t = e.target;
        if (!t || !t.id) return;
        if (t.classList.contains('stat-score') || /^prof-armor-/.test(t.id)) {
            const d = load();
            if (d.auto) applyToSheet(d);
            if (isOpen()) render();
            return;
        }
        if (t.id === 'armor-class' && e.type === 'input' && e.isTrusted) {
            const d = load();
            if (!d.auto) return;
            d.auto = false; save(d); badge(d);
            toast('✍️ CA saisie à la main : calcul automatique désactivé. Le bouton CA le réactive.');
            if (isOpen()) render();
            return;
        }
        const def = DEF.find(x => x[1] === t.id);
        if (def && e.type === 'change' && e.isTrusted) {
            const d = load();
            const fromArmor = new Set(granted(d, def[0]).map(fold));
            d.defenses[def[0]] = uniq(splitList(t.value).filter(x => !fromArmor.has(fold(x))));
            save(d);
            applyToSheet(d);
        }
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('#btn-open-armor')) { e.preventDefault(); open(); return; }
        const cell = e.target.closest('.ac-cell');
        if (cell && !e.target.closest('input, button, label')) open();
    });

    document.addEventListener('DOMContentLoaded', () => {
        document.body.addEventListener('input', onSheetEvent);
        document.body.addEventListener('change', onSheetEvent);
        // Après le chargement de la fiche par script.js : on remet la CA à jour.
        setTimeout(() => { if ($('armor-class') && hasData()) applyToSheet(load()); }, 400);
    });

    window.ArmorWidget = {
        open, close,
        /** Ajoute des armures (entrées SRD ou objets). `equip` porte la première de chaque
         *  sorte si rien n'est déjà porté ; `auto` active le calcul de la CA. */
        add(entries, opts) {
            const o = opts || {};
            const d = load();
            (entries || []).forEach(x => {
                if (!x) return;
                const a = x.armor_class ? fromSrd(x) : newArmor(x);
                d.armors.push(a);
                if (o.equip && !d.armors.some(y => y !== a && y.equipped && sameSlot(y, a))) a.equipped = true;
            });
            if (o.auto) d.auto = true;
            if (o.unarmored && UNARMORED[o.unarmored]) d.unarmored = o.unarmored;
            save(d);
            applyToSheet(d);
            if (isOpen()) render();
        },
        compute: () => compute(load()),
        refresh: () => { if (hasData()) applyToSheet(load()); }
    };
})();
