/* Coll · service worker: guarda l'app i les dades per obrir-la sense cobertura.
 * Els àudios van a IndexedDB (botó «Descarrega»), no aquí. Xarxa primer, memòria si no n'hi ha. */
const C = 'coll-v2';
const SHELL = ['./', 'index.html', 'js/coach.js', 'js/app.js', 'data/perfil_coll.json', 'data/frases.json', 'audio/index.json',
  'data/sim/2026-11-03.json', 'data/sim/2026-10-30.json'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.endsWith('.mp3')) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
