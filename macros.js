// =====================================================
// macros.js — modifier une macro de dés (LOT 5.3)
//
// Chargé à la demande, au premier clic sur ✎ d'une macro. La liste, son rendu
// et son glisser-déposer restent dans script.js (window.SheetMacros) : ce
// module n'apporte que la fenêtre d'édition.
//
// Une macro reste { name, formula } — ce que lisent l'export, les exploits et
// les fiches d'avant. S'y ajoutent, facultatifs : `id`, `icone` (une des
// icônes ci-dessous) et `couleur` (un ton du site, jamais une couleur libre).
// =====================================================
(function () {
    'use strict';

    const ICONES = ['🎲', '⚔️', '🏹', '🗡️', '🔥', '❄️', '⚡', '✨', '🩸', '💀', '🛡️', '❤️'];
    const TONS = [
        ['', 'Sans couleur'], ['sang', 'Sang'], ['laiton', 'Laiton'], ['foret', 'Forêt'],
        ['nuit', 'Nuit'], ['ambre', 'Ambre'], ['encre', 'Encre']
    ];
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    async function modifier(index) {
        const S = window.SheetMacros; if (!S) return false;
        const liste = S.liste();
        const m = liste[index];
        if (!m) return false;
        let zone = null;

        const res = await window.Dialogue.fenetre({
            titre: 'Modifier la macro', icone: '🎲', confirmer: 'Enregistrer', annuler: 'Annuler', annule: null,
            corps() {
                zone = document.createElement('div');
                zone.className = 'macro-form';
                const iconeActuelle = ICONES.includes(m.icone) ? m.icone : '';
                const tonActuel = TONS.some(t => t[0] === m.couleur) ? m.couleur : '';
                zone.innerHTML = `
                    <div class="dlg-champ"><label for="macro-f-nom">Nom</label>
                        <input id="macro-f-nom" class="dlg-saisie" type="text" maxlength="60" autocomplete="off" value="${esc(m.name)}"></div>
                    <div class="dlg-champ"><label for="macro-f-formule">Formule</label>
                        <input id="macro-f-formule" class="dlg-saisie" type="text" maxlength="120" autocomplete="off" spellcheck="false" value="${esc(m.formula)}" placeholder="1d8+3d6+4"></div>
                    <fieldset class="macro-choix-groupe"><legend>Icône</legend>
                        <div class="macro-choix" role="radiogroup" aria-label="Icône">
                            <label class="macro-choix-opt"><input type="radio" name="macro-f-icone" value=""${iconeActuelle ? '' : ' checked'}><span class="macro-choix-carte">Aucune</span></label>
                            ${ICONES.map(ic => `<label class="macro-choix-opt"><input type="radio" name="macro-f-icone" value="${ic}"${ic === iconeActuelle ? ' checked' : ''}><span class="macro-choix-carte" aria-label="${ic}">${ic}</span></label>`).join('')}
                        </div></fieldset>
                    <fieldset class="macro-choix-groupe"><legend>Couleur</legend>
                        <div class="macro-choix" role="radiogroup" aria-label="Couleur">
                            ${TONS.map(([v, nom]) => `<label class="macro-choix-opt"><input type="radio" name="macro-f-ton" value="${v}"${v === tonActuel ? ' checked' : ''}><span class="macro-choix-carte macro-ton${v ? ' ton-' + v : ''}">${esc(nom)}</span></label>`).join('')}
                        </div></fieldset>
                    ${liste.length > 1 ? `<div class="dlg-champ"><label for="macro-f-rang">Position</label>
                        <select id="macro-f-rang" class="dlg-saisie">${liste.map((_, i) => `<option value="${i}"${i === index ? ' selected' : ''}>${i + 1}${i === 0 ? ' (en premier)' : (i === liste.length - 1 ? ' (en dernier)' : '')}</option>`).join('')}</select></div>` : ''}`;
                return zone;
            },
            resultat(signaler) {
                const nom = zone.querySelector('#macro-f-nom').value.trim();
                const formule = zone.querySelector('#macro-f-formule').value.trim();
                if (!nom) { signaler('Donne un nom à la macro.'); return undefined; }
                if (!S.valide(formule)) { signaler('Formule invalide. Exemples : 2d6+3, 1d8+3d6+4, 8d6.'); return undefined; }
                const rang = zone.querySelector('#macro-f-rang');
                return {
                    nom, formule,
                    icone: (zone.querySelector('input[name="macro-f-icone"]:checked') || {}).value || '',
                    ton: (zone.querySelector('input[name="macro-f-ton"]:checked') || {}).value || '',
                    rang: rang ? parseInt(rang.value, 10) : index
                };
            }
        });
        if (!res) return false;
        const i = liste.indexOf(m);
        if (i < 0) return false;
        m.name = res.nom;
        m.formula = res.formule;
        if (res.icone) m.icone = res.icone; else delete m.icone;
        if (res.ton) m.couleur = res.ton; else delete m.couleur;
        if (!m.id) m.id = 'm' + Date.now().toString(36);
        if (res.rang !== i && res.rang >= 0 && res.rang < liste.length) {
            liste.splice(i, 1);
            liste.splice(res.rang, 0, m);
        }
        S.enregistrer();
        if (window.showAppToast) window.showAppToast('🎲 Macro « ' + m.name + ' » enregistrée', 'reussite');
        return true;
    }

    window.Macros = { modifier, ICONES, TONS };
})();
