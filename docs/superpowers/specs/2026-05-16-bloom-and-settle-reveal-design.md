# Bloom-and-settle ink reveal — design

**Date:** 2026-05-16
**Status:** Approved (pending user review of this written spec)
**Replaces:** Wedge-sweep clip-path reveal in the Quiz tab
**Scope:** `examples/index.html` only (CSS + JS in the inline `<script>`). No changes to the V2 renderer or the V2 SVG output.

## Motivation

The current quiz reveal is a `<clipPath>` polygon (a wedge from the ensō center) that rotates clockwise from the gap, driven by `requestAnimationFrame`. It works geometrically — elements appear in the brush-gesture order — but the hard wedge edge and constant angular sweep read as mechanical. Real wet ink doesn't appear at a clip boundary; it blooms into wet paper, then settles as it dries.

The user wants the reveal to feel like ink hitting paper, with bokeh easing the transition between "not there" and "there".

## Approach

**Per-element bloom-and-settle.** Drop the clip wedge entirely. Each logical element of the V2 SVG animates its own short bloom (heavy blur + oversized + transparent → sharp + correct-size + opaque), staggered along the brush-gesture timeline so the reading order emerges from sequencing rather than geometry.

**Capillary stagger between layers.** The two halo layers (far, near) and the crisp layer have the same per-element keyframe but the crisp layer is offset 80 ms later than the halo. The wet bleed blooms first, the sharp line catches up — mimicking paper absorbing ink before the line darkens.

## Element timeline

The V2 renderer emits 6 logical elements per ink layer (`g.ink-halo-far`, `g.ink-halo-near`, `g.ink-crisp`). Each element is animated independently. All times in ms from animation start.

| Element              | Selector                                      | Halo start | Crisp start | Duration |
|---------------------|-----------------------------------------------|-----------:|------------:|---------:|
| Wet-drop (splash)    | `g.wet-drop`                                  | 0          | 80          | 380      |
| Ensō body + tail     | `g.enso`                                      | 280        | 360         | 820      |
| Lobe 1 (thousands)   | `g.appendages > g.appendage:nth-child(1)`     | 650        | 730         | 400      |
| Lobe 2 (hundreds)    | `g.appendages > g.appendage:nth-child(2)`     | 950        | 1030        | 400      |
| Lobe 3 (tens)        | `g.appendages > g.appendage:nth-child(3)`     | 1250       | 1330        | 400      |
| Lobe 4 (units)       | `g.appendages > g.appendage:nth-child(4)`     | 1550       | 1630        | 400      |

Total duration: ~2030 ms. Each element's bloom overlaps with its successor's start, so the eye never sees a static frame.

## Per-element keyframes

Three keyframe sets, one per element type. Same set applies to all three layers; the layer-stagger comes from per-layer `animation-delay` only.

### `bloomDrop` — wet-drop only

```css
@keyframes bloomDrop {
  0%   { opacity: 0;   transform: scale(0.30); filter: blur(6px); }
  40%  { opacity: 1;   transform: scale(1.25); filter: blur(2px); }
  100% { opacity: 1;   transform: scale(1);    filter: blur(0);   }
}
```

Easing: `cubic-bezier(0.34, 1.56, 0.64, 1)` (elastic overshoot). The drop scales up past 1 then surface-tensions back to 1 — matches the way a real wet drop spreads then settles.

### `bloomRing` — ensō body+tail

```css
@keyframes bloomRing {
  0%   { opacity: 0;   filter: blur(10px); }
  60%  { opacity: 0.8; filter: blur(3px);  }
  100% { opacity: 1;   filter: blur(0);    }
}
```

No transform. Scaling a ring distorts the geometry visibly — we keep the ring at its correct radius and only modulate opacity + blur. Easing: `cubic-bezier(0.215, 0.610, 0.355, 1.0)` (ease-out-quart).

### `bloomLobe` — each appendage

```css
@keyframes bloomLobe {
  0%   { opacity: 0;   transform: scale(1.4); filter: blur(7px); }
  100% { opacity: 1;   transform: scale(1);   filter: blur(0);   }
}
```

Lobes start slightly oversized — like ink spreading outward before contracting to the inked shape. Easing: ease-out-quart.

## Transform anchoring

All scaled elements need their transform origin anchored at their own geometric center, not at SVG origin (0, 0):

```css
.quiz-anim g.wet-drop,
.quiz-anim g.appendages > g.appendage {
  transform-box: fill-box;
  transform-origin: center;
}
```

`transform-box: fill-box` is supported in all modern browsers (Chrome 64+, Firefox 55+, Safari 11+). The fill bounding box of a `<g>` is the union of its children's bboxes, so the lobe scales from its own visual center.

## Selector and animation rules

Each element type gets two rules: one for the halo layers (`g.ink-halo`), one for the crisp layer (`g.ink-crisp`). Same keyframes, layer-specific delay.

```css
/* Wet-drop */
.quiz-anim g.ink-halo > g.wet-drop  { animation: bloomDrop 380ms    0ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.quiz-anim g.ink-crisp > g.wet-drop { animation: bloomDrop 380ms   80ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }

/* Ensō body */
.quiz-anim g.ink-halo > g.enso      { animation: bloomRing 820ms  280ms cubic-bezier(0.215, 0.610, 0.355, 1.0) both; }
.quiz-anim g.ink-crisp > g.enso     { animation: bloomRing 820ms  360ms cubic-bezier(0.215, 0.610, 0.355, 1.0) both; }

/* Lobes 1–4 — :nth-child positions are stable because the V2 renderer always
   emits the 4 appendages in the order [thousands, hundreds, tens, units]. */
.quiz-anim g.ink-halo  > g.appendages > g.appendage:nth-child(1) { animation: bloomLobe 400ms  650ms cubic-bezier(0.215, 0.610, 0.355, 1.0) both; }
.quiz-anim g.ink-crisp > g.appendages > g.appendage:nth-child(1) { animation: bloomLobe 400ms  730ms cubic-bezier(0.215, 0.610, 0.355, 1.0) both; }
.quiz-anim g.ink-halo  > g.appendages > g.appendage:nth-child(2) { animation: bloomLobe 400ms  950ms cubic-bezier(0.215, 0.610, 0.355, 1.0) both; }
.quiz-anim g.ink-crisp > g.appendages > g.appendage:nth-child(2) { animation: bloomLobe 400ms 1030ms cubic-bezier(0.215, 0.610, 0.355, 1.0) both; }
.quiz-anim g.ink-halo  > g.appendages > g.appendage:nth-child(3) { animation: bloomLobe 400ms 1250ms cubic-bezier(0.215, 0.610, 0.355, 1.0) both; }
.quiz-anim g.ink-crisp > g.appendages > g.appendage:nth-child(3) { animation: bloomLobe 400ms 1330ms cubic-bezier(0.215, 0.610, 0.355, 1.0) both; }
.quiz-anim g.ink-halo  > g.appendages > g.appendage:nth-child(4) { animation: bloomLobe 400ms 1550ms cubic-bezier(0.215, 0.610, 0.355, 1.0) both; }
.quiz-anim g.ink-crisp > g.appendages > g.appendage:nth-child(4) { animation: bloomLobe 400ms 1630ms cubic-bezier(0.215, 0.610, 0.355, 1.0) both; }
```

Note: `g.ink-halo` matches both `g.ink-halo-far` and `g.ink-halo-near` (they have the multi-class `ink-halo ink-halo-far`). Two halo elements per logical element + one crisp = 3 animated elements per logical element. The `>` direct-child combinator scopes the selectors so they don't accidentally match nested elements.

## Why compound blur works

Each halo layer already carries its own SVG `filter=` (Gaussian blur + feTurbulence-driven displacement). Adding CSS `filter: blur(Npx)` on top stacks: at `t=0` the element is rendered with SVG blur first, then a further CSS blur — heavy bokeh. At animation end (CSS blur 0) only the SVG filter remains — the layer's natural look. So bokeh emerges from the existing blur character; no visible "removal of the bokeh" beyond the resolve.

For the crisp layer (no/light SVG filter), CSS blur dominates during bloom and resolves to crisp at end. The crisp layer's blur curve is identical to the halos' — only the start delay differs.

## JS simplifications

Delete:
- `runQuizDrawAnimation` (entire function, ~80 lines including the clipPath polygon math)
- `quiz.cancelDraw` state slot
- The `cancelDraw({reveal:...})` call chain in `renderQuizLogogram`, `submitQuizGuess`, and `endQuiz`
- The `SVG_NS` and `INITIAL_WEDGE_DEG` / `DRAW_MS` constants (only used by the deleted animator)

Adjust:
- `renderQuizLogogram` still sets `quiz-anim` class on the SVG. That's now the entire animation trigger.
- `submitQuizGuess` snap-reveals by `svg.classList.remove('quiz-anim')` — CSS animations stop immediately; with `animation-fill-mode: both` removed alongside the class, elements revert to their natural rendered state (opacity 1, no blur, scale 1). Glow filter then applies to the fully-revealed shape.
- `endQuiz` removes `quiz-anim` on the soon-to-be-cleared SVG (defensive — the `stage.replaceChildren()` next line removes it anyway).

The SVG dataset attrs (`cx`, `wetDropX`, `gapStartDeg`, etc.) baked in by `compositeFlow.js` are no longer read by the quiz. They stay in the SVG output for now (cost is negligible, future animations may want them). Could be removed in a future cleanup pass.

## Reduced-motion handling

```css
@media (prefers-reduced-motion: reduce) {
  .quiz-anim g.wet-drop,
  .quiz-anim g.enso,
  .quiz-anim g.appendages > g.appendage {
    animation: none;
  }
}
```

When the user has reduced-motion turned on, all bloom animations short-circuit — the logogram appears in its natural state instantly.

## Performance

Per round, the browser composites:

- 3 ink layers × ~6 elements = ~18 animated subtrees
- Each subtree has CSS `opacity`, `transform: scale()`, and `filter: blur()` animated
- CSS filters are GPU-accelerated on modern browsers
- The existing SVG `feGaussianBlur` + `feTurbulence` filters on the halo layers are static (their `stdDeviation` and `baseFrequency` don't animate) — the GPU caches them
- Total animation lifetime: ~2 s per round, 5 rounds per session

This should be smooth on any phone made in the last 4 years. Older phones may see a frame dropped during the heaviest overlap (~1.0–1.4 s when ensō, lobe 1, and lobe 2 all have CSS filters running). Acceptable.

## Testing plan

Manual visual QA on the running dev server:

1. Open quiz on desktop Chrome at 480×800 viewport and at 1280×800
2. Verify: wet-drop splashes first, ensō body resolves, lobes appear in order (NW→SW→NE-ish path matching the visible gesture)
3. Verify staggered layer effect: halo bleed visibly leads the crisp line resolution by ~80 ms
4. Verify snap-reveal: type 4 digits before 2 s, confirm glow wraps the full glyph
5. Verify scale anchoring: lobes scale from their own centers, not from origin (would look like elements flying in from top-left if mis-anchored)
6. Open with macOS / iOS "Reduce Motion" enabled, verify animations are skipped
7. Test on a real iPhone (Safari) and a real Android (Chrome) — confirm no frame drops in the overlap window

No automated test coverage; the bloom animation is a visual-only concern and the SVG output structure is already tested in `test/basic.test.js`.

## Out of scope

- Removing the dataset attrs from the V2 SVG output (deferred — low value, costs reader-side complexity to defend the contract)
- Sound / haptics on element appearance — not requested, would distract from the calligraphy
- Re-introducing the wedge as an option alongside the bloom — single reveal style for now

## Addendum: Tune panel (per follow-up request)

Four CSS-variable sliders live in a collapsible panel inside the quiz modal so the bloom can be tuned without leaving the quiz:

| Slider  | CSS var                  | Range     | Default | Meaning                                                           |
|---------|--------------------------|-----------|---------|-------------------------------------------------------------------|
| Speed   | `--quiz-anim-scale`      | 0.4 – 2.0 | 1.00×   | Multiplier on every duration and delay                            |
| Bokeh   | `--quiz-anim-blur`       | 0 – 2.0   | 1.00×   | Multiplier on starting blur radii (6/7/10 px → scaled)            |
| Bounce  | `--quiz-anim-overshoot`  | 0 – 2.0   | 1.00×   | Multiplier on the wet-drop's `+0.25` and lobe's `+0.40` overshoot |
| Stagger | `--quiz-anim-stagger`    | 0 – 250ms | 80ms    | Additional delay applied to the crisp layer's animations          |

A `Replay` button next to `Tune ▾` re-fires the bloom on the current glyph (remove `.quiz-anim` class → force reflow → re-add) so the user doesn't have to wait for the next round to see the effect of a slider change. The tune panel is collapsed by default so it doesn't bloat the modal for non-tuning users.
