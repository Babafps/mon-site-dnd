// =====================================================
// carnet.js — PNJ et lieux : mentions @, fiche, portrait (LOT 5.5)
//
// Chargé à la demande : au premier « @ » tapé dans une note, une quête, une
// fiche du carnet ou le journal ; au clic sur une mention ; au clic sur un
// portrait de PNJ.
//
// Le carnet lui-même (listes, champs, aperçus) est dessiné par script.js
// (makeNoteList), qui expose window.SheetCarnet. Ici vivent :
//   · la bulle de suggestions qui s'ouvre après « @ » ;
//   · la fiche d'un PNJ ou d'un lieu, ouverte depuis une mention ;
//   · le choix et la compression du portrait d'un PNJ.
//
// Une mention est enregistrée en TEXTE : « @[Nom](pnj:id) » ou
// « @[Nom](lieu:id) ». Le nom écrit n'est qu'un souvenir : l'affichage relit
// le nom actuel par l'identifiant, et survit donc au renommage. Dans le
// journal (Quill), la mention est un lien « #bb-pnj:id ».
// =====================================================
(function () {
    'use strict';

    const MAX_SUGGESTIONS = 8;
    const PORTRAIT_COTE = 160;            // px
    const PORTRAIT_POIDS = 40000;         // caractères de data: URL visés (~30 Ko)
    const DECLENCHEUR = /(^|[\s(«"'’])@([^\s@\[\]()]{0,30})$/;

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const plier = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const calme = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
    const C = () => window.SheetCarnet;

    // ---------------------------------------------------------------
    // La bulle de suggestions
    // ---------------------------------------------------------------
    let pop = null;
    let etat = null;       // { type: 'zone' | 'quill', cible, debut, fin, options, actif }

    function candidats(requete) {
        const f = plier(requete);
        const out = [];
        const ajouter = (liste, type, detail) => (liste || []).forEach(x => {
            const nom = String((x && x.title) || '').trim();
            if (!nom || !x.id) return;
            if (f && !plier(nom).includes(f)) return;
            out.push({ type, id: x.id, nom, detail: detail(x) });
        });
        ajouter(C().pnj(), 'pnj', x => ['PNJ', x.faction].filter(Boolean).join(' · '));
        ajouter(C().lieux(), 'lieu', x => ['Lieu', x.region].filter(Boolean).join(' · '));
        out.sort((a, b) => (plier(a.nom).startsWith(f) ? 0 : 1) - (plier(b.nom).startsWith(f) ? 0 : 1)
            || a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));
        return out.slice(0, MAX_SUGGESTIONS);
    }

    function fermer() {
        if (etat && etat.type === 'zone' && etat.cible) {
            etat.cible.removeAttribute('aria-activedescendant');
            etat.cible.setAttribute('aria-expanded', 'false');
        }
        etat = null;
        if (pop) { pop.remove(); pop = null; }
        document.removeEventListener('keydown', surTouche, true);
        window.removeEventListener('resize', fermer);
    }

    function rendrePop() {
        if (!pop || !etat) return;
        pop.innerHTML = etat.options.length
            ? etat.options.map((o, i) => `<div role="option" id="mention-opt-${i}" class="mention-opt${i === etat.actif ? ' is-active' : ''}" aria-selected="${i === etat.actif}" data-i="${i}">
                    <span class="mention-opt-ico" aria-hidden="true">${o.type === 'pnj' ? '👤' : '🏰'}</span>
                    <span class="mention-opt-txt"><b>@${esc(o.nom)}</b><small>${esc(o.detail)}</small></span></div>`).join('')
            : '<div class="mention-vide">Aucun PNJ ni lieu ne correspond. Ajoute-le dans « Quêtes, PNJ &amp; lieux ».</div>';
        if (etat.type === 'zone') {
            if (etat.options.length) etat.cible.setAttribute('aria-activedescendant', 'mention-opt-' + etat.actif);
            else etat.cible.removeAttribute('aria-activedescendant');
        }
        const actif = pop.querySelector('.mention-opt.is-active');
        if (actif && actif.scrollIntoView) actif.scrollIntoView({ block: 'nearest' });
    }

    function montrer(rect) {
        if (!pop) {
            pop = document.createElement('div');
            pop.id = 'carnet-mentions';
            pop.className = 'mention-pop no-print';
            pop.setAttribute('role', 'listbox');
            pop.setAttribute('aria-label', 'PNJ et lieux à mentionner');
            // Garder le focus dans le champ : un clic dans la bulle ne doit pas le lui voler.
            pop.addEventListener('pointerdown', (e) => e.preventDefault());
            pop.addEventListener('click', (e) => {
                const o = e.target.closest('.mention-opt');
                if (o) choisir(parseInt(o.dataset.i, 10));
            });
            document.body.appendChild(pop);
            document.addEventListener('keydown', surTouche, true);
            window.addEventListener('resize', fermer);
        }
        const largeur = Math.min(320, window.innerWidth - 16);
        pop.style.width = largeur + 'px';
        pop.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - largeur - 8)) + 'px';
        const dessous = window.innerHeight - rect.bottom;
        if (dessous < 230 && rect.top > dessous) { pop.style.top = 'auto'; pop.style.bottom = (window.innerHeight - rect.top + 4) + 'px'; }
        else { pop.style.bottom = 'auto'; pop.style.top = (rect.bottom + 4) + 'px'; }
        if (etat.type === 'zone') {
            etat.cible.setAttribute('aria-expanded', 'true');
            etat.cible.setAttribute('aria-controls', 'carnet-mentions');
            etat.cible.setAttribute('aria-autocomplete', 'list');
        }
        rendrePop();
    }

    function surTouche(e) {
        if (!etat) return;
        const dansCible = etat.type === 'zone' ? e.target === etat.cible : !!(e.target.closest && e.target.closest('.ql-editor'));
        if (!dansCible) return;
        const n = etat.options.length;
        const bloquer = () => { e.preventDefault(); e.stopPropagation(); };
        if (e.key === 'ArrowDown' && n) { bloquer(); etat.actif = (etat.actif + 1) % n; rendrePop(); }
        else if (e.key === 'ArrowUp' && n) { bloquer(); etat.actif = (etat.actif - 1 + n) % n; rendrePop(); }
        else if ((e.key === 'Enter' || e.key === 'Tab') && n) { bloquer(); choisir(etat.actif); }
        else if (e.key === 'Escape') { bloquer(); fermer(); }
    }

    /** Un « @ » vient d'être tapé (ou la saisie continue) dans une zone de texte. */
    function surSaisie(zone) {
        if (!zone || zone.tagName !== 'TEXTAREA') return;
        if (!zone.dataset.mentionsBranche) {
            zone.dataset.mentionsBranche = '1';
            zone.addEventListener('blur', () => setTimeout(() => { if (etat && etat.cible === zone) fermer(); }, 150));
        }
        const pos = zone.selectionStart;
        if (pos == null || pos !== zone.selectionEnd) { fermer(); return; }
        const m = DECLENCHEUR.exec(zone.value.slice(0, pos));
        if (!m) { if (etat && etat.cible === zone) fermer(); return; }
        etat = { type: 'zone', cible: zone, debut: pos - m[2].length - 1, fin: pos, options: candidats(m[2]), actif: 0 };
        montrer(zone.getBoundingClientRect());
    }

    /** Même chose dans un éditeur Quill (journal). */
    function surQuill(q) {
        if (!q) return;
        if (!q.__mentionsBranche) {
            q.__mentionsBranche = true;
            q.on('selection-change', (r) => { if (!r) setTimeout(() => { if (etat && etat.cible === q) fermer(); }, 150); });
        }
        const sel = q.getSelection();
        if (!sel || sel.length) { fermer(); return; }
        const depuis = Math.max(0, sel.index - 40);
        const m = DECLENCHEUR.exec(q.getText(depuis, sel.index - depuis));
        if (!m) { if (etat && etat.cible === q) fermer(); return; }
        const b = q.getBounds(sel.index);
        const r = q.root.getBoundingClientRect();
        etat = { type: 'quill', cible: q, debut: sel.index - m[2].length - 1, fin: sel.index, options: candidats(m[2]), actif: 0 };
        montrer({ left: r.left + b.left, top: r.top + b.top, bottom: r.top + b.top + b.height });
    }

    function choisir(i) {
        const o = etat && etat.options[i];
        if (!o) return;
        const nom = o.nom.replace(/[\[\]\n]/g, ' ').slice(0, 80);
        if (etat.type === 'zone') {
            const z = etat.cible, v = z.value;
            const jeton = `@[${nom}](${o.type}:${o.id}) `;
            const debut = etat.debut, fin = etat.fin;
            fermer();
            z.value = v.slice(0, debut) + jeton + v.slice(fin);
            const p = debut + jeton.length;
            z.setSelectionRange(p, p);
            z.focus();
            z.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            const q = etat.cible, debut = etat.debut, longueur = etat.fin - etat.debut;
            const texte = '@' + nom;
            fermer();
            q.deleteText(debut, longueur, 'user');
            q.insertText(debut, texte, { link: '#bb-' + o.type + ':' + o.id }, 'user');
            q.insertText(debut + texte.length, ' ', { link: false }, 'user');
            q.setSelection(debut + texte.length + 1, 0, 'user');
        }
    }

    // ---------------------------------------------------------------
    // La fiche d'un PNJ ou d'un lieu
    // ---------------------------------------------------------------
    function dateLisible(iso) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
        if (!m) return '';
        try { return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
        catch (e) { return iso; }
    }

    async function ouvrirFiche(type, id) {
        const S = C();
        if (!S) return false;
        const estPnj = type === 'pnj';
        const x = (estPnj ? S.pnj() : S.lieux()).find(e => e && e.id === id);
        if (!x) {
            await window.Dialogue.informer({ titre: 'Fiche introuvable', type: 'erreur',
                message: estPnj ? 'Ce PNJ a été retiré du carnet.' : 'Ce lieu a été retiré du carnet.' });
            return false;
        }
        const nom = String(x.title || '').trim() || (estPnj ? 'PNJ sans nom' : 'Lieu sans nom');
        const ligne = (label, valeur) => valeur ? `<div class="carnet-fiche-ligne"><dt>${esc(label)}</dt><dd>${esc(valeur)}</dd></div>` : '';
        const aller = await window.Dialogue.fenetre({
            titre: nom, icone: estPnj ? '👤' : '🏰', confirmer: 'Voir dans le carnet', annuler: 'Fermer', annule: false,
            corps() {
                const d = document.createElement('div');
                d.className = 'carnet-fiche';
                const portrait = estPnj ? S.portraits()[x.id] : null;
                const att = estPnj ? S.attitude(x.attitude) : null;
                d.innerHTML = (portrait || att
                        ? `<div class="carnet-fiche-tete">${portrait ? `<img class="carnet-fiche-portrait" src="${esc(portrait)}" alt="Portrait de ${esc(nom)}">` : ''}
                            ${att ? `<span class="pnj-attitude a-${esc(att.cle)}">${esc(att.nom)}</span>` : ''}</div>`
                        : '')
                    + '<dl class="carnet-fiche-liste">'
                    + (estPnj
                        ? ligne('Faction', x.faction)
                          + ligne('Dernière rencontre', [dateLisible(x.rencontreDate), x.rencontreLieu].filter(Boolean).join(' — '))
                        : ligne('Région', x.region) + ligne('Type', x.type) + ligne('Visité le', dateLisible(x.visite)))
                    + '</dl>'
                    + (String(x.body || '').trim()
                        ? `<div class="carnet-fiche-notes">${S.rendre(x.body, { liens: false })}</div>`
                        : '<p class="compact-empty">Pas encore de notes.</p>');
                return d;
            },
            resultat: () => true
        });
        if (aller) S.allerA(type, id);
        return true;
    }

    // ---------------------------------------------------------------
    // Le portrait d'un PNJ : recadré au carré, réduit, en JPEG
    // ---------------------------------------------------------------
    function compresser(fichier) {
        return new Promise((tenir, rompre) => {
            if (!fichier || !/^image\//.test(fichier.type || '')) { rompre(new Error('Ce fichier n’est pas une image.')); return; }
            const url = URL.createObjectURL(fichier);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                const toile = document.createElement('canvas');
                toile.width = toile.height = PORTRAIT_COTE;
                const ctx = toile.getContext('2d');
                const cote = Math.min(img.naturalWidth, img.naturalHeight);
                // Un portrait se cadre plutôt vers le haut : c'est là qu'est le visage.
                const sx = (img.naturalWidth - cote) / 2;
                const sy = Math.max(0, (img.naturalHeight - cote) * 0.25);
                ctx.fillStyle = '#F5EDDA';
                ctx.fillRect(0, 0, PORTRAIT_COTE, PORTRAIT_COTE);
                ctx.drawImage(img, sx, sy, cote, cote, 0, 0, PORTRAIT_COTE, PORTRAIT_COTE);
                let qualite = 0.8, src = toile.toDataURL('image/jpeg', qualite);
                while (src.length > PORTRAIT_POIDS && qualite > 0.4) { qualite -= 0.1; src = toile.toDataURL('image/jpeg', qualite); }
                tenir(src);
            };
            img.onerror = () => { URL.revokeObjectURL(url); rompre(new Error('Cette image n’a pas pu être lue.')); };
            img.src = url;
        });
    }

    function choisirFichier(id) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', () => {
            const f = input.files && input.files[0];
            if (!f) return;
            compresser(f).then(src => {
                C().poserPortrait(id, src);
                if (window.showAppToast) window.showAppToast('🖼️ Portrait enregistré', 'reussite');
            }).catch(err => window.Dialogue.informer({ titre: 'Portrait', type: 'erreur', message: err.message }));
        });
        input.click();
    }

    async function portrait(id) {
        const S = C();
        if (!S) return;
        const actuel = S.portraits()[id];
        if (!actuel) { choisirFichier(id); return; }
        const v = await window.Dialogue.choisir({
            titre: 'Portrait du PNJ', icone: '🖼️', confirmer: 'Valider',
            options: [
                { valeur: 'changer', ico: '📷', titre: 'Changer d’image', detail: 'Recadrée au carré et réduite pour tenir dans la fiche.' },
                { valeur: 'retirer', ico: '✖', titre: 'Retirer le portrait' }
            ]
        });
        if (v === 'changer') choisirFichier(id);
        else if (v === 'retirer') {
            S.poserPortrait(id, null);
            if (window.showUndoToast) window.showUndoToast('Portrait retiré', () => S.poserPortrait(id, actuel));
        }
    }

    window.Carnet = { surSaisie, surQuill, fermer, ouvrirFiche, portrait, compresser, candidats };
})();
