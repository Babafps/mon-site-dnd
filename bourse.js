// =====================================================
// bourse.js — l'historique de la Bourse, l'achat et la vente (LOT 5.1, 5.2)
//
// Chargé à la demande (charger('bourse')) : au premier clic sur 📜 Historique,
// sur 💰 Vendre, ou quand un objet des règles arrive dans le sac avec un prix.
//
// Les pièces et le journal des opérations vivent dans script.js
// (window.SheetBourse) : chaque paiement y est consigné au moment même où il
// a lieu, que ce module soit chargé ou non. Ici, on AFFICHE ce journal et on
// sait le défaire.
//
// Règles lues pour la vente (rules.json) :
//   · 2014 (SRD 5.1)   « Armes, armures et autre équipement » : moitié du prix ;
//                      « Gemmes, bijoux et œuvres d'art » et « Troc » : pleine valeur.
//   · 2024 (SRD 5.2.1) « Vente d'équipement » : moitié du prix d'achat ; objets
//                      de valeur, pierres précieuses, objets d'art et biens
//                      commerciaux gardent toute leur valeur.
// =====================================================
(function () {
    'use strict';

    const PIECES = ['pp', 'po', 'pe', 'pa', 'pc'];
    const VALEUR = { pc: 1, pa: 10, pe: 50, po: 100, pp: 1000 };
    const TYPES = {
        paiement:   { ico: '➖', nom: 'Paiement' },
        ajout:      { ico: '➕', nom: 'Ajout' },
        conversion: { ico: '⚖️', nom: 'Conversion' },
        achat:      { ico: '🛒', nom: 'Achat' },
        vente:      { ico: '💰', nom: 'Vente' }
    };
    const REGLES = {
        '2014': {
            moitie: 'SRD 5.1, « Armes, armures et autre équipement » : ils se revendent à la moitié de leur prix.',
            plein: 'SRD 5.1, « Gemmes, bijoux et œuvres d’art » et « Troc » : ils conservent leur pleine valeur.'
        },
        '2024': {
            moitie: 'SRD 5.2.1, « Vente d’équipement » : l’équipement se vend à la moitié de son prix d’achat.',
            plein: 'SRD 5.2.1, « Vente d’équipement » : objets d’art, pierres précieuses et biens commerciaux gardent toute leur valeur.'
        }
    };

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const B = () => window.SheetBourse;
    const toast = (m, t) => { if (window.showAppToast) window.showAppToast(m, t); };
    const fmt = (c) => B().format(c);

    /** « 25 po », « 3 000 po », « 1,5 pa » → valeur en cuivre. « variable » → null. */
    function lirePrix(texte) {
        // Les données écrivent « 3 000 po » avec une espace fine insécable.
        const m = /^\s*(\d[\d\s\u00a0\u202f]*(?:[.,]\d+)?)\s*(pc|pa|pe|po|pp)\b/i.exec(String(texte == null ? '' : texte));
        if (!m) return null;
        const n = parseFloat(m[1].replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));
        return Number.isFinite(n) ? Math.round(n * VALEUR[m[2].toLowerCase()]) : null;
    }

    const memes = (a, b) => PIECES.every(p => (a[p] || 0) === (b[p] || 0));
    const enCuivre = (o) => PIECES.reduce((s, p) => s + (o[p] || 0) * VALEUR[p], 0);

    // ---------------------------------------------------------------
    // L'historique
    // ---------------------------------------------------------------
    const boite = () => document.getElementById('bourse-historique');
    const bouton = () => document.getElementById('btn-bourse-historique');

    function montant(op) {
        if (op.type === 'conversion' || !op.cuivre) return '±0';
        return (op.cuivre < 0 ? '−' : '+') + fmt(Math.abs(op.cuivre));
    }
    function quand(ts) {
        try { return new Date(ts).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
        catch (e) { return ''; }
    }

    function rendre() {
        const box = boite(); if (!box || box.hidden) return;
        const hist = B().historique();
        box.innerHTML = `<div class="bourse-historique-tete">
                <span class="sub-section-title">Dernières opérations</span>
                <button type="button" class="btn-small" data-bourse="annuler"${hist.length ? '' : ' disabled'}>↩ Annuler la dernière</button>
            </div>`
            + (hist.length
                ? `<ol class="bourse-ops">${hist.map(op => {
                    const t = TYPES[op.type] || { ico: '•', nom: op.type };
                    const d = new Date(op.ts);
                    return `<li class="bourse-op t-${esc(op.type)}">
                        <span class="bourse-op-ico" aria-hidden="true">${t.ico}</span>
                        <span class="bourse-op-txt"><b>${esc(t.nom)}</b>${op.libelle ? ` <i>${esc(op.libelle)}</i>` : ''}
                            <time datetime="${isNaN(d) ? '' : d.toISOString()}">${esc(quand(op.ts))}</time></span>
                        <span class="bourse-op-montant${op.cuivre < 0 ? ' is-moins' : (op.cuivre > 0 ? ' is-plus' : '')}">${esc(montant(op))}</span>
                    </li>`;
                }).join('')}</ol>`
                : '<p class="compact-empty">Aucune opération pour l’instant. Payer, ajouter, convertir, acheter ou vendre : tout s’inscrit ici.</p>');
    }

    function basculer(ouvrir) {
        const box = boite(), btn = bouton(); if (!box) return;
        const on = typeof ouvrir === 'boolean' ? ouvrir : box.hidden;
        box.hidden = !on;
        if (btn) btn.setAttribute('aria-expanded', on ? 'true' : 'false');
        if (on) rendre();
    }

    // ---------------------------------------------------------------
    // Défaire la dernière opération
    // ---------------------------------------------------------------
    function decrire(op) {
        const t = TYPES[op.type] || { nom: op.type };
        return t.nom + (op.libelle ? ' « ' + op.libelle + ' »' : '') + ' (' + montant(op) + ')';
    }

    /** o : { id } pour n'annuler QUE cette opération ; { confirmer: false } pour sauter la question. */
    async function annulerDerniere(o) {
        const opt = o || {};
        const hist = B().historique();
        const op = hist[0];
        if (!op) return false;
        if (opt.id && op.id !== opt.id) {
            toast('Une autre opération a eu lieu depuis : annule-la d’abord depuis l’historique de la Bourse.', 'erreur');
            return false;
        }
        const actuel = B().lire();
        let cible = op.avant, note = '';
        if (!memes(actuel, op.apres)) {
            // Les pièces ont bougé depuis (saisie à la main) : on rend l'écart,
            // pièce par pièce si c'est possible, sinon en monnaie au plus juste.
            const ecart = {};
            PIECES.forEach(p => { ecart[p] = (actuel[p] || 0) + (op.avant[p] || 0) - (op.apres[p] || 0); });
            if (PIECES.every(p => ecart[p] >= 0)) cible = ecart;
            else {
                const total = enCuivre(actuel) + enCuivre(op.avant) - enCuivre(op.apres);
                if (total < 0) {
                    await window.Dialogue.informer({ titre: 'Annulation impossible', type: 'erreur',
                        message: `Défaire ${decrire(op)} demanderait plus de pièces qu’il n’en reste dans ta bourse.` });
                    return false;
                }
                cible = B().repartir(total);
            }
            note = '\n\nTes pièces ont changé depuis : seul l’écart de cette opération est rendu, le reste ne bouge pas.';
        }
        const sac = window.SheetSac;
        let objet = '';
        if (op.objet && sac) objet = op.type === 'achat'
            ? `\n« ${op.objet.nom} »${op.objet.qte > 1 ? ' ×' + op.objet.qte : ''} quitte ton sac.`
            : `\n« ${op.objet.nom} »${op.objet.qte > 1 ? ' ×' + op.objet.qte : ''} revient dans ton sac.`;
        if (opt.confirmer !== false) {
            const ok = await window.Dialogue.confirmer({
                titre: 'Annuler la dernière opération ?', icone: '↩', confirmer: 'Annuler l’opération', annuler: 'Garder',
                message: decrire(op) + ' : les pièces reviennent comme avant.' + objet + note
            });
            // L'historique est relu à chaque appel : on compare par identifiant.
            if (!ok || (B().historique()[0] || {}).id !== op.id) return false;
        }

        let manque = false;
        if (op.objet && sac) {
            const liste = sac.liste();
            if (op.type === 'achat') {
                let i = -1;
                for (let k = liste.length - 1; k >= 0; k--) if (liste[k] && liste[k].name === op.objet.nom) { i = k; break; }
                if (i < 0) manque = true;
                else {
                    const q = (parseInt(liste[i].qty, 10) || 1) - (op.objet.qte || 1);
                    if (q > 0) liste[i].qty = q; else liste.splice(i, 1);
                }
            } else if (op.type === 'vente') {
                const meme = liste.find(x => x && x.name === op.objet.nom);
                if (meme) meme.qty = (parseInt(meme.qty, 10) || 1) + (op.objet.qte || 1);
                else liste.splice(Math.min(op.objet.index == null ? liste.length : op.objet.index, liste.length), 0,
                    Object.assign({}, op.objet.item || { name: op.objet.nom }, { qty: op.objet.qte || 1 }));
            }
            sac.enregistrer();
        }
        B().poser(cible);
        B().retirerOperation(op.id);
        toast('↩ ' + decrire(op) + ' annulé' + (manque ? ' — l’objet n’était plus dans le sac.' : '.'), manque ? 'info' : 'reussite');
        rendre();
        return true;
    }

    // ---------------------------------------------------------------
    // Acheter : un objet des règles arrive dans le sac avec son prix
    // ---------------------------------------------------------------
    async function proposerAchat(index) {
        const liste = window.SheetSac ? window.SheetSac.liste() : [];
        const it = liste[index];
        if (!it) return false;
        const unite = lirePrix(it.value);
        if (unite == null || unite <= 0) return false;
        const qte = Math.max(1, parseInt(it.qty, 10) || 1);
        const total = unite * qte, dispo = B().total();
        const quoi = `« ${it.name} »${qte > 1 ? ' ×' + qte : ''}`;
        if (dispo < total) {
            await window.Dialogue.informer({ titre: 'Pas assez d’argent', icone: '🛒',
                message: `${quoi} coûte ${fmt(total)} et ta bourse contient ${fmt(dispo)}. L’objet reste dans ton sac, sans paiement.` });
            return false;
        }
        const ok = await window.Dialogue.confirmer({
            titre: 'Payer cet achat ?', icone: '🛒', confirmer: 'Payer ' + fmt(total), annuler: 'Ajouter sans payer',
            message: `${quoi} : ${fmt(total)}` + (qte > 1 ? ` (${it.value} l’unité)` : '') + ` — le prix des règles.\n`
                   + `Ta bourse passe de ${fmt(dispo)} à ${fmt(dispo - total)}, monnaie rendue au plus juste.`
        });
        if (!ok || liste.indexOf(it) < 0) return false;
        const op = B().payer(total, { type: 'achat', libelle: it.name + (qte > 1 ? ' ×' + qte : ''), objet: { nom: it.name, qte } });
        if (op) toast(`🛒 ${quoi} payé ${fmt(total)}.`, 'reussite');
        return !!op;
    }

    // ---------------------------------------------------------------
    // Vendre un objet du sac
    // ---------------------------------------------------------------
    async function vendre(index) {
        const sac = window.SheetSac; if (!sac) return false;
        const liste = sac.liste();
        const it = liste[index];
        if (!it) return false;
        const nom = it.name || 'Objet';
        const qteMax = Math.max(1, parseInt(it.qty, 10) || 1);
        const connu = lirePrix(it.value);
        const regles = REGLES[window.Edition ? window.Edition.active() : '2024'] || REGLES['2024'];
        let champPrix = null, champQte = null, zone = null, sortie = null;

        const lireChoix = () => ({
            unite: connu != null ? connu : lirePrix(champPrix && champPrix.value),
            qte: champQte ? Math.min(qteMax, Math.max(1, parseInt(champQte.value, 10) || 0)) : 1,
            mode: (zone && zone.querySelector('input[name="vente-mode"]:checked') || {}).value === 'plein' ? 'plein' : 'moitie'
        });
        const gainDe = (c) => Math.floor((c.unite || 0) * c.qte * (c.mode === 'plein' ? 1 : 0.5));
        const maj = () => {
            const c = lireChoix();
            if (sortie) sortie.textContent = c.unite == null ? 'Indique le prix d’achat pour voir la somme.' : 'Tu reçois ' + fmt(gainDe(c)) + '.';
        };

        const choix = await window.Dialogue.fenetre({
            titre: 'Vendre « ' + nom + ' »', icone: '💰', confirmer: 'Vendre', annuler: 'Garder', annule: null,
            corps() {
                zone = document.createElement('div');
                zone.className = 'vente-form';
                zone.innerHTML = (connu == null
                    ? `<div class="dlg-champ"><label for="vente-prix">Prix d’achat, à l’unité</label>
                        <input id="vente-prix" class="dlg-saisie" type="text" autocomplete="off" placeholder="10 po"></div>`
                    : `<p class="vente-prix">Prix d’achat : <b>${esc(it.value)}</b>${qteMax > 1 ? ' l’unité' : ''}</p>`)
                    + (qteMax > 1
                        ? `<div class="dlg-champ"><label for="vente-qte">Quantité vendue (sur ${qteMax})</label>
                            <input id="vente-qte" class="dlg-saisie" type="number" min="1" max="${qteMax}" value="1" inputmode="numeric"></div>`
                        : '')
                    + `<div class="dlg-choix" role="radiogroup" aria-label="Prix de revente">
                        <label class="dlg-choix-opt"><input type="radio" name="vente-mode" value="moitie" checked>
                            <span class="dlg-choix-carte"><span class="dlg-choix-txt"><b>Moitié du prix</b><i>${esc(regles.moitie)}</i></span></span></label>
                        <label class="dlg-choix-opt"><input type="radio" name="vente-mode" value="plein">
                            <span class="dlg-choix-carte"><span class="dlg-choix-txt"><b>Plein prix — objet de valeur</b><i>${esc(regles.plein)}</i></span></span></label>
                    </div>
                    <p class="vente-total" aria-live="polite"></p>`;
                champPrix = zone.querySelector('#vente-prix');
                champQte = zone.querySelector('#vente-qte');
                sortie = zone.querySelector('.vente-total');
                zone.addEventListener('input', maj);
                zone.addEventListener('change', maj);
                maj();
                return zone;
            },
            resultat(signaler) {
                const c = lireChoix();
                if (c.unite == null || c.unite < 0) { signaler('Indique un prix, par exemple « 10 po » ou « 5 pa ».'); return undefined; }
                if (champQte && !(parseInt(champQte.value, 10) >= 1 && parseInt(champQte.value, 10) <= qteMax)) {
                    signaler(`Entre une quantité de 1 à ${qteMax}.`); return undefined;
                }
                return c;
            }
        });
        if (!choix) return false;
        const i = liste.indexOf(it);
        if (i < 0) { toast('Cet objet n’est plus dans le sac.', 'erreur'); return false; }

        const gain = gainDe(choix);
        const copie = JSON.parse(JSON.stringify(it));
        const reste = qteMax - choix.qte;
        if (reste > 0) it.qty = reste; else liste.splice(i, 1);
        sac.enregistrer();
        const libelle = nom + (choix.qte > 1 ? ' ×' + choix.qte : '');
        const op = B().ajouter(gain, { type: 'vente', libelle, objet: { nom, qte: choix.qte, index: i, item: copie } });
        const texte = `💰 « ${libelle} » vendu : +${fmt(gain)}`;
        if (op && window.showUndoToast) window.showUndoToast(texte, () => annulerDerniere({ id: op.id, confirmer: false }));
        else toast(texte, 'reussite');
        return true;
    }

    // Un clic dans le panneau : seul bouton, « Annuler la dernière ».
    document.addEventListener('click', (e) => {
        if (e.target.closest && e.target.closest('#bourse-historique [data-bourse="annuler"]')) annulerDerniere();
    });
    // Toute opération consignée (script.js) redessine le panneau s'il est ouvert.
    document.addEventListener('bourse:operation', rendre);

    window.Bourse = { lirePrix, basculer, rendre, annulerDerniere, proposerAchat, vendre };
})();
