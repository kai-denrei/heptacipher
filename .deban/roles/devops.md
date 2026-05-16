---
role: devops
owner: Gerald (Jelaludo)
status: active
last-updated: 2026-05-16
---

# DevOps

## Scope
Dev server, cache-busting toolkit, PWA shell (manifest + service worker + iOS head tags), and any deployment surface. Owns "how the bytes reach the user."

## Decisions
| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-16 | Dev server is `scripts/dev-server.py` — a wrapper around Python's `http.server` that adds `Cache-Control: no-store, no-cache, must-revalidate` on every response. | The vanilla Python http.server sends no Cache-Control and browsers heuristic-cache ESM modules aggressively, breaking dev iteration. The wrapper is 25 lines and works on any machine with Python 3. | [[dev]] |
| 2026-05-16 | `npm run demo` runs on port 8766 (not the original 8765) because user has another project on 8765. | One-line change in package.json; future-proof for multi-project workflow on the same machine. | (no cross-role) |
| 2026-05-16 | Cache-busting toolkit installed: `scripts/bust.sh` and `scripts/fingerprint-urls.py` from `~/.claude-kainode/skills/cache-busting`. Inline `<script type="module">` reads `<meta name="cb">` token and dynamic-imports `../src/index.js?v=${cb}`. | Layered defense: dev server's no-store + meta cache-control tags + URL fingerprinting on the entry import. Each layer covers a different cache (browser, CDN, intermediary proxy). | [[arch]], [[dev]] |
| 2026-05-16 | PWA shell at `examples/`: `manifest.webmanifest` (scope `./`, standalone display), `sw.js` (NetworkFirst HTML / SWR fingerprinted JS / CacheFirst icons), `icon.svg`, `icon-maskable.svg`, iOS apple-touch-icon + meta tags. | Mobile-pwa skill defaults: NetworkFirst HTML lets dev cache-busting always win; SWR on fingerprinted JS means new tokens automatically create new cache entries (clean invalidation); CacheFirst on icons because they rarely change. | [[arch]], [[ux]] |
| 2026-05-16 | Service worker uses `self.skipWaiting()` unconditionally in install. | This is a dev/prototype build; the proper update-toast pattern can be added when the project ships. Documented as a deferred concern. | [[pm]] |

## Dead Ends
| Date | What was tried | Why it failed / was rejected |
|---|---|---|
| 2026-05-16 | Original `npm run demo` invoked `python3 -m http.server 8765` directly. | Default Python http.server doesn't send any Cache-Control header → browsers heuristic-cache aggressively → editing src files didn't show changes without a hard refresh. Replaced with custom wrapper that injects `no-store`. |
| 2026-05-16 | Tried to use cairo-rasterizer fallback for the cache-busting visual badge (`brew install cairo` required). | macOS doesn't have libcairo installed by default. The cache-busting toolkit falls back to SVG-only mode when cairo is missing — verified the badge renders fine without WebP rasterization. |

## Lessons
- Python's `http.server` is a fine dev server BUT its lack of cache headers can hide hours of "why aren't my changes showing up?" debugging. Always wrap it with a no-cache header injector for serious dev work.
- A PWA that coexists with URL fingerprinting needs strategy-per-resource caching, not a one-size-fits-all CacheFirst — otherwise the SW will serve stale code despite the fingerprint changes.

## Open Questions
- [ ] Does the PWA install actually work on iOS Safari after the dev server is replaced by an HTTPS production host? — owner: [[devops]] — since: 2026-05-16
- [ ] Should the service worker version bump automatically when `bust.sh` runs? Currently `CACHE_VERSION` in sw.js is manual. — owner: [[devops]] — since: 2026-05-16
- [ ] What's the production hosting plan — GitHub Pages, Cloudflare Pages, an embed in the puzzle game's static assets? — owner: [[devops]], [[pm]] — since: 2026-05-16

## Assumptions
- The cache-busting toolkit's badge widget (corner SVG + favicon) is useful as a "did the bust work?" indicator, worth keeping in dev builds — status: validated in dev — since: 2026-05-16
- macOS Documents folder TCC restrictions won't bite again mid-session — status: untested (it happened once on 2026-05-16, manually restored) — since: 2026-05-16

## Dependencies
Blocked by: (none — internally led)
Feeds into: [[pm]] (deploy decisions), [[dev]] (toolchain choices affect implementation)

## Session Log
- 2026-05-16 — Dev server, cache-busting toolkit, PWA shell all installed and verified working together. Bust token bumped many times across the session without breaking the SW caches.
