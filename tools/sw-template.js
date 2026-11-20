const scope = self.registration.scope;
const prefix = 'cuentas-claras:' + scope + ':';
const version = '__CACHE_VERSION__';
const cacheName = prefix + version;
const shell = new Set(__SHELL_FILES__.map(path => new URL(path, scope).href));
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
