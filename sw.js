// =====================================================
// Service worker — stratégie RÉSEAU D'ABORD, avec repli sur le cache :
//   • en ligne : toujours la version fraîche (et on met le cache à jour) ;
//   • réseau muet plus de 2,5 s : on sert la version en cache sans attendre
//     (la réponse du réseau, quand elle arrive, rafraîchit quand même le cache) ;
//   • hors ligne : la dernière version en cache.
//
// À l'installation, l'essentiel est mis en cache : une fiche s'ouvre hors
// ligne dès la première visite, même si le joueur n'a pas tout parcouru.
//
// Une nouvelle version ne prend JAMAIS la main toute seule : elle attend, et
// la page propose un bandeau « Nouvelle version — recharger » (index.html).
// C'est le clic du joueur qui envoie `PRENDRE_LA_MAIN`.
//
// `srd-data-v1` appartient à srd-data.js (les règles hors connexion) : on n'y
// touche jamais, ni pour écrire ni pour purger.
// =====================================================
const VERSION = 'v9';
const CACHE = 'dnd-companion-' + VERSION;
const DELAI_RESEAU = 2500;

// L'essentiel : de quoi afficher l'accueil et ouvrir une fiche sans réseau.
// Les modules chargés à la demande (charger.js, LOT 10) y sont aussi : la page
// ne les demande qu'au premier usage, et ce premier usage peut être hors ligne.
// Le reste (cartes de sorts, cimetière, images…) entre dans le cache à la
// première visite, puisque chaque réponse reçue y est recopiée.
const ESSENTIEL = [
    './', './index.html',
    './style.css', './themes.css',
    './toasts.js', './charger.js', './dialogues.js', './auth.js', './effets.js',
    './srd-data.js', './edition.js', './srd-autocomplete.js', './calcul.js', './script.js', './jets.js',
    './armor.js', './etats.js', './exploits.js', './menu.js', './entitlements.js', './cosmetics.js', './pricing.js',
    './multiclasse.js', './lancer-sort.js', './effets-actifs.js', './formes.js', './stats-des.js',
    './bourse.js', './macros.js', './bestiaire.js', './carnet.js',
    './confort.js', './coffre.js', './seance.js', './vitrine.js', './des3d.js',
    // À la demande (LOT 10)
    './secrets.js', './secrets-monde.js', './exploits-suivi.js', './secrets-plus.js', './secrets-absurdes.js',
    './hero-card.js', './hero-card-styles.js', './music-player.js', './music-player.css',
    './fiche-layout.js', './print-sheet.js', './sheet-io.js', './homebrew.js', './rules-page.js',
    './help.js', './pj-tutorial.js', './legal.js',
    './style-carte-heros.css', './style-regles.css', './style-contenu-perso.css', './style-export-import.css',
    './style-legal.css', './style-aide.css', './style-assistant.css', './style-multiclasse.css', './style-jets.css',
    './style-effets-actifs.css', './style-formes.css', './style-stats-des.css', './style-admin.css',
    './style-tarifs.css', './style-imprimer.css',
    './manifest.webmanifest', './IMG/logo-192.png', './favicon-32.png'
];

self.addEventListener('install', (e) => {
    // Chaque fichier est mis en cache séparément : un seul absent ne doit pas
    // faire échouer toute l'installation (addAll est tout ou rien).
    e.waitUntil(caches.open(CACHE).then(c => Promise.all(
        ESSENTIEL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))
    )));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE && k.startsWith('dnd-companion-')).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// Le bandeau de la page demande le passage à la nouvelle version.
self.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'PRENDRE_LA_MAIN') self.skipWaiting();
});

/** Réseau d'abord ; le cache prend le relais au bout de DELAI_RESEAU ou en cas d'échec. */
function reseauDAbord(req) {
    return new Promise((resolve) => {
        let rendu = false;
        const rendre = (res) => { if (!rendu && res) { rendu = true; clearTimeout(minuteur); resolve(res); } };

        const minuteur = setTimeout(() => {
            caches.match(req).then(hit => rendre(hit));
        }, DELAI_RESEAU);

        fetch(req).then(res => {
            if (res && res.ok) {
                const copie = res.clone();
                caches.open(CACHE).then(c => c.put(req, copie)).catch(() => {});
            }
            rendre(res);
        }).catch(() => {
            caches.match(req).then(hit => {
                if (hit) return rendre(hit);
                // Une navigation sans réseau ni cache retombe sur la page d'accueil,
                // qui sait s'afficher hors ligne.
                if (req.mode === 'navigate') return caches.match('./index.html').then(p => rendre(p || Response.error()));
                rendre(Response.error());
            });
        });
    });
}

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;          // CDN / Supabase : laisser passer
    e.respondWith(reseauDAbord(req));
});
