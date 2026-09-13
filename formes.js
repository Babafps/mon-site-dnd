// =====================================================
// formes.js — Forme sauvage et Métamorphose (LOT 4.9)
//
// Chargé à la demande (charger.js) : au choix d'une forme dans « ✦ Effet »,
// ou à l'ouverture d'une fiche qui porte une forme en cours.
//
// CE QUE LA FICHE DEVIENT, selon les données (data/srd/<édition>/fr) :
//   · Forme sauvage (classes.json, Druide) — les deux éditions remplacent le
//     profil par celui de la bête mais gardent « Intelligence, Sagesse et
//     Charisme » : seules FOR, DEX et CON changent.
//   · Métamorphose (spells.json) — 2014 : « y compris ses valeurs de
//     caractéristique mentales » ; 2024 : le profil est remplacé, sauf
//     « alignement, personnalité, type de créature, points de vie et dés de
//     vie ». Les six caractéristiques changent.
//   · La CA, la vitesse et les attaques sont celles de la bête.
//   · Les PV — 2014 (les deux) : la créature « adopte les points de vie de la
//     bête » ; au retour, elle retrouve les siens, moins les « dégâts
//     excédentaires » si elle revient parce qu'elle tombe à 0 PV.
//     2024, Forme sauvage : « autant de points de vie temporaires que votre
//     niveau de Druide ». 2024, Métamorphose : « autant de points de vie
//     temporaires que les points de vie de sa forme de Bête » ; le sort
//     « prend fin […] s'il ne lui reste plus de points de vie temporaires ».
//   · Retour automatique — 2014 Forme sauvage : « inconscient, tombez à 0 point
//     de vie » ; 2024 Forme sauvage : « subissez l'état Neutralisé » ;
//     Métamorphose 2014 : « sauf si la cible tombe à 0 point de vie » ; et
//     partout, la fin de la durée (effets-actifs.js).
//
// SANS PERTE. Les caractéristiques, la CA et la vitesse de la bête sont posées
// dans les champs SANS événement de saisie : rien n'est enregistré à leur
// place, et les valeurs du héros restent dans le stockage. Une photo
// (`avant`) garde tout le reste. Clé de personnage `dnd-forme-active` :
//   { type, edition, bete: {…}, remplacees: ['str', …], avant: {…},
//     niveau, pvTempSort, debut }
// =====================================================
(function () {
    'use strict';

    const CLE = 'dnd-forme-active';
    const CARACS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    const NOM_TYPE = { 'forme-sauvage': 'Forme sauvage', metamorphose: 'Métamorphose' };

    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const plier = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const edition = () => (window.Edition ? window.Edition.active() : '2024');
    const toast = (m, t) => { if (window.showAppToast) window.showAppToast(m, t); };
    const entier = (v) => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };
    const store = () => window.SheetStore;
    const fp = (v) => { const s = String(v == null ? '' : v); if (s.includes('/')) { const [a, b] = s.split('/'); return entier(a) / (entier(b) || 1); } return parseFloat(s) || 0; };
    const fpTexte = (n) => ({ 0.125: '1/8', 0.25: '1/4', 0.5: '1/2' }[n] || String(n));

    function lire() {
        const f = store() && store().get(CLE);
        return f && typeof f === 'object' && f.bete ? f : null;
    }

    // =====================================================
    // LES RÈGLES, LUES DANS LES DONNÉES
    // =====================================================
    /** La table des formes de la Forme sauvage : [{ niveau, fp, vol, nage }], ou null si illisible. */
    function limitesFormeSauvage(texte, ed) {
        const t = String(texte || '');
        if (ed === '2024') {
            // « 2 — 4 — 1/4 — Non » : niveau, formes connues, FP max., vitesse de vol.
            const lignes = [...t.matchAll(/^\s*(\d+)\s*—\s*(\d+)\s*—\s*(\d+(?:\/\d+)?)\s*—\s*(Oui|Non)\s*$/gmi)]
                .map(m => ({ niveau: entier(m[1]), fp: fp(m[3]), vol: /oui/i.test(m[4]), nage: true }));
            return verifier(lignes);
        }
        // 2014 : la table est aplatie dans le texte —
        // « Niveau 2 4 8 FP max. 1/4 1/2 1 Limites Ni vitesse de vol ni vitesse de nage Pas de vitesse de vol — Exemple »
        const m = t.replace(/\s+/g, ' ').match(/Niveau\s+([\d ]+?)\s*FP max\.\s*([\d/ ]+?)\s*Limites\s+(.+?)\s*Exemple/i);
        if (!m) return null;
        const niveaux = m[1].trim().split(/\s+/).map(entier);
        const fps = m[2].trim().split(/\s+/).map(fp);
        const limites = m[3].match(/Ni vitesse de vol ni vitesse de nage|Pas de vitesse de vol|—/gi) || [];
        if (niveaux.length !== fps.length || niveaux.length !== limites.length) return null;
        return verifier(niveaux.map((n, i) => ({
            niveau: n, fp: fps[i],
            vol: !/vol/i.test(limites[i]), nage: !/nage/i.test(limites[i])
        })));
    }
    /** Au moindre doute, on ne propose rien de faux : trois paliers croissants ou rien. */
    function verifier(lignes) {
        if (lignes.length < 2) return null;
        for (let i = 1; i < lignes.length; i++) {
            if (!(lignes[i].niveau > lignes[i - 1].niveau) || !(lignes[i].fp >= lignes[i - 1].fp)) return null;
        }
        return lignes;
    }

    async function niveauDeClasse(nom) {
        try {
            await window.charger('multiclasse');
            const e = window.Multiclasse.liste().find(c => plier(c.nom) === plier(nom));
            if (e) return entier(e.niveau);
        } catch (e) { /* sans le module : le champ de la fiche */ }
        const cls = String(($('char-class') || {}).value || '');
        return plier(cls).includes(plier(nom)) ? (entier(($('char-level') || {}).value) || 1) : 0;
    }

    /** { limite: { fp, vol, nage } | null, niveau, duree, concentration, avertissements[] } */
    async function reglesForme(type) {
        const ed = edition();
        const r = { limite: null, niveau: 0, duree: null, concentration: false, avertissements: [] };
        if (type === 'metamorphose') {
            let sort = null;
            try { sort = (await window.SRD.category('spells')).find(s => plier(s.name) === 'metamorphose'); } catch (e) { /* hors ligne */ }
            r.niveau = entier(($('char-level') || {}).value) || 1;
            // « facteur de puissance est inférieur ou égal à celui de la cible (ou à son niveau […]) »
            r.limite = { fp: r.niveau, vol: true, nage: true };
            r.duree = sort && window.EffetsActifs ? window.EffetsActifs.lireDuree(sort.duration) : { unite: 'heure', valeur: 1 };
            r.concentration = sort ? !!sort.concentration : true;
            if (!sort) r.avertissements.push('Le sort n’a pas pu être lu : durée d’1 heure par défaut.');
            return r;
        }
        r.niveau = await niveauDeClasse('Druide');
        let feature = null;
        try {
            const druide = (await window.SRD.category('classes')).find(c => plier(c.name) === 'druide');
            feature = druide && (druide.features || []).find(f => plier(f.name) === 'forme sauvage');
        } catch (e) { /* hors ligne */ }
        const table = feature ? limitesFormeSauvage([].concat(feature.text || []).join('\n'), ed) : null;
        if (!table) r.avertissements.push('La table des formes n’a pas pu être lue : toutes les bêtes sont proposées.');
        else if (r.niveau < table[0].niveau) r.avertissements.push(`Aucun niveau de Druide ${table[0].niveau} ou plus sur la fiche : toutes les bêtes sont proposées.`);
        else r.limite = table.filter(l => l.niveau <= r.niveau).pop();
        // « un nombre d’heures égal à la moitié de votre niveau de druide, arrondi à l’inférieur » (2014)
        // « autant d’heures que la moitié de votre niveau de Druide » (2024)
        r.duree = { unite: 'heure', valeur: Math.max(1, Math.floor((r.niveau || 2) / 2)) };
        return r;
    }

    async function betes() {
        let tous = [];
        try { tous = await window.SRD.category('monsters'); } catch (e) { return []; }
        return tous.filter(m => plier(m.type) === 'bete' || (m.source === 'perso' && /bete/.test(plier(m.type))))
            .sort((a, b) => fp(a.cr) - fp(b.cr) || String(a.name).localeCompare(String(b.name), 'fr'));
    }
    const aVol = (b) => /\bvol\b/i.test(String(b.speed || ''));
    const aNage = (b) => /\bnage\b/i.test(String(b.speed || ''));
    function refus(b, limite) {
        if (!limite) return '';
        if (fp(b.cr) > limite.fp) return `FP ${fpTexte(fp(b.cr))} au-delà de ${fpTexte(limite.fp)}`;
        if (!limite.vol && aVol(b)) return 'vitesse de vol interdite à ton niveau';
        if (!limite.nage && aNage(b)) return 'vitesse de nage interdite à ton niveau';
        return '';
    }

    // ---------- Les attaques de la bête ----------
    const RX_ATTAQUE = /(?:([A-ZÀ-Ý][^.:]{0,40})\.\s*)?(?:Attaque d[’']arme (?:au corps à corps|à distance)|Attaque (?:au corps à corps|à distance)|Corps à corps(?: ou à distance)?|À distance)\s*:\s*([+−-]\s?\d+)[^.]*?\.\s*Touché\s*:\s*([^.]*)/g;
    // « 7 (2d4 + 2) dégâts perforants », « 1 dégât perforant plus 2 (1d4) dégâts de poison »
    function degatsDe(texte) {
        const out = [];
        for (const m of String(texte).matchAll(/(\d+)(?:\s*\(([^)]+)\))?\s*dégâts?\s+(?:de\s+|d[’']\s*)?([a-zà-ÿ]+)/gi)) {
            out.push({ expr: (m[2] || m[1]).replace(/\s+/g, '').replace(/−/g, '-'), type: m[3] });
        }
        return out;
    }
    function attaquesDe(bete) {
        const out = [];
        (bete.actions || []).forEach(a => {
            const texte = String(a.text || '');
            let trouve = false;
            for (const m of texte.matchAll(RX_ATTAQUE)) {
                trouve = true;
                out.push({ nom: (m[1] && m[1].trim()) || a.name, bonus: entier(m[2].replace(/\s/g, '').replace('−', '-')), degats: degatsDe(m[3]) });
            }
            if (!trouve && texte) out.push({ nom: a.name, texte });
        });
        return out;
    }
    function resumeBete(b) {
        return { id: b.id, nom: b.name, cr: b.cr, ac: entier(b.ac), hp: entier(b.hp), speed: String(b.speed || ''),
                 abilities: Object.assign({}, b.abilities || {}), traits: (b.traits || []).map(t => ({ name: t.name, text: t.text })),
                 actions: (b.actions || []).map(t => ({ name: t.name, text: t.text })) };
    }

    // =====================================================
    // CHOISIR UNE BÊTE
    // =====================================================
    async function ouvrir(type) {
        const t = type === 'metamorphose' ? 'metamorphose' : 'forme-sauvage';
        const [regles, liste] = await Promise.all([reglesForme(t), betes()]);
        if (!liste.length) {
            await window.Dialogue.informer({ titre: NOM_TYPE[t], type: 'erreur', message: 'Le bestiaire n’a pas pu être lu (hors ligne ?). Réessaie une fois connecté.' });
            return null;
        }
        let choisie = null;
        const ok = await window.Dialogue.fenetre({
            titre: NOM_TYPE[t], icone: '🐾', large: true, confirmer: 'Se transformer', annuler: 'Annuler',
            message: (regles.limite ? `Bêtes de FP ${fpTexte(regles.limite.fp)} au plus`
                + (!regles.limite.vol ? ', sans vitesse de vol' : '') + (!regles.limite.nage ? ', ni de nage' : '')
                + ` (règles ${edition()}).` : '') + (regles.avertissements.length ? '\n' + regles.avertissements.join('\n') : ''),
            corps() {
                const div = document.createElement('div');
                div.className = 'formes-fenetre';
                div.innerHTML = `<label class="formes-cherche">Chercher <input type="search" class="formes-q" placeholder="Loup, ours…" autocomplete="off"></label>
                    <div class="dlg-choix formes-liste" role="radiogroup" aria-label="Bêtes">${liste.map((b, i) => {
                        const non = refus(b, regles.limite);
                        return `<label class="dlg-choix-opt" data-nom="${esc(plier(b.name))}"><input type="radio" name="forme-bete" value="${i}"${non ? ' disabled' : ''}>
                            <span class="dlg-choix-carte"><span class="dlg-choix-txt"><b>${esc(b.name)}${b.source === 'perso' ? ' <small>(perso)</small>' : ''}</b>
                            <i>${esc(non || `CA ${b.ac} · PV ${b.hp} · ${b.speed}`)}</i></span>
                            <span class="dlg-choix-note">FP ${esc(fpTexte(fp(b.cr)))}</span></span></label>`;
                    }).join('')}</div>`;
                div.querySelector('.formes-q').addEventListener('input', (e) => {
                    const q = plier(e.target.value);
                    div.querySelectorAll('.formes-liste > label').forEach(l => { l.hidden = !!q && !l.dataset.nom.includes(q); });
                });
                return div;
            },
            resultat(signaler) {
                const c = document.querySelector('.formes-fenetre input[name="forme-bete"]:checked');
                if (!c) { signaler('Choisis une bête.'); return undefined; }
                choisie = liste[entier(c.value)];
                return true;
            }
        });
        if (!ok || !choisie) return null;
        return appliquer(t, choisie, regles);
    }

    // =====================================================
    // SE TRANSFORMER, REPRENDRE FORME
    // =====================================================
    function valeur(id) { return String(($(id) || {}).value || ''); }
    function saisir(id, v) {
        const el = $(id); if (!el) return;
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    async function appliquer(type, bete, regles) {
        const ed = edition();
        if (lire()) reprendre({ raison: 'nouvelle', silencieux: true });
        await window.charger('effets-actifs');
        const nomEffet = `${NOM_TYPE[type]} : ${bete.name}`;
        const effet = await window.EffetsActifs.ajouter({
            forme: true, nom: nomEffet, icone: '🐾', duree: regles.duree || { unite: 'heure', valeur: 1 },
            concentration: type === 'metamorphose' && regles.concentration,
            desc: `${NOM_TYPE[type]} (${ed})`, silencieux: true
        });
        if (!effet) return null;                       // concentration refusée : rien ne change

        const f = {
            type, edition: ed, bete: resumeBete(bete), niveau: regles.niveau, debut: Date.now(), pvTempSort: 0,
            remplacees: type === 'forme-sauvage' ? ['str', 'dex', 'con'] : CARACS.slice(),
            avant: {
                stats: Object.fromEntries(CARACS.map(k => [k, valeur('stat-' + k)])),
                ac: valeur('armor-class'), speed: valeur('speed'),
                hp: { cur: entier(valeur('hp-current')), max: entier(valeur('hp-max')), temp: entier(valeur('hp-temp')) }
            }
        };
        const notes = [];
        if (ed === '2014') {
            saisir('hp-max', f.bete.hp); saisir('hp-current', f.bete.hp);
            notes.push(`PV de la bête : ${f.bete.hp}.`);
        } else {
            const temp = type === 'forme-sauvage' ? Math.max(0, regles.niveau) : f.bete.hp;
            f.pvTempSort = temp;
            // PV temporaires « non cumulables » : on garde le plus élevé.
            if (temp > f.avant.hp.temp) { saisir('hp-temp', temp); notes.push(`${temp} PV temporaires.`); }
            else notes.push(`Tu gardes tes ${f.avant.hp.temp} PV temporaires (plus élevés que ${temp}).`);
        }
        store().set(CLE, f);
        poserDom(f);

        // Une utilisation de la Forme sauvage, si la fiche la suit dans « Capacités limitées ».
        if (type === 'forme-sauvage') {
            const abilities = (store().get('dnd-abilities') || []);
            const i = abilities.findIndex(a => a && /forme sauvage/i.test(a.name || '')
                && (a.used || []).filter(Boolean).length < (entier(a.max) || 0));
            if (i !== -1 && window.utiliserCapacite) window.utiliserCapacite(i);
        }
        toast(`🐾 ${nomEffet}. ${notes.join(' ')}`, 'reussite');
        document.dispatchEvent(new CustomEvent('forme:debut', { detail: { type, bete: f.bete.nom } }));
        return f;
    }

    function poserDom(f) {
        f.remplacees.forEach(k => {
            const el = $('stat-' + k); if (!el) return;
            el.value = f.bete.abilities[k] != null ? f.bete.abilities[k] : el.value;
            el.readOnly = true; el.classList.add('forme-remplace');
            el.title = `${f.bete.nom} — reprends ta forme pour modifier cette valeur`;
        });
        const ac = $('armor-class');
        if (ac) { ac.value = f.bete.ac; ac.readOnly = true; ac.classList.add('forme-remplace'); }
        const vit = $('speed');
        if (vit) { vit.value = f.bete.speed; vit.readOnly = true; vit.classList.add('forme-remplace'); vit.title = f.bete.speed; }
        document.body.classList.add('forme-active');
        banniere(f);
        panneauAttaques(f);
        if (window.SheetApi && window.SheetApi.refresh) window.SheetApi.refresh();
        if (window.ArmorWidget && window.ArmorWidget.refresh) window.ArmorWidget.refresh();
    }

    function reprendre(o) {
        const opt = o || {};
        const f = lire();
        if (!f) return false;
        f.remplacees.forEach(k => {
            const el = $('stat-' + k); if (!el) return;
            const vrai = store().raw('dnd-sheet-stat-' + k);
            el.value = vrai != null ? vrai : f.avant.stats[k];
            el.readOnly = false; el.classList.remove('forme-remplace'); el.removeAttribute('title');
        });
        const armure = store().get('dnd-armor');
        const ac = $('armor-class');
        if (ac) {
            ac.readOnly = false; ac.classList.remove('forme-remplace');
            if (!(armure && armure.auto)) {
                const vrai = store().raw('dnd-sheet-armor-class');
                ac.value = vrai != null && vrai !== String(f.bete.ac) ? vrai : f.avant.ac;
            }
        }
        const vit = $('speed');
        if (vit) {
            const vrai = store().raw('dnd-sheet-speed');
            vit.value = vrai != null ? vrai : f.avant.speed;
            vit.readOnly = false; vit.classList.remove('forme-remplace'); vit.removeAttribute('title');
        }
        const notes = [];
        if (f.edition === '2014') {
            const exc = Math.max(0, entier(opt.excedent));
            const cur = Math.max(0, f.avant.hp.cur - exc);
            saisir('hp-max', f.avant.hp.max);
            saisir('hp-current', cur);
            notes.push(exc ? `${exc} dégâts excédentaires : ${f.avant.hp.cur} → ${cur} PV.` : `Tu retrouves tes ${cur} PV.`);
        } else if (f.type === 'metamorphose' && entier(valeur('hp-temp')) > 0) {
            // « Ces points de vie temporaires disparaissent s’il lui en reste à la fin du sort. »
            saisir('hp-temp', 0);
        }
        store().set(CLE, null);
        document.body.classList.remove('forme-active');
        const b = $('forme-banniere'); if (b) b.remove();
        document.querySelectorAll('.forme-attaques').forEach(x => x.remove());
        if (!opt.depuisEffet && window.EffetsActifs) window.EffetsActifs.terminerSi(x => x.forme, 'forme');
        if (window.SheetApi && window.SheetApi.refresh) window.SheetApi.refresh();
        if (window.ArmorWidget && window.ArmorWidget.refresh) window.ArmorWidget.refresh();
        const pourquoi = { '0pv': 'à 0 point de vie', pvtemp: 'plus de points de vie temporaires', etat: 'état', effet: 'durée écoulée' }[opt.raison];
        if (!opt.silencieux || opt.raison === '0pv' || opt.raison === 'pvtemp' || opt.raison === 'etat') {
            toast(`🐾 Tu reprends ta forme${pourquoi ? ' (' + pourquoi + ')' : ''}. ${notes.join(' ')}`, 'info');
        }
        document.dispatchEvent(new CustomEvent('forme:fin', { detail: { type: f.type, raison: opt.raison || 'manuel' } }));
        return true;
    }

    // ---------- Le bandeau et les attaques ----------
    function banniere(f) {
        let b = $('forme-banniere');
        if (!b) {
            b = document.createElement('section');
            b.id = 'forme-banniere';
            b.className = 'forme-banniere no-print';
            b.setAttribute('aria-label', 'Forme en cours');
            const ancre = document.querySelector('#app-screen .sheet-header') || document.querySelector('.sheet-header');
            if (ancre && ancre.parentNode) ancre.parentNode.insertBefore(b, ancre.nextSibling);
            else document.body.appendChild(b);
        }
        const bete = f.bete;
        const pv = f.edition === '2014' ? `PV de la bête ${bete.hp}` : `${f.pvTempSort} PV temporaires`;
        b.innerHTML = `<span class="forme-ico" aria-hidden="true">🐾</span>
            <div class="forme-txt"><b>${esc(NOM_TYPE[f.type])} : ${esc(bete.nom)}</b>
            <span>FP ${esc(fpTexte(fp(bete.cr)))} · CA ${esc(bete.ac)} · ${esc(pv)} · ${esc(bete.speed)} · ${esc(f.remplacees.map(k => window.Calcul ? window.Calcul.ABREGE[k] : k).join(', '))} de la bête</span>
            ${(bete.traits || []).length ? `<details><summary>Traits</summary>${bete.traits.map(t => `<p><b>${esc(t.name)}.</b> ${esc(t.text)}</p>`).join('')}</details>` : ''}</div>
            <button type="button" class="btn-small forme-reprendre" data-forme-reprendre>Reprendre forme</button>`;
    }

    function panneauAttaques(f) {
        document.querySelectorAll('.forme-attaques').forEach(x => x.remove());
        const hote = document.querySelector('#widget-attacks .dynamic-box') || $('widget-attacks');
        if (!hote) return;
        const attaques = attaquesDe(f.bete);
        const bloc = document.createElement('div');
        bloc.className = 'forme-attaques no-print';
        bloc.innerHTML = `<p class="forme-att-titre">🐾 Attaques de ${esc(f.bete.nom)}</p>` + (attaques.map((a, i) => a.texte
            ? `<p class="forme-att-texte"><b>${esc(a.nom)}.</b> ${esc(a.texte)}</p>`
            : `<div class="forme-att"><span class="forme-att-nom">${esc(a.nom)}</span>
                <button type="button" class="gear-chip" data-forme-attaque="${i}" title="Toucher et dégâts"><span>Toucher</span><b>${a.bonus >= 0 ? '+' : ''}${a.bonus}</b></button>
                ${a.degats.length ? `<span class="forme-att-deg">${a.degats.map(d => esc(d.expr + ' ' + d.type)).join(' + ')}</span>` : ''}</div>`).join('')
            || '<p class="forme-att-texte">Aucune attaque dans le profil.</p>');
        const titre = hote.querySelector('.section-title-row');
        if (titre && titre.nextSibling) hote.insertBefore(bloc, titre.nextSibling); else hote.prepend(bloc);
        bloc._attaques = attaques;
    }

    // =====================================================
    // BRANCHEMENTS
    // =====================================================
    // Le moteur : la CA de la bête remplace celle du héros (les effets s'y ajoutent).
    let sansForme = false;
    function sourcesForme(cle, ctx) {
        const f = lire();
        if (!f || cle !== 'ca' || sansForme || !window.Calcul) return [];
        sansForme = true;
        let base = null;
        try {
            const r = window.Calcul.valeur('ca', ctx);
            if (r && r.total != null) base = r.sources.filter(s => s.origine !== 'effet').reduce((t, s) => t + s.valeur, 0);
        } finally { sansForme = false; }
        if (base == null || base === f.bete.ac) return [];
        return [{ libelle: `${f.bete.nom} (forme)`, valeur: f.bete.ac - base, origine: 'effet' }];
    }
    if (window.Calcul && window.Calcul.fournisseur) window.Calcul.fournisseur(sourcesForme);

    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-forme-reprendre]')) { e.preventDefault(); reprendre({ raison: 'manuel' }); return; }
        const att = e.target.closest('[data-forme-attaque]');
        if (att) {
            const bloc = att.closest('.forme-attaques');
            const a = bloc && bloc._attaques && bloc._attaques[entier(att.dataset.formeAttaque)];
            const f = lire();
            if (a && f && window.SheetApi && window.SheetApi.lancerAttaqueLibre) {
                window.SheetApi.lancerAttaqueLibre({ nom: a.nom, bonus: a.bonus, degats: a.degats, sousTitre: 'Forme : ' + f.bete.nom });
            }
        }
    });
    // PV : le retour automatique.
    function surPv(avant, apres, excedent) {
        const f = lire(); if (!f) return;
        if (f.edition === '2014' && apres.cur <= 0 && avant.cur > 0) reprendre({ raison: '0pv', excedent });
        else if (f.edition === '2024' && f.type === 'metamorphose' && apres.temp <= 0 && avant.temp > 0) reprendre({ raison: 'pvtemp' });
    }
    document.addEventListener('pv:change', (e) => { const d = e.detail || {}; if (d.avant && d.apres) surPv(d.avant, d.apres, d.excedent || 0); });
    document.addEventListener('change', (e) => {
        const t = e.target; if (!t || !t.id) return;
        const f = lire(); if (!f) return;
        if (t.id === 'hp-current' && f.edition === '2014' && entier(t.value) <= 0) reprendre({ raison: '0pv' });
        if (t.id === 'hp-temp' && f.edition === '2024' && f.type === 'metamorphose' && entier(t.value) <= 0) reprendre({ raison: 'pvtemp' });
        if (t.checked && f.type === 'forme-sauvage'
            && ((f.edition === '2024' && t.id === 'cond-incap') || (f.edition === '2014' && t.id === 'cond-uncon'))) reprendre({ raison: 'etat' });
    });

    window.Formes = { ouvrir, appliquer, reprendre, lire, active: () => !!lire(), limitesFormeSauvage, attaquesDe, reglesForme, refus };

    // Une fiche rouverte en pleine forme : la bête revient à l'écran, rien n'est réécrit.
    const f = lire();
    if (f) poserDom(f);
})();
