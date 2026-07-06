// =====================================================
// Service worker — stratégie RÉSEAU D'ABORD :
//   • en ligne : toujours la version fraîche (et on met le cache à jour) ;
//   • hors ligne : on sert la dernière version en cache.
// Ainsi les mises à jour du site ne restent jamais bloquées par le cache.
// =====================================================
const CACHE = 'dnd-companion-v1';

self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;          // CDN / Supabase : laisser passer
    e.respondWith(
        fetch(req)
            .then(res => {
                if (res && res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
                }
                return res;
            })
            .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
});
