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

    // ---------- Présence ----------
    function openPresence() {
        if (!window.SupaAuth || !state.code) return;
        try {
            const ch = window.SupaAuth.presenceChannel(state.code);
            ch.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    try { await ch.track({ role: 'player', name: snapName(), charId: state.charId, online: true }); } catch (e) {}
                }
            });
            state.channel = ch;
        } catch (e) { console.warn('presence:', e); }
    }

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
