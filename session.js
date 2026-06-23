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

        return {
            name: v('char-name'),
            level: num('char-level'),
            cls: v('char-class'),
            subclass: v('char-subclass'),
            race: v('char-race'),
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
              .on('broadcast', { event: 'ping' }, ({ payload }) => showPing(payload))
              .on('broadcast', { event: 'gift' }, ({ payload }) => receiveGift(payload))
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

    // --- Ping visuel envoyé par le MJ ---
    function showPing(p) {
        if (!p) return;
        const ping = document.createElement('div');
        ping.className = 'session-ping no-print';
        ping.style.left = ((p.x || 0.5) * 100) + 'vw';
        ping.style.top = ((p.y || 0.5) * 100) + 'vh';
        if (p.color) ping.style.setProperty('--ping-color', p.color);
        document.body.appendChild(ping);
        setTimeout(() => ping.remove(), 1700);
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

    // --- Styles du module (ping + notifications) ---
    function injectStyles() {
        if (document.getElementById('session-styles')) return;
        const st = document.createElement('style'); st.id = 'session-styles';
        st.textContent = `
        @keyframes session-ping-anim { 0%{ transform:translate(-50%,-50%) scale(0.2); opacity:0.95; } 100%{ transform:translate(-50%,-50%) scale(2.4); opacity:0; } }
        .session-ping { position:fixed; width:120px; height:120px; border-radius:50%; border:4px solid var(--ping-color,#C49B35); box-shadow:0 0 26px var(--ping-color,#C49B35); pointer-events:none; z-index:9998; transform:translate(-50%,-50%); animation:session-ping-anim 1.6s ease-out forwards; }
        .session-ping::after { content:''; position:absolute; inset:32%; border-radius:50%; background:var(--ping-color,#C49B35); opacity:0.55; }
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
        .session-notif-btn.refuse:hover { background:#e7d8c4; }`;
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
        if (!window.SupaAuth || !window.SupaAuth.currentUser) throw new Error('NON_CONNECTE');
        const charId = activeCharId();
        if (!charId) throw new Error('AUCUNE_FICHE');

        const sessionId = await window.SupaAuth.joinSession(code, charId, snapName(charId));
        state.code = code; state.sessionId = sessionId; state.charId = charId;
        persist(); emit();
        openPresence();
        pushSnapshot(true);
        if (window.showAppToast) window.showAppToast('🔗 Connecté à la session ' + code, '#2c3e50');
        return sessionId;
    }

    async function leave() {
        const sid = state.sessionId;
        await closePresence();
        state.code = null; state.sessionId = null;
        persist(); emit();
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
        waitForUser(() => {
            // La fiche active doit correspondre à celle liée à la session
            const charId = activeCharId();
            if (charId && saved.charId && charId !== saved.charId) return; // autre perso → on ne reconnecte pas
            state.code = saved.code; state.sessionId = saved.sessionId; state.charId = saved.charId || charId;
            emit();
            openPresence();
            pushSnapshot(true);
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
        restore();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.PlayerSession = { join, leave, isConnected, getState, pushSnapshot, restore };
})();
