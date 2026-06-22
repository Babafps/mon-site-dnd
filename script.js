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

    const btnImportJson = document.getElementById('btn-import-json');
    if (btnImportJson) {
        btnImportJson.addEventListener('change', (e) => {
            const file = e.target.files[0]; if (!file) return; const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const parsed = JSON.parse(event.target.result);
                    if (window.SupaAuth?.currentUser) {
                        if (parsed.version === "4.0" && Array.isArray(parsed.characters)) {
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
                        if (parsed.allData) { Object.keys(parsed.allData).forEach(k => { DB.set(k, parsed.allData[k]); }); if (parsed.charactersList) DB.set('dnd-character-list', JSON.stringify(parsed.charactersList)); if (parsed.activeCharId) DB.set('dnd-active-char', parsed.activeCharId); alert("Sauvegarde importée !"); location.reload(); } else { alert("Format de fichier invalide."); }
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
                DB.set(`${newId}_dnd-sheet-char-name`, name); DB.set('dnd-active-char', newId); location.reload(); 
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

        function renderManager() { syncHiddenWidgets(); const tabsList = document.getElementById('manager-tabs-list'); if(!tabsList) return; tabsList.innerHTML = ''; customLayout.forEach(tab => { let div = document.createElement('div'); div.style.display = 'flex'; div.style.alignItems = 'center'; div.style.gap = '5px'; div.style.background = tab.id === managerActiveTabId ? 'var(--primary-color)' : 'rgba(0,0,0,0.1)'; div.style.color = tab.id === managerActiveTabId ? 'white' : 'var(--text-color)'; div.style.padding = '5px 10px'; div.style.borderRadius = '5px'; let input = document.createElement('input'); input.value = tab.name; input.style.border = 'none'; input.style.background = 'transparent'; input.style.color = 'inherit'; input.style.fontWeight = 'bold'; input.style.width = '120px'; input.onchange = (e) => { tab.name = e.target.value.trim() || 'Onglet'; saveCustomLayout(); renderManager(); renderCustomSheet(); }; div.appendChild(input); let btnSelect = document.createElement('button'); btnSelect.innerHTML = '⚙️'; btnSelect.className = 'btn-small'; btnSelect.style.background = 'transparent'; btnSelect.onclick = () => { managerActiveTabId = tab.id; renderManager(); }; div.appendChild(btnSelect); if (customLayout.length > 1) { let btnDel = document.createElement('button'); btnDel.innerHTML = 'X'; btnDel.className = 'btn-small'; btnDel.style.background = '#e74c3c'; btnDel.onclick = () => { if(confirm(`Supprimer l'onglet "${tab.name}" ?`)) { customLayout = customLayout.filter(t => t.id !== tab.id); if(managerActiveTabId === tab.id) managerActiveTabId = customLayout[0].id; if(activeCustomTabId === tab.id) activeCustomTabId = customLayout[0].id; saveCustomLayout(); renderManager(); renderCustomSheet(); } }; div.appendChild(btnDel); } tabsList.appendChild(div); }); let activeTab = customLayout.find(t => t.id === managerActiveTabId); if(!activeTab) { activeTab = customLayout[0]; managerActiveTabId = activeTab.id; } ['col1', 'col2', 'col3'].forEach(colName => { const colContainer = document.getElementById(`manager-${colName}-list`); if(!colContainer) return; colContainer.innerHTML = ''; activeTab[colName].forEach((wId, index) => { let prettyName = wId.replace('widget-', '').toUpperCase(); colContainer.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.5); border:1px solid rgba(138,28,28,0.25); padding:4px 8px; border-radius:4px; font-size:0.8rem;"><span style="font-weight:bold; color:var(--text-color);">${prettyName}</span><div style="display:flex; gap:3px;"><button class="btn-small" style="background:#7f8c8d; padding:2px 6px;" onclick="window.moveCustomWidget('${managerActiveTabId}', '${colName}', ${index}, -1)" ${index === 0 ? 'disabled style="opacity:0.5;"' : ''}>▲</button><button class="btn-small" style="background:#7f8c8d; padding:2px 6px;" onclick="window.moveCustomWidget('${managerActiveTabId}', '${colName}', ${index}, 1)" ${index === activeTab[colName].length - 1 ? 'disabled style="opacity:0.5;"' : ''}>▼</button><button class="btn-small" style="background:#e74c3c; padding:2px 6px;" onclick="window.removeCustomWidget('${managerActiveTabId}', '${colName}', ${index})">X</button></div></div>`; }); }); const sel = document.getElementById('manager-hidden-select'); if(sel) { sel.innerHTML = hiddenCustomWidgets.length === 0 ? '<option value="">(Aucun module)</option>' : hiddenCustomWidgets.map(w => `<option value="${w}">${w.replace('widget-', '').toUpperCase()}</option>`).join(''); } }

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

        const btnToggleDice = document.getElementById('btn-toggle-dice'); const diceDrawer = document.getElementById('dice-drawer'); const toggleFloatingDice = document.getElementById('toggle-floating-dice');
        if(toggleFloatingDice && btnToggleDice && diceDrawer) {
            let showFloatingDice = DB.get('dnd-show-floating-dice'); if(showFloatingDice === null) showFloatingDice = 'true'; toggleFloatingDice.checked = showFloatingDice === 'true'; btnToggleDice.classList.toggle('hidden', !toggleFloatingDice.checked);
            toggleFloatingDice.addEventListener('change', (e) => { DB.set('dnd-show-floating-dice', e.target.checked); btnToggleDice.classList.toggle('hidden', !e.target.checked); if(!e.target.checked && diceDrawer.classList.contains('open')) diceDrawer.classList.remove('open'); });
            let isDraggingDiceBtn = false; let startY = 0, startX = 0, clickStartX = 0, clickStartY = 0; let startTop = 0, startLeft = 0;
            btnToggleDice.addEventListener('mousedown', (e) => { isDraggingDiceBtn = true; startX = e.clientX; startY = e.clientY; clickStartX = e.clientX; clickStartY = e.clientY; let rect = btnToggleDice.getBoundingClientRect(); startLeft = rect.left; startTop = rect.top; btnToggleDice.style.transition = 'none'; btnToggleDice.style.cursor = 'grabbing'; });
            window.addEventListener('mousemove', (e) => { if(!isDraggingDiceBtn) return; let newLeft = startLeft + (e.clientX - startX); let newTop = startTop + (e.clientY - startY); newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - btnToggleDice.offsetWidth)); newTop = Math.max(0, Math.min(newTop, window.innerHeight - btnToggleDice.offsetHeight)); btnToggleDice.style.left = newLeft + 'px'; btnToggleDice.style.top = newTop + 'px'; btnToggleDice.style.right = 'auto'; });
            window.addEventListener('mouseup', (e) => { if(isDraggingDiceBtn) { isDraggingDiceBtn = false; btnToggleDice.style.transition = 'top 0.3s, left 0.3s, background 0.2s'; btnToggleDice.style.cursor = 'grab'; if(Math.abs(e.clientX - clickStartX) < 5 && Math.abs(e.clientY - clickStartY) < 5) { diceDrawer.classList.toggle('open'); } else { let rect = btnToggleDice.getBoundingClientRect(); let isLeft = (rect.left + rect.width/2) < window.innerWidth / 2; if(isLeft) { btnToggleDice.style.left = '0px'; diceDrawer.classList.add('drawer-left'); diceDrawer.style.top = Math.max(0, rect.top - 20) + 'px'; } else { btnToggleDice.style.left = (window.innerWidth - btnToggleDice.offsetWidth) + 'px'; diceDrawer.classList.remove('drawer-left'); diceDrawer.style.top = Math.max(0, rect.top - 20) + 'px'; } setTimeout(() => { DB.set('dnd-dice-btn-y', btnToggleDice.style.top); DB.set('dnd-dice-btn-side', isLeft ? 'left' : 'right'); }, 350); } } });
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
        let diceBox = null, diceBoxReady = false, diceBoxInitStarted = false;
        async function initDiceBox() {
            if (diceBoxInitStarted) return;
            diceBoxInitStarted = true;
            try {
                const mod = await import('https://cdn.jsdelivr.net/npm/@3d-dice/dice-box@1.1.4/dist/dice-box.es.min.js');
                const DiceBox = mod.default;
                let overlay = document.getElementById('dice-box-overlay');
                if (!overlay) { overlay = document.createElement('div'); overlay.id = 'dice-box-overlay'; overlay.className = 'no-print'; document.body.appendChild(overlay); }
                const box = new DiceBox({
                    container: '#dice-box-overlay',
                    assetPath: 'https://cdn.jsdelivr.net/npm/@3d-dice/dice-box@1.1.4/dist/assets/',
                    theme: 'default', scale: 7, gravity: 2, throwForce: 6,
                });
                await box.init();
                diceBox = box;
                diceBoxReady = true;
            } catch (e) {
                console.warn('Plateau 3D indisponible — animation 2D utilisée à la place.', e);
                diceBoxReady = false;
            }
        }
        initDiceBox();

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
            try { diceBox.clear(); } catch (e) {}

            // 1 dé par entrée (normal) ou 2 dés (avantage/désavantage) — chaque dé = un groupe
            const notation = [];
            const groupMap = [];
            poolSnapshot.forEach(faces => {
                const n = advMode === 'normal' ? 1 : 2;
                const groups = [];
                for (let k = 0; k < n; k++) { groups.push(notation.length); notation.push(`1d${faces}`); }
                groupMap.push(groups);
            });

            const res = await diceBox.roll(notation);
            if (!Array.isArray(res) || !res.length) throw new Error('Résultat 3D vide');

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
                let colorClass = '';
                if (faces === 20 && finalScore === 20) colorClass = 'crit-success';
                if (faces === 20 && finalScore === 1) colorClass = 'crit-fail';
                resultsHTML += `<div class="die-result die-settle ${colorClass}" style="position:relative;"><span>d${faces}</span><div class="die-main-score">${finalScore}</div>${extraHTML}</div>`;
                if (index < poolSnapshot.length - 1) resultsHTML += `<div class="die-math">+</div>`;
            });

            if (resultsBox) resultsBox.innerHTML = resultsHTML;
            if (totalBox) totalBox.innerHTML = `Total : <span class="total-number">${poolTotal}</span>`;

            clearTimeout(window._diceBoxClearTimer);
            window._diceBoxClearTimer = setTimeout(() => { try { diceBox.clear(); } catch (e) {} }, 4500);
        }

        // --- Repli : animation 2D (culbute CSS + chiffres qui défilent) ---
        async function executeRollDOM(poolSnapshot, advMode) {
            const resultsBox = document.getElementById('dice-results');
            const totalBox = document.getElementById('dice-total');
            if (totalBox) totalBox.innerHTML = '';

            let rollingHTML = '';
            poolSnapshot.forEach((faces, index) => {
                rollingHTML += `<div class="die-result die-rolling-3d" id="rolling-die-${index}" style="position:relative;"><span>d${faces}</span><div class="die-main-score">?</div></div>`;
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
        }

        if(document.getElementById('btn-roll')) document.getElementById('btn-roll').addEventListener('click', () => executeRoll());
        
        document.body.addEventListener('click', (e) => {
            const el = e.target.closest('.rollable');
            if(el) {
                let name = el.getAttribute('data-name'); let targetId = el.getAttribute('data-target'); let mod = 0; if(targetId !== "none") { let targetEl = document.getElementById(targetId); if(targetEl) mod = parseInt(targetEl.textContent || targetEl.value) || 0; }
                let advModeNode = document.querySelector('input[name="roll-mode"]:checked'); const advMode = advModeNode ? advModeNode.value : 'normal'; let roll1 = Math.floor(Math.random() * 20) + 1; let finalRoll = roll1; let secondDieHTML = '';
                if(advMode === 'adv') { let roll2 = Math.floor(Math.random() * 20) + 1; finalRoll = Math.max(roll1, roll2); const kept = roll1 >= roll2 ? roll1 : roll2; const dropped = roll1 >= roll2 ? roll2 : roll1; secondDieHTML = `<div style="font-size:0.85rem; color:#aaa; margin-top:4px;">🎲 <span style="color:#f1c40f; font-weight:bold;">${kept}</span> <span style="text-decoration:line-through; color:#666;">${dropped}</span> <span style="color:#aaa;">(Avantage)</span></div>`; } else if (advMode === 'dis') { let roll2 = Math.floor(Math.random() * 20) + 1; finalRoll = Math.min(roll1, roll2); const kept = roll1 <= roll2 ? roll1 : roll2; const dropped = roll1 <= roll2 ? roll2 : roll1; secondDieHTML = `<div style="font-size:0.85rem; color:#aaa; margin-top:4px;">🎲 <span style="color:#e67e22; font-weight:bold;">${kept}</span> <span style="text-decoration:line-through; color:#666;">${dropped}</span> <span style="color:#aaa;">(Désavantage)</span></div>`; }
                let total = finalRoll + mod; let critText = finalRoll === 20 ? " 🟢 CRIT" : (finalRoll === 1 ? " 🔴 ÉCHEC" : ""); let modStr = mod >= 0 ? `+${mod}` : mod;
                if(quickToast) { quickToast.innerHTML = `${name} : ${finalRoll} ${modStr} = <span style="color:#f1c40f; font-size:2rem;">${total}</span>${critText}${secondDieHTML}`; quickToast.classList.remove('hidden'); quickToast.style.animation = 'none'; quickToast.offsetHeight; quickToast.style.animation = 'popUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'; setTimeout(() => { quickToast.classList.add('hidden'); }, 4000); } return;
            }
            const macroBtn = e.target.closest('.macro-btn');
            if(macroBtn) {
                let formula = macroBtn.getAttribute('data-formula'); let name = macroBtn.getAttribute('data-name'); let total = 0; let rolls = []; let parts = formula.replace(/\s+/g, '').split(/(?=[+-])/); if(parts[0] && !parts[0].startsWith('+') && !parts[0].startsWith('-')) parts[0] = '+' + parts[0];
                parts.forEach(part => { if(!part) return; let sign = part.startsWith('-') ? -1 : 1; part = part.substring(1); if(part.includes('d')) { let [count, faces] = part.split('d'); count = parseInt(count) || 1; faces = parseInt(faces); for(let i=0; i<count; i++) { let r = Math.floor(Math.random() * faces) + 1; total += (r * sign); rolls.push(`${sign < 0 ? '-' : '+'}${r}`); } } else { let val = parseInt(part); if(!isNaN(val)) { total += (val * sign); rolls.push(`${sign < 0 ? '-' : '+'}${val}`); } } });
                if(quickToast) { quickToast.innerHTML = `<span style="font-size:1rem;">${name}</span><br>= <span style="color:#f1c40f; font-size:2rem;">${total}</span> <br><span style="font-size:0.8rem; color:#ccc;">(${rolls.join(' ')})</span>`; quickToast.classList.remove('hidden'); quickToast.style.animation = 'none'; quickToast.offsetHeight; quickToast.style.animation = 'popUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'; setTimeout(() => { quickToast.classList.add('hidden'); }, 4500); }
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
        function updateAutoMagicStats() { const abilityEl = document.getElementById('spellcasting-ability'); const profEl = document.getElementById('prof-bonus'); if(!abilityEl || !profEl) return; const ability = abilityEl.value; const prof = parseInt(profEl.value) || 2; if (ability && ability !== 'none') { const score = parseInt(document.getElementById(`stat-${ability}`).value) || 10; const mod = getModifier(score); document.getElementById('spell-modifier').value = mod >= 0 ? `+${mod}` : mod; document.getElementById('spell-save-dc').value = 8 + prof + mod; document.getElementById('spell-attack-bonus').value = prof + mod; setStore('dnd-sheet-spell-save-dc', 8 + prof + mod, false); setStore('dnd-sheet-spell-attack-bonus', prof + mod, false); setStore('dnd-sheet-spell-modifier', mod, false); } }
        function updateSkillProfBtn(skillId) { const hiddenInput = document.getElementById('prof-' + skillId); const btn = document.getElementById('profbtn-' + skillId); if(!hiddenInput || !btn) return; const level = parseInt(hiddenInput.value) || 0; if(level === 0) { btn.textContent = '○'; btn.classList.remove('prof-active', 'exp-active'); btn.title = 'Clic : ajouter maîtrise'; } else if(level === 1) { btn.textContent = '●'; btn.classList.add('prof-active'); btn.classList.remove('exp-active'); btn.title = 'Maîtrise — clic : expertise'; } else { btn.textContent = '★'; btn.classList.remove('prof-active'); btn.classList.add('exp-active'); btn.title = 'Expertise — clic : retirer'; } }

        function updateStatsAndSkills() {
            const profEl = document.getElementById('prof-bonus'); if(!profEl) return; const profBonus = parseInt(profEl.value) || 2;
            skillsMap.forEach(attr => { const statEl = document.getElementById(`stat-${attr.id}`); const modEl = document.getElementById(`mod-${attr.id}`); if(statEl && modEl) { const score = parseInt(statEl.value) || 10; const mod = getModifier(score); modEl.textContent = mod >= 0 ? `+${mod}` : mod; attr.skills.forEach(skill => { const hiddenInput = document.getElementById(`prof-${skill.id}`); const profLevel = hiddenInput ? (parseInt(hiddenInput.value) || 0) : 0; const bonus = profLevel === 2 ? profBonus * 2 : (profLevel === 1 ? profBonus : 0); const totalMod = mod + bonus; const valEl = document.getElementById(`skill-val-${skill.id}`); if(valEl) valEl.textContent = totalMod >= 0 ? `+${totalMod}` : totalMod; }); } });
            updateAutoMagicStats();
        }

        const statDex = document.getElementById('stat-dex'); if(statDex && initInput) { statDex.addEventListener('change', () => { const dexScore = parseInt(statDex.value) || 10; initInput.value = getModifier(dexScore); setStore('dnd-sheet-initiative', initInput.value, false); }); }
        document.body.addEventListener('input', (e) => { if(e.target.classList.contains('stat-score')) updateStatsAndSkills(); });
        document.body.addEventListener('change', (e) => { if(e.target.classList.contains('stat-score')) updateStatsAndSkills(); });
        document.body.addEventListener('click', (e) => { const btn = e.target.closest('.skill-prof-btn'); if(!btn) return; const skillId = btn.dataset.skill; const hiddenInput = document.getElementById('prof-' + skillId); if(!hiddenInput) return; let level = (parseInt(hiddenInput.value) || 0) + 1; if(level > 2) level = 0; hiddenInput.value = level; setStore('dnd-sheet-prof-' + skillId, level, false); updateSkillProfBtn(skillId); updateStatsAndSkills(); });
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

        // Soin / dégâts rapides (les dégâts entament d'abord les PV temporaires, règle D&D)
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
        function recoverAbilitiesByRest(restType) { let recovered = 0; abilities.forEach(ab => { if(restType === 'short' && ab.regenMode !== 'short_long') return; const recoverType = restType === 'short' ? ab.shortType : ab.longType; const recoverAmount = recoverType === 'all' ? ab.max : (restType === 'short' ? (ab.shortAmount || 1) : (ab.longAmount || 1)); let count = 0; for(let i = ab.max - 1; i >= 0 && count < recoverAmount; i--) { if(ab.used[i]) { ab.used[i] = false; count++; recovered++; } } }); setStore('dnd-abilities', abilities); renderAbilities(); return recovered; }
        
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
        function renderPinnedSpells() { const list = document.getElementById('spells-list'); if(!list) return; list.innerHTML = ''; spells.forEach((sp, index) => { if(!sp.pinned) return; list.innerHTML += `<div class="item-card spell-card"><div class="item-card-header"><h4>Niv.${sp.level||0} - ${sp.name}</h4><div class="item-controls no-print"><button title="Monter" onclick="moveSpellUp(${index})">▲</button><button title="Descendre" onclick="moveSpellDown(${index})">▼</button><button class="btn-pin pinned" onclick="togglePin(${index})">📍</button></div></div><div class="item-details"><span>⏱️ ${sp.time}</span><span>📏 ${sp.range}</span><span>💎 ${sp.res}</span></div><p><em>${sp.desc}</em></p>${sp.notes ? `<p><small>📝 ${sp.notes}</small></p>` : ''}</div>`; }); }
        function renderGrimoire() { const content = document.getElementById('grimoire-content'); if(!content) return; content.innerHTML = ''; let grouped = {}; spells.forEach((sp, index) => { let lvl = parseInt(sp.level) || 0; if(!grouped[lvl]) grouped[lvl] = []; grouped[lvl].push({ ...sp, originalIndex: index }); }); let levels = Object.keys(grouped).sort((a,b) => a - b); levels.forEach(lvl => { let sortedSpells = grouped[lvl].sort((a,b) => a.name.localeCompare(b.name)); let lvlHtml = `<div class="spell-level-group"><h3 class="spell-level-title">Niveau ${lvl} ${lvl == 0 ? '(Tours de magie)' : ''}</h3>`; sortedSpells.forEach(sp => { let pinClass = sp.pinned ? 'pinned' : ''; let pinText = sp.pinned ? '📍 Épinglé' : '📌 Épingler'; lvlHtml += `<div class="item-card spell-card"><div class="item-card-header"><h4>${sp.name}</h4><div class="item-controls"><button class="btn-pin ${pinClass}" onclick="togglePin(${sp.originalIndex})">${pinText}</button><button title="Modifier" onclick="editSpell(${sp.originalIndex})">✎</button><button title="Supprimer" class="btn-del" onclick="deleteSpell(${sp.originalIndex})">X</button></div></div><div class="item-details"><span>⏱️ ${sp.time}</span><span>📏 ${sp.range}</span><span>💎 ${sp.res}</span></div><p><em>${sp.desc}</em></p>${sp.notes ? `<p><small>📝 ${sp.notes}</small></p>` : ''}</div>`; }); lvlHtml += `</div>`; content.innerHTML += lvlHtml; }); if(levels.length === 0) content.innerHTML = "<p style='text-align:center;'>Le grimoire est vide.</p>"; }
        
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
                        <span class="prepared-spell-meta">⏱️ ${sp.time}</span>
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

        if(document.getElementById('btn-add-spell')) { document.getElementById('btn-add-spell').addEventListener('click', () => { const sp = { name: document.getElementById('new-spell-name').value, level: document.getElementById('new-spell-level').value || 0, time: document.getElementById('new-spell-time').value, range: document.getElementById('new-spell-range').value, res: document.getElementById('new-spell-res').value, desc: quillNewSpell.root.innerHTML, notes: document.getElementById('new-spell-notes').value, pinned: document.getElementById('new-spell-pinned').checked, prepared: editingSpellIndex >= 0 ? spells[editingSpellIndex].prepared : false }; if(sp.name) { if(editingSpellIndex >= 0) { spells[editingSpellIndex] = sp; } else { spells.push(sp); } setStore('dnd-spells', spells); renderPinnedSpells(); renderGrimoire(); renderPreparedSpells(); spellModal.classList.add('hidden'); } }); }
        window.togglePin = (index) => { spells[index].pinned = !spells[index].pinned; setStore('dnd-spells', spells); renderPinnedSpells(); renderGrimoire(); }; window.deleteSpell = (index) => { if(confirm("Oublier ce sort ?")) { spells.splice(index, 1); setStore('dnd-spells', spells); renderPinnedSpells(); renderGrimoire(); renderPreparedSpells(); }}; window.moveSpellUp = (index) => { let prevIndex = -1; for(let i = index - 1; i >= 0; i--) { if(spells[i].pinned) { prevIndex = i; break; } } if(prevIndex !== -1) { [spells[prevIndex], spells[index]] = [spells[index], spells[prevIndex]]; setStore('dnd-spells', spells); renderPinnedSpells(); }}; window.moveSpellDown = (index) => { let nextIndex = -1; for(let i = index + 1; i < spells.length; i++) { if(spells[i].pinned) { nextIndex = i; break; } } if(nextIndex !== -1) { [spells[nextIndex], spells[index]] = [spells[index], spells[nextIndex]]; setStore('dnd-spells', spells); renderPinnedSpells(); }}; window.editSpell = (index) => { const data = spells[index]; document.getElementById('new-spell-name').value = data.name; document.getElementById('new-spell-level').value = data.level; document.getElementById('new-spell-time').value = data.time; document.getElementById('new-spell-range').value = data.range; document.getElementById('new-spell-res').value = data.res; quillNewSpell.root.innerHTML = data.desc; document.getElementById('new-spell-notes').value = data.notes; document.getElementById('new-spell-pinned').checked = data.pinned; editingSpellIndex = index; document.getElementById('spell-modal-title').textContent = "Modifier le Sort"; spellModal.classList.remove('hidden'); };
        const grimoireModal = document.getElementById('grimoire-modal'); document.body.addEventListener('click', (e) => { if(e.target.id === 'btn-open-grimoire') { renderGrimoire(); grimoireModal.classList.remove('hidden', 'closing'); grimoireModal.classList.add('opening'); } }); if(document.getElementById('btn-close-grimoire')) document.getElementById('btn-close-grimoire').addEventListener('click', () => { grimoireModal.classList.remove('opening'); grimoireModal.classList.add('closing'); setTimeout(() => { grimoireModal.classList.add('hidden'); }, 550); });

        let journal = getStore('dnd-journal') || []; const journalPage = document.getElementById('book-page-content');
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
        document.body.addEventListener('click', (e) => { if(e.target.id === 'btn-open-journal') { const modal = document.getElementById('journal-modal'); modal.classList.remove('hidden', 'book-burning'); modal.classList.add('book-opening'); renderJournalTOC(); } if(e.target.id === 'btn-lighter-close') { const modal = document.getElementById('journal-modal'); modal.classList.remove('book-opening'); modal.classList.add('book-burning'); setTimeout(() => modal.classList.add('hidden'), 1500); } });

        let attacks = getStore('dnd-attacks') || []; let activeAtkTab = 'Tout'; const atkModal = document.getElementById('attack-form-modal');
        function renderAttacks() { const list = document.getElementById('attacks-list'); if(!list) return; renderTabs('atk-tabs-container', attacks, activeAtkTab, atkCategories, (tab) => { activeAtkTab = tab; renderAttacks(); }, () => { let nouv = prompt("Nouvelle catégorie :"); if(nouv && nouv.trim() !== "" && !atkCategories.includes(nouv.trim())) { atkCategories.push(nouv.trim()); setStore('dnd-atk-categories', atkCategories); updateCategorySelects(); renderAttacks(); } }, () => { openCategoryManager('atk'); }); list.innerHTML = ''; let filtered = activeAtkTab === 'Tout' ? attacks : attacks.filter(a => (a.category || 'Général') === activeAtkTab); filtered.forEach(atk => { let originalIndex = attacks.indexOf(atk); let attuneHtml = atk.reqAttune ? `<div class="attune-check" title="Objet Lié ?"><input type="checkbox" ${atk.isAttuned ? 'checked' : ''} onchange="toggleAttune(${originalIndex})"><label>Lié</label></div>` : ''; list.innerHTML += `<div class="item-card atk-card"><div class="item-card-header"><div style="display:flex; align-items:center; gap:10px;"><h4>⚔️ ${atk.name}</h4>${attuneHtml}</div>${getCrudControlsHTML(originalIndex, 'Attack', activeAtkTab === 'Tout')}</div><div class="item-details"><span><strong>Bonus:</strong> ${atk.bonus}</span><span><strong>Dégâts:</strong> ${atk.dmg}</span></div>${atk.notes ? `<p><small>📝 ${atk.notes}</small></p>` : ''}</div>`; }); }
        document.body.addEventListener('click', (e) => { if(e.target.id === 'btn-open-attack-modal') { editingAttackIndex = -1; atkModal.classList.remove('hidden'); document.querySelectorAll('#attack-form-modal input[type="text"]').forEach(i => i.value = ''); document.getElementById('new-atk-req-attune').checked = false; }});
        if(document.getElementById('btn-save-atk')) { document.getElementById('btn-save-atk').addEventListener('click', () => { const atk = { name: document.getElementById('new-atk-name').value, bonus: document.getElementById('new-atk-bonus').value, dmg: document.getElementById('new-atk-dmg').value, category: document.getElementById('new-atk-category').value.trim() || 'Général', notes: document.getElementById('new-atk-notes').value, reqAttune: document.getElementById('new-atk-req-attune').checked, isAttuned: false }; if(atk.name) { if(editingAttackIndex >= 0) { atk.isAttuned = attacks[editingAttackIndex].isAttuned; attacks[editingAttackIndex] = atk; } else { attacks.push(atk); } setStore('dnd-attacks', attacks); renderAttacks(); atkModal.classList.add('hidden'); } }); }
        window.toggleAttune = (index) => { attacks[index].isAttuned = !attacks[index].isAttuned; setStore('dnd-attacks', attacks); }; window.deleteAttack = (index) => { if(confirm("Supprimer ?")) { attacks.splice(index, 1); setStore('dnd-attacks', attacks); renderAttacks(); }}; window.moveAttackUp = (index) => { if(moveWithinFilter(attacks, index, -1, a => activeAtkTab === 'Tout' ? true : (a.category || 'Général') === activeAtkTab)) { setStore('dnd-attacks', attacks); renderAttacks(); } }; window.moveAttackDown = (index) => { if(moveWithinFilter(attacks, index, 1, a => activeAtkTab === 'Tout' ? true : (a.category || 'Général') === activeAtkTab)) { setStore('dnd-attacks', attacks); renderAttacks(); } }; window.editAttack = (index) => { const data = attacks[index]; document.getElementById('new-atk-name').value = data.name; document.getElementById('new-atk-bonus').value = data.bonus; document.getElementById('new-atk-dmg').value = data.dmg; document.getElementById('new-atk-category').value = data.category || 'Général'; document.getElementById('new-atk-notes').value = data.notes; document.getElementById('new-atk-req-attune').checked = data.reqAttune; editingAttackIndex = index; atkModal.classList.remove('hidden'); };

        let inventory = getStore('dnd-inventory') || []; let activeInvTabPinned = 'Tout'; let activeInvTabModal = 'Tout'; const invModal = document.getElementById('inventory-modal');
        function renderInventory() { const listMain = document.getElementById('pinned-inventory-list'); const listFull = document.getElementById('inventory-full-list'); if(!listMain || !listFull) return; let pinnedItems = inventory.filter(i => i.pinned); let onAddInvCat = () => { let nouv = prompt("Nouvelle catégorie :"); if(nouv && nouv.trim() !== "" && !invCategories.includes(nouv.trim())) { invCategories.push(nouv.trim()); setStore('dnd-inv-categories', invCategories); updateCategorySelects(); renderInventory(); } }; renderTabs('inv-tabs-container-pinned', pinnedItems, activeInvTabPinned, invCategories, (tab) => { activeInvTabPinned = tab; renderInventory(); }, onAddInvCat, () => { openCategoryManager('inv'); }); renderTabs('inv-tabs-container-modal', inventory, activeInvTabModal, invCategories, (tab) => { activeInvTabModal = tab; renderInventory(); }, onAddInvCat, () => { openCategoryManager('inv'); }); listMain.innerHTML = ''; listFull.innerHTML = ''; let totalWeight = 0; inventory.forEach((item, index) => { let pinClass = item.pinned ? 'pinned' : ''; let w = parseFloat(item.weight); let q = parseInt(item.qty) || 1; if(!isNaN(w)) totalWeight += (w * q); let cat = item.category || 'Général'; if(activeInvTabModal === 'Tout' || cat === activeInvTabModal) { listFull.innerHTML += `<div class="item-card"><div class="item-card-header"><h4>${item.name} (x${item.qty})</h4><div class="item-controls no-print"><button title="Modifier" onclick="editInv(${index})">✎</button><button class="btn-pin ${pinClass}" onclick="toggleInvPin(${index})">📍</button><button class="btn-del" onclick="deleteInv(${index})">X</button></div></div><div class="item-details"><span style="color:#888;">Poids: ${item.weight}</span></div></div>`; } if(item.pinned && (activeInvTabPinned === 'Tout' || cat === activeInvTabPinned)) { listMain.innerHTML += `<div class="item-card"><div class="item-card-header"><h4>${item.name} (x${item.qty})</h4>${getCrudControlsHTML(index, 'Inv', activeInvTabPinned === 'Tout')}<button class="btn-pin ${pinClass}" onclick="toggleInvPin(${index})">📍</button></div></div><div class="item-details"><span style="color:#888;">Poids: ${item.weight}</span></div></div>`; } }); const weightDisplay = document.getElementById('inv-total-weight'); if(weightDisplay) weightDisplay.textContent = (totalWeight % 1 !== 0) ? totalWeight.toFixed(2) : totalWeight; }
        document.body.addEventListener('click', (e) => { if(e.target.id === 'btn-open-inventory') { invModal.classList.remove('hidden'); renderInventory(); }});
        if(document.getElementById('btn-add-inventory')) { document.getElementById('btn-add-inventory').addEventListener('click', () => { let name = document.getElementById('inv-name').value; if(name) { inventory.push({ name: name, qty: document.getElementById('inv-qty').value || 1, weight: document.getElementById('inv-weight').value || "-", category: document.getElementById('inv-category').value.trim() || 'Général', pinned: false }); setStore('dnd-inventory', inventory); renderInventory(); document.querySelectorAll('#inventory-modal input').forEach(i => i.value = ''); } }); }
        window.toggleInvPin = (index) => { inventory[index].pinned = !inventory[index].pinned; setStore('dnd-inventory', inventory); renderInventory(); }; window.deleteInv = (index) => { if(confirm("Jeter ?")) { inventory.splice(index, 1); setStore('dnd-inventory', inventory); renderInventory(); }}; window.moveInvUp = (index) => { if(moveWithinFilter(inventory, index, -1, i => i.pinned && (activeInvTabPinned === 'Tout' ? true : (i.category || 'Général') === activeInvTabPinned))) { setStore('dnd-inventory', inventory); renderInventory(); } }; window.moveInvDown = (index) => { if(moveWithinFilter(inventory, index, 1, i => i.pinned && (activeInvTabPinned === 'Tout' ? true : (i.category || 'Général') === activeInvTabPinned))) { setStore('dnd-inventory', inventory); renderInventory(); } }; window.editInv = (index) => { editingInvIndex = index; const item = inventory[index]; document.getElementById('edit-inv-name').value = item.name; document.getElementById('edit-inv-qty').value = item.qty; document.getElementById('edit-inv-weight').value = item.weight; document.getElementById('edit-inv-category').value = item.category || 'Général'; document.getElementById('edit-inventory-modal').classList.remove('hidden'); }; 
        if(document.getElementById('btn-save-edit-inv')) { document.getElementById('btn-save-edit-inv').addEventListener('click', () => { if (editingInvIndex >= 0) { inventory[editingInvIndex] = { name: document.getElementById('edit-inv-name').value, qty: document.getElementById('edit-inv-qty').value || 1, weight: document.getElementById('edit-inv-weight').value || "-", category: document.getElementById('edit-inv-category').value.trim() || 'Général', pinned: inventory[editingInvIndex].pinned }; setStore('dnd-inventory', inventory); renderInventory(); document.getElementById('edit-inventory-modal').classList.add('hidden'); editingInvIndex = -1; } }); }

        function renderTraits() { 
            const listClass = document.getElementById('traits-list-class'); 
            const listRace = document.getElementById('traits-list-race'); 
            const listFeat = document.getElementById('traits-list-feat'); 
            if(!listClass || !listRace || !listFeat) return; 
            listClass.innerHTML = ''; listRace.innerHTML = ''; listFeat.innerHTML = ''; 
            traits.forEach((trait, index) => { 
                let isExpandedClass = trait.pinned ? 'expanded' : ''; 
                let html = `<div class="item-card trait-card"><div class="item-card-header" onclick="toggleTraitDesc(event, ${index})"><div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;"><span class="trait-meta">${trait.level ? 'Niv.'+trait.level : ''}</span><h4 style="margin:0;">${trait.name}</h4>${trait.pinned ? '📍' : ''}</div>${getCrudControlsHTML(index, 'Trait')}</div><div class="trait-desc ${isExpandedClass}" id="trait-desc-${index}">${trait.desc.replace(/\n/g, '<br>')}</div></div>`; 
                if(trait.type === 'class') listClass.innerHTML += html; else if(trait.type === 'race') listRace.innerHTML += html; else listFeat.innerHTML += html; 
            }); 
            if(listClass.innerHTML === '') listClass.innerHTML = `<span style="font-size:0.8rem; color:#888; font-style:italic;">Aucune capacité.</span>`; 
            if(listRace.innerHTML === '') listRace.innerHTML = `<span style="font-size:0.8rem; color:#888; font-style:italic;">Aucun trait.</span>`; 
            if(listFeat.innerHTML === '') listFeat.innerHTML = `<span style="font-size:0.8rem; color:#888; font-style:italic;">Aucun don.</span>`; 
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

        const crudIgnoredPrefixes = ['new-', 'edit-', 'inv-name', 'inv-qty', 'inv-weight', 'inv-category', 'init-add', 'macro-', 'input-custom', 'pay-amount', 'new-atk', 'new-spell', 'new-ability', 'new-journal', 'new-trait', 'rest-hd-to-roll', 'hp-quick'];

        let traits = getStore('dnd-traits') || []; const traitModal = document.getElementById('trait-form-modal');
        let abilities = getStore('dnd-abilities') || []; const abilityModal = document.getElementById('ability-form-modal');

        function renderAbilities() {
            const list = document.getElementById('abilities-list'); if(!list) return; list.innerHTML = '';
            if(abilities.length === 0) { list.innerHTML = `<span style="font-size:0.8rem; color:#888; font-style:italic;">Aucune capacité limitée. Utilisez ➕ Ajouter pour en créer.</span>`; return; }
            abilities.forEach((ab, index) => {
                const usedCount = ab.used ? ab.used.filter(Boolean).length : 0; const available = ab.max - usedCount; let chargesHtml = '';
                for(let i = 0; i < ab.max; i++) { const isUsed = ab.used && ab.used[i]; chargesHtml += `<button class="ability-charge-btn ${isUsed ? 'used' : ''}" data-idx="${index}" data-i="${i}" title="${isUsed ? '↩ Récupérer' : '▶ Dépenser'}"></button>`; }
                const regenIcon = ab.regenMode === 'short_long' ? '⏳' : '🌙'; const regenText = ab.regenMode === 'short_long' ? 'Court + Long' : 'Repos Long';
                list.innerHTML += `<div class="item-card ability-card"><div class="item-card-header"><h4>${ab.name}</h4><div style="display:flex; align-items:center; gap:8px; flex-shrink:0;"><span class="ability-counter">${available}<span style="color:#bbb; font-size:0.8em;">/${ab.max}</span></span>${getCrudControlsHTML(index, 'Ability')}</div></div><div class="ability-charges">${chargesHtml}</div><div><span class="ability-regen-badge">${regenIcon} ${regenText}</span></div></div>`;
            });
            list.querySelectorAll('.ability-charge-btn').forEach(btn => { btn.addEventListener('click', (e) => { e.preventDefault(); const idx = parseInt(e.currentTarget.dataset.idx); const i = parseInt(e.currentTarget.dataset.i); if(!abilities[idx].used) abilities[idx].used = Array(abilities[idx].max).fill(false); abilities[idx].used[i] = !abilities[idx].used[i]; setStore('dnd-abilities', abilities); renderAbilities(); }); });
        }

        document.body.addEventListener('click', (e) => { if(e.target.id === 'btn-open-ability-modal') { editingAbilityIndex = -1; document.getElementById('new-ability-name').value = ''; document.getElementById('new-ability-max').value = ''; document.getElementById('ab-regen-mode').value = 'long'; document.getElementById('ab-short-rest-block').classList.add('hidden'); if(abilityModal) abilityModal.classList.remove('hidden'); } });
        const abRegenMode = document.getElementById('ab-regen-mode'); if(abRegenMode) { abRegenMode.addEventListener('change', () => { const shortBlock = document.getElementById('ab-short-rest-block'); if(shortBlock) shortBlock.classList.toggle('hidden', abRegenMode.value !== 'short_long'); }); }
        const abShortType = document.getElementById('ab-short-type'); if(abShortType) abShortType.addEventListener('change', () => { const el = document.getElementById('ab-short-amount'); if(el) el.classList.toggle('hidden', abShortType.value === 'all'); });
        const abLongType = document.getElementById('ab-long-type'); if(abLongType) abLongType.addEventListener('change', () => { const el = document.getElementById('ab-long-amount'); if(el) el.classList.toggle('hidden', abLongType.value === 'all'); });

        if(document.getElementById('btn-save-ability')) { document.getElementById('btn-save-ability').addEventListener('click', () => { const name = document.getElementById('new-ability-name').value.trim(); const max = parseInt(document.getElementById('new-ability-max').value) || 1; const regenMode = document.getElementById('ab-regen-mode').value; const shortType = document.getElementById('ab-short-type').value; const shortAmount = parseInt(document.getElementById('ab-short-amount').value) || 1; const longType = document.getElementById('ab-long-type').value; const longAmount = parseInt(document.getElementById('ab-long-amount').value) || 1; if(name && max > 0) { const ab = { name, max, used: Array(max).fill(false), regenMode, shortType, shortAmount, longType, longAmount }; if(editingAbilityIndex >= 0) { ab.used = (abilities[editingAbilityIndex].used || []).slice(0, max); while(ab.used.length < max) ab.used.push(false); abilities[editingAbilityIndex] = ab; } else { abilities.push(ab); } setStore('dnd-abilities', abilities); renderAbilities(); if(abilityModal) abilityModal.classList.add('hidden'); } }); }
        window.deleteAbility = (index) => { if(confirm("Supprimer cette capacité ?")) { abilities.splice(index, 1); setStore('dnd-abilities', abilities); renderAbilities(); } };
        window.moveAbilityUp = (index) => { if(index > 0) { [abilities[index-1], abilities[index]] = [abilities[index], abilities[index-1]]; setStore('dnd-abilities', abilities); renderAbilities(); } };
        window.moveAbilityDown = (index) => { if(index < abilities.length-1) { [abilities[index], abilities[index+1]] = [abilities[index+1], abilities[index]]; setStore('dnd-abilities', abilities); renderAbilities(); } };
        window.editAbility = (index) => { const ab = abilities[index]; document.getElementById('new-ability-name').value = ab.name; document.getElementById('new-ability-max').value = ab.max; document.getElementById('ab-regen-mode').value = ab.regenMode || 'long'; const shortBlock = document.getElementById('ab-short-rest-block'); if(shortBlock) shortBlock.classList.toggle('hidden', ab.regenMode !== 'short_long'); const abShortEl = document.getElementById('ab-short-type'); if(abShortEl) abShortEl.value = ab.shortType || 'all'; const abShortAmtEl = document.getElementById('ab-short-amount'); if(abShortAmtEl) { abShortAmtEl.value = ab.shortAmount || 1; abShortAmtEl.classList.toggle('hidden', (ab.shortType || 'all') === 'all'); } const abLongEl = document.getElementById('ab-long-type'); if(abLongEl) abLongEl.value = ab.longType || 'all'; const abLongAmtEl = document.getElementById('ab-long-amount'); if(abLongAmtEl) { abLongAmtEl.value = ab.longAmount || 1; abLongAmtEl.classList.toggle('hidden', (ab.longType || 'all') === 'all'); } editingAbilityIndex = index; if(abilityModal) abilityModal.classList.remove('hidden'); };

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
        if(document.getElementById('btn-export-pdf')) document.getElementById('btn-export-pdf').addEventListener('click', () => { applyLayout('classic'); window.print(); });

        // ==========================================
        // MODULE DE RECHERCHE GLOBALE
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

            searchInput.addEventListener('input', () => {
                const query = searchInput.value.toLowerCase().trim();
                if (!query) { searchResults.innerHTML = '<div style="text-align:center; padding:20px; color:#777; font-style:italic;">Entrez un mot-clé pour lancer la recherche...</div>'; return; }
                const itemsFound = [];
                const targets = document.querySelectorAll('h1, h2, h3, h4, label, th, .widget-title, .spell-name, [placeholder]');
                
                targets.forEach(el => {
                    if (el.closest('#global-search-modal') || el.closest('#login-screen') || el.closest('#loading-screen')) return;
                    let text = el.hasAttribute('placeholder') && el.getAttribute('placeholder') ? el.getAttribute('placeholder') : (el.textContent || el.innerText);
                    text = text.replace(/[\n\r]+|[\s]{2,}/g, ' ').trim();
                    if (!text || text.length < 2) return;

                    if (text.toLowerCase().includes(query)) {
                        let contextName = 'Fiche de personnage';
                        let widget = el.closest('.draggable-widget, .modal-box, .scroll-paper, .auth-card');
                        if (widget) {
                            let titleEl = widget.querySelector('.section-title, h2, .grimoire-title');
                            if (titleEl) contextName = "Dossier : " + titleEl.textContent.trim().replace(/[▶▼]/g, '');
                        }

                        const clickTarget = el.hasAttribute('placeholder') ? el : (el.closest('div, li, tr, label') || el);
                        if (!itemsFound.some(item => item.element === clickTarget)) { itemsFound.push({ title: text, context: contextName, element: clickTarget }); }
                    }
                });

                if (itemsFound.length === 0) {
                    searchResults.innerHTML = '<div style="text-align:center; padding:20px; color:#777; font-style:italic;">Aucun élément correspondant trouvé.</div>';
                } else {
                    searchResults.innerHTML = '';
                    itemsFound.slice(0, 15).forEach(item => {
                        const row = document.createElement('div');
                        row.className = 'search-result-item';
                        row.innerHTML = `<div class="result-title">${item.title}</div><div class="result-path">${item.context}</div>`;
                        row.addEventListener('click', () => {
                            closeSearch();
                            let hiddenParent = item.element.closest('.hidden, [style*="display: none"]');
                            if (hiddenParent) {
                                const tabId = item.element.closest('[id]')?.id;
                                if (tabId) {
                                    const tabBtn = document.querySelector(`[data-tab="${tabId}"], [href="#${tabId}"], #btn-tab-${tabId}`);
                                    if (tabBtn) tabBtn.click();
                                }
                            }
                            item.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            if (item.element.tagName === 'INPUT' || item.element.tagName === 'TEXTAREA') setTimeout(() => item.element.focus(), 300);
                            item.element.classList.add('search-highlight-active');
                            setTimeout(() => item.element.classList.remove('search-highlight-active'), 2400);
                        });
                        searchResults.appendChild(row);
                    });
                }
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