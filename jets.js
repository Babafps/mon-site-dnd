// =====================================================
// jets.js — la carte de résultat et l'historique des jets (LOT 4.1 et 4.2)
//
// UNE carte pour tous les jets : caractéristique, compétence, sauvegarde,
// initiative, attaque, sort, dégâts, expression, d20 rapide, dés de vie…
// Elle montre le dé gardé et le dé écarté barré, le détail des bonus tel que
// le moteur de calcul le donne (calcul.js), un total qui défile, et habille
// le 20 et le 1 naturels — sans émojis.
//
// Ce module ne lance aucun dé. script.js lance (3D ou repli), décrit le jet,
// le consigne, puis appelle `Jets.montrer(jet)`. « Relancer » repasse la main
// à la fiche : `window.SheetRolls.relancer(jet.rejouer)`.
//
// Un jet décrit :
//   {
//     type: 'competence', titre: 'Discrétion', sousTitre: 'Test de compétence',
//     d20: { mode: 'adv', des: [12, 7], garde: 12, bonus: 5, seuilCritique: 20,
//            sources: [{ libelle: 'DEX', valeur: 3, origine: 'carac' }, …] },
//     lancer: { etiquette: 'Dégâts', nature: 'degats', total: 9,
//               lignes: [{ libelle, expr: '1d8+3', total: 9, type: 'tranchant',
//                          groupes: [{ signe: 1, faces: 8, des: [6] }], fixe: 3 }] },
//     total: 17, critique: false, echec: false,
//     notes: ['…'], avertissements: ['…'], edition: '2024',
//     rejouer: { t: 'lancable', cible: 'skill-val-stealth', nom: 'Discrétion', jet: 'competence', mode: 'adv' }
//   }
//
// L'historique (clé de fiche `dnd-roll-history`, 100 lignes) garde pour
// chaque jet les champs d'avant — name, total, detail, nat, ts : une version
// plus ancienne du site, sur un autre appareil, le lit toujours — et, dans
// `jet`, cette forme rejouable, sans les sources nommées (le détail texte les
// résume, et l'historique voyage avec la fiche).
//
// Chargé à la demande (charger.js) : rien au premier affichage.
// =====================================================
(function () {
    'use strict';

    const HISTORIQUE_MAX = 100;
    const CLE_FILTRE = 'dnd-historique-filtre';
    const MAX_PUCES = 40;                     // au-delà, « +N » : 20d6 tiennent encore

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const calme = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
    const signe = (n) => (n < 0 ? '−' : '+') + Math.abs(n);
    const entier = (v) => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };
    const MODE = { adv: 'Avantage', dis: 'Désavantage' };

    // ---------- Les types de jets ----------
    // `familles` : les filtres de l'historique où le jet apparaît.
    // `attaque`  : un 20 ou un 1 y est un coup critique ou un échec critique ;
    //              ailleurs, on dit simplement « 20 naturel » / « 1 naturel ».
    const TYPES = {
        carac:        { sur: 'Test de caractéristique', familles: ['competences'] },
        competence:   { sur: 'Test de compétence', familles: ['competences'] },
        initiative:   { sur: 'Initiative', familles: ['competences'] },
        sauvegarde:   { sur: 'Jet de sauvegarde', familles: ['sauvegardes'] },
        mort:         { sur: 'Jet de sauvegarde contre la mort', familles: ['sauvegardes'] },
        attaque:      { sur: 'Attaque', familles: ['attaques'], attaque: true },
        sort:         { sur: 'Sort', familles: ['sorts'], attaque: true },
        degats:       { sur: 'Dégâts', familles: ['degats'] },
        expression:   { sur: 'Expression', familles: ['expressions'] },
        plateau:      { sur: 'Plateau de dés', familles: ['expressions'] },
        d20:          { sur: 'Jet rapide', familles: [] },
        'des-de-vie': { sur: 'Repos court', familles: [] }
    };

    const FILTRES = [
        { id: 'tout', nom: 'Tout' },
        { id: 'attaques', nom: 'Attaques' },
        { id: 'sauvegardes', nom: 'Sauvegardes' },
        { id: 'competences', nom: 'Compétences', aide: 'Tests de caractéristique, de compétence et d’initiative' },
        { id: 'degats', nom: 'Dégâts' },
        { id: 'sorts', nom: 'Sorts' },
        { id: 'expressions', nom: 'Expressions', aide: 'Expressions, macros et plateau de dés' }
    ];

    /** Les filtres où apparaît une ligne d'historique. */
    function familles(h) {
        const j = h && h.jet;
        if (j && TYPES[j.type]) {
            const f = TYPES[j.type].familles.slice();
            if (j.lancer && j.lancer.nature === 'degats' && f.indexOf('degats') === -1) f.push('degats');
            return f;
        }
        // Jets consignés avant la forme rejouable : rangés d'après leur libellé.
        const nom = String((h && h.name) || ''), detail = String((h && h.detail) || '');
        const f = [];
        if (/^⚔/.test(nom)) f.push('attaques');
        else if (/^✨/.test(nom)) f.push('sorts');
        else if (/^🎲/.test(nom)) f.push('expressions');
        else if (/sauvegarde|contre la mort|concentration/i.test(nom)) f.push('sauvegardes');
        else if (/^d20 :/.test(detail) && nom !== 'Jet rapide') f.push('competences');
        if (/dégâts/i.test(detail) || /\(dégâts\)/.test(nom)) f.push('degats');
        return f;
    }

    /** « Coup critique », « 20 naturel »… ou rien. */
    function bandeau(j) {
        if (!j || !j.d20) return '';
        const attaque = !!(TYPES[j.type] || {}).attaque;
        if (j.critique) return attaque ? 'Coup critique' : '20 naturel';
        if (j.echec) return attaque ? 'Échec critique' : '1 naturel';
        return '';
    }

    // =====================================================
    // LA CARTE
    // =====================================================
    let carte = null, annonce = null, minuteur = null, animation = null, filet = null;

    function construire() {
        if (carte && carte.isConnected) return carte;
        carte = document.createElement('section');
        carte.id = 'carte-jet';
        carte.className = 'cj no-print';
        carte.hidden = true;
        carte.setAttribute('aria-labelledby', 'cj-titre');
        carte.addEventListener('click', (e) => { if (e.target.closest('.cj-fermer')) fermer(); });
        carte.addEventListener('mouseenter', suspendre);
        carte.addEventListener('mouseleave', reprendre);
        carte.addEventListener('focusin', suspendre);
        carte.addEventListener('focusout', (e) => { if (!carte.contains(e.relatedTarget)) reprendre(); });
        document.body.appendChild(carte);

        // Ce qu'entend un lecteur d'écran : UNE phrase, le total final — pas
        // les chiffres qui défilent.
        annonce = document.createElement('div');
        annonce.className = 'cj-annonce no-print';
        annonce.setAttribute('aria-live', 'polite');
        annonce.setAttribute('aria-atomic', 'true');
        document.body.appendChild(annonce);
        return carte;
    }

    // Échap ferme la carte avant tout le reste (le livre, une fenêtre) — mais
    // jamais une fenêtre de dialogue ouverte par-dessus.
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || !carte || carte.hidden) return;
        if (document.querySelector('.dlg-voile')) return;
        e.stopPropagation();
        fermer();
    }, true);

    function planifier(ms) {
        clearTimeout(minuteur);
        minuteur = setTimeout(fermer, ms);
    }
    function suspendre() { clearTimeout(minuteur); }
    function reprendre() {
        if (!carte || carte.hidden) return;
        if (carte.matches(':hover') || carte.contains(document.activeElement)) return;
        planifier(2500);
    }

    function fermer() {
        clearTimeout(minuteur);
        cancelAnimationFrame(animation);
        clearTimeout(filet);
        if (!carte || carte.hidden) return;
        const focusDedans = carte.contains(document.activeElement);
        carte.hidden = true;
        if (focusDedans && document.activeElement) document.activeElement.blur();
    }

    function montrer(j) {
        if (!j) return;
        const c = construire();
        clearTimeout(minuteur);
        cancelAnimationFrame(animation);
        clearTimeout(filet);
        const b = bandeau(j);
        c.className = 'cj no-print cj-t-' + String(j.type || 'jet').replace(/[^\w-]/g, '')
            + (b && j.critique ? ' is-critique' : '') + (b && j.echec ? ' is-echec' : '');
        c.innerHTML = corps(j, b);
        c.hidden = false;
        void c.offsetWidth;                   // relance l'animation d'entrée
        c.classList.add('cj-entre');
        defiler(c);
        annonce.textContent = '';
        setTimeout(() => { if (annonce) annonce.textContent = phrase(j, b); }, 80);
        planifier(j.lancer || (j.notes && j.notes.length) || (j.avertissements && j.avertissements.length) ? 8000 : 6500);
    }

    function corps(j, b) {
        const t = TYPES[j.type] || {};
        const sur = [j.sousTitre || t.sur, j.d20 && MODE[j.d20.mode]].filter(Boolean).join(' · ');
        let h = '<button type="button" class="cj-fermer" aria-label="Fermer le résultat" title="Fermer (Échap)">✕</button>';
        if (sur) h += `<p class="cj-sur">${esc(sur)}</p>`;
        h += `<h2 class="cj-titre" id="cj-titre">${esc(j.titre || 'Jet')}</h2>`;
        if (b) h += `<p class="cj-bandeau"><span>${esc(b)}</span></p>`;
        if (j.d20) h += blocD20(j);
        if (j.lancer) h += blocLancer(j.lancer, !j.d20);
        const notes = (j.avertissements || []).map(n => `<li class="cj-avert">${esc(n)}</li>`)
            .concat((j.notes || []).map(n => `<li>${esc(n)}</li>`));
        if (notes.length) h += `<ul class="cj-notes">${notes.join('')}</ul>`;
        return h;
    }

    /** L'indice du dé gardé parmi les dés lancés (le premier, à égalité). */
    const indiceGarde = (d) => Math.max(0, (d.des || []).indexOf(d.garde));

    function blocD20(j) {
        const d = j.d20;
        const ig = indiceGarde(d);
        const puces = (d.des || []).map((v, i) =>
            `<span class="cj-de cj-d20 ${i === ig ? 'is-garde' : 'is-ecarte'}"><span>${esc(v)}</span></span>`).join('');
        let sources = (d.sources || [])
            .filter(s => s.origine === 'carac' || s.valeur !== 0)
            .map(s => `<li class="cj-src o-${esc(s.origine || 'effet')}"><b>${signe(s.valeur)}</b> ${esc(s.libelle)}</li>`).join('');
        // Sans sources nommées (valeur saisie à la main) : le bonus seul.
        if (!sources && entier(d.bonus)) sources = `<li class="cj-src"><b>${signe(entier(d.bonus))}</b> bonus</li>`;
        return '<div class="cj-jet">'
            + `<div class="cj-des" aria-hidden="true">${puces}</div>`
            + (sources ? `<ul class="cj-sources" aria-hidden="true">${sources}</ul>` : '')
            + `<span class="cj-total" aria-hidden="true" data-total="${entier(j.total)}">${entier(j.total)}</span>`
            + '</div>';
    }

    function blocLancer(l, principal) {
        const lignes = l.lignes || [];
        let puces = 0;
        const html = lignes.map(li => {
            if (li.erreur) return `<div class="cj-ligne is-erreur">${esc(li.erreur)}</div>`;
            const des = (li.groupes || []).map(g => {
                const valeurs = (g.des || []).slice(0, Math.max(0, MAX_PUCES - puces));
                puces += valeurs.length;
                const reste = (g.des || []).length - valeurs.length;
                return (g.signe < 0 ? '<span class="cj-signe">−</span>' : '')
                    + valeurs.map(v => `<span class="cj-de cj-d${entier(g.faces)}"><span>${esc(v)}</span></span>`).join('')
                    + (reste > 0 ? `<span class="cj-reste">+${reste} d${entier(g.faces)}</span>` : '');
            }).join('');
            return '<div class="cj-ligne">'
                + (li.libelle ? `<span class="cj-lib">${esc(li.libelle)}</span>` : '')
                + (des ? `<span class="cj-des">${des}</span>` : '')
                + (entier(li.fixe) ? `<span class="cj-fixe">${signe(entier(li.fixe))}</span>` : '')
                + (li.type ? `<span class="cj-type">${esc(li.type)}</span>` : '')
                + (lignes.length > 1 ? `<b class="cj-sous-total">${entier(li.total)}</b>` : '')
                + '</div>';
        }).join('');
        const nature = String(l.nature || 'resultat').replace(/[^\w-]/g, '');
        return `<div class="cj-lancer cj-n-${nature}${principal ? ' is-principal' : ''}">`
            + `<span class="cj-etiquette">${esc(l.etiquette || 'Résultat')}</span>`
            + `<div class="cj-lignes" aria-hidden="true">${html}</div>`
            + `<span class="cj-total${principal ? '' : ' cj-total-lancer'}" aria-hidden="true" data-total="${entier(l.total)}">${entier(l.total)}</span>`
            + '</div>';
    }

    /** Le total défile jusqu'à sa valeur ; immobile sous mouvement réduit. */
    function defiler(c) {
        const cibles = [...c.querySelectorAll('.cj-total[data-total]')];
        if (!cibles.length || calme()) return;
        const fin = cibles.map(el => entier(el.dataset.total));
        const figer = () => cibles.forEach((el, i) => { el.textContent = String(fin[i]); });
        const t0 = performance.now(), duree = 650;
        const pas = (t) => {
            const p = Math.min(1, (t - t0) / duree);
            const e = 1 - Math.pow(1 - p, 3);
            cibles.forEach((el, i) => { el.textContent = String(Math.round(fin[i] * e)); });
            if (p < 1) animation = requestAnimationFrame(pas); else figer();
        };
        cibles.forEach(el => { el.textContent = '0'; });
        animation = requestAnimationFrame(pas);
        // Onglet en arrière-plan : requestAnimationFrame ne tourne pas, le total
        // ne doit pas rester à zéro pour autant.
        filet = setTimeout(figer, duree + 150);
    }

    /** La phrase lue par un lecteur d'écran. */
    function phrase(j, b) {
        const bouts = [`${j.titre || 'Jet'} : ${entier(j.total)}`];
        if (b) bouts.push(b);
        if (j.d20) {
            const d = j.d20, ig = indiceGarde(d);
            const autres = (d.des || []).filter((v, i) => i !== ig);
            bouts.push(`d20 ${d.garde}` + (autres.length ? `, ${autres[0]} écarté` : '')
                + (MODE[d.mode] ? ` (${MODE[d.mode].toLowerCase()})` : ''));
            const src = (d.sources || []).filter(s => s.valeur !== 0)
                .map(s => `${s.valeur < 0 ? 'moins' : 'plus'} ${Math.abs(s.valeur)} ${s.libelle}`);
            if (src.length) bouts.push(src.join(', '));
        }
        if (j.lancer && j.d20) bouts.push(`${j.lancer.etiquette || 'Résultat'} : ${entier(j.lancer.total)}`);
        (j.avertissements || []).concat(j.notes || []).forEach(n => bouts.push(n));
        return bouts.join('. ').replace(/\.\./g, '.') + '.';
    }

    // =====================================================
    // L'HISTORIQUE
    // =====================================================
    const lireFiltre = () => {
        try { const f = localStorage.getItem(CLE_FILTRE); return FILTRES.some(x => x.id === f) ? f : 'tout'; }
        catch (e) { return 'tout'; }
    };
    let filtre = lireFiltre();
    let affiche = { hist: [], liste: null };

    function heure(ts) {
        const t = new Date(ts);
        if (isNaN(t.getTime())) return '';
        return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
    }

    function ligne(h, i) {
        const cls = h.nat === 20 ? ' is-crit' : (h.nat === 1 ? ' is-fumble' : '');
        const rejouable = !!(h.jet && h.jet.rejouer);
        const type = h.jet && h.jet.type ? ` data-type="${esc(h.jet.type)}"` : '';
        return `<div class="roll-history-item${cls}"${type}>`
            + `<span class="rh-name">${esc(h.name)}<span class="rh-detail"> — ${esc(h.detail || '')}</span></span>`
            + `<span class="rh-total">${esc(h.total)}</span>`
            + `<span class="rh-detail">${heure(h.ts)}</span>`
            + (rejouable ? `<button type="button" class="rh-relancer" data-rh-relancer="${i}" title="Relancer" aria-label="Relancer : ${esc(h.name)}">↻</button>` : '')
            + '</div>';
    }

    function rendreFiltres(barre) {
        if (!barre.dataset.rhBranche) {
            barre.dataset.rhBranche = '1';
            barre.innerHTML = FILTRES.map(f =>
                `<button type="button" class="rh-filtre" data-rh-filtre="${f.id}" aria-pressed="false"${f.aide ? ` title="${esc(f.aide)}"` : ''}>${esc(f.nom)}</button>`).join('');
            barre.addEventListener('click', (e) => {
                const b = e.target.closest('[data-rh-filtre]');
                if (!b) return;
                filtre = b.dataset.rhFiltre;
                try { localStorage.setItem(CLE_FILTRE, filtre); } catch (err) {}
                rendreHistorique(affiche.hist, affiche.liste);
            });
        }
        // On retouche les boutons plutôt que de les redessiner : le focus clavier reste en place.
        barre.querySelectorAll('[data-rh-filtre]').forEach(b => {
            const on = b.dataset.rhFiltre === filtre;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }

    function rendreHistorique(hist, liste) {
        if (!liste) return;
        affiche = { hist: Array.isArray(hist) ? hist : [], liste };
        const bloc = liste.closest('.roll-history-block');
        const barre = bloc && bloc.querySelector('.rh-filtres');
        if (barre) rendreFiltres(barre);
        if (!liste.dataset.rhBranche) {
            liste.dataset.rhBranche = '1';
            liste.addEventListener('click', (e) => {
                const b = e.target.closest('[data-rh-relancer]');
                if (!b) return;
                const h = affiche.hist[entier(b.dataset.rhRelancer)];
                if (!h || !h.jet || !h.jet.rejouer) return;
                if (window.SheetRolls && typeof window.SheetRolls.relancer === 'function') window.SheetRolls.relancer(h.jet.rejouer);
            });
        }
        if (!affiche.hist.length) { liste.innerHTML = '<div class="roll-history-empty">Aucun jet pour l’instant.</div>'; return; }
        const lignes = affiche.hist.map((h, i) => ({ h, i }))
            .filter(({ h }) => h && (filtre === 'tout' || familles(h).indexOf(filtre) !== -1));
        liste.innerHTML = lignes.length
            ? lignes.map(({ h, i }) => ligne(h, i)).join('')
            : '<div class="roll-history-empty">Aucun jet de ce type pour l’instant.</div>';
    }

    window.Jets = {
        HISTORIQUE_MAX, TYPES, FILTRES,
        montrer, fermer, rendreHistorique, familles, bandeau, phrase,
        visible: () => !!(carte && !carte.hidden)
    };
})();
