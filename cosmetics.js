// =====================================================
// cosmetics.js — l'apparence, gratuite et payante
//
// Quatre familles, un seul panneau : matières de dés, fonds de page,
// couleurs, cadres. Chaque article est soit gratuit, soit conditionné à un
// droit d'accès (Ent.has).
//
// Le verrou est ICI, dans le navigateur : contournable, et ce n'est pas grave.
// Débloquer un cadre en trichant dans la console ne coûte rien à personne et
// ne consomme aucune ressource. Tout ce qui touche aux serveurs — nombre de
// fiches synchronisées, quota d'images — est refusé par la base (lot 4), pas
// par ce fichier.
//
// Rien n'est stocké par personnage : ce sont des réglages d'appareil, écrits
// sous le préfixe `dnd-` comme le reste des préférences globales.
// =====================================================
(function () {
    'use strict';

    const get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
    const del = (k) => { try { localStorage.removeItem(k); } catch (e) {} };
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const owned = (ent) => !ent || (window.Ent ? window.Ent.has(ent) : false);

    // =====================================================
    // Le catalogue
    // `ent` = le droit d'accès requis ; absent = gratuit.
    // =====================================================

    // --- Fonds de page ---
    // Tout en CSS : aucune image à télécharger, aucun octet de plus, et ça
    // s'adapte au thème clair comme au sombre.
    const BACKGROUNDS = [
        { key: '',         nom: 'Illustration',  desc: 'Le fond peint d’origine.' },
        { key: 'velin',    nom: 'Vélin',         desc: 'Un parchemin clair et calme.' },
        { key: 'encre',    nom: 'Encre',         desc: 'Un lavis sombre, pour les tables de nuit.' },
        { key: 'nuit',     nom: 'Nuit d’encre',  desc: 'Bleu profond et étoiles pâles.',  ent: 'fonds-de-page' },
        { key: 'braise',   nom: 'Braises',       desc: 'La lueur d’un feu de camp.',      ent: 'fonds-de-page' },
        { key: 'foret',    nom: 'Sous-bois',     desc: 'Vert sombre et lumière filtrée.', ent: 'fonds-de-page' },
        { key: 'pierre',   nom: 'Pierre',        desc: 'Le donjon, tout simplement.',     ent: 'fonds-de-page' }
    ];

    // --- Palettes ---
    // Trois prédéfinies restent gratuites, comme promis dans les CGU.
    const PALETTES = [
        { key: 'academia', nom: 'Academia', desc: 'Sang de bœuf et laiton. La maison.',
          colors: { 'dnd-theme-primary': '#7A2828', 'dnd-theme-accent': '#C49B35' } },
        { key: 'foret', nom: 'Forêt', desc: 'Vert profond et vieil or.',
          colors: { 'dnd-theme-primary': '#2c5f3f', 'dnd-theme-accent': '#b89b4a' } },
        { key: 'nuit', nom: 'Nuit', desc: 'Indigo et argent.',
          colors: { 'dnd-theme-primary': '#2f3b6b', 'dnd-theme-accent': '#9fb3c8' } }
    ];

    // --- Cadres ---
    const FRAMES = [
        { key: '',         nom: 'Aucun',     desc: 'Sans encadrement.' },
        { key: 'laiton',   nom: 'Laiton',    desc: 'Un jonc doré, discret.',        ent: 'cadres' },
        { key: 'oxblood',  nom: 'Sang',      desc: 'Un liseré rouge sombre.',       ent: 'cadres' },
        { key: 'runes',    nom: 'Runes',     desc: 'Traits gravés aux quatre coins.', ent: 'cadres' },
        { key: 'feuilles', nom: 'Feuillage', desc: 'Une vrille végétale.',          ent: 'cadres' }
    ];

    const MAX_THEMES = 12;      // thèmes enregistrés, réservés à la palette libre

    // =====================================================
    // Application
    // =====================================================

    function applyAll() {
        applyBackground();
        applyFrames();
        // Les couleurs restent gérées par script.js : une seule vérité.
        window.applyTheme?.();
    }

    /** Le fond choisi. Une image envoyée par l'utilisateur l'emporte toujours :
     *  c'est le réglage le plus explicite qu'il ait pu faire. */
    function applyBackground() {
        let key = get('dnd-bg-style') || '';
        const item = BACKGROUNDS.find(b => b.key === key);
        // Droit perdu (abonnement fini, achat révoqué) : on retombe sur le fond
        // d'origine sans rien casser ni rien effacer.
        if (item && !owned(item.ent)) key = '';
        document.body.setAttribute('data-bg', key);
    }

    function applyFrames() {
        [['portrait', 'dnd-frame-portrait'], ['sheet', 'dnd-frame-sheet']].forEach(([attr, k]) => {
            let key = get(k) || '';
            const item = FRAMES.find(f => f.key === key);
            if (item && !owned(item.ent)) key = '';
            document.body.setAttribute('data-frame-' + attr, key);
        });
    }

    function applyPalette(p) {
        if (!p) return;
        // On efface d'abord toutes les couleurs perso, sinon un réglage laissé
        // d'un ancien thème survivrait au changement.
        (window.THEME_COLOR_KEYS || []).forEach(del);
        Object.entries(p.colors).forEach(([k, v]) => set(k, v));
        set('dnd-theme-palette', p.key);
        window.applyTheme?.();
    }

    // --- Thèmes enregistrés (palette libre) ---
    const savedThemes = () => { try { return JSON.parse(get('dnd-theme-saved') || '[]') || []; } catch (e) { return []; } };
    const writeThemes = (l) => set('dnd-theme-saved', JSON.stringify(l.slice(0, MAX_THEMES)));

    function saveCurrentTheme(nom) {
        const colors = {};
        (window.THEME_COLOR_KEYS || []).forEach(k => { const v = get(k); if (v) colors[k] = v; });
        if (!Object.keys(colors).length) return { error: 'Aucune couleur personnalisée à enregistrer.' };
        const list = savedThemes();
        if (list.length >= MAX_THEMES) return { error: `Douze thèmes au maximum. Supprimes-en un d’abord.` };
        list.push({ id: 't' + Date.now(), nom: String(nom || 'Sans nom').trim().slice(0, 40) || 'Sans nom', colors });
        writeThemes(list);
        return { ok: true };
    }

    // =====================================================
    // Le panneau
    // =====================================================

    let currentTab = 'des';

    function lockHtml(ent) {
        return `<span class="cos-lock" title="Débloqué par un achat">🔒</span>`;
    }

    function cardHtml(o) {
        // o : {key, nom, desc, ent, active, preview}
        const ok = owned(o.ent);
        return `<button type="button" class="cos-card${o.active ? ' is-on' : ''}${ok ? '' : ' is-locked'}"
                    data-cos-pick="${esc(o.key)}" ${ok ? '' : 'data-cos-locked="1"'}>
            ${o.preview || ''}
            <span class="cos-card-name">${esc(o.nom)}${ok ? '' : ' ' + lockHtml(o.ent)}</span>
            <span class="cos-card-desc">${esc(o.desc || '')}</span>
        </button>`;
    }

    function tabDes() {
        const mats = window.getDiceMaterials ? window.getDiceMaterials() : [];
        if (!mats.length) {
            return `<p class="cos-note">Le plateau de dés 3D n’est pas encore chargé. Lance un dé une
                fois, puis reviens ici.</p>`;
        }
        return `<p class="cos-note">La matière change l’aspect des dés 3D, jamais les résultats :
                le hasard reste le même pour tout le monde.</p>
            <div class="cos-cards">${mats.map(m => cardHtml({
                key: m.key, nom: m.name, ent: m.key === 'standard' ? null : m.key,
                active: m.active,
                desc: m.ready === false ? 'Indisponible sur cet appareil' : '',
                preview: `<span class="cos-die" style="--die:${m.color || 'var(--primary-color)'}">20</span>`
            })).join('')}</div>`;
    }

    function tabFonds() {
        const cur = get('dnd-bg-style') || '';
        const hasImage = !!get('dnd-custom-background-image');
        return `<p class="cos-note">Un fond de page habille tout le site. Il est enregistré sur cet
                appareil seulement.</p>
            ${hasImage ? `<div class="cos-warn">Une image personnelle est active : elle passe devant
                le fond choisi ici. <button type="button" class="cos-link" data-cos-act="clear-image">
                Retirer l’image</button></div>` : ''}
            <div class="cos-cards">${BACKGROUNDS.map(b => cardHtml({
                key: b.key, nom: b.nom, desc: b.desc, ent: b.ent, active: b.key === cur,
                preview: `<span class="cos-bg-preview" data-bg-preview="${esc(b.key)}"></span>`
            })).join('')}</div>
            <div class="cos-block">
                <h3 class="cos-h">Ton propre fond</h3>
                <p class="cos-note">Une image à toi, redimensionnée et gardée sur cet appareil.</p>
                ${owned('fonds-de-page')
                    ? `<button type="button" class="cos-btn" data-cos-act="pick-image">📷 Choisir une image</button>`
                    : `<button type="button" class="cos-btn is-off" data-cos-locked="1">🔒 Choisir une image</button>`}
            </div>`;
    }

    function tabCouleurs() {
        const cur = get('dnd-theme-palette') || '';
        const libre = owned('palette-libre');
        const list = savedThemes();
        return `<p class="cos-note">Trois palettes sont offertes. La palette libre ouvre les cinq
                sélecteurs de couleurs et permet d’enregistrer tes propres thèmes.</p>
            <div class="cos-cards">${PALETTES.map(p => cardHtml({
                key: p.key, nom: p.nom, desc: p.desc, active: p.key === cur,
                preview: `<span class="cos-palette">
                    <i style="background:${esc(p.colors['dnd-theme-primary'])}"></i>
                    <i style="background:${esc(p.colors['dnd-theme-accent'])}"></i></span>`
            })).join('')}</div>
            <div class="cos-block">
                <h3 class="cos-h">Palette libre ${libre ? '' : lockHtml('palette-libre')}</h3>
                ${libre
                    ? `<p class="cos-note">Les sélecteurs sont dans le menu ☰ → Apparence. Une fois tes
                           couleurs réglées, enregistre-les ici.</p>
                       <div class="cos-save">
                           <input type="text" class="cos-theme-name" maxlength="40"
                                  placeholder="Nom du thème" aria-label="Nom du thème">
                           <button type="button" class="cos-btn" data-cos-act="save-theme">Enregistrer</button>
                       </div>
                       ${list.length ? `<div class="cos-saved">${list.map(t => `
                           <span class="cos-saved-item">
                               <button type="button" class="cos-saved-load" data-cos-load="${esc(t.id)}">${esc(t.nom)}</button>
                               <button type="button" class="cos-saved-del" data-cos-del="${esc(t.id)}"
                                       aria-label="Supprimer ${esc(t.nom)}">✕</button>
                           </span>`).join('')}</div>`
                        : `<p class="cos-note">Aucun thème enregistré pour l’instant.</p>`}`
                    : `<p class="cos-note">Sans la palette libre, les cinq sélecteurs restent
                           désactivés et seules les trois palettes ci-dessus s’appliquent.</p>`}
                <button type="button" class="cos-link" data-cos-act="reset-colors">Revenir aux couleurs d’origine</button>
            </div>`;
    }

    function tabCadres() {
        const p = get('dnd-frame-portrait') || '', s = get('dnd-frame-sheet') || '';
        const bloc = (titre, attr, cur) => `<div class="cos-block">
            <h3 class="cos-h">${esc(titre)}</h3>
            <div class="cos-cards">${FRAMES.map(f => cardHtml({
                key: f.key, nom: f.nom, desc: f.desc, ent: f.ent, active: f.key === cur,
                preview: `<span class="cos-frame-preview" data-frame-preview="${esc(f.key)}"></span>`
            })).join('').replace(/data-cos-pick=/g, `data-cos-frame="${attr}" data-cos-pick=`)}</div>
        </div>`;
        return bloc('Cadre du portrait', 'portrait', p) + bloc('Cadre de la fiche', 'sheet', s);
    }

    const TABS = [
        { id: 'des', nom: '🎲 Dés', render: tabDes },
        { id: 'fonds', nom: '🖼️ Fonds', render: tabFonds },
        { id: 'couleurs', nom: '🎨 Couleurs', render: tabCouleurs },
        { id: 'cadres', nom: '🖼 Cadres', render: tabCadres }
    ];

    function markup() {
        return `<div class="cos-panel" role="document">
            <header class="cos-head">
                <h2 class="cos-title">Apparence</h2>
                <button type="button" class="cos-x" data-cos-act="close" aria-label="Fermer">✕</button>
            </header>
            <nav class="cos-tabs">${TABS.map(t =>
                `<button type="button" class="cos-tab${t.id === currentTab ? ' is-on' : ''}"
                         data-cos-tab="${t.id}">${esc(t.nom)}</button>`).join('')}</nav>
            <div class="cos-body" id="cos-body"></div>
            <footer class="cos-foot">
                <span class="cos-foot-note">Le décor n’a aucun effet sur les règles.</span>
                <button type="button" class="cos-link" data-pricing-open="1">Voir les tarifs</button>
            </footer>
        </div>`;
    }

    function renderBody() {
        const box = document.getElementById('cos-body');
        if (!box) return;
        const tab = TABS.find(t => t.id === currentTab) || TABS[0];
        box.innerHTML = tab.render();
        document.querySelectorAll('#cosmetics .cos-tab').forEach(t =>
            t.classList.toggle('is-on', t.dataset.cosTab === currentTab));
    }

    function open(tab) {
        if (tab) currentTab = tab;
        document.getElementById('cosmetics')?.remove();
        const ov = document.createElement('div');
        ov.id = 'cosmetics';
        ov.className = 'no-print';
        ov.setAttribute('role', 'dialog');
        ov.setAttribute('aria-modal', 'true');
        ov.setAttribute('aria-label', 'Apparence');
        ov.innerHTML = markup();
        document.body.appendChild(ov);
        renderBody();

        const close = () => { ov.remove(); document.removeEventListener('keydown', onKey, true); };
        const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
        document.addEventListener('keydown', onKey, true);

        ov.addEventListener('click', (e) => {
            if (e.target === ov) return;

            const tabBtn = e.target.closest('[data-cos-tab]');
            if (tabBtn) { currentTab = tabBtn.dataset.cosTab; renderBody(); return; }

            // Un article verrouillé n'applique rien : il explique et renvoie
            // vers les tarifs. Jamais de faux déblocage.
            const locked = e.target.closest('[data-cos-locked]');
            if (locked) {
                if (window.Pricing) { close(); window.Pricing.open(); }
                else alert('Cet article fait partie des options payantes.');
                return;
            }

            const pick = e.target.closest('[data-cos-pick]');
            if (pick) { choose(pick); return; }

            const load = e.target.closest('[data-cos-load]');
            if (load) {
                const t = savedThemes().find(x => x.id === load.dataset.cosLoad);
                if (t) { applyPalette({ key: '', colors: t.colors }); set('dnd-theme-palette', ''); renderBody(); }
                return;
            }
            const kill = e.target.closest('[data-cos-del]');
            if (kill) { writeThemes(savedThemes().filter(x => x.id !== kill.dataset.cosDel)); renderBody(); return; }

            const act = e.target.closest('[data-cos-act]')?.dataset.cosAct;
            if (act === 'close') { close(); return; }
            if (act === 'clear-image') {
                del('dnd-custom-background-image');
                window.applySavedBackground?.(); applyBackground(); renderBody();
                return;
            }
            if (act === 'pick-image') { document.getElementById('bg-file-input')?.click(); return; }
            if (act === 'reset-colors') {
                (window.THEME_COLOR_KEYS || []).forEach(del);
                del('dnd-theme-palette');
                window.applyTheme?.(); renderBody();
                return;
            }
            if (act === 'save-theme') {
                const input = ov.querySelector('.cos-theme-name');
                const r = saveCurrentTheme(input && input.value);
                if (r.error) alert(r.error); else renderBody();
                return;
            }
        });
    }

    function choose(btn) {
        const key = btn.dataset.cosPick;
        if (currentTab === 'des') {
            window.setDiceMaterial?.(key);
        } else if (currentTab === 'fonds') {
            if (key) set('dnd-bg-style', key); else del('dnd-bg-style');
            applyBackground();
        } else if (currentTab === 'couleurs') {
            applyPalette(PALETTES.find(p => p.key === key));
        } else if (currentTab === 'cadres') {
            const which = btn.dataset.cosFrame === 'sheet' ? 'dnd-frame-sheet' : 'dnd-frame-portrait';
            if (key) set(which, key); else del(which);
            applyFrames();
        }
        renderBody();
    }

    // =====================================================
    // Branchements
    // =====================================================

    function mountMenu() {
        // Le panneau se range dans la rubrique Apparence, qui existe déjà.
        const body = document.querySelector('#settings-dropdown .menu-cat-body');
        const appear = [...document.querySelectorAll('#settings-dropdown .menu-cat')]
            .find(d => /Apparence/.test(d.querySelector('summary')?.textContent || ''));
        const host = appear ? appear.querySelector('.menu-cat-body') : body;
        if (!host || host.querySelector('.cos-menu-btn')) return;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn-menu-item cos-menu-btn';
        b.textContent = '✨ Dés, fonds, cadres…';
        b.addEventListener('click', () => {
            document.getElementById('settings-dropdown')?.classList.add('hidden');
            open();
        });
        host.insertBefore(b, host.firstChild);
    }

    /** Les couleurs libres ne s'ouvrent qu'avec le droit correspondant. */
    function gateColorPickers() {
        const libre = owned('palette-libre');
        document.querySelectorAll('#settings-dropdown .color-picker').forEach(inp => {
            inp.disabled = !libre;
            inp.title = libre ? '' : 'Palette libre : option payante';
            inp.closest('.menu-color')?.classList.toggle('is-locked', !libre);
        });
    }

    function init() {
        applyAll();
        mountMenu();
        gateColorPickers();
        // Les droits arrivent après la connexion : tout se remet à jour tout seul.
        window.Ent?.onChange(() => {
            applyAll();
            gateColorPickers();
            if (document.getElementById('cosmetics')) renderBody();
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.Cosmetics = { open, BACKGROUNDS, PALETTES, FRAMES, applyAll, savedThemes };
})();
