/* CLARIA · Service worker (modo sin conexión básico).
   Archivos propios: primero la red y, si no hay, la copia guardada; pictogramas: primero la copia. Nunca guarda llamadas a /api ni a otros sitios. */
const V = 'claria-v1', CORE = ['./', 'index.html', 'styles.css', 'guia.css', 'foto.css', 'tablero.css', 'lugares.css', 'creador.css', 'ciudad.js', 'entender-core.js', 'entender.js', 'entender.css', 'decilo.css', 'editor.js', 'editor.css', 'data/ciudad.json', 'data/ciudad-revisiones.json', 'picto.css', 'cine.css', 'app.js', 'guia.js', 'pictos.js', 'exportar.js', 'convertidor.js', 'pictocuento.js', 'tablero.js', 'lugares.js', 'creador.js', 'vendor/jsQR.js', 'cine.js', 'privacy.js', 'config.js', 'data/pictogramas.json', 'data/tablero.json', 'data/lugares.json'];
// Instalación: archivos propios y, además, los pictogramas locales del diccionario (para que los tableros y guías funcionen sin conexión).
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then(async (c) => {
  await Promise.all(CORE.map((u) => c.add(u).catch(() => {})));
  try { const d = await (await fetch('data/pictogramas.json')).json(); const ids = [...new Set([...d.entradas.map((x) => x.id), ...(d.expresiones || []).map((x) => x.id)])]; await Promise.all(ids.map((i) => c.add(`assets/picto/${i}.png`).catch(() => {}))); } catch (_) {}
}).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request; const u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  if (u.pathname.includes('/assets/picto/')) { e.respondWith(caches.match(r).then((m) => m || fetch(r).then((x) => { if (x.ok) { const c = x.clone(); caches.open(V).then((ch) => ch.put(r, c)); } return x; }))); return; }
  e.respondWith(fetch(r).then((x) => { if (x.ok) { const c = x.clone(); caches.open(V).then((ch) => ch.put(r, c)); } return x; }).catch(() => caches.match(r, { ignoreSearch: true }).then((m) => m || caches.match('index.html'))));
});
