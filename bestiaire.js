// =====================================================
// bestiaire.js — un compagnon tiré du bestiaire (LOT 5.4)
//
// Chargé à la demande : au clic sur « 📖 Bestiaire » du module Compagnons, ou
// sur 📖 d'une carte de compagnon (la remplir depuis une créature).
//
// Les créatures viennent de SRD.category('monsters') : le bestiaire de
// l'édition du personnage (2014 : SRD 5.1, 2024 : SRD 5.2.1) et le contenu
// perso, qui a la même forme. Rien n'est écrit en dur.
//
// Ce qui est recopié : nom, CA, PV, vitesse, les six caractéristiques et les
// attaques. Une attaque est une action dont le texte donne un bonus au
// toucher et/ou un « Touché : » :
//   2014 « Attaque d’arme au corps à corps : +4 pour toucher […] Touché : 7 (2d4 + 2) »
//   2024 « Corps à corps : +4, allonge 1,50 m. Touché : 5 (1d6 + 2) »
// Les autres actions, les traits, les sens et les compétences vont dans les
// notes. Tout reste modifiable ensuite sur la carte.
// =====================================================
(function () {
    'use strict';

    const ROLES = [
        ['familier', '🦉 Familier'], ['bete', '🐺 Compagnon animal'], ['monture', '🐎 Monture'],
        ['invocation', '✨ Invocation'], ['allie', '🛡️ Allié']
    ];
    const MAX_AFFICHES = 60;
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const texte = (a) => (Array.isArray(a && a.text) ? a.text.join(' ') : String((a && a.text) || '')).replace(/\s+/g, ' ').trim();
    const plier = (s) => (window.SRD && window.SRD.fold ? window.SRD.fold(s) : String(s || '').toLowerCase());
    const SIGNES = /[−–]/g;     // moins typographique et tiret demi-cadratin des données

    /** Une action → { bonus, dmg }, ou null si ce n'est pas une attaque. */
    function lireAttaque(action) {
        const t = texte(action);
        const mb = /(?:attaque[^:.]{0,70}|corps à corps(?: ou à distance)?|à distance|distance)\s*:\s*([+\-−–]\s?\d+)/i.exec(t);
        const mt = /Touché\s*:\s*([\s\S]*?)(?:\.(?:\s|$)|$)/i.exec(t);
        if (!mb && !mt) return null;
        let dmg = '';
        if (mt) {
            const des = [];
            const rx = /\((\d+d\d+(?:\s*[+\-−–]\s*\d+)?)\)/g;
            let m;
            while ((m = rx.exec(mt[1]))) des.push(m[1].replace(/\s+/g, '').replace(SIGNES, '-'));
            if (des.length) dmg = des.join('+').replace(/\+-/g, '-');
            else {
                // « Touché : 1 dégât perforant » — des dégâts fixes, sans dé.
                const fixe = /^(\d+)\s+dégâts?\b/i.exec(mt[1].trim());
                if (fixe) dmg = fixe[1];
            }
        }
        return { bonus: mb ? mb[1].replace(/\s/g, '').replace(SIGNES, '-') : '', dmg };
    }

    const nombre = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
    const fp = (m) => m.cr_display || (m.cr != null && m.cr !== '' ? String(m.cr) : '');
    const estBete = (m) => /^b[êe]te\b/i.test(String(m.type || '').trim());

    /** Une créature du bestiaire → un compagnon, au format de `dnd-companions`. */
    function versCompagnon(m, role, edition) {
        const ab = m.abilities || {};
        const stat = (k) => { const n = nombre(ab[k]); return n == null ? 10 : n; };
        const attaques = [], notes = [];
        const base = Date.now().toString(36);
        (m.actions || []).forEach((a, i) => {
            const r = lireAttaque(a);
            if (r) attaques.push({ id: 'a' + base + i, name: a.name || 'Attaque', bonus: r.bonus, dmg: r.dmg });
            else notes.push((a.name ? a.name + '. ' : '') + texte(a));
        });
        const kv = (label, v) => { if (v && String(v).trim() && String(v).trim() !== '—') notes.unshift(label + ' : ' + String(v).trim()); };
        (m.traits || []).slice().reverse().forEach(t => notes.unshift((t.name ? t.name + '. ' : '') + texte(t)));
        kv('Langues', m.languages); kv('Sens', m.senses); kv('Compétences', m.skills);
        [['bonus_actions', 'Action bonus'], ['reactions', 'Réaction']].forEach(([k, label]) =>
            (m[k] || []).forEach(a => notes.push(label + ' — ' + (a.name ? a.name + '. ' : '') + texte(a))));
        const ca = nombre(m.ac), pv = nombre(m.hp);
        return {
            name: m.name || '', type: role || (estBete(m) ? 'bete' : 'familier'),
            ac: ca == null ? '' : String(ca), hp: pv == null ? '' : String(pv), hpMax: pv == null ? '' : String(pv), hpTemp: '',
            speed: m.speed || '', init: '',
            stats: { for: stat('str'), dex: stat('dex'), con: stat('con'), int: stat('int'), sag: stat('wis'), cha: stat('cha') },
            attacks: attaques,
            notes: notes.join('\n'),
            collapsed: false,
            bestiaire: { id: m.id || '', nom: m.name || '', edition: edition || '', perso: m.source === 'perso' }
        };
    }

    /** o : { index } pour remplir ce compagnon ; rien pour en créer un. */
    async function choisir(o) {
        const S = window.SheetCompagnons;
        if (!S || !window.SRD) return false;
        let monstres;
        try { monstres = await window.SRD.category('monsters'); }
        catch (e) {
            await window.Dialogue.informer({ titre: 'Bestiaire indisponible', type: 'erreur', message: e.diagnostic || e.message });
            return false;
        }
        const edition = window.SRD.getEdition();
        const cible = o && o.index != null ? S.liste()[o.index] : null;
        const tries = monstres.filter(m => m && m.name)
            .sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr', { sensitivity: 'base' }));
        let zone = null, champ = null, liste = null, compte = null, roleSel = null, betes = null;
        let choisiId = null, roleTouche = false;

        function filtrer() {
            const q = plier(champ.value.trim());
            const vus = tries.filter(m => (!betes.checked || estBete(m)) && (!q || plier(m.name).includes(q)));
            const affiches = vus.slice(0, MAX_AFFICHES);
            liste.innerHTML = affiches.length ? affiches.map(m => {
                const detail = [
                    [m.size ? 'taille ' + m.size : '', m.type].filter(Boolean).join(' '),
                    fp(m) ? 'FP ' + fp(m) : '', m.ac != null && m.ac !== '' ? 'CA ' + m.ac : '', m.hp != null && m.hp !== '' ? 'PV ' + m.hp : ''
                ].filter(Boolean).join(' · ');
                return `<label class="dlg-choix-opt"><input type="radio" name="bst-choix" value="${esc(m.id)}"${m.id === choisiId ? ' checked' : ''}>
                    <span class="dlg-choix-carte"><span class="dlg-choix-txt"><b>${esc(m.name)}</b><i>${esc(detail)}</i></span>
                    ${m.source === 'perso' ? '<span class="dlg-choix-note">perso</span>' : ''}</span></label>`;
            }).join('') : '<p class="compact-empty">Aucune créature ne correspond.</p>';
            compte.textContent = vus.length > MAX_AFFICHES
                ? `${vus.length} créatures — les ${MAX_AFFICHES} premières sont affichées, affine la recherche.`
                : `${vus.length} créature${vus.length > 1 ? 's' : ''}.`;
        }

        const res = await window.Dialogue.fenetre({
            titre: cible ? 'Remplir depuis le bestiaire' : 'Choisir dans le bestiaire',
            icone: '📖', large: true, annule: null,
            confirmer: cible ? 'Remplir' : 'Ajouter', annuler: 'Annuler',
            message: 'Bestiaire des règles ' + edition + (cible
                ? ` — CA, PV, vitesse, caractéristiques et attaques de « ${cible.name || 'ce compagnon'} » seront remplacées. Son nom et ses notes restent.`
                : '.'),
            corps() {
                zone = document.createElement('div');
                zone.className = 'bst-form';
                zone.innerHTML = `
                    <div class="dlg-champ"><label for="bst-q">Rechercher une créature</label>
                        <input id="bst-q" class="dlg-saisie" type="search" autocomplete="off" spellcheck="false" placeholder="Loup, chouette, cheval de trait…"></div>
                    <div class="bst-options">
                        <label class="bst-betes"><input type="checkbox" id="bst-betes"> Bêtes seulement</label>
                        <label class="bst-role">Rôle <select id="bst-role" class="dlg-saisie">${ROLES.map(([v, l]) => `<option value="${v}"${cible && cible.type === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
                    </div>
                    <div class="bst-liste dlg-choix" role="radiogroup" aria-label="Créatures du bestiaire"></div>
                    <p class="bst-compte" aria-live="polite"></p>`;
                champ = zone.querySelector('#bst-q');
                liste = zone.querySelector('.bst-liste');
                compte = zone.querySelector('.bst-compte');
                roleSel = zone.querySelector('#bst-role');
                betes = zone.querySelector('#bst-betes');
                if (cible) roleTouche = true;
                champ.addEventListener('input', filtrer);
                betes.addEventListener('change', filtrer);
                roleSel.addEventListener('change', () => { roleTouche = true; });
                liste.addEventListener('change', (e) => {
                    if (e.target.name !== 'bst-choix') return;
                    choisiId = e.target.value;
                    const m = tries.find(x => x.id === choisiId);
                    // Tant que le joueur n'a pas choisi de rôle, une bête devient compagnon animal.
                    if (m && !roleTouche) roleSel.value = estBete(m) ? 'bete' : 'familier';
                });
                filtrer();
                return zone;
            },
            resultat(signaler) {
                const coche = zone.querySelector('input[name="bst-choix"]:checked');
                const m = coche && tries.find(x => x.id === coche.value);
                if (!m) { signaler('Choisis une créature dans la liste.'); return undefined; }
                return { m, role: roleSel.value };
            }
        });
        if (!res) return false;

        const nouveau = versCompagnon(res.m, res.role, edition);
        const toast = window.showUndoToast || ((msg) => window.showAppToast(msg, 'reussite'));
        if (cible) {
            const i = S.liste().indexOf(cible);
            if (i < 0) return false;
            const avant = JSON.parse(JSON.stringify(cible));
            S.remplacer(i, Object.assign({}, cible, nouveau, {
                id: cible.id,
                name: String(cible.name || '').trim() ? cible.name : nouveau.name,
                notes: String(cible.notes || '').trim() ? cible.notes : nouveau.notes
            }));
            toast(`« ${avant.name || nouveau.name} » rempli d’après « ${res.m.name} »`, () => {
                const j = S.liste().findIndex(x => x && x.id === avant.id);
                if (j >= 0) S.remplacer(j, avant);
            });
        } else {
            nouveau.id = 'c' + Date.now();
            S.ajouter(nouveau);
            toast(`« ${nouveau.name} » rejoint tes compagnons`, () => S.retirer(nouveau.id));
        }
        return true;
    }

    window.Bestiaire = { choisir, lireAttaque, versCompagnon };
})();
