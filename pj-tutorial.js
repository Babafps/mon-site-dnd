// =====================================================
// pj-tutorial.js — Côté JOUEUR (Lot 27) :
//   1. ASSISTANT DE CRÉATION : à la première ouverture d'une
//      fiche fraîchement créée, un guide pas-à-pas propose de
//      remplir l'essentiel (nom, classe, niveau, espèce, caracs,
//      PV…). Skippable à tout moment ; ce qui est déjà saisi
//      est appliqué à la fiche (rien n'est perdu).
//   2. TUTORIEL DE LA FICHE : visite guidée (spotlight) des
//      fonctionnalités. Skippable, revisionnable depuis le menu ☰.
// Aucune dépendance : s'appuie uniquement sur les champs existants
// (dispatch input/change → la sauvegarde du site fait le reste).
// =====================================================
(function () {
    'use strict';

    const WIZ_FLAG = 'dnd-pj-wizard-pending';   // posé par script.js à la création d'une fiche
    const TUTO_FLAG = 'dnd-pj-tuto-done';       // tuto de la fiche déjà vu (global)

    function byId(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    // Écrit une valeur dans un champ RÉEL de la fiche + déclenche la sauvegarde du site.
    function setField(id, value) {
        const el = byId(id);
        if (!el || value === '' || value == null) return;
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // ---------- Données 5e proposées (datalists — saisie libre possible) ----------
    const CLASSES = ['Artificier', 'Barbare', 'Barde', 'Clerc', 'Druide', 'Ensorceleur', 'Guerrier', 'Magicien', 'Moine', 'Occultiste', 'Paladin', 'Rôdeur', 'Roublard'];
    const ESPECES = ['Humain', 'Elfe', 'Demi-elfe', 'Nain', 'Halfelin', 'Gnome', 'Drakéide', 'Demi-orc', 'Tieffelin', 'Aasimar', 'Goliath', 'Orc'];
    const HISTORIQUES = ['Acolyte', 'Artisan de guilde', 'Artiste', 'Charlatan', 'Criminel', 'Ermite', 'Héros du peuple', 'Marin', 'Noble', 'Sage', 'Sauvageon', 'Soldat', 'Vagabond'];
    const ALIGNEMENTS = ['Loyal Bon', 'Neutre Bon', 'Chaotique Bon', 'Loyal Neutre', 'Neutre', 'Chaotique Neutre', 'Loyal Mauvais', 'Neutre Mauvais', 'Chaotique Mauvais'];
    const STATS = [['str', 'Force'], ['dex', 'Dextérité'], ['con', 'Constitution'], ['int', 'Intelligence'], ['wis', 'Sagesse'], ['cha', 'Charisme']];

    // =====================================================
    // 1. ASSISTANT DE CRÉATION (wizard)
    // =====================================================
    let wizStep = 0;
    const wizData = {};   // valeurs saisies, appliquées à la fiche à la fermeture

    function wizardSteps() {
        const datalist = (id, arr) => `<datalist id="${id}">${arr.map(v => `<option value="${esc(v)}">`).join('')}</datalist>`;
        return [
            {
                title: '🧙 Bienvenue, aventurier !',
                html: `<p>Ta fiche est créée. Veux-tu que je te <b>guide pas à pas</b> pour remplir l'essentiel (classe, espèce, caractéristiques, PV…) ?</p>
                       <p class="pjw-note">Tu peux passer à tout moment : ce que tu as déjà saisi sera conservé, et tout reste modifiable sur la fiche ensuite.</p>`,
                choice: true
            },
            {
                title: '⚔️ Qui es-tu ?',
                html: `
                    <label class="pjw-lbl">Nom du personnage</label>
                    <input class="pjw-in" data-wiz="name" value="${esc((byId('char-name') || {}).value || '')}" placeholder="Ex : Thorgrim">
                    <label class="pjw-lbl">Classe</label>
                    <input class="pjw-in" data-wiz="class" list="pjw-classes" placeholder="Ex : Guerrier">${datalist('pjw-classes', CLASSES)}
                    <div class="pjw-2col">
                        <div><label class="pjw-lbl">Sous-classe</label>
                        <input class="pjw-in" data-wiz="subclass" placeholder="Vide si niveau < 3"></div>
                        <div><label class="pjw-lbl">Niveau</label>
                        <input class="pjw-in" data-wiz="level" type="number" min="1" max="20" value="1"></div>
                    </div>
                    <p class="pjw-note">Le bonus de maîtrise se calcule tout seul à partir du niveau.</p>`
            },
            {
                title: '🌍 D\'où viens-tu ?',
                html: `
                    <label class="pjw-lbl">Espèce / race</label>
                    <input class="pjw-in" data-wiz="race" list="pjw-especes" placeholder="Ex : Humain">${datalist('pjw-especes', ESPECES)}
                    <label class="pjw-lbl">Historique</label>
                    <input class="pjw-in" data-wiz="background" list="pjw-historiques" placeholder="Ex : Soldat">${datalist('pjw-historiques', HISTORIQUES)}
                    <label class="pjw-lbl">Alignement</label>
                    <input class="pjw-in" data-wiz="alignment" list="pjw-alignements" placeholder="Ex : Chaotique Bon">${datalist('pjw-alignements', ALIGNEMENTS)}`
            },
            {
                title: '💪 Tes caractéristiques',
                html: `
                    <p class="pjw-note">Répartition classique : <b>15, 14, 13, 12, 10, 8</b> — place les meilleures valeurs là où ta classe brille. Le modificateur s'affiche à côté.</p>
                    <div class="pjw-stats">` +
                    STATS.map(s => `<div class="pjw-stat"><label>${s[1]}</label><input class="pjw-in pjw-stat-in" data-wiz="stat-${s[0]}" type="number" min="1" max="30" value="10"><b class="pjw-mod" data-mod="${s[0]}">+0</b></div>`).join('') +
                    `</div>`
            },
            {
                title: '❤️ Points de vie & défense',
                html: `
                    <div class="pjw-2col">
                        <div><label class="pjw-lbl">PV maximum</label>
                        <input class="pjw-in" data-wiz="hpmax" type="number" min="1" placeholder="Ex : 12"></div>
                        <div><label class="pjw-lbl">Classe d'armure (CA)</label>
                        <input class="pjw-in" data-wiz="ac" type="number" min="1" placeholder="Ex : 16"></div>
                    </div>
                    <label class="pjw-lbl">Vitesse</label>
                    <input class="pjw-in" data-wiz="speed" value="9 m" placeholder="Ex : 9 m">
                    <p class="pjw-note">PV niveau 1 = dé de vie max + mod. de Constitution (ex : Guerrier 10 + 2 = 12).</p>`
            },
            {
                title: '🎉 C\'est prêt !',
                html: `<p>Je reporte tout ça sur ta fiche. Tu pourras <b>tout modifier</b> directement dessus, à tout moment.</p>
                       <p class="pjw-note">Juste après, je te fais visiter la fiche en 1 minute (ça aussi, tu peux passer 😉).</p>`
            }
        ];
    }

    function collectWizInputs() {
        const ov = byId('pj-wizard'); if (!ov) return;
        ov.querySelectorAll('[data-wiz]').forEach(inp => { wizData[inp.dataset.wiz] = inp.value.trim(); });
    }
    // Applique ce qui a été saisi aux VRAIS champs de la fiche (guards partout : selon la
    // disposition choisie, certains widgets peuvent ne pas exister).
    function applyWizData() {
        setField('char-name', wizData.name);
        setField('char-class', wizData.class);
        setField('char-subclass', wizData.subclass);
        setField('char-level', wizData.level);
        setField('char-race', wizData.race);
        setField('char-background', wizData.background);
        setField('char-alignment', wizData.alignment);
        STATS.forEach(s => setField('stat-' + s[0], wizData['stat-' + s[0]]));
        setField('hp-max', wizData.hpmax);
        setField('hp-current', wizData.hpmax);   // on démarre en pleine forme
        setField('armor-class', wizData.ac);
        setField('speed', wizData.speed);
    }
    function closeWizard(applyThenTuto) {
        collectWizInputs();
        applyWizData();                          // même en passant : rien de saisi n'est perdu
        const ov = byId('pj-wizard'); if (ov) ov.remove();
        if (applyThenTuto !== false) startPjTutorial(false);   // enchaîne sur la visite (si jamais vue)
    }
    function showWizStep() {
        const steps = wizardSteps();
        if (wizStep >= steps.length) { closeWizard(); return; }
        const st = steps[wizStep];
        let ov = byId('pj-wizard');
        if (!ov) {
            ov = document.createElement('div'); ov.id = 'pj-wizard'; ov.className = 'no-print';
            ov.innerHTML = '<div class="pjw-card" role="dialog" aria-label="Assistant de création"></div>';
            document.body.appendChild(ov);
        }
        const card = ov.querySelector('.pjw-card');
        const last = wizStep === steps.length - 1;
        const dots = steps.map((_, i) => `<span class="pjw-dot${i === wizStep ? ' is-on' : ''}"></span>`).join('');
        card.innerHTML = `
            <div class="pjw-head">${st.title}</div>
            <div class="pjw-body">${st.html}</div>
            <div class="pjw-dots">${dots}</div>
            <div class="pjw-btns">` + (st.choice
                ? `<button class="pjw-btn pjw-skip" data-pjw="skip">Passer — je remplis moi-même</button>
                   <button class="pjw-btn pjw-primary" data-pjw="next">✨ Me guider</button>`
                : `<button class="pjw-btn pjw-skip" data-pjw="skip">Passer le guide</button>
                   <span class="pjw-spacer"></span>
                   ${wizStep > 1 ? '<button class="pjw-btn" data-pjw="prev">← Précédent</button>' : ''}
                   <button class="pjw-btn pjw-primary" data-pjw="next">${last ? 'Terminer ✓' : 'Suivant →'}</button>`) +
            `</div>`;
        // Modificateurs en direct sur l'étape caractéristiques
        card.querySelectorAll('.pjw-stat-in').forEach(inp => {
            const upd = () => { const m = Math.floor(((parseInt(inp.value, 10) || 10) - 10) / 2); const b = card.querySelector(`[data-mod="${inp.dataset.wiz.slice(5)}"]`); if (b) b.textContent = (m >= 0 ? '+' : '') + m; };
            inp.addEventListener('input', upd); upd();
        });
        // Restaure ce qui avait été saisi si on revient en arrière
        card.querySelectorAll('[data-wiz]').forEach(inp => { if (wizData[inp.dataset.wiz] != null && wizData[inp.dataset.wiz] !== '') inp.value = wizData[inp.dataset.wiz]; });
        card.querySelectorAll('[data-pjw]').forEach(b => b.addEventListener('click', () => {
            collectWizInputs();
            const act = b.dataset.pjw;
            if (act === 'skip') { closeWizard(); return; }
            if (act === 'prev') { wizStep = Math.max(1, wizStep - 1); showWizStep(); return; }
            wizStep++; showWizStep();
        }));
        // Entrée dans un champ = étape suivante (confort clavier)
        card.querySelectorAll('input.pjw-in').forEach(inp => inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); collectWizInputs(); wizStep++; showWizStep(); }
        }));
        const first = card.querySelector('input.pjw-in'); if (first) setTimeout(() => first.focus(), 60);
    }
    function startWizard() { wizStep = 0; showWizStep(); }

    // =====================================================
    // 2. TUTORIEL DE LA FICHE (spotlight, comme côté MJ)
    // =====================================================
    let tutoIdx = 0, tutoSteps = [];
    function buildTutoSteps() {
        const all = [
            { icon: '📜', title: 'Voici ta fiche !', text: 'Petite visite guidée (1 minute). Tout se sauvegarde automatiquement pendant que tu écris. Tu peux revoir cette visite à tout moment via le menu ☰ en haut à droite.' },
            { sel: '#widget-hp', icon: '❤️', title: 'Tes points de vie', text: 'La barre suit tes PV. Saisis un montant puis 💥 (dégâts) ou 💚 (soins) — les PV temporaires ont leur propre case.' },
            { sel: '#widget-stats', icon: '💪', title: 'Caractéristiques & compétences', text: 'Clique sur le NOM d\'une caractéristique ou d\'une compétence pour lancer le d20 correspondant ! Le bouton ○ devant chaque compétence = maîtrise (●) puis expertise (★) en double-cliquant.' },
            { sel: '#widget-combat', icon: '🛡️', title: 'Le combat', text: 'CA, initiative, vitesse… tout est là. Ces valeurs sont visibles par ton MJ quand tu es connecté à sa session.' },
            { sel: '#widget-attacks', icon: '⚔️', title: 'Tes attaques', text: 'Ajoute tes armes et sorts d\'attaque : un clic lance le jet complet (toucher + dégâts), rangeables par onglets.' },
            { sel: '#widget-spells', icon: '✨', title: 'Tes sorts', text: 'Ton grimoire : ajoute tes sorts, prépare-les, suis tes emplacements. Les caractéristiques de magie (DD, bonus) se calculent automatiquement.' },
            { sel: '#widget-inventory', icon: '🎒', title: 'Ton sac à dos', text: 'Objets, pièces, encombrement… avec des onglets personnalisables pour t\'organiser.' },
            { sel: '#widget-rests', icon: '🌙', title: 'Les repos', text: 'Repos court (dés de vie) ou long (récupération complète) en un clic. Ton MJ est prévenu si tu es en session.' },
            { sel: '#btn-settings-toggle', icon: '☰', title: 'Le menu', text: 'Thème et couleurs, disposition de la fiche, connexion à la session de ton MJ (code à 6 caractères)… et le bouton pour REVOIR ce tutoriel. Bonne aventure ! 🎲' }
        ];
        // On ne garde que les étapes dont la cible existe et est visible (selon la disposition)
        return all.filter(s => !s.sel || (document.querySelector(s.sel) && document.querySelector(s.sel).offsetParent !== null));
    }
    function onTutoKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); endPjTutorial(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); tutoIdx++; showTutoStep(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); tutoIdx = Math.max(0, tutoIdx - 1); showTutoStep(); }
    }
    function startPjTutorial(force) {
        if (!force && localStorage.getItem(TUTO_FLAG)) return;
        const app = byId('app-screen');
        if (!app || app.classList.contains('hidden')) return;      // pas sur la fiche
        tutoSteps = buildTutoSteps(); tutoIdx = 0;
        let ov = byId('pj-tuto');
        if (!ov) {
            ov = document.createElement('div'); ov.id = 'pj-tuto'; ov.className = 'no-print';
            ov.innerHTML = '<div class="pj-tuto-spot"></div><div class="pjw-card pj-tuto-card" role="dialog" aria-label="Tutoriel de la fiche"></div>';
            document.body.appendChild(ov);
        }
        document.addEventListener('keydown', onTutoKey, true);
        showTutoStep();
    }
    function endPjTutorial() {
        try { localStorage.setItem(TUTO_FLAG, '1'); } catch (e) {}
        document.removeEventListener('keydown', onTutoKey, true);
        const ov = byId('pj-tuto'); if (ov) ov.remove();
    }
    function showTutoStep() {
        if (tutoIdx >= tutoSteps.length) { endPjTutorial(); return; }
        const st = tutoSteps[tutoIdx];
        const ov = byId('pj-tuto'); if (!ov) return;
        const spot = ov.querySelector('.pj-tuto-spot'), card = ov.querySelector('.pj-tuto-card');
        let r = null;
        if (st.sel) {
            const el = document.querySelector(st.sel);
            if (el && el.offsetParent !== null) {
                try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
                r = el.getBoundingClientRect();
            }
        }
        spot.classList.toggle('pj-tuto-spot-none', !r);
        if (r) {
            const pad = 6;
            spot.style.left = (r.left - pad) + 'px'; spot.style.top = (r.top - pad) + 'px';
            spot.style.width = (r.width + pad * 2) + 'px'; spot.style.height = (r.height + pad * 2) + 'px';
        } else { spot.style.left = '50%'; spot.style.top = '50%'; spot.style.width = '0'; spot.style.height = '0'; }
        const last = tutoIdx === tutoSteps.length - 1;
        const dots = tutoSteps.map((_, i) => `<span class="pjw-dot${i === tutoIdx ? ' is-on' : ''}"></span>`).join('');
        card.innerHTML = `
            <div class="pjw-head">${st.icon} ${esc(st.title)}</div>
            <div class="pjw-body"><p>${esc(st.text)}</p></div>
            <div class="pjw-dots">${dots}</div>
            <div class="pjw-btns">
                <button class="pjw-btn pjw-skip" data-pjt="skip">Passer</button>
                <span class="pjw-spacer"></span>
                ${tutoIdx > 0 ? '<button class="pjw-btn" data-pjt="prev">← Précédent</button>' : ''}
                <button class="pjw-btn pjw-primary" data-pjt="next">${last ? 'Terminer ✓' : 'Suivant →'}</button>
            </div>`;
        card.querySelectorAll('[data-pjt]').forEach(b => b.addEventListener('click', () => {
            const act = b.dataset.pjt;
            if (act === 'skip') { endPjTutorial(); return; }
            if (act === 'prev') { tutoIdx = Math.max(0, tutoIdx - 1); showTutoStep(); return; }
            tutoIdx++; showTutoStep();
        }));
        // Position de la bulle : à côté de la cible sans déborder, sinon centrée
        const vw = window.innerWidth, vh = window.innerHeight;
        const cw = card.offsetWidth, chh = card.offsetHeight;
        let cx = (vw - cw) / 2, cy = (vh - chh) / 2;
        if (r) {
            const M = 14;
            if (r.right + M + cw <= vw - 8) { cx = r.right + M; cy = r.top; }
            else if (r.left - M - cw >= 8) { cx = r.left - M - cw; cy = r.top; }
            else if (r.bottom + M + chh <= vh - 8) { cx = r.left; cy = r.bottom + M; }
            else if (r.top - M - chh >= 8) { cx = r.left; cy = r.top - M - chh; }
            cx = Math.max(8, Math.min(cx, vw - cw - 8));
            cy = Math.max(8, Math.min(cy, vh - chh - 8));
        }
        card.style.left = cx + 'px'; card.style.top = cy + 'px';
    }

    // =====================================================
    // Bouton « Revoir » dans le menu ☰ + déclenchement au chargement
    // =====================================================
    function injectMenuButtons() {
        const dd = byId('settings-dropdown'); if (!dd || byId('btn-pj-tuto-replay')) return;
        const wrap = document.createElement('div');
        wrap.className = 'player-only-setting';
        wrap.innerHTML = `<hr>
            <label style="font-weight:bold; font-size:0.85rem; color:var(--primary-color);">🎓 Aide :</label>
            <button id="btn-pj-tuto-replay" class="btn-small" style="width:100%; margin-top:4px;">🎓 Revoir le tutoriel de la fiche</button>
            <button id="btn-pj-wizard-replay" class="btn-small" style="width:100%; margin-top:5px;">✨ Relancer l'assistant de création</button>`;
        dd.appendChild(wrap);
        byId('btn-pj-tuto-replay').addEventListener('click', () => { dd.classList.add('hidden'); startPjTutorial(true); });
        byId('btn-pj-wizard-replay').addEventListener('click', () => { dd.classList.add('hidden'); startWizard(); });
    }

    function injectStyles() {
        const css = `
        #pj-wizard, #pj-tuto { position: fixed; inset: 0; z-index: 99990; }
        #pj-wizard { background: rgba(20, 12, 4, 0.55); backdrop-filter: blur(2px); }
        .pjw-card { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(420px, calc(100vw - 24px)); max-height: calc(100vh - 30px); overflow: auto;
            background: var(--sheet-bg-color, #FAF3E0); border: 1px solid var(--accent-color, #C49B35); border-radius: 14px; padding: 16px 18px;
            box-shadow: 0 14px 44px rgba(0,0,0,0.5); font-family: 'Lora', serif; color: var(--text-color, #3a2e1f); }
        .pjw-head { font-family: 'Cinzel', serif; font-weight: bold; font-size: 1.08rem; color: var(--primary-color, #7A2828); margin-bottom: 10px; }
        .pjw-body p { margin: 0 0 8px; font-size: 0.9rem; line-height: 1.5; }
        .pjw-note { font-size: 0.78rem; color: #8a7a5e; font-style: italic; }
        .pjw-lbl { display: block; font-size: 0.8rem; font-weight: bold; color: var(--primary-color, #7A2828); margin: 8px 0 3px; }
        .pjw-in { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid rgba(122,40,40,0.3); border-radius: 8px; font-family: 'Lora', serif; font-size: 0.9rem; background: rgba(255,255,255,0.75); color: inherit; }
        .pjw-in:focus { outline: none; border-color: var(--accent-color, #C49B35); box-shadow: 0 0 0 2px rgba(196,155,53,0.2); }
        .pjw-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .pjw-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; margin-top: 6px; }
        .pjw-stat { display: flex; align-items: center; gap: 6px; }
        .pjw-stat label { flex: 1; font-size: 0.82rem; }
        .pjw-stat .pjw-in { width: 58px; flex: 0 0 auto; text-align: center; }
        .pjw-mod { width: 32px; text-align: center; color: var(--accent-color, #C49B35); font-family: 'Cinzel', serif; }
        .pjw-dots { display: flex; gap: 5px; justify-content: center; margin: 12px 0 10px; }
        .pjw-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(122,40,40,0.2); transition: background 0.2s, transform 0.2s; }
        .pjw-dot.is-on { background: var(--accent-color, #C49B35); transform: scale(1.25); }
        .pjw-btns { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .pjw-spacer { flex: 1; }
        .pjw-btn { padding: 8px 12px; border-radius: 9px; border: 1px solid rgba(122,40,40,0.3); background: rgba(255,255,255,0.6); font-family: 'Lora', serif; font-size: 0.84rem; cursor: pointer; color: inherit; }
        .pjw-btn:hover { border-color: var(--accent-color, #C49B35); }
        .pjw-primary { background: linear-gradient(160deg, #d9af45, #b8862c); border: none; color: #2a1c0a; font-weight: bold; }
        .pjw-skip { opacity: 0.75; }
        /* Tuto fiche : spotlight (assombrit tout sauf la cible) + bulle positionnée */
        .pj-tuto-spot { position: fixed; border-radius: 10px; box-shadow: 0 0 0 200vmax rgba(12, 8, 3, 0.72); border: 2px solid var(--accent-color, #C49B35); pointer-events: none; transition: left 0.28s ease, top 0.28s ease, width 0.28s ease, height 0.28s ease; }
        .pj-tuto-spot-none { border: none; }
        .pj-tuto-card { transform: none; transition: left 0.28s ease, top 0.28s ease; }
        body.dark-mode .pjw-card { background: #241c16; color: #ece3d2; }
        body.dark-mode .pjw-in { background: #2a221b; color: #ece3d2; }
        body.dark-mode .pjw-btn { background: #2a221b; color: #ece3d2; }
        body.dark-mode .pjw-note { color: #9a8a70; }`;
        const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    }

    document.addEventListener('DOMContentLoaded', () => {
        injectStyles();
        // Sur la fiche uniquement (pas l'accueil, pas l'écran MJ)
        setTimeout(() => {
            const app = byId('app-screen');
            const onSheet = app && !app.classList.contains('hidden') && !document.body.classList.contains('gm-active');
            if (!onSheet) return;
            injectMenuButtons();
            if (localStorage.getItem(WIZ_FLAG)) {
                try { localStorage.removeItem(WIZ_FLAG); } catch (e) {}
                startWizard();                                   // fiche fraîchement créée → assistant
            } else if (!localStorage.getItem(TUTO_FLAG)) {
                // Fiche existante mais tuto jamais vu : on le propose sans forcer (1er affichage)
                startPjTutorial(false);
            }
        }, 900);
    });

    // Accès debug / autres modules
    window.PjTutorial = { startWizard, startTutorial: startPjTutorial };
})();
