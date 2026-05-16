# heptacipher

A read-the-wet-ink-and-guess-the-number quiz. Each round, a 4-digit number (0–9999) is rendered as a heptapod-style logogram — an open ensō circle with four digit-encoding lobes — and you tap the answer on a keypad before the next round.

**Live demo:** https://kai-denrei.github.io/heptacipher/

Installable as a PWA on iOS / Android / desktop. Offline-capable. Zero runtime dependencies; pure ES modules loaded directly by the browser.

## Quick start (local dev)

```bash
npm install
npm run demo
# open http://localhost:8766/
```

The dev server (`scripts/dev-server.py`) sends `Cache-Control: no-store` on every response so edits show up on refresh.

## How the quiz reads

The ring is drawn clockwise as a single brush gesture. Four digits N1…N4 (thousands → units) are placed as lobes along the body. Reading order:
- **N1** = thousands lobe (first quadrant, OUTSIDE the ring)
- **N2** = hundreds lobe (second quadrant, INSIDE the ring)
- **N3** = tens lobe (third quadrant, OUTSIDE)
- **N4** = units lobe (fourth quadrant, INSIDE)

Each lobe carries 5 morse marks:

```
0: ─ ─ ─ ─ ─    5: • • • • •
1: • ─ ─ ─ ─    6: ─ • • • •
2: • • ─ ─ ─    7: ─ ─ • • •
3: • • • ─ ─    8: ─ ─ ─ • •
4: • • • • ─    9: ─ ─ ─ ─ •
```

The marks are revealed one at a time as the brush passes them — by the time the last mark of N4 lands, the body sweep finishes drawing the final quadrant.

## Admin panel

Append `?admin` to the URL (or tap the small ⚙ in the top-right) to expose the tuning panel:

- **Speed** — multiplier on all animation durations (0.4×–5×)
- **Bokeh** — multiplier on the bloom-blur radii
- **Bounce** — multiplier on the splash/bounce overshoot
- **Stagger** — halo → crisp layer delay (the capillary feel)
- **Stride** — per-mark delay within a lobe
- **Feather** — Gaussian blur radius on the sweep-mask edge

And a Vars drawer with the underlying V2 renderer parameters (lobe steepness, ink bleed, halo darkness, liquid wobble, etc.). Changes apply live; the Replay button re-fires the bloom on the current glyph.

## Architecture

```
.
├── index.html              the PWA entry
├── manifest.webmanifest    PWA manifest (scope ./)
├── sw.js                   service worker (NetworkFirst HTML / SWR JS / CacheFirst icons)
├── icon.svg                app icon (any-purpose)
├── icon-maskable.svg       app icon (maskable, 78% safe area)
├── src/
│   ├── index.js            re-exports renderHeptapodNumeralV2
│   ├── compositeFlow.js    public renderer — builds the SVG
│   ├── enso.js             open ensō with gap + tapering tail
│   ├── brush.js            filled brush stroke from a spine
│   ├── splotch.js          irregular ink blobs (dots, splats)
│   ├── morseDigitArc.js    per-lobe morse appendage
│   ├── prongDigitArc.js    per-lobe prong appendage (unused by the quiz, kept for API)
│   └── rng.js              mulberry32 PRNG (seedable)
├── public/                 cache-busting badge (cb-shapes/, cb-badge.js)
├── scripts/                dev tooling (dev-server.py, bust.sh, fingerprint-urls.py)
├── test/                   vitest structural smoke tests
└── docs/superpowers/       design specs
```

The reveal animation has three coordinated effects:
1. **Wet-drop splash** — CSS keyframe scales the brush-touchdown blob from 0 with elastic overshoot.
2. **Clockwise body sweep** — rAF-driven SVG mask whose polygon is itself Gaussian-blurred (soft leading edge — no geometric line through the ink halo).
3. **Per-quadrant lobe blooms** — each lobe Nn starts blooming when the sweep enters quadrant Cn; each mark within a lobe staggers along the arc. Auto-balanced so N4's last mark lands exactly when the body sweep finishes.

## Testing

```bash
npm test
```

Four vitest cases verify the SVG structural contract (viewBox, ensō group, four appendage groups, dataset metadata) and seed determinism. Visual / animation behaviour is reviewed in the browser.

## License

UNLICENSED — internal prototype.
