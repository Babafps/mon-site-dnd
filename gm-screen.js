// =====================================================
// ÉCRAN DU MAÎTRE (GM Screen) — Phase 1 : UI + outils locaux
// État encapsulé (closure) + persistance localStorage.
// La couche temps réel (Supabase Realtime) viendra en Phase 2.
// =====================================================
(function () {
    'use strict';

    // ---------- Données statiques ----------
    const CONDITIONS = [
        { key: 'pois', icon: '🧪', label: 'Empoisonné' }, { key: 'prone', icon: '⏬', label: 'À terre' },
        { key: 'stun', icon: '💫', label: 'Étourdi' }, { key: 'restr', icon: '⛓️', label: 'Entravé' },
        { key: 'fright', icon: '👻', label: 'Effrayé' }, { key: 'blind', icon: '👁️', label: 'Aveuglé' },
        { key: 'charm', icon: '💖', label: 'Charmé' }, { key: 'grap', icon: '✊', label: 'Empoigné' },
        { key: 'uncon', icon: '💤', label: 'Inconscient' }, { key: 'dead', icon: '☠️', label: 'Mort' }
    ];
    const GEN_NAMES = ['Aldric le Borgne', 'Maelle Scombreaube', 'Garrik Pierre-Poing', 'Sylphine Vent-d\'Argent',
        'Thorin Barbe-de-Fer', 'Élora la Murmurante', 'Brann Tisse-Ombre', 'Wynn Cœur-Vaillant', 'Dame Cécile d\'Aubéron',
        'Vasco le Trompeur', 'Nessa Feuille-Rousse', 'Kaeleth Grise-Lune', 'Bourg le Tavernier', 'Sœur Aldwena', 'Le vieux Tobias'];
    const GEN_RUMORS = ['Une lumière étrange flotte chaque nuit au-dessus du vieux moulin.',
        'Le seigneur local n\'a plus été vu depuis trois lunes…', 'On dit qu\'un dragon dort sous la colline aux Corbeaux.',
        'Des marchands disparaissent sur la route de l\'Est.', 'La fille du forgeron parlerait aux morts.',
        'Un trésor maudit reposerait au fond du puits asséché.', 'Les loups descendent des montagnes plus tôt que d\'habitude.',
        'Un culte se réunirait dans les égouts de la cité basse.'];
    const GEN_LOOT = ['Une potion de soins (2d4+2 PV)', '37 pièces d\'or dans une bourse en cuir', 'Une dague finement ouvragée (+1)',
        'Un parchemin de sort inconnu', 'Une gemme verte d\'une valeur de 50 po', 'Une carte au trésor déchirée en deux',
        'Un anneau de cuivre gravé de runes', 'Une fiole de poison (CD 13)', 'Des bottes de marche silencieuse', 'Un médaillon avec un portrait inconnu'];
    const DICE = [4, 6, 8, 10, 12, 20, 100];

    // ---------- État (multi-campagnes) ----------
    const CAMP_KEY = 'dnd-gm-campaigns';
    let campaigns = loadCampaigns();
    let activeCampaignId = null;
    function loadCampaigns() { try { return JSON.parse(localStorage.getItem(CAMP_KEY)) || []; } catch (e) { return []; } }
    function saveCampaigns() { try { localStorage.setItem(CAMP_KEY, JSON.stringify(campaigns)); } catch (e) {} }
    function stateKey() { return 'dnd-gm-state-' + activeCampaignId; }
    function defaultState() {
        return {
            roomCode: null,
            party: [], initiative: [], round: 1, turnIndex: 0,
            monsters: [], npcs: [], quests: [], notes: '', scenes: [],
            env: { time: '', weather: '☀️ Dégagé' }, diceLog: []
        };
    }
    let state = defaultState();
    function load() { if (!activeCampaignId) return defaultState(); try { const s = JSON.parse(localStorage.getItem(stateKey())); return Object.assign(defaultState(), s || {}); } catch (e) { return defaultState(); } }
    function save() { if (!activeCampaignId) return; try { localStorage.setItem(stateKey(), JSON.stringify(state)); } catch (e) {} }

    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // ---------- Lancer de dés ----------
    function rollFormula(formula) {
        let total = 0; const rolls = [];
        const clean = String(formula).replace(/\s+/g, '').toLowerCase();
        const tokens = clean.match(/[+-]?[^+-]+/g) || [];
        tokens.forEach(tok => {
            const sign = tok[0] === '-' ? -1 : 1;
            const body = tok.replace(/^[+-]/, '');
            if (body.includes('d')) {
                let [n, f] = body.split('d'); n = parseInt(n) || 1; f = parseInt(f);
                if (!f) return;
                for (let i = 0; i < n; i++) { const r = Math.floor(Math.random() * f) + 1; total += sign * r; rolls.push((sign < 0 ? '-' : '') + r); }
            } else { const v = parseInt(body); if (!isNaN(v)) { total += sign * v; rolls.push((sign < 0 ? '-' : '+') + Math.abs(v)); } }
        });
        return { total, detail: rolls.join(' '), formula: clean };
    }
    function logDice(label, res) {
        state.diceLog.unshift({ label, total: res.total, detail: res.detail });
        if (state.diceLog.length > 30) state.diceLog.pop();
        save(); renderDice();
        // Affiche le grand résultat
        const out = document.getElementById('gm-dice-result');
        if (out) { const crit = /d20/.test(res.formula) && res.detail.split(' ').length === 1; let cls = ''; if (crit && res.total >= 20) cls = 'gm-crit'; if (crit && res.detail === '1') cls = 'gm-fail'; out.innerHTML = `<span class="${cls}">${res.total}</span>`; }
    }

    // ---------- Injection HTML ----------
    function injectHTML() {
        const ov = document.createElement('div');
        ov.id = 'gm-overlay'; ov.className = 'no-print';
        ov.innerHTML = `
        <div class="gm-header">
            <h2 class="gm-title">🛡️ Écran du Maître <span class="beta-badge">Bêta</span></h2>
            <span id="gm-campaign-title" class="gm-campaign-title"></span>
            <div class="gm-room">
                <span id="gm-room-label" class="gm-readonly-note">Session locale</span>
                <span id="gm-room-code" class="gm-room-code" style="display:none;"></span>
                <button id="gm-room-btn" class="gm-btn gm-btn-primary">➕ Créer une session</button>
            </div>
            <button id="gm-close" class="gm-btn gm-close" title="Fermer">✕</button>
        </div>

        <div class="gm-tabs">
            <button class="gm-tab active" data-tab="dash">Groupe</button>
            <button class="gm-tab" data-tab="combat">Combat</button>
            <button class="gm-tab" data-tab="lore">Narration</button>
        </div>

        <div class="gm-body">
            <!-- COLONNE A : DASHBOARD -->
            <div class="gm-col gm-col-dash gm-show">
                <div class="gm-card">
                    <div class="gm-card-head"><span class="gm-card-icon">👥</span> Statut du groupe</div>
                    <div class="gm-card-body">
                        <div class="gm-row">
                            <input id="gm-party-name" class="gm-input" placeholder="Nom du personnage">
                            <input id="gm-party-cls" class="gm-input" placeholder="Classe" style="flex:0 1 110px;">
                            <button id="gm-party-add" class="gm-add" title="Ajouter">＋</button>
                        </div>
                        <div id="gm-party-list"></div>
                        <div class="gm-readonly-note">ⓘ En Phase 2, les fiches des joueurs liés s'afficheront ici automatiquement (lecture seule).</div>
                    </div>
                </div>
                <div class="gm-card">
                    <div class="gm-card-head"><span class="gm-card-icon">🌤️</span> Environnement</div>
                    <div class="gm-card-body">
                        <div class="gm-env-row"><label>🕑 Heure</label><input id="gm-env-time" class="gm-input" placeholder="ex : Crépuscule, 18h…"></div>
                        <div class="gm-env-row"><label>🌦️ Météo</label>
                            <select id="gm-env-weather" class="gm-select">
                                <option>☀️ Dégagé</option><option>⛅ Nuageux</option><option>🌧️ Pluie</option>
                                <option>⛈️ Orage</option><option>🌫️ Brouillard</option><option>❄️ Neige</option><option>🌙 Nuit</option>
                            </select>
                        </div>
                        <div class="gm-music-mini">
                            <button class="gm-btn" data-act="music-toggle">🎵 Lecteur</button>
                            <button class="gm-btn" data-act="music-show">▶ Afficher</button>
                        </div>
                    </div>
                </div>
                <div class="gm-card">
                    <div class="gm-card-head"><span class="gm-card-icon">🎬</span> Scènes (ambiance)</div>
                    <div class="gm-card-body">
                        <div class="gm-row">
                            <input id="gm-scene-name" class="gm-input" placeholder="Nom (Taverne, Forêt…)">
                            <label class="gm-btn" id="gm-scene-img-label" style="flex:0 0 auto;" title="Image de fond (optionnel)">🖼️<input type="file" id="gm-scene-img" accept="image/*" style="display:none;"></label>
                            <button id="gm-scene-add" class="gm-add" title="Créer la scène">＋</button>
                        </div>
                        <div id="gm-scene-list" class="gm-scene-list"></div>
                        <div class="gm-readonly-note">ⓘ « Appliquer » change le fond localement ; la diffusion à tous les joueurs viendra avec le réseau.</div>
                    </div>
                </div>
            </div>

            <!-- COLONNE B : COMBAT -->
            <div class="gm-col gm-col-combat">
                <div class="gm-card">
                    <div class="gm-card-head"><span class="gm-card-icon">⚔️</span> Initiative
                        <span class="gm-spacer"></span>
                        <span class="gm-round">Round <b id="gm-round-val">1</b></span>
                    </div>
                    <div class="gm-card-body">
                        <div class="gm-row">
                            <input id="gm-init-name" class="gm-input" placeholder="Nom (joueur / monstre)">
                            <input id="gm-init-val" class="gm-input gm-num" type="number" placeholder="Init">
                            <select id="gm-init-type" class="gm-select" style="flex:0 0 auto; width:auto;"><option value="pj">🧝 PJ</option><option value="monster">👹 Monstre</option></select>
                            <button id="gm-init-add" class="gm-add" title="Ajouter">＋</button>
                        </div>
                        <div id="gm-init-list"></div>
                        <div class="gm-row" style="justify-content:space-between;">
                            <button id="gm-init-next" class="gm-btn gm-btn-primary">⏭ Tour suivant</button>
                            <button id="gm-init-reset" class="gm-btn gm-btn-danger">↺ Réinitialiser</button>
                        </div>
                    </div>
                </div>
                <div class="gm-card">
                    <div class="gm-card-head"><span class="gm-card-icon">👹</span> Monstres</div>
                    <div class="gm-card-body">
                        <div class="gm-row">
                            <input id="gm-mon-name" class="gm-input" placeholder="Nom du monstre">
                            <input id="gm-mon-hp" class="gm-input gm-num" type="number" placeholder="PV">
                            <input id="gm-mon-ac" class="gm-input gm-num" type="number" placeholder="CA">
                            <button id="gm-mon-add" class="gm-add" title="Ajouter">＋</button>
                        </div>
                        <div id="gm-mon-list"></div>
                    </div>
                </div>
                <div class="gm-card">
                    <div class="gm-card-head"><span class="gm-card-icon">🎲</span> Lanceur de dés MJ</div>
                    <div class="gm-card-body">
                        <div class="gm-dice-quick">${DICE.map(d => `<button class="gm-die" data-die="${d}">d${d}</button>`).join('')}</div>
                        <div class="gm-row">
                            <input id="gm-dice-formula" class="gm-input" placeholder="ex : 2d6+3, 1d20+5…">
                            <button id="gm-dice-roll" class="gm-add" title="Lancer">🎲</button>
                        </div>
                        <div id="gm-dice-result" class="gm-dice-result"></div>
                        <div id="gm-dice-log" class="gm-dice-log"></div>
                    </div>
                </div>
            </div>

            <!-- COLONNE C : NARRATION -->
            <div class="gm-col gm-col-lore">
                <div class="gm-card">
                    <div class="gm-card-head"><span class="gm-card-icon">🎭</span> PNJ présents</div>
                    <div class="gm-card-body">
                        <div class="gm-row">
                            <input id="gm-npc-name" class="gm-input" placeholder="Nom du PNJ">
                            <button id="gm-npc-add" class="gm-add" title="Ajouter">＋</button>
                        </div>
                        <div id="gm-npc-list"></div>
                    </div>
                </div>
                <div class="gm-card">
                    <div class="gm-card-head"><span class="gm-card-icon">📜</span> Quêtes en cours</div>
                    <div class="gm-card-body">
                        <div class="gm-row">
                            <input id="gm-quest-name" class="gm-input" placeholder="Objectif des joueurs…">
                            <button id="gm-quest-add" class="gm-add" title="Ajouter">＋</button>
                        </div>
                        <div id="gm-quest-list"></div>
                    </div>
                </div>
                <div class="gm-card">
                    <div class="gm-card-head"><span class="gm-card-icon">🎲</span> Générateur d'urgence</div>
                    <div class="gm-card-body">
                        <div class="gm-gen-btns">
                            <button class="gm-btn" data-gen="name">PNJ</button>
                            <button class="gm-btn" data-gen="rumor">Rumeur</button>
                            <button class="gm-btn" data-gen="loot">Trésor</button>
                        </div>
                        <div id="gm-gen-out" class="gm-gen-out">Clique pour générer…</div>
                    </div>
                </div>
                <div class="gm-card">
                    <div class="gm-card-head"><span class="gm-card-icon">📝</span> Bloc-notes</div>
                    <div class="gm-card-body">
                        <textarea id="gm-notes" class="gm-textarea" placeholder="Notes à la volée…"></textarea>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.appendChild(ov);
    }

    // ---------- Rendus ----------
    function renderParty() {
        const el = document.getElementById('gm-party-list'); if (!el) return;
        if (!state.party.length) { el.innerHTML = `<div class="gm-empty">Aucun personnage suivi.</div>`; return; }
        el.innerHTML = state.party.map(p => {
            const ratio = p.hpMax > 0 ? Math.max(0, Math.min(1, p.hpCur / p.hpMax)) : 0;
            return `<div class="gm-party-item" data-id="${p.id}">
                <span class="gm-party-name">${esc(p.name)}</span>
                <button class="gm-del-x" data-act="party-del" data-id="${p.id}">✕</button>
                <span class="gm-party-sub" style="grid-column:1/-1;">${esc(p.cls || 'Classe ?')}</span>
                <div class="gm-party-stats">
                    <span class="gm-stat-pill">❤️ <input class="gm-input gm-num" style="width:42px;display:inline-block;padding:2px;" type="number" data-f="hpCur" data-id="${p.id}" value="${p.hpCur}">/<input class="gm-input gm-num" style="width:42px;display:inline-block;padding:2px;" type="number" data-f="hpMax" data-id="${p.id}" value="${p.hpMax}"></span>
                    <span class="gm-stat-pill">🛡️ CA <input class="gm-input gm-num" style="width:38px;display:inline-block;padding:2px;" type="number" data-f="ac" data-id="${p.id}" value="${p.ac}"></span>
                    <span class="gm-stat-pill"><b>Perc.P</b> <input class="gm-input gm-num" style="width:38px;display:inline-block;padding:2px;" type="number" data-f="passPerc" data-id="${p.id}" value="${p.passPerc}"></span>
                    <span class="gm-stat-pill"><b>Intu.P</b> <input class="gm-input gm-num" style="width:38px;display:inline-block;padding:2px;" type="number" data-f="passInsight" data-id="${p.id}" value="${p.passInsight}"></span>
                </div>
                <div class="gm-hp-bar"><div class="gm-hp-fill" style="width:${ratio * 100}%;"></div></div>
            </div>`;
        }).join('');
    }
    function renderInit() {
        const el = document.getElementById('gm-init-list'); if (!el) return;
        const rv = document.getElementById('gm-round-val'); if (rv) rv.textContent = state.round;
        if (!state.initiative.length) { el.innerHTML = `<div class="gm-empty">Personne dans l'ordre d'initiative.</div>`; return; }
        el.innerHTML = state.initiative.map((c, i) => `<div class="gm-init-item ${i === state.turnIndex ? 'is-active' : ''}${c.hidden ? ' is-mj-hidden' : ''}">
            <span class="gm-init-init">${c.init}</span>
            <span class="gm-init-type">${c.type === 'pj' ? '🧝' : '👹'}</span>
            <span class="gm-init-name">${esc(c.name)}</span>
            <button class="gm-eye${c.hidden ? ' is-hidden' : ''}" data-act="init-eye" data-id="${c.id}" title="${c.hidden ? 'Caché des joueurs' : 'Masquer aux joueurs'}">${c.hidden ? '🙈' : '👁️'}</button>
            <button class="gm-init-del" data-act="init-del" data-id="${c.id}">✕</button>
        </div>`).join('');
    }
    function renderMonsters() {
        const el = document.getElementById('gm-mon-list'); if (!el) return;
        if (!state.monsters.length) { el.innerHTML = `<div class="gm-empty">Aucun monstre.</div>`; return; }
        el.innerHTML = state.monsters.map(m => {
            const dead = m.hpCur <= 0;
            const conds = CONDITIONS.map(c => `<button class="gm-cond ${m.conditions.includes(c.key) ? 'on' : ''}" title="${c.label}" data-act="mon-cond" data-id="${m.id}" data-cond="${c.key}">${c.icon}</button>`).join('');
            const atks = (m.attacks || []).map((a, ai) => `<button class="gm-atk-btn" data-act="mon-atk" data-id="${m.id}" data-ai="${ai}">⚔️ ${esc(a.name)} (${esc(a.formula)})</button>`).join('');
            return `<div class="gm-monster${m.hidden ? ' is-mj-hidden' : ''}" data-id="${m.id}">
                <div class="gm-monster-top">
                    <span class="gm-monster-name">${esc(m.name)}${m.ac ? ` <span class="gm-party-sub">CA ${m.ac}</span>` : ''}</span>
                    <div class="gm-hp-ctrl">
                        <button class="gm-hp-btn" data-act="mon-hp" data-id="${m.id}" data-delta="-1">−</button>
                        <span class="gm-hp-val ${dead ? 'is-dead' : ''}">${m.hpCur}/${m.hpMax}</span>
                        <button class="gm-hp-btn" data-act="mon-hp" data-id="${m.id}" data-delta="1">＋</button>
                    </div>
                    <button class="gm-eye${m.hidden ? ' is-hidden' : ''}" data-act="mon-eye" data-id="${m.id}" title="${m.hidden ? 'Caché des joueurs (clic = montrer)' : 'Visible (clic = masquer aux joueurs)'}">${m.hidden ? '🙈' : '👁️'}</button>
                    <button class="gm-del-x" data-act="mon-del" data-id="${m.id}">✕</button>
                </div>
                <div class="gm-conditions">${conds}</div>
                <div class="gm-row"><input class="gm-input" placeholder="Attaque (ex: Morsure)" data-mon-atk-name="${m.id}"><input class="gm-input gm-num" style="width:88px;" placeholder="1d20+5" data-mon-atk-formula="${m.id}"><button class="gm-add" style="width:32px;height:32px;font-size:1rem;" data-act="mon-atk-add" data-id="${m.id}">＋</button></div>
                <div class="gm-monster-atk">${atks || '<span class="gm-readonly-note">Aucune attaque enregistrée.</span>'}</div>
            </div>`;
        }).join('');
    }
    function renderDice() {
        const el = document.getElementById('gm-dice-log'); if (!el) return;
        el.innerHTML = state.diceLog.map(d => `<div class="gm-dice-log-item"><span>${esc(d.label)}</span><span><b>${d.total}</b> <span style="opacity:.6;">(${esc(d.detail)})</span></span></div>`).join('');
    }
    function renderNpcs() {
        const el = document.getElementById('gm-npc-list'); if (!el) return;
        if (!state.npcs.length) { el.innerHTML = `<div class="gm-empty">Aucun PNJ.</div>`; return; }
        el.innerHTML = state.npcs.map(n => `<div class="gm-npc" data-id="${n.id}">
            <div class="gm-npc-top">
                <input type="checkbox" class="gm-check" data-act="npc-present" data-id="${n.id}" ${n.present ? 'checked' : ''} title="Présent dans la scène">
                <span class="gm-npc-name">${esc(n.name)}</span>
                <button class="gm-del-x" data-act="npc-del" data-id="${n.id}">✕</button>
            </div>
            <textarea class="gm-textarea" style="min-height:48px;margin-top:6px;" placeholder="Secret / note du PNJ…" data-act="npc-secret" data-id="${n.id}">${esc(n.secret || '')}</textarea>
        </div>`).join('');
    }
    function renderQuests() {
        const el = document.getElementById('gm-quest-list'); if (!el) return;
        if (!state.quests.length) { el.innerHTML = `<div class="gm-empty">Aucune quête.</div>`; return; }
        el.innerHTML = state.quests.map(q => `<div class="gm-quest gm-quest-top ${q.done ? 'gm-quest-done' : ''}" data-id="${q.id}">
            <input type="checkbox" class="gm-check" data-act="quest-done" data-id="${q.id}" ${q.done ? 'checked' : ''}>
            <span style="flex:1;">${esc(q.text)}</span>
            <button class="gm-del-x" data-act="quest-del" data-id="${q.id}">✕</button>
        </div>`).join('');
    }
    function renderScenes() {
        const el = document.getElementById('gm-scene-list'); if (!el) return;
        if (!state.scenes.length) { el.innerHTML = `<div class="gm-empty">Aucune scène préparée.</div>`; return; }
        el.innerHTML = state.scenes.map(s => `<div class="gm-scene" data-id="${s.id}"${s.bg ? ` style="background-image:url(${s.bg})"` : ''}>
            <span class="gm-scene-name">🎬 ${esc(s.name)}</span>
            <div class="gm-scene-actions">
                <button class="gm-btn" data-act="scene-apply" data-id="${s.id}">Appliquer</button>
                <button class="gm-del-x" data-act="scene-del" data-id="${s.id}">✕</button>
            </div>
        </div>`).join('');
    }
    function applyScene(s) { if (s && s.bg) document.body.style.backgroundImage = `url(${s.bg})`; if (window.showAppToast) window.showAppToast('🎬 Scène « ' + (s ? s.name : '') + ' » appliquée', '#8a6320'); }
    function fileToDataURL(file, cb) {
        const reader = new FileReader();
        reader.onload = ev => { const img = new Image(); img.onload = () => { const cv = document.createElement('canvas'); const MAX = 1280; let w = img.width, h = img.height; if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } cv.width = w; cv.height = h; cv.getContext('2d').drawImage(img, 0, 0, w, h); try { cb(cv.toDataURL('image/jpeg', 0.7)); } catch (e) { cb(null); } }; img.src = ev.target.result; };
        reader.readAsDataURL(file);
    }
    function renderAll() { renderParty(); renderInit(); renderMonsters(); renderDice(); renderNpcs(); renderQuests(); renderScenes();
        const t = document.getElementById('gm-env-time'); if (t) t.value = state.env.time || '';
        const w = document.getElementById('gm-env-weather'); if (w) w.value = state.env.weather || '☀️ Dégagé';
        const n = document.getElementById('gm-notes'); if (n) n.value = state.notes || '';
        const rc = document.getElementById('gm-room-code'); const rb = document.getElementById('gm-room-btn'); const rl = document.getElementById('gm-room-label');
        if (state.roomCode && rc && rb) { rc.style.display = ''; rc.textContent = state.roomCode; rb.textContent = '✕ Fermer la session'; if (rl) rl.textContent = 'Code :'; }
    }

    // ---------- Câblage ----------
    function byId(id) { return document.getElementById(id); }
    function find(arr, id) { return arr.find(x => x.id === id); }

    function wire() {
        byId('gm-close').addEventListener('click', close);

        // Session (placeholder Phase 2)
        byId('gm-room-btn').addEventListener('click', () => {
            if (state.roomCode) { state.roomCode = null; }
            else { state.roomCode = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join(''); }
            save(); renderAll();
            const rc = byId('gm-room-code'), rb = byId('gm-room-btn'), rl = byId('gm-room-label');
            if (!state.roomCode) { rc.style.display = 'none'; rb.textContent = '➕ Créer une session'; rl.textContent = 'Session locale'; }
            if (state.roomCode && window.showAppToast) window.showAppToast('Session ' + state.roomCode + ' créée (réseau à venir)', '#2c3e50');
        });

        // Onglets mobile
        document.querySelectorAll('.gm-tab').forEach(tab => tab.addEventListener('click', () => {
            document.querySelectorAll('.gm-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const map = { dash: '.gm-col-dash', combat: '.gm-col-combat', lore: '.gm-col-lore' };
            document.querySelectorAll('.gm-col').forEach(c => c.classList.remove('gm-show'));
            const target = document.querySelector(map[tab.dataset.tab]); if (target) target.classList.add('gm-show');
        }));

        // --- Ajouts ---
        byId('gm-party-add').addEventListener('click', () => {
            const name = byId('gm-party-name').value.trim(); if (!name) return;
            state.party.push({ id: uid(), name, cls: byId('gm-party-cls').value.trim(), hpCur: 0, hpMax: 0, ac: 10, passPerc: 10, passInsight: 10 });
            byId('gm-party-name').value = ''; byId('gm-party-cls').value = ''; save(); renderParty();
        });
        byId('gm-init-add').addEventListener('click', () => {
            const name = byId('gm-init-name').value.trim(); if (!name) return;
            state.initiative.push({ id: uid(), name, init: parseInt(byId('gm-init-val').value) || 0, type: byId('gm-init-type').value });
            state.initiative.sort((a, b) => b.init - a.init);
            byId('gm-init-name').value = ''; byId('gm-init-val').value = ''; save(); renderInit();
        });
        byId('gm-init-next').addEventListener('click', () => {
            if (!state.initiative.length) return;
            state.turnIndex++;
            if (state.turnIndex >= state.initiative.length) { state.turnIndex = 0; state.round++; }
            save(); renderInit();
        });
        byId('gm-init-reset').addEventListener('click', () => {
            if (!confirm('Réinitialiser l\'ordre d\'initiative et le compteur de round ?')) return;
            state.initiative = []; state.round = 1; state.turnIndex = 0; save(); renderInit();
        });
        byId('gm-mon-add').addEventListener('click', () => {
            const name = byId('gm-mon-name').value.trim(); if (!name) return;
            const hp = parseInt(byId('gm-mon-hp').value) || 1;
            state.monsters.push({ id: uid(), name, hpCur: hp, hpMax: hp, ac: parseInt(byId('gm-mon-ac').value) || 0, conditions: [], attacks: [] });
            byId('gm-mon-name').value = ''; byId('gm-mon-hp').value = ''; byId('gm-mon-ac').value = ''; save(); renderMonsters();
        });
        byId('gm-npc-add').addEventListener('click', () => {
            const name = byId('gm-npc-name').value.trim(); if (!name) return;
            state.npcs.push({ id: uid(), name, secret: '', present: true });
            byId('gm-npc-name').value = ''; save(); renderNpcs();
        });
        byId('gm-quest-add').addEventListener('click', () => {
            const text = byId('gm-quest-name').value.trim(); if (!text) return;
            state.quests.push({ id: uid(), text, done: false });
            byId('gm-quest-name').value = ''; save(); renderQuests();
        });

        // Entrée = valider l'ajout du champ
        [['gm-party-name', 'gm-party-add'], ['gm-init-name', 'gm-init-add'], ['gm-init-val', 'gm-init-add'],
        ['gm-mon-name', 'gm-mon-add'], ['gm-mon-hp', 'gm-mon-add'], ['gm-mon-ac', 'gm-mon-add'],
        ['gm-npc-name', 'gm-npc-add'], ['gm-quest-name', 'gm-quest-add']].forEach(([inp, btn]) => {
            const e = byId(inp); if (e) e.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); byId(btn).click(); } });
        });

        // Dés
        DICE.forEach(() => {});
        document.querySelectorAll('.gm-die').forEach(b => b.addEventListener('click', () => logDice('1d' + b.dataset.die, rollFormula('1d' + b.dataset.die))));
        byId('gm-dice-roll').addEventListener('click', () => { const f = byId('gm-dice-formula').value.trim(); if (f) logDice(f, rollFormula(f)); });
        byId('gm-dice-formula').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); byId('gm-dice-roll').click(); } });

        // Générateurs
        document.querySelectorAll('[data-gen]').forEach(b => b.addEventListener('click', () => {
            const pool = b.dataset.gen === 'name' ? GEN_NAMES : b.dataset.gen === 'rumor' ? GEN_RUMORS : GEN_LOOT;
            byId('gm-gen-out').textContent = pool[Math.floor(Math.random() * pool.length)];
        }));

        // Environnement + notes (sauvegarde sur saisie)
        byId('gm-env-time').addEventListener('input', e => { state.env.time = e.target.value; save(); });
        byId('gm-env-weather').addEventListener('change', e => { state.env.weather = e.target.value; save(); });
        byId('gm-notes').addEventListener('input', e => { state.notes = e.target.value; save(); });

        // Mini-contrôle musique
        document.querySelectorAll('[data-act="music-toggle"],[data-act="music-show"]').forEach(b => b.addEventListener('click', () => {
            if (!window.MusicPlayer) return;
            if (b.dataset.act === 'music-show') window.MusicPlayer.show(); else window.MusicPlayer.toggle();
        }));

        // --- Délégation : clics sur éléments générés ---
        document.getElementById('gm-overlay').addEventListener('click', (e) => {
            const t = e.target.closest('[data-act]'); if (!t) return;
            const id = t.dataset.id, act = t.dataset.act;
            switch (act) {
                case 'party-del': state.party = state.party.filter(p => p.id !== id); save(); renderParty(); break;
                case 'init-del': {
                    const idx = state.initiative.findIndex(c => c.id === id);
                    state.initiative = state.initiative.filter(c => c.id !== id);
                    if (state.turnIndex >= state.initiative.length) state.turnIndex = 0;
                    save(); renderInit(); break;
                }
                case 'mon-del': state.monsters = state.monsters.filter(m => m.id !== id); save(); renderMonsters(); break;
                case 'mon-eye': { const m = find(state.monsters, id); if (m) { m.hidden = !m.hidden; save(); renderMonsters(); } break; }
                case 'init-eye': { const c = find(state.initiative, id); if (c) { c.hidden = !c.hidden; save(); renderInit(); } break; }
                case 'mon-hp': { const m = find(state.monsters, id); if (m) { m.hpCur = Math.max(0, Math.min(m.hpMax, m.hpCur + parseInt(t.dataset.delta))); save(); renderMonsters(); } break; }
                case 'mon-cond': { const m = find(state.monsters, id); if (m) { const c = t.dataset.cond; m.conditions = m.conditions.includes(c) ? m.conditions.filter(x => x !== c) : [...m.conditions, c]; save(); renderMonsters(); } break; }
                case 'mon-atk': { const m = find(state.monsters, id); if (m) { const a = m.attacks[parseInt(t.dataset.ai)]; if (a) logDice(`${m.name} — ${a.name}`, rollFormula(a.formula)); } break; }
                case 'mon-atk-add': {
                    const m = find(state.monsters, id); if (!m) break;
                    const nameEl = document.querySelector(`[data-mon-atk-name="${id}"]`), fEl = document.querySelector(`[data-mon-atk-formula="${id}"]`);
                    const an = nameEl.value.trim(), af = fEl.value.trim(); if (!an || !af) break;
                    m.attacks.push({ name: an, formula: af }); save(); renderMonsters(); break;
                }
                case 'npc-del': state.npcs = state.npcs.filter(n => n.id !== id); save(); renderNpcs(); break;
                case 'quest-del': state.quests = state.quests.filter(q => q.id !== id); save(); renderQuests(); break;
            }
        });
        // Délégation : changements (checkboxes, champs de stats joueurs, secrets PNJ)
        document.getElementById('gm-overlay').addEventListener('change', (e) => {
            const t = e.target.closest('[data-act]'); if (!t) return;
            const id = t.dataset.id;
            if (t.dataset.act === 'npc-present') { const n = find(state.npcs, id); if (n) { n.present = t.checked; save(); } }
            if (t.dataset.act === 'quest-done') { const q = find(state.quests, id); if (q) { q.done = t.checked; save(); renderQuests(); } }
        });
        document.getElementById('gm-overlay').addEventListener('input', (e) => {
            const pf = e.target.closest('[data-f]');
            if (pf) { const p = find(state.party, pf.dataset.id); if (p) { p[pf.dataset.f] = parseInt(e.target.value) || 0; save(); const item = pf.closest('.gm-party-item'); const fill = item && item.querySelector('.gm-hp-fill'); if (fill && p.hpMax > 0) fill.style.width = Math.max(0, Math.min(1, p.hpCur / p.hpMax)) * 100 + '%'; } return; }
            const sec = e.target.closest('[data-act="npc-secret"]');
            if (sec) { const n = find(state.npcs, sec.dataset.id); if (n) { n.secret = e.target.value; save(); } }
        });
    }

    // ---------- Campagnes (accueil MJ) ----------
    function createCampaign(name) { const c = { id: uid(), name: name.trim(), archived: false, created: Date.now() }; campaigns.push(c); saveCampaigns(); renderCampaigns(); return c; }
    function renderCampaigns() {
        const list = document.getElementById('gm-campaign-list'); if (!list) return;
        const showArch = (document.getElementById('gm-show-archived') || {}).checked;
        const visible = campaigns.filter(c => showArch || !c.archived);
        list.innerHTML = '';
        if (!visible.length) { list.innerHTML = `<p style="text-align:center; font-style:italic; color:#888;">Aucune campagne. Créez-en une !</p>`; return; }
        visible.forEach(c => {
            const card = document.createElement('div'); card.className = 'char-card campaign-card' + (c.archived ? ' is-archived' : '');
            const info = document.createElement('div'); info.className = 'char-info';
            info.innerHTML = `<strong>${esc(c.name)}</strong> ${c.archived ? '<span style="font-size:0.8rem;color:#888;">(archivée)</span>' : ''}`;
            info.onclick = () => open(c.id);
            const actions = document.createElement('div'); actions.className = 'campaign-actions';
            const mk = (label, title, fn) => { const b = document.createElement('button'); b.textContent = label; b.title = title; b.onclick = (e) => { e.stopPropagation(); fn(); }; return b; };
            actions.appendChild(mk('▶', 'Ouvrir', () => open(c.id)));
            actions.appendChild(mk('✏️', 'Renommer', () => { const n = prompt('Nouveau nom :', c.name); if (n && n.trim()) { c.name = n.trim(); saveCampaigns(); renderCampaigns(); } }));
            actions.appendChild(mk(c.archived ? '📂' : '🗄️', c.archived ? 'Désarchiver' : 'Archiver', () => { c.archived = !c.archived; saveCampaigns(); renderCampaigns(); }));
            actions.appendChild(mk('✖', 'Supprimer', () => { if (confirm('Supprimer définitivement « ' + c.name + ' » et toutes ses données ?')) { try { localStorage.removeItem('dnd-gm-state-' + c.id); } catch (e) {} campaigns = campaigns.filter(x => x.id !== c.id); saveCampaigns(); renderCampaigns(); } }));
            card.appendChild(info); card.appendChild(actions); list.appendChild(card);
        });
    }
    function wireHome() {
        document.querySelectorAll('.home-tab').forEach(tab => tab.addEventListener('click', () => {
            document.querySelectorAll('.home-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active');
            const isGm = tab.dataset.htab === 'gm';
            const pp = document.getElementById('home-panel-player'); const pg = document.getElementById('home-panel-gm');
            if (pp) pp.classList.toggle('hidden', isGm); if (pg) pg.classList.toggle('hidden', !isGm);
            if (isGm) renderCampaigns();
        }));
        const cc = document.getElementById('btn-create-campaign');
        if (cc) cc.addEventListener('click', () => { const i = document.getElementById('new-campaign-name'); const n = (i.value || '').trim(); if (n) { createCampaign(n); i.value = ''; } });
        const ni = document.getElementById('new-campaign-name'); if (ni) ni.addEventListener('keydown', e => { if (e.key === 'Enter' && cc) { e.preventDefault(); cc.click(); } });
        const sa = document.getElementById('gm-show-archived'); if (sa) sa.addEventListener('change', renderCampaigns);
        renderCampaigns();
    }

    // ---------- Ouverture / fermeture ----------
    function open(campaignId) {
        if (campaignId) { activeCampaignId = campaignId; state = load(); }
        else if (!activeCampaignId) { const c = createCampaign('Partie rapide'); activeCampaignId = c.id; state = load(); }
        const ov = document.getElementById('gm-overlay'); if (!ov) return;
        const camp = campaigns.find(c => c.id === activeCampaignId);
        const tEl = document.getElementById('gm-campaign-title'); if (tEl) tEl.textContent = camp ? '— ' + camp.name : '';
        ov.classList.add('gm-open'); renderAll();
    }
    function close() { const ov = document.getElementById('gm-overlay'); if (ov) ov.classList.remove('gm-open'); }

    document.addEventListener('DOMContentLoaded', () => {
        injectHTML();
        setTimeout(() => { wire(); wireHome(); }, 60);
    });

    window.GMScreen = { open, close };
})();
