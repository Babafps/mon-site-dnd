// =====================================================
// session.js — Côté JOUEUR : rejoindre une session MJ
// et diffuser sa fiche en temps réel (Supabase Realtime).
//   • join/leave par code à 6 caractères
//   • présence (canal session:{code})
//   • snapshot de la fiche débauncé → table session_players
// L'état est exposé via l'évènement 'playersession:change'.
// =====================================================
//
//  PLAN DU FICHIER  (une seule IIFE — repères de navigation, voir bannières « N · … » ↓)
//     1. Config, état & petits helpers
//     2. Snapshot de la fiche → Supabase
//     3. Présence & canal Realtime
//     4. Identité & envoi au MJ
//     5. Réception d'événements du MJ (notifications joueur)
//     6. FAB, jets partagés & combat
//     7. Carte / plateau joueur (VTT)
//     8. Widget fiche flottante
//     9. Cycle de vie : teardown, kick, styles, API (join/leave), init
//    10. TableFX — célébrations de table (nat 20 / nat 1)
//
// =====================================================
(function () {
    'use strict';

    // =====================================================
    // 1 · CONFIG, ÉTAT & PETITS HELPERS
    // =====================================================

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

    // =====================================================
    // 2 · SNAPSHOT DE LA FICHE → SUPABASE
    //     Lecture seule du DOM, débounce, upsert vers session_players.
    // =====================================================
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
            // Compagnons : plusieurs possibles. `companion` (le 1er) reste envoyé pour l'affichage MJ existant.
            companions: (jstore('dnd-companions') || []).map(c => ({ name: c.name, ac: c.ac, hp: c.hp, notes: c.notes })),
            companion: (jstore('dnd-companions') || [])[0] || { name: '', ac: '', hp: '', notes: '' },
            defenses: { resist: v('dmg-resist'), immune: v('dmg-immune'), vulnerable: v('dmg-vulnerable') },
            notes: { quick: v('quick-note'), quests: v('quest-log'), npcs: v('npc-log') }
        };

        return {
            name: v('char-name'),
            // Avatar du perso → utilisé par le MJ comme image par défaut du jeton contrôlé par ce joueur.
            tokenImg: (function () { try { const a = localStorage.getItem(state.charId + '_dnd-avatar'); return a && a !== 'undefined' ? a : null; } catch (e) { return null; } })(),
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

    // =====================================================
    // 3 · PRÉSENCE & CANAL REALTIME
    //     Canal session:{code} + abonnement aux broadcasts du MJ.
    // =====================================================
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
              .on('broadcast', { event: 'roll-request' }, ({ payload }) => receiveRollRequest(payload))
              .on('broadcast', { event: 'map-ping' }, ({ payload }) => showMapPing(payload))
              .on('broadcast', { event: 'concentration' }, ({ payload }) => receiveConcentration(payload))
              .on('broadcast', { event: 'inspiration' }, ({ payload }) => receiveInspiration(payload))
              .on('broadcast', { event: 'npc-card' }, ({ payload }) => receiveNpcCard(payload))
              .on('broadcast', { event: 'boss-reveal' }, ({ payload }) => receiveBossReveal(payload))
              .on('broadcast', { event: 'banner' }, ({ payload }) => receiveBanner(payload))
              .on('broadcast', { event: 'session-recap' }, ({ payload }) => receiveSessionRecap(payload))
              .on('broadcast', { event: 'timer' }, ({ payload }) => receiveTimer(payload))
              .subscribe(async (status) => {
                  if (status === 'SUBSCRIBED') {
                      try { await ch.track({ role: 'player', name: snapName(), charId: state.charId, online: true }); } catch (e) {}
                  }
              });
            state.channel = ch;
        } catch (e) { console.warn('presence:', e); }
    }

    // =====================================================
    // 4 · IDENTITÉ & ENVOI AU MJ
    //     myUid(), sendToGm() (avec relance), échappement HTML.
    // =====================================================
    let debugUid = null;   // uid simulé pour les tests hors session (voir debugApplyMap)
    function myUid() { return (window.SupaAuth && window.SupaAuth.currentUser && window.SupaAuth.currentUser.id) || debugUid; }
    // Envoi joueur → MJ avec filet : si Supabase répond autre chose que 'ok'
    // (rate limited, timed out…), on retente UNE fois — sinon on trace en console.
    function sendToGm(event, payload) {
        const ch = state.channel; if (!ch) return;
        const doSend = () => ch.send({ type: 'broadcast', event, payload });
        try {
            const p = doSend();
            if (p && p.then) p.then(res => {
                if (res !== 'ok') {
                    console.warn('[session] envoi « ' + event + ' » → ' + res + ' — nouvelle tentative');
                    setTimeout(() => { try { doSend(); } catch (e) {} }, 250);
                }
            }).catch(e => console.warn('[session] envoi « ' + event + ' » :', e));
        } catch (e) { console.warn('[session] envoi « ' + event + ' » :', e); }
    }
    function escHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    // =====================================================
    // 5 · RÉCEPTION D'ÉVÉNEMENTS DU MJ (notifications joueur)
    //     Scène, cadeau/murmure, image, dés, demande de jet,
    //     concentration, inspiration, carte PNJ, minuteur.
    // =====================================================
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
        // Réussite / échec si un DD accompagne le jet (demande de jet du MJ) + critiques naturels
        const dcHtml = (p.dc != null && p.dc !== '') ? (Number(p.total) >= Number(p.dc) ? ` <b class="sdc-ok">✅ DD ${escHtml(String(p.dc))}</b>` : ` <b class="sdc-ko">❌ DD ${escHtml(String(p.dc))}</b>`) : '';
        const natHtml = p.nat === 20 ? ' <b class="sdc-ok">NAT 20 !</b>' : (p.nat === 1 ? ' <b class="sdc-ko">NAT 1…</b>' : '');
        card.innerHTML = `<div class="session-notif-head"><span class="sdc-die">🎲</span> ${escHtml(p.user || 'MJ')} lance ${escHtml(p.formula || '')}</div>
            <div class="session-notif-body sdc-body"><b class="sdc-total">${escHtml(String(p.total))}</b> <span style="opacity:.6;">(${escHtml(p.detail || '')})</span>${natHtml}${dcHtml}</div>`;
        wrap.appendChild(card);
        // Critique naturel partagé : célébration chez TOUT le monde 🎉
        if (window.TableFX) { if (p.nat === 20) window.TableFX.crit(); else if (p.nat === 1) window.TableFX.fumble(); }
        setTimeout(() => { card.style.transition = 'opacity .4s'; card.style.opacity = '0'; setTimeout(() => card.remove(), 400); }, 6000);
    }
    // --- Demande de jet du MJ : « Lance Perception (DD 15) » → bouton qui lance
    // AUTOMATIQUEMENT d20 + le modificateur lu sur MA fiche, et partage le résultat. ---
    function receiveRollRequest(p) {
        if (!p || !p.skill) return;
        if (p.targetUserId && p.targetUserId !== 'all' && p.targetUserId !== myUid()) return;
        let wrap = document.getElementById('session-notifs');
        if (!wrap) { wrap = document.createElement('div'); wrap.id = 'session-notifs'; wrap.className = 'no-print'; document.body.appendChild(wrap); }
        const card = document.createElement('div'); card.className = 'session-notif';
        const lbl = p.label || p.skill;
        card.innerHTML = `<div class="session-notif-head">🎯 Le MJ demande un jet !</div>
            <div class="session-notif-body"><b>${escHtml(lbl)}</b>${p.dc ? ` — DD ${escHtml(String(p.dc))}` : ''}</div>
            <div class="session-notif-actions"><button class="snc-btn snc-roll">🎲 Lancer (mod. de ma fiche)</button></div>`;
        wrap.appendChild(card);
        card.querySelector('.snc-roll').addEventListener('click', () => {
            // Mod lu sur MA fiche : carac brute (#mod-x), sauvegarde ou compétence (#skill-val-x)
            let el = null;
            if (/^(str|dex|con|int|wis|cha)$/.test(p.skill)) el = document.getElementById('mod-' + p.skill);
            else el = document.getElementById('skill-val-' + p.skill);
            const mod = el ? (parseInt(el.textContent, 10) || 0) : 0;
            const r = Math.floor(Math.random() * 20) + 1;
            const total = r + mod;
            const ok = p.dc ? total >= Number(p.dc) : null;
            card.querySelector('.session-notif-actions').innerHTML =
                `<b class="sdc-total">${total}</b> <span style="opacity:.6;">(d20 : ${r} ${mod >= 0 ? '+' : ''}${mod})</span>` +
                (ok === null ? '' : (ok ? ' <b class="sdc-ok">✅ Réussite</b>' : ' <b class="sdc-ko">❌ Échec</b>'));
            const payload = { user: snapName(), formula: '🎯 ' + lbl, total: total, detail: 'd20 : ' + r + ' ' + (mod >= 0 ? '+' : '') + mod, nat: r, dc: p.dc || null };
            sendToGm('dice', payload);
            if (window.TableFX) { if (r === 20) window.TableFX.crit(); else if (r === 1) window.TableFX.fumble(); }
            setTimeout(() => { card.style.transition = 'opacity .4s'; card.style.opacity = '0'; setTimeout(() => card.remove(), 400); }, 7000);
        });
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
        if (window.TableFX && window.TableFX.inspire) window.TableFX.inspire();   // animation de célébration (Lot 35)
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
    // --- 🐉 Révélation cinématique de boss (Lot 35) ---
    let bossRevealStyled = false;
    function ensureBossStyles() {
        if (bossRevealStyled) return; bossRevealStyled = true;
        const reduce = (function () { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
        const anim = reduce ? '' : 'animation';
        const css = `
        #session-boss-reveal { position: fixed; inset: 0; z-index: 100060; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; cursor: pointer;
            background: radial-gradient(ellipse at 50% 42%, rgba(60,6,6,0.72), rgba(0,0,0,0.94) 70%); ${anim}: bossIn 0.7s ease-out both; -webkit-tap-highlight-color: transparent; }
        #session-boss-reveal.hidden { display: none; }
        #session-boss-reveal::after { content: ''; position: absolute; inset: 0; pointer-events: none; box-shadow: inset 0 0 200px 60px rgba(150,10,10,0.55); ${anim}: bossPulse 2.6s ease-in-out infinite; }
        .sbr-img { width: min(46vw, 300px); max-height: 46vh; object-fit: contain; border-radius: 14px; border: 2px solid rgba(220,60,60,0.5); box-shadow: 0 0 60px rgba(200,30,30,0.6); ${anim}: bossImg 1s ease-out both; }
        .sbr-noimg { font-size: clamp(3rem, 14vw, 7rem); filter: drop-shadow(0 0 30px rgba(220,40,40,0.8)); ${anim}: bossImg 1s ease-out both; }
        .sbr-name { font-family: 'Cinzel','Lora',serif; font-weight: 700; text-align: center; color: #ffdede; font-size: clamp(2rem, 9vw, 5rem); letter-spacing: 0.06em; text-shadow: 0 0 26px rgba(220,30,30,0.9), 0 3px 10px rgba(0,0,0,0.8); padding: 0 16px; ${anim}: bossName 1.1s 0.25s ease-out both; }
        .sbr-sub { font-family: 'Lora',serif; font-style: italic; color: #e8b3b3; font-size: clamp(0.95rem, 3.4vw, 1.5rem); text-align: center; padding: 0 24px; text-shadow: 0 2px 8px rgba(0,0,0,0.8); ${anim}: bossName 1.1s 0.55s ease-out both; }
        .sbr-skip { position: absolute; bottom: 22px; color: rgba(255,255,255,0.55); font-family: 'Lora',serif; font-size: 0.85rem; }
        @keyframes bossIn { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes bossPulse { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
        @keyframes bossImg { 0% { opacity: 0; transform: scale(1.35); filter: blur(8px) drop-shadow(0 0 30px rgba(220,40,40,0.8)); } 100% { opacity: 1; transform: scale(1); filter: blur(0) drop-shadow(0 0 30px rgba(220,40,40,0.8)); } }
        @keyframes bossName { 0% { opacity: 0; letter-spacing: 0.4em; transform: translateY(14px); } 100% { opacity: 1; letter-spacing: 0.06em; transform: translateY(0); } }`;
        const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    }
    function receiveBossReveal(p) {
        if (!p || !p.name) return;
        ensureBossStyles();
        let ov = document.getElementById('session-boss-reveal');
        if (!ov) { ov = document.createElement('div'); ov.id = 'session-boss-reveal'; ov.className = 'no-print'; document.body.appendChild(ov); }
        else { ov.classList.remove('hidden'); }
        ov.innerHTML = (p.img ? `<img class="sbr-img" src="${escHtml(p.img)}" alt="">` : `<div class="sbr-noimg">🐉</div>`)
            + `<div class="sbr-name">${escHtml(p.name)}</div>`
            + (p.subtitle ? `<div class="sbr-sub">${escHtml(p.subtitle)}</div>` : '')
            + `<div class="sbr-skip">Touche l'écran pour continuer</div>`;
        if (window.TableFX && window.TableFX.fumble) { /* petite secousse dramatique */ document.body.classList.add('tfx-shake'); setTimeout(() => document.body.classList.remove('tfx-shake'), 600); }
        const dismiss = () => { ov.classList.add('hidden'); clearTimeout(bossRevealTimer); };
        ov.onclick = dismiss;
        clearTimeout(bossRevealTimer);
        bossRevealTimer = setTimeout(dismiss, 7000);
    }
    let bossRevealTimer = null;

    // --- 🎭 Bannière d'annonce plein écran (titre de chapitre, transition…) ---
    let bannerStyled = false, bannerTimer = null;
    function ensureBannerStyles() {
        if (bannerStyled) return; bannerStyled = true;
        const reduce = (function () { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
        const anim = reduce ? '' : 'animation';
        const css = `
        #session-banner { position: fixed; inset: 0; z-index: 100055; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; cursor: pointer; text-align: center;
            background: linear-gradient(180deg, rgba(8,8,12,0.86), rgba(8,8,12,0.94)); ${anim}: bnFade 0.6s ease-out both; }
        #session-banner.hidden { display: none; }
        #session-banner .bn-line { width: min(70vw, 520px); height: 1px; background: linear-gradient(90deg, transparent, rgba(196,155,53,0.9), transparent); ${anim}: bnLine 1s ease-out both; }
        #session-banner .bn-title { font-family: 'Cinzel','Lora',serif; font-weight: 700; color: #f3e3bb; font-size: clamp(1.7rem, 7vw, 4rem); letter-spacing: 0.05em; padding: 0 18px; text-shadow: 0 2px 14px rgba(0,0,0,0.7); ${anim}: bnUp 0.9s 0.15s ease-out both; }
        #session-banner .bn-sub { font-family: 'Lora',serif; font-style: italic; color: #d9c79a; font-size: clamp(0.95rem, 3.4vw, 1.4rem); padding: 0 24px; ${anim}: bnUp 0.9s 0.4s ease-out both; }
        @keyframes bnFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bnUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bnLine { from { opacity: 0; transform: scaleX(0.2); } to { opacity: 1; transform: scaleX(1); } }`;
        const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    }
    function receiveBanner(p) {
        if (!p || !p.text) return;
        ensureBannerStyles();
        let ov = document.getElementById('session-banner');
        if (!ov) { ov = document.createElement('div'); ov.id = 'session-banner'; ov.className = 'no-print'; document.body.appendChild(ov); }
        else ov.classList.remove('hidden');
        ov.innerHTML = `<div class="bn-line"></div><div class="bn-title">${escHtml(p.text)}</div>${p.sub ? `<div class="bn-sub">${escHtml(p.sub)}</div>` : ''}<div class="bn-line"></div>`;
        const dismiss = () => { ov.classList.add('hidden'); clearTimeout(bannerTimer); };
        ov.onclick = dismiss;
        clearTimeout(bannerTimer);
        bannerTimer = setTimeout(dismiss, Math.max(3500, Math.min(9000, (p.text.length + (p.sub ? p.sub.length : 0)) * 90)));
    }

    // --- 🧾 Résumé de session « générique de fin » envoyé par le MJ (Lot 37+, idée 2) ---
    let recapStyled = false;
    function ensureRecapStyles() {
        if (recapStyled) return; recapStyled = true;
        const reduce = (function () { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
        const css = `
        #session-recap { position: fixed; inset: 0; z-index: 100058; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 6vh 5vw; overflow: hidden;
            background: radial-gradient(ellipse at 50% 30%, rgba(30,24,14,0.96), rgba(6,5,3,0.98)); }
        #session-recap.hidden { display: none; }
        #session-recap .rc-title { font-family: 'Cinzel','Lora',serif; font-weight: 700; color: #f3e3bb; font-size: clamp(1.4rem, 5vw, 2.4rem); text-shadow: 0 0 18px rgba(196,155,53,0.7); margin-bottom: 12px; flex: 0 0 auto; }
        #session-recap .rc-scroll { flex: 0 1 auto; max-height: 66vh; overflow: hidden; width: min(90vw, 620px); -webkit-mask-image: linear-gradient(180deg, transparent, #000 12%, #000 82%, transparent); mask-image: linear-gradient(180deg, transparent, #000 12%, #000 82%, transparent); }
        #session-recap .rc-inner { font-family: 'Lora',serif; color: #e6d7b4; font-size: clamp(0.95rem, 3vw, 1.25rem); line-height: 1.7; white-space: pre-wrap; text-align: center; ${reduce ? '' : 'animation: rcRoll 26s linear forwards;'} }
        #session-recap .rc-close { margin-top: 14px; flex: 0 0 auto; background: rgba(196,155,53,0.2); color: #f3e3bb; border: 1px solid rgba(196,155,53,0.6); border-radius: 20px; padding: 8px 18px; font-family: 'Lora',serif; cursor: pointer; }
        @keyframes rcRoll { from { transform: translateY(55vh); } to { transform: translateY(-100%); } }`;
        const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    }
    function receiveSessionRecap(p) {
        if (!p || !p.text) return;
        ensureRecapStyles();
        let ov = document.getElementById('session-recap');
        if (!ov) { ov = document.createElement('div'); ov.id = 'session-recap'; ov.className = 'no-print'; document.body.appendChild(ov); }
        else ov.classList.remove('hidden');
        ov.innerHTML = `<div class="rc-title">🎬 Fin de séance</div><div class="rc-scroll"><div class="rc-inner">${escHtml(p.text)}</div></div><button class="rc-close">Fermer</button>`;
        ov.querySelector('.rc-close').addEventListener('click', () => ov.classList.add('hidden'));
    }

    // --- 🤢 Effets d'état en plein écran côté joueur (Lot 35) ---
    // Pilotés par MES propres conditions (cases de la fiche). Désactivables par le joueur
    // (case du panneau ⚔️, localStorage) ET par le MJ (m.playerFxOff, via la carte diffusée).
    let statusFxStyled = false;
    function ensureStatusStyles() {
        if (statusFxStyled) return; statusFxStyled = true;
        const css = `
        #session-status-fx { position: fixed; inset: 0; pointer-events: none; z-index: 9960; opacity: 0; transition: opacity 0.6s ease; }
        #session-status-fx.on { opacity: 1; }
        #session-status-fx.fx-poison { box-shadow: inset 0 0 150px 40px rgba(70,150,40,0.42); background: radial-gradient(ellipse at 50% 50%, rgba(90,170,50,0) 55%, rgba(60,130,30,0.18)); animation: sfxPulse 3.4s ease-in-out infinite; }
        #session-status-fx.fx-fire { box-shadow: inset 0 0 150px 45px rgba(200,70,20,0.5); background: radial-gradient(ellipse at 50% 100%, rgba(255,120,30,0.22), rgba(0,0,0,0) 55%); animation: sfxFlicker 0.5s ease-in-out infinite; }
        #session-status-fx.fx-fear { box-shadow: inset 0 0 170px 60px rgba(120,10,10,0.55); animation: sfxPulse 2.2s ease-in-out infinite; }
        #session-status-fx.fx-blind { box-shadow: inset 0 0 250px 130px rgba(0,0,0,0.9); background: rgba(0,0,0,0.35); }
        #session-status-fx.fx-stun { box-shadow: inset 0 0 160px 55px rgba(120,110,60,0.5); filter: saturate(0.6); animation: sfxPulse 1.6s ease-in-out infinite; }
        #session-status-fx.fx-down { box-shadow: inset 0 0 230px 110px rgba(0,0,0,0.82); background: rgba(20,20,25,0.4); }
        @keyframes sfxPulse { 0%,100% { opacity: 0.72; } 50% { opacity: 1; } }
        @keyframes sfxFlicker { 0%,100% { opacity: 0.8; } 25% { opacity: 1; } 50% { opacity: 0.7; } 75% { opacity: 0.95; } }
        @media (prefers-reduced-motion: reduce) { #session-status-fx { animation: none !important; } }`;
        const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    }
    // Lit MES conditions cochées (mêmes sources que le snapshot).
    function myConditions() {
        const out = [];
        try {
            document.querySelectorAll('#conditions-track-container input[type="checkbox"]:checked, #custom-conditions-container input[type="checkbox"]:checked').forEach(cb => {
                const lbl = (cb.parentElement ? cb.parentElement.textContent : '').replace(/\s+/g, ' ').trim();
                if (lbl) out.push(lbl.toLowerCase());
            });
        } catch (e) {}
        return out;
    }
    // Condition dominante → classe d'effet (par ordre de gravité visuelle).
    function pickStatusEffect(conds) {
        const has = (kw) => conds.some(c => c.indexOf(kw) !== -1);
        if (has('inconscient')) return 'fx-down';
        if (has('pétrifi') || has('petrifi') || has('paralys')) return 'fx-stun';
        if (has('aveugl')) return 'fx-blind';
        if (has('feu') || has('enflamm') || has('brûl') || has('brul')) return 'fx-fire';
        if (has('empoisonn') || has('poison') || has('intoxiqu')) return 'fx-poison';
        if (has('effray') || has('terroris') || has('apeur') || has('épouvant') || has('epouvant')) return 'fx-fear';
        if (has('étourdi') || has('etourdi') || has('assomm') || has('neutralis')) return 'fx-stun';
        if (has('à terre') || has('a terre')) return 'fx-down';
        return null;
    }
    function statusFxEnabled() {
        try { if (localStorage.getItem('dnd-fx-fullscreen') === '0') return false; } catch (e) {}
        if (mapState && mapState.map && mapState.map.playerFxOff) return false;   // MJ a coupé les effets
        return true;
    }
    function updateStatusFx() {
        const app = document.getElementById('app-screen');
        const onSheet = app && !app.classList.contains('hidden') && !document.body.classList.contains('gm-active');
        let ov = document.getElementById('session-status-fx');
        const effect = (onSheet && statusFxEnabled()) ? pickStatusEffect(myConditions()) : null;
        if (!effect) {
            // ⚠️ Retrait d'un effet : les effets ANIMÉS (poison/peur/étourdi/feu) utilisent des keyframes
            // qui pilotent l'OPACITÉ (sfxPulse/sfxFlicker) ; retirer seulement « on » ne suffit pas car
            // l'animation continue de forcer l'opacité → le voile restait visible à l'écran (bug 14 juil.).
            // On coupe donc l'animation, puis l'opacité de base (0) prend le relais pour le fondu de sortie.
            if (ov) { ov.style.animation = 'none'; ov.classList.remove('on'); }
            return;
        }
        ensureStatusStyles();
        if (!ov) { ov = document.createElement('div'); ov.id = 'session-status-fx'; ov.className = 'no-print'; document.body.appendChild(ov); }
        ov.style.animation = '';                 // réactive l'animation CSS propre à l'effet
        ov.className = 'no-print ' + effect;
        // reflow pour rejouer la transition d'opacité au changement d'effet
        void ov.offsetWidth;
        ov.classList.add('on');
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
    // 6 · FAB, JETS PARTAGÉS & COMBAT (joueur)
    //     Bouton flottant + initiative, murmure, dé partagé, barre de tour.
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
    // Partage AUTOMATIQUE des jets faits sur la fiche (caracs, compétences, macros,
    // lanceur de dés) : appelé par script.js. Désactivable via la case du panneau ⚔️.
    function shareRoll(name, total, detail, nat) {
        if (!state.sessionId || !state.channel) return;                     // pas en session → silencieux
        try { if (localStorage.getItem('dnd-share-rolls') === '0') return; } catch (e) {}
        sendToGm('dice', { user: snapName(), formula: String(name || '🎲'), total: total, detail: String(detail || ''), nat: (nat === 20 || nat === 1) ? nat : null });
    }
    function renderFabPanel() {
        if (!fabPanel) return;
        const shareOn = (function () { try { return localStorage.getItem('dnd-share-rolls') !== '0'; } catch (e) { return true; } })();
        const fxOn = (function () { try { return localStorage.getItem('dnd-fx-fullscreen') !== '0'; } catch (e) { return true; } })();
        const whisperBtn = `<button id="sfp-whisper-open" class="sfp-btn sfp-btn-whisper" type="button">🤫 Murmurer au MJ</button>`
            + `<button id="sfp-loot-open" class="sfp-btn sfp-btn-whisper" type="button">🎒 Butin du groupe</button>`
            + `<div class="sfp-manual"><input id="sfp-dice-formula" class="sfp-manual-input" placeholder="2d6+3 (dé partagé)"><button id="sfp-dice-share" class="sfp-btn sfp-btn-alt" title="Lancer devant tout le monde">🎲</button></div>`
            + `<label class="sfp-share-toggle" title="Quand c'est coché, les jets faits sur ta fiche (caracs, compétences, attaques, dés) s'affichent chez le MJ et les autres joueurs."><input type="checkbox" id="sfp-share-rolls"${shareOn ? ' checked' : ''}> 🎲 Partager mes jets de fiche</label>`
            + `<label class="sfp-share-toggle" title="Un voile coloré recouvre ton écran quand ton personnage est empoisonné, aveuglé, effrayé, en feu… Décoche pour ne rien afficher."><input type="checkbox" id="sfp-status-fx"${fxOn ? ' checked' : ''}> 💥 Effets d'état plein écran</label>`;
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
        const lb = document.getElementById('sfp-loot-open');
        if (lb) lb.addEventListener('click', toggleLootPanel);
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

    // 🎒 Butin du groupe partagé (Lot 36) — liste synchronisée via la carte (m.partyLoot).
    let lootStyled = false;
    function ensureLootStyles() {
        if (lootStyled) return; lootStyled = true;
        const css = `
        #session-loot { position: fixed; z-index: 9994; right: 16px; bottom: 84px; width: min(92vw, 320px); max-height: 60vh; display: flex; flex-direction: column; overflow: hidden;
            background: var(--sheet-bg-color, #fffdf7); color: #2a2016; border: 1px solid var(--accent-color, #C49B35); border-radius: 14px; box-shadow: 0 14px 40px rgba(0,0,0,0.45); font-family: 'Lora',serif; }
        #session-loot.hidden { display: none; }
        .sloot-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; font-weight: bold; background: rgba(196,155,53,0.16); }
        .sloot-head .sloot-x { margin-left: auto; cursor: pointer; background: none; border: none; font-size: 1rem; color: inherit; }
        .sloot-list { overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 2px; }
        .sloot-row { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: 7px; }
        .sloot-row:hover { background: rgba(196,155,53,0.12); }
        .sloot-qty { font-weight: bold; color: var(--primary-color, #7A2828); min-width: 30px; }
        .sloot-name { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sloot-by { font-size: 0.7rem; opacity: 0.55; font-style: italic; }
        .sloot-del { background: none; border: none; cursor: pointer; color: #a3402f; font-size: 0.95rem; }
        .sloot-add { display: flex; gap: 5px; padding: 8px; border-top: 1px solid rgba(196,155,53,0.3); }
        .sloot-add input { font-family: inherit; padding: 6px 8px; border: 1px solid rgba(150,120,60,0.4); border-radius: 8px; background: rgba(255,255,255,0.6); }
        .sloot-add .sloot-nm { flex: 1 1 auto; min-width: 0; }
        .sloot-add .sloot-q { width: 48px; }
        .sloot-add button { background: var(--accent-color, #C49B35); color: #2a1c0a; border: none; border-radius: 8px; padding: 0 12px; font-weight: bold; cursor: pointer; }
        .sloot-empty { padding: 14px; text-align: center; opacity: 0.6; font-style: italic; font-size: 0.9rem; }
        body.dark-mode #session-loot, body.theme-dark #session-loot { background: #241c16; color: #e8dcc4; }`;
        const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    }
    function ensureLootPanel() {
        let p = document.getElementById('session-loot');
        if (p) return p;
        ensureLootStyles();
        p = document.createElement('div'); p.id = 'session-loot'; p.className = 'no-print hidden';
        document.body.appendChild(p);
        return p;
    }
    function renderLootPanel() {
        const p = document.getElementById('session-loot');
        if (!p || p.classList.contains('hidden')) return;
        const loot = (mapState.map && Array.isArray(mapState.map.partyLoot)) ? mapState.map.partyLoot : [];
        const rows = loot.length
            ? loot.map(it => `<div class="sloot-row"><span class="sloot-qty">×${it.qty || 1}</span><span class="sloot-name">${escHtml(it.name)}</span>${it.by ? `<span class="sloot-by">${escHtml(it.by)}</span>` : ''}<button class="sloot-del" data-loot-del="${escHtml(it.id)}" title="Retirer">✕</button></div>`).join('')
            : '<div class="sloot-empty">Le sac commun est vide.<br>Ajoute un objet ci-dessous.</div>';
        p.innerHTML = `<div class="sloot-head">🎒 Butin du groupe<button class="sloot-x" title="Fermer">✕</button></div>
            <div class="sloot-list">${rows}</div>
            <div class="sloot-add"><input class="sloot-nm" placeholder="Objet…" maxlength="80"><input class="sloot-q" type="number" min="1" value="1"><button class="sloot-plus">＋</button></div>`;
        p.querySelector('.sloot-x').addEventListener('click', () => p.classList.add('hidden'));
        p.querySelectorAll('[data-loot-del]').forEach(b => b.addEventListener('click', () => { sendToGm('loot-del', { id: b.dataset.lootDel }); }));
        const nm = p.querySelector('.sloot-nm'), q = p.querySelector('.sloot-q');
        const add = () => { const name = (nm.value || '').trim(); if (!name) return; sendToGm('loot-add', { name: name.slice(0, 80), qty: Math.max(1, parseInt(q.value, 10) || 1), by: snapName() }); nm.value = ''; q.value = '1'; nm.focus(); };
        p.querySelector('.sloot-plus').addEventListener('click', add);
        nm.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    }
    function toggleLootPanel() {
        const p = ensureLootPanel();
        if (p.classList.contains('hidden')) { p.classList.remove('hidden'); renderLootPanel(); }
        else p.classList.add('hidden');
    }
    // 📌 Annotations validées par le MJ (visibles de tous) — épingles sur le board joueur.
    let annotStyled = false;
    function ensureAnnotStyles() {
        if (annotStyled) return; annotStyled = true;
        const css = `
        .smap-annot { position: absolute; transform: translate(-50%, -100%); z-index: 8; pointer-events: none; display: flex; flex-direction: column; align-items: center; }
        .smap-annot .sa-pin { font-size: 1.1rem; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6)); }
        .smap-annot .sa-lbl { max-width: 130px; font-family: 'Lora',serif; font-size: 0.66rem; line-height: 1.1; color: #fff; background: rgba(20,14,8,0.82); border: 1px solid rgba(196,155,53,0.6); border-radius: 6px; padding: 1px 5px; margin-bottom: 2px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`;
        const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    }
    function renderPlayerAnnotations() {
        const board = playerBoard(); if (!board) return;
        board.querySelectorAll('.smap-annot').forEach(el => el.remove());
        const list = (mapState.map && Array.isArray(mapState.map.annotations)) ? mapState.map.annotations : [];
        if (!list.length) return;
        ensureAnnotStyles();
        const html = list.map(a => `<div class="smap-annot" style="left:${a.x * 100}%; top:${a.y * 100}%;" title="${escHtml(a.text)}${a.by ? ' — ' + escHtml(a.by) : ''}"><span class="sa-lbl">${escHtml(a.text)}</span><span class="sa-pin">📌</span></div>`).join('');
        board.insertAdjacentHTML('beforeend', html);
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
    // 7 · CARTE / PLATEAU JOUEUR (VTT) — vue lecture seule synchronisée
    //     Rendu carte, jetons, vision/obscurité, brouillard, zones sonores,
    //     gabarits, dessin, déplacement mesuré de mon jeton.
    // =====================================================
    let mapState = { map: {}, tokens: [] };
    let mapPanel = null, mapToggle = null, openMapPanel = null;
    let playerDragBusy = false;      // je déplace MON jeton : ne pas reconstruire le DOM sous mon doigt
    let pendingMapRender = false;    // un état carte est arrivé pendant le drag → re-rendu au lâcher
    let playerAoe = { on: false, kind: 'circle', color: '#3498db', draft: null };  // outil gabarit de sort côté joueur
    let playerAnnot = { on: false };  // outil annotation : clic sur la carte = proposer une note au MJ (Lot 36)

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
        mapPanel.innerHTML = '<div class="smap-head"><span>🗺️ Carte tactique</span><div class="smap-head-btns"><button id="smap-annot" title="Annoter la carte (le MJ valide)">📌</button><button id="smap-aoe" title="Gabarit de sort / zone d\'effet">🎯</button><button id="smap-sheet" title="Ma fiche (petit widget déplaçable)">🪪</button><button id="smap-full" title="Plein écran">⛶</button><button id="smap-close" title="Fermer">✕</button></div></div><div id="smap-view" class="smap-view"></div>';
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
        if (aoeBtn) aoeBtn.addEventListener('click', () => { playerAoe.on = !playerAoe.on; aoeBtn.classList.toggle('is-on', playerAoe.on); if (playerAoe.on) { playerAnnot.on = false; const ab = mapPanel.querySelector('#smap-annot'); if (ab) ab.classList.remove('is-on'); } renderPlayerAoeBar(); });
        const annotBtn = mapPanel.querySelector('#smap-annot');
        if (annotBtn) annotBtn.addEventListener('click', () => {
            playerAnnot.on = !playerAnnot.on; annotBtn.classList.toggle('is-on', playerAnnot.on);
            if (playerAnnot.on) { playerAoe.on = false; if (aoeBtn) aoeBtn.classList.remove('is-on'); renderPlayerAoeBar(); if (window.showAppToast) window.showAppToast('📌 Clique la carte pour proposer une note au MJ', '#2c3e50'); }
        });
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
            bx: m.bgX || 0, by: m.bgY || 0, bs: m.bgScale || 1, w: m.weather || '', tint: m.tint || '',
            dn: (m.dayNight && m.dayNight.on) ? (m.dayNight.time == null ? 12 : m.dayNight.time) : -1,
            hz: (m.hazards || []).map(z => [z.kind, Math.round(z.x * 100), Math.round(z.y * 100), Math.round((z.r || 0) * 100)]),
            doors: walls.filter(w => w.door).map(w => [w.id, !!w.open, !!w.locked, !!w.secret]),
            wl: walls.length, tpl: (m.templates || []).length, dr: (m.drawings || []).length,
            fog: !!(m.fog && m.fog.on), fr: ((m.fog && m.fog.reveals) || []).length,
            dark: !!(m.dark && m.dark.on), dR: (m.dark && m.dark.range) || 0, li: (m.lights || []).length,
            tk: (ms.tokens || []).map(t => [t.id, t.owner || '', Number(t.size) || 1, t.img || '', t.name || '', !!t.hidden, (t.badges || ''), t.color || '', t.layer || '', (ms.map && ms.map.hpBars) ? (t.hp + '/' + t.hpMax) : '']).sort()
        });
    }
    // ===== ZONES SONORES SPATIALISÉES (#3, Lot 33b) — côté joueur =====
    // Chaque zone (m.soundZones) joue une boucle audio dont le volume monte quand MON jeton
    // s'en approche. On utilise des <audio> (HTMLMediaElement) : pas de contrainte CORS pour la
    // simple lecture (contrairement à Web Audio decodeAudioData), et le volume est réglable.
    const zoneAudio = {
        els: {},            // id -> { el, url, target, remove } — zones EN BOUCLE
        oneShot: {},        // id -> { inside, last } — état des zones à déclenchement unique
        fadeTimer: null,    // boucle de fondu (setInterval, marche même onglet caché)
        blocked: false,
        // Position d'écoute = MES jetons (le joueur n'entend qu'à travers son perso).
        // Volume d'une boucle = max sur mes jetons de [rampe de distance] × [0.3 si un mur bloque].
        update() {
            const m = (mapState && mapState.map) || {};
            const zones = Array.isArray(m.soundZones) ? m.soundZones : [];
            const walls = (m.walls || []);
            const board = playerBoard();
            const bw = board ? Math.max(1, board.clientWidth) : 1000;
            const bh = board ? Math.max(1, board.clientHeight) : bw * 9 / 16;
            const uid = myUid();
            const mine = (mapState.tokens || []).filter(t => !t.hidden && t.owner && t.owner === uid);
            const loopIds = {};
            zones.forEach(z => { if (z && z.id && z.url && !z.oneshot) loopIds[z.id] = 1; });
            // Zones EN BOUCLE disparues (ou passées en one-shot / son retiré) → fondu de sortie
            Object.keys(this.els).forEach(id => { if (!loopIds[id]) { this.els[id].target = 0; this.els[id].remove = true; } });
            zones.forEach(z => {
                if (!z || !z.url) return;
                if (z.oneshot) { this.tickOneShot(z, mine, bw, bh); return; }
                let slot = this.els[z.id];
                if (!slot || slot.url !== z.url) {
                    if (slot) { try { slot.el.pause(); } catch (e) {} }
                    const a = new Audio(z.url); a.loop = true; a.preload = 'auto'; a.volume = 0;
                    slot = this.els[z.id] = { el: a, url: z.url, target: 0 };
                }
                slot.remove = false;
                let vol = 0;
                mine.forEach(t => {
                    const d = Math.hypot((t.x - z.x) * bw, (t.y - z.y) * bh);
                    const rPx = Math.max(1, (Number(z.r) || 0.15) * bw), inner = rPx * 0.3;
                    let v = d <= inner ? 1 : (d >= rPx ? 0 : 1 - (d - inner) / (rPx - inner));
                    // Occlusion (idée #1) : un mur entre le jeton et la source étouffe le son.
                    if (v > 0 && z.occl !== false && walls.length && window.VTTGeo && window.VTTGeo.moveBlocked(walls, t.x, t.y, z.x, z.y)) v *= 0.3;
                    if (v > vol) vol = v;
                });
                slot.target = Math.max(0, Math.min(1, vol * (z.vol != null ? Number(z.vol) : 0.8)));
            });
            this.ensureFadeLoop();
        },
        // Son à déclenchement unique (idée #3) : joué UNE fois quand un de mes jetons entre dans la zone.
        tickOneShot(z, mine, bw, bh) {
            const rPx = Math.max(1, (Number(z.r) || 0.15) * bw);
            const inside = mine.some(t => Math.hypot((t.x - z.x) * bw, (t.y - z.y) * bh) <= rPx);
            const st = this.oneShot[z.id] || { inside: false, last: 0 };
            if (inside && !st.inside && (Date.now() - st.last) > 1500) {
                try {
                    const a = new Audio(z.url); a.loop = false; a.volume = Math.max(0, Math.min(1, z.vol != null ? Number(z.vol) : 0.8));
                    const pr = a.play(); if (pr && pr.catch) pr.catch(() => { zoneAudio.blocked = true; showAudioUnlock(); });
                } catch (e) {}
                st.last = Date.now();
            }
            st.inside = inside; this.oneShot[z.id] = st;
        },
        // Fondu enchaîné (idée #2) : rampe chaque volume vers sa cible ; joue/coupe et purge les zones sorties.
        ensureFadeLoop() {
            if (this.fadeTimer) return;
            const STEP = 0.06;
            this.fadeTimer = setInterval(() => {
                const ids = Object.keys(this.els);
                if (!ids.length) { clearInterval(this.fadeTimer); this.fadeTimer = null; return; }
                let anyBusy = false;
                ids.forEach(id => {
                    const s = this.els[id], tgt = s.target || 0, cur = s.el.volume;
                    if (Math.abs(cur - tgt) > 0.005) { s.el.volume = cur < tgt ? Math.min(tgt, cur + STEP) : Math.max(tgt, cur - STEP); anyBusy = true; }
                    else s.el.volume = tgt;
                    if (tgt > 0.001 && s.el.paused) { const pr = s.el.play(); if (pr && pr.catch) pr.catch(() => { zoneAudio.blocked = true; showAudioUnlock(); }); }
                    if (tgt <= 0.001 && s.el.volume <= 0.01) {
                        if (!s.el.paused) { try { s.el.pause(); } catch (e) {} }
                        if (s.remove) { delete this.els[id]; }
                    } else if (tgt > 0.001) anyBusy = true;
                });
                if (!anyBusy && !Object.keys(this.els).length) { clearInterval(this.fadeTimer); this.fadeTimer = null; }
            }, 60);
        },
        unlock() {
            this.blocked = false;
            Object.keys(this.els).forEach(id => { const s = this.els[id]; if ((s.target || 0) > 0.001 && s.el.paused) { const pr = s.el.play(); if (pr && pr.catch) pr.catch(() => {}); } });
        },
        stopAll() {
            if (this.fadeTimer) { clearInterval(this.fadeTimer); this.fadeTimer = null; }
            Object.keys(this.els).forEach(id => { try { this.els[id].el.pause(); } catch (e) {} });
            this.els = {}; this.oneShot = {}; this.blocked = false; hideAudioUnlock();
        }
    };
    function updateZoneAudio() { try { zoneAudio.update(); } catch (e) {} }
    // Bouton de déblocage (politique autoplay des navigateurs) : un geste utilisateur suffit.
    function showAudioUnlock() {
        if (!zoneAudio.blocked) return;
        let b = document.getElementById('smap-audio-unlock');
        if (b) return;
        b = document.createElement('button'); b.id = 'smap-audio-unlock'; b.className = 'no-print';
        b.textContent = '🔊 Activer les sons d\'ambiance';
        b.style.cssText = 'position:fixed; left:50%; bottom:16px; transform:translateX(-50%); z-index:9999; padding:10px 16px; border-radius:22px; border:1px solid #C49B35; background:rgba(20,28,42,0.95); color:#f3e3bb; font-family:Lora,serif; font-size:0.9rem; cursor:pointer; box-shadow:0 6px 20px rgba(0,0,0,0.5);';
        b.addEventListener('click', () => { zoneAudio.unlock(); hideAudioUnlock(); });
        document.body.appendChild(b);
    }
    function hideAudioUnlock() { const b = document.getElementById('smap-audio-unlock'); if (b) b.remove(); }
    // Amorçage audio : la politique d'autoplay des navigateurs interdit toute lecture tant que le
    // joueur n'a pas interagi avec la page. On débloque donc les sons d'ambiance dès sa 1re
    // interaction (clic, touche, toucher) — la lecture démarre alors toute seule quand un jeton
    // approche d'une zone, sans avoir à trouver le bouton « 🔊 Activer les sons d'ambiance ».
    let audioPrimed = false;
    function primeZoneAudio() {
        if (audioPrimed) return;
        audioPrimed = true;
        zoneAudio.blocked = false;
        try { zoneAudio.unlock(); } catch (e) {}
        hideAudioUnlock();
        ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.removeEventListener(ev, primeZoneAudio, true));
    }
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, primeZoneAudio, true));

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
        updateZoneAudio();                                 // zones sonores : (re)calcule les volumes
        updateStatusFx();                                  // effets d'état plein écran (le MJ peut les couper via m.playerFxOff)
        renderLootPanel();                                 // butin de groupe : suivre les ajouts/retraits (si ouvert)
        renderPlayerAnnotations();                         // annotations validées par le MJ
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
    // Teinte du cycle jour/nuit (identique au calcul MJ) — reçue via m.dayNight (Lot 32)
    function playerDayNightTint(h) {
        const anchors = [
            [0, [8, 12, 40, 0.58]], [5, [20, 25, 65, 0.5]], [7, [235, 150, 80, 0.26]],
            [9, [255, 244, 210, 0.05]], [12, [255, 255, 255, 0]], [16, [255, 240, 205, 0.05]],
            [18, [235, 120, 65, 0.28]], [20, [40, 35, 85, 0.42]], [24, [8, 12, 40, 0.58]]
        ];
        h = ((h % 24) + 24) % 24;
        let a = anchors[0], b = anchors[anchors.length - 1];
        for (let i = 0; i < anchors.length - 1; i++) { if (h >= anchors[i][0] && h <= anchors[i + 1][0]) { a = anchors[i]; b = anchors[i + 1]; break; } }
        const t = b[0] === a[0] ? 0 : (h - a[0]) / (b[0] - a[0]);
        const c = a[1].map((v, i) => v + (b[1][i] - v) * t);
        if (c[3] < 0.02) return '';
        return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (Math.round(c[3] * 100) / 100) + ')';
    }
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
            const sz = Math.max(12, Math.round(Math.max(6, gpx) * (Number(t.size) || 1) * 0.78));   // MÊME facteur que le MJ (0.78 case, Lot 25)
            const onMap = t.layer === 'map';
            let aura = '';
            if (t.aura && Number(t.aura.r) > 0) {
                const apx = (Number(t.aura.r) / playerCellM()) * gpx;
                aura = `<div class="smap-aura" style="left:${t.x * 100}%; top:${t.y * 100}%; width:${apx * 2}px; height:${apx * 2}px; --aura:${t.aura.color || '#3498db'};"></div>`;
            }
            const badges = t.badges ? `<span class="smap-badges">${escHtml(t.badges)}</span>` : '';
            // Barre de PV (si le MJ l'a activée : 🧝 → « Barres de PV visibles des joueurs »)
            let hpBar = '';
            if (m.hpBars && Number(t.hpMax) > 0) {
                const hpv = Number(t.hp), ratio = Math.max(0, Math.min(1, (isNaN(hpv) ? Number(t.hpMax) : hpv) / Number(t.hpMax)));
                hpBar = `<i class="smap-hpbar"><b class="${ratio <= 0.33 ? 'is-low' : ''}" style="width:${Math.round(ratio * 100)}%"></b></i>`;
            }
            return aura + `<div class="smap-token${mine ? ' smap-token-mine' : ''}${t.img ? ' smap-token-img' : ''}${onMap ? ' smap-token-onmap' : ''}" data-token="${t.id}" data-owner="${t.owner || ''}" style="left:${t.x * 100}%; top:${t.y * 100}%; width:${sz}px; height:${sz}px; --tok:${t.color || (t.type === 'monster' ? '#7A2828' : '#2980b9')}; ${img}" title="${escHtml(t.name)}">${t.img ? '' : `<span>${escHtml((t.name || '?').slice(0, 2))}</span>`}${badges}${hpBar}</div>`;
        }).join('');
        // Portes : jamais les secrètes, et seulement celles RÉELLEMENT en vue quand
        // l'obscurité ou le brouillard sont actifs (le joueur ne devine plus les portes cachées).
        const doorOrigins = playerVisionOrigins(bw, bh);
        const doorSegs = playerBlockingSegsPx(bw, bh);
        const doorsHtml = (m.walls || []).filter(s => s.door && !s.secret && doorVisibleToPlayer(s, bw, bh, doorOrigins, doorSegs)).map(doorButtonHtml).join('');
        view.innerHTML = `<div class="smap-board" style="left:${bl}px; top:${bt}px; width:${bw}px; height:${bh}px;"><canvas class="smap-hazards"></canvas>` + tokensHtml + doorsHtml
            + '<canvas class="smap-draw"></canvas><canvas class="smap-templates"></canvas><canvas class="smap-weather"></canvas><canvas class="smap-fog"></canvas><canvas class="smap-dark"></canvas><div class="smap-daynight"></div><div class="smap-tint"></div><canvas class="smap-measure"></canvas></div>';
        const board = view.querySelector('.smap-board');
        const tintEl = board.querySelector('.smap-tint'); if (tintEl) tintEl.style.background = m.tint || 'transparent';   // teinte d'ambiance (Lot 30)
        const dnEl = board.querySelector('.smap-daynight'); if (dnEl) dnEl.style.background = ((m.dayNight && m.dayNight.on) ? playerDayNightTint(m.dayNight.time == null ? 12 : m.dayNight.time) : '') || 'transparent';   // cycle jour/nuit (Lot 32)
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
        renderPlayerHazards();
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
    // Dangers animés posés par le MJ (lave / poison / feu), Lot 33
    function renderPlayerHazards() {
        const board = playerBoard(); if (!board) return;
        const canvas = board.querySelector('.smap-hazards'); if (!canvas) return;
        if (window.VTTHazards) window.VTTHazards.apply(canvas, (mapState.map && mapState.map.hazards) || [], Math.max(1, board.clientWidth), Math.max(1, board.clientHeight));
    }
    // Une lumière du MJ est-elle perçue par MOI ? Il faut qu'un de MES jetons ait une
    // ligne de vue DÉGAGÉE vers elle (les murs bloquent) — sauf « toujours visible ».
    // Une torche dans une pièce fermée ne doit pas trahir la pièce. (Lot 25)
    function lightSeenByMe(l, myToks, walls) {
        if (l.always) return true;
        if (!window.VTTGeo) return true;
        return (myToks || []).some(t => !window.VTTGeo.moveBlocked(walls, t.x, t.y, l.x, l.y));
    }
    // Origines de vision du joueur (SES jetons + les lumières du MJ en vue), en px du board donné.
    function playerVisionOrigins(w, h) {
        const m = mapState.map || {};
        if (!window.VTTGeo) return [];
        const uid = myUid();
        const dk = Object.assign({}, m.dark || {}, { cellM: playerCellM() });
        const g = playerGridPx(w);
        const origins = [];
        const mine = (mapState.tokens || []).filter(t => !t.hidden && t.owner && t.owner === uid);
        mine.forEach(t => origins.push({ x: t.x * w, y: t.y * h, R: window.VTTGeo.visionRadiusPx(t, dk, g) }));
        (m.lights || []).filter(l => lightSeenByMe(l, mine, m.walls || []))
            .forEach(l => origins.push({ x: l.x * w, y: l.y * h, R: (Number(l.r) || 0.16) * w }));
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
        const oldMsg = view.querySelector('.smap-dark-msg');
        if (!dark || !dark.on || !window.VTTGeo) { canvas.style.display = 'none'; if (oldMsg) oldMsg.remove(); return; }
        canvas.style.display = 'block';
        const w = Math.max(1, view.clientWidth), h = Math.max(1, view.clientHeight);
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        // Noir profond légèrement bleuté + vignette (plus joli qu'un aplat pur)
        const bg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
        bg.addColorStop(0, 'rgb(11,10,16)');
        bg.addColorStop(1, 'rgb(2,2,5)');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
        const uid = myUid();
        const mine = (mapState.tokens || []).filter(t => !t.hidden && t.owner && t.owner === uid);
        // Seules les lumières EN VUE d'un de mes jetons sont rendues (sauf « toujours visible »)
        const lights = (m.lights || []).filter(l => lightSeenByMe(l, mine, m.walls || []));
        const segs = window.VTTGeo.wallsToPx(m.walls || [], w, h);
        const g = playerGridPx(w);                          // px d'une case sur CE board (échelle partagée)
        const dk = Object.assign({}, dark, { cellM: playerCellM() });
        // Murs nets, mais fondu doux en limite de portée (torche qui faiblit)
        const erase = window.VTTGeo.eraseVisionSoft || window.VTTGeo.eraseVision;
        const tintOrigins = [];
        if (mine.length || lights.length) {
            ctx.globalCompositeOperation = 'destination-out';
            mine.forEach(t => {
                const R = window.VTTGeo.visionRadiusPx(t, dk, g);
                erase(ctx, t.x * w, t.y * h, segs, R);
                tintOrigins.push({ x: t.x * w, y: t.y * h, R: R });
            });
            // Les points de lumière du MJ (torches au sol, lanternes…) éclairent tout le monde.
            lights.forEach(l => {
                const R = (Number(l.r) || 0.16) * w;
                erase(ctx, l.x * w, l.y * h, segs, R);
                tintOrigins.push({ x: l.x * w, y: l.y * h, R: R, c: l.color });
            });
            ctx.globalCompositeOperation = 'source-over';
            // Lueur chaude dans la zone dévoilée (derrière l'obscurité → aucune fuite)
            if (window.VTTGeo.paintLightTint) window.VTTGeo.paintLightTint(ctx, tintOrigins);
        }
        // Aucun jeton à moi ni lumière : message d'ambiance stylé (HTML, animé en CSS)
        if (!mine.length && !lights.length) {
            if (!oldMsg) {
                const msg = document.createElement('div');
                msg.className = 'smap-dark-msg';
                msg.innerHTML = '<span class="sdm-moon">🌑</span><div>Il fait noir…</div><small>Vous ne voyez rien. Approchez d\'une torche, ou attendez le MJ.</small>';
                view.appendChild(msg);
            }
        } else if (oldMsg) oldMsg.remove();
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
        ping.style.setProperty('--ping', p.color || '#C49B35');   // couleur choisie par le MJ
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
        if (!final && now - tokenSendThrottle < 100) return;   // ≤10 msg/s : sous la limite realtime
        tokenSendThrottle = now;
        sendToGm('token-move', { id: t.id, x: t.x, y: t.y, fromUid: myUid(), final: !!final });
    }
    // Vitesse de mon perso en mètres (lue sur la fiche #speed, sinon 9 m). Pour le déplacement mesuré.
    function playerTokenSpeed() {
        const el = document.getElementById('speed');
        if (el) { const n = parseFloat(String(el.value || '').replace(',', '.')); if (n && n > 0) return n; }
        return 9;
    }
    let playerMeasure = null;   // { x1,y1,x2,y2,speed } pendant que JE déplace mon jeton (Lot 34)
    function renderPlayerMeasure() {
        const board = playerBoard(); if (!board) return;
        const canvas = board.querySelector('.smap-measure'); if (!canvas) return;
        const w = Math.max(1, board.clientWidth), h = Math.max(1, board.clientHeight);
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, w, h);
        if (!playerMeasure) return;
        const x1 = playerMeasure.x1 * w, y1 = playerMeasure.y1 * h, x2 = playerMeasure.x2 * w, y2 = playerMeasure.y2 * h;
        const g = Math.max(1, playerGridPx(w));
        const meters = (Math.hypot(x2 - x1, y2 - y1) / g) * playerCellM();
        const spd = playerMeasure.speed || 9;
        const col = meters <= spd + 1e-6 ? '#57a64a' : (meters <= spd * 2 + 1e-6 ? '#d68a2b' : '#e23b3b');
        ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = col;
        [[x1, y1], [x2, y2]].forEach(pt => { ctx.beginPath(); ctx.arc(pt[0], pt[1], 4, 0, Math.PI * 2); ctx.fill(); });
        const tag = meters <= spd + 1e-6 ? '' : (meters <= spd * 2 + 1e-6 ? ' ⚡' : ' 🚫');
        const label = (Math.round(meters * 10) / 10).toLocaleString('fr-FR') + ' m / ' + spd + ' m' + tag;
        ctx.font = 'bold 13px Lora, serif'; const tw = ctx.measureText(label).width;
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 16;
        const bx = Math.max(4, Math.min(w - tw - 16, mx - tw / 2 - 6));
        ctx.fillStyle = 'rgba(20,14,8,0.85)';
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, my - 15, tw + 12, 22, 6) : ctx.rect(bx, my - 15, tw + 12, 22); ctx.fill();
        ctx.fillStyle = '#f3e3bb'; ctx.fillText(label, bx + 6, my + 1);
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
            // Outil annotation actif : clic = proposer une note au MJ (il validera).
            if (playerAnnot.on) {
                const p = boardFrac(e);
                const txt = prompt('Note à proposer au MJ (ex. « piège ici », « porte cachée ? ») :', '');
                if (txt && txt.trim()) {
                    sendToGm('annotation-add', { x: p.x, y: p.y, text: txt.trim().slice(0, 80), fromUid: myUid(), name: snapName() });
                    if (window.showAppToast) window.showAppToast('📌 Note envoyée au MJ pour validation', '#2c3e50');
                }
                playerAnnot.on = false; const ab = document.getElementById('smap-annot'); if (ab) ab.classList.remove('is-on');
                e.preventDefault(); return;
            }
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
            playerMeasure = { x1: t.x, y1: t.y, x2: t.x, y2: t.y, speed: playerTokenSpeed() };   // déplacement mesuré
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
            if (playerMeasure) { playerMeasure.x2 = x; playerMeasure.y2 = y; renderPlayerMeasure(); }   // distance parcourue
            scheduleDark();                                // ma vision suit mon jeton en direct
            updateZoneAudio();                             // le volume des zones sonores suit mon jeton
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
            playerMeasure = null; renderPlayerMeasure();   // fin du drag : efface la mesure
            sendTokenMove(cur, true); cur = null; el = null; playerDragBusy = false;
            if (pendingMapRender) { pendingMapRender = false; renderPlayerMap(); }
            updateZoneAudio();
        };
        view.addEventListener('pointerup', up);
        view.addEventListener('pointercancel', up);
    }

    // =====================================================
    // 8 · WIDGET FICHE FLOTTANTE — mini-fiche déplaçable par-dessus la carte
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

    // =====================================================
    // 9 · CYCLE DE VIE : teardown, kick/close, styles, API (join/leave), init
    // =====================================================
    function teardownMapUI() {
        mapState = { map: {}, tokens: [] };
        if (mapToggle) mapToggle.style.display = 'none';
        if (mapPanel) mapPanel.classList.add('hidden');
        if (sheetWidget) { sheetWidget.classList.add('hidden'); clearInterval(sswTimer); }
        try { zoneAudio.stopAll(); } catch (e) {}          // couper les boucles d'ambiance
        const lp = document.getElementById('session-loot'); if (lp) lp.classList.add('hidden');
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
        .sfp-share-toggle { display:flex; align-items:center; gap:6px; font-size:0.78rem; color:#6a5a3e; margin-bottom:10px; cursor:pointer; user-select:none; }
        body.theme-dark .sfp-share-toggle { color:#b6a074; }
        .sdc-ok { color:#2e9e44; }
        .sdc-ko { color:#c0392b; }
        .snc-roll { border:none; border-radius:8px; padding:7px 12px; background:linear-gradient(160deg,#d9af45,#b8862c); color:#2a1c0a; font-family:'Cinzel',serif; font-weight:bold; cursor:pointer; }
        .snc-roll:hover { filter:brightness(1.08); }
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
        .smap-templates, .smap-weather, .smap-hazards { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }
        .smap-tint { position:absolute; inset:0; pointer-events:none; transition:background 0.6s ease; border-radius:8px; z-index:2; }
        .smap-daynight { position:absolute; inset:0; pointer-events:none; transition:background 0.8s ease; border-radius:8px; z-index:2; }
        .smap-measure { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:7; }
        .smap-aura { position:absolute; transform:translate(-50%,-50%); border-radius:50%; pointer-events:none; background:radial-gradient(circle, color-mix(in srgb, var(--aura,#3498db) 26%, transparent) 0%, color-mix(in srgb, var(--aura,#3498db) 14%, transparent) 70%, transparent 72%); border:1px dashed color-mix(in srgb, var(--aura,#3498db) 60%, transparent); }
        .smap-badges { position:absolute; bottom:calc(100% + 1px); left:50%; transform:translateX(-50%); white-space:nowrap; font-size:0.6rem; line-height:1; background:rgba(20,14,8,0.78); border-radius:8px; padding:1px 4px; pointer-events:none; }
        .smap-token { position:absolute; width:30px; height:30px; transform:translate(-50%,-50%); border-radius:50%; background:var(--tok,#2980b9); border:2px solid #fff; display:flex; align-items:center; justify-content:center; color:#fff; font-family:'Cinzel',serif; font-weight:bold; font-size:0.68rem; box-shadow:0 2px 5px rgba(0,0,0,0.5); touch-action:none; transition:left 0.1s linear, top 0.1s linear; }
        /* Ombre elliptique « posée au sol » sous chaque jeton (Lot 24) */
        .smap-token::after { content:''; position:absolute; left:8%; right:8%; bottom:-16%; height:24%; border-radius:50%; background:radial-gradient(ellipse at center, rgba(0,0,0,0.42), rgba(0,0,0,0) 68%); z-index:-1; pointer-events:none; }
        /* Barre de PV sous le jeton (activée par le MJ, Lot 28) */
        .smap-hpbar { position:absolute; left:6%; right:6%; bottom:-26%; height:4px; border-radius:3px; background:rgba(0,0,0,0.55); border:1px solid rgba(255,255,255,0.35); overflow:hidden; pointer-events:none; }
        .smap-hpbar b { display:block; height:100%; background:linear-gradient(90deg,#37b24d,#69cc70); transition:width 0.25s ease; }
        .smap-hpbar b.is-low { background:linear-gradient(90deg,#c0392b,#e2694f); }
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
        /* Message d'ambiance quand le joueur ne voit rien (obscurité totale) */
        .smap-dark-msg { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); z-index:5; text-align:center; color:#cdc3ab; font-family:'Lora',serif; pointer-events:none; text-shadow:0 2px 10px #000, 0 0 4px #000; animation:sdmPulse 3.4s ease-in-out infinite; max-width:80%; }
        .smap-dark-msg .sdm-moon { font-size:2.1rem; display:block; margin-bottom:6px; filter:drop-shadow(0 0 14px rgba(130,140,190,0.4)); }
        .smap-dark-msg div { font-size:1.06rem; font-style:italic; letter-spacing:0.09em; }
        .smap-dark-msg small { display:block; margin-top:4px; color:#8d8471; font-size:0.72rem; letter-spacing:0.05em; }
        @keyframes sdmPulse { 0%,100% { opacity:0.55; } 50% { opacity:1; } }
        /* Portes cliquables par les joueurs (au-dessus de l'obscurité) */
        .smap-door-btn { position:absolute; transform:translate(-50%,-50%); z-index:8; width:28px; height:28px; padding:0; border-radius:50%; border:2px solid #d68a2b; background:rgba(34,24,14,0.92); font-size:0.9rem; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.5); }
        .smap-door-btn:hover { transform:translate(-50%,-50%) scale(1.15); box-shadow:0 0 12px rgba(214,138,43,0.9); }
        .smap-door-btn.is-open { border-color:#57a64a; }
        .smap-door-btn.is-locked { border-color:#c0392b; cursor:not-allowed; opacity:0.85; }
        /* Ouverture de la carte : elle « jaillit » depuis le bouton flottant */
        @keyframes smap-open-anim { 0%{ transform:scale(0.25); opacity:0; } 60%{ opacity:1; } 100%{ transform:none; opacity:1; } }
        #session-map.smap-anim-open { animation:smap-open-anim 0.32s cubic-bezier(0.26,1.2,0.42,1); }
        @media (prefers-reduced-motion: reduce) { #session-map { animation:none !important; transition:none !important; } }
        .smap-ping { position:absolute; width:40px; height:40px; transform:translate(-50%,-50%); border-radius:50%; border:3px solid var(--ping,#C49B35); box-shadow:0 0 16px var(--ping,#C49B35); pointer-events:none; z-index:6; animation:smap-ping-anim 1s ease-out 2; }
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
        #session-timer { position:fixed; top:8px; right:14px; z-index:9998; background:linear-gradient(160deg,#2c231b,#1d1712); color:#f3e3bb; border:2px solid var(--accent-color,#C49B35); border-radius:22px; padding:7px 14px; font-family:'Cinzel',serif; font-weight:bold; box-shadow:0 6px 18px rgba(0,0,0,0.45); pointer-events:none; }
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

    // Détachement LOCAL uniquement (appelé par l'écran MJ quand il ouvre sa session) :
    // on coupe le canal et l'UI joueur de CET onglet, sans rien toucher en base ni au
    // localStorage — la session joueur d'une autre fenêtre continue de vivre. (Lot 25)
    function detachLocal() {
        if (!state.sessionId) return;
        closePresence();
        state.code = null; state.sessionId = null; state.charId = null;
        setMusicRole('free');
        try { teardownCombatUI(); teardownMapUI(); } catch (e) {}
        try { updateFabVisibility(); } catch (e) {}
        emit();
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
        // ⚠️ Onglet ÉCRAN MJ : ne JAMAIS reconnecter la session joueur ici. Le localStorage
        // étant partagé entre fenêtres, l'onglet MJ rejoindrait le même topic Supabase une
        // 2e fois dans le MÊME client → le serveur ferme le canal MJ (il émet encore, mais
        // ne REÇOIT plus rien des joueurs : jetons, portes, murmures…). (bugfix Lot 25)
        if ((location.hash || '').indexOf('#gm/') === 0) return;
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
        document.addEventListener('screen:change', () => { updateFabVisibility(); renderTurnbar(); updateStatusFx(); });
        restore();
        setTimeout(updateStatusFx, 400);   // effet d'état plein écran si des conditions sont déjà cochées
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    // Case « partager mes jets » du panneau ⚔️ (délégué : le panneau est reconstruit à chaque ouverture)
    document.addEventListener('change', (e) => {
        if (!e.target) return;
        if (e.target.id === 'sfp-share-rolls') {
            try { localStorage.setItem('dnd-share-rolls', e.target.checked ? '1' : '0'); } catch (err) {}
            if (window.showAppToast) window.showAppToast(e.target.checked ? '🎲 Tes jets de fiche sont partagés avec la table' : '🤫 Tes jets de fiche restent privés', '#2c3e50');
        }
        // Case « effets d'état plein écran » (Lot 35)
        if (e.target.id === 'sfp-status-fx') {
            try { localStorage.setItem('dnd-fx-fullscreen', e.target.checked ? '1' : '0'); } catch (err) {}
            updateStatusFx();
            if (window.showAppToast) window.showAppToast(e.target.checked ? '💥 Effets d\'état plein écran activés' : '🚫 Effets d\'état plein écran désactivés', '#2c3e50');
        }
        // Une de MES conditions a changé → rafraîchir l'effet plein écran
        if (e.target.type === 'checkbox' && e.target.closest && e.target.closest('#conditions-track-container, #custom-conditions-container')) {
            updateStatusFx();
        }
    });

    // =====================================================
    // 10 · TableFX — célébrations de table partagées (nat 20 / nat 1).
    // Léger, sans lib : particules dorées + flash, ou secousse + voile rouge.
    // Respecte prefers-reduced-motion (aucune animation dans ce cas).
    // =====================================================
    (function () {
        let styled = false;
        function ensureFxStyles() {
            if (styled) return; styled = true;
            const css = `
            .tfx-burst { position: fixed; inset: 0; pointer-events: none; z-index: 100050; overflow: hidden; }
            .tfx-p { position: absolute; width: 10px; height: 10px; border-radius: 2px; opacity: 0.95; animation: tfxFall var(--d,1.6s) ease-out forwards; }
            @keyframes tfxFall { 0% { transform: translate(0,0) rotate(0deg); opacity: 1; } 100% { transform: translate(var(--dx,0), var(--dy,80vh)) rotate(var(--rot,540deg)); opacity: 0; } }
            .tfx-flash { position: fixed; inset: 0; pointer-events: none; z-index: 100049; background: radial-gradient(circle at 50% 45%, rgba(255,220,120,0.4), rgba(255,220,120,0) 60%); animation: tfxFlash 0.9s ease-out forwards; }
            @keyframes tfxFlash { 0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; } }
            .tfx-fumble { position: fixed; inset: 0; pointer-events: none; z-index: 100049; box-shadow: inset 0 0 120px 30px rgba(160,20,20,0.55); animation: tfxFlash 1.1s ease-out forwards; }
            body.tfx-shake { animation: tfxShake 0.5s ease-in-out; }
            @keyframes tfxShake { 0%,100% { transform: translate(0,0); } 20% { transform: translate(-7px,3px); } 40% { transform: translate(6px,-4px); } 60% { transform: translate(-5px,2px); } 80% { transform: translate(4px,-2px); } }
            .tfx-inspire { position: fixed; inset: 0; pointer-events: none; z-index: 100051; display: flex; align-items: center; justify-content: center; }
            .tfx-inspire b { font-family: 'Cinzel','Lora',serif; font-weight: 700; text-align: center; font-size: clamp(1.5rem, 6vw, 3.1rem); color: #ffe9a8; text-shadow: 0 0 20px rgba(245,197,66,0.9), 0 2px 8px rgba(0,0,0,0.65); animation: tfxInspire 2.6s ease-out forwards; }
            @keyframes tfxInspire { 0% { opacity:0; transform: scale(0.6) translateY(12px); } 14% { opacity:1; transform: scale(1.1) translateY(0); } 30% { transform: scale(1); } 78% { opacity:1; } 100% { opacity:0; transform: scale(1.03) translateY(-16px); } }`;
            const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
        }
        function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
        const COLS = ['#f5c542', '#e2a13a', '#fff2b2', '#c49b35', '#ffdf7e'];
        function crit() {
            if (reduced()) return;
            ensureFxStyles();
            const burst = document.createElement('div'); burst.className = 'tfx-burst no-print';
            for (let i = 0; i < 26; i++) {
                const p = document.createElement('i'); p.className = 'tfx-p';
                p.style.left = (35 + Math.random() * 30) + '%';
                p.style.top = (30 + Math.random() * 12) + '%';
                p.style.background = COLS[i % COLS.length];
                p.style.setProperty('--dx', (Math.random() * 60 - 30) + 'vw');
                p.style.setProperty('--dy', (35 + Math.random() * 45) + 'vh');
                p.style.setProperty('--rot', Math.round(Math.random() * 900 - 450) + 'deg');
                p.style.setProperty('--d', (1.2 + Math.random() * 0.9) + 's');
                burst.appendChild(p);
            }
            const flash = document.createElement('div'); flash.className = 'tfx-flash no-print';
            document.body.appendChild(flash); document.body.appendChild(burst);
            setTimeout(() => { burst.remove(); flash.remove(); }, 2300);
        }
        function fumble() {
            if (reduced()) return;
            ensureFxStyles();
            const veil = document.createElement('div'); veil.className = 'tfx-fumble no-print';
            document.body.appendChild(veil);
            document.body.classList.add('tfx-shake');
            setTimeout(() => { veil.remove(); document.body.classList.remove('tfx-shake'); }, 1200);
        }
        // ✨ Inspiration héroïque : bannière dorée + gerbe d'étincelles (Lot 35).
        function inspire() {
            ensureFxStyles();
            if (!reduced()) {
                const burst = document.createElement('div'); burst.className = 'tfx-burst no-print';
                for (let i = 0; i < 22; i++) {
                    const p = document.createElement('i'); p.className = 'tfx-p';
                    p.style.left = (40 + Math.random() * 20) + '%';
                    p.style.top = (40 + Math.random() * 12) + '%';
                    p.style.background = COLS[i % COLS.length];
                    p.style.setProperty('--dx', (Math.random() * 70 - 35) + 'vw');
                    p.style.setProperty('--dy', (30 + Math.random() * 40) + 'vh');
                    p.style.setProperty('--rot', Math.round(Math.random() * 900 - 450) + 'deg');
                    p.style.setProperty('--d', (1.3 + Math.random() * 0.9) + 's');
                    burst.appendChild(p);
                }
                document.body.appendChild(burst);
                setTimeout(() => burst.remove(), 2600);
            }
            const banner = document.createElement('div'); banner.className = 'tfx-inspire no-print';
            banner.innerHTML = '<b>✨ Inspiration héroïque !</b>';
            document.body.appendChild(banner);
            setTimeout(() => banner.remove(), 2700);
        }
        window.TableFX = { crit, fumble, inspire };
    })();

    window.PlayerSession = { join, leave, isConnected, getState, pushSnapshot, restore, detachLocal, shareRoll,
        // Crochets de TEST (preview sans Supabase) : simulent ce que le MJ diffuse.
        // Aucun effet en usage normal ; permettent de valider le rendu joueur sans session réelle.
        debugApplyMap: function (map, tokens, uid) { if (uid) debugUid = uid; if (!state.sessionId) state.sessionId = 'debug'; applyMap(map, tokens); },
        // Cibles de volume des zones sonores EN BOUCLE (le fondu tend vers ces valeurs). Test/diagnostic.
        debugZoneTargets: function () { const o = {}; Object.keys(zoneAudio.els).forEach(id => { o[id] = Math.round((zoneAudio.els[id].target || 0) * 1000) / 1000; }); return o; },
        debugEvent: function (event, payload) {
            if (!state.sessionId) state.sessionId = 'debug';
            const map = { combat: applyCombat, dice: receiveDiceRoll, concentration: receiveConcentration, inspiration: receiveInspiration, 'npc-card': receiveNpcCard, 'boss-reveal': receiveBossReveal, banner: receiveBanner, 'session-recap': receiveSessionRecap, timer: receiveTimer, 'show-image': receiveSharedImage, gift: receiveGift, 'roll-request': receiveRollRequest };
            if (map[event]) map[event](payload);
        } };
})();
