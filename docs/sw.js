/* Vực Tàn Nguyệt service worker: plays offline after the first visit.
 * - Core files are cached on install; everything else is cached the first time it is used (the game is ~8,000 files, so we never
 *   download it all at once on a phone).
 * - Code and data are "network first, cache as fallback" so players get updates as soon as they are online.
 * - Images and fonts are "cache first". Music is served with Range support, which iOS Safari requires.
 * Bump VERSION when publishing (tools/build_pages.py stamps it automatically). */
const VERSION = 'vtn-20261116-102535';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'data/bundle.js', 'css/v4.css', 'css/theme-v2.css', 'css/ui-system.css', 'css/ui-skin.css', 'css/moonlit-ui.css',
  'assets/pwa/icon-192.png', 'assets/pwa/apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('vtn-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function rangeResponse(request, cache) {
  const key = request.url;
  let full = await cache.match(key);
  if (!full) {
    const net = await fetch(key);                      // whole file, no Range header
    if (!net.ok) return net;
    await cache.put(key, net.clone());
    full = net;
  }
  const buf = await full.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range') || '');
  if (!m) return new Response(buf, {status: 200, headers: {'Content-Type': 'audio/mpeg', 'Content-Length': String(buf.byteLength), 'Accept-Ranges': 'bytes'}});
  const start = m[1] ? parseInt(m[1], 10) : 0, end = m[2] ? Math.min(parseInt(m[2], 10), buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {status: 206, headers: {'Content-Type': 'audio/mpeg', 'Content-Range': 'bytes ' + start + '-' + end + '/' + buf.byteLength, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes'}});
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    if (/\.mp3$/i.test(url.pathname)) return rangeResponse(req, cache);
    const code = req.mode === 'navigate' || /\.(html|js|json|css|webmanifest)$/i.test(url.pathname);
    if (code) {
      try {
        const net = await fetch(req);
        if (net && net.ok) cache.put(req, net.clone());
        return net;
      } catch (e) {
        const hit = await cache.match(req, {ignoreSearch: true}) || (req.mode === 'navigate' ? await cache.match('index.html') : null);
        if (hit) return hit;
        throw e;
      }
    }
    const hit = await cache.match(req, {ignoreSearch: true});
    if (hit) return hit;
    const net = await fetch(req);
    if (net && net.ok) cache.put(req, net.clone());
    return net;
  })());
});
