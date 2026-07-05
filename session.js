// =====================================================
// session.js — Côté JOUEUR : rejoindre une session MJ
// et diffuser sa fiche en temps réel (Supabase Realtime).
//   • join/leave par code à 6 caractères
//   • présence (canal session:{code})
//   • snapshot de la fiche débauncé → table session_players
// L'état est exposé via l'évènement 'playersession:change'.
// =====================================================
(function () {
    'use strict';

    const LS_KEY = 'dnd-player-session';
    const DEBOUNCE = 800;

    const state = { code: null, sessionId: null, charId: null, channel: null, pushTimer: null };

    function activeCharId() { try { return localStorage.getItem('dnd-active-char'); } catch (e) { return null; } }
    // Permissions audio : joueur en session = volume seul (contrôles MJ désactivés)
    function setMusicRole(r) { if (window.MusicPlayer && window.MusicPlayer.setRole) window.MusicPlayer.setRole(r); }

    function emit() {
        const detail = { connected: !!state.sessionId, code: state.code };
        document.dispatchEvent(new CustomEvent('playersession:change', { detail }));
    }

    function persist() {
        try {
            if (state.sessionId) localStorage.setItem(LS_KEY, JSON.stringify({ code: state.code, sessionId: state.sessionId, charId: state.charId }));
            else localStorage.removeItem(LS_KEY);
        } catch (e) {}
    }

    // ---------- Snapshot de la fiche (lecture seule du DOM) ----------
    function buildSnapshot() {
        const v = id => { const el = document.getElementById(id); return el ? el.value : ''; };
        const num = id => { const n = parseInt(v(id), 10); return isNaN(n) ? null : n; };
        const chk = id => { const el = document.getElementById(id); return !!(el && el.checked); };

        const conditions = [];
        document.querySelectorAll('#conditions-track-container input[type="checkbox"]').forEach(cb => {
            if (cb.checked) {
                const lbl = (cb.parentElement ? cb.parentElement.textContent : '').replace(/\s+/g, ' ').trim();
                conditions.push(lbl || cb.id);
            }
        });
        document.querySelectorAll('#custom-conditions-container input[type="checkbox"]:checked').forEach(cb => {
            const lbl = (cb.parentElement ? cb.parentElement.textContent : '').replace(/\s+/g, ' ').trim();
            if (lbl) conditions.push(lbl);
        });

        const abilities = {};
        ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(a => {
            const sc = document.getElementById('stat-' + a), md = document.getElementById('mod-' + a);
            abilities[a] = { score: sc ? (parseInt(sc.value, 10) || null) : null, mod: md ? md.textContent.trim() : '' };
        });

        // ----- Fiche COMPLÈTE (pour la vue MJ : tout le personnage) -----
        const jstore = (key) => { try { const raw = localStorage.getItem(state.charId + '_' + key); return raw && raw !== 'undefined' ? JSON.parse(raw) : null; } catch (e) { return null; } };
        const skills = [];
        document.querySelectorAll('#attributes-list .skill-row').forEach(row => {
            const lbl = row.querySelector('label'); const md = row.querySelector('.skill-mod'); const pf = row.querySelector('.skill-prof');
            if (lbl && md) skills.push({ name: lbl.textContent.trim(), mod: md.textContent.trim(), prof: pf ? (parseInt(pf.value, 10) || 0) : 0, save: row.classList.contains('saving-throw'), stat: pf ? (pf.dataset.stat || '') : '' });
        });
        const full = {
            identity: { background: v('char-background'), alignment: v('char-alignment'), languages: v('char-languages'), xp: v('char-xp'), size: v('char-size'), appearance: v('char-appearance') },
            skills: skills,
            // On envoie l'essentiel (pas les descriptions HTML complètes) pour garder le snapshot léger.
            attacks: (jstore('dnd-attacks') || []).map(a => ({ name: a.name, bonus: a.bonus, dmg: a.dmg, notes: a.notes })),
            spells: (jstore('dnd-spells') || []).map(sp => ({ name: sp.name, level: sp.level, notes: sp.notes })),
            spellSlots: jstore('dnd-spell-slots') || [],
            spellInfo: { ability: v('spellcasting-ability'), mod: v('spell-modifier'), dc: v('spell-save-dc'), atk: v('spell-attack-bonus') },
            abilitiesLimited: (jstore('dnd-abilities') || []).map(c => ({ name: c.name, max: c.max, used: c.used })),
            inventory: (jstore('dnd-inventory') || []).map(it => ({ name: it.name, qty: it.qty, weight: it.weight })),
            currency: { pc: v('coin-pc'), pa: v('coin-pa'), pe: v('coin-pe'), po: v('coin-po'), pp: v('coin-pp') },
            traits: (jstore('dnd-traits') || []).map(t => ({ name: t.name, type: t.type, desc: String(t.desc || '').replace(/<[^>]+>/g, '').slice(0, 240) })),
            hitDice: { spent: v('hd-spent'), max: v('hd-max'), size: (document.getElementById('hd-size') || {}).value || '' },
            companion: { name: v('comp-name'), ac: v('comp-ac'), hp: v('comp-hp'), notes: v('comp-notes') },
            notes: { quick: v('quick-note'), quests: v('quest-log'), npcs: v('npc-log') }
        };

        return {
            name: v('char-name'),
            level: num('char-level'),
            cls: v('char-class'),
            subclass: v('char-subclass'),
            race: v('char-race'),
            abilities: abilities,
            prof: num('prof-bonus'),
            hpCur: num('hp-current'),
            hpMax: num('hp-max'),
            hpTemp: num('hp-temp'),
            ac: num('armor-class'),
            passivePerception: num('passive-perception'),
            initiative: num('initiative'),
            speed: v('speed'),
            spellDC: num('spell-save-dc'),
            concentrating: chk('is-concentrating'),
            deathSaves: {
                s: ['death-s1', 'death-s2', 'death-s3'].filter(chk).length,
                f: ['death-f1', 'death-f2', 'death-f3'].filter(chk).length
            },
            conditions: conditions,
            full: full,
            ts: Date.now()
        };
    }

    function snapName(charId) {
        const el = document.getElementById('char-name');
        const fromDom = el ? el.value.trim() : '';
        if (fromDom) return fromDom;
        const cid = charId || state.charId;
        try { return localStorage.getItem(cid + '_dnd-sheet-char-name') || 'Aventurier'; } catch (e) { return 'Aventurier'; }
    }

    async function doPush() {
        if (!state.sessionId || !window.SupaAuth) return;
        try { await window.SupaAuth.upsertSnapshot(state.sessionId, state.charId, snapName(), buildSnapshot()); }
        catch (e) { console.warn('snapshot push:', e); }
    }

    function pushSnapshot(immediate) {
        if (!state.sessionId) return;
        clearTimeout(state.pushTimer);
        if (immediate) { doPush(); return; }
        state.pushTimer = setTimeout(doPush, DEBOUNCE);
    }

    // ---------- Présence + réception des broadcasts MJ ----------
    function openPresence() {
        if (!window.SupaAuth || !state.code) return;
        try {
            const ch = window.SupaAuth.presenceChannel(state.code);
            ch.on('broadcast', { event: 'scene' }, ({ payload }) => applyIncomingScene(payload))
              .on('broadcast', { event: 'gift' }, ({ payload }) => receiveGift(payload))
              .on('broadcast', { event: 'sfx' }, ({ payload }) => { if (!payload || !window.MusicPlayer) return; if (payload.builtin && window.MusicPlayer.playBuiltinSfx) window.MusicPlayer.playBuiltinSfx(payload.builtin); else if (payload.url && window.MusicPlayer.playSfx) window.MusicPlayer.playSfx(payload.url); })
              .on('broadcast', { event: 'music' }, ({ payload }) => { if (window.MusicPlayer && window.MusicPlayer.applyRemoteMusic) window.MusicPlayer.applyRemoteMusic(payload); })
              .on('broadcast', { event: 'combat' }, ({ payload }) => applyCombat(payload))
              .on('broadcast', { event: 'map' }, ({ payload }) => { if (payload) applyMap(payload.map, payload.tokens); })
              .on('broadcast', { event: 'session-closed' }, () => onSessionClosed())
              .on('broadcast', { event: 'kick' }, ({ payload }) => onKicked(payload))
              .on('broadcast', { event: 'show-image' }, ({ payload }) => receiveSharedImage(payload))
              .on('broadcast', { event: 'dice' }, ({ payload }) => receiveDiceRoll(payload))
              .on('broadcast', { event: 'map-ping' }, ({ payload }) => showMapPing(payload))
              .subscribe(async (status) => {
                  if (status === 'SUBSCRIBED') {
                      try { await ch.track({ role: 'player', name: snapName(), charId: state.charId, online: true }); } catch (e) {}
                  }
              });
            state.channel = ch;
        } catch (e) { console.warn('presence:', e); }
    }

    function myUid() { return (window.SupaAuth && window.SupaAuth.currentUser && window.SupaAuth.currentUser.id) || null; }
    function sendToGm(event, payload) { if (state.channel) { try { state.channel.send({ type: 'broadcast', event, payload }); } catch (e) {} } }
    function escHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    // --- Scène diffusée par le MJ : change le fond + lance l'ambiance ---
    function applyIncomingScene(p) {
        if (!p) return;
        if (p.bg) { document.body.style.backgroundImage = 'url(' + p.bg + ')'; document.body.classList.add('scene-active'); }
        if (p.music && window.MusicPlayer && window.MusicPlayer.playUrl) { try { window.MusicPlayer.playUrl(p.music, '🎬 ' + (p.name || 'Scène')); } catch (e) {} }
        if (window.showAppToast) window.showAppToast('🎬 ' + (p.name ? ('Scène : ' + p.name) : 'Nouvelle ambiance'), '#8a6320');
    }

    // --- Troc / Murmure reçu ---
    function receiveGift(p) {
        if (!p) return;
        if (p.targetUserId && p.targetUserId !== 'all' && p.targetUserId !== myUid()) return; // pas destiné à moi
        showGiftNotification(p);
    }
    function mkBtn(label, cls, fn) { const b = document.createElement('button'); b.className = 'session-notif-btn ' + cls; b.textContent = label; b.addEventListener('click', fn); return b; }
    function showGiftNotification(p) {
        let wrap = document.getElementById('session-notifs');
        if (!wrap) { wrap = document.createElement('div'); wrap.id = 'session-notifs'; wrap.className = 'no-print'; document.body.appendChild(wrap); }
        const card = document.createElement('div'); card.className = 'session-notif';
        const isItem = p.type === 'item' && p.item;
        const icon = isItem ? '🎁' : '🤫';
        const title = isItem ? "Le MJ t'offre un objet" : 'Murmure du MJ';
        const body = isItem
            ? `<b>${escHtml(p.item.name)}</b>${(p.item.qty > 1) ? (' ×' + p.item.qty) : ''}${p.message ? ('<div class="session-notif-msg">' + escHtml(p.message) + '</div>') : ''}`
            : `<div class="session-notif-msg">${escHtml(p.message || '')}</div>`;
        card.innerHTML = `<div class="session-notif-head">${icon} ${title}</div><div class="session-notif-body">${body}</div><div class="session-notif-actions"></div>`;
        const actions = card.querySelector('.session-notif-actions');
        if (isItem) {
            actions.appendChild(mkBtn('✔ Accepter', 'accept', () => {
                if (window.PlayerInventory) window.PlayerInventory.add(p.item);
                sendToGm('gift-response', { accepted: true, by: snapName(), item: p.item.name, giftId: p.giftId });
                if (window.showAppToast) window.showAppToast('🎁 « ' + p.item.name + ' » ajouté au sac', '#27ae60');
                card.remove();
            }));
            actions.appendChild(mkBtn('✖ Refuser', 'refuse', () => {
                sendToGm('gift-response', { accepted: false, by: snapName(), item: p.item.name, giftId: p.giftId });
                card.remove();
            }));
        } else {
            actions.appendChild(mkBtn('Compris', 'accept', () => {
                sendToGm('gift-response', { accepted: true, by: snapName(), whisper: true, giftId: p.giftId });
                card.remove();
            }));
        }
        wrap.appendChild(card);
    }

    // --- Image partagée par le MJ : notification « Ouvrir » → visionneuse plein écran ---
    function receiveSharedImage(p) {
        if (!p || !p.url) return;
        let wrap = document.getElementById('session-notifs');
        if (!wrap) { wrap = document.createElement('div'); wrap.id = 'session-notifs'; wrap.className = 'no-print'; document.body.appendChild(wrap); }
        const card = document.createElement('div'); card.className = 'session-notif';
        card.innerHTML = `<div class="session-notif-head">🖼️ Le MJ partage une image</div><div class="session-notif-actions"></div>`;
        const actions = card.querySelector('.session-notif-actions');
        actions.appendChild(mkBtn('🔍 Ouvrir', 'accept', () => { openSharedImage(p.url); card.remove(); }));
        actions.appendChild(mkBtn('Ignorer', 'refuse', () => card.remove()));
        wrap.appendChild(card);
    }
    // Jet de dés public diffusé par le MJ → notification éphémère côté joueur.
    function receiveDiceRoll(p) {
        if (!p) return;
        let wrap = document.getElementById('session-notifs');
        if (!wrap) { wrap = document.createElement('div'); wrap.id = 'session-notifs'; wrap.className = 'no-print'; document.body.appendChild(wrap); }
        const card = document.createElement('div'); card.className = 'session-notif';
        card.innerHTML = `<div class="session-notif-head">🎲 ${escHtml(p.user || 'MJ')} lance ${escHtml(p.formula || '')}</div><div class="session-notif-body">Résultat : <b>${escHtml(String(p.total))}</b> <span style="opacity:.6;">(${escHtml(p.detail || '')})</span></div>`;
        wrap.appendChild(card);
        setTimeout(() => { card.style.transition = 'opacity .4s'; card.style.opacity = '0'; setTimeout(() => card.remove(), 400); }, 6000);
    }
    function openSharedImage(url) {
        let ov = document.getElementById('session-image-viewer');
        if (!ov) {
            ov = document.createElement('div'); ov.id = 'session-image-viewer'; ov.className = 'no-print hidden';
            ov.addEventListener('click', () => ov.classList.add('hidden'));
            document.body.appendChild(ov);
        }
        ov.innerHTML = `<img src="${url}" alt="Image du MJ"><button class="siv-close" title="Fermer">✕</button>`;
        ov.classList.remove('hidden');
    }

    // =====================================================
    // COMBAT (joueur) : bouton flottant (FAB) + initiative
    // =====================================================
    let combatState = { active: false, round: 1, turnIndex: 0, order: [] };
    let fabEl = null, fabPanel = null;

    function clampN(v, a, b) { return Math.max(a, Math.min(v, b)); }

    function ensureFab() {
        if (fabEl) return;
        fabEl = document.createElement('button');
        fabEl.id = 'session-fab'; fabEl.className = 'no-print'; fabEl.type = 'button';
        fabEl.innerHTML = '<span class="session-fab-ic">⚔️</span>';
        fabEl.title = 'Actions de combat (glisse-moi le long des bords)';
        document.body.appendChild(fabEl);

        fabPanel = document.createElement('div');
        fabPanel.id = 'session-fab-panel'; fabPanel.className = 'no-print hidden';
        document.body.appendChild(fabPanel);

        fabEl.addEventListener('click', () => { if (fabEl.dataset.dragged === '1') { fabEl.dataset.dragged = '0'; return; } toggleFabPanel(); });
        setupFabDrag();
        restoreFabPos();
    }

    function toggleFabPanel() {
        if (!fabPanel) return;
        if (fabPanel.classList.contains('hidden')) { renderFabPanel(); fabPanel.classList.remove('hidden'); placePanel(); }
        else fabPanel.classList.add('hidden');
    }

    function placePanel() {
        if (!fabEl || !fabPanel) return;
        const r = fabEl.getBoundingClientRect();
        const pw = fabPanel.offsetWidth || 250, ph = fabPanel.offsetHeight || 200, m = 8;
        let left = r.right + m; if (left + pw > window.innerWidth) left = r.left - pw - m;
        left = clampN(left, m, window.innerWidth - pw - m);
        let top = clampN(r.top, m, window.innerHeight - ph - m);
        fabPanel.style.left = left + 'px'; fabPanel.style.top = top + 'px';
        // Le panneau « pousse » depuis le côté du bouton (animation naturelle)
        fabPanel.style.transformOrigin = (left > r.left ? 'left' : 'right') + ' 24px';
    }

    function renderFabPanel() {
        if (!fabPanel) return;
        const whisperBtn = `<button id="sfp-whisper-open" class="sfp-btn sfp-btn-whisper" type="button">🤫 Murmurer au MJ</button>`;
        // Hors combat : on n'affiche le message QUE dans le panneau ouvert (plus de badge flottant).
        if (!combatState.active) {
            fabPanel.innerHTML = `<div class="sfp-head">⚔️ Session</div>${whisperBtn}<div class="sfp-empty">Pas de combat pour le moment.</div>`;
        } else {
            const order = combatState.order || [];
            const rows = order.map((c, i) => `<div class="sfp-row${i === combatState.turnIndex ? ' is-turn' : ''}">
                <span class="sfp-init">${c.init == null ? '—' : c.init}</span>
                <span class="sfp-type">${c.type === 'monster' ? '👹' : '🧝'}</span>
                <span class="sfp-name">${escHtml(c.name)}</span>
            </div>`).join('') || '<div class="sfp-empty">En attente de l\'ordre d\'initiative…</div>';
            fabPanel.innerHTML = `
                <div class="sfp-head">⚔️ Combat — Round <b>${combatState.round || 1}</b></div>
                <button id="sfp-roll-init" class="sfp-btn">🎲 Lancer mon initiative</button>
                <div class="sfp-manual">
                    <input type="number" id="sfp-init-manual" class="sfp-manual-input" inputmode="numeric" placeholder="Score réel (dé IRL)">
                    <button id="sfp-init-manual-btn" class="sfp-btn sfp-btn-alt" title="Saisir manuellement mon initiative">✍️</button>
                </div>
                <div class="sfp-order">${rows}</div>
                ${whisperBtn}`;
        }
        const wb = document.getElementById('sfp-whisper-open');
        if (wb) wb.addEventListener('click', renderWhisperForm);
        const rb = document.getElementById('sfp-roll-init');
        if (rb) rb.addEventListener('click', rollInitiative);
        const mb = document.getElementById('sfp-init-manual-btn');
        if (mb) mb.addEventListener('click', submitManualInit);
        const mi = document.getElementById('sfp-init-manual');
        if (mi) mi.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitManualInit(); } });
    }

    function rollInitiative() {
        const modEl = document.getElementById('initiative');
        const mod = modEl ? (parseInt(modEl.value, 10) || 0) : 0;
        const d = Math.floor(Math.random() * 20) + 1;
        const total = d + mod;
        sendToGm('initiative-roll', { charId: state.charId, name: snapName(), total: total });
        if (window.showAppToast) window.showAppToast('🎲 Initiative : ' + d + (mod ? (mod > 0 ? ' +' + mod : ' ' + mod) : '') + ' = ' + total, '#2c3e50');
        renderFabPanel(); placePanel();
    }

    // Saisie manuelle (pour ceux qui lancent un vrai dé) : on envoie le score tel quel au MJ.
    function submitManualInit() {
        const inp = document.getElementById('sfp-init-manual'); if (!inp) return;
        const total = parseInt(inp.value, 10);
        if (isNaN(total)) { inp.focus(); return; }
        sendToGm('initiative-roll', { charId: state.charId, name: snapName(), total: total });
        if (window.showAppToast) window.showAppToast('✍️ Initiative envoyée : ' + total, '#2c3e50');
        inp.value = '';
        renderFabPanel(); placePanel();
    }

    // --- Murmure joueur → MJ : privé, seul l'écran MJ écoute l'événement 'whisper' ---
    function renderWhisperForm() {
        if (!fabPanel) return;
        fabPanel.innerHTML = `
            <div class="sfp-head">🤫 Murmure au MJ</div>
            <textarea id="sfp-whisper-text" class="sfp-whisper-text" rows="3" maxlength="500" placeholder="Message privé — seul le MJ le verra…"></textarea>
            <div class="sfp-whisper-actions">
                <button id="sfp-whisper-cancel" class="sfp-btn sfp-btn-alt" type="button">Annuler</button>
                <button id="sfp-whisper-send" class="sfp-btn" type="button">Envoyer</button>
            </div>`;
        placePanel();
        const ta = document.getElementById('sfp-whisper-text');
        document.getElementById('sfp-whisper-cancel').addEventListener('click', () => { renderFabPanel(); placePanel(); });
        document.getElementById('sfp-whisper-send').addEventListener('click', sendWhisper);
        if (ta) { ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendWhisper(); } }); ta.focus(); }
    }
    function sendWhisper() {
        const ta = document.getElementById('sfp-whisper-text'); if (!ta) return;
        const text = (ta.value || '').trim();
        if (!text) { ta.focus(); return; }
        if (!state.channel) { if (window.showAppToast) window.showAppToast('Pas de session active.', '#c0392b'); return; }
        sendToGm('whisper', { name: snapName(), charId: state.charId, fromUid: myUid(), text: text.slice(0, 500), ts: Date.now() });
        if (window.showAppToast) window.showAppToast('🤫 Murmure envoyé au MJ', '#8a6320');
        fabPanel.classList.add('hidden');
        renderFabPanel();
    }

    function applyCombat(p) {
        if (!p) return;
        combatState = { active: !!p.active, round: p.round || 1, turnIndex: p.turnIndex || 0, order: p.order || [] };
        ensureFab();
        fabEl.classList.toggle('fab-combat', combatState.active);   // halo + pastille rouge en combat
        updateFabVisibility();
        if (fabPanel && !fabPanel.classList.contains('hidden')) { renderFabPanel(); placePanel(); }
        document.body.classList.toggle('session-combat-active', combatState.active);
        maybeNotifyTurn();
    }

    // Notification d'anticipation : prévient le joueur juste avant son tour
    let lastTurnNotice = -1;
    function maybeNotifyTurn() {
        if (!combatState.active || !combatState.order || !combatState.order.length) { lastTurnNotice = -1; return; }
        const order = combatState.order, n = order.length;
        const myId = state.charId, myName = (snapName() || '').toLowerCase();
        const isMe = (c) => !!c && ((myId && c.charId && c.charId === myId) || (!!c.name && c.name.toLowerCase() === myName));
        const nextIdx = (combatState.turnIndex + 1) % n;
        if (isMe(order[nextIdx]) && !isMe(order[combatState.turnIndex]) && lastTurnNotice !== nextIdx) {
            lastTurnNotice = nextIdx;
            showTurnNotice('⏳ Votre tour approche — préparez votre action !');
        }
    }
    function showTurnNotice(msg) {
        let el = document.getElementById('session-turn-notice');
        if (!el) { el = document.createElement('div'); el.id = 'session-turn-notice'; el.className = 'no-print'; document.body.appendChild(el); }
        el.textContent = msg; el.classList.add('show');
        clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 3500);
    }

    function updateFabVisibility() {
        if (!fabEl) return;
        const connected = !!state.sessionId;
        // Le bouton de combat n'apparaît QUE sur l'écran joueur (jamais MJ / accueil / login).
        const app = document.getElementById('app-screen');
        const onPlayerScreen = !!(app && !app.classList.contains('hidden'));
        const show = connected && onPlayerScreen;
        fabEl.style.display = show ? 'flex' : 'none';
        if (!show && fabPanel) fabPanel.classList.add('hidden');
    }

    function teardownCombatUI() {
        combatState = { active: false, round: 1, turnIndex: 0, order: [] };
        if (fabEl) { fabEl.style.display = 'none'; fabEl.classList.remove('fab-combat'); }
        if (fabPanel) fabPanel.classList.add('hidden');
        document.body.classList.remove('session-combat-active');
    }

    // Drag du FAB : libre, puis ancrage (snap) au bord le plus proche
    function setupFabDrag() {
        let dragging = false, moved = false, startX = 0, startY = 0, offX = 0, offY = 0;
        const margin = 10;
        fabEl.style.touchAction = 'none';
        fabEl.addEventListener('pointerdown', (e) => {
            if (e.button != null && e.button !== 0) return;
            dragging = true; moved = false;
            const r = fabEl.getBoundingClientRect();
            offX = e.clientX - r.left; offY = e.clientY - r.top; startX = e.clientX; startY = e.clientY;
            fabEl.style.transition = 'none';
            try { fabEl.setPointerCapture(e.pointerId); } catch (_) {}
        });
        fabEl.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            if (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4) moved = true;
            const w = fabEl.offsetWidth, h = fabEl.offsetHeight;
            const x = clampN(e.clientX - offX, margin, window.innerWidth - w - margin);
            const y = clampN(e.clientY - offY, margin, window.innerHeight - h - margin);
            fabEl.style.left = x + 'px'; fabEl.style.top = y + 'px'; fabEl.style.right = 'auto'; fabEl.style.bottom = 'auto';
            if (fabPanel && !fabPanel.classList.contains('hidden')) placePanel();
        });
        const up = (e) => {
            if (!dragging) return; dragging = false;
            fabEl.style.transition = '';
            fabEl.dataset.dragged = moved ? '1' : '0';
            if (moved) snapToEdge();
            try { fabEl.releasePointerCapture(e.pointerId); } catch (_) {}
        };
        fabEl.addEventListener('pointerup', up);
        fabEl.addEventListener('pointercancel', up);
        window.addEventListener('resize', () => { const p = readFabPos(); if (p) applyFabEdge(p.edge, p.offset); });
    }

    function snapToEdge() {
        const w = fabEl.offsetWidth, h = fabEl.offsetHeight, margin = 10;
        const r = fabEl.getBoundingClientRect();
        const cx = r.left + w / 2, cy = r.top + h / 2;
        const dl = cx, dr = window.innerWidth - cx, dt = cy, db = window.innerHeight - cy;
        const min = Math.min(dl, dr, dt, db);
        let edge, offset;
        if (min === dl) { edge = 'left'; offset = clampN(r.top, margin, window.innerHeight - h - margin); }
        else if (min === dr) { edge = 'right'; offset = clampN(r.top, margin, window.innerHeight - h - margin); }
        else if (min === dt) { edge = 'top'; offset = clampN(r.left, margin, window.innerWidth - w - margin); }
        else { edge = 'bottom'; offset = clampN(r.left, margin, window.innerWidth - w - margin); }
        animateFabTo(edge, offset);
        try { localStorage.setItem('dnd-fab-pos', JSON.stringify({ edge, offset })); } catch (e) {}
    }

    // Glisse en douceur jusqu'au bord (au lieu de s'y téléporter), puis ré-ancre.
    function animateFabTo(edge, offset) {
        const margin = 10, w = fabEl.offsetWidth || 58, h = fabEl.offsetHeight || 58;
        let tx, ty;
        if (edge === 'left') { tx = margin; ty = clampN(offset, margin, window.innerHeight - h - margin); }
        else if (edge === 'right') { tx = window.innerWidth - w - margin; ty = clampN(offset, margin, window.innerHeight - h - margin); }
        else if (edge === 'top') { ty = margin; tx = clampN(offset, margin, window.innerWidth - w - margin); }
        else { ty = window.innerHeight - h - margin; tx = clampN(offset, margin, window.innerWidth - w - margin); }
        // Le drag positionne déjà en left/top : on anime left/top, puis on ré-ancre proprement.
        fabEl.style.transition = 'left 0.3s cubic-bezier(0.22,0.9,0.35,1.15), top 0.3s cubic-bezier(0.22,0.9,0.35,1.15)';
        fabEl.style.left = tx + 'px'; fabEl.style.top = ty + 'px'; fabEl.style.right = 'auto'; fabEl.style.bottom = 'auto';
        clearTimeout(fabEl._snapTimer);
        fabEl._snapTimer = setTimeout(() => {
            fabEl.style.transition = 'none';
            applyFabEdge(edge, offset);
            requestAnimationFrame(() => { fabEl.style.transition = ''; });
            if (fabPanel && !fabPanel.classList.contains('hidden')) placePanel();
        }, 320);
    }

    function applyFabEdge(edge, offset) {
        if (!fabEl) return;
        const margin = 10, w = fabEl.offsetWidth || 58, h = fabEl.offsetHeight || 58;
        fabEl.style.left = fabEl.style.right = fabEl.style.top = fabEl.style.bottom = 'auto';
        if (edge === 'left') { fabEl.style.left = margin + 'px'; fabEl.style.top = clampN(offset, margin, window.innerHeight - h - margin) + 'px'; }
        else if (edge === 'right') { fabEl.style.right = margin + 'px'; fabEl.style.top = clampN(offset, margin, window.innerHeight - h - margin) + 'px'; }
        else if (edge === 'top') { fabEl.style.top = margin + 'px'; fabEl.style.left = clampN(offset, margin, window.innerWidth - w - margin) + 'px'; }
        else { fabEl.style.bottom = margin + 'px'; fabEl.style.left = clampN(offset, margin, window.innerWidth - w - margin) + 'px'; }
    }

    function readFabPos() { try { return JSON.parse(localStorage.getItem('dnd-fab-pos') || 'null'); } catch (e) { return null; } }
    function restoreFabPos() {
        const pos = readFabPos();
        if (pos && pos.edge) applyFabEdge(pos.edge, pos.offset || 60);
        else applyFabEdge('right', Math.round(window.innerHeight * 0.45));
    }

    async function loadLiveState() {
        if (!state.sessionId || !window.SupaAuth || !window.SupaAuth.loadSessionState) return;
        try {
            const st = await window.SupaAuth.loadSessionState(state.sessionId);
            if (st) { if (st.combat) applyCombat(st.combat); if (st.map && typeof applyMap === 'function') applyMap(st.map, st.tokens); }
        } catch (e) {}
    }

    // =====================================================
    // CARTE TACTIQUE (joueur) : vue lecture seule synchronisée
    // =====================================================
    let mapState = { map: {}, tokens: [] };
    let mapPanel = null, mapToggle = null, openMapPanel = null;

    function ensureMapUI() {
        if (mapToggle) return;
        mapToggle = document.createElement('button');
        mapToggle.id = 'session-map-toggle'; mapToggle.className = 'no-print'; mapToggle.type = 'button';
        mapToggle.textContent = '🗺️'; mapToggle.title = 'Carte tactique';
        document.body.appendChild(mapToggle);

        mapPanel = document.createElement('div');
        mapPanel.id = 'session-map'; mapPanel.className = 'no-print hidden';
        mapPanel.innerHTML = '<div class="smap-head"><span>🗺️ Carte tactique</span><div class="smap-head-btns"><button id="smap-full" title="Plein écran">⛶</button><button id="smap-close" title="Fermer">✕</button></div></div><div id="smap-view" class="smap-view"></div>';
        document.body.appendChild(mapPanel);

        // La carte s'ouvre toujours directement en plein écran ; ⛶ permet de la réduire.
        const fullBtn = mapPanel.querySelector('#smap-full');
        const syncFullBtn = () => { fullBtn.title = mapPanel.classList.contains('smap-fullscreen') ? 'Réduire' : 'Plein écran'; };
        const refreshMapCanvases = () => { requestAnimationFrame(() => { renderPlayerDraw(); renderPlayerFog(); }); };
        openMapPanel = () => { mapPanel.classList.remove('hidden'); mapPanel.classList.add('smap-fullscreen'); syncFullBtn(); refreshMapCanvases(); };
        mapToggle.addEventListener('click', () => { if (mapPanel.classList.contains('hidden')) openMapPanel(); else mapPanel.classList.add('hidden'); });
        mapPanel.querySelector('#smap-close').addEventListener('click', () => mapPanel.classList.add('hidden'));
        fullBtn.addEventListener('click', () => { mapPanel.classList.toggle('smap-fullscreen'); syncFullBtn(); refreshMapCanvases(); });
        setupPlayerTokenDrag(document.getElementById('smap-view'));
    }

    function applyMap(map, tokens) {
        mapState = { map: map || {}, tokens: tokens || [] };
        ensureMapUI();
        const hasMap = !!(mapState.map && mapState.map.bg) || (mapState.tokens && mapState.tokens.length);
        mapToggle.style.display = (state.sessionId && hasMap) ? 'flex' : 'none';
        if (!(state.sessionId && hasMap)) mapPanel.classList.add('hidden');
        renderPlayerMap();
    }

    function renderPlayerMap() {
        const view = document.getElementById('smap-view'); if (!view) return;
        const m = mapState.map || {};
        const uid = myUid(), locked = !!m.tokensLocked;
        view.style.backgroundImage = m.bg ? `url(${m.bg})` : 'none';
        const bx = m.bgX || 0, by = m.bgY || 0, bs = Number(m.bgScale) || 1;
        view.style.backgroundPosition = `calc(50% + ${bx}px) calc(50% + ${by}px)`;
        view.style.backgroundSize = (bs === 1) ? 'contain' : (bs * 100) + '%';
        view.classList.toggle('show-grid', m.showGrid !== false);
        view.style.setProperty('--gm-grid', (m.gridSize || 48) + 'px');
        const tokensHtml = (mapState.tokens || []).filter(t => !t.hidden).map(t => {
            const mine = !locked && t.owner && t.owner === uid;
            const img = t.img ? `background-image:url(${t.img}); background-size:cover; background-position:center;` : '';
            const sz = Math.round(30 * (Number(t.size) || 1));
            return `<div class="smap-token${mine ? ' smap-token-mine' : ''}${t.img ? ' smap-token-img' : ''}" data-token="${t.id}" data-owner="${t.owner || ''}" style="left:${t.x * 100}%; top:${t.y * 100}%; width:${sz}px; height:${sz}px; --tok:${t.color || (t.type === 'monster' ? '#7A2828' : '#2980b9')}; ${img}" title="${escHtml(t.name)}">${t.img ? '' : `<span>${escHtml((t.name || '?').slice(0, 2))}</span>`}</div>`;
        }).join('');
        view.innerHTML = tokensHtml + '<canvas class="smap-draw"></canvas><canvas class="smap-fog"></canvas>';
        renderPlayerDraw();
        renderPlayerFog();
    }
    // Dessin libre du MJ (synchronisé) côté joueur.
    function renderPlayerDraw() {
        const view = document.getElementById('smap-view'); if (!view) return;
        const canvas = view.querySelector('.smap-draw'); if (!canvas) return;
        const strokes = (mapState.map && mapState.map.drawings) || [];
        const w = Math.max(1, view.clientWidth), h = Math.max(1, view.clientHeight);
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, w, h); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        strokes.forEach(s => {
            if (!s.pts || !s.pts.length) return;
            ctx.strokeStyle = s.color || '#e23b3b'; ctx.lineWidth = s.width || 3;
            ctx.beginPath();
            s.pts.forEach((p, i) => { const px = p.x * w, py = p.y * h; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
            if (s.pts.length === 1) ctx.lineTo(s.pts[0].x * w + 0.5, s.pts[0].y * h + 0.5);
            ctx.stroke();
        });
    }
    // Signal/ping du MJ : ouvre la carte + repère lumineux animé au point indiqué.
    function showMapPing(p) {
        if (!p) return;
        ensureMapUI();
        if (mapToggle) mapToggle.style.display = 'flex';
        if (mapPanel && mapPanel.classList.contains('hidden') && openMapPanel) openMapPanel();
        const view = document.getElementById('smap-view'); if (!view) return;
        const ping = document.createElement('div'); ping.className = 'smap-ping';
        ping.style.left = ((p.x || 0.5) * 100) + '%'; ping.style.top = ((p.y || 0.5) * 100) + '%';
        view.appendChild(ping); setTimeout(() => ping.remove(), 2600);
    }
    // Brouillard côté joueur : OPAQUE (le joueur ne voit que les zones révélées par le MJ).
    function renderPlayerFog() {
        const view = document.getElementById('smap-view'); if (!view) return;
        const canvas = view.querySelector('.smap-fog'); if (!canvas) return;
        const fog = (mapState.map && mapState.map.fog) || null;
        if (!fog || !fog.on) { canvas.style.display = 'none'; return; }
        canvas.style.display = 'block';
        const w = Math.max(1, view.clientWidth), h = Math.max(1, view.clientHeight);
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(6,5,4,0.985)';
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000';                // alpha plein → zones révélées totalement claires
        (fog.reveals || []).forEach(r => { ctx.beginPath(); ctx.arc(r.x * w, r.y * h, (r.r || 0.06) * w, 0, Math.PI * 2); ctx.fill(); });
        ctx.globalCompositeOperation = 'source-over';
    }

    // Déplacement par le joueur de SON jeton (envoyé au MJ qui fait autorité)
    let tokenSendThrottle = 0;
    function sendTokenMove(t, final) {
        const now = Date.now();
        if (!final && now - tokenSendThrottle < 70) return;
        tokenSendThrottle = now;
        sendToGm('token-move', { id: t.id, x: t.x, y: t.y, fromUid: myUid(), final: !!final });
    }
    function setupPlayerTokenDrag(view) {
        if (!view) return;
        let cur = null, el = null;
        view.addEventListener('pointerdown', (e) => {
            const tEl = e.target.closest('.smap-token'); if (!tEl) return;
            const t = (mapState.tokens || []).find(x => x.id === tEl.dataset.token); if (!t) return;
            if (mapState.map && mapState.map.tokensLocked) return;
            if (!t.owner || t.owner !== myUid()) return;   // un joueur ne bouge que son jeton
            cur = t; el = tEl; try { tEl.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault();
        });
        view.addEventListener('pointermove', (e) => {
            if (!cur || !el) return;
            const r = view.getBoundingClientRect();
            const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
            const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
            cur.x = x; cur.y = y; el.style.left = (x * 100) + '%'; el.style.top = (y * 100) + '%';
            sendTokenMove(cur, false);
        });
        const up = () => { if (!cur) return; sendTokenMove(cur, true); cur = null; el = null; };
        view.addEventListener('pointerup', up);
        view.addEventListener('pointercancel', up);
    }

    function teardownMapUI() {
        mapState = { map: {}, tokens: [] };
        if (mapToggle) mapToggle.style.display = 'none';
        if (mapPanel) mapPanel.classList.add('hidden');
    }

    // --- Exclusion ciblée d'un joueur (kick + ban temporaire) ---
    function onKicked(p) {
        if (!p) return;
        const me = myUid();
        if (p.targetUserId && p.targetUserId !== 'all' && p.targetUserId !== me) return; // pas destiné à moi
        const code = state.code;
        if (p.until && code) { try { localStorage.setItem('dnd-session-ban', JSON.stringify({ code: code, until: p.until })); } catch (e) {} }
        const mins = p.until ? Math.max(1, Math.round((p.until - Date.now()) / 60000)) : 0;
        if (window.showAppToast) window.showAppToast(mins ? ('🚫 Exclu par le MJ (' + mins + ' min)') : '🚪 Exclu de la session par le MJ', '#c0392b');
        leave().finally(() => { document.body.style.backgroundImage = ''; document.body.classList.remove('scene-active'); if (window.navTo) window.navTo('home-screen'); });
    }

    // --- Fermeture forcée par le MJ : déconnexion + retour accueil ---
    function onSessionClosed() {
        if (window.showAppToast) window.showAppToast('🚪 La session a été fermée par le MJ.', '#7A2828');
        leave().finally(() => {
            // Nettoyage visuel de l'ambiance diffusée + retour à l'accueil
            document.body.style.backgroundImage = '';
            document.body.classList.remove('scene-active');
            if (window.navTo) window.navTo('home-screen');
            try { if ((location.hash || '').indexOf('#gm') !== 0) location.hash = '#home'; } catch (e) {}
        });
    }

    // --- Styles du module (notifications) ---
    function injectStyles() {
        if (document.getElementById('session-styles')) return;
        const st = document.createElement('style'); st.id = 'session-styles';
        st.textContent = `
        #session-notifs { position:fixed; right:18px; bottom:100px; z-index:9999; display:flex; flex-direction:column; gap:10px; max-width:340px; }
        @keyframes session-notif-in { from{ transform:translateX(40px); opacity:0; } to{ transform:none; opacity:1; } }
        .session-notif { background:#fffdf7; border:2px solid var(--accent-color,#C49B35); border-radius:12px; box-shadow:0 8px 28px rgba(0,0,0,0.32); padding:12px 14px; font-family:'Lora',serif; color:#3a2e1f; animation:session-notif-in 0.25s ease-out; }
        .session-notif-head { font-family:'Cinzel',serif; font-weight:bold; color:var(--primary-color,#7A2828); margin-bottom:6px; }
        .session-notif-body { font-size:0.92rem; }
        .session-notif-body b { color:var(--primary-color,#7A2828); }
        .session-notif-msg { margin-top:6px; font-style:italic; color:#5a4a36; line-height:1.4; }
        .session-notif-actions { display:flex; gap:8px; margin-top:10px; }
        .session-notif-btn { flex:1; border:none; border-radius:8px; padding:8px; font-family:'Cinzel',serif; font-weight:bold; cursor:pointer; font-size:0.85rem; }
        .session-notif-btn.accept { background:#27ae60; color:#fff; }
        .session-notif-btn.accept:hover { filter:brightness(1.08); }
        .session-notif-btn.refuse { background:#f0e6d8; color:#c0392b; }
        .session-notif-btn.refuse:hover { background:#e7d8c4; }
        /* --- FAB de combat (joueur) : apparition « ressort », survol doux, halo en combat --- */
        #session-fab { position:fixed; z-index:9990; width:58px; height:58px; border-radius:50%; border:none; cursor:grab; display:none; align-items:center; justify-content:center; font-size:1.6rem; color:#fff; background:linear-gradient(160deg, var(--primary-hover,#9c3333), var(--primary-color,#7A2828)); box-shadow:0 6px 20px rgba(0,0,0,0.4); touch-action:none; animation:session-fab-in 0.45s cubic-bezier(0.34,1.56,0.64,1); transition:transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.22s ease, filter 0.18s ease; will-change:transform; }
        #session-fab:active { cursor:grabbing; transform:scale(0.92); }
        #session-fab:hover { filter:brightness(1.08); transform:scale(1.08); box-shadow:0 10px 26px rgba(0,0,0,0.45); }
        @keyframes session-fab-in { 0%{ transform:scale(0.3); opacity:0; } 60%{ transform:scale(1.12); opacity:1; } 100%{ transform:none; opacity:1; } }
        .session-fab-ic { transition:transform 0.25s cubic-bezier(0.34,1.56,0.64,1); }
        #session-fab:hover .session-fab-ic { transform:rotate(-12deg) scale(1.08); }
        /* Halo pulsé + pastille quand un combat est en cours */
        #session-fab.fab-combat::before { content:''; position:absolute; inset:-5px; border-radius:50%; border:2px solid var(--accent-color,#C49B35); animation:session-fab-pulse 1.7s ease-out infinite; pointer-events:none; }
        #session-fab.fab-combat::after { content:''; position:absolute; top:2px; right:2px; width:13px; height:13px; border-radius:50%; background:#e74c3c; border:2px solid #fffdf7; box-shadow:0 0 6px rgba(231,76,60,0.9); }
        @keyframes session-fab-pulse { 0%{ transform:scale(0.9); opacity:0.9; } 75%{ transform:scale(1.28); opacity:0; } 100%{ opacity:0; } }
        /* Panneau : glisse + fondu depuis le bouton (au lieu d'apparaître sèchement) */
        #session-fab-panel { position:fixed; z-index:9991; width:250px; max-height:62vh; overflow-y:auto; background:#fffdf7; border:2px solid var(--accent-color,#C49B35); border-radius:14px; box-shadow:0 10px 32px rgba(0,0,0,0.4); padding:12px; font-family:'Lora',serif; color:#3a2e1f; opacity:1; transform:none; transition:opacity 0.22s ease, transform 0.26s cubic-bezier(0.34,1.4,0.64,1), visibility 0s; }
        #session-fab-panel.hidden { display:block; visibility:hidden; opacity:0; transform:translateY(10px) scale(0.94); pointer-events:none; transition:opacity 0.16s ease, transform 0.16s ease, visibility 0s 0.16s; }
        @media (prefers-reduced-motion: reduce) { #session-fab, #session-fab-panel, .session-fab-ic { animation:none !important; transition:none !important; } #session-fab.fab-combat::before { animation:none !important; } }
        .sfp-head { font-family:'Cinzel',serif; font-weight:bold; color:var(--primary-color,#7A2828); margin-bottom:8px; }
        .sfp-head b { font-size:1.1rem; }
        .sfp-btn { width:100%; border:none; border-radius:9px; padding:10px; font-family:'Cinzel',serif; font-weight:bold; cursor:pointer; background:linear-gradient(160deg,#d9af45,#b8862c); color:#2a1c0a; margin-bottom:10px; }
        .sfp-btn:hover { filter:brightness(1.06); }
        .sfp-manual { display:flex; gap:6px; margin-bottom:10px; }
        .sfp-manual-input { flex:1; min-width:0; border:1px solid var(--accent-color,#C49B35); border-radius:9px; padding:9px 10px; font-family:'Lora',serif; font-size:0.9rem; background:#fffdf7; color:#3a2e1f; }
        .sfp-manual-input:focus { outline:none; border-color:var(--primary-color,#7A2828); box-shadow:0 0 0 2px rgba(196,155,53,0.25); }
        .sfp-btn-alt { width:auto; flex:0 0 auto; margin-bottom:0; padding:9px 14px; background:linear-gradient(160deg,#4a6b53,#3a5642); color:#eef6ef; }
        body.theme-dark .sfp-manual-input { background:#2a221b; color:var(--text-color,#ece3d2); }
        .sfp-order { display:flex; flex-direction:column; gap:4px; }
        .sfp-row { display:flex; align-items:center; gap:8px; padding:5px 8px; border-radius:7px; background:rgba(196,155,53,0.12); font-size:0.85rem; }
        .sfp-row.is-turn { background:rgba(196,155,53,0.3); box-shadow:inset 0 0 0 1px var(--accent-color,#C49B35); font-weight:bold; }
        .sfp-init { font-family:'Courier New',monospace; font-weight:bold; min-width:22px; text-align:center; color:var(--primary-color,#7A2828); }
        .sfp-name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .sfp-empty { font-style:italic; color:#8a7a5e; font-size:0.82rem; text-align:center; padding:6px; }
        /* --- Murmure au MJ --- */
        .sfp-btn-whisper { background:linear-gradient(160deg,#6d5a8c,#53446b); color:#f0eaf8; margin-top:8px; margin-bottom:6px; }
        .sfp-btn-whisper:hover { filter:brightness(1.1); }
        .sfp-whisper-text { width:100%; box-sizing:border-box; resize:vertical; min-height:70px; border:1px solid var(--accent-color,#C49B35); border-radius:9px; padding:9px 10px; font-family:'Lora',serif; font-size:0.9rem; background:#fffdf7; color:#3a2e1f; margin-bottom:10px; }
        .sfp-whisper-text:focus { outline:none; border-color:var(--primary-color,#7A2828); box-shadow:0 0 0 2px rgba(196,155,53,0.25); }
        .sfp-whisper-actions { display:flex; gap:8px; }
        .sfp-whisper-actions .sfp-btn { margin-bottom:0; }
        .sfp-whisper-actions #sfp-whisper-send { flex:1; }
        body.theme-dark .sfp-whisper-text { background:#2a221b; color:var(--text-color,#ece3d2); }
        #session-combat-badge { position:fixed; right:14px; bottom:150px; z-index:9980; display:none; background:rgba(40,30,20,0.82); color:#e8dcc2; font-family:'Lora',serif; font-size:0.74rem; padding:6px 12px; border-radius:20px; box-shadow:0 4px 12px rgba(0,0,0,0.3); pointer-events:none; }
        body.session-combat-active #btn-init-next, body.session-combat-active #btn-init-clear { opacity:0.4 !important; pointer-events:none !important; }
        /* UI combat allégée côté joueur : on masque le tracker complet (le FAB suffit) */
        body.session-combat-active #widget-initiative { display:none !important; }
        #session-turn-notice { position:fixed; top:70px; left:50%; transform:translateX(-50%) translateY(-20px); z-index:9993; background:linear-gradient(160deg,#d9af45,#b8862c); color:#2a1c0a; font-family:'Cinzel',serif; font-weight:bold; font-size:0.9rem; padding:10px 18px; border-radius:30px; box-shadow:0 8px 24px rgba(0,0,0,0.4); opacity:0; pointer-events:none; transition:opacity 0.3s, transform 0.3s; max-width:90vw; text-align:center; }
        #session-turn-notice.show { opacity:1; transform:translateX(-50%) translateY(0); }
        body.theme-dark #session-fab-panel { background:#241c16; color:var(--text-color,#ece3d2); }
        body.theme-dark .sfp-row { background:rgba(196,155,53,0.1); }
        body.theme-dark .sfp-empty { color:#9a8a70; }
        /* --- Carte tactique (joueur, lecture seule) --- */
        #session-map-toggle { position:fixed; right:14px; bottom:210px; z-index:9982; width:46px; height:46px; border-radius:50%; border:none; cursor:pointer; display:none; align-items:center; justify-content:center; font-size:1.3rem; background:linear-gradient(160deg,#d9af45,#b8862c); color:#2a1c0a; box-shadow:0 4px 14px rgba(0,0,0,0.4); }
        #session-map-toggle:hover { filter:brightness(1.07); }
        #session-map { position:fixed; z-index:9985; right:14px; bottom:14px; width:min(540px,92vw); background:#fffdf7; border:2px solid var(--accent-color,#C49B35); border-radius:14px; box-shadow:0 12px 40px rgba(0,0,0,0.45); padding:10px; }
        #session-map.hidden { display:none; }
        .smap-head { display:flex; justify-content:space-between; align-items:center; font-family:'Cinzel',serif; font-weight:bold; color:var(--primary-color,#7A2828); margin-bottom:6px; }
        .smap-head button { background:none; border:none; cursor:pointer; font-size:1rem; color:var(--primary-color,#7A2828); }
        .smap-view { position:relative; width:100%; aspect-ratio:16/9; background:#11100e; background-size:contain; background-position:center; background-repeat:no-repeat; border-radius:8px; overflow:hidden; }
        .smap-view.show-grid::after { content:''; position:absolute; inset:0; pointer-events:none; background-image:linear-gradient(rgba(255,255,255,0.13) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.13) 1px,transparent 1px); background-size:var(--gm-grid,48px) var(--gm-grid,48px); }
        .smap-token { position:absolute; width:30px; height:30px; transform:translate(-50%,-50%); border-radius:50%; background:var(--tok,#2980b9); border:2px solid #fff; display:flex; align-items:center; justify-content:center; color:#fff; font-family:'Cinzel',serif; font-weight:bold; font-size:0.68rem; box-shadow:0 2px 5px rgba(0,0,0,0.5); touch-action:none; }
        .smap-token-mine { cursor:grab; box-shadow:0 0 0 2px #fff, 0 0 10px var(--accent-color,#C49B35); }
        .smap-token-mine:active { cursor:grabbing; }
        .smap-token-img { background-size:cover; background-position:center; border-color:#f3e8cf; }
        .smap-fog { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; border-radius:8px; }
        .smap-draw { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; border-radius:8px; }
        .smap-ping { position:absolute; width:40px; height:40px; transform:translate(-50%,-50%); border-radius:50%; border:3px solid #C49B35; box-shadow:0 0 16px #C49B35; pointer-events:none; z-index:6; animation:smap-ping-anim 1s ease-out 2; }
        @keyframes smap-ping-anim { 0%{ transform:translate(-50%,-50%) scale(0.3); opacity:0.95; } 100%{ transform:translate(-50%,-50%) scale(1.9); opacity:0; } }
        #session-image-viewer { position:fixed; inset:0; z-index:10000; background:rgba(8,6,4,0.92); display:flex; align-items:center; justify-content:center; padding:24px; cursor:zoom-out; }
        #session-image-viewer.hidden { display:none; }
        #session-image-viewer img { max-width:94vw; max-height:90vh; border-radius:10px; border:2px solid var(--accent-color,#C49B35); box-shadow:0 16px 60px rgba(0,0,0,0.7); }
        #session-image-viewer .siv-close { position:fixed; top:18px; right:22px; width:42px; height:42px; border-radius:50%; border:none; background:#fffdf7; color:var(--primary-color,#7A2828); font-size:1.2rem; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.4); }
        .smap-head-btns { display:flex; gap:4px; }
        #session-map.smap-fullscreen { right:0; bottom:0; top:0; left:0; width:100vw; height:100vh; border-radius:0; z-index:9995; display:flex; flex-direction:column; }
        #session-map.smap-fullscreen .smap-view { flex:1; aspect-ratio:auto; height:auto; }
        body.theme-dark #session-map { background:#241c16; }`;
        document.head.appendChild(st);
    }

    // ---------- API publique ----------

    async function closePresence() {
        if (state.channel) {
            try { await state.channel.untrack(); } catch (e) {}
            try { await state.channel.unsubscribe(); } catch (e) {}
            state.channel = null;
        }
    }

    // ---------- API publique ----------
    async function join(code) {
        code = String(code || '').toUpperCase().trim();
        if (!code || code.length < 4) throw new Error('CODE_INVALIDE');
        // Bannissement temporaire en cours pour cette session ?
        try { const b = JSON.parse(localStorage.getItem('dnd-session-ban') || 'null'); if (b && b.code === code && b.until > Date.now()) { const mins = Math.max(1, Math.round((b.until - Date.now()) / 60000)); if (window.showAppToast) window.showAppToast('🚫 Banni de cette session pour encore ~' + mins + ' min.', '#c0392b'); throw new Error('BANNI'); } } catch (e) { if (e && e.message === 'BANNI') throw e; }
        if (!window.SupaAuth || !window.SupaAuth.currentUser) throw new Error('NON_CONNECTE');
        const charId = activeCharId();
        if (!charId) throw new Error('AUCUNE_FICHE');

        const sessionId = await window.SupaAuth.joinSession(code, charId, snapName(charId));
        state.code = code; state.sessionId = sessionId; state.charId = charId;
        persist(); emit();
        openPresence();
        pushSnapshot(true);
        setMusicRole('player');
        ensureFab(); updateFabVisibility(); loadLiveState();
        if (window.showAppToast) window.showAppToast('🔗 Connecté à la session ' + code, '#2c3e50');
        return sessionId;
    }

    async function leave() {
        const sid = state.sessionId;
        await closePresence();
        state.code = null; state.sessionId = null;
        persist(); emit();
        setMusicRole('free');
        teardownCombatUI(); teardownMapUI();
        if (sid && window.SupaAuth) { try { await window.SupaAuth.leaveSession(sid); } catch (e) {} }
        if (window.showAppToast) window.showAppToast('Session quittée', '#7A2828');
    }

    function isConnected() { return !!state.sessionId; }
    function getState() { return { connected: !!state.sessionId, code: state.code, sessionId: state.sessionId }; }

    // ---------- Restauration après rechargement ----------
    function waitForUser(cb, tries) {
        tries = tries == null ? 25 : tries;
        if (window.SupaAuth && window.SupaAuth.currentUser) return cb();
        if (tries <= 0) return;
        setTimeout(() => waitForUser(cb, tries - 1), 200);
    }

    function restore() {
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) {}
        if (!saved || !saved.sessionId) return;
        try { const b = JSON.parse(localStorage.getItem('dnd-session-ban') || 'null'); if (b && b.code === saved.code && b.until > Date.now()) return; } catch (e) {}
        waitForUser(() => {
            // La fiche active doit correspondre à celle liée à la session
            const charId = activeCharId();
            if (charId && saved.charId && charId !== saved.charId) return; // autre perso → on ne reconnecte pas
            state.code = saved.code; state.sessionId = saved.sessionId; state.charId = saved.charId || charId;
            emit();
            openPresence();
            pushSnapshot(true);
            setMusicRole('player');
            ensureFab(); updateFabVisibility(); loadLiveState();
        });
    }

    // ---------- Câblage des changements de fiche ----------
    function init() {
        injectStyles();
        const app = document.getElementById('app-screen') || document.body;
        const onChange = () => pushSnapshot(false);
        app.addEventListener('input', onChange, true);
        app.addEventListener('change', onChange, true);
        // PV via boutons rapides (+/−) → pas forcément un input : on republie après clic
        app.addEventListener('click', (e) => {
            if (e.target.closest('#btn-hp-damage, #btn-hp-heal, #btn-short-rest, #btn-long-rest')) setTimeout(() => pushSnapshot(false), 50);
        }, true);
        // Le bouton de combat suit l'écran actif (visible seulement sur la fiche joueur)
        document.addEventListener('screen:change', updateFabVisibility);
        restore();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.PlayerSession = { join, leave, isConnected, getState, pushSnapshot, restore };
})();
