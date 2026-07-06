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
              .on('broadcast', { event: 'concentration' }, ({ payload }) => receiveConcentration(payload))
              .on('broadcast', { event: 'inspiration' }, ({ payload }) => receiveInspiration(payload))
              .on('broadcast', { event: 'npc-card' }, ({ payload }) => receiveNpcCard(payload))
              .on('broadcast', { event: 'timer' }, ({ payload }) => receiveTimer(payload))
              .subscribe(async (status) => {
                  if (status === 'SUBSCRIBED') {
                      try { await ch.track({ role: 'player', name: snapName(), charId: state.charId, online: true }); } catch (e) {}
                  }
              });
            state.channel = ch;
        } catch (e) { console.warn('presence:', e); }
    }

    let debugUid = null;   // uid simulé pour les tests hors session (voir debugApplyMap)
    function myUid() { return (window.SupaAuth && window.SupaAuth.currentUser && window.SupaAuth.currentUser.id) || debugUid; }
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
        if (p.targetUserId && p.targetUserId !== 'all' && p.targetUserId !== myUid()) return; // image ciblée : pas pour moi
        let wrap = document.getElementById('session-notifs');
        if (!wrap) { wrap = document.createElement('div'); wrap.id = 'session-notifs'; wrap.className = 'no-print'; document.body.appendChild(wrap); }
        const card = document.createElement('div'); card.className = 'session-notif';
        card.innerHTML = `<div class="session-notif-head">🖼️ Le MJ partage une image</div><div class="session-notif-actions"></div>`;
        const actions = card.querySelector('.session-notif-actions');
        actions.appendChild(mkBtn('🔍 Ouvrir', 'accept', () => { openSharedImage(p.url); card.remove(); }));
        actions.appendChild(mkBtn('Ignorer', 'refuse', () => card.remove()));
        wrap.appendChild(card);
    }
    // Jet de dés partagé (MJ ou joueur) → carte ANIMÉE : le dé tourne puis le résultat claque.
    function receiveDiceRoll(p) {
        if (!p) return;
        let wrap = document.getElementById('session-notifs');
        if (!wrap) { wrap = document.createElement('div'); wrap.id = 'session-notifs'; wrap.className = 'no-print'; document.body.appendChild(wrap); }
        const card = document.createElement('div'); card.className = 'session-notif session-dice-card';
        card.innerHTML = `<div class="session-notif-head"><span class="sdc-die">🎲</span> ${escHtml(p.user || 'MJ')} lance ${escHtml(p.formula || '')}</div>
            <div class="session-notif-body sdc-body"><b class="sdc-total">${escHtml(String(p.total))}</b> <span style="opacity:.6;">(${escHtml(p.detail || '')})</span></div>`;
        wrap.appendChild(card);
        setTimeout(() => { card.style.transition = 'opacity .4s'; card.style.opacity = '0'; setTimeout(() => card.remove(), 400); }, 6000);
    }
    // --- Concentration : le MJ signale qu'un jet de CON est requis (DD calculé) ---
    function receiveConcentration(p) {
        if (!p) return;
        if (p.targetUserId && p.targetUserId !== myUid()) return;
        let wrap = document.getElementById('session-notifs');
        if (!wrap) { wrap = document.createElement('div'); wrap.id = 'session-notifs'; wrap.className = 'no-print'; document.body.appendChild(wrap); }
        const card = document.createElement('div'); card.className = 'session-notif';
        card.innerHTML = `<div class="session-notif-head">🌀 Concentration menacée !</div>
            <div class="session-notif-body">Tu subis <b>${escHtml(String(p.dmg || '?'))}</b> dégâts en te concentrant.<br>Jet de sauvegarde de <b>Constitution DD ${escHtml(String(p.dc || 10))}</b> pour maintenir le sort.</div>
            <div class="session-notif-actions"></div>`;
        const actions = card.querySelector('.session-notif-actions');
        actions.appendChild(mkBtn('🎲 Jet de CON', 'accept', () => {
            const modEl = document.getElementById('mod-con');
            const mod = modEl ? (parseInt(String(modEl.textContent).replace('+', ''), 10) || 0) : 0;
            const d = Math.floor(Math.random() * 20) + 1, total = d + mod;
            const ok = total >= (p.dc || 10);
            card.querySelector('.session-notif-body').innerHTML = `Jet de CON : ${d}${mod ? (mod > 0 ? ' +' + mod : ' ' + mod) : ''} = <b>${total}</b> → ${ok ? '✅ concentration maintenue !' : '❌ concentration perdue…'}`;
            actions.innerHTML = '';
            sendToGm('whisper', { name: snapName(), fromUid: myUid(), text: '🌀 Concentration DD ' + (p.dc || 10) + ' : ' + total + ' → ' + (ok ? 'maintenue ✅' : 'PERDUE ❌'), ts: Date.now() });
            if (!ok) { const cb = document.getElementById('is-concentrating'); if (cb && cb.checked) { cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); } }
            setTimeout(() => card.remove(), 6000);
        }));
        actions.appendChild(mkBtn('Ignorer', 'refuse', () => card.remove()));
        wrap.appendChild(card);
    }
    // --- ✨ Inspiration héroïque accordée par le MJ : coche la vraie case de la fiche ---
    function receiveInspiration(p) {
        if (!p) return;
        if (p.targetUserId && p.targetUserId !== 'all' && p.targetUserId !== myUid()) return;
        const cb = document.getElementById('heroic-inspiration');
        if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
        if (window.showAppToast) window.showAppToast('✨ Le MJ t\'accorde l\'inspiration héroïque !', '#b8862c');
    }
    // --- 🎴 Carte de PNJ révélée par le MJ (portrait + nom + description) ---
    function receiveNpcCard(p) {
        if (!p || !p.name) return;
        let ov = document.getElementById('session-npc-card');
        if (!ov) {
            ov = document.createElement('div'); ov.id = 'session-npc-card'; ov.className = 'no-print';
            ov.addEventListener('click', () => ov.classList.add('hidden'));
            document.body.appendChild(ov);
        }
        ov.innerHTML = `<div class="snc-box" onclick="event.stopPropagation()">
            ${p.img ? `<img class="snc-img" src="${escHtml(p.img)}" alt="">` : '<div class="snc-noimg">🎭</div>'}
            <div class="snc-name">${escHtml(p.name)}</div>
            ${p.text ? `<div class="snc-text">${escHtml(p.text)}</div>` : ''}
            <button class="snc-close">✕</button>
        </div>`;
        ov.querySelector('.snc-close').addEventListener('click', () => ov.classList.add('hidden'));
        ov.classList.remove('hidden');
    }
    // --- ⏳ Minuteur partagé lancé par le MJ ---
    let sessTimerInt = null;
    function receiveTimer(p) {
        let el = document.getElementById('session-timer');
        clearInterval(sessTimerInt);
        if (!p || !p.until || p.until <= Date.now()) { if (el) el.remove(); return; }
        if (!el) { el = document.createElement('div'); el.id = 'session-timer'; el.className = 'no-print'; document.body.appendChild(el); }
        const tick = () => {
            const left = p.until - Date.now();
            if (left <= 0) { clearInterval(sessTimerInt); el.remove(); if (window.showAppToast) window.showAppToast('⏰ Temps écoulé !', '#c0392b'); return; }
            const s = Math.ceil(left / 1000);
            el.textContent = '⏳ ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
            el.classList.toggle('is-low', s <= 10);
        };
        tick(); sessTimerInt = setInterval(tick, 500);
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

    // Mini-parser de formule de dés (2d6+3, 1d20-1…) — équivalent léger du lanceur MJ.
    function rollFormulaLite(raw) {
        const clean = String(raw || '').toLowerCase().replace(/\s+/g, '');
        if (!clean || !/^[0-9d+\-]+$/.test(clean)) return null;
        let total = 0; const parts = [];
        const tokens = clean.match(/[+\-]?[^+\-]+/g) || [];
        for (const tk of tokens) {
            const sign = tk[0] === '-' ? -1 : 1;
            const body = tk.replace(/^[+\-]/, '');
            const dm = body.match(/^(\d*)d(\d+)$/);
            if (dm) {
                const n = Math.min(50, parseInt(dm[1] || '1', 10)), faces = Math.min(1000, parseInt(dm[2], 10));
                if (!n || !faces) return null;
                for (let i = 0; i < n; i++) { const r = Math.floor(Math.random() * faces) + 1; total += sign * r; parts.push(r); }
            } else {
                const v = parseInt(body, 10); if (isNaN(v)) return null;
                total += sign * v;
            }
        }
        return { total, detail: parts.join(' ') };
    }
    function sendSharedRoll() {
        const inp = document.getElementById('sfp-dice-formula'); if (!inp) return;
        const f = (inp.value || '').trim() || '1d20';
        const res = rollFormulaLite(f);
        if (!res) { if (window.showAppToast) window.showAppToast('Formule invalide (ex : 2d6+3)', '#c0392b'); return; }
        const payload = { user: snapName(), formula: f, total: res.total, detail: res.detail };
        sendToGm('dice', payload);          // le MJ ET les autres joueurs le reçoivent
        receiveDiceRoll(payload);           // soi-même (les broadcasts ne reviennent pas à l'émetteur)
        inp.value = '';
    }
    function renderFabPanel() {
        if (!fabPanel) return;
        const whisperBtn = `<button id="sfp-whisper-open" class="sfp-btn sfp-btn-whisper" type="button">🤫 Murmurer au MJ</button>`
            + `<div class="sfp-manual"><input id="sfp-dice-formula" class="sfp-manual-input" placeholder="2d6+3 (dé partagé)"><button id="sfp-dice-share" class="sfp-btn sfp-btn-alt" title="Lancer devant tout le monde">🎲</button></div>`;
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
        const ds = document.getElementById('sfp-dice-share');
        if (ds) ds.addEventListener('click', sendSharedRoll);
        const df = document.getElementById('sfp-dice-formula');
        if (df) df.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendSharedRoll(); } });
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
        renderTurnbar();
        maybeNotifyTurn();
    }

    // --- Barre de tour partagée (en haut de l'écran pendant le combat) ---
    function renderTurnbar() {
        let bar = document.getElementById('session-turnbar');
        const app = document.getElementById('app-screen');
        const show = combatState.active && !!state.sessionId && !!(app && !app.classList.contains('hidden'));
        if (!show) { if (bar) bar.style.display = 'none'; return; }
        if (!bar) { bar = document.createElement('div'); bar.id = 'session-turnbar'; bar.className = 'no-print'; document.body.appendChild(bar); }
        bar.style.display = 'flex';
        const myName = (snapName() || '').toLowerCase();
        const chips = (combatState.order || []).map((c, i) => {
            const me = c.name && c.name.toLowerCase() === myName;
            return `<span class="stb-chip${i === combatState.turnIndex ? ' is-turn' : ''}${me ? ' is-me' : ''}">${c.type === 'monster' ? '👹' : '🧝'} ${escHtml(c.name)}</span>`;
        }).join('');
        bar.innerHTML = `<span class="stb-round">R${combatState.round || 1}</span>${chips || '<span class="stb-chip">En attente des initiatives…</span>'}`;
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
        const tb = document.getElementById('session-turnbar'); if (tb) tb.style.display = 'none';
        const tm = document.getElementById('session-timer'); if (tm) { clearInterval(sessTimerInt); tm.remove(); }
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
    let playerDragBusy = false;      // je déplace MON jeton : ne pas reconstruire le DOM sous mon doigt
    let pendingMapRender = false;    // un état carte est arrivé pendant le drag → re-rendu au lâcher
    let playerAoe = { on: false, kind: 'circle', color: '#3498db', draft: null };  // outil gabarit de sort côté joueur

    // --- Bouton/élément flottant générique : glisser librement, aimanté au bord le plus proche au lâcher ---
    function makeEdgeDock(el, storeKey, defaults) {
        const margin = 10;
        const read = () => { try { return JSON.parse(localStorage.getItem(storeKey) || 'null'); } catch (e) { return null; } };
        const applyEdge = (edge, offset) => {
            const w = el.offsetWidth || 48, h = el.offsetHeight || 48;
            el.style.left = el.style.right = el.style.top = el.style.bottom = 'auto';
            if (edge === 'left') { el.style.left = margin + 'px'; el.style.top = clampN(offset, margin, window.innerHeight - h - margin) + 'px'; }
            else if (edge === 'right') { el.style.right = margin + 'px'; el.style.top = clampN(offset, margin, window.innerHeight - h - margin) + 'px'; }
            else if (edge === 'top') { el.style.top = margin + 'px'; el.style.left = clampN(offset, margin, window.innerWidth - w - margin) + 'px'; }
            else { el.style.bottom = margin + 'px'; el.style.left = clampN(offset, margin, window.innerWidth - w - margin) + 'px'; }
        };
        const glideTo = (edge, offset) => {                          // glisse animée vers le bord, puis ré-ancrage
            const w = el.offsetWidth || 48, h = el.offsetHeight || 48;
            let tx, ty;
            if (edge === 'left') { tx = margin; ty = clampN(offset, margin, window.innerHeight - h - margin); }
            else if (edge === 'right') { tx = window.innerWidth - w - margin; ty = clampN(offset, margin, window.innerHeight - h - margin); }
            else if (edge === 'top') { ty = margin; tx = clampN(offset, margin, window.innerWidth - w - margin); }
            else { ty = window.innerHeight - h - margin; tx = clampN(offset, margin, window.innerWidth - w - margin); }
            el.style.transition = 'left 0.3s cubic-bezier(0.22,0.9,0.35,1.15), top 0.3s cubic-bezier(0.22,0.9,0.35,1.15)';
            el.style.left = tx + 'px'; el.style.top = ty + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto';
            clearTimeout(el._dockTimer);
            el._dockTimer = setTimeout(() => {
                el.style.transition = 'none';
                applyEdge(edge, offset);
                requestAnimationFrame(() => { el.style.transition = ''; });
            }, 320);
        };
        let dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
        el.style.touchAction = 'none';
        el.addEventListener('pointerdown', (e) => {
            if (e.button != null && e.button !== 0) return;
            dragging = true; moved = false;
            const r = el.getBoundingClientRect();
            ox = e.clientX - r.left; oy = e.clientY - r.top; sx = e.clientX; sy = e.clientY;
            el.style.transition = 'none';
            try { el.setPointerCapture(e.pointerId); } catch (_) {}
        });
        el.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            if (Math.abs(e.clientX - sx) > 4 || Math.abs(e.clientY - sy) > 4) moved = true;
            const w = el.offsetWidth, h = el.offsetHeight;
            el.style.left = clampN(e.clientX - ox, margin, window.innerWidth - w - margin) + 'px';
            el.style.top = clampN(e.clientY - oy, margin, window.innerHeight - h - margin) + 'px';
            el.style.right = 'auto'; el.style.bottom = 'auto';
        });
        const up = (e) => {
            if (!dragging) return; dragging = false;
            el.style.transition = '';
            el.dataset.dragged = moved ? '1' : '0';
            if (moved) {
                const w = el.offsetWidth, h = el.offsetHeight;
                const r = el.getBoundingClientRect();
                const cx = r.left + w / 2, cy = r.top + h / 2;
                const dl = cx, drr = window.innerWidth - cx, dt = cy, db = window.innerHeight - cy;
                const min = Math.min(dl, drr, dt, db);
                let edge, offset;
                if (min === dl) { edge = 'left'; offset = r.top; }
                else if (min === drr) { edge = 'right'; offset = r.top; }
                else if (min === dt) { edge = 'top'; offset = r.left; }
                else { edge = 'bottom'; offset = r.left; }
                glideTo(edge, offset);
                try { localStorage.setItem(storeKey, JSON.stringify({ edge, offset })); } catch (err) {}
            }
            try { el.releasePointerCapture(e.pointerId); } catch (_) {}
        };
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
        window.addEventListener('resize', () => { const p = read(); if (p && p.edge) applyEdge(p.edge, p.offset); });
        const p = read();
        if (p && p.edge) applyEdge(p.edge, p.offset || 60);
        else applyEdge(defaults.edge, defaults.offset);
    }

    function ensureMapUI() {
        if (mapToggle) return;
        mapToggle = document.createElement('button');
        mapToggle.id = 'session-map-toggle'; mapToggle.className = 'no-print'; mapToggle.type = 'button';
        mapToggle.textContent = '🗺️'; mapToggle.title = 'Carte tactique (glisse-moi le long des bords)';
        document.body.appendChild(mapToggle);

        mapPanel = document.createElement('div');
        mapPanel.id = 'session-map'; mapPanel.className = 'no-print hidden';
        mapPanel.innerHTML = '<div class="smap-head"><span>🗺️ Carte tactique</span><div class="smap-head-btns"><button id="smap-aoe" title="Gabarit de sort / zone d\'effet">🎯</button><button id="smap-sheet" title="Ma fiche (petit widget déplaçable)">🪪</button><button id="smap-full" title="Plein écran">⛶</button><button id="smap-close" title="Fermer">✕</button></div></div><div id="smap-view" class="smap-view"></div>';
        document.body.appendChild(mapPanel);

        const fullBtn = mapPanel.querySelector('#smap-full');
        const syncFullBtn = () => { fullBtn.title = mapPanel.classList.contains('smap-fullscreen') ? 'Réduire' : 'Plein écran'; fullBtn.textContent = mapPanel.classList.contains('smap-fullscreen') ? '🗗' : '⛶'; };
        // Rendu immédiat (lire clientWidth force la mise en page) + une passe rAF de sécurité.
        // (rAF seul ne suffit pas : il ne tourne pas si l'onglet est en arrière-plan.)
        // Reconstruit tout le board : sa géométrie dépend de la taille de la fenêtre carte.
        const refreshMapCanvases = () => {
            if (playerDragBusy) { pendingMapRender = true; return; }
            renderPlayerMap();
            requestAnimationFrame(() => { if (!playerDragBusy) renderPlayerMap(); });
        };
        let resizeT = null;
        window.addEventListener('resize', () => {
            if (mapPanel.classList.contains('hidden')) return;
            clearTimeout(resizeT); resizeT = setTimeout(refreshMapCanvases, 150);
        });
        // La carte s'ouvre en PETIT, avec une animation depuis le bouton ; ⛶ agrandit (animé).
        openMapPanel = () => {
            mapPanel.classList.remove('smap-fullscreen');
            mapPanel.classList.remove('hidden');
            syncFullBtn();
            // Origine de l'animation = position du bouton carte (où qu'il soit ancré)
            try {
                const tr = mapToggle.getBoundingClientRect(), pr = mapPanel.getBoundingClientRect();
                const ax = clampN(tr.left + tr.width / 2 - pr.left, 0, pr.width);
                const ay = clampN(tr.top + tr.height / 2 - pr.top, 0, pr.height);
                mapPanel.style.transformOrigin = ax + 'px ' + ay + 'px';
            } catch (e) { mapPanel.style.transformOrigin = 'bottom right'; }
            mapPanel.classList.remove('smap-anim-open');
            void mapPanel.offsetWidth;                     // relance l'animation CSS
            mapPanel.classList.add('smap-anim-open');
            refreshMapCanvases();
        };
        // Petit ↔ plein écran : transition FLIP fluide (au lieu d'un saut sec)
        const toggleFullscreen = () => {
            const first = mapPanel.getBoundingClientRect();
            mapPanel.classList.remove('smap-anim-open');
            mapPanel.classList.toggle('smap-fullscreen');
            syncFullBtn();
            const last = mapPanel.getBoundingClientRect();
            if (last.width && last.height) {
                mapPanel.style.transformOrigin = '0 0';
                mapPanel.style.transition = 'none';
                mapPanel.style.transform = `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${first.width / last.width}, ${first.height / last.height})`;
                requestAnimationFrame(() => {
                    mapPanel.style.transition = 'transform 0.34s cubic-bezier(0.22,0.9,0.3,1)';
                    mapPanel.style.transform = 'none';
                    setTimeout(() => { mapPanel.style.transition = ''; }, 360);
                });
            }
            refreshMapCanvases();
        };
        mapToggle.addEventListener('click', () => {
            if (mapToggle.dataset.dragged === '1') { mapToggle.dataset.dragged = '0'; return; }   // fin de glisser ≠ clic
            if (mapPanel.classList.contains('hidden')) openMapPanel(); else mapPanel.classList.add('hidden');
        });
        mapPanel.querySelector('#smap-close').addEventListener('click', () => mapPanel.classList.add('hidden'));
        mapPanel.querySelector('#smap-sheet').addEventListener('click', toggleSheetWidget);
        const aoeBtn = mapPanel.querySelector('#smap-aoe');
        if (aoeBtn) aoeBtn.addEventListener('click', () => { playerAoe.on = !playerAoe.on; aoeBtn.classList.toggle('is-on', playerAoe.on); renderPlayerAoeBar(); });
        fullBtn.addEventListener('click', toggleFullscreen);
        // Le bouton carte se déplace et s'aimante aux bords (position mémorisée)
        makeEdgeDock(mapToggle, 'dnd-maptoggle-pos', { edge: 'right', offset: Math.round(window.innerHeight * 0.3) });
        setupPlayerTokenDrag(document.getElementById('smap-view'));
    }

    // Signature « structurelle » de la carte : tout SAUF la position x/y des jetons.
    // Si elle est inchangée d'une trame à l'autre, on se contente de déplacer les jetons
    // existants (transition CSS fluide) au lieu de reconstruire tout le DOM.
    function mapStructSig(ms) {
        const m = ms.map || {}, walls = m.walls || [];
        return JSON.stringify({
            bg: m.bg || '', ar: m.stageAR || 0, grid: m.gridSize || 48, sg: m.showGrid !== false,
            bx: m.bgX || 0, by: m.bgY || 0, bs: m.bgScale || 1, w: m.weather || '',
            doors: walls.filter(w => w.door).map(w => [w.id, !!w.open, !!w.locked, !!w.secret]),
            wl: walls.length, tpl: (m.templates || []).length, dr: (m.drawings || []).length,
            fog: !!(m.fog && m.fog.on), fr: ((m.fog && m.fog.reveals) || []).length,
            dark: !!(m.dark && m.dark.on), dR: (m.dark && m.dark.range) || 0, li: (m.lights || []).length,
            tk: (ms.tokens || []).map(t => [t.id, t.owner || '', Number(t.size) || 1, t.img || '', t.name || '', !!t.hidden, (t.badges || ''), t.color || '', t.layer || '']).sort()
        });
    }
    let lastMapSig = null;
    function applyMap(map, tokens) {
        mapState = { map: map || {}, tokens: tokens || [] };
        ensureMapUI();
        const hasMap = !!(mapState.map && mapState.map.bg) || (mapState.tokens && mapState.tokens.length);
        mapToggle.style.display = (state.sessionId && hasMap) ? 'flex' : 'none';
        if (!(state.sessionId && hasMap)) mapPanel.classList.add('hidden');
        // Pendant que je déplace mon jeton, reconstruire le DOM casserait le glisser en cours :
        // on note qu'un re-rendu est dû et on l'applique au lâcher.
        if (playerDragBusy) { pendingMapRender = true; return; }
        const sig = mapStructSig(mapState);
        const hasAura = (mapState.tokens || []).some(t => t.aura && Number(t.aura.r) > 0);
        const board = playerBoard();
        if (board && lastMapSig !== null && sig === lastMapSig && !hasAura) patchTokenPositions();
        else renderPlayerMap();
        lastMapSig = sig;
    }
    // Déplace seulement les jetons déjà présents (fluide), rafraîchit vision + portes visibles.
    function patchTokenPositions() {
        const board = playerBoard(); if (!board) { renderPlayerMap(); return; }
        (mapState.tokens || []).filter(t => !t.hidden).forEach(t => {
            const el = board.querySelector('.smap-token[data-token="' + t.id + '"]');
            if (el) { el.style.left = (t.x * 100) + '%'; el.style.top = (t.y * 100) + '%'; }
        });
        renderPlayerDark();
        const m = mapState.map || {};
        if ((m.dark && m.dark.on) || (m.fog && m.fog.on)) refreshPlayerDoors();  // la visibilité des portes suit les jetons
    }
    // Recalcule quelles portes sont visibles (utilisé pendant un déplacement fluide).
    function refreshPlayerDoors() {
        const board = playerBoard(); if (!board) return;
        const m = mapState.map || {};
        const bw = Math.max(1, board.clientWidth), bh = Math.max(1, board.clientHeight);
        const origins = playerVisionOrigins(bw, bh), segs = playerBlockingSegsPx(bw, bh);
        board.querySelectorAll('.smap-door-btn').forEach(b => b.remove());
        const html = (m.walls || []).filter(s => s.door && !s.secret && doorVisibleToPlayer(s, bw, bh, origins, segs)).map(doorButtonHtml).join('');
        if (html) board.insertAdjacentHTML('beforeend', html);
    }
    function doorButtonHtml(s) {
        const mx = (s.x1 + s.x2) / 2 * 100, my = (s.y1 + s.y2) / 2 * 100;
        const cls = 'smap-door-btn' + (s.open ? ' is-open' : '') + (s.locked ? ' is-locked' : '');
        const tip = s.locked ? 'Porte verrouillée' : (s.open ? 'Porte ouverte — clic : fermer' : 'Porte fermée — clic : ouvrir');
        return `<button class="${cls}" data-door="${s.id}"${s.locked ? ' disabled' : ''} style="left:${mx}%; top:${my}%;" title="${tip}">${s.locked ? '🔒' : '🚪'}</button>`;
    }

    // Le BOARD : plateau à ratio fixe (m.stageAR), identique à celui du MJ — les fractions
    // x/y y correspondent pile aux mêmes points de la carte (fix « voir à travers les murs »).
    function playerBoard() { const v = document.getElementById('smap-view'); return v ? (v.querySelector('.smap-board') || v) : null; }
    // IDENTIQUE à gridPxFor(w) côté MJ → même taille de case et de jetons des deux côtés.
    function playerGridPx(bw) {
        const m = mapState.map || {};
        return Math.max(4, (m.gridSize || 48) * bw / 1000);
    }
    function playerCellM() { return Number(mapState.map && mapState.map.cellM) || 1.5; }
    function renderPlayerMap() {
        const view = document.getElementById('smap-view'); if (!view) return;
        const m = mapState.map || {};
        const uid = myUid(), locked = !!m.tokensLocked;
        // Géométrie du board : letterbox au MÊME ratio que le MJ (défaut 16/9 identique) → boards superposables.
        const vw = Math.max(1, view.clientWidth), vh = Math.max(1, view.clientHeight);
        const AR = Number(m.stageAR) || (16 / 9);
        let bw = Math.min(vw, vh * AR), bh = bw / AR, bl = (vw - bw) / 2, bt = (vh - bh) / 2;
        const gpx = playerGridPx(bw);
        const tokensHtml = (mapState.tokens || []).filter(t => !t.hidden).map(t => {
            const mine = !locked && t.owner && t.owner === uid;
            const img = t.img ? `background-image:url(${t.img}); background-size:cover; background-position:center;` : '';
            // FORMULE IDENTIQUE au MJ (tokenHtml) → même taille apparente des jetons.
            const sz = Math.max(12, Math.round(Math.max(6, gpx) * (Number(t.size) || 1) * 0.92));
            const onMap = t.layer === 'map';
            let aura = '';
            if (t.aura && Number(t.aura.r) > 0) {
                const apx = (Number(t.aura.r) / playerCellM()) * gpx;
                aura = `<div class="smap-aura" style="left:${t.x * 100}%; top:${t.y * 100}%; width:${apx * 2}px; height:${apx * 2}px; --aura:${t.aura.color || '#3498db'};"></div>`;
            }
            const badges = t.badges ? `<span class="smap-badges">${escHtml(t.badges)}</span>` : '';
            return aura + `<div class="smap-token${mine ? ' smap-token-mine' : ''}${t.img ? ' smap-token-img' : ''}${onMap ? ' smap-token-onmap' : ''}" data-token="${t.id}" data-owner="${t.owner || ''}" style="left:${t.x * 100}%; top:${t.y * 100}%; width:${sz}px; height:${sz}px; --tok:${t.color || (t.type === 'monster' ? '#7A2828' : '#2980b9')}; ${img}" title="${escHtml(t.name)}">${t.img ? '' : `<span>${escHtml((t.name || '?').slice(0, 2))}</span>`}${badges}</div>`;
        }).join('');
        // Portes : jamais les secrètes, et seulement celles RÉELLEMENT en vue quand
        // l'obscurité ou le brouillard sont actifs (le joueur ne devine plus les portes cachées).
        const doorOrigins = playerVisionOrigins(bw, bh);
        const doorSegs = playerBlockingSegsPx(bw, bh);
        const doorsHtml = (m.walls || []).filter(s => s.door && !s.secret && doorVisibleToPlayer(s, bw, bh, doorOrigins, doorSegs)).map(doorButtonHtml).join('');
        view.innerHTML = `<div class="smap-board" style="left:${bl}px; top:${bt}px; width:${bw}px; height:${bh}px;">` + tokensHtml + doorsHtml
            + '<canvas class="smap-draw"></canvas><canvas class="smap-templates"></canvas><canvas class="smap-weather"></canvas><canvas class="smap-fog"></canvas><canvas class="smap-dark"></canvas></div>';
        const board = view.querySelector('.smap-board');
        board.style.backgroundImage = m.bg ? `url(${m.bg})` : 'none';
        const f = AR > 0 ? bw / 1000 : 1;
        const bx = (m.bgX || 0) * f, by = (m.bgY || 0) * f, bs = Number(m.bgScale) || 1;
        board.style.backgroundPosition = `calc(50% + ${bx}px) calc(50% + ${by}px)`;
        board.style.backgroundSize = (bs === 1) ? 'contain' : (bs * 100) + '%';
        board.classList.toggle('show-grid', m.showGrid !== false);
        board.style.setProperty('--gm-grid', gpx + 'px');
        view.classList.remove('show-grid'); view.style.backgroundImage = 'none';   // (ancien rendu sur la vue)
        renderPlayerDraw();
        renderPlayerTemplates();
        renderPlayerWeather();
        renderPlayerFog();
        renderPlayerDark();
        renderPlayerAoeBar();
    }
    // Barre d'outils gabarit côté joueur (formes + couleur + effacer). Le MJ peut la désactiver.
    function renderPlayerAoeBar() {
        const view = document.getElementById('smap-view'); if (!view) return;
        let bar = view.querySelector('#smap-aoe-bar');
        const off = !!(mapState.map && mapState.map.playerAoeOff);
        const aoeBtn = mapPanel && mapPanel.querySelector('#smap-aoe');
        if (aoeBtn) aoeBtn.style.display = off ? 'none' : '';
        if (off) playerAoe.on = false;
        if (!playerAoe.on) { if (bar) bar.remove(); return; }
        if (!bar) { bar = document.createElement('div'); bar.id = 'smap-aoe-bar'; bar.className = 'smap-aoe-bar'; view.appendChild(bar); }
        const shapes = [['circle', '⭕'], ['cone', '🔺'], ['line', '➖'], ['cube', '⬛']];
        bar.innerHTML = shapes.map(s => `<button data-aoe="${s[0]}" class="${playerAoe.kind === s[0] ? 'is-on' : ''}" title="Forme">${s[1]}</button>`).join('')
            + `<input type="color" id="smap-aoe-color" value="${playerAoe.color}" title="Couleur">`
            + `<button data-aoe="clear" title="Effacer mes gabarits">🧹</button>`;
        bar.querySelectorAll('[data-aoe]').forEach(b => b.addEventListener('click', (e) => {
            e.stopPropagation();
            if (b.dataset.aoe === 'clear') { sendToGm('template-clear', { fromUid: myUid() }); return; }
            playerAoe.kind = b.dataset.aoe; renderPlayerAoeBar();
        }));
        const col = bar.querySelector('#smap-aoe-color'); if (col) col.addEventListener('input', (e) => { playerAoe.color = e.target.value; });
    }
    // Gabarits de sorts posés par le MJ (sphère / cône / ligne / cube)
    function renderPlayerTemplates() {
        const board = playerBoard(); if (!board) return;
        const canvas = board.querySelector('.smap-templates'); if (!canvas) return;
        const w = Math.max(1, board.clientWidth), h = Math.max(1, board.clientHeight);
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        const ts = ((mapState.map && mapState.map.templates) || []).concat(playerAoe.draft ? [playerAoe.draft] : []);
        if (ts.length && window.VTTGeo && window.VTTGeo.drawTemplates) window.VTTGeo.drawTemplates(ctx, w, h, ts, playerGridPx(w), playerCellM());
    }
    // Météo d'ambiance décidée par le MJ (pluie, neige, brume, braises)
    function renderPlayerWeather() {
        const board = playerBoard(); if (!board) return;
        const canvas = board.querySelector('.smap-weather'); if (!canvas) return;
        if (window.VTTWeather) window.VTTWeather.apply(canvas, (mapState.map && mapState.map.weather) || '', Math.max(1, board.clientWidth), Math.max(1, board.clientHeight));
    }
    // Origines de vision du joueur (SES jetons + les lumières du MJ), en px du board donné.
    function playerVisionOrigins(w, h) {
        const m = mapState.map || {};
        if (!window.VTTGeo) return [];
        const uid = myUid();
        const dk = Object.assign({}, m.dark || {}, { cellM: playerCellM() });
        const g = playerGridPx(w);
        const origins = [];
        (mapState.tokens || []).filter(t => !t.hidden && t.owner && t.owner === uid)
            .forEach(t => origins.push({ x: t.x * w, y: t.y * h, R: window.VTTGeo.visionRadiusPx(t, dk, g) }));
        (m.lights || []).forEach(l => origins.push({ x: l.x * w, y: l.y * h, R: (Number(l.r) || 0.16) * w }));
        return origins;
    }
    // Murs bloquants en px, id conservé (pour exclure une porte de son propre test de vue).
    function playerBlockingSegsPx(w, h) {
        const walls = (mapState.map && mapState.map.walls) || [];
        if (!window.VTTGeo) return [];
        return window.VTTGeo.blockingWalls(walls).map(s => ({ id: s.id, x1: s.x1 * w, y1: s.y1 * h, x2: s.x2 * w, y2: s.y2 * h }));
    }
    // Une porte est-elle réellement vue par le joueur ? (respecte obscurité + brouillard)
    function doorVisibleToPlayer(s, w, h, origins, segsPx) {
        const m = mapState.map || {};
        if (m.fog && m.fog.on) {
            const mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2;
            const revealed = (m.fog.reveals || []).some(r => Math.hypot(r.x - mx, r.y - my) <= (r.r || 0.06));
            if (!revealed) return false;
        }
        if (m.dark && m.dark.on && window.VTTGeo && window.VTTGeo.pointVisible) {
            const mx = (s.x1 + s.x2) / 2 * w, my = (s.y1 + s.y2) / 2 * h;
            const segsNoSelf = segsPx.filter(g => g.id !== s.id);   // la porte ne se bloque pas elle-même
            return window.VTTGeo.pointVisible(mx, my, origins, segsNoSelf);
        }
        return true;                                                // ni noir ni brouillard : tout est visible
    }
    // --- Obscurité (vision limitée) : NOIR TOTAL hors de portée de vision de MES jetons.
    // Les murs invisibles posés par le MJ bloquent la ligne de vue (portes fermées incluses).
    let darkRaf = false;
    function scheduleDark() { if (darkRaf) return; darkRaf = true; requestAnimationFrame(() => { darkRaf = false; renderPlayerDark(); }); }
    function renderPlayerDark() {
        const view = playerBoard(); if (!view) return;
        const canvas = view.querySelector('.smap-dark'); if (!canvas) return;
        const m = mapState.map || {};
        const dark = m.dark || null;
        if (!dark || !dark.on || !window.VTTGeo) { canvas.style.display = 'none'; return; }
        canvas.style.display = 'block';
        const w = Math.max(1, view.clientWidth), h = Math.max(1, view.clientHeight);
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgb(4,3,2)';                       // noir complet : on ne voit RIEN au-delà
        ctx.fillRect(0, 0, w, h);
        const uid = myUid();
        const mine = (mapState.tokens || []).filter(t => !t.hidden && t.owner && t.owner === uid);
        const lights = (m.lights || []);
        const segs = window.VTTGeo.wallsToPx(m.walls || [], w, h);
        const g = playerGridPx(w);                          // px d'une case sur CE board (échelle partagée)
        const dk = Object.assign({}, dark, { cellM: playerCellM() });
        if (mine.length || lights.length) {
            ctx.globalCompositeOperation = 'destination-out';
            mine.forEach(t => window.VTTGeo.eraseVision(ctx, t.x * w, t.y * h, segs, window.VTTGeo.visionRadiusPx(t, dk, g)));
            // Les points de lumière du MJ (torches au sol, lanternes…) éclairent tout le monde.
            lights.forEach(l => window.VTTGeo.eraseVision(ctx, l.x * w, l.y * h, segs, (Number(l.r) || 0.16) * w));
            ctx.globalCompositeOperation = 'source-over';
        }
        if (!mine.length && !lights.length) {
            ctx.fillStyle = 'rgba(232,216,182,0.75)';
            ctx.font = 'italic 13px Lora, serif'; ctx.textAlign = 'center';
            ctx.fillText('🌑 Il fait noir… vous ne voyez rien.', w / 2, h / 2);
            ctx.textAlign = 'start';
        }
    }
    // Dessin libre du MJ (synchronisé) côté joueur.
    function renderPlayerDraw() {
        const view = playerBoard(); if (!view) return;
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
        const view = playerBoard(); if (!view) return;
        const ping = document.createElement('div'); ping.className = 'smap-ping';
        ping.style.left = ((p.x || 0.5) * 100) + '%'; ping.style.top = ((p.y || 0.5) * 100) + '%';
        view.appendChild(ping); setTimeout(() => ping.remove(), 2600);
    }
    // Brouillard côté joueur : OPAQUE (le joueur ne voit que les zones révélées par le MJ).
    function renderPlayerFog() {
        const view = playerBoard(); if (!view) return;
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
        // Clic sur une porte visible non verrouillée → demande d'ouverture/fermeture au MJ (autorité).
        view.addEventListener('click', (e) => {
            const dEl = e.target.closest('.smap-door-btn'); if (!dEl) return;
            if (dEl.disabled) { if (window.showAppToast) window.showAppToast('🔒 Cette porte est verrouillée.', '#c0392b'); return; }
            sendToGm('door-toggle', { id: dEl.dataset.door, fromUid: myUid() });
            if (window.showAppToast) window.showAppToast('🚪 …', '#2c3e50');
        });
        let aoeDrawing = false;
        const boardFrac = (e) => { const b = playerBoard() || view; const r = b.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }; };
        view.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.smap-door-btn') || e.target.closest('#smap-aoe-bar')) return;
            // Outil gabarit actif : glisser sur la carte trace la zone d'effet (origine → taille).
            if (playerAoe.on) {
                const p = boardFrac(e);
                playerAoe.draft = { kind: playerAoe.kind, x: p.x, y: p.y, x2: p.x, y2: p.y, color: playerAoe.color };
                aoeDrawing = true;
                try { view.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); return;
            }
            const tEl = e.target.closest('.smap-token'); if (!tEl) return;
            const t = (mapState.tokens || []).find(x => x.id === tEl.dataset.token); if (!t) return;
            if (mapState.map && mapState.map.tokensLocked) return;
            if (!t.owner || t.owner !== myUid()) return;   // un joueur ne bouge que son jeton
            cur = t; el = tEl; playerDragBusy = true;
            el.classList.add('smap-token-dragging');
            try { tEl.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault();
        });
        view.addEventListener('pointermove', (e) => {
            if (aoeDrawing && playerAoe.draft) {
                const p = boardFrac(e); playerAoe.draft.x2 = p.x; playerAoe.draft.y2 = p.y;
                renderPlayerTemplates(); return;
            }
            if (!cur || !el) return;
            const b = playerBoard() || view;
            const r = b.getBoundingClientRect();               // coordonnées relatives au BOARD (espace partagé)
            const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
            const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
            // Les murs (et portes fermées) posés par le MJ sont infranchissables pour un joueur.
            const walls = (mapState.map && mapState.map.walls) || [];
            if (walls.length && window.VTTGeo && window.VTTGeo.moveBlocked(walls, cur.x, cur.y, x, y)) return;
            cur.x = x; cur.y = y; el.style.left = (x * 100) + '%'; el.style.top = (y * 100) + '%';
            scheduleDark();                                // ma vision suit mon jeton en direct
            sendTokenMove(cur, false);
        });
        const up = () => {
            if (aoeDrawing && playerAoe.draft) {
                const d = playerAoe.draft; playerAoe.draft = null; aoeDrawing = false;
                if (Math.hypot((d.x2 - d.x), (d.y2 - d.y)) > 0.01) {
                    sendToGm('template-add', { kind: d.kind, x: d.x, y: d.y, x2: d.x2, y2: d.y2, color: d.color, by: 'player', byUid: myUid() });
                }
                renderPlayerTemplates(); return;
            }
            if (!cur) return;
            if (el) el.classList.remove('smap-token-dragging');
            sendTokenMove(cur, true); cur = null; el = null; playerDragBusy = false;
            if (pendingMapRender) { pendingMapRender = false; renderPlayerMap(); }
        };
        view.addEventListener('pointerup', up);
        view.addEventListener('pointercancel', up);
    }

    // =====================================================
    // WIDGET FICHE (joueur) : mini-fiche déplaçable par-dessus la carte
    // =====================================================
    let sheetWidget = null, sswTimer = null;
    function vId(id) { const el = document.getElementById(id); return el ? el.value : ''; }
    function toggleSheetWidget() {
        ensureSheetWidget();
        const hidden = sheetWidget.classList.toggle('hidden');
        clearInterval(sswTimer);
        if (!hidden) { refreshSheetWidget(); sswTimer = setInterval(refreshSheetWidget, 1500); }   // suit la fiche en direct
    }
    function ensureSheetWidget() {
        if (sheetWidget) return;
        sheetWidget = document.createElement('div');
        sheetWidget.id = 'session-sheet-widget'; sheetWidget.className = 'no-print hidden';
        sheetWidget.innerHTML = `
            <div class="ssw-head"><span class="ssw-drag" title="Glisser pour déplacer">⠿</span><b class="ssw-name">Ma fiche</b><button class="ssw-close" title="Fermer">✕</button></div>
            <div class="ssw-hp-row">
                <button class="ssw-hp-btn" data-hp="-5">−5</button>
                <button class="ssw-hp-btn" data-hp="-1">−1</button>
                <div class="ssw-hp" id="ssw-hp"></div>
                <button class="ssw-hp-btn ssw-hp-plus" data-hp="1">+1</button>
                <button class="ssw-hp-btn ssw-hp-plus" data-hp="5">+5</button>
            </div>
            <div class="ssw-hpbar"><div class="ssw-hpbar-fill"></div></div>
            <div class="ssw-pills" id="ssw-pills"></div>
            <div class="ssw-abilities" id="ssw-abilities"></div>
            <div class="ssw-conds" id="ssw-conds"></div>`;
        document.body.appendChild(sheetWidget);
        sheetWidget.querySelector('.ssw-close').addEventListener('click', () => { sheetWidget.classList.add('hidden'); clearInterval(sswTimer); });
        sheetWidget.querySelectorAll('.ssw-hp-btn').forEach(b => b.addEventListener('click', () => bumpHp(parseInt(b.dataset.hp, 10) || 0)));
        // Déplacement par l'en-tête (position mémorisée)
        const head = sheetWidget.querySelector('.ssw-head');
        let dragging = false, ox = 0, oy = 0;
        head.style.touchAction = 'none';
        head.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.ssw-close')) return;
            dragging = true;
            const r = sheetWidget.getBoundingClientRect();
            ox = e.clientX - r.left; oy = e.clientY - r.top;
            try { head.setPointerCapture(e.pointerId); } catch (_) {}
            e.preventDefault();
        });
        head.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const x = clampN(e.clientX - ox, 4, window.innerWidth - sheetWidget.offsetWidth - 4);
            const y = clampN(e.clientY - oy, 4, window.innerHeight - sheetWidget.offsetHeight - 4);
            sheetWidget.style.left = x + 'px'; sheetWidget.style.top = y + 'px'; sheetWidget.style.right = 'auto'; sheetWidget.style.bottom = 'auto';
        });
        const up = () => {
            if (!dragging) return; dragging = false;
            try { localStorage.setItem('dnd-ssw-pos', JSON.stringify({ x: parseInt(sheetWidget.style.left, 10) || 0, y: parseInt(sheetWidget.style.top, 10) || 0 })); } catch (e) {}
        };
        head.addEventListener('pointerup', up); head.addEventListener('pointercancel', up);
        try {
            const p = JSON.parse(localStorage.getItem('dnd-ssw-pos') || 'null');
            if (p) { sheetWidget.style.left = clampN(p.x, 4, Math.max(4, window.innerWidth - 270)) + 'px'; sheetWidget.style.top = clampN(p.y, 4, Math.max(4, window.innerHeight - 220)) + 'px'; sheetWidget.style.right = 'auto'; sheetWidget.style.bottom = 'auto'; }
        } catch (e) {}
    }
    // ± PV : modifie le VRAI champ de la fiche (les écouteurs de l'app + la synchro MJ suivent)
    function bumpHp(delta) {
        const inp = document.getElementById('hp-current'); if (!inp) return;
        const max = parseInt((document.getElementById('hp-max') || {}).value, 10);
        let v = (parseInt(inp.value, 10) || 0) + delta;
        if (!isNaN(max)) v = Math.min(v, max);
        inp.value = Math.max(0, v);
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        refreshSheetWidget();
    }
    function refreshSheetWidget() {
        if (!sheetWidget || sheetWidget.classList.contains('hidden')) return;
        sheetWidget.querySelector('.ssw-name').textContent = vId('char-name') || 'Ma fiche';
        const hp = parseInt(vId('hp-current'), 10), hpMax = parseInt(vId('hp-max'), 10), tmp = parseInt(vId('hp-temp'), 10);
        sheetWidget.querySelector('#ssw-hp').innerHTML = `❤️ <b>${isNaN(hp) ? '—' : hp}</b>/${isNaN(hpMax) ? '—' : hpMax}${(!isNaN(tmp) && tmp > 0) ? ` <span class="ssw-tmp">+${tmp}</span>` : ''}`;
        const ratio = (hpMax > 0 && !isNaN(hp)) ? Math.max(0, Math.min(1, hp / hpMax)) : 0;
        const fill = sheetWidget.querySelector('.ssw-hpbar-fill');
        fill.style.width = (ratio * 100) + '%';
        fill.classList.toggle('is-low', ratio <= 0.33);
        sheetWidget.querySelector('#ssw-pills').innerHTML =
            `<span class="ssw-pill">🛡️ CA <b>${escHtml(vId('armor-class') || '—')}</b></span>` +
            `<span class="ssw-pill">👟 <b>${escHtml(vId('speed') || '—')}</b></span>` +
            `<span class="ssw-pill">⚡ Init <b>${escHtml(vId('initiative') || '—')}</b></span>` +
            `<span class="ssw-pill">👁️ Perc. <b>${escHtml(vId('passive-perception') || '—')}</b></span>`;
        const abbr = { str: 'FOR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'SAG', cha: 'CHA' };
        sheetWidget.querySelector('#ssw-abilities').innerHTML = Object.keys(abbr).map(a => {
            const md = document.getElementById('mod-' + a);
            return `<div class="ssw-ab"><span>${abbr[a]}</span><b>${md ? escHtml(md.textContent.trim()) : '—'}</b></div>`;
        }).join('');
        const conds = [];
        document.querySelectorAll('#conditions-track-container input[type="checkbox"]:checked, #custom-conditions-container input[type="checkbox"]:checked').forEach(cb => {
            const lbl = (cb.parentElement ? cb.parentElement.textContent : '').replace(/\s+/g, ' ').trim();
            if (lbl) conds.push(lbl);
        });
        sheetWidget.querySelector('#ssw-conds').innerHTML = conds.map(c => `<span class="ssw-cond">${escHtml(c)}</span>`).join('');
    }

    function teardownMapUI() {
        mapState = { map: {}, tokens: [] };
        if (mapToggle) mapToggle.style.display = 'none';
        if (mapPanel) mapPanel.classList.add('hidden');
        if (sheetWidget) { sheetWidget.classList.add('hidden'); clearInterval(sswTimer); }
    }

    // Retour à la VRAIE page d'accueil. L'app choisit accueil-vs-fiche UNIQUEMENT au chargement
    // (selon dnd-active-char) et navigue par rechargement : un simple navTo('home-screen')
    // révélerait un accueil jamais peuplé. On reproduit donc le bouton « Retour Accueil ».
    function goHomeHard(bannerMsg) {
        try { localStorage.removeItem('dnd-active-char'); } catch (e) {}
        try { if (bannerMsg) sessionStorage.setItem('dnd-boot-toast', bannerMsg); } catch (e) {}
        try { if ((location.hash || '').indexOf('#gm') !== 0) location.hash = '#home'; } catch (e) {}
        document.body.style.backgroundImage = ''; document.body.classList.remove('scene-active');
        location.reload();
    }

    // --- Exclusion ciblée d'un joueur (kick + ban temporaire) ---
    function onKicked(p) {
        if (!p) return;
        const me = myUid();
        if (p.targetUserId && p.targetUserId !== 'all' && p.targetUserId !== me) return; // pas destiné à moi
        const code = state.code;
        if (p.until && code) { try { localStorage.setItem('dnd-session-ban', JSON.stringify({ code: code, until: p.until })); } catch (e) {} }
        const mins = p.until ? Math.max(1, Math.round((p.until - Date.now()) / 60000)) : 0;
        const msg = mins ? ('🚫 Exclu par le MJ (' + mins + ' min)') : '🚪 Exclu de la session par le MJ';
        if (window.showAppToast) window.showAppToast(msg, '#c0392b');
        // On quitte proprement (untrack présence + suppression de la ligne) PUIS on recharge sur l'accueil.
        leave().finally(() => setTimeout(() => goHomeHard(msg), 700));
    }

    // --- Fermeture forcée par le MJ : déconnexion + retour accueil ---
    function onSessionClosed() {
        const msg = '🚪 La session a été fermée par le MJ.';
        if (window.showAppToast) window.showAppToast(msg, '#7A2828');
        leave().finally(() => setTimeout(() => goHomeHard(msg), 700));
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
        #session-map-toggle { position:fixed; right:14px; bottom:210px; z-index:9982; width:46px; height:46px; border-radius:50%; border:none; cursor:grab; touch-action:none; display:none; align-items:center; justify-content:center; font-size:1.3rem; background:linear-gradient(160deg,#d9af45,#b8862c); color:#2a1c0a; box-shadow:0 4px 14px rgba(0,0,0,0.4); }
        #session-map-toggle:hover { filter:brightness(1.07); }
        #session-map-toggle:active { cursor:grabbing; }
        #session-map { position:fixed; z-index:9985; right:14px; bottom:14px; width:min(540px,92vw); background:#fffdf7; border:2px solid var(--accent-color,#C49B35); border-radius:14px; box-shadow:0 12px 40px rgba(0,0,0,0.45); padding:10px; }
        #session-map.hidden { display:none; }
        .smap-head { display:flex; justify-content:space-between; align-items:center; font-family:'Cinzel',serif; font-weight:bold; color:var(--primary-color,#7A2828); margin-bottom:6px; }
        .smap-head button { background:none; border:none; cursor:pointer; font-size:1rem; color:var(--primary-color,#7A2828); }
        .smap-view { position:relative; width:100%; aspect-ratio:16/9; background:#11100e; border-radius:8px; overflow:hidden; }
        /* BOARD : plateau à ratio fixe, même espace de coordonnées que chez le MJ */
        .smap-board { position:absolute; background-color:#171410; background-size:contain; background-position:center; background-repeat:no-repeat; box-shadow:0 0 0 1px rgba(196,155,53,0.2); }
        .smap-board.show-grid::after { content:''; position:absolute; inset:0; pointer-events:none; background-image:linear-gradient(rgba(255,255,255,0.13) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.13) 1px,transparent 1px); background-size:var(--gm-grid,48px) var(--gm-grid,48px); }
        .smap-templates, .smap-weather { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }
        .smap-aura { position:absolute; transform:translate(-50%,-50%); border-radius:50%; pointer-events:none; background:radial-gradient(circle, color-mix(in srgb, var(--aura,#3498db) 26%, transparent) 0%, color-mix(in srgb, var(--aura,#3498db) 14%, transparent) 70%, transparent 72%); border:1px dashed color-mix(in srgb, var(--aura,#3498db) 60%, transparent); }
        .smap-badges { position:absolute; bottom:calc(100% + 1px); left:50%; transform:translateX(-50%); white-space:nowrap; font-size:0.6rem; line-height:1; background:rgba(20,14,8,0.78); border-radius:8px; padding:1px 4px; pointer-events:none; }
        .smap-token { position:absolute; width:30px; height:30px; transform:translate(-50%,-50%); border-radius:50%; background:var(--tok,#2980b9); border:2px solid #fff; display:flex; align-items:center; justify-content:center; color:#fff; font-family:'Cinzel',serif; font-weight:bold; font-size:0.68rem; box-shadow:0 2px 5px rgba(0,0,0,0.5); touch-action:none; transition:left 0.1s linear, top 0.1s linear; }
        .smap-token-dragging { transition:none !important; z-index:9; }
        .smap-token-onmap { z-index:1; opacity:0.94; box-shadow:0 1px 3px rgba(0,0,0,0.5); }
        .smap-aoe-bar { position:absolute; top:8px; left:8px; z-index:12; display:flex; gap:4px; align-items:center; background:rgba(28,20,12,0.92); border:1px solid rgba(196,155,53,0.5); border-radius:10px; padding:4px 6px; box-shadow:0 3px 10px rgba(0,0,0,0.5); }
        .smap-aoe-bar.hidden { display:none; }
        .smap-aoe-bar button { width:30px; height:30px; border-radius:7px; border:1px solid rgba(196,155,53,0.35); background:#2a2118; color:#ece3d2; cursor:pointer; font-size:0.95rem; padding:0; }
        .smap-aoe-bar button.is-on { background:rgba(196,155,53,0.4); border-color:#C49B35; }
        .smap-aoe-bar input[type=color] { width:28px; height:28px; padding:0; border:1px solid rgba(196,155,53,0.35); border-radius:6px; background:none; cursor:pointer; }
        #smap-aoe.is-on { background:rgba(196,155,53,0.4); }
        .smap-token-mine { cursor:grab; box-shadow:0 0 0 2px #fff, 0 0 10px var(--accent-color,#C49B35); }
        .smap-token-mine:active { cursor:grabbing; }
        .smap-token-img { background-size:cover; background-position:center; border-color:#f3e8cf; }
        .smap-fog { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; border-radius:8px; }
        .smap-draw { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; border-radius:8px; }
        .smap-dark { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; border-radius:8px; }
        /* Portes cliquables par les joueurs (au-dessus de l'obscurité) */
        .smap-door-btn { position:absolute; transform:translate(-50%,-50%); z-index:8; width:28px; height:28px; padding:0; border-radius:50%; border:2px solid #d68a2b; background:rgba(34,24,14,0.92); font-size:0.9rem; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.5); }
        .smap-door-btn:hover { transform:translate(-50%,-50%) scale(1.15); box-shadow:0 0 12px rgba(214,138,43,0.9); }
        .smap-door-btn.is-open { border-color:#57a64a; }
        .smap-door-btn.is-locked { border-color:#c0392b; cursor:not-allowed; opacity:0.85; }
        /* Ouverture de la carte : elle « jaillit » depuis le bouton flottant */
        @keyframes smap-open-anim { 0%{ transform:scale(0.25); opacity:0; } 60%{ opacity:1; } 100%{ transform:none; opacity:1; } }
        #session-map.smap-anim-open { animation:smap-open-anim 0.32s cubic-bezier(0.26,1.2,0.42,1); }
        @media (prefers-reduced-motion: reduce) { #session-map { animation:none !important; transition:none !important; } }
        .smap-ping { position:absolute; width:40px; height:40px; transform:translate(-50%,-50%); border-radius:50%; border:3px solid #C49B35; box-shadow:0 0 16px #C49B35; pointer-events:none; z-index:6; animation:smap-ping-anim 1s ease-out 2; }
        @keyframes smap-ping-anim { 0%{ transform:translate(-50%,-50%) scale(0.3); opacity:0.95; } 100%{ transform:translate(-50%,-50%) scale(1.9); opacity:0; } }
        #session-image-viewer { position:fixed; inset:0; z-index:10000; background:rgba(8,6,4,0.92); display:flex; align-items:center; justify-content:center; padding:24px; cursor:zoom-out; }
        #session-image-viewer.hidden { display:none; }
        #session-image-viewer img { max-width:94vw; max-height:90vh; border-radius:10px; border:2px solid var(--accent-color,#C49B35); box-shadow:0 16px 60px rgba(0,0,0,0.7); }
        #session-image-viewer .siv-close { position:fixed; top:18px; right:22px; width:42px; height:42px; border-radius:50%; border:none; background:#fffdf7; color:var(--primary-color,#7A2828); font-size:1.2rem; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.4); }
        .smap-head-btns { display:flex; gap:4px; }
        #session-map.smap-fullscreen { right:0; bottom:0; top:0; left:0; width:100vw; height:100vh; border-radius:0; z-index:9995; display:flex; flex-direction:column; }
        #session-map.smap-fullscreen .smap-view { flex:1; aspect-ratio:auto; height:auto; }
        body.theme-dark #session-map { background:#241c16; }
        /* --- Widget « Ma fiche » : mini-fiche déplaçable par-dessus la carte --- */
        #session-sheet-widget { position:fixed; left:auto; right:20px; top:90px; z-index:9996; width:248px; background:#fffdf7; border:2px solid var(--accent-color,#C49B35); border-radius:13px; box-shadow:0 12px 36px rgba(0,0,0,0.45); padding:0 10px 10px; font-family:'Lora',serif; color:#3a2e1f; animation:session-notif-in 0.22s ease-out; }
        #session-sheet-widget.hidden { display:none; }
        .ssw-head { display:flex; align-items:center; gap:7px; margin:0 -10px 8px; padding:8px 10px; background:linear-gradient(180deg,rgba(196,155,53,0.2),rgba(196,155,53,0.06)); border-radius:11px 11px 0 0; cursor:grab; user-select:none; }
        .ssw-head:active { cursor:grabbing; }
        .ssw-drag { color:#8a7a5e; font-size:0.9rem; }
        .ssw-name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-family:'Cinzel',serif; color:var(--primary-color,#7A2828); font-size:0.92rem; }
        .ssw-close { background:none; border:none; cursor:pointer; color:var(--primary-color,#7A2828); font-size:0.95rem; padding:2px 4px; }
        .ssw-hp-row { display:flex; align-items:center; gap:4px; }
        .ssw-hp { flex:1; text-align:center; font-size:0.95rem; white-space:nowrap; }
        .ssw-hp b { color:var(--primary-color,#7A2828); font-size:1.1rem; }
        .ssw-tmp { color:#2471a3; font-weight:bold; font-size:0.8rem; }
        .ssw-hp-btn { border:1px solid rgba(122,40,40,0.35); background:#fdf3df; color:#7A2828; border-radius:7px; padding:5px 0; width:34px; cursor:pointer; font-weight:bold; font-size:0.8rem; }
        .ssw-hp-btn:hover { background:#f4e2bd; }
        .ssw-hp-btn.ssw-hp-plus { color:#1e8449; }
        .ssw-hpbar { height:7px; border-radius:4px; background:rgba(122,40,40,0.15); margin:7px 0 9px; overflow:hidden; }
        .ssw-hpbar-fill { height:100%; border-radius:4px; background:linear-gradient(90deg,#27ae60,#2ecc71); transition:width 0.25s ease; }
        .ssw-hpbar-fill.is-low { background:linear-gradient(90deg,#c0392b,#e74c3c); }
        .ssw-pills { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:8px; }
        .ssw-pill { font-size:0.74rem; background:rgba(196,155,53,0.13); border:1px solid rgba(196,155,53,0.35); border-radius:12px; padding:3px 8px; white-space:nowrap; }
        .ssw-pill b { color:var(--primary-color,#7A2828); }
        .ssw-abilities { display:grid; grid-template-columns:repeat(6,1fr); gap:4px; margin-bottom:6px; }
        .ssw-ab { display:flex; flex-direction:column; align-items:center; background:rgba(196,155,53,0.1); border-radius:7px; padding:4px 0; }
        .ssw-ab span { font-size:0.6rem; color:#8a7a5e; font-family:'Cinzel',serif; }
        .ssw-ab b { font-size:0.82rem; color:var(--primary-color,#7A2828); }
        .ssw-conds { display:flex; flex-wrap:wrap; gap:4px; }
        .ssw-cond { font-size:0.7rem; background:rgba(192,57,43,0.12); border:1px solid rgba(192,57,43,0.35); color:#96281b; border-radius:10px; padding:2px 7px; }
        body.theme-dark #session-sheet-widget { background:#241c16; color:var(--text-color,#ece3d2); }
        body.theme-dark .ssw-hp-btn { background:#2a221b; }
        body.theme-dark .ssw-hp-btn:hover { background:#332a20; }
        body.theme-dark .ssw-cond { color:#e89a8c; }
        /* --- Barre de tour (combat) en haut de l'écran joueur --- */
        #session-turnbar { position:fixed; top:8px; left:50%; transform:translateX(-50%); z-index:9970; display:flex; align-items:center; gap:6px; max-width:92vw; overflow-x:auto; padding:6px 10px; background:rgba(30,23,16,0.92); border:1px solid var(--accent-color,#C49B35); border-radius:24px; box-shadow:0 6px 18px rgba(0,0,0,0.4); scrollbar-width:none; }
        .stb-round { font-family:'Cinzel',serif; font-weight:bold; color:var(--accent-color,#C49B35); font-size:0.82rem; flex:0 0 auto; padding-right:4px; border-right:1px solid rgba(196,155,53,0.4); }
        .stb-chip { flex:0 0 auto; font-family:'Lora',serif; font-size:0.76rem; color:#d8cbb2; background:rgba(196,155,53,0.12); border-radius:14px; padding:3px 9px; white-space:nowrap; }
        .stb-chip.is-turn { background:linear-gradient(160deg,#d9af45,#b8862c); color:#2a1c0a; font-weight:bold; box-shadow:0 0 10px rgba(196,155,53,0.7); }
        .stb-chip.is-me { outline:1px dashed rgba(196,155,53,0.8); }
        /* --- Carte de dé animée --- */
        .session-dice-card .sdc-die { display:inline-block; animation:sdc-spin 0.7s cubic-bezier(0.3,0.8,0.4,1.4); }
        .session-dice-card .sdc-total { display:inline-block; font-size:1.35rem; color:var(--primary-color,#7A2828); animation:sdc-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.35s backwards; }
        @keyframes sdc-spin { 0%{ transform:rotate(0) scale(0.6); } 70%{ transform:rotate(680deg) scale(1.25); } 100%{ transform:rotate(720deg) scale(1); } }
        @keyframes sdc-pop { 0%{ transform:scale(0); opacity:0; } 100%{ transform:scale(1); opacity:1; } }
        /* --- Carte PNJ révélée --- */
        #session-npc-card { position:fixed; inset:0; z-index:9998; background:rgba(8,6,4,0.75); display:flex; align-items:center; justify-content:center; padding:20px; }
        #session-npc-card.hidden { display:none; }
        .snc-box { position:relative; width:min(340px,92vw); background:#fffdf7; border:3px double var(--accent-color,#C49B35); border-radius:16px; padding:18px; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,0.6); animation:snc-in 0.35s cubic-bezier(0.26,1.2,0.42,1); font-family:'Lora',serif; color:#3a2e1f; }
        @keyframes snc-in { 0%{ transform:scale(0.6) rotate(-3deg); opacity:0; } 100%{ transform:none; opacity:1; } }
        .snc-img { width:150px; height:150px; object-fit:cover; border-radius:50%; border:3px solid var(--accent-color,#C49B35); box-shadow:0 6px 18px rgba(0,0,0,0.35); }
        .snc-noimg { font-size:3.4rem; }
        .snc-name { font-family:'Cinzel',serif; font-weight:bold; font-size:1.25rem; color:var(--primary-color,#7A2828); margin-top:8px; }
        .snc-text { margin-top:8px; font-style:italic; line-height:1.45; color:#5a4a36; }
        .snc-close { position:absolute; top:8px; right:10px; background:none; border:none; cursor:pointer; font-size:1rem; color:var(--primary-color,#7A2828); }
        body.theme-dark .snc-box { background:#241c16; color:#ece3d2; }
        body.theme-dark .snc-text { color:#c2b094; }
        /* --- Minuteur partagé --- */
        #session-timer { position:fixed; top:8px; right:14px; z-index:9971; background:linear-gradient(160deg,#2c231b,#1d1712); color:#f3e3bb; border:2px solid var(--accent-color,#C49B35); border-radius:22px; padding:7px 14px; font-family:'Cinzel',serif; font-weight:bold; box-shadow:0 6px 18px rgba(0,0,0,0.45); pointer-events:none; }
        #session-timer.is-low { border-color:#e74c3c; color:#ffb3a7; animation:st-blink 0.6s steps(2) infinite; }
        @keyframes st-blink { 50% { opacity:0.5; } }`;
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

    // Message reporté après un rechargement (ex : exclusion par le MJ)
    function flushBootToast() {
        let m = null;
        try { m = sessionStorage.getItem('dnd-boot-toast'); sessionStorage.removeItem('dnd-boot-toast'); } catch (e) {}
        if (m) setTimeout(() => { if (window.showAppToast) window.showAppToast(m, '#7A2828'); }, 900);
    }

    // ---------- Câblage des changements de fiche ----------
    function init() {
        injectStyles();
        flushBootToast();
        const app = document.getElementById('app-screen') || document.body;
        const onChange = () => pushSnapshot(false);
        app.addEventListener('input', onChange, true);
        app.addEventListener('change', onChange, true);
        // PV via boutons rapides (+/−) → pas forcément un input : on republie après clic
        app.addEventListener('click', (e) => {
            if (e.target.closest('#btn-hp-damage, #btn-hp-heal, #btn-short-rest, #btn-long-rest')) setTimeout(() => pushSnapshot(false), 50);
            // Le MJ est prévenu quand un joueur entame un repos (journal de combat)
            const rest = e.target.closest('#btn-short-rest, #btn-long-rest');
            if (rest && state.sessionId) sendToGm('rest', { name: snapName(), kind: rest.id === 'btn-long-rest' ? 'long' : 'court' });
        }, true);
        // Le bouton de combat et la barre de tour suivent l'écran actif
        document.addEventListener('screen:change', () => { updateFabVisibility(); renderTurnbar(); });
        restore();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.PlayerSession = { join, leave, isConnected, getState, pushSnapshot, restore,
        // Crochets de TEST (preview sans Supabase) : simulent ce que le MJ diffuse.
        // Aucun effet en usage normal ; permettent de valider le rendu joueur sans session réelle.
        debugApplyMap: function (map, tokens, uid) { if (uid) debugUid = uid; if (!state.sessionId) state.sessionId = 'debug'; applyMap(map, tokens); },
        debugEvent: function (event, payload) {
            if (!state.sessionId) state.sessionId = 'debug';
            const map = { combat: applyCombat, dice: receiveDiceRoll, concentration: receiveConcentration, inspiration: receiveInspiration, 'npc-card': receiveNpcCard, timer: receiveTimer, 'show-image': receiveSharedImage, gift: receiveGift };
            if (map[event]) map[event](payload);
        } };
})();
