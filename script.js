document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. BASE DE DONNÉES ET GESTIONNAIRE D'ÉTAT
    // ==========================================
    const DB = {
        get: function(key) { try { return localStorage.getItem(key); } catch(e) { return null; } },
        set: function(key, val) { 
            try { localStorage.setItem(key, val); } catch(e) { console.warn("Erreur sauvegarde locale."); }
            if (window.SupaAuth?.currentUser && window.SyncQueue && ACTIVE_CHAR_ID && key.startsWith(ACTIVE_CHAR_ID + '_')) {
                const subKey = key.slice(ACTIVE_CHAR_ID.length + 1);
                if (!key.startsWith('dnd-theme-') && !key.startsWith('dnd-custom-background')) {
                    window.SyncQueue.push(ACTIVE_CHAR_ID, subKey, val);
                }
            }
        },
        remove: function(key) { try { localStorage.removeItem(key); } catch(e) {} },
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
    
    function applyTheme() {
        let primary = DB.get('dnd-theme-primary') || '#7A2828';
        let accent = DB.get('dnd-theme-accent') || '#C49B35';
        let sheetBg = DB.get('dnd-theme-sheet-bg') || '#FAF3E0';
        let widgetBg = DB.get('dnd-theme-widget-bg') || '#FFFFFF';
        let concentrationColor = DB.get('dnd-theme-concentration') || '#2980b9';
        
        document.documentElement.style.setProperty('--primary-color', primary);
        document.documentElement.style.setProperty('--accent-color', accent);
        document.documentElement.style.setProperty('--sheet-bg-color', sheetBg);
        document.documentElement.style.setProperty('--widget-bg', widgetBg);
        document.documentElement.style.setProperty('--concentration-color', concentrationColor);
        
        let cp = document.getElementById('color-primary'); if(cp) cp.value = primary;
        let ca = document.getElementById('color-accent'); if(ca) ca.value = accent;
        let csb = document.getElementById('color-sheet-bg'); if(csb) csb.value = sheetBg;
        let cwb = document.getElementById('color-widget-bg'); if(cwb) cwb.value = widgetBg;
        let cc = document.getElementById('color-concentration'); if(cc) cc.value = concentrationColor;
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

    // --- Mode Nuit (fiche) ---
    const toggleDarkMode = document.getElementById('toggle-dark-mode');
    function applyDarkMode(on) { document.body.classList.toggle('theme-dark', on); if(toggleDarkMode) toggleDarkMode.checked = on; }
    applyDarkMode(DB.get('dnd-theme-darkmode') === 'true');
    if(toggleDarkMode) toggleDarkMode.addEventListener('change', (e) => { DB.set('dnd-theme-darkmode', e.target.checked); applyDarkMode(e.target.checked); });

    const cPrim = document.getElementById('color-primary'); if(cPrim) cPrim.addEventListener('input', (e) => { document.documentElement.style.setProperty('--primary-color', e.target.value); DB.set('dnd-theme-primary', e.target.value); });
    const cAcc = document.getElementById('color-accent'); if(cAcc) cAcc.addEventListener('input', (e) => { document.documentElement.style.setProperty('--accent-color', e.target.value); DB.set('dnd-theme-accent', e.target.value); });
    const cShBg = document.getElementById('color-sheet-bg'); if(cShBg) cShBg.addEventListener('input', (e) => { document.documentElement.style.setProperty('--sheet-bg-color', e.target.value); DB.set('dnd-theme-sheet-bg', e.target.value); });
    const cWdBg = document.getElementById('color-widget-bg'); if(cWdBg) cWdBg.addEventListener('input', (e) => { document.documentElement.style.setProperty('--widget-bg', e.target.value); DB.set('dnd-theme-widget-bg', e.target.value); });
    const cConc = document.getElementById('color-concentration'); if(cConc) cConc.addEventListener('input', (e) => { document.documentElement.style.setProperty('--concentration-color', e.target.value); DB.set('dnd-theme-concentration', e.target.value); });
    const btnResetTheme = document.getElementById('btn-reset-theme'); if(btnResetTheme) btnResetTheme.addEventListener('click', () => { DB.remove('dnd-theme-primary'); DB.remove('dnd-theme-accent'); DB.remove('dnd-theme-sheet-bg'); DB.remove('dnd-theme-widget-bg'); DB.remove('dnd-theme-concentration'); applyTheme(); });

    const btnSettingsToggle = document.getElementById('btn-settings-toggle');
    const settingsDropdown = document.getElementById('settings-dropdown');
    if (btnSettingsToggle && settingsDropdown) {
        btnSettingsToggle.addEventListener('click', (e) => { e.stopPropagation(); settingsDropdown.classList.toggle('hidden'); });
        document.addEventListener('click', (e) => { if (!settingsDropdown.classList.contains('hidden') && !e.target.closest('.settings-container')) { settingsDropdown.classList.add('hidden'); } });
    }

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

    const btnExportJson = document.getElementById('btn-export-json');
    if (btnExportJson) {
        btnExportJson.addEventListener('click', async () => {
            btnExportJson.disabled = true; btnExportJson.textContent = '⏳ Export en cours…';
            try {
                let exportData;
                if (window.SupaAuth?.currentUser) {
                    const chars = await window.SupaAuth.loadCharacters(); exportData = { version: "4.0", characters: [] };
                    for (const c of chars) { const data = await window.SupaAuth.loadCharacterData(c.id); exportData.characters.push({ meta: c, data: data }); }
                } else {
                    exportData = { version: "3.0", charactersList: charactersList, activeCharId: ACTIVE_CHAR_ID, allData: {} };
                    DB.keys().forEach(k => { exportData.allData[k] = DB.get(k); });
                }
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
                const a = document.createElement('a'); a.setAttribute("href", dataStr); a.setAttribute("download", "sauvegarde_dnd.json"); document.body.appendChild(a); a.click(); a.remove();
            } catch(err) { alert("Erreur lors de l'export : " + err.message); } finally { btnExportJson.disabled = false; btnExportJson.textContent = '📥 Exporter la sauvegarde'; }
        });
    }

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
                const a = document.createElement('a'); a.setAttribute("href", dataStr); a.setAttribute("download", "fiche_" + safe + ".json"); document.body.appendChild(a); a.click(); a.remove();
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
    function applySavedBackground() { const savedBg = DB.get(CUSTOM_BG_KEY); if(savedBg && savedBg !== 'undefined') { document.body.style.backgroundImage = `url("${savedBg}")`; } else { document.body.style.backgroundImage = ''; } }
    applySavedBackground();
    
    const btnChangeBg = document.getElementById('btn-change-bg'); if(btnChangeBg && bgInput) { btnChangeBg.addEventListener('click', () => { bgInput.click(); if(settingsDropdown) settingsDropdown.classList.add('hidden'); }); }
    if(bgInput) { bgInput.addEventListener('change', (e) => { const file = e.target.files[0]; if(!file || !file.type.startsWith('image/')) return; const reader = new FileReader(); reader.onload = (event) => { const img = new Image(); img.onload = () => { const canvas = document.createElement('canvas'); const MAX_WIDTH = 1920; let width = img.width; let height = img.height; if(width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; } canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height); try { DB.set(CUSTOM_BG_KEY, canvas.toDataURL('image/jpeg', 0.7)); applySavedBackground(); } catch (err) { alert("L'image est toujours trop lourde."); } bgInput.value = ''; }; img.src = event.target.result; }; reader.readAsDataURL(file); }); }
    const btnResetBg = document.getElementById('btn-reset-bg'); if(btnResetBg) { btnResetBg.addEventListener('click', () => { DB.remove(CUSTOM_BG_KEY); applySavedBackground(); if(settingsDropdown) settingsDropdown.classList.add('hidden'); }); }

    const btnGoHome = document.getElementById('btn-go-home'); if(btnGoHome) btnGoHome.addEventListener('click', () => { DB.remove('dnd-active-char'); location.reload(); });

    const btnCreateChar = document.getElementById('btn-create-char');
    if(btnCreateChar) {
        btnCreateChar.addEventListener('click', async () => {
            const inputName = document.getElementById('new-char-name'); if(!inputName) return; const name = inputName.value.trim();
            if(name) { 
                let newId, newChar;
                if(window.SupaAuth?.currentUser) { newChar = await window.SupaAuth.createCharacter(name); if(!newChar) { alert("Erreur lors de la création."); return; } newId = newChar.id; charactersList.push({ id: newId, name: name, level: 1, class: '' }); DB.set('dnd-character-list', JSON.stringify(charactersList)); } else { newId = 'char_' + Date.now(); charactersList.push({ id: newId, name: name, level: 1, class: '' }); DB.set('dnd-character-list', JSON.stringify(charactersList)); }
                DB.set(`${newId}_dnd-sheet-char-name`, name); DB.set('dnd-active-char', newId);
                DB.set('dnd-pj-wizard-pending', '1');   // fiche neuve → l'assistant de création se lance après le reload (pj-tutorial.js)
                location.reload();
            } else { alert("Donne un nom à ton personnage."); }
        });
    }

    const homeScreen = document.getElementById('home-screen'); const appScreen = document.getElementById('app-screen');

    if(!ACTIVE_CHAR_ID) { 
        if(homeScreen) homeScreen.classList.remove('hidden'); if(appScreen) appScreen.classList.add('hidden'); 
        const listDiv = document.getElementById('character-list'); 
        if(listDiv) {
            listDiv.innerHTML = '';
            if(charactersList.length === 0) { listDiv.innerHTML = "<p style='text-align:center; font-style:italic;'>Aucun personnage. Créez-en un !</p>"; } else {
                charactersList.forEach(c => {
                    let card = document.createElement('div'); card.className = 'char-card'; let info = document.createElement('div'); info.className = 'char-info';
                    info.innerHTML = `<strong>${c.name}</strong> <span style="font-size:0.8rem; color:#888;">(Niv.${c.level || 1} ${c.class || ''})</span>`;
                    info.onclick = async () => { DB.set('dnd-active-char', c.id); if(window.SupaAuth?.currentUser && window.loadCharacterDataIntoLocalStorage) { await window.loadCharacterDataIntoLocalStorage(c.id); } location.reload(); };
                    let delBtn = document.createElement('button'); delBtn.className = 'btn-delete-char'; delBtn.innerHTML = '✖';
                    delBtn.onclick = async (e) => { e.stopPropagation(); if(confirm(`Supprimer définitivement ${c.name} ?`)) { if(window.SupaAuth?.currentUser) { await window.SupaAuth.deleteCharacter(c.id); } charactersList = charactersList.filter(char => char.id !== c.id); DB.set('dnd-character-list', JSON.stringify(charactersList)); DB.keys().forEach(k => { if(k.startsWith(c.id + '_')) DB.remove(k); }); location.reload(); } };
                    card.appendChild(info); card.appendChild(delBtn); listDiv.appendChild(card);
                });
            }
        }
    } else { 
        let quillNewJournal = new Quill('#new-journal-content', { theme: 'snow' });
        let quillNewSpell = new Quill('#new-spell-desc', { theme: 'snow' });
        let quillEditJournal = null;

        if(homeScreen) homeScreen.classList.add('hidden'); if(appScreen) appScreen.classList.remove('hidden'); 

        document.querySelectorAll('.btn-close-modal').forEach(btn => { btn.addEventListener('click', (e) => e.target.closest('.modal-overlay').classList.add('hidden')); });

        const ALL_WIDGETS = ['widget-rests', 'widget-concentration', 'widget-inspiration', 'widget-proficiency', 'widget-stats', 'widget-appearance', 'widget-traits', 'widget-training', 'widget-combat', 'widget-hp', 'widget-attacks', 'widget-currency', 'widget-inventory', 'widget-companion', 'widget-quests', 'widget-magic-stats', 'widget-abilities', 'widget-spells', 'widget-prepared-spells', 'widget-macros', 'widget-initiative', 'widget-notes', 'widget-calculator'];
        
        function safeStoreAllWidgets() { const storage = document.getElementById('widget-storage'); ALL_WIDGETS.forEach(wId => { const w = document.getElementById(wId); if(w && w.parentNode !== storage) { storage.appendChild(w); } }); }

        document.body.addEventListener('click', (e) => {
            const header = e.target.closest('.collapsible-header'); if(!header) return;
            if(e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.classList.contains('btn-icon')) return;
            if(e.target.closest('.trait-card')) return; 
            e.preventDefault(); const content = header.nextElementSibling; if(!content || !content.classList.contains('collapsible-content')) return;
            const icon = header.querySelector('.collapse-icon'); content.classList.toggle('collapsed'); if(icon) icon.textContent = content.classList.contains('collapsed') ? '▶' : '▼';
        });

        const layoutSelector = document.getElementById('layout-selector'); const layoutTabsContainer = document.getElementById('layout-tabs-container'); const layoutClassicContainer = document.getElementById('layout-classic-container'); const layoutCustomContainer = document.getElementById('layout-custom-container'); const btnEditCustom = document.getElementById('btn-edit-custom'); let isEditMode = false;
        
        const DEFAULT_CLASSIC_LAYOUT = { 'col-left': ['widget-proficiency', 'widget-inspiration', 'widget-concentration', 'widget-stats', 'widget-training', 'widget-quests'], 'col-center': ['widget-combat', 'widget-hp', 'widget-rests', 'widget-traits', 'widget-attacks', 'widget-inventory', 'widget-currency', 'widget-initiative', 'widget-companion'], 'col-right': ['widget-magic-stats', 'widget-spells', 'widget-prepared-spells', 'widget-abilities', 'widget-macros', 'widget-calculator'], 'col-bottom': ['widget-appearance', 'widget-notes'] };
        const DEFAULT_TABS_LAYOUT = { 'tab-strict-gen': ['widget-proficiency', 'widget-concentration', 'widget-inspiration', 'widget-stats', 'widget-rests', 'widget-appearance', 'widget-traits', 'widget-training', 'widget-companion'], 'tab-strict-com': ['widget-combat', 'widget-initiative', 'widget-hp', 'widget-attacks', 'widget-currency', 'widget-inventory'], 'tab-strict-mag': ['widget-magic-stats', 'widget-macros', 'widget-abilities', 'widget-spells', 'widget-prepared-spells', 'widget-calculator'], 'tab-strict-not': ['widget-quests', 'widget-notes'] };

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

        function applyLayout(mode) {
            setStore('dnd-layout-mode', mode, false); isEditMode = false; const profileActions = document.getElementById('profile-actions'); if(profileActions) { if(mode.startsWith('prof_')) profileActions.classList.remove('hidden'); else profileActions.classList.add('hidden'); }
            if(document.getElementById('custom-layout-manager')) document.getElementById('custom-layout-manager').classList.add('hidden'); if(btnEditCustom) btnEditCustom.textContent = "⚙️ Modifier Disposition";
            if(layoutTabsContainer) layoutTabsContainer.classList.add('hidden'); if(layoutClassicContainer) layoutClassicContainer.classList.add('hidden'); if(layoutCustomContainer) layoutCustomContainer.classList.add('hidden');
            safeStoreAllWidgets(); applyWidgetSizes();

            if (mode === 'tabs' && layoutTabsContainer) { layoutTabsContainer.classList.remove('hidden'); for (const [containerId, widgetList] of Object.entries(DEFAULT_TABS_LAYOUT)) { const container = document.getElementById(containerId); if (container) { widgetList.forEach(widgetId => { const w = document.getElementById(widgetId); if (w) container.appendChild(w); }); } } switchStrictTab('tab-strict-gen');
            } else if (mode === 'classic' && layoutClassicContainer) { layoutClassicContainer.classList.remove('hidden'); for (const [containerId, widgetList] of Object.entries(DEFAULT_CLASSIC_LAYOUT)) { const container = document.getElementById(containerId); if (container) { widgetList.forEach(widgetId => { const w = document.getElementById(widgetId); if (w) container.appendChild(w); }); } }
            } else if (mode === 'custom' || mode.startsWith('prof_')) { layoutCustomContainer.classList.remove('hidden'); if (mode.startsWith('prof_')) { let prof = customProfiles.find(p => p.id === mode); if (prof) { customLayout = prof.layout; } else { applyLayout('classic'); return; } } else { let savedBrouillon = getStore('dnd-custom-layout'); if (savedBrouillon && Array.isArray(savedBrouillon)) { customLayout = savedBrouillon; } else { customLayout = [{ id: 'tab_custom_default', name: 'Ma Fiche', col1: [...DEFAULT_CLASSIC_LAYOUT['col-left']], col2: [...DEFAULT_CLASSIC_LAYOUT['col-center']], col3: [...DEFAULT_CLASSIC_LAYOUT['col-right']] }]; } } if (!customLayout.find(t => t.id === activeCustomTabId)) { activeCustomTabId = customLayout[0].id; managerActiveTabId = customLayout[0].id; } renderCustomSheet(); }
            if(settingsDropdown) settingsDropdown.classList.add('hidden');
        }
        if(layoutSelector) layoutSelector.addEventListener('change', (e) => applyLayout(e.target.value));
        function switchStrictTab(tabId) { document.querySelectorAll('.tab-btn-strict').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId)); document.querySelectorAll('#layout-tabs-container .tab-content').forEach(content => { content.classList.toggle('hidden', content.id !== tabId); content.classList.toggle('active', content.id === tabId); }); }
        document.querySelectorAll('.tab-btn-strict').forEach(btn => { btn.addEventListener('click', () => switchStrictTab(btn.dataset.tab)); });

        window.appendCalc = (val) => { const disp = document.getElementById('calc-display'); if(disp) disp.value += val; }; window.clearCalc = () => { const disp = document.getElementById('calc-display'); if(disp) disp.value = ''; }; window.evalCalc = () => { const disp = document.getElementById('calc-display'); if(disp) { try { let safeVal = disp.value.replace(/[^0-9+\-*/.]/g, ''); disp.value = eval(safeVal) || ''; } catch(e) { disp.value = 'Erreur'; setTimeout(() => disp.value='', 1000); } } };

        const avatarInput = document.getElementById('avatar-file-input'); const avatarPreview = document.getElementById('main-avatar-preview'); const avatarHeader = document.getElementById('header-avatar'); const avatarPlaceholder = document.getElementById('avatar-placeholder');
        function loadAvatar() { const savedAvatar = getStore('dnd-avatar', false); if(savedAvatar && avatarPreview && avatarPlaceholder && avatarHeader) { avatarPreview.src = savedAvatar; avatarPreview.classList.remove('hidden'); avatarPlaceholder.classList.add('hidden'); avatarHeader.style.backgroundImage = `url("${savedAvatar}")`; } }
        if(avatarInput) { avatarInput.addEventListener('change', (e) => { const file = e.target.files[0]; if(!file || !file.type.startsWith('image/')) return; const reader = new FileReader(); reader.onload = (event) => { const img = new Image(); img.onload = () => { const canvas = document.createElement('canvas'); const MAX_WIDTH = 250; const scaleSize = MAX_WIDTH / img.width; canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); try { setStore('dnd-avatar', canvas.toDataURL('image/jpeg', 0.8), false); loadAvatar(); } catch (err) { alert("L'image est toujours trop lourde."); } bgInput.value = ''; }; img.src = event.target.result; }; reader.readAsDataURL(file); }); }
        loadAvatar();

        const cbConcentration = document.getElementById('is-concentrating'); const concentrationGlow = document.getElementById('concentration-glow');
        function updateConcentrationUI() { if(!cbConcentration || !concentrationGlow || !avatarHeader) return; if(cbConcentration.checked) { document.body.classList.add('concentrating-mode'); concentrationGlow.classList.remove('hidden'); avatarHeader.classList.add('concentrating'); } else { document.body.classList.remove('concentrating-mode'); concentrationGlow.classList.add('hidden'); avatarHeader.classList.remove('concentrating'); } }
        if(cbConcentration) { cbConcentration.checked = getStore('dnd-is-concentrating', false) === 'true'; updateConcentrationUI(); cbConcentration.addEventListener('change', () => { setStore('dnd-is-concentrating', cbConcentration.checked, false); updateConcentrationUI(); }); }

        const btnGlobalSearchTrigger = document.getElementById('btn-global-search-trigger');
        const toggleSearchBtn = document.getElementById('toggle-search-btn');
        if(toggleSearchBtn && btnGlobalSearchTrigger) {
            let showSearch = DB.get('dnd-show-search-btn'); if(showSearch === null) showSearch = 'true'; toggleSearchBtn.checked = showSearch === 'true'; btnGlobalSearchTrigger.classList.toggle('hidden', !toggleSearchBtn.checked);
            toggleSearchBtn.addEventListener('change', (e) => { DB.set('dnd-show-search-btn', e.target.checked); btnGlobalSearchTrigger.classList.toggle('hidden', !e.target.checked); });
        }

        const toggleMusicPlayer = document.getElementById('toggle-music-player');
        if(toggleMusicPlayer) {
            let showMusic = DB.get('dnd-show-music-player'); if(showMusic === null) showMusic = 'true';
            toggleMusicPlayer.checked = showMusic === 'true';
            if(window.MusicPlayer) window.MusicPlayer.setVisible(toggleMusicPlayer.checked, false);
            toggleMusicPlayer.addEventListener('change', (e) => { if(window.MusicPlayer) window.MusicPlayer.setVisible(e.target.checked, true); else DB.set('dnd-show-music-player', e.target.checked); });
        }

        const btnToggleDice = document.getElementById('btn-toggle-dice'); const diceDrawer = document.getElementById('dice-drawer'); const toggleFloatingDice = document.getElementById('toggle-floating-dice');
        if(toggleFloatingDice && btnToggleDice && diceDrawer) {
            let showFloatingDice = DB.get('dnd-show-floating-dice'); if(showFloatingDice === null) showFloatingDice = 'true'; toggleFloatingDice.checked = showFloatingDice === 'true'; btnToggleDice.classList.toggle('hidden', !toggleFloatingDice.checked);
            toggleFloatingDice.addEventListener('change', (e) => { DB.set('dnd-show-floating-dice', e.target.checked); btnToggleDice.classList.toggle('hidden', !e.target.checked); if(!e.target.checked && diceDrawer.classList.contains('open')) diceDrawer.classList.remove('open'); });
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

        // --- Créations de dés personnalisées : FONCTIONNALITÉ RETIRÉE ---
        // On conserve les fonctions (appelées à l'affichage des résultats) en no-op pour ne rien casser.
        function loadDiceDesigns() { return []; }
        function persistDiceDesigns() {}
        let diceDesigns = [];
        let activeDesignId = null;
        function getActiveDesign() { return null; }   // plus de skin personnalisé → dés standards
        function faceImageFor(faces) { const d = getActiveDesign(); if (!d) return null; return d.faces['d' + faces] || d.faces.all || null; }
        function applyCustomDiceSkin(scope) {
            const d = getActiveDesign();
            (scope || document).querySelectorAll('.die-result[data-faces]').forEach(el => {
                const img = faceImageFor(parseInt(el.getAttribute('data-faces')));
                if (img) { el.classList.add('has-skin'); el.style.backgroundImage = `url(${img})`; if (d && d.bg) el.style.backgroundColor = d.bg; }
            });
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
        initDiceBox();

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

            if (resultsBox) { resultsBox.innerHTML = resultsHTML; applyCustomDiceSkin(resultsBox); }
            if (totalBox) totalBox.innerHTML = `Total : <span class="total-number">${poolTotal}</span>`;
            sharePoolRoll(poolSnapshot, poolTotal, finalScores);   // partagé avec la table (si en session)
        }
        // Diffuse un lancer du lanceur de dés à la table + célèbre un d20 naturel seul
        function sharePoolRoll(poolSnapshot, poolTotal, scores) {
            const nat = (poolSnapshot.length === 1 && poolSnapshot[0] === 20) ? scores[0] : null;
            if (window.PlayerSession && window.PlayerSession.shareRoll) window.PlayerSession.shareRoll(poolSnapshot.map(f => 'd' + f).join(' + '), poolTotal, scores.join(' + '), nat);
            if (window.TableFX && nat) { if (nat === 20) window.TableFX.crit(); else if (nat === 1) window.TableFX.fumble(); }
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
            applyCustomDiceSkin(resultsBox);

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

        // --- Atelier de peinture de dés (canvas : pinceau, gomme, pipette, pot, annuler/refaire) ---
        (function setupDiceStudio() {
            const modal = document.getElementById('dice-studio-modal');
            const openBtn = document.getElementById('btn-open-dice-studio');
            const canvas = document.getElementById('ds-canvas');
            if (!modal || !canvas) return;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            const W = canvas.width, H = canvas.height;

            const TYPES = ['all', 'd4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
            const TYPE_LABEL = { all: 'Tous', d4: 'd4', d6: 'd6', d8: 'd8', d10: 'd10', d12: 'd12', d20: 'd20', d100: 'd100' };
            const PALETTE = ['#000000', '#ffffff', '#7A2828', '#C49B35', '#c0392b', '#e08a1e', '#27ae60', '#16a3a3', '#2563c9', '#7b3fa0', '#e84393', '#8a6d4a'];

            let tool = 'brush', color = '#C49B35', size = 12;
            let studioBg = '#7A2828';
            let studioScope = 'all';   // 'all' | 'd4' | 'd6' | … | 'd20'
            let studioFace = 0;        // index de la face en cours (si dé spécifique)
            let studioData = {};       // { all:url, d4:[url…], d6:[…], … }  (par-face)
            let drawing = false, lastX = 0, lastY = 0;
            let undoStack = [], redoStack = [];
            let dice3D = null;

            const FACE_COUNTS = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 10 };
            const faceCountOf = (type) => FACE_COUNTS[type] || 1;
            const firstNonNull = (arr) => Array.isArray(arr) ? (arr.find(Boolean) || null) : null;
            function ensureSlots(type) {
                if (type === 'all') { if (studioData.all === undefined) studioData.all = null; return; }
                if (!Array.isArray(studioData[type])) studioData[type] = Array(faceCountOf(type)).fill(null);
                while (studioData[type].length < faceCountOf(type)) studioData[type].push(null);
            }
            function curSlotGet() { if (studioScope === 'all') return studioData.all || null; ensureSlots(studioScope); return studioData[studioScope][studioFace] || null; }
            function curSlotSet(url) { if (studioScope === 'all') { studioData.all = url; } else { ensureSlots(studioScope); studioData[studioScope][studioFace] = url; } }
            function migrateOldFaces(faces) { // ancien format (1 image/type) → remplit toutes les faces
                const d = { all: (faces && faces.all) || null };
                Object.keys(FACE_COUNTS).forEach(t => { const img = (faces && (faces[t] || faces.all)) || null; d[t] = Array(faceCountOf(t)).fill(img); });
                return d;
            }

            const colorInput = document.getElementById('ds-color');
            const bgInput = document.getElementById('ds-bg');
            const preview = document.getElementById('ds-preview');

            const snapshot = () => { try { undoStack.push(ctx.getImageData(0, 0, W, H)); if (undoStack.length > 40) undoStack.shift(); redoStack = []; } catch (e) {} };
            const saveCanvasToFace = () => { curSlotSet(canvas.toDataURL('image/png')); };
            function loadFaceToCanvas() {
                ctx.clearRect(0, 0, W, H); undoStack = []; redoStack = [];
                const url = curSlotGet();
                if (url) { const img = new Image(); img.onload = () => { ctx.clearRect(0, 0, W, H); ctx.drawImage(img, 0, 0, W, H); updatePreview(); }; img.src = url; }
                else updatePreview();
            }
            function updatePreview() {
                if (dice3D) {
                    // Aperçu 3D actif : la face peinte est projetée sur le dé en temps réel
                    preview.style.backgroundImage = 'none';
                    preview.style.backgroundColor = '#161210';
                    dice3D.refresh();
                } else {
                    const url = curSlotGet() || canvas.toDataURL();
                    preview.style.backgroundColor = studioBg;
                    preview.style.backgroundImage = url ? `url(${url})` : 'none';
                }
            }

            // ---- Aperçu 3D temps réel (Three.js) : faces distinctes + clic pour sélectionner ----
            function build3DPreview() {
                if (typeof THREE === 'undefined') { console.warn('Three.js indisponible — aperçu 3D désactivé (aperçu plat conservé).'); return null; }
                const cvs = document.getElementById('ds-3d-canvas'); if (!cvs) return null;
                let renderer;
                try { renderer = new THREE.WebGLRenderer({ canvas: cvs, alpha: true, antialias: true }); }
                catch (e) { console.warn('WebGL indisponible — aperçu 3D désactivé.', e); return null; }
                renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

                const scene = new THREE.Scene();
                const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100); camera.position.set(0, 0, 5);
                scene.add(new THREE.AmbientLight(0xffffff, 0.85));
                const d1 = new THREE.DirectionalLight(0xffffff, 0.85); d1.position.set(3, 5, 4); scene.add(d1);
                const d2 = new THREE.DirectionalLight(0xffffff, 0.3); d2.position.set(-4, -3, -2); scene.add(d2);
                const raycaster = new THREE.Raycaster(); const ndc = new THREE.Vector2();

                let mesh = null, faceCanvases = [], faceTextures = [], materials = [], triFace = [], faceNormals = [], running = false, raf = null;
                // Rotation : libre (idle) OU focus sur une face (snap fluide vers la caméra)
                let autoRotate = true, focused = false, dirty = false;
                const targetQuat = new THREE.Quaternion();
                const spinDelta = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0.25, 1, 0.12).normalize(), 0.018);

                function pentaBipyramid(r, h) {
                    const eq = []; for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; eq.push([Math.cos(a) * r, 0, Math.sin(a) * r]); }
                    const top = [0, h, 0], bot = [0, -h, 0], P = [];
                    for (let i = 0; i < 5; i++) { const a = eq[i], b = eq[(i + 1) % 5]; P.push(top[0], top[1], top[2], a[0], a[1], a[2], b[0], b[1], b[2]); P.push(bot[0], bot[1], bot[2], b[0], b[1], b[2], a[0], a[1], a[2]); }
                    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); return g;
                }
                function makeGeometry(type) {
                    const r = 1.4;
                    switch (type) {
                        case 'd4': return new THREE.TetrahedronGeometry(r * 1.3);
                        case 'd8': return new THREE.OctahedronGeometry(r);
                        case 'd10': case 'd100': return pentaBipyramid(1.25, 1.5);
                        case 'd12': return new THREE.DodecahedronGeometry(r);
                        case 'd20': return new THREE.IcosahedronGeometry(r);
                        default: return new THREE.BoxGeometry(2, 2, 2); // d6 / all
                    }
                }
                // Regroupe les triangles coplanaires = vraies faces, pose des UV planaires 0..1 par face
                function buildFacesUV(geo) {
                    const g = geo.index ? geo.toNonIndexed() : geo;
                    const pos = g.attributes.position; const tri = pos.count / 3;
                    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2));
                    const uv = g.attributes.uv;
                    const key = n => `${Math.round(n.x * 100)},${Math.round(n.y * 100)},${Math.round(n.z * 100)}`;
                    const fmap = new Map(), tf = [], ftris = [], fnormals = [];
                    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3(), nm = new THREE.Vector3();
                    for (let t = 0; t < tri; t++) {
                        a.fromBufferAttribute(pos, t * 3); b.fromBufferAttribute(pos, t * 3 + 1); c.fromBufferAttribute(pos, t * 3 + 2);
                        ab.subVectors(b, a); ac.subVectors(c, a); nm.crossVectors(ab, ac).normalize();
                        const k = key(nm); let id = fmap.get(k); if (id === undefined) { id = fmap.size; fmap.set(k, id); ftris[id] = []; fnormals[id] = nm.clone(); }
                        tf[t] = id; ftris[id].push(t);
                    }
                    const U = new THREE.Vector3(), V = new THREE.Vector3(), N = new THREE.Vector3(), p = new THREE.Vector3();
                    for (let f = 0; f < fmap.size; f++) {
                        const t0 = ftris[f][0];
                        a.fromBufferAttribute(pos, t0 * 3); b.fromBufferAttribute(pos, t0 * 3 + 1); c.fromBufferAttribute(pos, t0 * 3 + 2);
                        ab.subVectors(b, a); ac.subVectors(c, a); N.crossVectors(ab, ac).normalize(); U.copy(ab).normalize(); V.crossVectors(N, U).normalize();
                        let minS = Infinity, minT = Infinity, maxS = -Infinity, maxT = -Infinity; const vs = [];
                        ftris[f].forEach(t => { for (let k = 0; k < 3; k++) { p.fromBufferAttribute(pos, t * 3 + k); const s = p.dot(U), tt = p.dot(V); vs.push([t * 3 + k, s, tt]); if (s < minS) minS = s; if (tt < minT) minT = tt; if (s > maxS) maxS = s; if (tt > maxT) maxT = tt; } });
                        const ds = (maxS - minS) || 1, dt = (maxT - minT) || 1;
                        vs.forEach(([vi, s, tt]) => uv.setXY(vi, (s - minS) / ds, (tt - minT) / dt));
                    }
                    uv.needsUpdate = true;
                    g.clearGroups();
                    const allMode = (studioScope === 'all');
                    for (let t = 0; t < tri; t++) g.addGroup(t * 3, 3, allMode ? 0 : tf[t]);
                    return { g, faceCount: fmap.size, tf, normals: fnormals };
                }
                function composeInto(i, url) {
                    const fctx = faceCanvases[i].getContext('2d');
                    fctx.clearRect(0, 0, 128, 128); fctx.fillStyle = studioBg || '#7A2828'; fctx.fillRect(0, 0, 128, 128);
                    faceTextures[i].needsUpdate = true;
                    if (url) { const img = new Image(); img.onload = () => { fctx.fillStyle = studioBg || '#7A2828'; fctx.fillRect(0, 0, 128, 128); fctx.drawImage(img, 0, 0, 128, 128); faceTextures[i].needsUpdate = true; }; img.src = url; }
                }
                function disposeMats() { materials.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); }
                function rebuild() {
                    if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); }
                    disposeMats();
                    const built = buildFacesUV(makeGeometry(studioScope));
                    triFace = built.tf; faceNormals = built.normals;
                    const allMode = (studioScope === 'all');
                    const matCount = allMode ? 1 : built.faceCount;
                    faceCanvases = []; faceTextures = []; materials = [];
                    for (let i = 0; i < matCount; i++) {
                        const fc = document.createElement('canvas'); fc.width = fc.height = 128; faceCanvases.push(fc);
                        const tx = new THREE.CanvasTexture(fc); if ('SRGBColorSpace' in THREE) tx.colorSpace = THREE.SRGBColorSpace; faceTextures.push(tx);
                        materials.push(new THREE.MeshStandardMaterial({ map: tx, roughness: 0.5, metalness: 0.12, flatShading: true, side: THREE.DoubleSide }));
                    }
                    mesh = new THREE.Mesh(built.g, materials); scene.add(mesh);
                    if (allMode) composeInto(0, studioData.all);
                    else { ensureSlots(studioScope); for (let i = 0; i < built.faceCount; i++) composeInto(i, (studioData[studioScope] || [])[i]); }
                    // Après reconstruction : rotation libre (le snap n'arrive qu'au choix d'une FACE)
                    highlight(studioFace); dirty = true; focused = false; autoRotate = true;
                }
                // Recompose réellement la texture de la face courante (depuis le canvas live)
                function recomposeCurrent() {
                    if (!materials.length) return;
                    const i = (studioScope === 'all') ? 0 : Math.min(studioFace, materials.length - 1);
                    const fctx = faceCanvases[i] && faceCanvases[i].getContext('2d'); if (!fctx) return;
                    fctx.clearRect(0, 0, 128, 128); fctx.fillStyle = studioBg || '#7A2828'; fctx.fillRect(0, 0, 128, 128);
                    try { fctx.drawImage(canvas, 0, 0, 128, 128); } catch (e) {}
                    faceTextures[i].needsUpdate = true;
                }
                // Coalescé : on ne fait l'upload de texture qu'1×/frame (perf & chaleur mobile)
                function refresh() { dirty = true; }
                function highlight(i) { materials.forEach((m, k) => m.emissive.setHex((k === i && studioScope !== 'all') ? 0x3a2f12 : 0x000000)); }
                // Oriente en douceur la face i face à la caméra (parallèle à l'écran) et fige la rotation
                function focusFace(i) {
                    if (studioScope === 'all' || !faceNormals[i]) { focused = false; autoRotate = true; return; }
                    targetQuat.setFromUnitVectors(faceNormals[i].clone().normalize(), new THREE.Vector3(0, 0, 1));
                    focused = true; autoRotate = false;
                }
                function resumeSpin() { focused = false; autoRotate = true; }
                function toggleSpin() { if (autoRotate) { if (studioScope !== 'all') focusFace(studioFace); } else { resumeSpin(); } }
                function fitSize() { const w = cvs.clientWidth || 220, h = cvs.clientHeight || 220; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
                function loop() {
                    if (!running) return;
                    if (dirty) { recomposeCurrent(); dirty = false; }
                    if (mesh) {
                        if (focused) mesh.quaternion.slerp(targetQuat, 0.2);          // snap fluide
                        else if (autoRotate) mesh.quaternion.multiply(spinDelta);     // rotation libre
                    }
                    renderer.render(scene, camera);
                    raf = requestAnimationFrame(loop);
                }
                function start() { if (running) return; running = true; fitSize(); if (!mesh) rebuild(); loop(); }
                function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

                // Clic sur une face du dé 3D → la sélectionne, l'oriente face caméra et verrouille la rotation
                cvs.addEventListener('pointerdown', (e) => {
                    if (studioScope === 'all' || !mesh) return;
                    const r = cvs.getBoundingClientRect();
                    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1; ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
                    raycaster.setFromCamera(ndc, camera);
                    const hit = raycaster.intersectObject(mesh)[0];
                    if (hit && triFace[hit.faceIndex] != null) { saveCanvasToFace(); studioFace = triFace[hit.faceIndex]; renderFaceTabs(); loadFaceToCanvas(); highlight(studioFace); focusFace(studioFace); }
                });
                window.addEventListener('resize', () => { if (running) fitSize(); });
                return { refresh, rebuild, start, stop, highlight, focusFace, resumeSpin, toggleSpin };
            }
            function renderTypeTabs() {
                const wrap = document.getElementById('ds-type-tabs'); if (!wrap) return; wrap.innerHTML = '';
                TYPES.forEach(t => {
                    const has = (t === 'all') ? !!studioData.all : (Array.isArray(studioData[t]) && studioData[t].some(Boolean));
                    const b = document.createElement('button');
                    b.className = 'ds-type-tab' + (t === studioScope ? ' active' : '') + (has ? ' has-design' : '');
                    b.textContent = TYPE_LABEL[t];
                    b.addEventListener('click', () => {
                        saveCanvasToFace();
                        studioScope = t; studioFace = 0;
                        renderTypeTabs(); renderFaceTabs(); loadFaceToCanvas();
                        if (dice3D) dice3D.rebuild();
                    });
                    wrap.appendChild(b);
                });
            }
            function renderFaceTabs() {
                const row = document.getElementById('ds-face-row'); const wrap = document.getElementById('ds-face-tabs');
                if (!row || !wrap) return;
                if (studioScope === 'all') { row.style.display = 'none'; wrap.innerHTML = ''; return; }
                row.style.display = 'flex';
                ensureSlots(studioScope); wrap.innerHTML = '';
                const n = faceCountOf(studioScope);
                for (let i = 0; i < n; i++) {
                    const b = document.createElement('button');
                    b.className = 'ds-face-tab' + (i === studioFace ? ' active' : '') + (studioData[studioScope][i] ? ' has-design' : '');
                    b.textContent = (i + 1);
                    b.addEventListener('click', () => { saveCanvasToFace(); studioFace = i; renderFaceTabs(); loadFaceToCanvas(); if (dice3D) { dice3D.highlight(i); dice3D.focusFace(i); } });
                    wrap.appendChild(b);
                }
            }
            function renderPalette() {
                const wrap = document.getElementById('ds-palette'); wrap.innerHTML = '';
                PALETTE.forEach(c => { const s = document.createElement('button'); s.className = 'ds-swatch'; s.style.background = c; s.title = c; s.addEventListener('click', () => { color = c; colorInput.value = c; setTool('brush'); }); wrap.appendChild(s); });
            }
            function renderGallery() {
                const g = document.getElementById('ds-gallery'); g.innerHTML = '';
                if (!diceDesigns.length) { g.innerHTML = '<div style="grid-column:1/-1;font-size:0.72rem;color:#999;text-align:center;padding:8px;">Aucune création pour l\'instant.</div>'; return; }
                diceDesigns.forEach(d => {
                    const item = document.createElement('div');
                    item.className = 'ds-gallery-item' + (d.id === activeDesignId ? ' active' : '');
                    item.style.backgroundColor = d.bg || '#7A2828';
                    if (d.thumb) item.style.backgroundImage = `url(${d.thumb})`;
                    item.title = d.name;
                    item.innerHTML = `<button class="ds-gi-del" title="Supprimer">✕</button><div class="ds-gi-name">${d.name}</div>`;
                    item.addEventListener('click', (e) => { if (e.target.classList.contains('ds-gi-del')) return; activeDesignId = d.id; DB.set('dnd-dice-active-design', d.id); renderGallery(); });
                    item.querySelector('.ds-gi-del').addEventListener('click', (e) => { e.stopPropagation(); if (confirm('Supprimer « ' + d.name + ' » ?')) { diceDesigns = diceDesigns.filter(x => x.id !== d.id); if (activeDesignId === d.id) { activeDesignId = null; DB.set('dnd-dice-active-design', ''); } persistDiceDesigns(); renderGallery(); } });
                    g.appendChild(item);
                });
            }
            function setTool(t) { tool = t; document.querySelectorAll('.ds-tool').forEach(x => x.classList.toggle('active', x.dataset.tool === t)); }

            const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; };
            function drawTo(x, y) {
                ctx.globalCompositeOperation = (tool === 'eraser') ? 'destination-out' : 'source-over';
                ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.stroke();
                ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.fill();
                ctx.globalCompositeOperation = 'source-over';
                lastX = x; lastY = y;
            }
            function pickColor(x, y) { const p = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data; if (p[3] === 0) return; const hex = '#' + [p[0], p[1], p[2]].map(v => v.toString(16).padStart(2, '0')).join(''); color = hex; colorInput.value = hex; setTool('brush'); }
            function floodFill(x, y) {
                x = Math.floor(x); y = Math.floor(y);
                const img = ctx.getImageData(0, 0, W, H), data = img.data;
                const i0 = (y * W + x) * 4, tr = data[i0], tg = data[i0 + 1], tb = data[i0 + 2], ta = data[i0 + 3];
                const tmp = document.createElement('canvas').getContext('2d'); tmp.fillStyle = color; tmp.fillRect(0, 0, 1, 1); const fc = tmp.getImageData(0, 0, 1, 1).data;
                if (tr === fc[0] && tg === fc[1] && tb === fc[2] && ta === fc[3]) return;
                const match = (i) => Math.abs(data[i] - tr) < 28 && Math.abs(data[i + 1] - tg) < 28 && Math.abs(data[i + 2] - tb) < 28 && Math.abs(data[i + 3] - ta) < 28;
                const stack = [[x, y]];
                while (stack.length) { const [cx, cy] = stack.pop(); if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue; const i = (cy * W + cx) * 4; if (!match(i)) continue; data[i] = fc[0]; data[i + 1] = fc[1]; data[i + 2] = fc[2]; data[i + 3] = fc[3]; stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]); }
                ctx.putImageData(img, 0, 0);
            }

            canvas.addEventListener('pointerdown', (e) => {
                e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
                const { x, y } = pos(e);
                if (tool === 'pipette') { pickColor(x, y); return; }
                snapshot();
                if (tool === 'fill') { floodFill(x, y); updatePreview(); return; }
                drawing = true; lastX = x; lastY = y; drawTo(x, y);
            });
            canvas.addEventListener('pointermove', (e) => { if (!drawing) return; const { x, y } = pos(e); drawTo(x, y); });
            canvas.addEventListener('pointerup', () => { if (drawing) { drawing = false; updatePreview(); } });

            document.querySelectorAll('.ds-tool').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
            document.querySelectorAll('.ds-size').forEach(b => b.addEventListener('click', () => { size = parseInt(b.dataset.size); document.querySelectorAll('.ds-size').forEach(x => x.classList.remove('active')); b.classList.add('active'); }));
            colorInput.addEventListener('input', () => { color = colorInput.value; setTool('brush'); });
            bgInput.addEventListener('input', () => { studioBg = bgInput.value; if (dice3D) dice3D.rebuild(); else updatePreview(); });
            document.getElementById('ds-undo').addEventListener('click', () => { if (undoStack.length) { redoStack.push(ctx.getImageData(0, 0, W, H)); ctx.putImageData(undoStack.pop(), 0, 0); updatePreview(); } });
            document.getElementById('ds-redo').addEventListener('click', () => { if (redoStack.length) { undoStack.push(ctx.getImageData(0, 0, W, H)); ctx.putImageData(redoStack.pop(), 0, 0); updatePreview(); } });
            document.getElementById('ds-clear').addEventListener('click', () => { snapshot(); ctx.clearRect(0, 0, W, H); updatePreview(); });
            // Dupliquer la face en cours sur TOUTES les faces (du dé courant, ou de tous les dés si portée = « Tous »)
            document.getElementById('ds-apply-faces').addEventListener('click', () => {
                saveCanvasToFace();
                const url = canvas.toDataURL('image/png');
                if (studioScope === 'all') {
                    studioData.all = url;
                    Object.keys(FACE_COUNTS).forEach(t => { ensureSlots(t); studioData[t] = studioData[t].map(() => url); });
                } else {
                    ensureSlots(studioScope); studioData[studioScope] = studioData[studioScope].map(() => url);
                }
                renderTypeTabs(); renderFaceTabs();
                if (dice3D) dice3D.rebuild();
                if (window.showAppToast) window.showAppToast('Appliqué à toutes les faces', '#8e44ad');
            });
            // Appliquer la face en cours à TOUS les dés (toutes leurs faces) et repasser en « Tous »
            document.getElementById('ds-apply-all').addEventListener('click', () => {
                saveCanvasToFace();
                const url = curSlotGet() || canvas.toDataURL('image/png');
                studioData.all = url;
                Object.keys(FACE_COUNTS).forEach(t => { ensureSlots(t); studioData[t] = studioData[t].map(() => url); });
                studioScope = 'all'; studioFace = 0;
                renderTypeTabs(); renderFaceTabs(); loadFaceToCanvas();
                if (dice3D) dice3D.rebuild();
                if (window.showAppToast) window.showAppToast('Face appliquée à tous les dés', '#2980b9');
            });
            document.getElementById('ds-save').addEventListener('click', () => {
                saveCanvasToFace();
                const name = (document.getElementById('ds-name').value || '').trim() || ('Création ' + (diceDesigns.length + 1));
                // image représentative par dé (1ʳᵉ face dessinée) pour conserver le skin 2D des résultats
                const repFaces = { all: studioData.all || null };
                Object.keys(FACE_COUNTS).forEach(t => { repFaces[t] = firstNonNull(studioData[t]) || studioData.all || null; });
                const thumb = repFaces.all || repFaces.d20 || repFaces.d6 || Object.values(repFaces).find(Boolean) || canvas.toDataURL();
                const design = { id: 'dd_' + Date.now(), name, bg: studioBg, faces: repFaces, facesFull: JSON.parse(JSON.stringify(studioData)), thumb };
                diceDesigns.push(design); persistDiceDesigns();
                activeDesignId = design.id; DB.set('dnd-dice-active-design', design.id);
                document.getElementById('ds-name').value = '';
                renderGallery();
                if (typeof applyCustomDiceSkin === 'function') applyCustomDiceSkin();
                if (window.showAppToast) window.showAppToast('🎲 Création enregistrée et activée', '#27ae60');
            });
            document.getElementById('ds-deactivate').addEventListener('click', () => { activeDesignId = null; DB.set('dnd-dice-active-design', ''); renderGallery(); });
            { const spinBtn = document.getElementById('ds-3d-spin'); if (spinBtn) spinBtn.addEventListener('click', () => { if (dice3D) dice3D.toggleSpin(); }); }
            document.getElementById('ds-close').addEventListener('click', () => { modal.classList.add('hidden'); if (dice3D) dice3D.stop(); });
            modal.addEventListener('click', (e) => { if (e.target === modal) { modal.classList.add('hidden'); if (dice3D) dice3D.stop(); } });

            function openStudio() {
                const act = getActiveDesign();
                studioData = act ? (act.facesFull ? JSON.parse(JSON.stringify(act.facesFull)) : migrateOldFaces(act.faces)) : {};
                studioBg = act ? (act.bg || '#7A2828') : '#7A2828';
                bgInput.value = studioBg; studioScope = 'all'; studioFace = 0;
                renderPalette(); renderTypeTabs(); renderFaceTabs(); renderGallery();
                loadFaceToCanvas();
                modal.classList.remove('hidden');
                // Le canvas 3D a une taille une fois la modale visible → on initialise ici
                if (!dice3D) dice3D = build3DPreview();
                if (dice3D) { dice3D.rebuild(); dice3D.start(); }
                updatePreview();
                const panel = document.getElementById('dice-theme-panel'); if (panel) panel.classList.add('hidden');
            }
            if (openBtn) openBtn.addEventListener('click', openStudio);
        })();

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
        function updateCategorySelects() { const buildOptions = (cats) => `<option value="Général">Général</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join(''); let invSel = document.getElementById('inv-category'); if(invSel) invSel.innerHTML = buildOptions(invCategories); let editInvSel = document.getElementById('edit-inv-category'); if(editInvSel) editInvSel.innerHTML = buildOptions(invCategories); let atkSel = document.getElementById('new-atk-category'); if(atkSel) atkSel.innerHTML = buildOptions(atkCategories); }
        const catManagerModal = document.getElementById('category-manager-modal'); let currentCatContext = null; 
        window.openCategoryManager = function(context) { currentCatContext = context; const title = document.getElementById('cat-manager-title'); if(title) title.textContent = context === 'inv' ? "Onglets : Sac à dos" : "Onglets : Attaques"; renderCategoryManagerList(); if(catManagerModal) catManagerModal.classList.remove('hidden'); }
        function renderCategoryManagerList() { const list = document.getElementById('cat-manager-list'); if(!list) return; list.innerHTML = ''; let categories = currentCatContext === 'inv' ? invCategories : atkCategories; if (categories.length === 0) { list.innerHTML = `<p style="text-align:center; color:#888;">Aucun onglet personnalisé.</p>`; return; } categories.forEach((cat, index) => { let row = document.createElement('div'); row.style.display = 'flex'; row.style.gap = '10px'; row.style.marginBottom = '10px'; let input = document.createElement('input'); input.type = 'text'; input.value = cat; input.style.flex = '1'; input.style.padding = '5px'; input.style.border = '1px solid rgba(138,28,28,0.25)'; input.style.borderRadius = '4px'; input.style.background = 'rgba(255,255,255,0.5)'; let btnSave = document.createElement('button'); btnSave.className = 'btn-small'; btnSave.textContent = '💾'; btnSave.title = 'Enregistrer'; btnSave.onclick = () => saveCategoryRename(index, input.value.trim()); let btnDel = document.createElement('button'); btnDel.className = 'btn-small'; btnDel.style.background = '#e74c3c'; btnDel.textContent = 'X'; btnDel.title = 'Supprimer'; btnDel.onclick = () => deleteCategory(index); row.appendChild(input); row.appendChild(btnSave); row.appendChild(btnDel); list.appendChild(row); }); }
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
        const btnClearNote = document.getElementById('btn-clear-note'); const quickNoteInput = document.getElementById('quick-note');
        if(btnClearNote && quickNoteInput) { btnClearNote.addEventListener('click', () => { if(confirm('Effacer la note rapide ?')) { quickNoteInput.value = ''; setStore('dnd-sheet-quick-note', '', false); adjustHeight(quickNoteInput); } }); }

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
                attributesContainer.innerHTML += `<div class="attribute-block"><h3 class="rollable" data-name="${attr.name}" data-target="mod-${attr.id}">${attr.name}</h3><div class="stat-main-row"><div class="stat-score-circle"><input type="number" id="stat-${attr.id}" class="stat-score stat-score-input" value="10"></div><div class="stat-mod-box" id="mod-${attr.id}">+0</div></div><div class="nested-skills-list">${skillsHTML}</div></div>`;
            });
        }

        function getModifier(score) { return Math.floor((score - 10) / 2); }
        function updateAutoMagicStats() { const abilityEl = document.getElementById('spellcasting-ability'); const profEl = document.getElementById('prof-bonus'); if(!abilityEl || !profEl) return; const ability = abilityEl.value; const prof = parseInt(profEl.value) || 2; if (ability && ability !== 'none') { const statEl = document.getElementById(`stat-${ability}`); if(!statEl) return; const score = parseInt(statEl.value) || 10; const mod = getModifier(score); document.getElementById('spell-modifier').value = mod >= 0 ? `+${mod}` : mod; document.getElementById('spell-save-dc').value = 8 + prof + mod; document.getElementById('spell-attack-bonus').value = prof + mod; setStore('dnd-sheet-spell-save-dc', 8 + prof + mod, false); setStore('dnd-sheet-spell-attack-bonus', prof + mod, false); setStore('dnd-sheet-spell-modifier', mod, false); } }
        function updateSkillProfBtn(skillId) { const hiddenInput = document.getElementById('prof-' + skillId); const btn = document.getElementById('profbtn-' + skillId); if(!hiddenInput || !btn) return; const level = parseInt(hiddenInput.value) || 0; if(level === 0) { btn.textContent = '○'; btn.classList.remove('prof-active', 'exp-active'); btn.title = 'Clic : ajouter maîtrise'; } else if(level === 1) { btn.textContent = '●'; btn.classList.add('prof-active'); btn.classList.remove('exp-active'); btn.title = 'Maîtrise — clic : expertise'; } else { btn.textContent = '★'; btn.classList.remove('prof-active'); btn.classList.add('exp-active'); btn.title = 'Expertise — clic : retirer'; } }

        function updateStatsAndSkills() {
            const profEl = document.getElementById('prof-bonus'); if(!profEl) return; const profBonus = parseInt(profEl.value) || 2;
            skillsMap.forEach(attr => { const statEl = document.getElementById(`stat-${attr.id}`); const modEl = document.getElementById(`mod-${attr.id}`); if(statEl && modEl) { const score = parseInt(statEl.value) || 10; const mod = getModifier(score); modEl.textContent = mod >= 0 ? `+${mod}` : mod; attr.skills.forEach(skill => { const hiddenInput = document.getElementById(`prof-${skill.id}`); const profLevel = hiddenInput ? (parseInt(hiddenInput.value) || 0) : 0; const bonus = profLevel === 2 ? profBonus * 2 : (profLevel === 1 ? profBonus : 0); const manual = parseInt(getStore('dnd-sheet-skill-bonus-' + skill.id, false)) || 0; const totalMod = mod + bonus + manual; const valEl = document.getElementById(`skill-val-${skill.id}`); if(valEl) { valEl.textContent = totalMod >= 0 ? `+${totalMod}` : totalMod; valEl.classList.toggle('manual-bonus', manual !== 0); valEl.title = manual !== 0 ? `Bonus manuel ${manual > 0 ? '+' + manual : manual} inclus — clic pour modifier` : 'Clic : bonus manuel (ex : Touche-à-tout)'; } }); } });
            updateAutoMagicStats();
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
        }

        // Soin / dégâts rapides (les dégâts entament d'abord les PV temporaires, règle 5e)
        function applyHpDelta(delta) {
            const cur = document.getElementById('hp-current'); const tmp = document.getElementById('hp-temp'); const maxEl = document.getElementById('hp-max');
            if(!cur) return; const max = parseInt(maxEl?.value) || 0;
            if(delta < 0) {
                let dmg = -delta; let temp = parseInt(tmp?.value) || 0;
                if(temp > 0 && tmp) { const absorbed = Math.min(temp, dmg); temp -= absorbed; dmg -= absorbed; tmp.value = temp; tmp.dispatchEvent(new Event('input', { bubbles: true })); }
                if(dmg > 0) { cur.value = (parseInt(cur.value) || 0) - dmg; cur.dispatchEvent(new Event('input', { bubbles: true })); }
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

        let initiativeTracker = getStore('dnd-initiative-tracker') || []; let activeInitIndex = getStore('dnd-initiative-active', false) || -1;
        let initiativeRound = parseInt(getStore('dnd-initiative-round', false)) || 1;

        window.updateInitHP = (i, change) => {
            let hp = parseInt(initiativeTracker[i].hp) || 0;
            hp += change;
            initiativeTracker[i].hp = hp;
            setStore('dnd-initiative-tracker', initiativeTracker);
            renderInitiativeTracker();
        };

        window.setInitHP = (i, val) => {
            initiativeTracker[i].hp = val;
            setStore('dnd-initiative-tracker', initiativeTracker);
            renderInitiativeTracker();
        };

        function renderInitiativeTracker() { 
            const list = document.getElementById('init-tracker-list'); 
            if(!list) return; 
            list.innerHTML = ''; 
            if(initiativeTracker.length === 0) list.innerHTML = `<span style="font-size:0.8rem; color:#888; font-style:italic;">Aucun combattant.</span>`; 
            initiativeTracker.forEach((c, i) => { 
                let activeClass = i === activeInitIndex ? 'active-turn' : ''; 
                list.innerHTML += `<div class="init-item ${activeClass}">
                    <span class="init-score">${c.score}</span>
                    <span style="flex:1; font-weight:bold;">${c.name}</span>
                    <span style="display:flex; align-items:center; gap:5px; margin-right:10px;">
                        ❤️ 
                        <button class="btn-small" style="padding:2px 6px;" onclick="updateInitHP(${i}, -1)">-</button>
                        <input type="number" value="${c.hp}" onchange="setInitHP(${i}, this.value)" style="width:50px; text-align:center; font-weight:bold; background:rgba(255,255,255,0.5); border:1px solid #ccc; border-radius:4px;">
                        <button class="btn-small" style="padding:2px 6px;" onclick="updateInitHP(${i}, 1)">+</button>
                    </span>
                    <span class="init-del no-print" onclick="deleteInit(${i})">X</span>
                </div>`; 
            }); 
            
            const roundVal = document.getElementById('init-round-val');
            if(roundVal) roundVal.textContent = initiativeRound;
        }

        document.body.addEventListener('click', (e) => { 
            if(e.target.id === 'btn-init-add') { 
                const name = document.getElementById('init-add-name').value.trim(); 
                const score = parseInt(document.getElementById('init-add-score').value) || 0; 
                const hpInput = document.getElementById('init-add-hp');
                const hp = hpInput && hpInput.value.trim() !== '' ? hpInput.value.trim() : 0; 
                
                if(name) { 
                    initiativeTracker.push({name, score, hp}); 
                    initiativeTracker.sort((a,b) => b.score - a.score); 
                    setStore('dnd-initiative-tracker', initiativeTracker); 
                    renderInitiativeTracker(); 
                    document.getElementById('init-add-name').value=''; 
                    document.getElementById('init-add-score').value=''; 
                    if(hpInput) hpInput.value=''; 
                } 
            } 
            if(e.target.id === 'btn-init-next') { 
                if(initiativeTracker.length === 0) return;
                activeInitIndex++;
                if(activeInitIndex >= initiativeTracker.length) {
                    activeInitIndex = 0;
                    initiativeRound++; 
                    setStore('dnd-initiative-round', initiativeRound, false);
                }
                setStore('dnd-initiative-active', activeInitIndex, false);
                renderInitiativeTracker();
            } 
            if(e.target.id === 'btn-init-clear') { 
                if(confirm("Vider le tracker ?")) {
                    initiativeTracker = [];
                    activeInitIndex = -1;
                    initiativeRound = 1; 
                    setStore('dnd-initiative-tracker', initiativeTracker);
                    setStore('dnd-initiative-active', activeInitIndex, false);
                    setStore('dnd-initiative-round', initiativeRound, false);
                    renderInitiativeTracker();
                }
            } 
        });
        window.deleteInit = (i) => { initiativeTracker.splice(i, 1); if(activeInitIndex >= initiativeTracker.length) activeInitIndex = 0; if(initiativeTracker.length === 0) activeInitIndex = -1; setStore('dnd-initiative-tracker', initiativeTracker); setStore('dnd-initiative-active', activeInitIndex, false); renderInitiativeTracker(); };

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
        const grimoireModal = document.getElementById('grimoire-modal'); document.body.addEventListener('click', (e) => { if(e.target.id === 'btn-open-grimoire') { renderGrimoire(); grimoireModal.classList.remove('hidden', 'closing'); grimoireModal.classList.add('opening'); } }); if(document.getElementById('btn-close-grimoire')) document.getElementById('btn-close-grimoire').addEventListener('click', () => { grimoireModal.classList.remove('opening'); grimoireModal.classList.add('closing'); setTimeout(() => { grimoireModal.classList.add('hidden'); }, 750); });

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
            if(e.target.id === 'btn-open-journal') { const modal = document.getElementById('journal-modal'); clearBookFlames(); modal.classList.remove('hidden', 'book-burning'); modal.classList.add('book-opening'); renderJournalTOC(); }
            if(e.target.id === 'btn-lighter-close') { const modal = document.getElementById('journal-modal'); modal.classList.remove('book-opening'); igniteBook(); modal.classList.add('book-burning'); setTimeout(() => { modal.classList.add('hidden'); clearBookFlames(); }, 1800); }
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
                list.innerHTML += `<div class="ca-row atk-row" data-i="${originalIndex}"><div class="ca-head"><span class="ca-name">⚔️ ${atk.name}</span>${attuneHtml}<span class="atk-stat" title="Bonus / DD">🎯 ${atk.bonus || '—'}</span><span class="atk-stat" title="Dégâts">💥 ${atk.dmg || '—'}</span><div class="ca-actions"><button class="ci-up" title="Monter">▲</button><button class="ci-down" title="Descendre">▼</button><button class="ci-edit" title="Modifier">✎</button><button class="ci-del" title="Supprimer">🗑</button></div></div>${atk.notes ? `<div class="atk-notes">📝 ${atk.notes}</div>` : ''}</div>`;
            });
        }
        const atkListContainer = document.getElementById('attacks-list');
        if(atkListContainer) atkListContainer.addEventListener('click', (e) => {
            const row = e.target.closest('.ca-row'); if(!row) return; const index = parseInt(row.dataset.i);
            if(e.target.closest('.ci-up')) { if(window.moveAttackUp) window.moveAttackUp(index); return; }
            if(e.target.closest('.ci-down')) { if(window.moveAttackDown) window.moveAttackDown(index); return; }
            if(e.target.closest('.ci-edit')) { if(window.editAttack) window.editAttack(index); return; }
            if(e.target.closest('.ci-del')) { if(window.deleteAttack) window.deleteAttack(index); return; }
        });
        document.body.addEventListener('click', (e) => { if(e.target.id === 'btn-open-attack-modal') { editingAttackIndex = -1; atkModal.classList.remove('hidden'); document.querySelectorAll('#attack-form-modal input[type="text"]').forEach(i => i.value = ''); document.getElementById('new-atk-req-attune').checked = false; }});
        if(document.getElementById('btn-save-atk')) { document.getElementById('btn-save-atk').addEventListener('click', () => { const atk = { name: document.getElementById('new-atk-name').value, bonus: document.getElementById('new-atk-bonus').value, dmg: document.getElementById('new-atk-dmg').value, category: document.getElementById('new-atk-category').value.trim() || 'Général', notes: document.getElementById('new-atk-notes').value, reqAttune: document.getElementById('new-atk-req-attune').checked, isAttuned: false }; if(atk.name) { if(editingAttackIndex >= 0) { atk.isAttuned = attacks[editingAttackIndex].isAttuned; attacks[editingAttackIndex] = atk; } else { attacks.push(atk); } setStore('dnd-attacks', attacks); renderAttacks(); atkModal.classList.add('hidden'); } }); }
        window.toggleAttune = (index) => { attacks[index].isAttuned = !attacks[index].isAttuned; setStore('dnd-attacks', attacks); }; window.deleteAttack = (index) => { if(confirm("Supprimer ?")) { attacks.splice(index, 1); setStore('dnd-attacks', attacks); renderAttacks(); }}; window.moveAttackUp = (index) => { if(moveWithinFilter(attacks, index, -1, a => activeAtkTab === 'Tout' ? true : (a.category || 'Général') === activeAtkTab)) { setStore('dnd-attacks', attacks); renderAttacks(); } }; window.moveAttackDown = (index) => { if(moveWithinFilter(attacks, index, 1, a => activeAtkTab === 'Tout' ? true : (a.category || 'Général') === activeAtkTab)) { setStore('dnd-attacks', attacks); renderAttacks(); } }; window.editAttack = (index) => { const data = attacks[index]; document.getElementById('new-atk-name').value = data.name; document.getElementById('new-atk-bonus').value = data.bonus; document.getElementById('new-atk-dmg').value = data.dmg; document.getElementById('new-atk-category').value = data.category || 'Général'; document.getElementById('new-atk-notes').value = data.notes; document.getElementById('new-atk-req-attune').checked = data.reqAttune; editingAttackIndex = index; atkModal.classList.remove('hidden'); };

        let inventory = getStore('dnd-inventory') || []; let activeInvTabPinned = 'Tout'; let activeInvTabModal = 'Tout';
        const invAttr = (s) => String(s == null ? '' : s).replace(/"/g, '&quot;');

        function renderInventory() {
            const listEl = document.getElementById('pinned-inventory-list'); if(!listEl) return;
            const onAddInvCat = () => { let nouv = prompt("Nouvelle catégorie :"); if(nouv && nouv.trim() !== "" && !invCategories.includes(nouv.trim())) { invCategories.push(nouv.trim()); setStore('dnd-inv-categories', invCategories); updateCategorySelects(); renderInventory(); } };
            renderTabs('inv-tabs-container-pinned', inventory, activeInvTabPinned, invCategories, (tab) => { activeInvTabPinned = tab; renderInventory(); }, onAddInvCat, () => { openCategoryManager('inv'); });

            let totalWeight = 0; inventory.forEach(item => { let w = parseFloat(item.weight); let q = parseInt(item.qty) || 1; if(!isNaN(w)) totalWeight += (w * q); });

            const entries = inventory.map((item, index) => ({ item, index })).filter(({ item }) => activeInvTabPinned === 'Tout' || (item.category || 'Général') === activeInvTabPinned);
            entries.sort((a, b) => (b.item.pinned ? 1 : 0) - (a.item.pinned ? 1 : 0)); // favoris en tête

            listEl.innerHTML = '';
            if(entries.length === 0) {
                listEl.innerHTML = `<div class="compact-empty">${inventory.length === 0 ? 'Sac vide — ajoute un objet ci-dessus.' : 'Aucun objet dans cet onglet.'}</div>`;
            } else {
                entries.forEach(({ item, index }) => {
                    if(editingInvIndex === index) {
                        const cats = `<option value="Général">Général</option>` + invCategories.map(c => `<option value="${invAttr(c)}" ${(item.category || 'Général') === c ? 'selected' : ''}>${c}</option>`).join('');
                        listEl.innerHTML += `<div class="ci-row ci-editing" data-i="${index}"><div class="ci-edit-form"><input class="qa-input qa-grow ci-e-name" value="${invAttr(item.name)}" placeholder="Nom"><input type="number" min="1" class="qa-input qa-num ci-e-qty" value="${parseInt(item.qty) || 1}"><input class="qa-input qa-num ci-e-weight" value="${invAttr(item.weight === '-' ? '' : item.weight)}" placeholder="Poids"><select class="qa-input qa-cat ci-e-cat">${cats}</select><button class="qa-add ci-e-save" title="Enregistrer">✓</button><button class="ci-e-cancel" title="Annuler" style="background:none; border:none; cursor:pointer; font-size:1.1rem; color:#9a8a70;">✕</button></div></div>`;
                        return;
                    }
                    const weightTxt = (item.weight !== undefined && item.weight !== null && item.weight !== '-' && String(item.weight).trim() !== '') ? item.weight : '—';
                    listEl.innerHTML += `<div class="ci-row${item.pinned ? ' is-pinned' : ''}" data-i="${index}"><button class="ci-pin" title="${item.pinned ? 'Retirer des favoris' : 'Mettre en favori'}">${item.pinned ? '📌' : '☆'}</button><span class="ci-name" title="${invAttr(item.name)}">${item.name}</span><div class="ci-qty"><button class="ci-step" data-act="dec" title="-1">−</button><span class="ci-qval">${parseInt(item.qty) || 1}</span><button class="ci-step" data-act="inc" title="+1">＋</button></div><span class="ci-weight">${weightTxt}</span><div class="ci-actions"><button class="ci-up" title="Monter">▲</button><button class="ci-down" title="Descendre">▼</button><button class="ci-edit" title="Modifier">✎</button><button class="ci-del" title="Supprimer">🗑</button></div></div>`;
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
                if(e.target.closest('.ci-pin')) { inventory[index].pinned = !inventory[index].pinned; setStore('dnd-inventory', inventory); renderInventory(); return; }
                if(e.target.closest('.ci-step')) { const act = e.target.closest('.ci-step').dataset.act; let q = parseInt(inventory[index].qty) || 1; q = act === 'inc' ? q + 1 : Math.max(1, q - 1); inventory[index].qty = q; setStore('dnd-inventory', inventory); renderInventory(); return; }
                if(e.target.closest('.ci-edit')) { editingInvIndex = index; renderInventory(); return; }
                if(e.target.closest('.ci-del')) { if(confirm(`Jeter « ${inventory[index].name} » ?`)) { inventory.splice(index, 1); setStore('dnd-inventory', inventory); renderInventory(); } return; }
            });
            invListContainer.addEventListener('keydown', (e) => { if(e.key === 'Enter' && e.target.closest('.ci-edit-form')) { e.preventDefault(); const saveBtn = e.target.closest('.ci-edit-form').querySelector('.ci-e-save'); if(saveBtn) saveBtn.click(); } });
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
        window.deleteTrait = (index) => { if(confirm("Supprimer cette capacité ?")) { traits.splice(index, 1); setStore('dnd-traits', traits); renderTraits(); }}; window.moveTraitUp = (index) => { if(moveWithinFilter(traits, index, -1, t => t.type === traits[index].type)) { setStore('dnd-traits', traits); renderTraits(); } }; window.moveTraitDown = (index) => { if(moveWithinFilter(traits, index, 1, t => t.type === traits[index].type)) { setStore('dnd-traits', traits); renderTraits(); } }; window.editTrait = (index) => { const data = traits[index]; document.getElementById('new-trait-name').value = data.name; document.getElementById('new-trait-type').value = data.type; document.getElementById('new-trait-level').value = data.level || ''; document.getElementById('new-trait-desc').value = data.desc; document.getElementById('new-trait-pinned').checked = data.pinned; editingTraitIndex = index; document.getElementById('trait-modal-title').textContent = "Modifier la Capacité"; traitModal.classList.remove('hidden'); };

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
        window.deleteAbility = (index) => { if(confirm("Supprimer cette capacité ?")) { abilities.splice(index, 1); setStore('dnd-abilities', abilities); renderAbilities(); } };

        let macros = getStore('dnd-macros') || [];
        function renderMacros() { const list = document.getElementById('macro-list'); if(!list) return; list.innerHTML = ''; macros.forEach((m, i) => { list.innerHTML += `<div class="macro-pill"><button class="macro-btn rollable" data-formula="${m.formula}" data-name="${m.name}">${m.name}</button><span class="macro-del" onclick="deleteMacro(${i})">✖</span></div>`; }); }
        if(document.getElementById('btn-add-macro')) { document.getElementById('btn-add-macro').addEventListener('click', () => { const name = document.getElementById('macro-name').value.trim(); const formula = document.getElementById('macro-formula').value.trim(); if(name && formula) { macros.push({ name, formula }); setStore('dnd-macros', macros); renderMacros(); document.getElementById('macro-name').value = ''; document.getElementById('macro-formula').value = ''; } }); }
        window.deleteMacro = (index) => { macros.splice(index, 1); setStore('dnd-macros', macros); renderMacros(); };

        document.body.addEventListener('click', (e) => { if(e.target.id === 'btn-pay-currency') { const amount = parseFloat(document.getElementById('pay-amount-val').value) || 0; const type = document.getElementById('pay-amount-type').value; if(amount <= 0) return; const coinInput = document.getElementById('coin-' + type); if(coinInput) { let current = parseFloat(coinInput.value) || 0; coinInput.value = Math.max(0, current - amount); setStore('dnd-sheet-coin-' + type, coinInput.value, false); document.getElementById('pay-amount-val').value = ''; } } });

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
        if(levelInput) { let prof = Math.floor((parseInt(levelInput.value) || 1) - 1) / 4 + 2; const pInp = document.getElementById('prof-bonus'); if(pInp) pInp.value = Math.floor(prof); }
        if(spellCastingAbility) spellCastingAbility.value = getStore('dnd-sheet-spellcasting-ability', false) || "";
        
        updateCategorySelects(); updateStatsAndSkills(); renderAbilities(); renderPinnedSpells(); renderAttacks(); renderSpellSlots(); renderInventory(); renderMacros(); renderInitiativeTracker(); renderCustomConditions(); renderTraits(); renderPreparedSpells(); updateStatusEffects();
        
        let savedInit = getStore('dnd-sheet-initiative', false); if(savedInit === null) { let mod = getModifier(parseInt(document.getElementById('stat-dex').value) || 10); if(initInput) initInput.value = mod; setStore('dnd-sheet-initiative', mod, false); }
        if(document.getElementById('btn-export-pdf')) document.getElementById('btn-export-pdf').addEventListener('click', async () => {
            // Fiche officielle remplie (print-sheet.js) ; repli = impression classique du site (hors-ligne / erreur)
            if (window.PrintSheet) {
                try { const ok = await window.PrintSheet.print(); if (ok) return; } catch (e) { console.warn('Impression fiche officielle KO, repli :', e); }
            }
            applyLayout('classic'); window.print();
        });

        // ==========================================
        // MODULE DE RECHERCHE GLOBALE
        // ==========================================
        // ==========================================
        // BASE DE RÈGLES 5e (en français) — recherche + fiche détaillée
        // ==========================================
        const DND_RULES = [
            // --- Actions en combat ---
            { name: 'Action : Attaquer', cat: 'Actions', text: "Effectue une attaque au corps à corps ou à distance contre une cible. Certaines capacités (Attaque supplémentaire) permettent plusieurs attaques avec la même action. Jet d'attaque : 1d20 + mod. de caractéristique + bonus de maîtrise (si l'arme est maîtrisée)." },
            { name: 'Action : Lancer un sort', cat: 'Actions', text: "Lance un sort dont le temps d'incantation est de 1 action. Certains sorts utilisent une action bonus ou une réaction. On ne peut lancer qu'un seul sort nécessitant une action bonus par tour, et dans ce cas l'action ne peut servir qu'à un tour de magie." },
            { name: 'Action : Foncer (Dash)', cat: 'Actions', text: "Gagne un déplacement supplémentaire égal à ta vitesse pour ce tour (après application des modificateurs de vitesse)." },
            { name: 'Action : Se désengager', cat: 'Actions', text: "Ton déplacement ne provoque pas d'attaques d'opportunité pour le reste du tour." },
            { name: 'Action : Esquiver', cat: 'Actions', text: "Jusqu'à ton prochain tour : les attaques contre toi ont le désavantage (si tu vois l'attaquant) et tu fais tes jets de sauvegarde de Dextérité avec l'avantage. Annulé si ta vitesse tombe à 0 ou si tu es neutralisé." },
            { name: 'Action : Se cacher', cat: 'Actions', text: "Fais un test de Dextérité (Discrétion) opposé à la Perception passive (ou active) des créatures. En cas de succès, tu es caché : tu bénéficies de l'avantage à ta prochaine attaque et les créatures t'attaquent avec désavantage." },
            { name: 'Action : Préparer', cat: 'Actions', text: "Choisis un déclencheur perceptible et une action (ou un déplacement) à exécuter en réaction quand il survient. Préparer un sort coûte un emplacement à l'avance et exige de maintenir la concentration jusqu'au déclenchement." },
            { name: 'Action : Aider', cat: 'Actions', text: "Donne l'avantage au prochain test de caractéristique d'un allié sur une tâche pour laquelle tu l'assistes, OU à sa prochaine attaque contre une créature située à 1,50 m de toi (avant ton prochain tour)." },
            { name: 'Action : Chercher', cat: 'Actions', text: "Consacre ton attention à trouver quelque chose : test de Sagesse (Perception) ou d'Intelligence (Investigation) selon la situation." },
            { name: 'Action : Utiliser un objet', cat: 'Actions', text: "Interagir avec un second objet (le premier est gratuit via ton déplacement) ou utiliser un objet qui requiert une action. Ex. : boire une potion, activer un objet magique." },
            { name: 'Action bonus', cat: 'Actions', text: "Action supplémentaire accordée par une capacité, un sort ou une règle spécifique. Tu ne peux en faire qu'UNE par tour, à ton tour uniquement." },
            { name: 'Réaction', cat: 'Actions', text: "Action instantanée en réponse à un déclencheur, même hors de ton tour. Une seule réaction par round ; elle se récupère au début de ton tour. Ex. : attaque d'opportunité, certains sorts." },
            { name: "Attaque d'opportunité", cat: 'Combat', text: "Réaction déclenchée quand une créature hostile que tu vois quitte ton allonge en se déplaçant : une attaque de mêlée contre elle. On l'évite avec l'action Se désengager ou en se téléportant." },
            { name: 'Interaction avec un objet', cat: 'Combat', text: "Tu peux interagir gratuitement avec un objet une fois par tour pendant ton déplacement ou ton action (dégainer une arme, ouvrir une porte). Une seconde interaction nécessite l'action Utiliser un objet." },

            // --- Mécaniques de combat ---
            { name: 'Avantage / Désavantage', cat: 'Combat', text: "Avantage : lance 2d20 et garde le meilleur. Désavantage : lance 2d20 et garde le pire. Ils ne se cumulent pas : si tu as au moins une source de chaque, ils s'annulent et tu lances un seul d20." },
            { name: 'Coup critique', cat: 'Combat', text: "Un 20 naturel sur un jet d'attaque touche automatiquement et constitue un coup critique : tu lances deux fois les dés de dégâts (pas les bonus fixes). Un 1 naturel rate automatiquement." },
            { name: 'Initiative', cat: 'Combat', text: "Au début d'un combat, chaque participant lance 1d20 + mod. de Dextérité. On agit dans l'ordre décroissant. En cas d'égalité, le MJ tranche (ou DEX la plus haute)." },
            { name: 'Surprise', cat: 'Combat', text: "Le MJ compare la Discrétion des assaillants à la Perception passive des autres. Une créature surprise ne peut ni agir ni réagir lors de son premier tour de combat." },
            { name: 'Couverture', cat: 'Combat', text: "À demi-couvert : +2 à la CA et aux jets de sauvegarde de DEX. Aux trois quarts : +5. Couverture totale : la cible ne peut pas être visée directement." },
            { name: 'Attaque à distance au contact', cat: 'Combat', text: "Effectuer une attaque à distance alors qu'une créature hostile se trouve à 1,50 m de toi impose le désavantage à ce jet d'attaque." },
            { name: 'Combat à deux armes', cat: 'Combat', text: "Quand tu attaques avec une arme de mêlée légère à une main, tu peux, en action bonus, attaquer avec une seconde arme légère tenue dans l'autre main. Tu n'ajoutes pas ton mod. de caractéristique aux dégâts de cette seconde attaque (sauf s'il est négatif)." },
            { name: 'Empoigner (grappling)', cat: 'Combat', text: "À la place d'une attaque, test de Force (Athlétisme) opposé à l'Athlétisme (Force) ou l'Acrobaties (DEX) de la cible (taille max : G+1). Réussite : la cible est Empoignée (vitesse 0)." },
            { name: 'Bousculer', cat: 'Combat', text: "À la place d'une attaque : Force (Athlétisme) opposé à l'Athlétisme ou l'Acrobaties de la cible. Réussite : tu la mets à terre OU tu la repousses de 1,50 m." },
            { name: 'Saut', cat: 'Déplacement', text: "Saut en longueur : distance en mètres ≈ valeur de Force (avec élan d'au moins 3 m), divisée par deux sans élan. Saut en hauteur : 90 cm + mod. de Force (avec élan). Le saut consomme du déplacement." },
            { name: 'Dégâts massifs (mort subite)', cat: 'Combat', text: "Si des dégâts réduisent un personnage à 0 PV et que l'excédent est ≥ à son maximum de PV, il meurt sur le coup." },

            // --- Concentration & magie ---
            { name: 'Concentration', cat: 'Magie', text: "Certains sorts exigent de se concentrer pour durer. Tu perds la concentration si : tu lances un autre sort de concentration, tu es neutralisé/tué, ou tu subis des dégâts (jet de sauvegarde de Constitution, DD = 10 ou la moitié des dégâts subis, le plus élevé)." },
            { name: 'Emplacements de sorts', cat: 'Magie', text: "Lancer un sort de niveau 1 ou plus dépense un emplacement de niveau égal ou supérieur. Les tours de magie (niveau 0) ne coûtent pas d'emplacement. Les emplacements se récupèrent au repos long (ou court pour certaines classes)." },
            { name: 'Lancer à un niveau supérieur', cat: 'Magie', text: "Dépenser un emplacement de niveau plus élevé que celui du sort amplifie souvent son effet (« Aux niveaux supérieurs »). Le sort est considéré comme lancé au niveau de l'emplacement utilisé." },
            { name: 'Composantes (V, S, M)', cat: 'Magie', text: "Verbale (incanter à voix haute), Somatique (geste d'une main libre), Matérielle (un composant ; un focaliseur ou une bourse à composants remplace ceux sans coût). Sans la composante requise, le sort ne peut être lancé." },
            { name: 'Rituel', cat: 'Magie', text: "Un sort possédant la balise rituel peut être lancé sans dépenser d'emplacement si on y consacre 10 minutes de plus, à condition que la classe/capacité autorise l'incantation rituelle." },
            { name: 'DD de sauvegarde des sorts', cat: 'Magie', text: "DD de sauvegarde = 8 + bonus de maîtrise + mod. de la caractéristique d'incantation. Bonus d'attaque de sort = bonus de maîtrise + mod. d'incantation." },
            { name: 'Sorts de zone et couverture', cat: 'Magie', text: "Une créature bénéficiant d'une couverture totale par rapport au point d'origine d'un effet de zone n'est pas affectée. La zone part du point d'origine choisi par le lanceur." },

            // --- Tests, compétences, sauvegardes ---
            { name: 'Test de caractéristique', cat: 'Tests', text: "1d20 + mod. de caractéristique, comparé à un Degré de Difficulté (DD). On ajoute le bonus de maîtrise si une compétence pertinente est maîtrisée." },
            { name: 'Degrés de Difficulté (DD)', cat: 'Tests', text: "Très facile 5 · Facile 10 · Moyen 15 · Difficile 20 · Très difficile 25 · Presque impossible 30." },
            { name: 'Jet de sauvegarde', cat: 'Tests', text: "1d20 + mod. de caractéristique (+ maîtrise si tu maîtrises cette sauvegarde) pour résister à un effet (sort, poison, souffle…). Comparé au DD de l'effet." },
            { name: 'Maîtrise et expertise', cat: 'Tests', text: "Le bonus de maîtrise (+2 au niveau 1, jusqu'à +6 au niveau 17) s'ajoute aux jets pour lesquels tu es maîtrisé. L'expertise double ce bonus pour la compétence concernée." },
            { name: 'Test en groupe', cat: 'Tests', text: "Tout le monde lance le même test ; si la moitié au moins réussit, le groupe réussit. Utile pour la discrétion ou la traque collective." },
            { name: 'Perception passive', cat: 'Tests', text: "Score passif = 10 + mod. de Sagesse (Perception) + maîtrise éventuelle. Utilisé pour repérer sans lancer de dé (ex. créatures cachées, pièges)." },
            { name: 'Les 6 caractéristiques', cat: 'Tests', text: "Force (FOR), Dextérité (DEX), Constitution (CON), Intelligence (INT), Sagesse (SAG), Charisme (CHA). Modificateur = (score − 10) arrondi à l'inférieur, divisé par 2." },

            // --- Repos & récupération ---
            { name: 'Repos court', cat: 'Repos', text: "Au moins 1 heure d'activité légère. Tu peux dépenser des dés de vie (1 dé + mod. de CON chacun) pour récupérer des PV. Certaines capacités/emplacements se rechargent au repos court." },
            { name: 'Repos long', cat: 'Repos', text: "Au moins 8 heures (dont 6 de sommeil). Récupère tous les PV, la moitié de tes dés de vie totaux (minimum 1) et la plupart des ressources. Un seul repos long bénéfique par 24 heures." },
            { name: 'Dés de vie', cat: 'Repos', text: "Tu en possèdes autant que ton niveau, du type lié à ta classe (d6 à d12). Dépensés au repos court pour soigner, ils se récupèrent en partie au repos long." },

            // --- Mort & soins ---
            { name: 'Jets de sauvegarde contre la mort', cat: 'Mort & soins', text: "À 0 PV, au début de ton tour : 1d20. 10+ = succès, moins de 10 = échec. 3 succès → tu es stabilisé ; 3 échecs → tu meurs. Un 1 naturel compte double échec, un 20 naturel te rend 1 PV. Subir des dégâts à 0 PV = 1 échec (2 si critique au contact)." },
            { name: 'Stabiliser une créature', cat: 'Mort & soins', text: "Action + test de Sagesse (Médecine) DD 10 sur une créature à 0 PV : elle devient stable (plus de jets contre la mort), reste inconsciente et regagne 1 PV après 1d4 heures." },
            { name: 'Points de vie temporaires', cat: 'Mort & soins', text: "Ils forment un « tampon » absorbé en premier par les dégâts. Ils ne se cumulent pas (on garde le plus élevé), ne se soignent pas et disparaissent au repos long." },
            { name: 'Résistance, vulnérabilité, immunité', cat: 'Mort & soins', text: "Résistance : dégâts du type concerné divisés par deux. Vulnérabilité : dégâts doublés. Immunité : aucun dégât de ce type. On applique d'abord les autres modificateurs, puis la résistance/vulnérabilité." },
            { name: 'Types de dégâts', cat: 'Mort & soins', text: "Contondant, perforant, tranchant, feu, froid, foudre, acide, poison, nécrotique, radiant, psychique, tonnerre, force. Ils déterminent résistances et vulnérabilités." },

            // --- Déplacement, environnement, vision ---
            { name: 'Déplacement et vitesse', cat: 'Déplacement', text: "Tu peux répartir ton déplacement avant/après/entre tes attaques. Te relever (de À terre) coûte la moitié de ta vitesse. Tu peux te déplacer à travers l'espace d'un allié (pas d'un ennemi sans Acrobaties/Athlétisme)." },
            { name: 'Terrain difficile', cat: 'Déplacement', text: "Chaque 1,50 m parcouru en terrain difficile (décombres, eau, broussailles, neige…) coûte 3 m de déplacement : ta distance utile est divisée par deux." },
            { name: 'Capacité de charge', cat: 'Déplacement', text: "Charge maximale = score de Force × 7,5 kg. Au-delà de Force × 5 kg, tu es encombré (variante) : vitesse réduite et désavantages possibles." },
            { name: 'Vision dans le noir', cat: 'Vision', text: "Dans le noir, tu vois en lumière faible comme en lumière vive, et dans l'obscurité comme en lumière faible (en nuances de gris), jusqu'à la distance indiquée." },
            { name: 'Lumière (vive, faible, obscurité)', cat: 'Vision', text: "Lumière vive : vision normale. Lumière faible : zone de pénombre, perception visuelle avec désavantage. Obscurité : zone d'aveuglement (Aveuglé sans vision spéciale)." },
            { name: 'Créature cachée / invisible', cat: 'Vision', text: "Attaquer une cible que tu ne vois pas : désavantage. Être attaqué sans être vu : l'attaquant a l'avantage. Une attaque révèle ta position si tu étais caché." },
            { name: 'Chute', cat: 'Environnement', text: "1d6 dégâts contondants par tranche de 3 m de chute, jusqu'à 20d6 (60 m). La créature atterrit À terre, sauf si elle évite les dégâts." },
            { name: 'Suffocation', cat: 'Environnement', text: "Tu peux retenir ta respiration 1 + mod. de CON minutes (min. 30 s). Ensuite, tu survis un nombre de rounds égal à ton mod. de CON (min. 1), puis tu tombes à 0 PV et tu te stabilises pas." },

            // --- Conditions / états ---
            { name: 'État : Aveuglé', cat: 'États', text: "Ne voit plus, rate automatiquement les tests liés à la vue. Ses attaques ont le désavantage ; les attaques contre lui ont l'avantage." },
            { name: 'État : Charmé', cat: 'États', text: "Ne peut pas attaquer le charmeur ni le cibler par une capacité/un effet néfaste. Le charmeur a l'avantage aux tests d'interaction sociale avec lui." },
            { name: 'État : Assourdi', cat: 'États', text: "N'entend plus et rate automatiquement les tests de caractéristique nécessitant l'ouïe." },
            { name: 'État : Effrayé', cat: 'États', text: "Désavantage aux tests et aux attaques tant que la source de la peur est dans son champ de vision. Ne peut pas s'en rapprocher volontairement." },
            { name: 'État : Empoigné', cat: 'États', text: "Sa vitesse tombe à 0 (pas de bonus de vitesse). Prend fin si l'empoigneur est neutralisé ou si la créature est sortie de portée par un effet." },
            { name: 'État : Neutralisé', cat: 'États', text: "Ne peut effectuer aucune action ni réaction." },
            { name: 'État : Invisible', cat: 'États', text: "Impossible à voir sans aide spéciale ; considéré comme fortement obscurci. Avantage à ses attaques ; les attaques contre lui ont le désavantage." },
            { name: 'État : Paralysé', cat: 'États', text: "Neutralisé, ne peut ni bouger ni parler. Rate les sauvegardes de Force et de Dextérité. Les attaques contre lui ont l'avantage et tout coup porté à 1,50 m est un critique." },
            { name: 'État : Pétrifié', cat: 'États', text: "Transformé en matière solide, neutralisé, ne perçoit plus, résistance à tous les dégâts, immunité au poison et aux maladies. Attaques contre lui avec avantage." },
            { name: 'État : Empoisonné', cat: 'États', text: "Désavantage aux jets d'attaque et aux tests de caractéristique." },
            { name: 'État : À terre', cat: 'États', text: "Ne peut que ramper (ou se relever en dépensant la moitié de sa vitesse). Désavantage à ses attaques. Attaques contre lui : avantage au contact, désavantage à distance." },
            { name: 'État : Entravé', cat: 'États', text: "Vitesse à 0. Ses attaques ont le désavantage et les attaques contre lui l'avantage. Désavantage aux sauvegardes de Dextérité." },
            { name: 'État : Étourdi', cat: 'États', text: "Neutralisé, ne peut bouger, parle avec peine. Rate les sauvegardes de Force et de Dextérité. Les attaques contre lui ont l'avantage." },
            { name: 'État : Inconscient', cat: 'États', text: "Neutralisé, ne perçoit plus, lâche ce qu'il tient et tombe À terre. Rate FOR/DEX. Attaques contre lui avec avantage ; tout coup au contact à 1,50 m est un critique." },
            { name: 'Épuisement', cat: 'États', text: "6 niveaux cumulatifs : 1) désavantage aux tests · 2) vitesse divisée par deux · 3) désavantage aux attaques et sauvegardes · 4) PV maximum divisés par deux · 5) vitesse à 0 · 6) mort. Un repos long retire 1 niveau (avec nourriture/boisson)." },

            // --- Divers ---
            { name: 'Inspiration', cat: 'Divers', text: "Récompense du MJ (souvent pour le roleplay). Tu peux la dépenser pour obtenir l'avantage sur un jet d'attaque, un test de caractéristique ou une sauvegarde. On n'en possède qu'une à la fois." },
            { name: 'Monnaie et conversion', cat: 'Divers', text: "1 po = 10 pa = 100 pc ; 1 po = 2 pe ; 1 pp = 10 po. (po : or, pa : argent, pe : électrum, pc : cuivre, pp : platine)." },
            { name: 'Liaison à un objet magique', cat: 'Divers', text: "Certains objets requièrent une liaison (attunement) : un repos court concentré sur l'objet. Un personnage ne peut être lié qu'à 3 objets magiques à la fois." }
        ];

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

            // --- Widget de règle (fiche détaillée, fermable) ---
            function openRuleWidget(rule) {
                const titleEl = document.getElementById('rule-widget-title');
                const catEl = document.getElementById('rule-widget-cat');
                const bodyEl = document.getElementById('rule-widget-body');
                const modal = document.getElementById('rule-widget-modal');
                if (!titleEl || !modal) return;
                titleEl.textContent = rule.name;
                if (catEl) catEl.textContent = rule.cat || '';
                if (bodyEl) bodyEl.textContent = rule.text;
                modal.classList.remove('hidden');
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
                    { kw: ['initiative', 'tracker'], title: "Tracker d'initiative", widgetId: 'widget-initiative', icon: '⚔️' },
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

                // 2) Règles du jeu (clic → fiche détaillée dans un widget)
                const rules = DND_RULES.filter(r => r.name.toLowerCase().includes(query) || r.text.toLowerCase().includes(query));
                if (rules.length) {
                    any = true;
                    searchResults.appendChild(groupHeader('📖 Règles du jeu'));
                    rules.slice(0, 14).forEach(r => searchResults.appendChild(makeResultRow('📖', r.name, r.cat, () => { closeSearch(); openRuleWidget(r); })));
                }

                // 3) Autres libellés présents sur la fiche
                const page = searchPageElements(query);
                if (page.length) {
                    any = true;
                    searchResults.appendChild(groupHeader('🧭 Sur la page'));
                    page.slice(0, 8).forEach(p => searchResults.appendChild(makeResultRow('🧭', p.title, p.context, () => { closeSearch(); revealAndScroll(p.element); if (p.element.tagName === 'INPUT' || p.element.tagName === 'TEXTAREA') setTimeout(() => p.element.focus(), 320); })));
                }

                if (!any) searchResults.innerHTML = '<div style="text-align:center; padding:20px; color:#777; font-style:italic;">Aucun résultat. Essaie un autre mot-clé (règle, capacité, sort, objet…).</div>';
            });

            window.openGlobalSearch = openSearch;
            window.closeGlobalSearch = closeSearch;
        }

        // ==========================================
        // GESTIONNAIRE DE RACCOURCIS CLAVIER
        // ==========================================
        const DEFAULT_SHORTCUTS = [
            { id: 'open-search',  label: 'Recherche Globale',    key: 'k', action: () => { document.getElementById('btn-global-search-trigger')?.click(); } },
            { id: 'roll-adv',     label: 'Mode Avantage',        key: 'a', action: () => { const r = document.querySelector('input[name="roll-mode"][value="adv"]'); if(r){r.checked=true;} } },
            { id: 'roll-dis',     label: 'Mode Désavantage',     key: 'd', action: () => { const r = document.querySelector('input[name="roll-mode"][value="dis"]'); if(r){r.checked=true;} } },
            { id: 'roll-normal',  label: 'Mode Normal',          key: 'n', action: () => { const r = document.querySelector('input[name="roll-mode"][value="normal"]'); if(r){r.checked=true;} } },
            { id: 'open-dice',    label: 'Ouvrir plateau de dés', key: 'r', action: () => { const dd = document.getElementById('dice-drawer'); if(dd) dd.classList.toggle('open'); } },
            { id: 'open-music',   label: 'Ouvrir le lecteur musical', key: 'm', action: () => { window.MusicPlayer?.toggle(); } },
            { id: 'roll-init',    label: 'Lancer Initiative',    key: 'i', action: () => { const el = document.querySelector('[data-name="Initiative"]'); if(el) el.click(); } },
            { id: 'short-rest',   label: 'Repos Court',          key: 's', action: () => { document.getElementById('btn-short-rest')?.click(); } },
            { id: 'long-rest',    label: 'Repos Long',           key: 'l', action: () => { document.getElementById('btn-long-rest')?.click(); } },
            { id: 'go-home',      label: 'Retour Accueil',       key: 'h', action: () => { document.getElementById('btn-go-home')?.click(); } },
        ];

        let savedShortcutKeys = {};
        try { savedShortcutKeys = JSON.parse(DB.get('dnd-shortcuts') || '{}'); } catch(e) {}
        const shortcuts = DEFAULT_SHORTCUTS.map(s => ({ ...s, key: savedShortcutKeys[s.id] ?? s.key }));

        function renderShortcutsConfig() {
            const container = document.getElementById('shortcuts-config-list');
            if(!container) return;
            container.innerHTML = '';
            shortcuts.forEach((sc, i) => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:0.78rem;';
                row.innerHTML = `<span style="color:#555; flex:1;">${sc.label}</span>
                    <button class="shortcut-key-btn" data-i="${i}" title="Cliquer pour changer" style="font-family:monospace; font-weight:bold; background:var(--primary-color); color:white; border:none; border-radius:4px; padding:3px 8px; cursor:pointer; min-width:28px; font-size:0.85rem;">${sc.key ? sc.key.toUpperCase() : '—'}</button>`;
                container.appendChild(row);
            });
            container.querySelectorAll('.shortcut-key-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const i = parseInt(btn.dataset.i);
                    btn.textContent = '⏳';
                    btn.style.background = '#e67e22';
                    const handler = (e) => {
                        e.preventDefault(); e.stopPropagation();
                        let key = e.key.toLowerCase(); if(key === 'escape') key = '';
                        shortcuts[i].key = key; savedShortcutKeys[shortcuts[i].id] = key;
                        DB.set('dnd-shortcuts', JSON.stringify(savedShortcutKeys));
                        renderShortcutsConfig(); window.removeEventListener('keydown', handler, true);
                    };
                    window.addEventListener('keydown', handler, true);
                });
            });
        }
        renderShortcutsConfig();

        window.addEventListener('keydown', (e) => {
            const tag = document.activeElement?.tagName;
            if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable || document.activeElement?.classList.contains('ql-editor')) return;
            if(e.ctrlKey || e.metaKey || e.altKey) return;
            const key = e.key.toLowerCase();
            const sc = shortcuts.find(s => s.key && s.key === key);
            if(sc) { e.preventDefault(); sc.action(); }
        });
    }
});