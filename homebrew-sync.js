// =====================================================
// homebrew-sync.js — le contenu personnel, d'un appareil à l'autre
//
// La bibliothèque perso (dnd-homebrew) vit dans le navigateur. Ce module en
// dépose une copie sur le compte, et la rapatrie ailleurs.
//
// Trois principes :
//   · LE LOCAL RESTE ENTIER. Sans abonnement, sans réseau, sans compte, la
//     bibliothèque fonctionne exactement comme avant. La synchro est un
//     confort, jamais une condition.
//   · Une ligne PAR ENTRÉE, avec sa date. Deux appareils qui écrivent chacun
//     leur bibliothèque complète s'écraseraient l'un l'autre ; entrée par
//     entrée, la plus récente gagne et rien ne disparaît.
//   · Une suppression voyage. Sans pierre tombale, une classe effacée sur le
//     téléphone reviendrait au prochain rapatriement depuis le bureau.
//
// Le droit d'accès est vérifié PAR LA BASE (docs/abonnement.sql). Ce fichier
// ne fait que s'épargner des requêtes vouées au refus.
// =====================================================
(function () {
    'use strict';

    const SHADOW_KEY = 'dnd-hb-sync';     // ce que la synchro croit savoir
    const DEBOUNCE = 2500;
    const TABLE = 'homebrew_entries';

    let timer = null;
    let running = false;
    let refusedOnce = false;              // on ne crie qu'une fois
    let lastError = null;

    const now = () => new Date().toISOString();
    const client = () => window.SupaAuth?.client || null;
    const user = () => window.SupaAuth?.currentUser || null;
    const allowed = () => !!user() && (window.Ent ? window.Ent.has('abonnement') : false);

    // --- L'ombre : {type/id: {h: empreinte, at: date}} ---
    function shadow() {
        try { return JSON.parse(localStorage.getItem(SHADOW_KEY) || '{}') || {}; }
        catch (e) { return {}; }
    }
    function writeShadow(s) {
        try { localStorage.setItem(SHADOW_KEY, JSON.stringify(s)); } catch (e) {}
    }

    /** Empreinte courte et stable d'une entrée. Sert seulement à repérer un
     *  changement, pas à sécuriser quoi que ce soit. */
    function hash(o) {
        const s = JSON.stringify(o);
        let h = 5381;
        for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
        return s.length + ':' + h.toString(36);
    }

    const keyOf = (type, id) => type + '/' + id;

    /** La bibliothèque locale, à plat : [{type, id, entry}] */
    function localEntries() {
        const hb = window.SRD?.homebrew;
        if (!hb) return [];
        const all = hb.all() || {};
        const out = [];
        Object.keys(all).forEach(type => {
            (all[type] || []).forEach(e => { if (e && e.id) out.push({ type, id: e.id, entry: e }); });
        });
        return out;
    }

    // =====================================================
    // Envoi — ce qui a changé ici part là-bas
    // =====================================================

    async function push() {
        if (!allowed()) return { skipped: 'sans abonnement' };
        const sb = client();
        if (!sb) return { skipped: 'hors ligne' };

        const s = shadow();
        const locals = localEntries();
        const seen = new Set();
        const rows = [];
        const stamp = now();

        locals.forEach(({ type, id, entry }) => {
            const k = keyOf(type, id);
            seen.add(k);
            const h = hash(entry);
            if (s[k] && s[k].h === h && !s[k].pending) return;   // rien de neuf
            rows.push({ user_id: user().id, type, entry_id: id, data: entry,
                        deleted: false, updated_at: stamp });
            s[k] = { h, at: stamp };
        });

        // Ce que l'ombre connaissait et qui n'est plus là : supprimé ici.
        Object.keys(s).forEach(k => {
            if (seen.has(k) || s[k].tomb) return;
            const [type, ...rest] = k.split('/');
            rows.push({ user_id: user().id, type, entry_id: rest.join('/'), data: null,
                        deleted: true, updated_at: stamp });
            s[k] = { h: null, at: stamp, tomb: true };
        });

        if (!rows.length) { writeShadow(s); lastError = null; return { sent: 0 }; }

        const { error } = await sb.from(TABLE).upsert(rows, { onConflict: 'user_id,type,entry_id' });
        if (error) {
            lastError = error;
            // 42501 = la base a refusé : abonnement absent ou expiré. On garde
            // tout en local et on n'insiste pas.
            if (error.code === '42501' || /row-level security/i.test(error.message || '')) {
                if (!refusedOnce) {
                    refusedOnce = true;
                    console.info('[contenu perso] synchronisation refusée : abonnement requis. '
                        + 'La bibliothèque reste entière sur cet appareil.');
                }
                return { refused: true };
            }
            console.warn('[contenu perso] envoi impossible, on réessaiera :', error.message);
            return { error: error.message };
        }
        writeShadow(s);
        // Un tour réussi efface la plainte précédente : sinon l'écran garderait
        // éternellement un avertissement pour une panne d'une seconde.
        lastError = null;
        refusedOnce = false;
        return { sent: rows.length };
    }

    // =====================================================
    // Rapatriement — ce qui est plus récent là-bas revient ici
    // =====================================================

    async function pull() {
        const sb = client();
        if (!sb || !user()) return { skipped: 'hors ligne' };

        // La LECTURE reste ouverte même sans abonnement : ce qui a déjà été
        // déposé doit pouvoir revenir, sinon un abonnement qui s'arrête
        // emporterait le travail avec lui.
        const { data, error } = await sb.from(TABLE)
            .select('type, entry_id, data, deleted, updated_at')
            .eq('user_id', user().id);
        if (error) {
            lastError = error;
            console.warn('[contenu perso] rapatriement impossible :', error.message);
            return { error: error.message };
        }

        lastError = null;
        const hb = window.SRD?.homebrew;
        if (!hb) return { skipped: 'règles pas prêtes' };

        const s = shadow();
        const localMap = new Map(localEntries().map(e => [keyOf(e.type, e.id), e]));
        let added = 0, updated = 0, removed = 0;

        (data || []).forEach(row => {
            const k = keyOf(row.type, row.entry_id);
            const mine = s[k];
            // Le distant ne gagne que s'il est STRICTEMENT plus récent que ce
            // que nous avions déjà envoyé. À égalité, on ne touche à rien.
            if (mine && mine.at && new Date(row.updated_at) <= new Date(mine.at)) return;

            if (row.deleted) {
                if (localMap.has(k)) { try { hb.remove(row.type, row.entry_id); removed++; } catch (e) {} }
                s[k] = { h: null, at: row.updated_at, tomb: true };
                return;
            }
            if (!row.data) return;
            try {
                hb.save(row.type, row.data);
                if (localMap.has(k)) updated++; else added++;
                s[k] = { h: hash(row.data), at: row.updated_at };
            } catch (e) {
                console.warn('[contenu perso] entrée refusée par la bibliothèque :', row.entry_id, e.message);
            }
        });

        writeShadow(s);
        return { added, updated, removed };
    }

    // =====================================================
    // Orchestration
    // =====================================================

    async function sync(reason) {
        if (running || !user()) return null;
        running = true;
        try {
            // On rapatrie AVANT d'envoyer : sinon un appareil en retard
            // écraserait le travail fait ailleurs.
            const down = await pull();
            const up = await push();
            const r = { reason, down, up };
            try { document.dispatchEvent(new CustomEvent('homebrew-sync', { detail: r })); } catch (e) {}
            return r;
        } finally { running = false; }
    }

    function schedule() {
        if (!allowed()) return;
        clearTimeout(timer);
        timer = setTimeout(() => sync('changement'), DEBOUNCE);
    }

    // =====================================================
    // Ce que l'écran en dit
    // La phrase du pied de l'écran « Mon contenu » doit être VRAIE : local
    // seul, ou local plus compte. Elle se met à jour toute seule.
    // =====================================================
    function paintStatus() {
        const el = document.getElementById('hb-sync');
        if (!el) return;
        const u = !!user(), abo = window.Ent ? window.Ent.has('abonnement') : false;
        let txt, cls;
        if (!u) { txt = '📴 Sur cet appareil seulement — connecte-toi pour retrouver ta bibliothèque ailleurs.'; cls = 'is-local'; }
        else if (!abo) { txt = '📴 Sur cet appareil seulement — la synchronisation fait partie de l’abonnement. Rien n’est perdu : l’export reste gratuit.'; cls = 'is-local'; }
        else if (lastError) { txt = '⚠️ Synchronisation en attente : ' + lastError.message; cls = 'is-warn'; }
        else { txt = '☁️ Synchronisé avec ton compte.'; cls = 'is-ok'; }
        el.className = 'hb-sync ' + cls;
        el.textContent = txt;
    }

    // --- Branchements ---
    // hbPersist() émet déjà cet événement à chaque écriture de la bibliothèque.
    document.addEventListener('srd-homebrew-change', () => { schedule(); paintStatus(); });
    document.addEventListener('homebrew-sync', paintStatus);
    document.addEventListener('screen:change', (e) => {
        if (e.detail && e.detail.id === 'homebrew-screen') { paintStatus(); if (allowed()) sync('ouverture'); }
    });
    window.addEventListener('online', () => { if (allowed()) sync('retour du réseau'); });
    window.addEventListener('beforeunload', () => {
        // Dernier envoi au vol : sans await, c'est le mieux qu'on puisse faire
        // avant que la page ne parte.
        if (allowed() && timer) { clearTimeout(timer); push(); }
    });

    // Les droits arrivent après la connexion : c'est le signal d'un premier tour.
    let armed = false;
    function arm() {
        if (armed || !allowed()) return;
        armed = true;
        sync('connexion');
    }
    document.addEventListener('entitlements:change', () => { arm(); paintStatus(); });
    document.addEventListener('DOMContentLoaded', () => { paintStatus(); setTimeout(arm, 1500); });

    window.HomebrewSync = {
        sync, push, pull, allowed, paintStatus,
        /** Pour l'écran : où en est-on ? */
        status: () => ({
            possible: allowed(),
            connecte: !!user(),
            abonne: window.Ent ? window.Ent.has('abonnement') : false,
            suivies: Object.keys(shadow()).length,
            derniereErreur: lastError ? (lastError.message || String(lastError)) : null
        }),
        /** Oublie ce que la synchro croit savoir : le prochain tour renvoie tout. */
        forget: () => { try { localStorage.removeItem(SHADOW_KEY); } catch (e) {} }
    };
})();
