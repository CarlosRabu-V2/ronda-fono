/* Service worker: guarda el armazón de la app para que abra sin conexión.
   Los datos NO pasan por aquí: viven en IndexedDB. */

const CACHE = 'ronda-fono-v6';
const ARCHIVOS = ['./', 'index.html', 'styles.css', 'app.js', 'pantallas.js', 'dashboard.js', 'informes.js', 'manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Las llamadas a Apps Script nunca se cachean: si no hay red deben fallar
  // para que la sesión se quede en la bandeja y se reintente después.
  if (url.hostname.includes('google.com') || url.hostname.includes('googleusercontent.com')) return;
  if (e.request.method !== 'GET') return;

  // Responde al instante desde el caché y, en paralelo, se trae la versión nueva
  // para el próximo arranque. Sin esto una actualización no llegaría nunca.
  e.respondWith(
    caches.match(e.request).then(hit => {
      const red = fetch(e.request).then(res => {
        if (res.ok && url.origin === location.origin) {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copia));
        }
        return res;
      }).catch(() => hit || caches.match('index.html'));
      return hit || red;
    })
  );
});
