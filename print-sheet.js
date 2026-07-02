/* ============================================================
   IMPRESSION DE LA FICHE OFFICIELLE (D&D 2024 FR)
   ------------------------------------------------------------
   Dessine les 2 pages de la fiche officielle (images pré-rendues
   fiche-p1.png / fiche-p2.png) sur canvas, surimprime les valeurs
   du personnage ACTIF aux positions des champs (fiche-layout.js,
   généré depuis le PDF AcroForm d'origine), puis imprime.
   Style « encre bleue manuscrite ». 100 % local, aucun CDN.
   Expose window.PrintSheet.print().
   ============================================================ */
(function () {
    'use strict';

    const PAGES = ['fiche-p1.png', 'fiche-p2.png'];
    const INK   = '#1c2f7a';                          // encre bleue
    const FONT  = '"Segoe Print","Bradley Hand","Comic Sans MS",cursive';

    let _imgsPromise = null;
    function loadImages() {
        if (!_imgsPromise) {
            _imgsPromise = Promise.all(PAGES.map(src => new Promise((res, rej) => {
                const im = new Image();
                im.onload = () => res(im);
                im.onerror = () => { _imgsPromise = null; rej(new Error('Image de fiche introuvable : ' + src)); };
                im.src = src;
            })));
        }
        return _imgsPromise;
    }

    // ---------- Collecte des données du personnage actif ----------
    const $   = id => document.getElementById(id);
    const val = id => { const el = $(id); return el ? String(el.value || '').trim() : ''; };
    const txt = id => { const el = $(id); return el ? String(el.textContent || '').trim() : ''; };
    const chk = id => { const el = $(id); return !!(el && el.checked); };
    const signed = v => { const n = parseInt(v, 10); return isNaN(n) ? String(v || '') : (n >= 0 ? '+' + n : String(n)); };
    function jstore(key) {
        try {
            const cid = localStorage.getItem('dnd-active-char'); if (!cid) return null;
            const raw = localStorage.getItem(cid + '_' + key);
            return raw && raw !== 'undefined' ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }
    // Valeur brute (non-JSON) du stockage du personnage actif (clés dnd-sheet-*)
    function rawStore(key) {
        try {
            const cid = localStorage.getItem('dnd-active-char'); if (!cid) return null;
            const v = localStorage.getItem(cid + '_' + key);
            return (v == null || v === 'undefined') ? null : v;
        } catch (e) { return null; }
    }
    // Lecture robuste : DOM d'abord, sinon repli sur le stockage local du personnage
    const val2 = id => { const v = val(id); return v || (rawStore('dnd-sheet-' + id) || ''); };
    const chk2 = id => { const el = $(id); return el ? !!el.checked : rawStore('dnd-sheet-' + id) === 'true'; };

    // Fiche 2024 : correspondance champ PDF → compétence de l'app
    const SKILLS = { skill1: 'athletics', skill2: 'acrobatics', skill3: 'stealth', skill4: 'sleight',
        skill5: 'arcana', skill6: 'history', skill7: 'investigation', skill8: 'nature', skill9: 'religion',
        skill10: 'animal', skill11: 'insight', skill12: 'medicine', skill13: 'perception', skill14: 'survival',
        skill15: 'intimidation', skill16: 'persuasion', skill17: 'performance', skill18: 'deception' };
    const SAVES = { save1: 'save-str', save2: 'save-dex', save3: 'save-con', save4: 'save-int', save5: 'save-wis', save6: 'save-cha' };
    const CBSLOTS = { 1: [11, 12, 13, 14], 2: [21, 22, 23], 3: [31, 32, 33], 4: [41, 42, 43], 5: [51, 52, 53], 6: [61, 62], 7: [71, 72], 8: [81], 9: [91] };

    function collect() {
        const F = {};   // champs texte  {nom: valeur}
        const C = {};   // cases à cocher {nom: bool}

        // --- Identité (page 1) ---
        F.charactername = val2('char-name');
        F.class = val2('char-class'); F.subclass = val2('char-subclass');
        F.level = val2('char-level'); F.xp = val2('char-xp');
        F.background = val2('char-background'); F.species = val2('char-race');
        F.size = val2('char-size'); F.alignment = val2('char-alignment');

        // --- Caracs + mods ---
        ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(a => { F[a] = val('stat-' + a); F['mod' + a] = txt('mod-' + a); });
        F.pb = signed(val('prof-bonus'));
        F.ac = val('armor-class'); F.init = signed(val('initiative'));
        F.speed = val('speed'); F.passive = val('passive-perception');
        F['hp-current'] = val('hp-current'); F['hp-max'] = val('hp-max'); F['hp-temp'] = val('hp-temp');
        const hdSize = val('hd-size');
        F['hd-max'] = val('hd-max') + (hdSize ? ' ' + hdSize : '');
        F['hd-spent'] = val('hd-spent');
        // Jets contre la mort : DS1-3 = succès (rangée haute), DS4-6 = échecs
        ['s1', 's2', 's3'].forEach((k, i) => { C['DS' + (i + 1)] = chk('death-' + k); });
        ['f1', 'f2', 'f3'].forEach((k, i) => { C['DS' + (i + 4)] = chk('death-' + k); });

        // --- Sauvegardes & compétences (valeur + maîtrise) ---
        Object.keys(SAVES).forEach((f, i) => {
            F[f] = txt('skill-val-' + SAVES[f]);
            C['s' + (i + 1)] = (parseInt(val('prof-' + SAVES[f]), 10) || 0) > 0;
        });
        Object.keys(SKILLS).forEach(f => {
            F[f] = txt('skill-val-' + SKILLS[f]);
            C['sk' + f.slice(5)] = (parseInt(val('prof-' + SKILLS[f]), 10) || 0) > 0;
        });

        // --- Bouclier & inspiration héroïque ---
        C.shield = chk2('has-shield');
        C.inspiration = chk2('heroic-inspiration');

        // --- Armes & attaques (grille 6×4 + liaison d'objets magiques) ---
        const attacks = jstore('dnd-attacks') || [];
        attacks.slice(0, 6).forEach((a, i) => {
            const r = i + 1;
            F['weapons' + r + '1'] = a.name || ''; F['weapons' + r + '2'] = a.bonus || '';
            F['weapons' + r + '3'] = a.dmg || '';  F['weapons' + r + '4'] = a.notes || '';
        });
        attacks.filter(a => a.reqAttune).slice(0, 3).forEach((a, i) => {
            F['attun' + (i + 1)] = a.name || ''; C['attunChk' + (i + 1)] = !!a.isAttuned;
        });

        // --- Entraînements & maîtrises (bloc bas-gauche de la page 1) ---
        // ARMURES : 4 cases (Légères / Intermédiaires / Lourdes / Boucliers)
        C.armor1 = chk2('prof-armor-light'); C.armor2 = chk2('prof-armor-med');
        C.armor3 = chk2('prof-armor-heavy'); C.armor4 = chk2('prof-armor-shield');
        // ARMES : zone texte (le champ PDF « weapons » = maîtrises d'armes, PAS les attaques)
        const wp = [];
        if (chk2('prof-weapon-simple')) wp.push('Armes courantes');
        if (chk2('prof-weapon-martial')) wp.push('Armes de guerre');
        if (chk2('prof-weapon-other')) wp.push('Autres armes');
        F.weapons = wp.join(', ');
        // OUTILS : zone texte libre
        F.tools = val2('prof-tools');

        // --- Capacités de classe / traits d'espèce / dons (NOMS seulement) ---
        const traits = jstore('dnd-traits') || [];
        const limited = (jstore('dnd-abilities') || []).map(c => c.name).filter(Boolean);
        const seen = {};
        const classFeats = traits.filter(t => t.type === 'class').map(t => t.name).concat(limited)
            .filter(n => { const k = String(n || '').trim().toLowerCase(); if (!k || seen[k]) return false; seen[k] = 1; return true; });
        const half = Math.ceil(classFeats.length / 2);
        F.features1 = classFeats.slice(0, half).join('\n');
        F.features2 = classFeats.slice(half).join('\n');
        F.traits = traits.filter(t => t.type === 'race').map(t => t.name).join('\n');
        F.feats = traits.filter(t => t.type === 'feat').map(t => t.name).join('\n');

        // --- Équipement, langues, apparence, histoire & personnalité, monnaie (page 2) ---
        let equipment = (jstore('dnd-inventory') || []).map(it => it.name + (Number(it.qty) > 1 ? ' ×' + it.qty : '')).join('\n');
        // Les attaques au-delà des 6 lignes de la grille rejoignent l'équipement (page 2)
        if (attacks.length > 6) {
            equipment += (equipment ? '\n' : '') + '— Attaques (suite) —\n'
                + attacks.slice(6).map(a => [a.name, a.bonus, a.dmg].filter(Boolean).join(' · ')).join('\n');
        }
        F.equipment = equipment;
        F.languages = val2('char-languages');
        F.appearance = val2('char-appearance');
        F.backstory = val2('char-backstory');
        F.cp = val('coin-pc'); F.sp = val('coin-pa'); F.ep = val('coin-pe'); F.gp = val('coin-po'); F.pp = val('coin-pp');

        // --- Magie --- (val2 : certains champs sont recalculés/vidés dans le DOM → repli stockage)
        F['spell-ability'] = ({ int: 'Intelligence', wis: 'Sagesse', cha: 'Charisme' })[val2('spellcasting-ability')] || '';
        const spellMod = val2('spell-modifier');
        F['spell-mod'] = spellMod === '' ? '' : signed(spellMod);
        F['spell-dc'] = val2('spell-save-dc');
        const spellAtk = val2('spell-attack-bonus');
        F['spell-bonus'] = spellAtk === '' ? '' : signed(spellAtk);
        const slots = jstore('dnd-spell-slots') || [];
        slots.forEach((s, lvl) => {
            if (!s || !(s.total > 0)) return;
            F['slot' + (lvl + 1)] = String(s.total);
            const used = (s.used || []).filter(Boolean).length;
            (CBSLOTS[lvl + 1] || []).forEach((cb, i) => { if (i < used) C['cbslot' + cb] = true; });
        });

        // --- Table des sorts (30 lignes : mineurs + préparés ; tout si rien n'est marqué préparé) ---
        const spells = jstore('dnd-spells') || [];
        const anyPrepared = spells.some(sp => sp.prepared);
        const rows = spells
            .filter(sp => (parseInt(sp.level, 10) || 0) === 0 || !anyPrepared || sp.prepared)
            .sort((a, b) => ((parseInt(a.level, 10) || 0) - (parseInt(b.level, 10) || 0)) || String(a.name).localeCompare(String(b.name)))
            .slice(0, 30);
        rows.forEach((sp, i) => {
            const n = i + 1;
            const comp = sp.comp || null;   // cases V/S/M structurées (sinon repli sur l'ancien texte libre)
            F['spell' + n + 'l'] = String(parseInt(sp.level, 10) || 0);
            F['spell' + n] = sp.name || '';
            F['spell' + n + 't'] = sp.time || '';
            F['spell' + n + 'r'] = sp.range || '';
            F['spell' + n + 'c'] = [sp.duration, sp.notes, (comp && comp.m && comp.mat) ? ('M : ' + comp.mat) : null].filter(Boolean).join(' · ');
            C['c' + n] = /concentration/i.test(sp.duration || '');
            C['r' + n] = /rituel|ritual/i.test((sp.name || '') + ' ' + (sp.time || '') + ' ' + (sp.notes || ''));
            C['m' + n] = comp ? !!comp.m : /\bM\b/i.test(sp.res || '');
        });

        return { F, C };
    }

    // ---------- Dessin des valeurs sur le canvas ----------
    // Entrée layout [nom, type, x1, y1, x2, y2] en coords PDF (origine bas-gauche) → rect canvas
    function toCanvasRect(e, scale, pageH) {
        return { x: e[2] * scale, y: (pageH - e[5]) * scale, w: (e[4] - e[2]) * scale, h: (e[5] - e[3]) * scale };
    }
    function drawSingleLine(ctx, value, r, scale) {
        const pad = 3 * scale;
        let size = Math.min(r.h * 0.66, 15 * scale);
        ctx.save(); ctx.fillStyle = INK; ctx.textBaseline = 'middle';
        // rétrécit la police jusqu'à tenir dans la case (plancher bas : tout doit rentrer)
        for (; size > 3.6 * scale; size -= 0.4 * scale) {
            ctx.font = size + 'px ' + FONT;
            if (ctx.measureText(value).width <= r.w - pad * 2) break;
        }
        const center = r.w < 58 * scale;   // petites cases (scores, bonus…) → centré
        ctx.textAlign = center ? 'center' : 'left';
        ctx.fillText(value, center ? r.x + r.w / 2 : r.x + pad, r.y + r.h / 2 + 1 * scale, r.w - pad);
        ctx.restore();
    }
    function drawMultiline(ctx, value, r, scale) {
        const pad = 4 * scale;
        const lines = String(value).split('\n');
        const MIN = 4.2 * scale;           // plancher bas : on réduit l'écriture plutôt que de couper
        let size = 10 * scale, lineH;
        ctx.save(); ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        // essaie 10pt puis réduit (police ET interligne) jusqu'à ce que TOUT tienne dans la case
        for (; size >= MIN; size -= 0.6 * scale) {
            ctx.font = size + 'px ' + FONT; lineH = size * (size <= 6.5 * scale ? 1.18 : 1.28);
            const wrapped = [];
            lines.forEach(line => {
                let cur = '';
                String(line).split(/\s+/).forEach(word => {
                    const t = cur ? cur + ' ' + word : word;
                    if (ctx.measureText(t).width <= r.w - pad * 2) cur = t;
                    else { if (cur) wrapped.push(cur); cur = word; }
                });
                wrapped.push(cur);
            });
            if (wrapped.length * lineH <= r.h - pad || size <= MIN) {
                const maxLines = Math.max(1, Math.floor((r.h - pad) / lineH));
                wrapped.slice(0, maxLines).forEach((l, i) => {
                    const last = (i === maxLines - 1 && wrapped.length > maxLines);
                    ctx.fillText(last ? l + ' …' : l, r.x + pad, r.y + pad / 2 + i * lineH, r.w - pad);
                });
                break;
            }
        }
        ctx.restore();
    }
    function drawCheck(ctx, r, scale) {
        const pad = Math.min(r.w, r.h) * 0.22;
        ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6 * scale; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r.x + pad, r.y + pad); ctx.lineTo(r.x + r.w - pad, r.y + r.h - pad);
        ctx.moveTo(r.x + r.w - pad, r.y + pad); ctx.lineTo(r.x + pad, r.y + r.h - pad);
        ctx.stroke(); ctx.restore();
    }

    function renderFilledPage(img, layout, data) {
        const L = window.FICHE_LAYOUT;
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const scale = canvas.width / L.pageW;   // ≈ 2.5 (1508 / 603)
        layout.forEach(e => {
            const name = e[0], type = e[1];
            const r = toCanvasRect(e, scale, L.pageH);
            if (type === 'b') {
                if (data.C[name]) drawCheck(ctx, r, scale);
            } else {
                const v = data.F[name];
                if (v == null || v === '') return;
                // hp-current est multiligne dans le PDF mais reçoit un nombre → centré simple
                if (type === 'm' && name !== 'hp-current') drawMultiline(ctx, v, r, scale);
                else drawSingleLine(ctx, String(v), r, scale);
            }
        });
        return canvas;
    }

    // ---------- Impression via iframe caché ----------
    function printCanvases(canvases, title) {
        return new Promise((resolve) => {
            const old = document.getElementById('print-sheet-frame'); if (old) old.remove();
            const frame = document.createElement('iframe');
            frame.id = 'print-sheet-frame';
            frame.style.cssText = 'position:fixed; right:0; bottom:0; width:0; height:0; border:0; visibility:hidden;';
            document.body.appendChild(frame);
            const d = frame.contentDocument;
            d.open();
            d.write('<!DOCTYPE html><html><head><title>' + (title || 'Fiche de personnage') + '</title><style>'
                + '@page { size: A4 portrait; margin: 6mm; }'
                + 'html,body { margin:0; padding:0; }'
                + 'img { display:block; width:100%; height:auto; page-break-after:always; break-after:page; }'
                + 'img:last-child { page-break-after:auto; break-after:auto; }'
                + '</style></head><body></body></html>');
            d.close();
            let loaded = 0;
            canvases.forEach(c => {
                const img = d.createElement('img');
                img.onload = () => { if (++loaded === canvases.length) setTimeout(go, 60); };
                img.src = c.toDataURL('image/jpeg', 0.92);
                d.body.appendChild(img);
            });
            function go() {
                try { frame.contentWindow.focus(); frame.contentWindow.print(); resolve(true); }
                catch (e) { resolve(false); }
            }
        });
    }

    async function print() {
        if (!window.FICHE_LAYOUT) throw new Error('fiche-layout.js non chargé');
        if (window.showAppToast) window.showAppToast('💾 Préparation de la fiche officielle… (choisis « Enregistrer en PDF » comme imprimante)', '#2c3e50');
        const imgs = await loadImages();               // mis en cache après le 1er appel
        const data = collect();
        const p1 = renderFilledPage(imgs[0], window.FICHE_LAYOUT.p1, data);
        const p2 = renderFilledPage(imgs[1], window.FICHE_LAYOUT.p2, data);
        const name = data.F.charactername || 'personnage';
        return printCanvases([p1, p2], 'Fiche – ' + name);
    }

    window.PrintSheet = { print: print, _collect: collect, _render: renderFilledPage, _loadImages: loadImages };
})();
