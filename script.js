document.addEventListener('DOMContentLoaded', () => {

    // 1. PARE-FEU DE MÉMOIRE
    const DB = {
        get: function(key) { try { return localStorage.getItem(key); } catch(e) { return null; } },
        set: function(key, val) { try { localStorage.setItem(key, val); } catch(e) { console.warn("Erreur sauvegarde : Mémoire pleine ou bloquée."); } },
        remove: function(key) { try { localStorage.removeItem(key); } catch(e) {} },
        keys: function() { try { return Object.keys(localStorage); } catch(e) { return []; } }
    };

    let ACTIVE_CHAR_ID = DB.get('dnd-active-char');
    let charactersList = [];
    
    try { 
        let rawList = DB.get('dnd-character-list');
        if(rawList && rawList !== 'undefined') charactersList = JSON.parse(rawList);
        if(!Array.isArray(charactersList)) charactersList = [];
    } catch(e) { 
        charactersList = []; 
    }

    function getStore(key, isJson = true) { 
        let val = DB.get(`${ACTIVE_CHAR_ID}_${key}`); 
        if(!val || val === 'undefined') return null; 
        if(isJson) { try { return JSON.parse(val); } catch(e) { return null; } }
        return val;
    }
    function setStore(key, val, isJson = true) { 
        DB.set(`${ACTIVE_CHAR_ID}_${key}`, isJson ? JSON.stringify(val) : val); 
    }

    // ==========================================
    // 2. FONCTIONS GLOBALES
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

    let cPrim = document.getElementById('color-primary'); if(cPrim) cPrim.addEventListener('input', (e) => { document.documentElement.style.setProperty('--primary-color', e.target.value); DB.set('dnd-theme-primary', e.target.value); });
    let cAcc = document.getElementById('color-accent'); if(cAcc) cAcc.addEventListener('input', (e) => { document.documentElement.style.setProperty('--accent-color', e.target.value); DB.set('dnd-theme-accent', e.target.value); });
    let cShBg = document.getElementById('color-sheet-bg'); if(cShBg) cShBg.addEventListener('input', (e) => { document.documentElement.style.setProperty('--sheet-bg-color', e.target.value); DB.set('dnd-theme-sheet-bg', e.target.value); });
    let cWdBg = document.getElementById('color-widget-bg'); if(cWdBg) cWdBg.addEventListener('input', (e) => { document.documentElement.style.setProperty('--widget-bg', e.target.value); DB.set('dnd-theme-widget-bg', e.target.value); });
    let cConc = document.getElementById('color-concentration'); if(cConc) cConc.addEventListener('input', (e) => { document.documentElement.style.setProperty('--concentration-color', e.target.value); DB.set('dnd-theme-concentration', e.target.value); });
    let btnResetTheme = document.getElementById('btn-reset-theme'); if(btnResetTheme) btnResetTheme.addEventListener('click', () => { DB.remove('dnd-theme-primary'); DB.remove('dnd-theme-accent'); DB.remove('dnd-theme-sheet-bg'); DB.remove('dnd-theme-widget-bg'); DB.remove('dnd-theme-concentration'); applyTheme(); });

    const btnSettingsToggle = document.getElementById('btn-settings-toggle');
    const settingsDropdown = document.getElementById('settings-dropdown');
    if (btnSettingsToggle && settingsDropdown) {
        btnSettingsToggle.addEventListener('click', (e) => { e.stopPropagation(); settingsDropdown.classList.toggle('hidden'); });
        document.addEventListener('click', (e) => { if (!settingsDropdown.classList.contains('hidden') && !settingsDropdown.contains(e.target) && e.target !== btnSettingsToggle) settingsDropdown.classList.add('hidden'); });
    }

    // ==========================================
    // IMPORT / EXPORT TEXTE
    // ==========================================
    const btnOpenIO = document.getElementById('btn-open-io');
    const ioModal = document.getElementById('io-modal');
    const ioTextarea = document.getElementById('io-textarea');

    if(btnOpenIO && ioModal) {
        btnOpenIO.addEventListener('click', () => {
            if(!ACTIVE_CHAR_ID) return alert("Aucun personnage actif.");
            const data = { 
                export_version: "3.0",
                char_meta: charactersList.find(c => c.id === ACTIVE_CHAR_ID),
                keys: {}
            };
            const prefix = ACTIVE_CHAR_ID + '_';
            DB.keys().forEach(k => {
                if(k.startsWith(prefix)) {
                    data.keys[k.substring(prefix.length)] = DB.get(k);
                }
            });
            const jsonStr = JSON.stringify(data);
            const base64Str = btoa(unescape(encodeURIComponent(jsonStr)));
            
            ioTextarea.value = base64Str;
            ioModal.classList.remove('hidden');
            if(settingsDropdown) settingsDropdown.classList.add('hidden');
        });
    }

    if(document.getElementById('btn-close-io')) {
        document.getElementById('btn-close-io').addEventListener('click', () => ioModal.classList.add('hidden'));
    }

    if(document.getElementById('btn-io-copy')) {
        document.getElementById('btn-io-copy').addEventListener('click', () => {
            ioTextarea.select();
            document.execCommand('copy');
            alert("Code copié dans le presse-papier ! Tu peux le sauvegarder dans un fichier texte.");
        });
    }

    if(document.getElementById('btn-io-import')) {
        document.getElementById('btn-io-import').addEventListener('click', () => {
            const code = ioTextarea.value.trim();
            if(!code) return alert("Le champ est vide. Colle un code de sauvegarde !");
            
            try {
                const jsonStr = decodeURIComponent(escape(atob(code)));
                const parsed = JSON.parse(jsonStr);
                
                let isOldFormat = parsed['char_meta'] && typeof parsed['char_meta'] === 'string';
                let charMeta = isOldFormat ? JSON.parse(parsed['char_meta']) : parsed.char_meta;
                
                if(!charMeta) throw new Error("Les données du personnage sont introuvables.");

                let newId = 'char_' + Date.now();
                charMeta.id = newId; 
                charMeta.name = charMeta.name + " (Importé)";
                charactersList.push(charMeta);
                DB.set('dnd-character-list', JSON.stringify(charactersList));

                if (isOldFormat) {
                    for(let k in parsed) { if(k !== 'char_meta') DB.set(newId + '_' + k, parsed[k]); }
                } else if (parsed.keys) {
                    for(let k in parsed.keys) { DB.set(newId + '_' + k, parsed.keys[k]); }
                }

                DB.set('dnd-active-char', newId); 
                alert("Importation réussie avec succès !");
                location.reload();
            } catch(err) {
                console.error(err);
                alert("Code invalide ou corrompu. Assure-toi d'avoir copié l'intégralité du texte.");
            }
        });
    }

    // ==========================================
    // GESTION DU FOND D'ÉCRAN
    // ==========================================
    const bgInput = document.getElementById('bg-file-input');
    const CUSTOM_BG_KEY = 'dnd-custom-background-image';
    
    function applySavedBackground() {
        const savedBg = DB.get(CUSTOM_BG_KEY);
        if(savedBg && savedBg !== 'undefined') { 
            document.body.style.backgroundImage = `url("${savedBg}")`; 
        } else { 
            document.body.style.backgroundImage = ''; 
        }
    }
    applySavedBackground();
    
    let btnChangeBg = document.getElementById('btn-change-bg'); 
    if(btnChangeBg && bgInput) {
        btnChangeBg.addEventListener('click', () => {
            bgInput.click();
            if(settingsDropdown) settingsDropdown.classList.add('hidden');
        });
    }

    if(bgInput) {
        bgInput.addEventListener('change', (e) => {
            const file = e.target.files[0]; 
            if(!file) return;
            if(!file.type.startsWith('image/')) return;
            
            const reader = new FileReader();
            reader.onload = (event) => { 
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1920; 
                    let width = img.width;
                    let height = img.height;
                    
                    if(width > MAX_WIDTH) {
                        height = Math.round((height * MAX_WIDTH) / width);
                        width = MAX_WIDTH;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    const resizedBase64 = canvas.toDataURL('image/jpeg', 0.7); 
                    
                    try { 
                        DB.set(CUSTOM_BG_KEY, resizedBase64); 
                        applySavedBackground(); 
                    } catch (err) { 
                        alert("L'image est toujours trop lourde même après compression. Essayez une image plus petite."); 
                    } 
                    bgInput.value = '';
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
    
    let btnResetBg = document.getElementById('btn-reset-bg'); 
    if(btnResetBg) {
        btnResetBg.addEventListener('click', () => { 
            DB.remove(CUSTOM_BG_KEY); 
            applySavedBackground(); 
            if(settingsDropdown) settingsDropdown.classList.add('hidden');
        });
    }

    // ==========================================
    // 3. ÉCRAN D'ACCUEIL
    // ==========================================
    const homeScreen = document.getElementById('home-screen');
    const appScreen = document.getElementById('app-screen');

    function initHome() {
        const listDiv = document.getElementById('character-list'); if(!listDiv) return; 
        listDiv.innerHTML = '';
        if(charactersList.length === 0) { listDiv.innerHTML = "<p>Aucun personnage. Créez-en un !</p>"; } 
        else {
            charactersList.forEach(c => {
                let card = document.createElement('div'); card.className = 'char-card';
                let info = document.createElement('div'); info.className = 'char-info';
                info.innerHTML = `<span>${c.name}</span> <span style="font-size:0.8rem; color:#888;">(Niv.${c.level || 1} ${c.class || ''})</span>`;
                info.onclick = () => { DB.set('dnd-active-char', c.id); location.reload(); };
                let delBtn = document.createElement('button'); delBtn.className = 'btn-delete-char'; delBtn.innerHTML = '✖';
                delBtn.onclick = (e) => { e.stopPropagation(); if(confirm(`Supprimer ${c.name} ?`)) { charactersList = charactersList.filter(char => char.id !== c.id); DB.set('dnd-character-list', JSON.stringify(charactersList)); initHome(); } };
                card.appendChild(info); card.appendChild(delBtn); listDiv.appendChild(card);
            });
        }
    }

    const btnCreateChar = document.getElementById('btn-create-char');
    if(btnCreateChar) {
        let newBtnCreate = btnCreateChar.cloneNode(true);
        btnCreateChar.parentNode.replaceChild(newBtnCreate, btnCreateChar);
        newBtnCreate.addEventListener('click', () => {
            let inputName = document.getElementById('new-char-name');
            if(!inputName) return;
            let name = inputName.value.trim();
            if(name) { 
                let newId = 'char_' + Date.now(); 
                charactersList.push({ id: newId, name: name, level: 1, class: '' }); 
                DB.set('dnd-character-list', JSON.stringify(charactersList)); 
                DB.set(`${newId}_dnd-sheet-char-name`, name); 
                DB.set('dnd-active-char', newId); 
                location.reload(); 
            } else {
                alert("Donne un nom à ton personnage avant de le créer.");
            }
        });
    }

    const btnGoHome = document.getElementById('btn-go-home');
    if(btnGoHome) btnGoHome.addEventListener('click', () => { DB.remove('dnd-active-char'); location.reload(); });

    if(!ACTIVE_CHAR_ID) { 
        if(homeScreen) homeScreen.classList.remove('hidden'); 
        if(appScreen) appScreen.classList.add('hidden'); 
        initHome(); 
        return; 
    } 
    else { 
        if(homeScreen) homeScreen.classList.add('hidden'); 
        if(appScreen) appScreen.classList.remove('hidden'); 
    }

    // ==========================================
    // 4. LOGIQUE DE LA FICHE DE PERSONNAGE
    // ==========================================

    const ALL_WIDGETS = ['widget-rests', 'widget-concentration', 'widget-inspiration', 'widget-proficiency', 'widget-stats', 'widget-appearance', 'widget-traits', 'widget-training', 'widget-combat', 'widget-hp', 'widget-attacks', 'widget-currency', 'widget-inventory', 'widget-companion', 'widget-quests', 'widget-magic-stats', 'widget-abilities', 'widget-spells', 'widget-macros', 'widget-initiative', 'widget-notes', 'widget-calculator'];
    
    function safeStoreAllWidgets() {
        const storage = document.getElementById('widget-storage');
        ALL_WIDGETS.forEach(wId => { const w = document.getElementById(wId); if(w && w.parentNode !== storage) { storage.appendChild(w); } });
    }

    // FIX SAUT DE PAGE LORS DU REPLI D'UN MODULE
    document.body.addEventListener('click', (e) => {
        const header = e.target.closest('.collapsible-header');
        if(!header) return;
        if(e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.classList.contains('btn-icon')) return;
        
        // Empêche le comportement natif des <label> de faire scroller la page
        e.preventDefault();

        const content = header.nextElementSibling;
        if(!content || !content.classList.contains('collapsible-content')) return;
        
        // On mémorise la position Y du module sur l'écran avant de le replier
        const rectBefore = header.getBoundingClientRect();
        
        const icon = header.querySelector('.collapse-icon');
        content.classList.toggle('collapsed');
        if(icon) icon.textContent = content.classList.contains('collapsed') ? '▶' : '▼';
        
        // On attend la frame suivante pour calculer la nouvelle position
        setTimeout(() => {
            const rectAfter = header.getBoundingClientRect();
            // Si la hauteur de la page a été réduite et a forcé un scroll, on réaligne la page
            if (Math.abs(rectAfter.top - rectBefore.top) > 0) {
                window.scrollBy(0, rectAfter.top - rectBefore.top);
            }
        }, 0);
    });

    const layoutSelector = document.getElementById('layout-selector');
    const layoutTabsContainer = document.getElementById('layout-tabs-container');
    const layoutClassicContainer = document.getElementById('layout-classic-container');
    const layoutCustomContainer = document.getElementById('layout-custom-container');
    const btnEditCustom = document.getElementById('btn-edit-custom');
    
    let isEditMode = false;
    
    const DEFAULT_CLASSIC_LAYOUT = {
        'col-left': ['widget-proficiency', 'widget-inspiration', 'widget-concentration', 'widget-stats', 'widget-training', 'widget-quests'],
        'col-center': ['widget-combat', 'widget-hp', 'widget-rests', 'widget-traits', 'widget-attacks', 'widget-inventory', 'widget-currency', 'widget-initiative', 'widget-companion'],
        'col-right': ['widget-magic-stats', 'widget-spells', 'widget-abilities', 'widget-macros', 'widget-calculator'],
        'col-bottom': ['widget-appearance', 'widget-notes']
    };

    const DEFAULT_TABS_LAYOUT = {
        'tab-strict-gen': ['widget-rests', 'widget-concentration', 'widget-inspiration', 'widget-proficiency', 'widget-stats', 'widget-appearance', 'widget-traits', 'widget-training', 'widget-companion'],
        'tab-strict-com': ['widget-combat', 'widget-initiative', 'widget-hp', 'widget-attacks', 'widget-currency', 'widget-inventory'],
        'tab-strict-mag': ['widget-magic-stats', 'widget-macros', 'widget-abilities', 'widget-spells', 'widget-calculator'],
        'tab-strict-not': ['widget-quests', 'widget-notes']
    };

    function applyWidgetSizes() {
        ALL_WIDGETS.forEach(wId => {
            const el = document.getElementById(wId);
            if(el) {
                el.classList.remove('widget-full', 'widget-half', 'widget-third');
                if(['widget-inspiration', 'widget-concentration', 'widget-proficiency'].includes(wId)) {
                    el.classList.add('widget-third');
                } else {
                    el.classList.add('widget-full'); 
                }
            }
        });
    }

    // ==========================================
    // PROFILS PERSONNALISÉS GLOBAUX
    // ==========================================
    let customProfiles = [];
    try { customProfiles = JSON.parse(DB.get('dnd-global-profiles')) || []; } catch(e) { customProfiles = []; }

    function updateLayoutSelectorOptions() {
        const sel = document.getElementById('layout-selector');
        if(!sel) return;
        const currentVal = getStore('dnd-layout-mode', false) || 'classic';
        sel.innerHTML = `
            <option value="classic">📜 Mode Classique</option>
            <option value="tabs">📑 Mode Onglets</option>
            <option value="custom">🧩 Mode Personnalisé (Brouillon)</option>
        `;
        customProfiles.forEach(p => {
            let opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `💾 Profil: ${p.name}`;
            sel.appendChild(opt);
        });
        
        let found = Array.from(sel.options).some(o => o.value === currentVal);
        sel.value = found ? currentVal : 'classic';
    }

    const btnSaveAsProfile = document.getElementById('btn-save-as-profile');
    if(btnSaveAsProfile) {
        btnSaveAsProfile.addEventListener('click', () => {
            let name = prompt("Donnez un nom à ce profil (ex: 'Mage', 'Combat') :");
            if(name && name.trim() !== '') {
                let newProf = {
                    id: 'prof_' + Date.now(),
                    name: name.trim(),
                    layout: JSON.parse(JSON.stringify(customLayout)) // Copie profonde
                };
                customProfiles.push(newProf);
                DB.set('dnd-global-profiles', JSON.stringify(customProfiles));
                updateLayoutSelectorOptions();
                document.getElementById('layout-selector').value = newProf.id;
                applyLayout(newProf.id);
                alert("Profil sauvegardé ! Il est maintenant disponible dans le menu Disposition.");
            }
        });
    }

    const btnRenameProfile = document.getElementById('btn-rename-profile');
    if(btnRenameProfile) {
        btnRenameProfile.addEventListener('click', () => {
            let selValue = document.getElementById('layout-selector').value;
            let prof = customProfiles.find(p => p.id === selValue);
            if(prof) {
                let newName = prompt("Nouveau nom pour ce profil :", prof.name);
                if(newName && newName.trim() !== '') {
                    prof.name = newName.trim();
                    DB.set('dnd-global-profiles', JSON.stringify(customProfiles));
                    updateLayoutSelectorOptions();
                }
            }
        });
    }

    const btnDeleteProfile = document.getElementById('btn-delete-profile');
    if(btnDeleteProfile) {
        btnDeleteProfile.addEventListener('click', () => {
            let selValue = document.getElementById('layout-selector').value;
            if(confirm("Voulez-vous vraiment supprimer définitivement ce profil ?")) {
                customProfiles = customProfiles.filter(p => p.id !== selValue);
                DB.set('dnd-global-profiles', JSON.stringify(customProfiles));
                updateLayoutSelectorOptions();
                applyLayout('classic');
            }
        });
    }

    // ==========================================
    // GESTIONNAIRE PERSONNALISÉ (Onglets + Tri)
    // ==========================================
    let customLayout = [];
    let activeCustomTabId = null;
    let managerActiveTabId = null;
    let hiddenCustomWidgets = [];

    function syncHiddenWidgets() {
        let used = [];
        customLayout.forEach(t => used.push(...t.col1, ...t.col2, ...t.col3));
        hiddenCustomWidgets = ALL_WIDGETS.filter(w => !used.includes(w) && w !== 'widget-dice');
    }

    function renderCustomSheet() {
        safeStoreAllWidgets();
        const nav = document.getElementById('custom-tabs-nav');
        if(!nav) return;
        nav.innerHTML = '';
        
        if (customLayout.length <= 1) {
            nav.style.display = 'none';
        } else {
            nav.style.display = 'flex';
            customLayout.forEach(tab => {
                let btn = document.createElement('button');
                btn.className = `tab-btn-strict ${tab.id === activeCustomTabId ? 'active' : ''}`;
                btn.textContent = tab.name;
                btn.onclick = () => { activeCustomTabId = tab.id; renderCustomSheet(); };
                nav.appendChild(btn);
            });
        }

        let activeTab = customLayout.find(t => t.id === activeCustomTabId);
        if(!activeTab) { activeTab = customLayout[0]; activeCustomTabId = activeTab.id; }

        const c1 = document.getElementById('custom-col-1'); c1.innerHTML = '';
        const c2 = document.getElementById('custom-col-2'); c2.innerHTML = '';
        const c3 = document.getElementById('custom-col-3'); c3.innerHTML = '';

        activeTab.col1.forEach(wId => { let w = document.getElementById(wId); if(w) c1.appendChild(w); });
        activeTab.col2.forEach(wId => { let w = document.getElementById(wId); if(w) c2.appendChild(w); });
        activeTab.col3.forEach(wId => { let w = document.getElementById(wId); if(w) c3.appendChild(w); });
        
        applyWidgetSizes();
    }

    function renderManager() {
        syncHiddenWidgets();
        const tabsList = document.getElementById('manager-tabs-list');
        if(!tabsList) return;
        tabsList.innerHTML = '';
        
        customLayout.forEach(tab => {
            let div = document.createElement('div');
            div.style.display = 'flex'; div.style.alignItems = 'center'; div.style.gap = '5px';
            div.style.background = tab.id === managerActiveTabId ? 'var(--primary-color)' : 'rgba(0,0,0,0.1)';
            div.style.color = tab.id === managerActiveTabId ? 'white' : 'var(--text-color)';
            div.style.padding = '5px 10px'; div.style.borderRadius = '5px';
            
            let input = document.createElement('input');
            input.value = tab.name;
            input.style.border = 'none'; input.style.background = 'transparent'; input.style.color = 'inherit'; input.style.fontWeight = 'bold'; input.style.width = '120px';
            input.onchange = (e) => { tab.name = e.target.value.trim() || 'Onglet'; saveCustomLayout(); renderManager(); renderCustomSheet(); };
            div.appendChild(input);
            
            let btnSelect = document.createElement('button');
            btnSelect.innerHTML = '⚙️'; btnSelect.className = 'btn-small'; btnSelect.style.background = 'transparent'; btnSelect.title = "Éditer cet onglet";
            btnSelect.onclick = () => { managerActiveTabId = tab.id; renderManager(); };
            div.appendChild(btnSelect);
            
            if (customLayout.length > 1) {
                let btnDel = document.createElement('button');
                btnDel.innerHTML = 'X'; btnDel.className = 'btn-small'; btnDel.style.background = '#e74c3c'; btnDel.title = "Supprimer";
                btnDel.onclick = () => { 
                    if(confirm(`Supprimer l'onglet "${tab.name}" ? Ses modules retourneront dans la réserve.`)) {
                        customLayout = customLayout.filter(t => t.id !== tab.id);
                        if(managerActiveTabId === tab.id) managerActiveTabId = customLayout[0].id;
                        if(activeCustomTabId === tab.id) activeCustomTabId = customLayout[0].id;
                        saveCustomLayout(); renderManager(); renderCustomSheet();
                    }
                };
                div.appendChild(btnDel);
            }
            tabsList.appendChild(div);
        });

        let activeTab = customLayout.find(t => t.id === managerActiveTabId);
        if(!activeTab) { activeTab = customLayout[0]; managerActiveTabId = activeTab.id; }
        
        ['col1', 'col2', 'col3'].forEach(colName => {
            const colContainer = document.getElementById(`manager-${colName}-list`);
            if(!colContainer) return;
            colContainer.innerHTML = '';
            activeTab[colName].forEach((wId, index) => {
                let prettyName = wId.replace('widget-', '').toUpperCase();
                colContainer.innerHTML += `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:white; border:1px solid #c4b487; padding:4px 8px; border-radius:4px; font-size:0.8rem;">
                        <span style="font-weight:bold; color:#333;">${prettyName}</span>
                        <div style="display:flex; gap:3px;">
                            <button class="btn-small" style="background:#7f8c8d; padding:2px 6px;" onclick="window.moveCustomWidget('${managerActiveTabId}', '${colName}', ${index}, -1)" ${index === 0 ? 'disabled style="opacity:0.5;"' : ''}>▲</button>
                            <button class="btn-small" style="background:#7f8c8d; padding:2px 6px;" onclick="window.moveCustomWidget('${managerActiveTabId}', '${colName}', ${index}, 1)" ${index === activeTab[colName].length - 1 ? 'disabled style="opacity:0.5;"' : ''}>▼</button>
                            <button class="btn-small" style="background:#e74c3c; padding:2px 6px;" onclick="window.removeCustomWidget('${managerActiveTabId}', '${colName}', ${index})">X</button>
                        </div>
                    </div>
                `;
            });
        });

        const sel = document.getElementById('manager-hidden-select');
        if(sel) {
            sel.innerHTML = hiddenCustomWidgets.length === 0 
                ? '<option value="">(Aucun module disponible)</option>' 
                : hiddenCustomWidgets.map(w => `<option value="${w}">${w.replace('widget-', '').toUpperCase()}</option>`).join('');
        }
    }

    window.moveCustomWidget = (tabId, colName, index, dir) => {
        let tab = customLayout.find(t => t.id === tabId);
        let arr = tab[colName];
        if (dir === -1 && index > 0) [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
        else if (dir === 1 && index < arr.length - 1) [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
        saveCustomLayout(); renderManager(); renderCustomSheet();
    };

    window.removeCustomWidget = (tabId, colName, index) => {
        let tab = customLayout.find(t => t.id === tabId);
        tab[colName].splice(index, 1);
        saveCustomLayout(); renderManager(); renderCustomSheet();
    };

    window.addCustomWidget = (colName) => {
        const sel = document.getElementById('manager-hidden-select');
        if(!sel || !sel.value) return;
        let wId = sel.value;
        let tab = customLayout.find(t => t.id === managerActiveTabId);
        tab[colName].push(wId);
        saveCustomLayout(); renderManager(); renderCustomSheet();
    };

    let btnAddCol1 = document.getElementById('btn-manager-add-col1'); if(btnAddCol1) btnAddCol1.onclick = () => addCustomWidget('col1');
    let btnAddCol2 = document.getElementById('btn-manager-add-col2'); if(btnAddCol2) btnAddCol2.onclick = () => addCustomWidget('col2');
    let btnAddCol3 = document.getElementById('btn-manager-add-col3'); if(btnAddCol3) btnAddCol3.onclick = () => addCustomWidget('col3');
    
    let btnAddTab = document.getElementById('btn-manager-add-tab');
    if(btnAddTab) {
        btnAddTab.onclick = () => {
            let newTab = { id: 'tab_' + Date.now(), name: 'Nouvel Onglet', col1: [], col2: [], col3: [] };
            customLayout.push(newTab);
            managerActiveTabId = newTab.id;
            saveCustomLayout(); renderManager(); renderCustomSheet();
        };
    }

    function saveCustomLayout() {
        let mode = getStore('dnd-layout-mode', false) || 'classic';
        if (mode.startsWith('prof_')) {
            let prof = customProfiles.find(p => p.id === mode);
            if (prof) {
                prof.layout = customLayout;
                DB.set('dnd-global-profiles', JSON.stringify(customProfiles));
            }
        } else {
            setStore('dnd-custom-layout', customLayout);
        }
    }

    function toggleEditMode() {
        isEditMode = !isEditMode;
        const manager = document.getElementById('custom-layout-manager');
        if(manager) manager.classList.toggle('hidden', !isEditMode);
        
        if(isEditMode) {
            renderManager();
            if(btnEditCustom) btnEditCustom.textContent = "✅ Terminer Édition";
        } else {
            if(btnEditCustom) btnEditCustom.textContent = "⚙️ Modifier Disposition";
        }
    }
    if(btnEditCustom) btnEditCustom.addEventListener('click', toggleEditMode);

    // ==========================================
    // MOTEUR D'AFFICHAGE PRINCIPAL
    // ==========================================
    updateLayoutSelectorOptions(); // Init options on load

    function applyLayout(mode) {
        setStore('dnd-layout-mode', mode, false);
        isEditMode = false;
        
        const profileActions = document.getElementById('profile-actions');
        if(profileActions) {
            if(mode.startsWith('prof_')) profileActions.classList.remove('hidden');
            else profileActions.classList.add('hidden');
        }

        if(document.getElementById('custom-layout-manager')) document.getElementById('custom-layout-manager').classList.add('hidden');
        if(btnEditCustom) btnEditCustom.textContent = "⚙️ Modifier Disposition";
        
        if(layoutTabsContainer) layoutTabsContainer.classList.add('hidden');
        if(layoutClassicContainer) layoutClassicContainer.classList.add('hidden');
        if(layoutCustomContainer) layoutCustomContainer.classList.add('hidden');

        safeStoreAllWidgets();
        applyWidgetSizes();

        if (mode === 'tabs' && layoutTabsContainer) {
            layoutTabsContainer.classList.remove('hidden');
            for (const [containerId, widgetList] of Object.entries(DEFAULT_TABS_LAYOUT)) {
                const container = document.getElementById(containerId);
                if (container) { widgetList.forEach(widgetId => { const w = document.getElementById(widgetId); if (w) container.appendChild(w); }); }
            }
            switchStrictTab('tab-strict-gen');

        } else if (mode === 'classic' && layoutClassicContainer) {
            layoutClassicContainer.classList.remove('hidden');
            for (const [containerId, widgetList] of Object.entries(DEFAULT_CLASSIC_LAYOUT)) {
                const container = document.getElementById(containerId);
                if (container) { widgetList.forEach(widgetId => { const w = document.getElementById(widgetId); if (w) container.appendChild(w); }); }
            }

        } else if (mode === 'custom' || mode.startsWith('prof_')) {
            layoutCustomContainer.classList.remove('hidden');
            
            if (mode.startsWith('prof_')) {
                let prof = customProfiles.find(p => p.id === mode);
                if (prof) {
                    customLayout = prof.layout;
                } else {
                    applyLayout('classic');
                    return;
                }
            } else {
                let savedBrouillon = getStore('dnd-custom-layout');
                if (savedBrouillon && Array.isArray(savedBrouillon)) {
                    customLayout = savedBrouillon;
                } else {
                    customLayout = [{ id: 'tab_custom_default', name: 'Ma Fiche', col1: [...DEFAULT_CLASSIC_LAYOUT['col-left']], col2: [...DEFAULT_CLASSIC_LAYOUT['col-center']], col3: [...DEFAULT_CLASSIC_LAYOUT['col-right']] }];
                }
            }
            
            if (!customLayout.find(t => t.id === activeCustomTabId)) {
                activeCustomTabId = customLayout[0].id;
                managerActiveTabId = customLayout[0].id;
            }

            renderCustomSheet();
        }
        if(settingsDropdown) settingsDropdown.classList.add('hidden');
    }
    
    if(layoutSelector) layoutSelector.addEventListener('change', (e) => applyLayout(e.target.value));

    function switchStrictTab(tabId) {
        document.querySelectorAll('.tab-btn-strict').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
        document.querySelectorAll('#layout-tabs-container .tab-content').forEach(content => {
            content.classList.toggle('hidden', content.id !== tabId);
            content.classList.toggle('active', content.id === tabId);
        });
    }
    document.querySelectorAll('.tab-btn-strict').forEach(btn => { btn.addEventListener('click', () => switchStrictTab(btn.dataset.tab)); });

    // CALCULATRICE
    window.appendCalc = (val) => { const disp = document.getElementById('calc-display'); if(disp) disp.value += val; };
    window.clearCalc = () => { const disp = document.getElementById('calc-display'); if(disp) disp.value = ''; };
    window.evalCalc = () => { 
        const disp = document.getElementById('calc-display'); 
        if(disp) {
            try { 
                let safeVal = disp.value.replace(/[^0-9+\-*/.]/g, '');
                disp.value = eval(safeVal) || ''; 
            } catch(e) { disp.value = 'Erreur'; setTimeout(() => disp.value='', 1000); }
        }
    };

    // Avatar
    const avatarInput = document.getElementById('avatar-file-input');
    const avatarPreview = document.getElementById('main-avatar-preview');
    const avatarHeader = document.getElementById('header-avatar');
    const avatarPlaceholder = document.getElementById('avatar-placeholder');

    function loadAvatar() {
        const savedAvatar = DB.get('dnd-avatar', false);
        if(savedAvatar && avatarPreview && avatarPlaceholder && avatarHeader) { 
            avatarPreview.src = savedAvatar; 
            avatarPreview.classList.remove('hidden'); 
            avatarPlaceholder.classList.add('hidden'); 
            avatarHeader.style.backgroundImage = `url("${savedAvatar}")`; 
        }
    }
    if(avatarInput) {
        avatarInput.addEventListener('change', (e) => { 
            const file = e.target.files[0]; 
            if(!file || !file.type.startsWith('image/')) return; 
            const reader = new FileReader(); 
            reader.onload = (event) => { 
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 250;
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const resizedBase64 = canvas.toDataURL('image/jpeg', 0.8);
                    try { 
                        DB.set('dnd-avatar', resizedBase64, false); 
                        loadAvatar(); 
                    } catch (err) { alert("L'image est toujours trop lourde."); } 
                };
                img.src = event.target.result;
            }; 
            reader.readAsDataURL(file); 
        });
    }
    loadAvatar();

    const cbConcentration = document.getElementById('is-concentrating');
    const concentrationGlow = document.getElementById('concentration-glow');

    function updateConcentrationUI() {
        if(!cbConcentration || !concentrationGlow || !avatarHeader) return;
        if(cbConcentration.checked) {
            document.body.classList.add('concentrating-mode');
            concentrationGlow.classList.remove('hidden');
            avatarHeader.classList.add('concentrating');
        } else {
            document.body.classList.remove('concentrating-mode');
            concentrationGlow.classList.add('hidden');
            avatarHeader.classList.remove('concentrating');
        }
    }

    if(cbConcentration) {
        let isConcentrating = DB.get('dnd-is-concentrating', false) === 'true';
        cbConcentration.checked = isConcentrating;
        updateConcentrationUI();
        cbConcentration.addEventListener('change', () => { DB.set('dnd-is-concentrating', cbConcentration.checked, false); updateConcentrationUI(); });
    }

    // Dés Volants
    const btnToggleDice = document.getElementById('btn-toggle-dice');
    const diceDrawer = document.getElementById('dice-drawer');
    const toggleFloatingDice = document.getElementById('toggle-floating-dice');

    if(toggleFloatingDice && btnToggleDice && diceDrawer) {
        let showFloatingDice = DB.get('dnd-show-floating-dice', false);
        if(showFloatingDice === null) showFloatingDice = 'true';
        toggleFloatingDice.checked = showFloatingDice === 'true';
        btnToggleDice.classList.toggle('hidden', !toggleFloatingDice.checked);

        toggleFloatingDice.addEventListener('change', (e) => {
            DB.set('dnd-show-floating-dice', e.target.checked, false);
            btnToggleDice.classList.toggle('hidden', !e.target.checked);
            if(!e.target.checked && diceDrawer.classList.contains('open')) diceDrawer.classList.remove('open');
        });
        
        let isDraggingDiceBtn = false;
        let startY = 0, startX = 0, clickStartX = 0, clickStartY = 0;
        let startTop = 0, startLeft = 0;

        btnToggleDice.addEventListener('mousedown', (e) => {
            isDraggingDiceBtn = true;
            startX = e.clientX; startY = e.clientY; clickStartX = e.clientX; clickStartY = e.clientY;
            let rect = btnToggleDice.getBoundingClientRect(); startLeft = rect.left; startTop = rect.top;
            btnToggleDice.style.transition = 'none'; btnToggleDice.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if(!isDraggingDiceBtn) return;
            let newLeft = startLeft + (e.clientX - startX); let newTop = startTop + (e.clientY - startY);
            newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - btnToggleDice.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, window.innerHeight - btnToggleDice.offsetHeight));
            btnToggleDice.style.left = newLeft + 'px'; btnToggleDice.style.top = newTop + 'px'; btnToggleDice.style.right = 'auto'; 
        });

        window.addEventListener('mouseup', (e) => {
            if(isDraggingDiceBtn) {
                isDraggingDiceBtn = false;
                btnToggleDice.style.transition = 'top 0.3s, left 0.3s, background 0.2s'; btnToggleDice.style.cursor = 'grab';
                
                if(Math.abs(e.clientX - clickStartX) < 5 && Math.abs(e.clientY - clickStartY) < 5) {
                    diceDrawer.classList.toggle('open');
                } else {
                    let rect = btnToggleDice.getBoundingClientRect();
                    let isLeft = (rect.left + rect.width/2) < window.innerWidth / 2;
                    if(isLeft) { btnToggleDice.style.left = '0px'; diceDrawer.classList.add('drawer-left'); diceDrawer.style.top = Math.max(0, rect.top - 20) + 'px'; } 
                    else { btnToggleDice.style.left = (window.innerWidth - btnToggleDice.offsetWidth) + 'px'; diceDrawer.classList.remove('drawer-left'); diceDrawer.style.top = Math.max(0, rect.top - 20) + 'px'; }
                    setTimeout(() => { DB.set('dnd-dice-btn-y', btnToggleDice.style.top, false); DB.set('dnd-dice-btn-side', isLeft ? 'left' : 'right', false); }, 350);
                }
            }
        });

        let savedDiceY = DB.get('dnd-dice-btn-y', false);
        let savedDiceSide = DB.get('dnd-dice-btn-side', false);
        if(savedDiceY) {
            btnToggleDice.style.top = savedDiceY; btnToggleDice.style.right = 'auto';
            if(savedDiceSide === 'left') { btnToggleDice.style.left = '0px'; diceDrawer.classList.add('drawer-left'); } 
            else { btnToggleDice.style.left = (window.innerWidth - btnToggleDice.offsetWidth) + 'px'; diceDrawer.classList.remove('drawer-left'); }
            diceDrawer.style.top = (parseInt(savedDiceY) - 20) + 'px';
        }
        window.addEventListener('resize', () => { if(diceDrawer.classList.contains('drawer-left')) return; btnToggleDice.style.left = (window.innerWidth - btnToggleDice.offsetWidth) + 'px'; });
    }

    let dicePool = [];
    const dicePoolDisplay = document.getElementById('dice-pool');
    const diceResultsDisplay = document.getElementById('dice-results');
    const diceTotalDisplay = document.getElementById('dice-total');
    const quickToast = document.getElementById('quick-roll-toast');

    document.querySelectorAll('.btn-dice').forEach(btn => { btn.addEventListener('click', (e) => { dicePool.push(parseInt(e.target.getAttribute('data-faces'))); renderDicePool(); }); });
    function renderDicePool() { if(!dicePoolDisplay) return; dicePoolDisplay.innerHTML = ''; dicePool.forEach((faces, index) => { const dieDiv = document.createElement('div'); dieDiv.className = 'die-icon'; dieDiv.textContent = `d${faces}`; dieDiv.onclick = () => { dicePool.splice(index, 1); renderDicePool(); }; dicePoolDisplay.appendChild(dieDiv); }); }

    function executeRoll(btnIdToReadModeFrom) {
        if (dicePool.length === 0) return;
        let resultsBox = document.getElementById('dice-results');
        let totalBox = document.getElementById('dice-total');

        if(resultsBox) resultsBox.innerHTML = ''; 
        if(totalBox) totalBox.innerHTML = 'Calcul...';
        let poolTotal = 0; let resultsHTML = ''; 
        let advModeNode = document.querySelector(`input[name="roll-mode"]:checked`);
        const advMode = advModeNode ? advModeNode.value : 'normal'; 

        dicePool.forEach((faces, index) => {
            let score1 = Math.floor(Math.random() * faces) + 1; let finalScore = score1; let extraHTML = '';
            if(advMode !== 'normal') {
                let score2 = Math.floor(Math.random() * faces) + 1;
                if(advMode === 'adv') { finalScore = Math.max(score1, score2); extraHTML = `<div style="font-size:0.5rem; color:var(--primary-color);">Avantage</div>`; } 
                else { finalScore = Math.min(score1, score2); extraHTML = `<div style="font-size:0.5rem; color:var(--primary-color);">Désavantage</div>`; }
            }
            poolTotal += finalScore; let colorClass = ''; if (faces === 20 && finalScore === 20) colorClass = 'crit-success'; if (faces === 20 && finalScore === 1) colorClass = 'crit-fail';
            resultsHTML += `<div class="die-result rolling ${colorClass}"><span>d${faces}</span>${finalScore}${extraHTML}</div>`;
            if (index < dicePool.length - 1) resultsHTML += `<div class="die-math">+</div>`;
        });
        if(resultsBox) resultsBox.innerHTML = resultsHTML;
        setTimeout(() => { document.querySelectorAll('.die-result').forEach(el => el.classList.remove('rolling')); if(totalBox) totalBox.innerHTML = `Total : <span class="total-number">${poolTotal}</span>`; }, 500);
        dicePool = []; renderDicePool();
    }

    if(document.getElementById('btn-roll')) document.getElementById('btn-roll').addEventListener('click', () => executeRoll('drawer'));

    document.body.addEventListener('click', (e) => {
        const el = e.target.closest('.rollable');
        if(el) {
            let name = el.getAttribute('data-name'); let targetId = el.getAttribute('data-target'); let mod = 0;
            if(targetId !== "none") { let targetEl = document.getElementById(targetId); if(targetEl) mod = parseInt(targetEl.textContent || targetEl.value) || 0; }
            let advModeNode = document.querySelector('input[name="roll-mode"]:checked');
            const advMode = advModeNode ? advModeNode.value : 'normal';
            let roll1 = Math.floor(Math.random() * 20) + 1; let finalRoll = roll1; let modeText = "";
            if(advMode === 'adv') { let roll2 = Math.floor(Math.random() * 20) + 1; finalRoll = Math.max(roll1, roll2); modeText = ` <span style="font-size:0.8rem; color:#aaa;">(Avantage)</span>`; } 
            else if (advMode === 'dis') { let roll2 = Math.floor(Math.random() * 20) + 1; finalRoll = Math.min(roll1, roll2); modeText = ` <span style="font-size:0.8rem; color:#aaa;">(Désavantage)</span>`; }
            let total = finalRoll + mod; let critText = finalRoll === 20 ? " 🟢 CRIT" : (finalRoll === 1 ? " 🔴 ÉCHEC" : ""); let modStr = mod >= 0 ? `+${mod}` : mod;
            if(quickToast) {
                quickToast.innerHTML = `${name} : ${finalRoll} ${modStr} = <span style="color:#f1c40f; font-size:2rem;">${total}</span>${critText}${modeText}`;
                quickToast.classList.remove('hidden'); quickToast.style.animation = 'none'; quickToast.offsetHeight; quickToast.style.animation = 'popUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
                setTimeout(() => { quickToast.classList.add('hidden'); }, 4000);
            }
            return;
        }
        
        const macroBtn = e.target.closest('.macro-btn');
        if(macroBtn) {
            let formula = macroBtn.getAttribute('data-formula');
            let name = macroBtn.getAttribute('data-name');
            let total = 0; let rolls = [];
            let parts = formula.replace(/\s+/g, '').split(/(?=[+-])/); 
            if(parts[0] && !parts[0].startsWith('+') && !parts[0].startsWith('-')) parts[0] = '+' + parts[0];
            
            parts.forEach(part => {
                if(!part) return;
                let sign = part.startsWith('-') ? -1 : 1; part = part.substring(1);
                if(part.includes('d')) {
                    let [count, faces] = part.split('d');
                    count = parseInt(count) || 1; faces = parseInt(faces);
                    for(let i=0; i<count; i++) {
                        let r = Math.floor(Math.random() * faces) + 1;
                        total += (r * sign); rolls.push(`${sign < 0 ? '-' : '+'}${r}`);
                    }
                } else {
                    let val = parseInt(part);
                    if(!isNaN(val)) { total += (val * sign); rolls.push(`${sign < 0 ? '-' : '+'}${val}`); }
                }
            });
            if(quickToast) {
                quickToast.innerHTML = `<span style="font-size:1rem;">${name}</span><br>= <span style="color:#f1c40f; font-size:2rem;">${total}</span> <br><span style="font-size:0.8rem; color:#ccc;">(${rolls.join(' ')})</span>`;
                quickToast.classList.remove('hidden'); quickToast.style.animation = 'none'; quickToast.offsetHeight; quickToast.style.animation = 'popUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
                setTimeout(() => { quickToast.classList.add('hidden'); }, 4500);
            }
        }
    });

    let editingAbilityIndex = -1; let editingSpellIndex = -1; let editingAttackIndex = -1; let editingInvIndex = -1;
    function moveItem(array, index, direction) { if (direction === -1 && index > 0) [array[index - 1], array[index]] = [array[index], array[index - 1]]; else if (direction === 1 && index < array.length - 1) [array[index], array[index + 1]] = [array[index + 1], array[index]]; }
    function getCrudControlsHTML(index, prefix) { return `<div class="item-controls no-print"><button title="Monter" onclick="move${prefix}Up(${index})">▲</button><button title="Descendre" onclick="move${prefix}Down(${index})">▼</button><button title="Modifier" onclick="edit${prefix}(${index})">✎</button><button title="Supprimer" class="btn-del" onclick="delete${prefix}(${index})">X</button></div>`; }
    const autoExpandTextareas = document.querySelectorAll('.auto-expand');
    function adjustHeight(el) { el.style.height = 'auto'; el.style.height = (el.scrollHeight) + 'px'; }
    window.adjustHeight = adjustHeight;
    autoExpandTextareas.forEach(textarea => { textarea.addEventListener('input', () => adjustHeight(textarea)); setTimeout(() => adjustHeight(textarea), 100); });
    document.querySelectorAll('.btn-close-modal').forEach(btn => { btn.addEventListener('click', (e) => e.target.closest('.modal-overlay').classList.add('hidden')); });

    // Note Rapide Clear
    const btnClearNote = document.getElementById('btn-clear-note');
    const quickNoteInput = document.getElementById('quick-note');
    if(btnClearNote && quickNoteInput) {
        btnClearNote.addEventListener('click', () => {
            if(confirm('Effacer la note rapide ?')) {
                quickNoteInput.value = '';
                DB.set('dnd-sheet-quick-note', '', false);
                adjustHeight(quickNoteInput);
            }
        });
    }

    const levelInput = document.getElementById('char-level');
    const profInput = document.getElementById('prof-bonus');
    const initInput = document.getElementById('initiative');
    
    if(levelInput && profInput) {
        levelInput.addEventListener('input', () => { let lvl = parseInt(levelInput.value) || 1; let prof = Math.floor((lvl - 1) / 4) + 2; profInput.value = prof; DB.set('dnd-sheet-prof-bonus', prof, false); updateStatsAndSkills(); });
    }

    const skillsMap = [
        { id: 'str', name: 'Force', skills: [{id: 'save-str', name: 'Sauvegarde', type: 'save'}, {id: 'athletics', name: 'Athlétisme'}] },
        { id: 'dex', name: 'Dextérité', skills: [{id: 'save-dex', name: 'Sauvegarde', type: 'save'}, {id: 'acrobatics', name: 'Acrobaties'}, {id: 'sleight', name: 'Escamotage'}, {id: 'stealth', name: 'Discrétion'}] },
        { id: 'con', name: 'Constitution', skills: [{id: 'save-con', name: 'Sauvegarde', type: 'save'}] },
        { id: 'int', name: 'Intelligence', skills: [{id: 'save-int', name: 'Sauvegarde', type: 'save'}, {id: 'arcana', name: 'Arcanes'}, {id: 'history', name: 'Histoire'}, {id: 'investigation', name: 'Investigation'}, {id: 'nature', name: 'Nature'}, {id: 'religion', name: 'Religion'}] },
        { id: 'wis', name: 'Sagesse', skills: [{id: 'save-wis', name: 'Sauvegarde', type: 'save'}, {id: 'animal', name: 'Dressage'}, {id: 'insight', name: 'Intuition'}, {id: 'medicine', name: 'Médecine'}, {id: 'perception', name: 'Perception'}, {id: 'survival', name: 'Survie'}] },
        { id: 'cha', name: 'Charisme', skills: [{id: 'save-cha', name: 'Sauvegarde', type: 'save'}, {id: 'deception', name: 'Tromperie'}, {id: 'intimidation', name: 'Intimidation'}, {id: 'performance', name: 'Représentation'}, {id: 'persuasion', name: 'Persuasion'}] }
    ];

    const attributesContainer = document.getElementById('attributes-list');
    if(attributesContainer) {
        skillsMap.forEach(attr => {
            let skillsHTML = attr.skills.map(skill => `<div class="skill-row ${skill.type === 'save' ? 'saving-throw' : ''}"><input type="checkbox" id="prof-${skill.id}" class="skill-prof" data-stat="${attr.id}"><span class="skill-mod" id="skill-val-${skill.id}">+0</span><label class="rollable" data-name="${skill.name}" data-target="skill-val-${skill.id}">${skill.name}</label></div>`).join('');
            attributesContainer.innerHTML += `<div class="attribute-block"><h3 class="rollable" data-name="${attr.name}" data-target="mod-${attr.id}">${attr.name}</h3><div class="stat-main-row"><div class="stat-score-circle"><input type="number" id="stat-${attr.id}" class="stat-score stat-score-input" value="10"></div><div class="stat-mod-box" id="mod-${attr.id}">+0</div></div><div class="nested-skills-list">${skillsHTML}</div></div>`;
        });
    }

    function getModifier(score) { return Math.floor((score - 10) / 2); }
    function updateAutoMagicStats() {
        const abilityEl = document.getElementById('spellcasting-ability');
        const profEl = document.getElementById('prof-bonus');
        if(!abilityEl || !profEl) return;
        const ability = abilityEl.value; const prof = parseInt(profEl.value) || 2;
        if (ability && ability !== 'none') {
            const score = parseInt(document.getElementById(`stat-${ability}`).value) || 10; const mod = getModifier(score);
            document.getElementById('spell-modifier').value = mod >= 0 ? `+${mod}` : mod; document.getElementById('spell-save-dc').value = 8 + prof + mod; document.getElementById('spell-attack-bonus').value = prof + mod;
            DB.set('dnd-sheet-spell-save-dc', 8 + prof + mod, false); DB.set('dnd-sheet-spell-attack-bonus', prof + mod, false); DB.set('dnd-sheet-spell-modifier', mod, false);
        }
    }

    function updateStatsAndSkills() {
        const profEl = document.getElementById('prof-bonus');
        if(!profEl) return;
        const profBonus = parseInt(profEl.value) || 2;
        skillsMap.forEach(attr => {
            const statEl = document.getElementById(`stat-${attr.id}`);
            const modEl = document.getElementById(`mod-${attr.id}`);
            if(statEl && modEl) {
                const score = parseInt(statEl.value) || 10; const mod = getModifier(score); modEl.textContent = mod >= 0 ? `+${mod}` : mod;
                attr.skills.forEach(skill => { const isProficient = document.getElementById(`prof-${skill.id}`).checked; const totalMod = mod + (isProficient ? profBonus : 0); document.getElementById(`skill-val-${skill.id}`).textContent = totalMod >= 0 ? `+${totalMod}` : totalMod; });
            }
        });
        updateAutoMagicStats();
    }

    const statDex = document.getElementById('stat-dex');
    if(statDex && initInput) { statDex.addEventListener('change', () => { const dexScore = parseInt(statDex.value) || 10; initInput.value = getModifier(dexScore); DB.set('dnd-sheet-initiative', initInput.value, false); }); }
    document.body.addEventListener('input', (e) => { if(e.target.classList.contains('stat-score') || e.target.classList.contains('skill-prof')) updateStatsAndSkills(); });
    document.body.addEventListener('change', (e) => { if(e.target.classList.contains('stat-score') || e.target.classList.contains('skill-prof')) updateStatsAndSkills(); });
    
    const spellCastingAbility = document.getElementById('spellcasting-ability');
    if(spellCastingAbility) spellCastingAbility.addEventListener('change', () => { DB.set('dnd-sheet-spellcasting-ability', spellCastingAbility.value, false); updateAutoMagicStats(); });

    // États Personnalisés
    let customConditions = getStore('dnd-custom-conditions') || [];
    const customCondContainer = document.getElementById('custom-conditions-container');
    const customCondInput = document.getElementById('input-custom-condition');
    const btnAddCustomCond = document.getElementById('btn-add-custom-condition');

    function renderCustomConditions() {
        if(!customCondContainer) return;
        customCondContainer.innerHTML = '';
        customConditions.forEach((cond, i) => {
            customCondContainer.innerHTML += `
                <div style="display:flex; align-items:center; gap:5px; margin-bottom:4px; background:rgba(255,255,255,0.7); padding:4px 8px; border-radius:4px; border:1px dashed #c4b487;">
                    <input type="checkbox" id="custom-cond-${i}" ${cond.active ? 'checked' : ''} onchange="toggleCustomCond(${i})" style="transform:scale(1.2); cursor:pointer;">
                    <label style="flex:1; cursor:pointer; font-weight:bold; color:var(--text-color);" for="custom-cond-${i}">${cond.name}</label>
                    <span style="color:#e74c3c; cursor:pointer; font-weight:bold; padding:0 5px;" onclick="deleteCustomCond(${i})">X</span>
                </div>
            `;
        });
    }
    if(btnAddCustomCond && customCondInput) {
        btnAddCustomCond.addEventListener('click', () => {
            let val = customCondInput.value.trim();
            if(val) { customConditions.push({name: val, active: false}); setStore('dnd-custom-conditions', customConditions); customCondInput.value = ''; renderCustomConditions(); }
        });
    }
    window.toggleCustomCond = (i) => { customConditions[i].active = !customConditions[i].active; setStore('dnd-custom-conditions', customConditions); };
    window.deleteCustomCond = (i) => { customConditions.splice(i, 1); setStore('dnd-custom-conditions', customConditions); renderCustomConditions(); };

    function updateHpVisuals() {
        const hpCurrentInput = document.getElementById('hp-current');
        const hpMaxInput = document.getElementById('hp-max');
        if(!hpCurrentInput || !hpMaxInput) return;
        const current = parseInt(hpCurrentInput.value) || 0;
        const max = parseInt(hpMaxInput.value) || 1;
        const block = document.querySelector('.health-block');
        if(!block) return;
        
        const ratio = current / max;
        if(ratio > 0.5) { block.style.borderColor = '#2ecc71'; block.style.boxShadow = '0 0 10px rgba(46, 204, 113, 0.2)'; } 
        else if (ratio > 0.25) { block.style.borderColor = '#f1c40f'; block.style.boxShadow = '0 0 10px rgba(241, 196, 15, 0.2)'; } 
        else { block.style.borderColor = '#e74c3c'; block.style.boxShadow = '0 0 10px rgba(231, 76, 60, 0.3)'; }
    }

    function createDefaultSpellSlotLevel() { return { total: 0, used: [], regenMode: 'long', shortType: 'all', shortAmount: 1, longType: 'all', longAmount: 1 }; }
    function normalizeSpellSlotsData(rawData) { return Array.from({length: 9}, (_, lvl) => { const base = createDefaultSpellSlotLevel(); const old = Array.isArray(rawData) ? rawData[lvl] : null; if(old && typeof old === 'object') { base.total = Math.max(0, Math.min(9, parseInt(old.total) || 0)); base.used = Array.isArray(old.used) ? old.used.slice(0, base.total).map(Boolean) : []; base.regenMode = old.regenMode || 'long'; base.shortType = old.shortType || 'all'; base.shortAmount = Math.max(1, parseInt(old.shortAmount) || 1); base.longType = old.longType || 'all'; base.longAmount = Math.max(1, parseInt(old.longAmount) || 1); } while(base.used.length < base.total) base.used.push(false); base.used = base.used.slice(0, base.total); return base; }); }
    let spellSlotsData = normalizeSpellSlotsData(getStore('dnd-spell-slots')); setStore('dnd-spell-slots', spellSlotsData);

    function formatRecoverAmount(type, amount) { return type === 'all' ? 'Tout' : `+${amount}`; }
    function getSpellSlotRegenText(data) { if(data.regenMode === 'none') return 'Aucune régénération'; if(data.regenMode === 'short_long') return `Court: ${formatRecoverAmount(data.shortType, data.shortAmount)} | Long: ${formatRecoverAmount(data.longType, data.longAmount)}`; return `Long: ${formatRecoverAmount(data.longType, data.longAmount)}`; }

    function renderSpellSlots() {
        const container = document.getElementById('spell-slots-grid'); if(!container) return; container.innerHTML = '';
        const activeLevels = spellSlotsData.map((data, lvl) => ({ data, lvl })).filter(entry => entry.data.total > 0);
        if(activeLevels.length === 0) { container.innerHTML = `<div class="spell-slot-empty">Aucun emplacement configuré.</div>`; return; }
        activeLevels.forEach(({ data, lvl }) => {
            const usedCount = data.used.filter(Boolean).length; const available = Math.max(0, data.total - usedCount); let cbHtml = ''; for(let i=0; i<data.total; i++) cbHtml += `<input type="checkbox" class="slot-check" data-lvl="${lvl}" data-index="${i}" ${data.used[i]?'checked':''} title="Dépensé">`;
            container.innerHTML += `<div class="spell-slot-row"><div class="slot-lvl-label">Niveau ${lvl + 1}</div><div class="slot-main-content"><div class="slot-checkboxes">${cbHtml}</div><div class="slot-info">${available}/${data.total} dispos • ${getSpellSlotRegenText(data)}</div></div></div>`;
        });
        document.querySelectorAll('.slot-check').forEach(cb => { cb.addEventListener('change', (e) => { spellSlotsData[parseInt(e.target.dataset.lvl)].used[parseInt(e.target.dataset.index)] = e.target.checked; setStore('dnd-spell-slots', spellSlotsData); renderSpellSlots(); }); });
    }

    document.body.addEventListener('click', (e) => { 
        if(e.target.id === 'btn-open-spell-slots-modal') {
            const list = document.getElementById('spell-slots-config-list'); if(!list) return; list.innerHTML = '';
            spellSlotsData.forEach((data, lvl) => {
                list.innerHTML += `<div class="spell-slot-config-row ${data.total === 0 ? 'is-empty' : ''}" data-lvl="${lvl}"><div class="spell-slot-config-head"><div class="spell-slot-level-badge">Niv. ${lvl + 1}</div><label class="spell-slot-mini-field">Emplacements<input type="number" class="spell-config-total" min="0" max="9" value="${data.total}"></label><label class="spell-slot-mini-field spell-slot-regen-field">Récupération<select class="spell-config-regen-mode"><option value="none" ${data.regenMode === 'none' ? 'selected' : ''}>Aucune</option><option value="long" ${data.regenMode === 'long' ? 'selected' : ''}>Repos long</option><option value="short_long" ${data.regenMode === 'short_long' ? 'selected' : ''}>Repos court + long</option></select></label></div><div class="spell-slot-config-details"><div class="spell-recovery-pill spell-config-short-block hidden"><span>Court</span><select class="spell-config-short-type"><option value="all" ${data.shortType === 'all' ? 'selected' : ''}>Tout</option><option value="fixed" ${data.shortType === 'fixed' ? 'selected' : ''}>Partiel</option></select><input type="number" class="spell-config-short-amount hidden" min="1" value="${data.shortAmount}" placeholder="Nb"></div><div class="spell-recovery-pill spell-config-long-block"><span>Long</span><select class="spell-config-long-type"><option value="all" ${data.longType === 'all' ? 'selected' : ''}>Tout</option><option value="fixed" ${data.longType === 'fixed' ? 'selected' : ''}>Partiel</option></select><input type="number" class="spell-config-long-amount hidden" min="1" value="${data.longAmount}" placeholder="Nb"></div></div></div>`;
            });
            document.querySelectorAll('.spell-slot-config-row').forEach(row => { 
                const updateVisibility = () => {
                    const total = Math.max(0, parseInt(row.querySelector('.spell-config-total').value) || 0); const mode = row.querySelector('.spell-config-regen-mode').value;
                    row.classList.toggle('is-empty', total === 0); row.querySelector('.spell-slot-config-details').classList.toggle('hidden', total === 0 || mode === 'none'); row.querySelector('.spell-config-short-block').classList.toggle('hidden', total === 0 || mode !== 'short_long'); row.querySelector('.spell-config-long-block').classList.toggle('hidden', total === 0 || mode === 'none'); row.querySelector('.spell-config-short-amount').classList.toggle('hidden', row.querySelector('.spell-config-short-type').value === 'all'); row.querySelector('.spell-config-long-amount').classList.toggle('hidden', row.querySelector('.spell-config-long-type').value === 'all');
                };
                updateVisibility(); row.querySelectorAll('select, input').forEach(el => { el.addEventListener('input', updateVisibility); }); 
            });
            document.getElementById('spell-slots-modal').classList.remove('hidden');
        }
    });

    const btnSaveSpellSlots = document.getElementById('btn-save-spell-slots-config');
    if(btnSaveSpellSlots) {
        btnSaveSpellSlots.addEventListener('click', () => {
            document.querySelectorAll('.spell-slot-config-row').forEach(row => {
                const lvl = parseInt(row.dataset.lvl); const total = Math.max(0, Math.min(9, parseInt(row.querySelector('.spell-config-total').value) || 0));
                spellSlotsData[lvl] = { total: total, used: (spellSlotsData[lvl].used || []).slice(0, total), regenMode: row.querySelector('.spell-config-regen-mode').value, shortType: row.querySelector('.spell-config-short-type').value, shortAmount: Math.max(1, parseInt(row.querySelector('.spell-config-short-amount').value) || 1), longType: row.querySelector('.spell-config-long-type').value, longAmount: Math.max(1, parseInt(row.querySelector('.spell-config-long-amount').value) || 1) };
                while(spellSlotsData[lvl].used.length < total) spellSlotsData[lvl].used.push(false);
            });
            setStore('dnd-spell-slots', spellSlotsData); renderSpellSlots(); document.getElementById('spell-slots-modal').classList.add('hidden');
        });
    }

    function recoverSpellSlotsByRest(restType) { let recovered = 0; spellSlotsData.forEach(data => { if(data.regenMode === 'none' || (restType === 'short' && data.regenMode !== 'short_long')) return; const recoverType = restType === 'short' ? data.shortType : data.longType; const recoverAmount = recoverType === 'all' ? data.total : (restType === 'short' ? data.shortAmount : data.longAmount); let r = 0; for(let i = data.total - 1; i >= 0 && r < recoverAmount; i--) { if(data.used[i]) { data.used[i] = false; r++; recovered++; } } }); setStore('dnd-spell-slots', spellSlotsData); renderSpellSlots(); return recovered; }

    const restModal = document.getElementById('rest-modal'); 
    const restShortContent = document.getElementById('rest-short-content'); 
    const restLongContent = document.getElementById('rest-long-content'); 
    const restHdAvailable = document.getElementById('rest-hd-available'); 
    const restHdMaxDisplay = document.getElementById('rest-hd-max-display'); 
    const restHdSizeDisplay = document.getElementById('rest-hd-size-display'); 
    const restConModDisplay = document.getElementById('rest-con-mod'); 
    const restHpStatus = document.getElementById('rest-hp-status'); 
    const restRollResult = document.getElementById('rest-roll-result'); 
    const btnRollHitDie = document.getElementById('btn-roll-hit-die'); 
    let shortRestRollLog = [];

    if(document.getElementById('btn-close-rest')) document.getElementById('btn-close-rest').addEventListener('click', () => { restModal.classList.add('hidden'); });
    function getConstitutionModifierForRest() { return Math.floor(((parseInt(document.getElementById('stat-con').value) || 10) - 10) / 2); }
    
    function updateShortRestPanel() { 
        if(!restHdAvailable) return;
        const hdMax = parseInt(document.getElementById('hd-max').value) || 0; const hdSpent = parseInt(document.getElementById('hd-spent').value) || 0; const available = Math.max(0, hdMax - hdSpent); const hdSize = parseInt(document.getElementById('hd-size').value) || 8; const conMod = getConstitutionModifierForRest(); const currentHp = parseInt(document.getElementById('hp-current').value) || 0; const maxHp = parseInt(document.getElementById('hp-max').value) || 0; 
        restHdAvailable.textContent = available; restHdMaxDisplay.textContent = hdMax; restHdSizeDisplay.textContent = `d${hdSize}`; restConModDisplay.textContent = conMod >= 0 ? `+${conMod}` : `${conMod}`; restHpStatus.textContent = `${currentHp} / ${maxHp}`; 
        btnRollHitDie.disabled = available <= 0; document.getElementById('rest-hd-to-roll').max = available;
    }

    function recoverAbilitiesByRest(restType) { let recovered = 0; abilities.forEach(ab => { if(restType === 'short' && ab.regenMode !== 'short_long') return; const recoverType = restType === 'short' ? ab.shortType : ab.longType; const recoverAmount = recoverType === 'all' ? ab.max : (restType === 'short' ? (ab.shortAmount || 1) : (ab.longAmount || 1)); let count = 0; for(let i = ab.max - 1; i >= 0 && count < recoverAmount; i--) { if(ab.used[i]) { ab.used[i] = false; count++; recovered++; } } }); setStore('dnd-abilities', abilities); renderAbilities(); return recovered; }
    
    document.body.addEventListener('click', (e) => {
        if(e.target.id === 'btn-short-rest') { document.getElementById('rest-modal-title').innerText = "Repos Court"; restLongContent.classList.add('hidden'); restShortContent.classList.remove('hidden'); shortRestRollLog = []; restRollResult.innerHTML = ``; document.getElementById('rest-hd-to-roll').value = 1; updateShortRestPanel(); restModal.classList.remove('hidden'); }
        if(e.target.id === 'btn-long-rest') { document.getElementById('rest-modal-title').innerText = "Repos Long"; restShortContent.classList.add('hidden'); restLongContent.classList.remove('hidden'); restModal.classList.remove('hidden'); }
    });

    if(btnRollHitDie) {
        btnRollHitDie.addEventListener('click', () => { 
            const hdMax = parseInt(document.getElementById('hd-max').value) || 0; let hdSpent = parseInt(document.getElementById('hd-spent').value) || 0; const available = Math.max(0, hdMax - hdSpent); if(available <= 0) return; 
            let amountToRoll = parseInt(document.getElementById('rest-hd-to-roll').value) || 1; if(amountToRoll > available) amountToRoll = available; if(amountToRoll <= 0) return;
            const hdSize = parseInt(document.getElementById('hd-size').value) || 8; const conMod = getConstitutionModifierForRest(); const conText = conMod >= 0 ? `+${conMod}` : `${conMod}`; 
            
            let totalHealed = 0; let rollDetails = [];
            for(let i=0; i < amountToRoll; i++) { const roll = Math.floor(Math.random() * hdSize) + 1; const healed = Math.max(0, roll + conMod); totalHealed += healed; rollDetails.push(`[${roll}${conText}=${healed}]`); }
            const currentHp = parseInt(document.getElementById('hp-current').value) || 0; const maxHp = parseInt(document.getElementById('hp-max').value) || 0; const newHp = Math.min(maxHp, currentHp + totalHealed); 
            
            hdSpent += amountToRoll; document.getElementById('hd-spent').value = hdSpent; DB.set('dnd-sheet-hd-spent', hdSpent, false); document.getElementById('hp-current').value = newHp; DB.set('dnd-sheet-hp-current', newHp, false); 
            shortRestRollLog.push(`<strong>${amountToRoll}d${hdSize}</strong> : ${rollDetails.join(' + ')} ➔ <span style="color:#2ecc71;">+${totalHealed} PV</span>`); 
            restRollResult.innerHTML = `<p class="rest-log-line" style="font-size:1.2rem;"><strong>Lancé (${amountToRoll} dés) :</strong> ➔ <strong>+${totalHealed} PV</strong></p><p class="rest-log-line">PV : ${currentHp} → ${newHp}</p><div class="rest-roll-history" style="margin-top:10px; border-top:1px dashed var(--primary-color); padding-top:10px;"><strong>Historique :</strong><br>${shortRestRollLog.join('<br>')}</div>`; 
            document.getElementById('rest-hd-to-roll').value = 1; updateShortRestPanel(); updateHpVisuals();
        });
    }

    if(document.getElementById('btn-confirm-short-rest')) document.getElementById('btn-confirm-short-rest').addEventListener('click', () => { recoverAbilitiesByRest('short'); recoverSpellSlotsByRest('short'); restModal.classList.add('hidden'); });
    if(document.getElementById('btn-confirm-long-rest')) document.getElementById('btn-confirm-long-rest').addEventListener('click', () => { if((parseInt(document.getElementById('hp-current').value) || 0) < 1) { alert("Tu dois avoir au moins 1 PV pour un repos long."); return; } const maxHp = parseInt(document.getElementById('hp-max').value) || 0; if(maxHp > 0) { document.getElementById('hp-current').value = maxHp; DB.set('dnd-sheet-hp-current', maxHp, false); } const hdMax = parseInt(document.getElementById('hd-max').value) || 1; const hdSpent = parseInt(document.getElementById('hd-spent').value) || 0; const newSpent = Math.max(0, hdSpent - Math.max(1, Math.floor(hdMax / 2))); document.getElementById('hd-spent').value = newSpent; DB.set('dnd-sheet-hd-spent', newSpent, false); recoverSpellSlotsByRest('long'); recoverAbilitiesByRest('long'); updateHpVisuals(); restModal.classList.add('hidden'); alert("Repos Long terminé !"); });

    // MACROS ET INITIATIVE
    let macros = getStore('dnd-macros') || [];
    function renderMacros() { const list = document.getElementById('macro-list'); if(!list) return; list.innerHTML = ''; if(macros.length === 0) list.innerHTML = `<span style="font-size:0.8rem; color:#888; font-style:italic;">Aucune macro. (Ex: 1d8+3)</span>`; macros.forEach((m, i) => { list.innerHTML += `<div class="macro-pill"><button class="macro-btn" data-formula="${m.formula}" data-name="${m.name}" title="${m.formula}">${m.name}</button><span class="macro-del" onclick="deleteMacro(${i})">x</span></div>`; }); }
    document.body.addEventListener('click', (e) => { if(e.target.id === 'btn-add-macro') { const name = document.getElementById('macro-name').value.trim(); const formula = document.getElementById('macro-formula').value.trim(); if(name && formula) { macros.push({name, formula}); setStore('dnd-macros', macros); renderMacros(); document.getElementById('macro-name').value=''; document.getElementById('macro-formula').value=''; } } });
    window.deleteMacro = (i) => { macros.splice(i, 1); setStore('dnd-macros', macros); renderMacros(); };

    let initiativeTracker = getStore('dnd-initiative-tracker') || [];
    let activeInitIndex = getStore('dnd-initiative-active') || -1;
    function renderInitiativeTracker() { const list = document.getElementById('init-tracker-list'); if(!list) return; list.innerHTML = ''; if(initiativeTracker.length === 0) list.innerHTML = `<span style="font-size:0.8rem; color:#888; font-style:italic;">Aucun combattant.</span>`; initiativeTracker.forEach((c, i) => { let activeClass = i === activeInitIndex ? 'active-turn' : ''; list.innerHTML += `<div class="init-item ${activeClass}"><span class="init-score">${c.score}</span><span style="flex:1; font-weight:bold;">${c.name}</span><span style="font-size:0.8rem; margin-right:10px;">❤️ ${c.hp}</span><span class="init-del no-print" onclick="deleteInit(${i})">X</span></div>`; }); }
    document.body.addEventListener('click', (e) => {
        if(e.target.id === 'btn-init-add') { const name = document.getElementById('init-add-name').value.trim(); const score = parseInt(document.getElementById('init-add-score').value) || 0; const hp = document.getElementById('init-add-hp').value.trim() || "-"; if(name) { initiativeTracker.push({name, score, hp}); initiativeTracker.sort((a,b) => b.score - a.score); setStore('dnd-initiative-tracker', initiativeTracker); renderInitiativeTracker(); document.getElementById('init-add-name').value=''; document.getElementById('init-add-score').value=''; document.getElementById('init-add-hp').value=''; } }
        if(e.target.id === 'btn-init-next') { if(initiativeTracker.length === 0) return; activeInitIndex++; if(activeInitIndex >= initiativeTracker.length) activeInitIndex = 0; DB.set('dnd-initiative-active', activeInitIndex, false); renderInitiativeTracker(); }
        if(e.target.id === 'btn-init-clear') { if(confirm("Vider le tracker ?")) { initiativeTracker = []; activeInitIndex = -1; setStore('dnd-initiative-tracker', initiativeTracker); DB.set('dnd-initiative-active', activeInitIndex, false); renderInitiativeTracker(); } }
    });
    window.deleteInit = (i) => { initiativeTracker.splice(i, 1); if(activeInitIndex >= initiativeTracker.length) activeInitIndex = 0; if(initiativeTracker.length === 0) activeInitIndex = -1; setStore('dnd-initiative-tracker', initiativeTracker); DB.set('dnd-initiative-active', activeInitIndex, false); renderInitiativeTracker(); };

    // SORTS ET GRIMOIRE
    let spells = getStore('dnd-spells') || [];
    function renderPinnedSpells() { const list = document.getElementById('spells-list'); if(!list) return; list.innerHTML = ''; spells.forEach((sp, index) => { if(!sp.pinned) return; list.innerHTML += `<div class="item-card spell-card"><div class="item-card-header"><h4>Niv.${sp.level||0} - ${sp.name}</h4><div class="item-controls no-print"><button title="Monter" onclick="moveSpellUp(${index})">▲</button><button title="Descendre" onclick="moveSpellDown(${index})">▼</button><button class="btn-pin pinned" onclick="togglePin(${index})">📍</button></div></div><div class="item-details"><span>⏱️ ${sp.time}</span><span>📏 ${sp.range}</span><span>💎 ${sp.res}</span></div><p><em>${sp.desc}</em></p>${sp.notes ? `<p><small>📝 ${sp.notes}</small></p>` : ''}</div>`; }); }
    function renderGrimoire() { const content = document.getElementById('grimoire-content'); if(!content) return; content.innerHTML = ''; let grouped = {}; spells.forEach((sp, index) => { let lvl = parseInt(sp.level) || 0; if(!grouped[lvl]) grouped[lvl] = []; grouped[lvl].push({ ...sp, originalIndex: index }); }); let levels = Object.keys(grouped).sort((a,b) => a - b); levels.forEach(lvl => { let sortedSpells = grouped[lvl].sort((a,b) => a.name.localeCompare(b.name)); let lvlHtml = `<div class="spell-level-group"><h3 class="spell-level-title">Niveau ${lvl} ${lvl == 0 ? '(Tours de magie)' : ''}</h3>`; sortedSpells.forEach(sp => { let pinClass = sp.pinned ? 'pinned' : ''; let pinText = sp.pinned ? '📍 Épinglé' : '📌 Épingler'; lvlHtml += `<div class="item-card spell-card"><div class="item-card-header"><h4>${sp.name}</h4><div class="item-controls"><button class="btn-pin ${pinClass}" onclick="togglePin(${sp.originalIndex})">${pinText}</button><button title="Modifier" onclick="editSpell(${sp.originalIndex})">✎</button><button title="Supprimer" class="btn-del" onclick="deleteSpell(${sp.originalIndex})">X</button></div></div><div class="item-details"><span>⏱️ ${sp.time}</span><span>📏 ${sp.range}</span><span>💎 ${sp.res}</span></div><p><em>${sp.desc}</em></p>${sp.notes ? `<p><small>📝 ${sp.notes}</small></p>` : ''}</div>`; }); lvlHtml += `</div>`; content.innerHTML += lvlHtml; }); if(levels.length === 0) content.innerHTML = "<p style='text-align:center;'>Le grimoire est vide.</p>"; }
    const spellModal = document.getElementById('spell-form-modal');
    document.body.addEventListener('click', (e) => { if(e.target.id === 'btn-open-spell-add') { editingSpellIndex = -1; document.getElementById('spell-modal-title').textContent = "Inscrire un Sort"; document.querySelectorAll('#spell-form-modal input[type="text"], #spell-form-modal input[type="number"], #spell-form-modal textarea').forEach(i => i.value = ''); spellModal.classList.remove('hidden'); }});
    if(document.getElementById('btn-add-spell')) { document.getElementById('btn-add-spell').addEventListener('click', () => { const sp = { name: document.getElementById('new-spell-name').value, level: document.getElementById('new-spell-level').value || 0, time: document.getElementById('new-spell-time').value, range: document.getElementById('new-spell-range').value, res: document.getElementById('new-spell-res').value, desc: document.getElementById('new-spell-desc').value, notes: document.getElementById('new-spell-notes').value, pinned: document.getElementById('new-spell-pinned').checked }; if(sp.name) { if(editingSpellIndex >= 0) { spells[editingSpellIndex] = sp; } else { spells.push(sp); } setStore('dnd-spells', spells); renderPinnedSpells(); renderGrimoire(); spellModal.classList.add('hidden'); } }); }
    window.togglePin = (index) => { spells[index].pinned = !spells[index].pinned; setStore('dnd-spells', spells); renderPinnedSpells(); renderGrimoire(); }; window.deleteSpell = (index) => { if(confirm("Oublier ce sort ?")) { spells.splice(index, 1); setStore('dnd-spells', spells); renderPinnedSpells(); renderGrimoire(); }}; window.moveSpellUp = (index) => { let prevIndex = -1; for(let i = index - 1; i >= 0; i--) { if(spells[i].pinned) { prevIndex = i; break; } } if(prevIndex !== -1) { [spells[prevIndex], spells[index]] = [spells[index], spells[prevIndex]]; setStore('dnd-spells', spells); renderPinnedSpells(); }}; window.moveSpellDown = (index) => { let nextIndex = -1; for(let i = index + 1; i < spells.length; i++) { if(spells[i].pinned) { nextIndex = i; break; } } if(nextIndex !== -1) { [spells[nextIndex], spells[index]] = [spells[index], spells[nextIndex]]; setStore('dnd-spells', spells); renderPinnedSpells(); }}; window.editSpell = (index) => { const data = spells[index]; document.getElementById('new-spell-name').value = data.name; document.getElementById('new-spell-level').value = data.level; document.getElementById('new-spell-time').value = data.time; document.getElementById('new-spell-range').value = data.range; document.getElementById('new-spell-res').value = data.res; document.getElementById('new-spell-desc').value = data.desc; document.getElementById('new-spell-notes').value = data.notes; document.getElementById('new-spell-pinned').checked = data.pinned; editingSpellIndex = index; document.getElementById('spell-modal-title').textContent = "Modifier le Sort"; spellModal.classList.remove('hidden'); };
    const grimoireModal = document.getElementById('grimoire-modal');
    document.body.addEventListener('click', (e) => { if(e.target.id === 'btn-open-grimoire') { renderGrimoire(); grimoireModal.classList.remove('hidden', 'closing'); grimoireModal.classList.add('opening'); } });
    if(document.getElementById('btn-close-grimoire')) document.getElementById('btn-close-grimoire').addEventListener('click', () => { grimoireModal.classList.remove('opening'); grimoireModal.classList.add('closing'); setTimeout(() => { grimoireModal.classList.add('hidden'); }, 550); });

    // JOURNAL AVEC ÉDITION
    let journal = getStore('dnd-journal') || [];
    const journalPage = document.getElementById('book-page-content');
    window.renderJournalTOC = () => { if(!journalPage) return; let html = `<h2 class="toc-title">Sommaire</h2><div class="toc-list">`; if(journal.length === 0) html += `<p style="text-align:center;">Aucune note dans le journal. Écris un chapitre !</p>`; journal.forEach((entry, i) => { html += `<div class="toc-item"><div class="toc-link" onclick="openJournalEntry(${i})"><span class="toc-title-text">${entry.title}</span><div class="toc-dots"></div></div><div class="toc-controls"><span title="Déchirer la page" onclick="deleteJournalEntry(${i})">❌</span></div></div>`; }); html += `</div>`; journalPage.innerHTML = html; };
    
    window.openJournalEntry = (index) => { 
        const entry = journal[index]; 
        journalPage.innerHTML = `
            <div class="bookmark-return" onclick="renderJournalTOC()" title="Retour au sommaire">🔖</div>
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-top:20px;">
                <h2 class="note-view-title" style="margin-top:0;">${entry.title}</h2>
                <button class="btn-small no-print" style="background:var(--primary-color);" onclick="editJournalForm(${index})">✎ Modifier</button>
            </div>
            <div class="note-view-content" id="view-journal-content">${entry.content}</div>
            
            <div id="journal-edit-container" class="hidden" style="margin-top: 20px; border-top: 2px dashed #c4b487; padding-top: 15px;">
                <h3 style="font-family:'Cinzel'; color:var(--primary-color); margin-bottom:10px;">Modifier le chapitre</h3>
                <input type="text" id="edit-journal-title" style="width:100%; margin-bottom:10px; font-weight:bold; font-size:1.1rem; border:1px solid #c4b487; padding:8px;">
                <textarea id="edit-journal-content" class="auto-expand" style="width:100%; min-height:200px; border:1px solid #c4b487; padding:10px;"></textarea>
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button id="btn-confirm-edit-journal" class="btn-small" style="background:#27ae60;">Sauvegarder</button>
                    <button id="btn-cancel-edit-journal" class="btn-small" style="background:#e74c3c;">Annuler</button>
                </div>
            </div>
        `; 
    };

    window.editJournalForm = (index) => {
        const entry = journal[index];
        document.getElementById('view-journal-content').classList.add('hidden');
        document.getElementById('journal-edit-container').classList.remove('hidden');
        
        document.getElementById('edit-journal-title').value = entry.title;
        const ta = document.getElementById('edit-journal-content');
        ta.value = entry.content;
        setTimeout(() => adjustHeight(ta), 50);

        document.getElementById('btn-confirm-edit-journal').onclick = () => {
            journal[index].title = document.getElementById('edit-journal-title').value.trim();
            journal[index].content = document.getElementById('edit-journal-content').value.trim();
            setStore('dnd-journal', journal);
            openJournalEntry(index);
        };
        document.getElementById('btn-cancel-edit-journal').onclick = () => {
            openJournalEntry(index);
        };
    };

    window.deleteJournalEntry = (index) => { if(confirm("Déchirer cette page définitivement ?")) { journal.splice(index, 1); setStore('dnd-journal', journal); renderJournalTOC(); } };
    if(document.getElementById('btn-save-journal')) { document.getElementById('btn-save-journal').addEventListener('click', () => { const title = document.getElementById('new-journal-title').value.trim(); const content = document.getElementById('new-journal-content').value.trim(); if(title && content) { journal.push({title, content}); setStore('dnd-journal', journal); document.getElementById('new-journal-title').value = ''; document.getElementById('new-journal-content').value = ''; alert("Chapitre enregistré dans le journal !"); } }); }
    document.body.addEventListener('click', (e) => { if(e.target.id === 'btn-open-journal') { const modal = document.getElementById('journal-modal'); modal.classList.remove('hidden', 'book-burning'); modal.classList.add('book-opening'); renderJournalTOC(); } if(e.target.id === 'btn-lighter-close') { const modal = document.getElementById('journal-modal'); modal.classList.remove('book-opening'); modal.classList.add('book-burning'); setTimeout(() => modal.classList.add('hidden'), 1500); } });

    // ATTAQUES
    let attacks = getStore('dnd-attacks') || [];
    const atkModal = document.getElementById('attack-form-modal');
    function renderAttacks() { const list = document.getElementById('attacks-list'); if(!list) return; list.innerHTML = ''; attacks.forEach((atk, index) => { let attuneHtml = atk.reqAttune ? `<div class="attune-check" title="Objet Lié ?"><input type="checkbox" ${atk.isAttuned ? 'checked' : ''} onchange="toggleAttune(${index})"><label>Lié</label></div>` : ''; list.innerHTML += `<div class="item-card atk-card"><div class="item-card-header"><div style="display:flex; align-items:center; gap:10px;"><h4>⚔️ ${atk.name}</h4>${attuneHtml}</div>${getCrudControlsHTML(index, 'Attack')}</div><div class="item-details"><span><strong>Bonus:</strong> ${atk.bonus}</span><span><strong>Dégâts:</strong> ${atk.dmg}</span></div>${atk.notes ? `<p><small>📝 ${atk.notes}</small></p>` : ''}</div>`; }); }
    document.body.addEventListener('click', (e) => { if(e.target.id === 'btn-open-attack-modal') { editingAttackIndex = -1; atkModal.classList.remove('hidden'); document.querySelectorAll('#attack-form-modal input[type="text"]').forEach(i => i.value = ''); document.getElementById('new-atk-req-attune').checked = false; }});
    if(document.getElementById('btn-save-atk')) { document.getElementById('btn-save-atk').addEventListener('click', () => { const atk = { name: document.getElementById('new-atk-name').value, bonus: document.getElementById('new-atk-bonus').value, dmg: document.getElementById('new-atk-dmg').value, notes: document.getElementById('new-atk-notes').value, reqAttune: document.getElementById('new-atk-req-attune').checked, isAttuned: false }; if(atk.name) { if(editingAttackIndex >= 0) { atk.isAttuned = attacks[editingAttackIndex].isAttuned; attacks[editingAttackIndex] = atk; } else { attacks.push(atk); } setStore('dnd-attacks', attacks); renderAttacks(); atkModal.classList.add('hidden'); } }); }
    window.toggleAttune = (index) => { attacks[index].isAttuned = !attacks[index].isAttuned; setStore('dnd-attacks', attacks); }; window.deleteAttack = (index) => { if(confirm("Supprimer ?")) { attacks.splice(index, 1); setStore('dnd-attacks', attacks); renderAttacks(); }}; window.moveAttackUp = (index) => { moveItem(attacks, index, -1); setStore('dnd-attacks', attacks); renderAttacks(); }; window.moveAttackDown = (index) => { moveItem(attacks, index, 1); setStore('dnd-attacks', attacks); renderAttacks(); }; window.editAttack = (index) => { const data = attacks[index]; document.getElementById('new-atk-name').value = data.name; document.getElementById('new-atk-bonus').value = data.bonus; document.getElementById('new-atk-dmg').value = data.dmg; document.getElementById('new-atk-notes').value = data.notes; document.getElementById('new-atk-req-attune').checked = data.reqAttune; editingAttackIndex = index; atkModal.classList.remove('hidden'); };

    // INVENTAIRE
    let inventory = getStore('dnd-inventory') || [];
    const invModal = document.getElementById('inventory-modal');
    function renderInventory() { const listMain = document.getElementById('pinned-inventory-list'); const listFull = document.getElementById('inventory-full-list'); if(!listMain || !listFull) return; listMain.innerHTML = ''; listFull.innerHTML = ''; let totalWeight = 0; inventory.forEach((item, index) => { let pinClass = item.pinned ? 'pinned' : ''; let w = parseFloat(item.weight); let q = parseInt(item.qty) || 1; if(!isNaN(w)) totalWeight += (w * q); listFull.innerHTML += `<div class="item-card"><div class="item-card-header"><h4>${item.name} (x${item.qty})</h4><div class="item-controls no-print"><button title="Modifier" onclick="editInv(${index})">✎</button><button class="btn-pin ${pinClass}" onclick="toggleInvPin(${index})">📍</button><button class="btn-del" onclick="deleteInv(${index})">X</button></div></div><div class="item-details"><span style="color:#888;">Poids: ${item.weight}</span></div></div>`; if(item.pinned) listMain.innerHTML += `<div class="item-card"><div class="item-card-header"><h4>${item.name} (x${item.qty})</h4><div class="item-controls no-print"><button title="Monter" onclick="moveInvUp(${index})">▲</button><button title="Descendre" onclick="moveInvDown(${index})">▼</button><button title="Modifier" onclick="editInv(${index})">✎</button><button class="btn-pin ${pinClass}" onclick="toggleInvPin(${index})">📍</button></div></div><div class="item-details"><span style="color:#888;">Poids: ${item.weight}</span></div></div>`; }); const weightDisplay = document.getElementById('inv-total-weight'); if(weightDisplay) weightDisplay.textContent = (totalWeight % 1 !== 0) ? totalWeight.toFixed(2) : totalWeight; }
    document.body.addEventListener('click', (e) => { if(e.target.id === 'btn-open-inventory') { invModal.classList.remove('hidden'); renderInventory(); }});
    if(document.getElementById('btn-add-inventory')) { document.getElementById('btn-add-inventory').addEventListener('click', () => { let name = document.getElementById('inv-name').value; if(name) { inventory.push({ name: name, qty: document.getElementById('inv-qty').value || 1, weight: document.getElementById('inv-weight').value || "-", pinned: false }); setStore('dnd-inventory', inventory); renderInventory(); document.querySelectorAll('#inventory-modal input').forEach(i => i.value = ''); } }); }
    window.toggleInvPin = (index) => { inventory[index].pinned = !inventory[index].pinned; setStore('dnd-inventory', inventory); renderInventory(); }; window.deleteInv = (index) => { if(confirm("Jeter ?")) { inventory.splice(index, 1); setStore('dnd-inventory', inventory); renderInventory(); }}; window.moveInvUp = (index) => { let prevIndex = -1; for(let i = index - 1; i >= 0; i--) { if(inventory[i].pinned) { prevIndex = i; break; } } if(prevIndex !== -1) { [inventory[prevIndex], inventory[index]] = [inventory[index], inventory[prevIndex]]; setStore('dnd-inventory', inventory); renderInventory(); } }; window.moveInvDown = (index) => { let nextIndex = -1; for(let i = index + 1; i < inventory.length; i++) { if(inventory[i].pinned) { nextIndex = i; break; } } if(nextIndex !== -1) { [inventory[nextIndex], inventory[index]] = [inventory[index], inventory[nextIndex]]; setStore('dnd-inventory', inventory); renderInventory(); } }; window.editInv = (index) => { editingInvIndex = index; const item = inventory[index]; document.getElementById('edit-inv-name').value = item.name; document.getElementById('edit-inv-qty').value = item.qty; document.getElementById('edit-inv-weight').value = item.weight; document.getElementById('edit-inventory-modal').classList.remove('hidden'); }; 
    if(document.getElementById('btn-save-edit-inv')) { document.getElementById('btn-save-edit-inv').addEventListener('click', () => { if (editingInvIndex >= 0) { inventory[editingInvIndex] = { name: document.getElementById('edit-inv-name').value, qty: document.getElementById('edit-inv-qty').value || 1, weight: document.getElementById('edit-inv-weight').value || "-", pinned: inventory[editingInvIndex].pinned }; setStore('dnd-inventory', inventory); renderInventory(); document.getElementById('edit-inventory-modal').classList.add('hidden'); editingInvIndex = -1; } }); }
    document.body.addEventListener('click', (e) => { if(e.target.id === 'btn-toggle-currency') { document.getElementById('currency-inline-rules').classList.toggle('hidden'); } });

    // PAIEMENT BOURSE
    const btnPayCurrency = document.getElementById('btn-pay-currency');
    if(btnPayCurrency) {
        btnPayCurrency.addEventListener('click', () => {
            let costInput = document.getElementById('pay-amount-val'); 
            let costType = document.getElementById('pay-amount-type');
            if(!costInput || !costType) return;
            
            let costBase = parseFloat(costInput.value); if(isNaN(costBase) || costBase <= 0) return;
            let type = costType.value;
            
            let multipliers = { 'po': 100, 'pa': 10, 'pc': 1, 'pe': 50, 'pp': 1000 };
            let costPC = Math.round(costBase * multipliers[type]);

            let pc = parseInt(document.getElementById('coin-pc').value) || 0; let pa = parseInt(document.getElementById('coin-pa').value) || 0; let pe = parseInt(document.getElementById('coin-pe').value) || 0; let po = parseInt(document.getElementById('coin-po').value) || 0; let pp = parseInt(document.getElementById('coin-pp').value) || 0;
            let totalPC = pc + (pa * 10) + (pe * 50) + (po * 100) + (pp * 1000); 
            
            if(totalPC < costPC) { alert("Fonds insuffisants ! Tu n'as pas assez d'argent."); return; }
            totalPC -= costPC;
            
            let newPP = Math.floor(totalPC / 1000); totalPC %= 1000; let newPO = Math.floor(totalPC / 100); totalPC %= 100; let newPE = 0; let newPA = Math.floor(totalPC / 10); totalPC %= 10; let newPC = totalPC;
            document.getElementById('coin-pp').value = newPP; DB.set('dnd-sheet-coin-pp', newPP, false); document.getElementById('coin-po').value = newPO; DB.set('dnd-sheet-coin-po', newPO, false); document.getElementById('coin-pe').value = newPE; DB.set('dnd-sheet-coin-pe', newPE, false); document.getElementById('coin-pa').value = newPA; DB.set('dnd-sheet-coin-pa', newPA, false); document.getElementById('coin-pc').value = newPC; DB.set('dnd-sheet-coin-pc', newPC, false);
            costInput.value = '';
        });
    }

    // CAPACITÉS LIMITÉES
    let abilities = getStore('dnd-abilities') || [];
    const abilityModal = document.getElementById('ability-form-modal');
    const regenModeSelect = document.getElementById('ab-regen-mode'); const shortRestBlock = document.getElementById('ab-short-rest-block'); const shortTypeSelect = document.getElementById('ab-short-type'); const shortAmountInput = document.getElementById('ab-short-amount'); const longTypeSelect = document.getElementById('ab-long-type'); const longAmountInput = document.getElementById('ab-long-amount');
    
    if(regenModeSelect) regenModeSelect.addEventListener('change', (e) => { shortRestBlock.classList.toggle('hidden', e.target.value !== 'short_long'); }); if(shortTypeSelect) shortTypeSelect.addEventListener('change', (e) => { shortAmountInput.classList.toggle('hidden', e.target.value === 'all'); }); if(longTypeSelect) longTypeSelect.addEventListener('change', (e) => { longAmountInput.classList.toggle('hidden', e.target.value === 'all'); });
    function renderAbilities() { const list = document.getElementById('abilities-list'); if(!list) return; list.innerHTML = ''; abilities.forEach((ab, index) => { let regenMode = ab.regenMode || 'long'; let shortType = ab.shortType || 'all'; let longType = ab.longType || 'all'; let shortAmt = ab.shortAmount || 1; let longAmt = ab.longAmount || 1; let checkboxesHTML = Array.from({length: ab.max}).map((_, i) => `<input type="checkbox" data-index="${index}" data-box="${i}" ${ab.used[i] ? 'checked' : ''} class="ability-check">`).join(''); let regenText = regenMode === 'short_long' ? `Court: ${shortType === 'all' ? 'Tout' : `+${shortAmt}`} | Long: ${longType === 'all' ? 'Tout' : `+${longAmt}`}` : `Long: ${longType === 'all' ? 'Tout' : `+${longAmt}`}`; list.innerHTML += `<div class="item-card"><div class="item-card-header"><div style="display:flex; flex-direction:column;"><h4 style="margin-bottom:2px;">${ab.name}</h4><span style="font-size:0.75rem; color:#888;">Regen : ${regenText}</span></div>${getCrudControlsHTML(index, 'Ability')}</div><div class="ability-checkboxes">${checkboxesHTML}</div></div>`; }); document.querySelectorAll('.ability-check').forEach(cb => { cb.addEventListener('change', (e) => { abilities[e.target.dataset.index].used[e.target.dataset.box] = e.target.checked; setStore('dnd-abilities', abilities); }); }); }
    document.body.addEventListener('click', (e) => { if(e.target.id === 'btn-open-ability-modal') { editingAbilityIndex = -1; document.getElementById('new-ability-name').value = ''; document.getElementById('new-ability-max').value = ''; regenModeSelect.value = 'long'; shortRestBlock.classList.add('hidden'); shortTypeSelect.value = 'all'; shortAmountInput.classList.add('hidden'); shortAmountInput.value = '1'; longTypeSelect.value = 'all'; longAmountInput.classList.add('hidden'); longAmountInput.value = '1'; abilityModal.classList.remove('hidden'); } });
    if(document.getElementById('btn-save-ability')) { document.getElementById('btn-save-ability').addEventListener('click', () => { const name = document.getElementById('new-ability-name').value; const max = parseInt(document.getElementById('new-ability-max').value); if(name && max > 0) { const data = { name: name, max: max, used: new Array(max).fill(false), regenMode: regenModeSelect.value, shortType: shortTypeSelect.value, shortAmount: parseInt(shortAmountInput.value) || 1, longType: longTypeSelect.value, longAmount: parseInt(longAmountInput.value) || 1 }; if(editingAbilityIndex >= 0) { if(abilities[editingAbilityIndex].max === max) { data.used = abilities[editingAbilityIndex].used; } abilities[editingAbilityIndex] = data; } else { abilities.push(data); } setStore('dnd-abilities', abilities); renderAbilities(); abilityModal.classList.add('hidden'); } }); }
    window.deleteAbility = (index) => { if(confirm("Supprimer ?")) { abilities.splice(index, 1); setStore('dnd-abilities', abilities); renderAbilities(); }}; window.moveAbilityUp = (index) => { moveItem(abilities, index, -1); setStore('dnd-abilities', abilities); renderAbilities(); }; window.moveAbilityDown = (index) => { moveItem(abilities, index, 1); setStore('dnd-abilities', abilities); renderAbilities(); }; window.editAbility = (index) => { const data = abilities[index]; document.getElementById('new-ability-name').value = data.name; document.getElementById('new-ability-max').value = data.max; regenModeSelect.value = data.regenMode || 'long'; regenModeSelect.dispatchEvent(new Event('change')); shortTypeSelect.value = data.shortType || 'all'; shortTypeSelect.dispatchEvent(new Event('change')); shortAmountInput.value = data.shortAmount || 1; longTypeSelect.value = data.longType || 'all'; longTypeSelect.dispatchEvent(new Event('change')); longAmountInput.value = data.longAmount || 1; editingAbilityIndex = index; abilityModal.classList.remove('hidden'); };

    // SAUVEGARDE GLOBALE
    const crudIgnoredPrefixes = ['prof-', 'skill-', 'mod-', 'new-', 'slot-', 'inv-', 'edit-', 'ab-', 'rest-', 'custom-cond-', 'color-', 'init-', 'macro-'];
    function initGlobalSave() {
        const allSimpleInputs = document.querySelectorAll('#app-screen input:not(.slot-total-input):not(#avatar-file-input):not(#bg-file-input):not(#btn-import-json):not(.color-picker):not([type="radio"]):not([type="file"]):not(#pay-amount-val):not(#calc-display), #app-screen textarea, #app-screen select:not(#hd-size):not(#layout-selector):not(#pay-amount-type)');
        allSimpleInputs.forEach(input => {
            if(!input.id || crudIgnoredPrefixes.some(pref => input.id.startsWith(pref))) return;
            if (input.type === 'checkbox') {
                const saved = DB.get('dnd-sheet-'+input.id, false); if (saved !== null) input.checked = (saved === 'true');
                input.addEventListener('change', () => { DB.set('dnd-sheet-'+input.id, input.checked, false); updateStatsAndSkills(); });
            } else {
                const savedValue = DB.get('dnd-sheet-'+input.id, false); if (savedValue !== null) input.value = savedValue;
                input.addEventListener('input', () => { DB.set('dnd-sheet-'+input.id, input.value, false); if(input.id === 'hp-current' || input.id === 'hp-max') updateHpVisuals(); });
            }
        });
        const hdSizeInput = document.getElementById('hd-size'); const savedHdSize = DB.get('dnd-sheet-hd-size', false); if(savedHdSize !== null && hdSizeInput) hdSizeInput.value = savedHdSize; 
        if(hdSizeInput) hdSizeInput.addEventListener('change', () => DB.set('dnd-sheet-hd-size', hdSizeInput.value, false));
        updateHpVisuals(); 
    }

    function initSkillProfSave() {
        document.querySelectorAll('.skill-prof, #prof-armor-light, #prof-armor-med, #prof-armor-heavy, #prof-armor-shield, #prof-weapon-simple, #prof-weapon-martial, #prof-weapon-other').forEach(input => {
            const saved = DB.get('dnd-sheet-'+input.id, false); if (saved !== null) input.checked = (saved === 'true');
            input.addEventListener('change', () => { DB.set('dnd-sheet-'+input.id, input.checked, false); updateStatsAndSkills(); });
        });
    }

    initSkillProfSave(); initGlobalSave(); 
    const spellAbilityEl = document.getElementById('spellcasting-ability'); if(spellAbilityEl) spellAbilityEl.value = DB.get('dnd-sheet-spellcasting-ability', false) || "";
    updateStatsAndSkills(); renderAbilities(); renderPinnedSpells(); renderAttacks(); renderSpellSlots(); renderInventory(); renderMacros(); renderInitiativeTracker(); renderCustomConditions();
    let savedInit = DB.get('dnd-sheet-initiative', false); if(savedInit === null) { let mod = getModifier(parseInt(document.getElementById('stat-dex').value) || 10); if(initInput) initInput.value = mod; DB.set('dnd-sheet-initiative', mod, false); }

    if(document.getElementById('btn-export-pdf')) document.getElementById('btn-export-pdf').addEventListener('click', () => { applyLayout('classic'); window.print(); });

    // Initialisation Layout
    let savedLayout = getStore('dnd-layout-mode', false) || 'classic';
    if(layoutSelector) layoutSelector.value = savedLayout;
    applyLayout(savedLayout);
});