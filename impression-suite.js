// =====================================================
// impression-suite.js — les pages de suite de la fiche imprimée (LOT 7.1)
//
// Chargé à la demande par print-sheet.js, et seulement quand la fiche
// déborde. Les pages 1 et 2 restent la fiche officielle, telles quelles ;
// ici s'écrit ce qui n'y tenait pas, en HTML, dans la même iframe :
//   · Grimoire — les sorts restés hors de la table de la page 2 ;
//   · Sac et trésor — la bourse, tout le sac, les attaques au-delà de six ;
//   · Traits et capacités — avec leurs descriptions, que la page 1 ne
//     peut pas porter ;
//   · Notes — l'apparence et l'histoire quand elles débordent, puis les
//     notes rapides, les quêtes, les PNJ et les lieux, qui n'ont aucune case.
// Les libellés sont imprimés ; ce que le joueur a écrit prend l'écriture
// choisie (manuscrit ou imprimé).
//
//   ImpressionSuite.pages({ besoins, ecriture, encre, police, polices,
//                           lire(cle), valeur(id), nom, mention })
//     → { html, css, sections: ['sorts', 'sac', 'traits', 'notes'] }
// =====================================================
(function () {
    'use strict';

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const net = (v) => String(v == null ? '' : v).trim();
    const multi = (s) => esc(net(s)).replace(/\r?\n/g, '<br>');
    const liste = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
    const niveauDe = (sp) => parseInt(sp && sp.level, 10) || 0;
    // Les mêmes libellés que le carnet (script.js, ATTITUDES).
    const ATTITUDES = { allie: 'Allié', neutre: 'Neutre', hostile: 'Hostile', inconnu: 'Inconnu' };
    const COCHE = '✓';

    /** « @[Nom](pnj:id) » → le nom actuel du PNJ ou du lieu, sinon le nom écrit. */
    function sansMentions(texte, noms) {
        return String(texte || '').replace(/@\[([^\]]*)\]\((pnj|lieu):([^)\s]+)\)/g,
            (m, ecrit, type, id) => noms.get(type + ':' + id) || ecrit);
    }

    const ecrit = (s, bloc) => s ? `<span class="ecrit${bloc ? ' bloc' : ''}">${s}</span>` : '';

    // =====================================================
    // GRIMOIRE
    // =====================================================
    function sectionSorts(sorts) {
        const tries = sorts.slice().sort((a, b) => (niveauDe(a) - niveauDe(b)) || String(a.name).localeCompare(String(b.name), 'fr'));
        // Mêmes lectures que le grimoire et que la page 2.
        const conc = (sp) => /concentration/i.test(sp.duration || '');
        const rituel = (sp) => (sp.rituel != null ? !!sp.rituel : /\brituel\b/i.test(sp.time || ''));
        const comp = (sp) => {
            const c = sp.comp;
            if (c && typeof c === 'object') return [c.v && 'V', c.s && 'S', c.m && 'M'].filter(Boolean).join(', ') + (c.m && net(c.mat) ? ' (' + net(c.mat) + ')' : '');
            return net(sp.res);
        };
        const lignes = tries.map(sp => `<tr>
            <td class="n">${ecrit(niveauDe(sp) === 0 ? '✦' : String(niveauDe(sp)))}</td>
            <td>${ecrit(esc(net(sp.name)))}${net(sp.notes) ? `<div class="meta">${esc(net(sp.notes))}</div>` : ''}</td>
            <td>${ecrit(esc(net(sp.time)))}</td><td>${ecrit(esc(net(sp.range)))}</td><td>${ecrit(esc(net(sp.duration)))}</td>
            <td>${ecrit(esc(comp(sp)))}</td>
            <td class="n">${conc(sp) ? ecrit(COCHE) : ''}</td><td class="n">${rituel(sp) ? ecrit(COCHE) : ''}</td><td class="n">${sp.prepared ? ecrit(COCHE) : ''}</td>
        </tr>`).join('');
        return `<section class="bloc-suite" data-suite="sorts">
            <h2>Grimoire <small>suite de la page 2</small></h2>
            <p class="aide">La table de la page 2 compte trente lignes, réservées d’abord aux sorts mineurs et aux sorts préparés. Voici les sorts du grimoire qui n’y figurent pas.</p>
            <table><thead><tr><th class="n">Niv.</th><th>Sort</th><th>Incantation</th><th>Portée</th><th>Durée</th><th>Composantes</th>
                <th class="n" title="Concentration">Conc.</th><th class="n" title="Rituel">Rit.</th><th class="n" title="Préparé">Prép.</th></tr></thead>
            <tbody>${lignes}</tbody></table></section>`;
    }

    // =====================================================
    // SAC ET TRÉSOR
    // =====================================================
    function sectionSac(lire, valeur) {
        const bourse = [['pp', 'pp'], ['po', 'po'], ['pe', 'pe'], ['pa', 'pa'], ['pc', 'pc']]
            .map(([cle, libelle]) => [net(valeur('coin-' + cle)), libelle])
            .filter(([v]) => v && v !== '0');
        const sac = liste(lire('dnd-inventory')).filter(it => net(it.name));
        const ordre = liste(lire('dnd-inv-categories')).map(String);
        const categories = [];
        sac.forEach(it => { const c = net(it.category) || 'Général'; if (!categories.includes(c)) categories.push(c); });
        categories.sort((a, b) => {
            const ia = ordre.indexOf(a), ib = ordre.indexOf(b);
            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        });
        const ligne = (it) => {
            const details = [net(it.rarity), it.attuned ? 'lié' : (it.attunement ? 'liaison requise' : ''), it.equipped ? 'équipé' : '']
                .filter(Boolean).join(' · ');
            const charges = it.chargesMax != null && it.chargesMax !== '' ? `${it.charges == null ? '' : it.charges}/${it.chargesMax}` : '';
            const poids = net(it.weight) === '-' ? '' : net(it.weight);
            const texte = [net(it.notes), net(it.desc)].filter(Boolean);
            return `<tr><td class="n">${ecrit(esc(String(parseInt(it.qty, 10) || 1)))}</td>
                <td>${ecrit(esc(net(it.name)))}${details ? `<div class="meta">${esc(details)}</div>` : ''}</td>
                <td class="n">${ecrit(esc(poids))}</td><td class="n">${ecrit(esc(net(it.value)))}</td><td class="n">${ecrit(esc(charges))}</td>
                <td>${texte.length ? ecrit(texte.map(multi).join('<br>')) : ''}</td></tr>`;
        };
        const tableaux = categories.map(c => `<h3>${esc(c)}</h3>
            <table><thead><tr><th class="n">Qté</th><th>Objet</th><th class="n">Poids</th><th class="n">Valeur</th><th class="n">Charges</th><th>Description et notes</th></tr></thead>
            <tbody>${sac.filter(it => (net(it.category) || 'Général') === c).map(ligne).join('')}</tbody></table>`).join('');

        const attaques = liste(lire('dnd-attacks'));
        const surplus = attaques.length > 6 ? `<h3>Attaques <small>au-delà des six lignes de la page 1</small></h3>
            <table class="attaques"><thead><tr><th>Arme ou attaque</th><th class="n">Bonus</th><th>Dégâts</th><th>Notes</th></tr></thead><tbody>${
                attaques.slice(6).map(a => `<tr><td>${ecrit(esc(net(a.name)))}</td><td class="n">${ecrit(esc(net(a.bonus)))}</td>
                    <td>${ecrit(esc([a.dmg, a.dmgType].map(net).filter(Boolean).join(' ')))}</td>
                    <td>${ecrit(esc([a.notes, a.props, a.range].map(net).filter(Boolean).join(' · ')))}</td></tr>`).join('')
            }</tbody></table>` : '';

        return `<section class="bloc-suite" data-suite="sac">
            <h2>Sac et trésor <small>suite de la page 2</small></h2>
            ${bourse.length ? `<p class="bourse"><b>Bourse</b> ${bourse.map(([v, l]) => ecrit(esc(v)) + ' ' + l).join(' · ')}</p>` : ''}
            ${tableaux || '<p class="aide">Le sac est vide.</p>'}
            ${surplus}</section>`;
    }

    // =====================================================
    // TRAITS ET CAPACITÉS
    // =====================================================
    function sectionTraits(lire) {
        const deuxMille24 = !!(window.Edition && window.Edition.est2024());
        const traits = liste(lire('dnd-traits')).filter(t => net(t.name));
        const GROUPES = [
            ['class', 'Capacités de classe'],
            ['race', deuxMille24 ? 'Traits d’espèce' : 'Traits raciaux'],
            ['feat', 'Dons et historique']          // le formulaire des traits dit « Don / Historique »
        ];
        const connus = GROUPES.map(g => g[0]);
        const item = (nom, sous, desc) => `<div class="item"><h4>${ecrit(esc(nom))}${sous ? ` <small>${esc(sous)}</small>` : ''}</h4>${desc ? `<p>${ecrit(multi(desc), true)}</p>` : ''}</div>`;
        const blocs = GROUPES.map(([type, titre]) => {
            const t = traits.filter(x => x.type === type);
            if (!t.length) return '';
            return `<h3>${titre}</h3>` + t.map(x => item(net(x.name), parseInt(x.level, 10) > 0 ? 'niveau ' + parseInt(x.level, 10) : '', net(x.desc))).join('');
        });
        const autres = traits.filter(x => !connus.includes(x.type));
        if (autres.length) blocs.push('<h3>Autres traits</h3>' + autres.map(x => item(net(x.name), '', net(x.desc))).join(''));
        const capacites = liste(lire('dnd-abilities')).filter(a => net(a.name));
        if (capacites.length) {
            blocs.push('<h3>Capacités à usage limité</h3>' + capacites.map(a => {
                const max = parseInt(a.max, 10) || 0;
                const sous = [max ? max + (max > 1 ? ' charges' : ' charge') : '', net(a.de) ? 'dé ' + net(a.de) : ''].filter(Boolean).join(' · ');
                return item(net(a.name), sous, '');
            }).join(''));
        }
        return `<section class="bloc-suite" data-suite="traits">
            <h2>Traits et capacités <small>suite de la page 1</small></h2>
            ${blocs.join('')}</section>`;
    }

    // =====================================================
    // NOTES, QUÊTES ET CARNET
    // =====================================================
    function sectionNotes(lire, valeur, histoire) {
        const pnj = liste(lire('dnd-npcs')), lieux = liste(lire('dnd-lieux'));
        const noms = new Map();
        pnj.forEach(x => { if (x.id) noms.set('pnj:' + x.id, net(x.title)); });
        lieux.forEach(x => { if (x.id) noms.set('lieu:' + x.id, net(x.title)); });
        const texte = (s) => multi(sansMentions(s, noms));
        const remplis = (l) => l.filter(x => net(x.title) || net(x.body));
        const carte = (titre, meta, corps) => `<div class="item"><h4>${ecrit(esc(titre) || '—')}${meta ? ` <small>${esc(meta)}</small>` : ''}</h4>${net(corps) ? `<p>${ecrit(texte(corps), true)}</p>` : ''}</div>`;
        const date = (iso) => {
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(net(iso));
            return m ? `${m[3]}/${m[2]}/${m[1]}` : net(iso);
        };
        const out = [];
        if (histoire) {
            const apparence = net(valeur('char-appearance')), recit = net(valeur('char-backstory'));
            if (apparence) out.push(`<h3>Apparence <small>suite de la page 2</small></h3><p>${ecrit(texte(apparence), true)}</p>`);
            if (recit) out.push(`<h3>Histoire et personnalité <small>suite de la page 2</small></h3><p>${ecrit(texte(recit), true)}</p>`);
        }
        const notes = remplis(liste(lire('dnd-quick-notes')));
        if (notes.length) out.push('<h3>Notes rapides</h3>' + notes.map(n => carte(net(n.title), '', n.body)).join(''));
        const quetes = remplis(liste(lire('dnd-quests')));
        const enCours = quetes.filter(q => !q.done), finies = quetes.filter(q => q.done);
        if (enCours.length) out.push('<h3>Quêtes en cours</h3>' + enCours.map(q => carte(net(q.title), '', q.body)).join(''));
        if (finies.length) out.push('<h3>Quêtes terminées</h3>' + finies.map(q => carte(net(q.title), 'terminée', q.body)).join(''));
        const gens = remplis(pnj);
        if (gens.length) out.push('<h3>PNJ</h3>' + gens.map(n => carte(net(n.title),
            [ATTITUDES[n.attitude] || '', net(n.faction), [date(n.rencontreDate), net(n.rencontreLieu)].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
            n.body)).join(''));
        const endroits = remplis(lieux);
        if (endroits.length) out.push('<h3>Lieux</h3>' + endroits.map(l => carte(net(l.title),
            [net(l.region), net(l.type), date(l.visite)].filter(Boolean).join(' · '), l.body)).join(''));
        if (!out.length) return '';
        return `<section class="bloc-suite" data-suite="notes"><h2>Notes, quêtes et carnet</h2>${out.join('')}</section>`;
    }

    // =====================================================
    // LA FEUILLE DE STYLE ET L'ASSEMBLAGE
    // =====================================================
    function css(o) {
        const faces = (o.polices || []).map(p => `@font-face { font-family: "${p.famille}"; src: url("${p.url}") format("woff2"); font-weight: ${p.poids}; font-style: normal; }`).join('\n');
        const manuscrit = o.ecriture === 'manuscrit';
        return `
        ${faces}
        @page suite { size: A4 portrait; margin: 12mm 12mm 14mm; }
        .suite { page: suite; break-before: page; page-break-before: always; font: 9pt/1.38 Georgia, "Times New Roman", serif; color: #231d18; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .suite-bandeau { display: flex; justify-content: space-between; align-items: baseline; gap: 4mm; margin: 0 0 4mm; padding-bottom: 1.5mm; border-bottom: .6mm double #7a2828; font: 700 7.5pt/1.2 Arial, Helvetica, sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #7a2828; }
        .bloc-suite { margin: 0 0 7mm; }
        .suite h2 { margin: 0 0 1.5mm; font: 700 13pt/1.2 Georgia, serif; color: #7a2828; break-after: avoid; page-break-after: avoid; }
        .suite h2 small, .suite h3 small { margin-left: 2mm; font: italic 400 8pt Georgia, serif; color: #6b5a48; }
        .suite h3 { margin: 4mm 0 1.5mm; padding-bottom: .6mm; border-bottom: .3mm solid #c49b35; font: 700 9.5pt/1.2 Georgia, serif; color: #7a2828; break-after: avoid; page-break-after: avoid; }
        .suite .aide { margin: 0 0 2mm; font-style: italic; font-size: 8pt; color: #6b5a48; }
        .suite table { width: 100%; border-collapse: collapse; }
        .suite thead { display: table-header-group; }
        .suite th { padding: 1mm 1.2mm; border-bottom: .4mm solid #7a2828; text-align: left; font: 700 6.4pt/1.2 Arial, Helvetica, sans-serif; letter-spacing: .04em; text-transform: uppercase; color: #7a2828; }
        .suite td { padding: .9mm 1.2mm; border-bottom: .2mm solid #ddd3c4; vertical-align: top; }
        .suite tr { break-inside: avoid; page-break-inside: avoid; }
        .suite .n { width: 1%; white-space: nowrap; text-align: center; }
        .suite .meta { font: 7pt/1.25 Arial, Helvetica, sans-serif; color: #6b5a48; }
        .suite .bourse { margin: 0 0 2mm; }
        .suite .bourse b { margin-right: 2mm; font: 700 7pt Arial, Helvetica, sans-serif; text-transform: uppercase; letter-spacing: .06em; color: #7a2828; }
        .suite .item { margin: 0 0 2.2mm; break-inside: avoid; page-break-inside: avoid; }
        .suite .item h4 { margin: 0; font: 700 9pt/1.25 Georgia, serif; }
        .suite .item h4 small { margin-left: 1.5mm; font: 400 7pt Arial, Helvetica, sans-serif; color: #6b5a48; }
        .suite .item p, .suite h3 + p { margin: .4mm 0 0; }
        .suite .ecrit { font-family: ${o.police}; color: ${o.encre}; font-size: ${manuscrit ? '1.22em' : '1em'}; line-height: ${manuscrit ? 1.15 : 1.35}; }
        .suite .ecrit.bloc { display: inline; }
        .suite .attrib { margin-top: 6mm; padding-top: 2mm; border-top: .2mm solid #ccc; font: 6pt/1.35 Arial, Helvetica, sans-serif; color: #666; text-align: center; }
        .suite .attrib b { font-weight: 700; }
        `;
    }

    function pages(o) {
        const b = o.besoins || {};
        const lire = typeof o.lire === 'function' ? o.lire : () => null;
        const valeur = typeof o.valeur === 'function' ? o.valeur : () => '';
        const blocs = [], sections = [];
        const ajouter = (nom, html) => { if (html) { blocs.push(html); sections.push(nom); } };
        if (b.sorts && b.sorts.length) ajouter('sorts', sectionSorts(b.sorts));
        if (b.sac) ajouter('sac', sectionSac(lire, valeur));
        if (b.traits) ajouter('traits', sectionTraits(lire));
        if (b.notes) ajouter('notes', sectionNotes(lire, valeur, !!b.histoire));
        if (!blocs.length) return { html: '', css: '', sections: [] };
        const html = `<div class="suite">
            <div class="suite-bandeau"><span>${esc(o.nom || 'Personnage')} — pages de suite</span><span>Bones &amp; Blades</span></div>
            ${blocs.join('')}
            ${o.mention ? `<p class="attrib">${o.mention}</p>` : ''}
        </div>`;
        return { html, css: css(o), sections };
    }

    window.ImpressionSuite = { pages };
})();
