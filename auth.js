// =====================================================
// auth.js — Supabase Auth & Sync (email/password)
// =====================================================

const SUPABASE_URL  = 'https://vttzjbmzduqtgnrjtijn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_B1wwPg-kHhoknMbla9-FEA_MlnJNUHJ';

// eventsPerSecond : la limite par défaut (10/s) faisait JETER en silence des broadcasts
// pendant un drag de jeton joueur (~14 msg/s) → le MJ ne voyait pas le déplacement. (Lot 25)
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { realtime: { params: { eventsPerSecond: 40 } } });

// Lien « mot de passe oublié » : on lit le hash AVANT que supabase-js ne le consomme.
const AUTH_RECOVERY   = location.hash.includes('type=recovery');
const AUTH_LINK_ERROR = /error_code=otp_expired|error=access_denied/.test(location.hash);

// Code de session lisible (sans caractères ambigus : pas de 0/O, 1/I/L)
function genSessionCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// =====================================================
// NAVIGATION GLOBALE ENTRE ÉCRANS (routeur léger)
// Tous les écrans plein page sont des .screen-view ; on bascule
// .hidden. `gm-active` sur <body> permet d'adapter le menu ☰.
// =====================================================
const APP_SCREENS = ['loading-screen', 'login-screen', 'home-screen', 'app-screen', 'gm-screen'];
window.navTo = function (id) {
    APP_SCREENS.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.toggle('hidden', s !== id);
    });
    document.body.classList.toggle('gm-active', id === 'gm-screen');
    try { document.dispatchEvent(new CustomEvent('screen:change', { detail: { id } })); } catch (e) {}
};

window.SupaAuth = {
    client: _supabase,
    currentUser: null,

    async getUser() {
        const { data: { user } } = await _supabase.auth.getUser();
        this.currentUser = user;
        return user;
    },

    async signInEmail(email, password) {
        const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        this.currentUser = data.user;
        return data;
    },

    async signUpEmail(email, password) {
        const { data, error } = await _supabase.auth.signUp({ email, password });
        if (error) throw error;
        this.currentUser = data.user;
        return data;
    },

    async signOut() {
        await _supabase.auth.signOut();
        this.currentUser = null;
        Object.keys(localStorage).forEach(k => {
            if (!k.startsWith('dnd-theme-') && !k.startsWith('dnd-custom-background')) {
                localStorage.removeItem(k);
            }
        });
    },

    async loadCharacters() {
        if (!this.currentUser) return [];
        const { data, error } = await _supabase
            .from('characters')
            .select('id, name, level, class')
            .eq('user_id', this.currentUser.id)
            .order('created_at', { ascending: true });
        if (error) { console.warn('loadCharacters:', error); return []; }
        return data || [];
    },

    async createCharacter(name) {
        if (!this.currentUser) return null;
        const { data, error } = await _supabase
            .from('characters')
            .insert({ user_id: this.currentUser.id, name, level: 1, class: '' })
            .select().single();
        if (error) { console.warn('createCharacter:', error); return null; }
        return data;
    },

    async updateCharacterMeta(charId, fields) {
        if (!this.currentUser) return;
        await _supabase.from('characters')
            .update({ ...fields, updated_at: new Date().toISOString() })
            .eq('id', charId).eq('user_id', this.currentUser.id);
    },

    async deleteCharacter(charId) {
        if (!this.currentUser) return;
        await _supabase.from('characters')
            .delete().eq('id', charId).eq('user_id', this.currentUser.id);
    },

    async loadCharacterData(charId) {
        if (!this.currentUser) return {};
        const { data, error } = await _supabase
            .from('character_data')
            .select('key, value')
            .eq('character_id', charId)
            .eq('user_id', this.currentUser.id);
        if (error) { console.warn('loadCharacterData:', error); return {}; }
        const out = {};
        (data || []).forEach(r => { out[r.key] = r.value; });
        return out;
    },

    async saveKeys(charId, entries) {
        if (!this.currentUser || !charId || !entries.length) return;
        const rows = entries.map(({ key, value }) => ({
            character_id: charId,
            user_id: this.currentUser.id,
            key,
            value: String(value),
            updated_at: new Date().toISOString()
        }));
        const { error } = await _supabase
            .from('character_data')
            .upsert(rows, { onConflict: 'character_id,key' });
        if (error) throw error;
    },

    // =====================================================
    // SESSIONS TEMPS RÉEL (MJ ↔ joueurs)
    // =====================================================

    // --- Côté MJ ---
    async createSession(name) {
        if (!this.currentUser) return null;
        // Quelques tentatives en cas de collision de code (contrainte unique)
        for (let i = 0; i < 5; i++) {
            const code = genSessionCode();
            const { data, error } = await _supabase
                .from('sessions')
                .insert({ code, gm_id: this.currentUser.id, name: name || 'Partie', active: true })
                .select().single();
            if (!error) return data;            // { id, code, name, ... }
            if (error.code !== '23505') { console.warn('createSession:', error); return null; }
        }
        return null;
    },

    async closeSession(sessionId) {
        if (!this.currentUser || !sessionId) return;
        await _supabase.from('sessions')
            .update({ active: false })
            .eq('id', sessionId).eq('gm_id', this.currentUser.id);
    },

    async loadSessionPlayers(sessionId) {
        if (!this.currentUser || !sessionId) return [];
        const { data, error } = await _supabase
            .from('session_players')
            .select('user_id, character_id, character_name, snapshot, updated_at')
            .eq('session_id', sessionId)
            .order('updated_at', { ascending: true });
        if (error) { console.warn('loadSessionPlayers:', error); return []; }
        return data || [];
    },

    // S'abonne aux changements de fiches des joueurs (Postgres Changes). Renvoie le canal.
    subscribeSessionPlayers(sessionId, onChange) {
        return _supabase
            .channel('db-session-' + sessionId)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'session_players', filter: 'session_id=eq.' + sessionId },
                (payload) => { try { onChange(payload); } catch (e) { console.warn(e); } })
            .subscribe();
    },

    // --- Bannissement serveur (table session_bans + trigger anti-join) ---
    // Bannit un joueur jusqu'à `untilMs` (timestamp ms). until=0 → kick simple (lève le ban).
    async banPlayer(sessionId, userId, untilMs) {
        if (!this.currentUser || !sessionId || !userId) return;
        if (!untilMs) return this.unbanPlayer(sessionId, userId);
        const { error } = await _supabase.from('session_bans')
            .upsert({
                session_id: sessionId,
                user_id: userId,
                until: new Date(untilMs).toISOString(),
                created_by: this.currentUser.id
            }, { onConflict: 'session_id,user_id' });
        if (error) console.warn('banPlayer:', error);
    },

    async unbanPlayer(sessionId, userId) {
        if (!this.currentUser || !sessionId || !userId) return;
        const { error } = await _supabase.from('session_bans')
            .delete().eq('session_id', sessionId).eq('user_id', userId);
        if (error) console.warn('unbanPlayer:', error);
    },

    // Renvoie { userId: untilMs } des bans actifs de la session (pour l'UI MJ).
    async loadSessionBans(sessionId) {
        if (!this.currentUser || !sessionId) return {};
        const { data, error } = await _supabase.from('session_bans')
            .select('user_id, until').eq('session_id', sessionId);
        if (error) { console.warn('loadSessionBans:', error); return {}; }
        const now = Date.now(), out = {};
        (data || []).forEach(r => { const t = new Date(r.until).getTime(); if (t > now) out[r.user_id] = t; });
        return out;
    },

    // --- Côté joueur ---
    async joinSession(code, charId, charName) {
        if (!this.currentUser) throw new Error('NOT_LOGGED_IN');
        const { data, error } = await _supabase.rpc('join_session', {
            p_code: String(code || '').toUpperCase().trim(),
            p_char_id: String(charId),
            p_char_name: charName || ''
        });
        if (error) throw error;
        return data; // id (uuid) de la session rejointe
    },

    async leaveSession(sessionId) {
        if (!this.currentUser || !sessionId) return;
        await _supabase.from('session_players')
            .delete().eq('session_id', sessionId).eq('user_id', this.currentUser.id);
    },

    async upsertSnapshot(sessionId, charId, charName, snapshot) {
        if (!this.currentUser || !sessionId) return;
        const { error } = await _supabase.from('session_players')
            .upsert({
                session_id: sessionId,
                user_id: this.currentUser.id,
                character_id: String(charId),
                character_name: charName || '',
                snapshot: snapshot || {},
                updated_at: new Date().toISOString()
            }, { onConflict: 'session_id,user_id' });
        if (error) console.warn('upsertSnapshot:', error);
    },

    // --- Commun : canal de présence keyé par le code de session ---
    presenceChannel(code) {
        const key = (this.currentUser && this.currentUser.id) || 'anon-' + Math.random().toString(36).slice(2);
        return _supabase.channel('session:' + code, { config: { presence: { key } } });
    },

    // =====================================================
    // STORAGE — médias MJ (soundboard, images, maps) → bucket gm-assets
    // =====================================================
    async uploadAsset(file, folder) {
        if (!this.currentUser) throw new Error('NOT_LOGGED_IN');
        const safe = String(folder || 'misc').replace(/[^a-z0-9_-]/gi, '') || 'misc';
        const ext = (String(file.name || 'f').split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
        const path = this.currentUser.id + '/' + safe + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
        const { error } = await _supabase.storage.from('gm-assets').upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (error) throw error;
        const { data } = _supabase.storage.from('gm-assets').getPublicUrl(path);
        return { path, url: data.publicUrl };
    },

    assetPublicUrl(path) {
        if (!path) return null;
        const { data } = _supabase.storage.from('gm-assets').getPublicUrl(path);
        return data ? data.publicUrl : null;
    },

    async deleteAsset(path) {
        if (!this.currentUser || !path) return;
        try { await _supabase.storage.from('gm-assets').remove([path]); } catch (e) { console.warn('deleteAsset:', e); }
    },

    // =====================================================
    // ÉTAT LIVE DE SESSION (carte / tokens / combat) — table session_state
    // =====================================================
    async loadSessionState(sessionId) {
        if (!sessionId) return null;
        const { data, error } = await _supabase
            .from('session_state').select('*').eq('session_id', sessionId).maybeSingle();
        if (error) { console.warn('loadSessionState:', error); return null; }
        return data;
    },

    async saveSessionState(sessionId, patch) {
        if (!this.currentUser || !sessionId) return;
        const row = Object.assign({ session_id: sessionId, updated_at: new Date().toISOString() }, patch || {});
        const { error } = await _supabase.from('session_state').upsert(row, { onConflict: 'session_id' });
        if (error) console.warn('saveSessionState:', error);
    },

    subscribeSessionState(sessionId, onChange) {
        return _supabase.channel('db-state-' + sessionId)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'session_state', filter: 'session_id=eq.' + sessionId },
                (payload) => { try { onChange(payload.new || null); } catch (e) { console.warn(e); } })
            .subscribe();
    },

    // =====================================================
    // ARBORESCENCE DE PRÉPARATION (gm_tree)
    // =====================================================
    async treeList(campaignId) {
        if (!this.currentUser) return [];
        const { data, error } = await _supabase
            .from('gm_tree').select('*')
            .eq('gm_id', this.currentUser.id).eq('campaign_id', String(campaignId))
            .order('sort', { ascending: true });
        if (error) { console.warn('treeList:', error); return []; }
        return data || [];
    },

    async treeInsert(node) {
        if (!this.currentUser) return null;
        const row = Object.assign({ gm_id: this.currentUser.id }, node);
        const { data, error } = await _supabase.from('gm_tree').insert(row).select().single();
        if (error) { console.warn('treeInsert:', error); return null; }
        return data;
    },

    async treeUpdate(id, fields) {
        if (!this.currentUser || !id) return;
        const { error } = await _supabase.from('gm_tree')
            .update(Object.assign({ updated_at: new Date().toISOString() }, fields))
            .eq('id', id).eq('gm_id', this.currentUser.id);
        if (error) console.warn('treeUpdate:', error);
    },

    async treeDelete(id) {
        if (!this.currentUser || !id) return;
        const { error } = await _supabase.from('gm_tree').delete().eq('id', id).eq('gm_id', this.currentUser.id);
        if (error) console.warn('treeDelete:', error);
    },

    // =====================================================
    // PROFIL MJ DANS LE CLOUD (table gm_campaigns)
    // Métadonnées de campagne + état complet de l'écran MJ (JSONB).
    // =====================================================
    // Renvoie null si la table est injoignable (ex. SQL pas encore lancé), [] si vide.
    async gmCampaignsList() {
        if (!this.currentUser) return null;
        const { data, error } = await _supabase
            .from('gm_campaigns')
            .select('id, name, archived, created_at, updated_at')
            .eq('gm_id', this.currentUser.id)
            .order('created_at', { ascending: true });
        if (error) { console.warn('gmCampaignsList:', error); return null; }
        return data || [];
    },

    async gmCampaignState(id) {
        if (!this.currentUser || !id) return null;
        const { data, error } = await _supabase
            .from('gm_campaigns').select('state')
            .eq('id', String(id)).eq('gm_id', this.currentUser.id).maybeSingle();
        if (error) { console.warn('gmCampaignState:', error); return null; }
        return data ? data.state : null;
    },

    // Upsert complet d'une campagne (création / synchro métadonnées + état).
    async gmCampaignUpsert(camp) {
        if (!this.currentUser || !camp || !camp.id) return null;
        const row = {
            id: String(camp.id),
            gm_id: this.currentUser.id,
            name: camp.name || 'Partie',
            archived: !!camp.archived,
            updated_at: new Date().toISOString()
        };
        if (camp.state !== undefined) row.state = camp.state || {};
        const { data, error } = await _supabase
            .from('gm_campaigns').upsert(row, { onConflict: 'id' }).select().single();
        if (error) { console.warn('gmCampaignUpsert:', error); return null; }
        return data;
    },

    // Écriture rapide du seul état (sauvegardes fréquentes débauncées).
    async gmCampaignSaveState(id, state) {
        if (!this.currentUser || !id) return;
        const { error } = await _supabase.from('gm_campaigns')
            .update({ state: state || {}, updated_at: new Date().toISOString() })
            .eq('id', String(id)).eq('gm_id', this.currentUser.id);
        if (error) console.warn('gmCampaignSaveState:', error);
    },

    async gmCampaignDelete(id) {
        if (!this.currentUser || !id) return;
        const { error } = await _supabase.from('gm_campaigns')
            .delete().eq('id', String(id)).eq('gm_id', this.currentUser.id);
        if (error) console.warn('gmCampaignDelete:', error);
    },

    // ---- Bibliothèque MJ dans le cloud : bestiaire + groupes, partagés entre appareils ----
    // Une ligne par MJ (gm_library). Renvoie { bestiary, groups, ts } ou null si injoignable/vide.
    async gmLibraryGet() {
        if (!this.currentUser) return null;
        const { data, error } = await _supabase
            .from('gm_library').select('bestiary, groups, ts')
            .eq('gm_id', this.currentUser.id).maybeSingle();
        if (error) { console.warn('gmLibraryGet:', error); return null; }
        if (!data) return { bestiary: [], groups: [], ts: 0 };
        return { bestiary: data.bestiary || [], groups: data.groups || [], ts: Number(data.ts) || 0 };
    },
    async gmLibrarySave(bestiary, groups, ts) {
        if (!this.currentUser) return;
        const row = { gm_id: this.currentUser.id, bestiary: bestiary || [], groups: groups || [], ts: Number(ts) || Date.now(), updated_at: new Date().toISOString() };
        const { error } = await _supabase.from('gm_library').upsert(row, { onConflict: 'gm_id' });
        if (error) console.warn('gmLibrarySave:', error);
    }
};

// =====================================================
// QUEUE DE SYNC — regroupe les écritures
// =====================================================
window.SyncQueue = {
    pending: new Map(),
    timer: null,
    charId: null,

    push(charId, key, value) {
        this.charId = charId;
        this.pending.set(key, value);
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.flush(), 800);
    },

    async flush() {
        if (!this.pending.size || !this.charId) return;
        const entries = [...this.pending.entries()].map(([key, value]) => ({ key, value }));
        this.pending.clear();
        
        let toast = document.getElementById('sync-toast');
        if(!toast) {
            toast = document.createElement('div');
            toast.id = 'sync-toast';
            toast.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#f39c12; color:white; padding:8px 15px; border-radius:8px; font-size:0.9rem; font-weight:bold; z-index:9999; transition:0.3s; font-family:"Cinzel",serif; box-shadow: 0 4px 10px rgba(0,0,0,0.3);';
            document.body.appendChild(toast);
        }
        toast.style.background = '#f39c12';
        toast.textContent = '⏳ Sauvegarde...';
        toast.style.opacity = '1';

        try { 
            await window.SupaAuth.saveKeys(this.charId, entries); 
            toast.style.background = '#27ae60';
            toast.textContent = '✅ Sauvegardé';
            setTimeout(() => { toast.style.opacity = '0'; }, 2000);
        }
        catch (e) { 
            console.error('Erreur Supabase:', e); 
            toast.style.background = '#c0392b';
            toast.textContent = '❌ Erreur de sauvegarde';
        }
    }
};

// =====================================================
// CHARGEMENT DES DONNÉES EN CACHE LOCAL
// =====================================================
async function loadUserDataIntoLocalStorage(userId) {
    const characters = await SupaAuth.loadCharacters();

    await Promise.all(characters.map(async (c) => {
        const data = await SupaAuth.loadCharacterData(c.id);
        Object.entries(data).forEach(([key, value]) => {
            localStorage.setItem(`${c.id}_${key}`, value);
        });
        
        const sheetName  = data['dnd-sheet-char-name'];
        const sheetLevel = data['dnd-sheet-char-level'];
        const sheetClass = data['dnd-sheet-char-class'];
        if(sheetName  && sheetName  !== 'undefined') c.name  = sheetName;
        if(sheetLevel && sheetLevel !== 'undefined') c.level = parseInt(sheetLevel) || c.level;
        if(sheetClass && sheetClass !== 'undefined') c.class = sheetClass;
    }));

    localStorage.setItem('dnd-character-list', JSON.stringify(characters));

    if (typeof window.renderHomeScreen === 'function') window.renderHomeScreen();
}

async function loadCharacterDataIntoLocalStorage(charId) {
    const data = await SupaAuth.loadCharacterData(charId);
    Object.entries(data).forEach(([key, value]) => {
        localStorage.setItem(`${charId}_${key}`, value);
    });
    return data;
}

window.loadUserDataIntoLocalStorage      = loadUserDataIntoLocalStorage;
window.loadCharacterDataIntoLocalStorage = loadCharacterDataIntoLocalStorage;

function translateAuthError(msg) {
    if (!msg) return 'Une erreur est survenue.';
    if (msg.includes('Invalid login') || msg.includes('invalid_credentials')) return 'Email ou mot de passe incorrect.';
    if (msg.includes('already registered')) return 'Cet email est déjà utilisé.';
    if (msg.includes('Email not confirmed')) return 'Confirme ton email avant de te connecter.';
    if (msg.includes('should be different')) return "Le nouveau mot de passe doit être différent de l'ancien.";
    if (msg.includes('rate limit') || msg.includes('security purposes')) return 'Trop de demandes. Patiente une minute puis réessaie.';
    if (msg.includes('session missing') || msg.includes('Auth session')) return 'Lien expiré. Redemande un lien de réinitialisation.';
    if (msg.includes('Password should') || msg.includes('password')) return 'Mot de passe trop court (6 caractères min).';
    if (msg.includes('Unable to validate')) return 'Session expirée, recharge la page.';
    return msg;
}

// =====================================================
// INIT PAGE
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
    function showScreen(id) {
        if (id === 'home-screen' && localStorage.getItem('dnd-active-char')) {
            id = 'app-screen';
        }
        window.navTo(id);
    }

    // --- Flux « mot de passe oublié » ---
    // Autonome (accès DOM directs) : appelé pendant le boot, avant l'initialisation
    // des const du bas de ce callback (showMsg/msgEl seraient encore en TDZ).
    function authBootMsg(text, type) {
        const el = document.getElementById('auth-message');
        if (el) { el.textContent = text; el.className = 'auth-message auth-message--' + type; el.classList.remove('hidden'); }
    }
    function showRecoveryUI() {
        window.navTo('login-screen'); // direct : showScreen redirigerait vers la fiche si un perso est actif
        const tabs = document.querySelector('.auth-tabs'); if (tabs) tabs.classList.add('hidden');
        ['auth-form-login', 'auth-form-register', 'auth-form-forgot'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });
        const fr = document.getElementById('auth-form-reset'); if (fr) fr.classList.remove('hidden');
        const sub = document.querySelector('.auth-subtitle'); if (sub) sub.textContent = 'Choisis ton nouveau mot de passe';
        authBootMsg('🔐 Lien vérifié — saisis ton nouveau mot de passe.', 'success');
    }

    showScreen('loading-screen');

    const user = await SupaAuth.getUser();
    if (AUTH_RECOVERY && user) {
        // Le jeton du mail de réinitialisation vient de connecter l'utilisateur :
        // on demande le nouveau mot de passe au lieu d'entrer dans l'app.
        showRecoveryUI();
    } else if (user) {
        const emailEl = document.getElementById('auth-user-display');
        if (emailEl) emailEl.textContent = user.email;

        showScreen('home-screen');
        loadUserDataIntoLocalStorage(user.id);
    } else {
        showScreen('login-screen');
        if (AUTH_LINK_ERROR) authBootMsg('Lien invalide ou expiré. Clique sur « Mot de passe oublié ? » pour en recevoir un nouveau.', 'error');
        else if (AUTH_RECOVERY) authBootMsg("Le lien n'a pas pu être vérifié. Redemande un lien via « Mot de passe oublié ? ».", 'error');
    }

    _supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') { showRecoveryUI(); return; }
        if (event === 'SIGNED_IN' && session?.user) {
            if (AUTH_RECOVERY) return; // connexion issue du lien de récupération : on reste sur le formulaire de nouveau mot de passe
            SupaAuth.currentUser = session.user;
            const emailEl = document.getElementById('auth-user-display');
            if (emailEl) emailEl.textContent = session.user.email;
            // IMPORTANT : Supabase relance SIGNED_IN au rafraîchissement de jeton
            // (notamment quand l'onglet/fenêtre regagne le focus). On ne redirige
            // et on ne recharge les données QUE lors d'une vraie connexion, c.-à-d.
            // quand un écran d'authentification est encore affiché — sinon on
            // réinitialisait l'écran MJ/joueur à chaque retour de focus (+ risque
            // d'écraser des modifications locales non sauvegardées).
            const loginVisible = !document.getElementById('login-screen').classList.contains('hidden');
            const loadingVisible = !document.getElementById('loading-screen').classList.contains('hidden');
            if (loginVisible || loadingVisible) {
                showScreen('home-screen');
                loadUserDataIntoLocalStorage(session.user.id);
            }
        }
        if (event === 'SIGNED_OUT') {
            showScreen('login-screen');
        }
    });

    const tabLogin    = document.getElementById('auth-tab-login');
    const tabRegister = document.getElementById('auth-tab-register');
    const formLogin   = document.getElementById('auth-form-login');
    const formRegister= document.getElementById('auth-form-register');
    const msgEl       = document.getElementById('auth-message');

    function showMsg(text, type) {
        if (!msgEl) return;
        msgEl.textContent = text;
        msgEl.className = 'auth-message auth-message--' + type;
        msgEl.classList.remove('hidden');
    }
    function clearMsg() {
        if (msgEl) { msgEl.textContent = ''; msgEl.classList.add('hidden'); }
    }

    const formForgot = document.getElementById('auth-form-forgot');

    if (tabLogin) tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active'); tabRegister.classList.remove('active');
        formLogin.classList.remove('hidden'); formRegister.classList.add('hidden');
        if (formForgot) formForgot.classList.add('hidden');
        clearMsg();
    });
    if (tabRegister) tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active'); tabLogin.classList.remove('active');
        formRegister.classList.remove('hidden'); formLogin.classList.add('hidden');
        if (formForgot) formForgot.classList.add('hidden');
        clearMsg();
    });

    // --- Mot de passe oublié : demande d'envoi du lien ---
    const btnShowForgot = document.getElementById('btn-show-forgot');
    if (btnShowForgot) btnShowForgot.addEventListener('click', () => {
        formLogin.classList.add('hidden');
        if (formForgot) formForgot.classList.remove('hidden');
        const fe = document.getElementById('forgot-email');
        const se = document.getElementById('signin-email');
        if (fe && se && !fe.value) fe.value = se.value.trim();
        clearMsg();
        if (fe) fe.focus();
    });
    const btnBackLogin = document.getElementById('btn-back-login');
    if (btnBackLogin) btnBackLogin.addEventListener('click', () => {
        if (formForgot) formForgot.classList.add('hidden');
        formLogin.classList.remove('hidden');
        clearMsg();
    });
    const btnSendReset = document.getElementById('btn-send-reset');
    if (btnSendReset) btnSendReset.addEventListener('click', async () => {
        const email = (document.getElementById('forgot-email').value || '').trim();
        if (!email) { showMsg('Indique ton adresse email.', 'error'); return; }
        btnSendReset.disabled = true; btnSendReset.textContent = 'Envoi…';
        try {
            const { error } = await _supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
            if (error) throw error;
            showMsg('📩 Si un compte existe pour ' + email + ", un lien de réinitialisation vient d'être envoyé. Pense à vérifier les spams.", 'success');
        } catch (e) {
            showMsg(translateAuthError(e.message), 'error');
        } finally {
            btnSendReset.disabled = false; btnSendReset.textContent = 'Envoyer le lien';
        }
    });
    const forgotEmailInput = document.getElementById('forgot-email');
    if (forgotEmailInput) forgotEmailInput.addEventListener('keydown', e => { if (e.key === 'Enter') btnSendReset?.click(); });

    // --- Nouveau mot de passe (arrivée par le lien du mail) ---
    const btnDoReset = document.getElementById('btn-do-reset');
    if (btnDoReset) btnDoReset.addEventListener('click', async () => {
        const p1 = document.getElementById('reset-password').value;
        const p2 = document.getElementById('reset-password2').value;
        if (!p1) { showMsg('Choisis un nouveau mot de passe.', 'error'); return; }
        if (p1.length < 6) { showMsg('Mot de passe trop court (6 caractères min).', 'error'); return; }
        if (p1 !== p2) { showMsg('Les mots de passe ne correspondent pas.', 'error'); return; }
        btnDoReset.disabled = true; btnDoReset.textContent = 'Enregistrement…';
        try {
            const { error } = await _supabase.auth.updateUser({ password: p1 });
            if (error) throw error;
            showMsg('✅ Mot de passe modifié ! Connexion en cours…', 'success');
            history.replaceState(null, '', location.pathname + location.search); // purge le jeton du hash avant de recharger
            setTimeout(() => location.reload(), 1200);
        } catch (e) {
            showMsg(translateAuthError(e.message), 'error');
            btnDoReset.disabled = false; btnDoReset.textContent = 'Changer le mot de passe';
        }
    });
    ['reset-password', 'reset-password2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') btnDoReset?.click(); });
    });

    const btnSignIn = document.getElementById('btn-signin');
    if (btnSignIn) btnSignIn.addEventListener('click', async () => {
        const email    = document.getElementById('signin-email').value.trim();
        const password = document.getElementById('signin-password').value;
        if (!email || !password) { showMsg('Remplis tous les champs.', 'error'); return; }
        btnSignIn.disabled = true; btnSignIn.textContent = 'Connexion…';
        try {
            await SupaAuth.signInEmail(email, password);
            const emailEl = document.getElementById('auth-user-display');
            if (emailEl) emailEl.textContent = SupaAuth.currentUser.email;
            showScreen('home-screen');
            loadUserDataIntoLocalStorage(SupaAuth.currentUser.id);
        } catch (e) {
            showMsg(translateAuthError(e.message), 'error');
        } finally {
            btnSignIn.disabled = false; btnSignIn.textContent = 'Se connecter';
        }
    });

    ['signin-email', 'signin-password'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') btnSignIn?.click(); });
    });

    const btnSignUp = document.getElementById('btn-signup');
    if (btnSignUp) btnSignUp.addEventListener('click', async () => {
        const email    = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const password2= document.getElementById('signup-password2').value;
        if (!email || !password) { showMsg('Remplis tous les champs.', 'error'); return; }
        if (password !== password2) { showMsg('Les mots de passe ne correspondent pas.', 'error'); return; }
        if (password.length < 6)   { showMsg('Mot de passe trop court (6 caractères min).', 'error'); return; }
        btnSignUp.disabled = true; btnSignUp.textContent = 'Inscription…';
        try {
            const data = await SupaAuth.signUpEmail(email, password);
            if (data.user && !data.session) {
                showMsg('✅ Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse.', 'success');
            } else if (data.user) {
                const emailEl = document.getElementById('auth-user-display');
                if (emailEl) emailEl.textContent = data.user.email;
                showScreen('home-screen');
                loadUserDataIntoLocalStorage(data.user.id);
            }
        } catch (e) {
            showMsg(translateAuthError(e.message), 'error');
        } finally {
            btnSignUp.disabled = false; btnSignUp.textContent = "S'inscrire";
        }
    });

    const btnSignOut = document.getElementById('btn-signout');
    if (btnSignOut) btnSignOut.addEventListener('click', async () => {
        if (!confirm('Te déconnecter ?')) return;
        await SyncQueue.flush();
        await SupaAuth.signOut();
        location.reload();
    });

    window.addEventListener('beforeunload', () => { SyncQueue.flush(); });
});