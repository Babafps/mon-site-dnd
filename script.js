document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. BASE DE DONNÉES ET GESTIONNAIRE D'ÉTAT
    // ==========================================
    const DB = {
        get: function(key) { try { return localStorage.getItem(key); } catch(e) { return null; } },
        set: function(key, val) { 
            try { localStorage.setItem(key, val); }
            catch(e) { console.warn("Erreur sauvegarde locale.", e); DB.warnQuotaOnce(); }
            if (window.SupaAuth?.currentUser && window.SyncQueue && ACTIVE_CHAR_ID && key.startsWith(ACTIVE_CHAR_ID + '_')) {
                const subKey = key.slice(ACTIVE_CHAR_ID.length + 1);
                // `dnd-avatar-src` = image source pleine résolution gardée pour le re-recadrage local
                // uniquement → jamais synchronisée au cloud (trop lourde ; l'avatar rogné, lui, l'est).
                if (!key.startsWith('dnd-theme-') && !key.startsWith('dnd-custom-background') && subKey !== 'dnd-avatar-src') {
                    window.SyncQueue.push(ACTIVE_CHAR_ID, subKey, val);
                }
            }
        },
        remove: function(key) { try { localStorage.removeItem(key); } catch(e) {} },
        // Quota du navigateur plein : l'écriture échoue silencieusement et
        // l'utilisateur croirait sa fiche sauvegardée. On l'avertit une fois
        // par session, en le renvoyant vers la sauvegarde complète.
        _quotaWarned: false,
        warnQuotaOnce: function() {
            if (this._quotaWarned) return;
            this._quotaWarned = true;
            const msg = "⚠️ Mémoire du navigateur pleine : la sauvegarde a ÉCHOUÉ. "
                      + "Fais une « Sauvegarde complète » (menu ☰) avant de fermer, "
                      + "puis allège tes images ou supprime un personnage.";
            if (window.showAppToast) window.showAppToast(msg, '#c0392b');
            else setTimeout(() => alert(msg), 200);
        },
        keys: function() { try { return Object.keys(localStorage); } catch(e) { return []; } }
    };

    let ACTIVE_CHAR_ID = DB.get('dnd-active-char');
    let charactersList = [];
    
    try { 
        let rawList = DB.get('dnd-character-list');
        if(rawList && rawList !== 'undefined') charactersList = JSON.parse(rawList);
        if(!Array.isArray(charactersList)) charactersList = [];
    } catch(e) { charactersList = []; }

    function getStore(key, isJson = true) { 
        if(!ACTIVE_CHAR_ID) return null;
        let val = DB.get(`${ACTIVE_CHAR_ID}_${key}`); 
        if(!val || val === 'undefined') return null; 
        if(isJson) { try { return JSON.parse(val); } catch(e) { return null; } }
        return val;
    }
    function setStore(key, val, isJson = true) { 
        if(!ACTIVE_CHAR_ID) return;
        DB.set(`${ACTIVE_CHAR_ID}_${key}`, isJson ? JSON.stringify(val) : val); 
    }

    // ==========================================
    // EFFETS VISUELS ET ÉTATS
    // ==========================================
    const conditionsMap = {
        'cond-blind': { class: 'fx-blind', label: 'Aveuglé', icon: '👁️' },
        'cond-charm': { class: 'fx-charm', label: 'Charmé', icon: '💖' },
        'cond-deaf': { class: 'fx-deaf', label: 'Assourdi', icon: '🙉' },
        'cond-fright': { class: 'fx-fright', label: 'Effrayé', icon: '👻' },
        'cond-grap': { class: 'fx-grap', label: 'Empoigné', icon: '✊' },
        'cond-pois': { class: 'fx-poison', label: 'Empoisonné', icon: '🧪' },
        'cond-prone': { class: 'fx-prone', label: 'À terre', icon: '⏬' },
        'cond-restr': { class: 'fx-restrain', label: 'Entravé', icon: '⛓️' },
        'cond-stun': { class: 'fx-stun', label: 'Étourdi', icon: '💫' },
        'cond-uncon': { class: 'fx-uncon', label: 'Inconscient', icon: '💤' }
    };

    function updateStatusEffects() {
        const overlay = document.getElementById('status-fx-overlay');
        const labelsContainer = document.getElementById('status-fx-labels');
        if(!overlay) return;
        let activeClasses = [];
        let activeLabels = [];
        Object.keys(conditionsMap).forEach(id => {
            const cb = document.getElementById(id);
            if(cb && cb.checked) {
                activeClasses.push(conditionsMap[id].class);
                activeLabels.push(`<span class="status-fx-badge">${conditionsMap[id].icon} ${conditionsMap[id].label}</span>`);
            }
        });
        overlay.className = 'status-fx-overlay ' + activeClasses.join(' ');
        if(activeClasses.length > 0) overlay.classList.remove('hidden');
        else overlay.classList.add('hidden');
        
        if(labelsContainer) labelsContainer.innerHTML = activeLabels.join('');
    }

    // ==========================================
    // 2. ÉCOUTEURS GLOBAUX INDÉPENDANTS
    // ==========================================
    
    // Couleurs personnalisées : posées en inline sur <body>. On n'écrit QUE ce que
    // l'utilisateur a réellement modifié — les autres variables restent celles de :root.
    const THEME_COLORS = [
        ['dnd-theme-primary',       '--primary-color',       '#7A2828', 'color-primary'],
        ['dnd-theme-accent',        '--accent-color',        '#C49B35', 'color-accent'],
        ['dnd-theme-sheet-bg',      '--sheet-bg-color',      '#FAF3E0', 'color-sheet-bg'],
        ['dnd-theme-widget-bg',     '--widget-bg',           '#FFFFFF', 'color-widget-bg'],
        ['dnd-theme-concentration', '--concentration-color', '#2980b9', 'color-concentration']
    ];

    function applyTheme() {
        const computed = getComputedStyle(document.body);
        THEME_COLORS.forEach(function(entry) {
            const key = entry[0], cssVar = entry[1], fallback = entry[2], inputId = entry[3];
            const saved = DB.get(key);
            if (saved) document.body.style.setProperty(cssVar, saved);
            else document.body.style.removeProperty(cssVar);

            const input = document.getElementById(inputId);
            if (!input) return;
            if (saved) { input.value = saved; return; }
            // Pas de couleur perso : la pastille reflète la couleur du style actif.
            const fromStyle = computed.getPropertyValue(cssVar).trim();
            input.value = /^#[0-9a-f]{6}$/i.test(fromStyle) ? fromStyle : fallback;
        });
    }
    applyTheme();

    // --- Toast applicatif élégant (remplace certains alert) ---
    window.showAppToast = function(msg, bg = '#27ae60') {
        let t = document.getElementById('app-toast');
        if(!t) {
            t = document.createElement('div'); t.id = 'app-toast'; t.className = 'no-print';
            t.style.cssText = 'position:fixed; bottom:92px; left:50%; transform:translateX(-50%) translateY(20px); padding:12px 24px; border-radius:30px; font-family:"Cinzel",serif; font-size:1rem; font-weight:bold; color:#fff; z-index:6000; box-shadow:0 8px 28px rgba(0,0,0,0.45); opacity:0; transition:opacity 0.3s, transform 0.3s; pointer-events:none; text-align:center; max-width:90vw; border:1px solid rgba(196,155,53,0.5);';
            document.body.appendChild(t);
        }
        t.style.background = bg; t.textContent = msg;
        requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)'; });
        clearTimeout(t._timer);
        t._timer = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(20px)'; }, 2800);
    };

    // --- Suppression annulable ---
    // Remplace le couple « confirm() puis c'est perdu » par une suppression
    // immédiate assortie d'un toast « Annuler » de 6 s. Moins de friction à
    // chaque geste, et plus aucun regret définitif.
    window.showUndoToast = function(msg, onUndo, seconds) {
        const delay = (seconds || 6) * 1000;
        let t = document.getElementById('app-toast-undo');
        if (!t) {
            t = document.createElement('div'); t.id = 'app-toast-undo'; t.className = 'no-print';
            document.body.appendChild(t);
        }
        clearTimeout(t._timer);
        t.innerHTML = '';
        const label = document.createElement('span');
        label.className = 'undo-label'; label.textContent = msg;
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'undo-btn'; btn.textContent = '↩ Annuler';
        const hide = () => { t.classList.remove('is-on'); };
        btn.addEventListener('click', () => { clearTimeout(t._timer); hide(); try { onUndo(); } catch (e) { console.warn(e); } });
        t.appendChild(label); t.appendChild(btn);
        // Reflow forcé plutôt que requestAnimationFrame : rAF ne se déclenche pas
        // dans un onglet en arrière-plan, le toast resterait alors invisible.
        void t.offsetWidth;
        t.classList.add('is-on');
        t._timer = setTimeout(hide, delay);
    };

    /** Retire l'élément `index` d'un tableau, sauvegarde, redessine, et propose
     *  de revenir en arrière. `label` sert au message. */
    window.deleteWithUndo = function(arr, index, label, save, render) {
        if (index < 0 || index >= arr.length) return;
        const removed = arr[index];
        arr.splice(index, 1);
        save(); render();
        window.showUndoToast(`« ${label} » supprimé`, () => {
            arr.splice(Math.min(index, arr.length), 0, removed);
            save(); render();
        });
    };

    // --- Mode Nuit (fiche) ---
    const toggleDarkMode = document.getElementById('toggle-dark-mode');
    function applyDarkMode(on) { document.body.classList.toggle('theme-dark', on); if(toggleDarkMode) toggleDarkMode.checked = on; }
    applyDarkMode(DB.get('dnd-theme-darkmode') === 'true');
    if(toggleDarkMode) toggleDarkMode.addEventListener('change', (e) => { DB.set('dnd-theme-darkmode', e.target.checked); applyDarkMode(e.target.checked); });

    // --- Préférences d'affichage des modules (menu ☰) ---
    // Câblées ICI, hors des branches accueil / fiche, pour être utilisables depuis les
    // DEUX écrans. Les boutons ciblés n'existent que sur la fiche : chaque application
    // est donc protégée, et la préférence est enregistrée dans tous les cas.
    const applyPrefTo = (id, on) => { const el = document.getElementById(id); if (el) el.classList.toggle('hidden', !on); };

    const toggleSearchBtn = document.getElementById('toggle-search-btn');
    if (toggleSearchBtn) {
        const shown = (DB.get('dnd-show-search-btn') || 'true') === 'true';
        toggleSearchBtn.checked = shown;
        applyPrefTo('btn-global-search-trigger', shown);
        toggleSearchBtn.addEventListener('change', (e) => {
            DB.set('dnd-show-search-btn', e.target.checked);
            applyPrefTo('btn-global-search-trigger', e.target.checked);
        });
    }

    const toggleFloatingDice = document.getElementById('toggle-floating-dice');
    if (toggleFloatingDice) {
        const shown = (DB.get('dnd-show-floating-dice') || 'true') === 'true';
        toggleFloatingDice.checked = shown;
        applyPrefTo('btn-toggle-dice', shown);
        toggleFloatingDice.addEventListener('change', (e) => {
            DB.set('dnd-show-floating-dice', e.target.checked);
            applyPrefTo('btn-toggle-dice', e.target.checked);
            const drawer = document.getElementById('dice-drawer');
            if (!e.target.checked && drawer) drawer.classList.remove('open');
        });
    }

    const toggleMusicPlayer = document.getElementById('toggle-music-player');
    if (toggleMusicPlayer) {
        // Téléphone (≤700px) : préférence séparée de celle du bureau.
        const musicMobileView = () => window.matchMedia('(max-width: 700px)').matches;
        const musicKey = () => musicMobileView() ? 'dnd-show-music-player-mobile' : 'dnd-show-music-player';
        const shown = (DB.get(musicKey()) || 'false') === 'true';   // masqué par défaut
        toggleMusicPlayer.checked = shown;
        if (window.MusicPlayer) window.MusicPlayer.setVisible(shown, false);
        toggleMusicPlayer.addEventListener('change', (e) => {
            DB.set(musicKey(), e.target.checked ? 'true' : 'false');
            if (window.MusicPlayer) window.MusicPlayer.setVisible(e.target.checked, false);
        });
    }

    // ===== SAUVEGARDE COMPLÈTE (toutes les fiches en un fichier) =====
    // Filet de sécurité : le stockage local peut être vidé par le navigateur ou
    // saturer (cf. DB.warnQuotaOnce). L'export per-fiche existant ne couvre
    // qu'un personnage à la fois.
    function collectFullBackup() {
        const data = {};
        DB.keys().forEach(k => { if (k.startsWith('dnd-') || k.includes('_dnd-')) data[k] = DB.get(k); });
        return {
            format: 'bones-and-blades-backup', version: 1,
            exportedAt: new Date().toISOString(),
            characters: (() => { try { return JSON.parse(DB.get('dnd-character-list') || '[]'); } catch (e) { return []; } })(),
            data
        };
    }

    const btnBackupExport = document.getElementById('btn-backup-export');
    if (btnBackupExport) btnBackupExport.addEventListener('click', () => {
        const backup = collectFullBackup();
        const n = backup.characters.length;
        const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bones-and-blades-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        if (window.showAppToast) window.showAppToast(`💾 Sauvegarde de ${n} personnage${n > 1 ? 's' : ''} téléchargée`);
    });

    const backupImportInput = document.getElementById('backup-import-input');
    if (backupImportInput) backupImportInput.addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            let backup;
            try { backup = JSON.parse(ev.target.result); } catch (err) { alert('Fichier illisible.'); return; }
            if (backup.format !== 'bones-and-blades-backup' || !backup.data) {
                alert("Ce fichier n'est pas une sauvegarde complète Bones & Blades."); return;
            }
            const n = (backup.characters || []).length;
            const when = (backup.exportedAt || '').slice(0, 10);
            if (!confirm(`Restaurer ${n} personnage(s) sauvegardé(s) le ${when} ?\n\n`
                       + `⚠️ Cela REMPLACE tout le contenu actuel de ce navigateur.`)) return;
            // On repart d'un stockage propre pour ne pas laisser d'orphelins
            DB.keys().forEach(k => { if (k.startsWith('dnd-') || k.includes('_dnd-')) DB.remove(k); });
            Object.entries(backup.data).forEach(([k, v]) => { try { localStorage.setItem(k, v); } catch (err) { DB.warnQuotaOnce(); } });
            DB.remove('dnd-active-char');
            alert('Sauvegarde restaurée. La page va se recharger.');
            location.reload();
        };
        reader.readAsText(file);
        backupImportInput.value = '';
    });


    const cPrim = document.getElementById('color-primary'); if(cPrim) cPrim.addEventListener('input', (e) => { document.body.style.setProperty('--primary-color', e.target.value); DB.set('dnd-theme-primary', e.target.value); });
    const cAcc = document.getElementById('color-accent'); if(cAcc) cAcc.addEventListener('input', (e) => { document.body.style.setProperty('--accent-color', e.target.value); DB.set('dnd-theme-accent', e.target.value); });
    const cShBg = document.getElementById('color-sheet-bg'); if(cShBg) cShBg.addEventListener('input', (e) => { document.body.style.setProperty('--sheet-bg-color', e.target.value); DB.set('dnd-theme-sheet-bg', e.target.value); });
    const cWdBg = document.getElementById('color-widget-bg'); if(cWdBg) cWdBg.addEventListener('input', (e) => { document.body.style.setProperty('--widget-bg', e.target.value); DB.set('dnd-theme-widget-bg', e.target.value); });
    const cConc = document.getElementById('color-concentration'); if(cConc) cConc.addEventListener('input', (e) => { document.body.style.setProperty('--concentration-color', e.target.value); DB.set('dnd-theme-concentration', e.target.value); });
    const btnResetTheme = document.getElementById('btn-reset-theme'); if(btnResetTheme) btnResetTheme.addEventListener('click', () => { DB.remove('dnd-theme-primary'); DB.remove('dnd-theme-accent'); DB.remove('dnd-theme-sheet-bg'); DB.remove('dnd-theme-widget-bg'); DB.remove('dnd-theme-concentration'); applyTheme(); });

    const btnSettingsToggle = document.getElementById('btn-settings-toggle');
    const settingsDropdown = document.getElementById('settings-dropdown');
    if (btnSettingsToggle && settingsDropdown) {
        btnSettingsToggle.addEventListener('click', (e) => { e.stopPropagation(); settingsDropdown.classList.toggle('hidden'); });
        document.addEventListener('click', (e) => { if (!settingsDropdown.classList.contains('hidden') && !e.target.closest('.settings-container')) { settingsDropdown.classList.add('hidden'); } });
    }

    // Bouton ⌨️ du menu ☰ : ouvre l'éditeur de raccourcis du bon côté (MJ ou joueur).
    // ⚠️ Câblé ICI, au niveau global : l'écran MJ s'ouvre depuis l'accueil (sans personnage actif),
    // donc un câblage dans la branche « fiche » laisserait le bouton mort côté MJ.
    document.getElementById('btn-shortcuts')?.addEventListener('click', () => {
        if (settingsDropdown) settingsDropdown.classList.add('hidden');
        // (Renvoi vers les raccourcis de l'écran MJ retiré avec celui-ci — voir ecran-mj/README.md)
        if (window.__openPlayerShortcuts) { window.__openPlayerShortcuts(); return; }
        if (window.showAppToast) window.showAppToast('Ouvre une fiche ou l\'écran du MJ pour régler les raccourcis.', '#7a6050');
    });

    // ==========================================
    // SESSION DE JEU (côté joueur) — UI du menu ☰
    // ==========================================
    (function wirePlayerSessionUI() {
        const codeInput = document.getElementById('session-code-input');
        const btnJoin   = document.getElementById('btn-join-session');
        const btnLeave  = document.getElementById('btn-leave-session');
        const msgEl     = document.getElementById('session-join-msg');
        const boxDisc   = document.getElementById('player-session-disconnected');
        const boxConn   = document.getElementById('player-session-connected');
        const codeShow  = document.getElementById('session-current-code');
        if (!btnJoin || !boxDisc || !boxConn) return;

        function setMsg(text, color) { if (msgEl) { msgEl.textContent = text || ''; msgEl.style.color = color || '#777'; } }
        function renderState(s) {
            const connected = !!(s && s.connected);
            boxDisc.classList.toggle('hidden', connected);
            boxConn.classList.toggle('hidden', !connected);
            if (connected && codeShow) codeShow.textContent = s.code || '';
            if (!connected) setMsg('');
        }

        document.addEventListener('playersession:change', (e) => renderState(e.detail));
        if (window.PlayerSession) renderState(window.PlayerSession.getState());

        btnJoin.addEventListener('click', async () => {
            const code = (codeInput.value || '').toUpperCase().trim();
            if (!code) { setMsg('Entre un code.', '#c0392b'); return; }
            if (!ACTIVE_CHAR_ID) { setMsg("Ouvre d'abord une fiche de personnage.", '#c0392b'); return; }
            if (!window.SupaAuth || !window.SupaAuth.currentUser) { setMsg('Connecte-toi pour rejoindre.', '#c0392b'); return; }
            btnJoin.disabled = true; setMsg('Connexion…', '#777');
            try {
                await window.PlayerSession.join(code);
                codeInput.value = '';
            } catch (err) {
                const m = String((err && (err.message || err.code)) || err);
                if (m.includes('SESSION_NOT_FOUND'))      setMsg('Code invalide ou session fermée.', '#c0392b');
                else if (m.includes('AUCUNE_FICHE'))      setMsg("Ouvre d'abord une fiche.", '#c0392b');
                else if (m.includes('NON_CONNECTE'))      setMsg('Connecte-toi pour rejoindre.', '#c0392b');
                else if (m.includes('CODE_INVALIDE'))     setMsg('Code à 6 caractères attendu.', '#c0392b');
                else                                       setMsg('Échec : ' + m, '#c0392b');
            } finally { btnJoin.disabled = false; }
        });

        if (codeInput) codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); btnJoin.click(); } });
        if (btnLeave) btnLeave.addEventListener('click', async () => {
            btnLeave.disabled = true;
            try { await window.PlayerSession.leave(); } finally { btnLeave.disabled = false; }
        });
    })();

    // Partage d'UNE fiche (la fiche active) → fichier .json importable
    const btnExportChar = document.getElementById('btn-export-char');
    if (btnExportChar) {
        btnExportChar.addEventListener('click', async () => {
            if (!ACTIVE_CHAR_ID) { alert("Ouvre d'abord une fiche de personnage."); return; }
            btnExportChar.disabled = true; const old = btnExportChar.textContent; btnExportChar.textContent = '⏳ Export…';
            try {
                let data = {}, meta = null;
                if (window.SupaAuth?.currentUser) {
                    data = await window.SupaAuth.loadCharacterData(ACTIVE_CHAR_ID);
                    const chars = await window.SupaAuth.loadCharacters(); meta = chars.find(c => c.id === ACTIVE_CHAR_ID) || null;
                } else {
                    const prefix = ACTIVE_CHAR_ID + '_';
                    DB.keys().forEach(k => { if (k.startsWith(prefix)) data[k.slice(prefix.length)] = DB.get(k); });
                    meta = charactersList.find(c => c.id === ACTIVE_CHAR_ID) || null;
                }
                const rawName = (data['dnd-sheet-char-name'] || (meta && meta.name) || 'fiche').toString();
                const safe = rawName.replace(/[^\w\-]+/g, '_');
                const exportData = { version: "char-1.0", meta: meta, data: data };
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
                // Nom de fichier lisible : « Fiche de <nom du perso>.json » (on ne retire que les
                // caractères interdits par les systèmes de fichiers, pour garder accents et espaces).
                const fileName = 'Fiche de ' + rawName.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ') + '.json';
                const a = document.createElement('a'); a.setAttribute("href", dataStr); a.setAttribute("download", fileName); document.body.appendChild(a); a.click(); a.remove();
            } catch (err) { alert("Erreur lors de l'export : " + err.message); }
            finally { btnExportChar.disabled = false; btnExportChar.textContent = old; }
        });
    }

    const btnImportJson = document.getElementById('btn-import-json');
    if (btnImportJson) {
        btnImportJson.addEventListener('change', (e) => {
            const file = e.target.files[0]; if (!file) return; const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const parsed = JSON.parse(event.target.result);
                    if (window.SupaAuth?.currentUser) {
                        if (parsed.version === "char-1.0" && parsed.data) {
                            const charName = parsed.data['dnd-sheet-char-name'] || parsed.meta?.name || 'Fiche importée';
                            if (!confirm(`Importer la fiche « ${charName} » comme nouveau personnage ?`)) { btnImportJson.value = ''; return; }
                            const newChar = await window.SupaAuth.createCharacter(charName); if (!newChar) { alert("Erreur lors de la création."); btnImportJson.value = ''; return; }
                            const entries = Object.entries(parsed.data).filter(([, v]) => v !== null && v !== undefined).map(([key, value]) => ({ key, value: String(value) }));
                            if (entries.length > 0) await window.SupaAuth.saveKeys(newChar.id, entries);
                            alert(`✅ Fiche « ${charName} » importée !`); location.reload();
                        } else if (parsed.version === "4.0" && Array.isArray(parsed.characters)) {
                            if (!confirm(`Importer ${parsed.characters.length} personnage(s) ? Ils seront ajoutés à vos personnages existants.`)) { btnImportJson.value = ''; return; }
                            let ok = 0;
                            for (const charExport of parsed.characters) {
                                const charName = charExport.data?.['dnd-sheet-char-name'] || charExport.meta?.name || 'Personnage importé';
                                const newChar = await window.SupaAuth.createCharacter(charName); if (!newChar) return;
                                const entries = Object.entries(charExport.data || {}).filter(([, v]) => v !== null && v !== undefined).map(([key, value]) => ({ key, value: String(value) }));
                                if (entries.length > 0) await window.SupaAuth.saveKeys(newChar.id, entries); ok++;
                            }
                            alert(`✅ ${ok} personnage(s) importé(s) !`); location.reload();
                        } else if (parsed.allData && Array.isArray(parsed.charactersList)) {
                            if (!confirm(`Importer ${parsed.charactersList.length} personnage(s) depuis un ancien format ?`)) { btnImportJson.value = ''; return; }
                            let ok = 0;
                            for (const c of parsed.charactersList) {
                                const charName = parsed.allData[c.id + '_dnd-sheet-char-name'] || c.name || 'Personnage importé';
                                const newChar = await window.SupaAuth.createCharacter(charName); if (!newChar) continue; const prefix = c.id + '_';
                                const entries = Object.entries(parsed.allData).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => ({ key: k.slice(prefix.length), value: String(v) }));
                                if (entries.length > 0) await window.SupaAuth.saveKeys(newChar.id, entries); ok++;
                            }
                            alert(`✅ ${ok} personnage(s) importé(s) !`); location.reload();
                        } else { alert("Format de fichier non reconnu."); }
                    } else {
                        if (parsed.version === "char-1.0" && parsed.data) {
                            const newId = 'char_' + Date.now();
                            const charName = parsed.data['dnd-sheet-char-name'] || parsed.meta?.name || 'Fiche importée';
                            Object.entries(parsed.data).forEach(([k, v]) => DB.set(newId + '_' + k, v));
                            let list = []; try { list = JSON.parse(DB.get('dnd-character-list') || '[]'); } catch (e) {}
                            list.push({ id: newId, name: charName, level: (parsed.meta && parsed.meta.level) || 1, class: (parsed.meta && parsed.meta.class) || '' });
                            DB.set('dnd-character-list', JSON.stringify(list));
                            alert(`✅ Fiche « ${charName} » importée !`); location.reload();
                        } else if (parsed.allData) { Object.keys(parsed.allData).forEach(k => { DB.set(k, parsed.allData[k]); }); if (parsed.charactersList) DB.set('dnd-character-list', JSON.stringify(parsed.charactersList)); if (parsed.activeCharId) DB.set('dnd-active-char', parsed.activeCharId); alert("Sauvegarde importée !"); location.reload(); } else { alert("Format de fichier invalide."); }
                    }
                } catch (err) { alert("Erreur lors de la lecture du fichier : " + err.message); } btnImportJson.value = '';
            }; reader.readAsText(file);
        });
    }

    const bgInput = document.getElementById('bg-file-input'); const CUSTOM_BG_KEY = 'dnd-custom-background-image';
    // --custom-bg : sur mobile le fond est peint par un calque fixe (body::before, cf. style.css
    // « fluidité tactile ») qui lit cette variable pour afficher l'image personnalisée.
    function applySavedBackground() { const savedBg = DB.get(CUSTOM_BG_KEY); if(savedBg && savedBg !== 'undefined') { document.body.style.backgroundImage = `url("${savedBg}")`; document.body.style.setProperty('--custom-bg', `url("${savedBg}")`); } else { document.body.style.backgroundImage = ''; document.body.style.removeProperty('--custom-bg'); } }
    applySavedBackground();
    
    const btnChangeBg = document.getElementById('btn-change-bg'); if(btnChangeBg && bgInput) { btnChangeBg.addEventListener('click', () => { bgInput.click(); if(settingsDropdown) settingsDropdown.classList.add('hidden'); }); }
    if(bgInput) { bgInput.addEventListener('change', (e) => { const file = e.target.files[0]; if(!file || !file.type.startsWith('image/')) return; const reader = new FileReader(); reader.onload = (event) => { const img = new Image(); img.onload = () => { const canvas = document.createElement('canvas'); const MAX_WIDTH = 1920; let width = img.width; let height = img.height; if(width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; } canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height); try { DB.set(CUSTOM_BG_KEY, canvas.toDataURL('image/jpeg', 0.7)); applySavedBackground(); } catch (err) { alert("L'image est toujours trop lourde."); } bgInput.value = ''; }; img.src = event.target.result; }; reader.readAsDataURL(file); }); }
    const btnResetBg = document.getElementById('btn-reset-bg'); if(btnResetBg) { btnResetBg.addEventListener('click', () => { DB.remove(CUSTOM_BG_KEY); applySavedBackground(); if(settingsDropdown) settingsDropdown.classList.add('hidden'); }); }

    const btnGoHome = document.getElementById('btn-go-home'); if(btnGoHome) btnGoHome.addEventListener('click', () => { DB.remove('dnd-active-char'); location.reload(); });

    const btnCreateChar = document.getElementById('btn-create-char');
    if(btnCreateChar) {
        btnCreateChar.addEventListener('click', async () => {
            const inputName = document.getElementById('new-char-name');
            // Le nom n'est plus obligatoire : à vide, on crée avec un nom par défaut
            // (l'assistant de création, lancé juste après, permet de le renommer).
            const name = (inputName ? inputName.value.trim() : '') || 'Nouveau personnage';
            let newId, newChar;
            if(window.SupaAuth?.currentUser) { newChar = await window.SupaAuth.createCharacter(name); if(!newChar) { alert("Erreur lors de la création."); return; } newId = newChar.id; charactersList.push({ id: newId, name: name, level: 1, class: '' }); DB.set('dnd-character-list', JSON.stringify(charactersList)); } else { newId = 'char_' + Date.now(); charactersList.push({ id: newId, name: name, level: 1, class: '' }); DB.set('dnd-character-list', JSON.stringify(charactersList)); }
            DB.set(`${newId}_dnd-sheet-char-name`, name); DB.set('dnd-active-char', newId);
            DB.set('dnd-pj-wizard-pending', '1');   // fiche neuve → l'assistant de création se lance après le reload (pj-tutorial.js)
            location.reload();
        });
    }

    const homeScreen = document.getElementById('home-screen'); const appScreen = document.getElementById('app-screen');

    if(!ACTIVE_CHAR_ID) { 
        if(homeScreen) homeScreen.classList.remove('hidden'); if(appScreen) appScreen.classList.add('hidden'); 
        // ===== ACCUEIL : liste des personnages (archivage, duplication, tri) =====
        // NOTE : l'archivage et l'ordre personnalisé sont stockés LOCALEMENT (dnd-char-meta).
        // La table Supabase `characters` n'expose que id/name/level/class — pas de colonne
        // dédiée — donc ces préférences ne suivent pas d'un appareil à l'autre.
        const CHAR_META_KEY = 'dnd-char-meta';
        const CHAR_SORT_KEY = 'dnd-char-sort';
        let charMeta = (() => { try { const o = JSON.parse(DB.get(CHAR_META_KEY) || '{}'); return (o && typeof o === 'object') ? o : {}; } catch (e) { return {}; } })();
        function saveCharMeta() { DB.set(CHAR_META_KEY, JSON.stringify(charMeta)); }
        function metaOf(id) { if (!charMeta[id]) charMeta[id] = {}; return charMeta[id]; }
        // Échappement local : escAb() n'existe que dans la branche « fiche » de ce fichier.
        const escChar = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // Un seul menu ouvert à la fois ; un clic ailleurs ou Échap le referme.
        function closeCharMenus() {
            document.querySelectorAll('.char-card.is-menu-open').forEach(c => c.classList.remove('is-menu-open'));
            document.querySelectorAll('.char-menu.is-open').forEach(m => {
                m.classList.remove('is-open');
                const b = m.querySelector('.char-menu-btn'); if (b) b.setAttribute('aria-expanded', 'false');
            });
        }
        document.addEventListener('click', closeCharMenus);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCharMenus(); });
        // Pousse archivage / ordre vers Supabase quand les colonnes existent (voir « Archivage et ordre des personnages.sql »).
        // Sans la migration, l'appel est ignoré et tout reste local — aucun échec visible.
        function syncCharMetaCloud(id) {
            if (!window.SupaAuth || !window.SupaAuth.saveCharacterMeta) return;
            const m = metaOf(id);
            window.SupaAuth.saveCharacterMeta(id, { archived: !!m.archived, sort_order: m.order == null ? null : m.order });
        }
        // Reprend l'archivage / l'ordre venus du cloud, quand la migration a été appliquée.
        function hydrateCharMetaFromCloud(list) {
            if (!window.SupaAuth || !window.SupaAuth.charMetaColumns) return;
            list.forEach(c => {
                if (c.archived != null) metaOf(c.id).archived = !!c.archived;
                if (c.sort_order != null) metaOf(c.id).order = c.sort_order;
            });
            saveCharMeta();
        }

        function showArchivedChars() { const c = document.getElementById('char-show-archived'); return !!(c && c.checked); }

        function sortedCharacters(mode) {
            const arr = charactersList.slice();
            const byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' });
            if (mode === 'name') arr.sort(byName);
            else if (mode === 'level') arr.sort((a, b) => (b.level || 1) - (a.level || 1) || byName(a, b));
            else if (mode === 'recent') arr.sort((a, b) => (metaOf(b.id).lastOpened || 0) - (metaOf(a.id).lastOpened || 0));
            else if (mode === 'custom') arr.sort((a, b) => {
                const oa = metaOf(a.id).order, ob = metaOf(b.id).order;
                return (oa == null ? 1e9 : oa) - (ob == null ? 1e9 : ob);
            });
            // 'created' (défaut) : on garde l'ordre naturel de dnd-character-list
            return arr;
        }

        // Fige l'ordre affiché comme ordre personnalisé, pour que les flèches partent du visuel courant.
        function seedCustomOrder(list) { list.forEach((c, i) => { metaOf(c.id).order = i; }); saveCharMeta(); }

        function moveCharacter(id, dir) {
            const mode = DB.get(CHAR_SORT_KEY) || 'created';
            const visible = sortedCharacters(mode).filter(c => showArchivedChars() || !metaOf(c.id).archived);
            const i = visible.findIndex(c => c.id === id);
            const j = i + dir;
            if (i < 0 || j < 0 || j >= visible.length) return;
            seedCustomOrder(visible);                                 // fige l'ordre courant…
            const a = metaOf(visible[i].id), b = metaOf(visible[j].id);
            const tmp = a.order; a.order = b.order; b.order = tmp;     // …puis échange les deux voisins
            syncCharMetaCloud(visible[i].id); syncCharMetaCloud(visible[j].id);
            saveCharMeta();
            // Réordonner à la main bascule forcément en mode « personnalisé »
            const sel = document.getElementById('char-sort-select');
            if (sel && sel.value !== 'custom') { sel.value = 'custom'; }
            DB.set(CHAR_SORT_KEY, 'custom');
            renderCharacterList();
        }

        async function duplicateCharacter(src) {
            const newName = (src.name || 'Personnage') + ' (copie)';
            let newId;
            if (window.SupaAuth?.currentUser) {
                const created = await window.SupaAuth.createCharacter(newName);
                if (!created) { alert('Erreur lors de la duplication.'); return; }
                newId = created.id;
                const data = await window.SupaAuth.loadCharacterData(src.id);
                const entries = Object.entries(data).map(([key, value]) => ({ key, value }));
                // Le nom stocké dans la fiche doit suivre la copie, pas rester celui de l'original.
                const iName = entries.findIndex(e => e.key === 'dnd-sheet-char-name');
                if (iName >= 0) entries[iName].value = newName;
                else entries.push({ key: 'dnd-sheet-char-name', value: newName });
                try { await window.SupaAuth.saveKeys(newId, entries); } catch (e) { console.warn('duplicateCharacter:', e); }
                entries.forEach(({ key, value }) => DB.set(newId + '_' + key, value));
                try { await window.SupaAuth.updateCharacterMeta(newId, { level: src.level || 1, class: src.class || '' }); } catch (e) {}
            } else {
                newId = 'char_' + Date.now();
                DB.keys().forEach(k => {
                    if (!k.startsWith(src.id + '_')) return;
                    DB.set(newId + '_' + k.slice(src.id.length + 1), DB.get(k));
                });
                DB.set(newId + '_dnd-sheet-char-name', newName);
            }
            charactersList.push({ id: newId, name: newName, level: src.level || 1, class: src.class || '' });
            DB.set('dnd-character-list', JSON.stringify(charactersList));
            if (metaOf(src.id).archived) metaOf(newId).archived = true;   // la copie d'un archivé reste archivée
            saveCharMeta();
            renderCharacterList();
            if (window.showAppToast) window.showAppToast('📄 « ' + newName + ' » créé');
        }

        function renderCharacterList() {
            const listDiv = document.getElementById('character-list');
            if (!listDiv) return;
            const mode = DB.get(CHAR_SORT_KEY) || 'created';
            const sel = document.getElementById('char-sort-select'); if (sel) sel.value = mode;

            const all = sortedCharacters(mode);
            const archivedCount = all.filter(c => metaOf(c.id).archived).length;
            const visible = all.filter(c => showArchivedChars() || !metaOf(c.id).archived);

            // La case « afficher les archivés » ne sert à rien tant qu'aucun perso ne l'est.
            const wrap = document.getElementById('char-show-archived-wrap');
            if (wrap) wrap.classList.toggle('hidden', archivedCount === 0);
            const cnt = document.getElementById('char-archived-count');
            if (cnt) cnt.textContent = archivedCount ? ' (' + archivedCount + ')' : '';

            listDiv.innerHTML = '';
            if (!visible.length) {
                listDiv.innerHTML = charactersList.length
                    ? "<p style='text-align:center; font-style:italic;'>Tous tes personnages sont archivés.</p>"
                    : "<p style='text-align:center; font-style:italic;'>Aucun personnage. Créez-en un !</p>";
                return;
            }
            visible.forEach((c, idx) => {
                const archived = !!metaOf(c.id).archived;
                const card = document.createElement('div');
                card.className = 'char-card' + (archived ? ' is-archived' : '');
                // Vignette du perso : l'avatar est stocké sous `{charId}_dnd-avatar`
                // (chargé en localStorage pour local ET Supabase → dispo dès l'accueil).
                const avatarSrc = DB.get(c.id + '_dnd-avatar');
                const thumb = document.createElement('div'); thumb.className = 'char-card-avatar';
                if (avatarSrc && avatarSrc !== 'undefined') { thumb.style.backgroundImage = `url("${avatarSrc}")`; }
                else { thumb.classList.add('is-empty'); thumb.textContent = (c.name || '?').trim().charAt(0).toUpperCase() || '🧝'; }

                const info = document.createElement('div'); info.className = 'char-info';
                info.innerHTML = `<span class="char-name">${escChar(c.name)}</span>`
                    + `<span class="char-sub">Niveau ${c.level || 1}${c.class ? ' · ' + escChar(c.class) : ''}${archived ? ' · archivé' : ''}</span>`;

                const openChar = async () => {
                    metaOf(c.id).lastOpened = Date.now(); saveCharMeta();
                    DB.set('dnd-active-char', c.id);
                    if (window.SupaAuth?.currentUser && window.loadCharacterDataIntoLocalStorage) { await window.loadCharacterDataIntoLocalStorage(c.id); }
                    location.reload();
                };
                // La carte entière ouvre le personnage : ouvrir = 1 clic.
                card.onclick = openChar;

                const actions = document.createElement('div'); actions.className = 'char-actions';

                // Les flèches n'apparaissent qu'en mode « Ordre personnalisé » : ailleurs
                // elles n'auraient aucun sens, et elles encombraient la carte pour rien.
                if (mode === 'custom') {
                    const arrow = (label, title, dir, disabled) => {
                        const b = document.createElement('button');
                        b.type = 'button'; b.className = 'char-act char-act-move';
                        b.innerHTML = label; b.title = title; b.disabled = disabled;
                        b.onclick = (e) => { e.stopPropagation(); moveCharacter(c.id, dir); };
                        return b;
                    };
                    actions.appendChild(arrow('▲', 'Monter', -1, idx === 0));
                    actions.appendChild(arrow('▼', 'Descendre', 1, idx === visible.length - 1));
                }

                // Tout le reste tient derrière un seul bouton « ⋯ » : la carte reste lisible,
                // et chaque action se fait en 2 clics.
                const menuWrap = document.createElement('div'); menuWrap.className = 'char-menu';
                const menuBtn = document.createElement('button');
                menuBtn.type = 'button'; menuBtn.className = 'char-act char-menu-btn';
                menuBtn.innerHTML = '⋯'; menuBtn.title = 'Actions'; menuBtn.setAttribute('aria-haspopup', 'true'); menuBtn.setAttribute('aria-expanded', 'false');
                const menu = document.createElement('div'); menu.className = 'char-menu-pop';

                const addItem = (label, fn, cls) => {
                    const b = document.createElement('button');
                    b.type = 'button'; b.className = 'char-menu-item' + (cls ? ' ' + cls : '');
                    b.textContent = label;
                    b.onclick = (e) => { e.stopPropagation(); closeCharMenus(); fn(); };
                    menu.appendChild(b);
                };
                addItem('📄  Dupliquer', () => duplicateCharacter(c));
                addItem(archived ? '📂  Désarchiver' : '🗄️  Archiver', () => {
                    metaOf(c.id).archived = !archived; saveCharMeta(); syncCharMetaCloud(c.id); renderCharacterList();
                });
                addItem('🗑  Supprimer', async () => {
                    if (!confirm(`Supprimer définitivement ${c.name} ?\nCette action est irréversible.`)) return;
                    if (window.SupaAuth?.currentUser) { await window.SupaAuth.deleteCharacter(c.id); }
                    charactersList = charactersList.filter(char => char.id !== c.id);
                    DB.set('dnd-character-list', JSON.stringify(charactersList));
                    DB.keys().forEach(k => { if (k.startsWith(c.id + '_')) DB.remove(k); });
                    delete charMeta[c.id]; saveCharMeta();
                    renderCharacterList();
                }, 'is-danger');

                menuBtn.onclick = (e) => {
                    e.stopPropagation();
                    const wasOpen = menuWrap.classList.contains('is-open');
                    closeCharMenus();
                    if (!wasOpen) { menuWrap.classList.add('is-open'); card.classList.add('is-menu-open'); menuBtn.setAttribute('aria-expanded', 'true'); }
                };
                menuWrap.appendChild(menuBtn); menuWrap.appendChild(menu);
                actions.appendChild(menuWrap);

                card.appendChild(thumb); card.appendChild(info); card.appendChild(actions);
                listDiv.appendChild(card);
            });
        }

        const charSortSelect = document.getElementById('char-sort-select');
        if (charSortSelect) charSortSelect.addEventListener('change', (e) => { DB.set(CHAR_SORT_KEY, e.target.value); renderCharacterList(); });
        const charShowArchived = document.getElementById('char-show-archived');
        if (charShowArchived) charShowArchived.addEventListener('change', renderCharacterList);
        renderCharacterList();
        // auth.js appelle ce hook après avoir chargé la liste des persos depuis le cloud.
        // Il y était invoqué mais n'était défini nulle part : la liste ne se rafraîchissait
        // donc jamais après connexion (il fallait recharger la page à la main).
        window.renderHomeScreen = () => {
            try {
                const raw = DB.get('dnd-character-list');
                const parsed = (raw && raw !== 'undefined') ? JSON.parse(raw) : [];
                if (Array.isArray(parsed)) { charactersList = parsed; hydrateCharMetaFromCloud(parsed); }
            } catch (e) {}
            renderCharacterList();
        };
    } else { 
        let quillNewJournal = new Quill('#new-journal-content', { theme: 'snow' });
        let quillNewSpell = new Quill('#new-spell-desc', { theme: 'snow' });
        let quillEditJournal = null;

        if(homeScreen) homeScreen.classList.add('hidden'); if(appScreen) appScreen.classList.remove('hidden'); 

        document.querySelectorAll('.btn-close-modal').forEach(btn => { btn.addEventListener('click', (e) => e.target.closest('.modal-overlay').classList.add('hidden')); });

        const ALL_WIDGETS = ['widget-rests', 'widget-concentration', 'widget-inspiration', 'widget-proficiency', 'widget-stats', 'widget-appearance', 'widget-traits', 'widget-training', 'widget-combat', 'widget-hp', 'widget-attacks', 'widget-currency', 'widget-inventory', 'widget-companion', 'widget-quests', 'widget-magic-stats', 'widget-abilities', 'widget-spells', 'widget-prepared-spells', 'widget-macros', 'widget-notes', 'widget-calculator'];
        
        function safeStoreAllWidgets() { const storage = document.getElementById('widget-storage'); ALL_WIDGETS.forEach(wId => { const w = document.getElementById(wId); if(w && w.parentNode !== storage) { storage.appendChild(w); } }); }

        document.body.addEventListener('click', (e) => {
            const header = e.target.closest('.collapsible-header'); if(!header) return;
            if(e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.classList.contains('btn-icon')) return;
            if(e.target.closest('.trait-card')) return; 
            e.preventDefault(); const content = header.nextElementSibling; if(!content || !content.classList.contains('collapsible-content')) return;
            const icon = header.querySelector('.collapse-icon'); content.classList.toggle('collapsed'); if(icon) icon.textContent = content.classList.contains('collapsed') ? '▶' : '▼';
        });

        const layoutSelector = document.getElementById('layout-selector'); const layoutTabsContainer = document.getElementById('layout-tabs-container'); const layoutClassicContainer = document.getElementById('layout-classic-container'); const layoutCustomContainer = document.getElementById('layout-custom-container'); const btnEditCustom = document.getElementById('btn-edit-custom'); let isEditMode = false;
        
        const DEFAULT_CLASSIC_LAYOUT = { 'col-left': ['widget-proficiency', 'widget-inspiration', 'widget-concentration', 'widget-stats', 'widget-training', 'widget-quests'], 'col-center': ['widget-combat', 'widget-hp', 'widget-rests', 'widget-traits', 'widget-attacks', 'widget-inventory', 'widget-currency', 'widget-companion'], 'col-right': ['widget-magic-stats', 'widget-spells', 'widget-prepared-spells', 'widget-abilities', 'widget-macros', 'widget-calculator'], 'col-bottom': ['widget-appearance', 'widget-notes'] };
        const DEFAULT_TABS_LAYOUT = { 'tab-strict-gen': ['widget-proficiency', 'widget-concentration', 'widget-inspiration', 'widget-stats', 'widget-rests', 'widget-appearance', 'widget-traits', 'widget-training', 'widget-companion'], 'tab-strict-com': ['widget-combat', 'widget-hp', 'widget-attacks', 'widget-currency', 'widget-inventory'], 'tab-strict-mag': ['widget-magic-stats', 'widget-macros', 'widget-abilities', 'widget-spells', 'widget-prepared-spells', 'widget-calculator'], 'tab-strict-not': ['widget-quests', 'widget-notes'] };

        // ===== AFFICHAGE TÉLÉPHONE (≤700px) : une section à la fois + barre de navigation basse =====
        const MOBILE_LAYOUT = {
            'mob-sec-perso':  ['widget-proficiency', 'widget-inspiration', 'widget-concentration', 'widget-stats', 'widget-traits', 'widget-training', 'widget-appearance'],
            'mob-sec-combat': ['widget-hp', 'widget-combat', 'widget-rests', 'widget-attacks', 'widget-macros', 'widget-calculator'],
            'mob-sec-sac':    ['widget-inventory', 'widget-currency', 'widget-companion'],
            'mob-sec-magie':  ['widget-magic-stats', 'widget-prepared-spells', 'widget-spells', 'widget-abilities'],
            'mob-sec-notes':  ['widget-quests', 'widget-notes']
        };
        // Modules repliés au premier affichage mobile (désature l'écran ; l'utilisateur peut les rouvrir)
        const MOBILE_START_COLLAPSED = ['widget-training', 'widget-appearance', 'widget-macros', 'widget-calculator'];
        const mobileMedia = window.matchMedia('(max-width: 700px)');
        function isMobileView() { return mobileMedia.matches; }
        let mobileCollapsedOnce = false;

        function switchMobileTab(sec) {
            if (!MOBILE_LAYOUT['mob-sec-' + sec]) sec = 'perso';
            setStore('dnd-mobile-tab', sec, false);
            document.querySelectorAll('#layout-mobile-container .mob-section').forEach(s => s.classList.toggle('active', s.dataset.msec === sec));
            document.querySelectorAll('#mobile-nav .mob-tab').forEach(b => b.classList.toggle('active', b.dataset.msec === sec));
            window.scrollTo({ top: 0 });
        }
        window.__switchMobileTab = switchMobileTab;

        function updateMobileVitals() {
            const fill = document.getElementById('mob-vitals-fill'); if (!fill) return;
            const current = parseInt(document.getElementById('hp-current')?.value) || 0;
            const maxRaw = parseInt(document.getElementById('hp-max')?.value) || 0;
            const temp = parseInt(document.getElementById('hp-temp')?.value) || 0;
            const ratio = maxRaw > 0 ? Math.max(0, Math.min(1, current / maxRaw)) : 0;
            fill.style.width = (ratio * 100) + '%';
            fill.classList.remove('hp-mid', 'hp-low');
            if (maxRaw > 0 && ratio <= 0.25) fill.classList.add('hp-low');
            else if (maxRaw > 0 && ratio <= 0.5) fill.classList.add('hp-mid');
            const text = document.getElementById('mob-vitals-text');
            if (text) text.textContent = maxRaw > 0 ? `${current}/${maxRaw}${temp > 0 ? ' +' + temp : ''}` : '– / –';
            const ca = document.getElementById('mob-vitals-ca-val');
            if (ca) ca.textContent = document.getElementById('armor-class')?.value || '–';
        }

        function renderMobileSheet() {
            const container = document.getElementById('layout-mobile-container'); if (!container) return;
            container.classList.remove('hidden');
            for (const [secId, widgetList] of Object.entries(MOBILE_LAYOUT)) {
                const secEl = document.getElementById(secId); if (!secEl) continue;
                widgetList.forEach(wId => { const w = document.getElementById(wId); if (w) secEl.appendChild(w); });
            }
            if (!mobileCollapsedOnce) {
                mobileCollapsedOnce = true;
                MOBILE_START_COLLAPSED.forEach(wId => {
                    const w = document.getElementById(wId); if (!w) return;
                    const content = w.querySelector('.collapsible-content'); const icon = w.querySelector('.collapse-icon');
                    if (content && !content.classList.contains('collapsed')) { content.classList.add('collapsed'); if (icon) icon.textContent = '▶'; }
                });
            }
            switchMobileTab(getStore('dnd-mobile-tab', false) || 'perso');
            updateMobileVitals();
        }

        function applyWidgetSizes() { ALL_WIDGETS.forEach(wId => { const el = document.getElementById(wId); if(el) { el.classList.remove('widget-full', 'widget-half', 'widget-third'); if(['widget-inspiration', 'widget-concentration', 'widget-proficiency'].includes(wId)) { el.classList.add('widget-third'); } else { el.classList.add('widget-full'); } } }); }

        let customProfiles = []; try { customProfiles = JSON.parse(DB.get('dnd-global-profiles')) || []; } catch(e) { customProfiles = []; }

        function updateLayoutSelectorOptions() { if(!layoutSelector) return; const currentVal = getStore('dnd-layout-mode', false) || 'classic'; layoutSelector.innerHTML = `<option value="classic">📜 Mode Classique</option><option value="tabs">📑 Mode Onglets</option><option value="custom">🧩 Mode Personnalisé (Brouillon)</option>`; customProfiles.forEach(p => { let opt = document.createElement('option'); opt.value = p.id; opt.textContent = `💾 Profil: ${p.name}`; layoutSelector.appendChild(opt); }); let found = Array.from(layoutSelector.options).some(o => o.value === currentVal); layoutSelector.value = found ? currentVal : 'classic'; }

        const btnSaveAsProfile = document.getElementById('btn-save-as-profile'); if(btnSaveAsProfile) { btnSaveAsProfile.addEventListener('click', () => { let name = prompt("Donnez un nom à ce profil :"); if(name && name.trim() !== '') { let newProf = { id: 'prof_' + Date.now(), name: name.trim(), layout: JSON.parse(JSON.stringify(customLayout)) }; customProfiles.push(newProf); DB.set('dnd-global-profiles', JSON.stringify(customProfiles)); updateLayoutSelectorOptions(); layoutSelector.value = newProf.id; applyLayout(newProf.id); } }); }
        const btnRenameProfile = document.getElementById('btn-rename-profile'); if(btnRenameProfile) { btnRenameProfile.addEventListener('click', () => { let selValue = layoutSelector.value; let prof = customProfiles.find(p => p.id === selValue); if(prof) { let newName = prompt("Nouveau nom :", prof.name); if(newName && newName.trim() !== '') { prof.name = newName.trim(); DB.set('dnd-global-profiles', JSON.stringify(customProfiles)); updateLayoutSelectorOptions(); } } }); }
        const btnDeleteProfile = document.getElementById('btn-delete-profile'); if(btnDeleteProfile) { btnDeleteProfile.addEventListener('click', () => { let selValue = layoutSelector.value; if(confirm("Supprimer ce profil ?")) { customProfiles = customProfiles.filter(p => p.id !== selValue); DB.set('dnd-global-profiles', JSON.stringify(customProfiles)); updateLayoutSelectorOptions(); applyLayout('classic'); } }); }

        let customLayout = []; let activeCustomTabId = null; let managerActiveTabId = null; let hiddenCustomWidgets = [];
        function syncHiddenWidgets() { let used = []; customLayout.forEach(t => used.push(...t.col1, ...t.col2, ...t.col3)); hiddenCustomWidgets = ALL_WIDGETS.filter(w => !used.includes(w)); }

        function renderCustomSheet() { safeStoreAllWidgets(); const nav = document.getElementById('custom-tabs-nav'); if(!nav) return; nav.innerHTML = ''; if (customLayout.length <= 1) { nav.style.display = 'none'; } else { nav.style.display = 'flex'; customLayout.forEach(tab => { let btn = document.createElement('button'); btn.className = `tab-btn-strict ${tab.id === activeCustomTabId ? 'active' : ''}`; btn.textContent = tab.name; btn.onclick = () => { activeCustomTabId = tab.id; renderCustomSheet(); }; nav.appendChild(btn); }); } let activeTab = customLayout.find(t => t.id === activeCustomTabId); if(!activeTab) { activeTab = customLayout[0]; activeCustomTabId = activeTab.id; } const c1 = document.getElementById('custom-col-1'); c1.innerHTML = ''; const c2 = document.getElementById('custom-col-2'); c2.innerHTML = ''; const c3 = document.getElementById('custom-col-3'); c3.innerHTML = ''; activeTab.col1.forEach(wId => { let w = document.getElementById(wId); if(w) c1.appendChild(w); }); activeTab.col2.forEach(wId => { let w = document.getElementById(wId); if(w) c2.appendChild(w); }); activeTab.col3.forEach(wId => { let w = document.getElementById(wId); if(w) c3.appendChild(w); }); applyWidgetSizes(); }

        function renderManager() { syncHiddenWidgets(); const tabsList = document.getElementById('manager-tabs-list'); if(!tabsList) return; tabsList.innerHTML = ''; customLayout.forEach(tab => { let div = document.createElement('div'); div.style.display = 'flex'; div.style.alignItems = 'center'; div.style.gap = '5px'; div.style.background = tab.id === managerActiveTabId ? 'var(--primary-color)' : 'rgba(0,0,0,0.1)'; div.style.color = tab.id === managerActiveTabId ? 'white' : 'var(--text-color)'; div.style.padding = '5px 10px'; div.style.borderRadius = '5px'; let input = document.createElement('input'); input.value = tab.name; input.style.border = 'none'; input.style.background = 'transparent'; input.style.color = 'inherit'; input.style.fontWeight = 'bold'; input.style.width = '120px'; input.onchange = (e) => { tab.name = e.target.value.trim() || 'Onglet'; saveCustomLayout(); renderManager(); renderCustomSheet(); }; div.appendChild(input); let btnSelect = document.createElement('button'); btnSelect.innerHTML = '⚙️'; btnSelect.className = 'btn-small'; btnSelect.style.background = 'transparent'; btnSelect.onclick = () => { managerActiveTabId = tab.id; renderManager(); }; div.appendChild(btnSelect); if (customLayout.length > 1) { let btnDel = document.createElement('button'); btnDel.innerHTML = 'X'; btnDel.className = 'btn-small'; btnDel.style.background = '#e74c3c'; btnDel.onclick = () => { if(confirm(`Supprimer l'onglet "${tab.name}" ?`)) { customLayout = customLayout.filter(t => t.id !== tab.id); if(managerActiveTabId === tab.id) managerActiveTabId = customLayout[0].id; if(activeCustomTabId === tab.id) activeCustomTabId = customLayout[0].id; saveCustomLayout(); renderManager(); renderCustomSheet(); } }; div.appendChild(btnDel); } tabsList.appendChild(div); }); let activeTab = customLayout.find(t => t.id === managerActiveTabId); if(!activeTab) { activeTab = customLayout[0]; managerActiveTabId = activeTab.id; } ['col1', 'col2', 'col3'].forEach(colName => { const colContainer = document.getElementById(`manager-${colName}-list`); if(!colContainer) return; colContainer.innerHTML = ''; activeTab[colName].forEach((wId, index) => { let prettyName = wId.replace('widget-', '').toUpperCase(); colContainer.innerHTML += `<div class="manager-widget-row" style="display:flex; justify-content:space-between; align-items:center; padding:4px 8px; border-radius:4px; font-size:0.8rem;"><span class="manager-widget-name" style="font-weight:bold;">${prettyName}</span><div style="display:flex; gap:3px;"><button class="btn-small" style="background:#7f8c8d; padding:2px 6px;" onclick="window.moveCustomWidget('${managerActiveTabId}', '${colName}', ${index}, -1)" ${index === 0 ? 'disabled style="opacity:0.5;"' : ''}>▲</button><button class="btn-small" style="background:#7f8c8d; padding:2px 6px;" onclick="window.moveCustomWidget('${managerActiveTabId}', '${colName}', ${index}, 1)" ${index === activeTab[colName].length - 1 ? 'disabled style="opacity:0.5;"' : ''}>▼</button><button class="btn-small" style="background:#e74c3c; padding:2px 6px;" onclick="window.removeCustomWidget('${managerActiveTabId}', '${colName}', ${index})">X</button></div></div>`; }); }); const sel = document.getElementById('manager-hidden-select'); if(sel) { sel.innerHTML = hiddenCustomWidgets.length === 0 ? '<option value="">(Aucun module)</option>' : hiddenCustomWidgets.map(w => `<option value="${w}">${w.replace('widget-', '').toUpperCase()}</option>`).join(''); } }

        window.moveCustomWidget = (tabId, colName, index, dir) => { let tab = customLayout.find(t => t.id === tabId); let arr = tab[colName]; if (dir === -1 && index > 0) [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]; else if (dir === 1 && index < arr.length - 1) [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]; saveCustomLayout(); renderManager(); renderCustomSheet(); };
        window.removeCustomWidget = (tabId, colName, index) => { let tab = customLayout.find(t => t.id === tabId); tab[colName].splice(index, 1); saveCustomLayout(); renderManager(); renderCustomSheet(); };
        window.addCustomWidget = (colName) => { const sel = document.getElementById('manager-hidden-select'); if(!sel || !sel.value) return; let tab = customLayout.find(t => t.id === managerActiveTabId); tab[colName].push(sel.value); saveCustomLayout(); renderManager(); renderCustomSheet(); };
        let btnAddCol1 = document.getElementById('btn-manager-add-col1'); if(btnAddCol1) btnAddCol1.onclick = () => addCustomWidget('col1'); let btnAddCol2 = document.getElementById('btn-manager-add-col2'); if(btnAddCol2) btnAddCol2.onclick = () => addCustomWidget('col2'); let btnAddCol3 = document.getElementById('btn-manager-add-col3'); if(btnAddCol3) btnAddCol3.onclick = () => addCustomWidget('col3');
        let btnAddTab = document.getElementById('btn-manager-add-tab'); if(btnAddTab) { btnAddTab.onclick = () => { let newTab = { id: 'tab_' + Date.now(), name: 'Nouvel Onglet', col1: [], col2: [], col3: [] }; customLayout.push(newTab); managerActiveTabId = newTab.id; saveCustomLayout(); renderManager(); renderCustomSheet(); }; }
        
        const btnResetCustomLayout = document.getElementById('btn-reset-custom-layout');
        if (btnResetCustomLayout) {
            btnResetCustomLayout.addEventListener('click', () => {
                if (confirm("Réinitialiser cette disposition personnalisée à l'état par défaut ?")) {
                    customLayout = [{
                        id: 'tab_custom_default',
                        name: 'Ma Fiche',
                        col1: [...DEFAULT_CLASSIC_LAYOUT['col-left']],
                        col2: [...DEFAULT_CLASSIC_LAYOUT['col-center']],
                        col3: [...DEFAULT_CLASSIC_LAYOUT['col-right']]
                    }];
                    managerActiveTabId = customLayout[0].id;
                    activeCustomTabId = customLayout[0].id;
                    saveCustomLayout();
                    renderManager();
                    renderCustomSheet();
                }
            });
        }
        
        function saveCustomLayout() { let mode = getStore('dnd-layout-mode', false) || 'classic'; if (mode.startsWith('prof_')) { let prof = customProfiles.find(p => p.id === mode); if (prof) { prof.layout = customLayout; DB.set('dnd-global-profiles', JSON.stringify(customProfiles)); } } else { setStore('dnd-custom-layout', customLayout); } }
        if(btnEditCustom) btnEditCustom.addEventListener('click', () => { isEditMode = !isEditMode; const manager = document.getElementById('custom-layout-manager'); if(manager) manager.classList.toggle('hidden', !isEditMode); if(isEditMode) { renderManager(); btnEditCustom.textContent = "✅ Terminer Édition"; } else { btnEditCustom.textContent = "⚙️ Modifier Disposition"; } });
        updateLayoutSelectorOptions(); 

        function applyLayout(mode, opts) {
            setStore('dnd-layout-mode', mode, false); isEditMode = false; const profileActions = document.getElementById('profile-actions'); if(profileActions) { if(mode.startsWith('prof_')) profileActions.classList.remove('hidden'); else profileActions.classList.add('hidden'); }
            if(document.getElementById('custom-layout-manager')) document.getElementById('custom-layout-manager').classList.add('hidden'); if(btnEditCustom) btnEditCustom.textContent = "⚙️ Modifier Disposition";
            if(layoutTabsContainer) layoutTabsContainer.classList.add('hidden'); if(layoutClassicContainer) layoutClassicContainer.classList.add('hidden'); if(layoutCustomContainer) layoutCustomContainer.classList.add('hidden');
            safeStoreAllWidgets(); applyWidgetSizes();

            // Téléphone : l'affichage mobile dédié remplace les modes bureau (le mode choisi reste mémorisé pour le grand écran)
            const mobile = isMobileView() && !(opts && opts.forceDesktop);
            document.body.classList.toggle('mobile-sheet', mobile);
            if (mobile) { renderMobileSheet(); if(settingsDropdown) settingsDropdown.classList.add('hidden'); return; }
            const mobContainer = document.getElementById('layout-mobile-container'); if (mobContainer) mobContainer.classList.add('hidden');

            if (mode === 'tabs' && layoutTabsContainer) { layoutTabsContainer.classList.remove('hidden'); for (const [containerId, widgetList] of Object.entries(DEFAULT_TABS_LAYOUT)) { const container = document.getElementById(containerId); if (container) { widgetList.forEach(widgetId => { const w = document.getElementById(widgetId); if (w) container.appendChild(w); }); } } switchStrictTab('tab-strict-gen');
            } else if (mode === 'classic' && layoutClassicContainer) { layoutClassicContainer.classList.remove('hidden'); for (const [containerId, widgetList] of Object.entries(DEFAULT_CLASSIC_LAYOUT)) { const container = document.getElementById(containerId); if (container) { widgetList.forEach(widgetId => { const w = document.getElementById(widgetId); if (w) container.appendChild(w); }); } }
            } else if (mode === 'custom' || mode.startsWith('prof_')) { layoutCustomContainer.classList.remove('hidden'); if (mode.startsWith('prof_')) { let prof = customProfiles.find(p => p.id === mode); if (prof) { customLayout = prof.layout; } else { applyLayout('classic'); return; } } else { let savedBrouillon = getStore('dnd-custom-layout'); if (savedBrouillon && Array.isArray(savedBrouillon)) { customLayout = savedBrouillon; } else { customLayout = [{ id: 'tab_custom_default', name: 'Ma Fiche', col1: [...DEFAULT_CLASSIC_LAYOUT['col-left']], col2: [...DEFAULT_CLASSIC_LAYOUT['col-center']], col3: [...DEFAULT_CLASSIC_LAYOUT['col-right']] }]; } } if (!customLayout.find(t => t.id === activeCustomTabId)) { activeCustomTabId = customLayout[0].id; managerActiveTabId = customLayout[0].id; } renderCustomSheet(); }
            if(settingsDropdown) settingsDropdown.classList.add('hidden');
        }
        if(layoutSelector) layoutSelector.addEventListener('change', (e) => applyLayout(e.target.value));

        // Câblage de l'affichage téléphone : onglets bas, bandeau vital, chevron d'en-tête, bascule au redimensionnement
        document.querySelectorAll('#mobile-nav .mob-tab').forEach(btn => btn.addEventListener('click', () => switchMobileTab(btn.dataset.msec)));
        const mobVitalsBtn = document.getElementById('mob-vitals');
        if (mobVitalsBtn) mobVitalsBtn.addEventListener('click', () => switchMobileTab('combat'));
        const mobHeaderToggle = document.getElementById('mob-header-toggle');
        if (mobHeaderToggle) mobHeaderToggle.addEventListener('click', () => {
            const header = document.querySelector('.sheet-header'); if (!header) return;
            const open = header.classList.toggle('mob-open');
            mobHeaderToggle.textContent = open ? '▴ Infos' : '▾ Infos';
        });
        document.getElementById('armor-class')?.addEventListener('input', updateMobileVitals);
        // Accordéon des caractéristiques (mobile) : « ▾ Compétences » déplie le bloc en pleine largeur, un seul ouvert à la fois
        document.body.addEventListener('click', (e) => {
            const btn = e.target.closest('.stat-expand'); if (!btn) return;
            const block = btn.closest('.attribute-block'); if (!block) return;
            const wasOpen = block.classList.contains('mob-open');
            document.querySelectorAll('.attribute-block.mob-open').forEach(b => {
                b.classList.remove('mob-open');
                const bb = b.querySelector('.stat-expand'); if (bb) bb.textContent = '▾ Compétences';
            });
            if (!wasOpen) {
                block.classList.add('mob-open');
                btn.textContent = '▴ Replier';
                block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
        const onMobileMediaChange = () => {
            applyLayout(getStore('dnd-layout-mode', false) || 'classic');
            // Resynchronise le lecteur de musique avec la préférence de l'écran courant (mobile = caché par défaut)
            const musicPref = isMobileView() ? (DB.get('dnd-show-music-player-mobile') || 'false') : (DB.get('dnd-show-music-player') || 'false');
            if (window.MusicPlayer) window.MusicPlayer.setVisible(musicPref === 'true', false);
            const musicToggle = document.getElementById('toggle-music-player'); if (musicToggle) musicToggle.checked = musicPref === 'true';
        };
        if (mobileMedia.addEventListener) mobileMedia.addEventListener('change', onMobileMediaChange);
        else if (mobileMedia.addListener) mobileMedia.addListener(onMobileMediaChange);
        // Filet : certains environnements (WebViews, émulation) ne délivrent pas l'event 'change' de matchMedia
        let mobileResizeTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(mobileResizeTimer);
            mobileResizeTimer = setTimeout(() => {
                if (isMobileView() !== document.body.classList.contains('mobile-sheet')) onMobileMediaChange();
            }, 150);
        });
        // Balayage gauche/droite (affichage téléphone) : change de section comme la barre basse.
        // Ignoré quand le geste démarre sur un élément interactif ou qui défile horizontalement.
        const MOBILE_TAB_ORDER = ['perso', 'combat', 'sac', 'magie', 'notes'];
        const SWIPE_IGNORE = 'input, textarea, select, canvas, table, [contenteditable="true"], .ql-editor, .category-tabs, .hp-bar-track, #mobile-nav, #dice-drawer, #btn-toggle-dice, .modal-overlay, #music-player-container, .avatar-crop-stage';
        let swipeX = 0, swipeY = 0, swipeT = 0, swipeOk = false;
        document.addEventListener('touchstart', (e) => {
            swipeOk = false;
            if (!document.body.classList.contains('mobile-sheet')) return;
            if (e.touches.length !== 1) return;                       // pincer-zoomer = pas un balayage
            if (e.target.closest && e.target.closest(SWIPE_IGNORE)) return;
            swipeOk = true; swipeX = e.touches[0].clientX; swipeY = e.touches[0].clientY; swipeT = Date.now();
        }, { passive: true });
        document.addEventListener('touchend', (e) => {
            if (!swipeOk) return; swipeOk = false;
            if (Date.now() - swipeT > 600) return;                    // geste trop lent = défilement
            const dx = e.changedTouches[0].clientX - swipeX;
            const dy = e.changedTouches[0].clientY - swipeY;
            if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
            const current = document.querySelector('#mobile-nav .mob-tab.active')?.dataset.msec || 'perso';
            const next = MOBILE_TAB_ORDER.indexOf(current) + (dx < 0 ? 1 : -1);
            if (next < 0 || next >= MOBILE_TAB_ORDER.length) return;
            switchMobileTab(MOBILE_TAB_ORDER[next]);
        }, { passive: true });
        function switchStrictTab(tabId) { document.querySelectorAll('.tab-btn-strict').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId)); document.querySelectorAll('#layout-tabs-container .tab-content').forEach(content => { content.classList.toggle('hidden', content.id !== tabId); content.classList.toggle('active', content.id === tabId); }); }
        document.querySelectorAll('.tab-btn-strict').forEach(btn => { btn.addEventListener('click', () => switchStrictTab(btn.dataset.tab)); });

        // ===== LANCEUR D'EXPRESSION DE DÉS (remplace l'ancienne calculatrice) =====
        // Comprend « 2d6+3 », « 8d6 », « 1d20+5 », « 4d6-1 », « 1d8+2d6+3 »…
        function rollExpression(raw) {
            const clean = String(raw || '').toLowerCase().replace(/\s+/g, '');
            if (!clean) return { error: 'Entre une expression (ex : 2d6+3).' };
            if (!/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/.test(clean)) return { error: 'Expression invalide (ex : 2d6+3).' };
            const parts = clean.match(/[+-]?(?:\d*d\d+|\d+)/g) || [];
            let total = 0; const bits = [];
            for (const part of parts) {
                const sign = part.startsWith('-') ? -1 : 1;
                const body = part.replace(/^[+-]/, '');
                if (body.includes('d')) {
                    const [nRaw, fRaw] = body.split('d');
                    const n = Math.min(parseInt(nRaw || '1', 10) || 1, 100);      // garde-fou : 100 dés max
                    const faces = parseInt(fRaw, 10);
                    if (!faces || faces < 2 || faces > 1000) return { error: 'Dé invalide : d' + fRaw };
                    const rolls = Array.from({ length: n }, () => Math.floor(Math.random() * faces) + 1);
                    total += sign * rolls.reduce((a, b) => a + b, 0);
                    bits.push((sign < 0 ? '−' : '') + n + 'd' + faces + ' [' + rolls.join(', ') + ']');
                } else {
                    const v = parseInt(body, 10) || 0;
                    total += sign * v;
                    bits.push((sign < 0 ? '−' : '+') + v);
                }
            }
            return { total, detail: bits.join(' ') };
        }
        function runExpression(expr) {
            const out = document.getElementById('expr-result'); if (!out) return;
            const res = rollExpression(expr);
            if (res.error) { out.innerHTML = `<span class="expr-err">⚠️ ${res.error}</span>`; return; }
            out.innerHTML = `<span class="expr-total">${res.total}</span><span class="expr-detail">${res.detail}</span>`;
            // Partagé avec la table si connecté à une session
            if (window.PlayerSession && window.PlayerSession.shareRoll) window.PlayerSession.shareRoll('🎲 ' + expr, res.total, res.detail, null);
            pushRollHistory('🎲 ' + expr, res.total, res.detail, null);
        }
        const exprInput = document.getElementById('expr-input');
        const btnExprRoll = document.getElementById('btn-expr-roll');
        if (btnExprRoll && exprInput) btnExprRoll.addEventListener('click', () => runExpression(exprInput.value));
        if (exprInput) exprInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runExpression(exprInput.value); } });

        // ===== HISTORIQUE DES JETS =====
        function pushRollHistory(name, total, detail, nat) {
            let hist = getStore('dnd-roll-history') || [];
            hist.unshift({ name, total, detail, nat, ts: Date.now() });
            if (hist.length > 40) hist = hist.slice(0, 40);
            setStore('dnd-roll-history', hist);
            renderRollHistory();
        }
        function renderRollHistory() {
            const list = document.getElementById('roll-history-list'); if (!list) return;
            const hist = getStore('dnd-roll-history') || [];
            if (!hist.length) { list.innerHTML = `<div class="roll-history-empty">Aucun jet pour l'instant.</div>`; return; }
            list.innerHTML = hist.map(h => {
                const cls = h.nat === 20 ? ' is-crit' : (h.nat === 1 ? ' is-fumble' : '');
                const t = new Date(h.ts); const hh = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
                return `<div class="roll-history-item${cls}"><span class="rh-name">${h.name}<span class="rh-detail"> — ${h.detail || ''}</span></span><span class="rh-total">${h.total}</span><span class="rh-detail">${hh}</span></div>`;
            }).join('');
        }
        const btnClearHist = document.getElementById('btn-clear-roll-history');
        if (btnClearHist) btnClearHist.addEventListener('click', () => { setStore('dnd-roll-history', []); renderRollHistory(); });

        const avatarInput = document.getElementById('avatar-file-input'); const avatarPreview = document.getElementById('main-avatar-preview'); const avatarHeader = document.getElementById('header-avatar'); const avatarPlaceholder = document.getElementById('avatar-placeholder');
        function loadAvatar() { const savedAvatar = getStore('dnd-avatar', false); if(savedAvatar && avatarPreview && avatarPlaceholder && avatarHeader) { avatarPreview.src = savedAvatar; avatarPreview.classList.remove('hidden'); avatarPlaceholder.classList.add('hidden'); avatarHeader.style.backgroundImage = `url("${savedAvatar}")`; } const rc = document.getElementById('btn-recrop-avatar'); if(rc) rc.style.display = savedAvatar ? '' : 'none'; }
        // Import d'un portrait : on ouvre d'abord la modale de recadrage (zoom + déplacement),
        // puis on enregistre le carré recadré comme avatar.
        function loadImageFileToCrop(file) { if(!file || !file.type.startsWith('image/')) return; const reader = new FileReader(); reader.onload = (event) => { const img = new Image(); img.onload = () => openAvatarCrop(img, true); img.src = event.target.result; }; reader.readAsDataURL(file); }
        if(avatarInput) { avatarInput.addEventListener('change', (e) => { loadImageFileToCrop(e.target.files[0]); e.target.value = ''; }); }

        // --- Portrait en PLEIN ÉCRAN : cliquer un avatar l'agrandit (bouton 📸 Changer pour la photo) ---
        function openPortraitFullscreen() {
            const src = getStore('dnd-avatar', false); if(!src) return false;
            const fs = document.getElementById('portrait-fullscreen'), img = document.getElementById('portrait-fs-img');
            if(!fs || !img) return false;
            img.src = src; fs.classList.remove('hidden');
            return true;
        }
        function closePortraitFullscreen() { const fs = document.getElementById('portrait-fullscreen'); if(fs) fs.classList.add('hidden'); }
        // Mini-avatar de l'en-tête → plein écran (ou sélecteur de photo s'il n'y a pas encore d'avatar).
        if(avatarHeader) avatarHeader.addEventListener('click', () => { if(!openPortraitFullscreen() && avatarInput) avatarInput.click(); });
        // Portrait du module Identité : le label ouvre le sélecteur → on l'intercepte si un avatar existe.
        if(avatarPreview) avatarPreview.addEventListener('click', (e) => { if(getStore('dnd-avatar', false)) { e.preventDefault(); e.stopPropagation(); openPortraitFullscreen(); } });
        const btnChangeAvatar = document.getElementById('btn-change-avatar');
        if(btnChangeAvatar && avatarInput) btnChangeAvatar.addEventListener('click', () => avatarInput.click());
        const portraitFs = document.getElementById('portrait-fullscreen');
        if(portraitFs) portraitFs.addEventListener('click', closePortraitFullscreen);   // clic n'importe où = fermer
        const portraitFsClose = document.getElementById('portrait-fs-close');
        if(portraitFsClose) portraitFsClose.addEventListener('click', (e) => { e.stopPropagation(); closePortraitFullscreen(); });
        // Glisser-déposer une image directement sur le portrait (module Identité).
        const avatarDropZone = document.querySelector('.avatar-upload-container');
        if(avatarDropZone) {
            ['dragenter','dragover'].forEach(ev => avatarDropZone.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); avatarDropZone.classList.add('drag-over'); }));
            ['dragleave','dragend'].forEach(ev => avatarDropZone.addEventListener(ev, (e) => { e.preventDefault(); avatarDropZone.classList.remove('drag-over'); }));
            avatarDropZone.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); avatarDropZone.classList.remove('drag-over'); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if(f) loadImageFileToCrop(f); });
        }
        // « Recadrer » : réajuste zoom/cadrage à partir de l'image SOURCE conservée (repli sur l'avatar rogné).
        const btnRecrop = document.getElementById('btn-recrop-avatar');
        if(btnRecrop) btnRecrop.addEventListener('click', () => { const src = getStore('dnd-avatar-src', false) || getStore('dnd-avatar', false); if(!src) return; const img = new Image(); img.onload = () => openAvatarCrop(img, false); img.src = src; });

        // ---- Contrôleur de recadrage d'avatar ----
        const avatarCropModal = document.getElementById('avatar-crop-modal');
        const cropCanvas = document.getElementById('avatar-crop-canvas');
        const cropZoom = document.getElementById('avatar-crop-zoom');
        let cropState = null;   // { img, base, scale, ox, oy, rot, newSource }
        // Dimensions du dessin de l'image à l'écran, en tenant compte de la rotation (90/270 = axes échangés).
        function cropEffDims() { const w = cropState.img.width * cropState.base * cropState.scale, h = cropState.img.height * cropState.base * cropState.scale; const swap = (cropState.rot % 180) !== 0; return { ew: swap ? h : w, eh: swap ? w : h, w, h }; }
        function clampCrop() { if(!cropState || !cropCanvas) return; const S = cropCanvas.width; const d = cropEffDims(); const maxX = Math.max(0, (d.ew - S) / 2), maxY = Math.max(0, (d.eh - S) / 2); cropState.ox = Math.max(-maxX, Math.min(maxX, cropState.ox)); cropState.oy = Math.max(-maxY, Math.min(maxY, cropState.oy)); }
        function drawCrop() { if(!cropState || !cropCanvas) return; const ctx = cropCanvas.getContext('2d'); const S = cropCanvas.width; const d = cropEffDims(); ctx.clearRect(0,0,S,S); ctx.fillStyle = '#1a1410'; ctx.fillRect(0,0,S,S); ctx.save(); ctx.translate(S/2 + cropState.ox, S/2 + cropState.oy); ctx.rotate((cropState.rot || 0) * Math.PI / 180); ctx.drawImage(cropState.img, -d.w/2, -d.h/2, d.w, d.h); ctx.restore(); }
        function openAvatarCrop(img, newSource) { if(!avatarCropModal || !cropCanvas) return; const S = cropCanvas.width; const base = Math.max(S / img.width, S / img.height); cropState = { img, base, scale: 1, ox: 0, oy: 0, rot: 0, newSource: !!newSource }; if(cropZoom) cropZoom.value = 100; clampCrop(); drawCrop(); avatarCropModal.classList.remove('hidden'); }
        function closeAvatarCrop() { if(avatarCropModal) avatarCropModal.classList.add('hidden'); cropState = null; }
        function saveAvatarDataUrl(dataUrl) { try { setStore('dnd-avatar', dataUrl, false); loadAvatar(); } catch(err) { alert("L'image est trop lourde à enregistrer."); } }
        if(cropZoom) cropZoom.addEventListener('input', () => { if(!cropState) return; cropState.scale = (parseInt(cropZoom.value, 10) || 100) / 100; clampCrop(); drawCrop(); });
        const btnCropRotate = document.getElementById('btn-avatar-crop-rotate');
        if(btnCropRotate) btnCropRotate.addEventListener('click', () => { if(!cropState) return; cropState.rot = ((cropState.rot || 0) + 90) % 360; clampCrop(); drawCrop(); });
        if(cropCanvas) {
            let dragging = false, lastX = 0, lastY = 0;
            cropCanvas.addEventListener('pointerdown', (ev) => { if(!cropState) return; dragging = true; lastX = ev.clientX; lastY = ev.clientY; try { cropCanvas.setPointerCapture(ev.pointerId); } catch(e){} });
            cropCanvas.addEventListener('pointermove', (ev) => { if(!dragging || !cropState) return; const r = cropCanvas.getBoundingClientRect(); const ratio = cropCanvas.width / (r.width || cropCanvas.width); cropState.ox += (ev.clientX - lastX) * ratio; cropState.oy += (ev.clientY - lastY) * ratio; lastX = ev.clientX; lastY = ev.clientY; clampCrop(); drawCrop(); });
            const endDrag = () => { dragging = false; };
            cropCanvas.addEventListener('pointerup', endDrag); cropCanvas.addEventListener('pointercancel', endDrag);
            cropCanvas.addEventListener('wheel', (ev) => { if(!cropState) return; ev.preventDefault(); const dir = ev.deltaY < 0 ? 1 : -1; let v = (parseInt(cropZoom.value, 10) || 100) + dir * 15; v = Math.max(100, Math.min(400, v)); if(cropZoom) cropZoom.value = v; cropState.scale = v / 100; clampCrop(); drawCrop(); }, { passive: false });
        }
        const btnCropClose = document.getElementById('btn-close-avatar-crop'); if(btnCropClose) btnCropClose.addEventListener('click', closeAvatarCrop);
        const btnCropCancel = document.getElementById('btn-avatar-crop-cancel'); if(btnCropCancel) btnCropCancel.addEventListener('click', closeAvatarCrop);
        // Conserve l'image source (rognée à 512px max) pour pouvoir re-recadrer plus tard sans réimporter.
        function storeAvatarSource(img) { try { const S = 512; const sc = Math.min(1, S / Math.max(img.width, img.height)); const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(img.width * sc)); cv.height = Math.max(1, Math.round(img.height * sc)); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); setStore('dnd-avatar-src', cv.toDataURL('image/jpeg', 0.82), false); } catch(e) {} }
        const btnCropConfirm = document.getElementById('btn-avatar-crop-confirm'); if(btnCropConfirm) btnCropConfirm.addEventListener('click', () => { if(!cropState || !cropCanvas) return; if(cropState.newSource) storeAvatarSource(cropState.img); try { saveAvatarDataUrl(cropCanvas.toDataURL('image/jpeg', 0.85)); } catch(err) { alert("Impossible d'enregistrer l'image."); } closeAvatarCrop(); });
        loadAvatar();

        const cbConcentration = document.getElementById('is-concentrating'); const concentrationGlow = document.getElementById('concentration-glow');
        function updateConcentrationUI() { if(!cbConcentration || !concentrationGlow || !avatarHeader) return; if(cbConcentration.checked) { document.body.classList.add('concentrating-mode'); concentrationGlow.classList.remove('hidden'); avatarHeader.classList.add('concentrating'); } else { document.body.classList.remove('concentrating-mode'); concentrationGlow.classList.add('hidden'); avatarHeader.classList.remove('concentrating'); } }
        if(cbConcentration) { cbConcentration.checked = getStore('dnd-is-concentrating', false) === 'true'; updateConcentrationUI(); cbConcentration.addEventListener('change', () => { setStore('dnd-is-concentrating', cbConcentration.checked, false); updateConcentrationUI(); }); }


        const btnToggleDice = document.getElementById('btn-toggle-dice'); const diceDrawer = document.getElementById('dice-drawer');
        if(btnToggleDice && diceDrawer) {
            // Glisser-déposer du bouton : pointer events → fonctionne à la souris ET au tactile (mobile/tablette).
            let isDraggingDiceBtn = false; let startY = 0, startX = 0, clickStartX = 0, clickStartY = 0; let startTop = 0, startLeft = 0;
            btnToggleDice.style.touchAction = 'none';
            btnToggleDice.addEventListener('pointerdown', (e) => { if(e.button != null && e.button !== 0) return; isDraggingDiceBtn = true; startX = e.clientX; startY = e.clientY; clickStartX = e.clientX; clickStartY = e.clientY; const rect = btnToggleDice.getBoundingClientRect(); startLeft = rect.left; startTop = rect.top; btnToggleDice.style.transition = 'none'; btnToggleDice.style.cursor = 'grabbing'; try { btnToggleDice.setPointerCapture(e.pointerId); } catch(_) {} });
            btnToggleDice.addEventListener('pointermove', (e) => { if(!isDraggingDiceBtn) return; let newLeft = startLeft + (e.clientX - startX); let newTop = startTop + (e.clientY - startY); newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - btnToggleDice.offsetWidth)); newTop = Math.max(0, Math.min(newTop, window.innerHeight - btnToggleDice.offsetHeight)); btnToggleDice.style.left = newLeft + 'px'; btnToggleDice.style.top = newTop + 'px'; btnToggleDice.style.right = 'auto'; });
            const endDiceBtnDrag = (e) => { if(!isDraggingDiceBtn) return; isDraggingDiceBtn = false; btnToggleDice.style.transition = 'top 0.3s, left 0.3s, background 0.2s'; btnToggleDice.style.cursor = 'grab'; try { btnToggleDice.releasePointerCapture(e.pointerId); } catch(_) {} if(Math.abs(e.clientX - clickStartX) < 6 && Math.abs(e.clientY - clickStartY) < 6) { diceDrawer.classList.toggle('open'); } else { const rect = btnToggleDice.getBoundingClientRect(); const isLeft = (rect.left + rect.width/2) < window.innerWidth / 2; if(isLeft) { btnToggleDice.style.left = '0px'; diceDrawer.classList.add('drawer-left'); diceDrawer.style.top = Math.max(0, rect.top - 20) + 'px'; } else { btnToggleDice.style.left = (window.innerWidth - btnToggleDice.offsetWidth) + 'px'; diceDrawer.classList.remove('drawer-left'); diceDrawer.style.top = Math.max(0, rect.top - 20) + 'px'; } setTimeout(() => { DB.set('dnd-dice-btn-y', btnToggleDice.style.top); DB.set('dnd-dice-btn-side', isLeft ? 'left' : 'right'); }, 350); } };
            btnToggleDice.addEventListener('pointerup', endDiceBtnDrag);
            btnToggleDice.addEventListener('pointercancel', endDiceBtnDrag);
            let savedDiceY = DB.get('dnd-dice-btn-y'); let savedDiceSide = DB.get('dnd-dice-btn-side');
            if(savedDiceY) { btnToggleDice.style.top = savedDiceY; btnToggleDice.style.right = 'auto'; if(savedDiceSide === 'left') { btnToggleDice.style.left = '0px'; diceDrawer.classList.add('drawer-left'); } else { btnToggleDice.style.left = (window.innerWidth - btnToggleDice.offsetWidth) + 'px'; diceDrawer.classList.remove('drawer-left'); } diceDrawer.style.top = (parseInt(savedDiceY) - 20) + 'px'; }
            window.addEventListener('resize', () => { if(diceDrawer.classList.contains('drawer-left')) return; btnToggleDice.style.left = (window.innerWidth - btnToggleDice.offsetWidth) + 'px'; });
        }

        let dicePool = []; const dicePoolDisplay = document.getElementById('dice-pool'); const quickToast = document.getElementById('quick-roll-toast');
        document.querySelectorAll('.btn-dice').forEach(btn => { btn.addEventListener('click', (e) => { dicePool.push(parseInt(e.target.getAttribute('data-faces'))); renderDicePool(); }); });
        function renderDicePool() { if(!dicePoolDisplay) return; dicePoolDisplay.innerHTML = ''; dicePool.forEach((faces, index) => { const dieDiv = document.createElement('div'); dieDiv.className = 'die-icon'; dieDiv.textContent = `d${faces}`; dieDiv.onclick = () => { dicePool.splice(index, 1); renderDicePool(); }; dicePoolDisplay.appendChild(dieDiv); }); }
        
        const btnToggleCurrency = document.getElementById('btn-toggle-currency');
        const currencyRules = document.getElementById('currency-inline-rules');
        if(btnToggleCurrency && currencyRules) {
            btnToggleCurrency.addEventListener('click', () => {
                currencyRules.classList.toggle('hidden');
            });
        }

        // ===== PLATEAU DE DÉS 3D (moteur physique @3d-dice/dice-box) =====
        let diceBox = null, diceBoxReady = false, diceBoxInitStarted = false, dice3dBlockedByFile = false, diceRolling = false;

        // --- Thèmes de dés 3D (10 couleurs + aléatoire + couleur perso) ---
        const DICE_THEMES = [
            { name: 'Cramoisi',  color: '#7A2828' },
            { name: 'Or',        color: '#C49B35' },
            { name: 'Émeraude',  color: '#1f8a4c' },
            { name: 'Saphir',    color: '#2563c9' },
            { name: 'Améthyste', color: '#7b3fa0' },
            { name: 'Rubis',     color: '#c0392b' },
            { name: 'Onyx',      color: '#2c2c34' },
            { name: 'Ivoire',    color: '#e8e0cc' },
            { name: 'Turquoise', color: '#16a3a3' },
            { name: 'Ambre',     color: '#e08a1e' },
        ];
        let diceThemeColor = DB.get('dnd-dice-theme-color') || '#7A2828';
        let diceThemeRandom = DB.get('dnd-dice-theme-random') === 'true';
        function currentDiceThemeColor() {
            if (diceThemeRandom) return DICE_THEMES[Math.floor(Math.random() * DICE_THEMES.length)].color;
            return diceThemeColor;
        }

        async function initDiceBox() {
            if (diceBoxInitStarted) return;
            diceBoxInitStarted = true;
            // Les modules ES (donc dice-box) ne se chargent jamais en ouverture fichier local.
            if (location.protocol === 'file:') {
                dice3dBlockedByFile = true;
                console.warn("🎲 Dés 3D désactivés : ouvre le site via un serveur web (http://localhost) — la 3D ne peut pas fonctionner en file://. L'animation 2D est utilisée à la place.");
                return;
            }
            try {
                // dice-box est hébergé EN LOCAL (un Web Worker ne peut pas venir d'un autre domaine)
                const libUrl = new URL('lib/dice-box/', document.baseURI);
                const mod = await import(libUrl.href + 'dice-box.es.min.js');
                const DiceBox = mod.default;
                let overlay = document.getElementById('dice-box-overlay');
                if (!overlay) { overlay = document.createElement('div'); overlay.id = 'dice-box-overlay'; overlay.className = 'no-print'; document.body.appendChild(overlay); }
                const box = new DiceBox({
                    container: '#dice-box-overlay',
                    assetPath: new URL('lib/dice-box/assets/', document.baseURI).pathname,
                    theme: 'default', scale: 7, gravity: 2, throwForce: 6,
                });
                await box.init();
                diceBox = box;
                diceBoxReady = true;
                console.info('🎲 Plateau de dés 3D prêt.');
            } catch (e) {
                console.warn('Plateau 3D indisponible — animation 2D utilisée à la place.', e);
                diceBoxReady = false;
            }
        }
        // Chargement PARESSEUX du plateau 3D : le moteur (module ES + WebGL + assets, lourds) n'est
        // chargé qu'au 1er geste de l'utilisateur, à l'ouverture du tiroir de dés, ou quand le
        // navigateur est inactif — le PREMIER AFFICHAGE de la page n'est plus ralenti par la 3D.
        // (Si l'utilisateur lance un dé avant que la 3D soit prête, l'animation 2D prend le relais.)
        let diceWarmupDone = false;
        function warmupDiceBox() { if (diceWarmupDone) return; diceWarmupDone = true; initDiceBox(); }
        ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, warmupDiceBox, { once: true, passive: true }));
        if ('requestIdleCallback' in window) requestIdleCallback(warmupDiceBox, { timeout: 5000 }); else setTimeout(warmupDiceBox, 3000);

        // Accès SÉRIALISÉ à dice-box : un seul lancer 3D à la fois (sinon roll() peut ne
        // jamais se résoudre) + timeout de sécurité pour ne jamais bloquer l'interface.
        async function safeDiceRoll(notation) {
            if (diceRolling) throw new Error('dice-box-busy');
            diceRolling = true;
            clearTimeout(window._diceBoxClearTimer);
            try {
                try { diceBox.clear(); } catch (e) {}
                const res = await Promise.race([
                    diceBox.roll(notation, { themeColor: currentDiceThemeColor() }),
                    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout-3D')), 9000))
                ]);
                if (!Array.isArray(res) || !res.length) throw new Error('Résultat 3D vide');
                return res;
            } finally {
                diceRolling = false;
                window._diceBoxClearTimer = setTimeout(() => { try { diceBox.clear(); } catch (e) {} }, 4500);
            }
        }

        // Dispatcher : utilise la 3D si elle est prête, sinon l'animation 2D (aucune régression)
        async function executeRoll() {
            if (dicePool.length === 0) return;
            const advModeNode = document.querySelector(`input[name="roll-mode"]:checked`);
            const advMode = advModeNode ? advModeNode.value : 'normal';
            const poolSnapshot = [...dicePool];
            dicePool = [];
            renderDicePool();

            let done = false;
            if (diceBoxReady && diceBox) {
                try { await executeRoll3D(poolSnapshot, advMode); done = true; }
                catch (e) { console.warn('Échec du lancer 3D, repli sur l\'animation 2D.', e); }
            }
            if (!done) await executeRollDOM(poolSnapshot, advMode);
        }

        // --- Lancer réel en 3D via dice-box (résultats = source de vérité) ---
        async function executeRoll3D(poolSnapshot, advMode) {
            const resultsBox = document.getElementById('dice-results');
            const totalBox = document.getElementById('dice-total');
            if (resultsBox) resultsBox.innerHTML = '<span style="font-size:0.9rem; color:#888;">🎲 Les dés roulent…</span>';
            if (totalBox) totalBox.innerHTML = '';

            // 1 dé par entrée (normal) ou 2 dés (avantage/désavantage) — chaque dé = un groupe
            const notation = [];
            const groupMap = [];
            poolSnapshot.forEach(faces => {
                const n = advMode === 'normal' ? 1 : 2;
                const groups = [];
                for (let k = 0; k < n; k++) { groups.push(notation.length); notation.push(`1d${faces}`); }
                groupMap.push(groups);
            });

            const res = await safeDiceRoll(notation);

            // Valeur d'un groupe : on retient le dé au plus grand nombre de faces (gère le d100)
            const byGroup = {};
            res.forEach(d => { (byGroup[d.groupId] = byGroup[d.groupId] || []).push(d); });
            const groupValue = (g) => {
                const arr = byGroup[g] || [];
                if (!arr.length) return null;
                return arr.reduce((a, b) => (b.sides >= a.sides ? b : a)).value;
            };

            let poolTotal = 0;
            let resultsHTML = '';
            const finalScores = [];
            poolSnapshot.forEach((faces, index) => {
                const vals = groupMap[index].map(groupValue).filter(v => v !== null);
                let finalScore, droppedScore, extraHTML = '';
                if (advMode !== 'normal' && vals.length >= 2) {
                    if (advMode === 'adv') { finalScore = Math.max(vals[0], vals[1]); droppedScore = Math.min(vals[0], vals[1]); }
                    else { finalScore = Math.min(vals[0], vals[1]); droppedScore = Math.max(vals[0], vals[1]); }
                    extraHTML = `<div class="die-dropped-score" style="position:absolute; top:4px; right:6px; font-size:0.75rem; color:#888; text-decoration:line-through;">${droppedScore}</div>`;
                } else {
                    finalScore = (vals[0] != null) ? vals[0] : (Math.floor(Math.random() * faces) + 1);
                }
                poolTotal += finalScore;
                finalScores.push(finalScore);
                let colorClass = '';
                if (faces === 20 && finalScore === 20) colorClass = 'crit-success';
                if (faces === 20 && finalScore === 1) colorClass = 'crit-fail';
                resultsHTML += `<div class="die-result die-settle ${colorClass}" data-faces="${faces}" style="position:relative;"><span>d${faces}</span><div class="die-main-score">${finalScore}</div>${extraHTML}</div>`;
                if (index < poolSnapshot.length - 1) resultsHTML += `<div class="die-math">+</div>`;
            });

            if (resultsBox) { resultsBox.innerHTML = resultsHTML; }
            if (totalBox) totalBox.innerHTML = `Total : <span class="total-number">${poolTotal}</span>`;
            sharePoolRoll(poolSnapshot, poolTotal, finalScores);   // partagé avec la table (si en session)
        }
        // Diffuse un lancer du PLATEAU DE DÉS à la table + célèbre un d20 naturel seul.
        // Point de passage UNIQUE des deux chemins (3D et repli 2D) → aussi le hook de l'historique.
        function sharePoolRoll(poolSnapshot, poolTotal, scores) {
            const nat = (poolSnapshot.length === 1 && poolSnapshot[0] === 20) ? scores[0] : null;
            const label = poolSnapshot.map(f => 'd' + f).join(' + ');
            if (window.PlayerSession && window.PlayerSession.shareRoll) window.PlayerSession.shareRoll(label, poolTotal, scores.join(' + '), nat);
            if (window.TableFX && nat) { if (nat === 20) window.TableFX.crit(); else if (nat === 1) window.TableFX.fumble(); }
            pushRollHistory('🎲 ' + label, poolTotal, scores.join(' + '), nat);
        }

        // --- Repli : animation 2D (culbute CSS + chiffres qui défilent) ---
        async function executeRollDOM(poolSnapshot, advMode) {
            const resultsBox = document.getElementById('dice-results');
            const totalBox = document.getElementById('dice-total');
            if (totalBox) totalBox.innerHTML = '';

            let rollingHTML = '';
            poolSnapshot.forEach((faces, index) => {
                rollingHTML += `<div class="die-result die-rolling-3d" id="rolling-die-${index}" data-faces="${faces}" style="position:relative;"><span>d${faces}</span><div class="die-main-score">?</div></div>`;
                if (index < poolSnapshot.length - 1) rollingHTML += `<div class="die-math">+</div>`;
            });
            if (resultsBox) resultsBox.innerHTML = rollingHTML;

            const scramble = setInterval(() => {
                poolSnapshot.forEach((faces, index) => {
                    const el = document.querySelector(`#rolling-die-${index} .die-main-score`);
                    if (el) el.textContent = Math.floor(Math.random() * faces) + 1;
                });
            }, 60);

            await new Promise(resolve => setTimeout(resolve, 850));
            clearInterval(scramble);

            let poolTotal = 0;
            const finalScores = [];
            poolSnapshot.forEach((faces, index) => {
                let finalScore, droppedScore, extraHTML = '';
                if (advMode !== 'normal') {
                    let s1 = Math.floor(Math.random() * faces) + 1, s2 = Math.floor(Math.random() * faces) + 1;
                    if (advMode === 'adv') { finalScore = Math.max(s1, s2); droppedScore = Math.min(s1, s2); }
                    else { finalScore = Math.min(s1, s2); droppedScore = Math.max(s1, s2); }
                    extraHTML = `<div class="die-dropped-score" style="position:absolute; top:4px; right:6px; font-size:0.75rem; color:#888; text-decoration:line-through;">${droppedScore}</div>`;
                } else {
                    finalScore = Math.floor(Math.random() * faces) + 1;
                }
                poolTotal += finalScore;
                finalScores.push(finalScore);
                let colorClass = '';
                if (faces === 20 && finalScore === 20) colorClass = 'crit-success';
                if (faces === 20 && finalScore === 1) colorClass = 'crit-fail';
                const tile = document.getElementById(`rolling-die-${index}`);
                if (tile) {
                    tile.className = `die-result die-settle ${colorClass}`;
                    tile.style.position = 'relative';
                    tile.style.animationDelay = (index * 0.06) + 's';
                    tile.innerHTML = `<span>d${faces}</span><div class="die-main-score">${finalScore}</div>${extraHTML}`;
                }
            });

            if (totalBox) setTimeout(() => { totalBox.innerHTML = `Total : <span class="total-number">${poolTotal}</span>`; }, Math.min(350, poolSnapshot.length * 60 + 120));
            sharePoolRoll(poolSnapshot, poolTotal, finalScores);   // partagé avec la table (si en session)
        }

        if(document.getElementById('btn-roll')) document.getElementById('btn-roll').addEventListener('click', () => executeRoll());

        // --- Panneau de sélection du thème des dés 3D ---
        (function setupDiceThemePanel() {
            const btn = document.getElementById('btn-dice-theme');
            const panel = document.getElementById('dice-theme-panel');
            const swatches = document.getElementById('dice-theme-swatches');
            const randomCb = document.getElementById('dice-theme-random');
            const customColor = document.getElementById('dice-theme-custom-color');
            const customApply = document.getElementById('btn-dice-theme-custom');
            if (!btn || !panel || !swatches) return;

            function persist() {
                DB.set('dnd-dice-theme-color', diceThemeColor);
                DB.set('dnd-dice-theme-random', diceThemeRandom ? 'true' : 'false');
            }
            function renderSwatches() {
                swatches.innerHTML = '';
                DICE_THEMES.forEach(t => {
                    const el = document.createElement('button');
                    const isActive = !diceThemeRandom && t.color.toLowerCase() === diceThemeColor.toLowerCase();
                    el.className = 'dice-swatch' + (isActive ? ' active' : '');
                    el.style.setProperty('--swatch', t.color);
                    el.title = t.name;
                    el.innerHTML = `<span class="dice-swatch-face">20</span><span class="dice-swatch-name">${t.name}</span>`;
                    el.addEventListener('click', () => {
                        diceThemeColor = t.color; diceThemeRandom = false;
                        if (randomCb) randomCb.checked = false;
                        if (customColor) customColor.value = t.color;
                        persist(); renderSwatches();
                    });
                    swatches.appendChild(el);
                });
            }
            renderSwatches();
            if (customColor) customColor.value = /^#([0-9a-f]{6})$/i.test(diceThemeColor) ? diceThemeColor : '#7A2828';
            if (randomCb) randomCb.checked = diceThemeRandom;

            btn.addEventListener('click', (e) => { e.stopPropagation(); panel.classList.toggle('hidden'); });
            if (randomCb) randomCb.addEventListener('change', () => {
                diceThemeRandom = randomCb.checked; persist(); renderSwatches();
            });
            if (customApply && customColor) customApply.addEventListener('click', () => {
                diceThemeColor = customColor.value; diceThemeRandom = false;
                if (randomCb) randomCb.checked = false;
                persist(); renderSwatches();
            });
        })();

        // (L'Atelier de peinture de dés a été retiré le 13 juil. 2026 — fonctionnalité supprimée à la demande de Charlie ;
        //  le bloc mort de ~356 lignes et le chargement CDN de Three.js ont été nettoyés lors de l'audit du 14 juil. 2026.)

        // --- Jet de caractéristique : affiche le résultat dans la bulle ---
        function showAbilityRollResult(name, finalRoll, mod, advMode, roll1, roll2) {
            if(!quickToast) return;
            let secondDieHTML = '';
            if(advMode === 'adv') { const kept = Math.max(roll1, roll2); const dropped = Math.min(roll1, roll2); secondDieHTML = `<div style="font-size:0.85rem; color:#aaa; margin-top:4px;">🎲 <span style="color:#f1c40f; font-weight:bold;">${kept}</span> <span style="text-decoration:line-through; color:#666;">${dropped}</span> <span style="color:#aaa;">(Avantage)</span></div>`; }
            else if(advMode === 'dis') { const kept = Math.min(roll1, roll2); const dropped = Math.max(roll1, roll2); secondDieHTML = `<div style="font-size:0.85rem; color:#aaa; margin-top:4px;">🎲 <span style="color:#e67e22; font-weight:bold;">${kept}</span> <span style="text-decoration:line-through; color:#666;">${dropped}</span> <span style="color:#aaa;">(Désavantage)</span></div>`; }
            const total = finalRoll + mod; const critText = finalRoll === 20 ? " 🟢 CRIT" : (finalRoll === 1 ? " 🔴 ÉCHEC" : ""); const modStr = mod >= 0 ? `+${mod}` : mod;
            quickToast.innerHTML = `${name} : ${finalRoll} ${modStr} = <span style="color:#f1c40f; font-size:2rem;">${total}</span>${critText}${secondDieHTML}`;
            quickToast.classList.remove('hidden'); quickToast.style.animation = 'none'; quickToast.offsetHeight; quickToast.style.animation = 'popUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
            clearTimeout(quickToast._t); quickToast._t = setTimeout(() => { quickToast.classList.add('hidden'); }, 4000);
            // Partagé avec la table si connecté à une session (case 🎲 du panneau ⚔️) + célébration critique
            const advTxt = advMode === 'adv' ? ' (avantage)' : (advMode === 'dis' ? ' (désavantage)' : '');
            if (window.PlayerSession && window.PlayerSession.shareRoll) window.PlayerSession.shareRoll(name, total, `d20 : ${finalRoll} ${modStr}${advTxt}`, finalRoll);
            if (window.TableFX) { if (finalRoll === 20) window.TableFX.crit(); else if (finalRoll === 1) window.TableFX.fumble(); }
            pushRollHistory(name, total, `d20 : ${finalRoll} ${modStr}${advTxt}`, finalRoll);
        }

        // Lance 1 ou 2 d20 réels en 3D (via dice-box) et renvoie les valeurs obtenues
        async function rollD20Set3D(n) {
            const notation = Array.from({length: n}, () => '1d20');
            const res = await safeDiceRoll(notation);
            const vals = res.map(d => d.value).filter(v => typeof v === 'number');
            if(vals.length < n) throw new Error('Résultat 3D incomplet');
            return vals;
        }

        // Jet de caractéristique : un vrai dé 3D roule (comme dans le plateau),
        // avec repli sur un tirage aléatoire instantané si la 3D est indisponible.
        async function performAbilityRoll(name, mod, advMode) {
            const n = advMode === 'normal' ? 1 : 2;
            let roll1, roll2 = null, used3d = false;
            if(diceBoxReady && diceBox) {
                try { const vals = await rollD20Set3D(n); roll1 = vals[0]; if(n === 2) roll2 = vals[1]; used3d = true; }
                catch(e) { console.warn('Jet 3D impossible, repli sur tirage aléatoire.', e); used3d = false; }
            }
            if(!used3d) { roll1 = Math.floor(Math.random()*20)+1; if(n === 2) roll2 = Math.floor(Math.random()*20)+1; }
            let finalRoll = roll1;
            if(advMode === 'adv') finalRoll = Math.max(roll1, roll2);
            else if(advMode === 'dis') finalRoll = Math.min(roll1, roll2);
            showAbilityRollResult(name, finalRoll, mod, advMode, roll1, roll2);
        }

        // Accessibilité clavier : les libellés « à lancer » (.rollable) deviennent des boutons
        // focusables (Tab) et activables à la touche Entrée / Espace.
        function makeRollablesFocusable() {
            document.querySelectorAll('.rollable:not([data-kbd])').forEach(el => {
                el.setAttribute('data-kbd', '1');
                if(!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
                if(!el.hasAttribute('role')) el.setAttribute('role', 'button');
            });
        }
        document.body.addEventListener('keydown', (e) => {
            const el = e.target.closest('.rollable');
            if(el && (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar')) {
                e.preventDefault();
                el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }
        });

        document.body.addEventListener('click', (e) => {
            const el = e.target.closest('.rollable');
            if(el) {
                const name = el.getAttribute('data-name'); const targetId = el.getAttribute('data-target'); let mod = 0; if(targetId !== "none") { const targetEl = document.getElementById(targetId); if(targetEl) mod = parseInt(targetEl.textContent || targetEl.value) || 0; }
                const advModeNode = document.querySelector('input[name="roll-mode"]:checked'); const advMode = advModeNode ? advModeNode.value : 'normal';
                performAbilityRoll(name, mod, advMode);
                return;
            }
            const macroBtn = e.target.closest('.macro-btn');
            if(macroBtn) {
                let formula = macroBtn.getAttribute('data-formula'); let name = macroBtn.getAttribute('data-name'); let total = 0; let rolls = []; let parts = formula.replace(/\s+/g, '').split(/(?=[+-])/); if(parts[0] && !parts[0].startsWith('+') && !parts[0].startsWith('-')) parts[0] = '+' + parts[0];
                parts.forEach(part => { if(!part) return; let sign = part.startsWith('-') ? -1 : 1; part = part.substring(1); if(part.includes('d')) { let [count, faces] = part.split('d'); count = parseInt(count) || 1; faces = parseInt(faces); for(let i=0; i<count; i++) { let r = Math.floor(Math.random() * faces) + 1; total += (r * sign); rolls.push(`${sign < 0 ? '-' : '+'}${r}`); } } else { let val = parseInt(part); if(!isNaN(val)) { total += (val * sign); rolls.push(`${sign < 0 ? '-' : '+'}${val}`); } } });
                if(quickToast) { quickToast.innerHTML = `<span style="font-size:1rem;">${name}</span><br>= <span style="color:#f1c40f; font-size:2rem;">${total}</span> <br><span style="font-size:0.8rem; color:#ccc;">(${rolls.join(' ')})</span>`; quickToast.classList.remove('hidden'); quickToast.style.animation = 'none'; quickToast.offsetHeight; quickToast.style.animation = 'popUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'; setTimeout(() => { quickToast.classList.add('hidden'); }, 4500); }
                if (window.PlayerSession && window.PlayerSession.shareRoll) window.PlayerSession.shareRoll(name || formula, total, rolls.join(' '));   // partagé avec la table
            }
        });

        let invCategories = getStore('dnd-inv-categories') || []; let atkCategories = getStore('dnd-atk-categories') || [];
        function updateCategorySelects() { const buildOptions = (cats) => `<option value="Général">Général</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join(''); let invSel = document.getElementById('inv-category'); if(invSel) invSel.innerHTML = buildOptions(invCategories); let atkSel = document.getElementById('new-atk-category'); if(atkSel) atkSel.innerHTML = buildOptions(atkCategories); }   // (edit-inv-category retiré : l'ancienne fenêtre d'édition du sac n'existe plus, l'édition est inline)
        const catManagerModal = document.getElementById('category-manager-modal'); let currentCatContext = null; 
        window.openCategoryManager = function(context) { currentCatContext = context; const title = document.getElementById('cat-manager-title'); if(title) title.textContent = context === 'inv' ? "Onglets : Sac à dos" : "Onglets : Attaques"; renderCategoryManagerList(); if(catManagerModal) catManagerModal.classList.remove('hidden'); }
        function renderCategoryManagerList() { const list = document.getElementById('cat-manager-list'); if(!list) return; list.innerHTML = ''; let categories = currentCatContext === 'inv' ? invCategories : atkCategories; if (categories.length === 0) { list.innerHTML = `<p style="text-align:center; color:#888;">Aucun onglet personnalisé.</p>`; return; } categories.forEach((cat, index) => { let row = document.createElement('div'); row.style.display = 'flex'; row.style.gap = '6px'; row.style.alignItems = 'center'; row.style.marginBottom = '10px'; let moveBox = document.createElement('div'); moveBox.className = 'cat-move-box'; let btnUp = document.createElement('button'); btnUp.className = 'btn-small cat-move-btn'; btnUp.textContent = '▲'; btnUp.title = 'Monter cet onglet'; btnUp.disabled = index === 0; btnUp.onclick = () => moveCategory(index, -1); let btnDown = document.createElement('button'); btnDown.className = 'btn-small cat-move-btn'; btnDown.textContent = '▼'; btnDown.title = 'Descendre cet onglet'; btnDown.disabled = index === categories.length - 1; btnDown.onclick = () => moveCategory(index, 1); moveBox.appendChild(btnUp); moveBox.appendChild(btnDown); let input = document.createElement('input'); input.type = 'text'; input.value = cat; input.style.flex = '1'; input.style.padding = '5px'; input.style.border = '1px solid rgba(138,28,28,0.25)'; input.style.borderRadius = '4px'; input.style.background = 'rgba(255,255,255,0.5)'; let btnSave = document.createElement('button'); btnSave.className = 'btn-small'; btnSave.textContent = '💾'; btnSave.title = 'Enregistrer'; btnSave.onclick = () => saveCategoryRename(index, input.value.trim()); let btnDel = document.createElement('button'); btnDel.className = 'btn-small'; btnDel.style.background = '#e74c3c'; btnDel.textContent = 'X'; btnDel.title = 'Supprimer'; btnDel.onclick = () => deleteCategory(index); row.appendChild(moveBox); row.appendChild(input); row.appendChild(btnSave); row.appendChild(btnDel); list.appendChild(row); }); }
        function moveCategory(index, direction) { let categories = currentCatContext === 'inv' ? invCategories : atkCategories; const target = index + direction; if (target < 0 || target >= categories.length) return; [categories[index], categories[target]] = [categories[target], categories[index]]; if (currentCatContext === 'inv') { setStore('dnd-inv-categories', categories); updateCategorySelects(); renderInventory(); } else { setStore('dnd-atk-categories', categories); updateCategorySelects(); renderAttacks(); } renderCategoryManagerList(); }
        function saveCategoryRename(index, newName) { if (!newName) return; let categories = currentCatContext === 'inv' ? invCategories : atkCategories; let items = currentCatContext === 'inv' ? inventory : attacks; let oldName = categories[index]; if(newName === oldName) return; categories[index] = newName; items.forEach(item => { if (item.category === oldName) item.category = newName; }); if (currentCatContext === 'inv') { setStore('dnd-inv-categories', categories); setStore('dnd-inventory', items); if (activeInvTabPinned === oldName) activeInvTabPinned = newName; if (activeInvTabModal === oldName) activeInvTabModal = newName; updateCategorySelects(); renderInventory(); } else { setStore('dnd-atk-categories', categories); setStore('dnd-attacks', items); if (activeAtkTab === oldName) activeAtkTab = newName; updateCategorySelects(); renderAttacks(); } renderCategoryManagerList(); }
        function deleteCategory(index) { let categories = currentCatContext === 'inv' ? invCategories : atkCategories; let items = currentCatContext === 'inv' ? inventory : attacks; let oldName = categories[index]; if(!confirm(`Supprimer l'onglet "${oldName}" ? Les objets à l'intérieur retourneront dans "Général".`)) return; categories.splice(index, 1); items.forEach(item => { if (item.category === oldName) item.category = 'Général'; }); if (currentCatContext === 'inv') { setStore('dnd-inv-categories', categories); setStore('dnd-inventory', items); if (activeInvTabPinned === oldName) activeInvTabPinned = 'Tout'; if (activeInvTabModal === oldName) activeInvTabModal = 'Tout'; updateCategorySelects(); renderInventory(); } else { setStore('dnd-atk-categories', categories); setStore('dnd-attacks', items); if (activeAtkTab === oldName) activeAtkTab = 'Tout'; updateCategorySelects(); renderAttacks(); } renderCategoryManagerList(); }
        if(document.getElementById('btn-close-cat-manager')) document.getElementById('btn-close-cat-manager').addEventListener('click', () => catManagerModal.classList.add('hidden'));

        function renderTabs(containerId, items, activeTab, categoriesArr, onTabClick, onAddCategory, onEditCategories) { const container = document.getElementById(containerId); if(!container) return; let html = `<button class="cat-tab ${activeTab === 'Tout' ? 'active' : ''}" data-cat="Tout">Tout</button>`; categoriesArr.forEach(cat => { html += `<button class="cat-tab ${activeTab === cat ? 'active' : ''}" data-cat="${cat}">${cat}</button>`; }); html += `<button class="cat-tab-add" title="Nouvelle catégorie">+</button><button class="cat-tab-edit" title="Gérer les onglets">⚙️</button>`; container.innerHTML = html; container.querySelectorAll('.cat-tab').forEach(btn => { btn.addEventListener('click', (e) => { e.preventDefault(); onTabClick(e.target.dataset.cat); }); }); const addBtn = container.querySelector('.cat-tab-add'); if(addBtn) addBtn.addEventListener('click', (e) => { e.preventDefault(); onAddCategory(); }); const editBtn = container.querySelector('.cat-tab-edit'); if(editBtn && onEditCategories) editBtn.addEventListener('click', (e) => { e.preventDefault(); onEditCategories(); }); }
        function moveWithinFilter(array, index, direction, filterFn) { let targetIndex = -1; if (direction === -1) { for (let i = index - 1; i >= 0; i--) { if (filterFn(array[i])) { targetIndex = i; break; } } } else { for (let i = index + 1; i < array.length; i++) { if (filterFn(array[i])) { targetIndex = i; break; } } } if (targetIndex !== -1) { [array[targetIndex], array[index]] = [array[index], array[targetIndex]]; return true; } return false; }
        let editingAbilityIndex = -1; let editingSpellIndex = -1; let editingAttackIndex = -1; let editingInvIndex = -1; let editingTraitIndex = -1;
        function getCrudControlsHTML(index, prefix, hideMove = false) { let moveBtns = hideMove ? '' : `<button title="Monter" onclick="move${prefix}Up(${index})">▲</button><button title="Descendre" onclick="move${prefix}Down(${index})">▼</button>`; return `<div class="item-controls no-print">${moveBtns}<button title="Modifier" onclick="edit${prefix}(${index})">✎</button><button title="Supprimer" class="btn-del" onclick="delete${prefix}(${index})">X</button></div>`; }

        const autoExpandTextareas = document.querySelectorAll('.auto-expand');
        function adjustHeight(el) { el.style.height = 'auto'; el.style.height = (el.scrollHeight) + 'px'; } window.adjustHeight = adjustHeight;
        autoExpandTextareas.forEach(textarea => { textarea.addEventListener('input', () => adjustHeight(textarea)); setTimeout(() => adjustHeight(textarea), 100); });
        // ===== LISTES DE FICHES (notes rapides, quêtes, PNJ) =====
        // Trois modules partagent la même forme : une liste de { id, title, body } que l'on
        // ajoute, renomme, remplit et supprime. Une seule fabrique les sert tous les trois.
        // Les champs n'ont pas d'id : initGlobalSave() ignore les éléments non identifiés,
        // ce qui évite un double stockage avec les clés dnd-sheet-*.
        function makeNoteList(opt) {
            let items = getStore(opt.storeKey);
            if (!Array.isArray(items)) {
                // Migration depuis l'ancienne zone de texte unique.
                const legacy = opt.legacyKey ? getStore(opt.legacyKey, false) : null;
                items = (legacy && legacy.trim())
                    ? [{ id: 'n' + Date.now(), title: opt.legacyTitle || 'Note', body: legacy }]
                    : [];
                setStore(opt.storeKey, items);
            }
            items.forEach(it => { if (opt.withDone && it.done == null) it.done = false; });

            let saveTimer = null;
            const save = () => { clearTimeout(saveTimer); setStore(opt.storeKey, items); };
            // Frappe au clavier : écriture différée, sinon chaque caractère déclenche une synchro cloud.
            const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => setStore(opt.storeKey, items), 400); };
            window.addEventListener('beforeunload', () => { if (saveTimer) save(); });

            function render() {
                const list = document.getElementById(opt.listId); if (!list) return;
                if (!items.length) { list.innerHTML = `<div class="compact-empty">${opt.emptyText}</div>`; return; }
                list.innerHTML = items.map((n, i) => `<div class="qnote-card${n.done ? ' is-done' : ''}" data-ni="${i}">
                    <div class="qnote-head">
                        ${opt.withDone ? `<input type="checkbox" class="qnote-done" data-nf="done"${n.done ? ' checked' : ''} title="Marquer comme terminée">` : ''}
                        <input type="text" data-nf="title" value="${escAb(n.title)}" placeholder="${opt.titlePlaceholder}">
                        <button type="button" class="qnote-del no-print" title="Supprimer">🗑</button>
                    </div>
                    <textarea data-nf="body" class="auto-expand" placeholder="${opt.bodyPlaceholder}">${escAb(n.body)}</textarea>
                </div>`).join('');
                list.querySelectorAll('.auto-expand').forEach(t => adjustHeight(t));
            }

            const list = document.getElementById(opt.listId);
            if (list) {
                list.addEventListener('input', (e) => {
                    const card = e.target.closest('.qnote-card'); if (!card) return;
                    const field = e.target.dataset.nf; if (!field || field === 'done') return;
                    items[parseInt(card.dataset.ni, 10)][field] = e.target.value;
                    saveSoon();
                    if (e.target.classList.contains('auto-expand')) adjustHeight(e.target);
                });
                // Sortie de champ (et cases à cocher) : on écrit tout de suite.
                list.addEventListener('change', (e) => {
                    const card = e.target.closest('.qnote-card');
                    if (card && e.target.dataset.nf === 'done') {
                        items[parseInt(card.dataset.ni, 10)].done = e.target.checked;
                        card.classList.toggle('is-done', e.target.checked);
                    }
                    save();
                });
                list.addEventListener('click', (e) => {
                    if (!e.target.closest('.qnote-del')) return;
                    const i = parseInt(e.target.closest('.qnote-card').dataset.ni, 10);
                    window.deleteWithUndo(items, i, items[i].title || opt.deleteFallback, save, render);
                });
            }
            const addBtn = document.getElementById(opt.addBtnId);
            if (addBtn) addBtn.addEventListener('click', () => {
                const entry = { id: 'n' + Date.now(), title: '', body: '' };
                if (opt.withDone) entry.done = false;
                items.push(entry); save(); render();
                const last = document.querySelector('#' + opt.listId + ' .qnote-card:last-child input[data-nf="title"]');
                if (last) last.focus();
            });
            render();
            return { render, all: () => items };
        }

        makeNoteList({
            listId: 'quick-notes-list', addBtnId: 'btn-add-quick-note',
            storeKey: 'dnd-quick-notes', legacyKey: 'dnd-sheet-quick-note', legacyTitle: 'Note',
            titlePlaceholder: 'Titre de la note…', bodyPlaceholder: 'Saisis tes notes ici…',
            emptyText: 'Aucune note — clique sur ➕ Ajouter.', deleteFallback: 'cette note'
        });
        makeNoteList({
            listId: 'quests-list', addBtnId: 'btn-add-quest', withDone: true,
            storeKey: 'dnd-quests', legacyKey: 'dnd-sheet-quest-log', legacyTitle: 'Quêtes en cours',
            titlePlaceholder: 'Nom de la quête…', bodyPlaceholder: 'Objectifs, commanditaire, récompense…',
            emptyText: 'Aucune quête — clique sur ➕ Ajouter.', deleteFallback: 'cette quête'
        });
        makeNoteList({
            listId: 'npcs-list', addBtnId: 'btn-add-npc',
            storeKey: 'dnd-npcs', legacyKey: 'dnd-sheet-npc-log', legacyTitle: 'Registre des PNJ',
            titlePlaceholder: 'Nom du PNJ…', bodyPlaceholder: 'Lieu, attitude, ce qu\'il sait…',
            emptyText: 'Aucun PNJ — clique sur ➕ Ajouter.', deleteFallback: 'ce PNJ'
        });


        // ===== MONTÉE DE NIVEAU =====
        // Applique ce qui est déductible sans ambiguïté : niveau, dé de vie
        // supplémentaire, et bonus de maîtrise (recalculé par le listener existant
        // sur #char-level). Les emplacements de sorts et les aptitudes gagnées
        // dépendent de la sous-classe : on les signale au lieu de les deviner.
        const HIT_DIE_BY_CLASS = {
            barbare: 12, guerrier: 10, paladin: 10, rodeur: 10,
            barde: 8, clerc: 8, druide: 8, moine: 8, roublard: 8, occultiste: 8,
            ensorceleur: 6, magicien: 6
        };
        const CASTER_CLASSES = ['barde', 'clerc', 'druide', 'ensorceleur', 'magicien',
                                'occultiste', 'paladin', 'rodeur'];
        const classKey = (s) => String(s || '').toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '').trim().split(/[\s/,]+/)[0];

        const btnLevelUp = document.getElementById('btn-level-up');
        if (btnLevelUp) btnLevelUp.addEventListener('click', () => {
            const lvlEl = document.getElementById('char-level');
            if (!lvlEl) return;
            const lvl = parseInt(lvlEl.value, 10) || 1;
            if (lvl >= 20) {
                if (window.showAppToast) window.showAppToast('Niveau 20 : maximum atteint.', '#8a6320');
                return;
            }
            const cls = classKey(document.getElementById('char-class')?.value);
            const die = HIT_DIE_BY_CLASS[cls];
            const newLvl = lvl + 1;

            if (!confirm(`Passer du niveau ${lvl} au niveau ${newLvl} ?`)) return;

            lvlEl.value = newLvl;
            lvlEl.dispatchEvent(new Event('input', { bubbles: true }));   // recalcule le bonus de maîtrise

            const hdMaxEl = document.getElementById('hd-max');
            if (hdMaxEl) {
                hdMaxEl.value = (parseInt(hdMaxEl.value, 10) || 0) + 1;
                hdMaxEl.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (die) {
                const hdSizeEl = document.getElementById('hd-size');
                if (hdSizeEl && hdSizeEl.value !== String(die)) {
                    hdSizeEl.value = String(die);
                    hdSizeEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }

            const prof = String(document.getElementById('prof-bonus')?.value || '').replace('+', '');
            const rappels = ['❤️ Augmente tes PV max (dé de vie + mod. de Constitution)'];
            if (CASTER_CLASSES.includes(cls)) rappels.push('✨ Vérifie tes emplacements de sorts');
            rappels.push('📜 Ajoute les aptitudes gagnées à ce niveau');

            // Le champ Niveau pulse en or
            const grp = lvlEl.closest('.level-group');
            if (grp) { grp.classList.remove('is-levelling'); void grp.offsetWidth; grp.classList.add('is-levelling'); }

            showLevelUpFx({
                level: newLvl,
                className: document.getElementById('char-class')?.value || '',
                prof: prof,
                hitDice: die ? `${parseInt(hdMaxEl?.value, 10) || newLvl}d${die}` : '',
                todo: rappels
            });
        });

        // Célébration plein écran. Remplace l'alerte système : monter de niveau
        // mérite mieux qu'une boîte de dialogue grise.
        function showLevelUpFx(info) {
            document.getElementById('levelup-fx')?.remove();
            const ov = document.createElement('div');
            ov.id = 'levelup-fx'; ov.className = 'no-print';
            ov.setAttribute('role', 'dialog');
            ov.setAttribute('aria-label', 'Montée de niveau ' + info.level);

            const embers = Array.from({ length: 14 }, (_, i) =>
                `<span class="lvfx-ember" style="left:${6 + Math.random() * 88}%;`
                + `animation-delay:${(Math.random() * 2.2).toFixed(2)}s;`
                + `animation-duration:${(1.8 + Math.random() * 1.4).toFixed(2)}s"></span>`).join('');

            const stats = [
                `<span class="lvfx-stat">Maîtrise +${escAb(info.prof)}</span>`,
                info.hitDice ? `<span class="lvfx-stat">Dés de vie ${escAb(info.hitDice)}</span>` : '',
                `<span class="lvfx-stat">Niveau ${info.level}</span>`
            ].join('');

            ov.innerHTML = embers + `<div class="lvfx-card">
                <div class="lvfx-kicker">Niveau supérieur</div>
                <div class="lvfx-number">${info.level}</div>
                ${info.className ? `<div class="lvfx-class">${escAb(info.className)}</div>` : ''}
                <div class="lvfx-stats">${stats}</div>
                <ul class="lvfx-todo">${info.todo.map(t => `<li>${escAb(t)}</li>`).join('')}</ul>
                <button type="button" class="lvfx-close">Continuer l’aventure</button>
            </div>`;

            const close = () => {
                ov.classList.add('is-closing');
                setTimeout(() => ov.remove(), 280);
                document.removeEventListener('keydown', onKey);
            };
            const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') close(); };
            ov.addEventListener('click', close);
            document.addEventListener('keydown', onKey);
            document.body.appendChild(ov);
            ov.querySelector('.lvfx-close')?.focus();
        }
        const levelInput = document.getElementById('char-level'); const profInput = document.getElementById('prof-bonus'); const initInput = document.getElementById('initiative');
        function syncCharMeta() { const lvl = parseInt(document.getElementById('char-level').value) || 1; const cls = document.getElementById('char-class').value || ''; const idx = charactersList.findIndex(c => c.id === ACTIVE_CHAR_ID); if(idx !== -1) { charactersList[idx].level = lvl; charactersList[idx].class = cls; DB.set('dnd-character-list', JSON.stringify(charactersList)); } }
        if(levelInput && profInput) { levelInput.addEventListener('input', () => { let lvl = parseInt(levelInput.value) || 1; let prof = Math.floor((lvl - 1) / 4) + 2; profInput.value = prof; setStore('dnd-sheet-prof-bonus', prof, false); updateStatsAndSkills(); syncCharMeta(); }); }
        // Édition manuelle du bonus de maîtrise : recalcul complet (compétences + stats magiques)
        if(profInput) { profInput.addEventListener('input', () => { updateStatsAndSkills(); }); }
        const classInput = document.getElementById('char-class'); if(classInput) { classInput.addEventListener('input', () => { syncCharMeta(); }); }

        const skillsMap = [{ id: 'str', name: 'Force', skills: [{id: 'save-str', name: 'Sauvegarde', type: 'save'}, {id: 'athletics', name: 'Athlétisme'}] }, { id: 'dex', name: 'Dextérité', skills: [{id: 'save-dex', name: 'Sauvegarde', type: 'save'}, {id: 'acrobatics', name: 'Acrobaties'}, {id: 'sleight', name: 'Escamotage'}, {id: 'stealth', name: 'Discrétion'}] }, { id: 'con', name: 'Constitution', skills: [{id: 'save-con', name: 'Sauvegarde', type: 'save'}] }, { id: 'int', name: 'Intelligence', skills: [{id: 'save-int', name: 'Sauvegarde', type: 'save'}, {id: 'arcana', name: 'Arcanes'}, {id: 'history', name: 'Histoire'}, {id: 'investigation', name: 'Investigation'}, {id: 'nature', name: 'Nature'}, {id: 'religion', name: 'Religion'}] }, { id: 'wis', name: 'Sagesse', skills: [{id: 'save-wis', name: 'Sauvegarde', type: 'save'}, {id: 'animal', name: 'Dressage'}, {id: 'insight', name: 'Intuition'}, {id: 'medicine', name: 'Médecine'}, {id: 'perception', name: 'Perception'}, {id: 'survival', name: 'Survie'}] }, { id: 'cha', name: 'Charisme', skills: [{id: 'save-cha', name: 'Sauvegarde', type: 'save'}, {id: 'deception', name: 'Tromperie'}, {id: 'intimidation', name: 'Intimidation'}, {id: 'performance', name: 'Représentation'}, {id: 'persuasion', name: 'Persuasion'}] }];
        const attributesContainer = document.getElementById('attributes-list');
        if(attributesContainer) {
            skillsMap.forEach(attr => {
                let skillsHTML = attr.skills.map(skill => `<div class="skill-row ${skill.type === 'save' ? 'saving-throw' : ''}"><button type="button" class="skill-prof-btn" id="profbtn-${skill.id}" data-stat="${attr.id}" data-skill="${skill.id}" title="Clic: maîtrise / Double-clic: expertise">○</button><input type="hidden" id="prof-${skill.id}" class="skill-prof" data-stat="${attr.id}" value="0"><span class="skill-mod" id="skill-val-${skill.id}">+0</span><label class="rollable" data-name="${skill.name}" data-target="skill-val-${skill.id}">${skill.name}</label></div>`).join('');
                attributesContainer.innerHTML += `<div class="attribute-block"><h3 class="rollable" data-name="${attr.name}" data-target="mod-${attr.id}">${attr.name}</h3><div class="stat-main-row"><div class="stat-score-circle"><input type="number" id="stat-${attr.id}" class="stat-score stat-score-input" value="8"></div><div class="stat-mod-box" id="mod-${attr.id}">-1</div></div><button class="stat-expand no-print" type="button" title="Voir sauvegardes et compétences">▾ Compétences</button><div class="nested-skills-list">${skillsHTML}</div></div>`;
            });
        }

        function getModifier(score) { return Math.floor((score - 10) / 2); }
        function updateAutoMagicStats() { const abilityEl = document.getElementById('spellcasting-ability'); const profEl = document.getElementById('prof-bonus'); if(!abilityEl || !profEl) return; const ability = abilityEl.value; const prof = parseInt(profEl.value) || 2; if (ability && ability !== 'none') { const statEl = document.getElementById(`stat-${ability}`); if(!statEl) return; const score = parseInt(statEl.value) || 10; const mod = getModifier(score); document.getElementById('spell-modifier').value = mod >= 0 ? `+${mod}` : mod; document.getElementById('spell-save-dc').value = 8 + prof + mod; document.getElementById('spell-attack-bonus').value = prof + mod; setStore('dnd-sheet-spell-save-dc', 8 + prof + mod, false); setStore('dnd-sheet-spell-attack-bonus', prof + mod, false); setStore('dnd-sheet-spell-modifier', mod, false); } }
        function updateSkillProfBtn(skillId) { const hiddenInput = document.getElementById('prof-' + skillId); const btn = document.getElementById('profbtn-' + skillId); if(!hiddenInput || !btn) return; const level = parseInt(hiddenInput.value) || 0; if(level === 0) { btn.textContent = '○'; btn.classList.remove('prof-active', 'exp-active'); btn.title = 'Clic : ajouter maîtrise'; } else if(level === 1) { btn.textContent = '●'; btn.classList.add('prof-active'); btn.classList.remove('exp-active'); btn.title = 'Maîtrise — clic : expertise'; } else { btn.textContent = '★'; btn.classList.remove('prof-active'); btn.classList.add('exp-active'); btn.title = 'Expertise — clic : retirer'; } }

        function updateStatsAndSkills() {
            const profEl = document.getElementById('prof-bonus'); if(!profEl) return; const profBonus = parseInt(profEl.value) || 2;
            skillsMap.forEach(attr => { const statEl = document.getElementById(`stat-${attr.id}`); const modEl = document.getElementById(`mod-${attr.id}`); if(statEl && modEl) { const score = parseInt(statEl.value) || 10; const mod = getModifier(score); modEl.textContent = mod >= 0 ? `+${mod}` : mod; attr.skills.forEach(skill => { const hiddenInput = document.getElementById(`prof-${skill.id}`); const profLevel = hiddenInput ? (parseInt(hiddenInput.value) || 0) : 0; const bonus = profLevel === 2 ? profBonus * 2 : (profLevel === 1 ? profBonus : 0); const manual = parseInt(getStore('dnd-sheet-skill-bonus-' + skill.id, false)) || 0; const totalMod = mod + bonus + manual; const valEl = document.getElementById(`skill-val-${skill.id}`); if(valEl) { valEl.textContent = totalMod >= 0 ? `+${totalMod}` : totalMod; valEl.classList.toggle('manual-bonus', manual !== 0); valEl.title = manual !== 0 ? `Bonus manuel ${manual > 0 ? '+' + manual : manual} inclus — clic pour modifier` : 'Clic : bonus manuel (ex : Touche-à-tout)'; } }); } });
            updateAutoMagicStats();
            updatePassivePerception();
        }

        // Perception passive = 10 + modificateur total de Perception (mod. Sagesse + maîtrise + bonus manuel).
        // Auto par défaut ; devient MANUELLE dès que le joueur saisit une valeur (revient en auto si le champ est vidé).
        function updatePassivePerception() {
            const el = document.getElementById('passive-perception'); if(!el) return;
            if(getStore('dnd-sheet-passive-perception-auto', false) === 'false') return; // override manuel : on n'écrase pas
            const percSpan = document.getElementById('skill-val-perception');
            const mod = percSpan ? (parseInt(percSpan.textContent, 10) || 0) : 0;
            const val = 10 + mod;
            if(String(el.value) !== String(val)) { el.value = val; setStore('dnd-sheet-passive-perception', val, false); }
        }
        const passivePercEl = document.getElementById('passive-perception');
        if(passivePercEl) {
            passivePercEl.addEventListener('input', () => {
                if(passivePercEl.value.trim() === '') { setStore('dnd-sheet-passive-perception-auto', 'true', false); updatePassivePerception(); }
                else setStore('dnd-sheet-passive-perception-auto', 'false', false);
            });
            passivePercEl.title = "Calculée automatiquement (10 + Perception). Saisis une valeur pour forcer manuellement ; vide le champ pour revenir en auto.";
        }

        const statDex = document.getElementById('stat-dex'); if(statDex && initInput) { statDex.addEventListener('change', () => { const dexScore = parseInt(statDex.value) || 10; initInput.value = getModifier(dexScore); setStore('dnd-sheet-initiative', initInput.value, false); }); }
        document.body.addEventListener('input', (e) => { if(e.target.classList.contains('stat-score')) updateStatsAndSkills(); });
        document.body.addEventListener('change', (e) => { if(e.target.classList.contains('stat-score')) updateStatsAndSkills(); });
        document.body.addEventListener('click', (e) => { const btn = e.target.closest('.skill-prof-btn'); if(!btn) return; const skillId = btn.dataset.skill; const hiddenInput = document.getElementById('prof-' + skillId); if(!hiddenInput) return; let level = (parseInt(hiddenInput.value) || 0) + 1; if(level > 2) level = 0; hiddenInput.value = level; setStore('dnd-sheet-prof-' + skillId, level, false); updateSkillProfBtn(skillId); updateStatsAndSkills(); });
        // Bonus manuel par compétence (demi-maîtrise « Touche-à-tout », objet magique...) :
        // additionné au calcul automatique, jamais écrasé par lui.
        const skillNameById = {}; skillsMap.forEach(attr => attr.skills.forEach(s => { skillNameById[s.id] = s.type === 'save' ? `${s.name} ${attr.name}` : s.name; }));
        document.body.addEventListener('click', (e) => { const span = e.target.closest('.skill-mod'); if(!span || !span.id || !span.id.startsWith('skill-val-')) return; const skillId = span.id.replace('skill-val-', ''); if(!(skillId in skillNameById)) return; const current = parseInt(getStore('dnd-sheet-skill-bonus-' + skillId, false)) || 0; const raw = prompt(`Bonus manuel pour « ${skillNameById[skillId]} »\n(ajouté au calcul automatique, ex : 1 ou -2 — vide ou 0 pour retirer) :`, current || ''); if(raw === null) return; const n = String(raw).trim() === '' ? 0 : parseInt(raw, 10); if(isNaN(n)) { alert('Valeur invalide : entre un nombre entier (ex : 1 ou -2).'); return; } setStore('dnd-sheet-skill-bonus-' + skillId, n, false); updateStatsAndSkills(); });
        const spellCastingAbility = document.getElementById('spellcasting-ability'); if(spellCastingAbility) spellCastingAbility.addEventListener('change', () => { setStore('dnd-sheet-spellcasting-ability', spellCastingAbility.value, false); updateAutoMagicStats(); });

        let customConditions = getStore('dnd-custom-conditions') || []; const customCondContainer = document.getElementById('custom-conditions-container'); const customCondInput = document.getElementById('input-custom-condition'); const btnAddCustomCond = document.getElementById('btn-add-custom-condition');
        function renderCustomConditions() { if(!customCondContainer) return; customCondContainer.innerHTML = ''; customConditions.forEach((cond, i) => { customCondContainer.innerHTML += `<div style="display:flex; align-items:center; gap:5px; margin-bottom:4px; background:rgba(255,255,255,0.5); padding:4px 8px; border-radius:4px; border:1px dashed rgba(138,28,28,0.25);"><input type="checkbox" id="custom-cond-${i}" ${cond.active ? 'checked' : ''} onchange="toggleCustomCond(${i})" style="transform:scale(1.2); cursor:pointer;"><label style="flex:1; cursor:pointer; font-weight:bold; color:var(--text-color);" for="custom-cond-${i}">${cond.name}</label><span style="color:#e74c3c; cursor:pointer; font-weight:bold; padding:0 5px;" onclick="deleteCustomCond(${i})">X</span></div>`; }); }
        if(btnAddCustomCond && customCondInput) { btnAddCustomCond.addEventListener('click', () => { let val = customCondInput.value.trim(); if(val) { customConditions.push({name: val, active: false}); setStore('dnd-custom-conditions', customConditions); customCondInput.value = ''; renderCustomConditions(); } }); }
        window.toggleCustomCond = (i) => { customConditions[i].active = !customConditions[i].active; setStore('dnd-custom-conditions', customConditions); updateStatusEffects(); }; window.deleteCustomCond = (i) => { customConditions.splice(i, 1); setStore('dnd-custom-conditions', customConditions); renderCustomConditions(); updateStatusEffects(); };

        function updateHpVisuals() {
            const hpCurrentInput = document.getElementById('hp-current'); const hpMaxInput = document.getElementById('hp-max');
            if(!hpCurrentInput || !hpMaxInput) return;
            const current = parseInt(hpCurrentInput.value) || 0;
            const maxRaw = parseInt(hpMaxInput.value) || 0;
            const temp = parseInt(document.getElementById('hp-temp')?.value) || 0;
            const max = maxRaw > 0 ? maxRaw : 1;
            const ratio = Math.max(0, Math.min(1, current / max));
            const block = document.querySelector('.health-block');
            if(block) {
                if(ratio > 0.5) { block.style.borderColor = '#2ecc71'; block.style.boxShadow = '0 0 10px rgba(46, 204, 113, 0.2)'; }
                else if (ratio > 0.25) { block.style.borderColor = '#f1c40f'; block.style.boxShadow = '0 0 10px rgba(241, 196, 15, 0.2)'; }
                else { block.style.borderColor = '#e74c3c'; block.style.boxShadow = '0 0 10px rgba(231, 76, 60, 0.3)'; }
            }
            const fill = document.getElementById('hp-bar-fill');
            if(fill) {
                fill.style.width = (maxRaw > 0 ? ratio * 100 : 0) + '%';
                fill.classList.remove('hp-mid', 'hp-low');
                if(maxRaw > 0 && ratio <= 0.25) fill.classList.add('hp-low');
                else if(maxRaw > 0 && ratio <= 0.5) fill.classList.add('hp-mid');
            }
            const text = document.getElementById('hp-bar-text');
            if(text) text.innerHTML = `${current} / ${maxRaw}` + (temp > 0 ? ` <span class="hp-bar-temp-badge">+${temp} PVT</span>` : '');
            // À 0 PV : état critique = voile rouge léger + mise en avant des jets contre la mort.
            const atZero = maxRaw > 0 && current <= 0;
            document.body.classList.toggle('at-zero-hp', atZero);
            const deathSection = document.querySelector('.death-saves-section');
            if(deathSection) deathSection.classList.toggle('is-critical', atZero);
            updateMobileVitals();
        }

        // Soin / dégâts rapides (les dégâts entament d'abord les PV temporaires, règle 5e)
        function applyHpDelta(delta) {
            const cur = document.getElementById('hp-current'); const tmp = document.getElementById('hp-temp'); const maxEl = document.getElementById('hp-max');
            if(!cur) return; const max = parseInt(maxEl?.value) || 0;
            if(delta < 0) {
                let dmg = -delta; let temp = parseInt(tmp?.value) || 0;
                if(temp > 0 && tmp) { const absorbed = Math.min(temp, dmg); temp -= absorbed; dmg -= absorbed; tmp.value = temp; tmp.dispatchEvent(new Event('input', { bubbles: true })); }
                if(dmg > 0) { cur.value = Math.max(0, (parseInt(cur.value) || 0) - dmg); cur.dispatchEvent(new Event('input', { bubbles: true })); }   // plancher 0 : à 0 PV on tombe inconscient (jets contre la mort), pas de PV négatifs
            } else if(delta > 0) {
                let nv = (parseInt(cur.value) || 0) + delta; if(max > 0) nv = Math.min(nv, max); cur.value = nv; cur.dispatchEvent(new Event('input', { bubbles: true }));
            }
            updateHpVisuals();
        }
        const hpQuickAmount = document.getElementById('hp-quick-amount');
        const getHpQuickAmount = () => Math.abs(parseInt(hpQuickAmount?.value) || 0);
        const btnHpDamage = document.getElementById('btn-hp-damage'); const btnHpHeal = document.getElementById('btn-hp-heal');
        if(btnHpDamage) btnHpDamage.addEventListener('click', () => { const a = getHpQuickAmount(); if(a > 0) { applyHpDelta(-a); if(hpQuickAmount) hpQuickAmount.value = ''; } });
        if(btnHpHeal) btnHpHeal.addEventListener('click', () => { const a = getHpQuickAmount(); if(a > 0) { applyHpDelta(a); if(hpQuickAmount) hpQuickAmount.value = ''; } });
        if(hpQuickAmount) hpQuickAmount.addEventListener('keydown', (e) => { if(e.key === 'Enter') { e.preventDefault(); btnHpHeal?.click(); } });

        function createDefaultSpellSlotLevel() { return { total: 0, used: [], regenMode: 'long', shortType: 'all', shortAmount: 1, longType: 'all', longAmount: 1 }; }
        function normalizeSpellSlotsData(rawData) { return Array.from({length: 9}, (_, lvl) => { const base = createDefaultSpellSlotLevel(); const old = Array.isArray(rawData) ? rawData[lvl] : null; if(old && typeof old === 'object') { base.total = Math.max(0, Math.min(9, parseInt(old.total) || 0)); base.used = Array.isArray(old.used) ? old.used.slice(0, base.total).map(Boolean) : []; base.regenMode = old.regenMode || 'long'; base.shortType = old.shortType || 'all'; base.shortAmount = Math.max(1, parseInt(old.shortAmount) || 1); base.longType = old.longType || 'all'; base.longAmount = Math.max(1, parseInt(old.longAmount) || 1); } while(base.used.length < base.total) base.used.push(false); base.used = base.used.slice(0, base.total); return base; }); }
        let spellSlotsData = normalizeSpellSlotsData(getStore('dnd-spell-slots')); setStore('dnd-spell-slots', spellSlotsData);
        function formatRecoverAmount(type, amount) { return type === 'all' ? 'Tout' : `+${amount}`; } function getSpellSlotRegenText(data) { if(data.regenMode === 'none') return 'Aucune régénération'; if(data.regenMode === 'short_long') return `Court: ${formatRecoverAmount(data.shortType, data.shortAmount)} | Long: ${formatRecoverAmount(data.longType, data.longAmount)}`; return `Long: ${formatRecoverAmount(data.longType, data.longAmount)}`; }

        function renderSpellSlots() { const container = document.getElementById('spell-slots-grid'); if(!container) return; container.innerHTML = ''; const activeLevels = spellSlotsData.map((data, lvl) => ({ data, lvl })).filter(entry => entry.data.total > 0); if(activeLevels.length === 0) { container.innerHTML = `<div class="spell-slot-empty">Aucun emplacement configuré.</div>`; return; } activeLevels.forEach(({ data, lvl }) => { const usedCount = data.used.filter(Boolean).length; const available = Math.max(0, data.total - usedCount); let cbHtml = ''; for(let i=0; i<data.total; i++) cbHtml += `<input type="checkbox" class="slot-check" data-lvl="${lvl}" data-index="${i}" ${data.used[i]?'checked':''} title="Dépensé">`; container.innerHTML += `<div class="spell-slot-row"><div class="slot-lvl-label">Niveau ${lvl + 1}</div><div class="slot-main-content"><div class="slot-checkboxes">${cbHtml}</div><div class="slot-info">${available}/${data.total} dispos • ${getSpellSlotRegenText(data)}</div></div></div>`; }); document.querySelectorAll('.slot-check').forEach(cb => { cb.addEventListener('change', (e) => { spellSlotsData[parseInt(e.target.dataset.lvl)].used[parseInt(e.target.dataset.index)] = e.target.checked; setStore('dnd-spell-slots', spellSlotsData); renderSpellSlots(); }); }); }
        document.body.addEventListener('click', (e) => { if(e.target.id === 'btn-open-spell-slots-modal') { const list = document.getElementById('spell-slots-config-list'); if(!list) return; list.innerHTML = ''; spellSlotsData.forEach((data, lvl) => { list.innerHTML += `<div class="spell-slot-config-row ${data.total === 0 ? 'is-empty' : ''}" data-lvl="${lvl}"><div class="spell-slot-config-head"><div class="spell-slot-level-badge">Niv. ${lvl + 1}</div><label class="spell-slot-mini-field">Emplacements<input type="number" class="spell-config-total" min="0" max="9" value="${data.total}"></label><label class="spell-slot-mini-field spell-slot-regen-field">Récupération<select class="spell-config-regen-mode"><option value="none" ${data.regenMode === 'none' ? 'selected' : ''}>Aucune</option><option value="long" ${data.regenMode === 'long' ? 'selected' : ''}>Repos long</option><option value="short_long" ${data.regenMode === 'short_long' ? 'selected' : ''}>Repos court + long</option></select></label></div><div class="spell-slot-config-details"><div class="spell-recovery-pill spell-config-short-block hidden"><span>Court</span><select class="spell-config-short-type"><option value="all" ${data.shortType === 'all' ? 'selected' : ''}>Tout</option><option value="fixed" ${data.shortType === 'fixed' ? 'selected' : ''}>Partiel</option></select><input type="number" class="spell-config-short-amount hidden" min="1" value="${data.shortAmount}" placeholder="Nb"></div><div class="spell-recovery-pill spell-config-long-block"><span>Long</span><select class="spell-config-long-type"><option value="all" ${data.longType === 'all' ? 'selected' : ''}>Tout</option><option value="fixed" ${data.longType === 'fixed' ? 'selected' : ''}>Partiel</option></select><input type="number" class="spell-config-long-amount hidden" min="1" value="${data.longAmount}" placeholder="Nb"></div></div></div>`; }); document.querySelectorAll('.spell-slot-config-row').forEach(row => { const updateVisibility = () => { const total = Math.max(0, parseInt(row.querySelector('.spell-config-total').value) || 0); const mode = row.querySelector('.spell-config-regen-mode').value; row.classList.toggle('is-empty', total === 0); row.querySelector('.spell-slot-config-details').classList.toggle('hidden', total === 0 || mode === 'none'); row.querySelector('.spell-config-short-block').classList.toggle('hidden', total === 0 || mode !== 'short_long'); row.querySelector('.spell-config-long-block').classList.toggle('hidden', total === 0 || mode === 'none'); row.querySelector('.spell-config-short-amount').classList.toggle('hidden', row.querySelector('.spell-config-short-type').value === 'all'); row.querySelector('.spell-config-long-amount').classList.toggle('hidden', row.querySelector('.spell-config-long-type').value === 'all'); }; updateVisibility(); row.querySelectorAll('select, input').forEach(el => { el.addEventListener('input', updateVisibility); }); }); document.getElementById('spell-slots-modal').classList.remove('hidden'); } });
        const btnSaveSpellSlots = document.getElementById('btn-save-spell-slots-config'); if(btnSaveSpellSlots) { btnSaveSpellSlots.addEventListener('click', () => { document.querySelectorAll('.spell-slot-config-row').forEach(row => { const lvl = parseInt(row.dataset.lvl); const total = Math.max(0, Math.min(9, parseInt(row.querySelector('.spell-config-total').value) || 0)); spellSlotsData[lvl] = { total: total, used: (spellSlotsData[lvl].used || []).slice(0, total), regenMode: row.querySelector('.spell-config-regen-mode').value, shortType: row.querySelector('.spell-config-short-type').value, shortAmount: Math.max(1, parseInt(row.querySelector('.spell-config-short-amount').value) || 1), longType: row.querySelector('.spell-config-long-type').value, longAmount: Math.max(1, parseInt(row.querySelector('.spell-config-long-amount').value) || 1) }; while(spellSlotsData[lvl].used.length < total) spellSlotsData[lvl].used.push(false); }); setStore('dnd-spell-slots', spellSlotsData); renderSpellSlots(); document.getElementById('spell-slots-modal').classList.add('hidden'); }); }
        function recoverSpellSlotsByRest(restType) { let recovered = 0; spellSlotsData.forEach(data => { if(data.regenMode === 'none' || (restType === 'short' && data.regenMode !== 'short_long')) return; const recoverType = restType === 'short' ? data.shortType : data.longType; const recoverAmount = recoverType === 'all' ? data.total : (restType === 'short' ? data.shortAmount : data.longAmount); let r = 0; for(let i = data.total - 1; i >= 0 && r < recoverAmount; i--) { if(data.used[i]) { data.used[i] = false; r++; recovered++; } } }); setStore('dnd-spell-slots', spellSlotsData); renderSpellSlots(); return recovered; }

        const restModal = document.getElementById('rest-modal'); const restShortContent = document.getElementById('rest-short-content'); const restLongContent = document.getElementById('rest-long-content'); const restHdAvailable = document.getElementById('rest-hd-available'); const restHdMaxDisplay = document.getElementById('rest-hd-max-display'); const restHdSizeDisplay = document.getElementById('rest-hd-size-display'); const restConModDisplay = document.getElementById('rest-con-mod'); const restHpStatus = document.getElementById('rest-hp-status'); const restRollResult = document.getElementById('rest-roll-result'); const btnRollHitDie = document.getElementById('btn-roll-hit-die'); let shortRestRollLog = [];
        if(document.getElementById('btn-close-rest')) document.getElementById('btn-close-rest').addEventListener('click', () => { restModal.classList.add('hidden'); });
        function getConstitutionModifierForRest() { return Math.floor(((parseInt(document.getElementById('stat-con').value) || 10) - 10) / 2); }
        function updateShortRestPanel() { if(!restHdAvailable) return; const hdMax = parseInt(document.getElementById('hd-max').value) || 0; const hdSpent = parseInt(document.getElementById('hd-spent').value) || 0; const available = Math.max(0, hdMax - hdSpent); const hdSize = parseInt(document.getElementById('hd-size').value) || 8; const conMod = getConstitutionModifierForRest(); const currentHp = parseInt(document.getElementById('hp-current').value) || 0; const maxHp = parseInt(document.getElementById('hp-max').value) || 0; restHdAvailable.textContent = available; restHdMaxDisplay.textContent = hdMax; restHdSizeDisplay.textContent = `d${hdSize}`; restConModDisplay.textContent = conMod >= 0 ? `+${conMod}` : `${conMod}`; restHpStatus.textContent = `${currentHp} / ${maxHp}`; btnRollHitDie.disabled = available <= 0; document.getElementById('rest-hd-to-roll').max = available; }
        function recoverAbilitiesByRest(restType) {
            let recovered = 0;
            abilities.forEach(ab => {
                const mode = ab.regenMode || 'long';
                if(mode === 'none') return;                              // aucune récupération
                let recoverType, recoverAmount;
                if(restType === 'short') {
                    if(mode !== 'short' && mode !== 'short_long') return; // un repos court ne récupère que les capacités à repos court
                    recoverType = ab.shortType || 'all';
                    recoverAmount = recoverType === 'all' ? ab.max : (ab.shortAmount || 1);
                } else {
                    // Repos long : restaure long / court+long ; et aussi les capacités « repos court » (règle 5e).
                    if(mode === 'long' || mode === 'short_long') { recoverType = ab.longType || 'all'; recoverAmount = recoverType === 'all' ? ab.max : (ab.longAmount || 1); }
                    else { recoverType = ab.shortType || 'all'; recoverAmount = recoverType === 'all' ? ab.max : (ab.shortAmount || 1); }
                }
                let count = 0;
                for(let i = ab.max - 1; i >= 0 && count < recoverAmount; i--) { if(ab.used[i]) { ab.used[i] = false; count++; recovered++; } }
            });
            setStore('dnd-abilities', abilities); renderAbilities(); return recovered;
        }
        
        document.body.addEventListener('click', (e) => { if(e.target.id === 'btn-short-rest') { document.getElementById('rest-modal-title').innerText = "Repos Court"; restLongContent.classList.add('hidden'); restShortContent.classList.remove('hidden'); shortRestRollLog = []; restRollResult.innerHTML = ``; document.getElementById('rest-hd-to-roll').value = 1; updateShortRestPanel(); restModal.classList.remove('hidden'); } if(e.target.id === 'btn-long-rest') { document.getElementById('rest-modal-title').innerText = "Repos Long"; restShortContent.classList.add('hidden'); restLongContent.classList.remove('hidden'); restModal.classList.remove('hidden'); } });
        if(btnRollHitDie) { btnRollHitDie.addEventListener('click', () => { const hdMax = parseInt(document.getElementById('hd-max').value) || 0; let hdSpent = parseInt(document.getElementById('hd-spent').value) || 0; const available = Math.max(0, hdMax - hdSpent); if(available <= 0) return; let amountToRoll = parseInt(document.getElementById('rest-hd-to-roll').value) || 1; if(amountToRoll > available) amountToRoll = available; if(amountToRoll <= 0) return; const hdSize = parseInt(document.getElementById('hd-size').value) || 8; const conMod = getConstitutionModifierForRest(); const conText = conMod >= 0 ? `+${conMod}` : `${conMod}`; let totalHealed = 0; let rollDetails = []; for(let i=0; i < amountToRoll; i++) { const roll = Math.floor(Math.random() * hdSize) + 1; const healed = Math.max(0, roll + conMod); totalHealed += healed; rollDetails.push(`[${roll}${conText}=${healed}]`); } const currentHp = parseInt(document.getElementById('hp-current').value) || 0; const maxHp = parseInt(document.getElementById('hp-max').value) || 0; const newHp = Math.min(maxHp, currentHp + totalHealed); hdSpent += amountToRoll; document.getElementById('hd-spent').value = hdSpent; setStore('dnd-sheet-hd-spent', hdSpent, false); document.getElementById('hp-current').value = newHp; setStore('dnd-sheet-hp-current', newHp, false); shortRestRollLog.push(`<strong>${amountToRoll}d${hdSize}</strong> : ${rollDetails.join(' + ')} ➔ <span style="color:#2ecc71;">+${totalHealed} PV</span>`); restRollResult.innerHTML = `<p class="rest-log-line" style="font-size:1.2rem;"><strong>Lancé (${amountToRoll} dés) :</strong> ➔ <strong>+${totalHealed} PV</strong></p><p class="rest-log-line">PV : ${currentHp} → ${newHp}</p><div class="rest-roll-history" style="margin-top:10px; border-top:1px dashed var(--primary-color); padding-top:10px;"><strong>Historique :</strong><br>${shortRestRollLog.join('<br>')}</div>`; document.getElementById('rest-hd-to-roll').value = 1; updateShortRestPanel(); updateHpVisuals(); }); }
        if(document.getElementById('btn-confirm-short-rest')) document.getElementById('btn-confirm-short-rest').addEventListener('click', () => { recoverAbilitiesByRest('short'); recoverSpellSlotsByRest('short'); restModal.classList.add('hidden'); });
        if(document.getElementById('btn-confirm-long-rest')) document.getElementById('btn-confirm-long-rest').addEventListener('click', () => { if((parseInt(document.getElementById('hp-current').value) || 0) < 1) { alert("Tu dois avoir au moins 1 PV pour un repos long."); return; } const maxHp = parseInt(document.getElementById('hp-max').value) || 0; if(maxHp > 0) { document.getElementById('hp-current').value = maxHp; setStore('dnd-sheet-hp-current', maxHp, false); } const hdMax = parseInt(document.getElementById('hd-max').value) || 1; const hdSpent = parseInt(document.getElementById('hd-spent').value) || 0; const newSpent = Math.max(0, hdSpent - Math.max(1, Math.floor(hdMax / 2))); document.getElementById('hd-spent').value = newSpent; setStore('dnd-sheet-hd-spent', newSpent, false); recoverSpellSlotsByRest('long'); recoverAbilitiesByRest('long'); updateHpVisuals(); restModal.classList.add('hidden'); window.showAppToast("⛺ Repos long terminé — PV & ressources récupérés", '#2c3e50'); });

        // ===== COMPAGNONS / FAMILIERS (plusieurs par personnage) =====
        // Modèle : dnd-companions = [{ id, name, type, ac, hp, hpMax, hpTemp, speed, init,
        //                              stats:{for,dex,con,int,sag,cha}, attacks:[{id,name,bonus,dmg}],
        //                              notes, collapsed }]
        // Les champs n'ont pas d'id : initGlobalSave() ignore les éléments non identifiés,
        // ce qui évite un double stockage avec les clés dnd-sheet-*.
        const COMP_TYPES = [
            { key: 'familier',   icon: '🦉', label: 'Familier' },
            { key: 'bete',       icon: '🐺', label: 'Compagnon animal' },
            { key: 'monture',    icon: '🐎', label: 'Monture' },
            { key: 'invocation', icon: '✨', label: 'Invocation' },
            { key: 'allie',      icon: '🛡️', label: 'Allié' }
        ];
        const COMP_STATS = [['for', 'FOR'], ['dex', 'DEX'], ['con', 'CON'], ['int', 'INT'], ['sag', 'SAG'], ['cha', 'CHA']];
        const compMod = (v) => Math.floor(((parseInt(v, 10) || 10) - 10) / 2);
        const compModTxt = (v) => { const m = compMod(v); return (m >= 0 ? '+' : '') + m; };
        const compIcon = (t) => (COMP_TYPES.find(x => x.key === t) || COMP_TYPES[0]).icon;

        let companions = getStore('dnd-companions');
        if (!Array.isArray(companions)) {
            // Migration depuis l'ancien compagnon UNIQUE (comp-name / comp-ac / comp-hp / comp-notes)
            const oldName = getStore('dnd-sheet-comp-name', false);
            const oldAc = getStore('dnd-sheet-comp-ac', false);
            const oldHp = getStore('dnd-sheet-comp-hp', false);
            const oldNotes = getStore('dnd-sheet-comp-notes', false);
            companions = (oldName || oldAc || oldHp || oldNotes)
                ? [{ id: 'c' + Date.now(), name: oldName || '', ac: oldAc || '', hp: oldHp || '', notes: oldNotes || '' }]
                : [];
            setStore('dnd-companions', companions);
        }
        // Complète les fiches créées avant l'ajout des caracs / attaques / PV max.
        function normalizeCompanion(c) {
            if (!c.type) c.type = 'familier';
            if (c.hpMax == null || c.hpMax === '') c.hpMax = c.hp || '';
            if (c.hpTemp == null) c.hpTemp = '';
            if (c.speed == null) c.speed = '';
            if (c.init == null) c.init = '';
            if (!c.stats || typeof c.stats !== 'object') c.stats = {};
            COMP_STATS.forEach(([k]) => { if (c.stats[k] == null || c.stats[k] === '') c.stats[k] = 10; });
            if (!Array.isArray(c.attacks)) c.attacks = [];
            if (c.collapsed == null) c.collapsed = false;
            return c;
        }
        // On ne réécrit que si la normalisation a réellement enrichi une fiche,
        // pour éviter une écriture (et une synchro cloud) inutile à chaque chargement.
        const compBeforeNorm = JSON.stringify(companions);
        companions.forEach(normalizeCompanion);
        if (JSON.stringify(companions) !== compBeforeNorm) setStore('dnd-companions', companions);

        function saveCompanions() { clearTimeout(compSaveTimer); setStore('dnd-companions', companions); }
        // Saisie au clavier : on diffère l'écriture (et donc la synchro cloud) pour ne pas
        // déclencher un envoi à chaque caractère tapé — c'est ce qui rendait la frappe saccadée.
        let compSaveTimer = null;
        function saveCompanionsSoon() {
            clearTimeout(compSaveTimer);
            compSaveTimer = setTimeout(() => setStore('dnd-companions', companions), 400);
        }
        window.addEventListener('beforeunload', () => { if (compSaveTimer) saveCompanions(); });

        // Met à jour les badges et la barre de PV SANS re-rendre la carte : un re-rendu
        // pendant la frappe détruisait le champ actif et faisait perdre le focus.
        function refreshCompanionHeader(card, c) {
            const hp = parseInt(c.hp, 10) || 0, hpMax = parseInt(c.hpMax, 10) || 0;
            const temp = parseInt(c.hpTemp, 10) || 0;
            const hpBadge = card.querySelector('.comp-badge-hp');
            if (hpBadge) hpBadge.textContent = '❤️ ' + hp + (hpMax ? '/' + hpMax : '') + (temp ? ' (+' + temp + ')' : '');
            const acBadge = card.querySelector('.comp-badge-ac');
            if (acBadge) acBadge.textContent = '🛡️ ' + (String(c.ac == null ? '' : c.ac).trim() || '—');
            const bar = card.querySelector('.comp-hpbar');
            if (bar) bar.classList.toggle('hidden', !hpMax);
            const fill = card.querySelector('.comp-hpbar-fill');
            if (fill && hpMax) {
                fill.style.width = Math.max(0, Math.min(100, Math.round(hp / hpMax * 100))) + '%';
                fill.classList.toggle('is-low', hp <= hpMax * 0.25);
            }
        }

        // --- PV : les dégâts entament d'abord les PV temporaires (règle D&D) ---
        function applyCompanionHp(c, delta) {
            let hp = parseInt(c.hp, 10) || 0;
            const max = parseInt(c.hpMax, 10) || 0;
            if (delta < 0) {
                let dmg = -delta;
                let temp = parseInt(c.hpTemp, 10) || 0;
                const absorbed = Math.min(temp, dmg);
                temp -= absorbed; dmg -= absorbed;
                c.hpTemp = temp > 0 ? temp : '';
                hp = Math.max(0, hp - dmg);
            } else {
                hp += delta;
                if (max) hp = Math.min(hp, max);
            }
            c.hp = hp;
        }

        // --- Jets liés au compagnon (réutilisent le lanceur de dés de la fiche) ---
        function companionRoll(c, label, mod, advMode) {
            performAbilityRoll((c.name || 'Compagnon') + ' — ' + label, mod, advMode || 'normal');
        }
        function companionDamageRoll(c, atk) {
            const res = rollExpression(atk.dmg);
            if (res.error) { if (window.showAppToast) window.showAppToast('⚠️ ' + res.error, '#c0392b'); return; }
            const label = (c.name || 'Compagnon') + ' — ' + (atk.name || 'attaque') + ' (dégâts)';
            if (window.PlayerSession && window.PlayerSession.shareRoll) window.PlayerSession.shareRoll(label, res.total, res.detail, null);
            pushRollHistory(label, res.total, res.detail, null);
            if (window.showAppToast) window.showAppToast('💥 ' + res.total + ' dégâts');
        }

        function renderCompanions() {
            const list = document.getElementById('companions-list'); if (!list) return;
            if (!companions.length) { list.innerHTML = `<div class="compact-empty">Aucun compagnon — clique sur ➕ Ajouter.</div>`; return; }
            list.innerHTML = companions.map((c, i) => {
                const hp = parseInt(c.hp, 10) || 0, hpMax = parseInt(c.hpMax, 10) || 0;
                const pct = hpMax ? Math.max(0, Math.min(100, Math.round(hp / hpMax * 100))) : 0;
                const low = hpMax && hp <= hpMax * 0.25;
                const temp = parseInt(c.hpTemp, 10) || 0;

                const statsHtml = COMP_STATS.map(([k, lbl]) => `
                    <div class="comp-stat">
                        <label>${lbl}</label>
                        <input type="number" data-cs="${k}" value="${escAb(c.stats[k])}" min="1" max="30">
                        <button type="button" class="comp-mod" data-croll="${k}" title="Lancer un jet de ${lbl} pour ce compagnon">${compModTxt(c.stats[k])}</button>
                    </div>`).join('');

                const attacksHtml = c.attacks.length
                    ? c.attacks.map((a, ai) => `
                        <div class="comp-atk" data-ai="${ai}">
                            <input type="text" data-af="name" value="${escAb(a.name)}" placeholder="Morsure…">
                            <input type="text" data-af="bonus" value="${escAb(a.bonus)}" placeholder="+4" title="Bonus au toucher">
                            <input type="text" data-af="dmg" value="${escAb(a.dmg)}" placeholder="1d6+2" title="Dégâts (ex : 1d6+2)">
                            <button type="button" class="comp-atk-roll" data-aact="hit" title="Jet d'attaque">🎯</button>
                            <button type="button" class="comp-atk-roll" data-aact="dmg" title="Jet de dégâts">💥</button>
                            <button type="button" class="comp-atk-del" data-aact="del" title="Supprimer cette attaque">🗑</button>
                        </div>`).join('')
                    : `<div class="comp-atk-empty">Aucune attaque enregistrée.</div>`;

                return `<div class="companion-card${c.collapsed ? ' is-collapsed' : ''}" data-ci="${i}">
                    <div class="companion-head">
                        <button type="button" class="comp-fold no-print" data-cact="fold" title="${c.collapsed ? 'Déplier' : 'Replier'}">${c.collapsed ? '▶' : '▼'}</button>
                        <select data-cf="type" class="comp-type" title="Type de compagnon">
                            ${COMP_TYPES.map(t => `<option value="${t.key}"${c.type === t.key ? ' selected' : ''}>${t.icon} ${t.label}</option>`).join('')}
                        </select>
                        <input type="text" data-cf="name" value="${escAb(c.name)}" placeholder="Nom du compagnon…">
                        <span class="comp-badge comp-badge-hp" title="Points de vie">❤️ ${hp}${hpMax ? '/' + hpMax : ''}${temp ? ' (+' + temp + ')' : ''}</span>
                        <span class="comp-badge comp-badge-ac" title="Classe d'armure">🛡️ ${escAb(c.ac) || '—'}</span>
                        <div class="comp-head-actions no-print">
                            <button type="button" class="comp-act" data-cact="up" title="Monter"${i === 0 ? ' disabled' : ''}>▲</button>
                            <button type="button" class="comp-act" data-cact="down" title="Descendre"${i === companions.length - 1 ? ' disabled' : ''}>▼</button>
                            <button type="button" class="comp-act" data-cact="dup" title="Dupliquer ce compagnon">⧉</button>
                            <button type="button" class="comp-act companion-del" data-cact="del" title="Supprimer ce compagnon">🗑</button>
                        </div>
                    </div>
                    <div class="companion-body">
                        <div class="comp-vitals">
                            <div class="comp-stat"><label>CA</label><input type="number" data-cf="ac" value="${escAb(c.ac)}"></div>
                            <div class="comp-stat"><label>PV</label><input type="number" data-cf="hp" value="${escAb(c.hp)}"></div>
                            <div class="comp-stat"><label>PV max</label><input type="number" data-cf="hpMax" value="${escAb(c.hpMax)}"></div>
                            <div class="comp-stat"><label>PV temp</label><input type="number" data-cf="hpTemp" value="${escAb(c.hpTemp)}"></div>
                            <div class="comp-stat"><label>Vitesse</label><input type="text" data-cf="speed" value="${escAb(c.speed)}" placeholder="9 m"></div>
                            <div class="comp-stat"><label>Init.</label><button type="button" class="comp-mod" data-croll="init" title="Lancer l'initiative">${compModTxt(c.stats.dex)}</button></div>
                        </div>
                        <div class="comp-hpbar no-print${hpMax ? '' : ' hidden'}"><div class="comp-hpbar-fill${low ? ' is-low' : ''}" style="width:${pct}%"></div></div>
                        <div class="comp-hp-controls no-print">
                            <input type="number" class="comp-hp-amount" data-camount="1" value="1" min="1" title="Montant à appliquer">
                            <button type="button" class="comp-hp-btn is-dmg" data-cact="dmg">− Dégâts</button>
                            <button type="button" class="comp-hp-btn is-heal" data-cact="heal">+ Soins</button>
                        </div>
                        <div class="comp-stats-grid">${statsHtml}</div>
                        <div class="comp-section-label">⚔️ Attaques</div>
                        <div class="comp-atk-list">${attacksHtml}</div>
                        <button type="button" class="comp-add-atk no-print" data-cact="addatk">➕ Ajouter une attaque</button>
                        <textarea data-cf="notes" class="auto-expand" placeholder="Capacités, traits, notes de suivi…">${escAb(c.notes)}</textarea>
                    </div>
                </div>`;
            }).join('');
            list.querySelectorAll('.auto-expand').forEach(t => adjustHeight(t));
        }

        const companionsList = document.getElementById('companions-list');
        if (companionsList) {
            // --- Saisie (texte, nombres, select) ---
            companionsList.addEventListener('input', (e) => {
                const card = e.target.closest('.companion-card'); if (!card) return;
                const c = companions[parseInt(card.dataset.ci, 10)]; if (!c) return;
                const t = e.target;
                if (t.dataset.cf) {
                    c[t.dataset.cf] = t.value;
                    saveCompanionsSoon();
                    if (t.classList.contains('auto-expand')) adjustHeight(t);
                    // Badges et barre de PV mis à jour en place, sans re-rendre la carte.
                    if (['ac', 'hp', 'hpMax', 'hpTemp'].indexOf(t.dataset.cf) >= 0) refreshCompanionHeader(card, c);
                } else if (t.dataset.cs) {
                    c.stats[t.dataset.cs] = t.value;
                    saveCompanionsSoon();
                    const btn = t.parentElement.querySelector('.comp-mod');
                    if (btn) btn.textContent = compModTxt(t.value);
                } else if (t.dataset.af) {
                    const atk = c.attacks[parseInt(t.closest('.comp-atk').dataset.ai, 10)];
                    if (atk) { atk[t.dataset.af] = t.value; saveCompanionsSoon(); }
                }
            });
            // `change` sert à deux choses : le <select> de type, et surtout la sortie de
            // champ — on force alors l'écriture différée, pour ne jamais perdre une saisie.
            companionsList.addEventListener('change', (e) => {
                if (e.target.classList.contains('comp-type')) {
                    const card = e.target.closest('.companion-card');
                    const c = card && companions[parseInt(card.dataset.ci, 10)];
                    if (c) c.type = e.target.value;
                }
                saveCompanions();
            });
            // --- Boutons ---
            companionsList.addEventListener('click', (e) => {
                const btn = e.target.closest('button'); if (!btn) return;
                const card = e.target.closest('.companion-card'); if (!card) return;
                const i = parseInt(card.dataset.ci, 10);
                const c = companions[i]; if (!c) return;

                // Jets de caracs / initiative
                if (btn.dataset.croll) {
                    const k = btn.dataset.croll;
                    if (k === 'init') companionRoll(c, 'Initiative', compMod(c.stats.dex));
                    else companionRoll(c, (COMP_STATS.find(s => s[0] === k) || [, k])[1], compMod(c.stats[k]));
                    return;
                }
                // Actions sur une attaque
                const atkRow = e.target.closest('.comp-atk');
                if (atkRow && btn.dataset.aact) {
                    const ai = parseInt(atkRow.dataset.ai, 10);
                    const atk = c.attacks[ai]; if (!atk) return;
                    if (btn.dataset.aact === 'hit') companionRoll(c, (atk.name || 'Attaque'), parseInt(atk.bonus, 10) || 0);
                    else if (btn.dataset.aact === 'dmg') companionDamageRoll(c, atk);
                    else if (btn.dataset.aact === 'del') { c.attacks.splice(ai, 1); saveCompanions(); renderCompanions(); }
                    return;
                }
                switch (btn.dataset.cact) {
                    case 'fold':
                        c.collapsed = !c.collapsed; saveCompanions(); renderCompanions(); break;
                    case 'up':
                        if (i > 0) { companions.splice(i - 1, 0, companions.splice(i, 1)[0]); saveCompanions(); renderCompanions(); } break;
                    case 'down':
                        if (i < companions.length - 1) { companions.splice(i + 1, 0, companions.splice(i, 1)[0]); saveCompanions(); renderCompanions(); } break;
                    case 'dup': {
                        const copy = JSON.parse(JSON.stringify(c));
                        copy.id = 'c' + Date.now();
                        copy.name = (c.name || 'Compagnon') + ' (copie)';
                        copy.attacks.forEach((a, n) => { a.id = 'a' + Date.now() + n; });
                        companions.splice(i + 1, 0, copy); saveCompanions(); renderCompanions();
                        break;
                    }
                    case 'del':
                        window.deleteWithUndo(companions, i, c.name || 'ce compagnon', saveCompanions, renderCompanions);
                        break;
                    case 'addatk':
                        c.attacks.push({ id: 'a' + Date.now(), name: '', bonus: '', dmg: '' });
                        saveCompanions(); renderCompanions();
                        break;
                    case 'dmg':
                    case 'heal': {
                        const amountEl = card.querySelector('.comp-hp-amount');
                        const amount = Math.abs(parseInt(amountEl && amountEl.value, 10) || 0);
                        if (!amount) return;
                        applyCompanionHp(c, btn.dataset.cact === 'dmg' ? -amount : amount);
                        saveCompanions(); renderCompanions();
                        // On restitue le montant saisi : pratique pour réappliquer le même coup.
                        const again = document.querySelectorAll('#companions-list .companion-card')[i];
                        const field = again && again.querySelector('.comp-hp-amount');
                        if (field) field.value = amount;
                        break;
                    }
                }
            });
        }
        const btnAddCompanion = document.getElementById('btn-add-companion');
        if (btnAddCompanion) btnAddCompanion.addEventListener('click', () => {
            companions.push(normalizeCompanion({ id: 'c' + Date.now(), name: '', ac: '', hp: '', notes: '' }));
            saveCompanions(); renderCompanions();
            const last = document.querySelector('#companions-list .companion-card:last-child input[data-cf="name"]'); if (last) last.focus();
        });

        let spells = getStore('dnd-spells') || [];
        // --- Composantes de sort (V/S/M) : cases à cocher + matériaux ---
        // sp.comp = { v, s, m, mat } (source de vérité) ; sp.res = chaîne d'affichage
        // composée automatiquement (« V, S, M (une perle…) ») pour compatibilité.
        function spellResString(c) {
            if (!c) return '';
            const parts = [];
            if (c.v) parts.push('V');
            if (c.s) parts.push('S');
            if (c.m) parts.push('M' + (c.mat ? ' (' + c.mat + ')' : ''));
            return parts.join(', ');
        }
        // Rétro-compatibilité : déduit les cases depuis l'ancien champ texte libre.
        function parseSpellRes(res) {
            res = String(res || '');
            const mat = (res.match(/\(([^)]*)\)/) || [])[1] || '';
            const flat = res.replace(/\([^)]*\)/g, '');
            const has = (k) => new RegExp('(^|[,;\\s/])' + k + '(?=$|[,;\\s/.])', 'i').test(flat);
            return { v: has('V'), s: has('S'), m: has('M'), mat: mat.trim() };
        }
        function readSpellCompForm() {
            const g = id => document.getElementById(id);
            const m = g('new-spell-comp-m').checked;
            return { v: g('new-spell-comp-v').checked, s: g('new-spell-comp-s').checked, m: m, mat: m ? g('new-spell-comp-mat').value.trim() : '' };
        }
        function fillSpellCompForm(comp) {
            const g = id => document.getElementById(id);
            const c = comp || { v: false, s: false, m: false, mat: '' };
            g('new-spell-comp-v').checked = !!c.v; g('new-spell-comp-s').checked = !!c.s; g('new-spell-comp-m').checked = !!c.m;
            g('new-spell-comp-mat').value = c.mat || '';
            g('new-spell-comp-mat').classList.toggle('hidden', !c.m);
        }
        const compMCheckbox = document.getElementById('new-spell-comp-m');
        if (compMCheckbox) compMCheckbox.addEventListener('change', () => {
            document.getElementById('new-spell-comp-mat').classList.toggle('hidden', !compMCheckbox.checked);
        });
        function renderPinnedSpells() { const list = document.getElementById('spells-list'); if(!list) return; list.innerHTML = ''; spells.forEach((sp, index) => { if(!sp.pinned) return; list.innerHTML += `<div class="item-card spell-card"><div class="item-card-header"><h4>Niv.${sp.level||0} - ${sp.name}</h4><div class="item-controls no-print"><button title="Monter" onclick="moveSpellUp(${index})">▲</button><button title="Descendre" onclick="moveSpellDown(${index})">▼</button><button class="btn-pin pinned" onclick="togglePin(${index})">📍</button></div></div><div class="item-details"><span>⏱️ ${sp.time}</span><span>📏 ${sp.range}</span>${sp.duration ? `<span>⏳ ${sp.duration}</span>` : ''}${sp.res ? `<span>💎 ${sp.res}</span>` : ''}</div><p><em>${sp.desc}</em></p>${sp.notes ? `<p><small>📝 ${sp.notes}</small></p>` : ''}</div>`; }); }
        function renderGrimoire() { const content = document.getElementById('grimoire-content'); if(!content) return; content.innerHTML = ''; let grouped = {}; spells.forEach((sp, index) => { let lvl = parseInt(sp.level) || 0; if(!grouped[lvl]) grouped[lvl] = []; grouped[lvl].push({ ...sp, originalIndex: index }); }); let levels = Object.keys(grouped).sort((a,b) => a - b); levels.forEach(lvl => { let sortedSpells = grouped[lvl].sort((a,b) => a.name.localeCompare(b.name)); let lvlHtml = `<div class="spell-level-group"><h3 class="spell-level-title">Niveau ${lvl} ${lvl == 0 ? '(Tours de magie)' : ''}</h3>`; sortedSpells.forEach(sp => { let pinClass = sp.pinned ? 'pinned' : ''; let pinText = sp.pinned ? '📍 Épinglé' : '📌 Épingler'; lvlHtml += `<div class="item-card spell-card"><div class="item-card-header"><h4>${sp.name}</h4><div class="item-controls"><button class="btn-pin ${pinClass}" onclick="togglePin(${sp.originalIndex})">${pinText}</button><button title="Modifier" onclick="editSpell(${sp.originalIndex})">✎</button><button title="Supprimer" class="btn-del" onclick="deleteSpell(${sp.originalIndex})">X</button></div></div><div class="item-details"><span>⏱️ ${sp.time}</span><span>📏 ${sp.range}</span>${sp.duration ? `<span>⏳ ${sp.duration}</span>` : ''}${sp.res ? `<span>💎 ${sp.res}</span>` : ''}</div><p><em>${sp.desc}</em></p>${sp.notes ? `<p><small>📝 ${sp.notes}</small></p>` : ''}</div>`; }); lvlHtml += `</div>`; content.innerHTML += lvlHtml; }); if(levels.length === 0) content.innerHTML = "<p style='text-align:center;'>Le grimoire est vide.</p>"; }
        
        function renderPreparedSpells() {
            const list = document.getElementById('prepared-spells-list');
            const countEl = document.getElementById('prepared-spell-count');
            if(!list) return;

            let preparedSpells = spells.filter(sp => sp.prepared);
            if (countEl) countEl.textContent = `${preparedSpells.length} préparés`;

            list.innerHTML = '';
            if (preparedSpells.length === 0) {
                list.innerHTML = '<span style="font-size:0.8rem; color:#888; font-style:italic;">Aucun sort préparé.</span>';
                return;
            }

            let grouped = {};
            preparedSpells.forEach(sp => {
                let lvl = parseInt(sp.level) || 0;
                if(!grouped[lvl]) grouped[lvl] = [];
                grouped[lvl].push(sp);
            });

            let levels = Object.keys(grouped).sort((a,b) => a - b);
            levels.forEach(lvl => {
                let lvlHtml = `<div class="prepared-level-group"><div class="prepared-level-header">Niveau ${lvl}</div>`;
                grouped[lvl].sort((a,b) => a.name.localeCompare(b.name)).forEach(sp => {
                    lvlHtml += `<div class="prepared-spell-row">
                        <span class="prepared-spell-name">${sp.name}</span>
                        <span class="prepared-spell-meta">⏱️ ${sp.time}${sp.duration ? ` • ⏳ ${sp.duration}` : ''}</span>
                    </div>`;
                });
                lvlHtml += `</div>`;
                list.innerHTML += lvlHtml;
            });
        }

        function renderPrepareModalList() {
            const checklist = document.getElementById('prepare-spells-checklist');
            const search = document.getElementById('prepare-search')?.value.toLowerCase() || "";
            const filterLvl = document.getElementById('prepare-filter-level')?.value || "";

            if (!checklist) return;
            checklist.innerHTML = '';

            let filtered = spells.filter(sp => {
                if (search && !sp.name.toLowerCase().includes(search)) return false;
                if (filterLvl !== "" && String(sp.level||0) !== filterLvl) return false;
                return true;
            });

            if (filtered.length === 0) {
                checklist.innerHTML = '<p style="text-align:center; color:#888; font-style:italic;">Aucun sort correspondant.</p>';
                return;
            }

            filtered.sort((a,b) => (parseInt(a.level)||0) - (parseInt(b.level)||0) || a.name.localeCompare(b.name)).forEach((sp) => {
                const originalIndex = spells.indexOf(sp);
                const isChecked = sp.prepared ? 'checked' : '';
                checklist.innerHTML += `
                    <label class="prepared-spell-row prepare-spell-row" style="cursor:pointer; display:flex; align-items:center; gap:10px;">
                        <input type="checkbox" style="transform:scale(1.2);" ${isChecked} onchange="toggleSpellPrepared(${originalIndex}, this.checked)">
                        <div style="flex:1;">
                            <div class="prepared-spell-name">${sp.name}</div>
                            <div class="prepared-spell-meta">Niv. ${sp.level||0} • ${sp.time}</div>
                        </div>
                    </label>
                `;
            });
        }

        window.toggleSpellPrepared = (index, isPrepared) => {
            spells[index].prepared = isPrepared;
            setStore('dnd-spells', spells);
            renderPreparedSpells();
        };

        const prepareSearchInput = document.getElementById('prepare-search');
        if (prepareSearchInput) prepareSearchInput.addEventListener('input', renderPrepareModalList);

        const prepareFilterLevel = document.getElementById('prepare-filter-level');
        if (prepareFilterLevel) prepareFilterLevel.addEventListener('change', renderPrepareModalList);

        const spellModal = document.getElementById('spell-form-modal');
        document.body.addEventListener('click', (e) => { 
            if(e.target.id === 'btn-open-spell-add') { 
                editingSpellIndex = -1; 
                document.getElementById('spell-modal-title').textContent = "Inscrire un Sort"; 
                document.querySelectorAll('#spell-form-modal input[type="text"], #spell-form-modal input[type="number"]').forEach(i => i.value = '');
                fillSpellCompForm(null);
                quillNewSpell.root.innerHTML = '';
                spellModal.classList.remove('hidden');
            }
            
            if (e.target.id === 'btn-open-prepare-spells') {
                document.getElementById('prepare-spells-modal').classList.remove('hidden');
                document.getElementById('prepare-search').value = '';
                document.getElementById('prepare-filter-level').value = '';
                renderPrepareModalList();
            }
        });

        if(document.getElementById('btn-close-prepare-spells')) {
            document.getElementById('btn-close-prepare-spells').addEventListener('click', () => {
                document.getElementById('prepare-spells-modal').classList.add('hidden');
            });
        }

        if(document.getElementById('btn-add-spell')) { document.getElementById('btn-add-spell').addEventListener('click', () => { const comp = readSpellCompForm(); const sp = { name: document.getElementById('new-spell-name').value, level: document.getElementById('new-spell-level').value || 0, time: document.getElementById('new-spell-time').value, range: document.getElementById('new-spell-range').value, duration: document.getElementById('new-spell-duration').value, comp: comp, res: spellResString(comp), desc: quillNewSpell.root.innerHTML, notes: document.getElementById('new-spell-notes').value, pinned: document.getElementById('new-spell-pinned').checked, prepared: editingSpellIndex >= 0 ? spells[editingSpellIndex].prepared : false }; if(sp.name) { if(editingSpellIndex >= 0) { spells[editingSpellIndex] = sp; } else { spells.push(sp); } setStore('dnd-spells', spells); renderPinnedSpells(); renderGrimoire(); renderPreparedSpells(); spellModal.classList.add('hidden'); } }); }
        window.togglePin = (index) => { spells[index].pinned = !spells[index].pinned; setStore('dnd-spells', spells); renderPinnedSpells(); renderGrimoire(); }; window.deleteSpell = (index) => { if(confirm("Oublier ce sort ?")) { spells.splice(index, 1); setStore('dnd-spells', spells); renderPinnedSpells(); renderGrimoire(); renderPreparedSpells(); }}; window.moveSpellUp = (index) => { let prevIndex = -1; for(let i = index - 1; i >= 0; i--) { if(spells[i].pinned) { prevIndex = i; break; } } if(prevIndex !== -1) { [spells[prevIndex], spells[index]] = [spells[index], spells[prevIndex]]; setStore('dnd-spells', spells); renderPinnedSpells(); }}; window.moveSpellDown = (index) => { let nextIndex = -1; for(let i = index + 1; i < spells.length; i++) { if(spells[i].pinned) { nextIndex = i; break; } } if(nextIndex !== -1) { [spells[nextIndex], spells[index]] = [spells[index], spells[nextIndex]]; setStore('dnd-spells', spells); renderPinnedSpells(); }}; window.editSpell = (index) => { const data = spells[index]; document.getElementById('new-spell-name').value = data.name; document.getElementById('new-spell-level').value = data.level; document.getElementById('new-spell-time').value = data.time; document.getElementById('new-spell-range').value = data.range; document.getElementById('new-spell-duration').value = data.duration || ''; fillSpellCompForm(data.comp || parseSpellRes(data.res)); quillNewSpell.root.innerHTML = data.desc; document.getElementById('new-spell-notes').value = data.notes; document.getElementById('new-spell-pinned').checked = data.pinned; editingSpellIndex = index; document.getElementById('spell-modal-title').textContent = "Modifier le Sort"; spellModal.classList.remove('hidden'); };
        const grimoireModal = document.getElementById('grimoire-modal'); document.body.addEventListener('click', (e) => { if(e.target.id === 'btn-open-grimoire') { renderGrimoire(); grimoireModal.classList.remove('hidden', 'closing'); grimoireModal.classList.add('opening'); } }); if(document.getElementById('btn-close-grimoire')) document.getElementById('btn-close-grimoire').addEventListener('click', () => { if(grimoireModal.classList.contains('closing')) return; grimoireModal.classList.remove('opening'); grimoireModal.classList.add('closing'); setTimeout(() => { grimoireModal.classList.add('hidden'); grimoireModal.classList.remove('closing'); }, 1000); });

        let journal = getStore('dnd-journal') || []; const journalPage = document.getElementById('book-page-content');
        // Animation « page qui tourne » rejouée à chaque changement de contenu du livre
        if (journalPage && 'MutationObserver' in window) {
            const flipObserver = new MutationObserver(() => {
                journalPage.classList.remove('page-flip-in');
                void journalPage.offsetWidth; // force un reflow pour rejouer l'animation
                journalPage.classList.add('page-flip-in');
            });
            flipObserver.observe(journalPage, { childList: true });
        }
        window.renderJournalTOC = () => { if(!journalPage) return; let html = `<h2 class="toc-title">Sommaire</h2><div class="toc-list">`; if(journal.length === 0) html += `<p style="text-align:center;">Aucune note dans le journal. Écris un chapitre !</p>`; journal.forEach((entry, i) => { html += `<div class="toc-item"><div class="toc-link" onclick="openJournalEntry(${i})"><span class="toc-title-text">${entry.title}</span><div class="toc-dots"></div></div><div class="toc-controls"><span title="Déchirer la page" onclick="deleteJournalEntry(${i})">❌</span></div></div>`; }); html += `</div>`; journalPage.innerHTML = html; };
        
        window.openJournalEntry = (index) => { 
            const entry = journal[index]; 
            journalPage.innerHTML = `<div class="bookmark-return" onclick="renderJournalTOC()" title="Retour au sommaire">🔖</div><div style="display:flex; justify-content:space-between; align-items:flex-start; margin-top:20px;"><h2 class="note-view-title" style="margin-top:0;">${entry.title}</h2><button class="btn-small no-print" style="background:var(--primary-color);" onclick="editJournalForm(${index})">✎ Modifier</button></div><div class="note-view-content ql-editor" id="view-journal-content">${entry.content}</div><div id="journal-edit-container" class="hidden" style="margin-top: 20px; border-top: 2px dashed rgba(138,28,28,0.25); padding-top: 15px;"><h3 style="font-family:'Cinzel'; color:var(--primary-color); margin-bottom:10px;">Modifier le chapitre</h3><input type="text" id="edit-journal-title" style="width:100%; margin-bottom:10px; font-weight:bold; font-size:1.1rem; border:1px solid rgba(138,28,28,0.25); padding:8px;"><div id="edit-journal-content" style="background: white; color: black; min-height: 200px; border-radius: 4px;"></div><div style="display:flex; gap:10px; margin-top:10px;"><button id="btn-confirm-edit-journal" class="btn-small" style="background:#27ae60;">Sauvegarder</button><button id="btn-cancel-edit-journal" class="btn-small" style="background:#e74c3c;">Annuler</button></div></div>`; 
        };

        window.editJournalForm = (index) => { 
            const entry = journal[index]; 
            document.getElementById('view-journal-content').classList.add('hidden'); 
            document.getElementById('journal-edit-container').classList.remove('hidden'); 
            document.getElementById('edit-journal-title').value = entry.title; 
            
            if(!quillEditJournal) {
                quillEditJournal = new Quill('#edit-journal-content', { theme: 'snow' });
            }
            quillEditJournal.root.innerHTML = entry.content; 
            
            document.getElementById('btn-confirm-edit-journal').onclick = () => { 
                journal[index].title = document.getElementById('edit-journal-title').value.trim(); 
                journal[index].content = quillEditJournal.root.innerHTML; 
                setStore('dnd-journal', journal); 
                openJournalEntry(index); 
            }; 
            document.getElementById('btn-cancel-edit-journal').onclick = () => { openJournalEntry(index); }; 
        };

        window.deleteJournalEntry = (index) => { if(confirm("Déchirer cette page définitivement ?")) { journal.splice(index, 1); setStore('dnd-journal', journal); renderJournalTOC(); } };
        if(document.getElementById('btn-save-journal')) { document.getElementById('btn-save-journal').addEventListener('click', () => { const title = document.getElementById('new-journal-title').value.trim(); const content = quillNewJournal.root.innerHTML; if(title && content !== '<p><br></p>') { journal.push({title, content}); setStore('dnd-journal', journal); document.getElementById('new-journal-title').value = ''; quillNewJournal.root.innerHTML = ''; window.showAppToast("📕 Chapitre enregistré dans le journal", '#27ae60'); } }); }
        function clearBookFlames() { const bc = document.getElementById('book-container'); const f = bc && bc.querySelector('.book-flames'); if(f) f.remove(); }

        function igniteBook() {
            const bc = document.getElementById('book-container'); if(!bc) return;
            clearBookFlames();
            const flames = document.createElement('div');
            flames.className = 'book-flames';
            // 7 langues de feu + 5 braises montantes
            flames.innerHTML = '<span></span><span></span><span></span><span></span><span></span><span></span><span></span><i></i><i></i><i></i><i></i><i></i>';
            bc.appendChild(flames);
        }
        document.body.addEventListener('click', (e) => {
            if(e.target.id === 'btn-open-journal') { const modal = document.getElementById('journal-modal'); clearBookFlames(); modal.classList.remove('hidden', 'book-burning', 'book-closing'); modal.classList.add('book-opening'); renderJournalTOC(); }
            // Fermeture en DEUX temps : la couverture se rabat (0,62 s), PUIS le livre refermé s'embrase.
            if(e.target.id === 'btn-lighter-close') {
                const modal = document.getElementById('journal-modal');
                if(modal.classList.contains('book-closing') || modal.classList.contains('book-burning')) return;   // anti double-clic
                modal.classList.remove('book-opening');
                modal.classList.add('book-closing');
                setTimeout(() => {                       // 780 ms = durée de bookCoverClose
                    igniteBook();
                    modal.classList.add('book-burning');
                    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('book-closing', 'book-burning'); clearBookFlames(); }, 1600);
                }, 800);
            }
        });

        let attacks = getStore('dnd-attacks') || []; let activeAtkTab = 'Tout'; const atkModal = document.getElementById('attack-form-modal');
        function renderAttacks() {
            const list = document.getElementById('attacks-list'); if(!list) return;
            renderTabs('atk-tabs-container', attacks, activeAtkTab, atkCategories, (tab) => { activeAtkTab = tab; renderAttacks(); }, () => { let nouv = prompt("Nouvelle catégorie :"); if(nouv && nouv.trim() !== "" && !atkCategories.includes(nouv.trim())) { atkCategories.push(nouv.trim()); setStore('dnd-atk-categories', atkCategories); updateCategorySelects(); renderAttacks(); } }, () => { openCategoryManager('atk'); });
            list.innerHTML = '';
            const filtered = activeAtkTab === 'Tout' ? attacks : attacks.filter(a => (a.category || 'Général') === activeAtkTab);
            if(filtered.length === 0) { list.innerHTML = `<div class="compact-empty">Aucune attaque — clique sur ➕ Ajouter ci-dessus.</div>`; return; }
            filtered.forEach(atk => {
                const originalIndex = attacks.indexOf(atk);
                const attuneHtml = atk.reqAttune ? `<label class="atk-attune ${atk.isAttuned ? 'on' : ''}" title="Objet lié ?"><input type="checkbox" ${atk.isAttuned ? 'checked' : ''} onchange="toggleAttune(${originalIndex})">Lié</label>` : '';
                // Munitions (optionnelles) : − = tirer, + = récupérer. Rouge quand il n'en reste plus.
                const hasAmmo = atk.ammo !== undefined && atk.ammo !== null && atk.ammo !== '';
                const ammoHtml = hasAmmo ? `<span class="atk-ammo${(parseInt(atk.ammo, 10) || 0) <= 0 ? ' is-empty' : ''}" title="Munitions restantes">🏹 <button class="ammo-minus" title="Tirer (−1)">−</button><b>${atk.ammo}${atk.ammoMax ? '/' + atk.ammoMax : ''}</b><button class="ammo-plus" title="Récupérer (+1)">+</button></span>` : '';
                list.innerHTML += `<div class="ca-row atk-row" data-i="${originalIndex}"><div class="ca-head"><span class="ca-name">⚔️ ${atk.name}</span>${attuneHtml}<span class="atk-stat" title="Bonus / DD">🎯 ${atk.bonus || '—'}</span><span class="atk-stat" title="Dégâts">💥 ${atk.dmg || '—'}</span>${ammoHtml}<div class="ca-actions"><button class="ci-up" title="Monter">▲</button><button class="ci-down" title="Descendre">▼</button><button class="ci-edit" title="Modifier">✎</button><button class="ci-del" title="Supprimer">🗑</button></div></div>${atk.notes ? `<div class="atk-notes">📝 ${atk.notes}</div>` : ''}</div>`;
            });
        }
        const atkListContainer = document.getElementById('attacks-list');
        if(atkListContainer) atkListContainer.addEventListener('click', (e) => {
            const row = e.target.closest('.ca-row'); if(!row) return; const index = parseInt(row.dataset.i);
            if(e.target.closest('.ammo-minus')) { const a = attacks[index]; const n = parseInt(a.ammo, 10) || 0; if(n > 0) { a.ammo = n - 1; setStore('dnd-attacks', attacks); renderAttacks(); } else if(window.showAppToast) window.showAppToast('🏹 Plus de munitions !', '#c0392b'); return; }
            if(e.target.closest('.ammo-plus')) { const a = attacks[index]; const n = parseInt(a.ammo, 10) || 0; const max = parseInt(a.ammoMax, 10) || 0; a.ammo = max > 0 ? Math.min(n + 1, max) : n + 1; setStore('dnd-attacks', attacks); renderAttacks(); return; }
            if(e.target.closest('.ci-up')) { if(window.moveAttackUp) window.moveAttackUp(index); return; }
            if(e.target.closest('.ci-down')) { if(window.moveAttackDown) window.moveAttackDown(index); return; }
            if(e.target.closest('.ci-edit')) { if(window.editAttack) window.editAttack(index); return; }
            if(e.target.closest('.ci-del')) { if(window.deleteAttack) window.deleteAttack(index); return; }
        });
        document.body.addEventListener('click', (e) => { if(e.target.id === 'btn-open-attack-modal') { editingAttackIndex = -1; atkModal.classList.remove('hidden'); document.querySelectorAll('#attack-form-modal input[type="text"], #attack-form-modal input[type="number"]').forEach(i => i.value = ''); document.getElementById('new-atk-req-attune').checked = false; }});
        if(document.getElementById('btn-save-atk')) { document.getElementById('btn-save-atk').addEventListener('click', () => { const ammoRaw = document.getElementById('new-atk-ammo').value.trim(); const ammoMaxRaw = document.getElementById('new-atk-ammo-max').value.trim(); const atk = { name: document.getElementById('new-atk-name').value, bonus: document.getElementById('new-atk-bonus').value, dmg: document.getElementById('new-atk-dmg').value, category: document.getElementById('new-atk-category').value.trim() || 'Général', notes: document.getElementById('new-atk-notes').value, reqAttune: document.getElementById('new-atk-req-attune').checked, isAttuned: false, ammo: ammoRaw === '' ? null : (parseInt(ammoRaw, 10) || 0), ammoMax: ammoMaxRaw === '' ? null : (parseInt(ammoMaxRaw, 10) || 0) }; if(atk.name) { if(editingAttackIndex >= 0) { atk.isAttuned = attacks[editingAttackIndex].isAttuned; attacks[editingAttackIndex] = atk; } else { attacks.push(atk); } setStore('dnd-attacks', attacks); renderAttacks(); atkModal.classList.add('hidden'); } }); }
        window.toggleAttune = (index) => { attacks[index].isAttuned = !attacks[index].isAttuned; setStore('dnd-attacks', attacks); }; window.deleteAttack = (index) => { if(confirm("Supprimer ?")) { attacks.splice(index, 1); setStore('dnd-attacks', attacks); renderAttacks(); }}; window.moveAttackUp = (index) => { if(moveWithinFilter(attacks, index, -1, a => activeAtkTab === 'Tout' ? true : (a.category || 'Général') === activeAtkTab)) { setStore('dnd-attacks', attacks); renderAttacks(); } }; window.moveAttackDown = (index) => { if(moveWithinFilter(attacks, index, 1, a => activeAtkTab === 'Tout' ? true : (a.category || 'Général') === activeAtkTab)) { setStore('dnd-attacks', attacks); renderAttacks(); } }; window.editAttack = (index) => { const data = attacks[index]; document.getElementById('new-atk-name').value = data.name; document.getElementById('new-atk-bonus').value = data.bonus; document.getElementById('new-atk-dmg').value = data.dmg; document.getElementById('new-atk-category').value = data.category || 'Général'; document.getElementById('new-atk-notes').value = data.notes; document.getElementById('new-atk-req-attune').checked = data.reqAttune; document.getElementById('new-atk-ammo').value = (data.ammo === null || data.ammo === undefined) ? '' : data.ammo; document.getElementById('new-atk-ammo-max').value = (data.ammoMax === null || data.ammoMax === undefined) ? '' : data.ammoMax; editingAttackIndex = index; atkModal.classList.remove('hidden'); };

        let inventory = getStore('dnd-inventory') || []; let activeInvTabPinned = 'Tout'; let invSearch = ''; let invSortMode = getStore('dnd-inv-sort', false) || 'manual'; let activeInvTabModal = 'Tout';
        const invAttr = (s) => String(s == null ? '' : s).replace(/"/g, '&quot;');

        function renderInventory() {
            const listEl = document.getElementById('pinned-inventory-list'); if(!listEl) return;
            const onAddInvCat = () => { let nouv = prompt("Nouvelle catégorie :"); if(nouv && nouv.trim() !== "" && !invCategories.includes(nouv.trim())) { invCategories.push(nouv.trim()); setStore('dnd-inv-categories', invCategories); updateCategorySelects(); renderInventory(); } };
            renderTabs('inv-tabs-container-pinned', inventory, activeInvTabPinned, invCategories, (tab) => { activeInvTabPinned = tab; renderInventory(); }, onAddInvCat, () => { openCategoryManager('inv'); });

            let totalWeight = 0; inventory.forEach(item => { let w = parseFloat(item.weight); let q = parseInt(item.qty) || 1; if(!isNaN(w)) totalWeight += (w * q); });

            // Recherche + tri : on part des objets de l'onglet courant, on filtre sur le nom,
            // puis on trie. Les favoris et les objets équipés restent groupés en tête.
            const needle = invSearch.trim().toLowerCase();
            let entries = inventory.map((item, index) => ({ item, index }))
                .filter(({ item }) => activeInvTabPinned === 'Tout' || (item.category || 'Général') === activeInvTabPinned)
                .filter(({ item }) => !needle || String(item.name || '').toLowerCase().includes(needle));

            const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
            if (invSortMode === 'name') entries.sort((a, b) => String(a.item.name || '').localeCompare(String(b.item.name || ''), 'fr', { sensitivity: 'base' }));
            else if (invSortMode === 'weight') entries.sort((a, b) => num(b.item.weight) - num(a.item.weight));
            else if (invSortMode === 'qty') entries.sort((a, b) => (parseInt(b.item.qty, 10) || 1) - (parseInt(a.item.qty, 10) || 1));
            // Favoris d'abord, puis équipés — tri stable, donc l'ordre choisi ci-dessus est conservé.
            entries.sort((a, b) => (b.item.equipped ? 1 : 0) - (a.item.equipped ? 1 : 0));
            entries.sort((a, b) => (b.item.pinned ? 1 : 0) - (a.item.pinned ? 1 : 0));

            listEl.innerHTML = '';
            if(entries.length === 0) {
                listEl.innerHTML = `<div class="compact-empty">${inventory.length === 0 ? 'Sac vide — ajoute un objet ci-dessus.' : (needle ? 'Aucun objet ne correspond à « ' + escAb(invSearch) + ' ».' : 'Aucun objet dans cet onglet.')}</div>`;
            } else {
                entries.forEach(({ item, index }) => {
                    if(editingInvIndex === index) {
                        const cats = `<option value="Général">Général</option>` + invCategories.map(c => `<option value="${invAttr(c)}" ${(item.category || 'Général') === c ? 'selected' : ''}>${c}</option>`).join('');
                        listEl.innerHTML += `<div class="ci-row ci-editing" data-i="${index}"><div class="ci-edit-form"><input class="qa-input qa-grow ci-e-name" value="${invAttr(item.name)}" placeholder="Nom"><input type="number" min="1" class="qa-input qa-num ci-e-qty" value="${parseInt(item.qty) || 1}"><input class="qa-input qa-num ci-e-weight" value="${invAttr(item.weight === '-' ? '' : item.weight)}" placeholder="Poids"><select class="qa-input qa-cat ci-e-cat">${cats}</select><button class="qa-add ci-e-save" title="Enregistrer">✓</button><button class="ci-e-cancel" title="Annuler" style="background:none; border:none; cursor:pointer; font-size:1.1rem; color:#9a8a70;">✕</button></div></div>`;
                        return;
                    }
                    const weightTxt = (item.weight !== undefined && item.weight !== null && item.weight !== '-' && String(item.weight).trim() !== '') ? item.weight : '—';
                    const eq = !!item.equipped;
                    listEl.innerHTML += `<div class="ci-row${item.pinned ? ' is-pinned' : ''}${eq ? ' is-equipped' : ''}" data-i="${index}"><button class="ci-pin" title="${item.pinned ? 'Retirer des favoris' : 'Mettre en favori'}">${item.pinned ? '📌' : '☆'}</button><button class="ci-equip${eq ? ' is-on' : ''}" title="${eq ? 'Déséquiper' : 'Équiper'}">⚔️</button><span class="ci-name" title="${invAttr(item.name)}">${item.name}</span><div class="ci-qty"><button class="ci-step" data-act="dec" title="-1">−</button><span class="ci-qval">${parseInt(item.qty) || 1}</span><button class="ci-step" data-act="inc" title="+1">＋</button></div><span class="ci-weight">${weightTxt}</span><div class="ci-actions">${invSortMode === 'manual' ? `<button class="ci-up" title="Monter">▲</button><button class="ci-down" title="Descendre">▼</button>` : ''}<button class="ci-edit" title="Modifier">✎</button><button class="ci-del" title="Supprimer">🗑</button></div></div>`;
                });
            }
            const weightDisplay = document.getElementById('inv-total-weight');
            if(weightDisplay) weightDisplay.textContent = `${(totalWeight % 1 !== 0) ? totalWeight.toFixed(2) : totalWeight} • ${inventory.length} objet${inventory.length > 1 ? 's' : ''}`;
        }

        // Réordonne un objet dans l'ordre affiché (sans franchir la frontière favoris/non-favoris)
        function moveInvInView(realIndex, dir) {
            const entries = inventory.map((item, i) => ({ item, i })).filter(({ item }) => activeInvTabPinned === 'Tout' || (item.category || 'Général') === activeInvTabPinned);
            entries.sort((a, b) => (b.item.pinned ? 1 : 0) - (a.item.pinned ? 1 : 0));
            const pos = entries.findIndex(e => e.i === realIndex); if(pos === -1) return;
            const target = pos + dir; if(target < 0 || target >= entries.length) return;
            if(!!entries[target].item.pinned !== !!entries[pos].item.pinned) return; // garde les favoris en tête
            const a = entries[pos].i, b = entries[target].i;
            [inventory[a], inventory[b]] = [inventory[b], inventory[a]];
            setStore('dnd-inventory', inventory); renderInventory();
        }

        function addInventoryFromInputs() {
            const nameEl = document.getElementById('inv-name'); const name = (nameEl.value || '').trim(); if(!name) { nameEl.focus(); return; }
            inventory.push({ name, qty: parseInt(document.getElementById('inv-qty').value) || 1, weight: (document.getElementById('inv-weight').value || '').trim() || '-', category: (document.getElementById('inv-category').value || '').trim() || 'Général', pinned: false });
            setStore('dnd-inventory', inventory);
            nameEl.value = ''; document.getElementById('inv-qty').value = ''; document.getElementById('inv-weight').value = '';
            renderInventory(); nameEl.focus();
        }

        // Réception d'un objet via le troc MJ (session.js) → ajout au sac
        window.PlayerInventory = {
            add(item) {
                if (!item || !item.name) return false;
                inventory.push({
                    name: String(item.name),
                    qty: parseInt(item.qty) || 1,
                    weight: (item.weight != null && String(item.weight).trim()) ? String(item.weight).trim() : '-',
                    category: item.category || 'Cadeaux',
                    pinned: false
                });
                setStore('dnd-inventory', inventory);
                renderInventory();
                return true;
            }
        };

        if(document.getElementById('btn-add-inventory')) document.getElementById('btn-add-inventory').addEventListener('click', addInventoryFromInputs);
        ['inv-name', 'inv-qty', 'inv-weight'].forEach(id => { const el = document.getElementById(id); if(el) el.addEventListener('keydown', (e) => { if(e.key === 'Enter') { e.preventDefault(); addInventoryFromInputs(); } }); });

        const invListContainer = document.getElementById('pinned-inventory-list');
        if(invListContainer) {
            invListContainer.addEventListener('click', (e) => {
                const rowEl = e.target.closest('[data-i]'); if(!rowEl) return; const index = parseInt(rowEl.dataset.i);
                if(e.target.closest('.ci-e-cancel')) { editingInvIndex = -1; renderInventory(); return; }
                if(e.target.closest('.ci-e-save')) { inventory[index] = { name: (rowEl.querySelector('.ci-e-name').value || '').trim() || 'Objet', qty: parseInt(rowEl.querySelector('.ci-e-qty').value) || 1, weight: (rowEl.querySelector('.ci-e-weight').value || '').trim() || '-', category: (rowEl.querySelector('.ci-e-cat').value || '').trim() || 'Général', pinned: inventory[index].pinned }; editingInvIndex = -1; setStore('dnd-inventory', inventory); updateCategorySelects(); renderInventory(); return; }
                if(e.target.closest('.ci-up')) { moveInvInView(index, -1); return; }
                if(e.target.closest('.ci-down')) { moveInvInView(index, 1); return; }
                if(e.target.closest('.ci-equip')) { inventory[index].equipped = !inventory[index].equipped; setStore('dnd-inventory', inventory); renderInventory(); return; }
                if(e.target.closest('.ci-pin')) { inventory[index].pinned = !inventory[index].pinned; setStore('dnd-inventory', inventory); renderInventory(); return; }
                if(e.target.closest('.ci-step')) { const act = e.target.closest('.ci-step').dataset.act; let q = parseInt(inventory[index].qty) || 1; q = act === 'inc' ? q + 1 : Math.max(1, q - 1); inventory[index].qty = q; setStore('dnd-inventory', inventory); renderInventory(); return; }
                if(e.target.closest('.ci-edit')) { editingInvIndex = index; renderInventory(); return; }
                if(e.target.closest('.ci-del')) { window.deleteWithUndo(inventory, index, inventory[index].name || 'cet objet', () => setStore('dnd-inventory', inventory), renderInventory); return; }
            });
            invListContainer.addEventListener('keydown', (e) => { if(e.key === 'Enter' && e.target.closest('.ci-edit-form')) { e.preventDefault(); const saveBtn = e.target.closest('.ci-edit-form').querySelector('.ci-e-save'); if(saveBtn) saveBtn.click(); } });
        }
        // Recherche & tri du sac à dos
        const invSearchEl = document.getElementById('inv-search');
        if (invSearchEl) invSearchEl.addEventListener('input', (e) => { invSearch = e.target.value; renderInventory(); invSearchEl.focus(); });
        const invSortEl = document.getElementById('inv-sort');
        if (invSortEl) {
            invSortEl.value = invSortMode;
            invSortEl.addEventListener('change', (e) => { invSortMode = e.target.value; setStore('dnd-inv-sort', invSortMode, false); renderInventory(); });
        }

        function renderTraits() { 
            const listClass = document.getElementById('traits-list-class'); 
            const listRace = document.getElementById('traits-list-race'); 
            const listFeat = document.getElementById('traits-list-feat'); 
            if(!listClass || !listRace || !listFeat) return; 
            listClass.innerHTML = ''; listRace.innerHTML = ''; listFeat.innerHTML = ''; 
            traits.forEach((trait, index) => {
                let isExpandedClass = trait.pinned ? 'expanded' : '';
                let caret = trait.pinned ? '' : '<span class="trait-caret">▸</span>';
                let metaHtml = trait.level ? `<span class="trait-meta">Niv.${trait.level}</span>` : '';
                let html = `<div class="trait-row"><div class="trait-row-head" onclick="toggleTraitDesc(event, ${index})">${caret}${metaHtml}<span class="trait-name">${trait.name}</span>${trait.pinned ? '<span class="trait-pin">📌</span>' : ''}${getCrudControlsHTML(index, 'Trait')}</div><div class="trait-desc ${isExpandedClass}" id="trait-desc-${index}">${trait.desc.replace(/\n/g, '<br>')}</div></div>`;
                if(trait.type === 'class') listClass.innerHTML += html; else if(trait.type === 'race') listRace.innerHTML += html; else listFeat.innerHTML += html;
            });
            if(listClass.innerHTML === '') listClass.innerHTML = `<div class="compact-empty">Aucune capacité.</div>`;
            if(listRace.innerHTML === '') listRace.innerHTML = `<div class="compact-empty">Aucun trait.</div>`;
            if(listFeat.innerHTML === '') listFeat.innerHTML = `<div class="compact-empty">Aucun don.</div>`;
        }

        window.toggleTraitDesc = (e, index) => { if(e.target.closest('button') || e.target.closest('.item-controls')) return; if(traits[index].pinned) return; const desc = document.getElementById(`trait-desc-${index}`); if(desc) desc.classList.toggle('expanded'); };
        
        const btnToggleAllTraits = document.getElementById('btn-toggle-all-traits');
        if(btnToggleAllTraits) {
            btnToggleAllTraits.addEventListener('click', (e) => {
                e.stopPropagation();
                const allDescs = document.querySelectorAll('.trait-desc');
                const anyExpanded = Array.from(allDescs).some(d => d.classList.contains('expanded'));
                allDescs.forEach(d => {
                    if(anyExpanded) d.classList.remove('expanded');
                    else d.classList.add('expanded');
                });
            });
        }

        document.body.addEventListener('click', (e) => { if(e.target.id === 'btn-open-trait-modal') { editingTraitIndex = -1; document.getElementById('trait-modal-title').textContent = "Ajouter une Capacité"; document.querySelectorAll('#trait-form-modal input[type="text"], #trait-form-modal input[type="number"], #trait-form-modal textarea').forEach(i => i.value = ''); document.getElementById('new-trait-pinned').checked = false; traitModal.classList.remove('hidden'); } });
        if(document.getElementById('btn-save-trait')) { document.getElementById('btn-save-trait').addEventListener('click', () => { const trait = { name: document.getElementById('new-trait-name').value.trim(), type: document.getElementById('new-trait-type').value, level: parseInt(document.getElementById('new-trait-level').value) || 0, desc: document.getElementById('new-trait-desc').value, pinned: document.getElementById('new-trait-pinned').checked }; if(trait.name) { if(editingTraitIndex >= 0) traits[editingTraitIndex] = trait; else traits.push(trait); setStore('dnd-traits', traits); renderTraits(); traitModal.classList.add('hidden'); } }); }
        window.deleteTrait = (index) => window.deleteWithUndo(traits, index, (traits[index] || {}).name || 'cette capacité', () => setStore('dnd-traits', traits), renderTraits); window.moveTraitUp = (index) => { if(moveWithinFilter(traits, index, -1, t => t.type === traits[index].type)) { setStore('dnd-traits', traits); renderTraits(); } }; window.moveTraitDown = (index) => { if(moveWithinFilter(traits, index, 1, t => t.type === traits[index].type)) { setStore('dnd-traits', traits); renderTraits(); } }; window.editTrait = (index) => { const data = traits[index]; document.getElementById('new-trait-name').value = data.name; document.getElementById('new-trait-type').value = data.type; document.getElementById('new-trait-level').value = data.level || ''; document.getElementById('new-trait-desc').value = data.desc; document.getElementById('new-trait-pinned').checked = data.pinned; editingTraitIndex = index; document.getElementById('trait-modal-title').textContent = "Modifier la Capacité"; traitModal.classList.remove('hidden'); };

        const crudIgnoredPrefixes = ['new-', 'edit-', 'qa-', 'inv-name', 'inv-qty', 'inv-weight', 'inv-category', 'init-add', 'macro-', 'input-custom', 'pay-amount', 'new-atk', 'new-spell', 'new-ability', 'new-journal', 'new-trait', 'rest-hd-to-roll', 'hp-quick'];

        let traits = getStore('dnd-traits') || []; const traitModal = document.getElementById('trait-form-modal');
        let abilities = getStore('dnd-abilities') || [];
        function escAb(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
        // Texte de récupération — identique à celui des emplacements de sorts.
        function getAbilityRegenText(ab) {
            const fmt = (t, a) => t === 'all' ? 'Tout' : `+${a}`;
            const m = ab.regenMode || 'long';
            if(m === 'none') return 'Aucune régénération';
            if(m === 'short') return `Court: ${fmt(ab.shortType, ab.shortAmount)}`;
            if(m === 'short_long') return `Court: ${fmt(ab.shortType, ab.shortAmount)} | Long: ${fmt(ab.longType, ab.longAmount)}`;
            return `Long: ${fmt(ab.longType, ab.longAmount)}`;
        }
        // Affichage calqué sur la grille des emplacements de sorts (cases à cocher + info dispo).
        function renderAbilities() {
            const list = document.getElementById('abilities-list'); if(!list) return;
            if(abilities.length === 0) { list.innerHTML = `<div class="spell-slot-empty">Aucune capacité configurée. Clique sur ⚙️ Gérer pour en ajouter.</div>`; return; }
            list.innerHTML = abilities.map((ab, index) => {
                const usedCount = ab.used ? ab.used.filter(Boolean).length : 0;
                const available = Math.max(0, ab.max - usedCount);
                let cbHtml = '';
                for(let i = 0; i < ab.max; i++) cbHtml += `<input type="checkbox" class="slot-check ability-charge-check" data-idx="${index}" data-index="${i}" ${ab.used && ab.used[i] ? 'checked' : ''} title="Dépensé">`;
                return `<div class="spell-slot-row"><div class="slot-lvl-label">${escAb(ab.name)}</div><div class="slot-main-content"><div class="slot-checkboxes">${cbHtml}</div><div class="slot-info">${available}/${ab.max} dispos • ${getAbilityRegenText(ab)}</div></div></div>`;
            }).join('');
            document.querySelectorAll('.ability-charge-check').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    const idx = parseInt(e.target.dataset.idx), i = parseInt(e.target.dataset.index);
                    if(!abilities[idx].used) abilities[idx].used = Array(abilities[idx].max).fill(false);
                    abilities[idx].used[i] = e.target.checked;
                    setStore('dnd-abilities', abilities); renderAbilities();
                });
            });
        }
        // ---- Modale de configuration (calquée sur la modale des Emplacements de Sorts) ----
        let abilityConfigDraft = [];
        const abilityConfigModal = document.getElementById('ability-config-modal');
        function abilityConfigRowHtml(ab, idx) {
            return `<div class="spell-slot-config-row ability-config-row" data-idx="${idx}">
                <div class="spell-slot-config-head">
                    <input class="ab-cfg-name spell-config-name" placeholder="Nom de la capacité" value="${escAb(ab.name)}">
                    <label class="spell-slot-mini-field">Charges<input type="number" class="ab-cfg-max" min="1" max="20" value="${ab.max || 1}"></label>
                    <label class="spell-slot-mini-field spell-slot-regen-field">Récupération<select class="ab-cfg-regen-mode">
                        <option value="none"${ab.regenMode === 'none' ? ' selected' : ''}>Aucune</option>
                        <option value="short"${ab.regenMode === 'short' ? ' selected' : ''}>Repos court</option>
                        <option value="long"${(ab.regenMode || 'long') === 'long' ? ' selected' : ''}>Repos long</option>
                        <option value="short_long"${ab.regenMode === 'short_long' ? ' selected' : ''}>Repos court + long</option>
                    </select></label>
                    <button class="ab-cfg-del btn-del" title="Supprimer cette capacité">🗑</button>
                </div>
                <div class="spell-slot-config-details">
                    <div class="spell-recovery-pill ab-cfg-short-block"><span>Court</span><select class="ab-cfg-short-type"><option value="all"${(ab.shortType || 'all') === 'all' ? ' selected' : ''}>Tout</option><option value="fixed"${ab.shortType === 'fixed' ? ' selected' : ''}>Partiel</option></select><input type="number" class="ab-cfg-short-amount" min="1" value="${ab.shortAmount || 1}" placeholder="Nb"></div>
                    <div class="spell-recovery-pill ab-cfg-long-block"><span>Long</span><select class="ab-cfg-long-type"><option value="all"${(ab.longType || 'all') === 'all' ? ' selected' : ''}>Tout</option><option value="fixed"${ab.longType === 'fixed' ? ' selected' : ''}>Partiel</option></select><input type="number" class="ab-cfg-long-amount" min="1" value="${ab.longAmount || 1}" placeholder="Nb"></div>
                </div>
            </div>`;
        }
        function renderAbilityConfig() {
            const list = document.getElementById('ability-config-list'); if(!list) return;
            if(!abilityConfigDraft.length) { list.innerHTML = `<div class="spell-slot-empty" style="padding:16px;">Aucune capacité. Clique « ➕ Ajouter une capacité » ci-dessous.</div>`; return; }
            list.innerHTML = abilityConfigDraft.map((ab, i) => abilityConfigRowHtml(ab, i)).join('');
            list.querySelectorAll('.ability-config-row').forEach(row => {
                const updateVisibility = () => {
                    const mode = row.querySelector('.ab-cfg-regen-mode').value;
                    row.querySelector('.spell-slot-config-details').classList.toggle('hidden', mode === 'none');
                    row.querySelector('.ab-cfg-short-block').classList.toggle('hidden', !(mode === 'short' || mode === 'short_long'));
                    row.querySelector('.ab-cfg-long-block').classList.toggle('hidden', !(mode === 'long' || mode === 'short_long'));
                    row.querySelector('.ab-cfg-short-amount').classList.toggle('hidden', row.querySelector('.ab-cfg-short-type').value === 'all');
                    row.querySelector('.ab-cfg-long-amount').classList.toggle('hidden', row.querySelector('.ab-cfg-long-type').value === 'all');
                };
                updateVisibility();
                row.querySelectorAll('select, input').forEach(el => el.addEventListener('input', updateVisibility));
                row.querySelector('.ab-cfg-del').addEventListener('click', () => { abilityConfigDraft = readAbilityConfigDraft(); abilityConfigDraft.splice(parseInt(row.dataset.idx), 1); renderAbilityConfig(); });
            });
        }
        function readAbilityConfigDraft() {
            const out = [];
            document.querySelectorAll('#ability-config-list .ability-config-row').forEach(row => {
                out.push({
                    name: row.querySelector('.ab-cfg-name').value.trim(),
                    max: Math.max(1, Math.min(20, parseInt(row.querySelector('.ab-cfg-max').value) || 1)),
                    regenMode: row.querySelector('.ab-cfg-regen-mode').value,
                    shortType: row.querySelector('.ab-cfg-short-type').value,
                    shortAmount: Math.max(1, parseInt(row.querySelector('.ab-cfg-short-amount').value) || 1),
                    longType: row.querySelector('.ab-cfg-long-type').value,
                    longAmount: Math.max(1, parseInt(row.querySelector('.ab-cfg-long-amount').value) || 1)
                });
            });
            return out;
        }
        function openAbilityConfig() {
            abilityConfigDraft = abilities.map(ab => ({ name: ab.name, max: ab.max, regenMode: ab.regenMode || 'long', shortType: ab.shortType || 'all', shortAmount: ab.shortAmount || 1, longType: ab.longType || 'all', longAmount: ab.longAmount || 1 }));
            renderAbilityConfig();
            if(abilityConfigModal) abilityConfigModal.classList.remove('hidden');
        }
        document.body.addEventListener('click', (e) => { if(e.target.id === 'btn-open-ability-config') openAbilityConfig(); });
        const btnAbCfgAdd = document.getElementById('btn-ability-config-add');
        if(btnAbCfgAdd) btnAbCfgAdd.addEventListener('click', () => { abilityConfigDraft = readAbilityConfigDraft(); abilityConfigDraft.push({ name: '', max: 1, regenMode: 'long', shortType: 'all', shortAmount: 1, longType: 'all', longAmount: 1 }); renderAbilityConfig(); const last = document.querySelector('#ability-config-list .ability-config-row:last-child .ab-cfg-name'); if(last) last.focus(); });
        const btnSaveAbCfg = document.getElementById('btn-save-ability-config');
        if(btnSaveAbCfg) btnSaveAbCfg.addEventListener('click', () => {
            const next = readAbilityConfigDraft().filter(ab => ab.name);
            // On préserve les charges déjà dépensées (matching par nom).
            next.forEach(ab => {
                const prev = abilities.find(a => a.name === ab.name);
                let used = prev && Array.isArray(prev.used) ? prev.used.slice(0, ab.max) : [];
                while(used.length < ab.max) used.push(false);
                ab.used = used;
            });
            abilities = next;
            setStore('dnd-abilities', abilities);
            renderAbilities();
            if(abilityConfigModal) abilityConfigModal.classList.add('hidden');
        });
        window.deleteAbility = (index) => window.deleteWithUndo(abilities, index, (abilities[index] || {}).name || 'cette capacité',
            () => setStore('dnd-abilities', abilities), renderAbilities);

        let macros = getStore('dnd-macros') || [];
        function renderMacros() { const list = document.getElementById('macro-list'); if(!list) return; list.innerHTML = ''; macros.forEach((m, i) => { list.innerHTML += `<div class="macro-pill"><button class="macro-btn rollable" data-formula="${m.formula}" data-name="${m.name}">${m.name}</button><span class="macro-del" onclick="deleteMacro(${i})">✖</span></div>`; }); }
        if(document.getElementById('btn-add-macro')) { document.getElementById('btn-add-macro').addEventListener('click', () => { const name = document.getElementById('macro-name').value.trim(); const formula = document.getElementById('macro-formula').value.trim(); if(name && formula) { macros.push({ name, formula }); setStore('dnd-macros', macros); renderMacros(); document.getElementById('macro-name').value = ''; document.getElementById('macro-formula').value = ''; } }); }
        window.deleteMacro = (index) => { macros.splice(index, 1); setStore('dnd-macros', macros); renderMacros(); };

        // ===== BOURSE : valeurs en cuivre, conversion optimale, payer / ajouter =====
        // 1 pa = 10 pc | 1 pe = 50 pc | 1 po = 100 pc | 1 pp = 1000 pc
        const COIN_VALUE = { pc: 1, pa: 10, pe: 50, po: 100, pp: 1000 };
        const COIN_ORDER = ['pp', 'po', 'pe', 'pa', 'pc'];   // du plus fort au plus faible
        function getCoin(t) { const el = document.getElementById('coin-' + t); return el ? (parseInt(el.value, 10) || 0) : 0; }
        function setCoin(t, v) { const el = document.getElementById('coin-' + t); if (el) { el.value = v; setStore('dnd-sheet-coin-' + t, String(v), false); } }
        function purseTotalCopper() { return COIN_ORDER.reduce((sum, t) => sum + getCoin(t) * COIN_VALUE[t], 0); }
        // Répartition en un MINIMUM de pièces (glouton — optimal pour ce système de monnaies).
        function distributeCopper(copper) {
            const out = {};
            COIN_ORDER.forEach(t => { out[t] = Math.floor(copper / COIN_VALUE[t]); copper -= out[t] * COIN_VALUE[t]; });
            return out;
        }
        function applyDistribution(d) { COIN_ORDER.forEach(t => setCoin(t, d[t] || 0)); renderCurrencyTotal(); }
        function renderCurrencyTotal() {
            const el = document.getElementById('currency-total-val'); if (!el) return;
            const c = purseTotalCopper();
            const po = Math.floor(c / 100), rest = c % 100;
            el.textContent = rest === 0 ? `${po} po` : `${po} po ${Math.floor(rest / 10)} pa ${rest % 10} pc`;
        }
        // Conversion vers une pièce choisie : on met le maximum dans la coupure visée,
        // et le reliquat descend dans les coupures inférieures — rien n'est perdu.
        function distributeToTarget(copper, target) {
            const out = {}; COIN_ORDER.forEach(t => { out[t] = 0; });
            out[target] = Math.floor(copper / COIN_VALUE[target]);
            let rest = copper - out[target] * COIN_VALUE[target];
            COIN_ORDER.slice(COIN_ORDER.indexOf(target) + 1).forEach(t => {
                out[t] = Math.floor(rest / COIN_VALUE[t]); rest -= out[t] * COIN_VALUE[t];
            });
            return out;
        }
        const COIN_LABEL = { pp: 'platine', po: 'or', pe: 'électrum', pa: 'argent', pc: 'cuivre' };
        const btnOptimize = document.getElementById('btn-optimize-currency');
        if (btnOptimize) btnOptimize.addEventListener('click', () => {
            const total = purseTotalCopper();
            if (total <= 0) { if (window.showAppToast) window.showAppToast('Ta bourse est vide.', '#c0392b'); return; }
            const target = (document.getElementById('convert-target') || {}).value || 'auto';
            if (target === 'auto') {
                applyDistribution(distributeCopper(total));
                if (window.showAppToast) window.showAppToast('⚖️ Bourse convertie au minimum de pièces.', '#27ae60');
            } else {
                const d = distributeToTarget(total, target);
                applyDistribution(d);
                const reste = COIN_ORDER.slice(COIN_ORDER.indexOf(target) + 1).some(t => d[t] > 0);
                if (window.showAppToast) window.showAppToast(
                    `⚖️ ${d[target]} pièce(s) de ${COIN_LABEL[target]}` + (reste ? ' + le reliquat en petite monnaie.' : '.'), '#27ae60');
            }
        });
        document.body.addEventListener('click', (e) => {
            if (e.target.id !== 'btn-pay-currency') return;
            const amountEl = document.getElementById('pay-amount-val');
            const amount = parseFloat(amountEl.value) || 0;
            const type = document.getElementById('pay-amount-type').value;
            const mode = (document.getElementById('pay-mode') || {}).value || 'pay';
            if (amount <= 0) return;
            const copper = Math.round(amount * COIN_VALUE[type]);
            if (mode === 'add') {
                // Ajout : on ajoute les pièces du type choisi (pas de conversion forcée).
                setCoin(type, getCoin(type) + Math.round(amount));
                renderCurrencyTotal();
                if (window.showAppToast) window.showAppToast(`➕ ${Math.round(amount)} ${type.toUpperCase()} ajoutée(s).`, '#27ae60');
            } else {
                // Paiement INTELLIGENT : on paie sur le total et on rend la monnaie de façon optimale.
                const total = purseTotalCopper();
                if (copper > total) { if (window.showAppToast) window.showAppToast('💸 Pas assez d\'argent dans ta bourse.', '#c0392b'); return; }
                applyDistribution(distributeCopper(total - copper));
                if (window.showAppToast) window.showAppToast(`➖ ${amount} ${type.toUpperCase()} payée(s) — monnaie rendue.`, '#2c3e50');
            }
            amountEl.value = '';
        });
        // Le total se met à jour dès qu'on édite une pièce à la main
        COIN_ORDER.forEach(t => { const el = document.getElementById('coin-' + t); if (el) el.addEventListener('input', renderCurrencyTotal); });

        // ===== BARRE DE PV CLIQUABLE & GLISSABLE : le remplissage suit le pointeur
        // tant que le clic (ou le doigt) reste appuyé ; la valeur n'est sauvegardée
        // qu'au relâchement (un seul event 'input' → pas de rafale d'écritures). =====
        const hpTrack = document.querySelector('.hp-bar-track');
        if (hpTrack) {
            hpTrack.title = 'Clique ou glisse pour fixer les PV';
            let hpScrubbing = false; let hpLastX = 0;
            const applyHpFromX = (clientX, commit) => {
                const maxEl = document.getElementById('hp-max'); const curEl = document.getElementById('hp-current');
                const max = parseInt(maxEl?.value, 10) || 0; if (!curEl || max <= 0) return;
                const r = hpTrack.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (clientX - r.left) / (r.width || 1)));
                curEl.value = Math.round(ratio * max);
                if (commit) curEl.dispatchEvent(new Event('input', { bubbles: true }));
                else updateHpVisuals();
            };
            hpTrack.addEventListener('pointerdown', (e) => {
                if (e.button != null && e.button !== 0) return;
                hpScrubbing = true; hpLastX = e.clientX;
                hpTrack.classList.add('hp-scrubbing');
                try { hpTrack.setPointerCapture(e.pointerId); } catch(_) {}
                applyHpFromX(e.clientX, false);
            });
            hpTrack.addEventListener('pointermove', (e) => { if (hpScrubbing) { hpLastX = e.clientX; applyHpFromX(e.clientX, false); } });
            const endHpScrub = (e) => {
                if (!hpScrubbing) return;
                hpScrubbing = false;
                hpTrack.classList.remove('hp-scrubbing');
                try { hpTrack.releasePointerCapture(e.pointerId); } catch(_) {}
                // pointercancel ne porte pas toujours de coordonnées → on garde la dernière position connue
                applyHpFromX(typeof e.clientX === 'number' && e.clientX !== 0 ? e.clientX : hpLastX, true);
            };
            hpTrack.addEventListener('pointerup', endHpScrub);
            hpTrack.addEventListener('pointercancel', endHpScrub);
        }

        function initGlobalSave() {
            const allSimpleInputs = document.querySelectorAll('#app-screen input:not(.slot-total-input):not(#avatar-file-input):not(#bg-file-input):not(#btn-import-json):not(.color-picker):not([type="radio"]):not([type="file"]):not(#pay-amount-val):not(#calc-display):not(#new-trait-pinned):not(#global-search-input), #app-screen textarea:not(#new-trait-desc), #app-screen select:not(#hd-size):not(#layout-selector):not(#pay-amount-type):not(#traits-sort-select):not(#new-trait-type):not(#inv-category):not(#edit-inv-category):not(#new-atk-category)');
            allSimpleInputs.forEach(input => {
                if(!input.id || crudIgnoredPrefixes.some(pref => input.id.startsWith(pref))) return;
                if (input.type === 'checkbox') {
                    const saved = getStore('dnd-sheet-'+input.id, false); if (saved !== null) input.checked = (saved === 'true');
                    input.addEventListener('change', () => { 
                        setStore('dnd-sheet-'+input.id, input.checked, false); 
                        updateStatsAndSkills(); 
                        if(input.id.startsWith('cond-')) updateStatusEffects();
                    });
                } else {
                    const savedValue = getStore('dnd-sheet-'+input.id, false); if (savedValue !== null) input.value = savedValue;
                    input.addEventListener('input', () => { setStore('dnd-sheet-'+input.id, input.value, false); if(input.id === 'hp-current' || input.id === 'hp-max' || input.id === 'hp-temp') updateHpVisuals(); });
                }
            });
            const hdSizeInput = document.getElementById('hd-size'); const savedHdSize = getStore('dnd-sheet-hd-size', false); if(savedHdSize !== null && hdSizeInput) hdSizeInput.value = savedHdSize; 
            if(hdSizeInput) hdSizeInput.addEventListener('change', () => setStore('dnd-sheet-hd-size', hdSizeInput.value, false));
            updateHpVisuals(); 
        }

        function initSkillProfSave() {
            document.querySelectorAll('.skill-prof').forEach(input => { const skillId = input.id.replace('prof-', ''); const saved = getStore('dnd-sheet-' + input.id, false); if(saved !== null) { input.value = parseInt(saved) || 0; } updateSkillProfBtn(skillId); });
            document.querySelectorAll('#prof-armor-light, #prof-armor-med, #prof-armor-heavy, #prof-armor-shield, #prof-weapon-simple, #prof-weapon-martial, #prof-weapon-other').forEach(input => { const saved = getStore('dnd-sheet-'+input.id, false); if (saved !== null) input.checked = (saved === 'true'); input.addEventListener('change', () => { setStore('dnd-sheet-'+input.id, input.checked, false); updateStatsAndSkills(); }); });
        }

        let savedLayout = getStore('dnd-layout-mode', false) || 'classic'; if(layoutSelector) layoutSelector.value = savedLayout; applyLayout(savedLayout);
        initSkillProfSave(); initGlobalSave(); 
        // Bonus de maîtrise : auto-calculé depuis le niveau UNIQUEMENT s'il n'a jamais été saisi
        // (même logique que l'initiative ci-dessous — une valeur éditée à la main survit au rechargement ;
        //  changer le Niveau recalcule toujours, via le listener plus haut).
        if(levelInput && getStore('dnd-sheet-prof-bonus', false) === null) { const prof = Math.floor(((parseInt(levelInput.value) || 1) - 1) / 4) + 2; const pInp = document.getElementById('prof-bonus'); if(pInp) pInp.value = prof; }
        if(spellCastingAbility) spellCastingAbility.value = getStore('dnd-sheet-spellcasting-ability', false) || "";
        
        updateCategorySelects(); updateStatsAndSkills(); renderAbilities(); renderPinnedSpells(); renderAttacks(); renderSpellSlots(); renderInventory(); renderMacros(); renderCompanions(); renderCustomConditions(); renderTraits(); renderPreparedSpells(); updateStatusEffects(); makeRollablesFocusable(); renderRollHistory(); renderCurrencyTotal();

        // ===== RACCOURCIS CLAVIER (#22) — personnalisables =====
        // Ignorés dès qu'on saisit du texte (champ, zone de texte, éditeur riche).
        function isTyping(t) { return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)); }
        function quickD20(advMode) { performAbilityRoll('Jet rapide', 0, advMode); }
        // Actions disponibles + touche par défaut. La touche peut être changée par le joueur
        // (stockée dans `dnd-shortcuts-player`, préférence GLOBALE non liée au personnage).
        const PLAYER_SC_ACTIONS = [
            { id: 'dice', def: 'd', label: 'Ouvrir / fermer le plateau de dés', run: () => document.getElementById('btn-toggle-dice')?.click() },
            { id: 'roll', def: 'r', label: 'Lancer un d20', run: () => quickD20('normal') },
            { id: 'adv', def: 'a', label: 'Lancer un d20 avec avantage', run: () => quickD20('adv') },
            { id: 'dis', def: 'e', label: 'Lancer un d20 avec désavantage', run: () => quickD20('dis') },
            { id: 'grimoire', def: 'g', label: 'Ouvrir le grimoire', run: () => document.getElementById('btn-open-grimoire')?.click() },
            { id: 'restShort', def: 'c', label: 'Repos court', run: () => document.getElementById('btn-short-rest')?.click() },
            { id: 'restLong', def: 'l', label: 'Repos long', run: () => document.getElementById('btn-long-rest')?.click() },
            { id: 'search', def: 'f', label: 'Recherche globale', run: () => document.getElementById('btn-global-search-trigger')?.click() },
            { id: 'help', def: '?', label: 'Afficher cette aide', run: () => openShortcutsModal() },
        ];
        // ⚠️ hasOwnProperty (et non `saved[id] || def`) : une touche VOLONTAIREMENT libérée est stockée
        // à '' — avec `||` elle serait retombée sur sa valeur par défaut et aurait recréé le conflit.
        function playerShortcutMap() { let saved = {}; try { saved = JSON.parse(DB.get('dnd-shortcuts-player') || '{}'); } catch (e) {} const m = {}; PLAYER_SC_ACTIONS.forEach(a => { const has = Object.prototype.hasOwnProperty.call(saved, a.id); m[a.id] = String(has ? saved[a.id] : a.def).toLowerCase(); }); return m; }
        function savePlayerShortcutMap(m) { DB.set('dnd-shortcuts-player', JSON.stringify(m)); }
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const appScreen = document.getElementById('app-screen');
            if (!appScreen || appScreen.classList.contains('hidden') || document.body.classList.contains('gm-active')) return;
            // Échap : ferme le portrait plein écran / la fenêtre ouverte la plus haute
            if (e.key === 'Escape') {
                const fs = document.getElementById('portrait-fullscreen');
                if (fs && !fs.classList.contains('hidden')) { closePortraitFullscreen(); return; }
                const open = [...document.querySelectorAll('.modal-overlay:not(.hidden)')].pop();
                if (open) open.classList.add('hidden');
                return;
            }
            if (isTyping(e.target) || scCaptureId) return;   // pendant une capture de touche : on n'exécute rien
            const k = e.key.toLowerCase();
            const map = playerShortcutMap();
            const action = PLAYER_SC_ACTIONS.find(a => map[a.id] && map[a.id] === k);
            if (action) { e.preventDefault(); action.run(); }
        });

        // --- Éditeur de raccourcis (voir & modifier) ---
        let scCaptureId = null;   // id de l'action dont on capture la nouvelle touche
        function keyLabel(k) { return !k ? '—' : (k === '?' ? '?' : k.toUpperCase()); }
        function renderShortcutsEditor() {
            const host = document.getElementById('shortcuts-list'); if (!host) return;
            const map = playerShortcutMap();
            host.innerHTML = PLAYER_SC_ACTIONS.map(a => `<div class="shortcut-row"><button class="sc-key${scCaptureId === a.id ? ' is-capturing' : ''}" data-sc="${a.id}" title="Cliquer puis appuyer sur la nouvelle touche">${scCaptureId === a.id ? '…' : keyLabel(map[a.id])}</button><span>${a.label}</span></div>`).join('')
                + `<div class="shortcut-row is-fixed"><kbd>Échap</kbd><span>Fermer la fenêtre ouverte</span></div>`;
            host.querySelectorAll('.sc-key').forEach(b => b.addEventListener('click', () => { scCaptureId = b.dataset.sc; renderShortcutsEditor(); }));
        }
        // Capture de la nouvelle touche (en phase de capture pour passer avant le handler global)
        document.addEventListener('keydown', (e) => {
            if (!scCaptureId) return;
            e.preventDefault(); e.stopPropagation();
            if (e.key === 'Escape') { scCaptureId = null; renderShortcutsEditor(); return; }
            const k = e.key.toLowerCase();
            if (k.length !== 1) return;                       // une seule touche (lettre, chiffre, ?)
            const map = playerShortcutMap();
            const clash = PLAYER_SC_ACTIONS.find(a => a.id !== scCaptureId && map[a.id] === k);
            if (clash) map[clash.id] = '';                     // la touche est libérée de l'autre action
            map[scCaptureId] = k;
            savePlayerShortcutMap(map);
            scCaptureId = null;
            renderShortcutsEditor();
            if (window.showAppToast) window.showAppToast('⌨️ Raccourci enregistré : ' + keyLabel(k), '#27ae60');
        }, true);
        function openShortcutsModal() { scCaptureId = null; renderShortcutsEditor(); document.getElementById('shortcuts-modal')?.classList.remove('hidden'); }
        window.__openPlayerShortcuts = openShortcutsModal;   // exposé : le bouton ☰ est câblé au niveau global (voir plus haut)
        document.getElementById('btn-close-shortcuts')?.addEventListener('click', () => { scCaptureId = null; document.getElementById('shortcuts-modal')?.classList.add('hidden'); });
        document.getElementById('btn-reset-shortcuts')?.addEventListener('click', () => { DB.remove('dnd-shortcuts-player'); renderShortcutsEditor(); if (window.showAppToast) window.showAppToast('⌨️ Raccourcis réinitialisés.', '#2c3e50'); });
        
        let savedInit = getStore('dnd-sheet-initiative', false); if(savedInit === null) { let mod = getModifier(parseInt(document.getElementById('stat-dex').value) || 10); if(initInput) initInput.value = mod; setStore('dnd-sheet-initiative', mod, false); }
        if(document.getElementById('btn-export-pdf')) document.getElementById('btn-export-pdf').addEventListener('click', async () => {
            // Fiche officielle remplie (print-sheet.js) ; repli = impression classique du site (hors-ligne / erreur)
            if (window.PrintSheet) {
                try { const ok = await window.PrintSheet.print(); if (ok) return; } catch (e) { console.warn('Impression fiche officielle KO, repli :', e); }
            }
            applyLayout('classic', { forceDesktop: true }); window.print();
            if (isMobileView()) applyLayout(getStore('dnd-layout-mode', false) || 'classic');
        });

        // ==========================================
        // MODULE DE RECHERCHE GLOBALE
        // ==========================================
        // ==========================================
        // BASE DE RÈGLES 5e (en français) — recherche + fiche détaillée
        // ==========================================

        const searchModal = document.getElementById('global-search-modal');
        const searchInput = document.getElementById('global-search-input');
        const searchResults = document.getElementById('global-search-results');
        const searchTrigger = document.getElementById('btn-global-search-trigger');

        if (searchModal && searchInput && searchResults) {
            function openSearch() { searchModal.classList.remove('hidden'); searchInput.value = ''; searchResults.innerHTML = '<div style="text-align:center; padding:20px; color:#777; font-style:italic;">Entrez un mot-clé pour lancer la recherche...</div>'; setTimeout(() => searchInput.focus(), 50); }
            function closeSearch() { searchModal.classList.add('hidden'); document.activeElement?.blur(); }

            if (searchTrigger) {
                searchTrigger.addEventListener('click', (e) => { e.stopPropagation(); if (searchModal.classList.contains('hidden')) openSearch(); else closeSearch(); });
            }

            searchModal.addEventListener('click', (e) => { if (e.target === searchModal) closeSearch(); });


            async function openSrdEntry(res) {
                const titleEl = document.getElementById('rule-widget-title');
                const catEl = document.getElementById('rule-widget-cat');
                const bodyEl = document.getElementById('rule-widget-body');
                const modal = document.getElementById('rule-widget-modal');
                if (!titleEl || !modal) return;
                titleEl.textContent = res.name;
                if (catEl) catEl.textContent = res.subtitle || res.categoryLabel || '';
                if (bodyEl) bodyEl.innerHTML = '<p style="font-style:italic; color:#888;">Chargement…</p>';
                modal.classList.remove('hidden');
                try {
                    const e = await window.SRD.entry(res.category, res.id);
                    if (!e) throw new Error('introuvable');
                    if (bodyEl) bodyEl.innerHTML = window.SRD.renderEntry(res.category, e)
                        + `<p class="rw-src">${escAb(window.SRD.attribution)}</p>`;
                } catch (err) {
                    if (bodyEl) bodyEl.innerHTML = `<p style="color:#c0392b;">Impossible de charger cette fiche.<br><small>${escAb(err.message)}</small></p>`;
                }
            }

            // --- Recherche dans les données saisies de la fiche ---
            function searchSheetData(q) {
                const out = [];
                const add = (arr, icon, subtitle, widgetId) => { (arr || []).forEach(it => { const nm = String((it && (it.name || it.title)) || '').trim(); if (nm && nm.toLowerCase().includes(q)) out.push({ icon, title: nm, subtitle, widgetId }); }); };
                add(getStore('dnd-abilities'), '🔋', 'Capacité limitée', 'widget-abilities');
                add(getStore('dnd-spells'),    '✨', 'Sort',             'widget-spells');
                add(getStore('dnd-attacks'),   '⚔️', 'Attaque / arme',   'widget-attacks');
                add(getStore('dnd-inventory'), '🎒', 'Objet (sac à dos)','widget-inventory');
                add(getStore('dnd-traits'),    '📜', 'Capacité / don',   'widget-traits');
                add(getStore('dnd-macros'),    '🎲', 'Macro',            'widget-macros');
                // Raccourcis vers les modules (ex. « bourse »)
                const modules = [
                    { kw: ['bourse', 'argent', 'piece', 'pièce', 'or', 'monnaie', 'po'], title: 'Bourse', widgetId: 'widget-currency', icon: '💰' },
                    { kw: ['inventaire', 'sac', 'poids', 'objet'], title: 'Sac à dos', widgetId: 'widget-inventory', icon: '🎒' },
                    { kw: ['magie', 'emplacement', 'incantation', 'dd'], title: 'Caractéristiques magiques', widgetId: 'widget-magic-stats', icon: '✨' },
                    { kw: ['compagnon', 'familier', 'animal', 'monture'], title: 'Compagnons / Familiers', widgetId: 'widget-companion', icon: '🐾' },
                    { kw: ['note', 'journal'], title: 'Notes & Journal', widgetId: 'widget-notes', icon: '📝' },
                    { kw: ['pv', 'vie', 'sante', 'santé', 'soin', 'mort'], title: 'Points de vie', widgetId: 'widget-hp', icon: '❤️' },
                    { kw: ['competence', 'compétence', 'sauvegarde', 'caracteristique', 'caractéristique', 'stat', 'force', 'dexterite', 'dextérité'], title: 'Caractéristiques & compétences', widgetId: 'widget-stats', icon: '🎯' },
                    { kw: ['repos'], title: 'Repos', widgetId: 'widget-rests', icon: '⛺' },
                    { kw: ['compagnon', 'familier'], title: 'Compagnon / Familier', widgetId: 'widget-companion', icon: '🐾' },
                    { kw: ['quete', 'quête', 'pnj'], title: 'Quêtes & PNJ', widgetId: 'widget-quests', icon: '🗺️' }
                ];
                modules.forEach(m => { if (m.kw.some(k => k.includes(q) || q.includes(k))) out.push({ icon: m.icon, title: m.title, subtitle: 'Module de la fiche', widgetId: m.widgetId }); });
                // Dédoublonnage par titre + module
                const seen = new Set();
                return out.filter(o => { const key = o.title + '|' + o.widgetId; if (seen.has(key)) return false; seen.add(key); return true; });
            }

            // --- Recherche des libellés/champs affichés sur la fiche ---
            function searchPageElements(query) {
                const found = [];
                const targets = document.querySelectorAll('#app-screen h1, #app-screen h2, #app-screen h3, #app-screen h4, #app-screen label, #app-screen th, #app-screen [placeholder]');
                targets.forEach(el => {
                    if (el.closest('#global-search-modal') || el.closest('#rule-widget-modal')) return;
                    let text = el.hasAttribute('placeholder') && el.getAttribute('placeholder') ? el.getAttribute('placeholder') : (el.textContent || el.innerText);
                    text = text.replace(/[\n\r]+|[\s]{2,}/g, ' ').trim();
                    if (!text || text.length < 2) return;
                    if (text.toLowerCase().includes(query)) {
                        let contextName = 'Fiche';
                        const widget = el.closest('.draggable-widget, .modal-box, .scroll-paper');
                        if (widget) { const titleEl = widget.querySelector('.section-title, h2, .grimoire-title'); if (titleEl) contextName = titleEl.textContent.trim().replace(/[▶▼]/g, ''); }
                        const clickTarget = el.hasAttribute('placeholder') ? el : (el.closest('div, li, tr, label') || el);
                        if (!found.some(item => item.element === clickTarget)) found.push({ title: text, context: contextName, element: clickTarget });
                    }
                });
                return found;
            }

            // Révèle un élément (onglet masqué) puis le met en évidence.
            function revealAndScroll(el) {
                if (!el) return;
                const mobSec = el.closest('.mob-section');
                if (mobSec && !mobSec.classList.contains('active') && window.__switchMobileTab) window.__switchMobileTab(mobSec.dataset.msec);
                const tabContent = el.closest('.tab-content');
                if (tabContent && tabContent.classList.contains('hidden')) {
                    const tabBtn = document.querySelector(`[data-tab="${tabContent.id}"]`);
                    if (tabBtn) tabBtn.click();
                }
                setTimeout(() => {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('search-highlight-active');
                    setTimeout(() => el.classList.remove('search-highlight-active'), 2400);
                }, 120);
            }

            function escSearch(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
            function makeResultRow(icon, title, subtitle, onClick) {
                const row = document.createElement('div');
                row.className = 'search-result-item';
                row.innerHTML = `<div class="result-title">${icon} ${escSearch(title)}</div><div class="result-path">${escSearch(subtitle)}</div>`;
                row.addEventListener('click', onClick);
                return row;
            }
            function groupHeader(label) { const h = document.createElement('div'); h.className = 'search-group-head'; h.textContent = label; return h; }

            // Fermeture du widget de règle (✕ et clic sur le fond)
            const ruleWidgetModal = document.getElementById('rule-widget-modal');
            const btnCloseRule = document.getElementById('btn-close-rule-widget');
            if (btnCloseRule && ruleWidgetModal) btnCloseRule.addEventListener('click', () => ruleWidgetModal.classList.add('hidden'));
            if (ruleWidgetModal) ruleWidgetModal.addEventListener('click', (e) => { if (e.target === ruleWidgetModal) ruleWidgetModal.classList.add('hidden'); });

            let srdSearchToken = 0;
            searchInput.addEventListener('input', () => {
                const query = searchInput.value.toLowerCase().trim();
                searchResults.innerHTML = '';
                if (!query) { searchResults.innerHTML = '<div style="text-align:center; padding:20px; color:#777; font-style:italic;">Entrez un mot-clé pour lancer la recherche...</div>'; return; }
                let any = false;

                // 1) Données de ta fiche
                const data = searchSheetData(query);
                if (data.length) {
                    any = true;
                    searchResults.appendChild(groupHeader('📋 Ta fiche'));
                    data.slice(0, 12).forEach(d => searchResults.appendChild(makeResultRow(d.icon || '•', d.title, d.subtitle, () => { closeSearch(); revealAndScroll(document.getElementById(d.widgetId)); })));
                }

                // 2) Base de règles SRD — chargée à la demande, donc asynchrone.
                // On réserve la place tout de suite et on la remplit à l'arrivée ;
                // un jeton écarte les réponses d'une frappe déjà obsolète.
                const srdSlot = document.createElement('div');
                searchResults.appendChild(srdSlot);
                const myToken = ++srdSearchToken;
                if (window.SRD) {
                    window.SRD.search(query, { limit: 14 }).then(results => {
                        if (myToken !== srdSearchToken || !results.length) return;
                        srdSlot.appendChild(groupHeader('📖 Règles du jeu'));
                        results.forEach(r => srdSlot.appendChild(
                            makeResultRow(r.icon, r.name, r.subtitle || r.categoryLabel,
                                          () => { closeSearch(); openSrdEntry(r); })));
                        emptyMsg?.remove();
                    }).catch(err => {
                        if (myToken !== srdSearchToken) return;
                        srdSlot.innerHTML = `<div style="text-align:center; padding:10px; color:#c0392b; font-size:0.8rem;">Règles indisponibles hors connexion tant qu'elles n'ont pas été consultées une fois.</div>`;
                    });
                }

                // 3) Autres libellés présents sur la fiche
                const page = searchPageElements(query);
                if (page.length) {
                    any = true;
                    searchResults.appendChild(groupHeader('🧭 Sur la page'));
                    page.slice(0, 8).forEach(p => searchResults.appendChild(makeResultRow('🧭', p.title, p.context, () => { closeSearch(); revealAndScroll(p.element); if (p.element.tagName === 'INPUT' || p.element.tagName === 'TEXTAREA') setTimeout(() => p.element.focus(), 320); })));
                }

                // Message « aucun résultat » : un élément à part, que la réponse SRD
                // (asynchrone) peut retirer sans écraser les résultats déjà affichés.
                var emptyMsg = null;
                if (!any) { emptyMsg = document.createElement("div"); emptyMsg.style.cssText = "text-align:center; padding:20px; color:#777; font-style:italic;"; emptyMsg.textContent = "Aucun résultat. Essaie un autre mot-clé (règle, capacité, objet, sort…)."; searchResults.appendChild(emptyMsg); }
            });

            window.openGlobalSearch = openSearch;
            window.closeGlobalSearch = closeSearch;
        }

        // (L'ancien gestionnaire de raccourcis + son affichage dans le menu ☰ ont été supprimés
        //  le 14 juil. 2026 : il faisait doublon avec l'éditeur unique — voir PLAYER_SC_ACTIONS.)
    }
});
