/* ============================================================
   IMPRESSION DE LA FICHE DE PERSONNAGE (2024 FR)
   ------------------------------------------------------------
   Dessine les 2 pages de la fiche officielle (images pré-rendues
   fiche-p1.png / fiche-p2.png) sur canvas, surimprime les valeurs
   du personnage ACTIF aux positions des champs (fiche-layout.js,
   généré depuis le PDF AcroForm d'origine), puis imprime.
   100 % local, aucun CDN. Expose window.PrintSheet.

   LOT 7.1 :
   · deux écritures au choix — « manuscrit » (la police Caveat, servie
     depuis fonts/ sous licence OFL, encre bleue) ou « imprimé »
     (caractères d'imprimerie, encre noire). Le choix est retenu sur
     l'appareil ;
   · les pages 1 et 2 gardent leur mise en page et leurs données :
     collect() ne change pas. Le dessin note seulement les champs qui
     débordent. Quand le sac, les traits ou l'histoire ne tiennent plus
     lisiblement, que des notes n'ont aucune case, ou que des sorts sont
     restés hors de la table de la page 2, des pages de suite s'ajoutent
     (impression-suite.js, chargé à la demande) ;
   · cadre() prête l'iframe d'impression aux autres modules (cartes de
     sorts : cartes-sorts.js).
   ============================================================ */
(function () {
    'use strict';

    const PAGES = ['fiche-p1.png', 'fiche-p2.png'];
    // « Caveat BnB » : un nom propre au site, pour qu'un Caveat installé sur
    // l'appareil ne vienne pas s'y substituer. Les polices système suivent en repli.
    const POLICE_MANUSCRITE = 'Caveat BnB';
    const FICHIERS_POLICE = [['fonts/Caveat-Regular.woff2', '400'], ['fonts/Caveat-Bold.woff2', '700']];
    const ECRITURES = {
        // Caveat est étroite : à taille égale elle paraît plus petite, on lui donne 12 % de plus.
        manuscrit: { encre: '#1c2f7a', police: '"' + POLICE_MANUSCRITE + '","Segoe Print","Bradley Hand","Comic Sans MS",cursive', grossir: 1.12 },
        imprime:   { encre: '#1d1d1f', police: 'Arial,"Helvetica Neue",Helvetica,sans-serif', grossir: 1 }
    };
    const CLE_ECRITURE = 'dnd-impression-ecriture';        // réglage de l'appareil
    let ecriture = ECRITURES.manuscrit;                      // celle du dessin en cours

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const adresse = (f) => { try { return new URL(f, document.baseURI).href; } catch (e) { return f; } };

    function ecritureRetenue() {
        try { const v = localStorage.getItem(CLE_ECRITURE); return ECRITURES[v] ? v : 'manuscrit'; } catch (e) { return 'manuscrit'; }
    }
    function retenirEcriture(v) { try { if (ECRITURES[v]) localStorage.setItem(CLE_ECRITURE, v); } catch (e) {} }

    // Le canvas n'attend pas les polices : Caveat est chargée avant le premier dessin.
    let policePrete = null;
    function chargerPolice() {
        if (policePrete) return policePrete;
        policePrete = (async () => {
            if (typeof FontFace !== 'function' || !document.fonts) return false;
            try {
                const faces = FICHIERS_POLICE.map(([f, poids]) =>
                    new FontFace(POLICE_MANUSCRITE, 'url("' + adresse(f) + '") format("woff2")', { weight: poids, style: 'normal' }));
                await Promise.all(faces.map(x => x.load()));
                faces.forEach(x => document.fonts.add(x));
                return true;
            } catch (e) {
                policePrete = null;         // hors ligne : les polices système prennent le relais, on réessaiera
                return false;
            }
        })();
        return policePrete;
    }

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

    /** Les sorts de la table de la page 2 (30 lignes : mineurs + préparés ; tout si rien n'est marqué préparé). */
    function tableDesSorts(spells) {
        const anyPrepared = spells.some(sp => sp.prepared);
        return spells
            .filter(sp => (parseInt(sp.level, 10) || 0) === 0 || !anyPrepared || sp.prepared)
            .sort((a, b) => ((parseInt(a.level, 10) || 0) - (parseInt(b.level, 10) || 0)) || String(a.name).localeCompare(String(b.name)))
            .slice(0, 30);
    }

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
            // Le type de dégâts et les propriétés vivent désormais dans leurs
            // propres champs : on les recolle pour la feuille papier.
            F['weapons' + r + '3'] = [a.dmg, a.dmgType].filter(Boolean).join(' ');
            F['weapons' + r + '4'] = [a.notes, a.props, a.range].filter(Boolean).join(' · ');
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
        const rows = tableDesSorts(jstore('dnd-spells') || []);
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
        let size = Math.min(r.h * 0.66, 15 * scale) * ecriture.grossir;
        ctx.save(); ctx.fillStyle = ecriture.encre; ctx.textBaseline = 'middle';
        // rétrécit la police jusqu'à tenir dans la case (plancher bas : tout doit rentrer)
        for (; size > 3.6 * scale; size -= 0.4 * scale) {
            ctx.font = size + 'px ' + ecriture.police;
            if (ctx.measureText(value).width <= r.w - pad * 2) break;
        }
        const center = r.w < 58 * scale;   // petites cases (scores, bonus…) → centré
        ctx.textAlign = center ? 'center' : 'left';
        ctx.fillText(value, center ? r.x + r.w / 2 : r.x + pad, r.y + r.h / 2 + 1 * scale, r.w - pad);
        ctx.restore();
    }
    /** Écrit un texte sur plusieurs lignes. Rend { taille, coupe } : la taille
     *  retenue (en points de la fiche) et si des lignes ont dû être coupées. */
    function drawMultiline(ctx, value, r, scale) {
        const pad = 4 * scale;
        const lines = String(value).split('\n');
        const MIN = 4.2 * scale;           // plancher bas : on réduit l'écriture plutôt que de couper
        let size = 10 * scale * ecriture.grossir, lineH;
        const rendu = { taille: 0, coupe: false };
        ctx.save(); ctx.fillStyle = ecriture.encre; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        // essaie 10pt puis réduit (police ET interligne) jusqu'à ce que TOUT tienne dans la case.
        // Le dernier essai se fait AU plancher : sans lui, un texte qui ne tenait
        // qu'en dessous n'était pas écrit du tout.
        for (;; size -= 0.6 * scale) {
            if (size < MIN) size = MIN;
            ctx.font = size + 'px ' + ecriture.police; lineH = size * (size <= 6.5 * scale ? 1.18 : 1.28);
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
                rendu.taille = size / scale / ecriture.grossir;
                rendu.coupe = wrapped.length > maxLines;
                break;
            }
        }
        ctx.restore();
        return rendu;
    }
    function drawCheck(ctx, r, scale) {
        const pad = Math.min(r.w, r.h) * 0.22;
        ctx.save(); ctx.strokeStyle = ecriture.encre; ctx.lineWidth = 1.6 * scale; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r.x + pad, r.y + pad); ctx.lineTo(r.x + r.w - pad, r.y + r.h - pad);
        ctx.moveTo(r.x + r.w - pad, r.y + pad); ctx.lineTo(r.x + pad, r.y + r.h - pad);
        ctx.stroke(); ctx.restore();
    }

    /** `rapport` (facultatif) reçoit, pour chaque champ multiligne, ce que le dessin en a fait. */
    function renderFilledPage(img, layout, data, rapport) {
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
                if (type === 'm' && name !== 'hp-current') {
                    const fait = drawMultiline(ctx, v, r, scale);
                    if (rapport) rapport[name] = fait;
                }
                else drawSingleLine(ctx, String(v), r, scale);
            }
        });
        return canvas;
    }

    // ---------- Ce qui ne tient pas sur les deux pages ----------
    // En dessous de cette taille (en points de la fiche), l'écriture ne se lit plus sans loupe.
    const LISIBLE = 5.5;
    const CHAMPS = { sac: ['equipment'], traits: ['features1', 'features2', 'traits', 'feats'], histoire: ['appearance', 'backstory'] };

    function besoinsDeSuite(rapport) {
        const deborde = (noms) => noms.some(n => rapport[n] && (rapport[n].coupe || rapport[n].taille < LISIBLE));
        const spells = jstore('dnd-spells') || [];
        const table = tableDesSorts(spells);
        const horsTable = spells.filter(sp => table.indexOf(sp) === -1);
        // Notes, quêtes, PNJ et lieux n'ont aucune case sur la fiche officielle.
        const rempli = (cle) => (jstore(cle) || []).some(x => x && (String(x.title || '').trim() || String(x.body || '').trim()));
        const carnet = ['dnd-quick-notes', 'dnd-quests', 'dnd-npcs', 'dnd-lieux'].some(rempli);
        const histoire = deborde(CHAMPS.histoire);
        return {
            sorts: horsTable.length ? horsTable : null,
            sac: deborde(CHAMPS.sac),
            traits: deborde(CHAMPS.traits),
            histoire,
            notes: histoire || carnet
        };
    }

    // ---------- L'iframe d'impression, prêtée aux autres modules ----------
    function cadre(titre, css) {
        const old = document.getElementById('print-sheet-frame'); if (old) old.remove();
        const frame = document.createElement('iframe');
        frame.id = 'print-sheet-frame';
        frame.title = 'Impression';
        frame.setAttribute('aria-hidden', 'true');
        frame.setAttribute('tabindex', '-1');
        frame.style.cssText = 'position:fixed; right:0; bottom:0; width:0; height:0; border:0; visibility:hidden;';
        document.body.appendChild(frame);
        const doc = frame.contentDocument;
        doc.open();
        doc.write('<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>' + esc(titre || 'Impression')
            + '</title><style>' + (css || '') + '</style></head><body></body></html>');
        doc.close();
        const win = frame.contentWindow;
        return {
            frame, doc, win,
            /** Tenue quand les images et les polices de la page sont prêtes. */
            pret() {
                void doc.body.offsetHeight;          // la mise en page réclame les polices utilisées
                const attentes = [...doc.images].filter(im => !im.complete)
                    .map(im => new Promise(ok => { im.onload = ok; im.onerror = ok; }));
                if (doc.fonts && doc.fonts.ready) attentes.push(doc.fonts.ready.catch(() => {}));
                return Promise.all(attentes).then(() => new Promise(ok => setTimeout(ok, 60)));
            },
            imprimer() {
                try { win.focus(); win.print(); return true; } catch (e) { return false; }
            }
        };
    }

    // Les images font 1508 x 1936 : à 198 mm de large elles occupent 254 mm
    // de haut, et laissent une bande blanche en bas de chaque page. C'est
    // là que va l'attribution du SRD, exigée par la licence (edition.js),
    // avec l'édition sous laquelle la fiche est jouée.
    const CSS_FICHE = '@page { size: A4 portrait; margin: 6mm; }'
        + 'html,body { margin:0; padding:0; }'
        + '.pg { page-break-after:always; break-after:page; }'
        + '.pg:last-of-type { page-break-after:auto; break-after:auto; }'
        + '.pg img { display:block; width:100%; height:auto; }'
        + '.pg p { margin: 2mm 0 0; font: 5.5pt/1.3 Arial, Helvetica, sans-serif; color:#555; text-align:center; }'
        + '.pg b { font-weight: 700; }';

    /** Prépare l'impression sans lancer l'imprimante : pages dessinées, pages de
     *  suite ajoutées si besoin. `opts.ecriture` : 'manuscrit' | 'imprime'. */
    async function preparer(opts) {
        if (!window.FICHE_LAYOUT) throw new Error('fiche-layout.js non chargé');
        const o = opts || {};
        const choix = ECRITURES[o.ecriture] ? o.ecriture : ecritureRetenue();
        ecriture = ECRITURES[choix];
        if (choix === 'manuscrit') await chargerPolice();
        const imgs = await loadImages();               // mis en cache après le 1er appel
        const data = collect();
        const rapport = {};
        const p1 = renderFilledPage(imgs[0], window.FICHE_LAYOUT.p1, data, rapport);
        const p2 = renderFilledPage(imgs[1], window.FICHE_LAYOUT.p2, data, rapport);
        const name = data.F.charactername || 'personnage';
        const ed = window.Edition ? window.Edition.active() : null;
        const mention = ed ? '<b>Règles ' + ed + '</b> — ' + esc(window.Edition.attribution(ed)) : '';

        const besoins = besoinsDeSuite(rapport);
        let suite = null;
        if (besoins.sorts || besoins.sac || besoins.traits || besoins.notes) {
            try {
                await window.charger('impression-suite');
                suite = window.ImpressionSuite.pages({
                    besoins, ecriture: choix, encre: ecriture.encre, police: ecriture.police,
                    polices: FICHIERS_POLICE.map(([f, poids]) => ({ famille: POLICE_MANUSCRITE, url: adresse(f), poids })),
                    lire: jstore, valeur: val2, nom: name, mention
                });
            } catch (e) {
                console.warn('[impression] pages de suite indisponibles', e);
                if (window.showAppToast) window.showAppToast('Les pages de suite n’ont pas pu se préparer (hors ligne ?) : seules les deux pages de la fiche partent.', 'info');
            }
        }

        const c = cadre('Fiche – ' + name, CSS_FICHE + (suite ? suite.css : ''));
        [p1, p2].forEach(cv => {
            const page = c.doc.createElement('div');
            page.className = 'pg';
            const img = c.doc.createElement('img');
            img.alt = '';
            img.src = cv.toDataURL('image/jpeg', 0.92);
            page.appendChild(img);
            if (mention) { const p = c.doc.createElement('p'); p.innerHTML = mention; page.appendChild(p); }
            c.doc.body.appendChild(page);
        });
        if (suite) {
            c.doc.body.insertAdjacentHTML('beforeend', suite.html);
            if (choix === 'manuscrit' && c.doc.fonts && c.doc.fonts.load) {
                try { await c.doc.fonts.load('12pt "' + POLICE_MANUSCRITE + '"'); } catch (e) { /* repli système */ }
            }
        }
        await c.pret();
        return { cadre: c, doc: c.doc, besoins, sections: suite ? suite.sections : [], ecriture: choix };
    }

    async function print(opts) {
        if (window.showAppToast) window.showAppToast('💾 Préparation de la fiche officielle… (choisis « Enregistrer en PDF » comme imprimante)', '#2c3e50');
        const r = await preparer(opts);
        return r.cadre.imprimer();
    }

    // ---------- La fenêtre : quelle écriture ? ----------
    function poserStyle() {
        if (document.getElementById('impression-style')) return;
        const s = document.createElement('style');
        s.id = 'impression-style';
        s.textContent = '.impression-apercu { display: inline-block; margin-top: 5px; padding: 1px 10px; border-radius: 6px; background: #fffdf6; border: 1px solid rgba(0,0,0,.14); font-size: 1.3rem; line-height: 1.25; font-style: normal; }'
            + '.impression-apercu[data-ecriture="imprime"] { font-size: 1rem; }'
            // L'aperçu montre l'écriture de la feuille, même quand la police adaptée à la dyslexie habille le site.
            + 'html.police-dyslexie body .impression-apercu[data-ecriture="manuscrit"] { font-family: ' + ECRITURES.manuscrit.police + ' !important; }'
            + 'html.police-dyslexie body .impression-apercu[data-ecriture="imprime"] { font-family: ' + ECRITURES.imprime.police + ' !important; }'
            + '.impression-note { margin: 10px 2px 0; font-size: .8rem; font-style: italic; opacity: .82; }';
        document.head.appendChild(s);
    }

    /** Demande l'écriture, puis imprime. Rend null si le joueur renonce. */
    async function demander() {
        await chargerPolice();
        poserStyle();
        const retenue = ecritureRetenue();
        const nom = val2('char-name') || 'Ton héros';
        let boite = null;
        const choix = await window.Dialogue.fenetre({
            titre: 'Imprimer la fiche', icone: '🖨️', confirmer: 'Imprimer', annuler: 'Annuler', annule: null,
            message: 'La fiche officielle, remplie. Pour garder un fichier, choisis « Enregistrer en PDF » comme imprimante.',
            corps() {
                boite = document.createElement('div');
                const opt = (v, ico, titre, detail) => '<label class="dlg-choix-opt">'
                    + '<input type="radio" name="impression-ecriture" value="' + v + '"' + (v === retenue ? ' checked' : '') + '>'
                    + '<span class="dlg-choix-carte"><span class="dlg-choix-ico" aria-hidden="true">' + ico + '</span>'
                    + '<span class="dlg-choix-txt"><b>' + titre + '</b><i>' + detail + '</i>'
                    + '<span class="impression-apercu" data-ecriture="' + v + '" aria-hidden="true" style="font-family:' + esc(ECRITURES[v].police) + ';color:' + ECRITURES[v].encre + '">' + esc(nom) + '</span>'
                    + '</span></span></label>';
                boite.innerHTML = '<div class="dlg-choix" role="radiogroup" aria-label="Écriture de la fiche">'
                    + opt('manuscrit', '✍️', 'Manuscrit', 'Encre bleue, écrit à la main')
                    + opt('imprime', '🔠', 'Imprimé', 'Encre noire, caractères d’imprimerie')
                    + '</div><p class="impression-note">Si ton sac, tes sorts, tes traits ou tes notes débordent de la fiche, des pages de suite s’ajoutent après les deux pages officielles.</p>';
                return boite;
            },
            resultat() { const c = boite && boite.querySelector('input:checked'); return c ? c.value : retenue; }
        });
        if (!choix) return null;
        retenirEcriture(choix);
        return print({ ecriture: choix });
    }

    window.PrintSheet = {
        print, demander, preparer, cadre,
        ecriture: ecritureRetenue,
        _collect: collect, _render: renderFilledPage, _loadImages: loadImages, _tableDesSorts: tableDesSorts
    };
})();
