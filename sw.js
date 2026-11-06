/* Coll · service worker: guarda l'app i les dades per obrir-la sense cobertura.
 * Els àudios van a IndexedDB (botó «Descarrega»), no aquí. Xarxa primer, memòria si no n'hi ha. */
const C = 'coll-v4', TILES = 'coll-mapa-v1';
const SHELL = ['./', 'index.html', 'js/coach.js', 'js/app.js', 'js/historial.js', 'js/mapa.js', 'data/perfil_coll.json', 'data/frases.json', 'audio/index.json',
  'data/sim/2026-11-03.json', 'data/sim/2026-10-30.json'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  // rajoles del mapa (ortofoto): primer la memòria, perquè el mapa es vegi sense cobertura un cop vist o descarregat
  if (e.request.method === 'GET' && /(^|\.)geoserveis\.icgc\.cat$|(^|\.)arcgisonline\.com$/.test(u.hostname)) {
    e.respondWith(caches.open(TILES).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; }))));
    return;
  }
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.endsWith('.mp3')) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
