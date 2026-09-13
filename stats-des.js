// =====================================================
// stats-des.js — les statistiques des d20 d'un personnage (LOT 4.15)
//
// Chargé à la demande (charger.js), au clic sur « 📊 » dans le tiroir de dés.
//
// Le COMPTE vit dans la fiche (script.js, clé `dnd-stats-d20`), mis à jour à
// chaque d20 lancé : ce module ne fait que le lire, le dessiner et le juger.
//
// Le test du χ² compare la répartition des 20 faces à celle d'un dé honnête
// (chaque face attendue n/20 fois). Avec 20 faces, il a 19 degrés de liberté.
// La probabilité (p) d'un écart au moins aussi grand par pur hasard vient de
// la fonction gamma incomplète régularisée Q(19/2, χ²/2), calculée ici sans
// bibliothèque (série pour les petites valeurs, fraction continue au-delà,
// ln Γ par l'approximation de Lanczos).
// =====================================================
(function () {
    'use strict';

    const FACES = 20;
    const SEUIL_FIABLE = 100;
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const virgule = (n, d) => Number(n).toFixed(d).replace('.', ',');

    // ---------- Le calcul ----------
    const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
        -176.61503916999185, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    function lnGamma(z) {
        if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
        z -= 1;
        let x = LANCZOS[0];
        for (let i = 1; i < 9; i++) x += LANCZOS[i] / (z + i);
        const t = z + 7.5;
        return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
    }
    /** Q(a, x) = Γ(a, x) / Γ(a) : la queue droite de la loi du χ² quand a = k/2 et x = χ²/2. */
    function gammaQ(a, x) {
        if (!(a > 0) || x < 0 || !isFinite(x)) return NaN;
        if (x === 0) return 1;
        const facteur = Math.exp(-x + a * Math.log(x) - lnGamma(a));
        if (x < a + 1) {
            let ap = a, somme = 1 / a, terme = somme;
            for (let n = 0; n < 500; n++) {
                ap += 1; terme *= x / ap; somme += terme;
                if (Math.abs(terme) < Math.abs(somme) * 1e-14) break;
            }
            return Math.max(0, Math.min(1, 1 - somme * facteur));
        }
        const TOUT_PETIT = 1e-300;
        let b = x + 1 - a, c = 1 / TOUT_PETIT, d = 1 / b, h = d;
        for (let i = 1; i < 500; i++) {
            const an = -i * (i - a);
            b += 2;
            d = an * d + b; if (Math.abs(d) < TOUT_PETIT) d = TOUT_PETIT;
            c = b + an / c; if (Math.abs(c) < TOUT_PETIT) c = TOUT_PETIT;
            d = 1 / d;
            const delta = d * c;
            h *= delta;
            if (Math.abs(delta - 1) < 1e-14) break;
        }
        return Math.max(0, Math.min(1, facteur * h));
    }
    /** { khi2, ddl, p } pour un tableau de 20 effectifs. */
    function khiDeux(compte) {
        const n = compte.reduce((t, v) => t + v, 0);
        if (!n) return { khi2: 0, ddl: FACES - 1, p: 1 };
        const attendu = n / FACES;
        const khi2 = compte.reduce((t, o) => t + (o - attendu) * (o - attendu) / attendu, 0);
        return { khi2, ddl: FACES - 1, p: gammaQ((FACES - 1) / 2, khi2 / 2) };
    }
    function phraseKhiDeux(r, n) {
        const fois = r.p * 100;
        const surCent = fois >= 1 ? `environ ${Math.round(fois)} fois sur 100` : 'moins d’une fois sur 100';
        if (r.p >= 0.05) return `Rien de suspect : un dé parfaitement équilibré produirait un écart au moins aussi grand ${surCent}.`;
        if (r.p >= 0.01) return `Un peu inhabituel : un dé équilibré ne ferait un tel écart que ${surCent}. Rien d’alarmant${n < 300 ? ' à ce stade' : ''}.`;
        return `Très inhabituel : un dé équilibré ferait un tel écart ${surCent}. Ton dé — ou ta chance — mérite qu’on s’y penche.`;
    }

    // ---------- La fenêtre ----------
    function corps(s) {
        const n = s.total || 0;
        const compte = Array.from({ length: FACES }, (_, i) => (s.compte && s.compte[i]) || 0);
        const plusHaut = Math.max(1, ...compte);
        const attendu = n / FACES;
        const moyenne = n ? compte.reduce((t, v, i) => t + v * (i + 1), 0) / n : 0;
        const r = khiDeux(compte);
        const depuis = s.depuis ? new Date(s.depuis).toLocaleDateString('fr-FR') : '';
        const div = document.createElement('div');
        div.className = 'stats-des';
        div.innerHTML = `
            <p class="stats-total"><b>${n}</b> d20 naturel${n > 1 ? 's' : ''}${depuis ? ` depuis le ${esc(depuis)}` : ''} <small>(ce personnage)</small></p>
            ${n < SEUIL_FIABLE ? `<p class="stats-avert" role="note">Moins de ${SEUIL_FIABLE} jets : ces chiffres dépendent encore beaucoup du hasard. Continue de lancer !</p>` : ''}
            <div class="stats-graphe" role="img" aria-label="Répartition des faces, de 1 à 20 : ${compte.map((v, i) => `${i + 1} : ${v}`).join(', ')}">
                ${n ? `<span class="stats-attendu" style="bottom:${(attendu / plusHaut) * 100}%" aria-hidden="true"></span>` : ''}
                ${compte.map((v, i) => `<span class="stats-col${i === 19 ? ' is-20' : ''}${i === 0 ? ' is-1' : ''}" aria-hidden="true">
                    <span class="stats-barre" style="height:${(v / plusHaut) * 100}%"><em>${v}</em></span><span class="stats-face">${i + 1}</span></span>`).join('')}
            </div>
            ${n ? `<p class="stats-legende">Pointillés : ce qu’un dé équilibré donnerait, ${virgule(attendu, 1)} par face.</p>` : ''}
            <dl class="stats-chiffres">
                <div><dt>Moyenne</dt><dd>${n ? virgule(moyenne, 2) : '—'} <small>(un dé équilibré : 10,5)</small></dd></div>
                <div><dt>Plus longue série de 20</dt><dd>${(s.max && s.max['20']) || 0}</dd></div>
                <div><dt>Plus longue série de 1</dt><dd>${(s.max && s.max['1']) || 0}</dd></div>
                <div><dt>Test du χ²</dt><dd>${n ? `${virgule(r.khi2, 1)} <small>(19 degrés de liberté, p = ${virgule(r.p, r.p < 0.01 ? 3 : 2)})</small>` : '—'}</dd></div>
            </dl>
            ${n ? `<p class="stats-phrase">${esc(phraseKhiDeux(r, n))}</p>` : '<p class="stats-phrase">Aucun d20 lancé pour l’instant.</p>'}
            <button type="button" class="btn-small stats-raz"${n ? '' : ' disabled'}>Remettre à zéro</button>`;
        return div;
    }

    async function ouvrir() {
        const api = window.SheetApi;
        if (!api || !api.statsD20) return;
        let raz = false;
        await window.Dialogue.fenetre({
            titre: 'Statistiques de dés', icone: '📊', large: true, confirmer: 'Fermer', annuler: '',
            corps(boite) {
                const c = corps(api.statsD20());
                c.querySelector('.stats-raz').addEventListener('click', () => {
                    raz = true;
                    const valider = boite.querySelector('[data-dlg="valider"]');
                    if (valider) valider.click();
                });
                return c;
            },
            resultat: () => true
        });
        if (!raz) return;
        const ok = await window.Dialogue.confirmer({
            titre: 'Remettre les statistiques à zéro ?', icone: '📊', danger: true, confirmer: 'Remettre à zéro',
            message: 'Le compte des d20 de ce personnage repart de zéro. L’historique des jets, lui, ne change pas.'
        });
        if (!ok) return;
        const avant = api.remettreStatsD20();
        if (window.showUndoToast) window.showUndoToast('Statistiques de dés remises à zéro', () => api.remettreStatsD20(avant));
    }

    window.StatsDes = { ouvrir, khiDeux, gammaQ, lnGamma, phraseKhiDeux };
})();
