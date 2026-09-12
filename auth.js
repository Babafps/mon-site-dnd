// =====================================================
// auth.js — Supabase Auth & Sync (email/password)
// =====================================================

const SUPABASE_URL  = 'https://vttzjbmzduqtgnrjtijn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_B1wwPg-kHhoknMbla9-FEA_MlnJNUHJ';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Lien « mot de passe oublié » : on lit le hash AVANT que supabase-js ne le consomme.
const AUTH_RECOVERY   = location.hash.includes('type=recovery');
const AUTH_LINK_ERROR = /error_code=otp_expired|error=access_denied/.test(location.hash);

// =====================================================
// NAVIGATION GLOBALE ENTRE ÉCRANS (routeur léger)
// Tous les écrans plein page sont des .screen-view ; on bascule
// .hidden.
// =====================================================
const APP_SCREENS = ['loading-screen', 'login-screen', 'home-screen', 'app-screen', 'rules-screen', 'homebrew-screen', 'legal-screen', 'pricing-screen'];
window.navTo = function (id) {
    APP_SCREENS.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.toggle('hidden', s !== id);
    });
    document.body.classList.toggle('rules-active', id === 'rules-screen');
    try { document.dispatchEvent(new CustomEvent('screen:change', { detail: { id } })); } catch (e) {}
};

window.SupaAuth = {
    client: _supabase,
    currentUser: null,

    async getUser() {
        const { data: { user } } = await _supabase.auth.getUser();
        if (user) { this.currentUser = user; return user; }
        // `getUser` interroge le serveur : hors ligne, il ne répond rien. La
        // session déjà gardée par supabase-js fait alors foi, sinon recharger
        // la page sans réseau renverrait le joueur à l'écran de connexion — et
        // ses modifications en attente seraient hors de portée.
        try {
            const { data: { session } } = await _supabase.auth.getSession();
            this.currentUser = (session && session.user) || null;
        } catch (e) { this.currentUser = null; }
        return this.currentUser;
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

    // `archived` et `sort_order` sont ajoutées par « Archivage et ordre des personnages.sql ». Elles sont OPTIONNELLES :
    // si la migration n'a pas été appliquée, la requête échoue et on retombe sur la
    // sélection de base — l'archivage et l'ordre restent alors locaux au navigateur.
    charMetaColumns: false,

    /** La liste du cloud, ou `null` si elle n'a PAS pu être lue (hors ligne,
     *  panne) — à ne pas confondre avec « aucun personnage ». */
    async loadCharacters() {
        if (!this.currentUser) return [];
        const query = (cols) => _supabase
            .from('characters')
            .select(cols)
            .eq('user_id', this.currentUser.id)
            .order('created_at', { ascending: true });

        let res = await query('id, name, level, class, archived, sort_order');
        if (res.error) {
            this.charMetaColumns = false;
            res = await query('id, name, level, class');
        } else {
            this.charMetaColumns = true;
        }
        if (res.error) { console.warn('loadCharacters:', res.error); return null; }
        return res.data || [];
    },

    // Pousse archivage / ordre vers le cloud. Sans la migration SQL, ne fait rien
    // (les préférences restent alors purement locales).
    async saveCharacterMeta(charId, fields) {
        if (!this.currentUser || !this.charMetaColumns || !charId) return;
        const { error } = await _supabase.from('characters')
            .update(fields)
            .eq('id', charId).eq('user_id', this.currentUser.id);
        if (error) console.warn('saveCharacterMeta:', error);
    },

    async createCharacter(name) {
        if (!this.currentUser) return null;
        const { data, error } = await _supabase
            .from('characters')
            .insert({ user_id: this.currentUser.id, name, level: 1, class: '' })
            .select().single();
        if (error) {
            console.warn('createCharacter:', error);
            // 42501 = la RLS a refusé. Sur cette table, la seule raison est le
            // quota de fiches synchronisées : autant le dire, plutôt que de
            // laisser croire à une panne.
            if (error.code === '42501' || /row-level security/i.test(error.message || '')) {
                this.lastCreateError = 'quota';
            } else {
                this.lastCreateError = 'erreur';
            }
            return null;
        }
        this.lastCreateError = null;
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
};

// =====================================================
// QUEUE DE SYNC — la file d'attente des écritures
//
// Une file PAR PERSONNAGE, gardée dans le navigateur sous
// `dnd-file-sync_<id>` : ce qui n'est pas encore parti survit au
// rechargement, à la fermeture de l'onglet et à la coupure de réseau.
//
// Trois règles, pour ne jamais rien perdre :
//   1. rien ne quitte la file avant d'avoir été ACCEPTÉ par le cloud ;
//   2. une clé modifiée PENDANT l'envoi reste en attente, avec sa nouvelle
//      valeur (on ne retire que ce qui n'a pas bougé) ;
//   3. une clé en attente n'est jamais écrasée par ce que renvoie le cloud
//      (voir `retientCle`, utilisé au chargement des données plus bas).
//
// L'envoi est retenté avec un délai qui grandit (2 s, 4 s, 8 s, 15 s, 30 s,
// puis 60 s), et relancé dès qu'un signe de vie apparaît : retour du réseau,
// retour sur l'onglet, ou départ de la page.
// =====================================================
const SYNC_PREFIXE = 'dnd-file-sync_';
const SYNC_DELAIS  = [2000, 4000, 8000, 15000, 30000, 60000];

window.SyncQueue = {
    charId: null,
    timer: null,
    reprise: null,
    echecs: 0,
    enVol: false,

    /** Les clés en attente d'un personnage : { clé: valeur }. */
    attente(charId) {
        if (!charId) return {};
        try {
            const brut = localStorage.getItem(SYNC_PREFIXE + charId);
            const o = brut ? JSON.parse(brut) : null;
            return (o && typeof o === 'object') ? o : {};
        } catch (e) { return {}; }
    },

    _ecrire(charId, o) {
        try {
            if (!o || !Object.keys(o).length) localStorage.removeItem(SYNC_PREFIXE + charId);
            else localStorage.setItem(SYNC_PREFIXE + charId, JSON.stringify(o));
        } catch (e) { console.warn('File de synchro : écriture impossible.', e); }
    },

    /** Les personnages qui ont encore quelque chose à envoyer. */
    personnages() {
        const out = [];
        try {
            Object.keys(localStorage).forEach(k => {
                if (!k.startsWith(SYNC_PREFIXE)) return;
                const id = k.slice(SYNC_PREFIXE.length);
                if (Object.keys(this.attente(id)).length) out.push(id);
            });
        } catch (e) {}
        return out;
    },

    /** Combien de clés attendent encore, tous personnages confondus. */
    enAttente() {
        return this.personnages().reduce((n, id) => n + Object.keys(this.attente(id)).length, 0);
    },

    /** Vrai si cette clé n'est pas encore partie : le cloud ne doit pas l'écraser. */
    retientCle(charId, cle) {
        return Object.prototype.hasOwnProperty.call(this.attente(charId), cle);
    },

    push(charId, key, value) {
        if (!charId) return;
        this.charId = charId;
        const o = this.attente(charId);
        o[key] = String(value);
        this._ecrire(charId, o);
        this.signaler();
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.flush(), 800);
    },

    async flush() {
        clearTimeout(this.timer);   this.timer = null;
        clearTimeout(this.reprise); this.reprise = null;
        if (this.enVol) return;                          // un envoi est déjà en cours
        const ids = this.personnages();
        if (!ids.length) { this.echecs = 0; this.signaler(); return; }
        // Sans compte connecté, la file attend simplement son heure.
        if (!window.SupaAuth?.currentUser) { this.signaler(); return; }

        this.enVol = true;
        this.signaler();
        let echec = false;
        for (const id of ids) {
            const instantane = this.attente(id);
            const entries = Object.entries(instantane).map(([key, value]) => ({ key, value }));
            if (!entries.length) continue;
            try {
                await window.SupaAuth.saveKeys(id, entries);
                // On ne retire que ce qui n'a pas bougé pendant l'envoi.
                const maintenant = this.attente(id);
                entries.forEach(({ key, value }) => { if (maintenant[key] === value) delete maintenant[key]; });
                this._ecrire(id, maintenant);
            } catch (e) {
                console.warn('Synchro : envoi refusé, la file est conservée.', e);
                echec = true;
            }
        }
        this.enVol = false;

        if (echec) {
            const delai = SYNC_DELAIS[Math.min(this.echecs, SYNC_DELAIS.length - 1)];
            this.echecs++;
            this.reprise = setTimeout(() => this.flush(), delai);
        } else {
            this.echecs = 0;
        }
        this.signaler();
    },

    /** Relance demandée par le joueur (clic sur l'icône) : on repart de zéro. */
    reessayer() { this.echecs = 0; return this.flush(); },

    /** Avant de quitter la page : on tente l'envoi sans bloquer la navigation.
     *  Rien n'est perdu si le délai expire — la file est déjà sur le disque. */
    quitter() {
        return Promise.race([
            this.flush(),
            new Promise(r => setTimeout(r, 1500))
        ]).catch(() => {});
    },

    signaler() { try { window.SyncEtat?.maj(); } catch (e) {} }
};

// =====================================================
// ÉTAT DE LA SYNCHRO — une icône discrète près du nom
//
// Cinq états : à jour, envoi, en attente (N), hors ligne, erreur.
// L'icône garde sa place et ne recouvre rien. Tant qu'il reste quelque chose
// à envoyer, un clic relance l'envoi tout de suite.
// =====================================================
window.SyncEtat = {
    ETATS: {
        ajour:        { icone: '✓', titre: 'Tout est enregistré.' },
        envoi:        { icone: '↻', titre: 'Envoi en cours…' },
        attente:      { icone: '⇡', titre: 'modification(s) en attente d’envoi. Clique pour envoyer maintenant.' },
        'hors-ligne': { icone: '⊘', titre: 'Hors ligne : tout est gardé sur cet appareil et partira au retour du réseau.' },
        erreur:       { icone: '!', titre: 'L’envoi a échoué. Clique pour réessayer.' }
    },

    /** L'état, maintenant. */
    lire() {
        const q = window.SyncQueue;
        const n = q ? q.enAttente() : 0;
        if (q && q.enVol) return { etat: 'envoi', n };
        if (!navigator.onLine) return { etat: n ? 'hors-ligne' : 'ajour', n };
        if (n && q && q.echecs > 0) return { etat: 'erreur', n };
        if (n) return { etat: 'attente', n };
        return { etat: 'ajour', n: 0 };
    },

    maj() {
        const el = document.getElementById('sync-etat');
        if (!el) return;
        const { etat, n } = this.lire();
        const def = this.ETATS[etat];
        el.dataset.etat = etat;
        const icone = el.querySelector('.sync-icone');
        const nb = el.querySelector('.sync-nb');
        if (icone) icone.textContent = def.icone;
        if (nb) nb.textContent = (etat !== 'ajour' && etat !== 'envoi' && n) ? String(n) : '';
        const texte = etat === 'attente' ? n + ' ' + def.titre : def.titre;
        el.title = texte;
        el.setAttribute('aria-label', 'Sauvegarde : ' + texte);
        el.disabled = (etat === 'ajour' || etat === 'envoi');
        // La zone annoncée vit À CÔTÉ du bouton : à l'état « à jour » celui-ci est
        // désactivé, et un lecteur d'écran ne lirait pas ce qu'il contient.
        const annonce = document.querySelector('.sync-annonce');
        if (annonce && annonce.textContent !== texte) annonce.textContent = texte;
    },

    brancher() {
        const el = document.getElementById('sync-etat');
        if (el && !el.dataset.branche) {
            el.dataset.branche = '1';
            el.addEventListener('click', () => { window.SyncQueue?.reessayer(); });
        }
        this.maj();
    }
};

// Les rendez-vous où l'on tente d'envoyer : retour du réseau, retour sur
// l'onglet, et départ de la page (sur téléphone, un onglet qu'on quitte passe
// par `pagehide`, jamais par `beforeunload`).
window.addEventListener('online',  () => { window.SyncQueue.reessayer(); });
window.addEventListener('offline', () => { window.SyncEtat.maj(); });
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') window.SyncQueue.flush();
    else window.SyncQueue.reessayer();
});
window.addEventListener('pagehide', () => { window.SyncQueue.flush(); });

// =====================================================
// CHARGEMENT DES DONNÉES EN CACHE LOCAL
// =====================================================
// Une clé encore en attente d'envoi est PLUS RÉCENTE que le cloud : on la
// garde telle quelle, et c'est sa valeur locale qui fait foi partout.
// Sans ça, ouvrir un personnage écrasait les modifications faites hors ligne.
function poserCleCloud(charId, key, value) {
    if (window.SyncQueue?.retientCle(charId, key)) return;
    try { localStorage.setItem(`${charId}_${key}`, value); }
    catch (e) { console.warn('Stockage local plein : clé non écrite', key, e); }
}
/** La valeur qui fait foi pour une clé : celle qui attend, sinon celle du cloud. */
function valeurRetenue(charId, key, cloud) {
    const attente = window.SyncQueue?.attente(charId) || {};
    return Object.prototype.hasOwnProperty.call(attente, key) ? attente[key] : cloud;
}

async function loadUserDataIntoLocalStorage(userId) {
    const characters = await SupaAuth.loadCharacters();
    // Liste illisible (hors ligne, panne) : on garde celle du navigateur.
    // L'écraser par une liste vide ferait disparaître tous les personnages
    // de l'accueil — et l'accueil est le seul chemin vers eux.
    if (!characters) {
        if (typeof window.renderHomeScreen === 'function') window.renderHomeScreen();
        return;
    }

    await Promise.all(characters.map(async (c) => {
        const data = await SupaAuth.loadCharacterData(c.id);
        Object.entries(data).forEach(([key, value]) => {
            poserCleCloud(c.id, key, value);
        });
        
        const sheetName  = valeurRetenue(c.id, 'dnd-sheet-char-name',  data['dnd-sheet-char-name']);
        const sheetLevel = valeurRetenue(c.id, 'dnd-sheet-char-level', data['dnd-sheet-char-level']);
        const sheetClass = valeurRetenue(c.id, 'dnd-sheet-char-class', data['dnd-sheet-char-class']);
        if(sheetName  && sheetName  !== 'undefined') c.name  = sheetName;
        if(sheetLevel && sheetLevel !== 'undefined') c.level = parseInt(sheetLevel) || c.level;
        if(sheetClass && sheetClass !== 'undefined') c.class = sheetClass;
    }));

    localStorage.setItem('dnd-character-list', JSON.stringify(characters));

    // L'édition du personnage est une clé comme les autres : elle vient
    // d'arriver du cloud, on la remet en vigueur (edition.js).
    window.Edition?.relire();
    // Les classes du personnage sont une cle comme les autres : la pastille
    // multiclasse du champ Classe se remet d'accord avec ce qui vient d'arriver.
    window.majPastilleClasses?.();
    if (typeof window.renderHomeScreen === 'function') window.renderHomeScreen();
}

async function loadCharacterDataIntoLocalStorage(charId) {
    const data = await SupaAuth.loadCharacterData(charId);
    Object.entries(data).forEach(([key, value]) => {
        poserCleCloud(charId, key, value);
    });
    window.Edition?.relire();
    // Les classes du personnage sont une cle comme les autres : la pastille
    // multiclasse du champ Classe se remet d'accord avec ce qui vient d'arriver.
    window.majPastilleClasses?.();
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
        window.Ent?.attach(user);
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
            // réinitialisait l'écran à chaque retour de focus (+ risque
            // d'écraser des modifications locales non sauvegardées).
            const loginVisible = !document.getElementById('login-screen').classList.contains('hidden');
            const loadingVisible = !document.getElementById('loading-screen').classList.contains('hidden');
            window.Ent?.attach(session.user);
            if (loginVisible || loadingVisible) {
                showScreen('home-screen');
                loadUserDataIntoLocalStorage(session.user.id);
            }
        }
        if (event === 'SIGNED_OUT') {
            window.Ent?.detach();
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
        if (!await window.Dialogue.confirmer({
            titre: 'Se déconnecter', icone: '⚿',
            message: 'Te déconnecter de ce compte sur cet appareil ?',
            confirmer: 'Se déconnecter'
        })) return;
        await SyncQueue.quitter();
        // La déconnexion vide le stockage de cet appareil : si quelque chose
        // n'est pas encore parti, on le dit AVANT, pas après.
        const reste = SyncQueue.enAttente();
        if (reste && !await window.Dialogue.confirmer({
            titre: 'Des modifications ne sont pas envoyées', danger: true, icone: '⚠',
            message: reste + ' modification(s) attendent encore le réseau. Te déconnecter maintenant les perdrait.\n\n'
                   + 'Reconnecte-toi à Internet et attends l’icône « tout est enregistré », ou déconnecte-toi quand même.',
            confirmer: 'Se déconnecter quand même'
        })) return;
        await SupaAuth.signOut();
        location.reload();
    });


    // --- Afficher / masquer les mots de passe ---
    // Appliqué à tous les champs `type="password"` de la page : chaque champ reçoit un
    // œil cliquable. Générique, donc tout futur champ en bénéficie sans modification.
    document.querySelectorAll('input[type="password"]').forEach(input => {
        if (input.parentElement && input.parentElement.classList.contains('pw-wrap')) return;
        const wrap = document.createElement('div');
        wrap.className = 'pw-wrap';
        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);

        const eye = document.createElement('button');
        eye.type = 'button';                 // sans ça, le bouton soumettrait le formulaire
        eye.className = 'pw-eye';
        eye.textContent = '👁';
        eye.title = 'Afficher le mot de passe';
        eye.setAttribute('aria-label', 'Afficher le mot de passe');
        eye.setAttribute('aria-pressed', 'false');
        eye.addEventListener('click', () => {
            const shown = input.type === 'text';
            input.type = shown ? 'password' : 'text';
            eye.textContent = shown ? '👁' : '🙈';
            const label = shown ? 'Afficher le mot de passe' : 'Masquer le mot de passe';
            eye.title = label;
            eye.setAttribute('aria-label', label);
            eye.setAttribute('aria-pressed', shown ? 'false' : 'true');
            input.focus();
        });
        wrap.appendChild(eye);
    });
    // L'icône d'état vit dans la fiche : on la branche une fois la page prête.
    // Les envois, eux, sont déclenchés plus haut par `online`, `visibilitychange`
    // et `pagehide`.
    window.SyncEtat.brancher();
    SyncQueue.flush();   // ce qui restait d'une session précédente part maintenant
});