// =====================================================
// auth.js — Supabase Auth & Sync (email/password)
// =====================================================

const SUPABASE_URL  = 'https://vttzjbmzduqtgnrjtijn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_B1wwPg-kHhoknMbla9-FEA_MlnJNUHJ';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
        // CORRECTION ICI : utilisation correcte de la variable ${key}
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
    // CORRECTION ICI : utilisation correcte de la variable ${key}
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
    if (msg.includes('Password should') || msg.includes('password')) return 'Mot de passe trop court (6 caractères min).';
    if (msg.includes('Unable to validate')) return 'Session expirée, recharge la page.';
    return msg;
}

// =====================================================
// INIT PAGE
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
    const screens = ['loading-screen', 'login-screen', 'home-screen', 'app-screen'];

    function showScreen(id) {
        if (id === 'home-screen' && localStorage.getItem('dnd-active-char')) {
            id = 'app-screen';
        }
        screens.forEach(s => {
            const el = document.getElementById(s);
            if (el) el.classList.toggle('hidden', s !== id);
        });
    }

    showScreen('loading-screen');

    const user = await SupaAuth.getUser();
    if (user) {
        const emailEl = document.getElementById('auth-user-display');
        if (emailEl) emailEl.textContent = user.email;

        showScreen('home-screen');
        loadUserDataIntoLocalStorage(user.id);
    } else {
        showScreen('login-screen');
    }

    _supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            SupaAuth.currentUser = session.user;
            const emailEl = document.getElementById('auth-user-display');
            if (emailEl) emailEl.textContent = session.user.email;
            showScreen('home-screen');
            loadUserDataIntoLocalStorage(session.user.id);
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