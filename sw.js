// Heptapod Logograms — service worker.
//
// Designed to coexist with the cache-busting toolkit:
//   • HTML always goes NetworkFirst with a 3s timeout. The dev server sends
//     `Cache-Control: no-store`, which we honour by always trying the network
//     first; on failure we fall back to whatever HTML we cached last.
//   • Source modules are cache-busted with ?v=<token> in their URL, so each
//     bust creates new cache keys. We use stale-while-revalidate: instant
//     load from cache, refresh in the background. New tokens = new entries.
//   • Icons and the manifest go CacheFirst — they rarely change.
//
// Versioning: bump CACHE_VERSION when sw.js itself materially changes so the
// activate handler can purge old caches.

const CACHE_VERSION = 'v1';
const STATIC_CACHE  = `heptapod-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `heptapod-runtime-${CACHE_VERSION}`;

// Minimal precache: just the offline fallback so a fresh install can show
// *something* if the user opens the app with no network the first time.
// We intentionally do NOT precache src/*.js — those carry cb-tokens and would
// go stale immediately.
const PRECACHE = ['./index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // don't proxy cross-origin

  // HTML navigations — NetworkFirst so dev edits + cache-busting always win.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(networkFirst(req, 3000));
    return;
  }

  // JS modules (cb-fingerprinted) — stale-while-revalidate.
  if (req.destination === 'script' || url.pathname.endsWith('.js')) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // Icons, manifest, images — CacheFirst.
  if (req.destination === 'image' || url.pathname.endsWith('.webmanifest') || url.pathname.endsWith('.svg')) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Everything else — pass through.
});

async function networkFirst(req, timeoutMs) {
  try {
    const fresh = await Promise.race([
      fetch(req),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
    if (fresh.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (_e) {
    const cached = await caches.match(req);
    if (cached) return cached;
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
      '<style>body{font-family:ui-serif,Georgia,serif;background:#f6f1e7;color:#161310;padding:48px;text-align:center}</style>' +
      '<h1>Offline</h1><p>No cached copy of this page yet — reconnect and reload.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  const networkPromise = fetch(req).then((fresh) => {
    if (fresh && fresh.ok) cache.put(req, fresh.clone()).catch(() => {});
    return fresh;
  }).catch(() => null);
  return cached || networkPromise || new Response('', { status: 504 });
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (_e) {
    return new Response('', { status: 504 });
  }
}
