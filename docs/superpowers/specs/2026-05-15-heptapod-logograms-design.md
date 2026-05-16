# Heptapod Logograms — Design Spec

**Date:** 2026-05-15
**Owner:** Gerald (Jelaludo)
**Status:** Approved for prototype

## Goal

A vanilla-JS, SVG-emitting procedural calligraphy engine that renders a 4-digit number as a single heptapod-style logogram glyph: an open ensō circle (Arrival film style, with gap and trailing tail) bearing one digit-encoding appendage in each of its four quadrants. Used as the visual layer of a puzzle in an existing game — the player sees the glyph as ink-in-water particles and picks the matching number from a list.

Two encoding variants are supported as separate puzzle types:
- **Morse-style** (per the canonical heptapod numeral chart): 5 dots/dashes per digit
- **Prong-binary**: 4 prongs per digit, OUT=1 / IN=0 (4-bit binary, MSB first)

## Non-goals

- Not generating heptapod **concept-logograms** (the smoky word-glyphs from the film). Numerals only.
- Not building the puzzle game logic or the particle animation system. Those exist already; this engine hands off an SVG for the existing particle system to sample.
- Not supporting numbers outside `0–9999`.
- Not supporting languages, characters, or non-numeric content.
- Not optimizing for IE / legacy browsers. Modern evergreen browsers only.

## Aesthetic constraints (load-bearing)

The visual style must honor these properties from the reference image:

1. **Open circle** — clear gap, typically in the 4–5 o'clock region; a trailing tail extends past the gap (kenshin/harai brush taper).
2. **Variable thickness** — the ensō stroke is thicker where ink loads, thinner where pressure lifts. Not a constant-width arc.
3. **Ragged edges** — the brush leaves an irregular boundary; no clean Bézier silhouette.
4. **Ink splotches** — dots are organic blobs (asymmetric, slightly elongated), not perfect circles.
5. **Mantid-tendril appendages** — appendage strokes radiate from a wet "splat" base, with curls and variable length, like the praying-mantid limbs described in the source novella.
6. **Vary each render** — the same number renders differently every time. Player decodes by reading marks, not by memorizing brush shapes. Engine optionally takes a seed for deterministic mode.

## Layout

```
              NW                NE
            (×1000)           (×100)
                  \         /
                   \       /
                    \     /
              ┌──── ensō ────┐
              │      gap     │
              │   (4-5 oc)   │
                    /     \
                   /       \
                  /         \
            (×10)             (×1)
              SW                SE

Reading order: NW → NE → SE → SW (clockwise from top-left)
```

For example, the number **3729** places:
- `3` in NW (thousands)
- `7` in NE (hundreds)
- `2` in SE (tens)
- `9` in SW (ones)

Each quadrant's appendage attaches to the ensō at roughly 45° / 135° / 225° / 315° (with seeded ±15° jitter). The appendage's "splat" sits on the circle perimeter; marks radiate outward.

## Encoding tables

### Morse-style (per reference chart, image #1)

| Digit | Pattern |
|-------|---------|
| 0 | — — — — — |
| 1 | • — — — — |
| 2 | • • — — — |
| 3 | • • • — — |
| 4 | • • • • — |
| 5 | • • • • • |
| 6 | — • • • • |
| 7 | — — • • • |
| 8 | — — — • • |
| 9 | — — — — • |

Each digit = 5 marks. Marks are placed along an outward-radiating arc/line from the splat, with seeded ±10° angle jitter and ±15% length jitter per mark. Mark order: read from the splat outward (closest mark = leftmost in the chart).

### Prong-binary

| Digit | Binary (MSB first) | Prongs |
|-------|--------------------|--------|
| 0 | 0000 | IN IN IN IN |
| 1 | 0001 | IN IN IN OUT |
| 2 | 0010 | IN IN OUT IN |
| 3 | 0011 | IN IN OUT OUT |
| 4 | 0100 | IN OUT IN IN |
| 5 | 0101 | IN OUT IN OUT |
| 6 | 0110 | IN OUT OUT IN |
| 7 | 0111 | IN OUT OUT OUT |
| 8 | 1000 | OUT IN IN IN |
| 9 | 1001 | OUT IN IN OUT |

Each digit = 4 prongs sprouting from the splat. **OUT** = prong points radially outward (away from ensō center). **IN** = prong points radially inward (toward ensō center, crossing the circle into the interior).

Prongs are arranged in a small fan, with the MSB on the "leading" (clockwise-forward) edge of the splat and LSB on the trailing edge. Seeded ±20° fan-spread jitter and ±20% length jitter per prong.

## Public API

```js
import { renderHeptapodNumeral, sampleSVG } from 'heptapod-logograms';

// Render a glyph
const svg = renderHeptapodNumeral({
  number: 3729,            // 0..9999
  encoding: 'morse',       // 'morse' | 'prong'
  size: 400,               // viewBox dimension (square)
  seed: undefined,         // omit => random per render; pass int => deterministic
});
document.body.appendChild(svg);  // svg is an SVGSVGElement

// Sample for particle system
const points = sampleSVG(svg, { density: 0.5 });
// points: Array<{ x: number, y: number, weight: number }>
// Weight roughly correlates with stroke thickness at that point.
```

The exported SVG has `viewBox="0 0 size size"`, transparent background, and uses `currentColor` for fills so the consumer can color it with CSS.

## Module architecture

8 ES modules in `src/`. Each module is a pure-function-style file with no DOM dependencies except where noted. Primitives return SVG path `d` strings; composers return SVG elements.

### `src/rng.js`
Seeded PRNG (mulberry32). Returns `{ next: () => float in [0,1), range: (lo, hi) => float, int: (lo, hi) => int, gauss: (mean, sd) => float }`. ~30 lines.

### `src/brush.js`
**The hero primitive.** All visible marks pass through here.

```js
brushStroke({
  controlPoints,   // Array<{x, y}> — Bézier spine
  widthProfile,    // (t: 0..1) => half-width in same units (default: kenshin taper from full to zero)
  jitter,          // {edge: number, spine: number} — pixel perturbation for ragged feel
  rng,             // seeded RNG
}) => string       // SVG path `d` for a *filled* shape tracing both sides of the brush
```

Implementation: walk the spine at fine `t`-steps (say 40 samples). At each sample, compute the spine point + perpendicular normal × widthProfile(t). Add seeded edge jitter perpendicular to the normal. This gives two polylines (left edge, right edge). Close them with rounded end-caps. Return as one closed SVG path.

Used by: enso, morseDigit (dashes), prongDigit (prongs).

### `src/splotch.js`
Irregular ink blob.

```js
irregularBlob({ cx, cy, size, irregularity, rng }) => string
```

Generates `~12–18` points on a noisy ellipse (radii perturbed by `irregularity` factor), smooths them with quadratic Bézier handles. Used for: ensō ink-puddles inside the circle, Morse dots, splat-base under each appendage.

### `src/enso.js`
Open circle with gap + tail.

```js
enso({ cx, cy, radius, gapAngleDeg, gapWidthDeg, tailLengthDeg, rng }) => string
```

Internally: builds a circular control-point path (with seeded radial wobble ±5%), opens the gap by trimming `gapWidthDeg` of arc centered at `gapAngleDeg`, extends one end as a tapering tail of `tailLengthDeg`, then calls `brushStroke` with a width profile that ramps up at the start, holds, ramps down through the tail to zero. Returns the brush stroke path string.

Default `gapAngleDeg`: ~135° (4-5 o'clock in SVG coords where Y is down). Default `gapWidthDeg`: 35°. Default `tailLengthDeg`: 25°.

### `src/morseDigit.js`
Morse appendage for one digit.

```js
morseDigitAppendage({
  digit,           // 0..9
  attachPoint,     // {x, y} on the ensō
  outDirection,    // unit vector {x, y} pointing radially outward
  scale,           // size factor (relative to ensō radius, e.g. 0.4)
  rng,
}) => string       // SVG group fragment (a <g>...</g> string)
```

Lookup the digit's mark pattern (e.g., `3 = ['•','•','•','—','—']`). Generate a splat (irregularBlob at the attach point). Then place each mark sequentially along an outward arc from the splat:
- Dot (`•`) → small irregularBlob, asymmetric
- Dash (`—`) → short brushStroke tendril with kenshin taper

Each mark gets seeded ±10° angle jitter and ±15% scale jitter, so the same digit looks slightly different each render.

### `src/prongDigit.js`
Prong appendage for one digit.

```js
prongDigitAppendage({ digit, attachPoint, outDirection, scale, rng }) => string
```

Lookup the digit's 4-bit pattern (MSB first). Generate the splat. For each of the 4 bits, generate a brushStroke prong:
- OUT bit → prong direction = outDirection rotated by fan angle
- IN bit → prong direction = inverse of outDirection (crossing into circle interior) rotated by fan angle

Fan angles: ±30°, ±10° from outDirection, so the 4 prongs span ~60° of fan. ±20° seeded jitter per prong.

### `src/composite.js`
**Public entry.**

```js
renderHeptapodNumeral({ number, encoding, size, seed }) => SVGSVGElement
```

1. Validate `number` (0..9999, integer), `encoding` ('morse'|'prong'), `size` (positive number). Throw with clear messages on invalid input.
2. Initialize RNG (with given seed, or `Math.random() * 2^32` if none).
3. Compute digit assignments: `thousands = number / 1000 | 0`, etc.
4. Compute ensō geometry (centered, radius = `size * 0.35`).
5. Compute the 4 attach points and outward unit vectors for NW/NE/SE/SW (with seeded ±10° angle jitter around each quadrant center).
6. Generate ensō path string via `enso()`.
7. For each digit, generate appendage string via `morseDigitAppendage` or `prongDigitAppendage`.
8. Optionally generate 1–3 small interior ink dots (matching the reference image).
9. Assemble into an `<svg>` element. Return it.

### `src/sample.js`
**Public entry for particle handoff.**

```js
sampleSVG(svgEl, { density = 0.5 } = {}) => Array<{x, y, weight}>
```

Walk the SVG tree. For each path:
- If it's a closed filled shape (splotches, brush strokes), sample points via random rejection sampling inside its bounding polygon. `weight` is constant.
- If it's a stroked path, sample points along the stroke at intervals proportional to `density`. `weight` scales with effective thickness.

For the prototype, a simpler approach: use `SVGPathElement.getTotalLength()` + `getPointAtLength()` to sample along path outlines; then optionally interior-fill via rejection sampling. Browsers support both natively.

### `src/index.js`
Re-exports public API only:
```js
export { renderHeptapodNumeral } from './composite.js';
export { sampleSVG } from './sample.js';
```

## Data flow

```
renderHeptapodNumeral({number, encoding, size, seed})
        │
        ├── rng.js  → seeded PRNG instance
        │
        ├── enso.js
        │    └── brush.js (circular spine + tail, ramped width)
        │         └── rng.js (jitter)
        │
        ├── 4× digit appendage (one per quadrant)
        │    │
        │    ├── morseDigit.js
        │    │    ├── splotch.js (splat-base, dots)
        │    │    └── brush.js  (dashes)
        │    │
        │    └── prongDigit.js
        │         ├── splotch.js (splat-base)
        │         └── brush.js  (prongs)
        │
        ├── splotch.js × 1–3 (interior ink dots, optional)
        │
        └── Assemble <svg> element → return

sampleSVG(svgEl, {density})
        │
        ├── Walk SVG tree
        ├── For each <path>: sample along + (if filled) inside
        └── Return [{x, y, weight}, ...]
```

## Project layout

```
heptapod-logograms/
├── src/
│   ├── rng.js
│   ├── brush.js
│   ├── splotch.js
│   ├── enso.js
│   ├── morseDigit.js
│   ├── prongDigit.js
│   ├── composite.js
│   ├── sample.js
│   └── index.js
├── examples/
│   └── index.html        # interactive demo
├── test/
│   └── basic.test.js     # smoke test (optional for prototype)
├── docs/
│   └── superpowers/specs/2026-05-15-heptapod-logograms-design.md
├── package.json          # type: module, name: heptapod-logograms
├── README.md
├── .gitignore            # node_modules, .superpowers/
└── (.git)
```

## Interactive demo (`examples/index.html`)

Single HTML page demonstrating the engine. Must support:
- 4-digit number input (0000–9999)
- Encoding toggle (Morse / Prong)
- "Re-roll" button (new random seed)
- "Lock seed" toggle + integer seed field
- Live render of the glyph
- "Show particle samples" toggle that overlays the sampled points from `sampleSVG` as faint dots

Loads modules via `<script type="module">` from `../src/index.js`. No build step.

## Error handling

Validate at the public API boundary only. Internal modules trust their callers.

- `renderHeptapodNumeral`: throw `TypeError` with a clear message if `number` is not an integer in `[0, 9999]`, `encoding` is not in `['morse', 'prong']`, or `size` is not a positive finite number.
- `sampleSVG`: throw `TypeError` if argument is not an `SVGSVGElement` or `SVGGraphicsElement`. Tolerate missing/empty paths (return `[]`).

No fallbacks, no defensive checks inside internal modules. Trust internal contracts.

## Testing (prototype scope)

- A single smoke test: `renderHeptapodNumeral({ number: 3729, encoding: 'morse', size: 400, seed: 1 })` returns an SVG element with the expected child structure (1 ensō path, 4 appendage groups, viewBox set).
- Visual validation is human-driven via `examples/index.html`. No snapshot tests yet — leave for post-iteration.

## Dependencies

**Runtime**: zero. The engine is pure JS + DOM/SVG APIs.

**Dev** (optional): `vitest` for the smoke test. If overkill, skip and rely on browser demo.

## Open questions for iteration (post-prototype)

These can wait until we see the prototype:
- Exact aesthetic of "OUT" vs "IN" prongs — does crossing into the ensō interior read clearly or feel cluttered?
- Whether interior ink dots help or distract (reference image has them; puzzle clarity may not need them).
- Stroke jitter parameters — how rough is too rough?
- Whether to add a slight ink-bleed soft outline (the reference sticker has a faint white halo — probably a print artifact, but could be worth trying).
- Whether the prong-binary glyph wants a different reading hint (since 4 prongs don't carry obvious order like Morse marks do).

## Acceptance for prototype

The prototype is "done enough to iterate on" when:
1. `examples/index.html` runs in Safari/Chrome on the M4 with no build step
2. Entering `3729` in Morse mode produces a recognizable open-ensō glyph with 4 appendages
3. Each Morse appendage's marks are visually countable
4. Toggling to Prong mode swaps to 4-prong appendages, with OUT/IN clearly distinct
5. "Re-roll" produces a visibly different glyph for the same number
6. "Lock seed" reproduces the same glyph
7. `sampleSVG` returns a non-empty array of points roughly tracing the glyph shape
