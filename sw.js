// Generado por node tools/build.mjs.
const scope = self.registration.scope;
const prefix = 'cuentas-claras:' + scope + ':';
const version = 'b7e8e5a1639ffa88';
const cacheName = prefix + version;
const shell = new Set(["index.html","manifest.webmanifest","styles/main.css","styles/base.css","styles/components.css","styles/themes.css","assets/app.bundle.js","assets/cuentas-claras.svg","assets/qrcode.js","assets/lz-string.min.js","assets/jsQR.js","assets/icon-180.png","assets/icon-192.png","assets/icon-512.png"].map(path => new URL(path, scope).href));
const home = new URL('index.html', scope).href;

self.addEventListener('install', event => {
  // Keep the current app running until every window using its old files closes.
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll([...shell].map(url => new Request(url, {cache:'reload'})))
  ));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(prefix) && name !== cacheName).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const entry = url.origin + url.pathname;
  const target = request.mode === 'navigate' && (entry === scope || entry === home)
    ? home
    : shell.has(request.url) ? request.url : null;
  if (!target) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return (await cache.match(target)) || fetch(request);
  })());
});
