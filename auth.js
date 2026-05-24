// =====================================================
// auth.js — Supabase Auth & Sync (email/password)
// !! Remplace les deux valeurs ci-dessous !!
// =====================================================

const SUPABASE_URL  = 'https://vttzjbmzduqtgnrjtijn.supabase.co/rest/v1/';   // ex: https://xxxx.supabase.co
const SUPABASE_ANON_KEY = 'sb_publishable_B1wwPg-kHhoknMbla9-FEA_MlnJNUHJ'; // clé publique anon

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =====================================================
// OBJET AUTH — toutes les opérations Supabase
// =====================================================
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
        // Vider le cache local (sauf préférences visuelles)
        Object.keys(localStorage).forEach(k => {
            if (!k.startsWith('dnd-theme-') && !k.startsWith('dnd-custom-background')) {
                localStorage.removeItem(k);
            }
        });
    },

    // --- Personnages ---
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

    // --- Données de fiche (clé-valeur) ---
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
        if (error) console.warn('saveKeys:', error);
    },

    async deleteKey(charId, key) {
        if (!this.currentUser || !charId) return;
        await _supabase.from('character_data')
            .delete()
            .eq('character_id', charId)
            .eq('key', key)
            .eq('user_id', this.currentUser.id);
    }
};

// =====================================================
// QUEUE DE SYNC — regroupe les écritures (debounce 1s)
// =====================================================
window.SyncQueue = {
    pending: new Map(),
    timer: null,
    charId: null,

    push(charId, key, value) {
        this.charId = charId;
        this.pending.set(key, value);
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.flush(), 1000);
    },

    async flush() {
        if (!this.pending.size || !this.charId) return;
        const entries = [...this.pending.entries()].map(([key, value]) => ({ key, value }));
        this.pending.clear();
        try { await window.SupaAuth.saveKeys(this.charId, entries); }
        catch (e) { console.warn('SyncQueue.flush:', e); }
    }
};

// =====================================================
// CHARGEMENT DES DONNÉES EN CACHE LOCAL
// =====================================================
async function loadUserDataIntoLocalStorage(userId) {
    const characters = await SupaAuth.loadCharacters();
    localStorage.setItem('dnd-character-list', JSON.stringify(characters));
    const activeId = localStorage.getItem('dnd-active-char');
    if (activeId && characters.find(c => c.id === activeId)) {
        await loadCharacterDataIntoLocalStorage(activeId);
    }
}

async function loadCharacterDataIntoLocalStorage(charId) {
    const data = await SupaAuth.loadCharacterData(charId);
    Object.entries(data).forEach(([key, value]) => {
        localStorage.setItem(`${charId}_${key}`, value);
    });
}

window.loadUserDataIntoLocalStorage      = loadUserDataIntoLocalStorage;
window.loadCharacterDataIntoLocalStorage = loadCharacterDataIntoLocalStorage;

// =====================================================
// TRADUCTION DES ERREURS SUPABASE
// =====================================================
function translateAuthError(msg) {
    if (!msg) return 'Une erreur est survenue.';
    if (msg.includes('Invalid login') || msg.includes('invalid_credentials')) return 'Email ou mot de passe incorrect.';
    if (msg.includes('already registered') || msg.includes('already been registered')) return 'Cet email est déjà utilisé.';
    if (msg.includes('Email not confirmed')) return 'Confirme ton email avant de te connecter.';
    if (msg.includes('Password should') || msg.includes('password')) return 'Mot de passe trop court (6 caractères min).';
    if (msg.includes('Unable to validate')) return 'Session expirée, recharge la page.';
    return msg;
}

// =====================================================
// INIT PAGE — vérification session + routing
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
    const screens = ['loading-screen', 'login-screen', 'home-screen', 'app-screen'];

    function showScreen(id) {
        screens.forEach(s => {
            const el = document.getElementById(s);
            if (el) el.classList.toggle('hidden', s !== id);
        });
    }

    // 1. Afficher le chargement le temps de vérifier la session Supabase
    showScreen('loading-screen');

    const user = await SupaAuth.getUser();
    if (user) {
        // Afficher l'email dans le menu
        const emailEl = document.getElementById('auth-user-display');
        if (emailEl) emailEl.textContent = user.email;

        await loadUserDataIntoLocalStorage(user.id);
        showScreen('home-screen');
        // Lancer l'app principale (définie dans script.js)
        if (typeof window.initDndApp === 'function') window.initDndApp();
    } else {
        showScreen('login-screen');
    }

    // Écouter les changements (ex : confirmation email en arrière-plan)
    _supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            SupaAuth.currentUser = session.user;
            const emailEl = document.getElementById('auth-user-display');
            if (emailEl) emailEl.textContent = session.user.email;
            await loadUserDataIntoLocalStorage(session.user.id);
            showScreen('home-screen');
            if (typeof window.initDndApp === 'function') window.initDndApp();
        }
        if (event === 'SIGNED_OUT') {
            showScreen('login-screen');
        }
    });

    // ---- Onglets login / inscription ----
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

    if (tabLogin) tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active'); tabRegister.classList.remove('active');
        formLogin.classList.remove('hidden'); formRegister.classList.add('hidden');
        clearMsg();
    });
    if (tabRegister) tabRegister.addEventListener('click', () => {
        tabRegister.classList.add('active'); tabLogin.classList.remove('active');
        formRegister.classList.remove('hidden'); formLogin.classList.add('hidden');
        clearMsg();
    });

    // ---- Connexion ----
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
            await loadUserDataIntoLocalStorage(SupaAuth.currentUser.id);
            showScreen('home-screen');
            if (typeof window.initDndApp === 'function') window.initDndApp();
        } catch (e) {
            showMsg(translateAuthError(e.message), 'error');
        } finally {
            btnSignIn.disabled = false; btnSignIn.textContent = 'Se connecter';
        }
    });

    // Soumettre avec Entrée depuis les champs
    ['signin-email', 'signin-password'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') btnSignIn?.click(); });
    });

    // ---- Inscription ----
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
            // Si email de confirmation activé dans Supabase
            if (data.user && !data.session) {
                showMsg('✅ Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse.', 'success');
            } else if (data.user) {
                const emailEl = document.getElementById('auth-user-display');
                if (emailEl) emailEl.textContent = data.user.email;
                await loadUserDataIntoLocalStorage(data.user.id);
                showScreen('home-screen');
                if (typeof window.initDndApp === 'function') window.initDndApp();
            }
        } catch (e) {
            showMsg(translateAuthError(e.message), 'error');
        } finally {
            btnSignUp.disabled = false; btnSignUp.textContent = "S'inscrire";
        }
    });

    // ---- Déconnexion ----
    const btnSignOut = document.getElementById('btn-signout');
    if (btnSignOut) btnSignOut.addEventListener('click', async () => {
        if (!confirm('Te déconnecter ?')) return;
        await SyncQueue.flush(); // Vider la queue avant de partir
        await SupaAuth.signOut();
        location.reload();
    });

    // Sauvegarder avant de quitter la page
    window.addEventListener('beforeunload', () => { SyncQueue.flush(); });
});
