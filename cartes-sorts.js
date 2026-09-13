// =====================================================
// cartes-sorts.js — les cartes de sorts à imprimer (LOT 7.2)
//
// Chargé à la demande : charger('cartes-sorts'), depuis le sommaire du
// grimoire ou le menu (Sauvegardes).
//
// Une planche A4 porte 3 × 3 cartes de 63 × 88 mm, jointives, avec des traits
// de coupe dans les marges. Chaque carte reprend le grimoire : nom, niveau,
// école, temps d'incantation, portée, composantes, durée, et les badges
// concentration et rituel. Le texte s'ajuste à la carte ; trop long, il se
// poursuit sur une carte « suite », numérotée.
//
// L'école ne vit pas dans la fiche : elle est lue dans l'index des règles de
// l'édition du personnage (« Niveau 3 · Évocation »), contenu personnel
// compris. Un sort inconnu des règles n'affiche pas d'école : rien n'est
// deviné. Concentration et rituel se lisent comme le grimoire les lit (la
// durée, le drapeau rituel ou le temps d'incantation).
// L'attribution exigée par la licence (edition.js) est imprimée au pied de
// chaque planche.
//
//   CartesSorts.ouvrir()                  → la fenêtre de choix, puis l'impression
//   CartesSorts.preparer({ choix, idx })  → Promise<{ doc, cartes, planches, imprimer }>
//   CartesSorts.selection(choix, idx)     → les sorts retenus, dans l'ordre d'impression
// `choix` : 'tous' | 'prepares' | 'selection' (idx : positions dans le grimoire).
// =====================================================
(function () {
    'use strict';

    const CARTE = { largeur: 63, hauteur: 88 };                 // mm
    const COLONNES = 3, RANGEES = 3, PAR_PLANCHE = COLONNES * RANGEES;
    const PAGE = { largeur: 210, hauteur: 297 };
    const MARGE_X = (PAGE.largeur - COLONNES * CARTE.largeur) / 2;   // 10,5 mm
    const MARGE_Y = (PAGE.hauteur - RANGEES * CARTE.hauteur) / 2;    // 16,5 mm
    // Taille du texte, en points. On descend jusqu'à UNIQUE pour tout garder sur
    // une carte ; au-delà, on repart à SUITE et le texte continue sur la suivante.
    const TAILLE_MAX = 7.6, TAILLE_UNIQUE = 6.0, TAILLE_SUITE = 6.8, PAS = 0.2;

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const niveauDe = (sp) => parseInt(sp && sp.level, 10) || 0;
    // Les deux mêmes lectures que le grimoire (script.js : spIsConc, spEstRituel).
    const estConcentration = (sp) => /concentration/i.test((sp && sp.duration) || '');
    const estRituel = (sp) => (sp && sp.rituel != null) ? !!sp.rituel : /\brituel\b/i.test((sp && sp.time) || '');
    const estPrepare = (sp) => niveauDe(sp) === 0 || !!(sp && sp.prepared);
    const plier = (s) => (window.SRD && window.SRD.fold ? window.SRD.fold(s) : String(s || '').toLowerCase()).trim();

    function idPerso() { try { return localStorage.getItem('dnd-active-char') || ''; } catch (e) { return ''; } }
    function lireSorts() {
        try {
            const brut = localStorage.getItem(idPerso() + '_dnd-spells');
            const v = brut && brut !== 'undefined' ? JSON.parse(brut) : [];
            return Array.isArray(v) ? v.filter(s => s && String(s.name || '').trim()) : [];
        } catch (e) { return []; }
    }
    const nomHeros = () => { const el = document.getElementById('char-name'); return (el && el.value.trim()) || 'Héros'; };

    /** Les sorts du grimoire, avec leur position, rangés par niveau puis par nom. */
    function grimoire() {
        return lireSorts().map((sp, i) => ({ sp, i }))
            .sort((a, b) => (niveauDe(a.sp) - niveauDe(b.sp)) || String(a.sp.name).localeCompare(String(b.sp.name), 'fr'));
    }

    function selection(choix, idx) {
        const tous = grimoire();
        if (choix === 'prepares') return tous.filter(x => estPrepare(x.sp)).map(x => x.sp);
        if (choix === 'selection') {
            const voulus = new Set((idx || []).map(Number));
            return tous.filter(x => voulus.has(x.i)).map(x => x.sp);
        }
        return tous.map(x => x.sp);
    }

    // =====================================================
    // L'ÉCOLE, LUE DANS LES RÈGLES
    // =====================================================
    /** Nom plié → sous-titre de l'index (« Niveau 3 · Évocation », « Sort mineur · Invocation »). */
    async function indexDesSorts() {
        const m = new Map();
        if (!window.SRD || typeof window.SRD.index !== 'function') return m;
        try {
            (await window.SRD.index()).forEach(e => { if (e && e.c === 'spells' && e.n) m.set(plier(e.n), String(e.s || '')); });
        } catch (e) { /* hors ligne, règles jamais ouvertes : les cartes partent sans école */ }
        return m;
    }

    function niveauTexte(n) { return n === 0 ? 'Sort mineur' : 'Niveau ' + n; }

    /** La ligne « niveau · école ». Le sous-titre des règles fait foi s'il décrit
     *  le même niveau que la fiche ; sinon on garde le niveau de la fiche. */
    function ligneNiveau(sp, index) {
        const n = niveauDe(sp);
        const s = index.get(plier(sp.name)) || '';
        const morceaux = s.split(' · ');
        const ecole = morceaux.length > 1 ? morceaux.slice(1).join(' · ').trim() : '';
        const tete = morceaux[0] || '';
        const memeNiveau = n === 0 ? /mineur/i.test(tete) : new RegExp('\\b' + n + '\\b').test(tete);
        return (memeNiveau && tete ? tete : niveauTexte(n)) + (ecole ? ' · ' + ecole : '');
    }

    // =====================================================
    // LE TEXTE DE LA CARTE
    // =====================================================
    const GARDES = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'SUP', 'SUB']);

    /** Les blocs du texte (paragraphes, listes), nettoyés : aucun attribut, aucun script. */
    function blocs(doc, sp) {
        const boite = doc.createElement('div');
        boite.innerHTML = String(sp.desc || '');
        boite.querySelectorAll('script, style, iframe, object, embed, img, svg').forEach(x => x.remove());
        boite.querySelectorAll('*').forEach(el => {
            if (el.tagName === 'H4' || el.tagName === 'BLOCKQUOTE' || el.tagName === 'DIV') {
                const p = doc.createElement('p');
                if (el.tagName === 'H4') { const b = doc.createElement('b'); b.append(...el.childNodes); p.appendChild(b); }
                else p.append(...el.childNodes);
                el.replaceWith(p);
            }
        });
        boite.querySelectorAll('*').forEach(el => {
            if (!GARDES.has(el.tagName)) { el.replaceWith(...el.childNodes); return; }
            [...el.attributes].forEach(a => el.removeAttribute(a.name));
        });
        const sortie = [];
        let enCours = null;
        [...boite.childNodes].forEach(n => {
            const bloc = n.nodeType === 1 && /^(P|UL|OL)$/.test(n.tagName);
            if (bloc) { enCours = null; if (n.textContent.trim()) sortie.push(n); return; }
            if (n.nodeType === 3 && !n.textContent.trim()) return;
            if (!enCours) { enCours = doc.createElement('p'); sortie.push(enCours); }
            enCours.appendChild(n);
        });
        const notes = String(sp.notes || '').trim();
        if (notes) {
            const p = doc.createElement('p');
            const b = doc.createElement('b'); b.textContent = 'Notes. ';
            p.append(b, doc.createTextNode(notes));
            sortie.push(p);
        }
        return sortie;
    }

    const motsDe = (el) => (el.textContent.match(/\S+/g) || []).length;

    /** Copie de `el` qui garde les mots [debut, fin[ — la mise en forme suit. */
    function tranche(el, debut, fin) {
        const c = el.cloneNode(true);
        const textes = [];
        const w = c.ownerDocument.createTreeWalker(c, 4 /* NodeFilter.SHOW_TEXT */);
        while (w.nextNode()) textes.push(w.currentNode);
        let vus = 0;
        textes.forEach(t => {
            let sortie = '';
            t.textContent.split(/(\s+)/).forEach(m => {
                if (!m) return;
                if (/^\s+$/.test(m)) { if (vus > debut && vus < fin) sortie += m; return; }
                if (vus >= debut && vus < fin) sortie += m;
                vus++;
            });
            t.textContent = sortie;
        });
        // Les enveloppes vidées (un gras dont tout le texte est parti) disparaissent.
        [...c.querySelectorAll('*')].reverse().forEach(x => { if (x.tagName !== 'BR' && !x.textContent.trim()) x.remove(); });
        return c;
    }

    const tient = (zone) => zone.scrollHeight <= zone.clientHeight + 1;

    /** Remplit `zone` avec autant de blocs que possible, en coupant le dernier au
     *  mot près. Rend les blocs qui restent à placer. */
    function remplir(zone, liste) {
        for (let i = 0; i < liste.length; i++) {
            zone.appendChild(liste[i]);
            if (tient(zone)) continue;
            zone.removeChild(liste[i]);
            const total = motsDe(liste[i]);
            let bas = 0, haut = total - 1;
            while (bas < haut) {
                const k = Math.ceil((bas + haut) / 2);
                const essai = tranche(liste[i], 0, k);
                zone.appendChild(essai);
                const ok = tient(zone);
                zone.removeChild(essai);
                if (ok) bas = k; else haut = k - 1;
            }
            // Une carte vide prend au moins un mot : sans cela, la boucle ne finirait pas.
            if (bas === 0 && !zone.childNodes.length) bas = 1;
            if (bas === 0) return liste.slice(i);
            zone.appendChild(tranche(liste[i], 0, bas));
            const reste = tranche(liste[i], bas, total);
            return (reste.textContent.trim() ? [reste] : []).concat(liste.slice(i + 1));
        }
        return [];
    }

    // =====================================================
    // UNE CARTE
    // =====================================================
    function composantes(sp) {
        const c = sp.comp;
        if (c && typeof c === 'object') {
            return { lettres: [c.v && 'V', c.s && 'S', c.m && 'M'].filter(Boolean).join(', '), mat: c.m ? String(c.mat || '').trim() : '' };
        }
        const res = String(sp.res || '');
        return { lettres: res.split('(')[0].replace(/[\s,]+$/, '').trim(), mat: (res.match(/\(([^)]*)\)/) || [])[1] || '' };
    }

    function carteVide(doc, sp, ligne, edition, suite) {
        const nom = String(sp.name || '').trim();
        const n = niveauDe(sp);
        const art = doc.createElement('article');
        art.className = 'carte' + (suite ? ' est-suite' : '');
        const taille = nom.length > 34 ? 7 : nom.length > 22 ? 8 : 9;
        const tete = `<header class="c-tete"><h2 class="c-nom" style="font-size:${taille}pt">${esc(nom)}</h2>`
            + `<span class="c-niv" title="${esc(niveauTexte(n))}">${n === 0 ? '✦' : n}</span></header>`;
        if (suite) {
            art.innerHTML = tete + '<div class="c-texte"></div>'
                + `<footer class="c-pied"><span>${esc(edition)}</span><span class="c-num"></span></footer>`;
            return art;
        }
        const comp = composantes(sp);
        const badges = [estConcentration(sp) ? '<b class="c-badge">◈ Concentration</b>' : '',
                        estRituel(sp) ? '<b class="c-badge">✧ Rituel</b>' : ''].join('');
        const stat = (t, v) => `<div><dt>${t}</dt><dd>${esc(v || '—')}</dd></div>`;
        art.innerHTML = tete
            + `<p class="c-sous"><span>${esc(ligne)}</span>${badges}</p>`
            + '<dl class="c-stats">' + stat('Incantation', sp.time) + stat('Portée', sp.range)
            + stat('Composantes', comp.lettres) + stat('Durée', sp.duration) + '</dl>'
            + (comp.mat ? `<p class="c-mat">M : ${esc(comp.mat)}</p>` : '')
            + '<div class="c-texte"></div>'
            + `<footer class="c-pied"><span>${esc(edition)}</span><span class="c-num"></span></footer>`;
        return art;
    }

    /** Une ou plusieurs cartes pour un sort, déjà mesurées dans `atelier`. */
    function cartesDu(doc, sp, ligne, edition, atelier) {
        const liste = blocs(doc, sp);
        const premiere = carteVide(doc, sp, ligne, edition, false);
        atelier.appendChild(premiere);
        const zone = premiere.querySelector('.c-texte');
        liste.forEach(b => zone.appendChild(b.cloneNode(true)));
        for (let t = TAILLE_MAX; t >= TAILLE_UNIQUE - 1e-6; t -= PAS) {
            zone.style.fontSize = t.toFixed(1) + 'pt';
            if (tient(zone)) return [premiere];
        }
        const sortie = [];
        let carte = premiere, reste = liste;
        while (reste.length && sortie.length < 40) {
            const z = carte.querySelector('.c-texte');
            z.innerHTML = '';
            z.style.fontSize = TAILLE_SUITE + 'pt';
            reste = remplir(z, reste);
            sortie.push(carte);
            if (reste.length) { carte = carteVide(doc, sp, ligne, edition, true); atelier.appendChild(carte); }
        }
        sortie.forEach((c, i) => { c.querySelector('.c-num').textContent = (i + 1) + '/' + sortie.length; });
        return sortie;
    }

    // =====================================================
    // LES PLANCHES
    // =====================================================
    const CSS = `
        @page { size: A4 portrait; margin: 0; }
        html, body { margin: 0; padding: 0; background: #fff; }
        body { color: #1e1a16; font-family: Georgia, "Times New Roman", serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .atelier { position: absolute; left: 0; top: 0; width: ${CARTE.largeur}mm; }
        .planche { position: relative; width: ${PAGE.largeur}mm; height: ${PAGE.hauteur}mm; overflow: hidden; break-after: page; page-break-after: always; }
        .planche:last-of-type { break-after: auto; page-break-after: auto; }
        .coupe { position: absolute; background: #000; }
        .guide { position: absolute; border: 0 dashed #c9c9c9; }
        .pl-titre { position: absolute; left: ${MARGE_X}mm; right: ${MARGE_X}mm; top: 5mm; margin: 0; text-align: center; font: 7pt/1.2 Arial, Helvetica, sans-serif; color: #777; }
        .pl-attrib { position: absolute; left: ${MARGE_X}mm; right: ${MARGE_X}mm; bottom: 3.2mm; margin: 0; text-align: center; font: 5.2pt/1.3 Arial, Helvetica, sans-serif; color: #666; }
        .pl-attrib b { font-weight: 700; }
        .carte { position: absolute; box-sizing: border-box; width: ${CARTE.largeur}mm; height: ${CARTE.hauteur}mm; padding: 3.3mm 3.5mm 2.7mm; display: flex; flex-direction: column; overflow: hidden; }
        .carte::before { content: ''; position: absolute; inset: 1.5mm; border: .35mm solid #7a2828; border-radius: 2.2mm; }
        .carte::after { content: ''; position: absolute; inset: 2.1mm; border: .12mm solid #c49b35; border-radius: 1.7mm; }
        .c-tete { display: flex; align-items: flex-start; gap: 1.5mm; }
        .c-nom { flex: 1; min-width: 0; margin: 0; font-weight: 700; line-height: 1.08; color: #7a2828; overflow-wrap: anywhere; }
        .carte.est-suite .c-nom::after { content: ' (suite)'; font-weight: 400; font-style: italic; font-size: .82em; }
        .c-niv { flex: 0 0 auto; width: 5.2mm; height: 5.2mm; border-radius: 50%; background: #7a2828; color: #fff; font: 700 7pt/5.2mm Arial, Helvetica, sans-serif; text-align: center; }
        .c-sous { display: flex; flex-wrap: wrap; align-items: center; gap: .7mm 1.3mm; margin: .7mm 0 0; font: italic 6.6pt/1.2 Georgia, serif; color: #5b4a3a; }
        .c-badge { font: normal 700 5.3pt/1 Arial, Helvetica, sans-serif; color: #7a2828; border: .2mm solid #7a2828; border-radius: 3mm; padding: .45mm 1.1mm; }
        .c-stats { display: grid; grid-template-columns: 1fr 1fr; gap: .6mm 1.6mm; margin: 1.3mm 0 0; padding: 1mm 0; border-top: .2mm solid #c49b35; border-bottom: .2mm solid #c49b35; }
        .c-stats div { min-width: 0; }
        .c-stats dt { font: 700 4.8pt/1.1 Arial, Helvetica, sans-serif; text-transform: uppercase; letter-spacing: .05em; color: #7a2828; }
        .c-stats dd { margin: 0; font: 6.3pt/1.15 Georgia, serif; overflow-wrap: anywhere; }
        .c-mat { margin: .8mm 0 0; font: italic 5.8pt/1.2 Georgia, serif; color: #5b4a3a; }
        .c-texte { flex: 1 1 auto; min-height: 0; overflow: hidden; margin-top: 1.2mm; line-height: 1.22; hyphens: auto; -webkit-hyphens: auto; }
        .c-texte p, .c-texte ul, .c-texte ol { margin: 0 0 .9mm; }
        .c-texte ul, .c-texte ol { padding-left: 3.2mm; }
        .c-pied { display: flex; justify-content: space-between; gap: 2mm; margin-top: .8mm; font: 5.2pt/1 Arial, Helvetica, sans-serif; color: #8a7a6a; }
    `;

    /** Traits de coupe dans les marges, et un pointillé discret entre les cartes. */
    function traits() {
        const out = [];
        const long = 5, ecart = 1.8;
        const largeurGrille = COLONNES * CARTE.largeur, hauteurGrille = RANGEES * CARTE.hauteur;
        for (let i = 0; i <= COLONNES; i++) {
            const x = MARGE_X + i * CARTE.largeur;
            out.push(`<i class="coupe" style="left:${x - 0.1}mm;top:${MARGE_Y - ecart - long}mm;width:.2mm;height:${long}mm"></i>`);
            out.push(`<i class="coupe" style="left:${x - 0.1}mm;top:${MARGE_Y + hauteurGrille + ecart}mm;width:.2mm;height:${long}mm"></i>`);
            if (i > 0 && i < COLONNES) out.push(`<i class="guide" style="left:${x}mm;top:${MARGE_Y}mm;height:${hauteurGrille}mm;border-left-width:.15mm"></i>`);
        }
        for (let j = 0; j <= RANGEES; j++) {
            const y = MARGE_Y + j * CARTE.hauteur;
            out.push(`<i class="coupe" style="left:${MARGE_X - ecart - long}mm;top:${y - 0.1}mm;width:${long}mm;height:.2mm"></i>`);
            out.push(`<i class="coupe" style="left:${MARGE_X + largeurGrille + ecart}mm;top:${y - 0.1}mm;width:${long}mm;height:.2mm"></i>`);
            if (j > 0 && j < RANGEES) out.push(`<i class="guide" style="left:${MARGE_X}mm;top:${y}mm;width:${largeurGrille}mm;border-top-width:.15mm"></i>`);
        }
        return out.join('');
    }

    async function preparer(opts) {
        const o = opts || {};
        if (!window.PrintSheet || typeof window.PrintSheet.cadre !== 'function') throw new Error('print-sheet.js non chargé');
        const sorts = selection(o.choix || 'tous', o.idx);
        if (!sorts.length) throw new Error('Aucun sort à imprimer.');
        const ed = window.Edition ? window.Edition.active() : null;
        const edition = window.Edition ? window.Edition.nom(ed) : '';
        const mention = window.Edition ? `<b>${esc(edition)}</b> — ${esc(window.Edition.attribution(ed))}` : '';
        const index = await indexDesSorts();
        const heros = nomHeros();

        const cadre = window.PrintSheet.cadre('Cartes de sorts – ' + heros, CSS);
        const doc = cadre.doc;
        const atelier = doc.createElement('div');
        atelier.className = 'atelier';
        doc.body.appendChild(atelier);
        const cartes = [];
        sorts.forEach(sp => cartes.push(...cartesDu(doc, sp, ligneNiveau(sp, index), edition, atelier)));
        atelier.remove();

        const nb = Math.ceil(cartes.length / PAR_PLANCHE);
        for (let p = 0; p < nb; p++) {
            const planche = doc.createElement('section');
            planche.className = 'planche';
            planche.innerHTML = traits()
                + `<p class="pl-titre">Cartes de sorts · ${esc(heros)} · planche ${p + 1}/${nb}</p>`
                + (mention ? `<p class="pl-attrib">${mention}</p>` : '');
            cartes.slice(p * PAR_PLANCHE, (p + 1) * PAR_PLANCHE).forEach((c, i) => {
                c.style.left = (MARGE_X + (i % COLONNES) * CARTE.largeur) + 'mm';
                c.style.top = (MARGE_Y + Math.floor(i / COLONNES) * CARTE.hauteur) + 'mm';
                planche.appendChild(c);
            });
            doc.body.appendChild(planche);
        }
        await cadre.pret();
        return { doc, cartes: cartes.length, planches: nb, sorts: sorts.length, imprimer: () => cadre.imprimer() };
    }

    // =====================================================
    // LA FENÊTRE DE CHOIX
    // =====================================================
    const STYLE_FENETRE = `
        .cs-liste { margin: 10px 0 0; padding: 8px 10px; border: 1px solid rgba(122, 40, 40, .28); border-radius: 12px; }
        .cs-liste[hidden] { display: none; }
        .cs-liste legend { padding: 0 6px; font-size: .78rem; font-weight: 700; }
        .cs-outils { display: flex; gap: 6px; margin-bottom: 6px; }
        .cs-outils button { min-height: 32px; padding: 4px 10px; border-radius: 999px; border: 1px solid rgba(122, 40, 40, .35); background: transparent; color: inherit; font: inherit; font-size: .8rem; cursor: pointer; }
        .cs-outils button:focus-visible, .cs-sort input:focus-visible { outline: 2px solid var(--accent-color, #C49B35); outline-offset: 2px; }
        .cs-sorts { max-height: min(38vh, 320px); overflow-y: auto; overscroll-behavior: contain; }
        .cs-rang { margin: 8px 0 2px; font-size: .7rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; opacity: .75; }
        .cs-sort { display: flex; align-items: center; gap: 8px; min-height: 32px; font-size: .9rem; cursor: pointer; }
        .cs-sort input { width: 18px; height: 18px; flex: 0 0 auto; accent-color: var(--primary-color, #7A2828); }
        .cs-compte { margin: 8px 2px 0; font-size: .8rem; font-style: italic; opacity: .8; }
    `;
    function poserStyle() {
        if (document.getElementById('cartes-sorts-style')) return;
        const s = document.createElement('style');
        s.id = 'cartes-sorts-style';
        s.textContent = STYLE_FENETRE;
        document.head.appendChild(s);
    }

    async function ouvrir() {
        const tous = grimoire();
        if (!tous.length) {
            await window.Dialogue.informer({ titre: 'Cartes de sorts', icone: '🃏', message: 'Ton grimoire est vide : inscris un sort, puis reviens imprimer ses cartes.' });
            return null;
        }
        poserStyle();
        const prepares = tous.filter(x => estPrepare(x.sp)).length;
        const pluriel = (n) => n + (n > 1 ? ' sorts' : ' sort');
        let boite = null;
        const choix = await window.Dialogue.fenetre({
            titre: 'Cartes de sorts', icone: '🃏', large: true, confirmer: 'Imprimer', annuler: 'Annuler', annule: null,
            message: 'Une planche A4 de 9 cartes (63 × 88 mm). Imprime à 100 % (« taille réelle »), puis découpe le long des traits.',
            corps() {
                boite = document.createElement('div');
                const opt = (v, ico, titre, detail, coche) => `<label class="dlg-choix-opt">
                    <input type="radio" name="cs-choix" value="${v}"${coche ? ' checked' : ''}>
                    <span class="dlg-choix-carte"><span class="dlg-choix-ico" aria-hidden="true">${ico}</span>
                    <span class="dlg-choix-txt"><b>${titre}</b><i>${detail}</i></span></span></label>`;
                let rang = -1;
                const lignes = tous.map(x => {
                    const n = niveauDe(x.sp);
                    const titreRang = n !== rang ? `<p class="cs-rang">${n === 0 ? 'Sorts mineurs' : 'Niveau ' + n}</p>` : '';
                    rang = n;
                    return titreRang + `<label class="cs-sort"><input type="checkbox" value="${x.i}"${estPrepare(x.sp) ? ' checked' : ''}> <span>${esc(x.sp.name)}</span></label>`;
                }).join('');
                boite.innerHTML = `<div class="dlg-choix" role="radiogroup" aria-label="Quels sorts imprimer ?">`
                    + opt('prepares', '✦', 'Les sorts préparés', pluriel(prepares) + ', sorts mineurs compris', prepares > 0)
                    + opt('tous', '📖', 'Tout le grimoire', pluriel(tous.length), prepares === 0)
                    + opt('selection', '☑', 'Une sélection', 'Coche les sorts à imprimer', false)
                    + `</div><fieldset class="cs-liste" hidden><legend>Sorts à imprimer</legend>
                        <div class="cs-outils"><button type="button" data-cs="tout">Tout cocher</button><button type="button" data-cs="rien">Tout décocher</button></div>
                        <div class="cs-sorts">${lignes}</div></fieldset>
                    <p class="cs-compte" aria-live="polite"></p>`;
                const liste = boite.querySelector('.cs-liste');
                const compte = boite.querySelector('.cs-compte');
                const maj = () => {
                    const v = (boite.querySelector('input[name="cs-choix"]:checked') || {}).value;
                    liste.hidden = v !== 'selection';
                    const n = v === 'selection' ? boite.querySelectorAll('.cs-sort input:checked').length
                        : v === 'prepares' ? prepares : tous.length;
                    compte.textContent = n ? `${pluriel(n)} · environ ${Math.max(1, Math.ceil(n / PAR_PLANCHE))} planche${n > PAR_PLANCHE ? 's' : ''} (un texte long ajoute une carte « suite »)` : 'Aucun sort coché.';
                };
                boite.addEventListener('change', maj);
                boite.addEventListener('click', (e) => {
                    const b = e.target.closest('[data-cs]');
                    if (!b) return;
                    boite.querySelectorAll('.cs-sort input').forEach(c => { c.checked = b.dataset.cs === 'tout'; });
                    maj();
                });
                maj();
                return boite;
            },
            resultat(signaler) {
                const v = (boite.querySelector('input[name="cs-choix"]:checked') || {}).value || 'tous';
                if (v !== 'selection') return { choix: v };
                const idx = [...boite.querySelectorAll('.cs-sort input:checked')].map(c => parseInt(c.value, 10));
                if (!idx.length) { signaler('Coche au moins un sort.'); return undefined; }
                return { choix: 'selection', idx };
            }
        });
        if (!choix) return null;
        if (choix.choix === 'prepares' && !prepares) {
            await window.Dialogue.informer({ titre: 'Cartes de sorts', icone: '🃏', message: 'Aucun sort n’est préparé pour l’instant.' });
            return null;
        }
        if (window.showAppToast) window.showAppToast('🃏 Préparation des cartes… choisis « Enregistrer en PDF » pour garder un fichier.', 'info');
        try {
            const r = await preparer(choix);
            r.imprimer();
            return r;
        } catch (e) {
            console.warn('[cartes de sorts]', e);
            if (window.showAppToast) window.showAppToast('⚠️ Les cartes n’ont pas pu être préparées : ' + e.message, 'erreur');
            return null;
        }
    }

    window.CartesSorts = { ouvrir, preparer, selection };
})();
