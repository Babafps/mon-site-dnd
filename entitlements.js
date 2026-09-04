// =====================================================
// entitlements.js — ce à quoi ce compte a droit
//
// Un seul point d'entrée : `Ent.has('des-obsidienne')`.
//
// Ce module ne fait que LIRE. Il n'écrit jamais dans Supabase, et il ne
// saurait pas : la table n'a aucune politique d'écriture (voir
// docs/entitlements.sql). Tricher ici débloque du décor, rien d'autre — tout
// ce qui coûte des ressources est refusé par la base, pas par ce fichier.
//
// Trois choses comptent :
//   · le cache, pour que la fiche s'affiche juste sans attendre le réseau ;
//   · le repli hors connexion : on garde le dernier état connu et on NE COUPE
//     PAS l'accès. Quelqu'un qui a payé et qui joue dans une cave ne doit pas
//     voir ses dés redevenir gris ;
//   · l'heure du serveur fait foi : la vue `my_entitlements` ne renvoie que ce
//     qui est actif à l'instant où on demande, l'horloge du navigateur n'a pas
//     voix au chapitre.
// =====================================================
(function () {
    'use strict';

    const CACHE_PREFIX = 'dnd-ent-';
    const FRESH_MS = 5 * 60 * 1000;        // au-delà, on retente le réseau
    const PRODUCTS = {
        // clé technique  →  ce qu'on en dit à l'écran
        'abonnement':      'Abonnement',
        'des-obsidienne':  'Dés d’obsidienne',
        'des-os':          'Dés en os',
        'des-laiton':      'Dés de laiton',
        'des-cristal':     'Dés de cristal',
        'fonds-de-page':   'Arrière-plans',
        'palette-libre':   'Palette de couleurs libre',
        'cadres':          'Cadres de portrait'
    };

    let userId = null;
    let items = [];              // [{product, expires_at}]
    let fetchedAt = 0;
    let stale = true;            // true = ce qu'on montre vient du cache
    let inflight = null;
    const listeners = [];

    const cacheKey = () => CACHE_PREFIX + (userId || 'anon');

    function readCache() {
        try {
            const raw = localStorage.getItem(cacheKey());
            if (!raw) return null;
            const o = JSON.parse(raw);
            return (o && Array.isArray(o.items)) ? o : null;
        } catch (e) { return null; }
    }

    function writeCache() {
        try {
            localStorage.setItem(cacheKey(), JSON.stringify({ at: fetchedAt, items }));
        } catch (e) { /* stockage plein : le module marche quand même, en mémoire */ }
    }

    /** Le corps porte la liste : le décor payant se laisse alors piloter en CSS
     *  seul, sans que chaque module ait à interroger ce fichier. */
    function paint() {
        const list = items.map(i => i.product).join(' ');
        document.body?.setAttribute('data-ent', list);
        document.body?.classList.toggle('ent-subscriber', has('abonnement'));
    }

    function announce() {
        paint();
        const detail = { items: items.slice(), stale };
        listeners.forEach(fn => { try { fn(detail); } catch (e) {} });
        try { document.dispatchEvent(new CustomEvent('entitlements:change', { detail })); } catch (e) {}
    }

    function has(product) {
        if (!product) return false;
        const it = items.find(i => i.product === product);
        if (!it) return false;
        // Hors connexion, on ne coupe rien : le dernier état connu vaut accord.
        if (stale) return true;
        return !it.expires_at || new Date(it.expires_at).getTime() > Date.now();
    }

    /** Va chercher la vérité au serveur. Jamais bloquant pour l'affichage. */
    async function refresh(force) {
        const sb = window.SupaAuth;
        if (!sb || !sb.currentUser) { return items; }
        if (inflight) return inflight;
        if (!force && !stale && Date.now() - fetchedAt < FRESH_MS) return items;

        inflight = (async () => {
            try {
                const { data, error } = await sb.client
                    .from('my_entitlements')
                    .select('product, expires_at');
                if (error) throw error;
                items = (data || []).map(r => ({ product: r.product, expires_at: r.expires_at }));
                fetchedAt = Date.now();
                stale = false;
                writeCache();
            } catch (e) {
                // Réseau coupé, table absente, projet en pause : on garde ce
                // qu'on avait. Un droit acheté ne disparaît pas parce que le
                // wifi tousse.
                stale = true;
                console.warn('[droits] lecture impossible, on garde le cache :', e.message || e);
            } finally {
                inflight = null;
                announce();
            }
            return items;
        })();
        return inflight;
    }

    /** Appelé à la connexion (et au démarrage si une session existe déjà). */
    function attach(user) {
        const id = user && user.id;
        if (id === userId && items.length) { refresh(); return; }
        userId = id || null;
        const cached = readCache();
        items = cached ? cached.items : [];
        fetchedAt = cached ? (cached.at || 0) : 0;
        stale = true;                      // tant que le réseau n'a pas parlé
        announce();
        refresh(true);
    }

    function detach() {
        userId = null; items = []; fetchedAt = 0; stale = true;
        announce();
    }

    // ---------- Quota de fiches synchronisées ----------
    // Purement informatif : c'est la base qui refuse, pas ce compteur. Il sert
    // à prévenir AVANT le clic plutôt qu'à expliquer après l'échec.
    const FREE_CHARACTERS = 3;
    function characterQuota() {
        let used = 0;
        try {
            const raw = localStorage.getItem('dnd-character-list');
            used = (JSON.parse(raw || '[]') || []).length;
        } catch (e) {}
        const unlimited = has('abonnement') || !window.SupaAuth?.currentUser;
        return { used, max: unlimited ? Infinity : FREE_CHARACTERS, unlimited,
                 left: unlimited ? Infinity : Math.max(0, FREE_CHARACTERS - used) };
    }

    // ---------- Branchements ----------
    document.addEventListener('DOMContentLoaded', () => {
        paint();
        // Une session peut déjà exister au chargement : auth.js préviendra,
        // mais on tente tout de suite si l'utilisateur est déjà là.
        if (window.SupaAuth?.currentUser) attach(window.SupaAuth.currentUser);
    });
    // Le retour de l'onglet est le bon moment pour vérifier : c'est là qu'un
    // achat fait dans un autre onglet vient d'aboutir.
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && window.SupaAuth?.currentUser) refresh();
    });
    window.addEventListener('online', () => refresh(true));

    window.Ent = {
        has,
        list: () => items.slice(),
        label: (p) => PRODUCTS[p] || p,
        products: PRODUCTS,
        isSubscriber: () => has('abonnement'),
        expiresAt: (p) => (items.find(i => i.product === p) || {}).expires_at || null,
        isStale: () => stale,
        refresh,
        attach,
        detach,
        characterQuota,
        FREE_CHARACTERS,
        onChange: (fn) => { if (typeof fn === 'function') listeners.push(fn); }
    };
})();
