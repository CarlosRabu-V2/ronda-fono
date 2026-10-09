/* Service worker: guarda el armazón de la app para que abra sin conexión.
   Los datos NO pasan por aquí: viven en IndexedDB. */

const CACHE = 'ronda-fono-v11';
const ARCHIVOS = ['./', 'index.html', 'styles.css', 'app.js', 'pantallas.js', 'dashboard.js', 'informes.js', 'manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  // cache: 'reload' salta la caché HTTP del navegador. GitHub Pages la deja
  // diez minutos, y sin esto la versión nueva podía instalarse con archivos viejos.
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ARCHIVOS.map(a => new Request(a, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
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

  // Solo desde el caché de esta versión, que se instala completa o no se
  // instala. Antes cada archivo se refrescaba por su cuenta, y con mala señal
  // podían quedar mezclados un app.js nuevo con un pantallas.js viejo. Las
  // versiones nuevas llegan cambiando CACHE: el navegador revisa sw.js al abrir
  // la app, instala la nueva y la app ofrece recargar.
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).catch(() => caches.match('index.html')))
  );
});
