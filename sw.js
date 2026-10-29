// Offline support. The precache list and VERSION are rewritten by
// `node tools/update-sw.mjs` — run it after changing any app file so installed
// apps pick up the new version.
const VERSION = 'b277f7b43c';
const PRECACHE = [
  './',
  'css/app.css',
  'css/screens/chart.css',
  'css/screens/drills.css',
  'css/screens/import.css',
  'css/screens/knowledge.css',
  'css/screens/map.css',
  'css/screens/mode-cloze.css',
  'css/screens/practice.css',
  'css/screens/process.css',
  'css/screens/settings.css',
  'css/screens/task.css',
  'css/screens/tasks.css',
  'css/screens/today.css',
  'css/screens/write.css',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon.svg',
  'icons/maskable-512.png',
  'index.html',
  'js/app.js',
  'js/core/charts.js',
  'js/core/claude-prompts.js',
  'js/core/describe.js',
  'js/core/drills.js',
  'js/core/english.js',
  'js/core/grade.js',
  'js/core/json.js',
  'js/core/kb-prompt.js',
  'js/core/kb-schema.js',
  'js/core/knowledge.js',
  'js/core/lint.js',
  'js/core/maps.js',
  'js/core/marked.js',
  'js/core/process.js',
  'js/core/rng.js',
  'js/core/srs.js',
  'js/core/task-import.js',
  'js/core/tasks.js',
  'js/core/text.js',
  'js/core/topics.js',
  'js/core/util.js',
  'js/data/core-pack.js',
  'js/data/db.js',
  'js/data/seed.js',
  'js/data/store.js',
  'js/render/chart-svg.js',
  'js/render/map-svg.js',
  'js/render/process-svg.js',
  'js/screens/claude-task.js',
  'js/screens/entry-edit.js',
  'js/screens/entry.js',
  'js/screens/import.js',
  'js/screens/index.js',
  'js/screens/knowledge.js',
  'js/screens/packs.js',
  'js/screens/practice/cards.js',
  'js/screens/practice/practice.js',
  'js/screens/practice/results.js',
  'js/screens/settings.js',
  'js/screens/shared.js',
  'js/screens/task.js',
  'js/screens/tasks.js',
  'js/screens/today.js',
  'js/screens/write.js',
  'js/ui/clipboard.js',
  'js/ui/components.js',
  'js/ui/dom.js',
  'js/ui/files.js',
  'js/ui/icons.js',
  'js/ui/router.js',
  'js/ui/speech.js',
  'js/ui/viewport.js',
  'manifest.webmanifest',
];

// Every app on johnbui765.github.io shares one origin, so this app's caches
// carry their own prefix and the worker only ever deletes caches with it.
const PREFIX = 'ielts-task1-';
const CACHE = `${PREFIX}${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// The same response without the "redirected" mark.
async function plainCopy(response) {
  const body = await response.blob();
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App navigations always get the cached shell (works offline).
  // Some hosts (Cloudflare Pages) answer index.html with a redirect to ./, and a browser refuses
  // to show a page from a redirected response. So ./ is tried first, and a redirected copy is
  // turned into a plain one before it is used.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = (await cache.match('./')) || (await cache.match('index.html'));
        if (cached && cached.redirected) return plainCopy(cached);
        if (cached) return cached;
        return fetch(request);
      })(),
    );
    return;
  }

  // Static files: cache first, then network (and remember the response).
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') cache.put(request, response.clone());
        return response;
      } catch (err) {
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })(),
  );
});
