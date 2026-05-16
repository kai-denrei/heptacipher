---
role: dev
owner: Gerald (Jelaludo)
status: active
last-updated: 2026-05-16
---

# Dev

## Scope
Implementation of `src/` modules (composite, ensō, brush, splotch, morse/prong digit appendages, sample, rng) and the demo at `examples/index.html` including the quiz UI and bloom-and-settle reveal logic. Owns the runtime JavaScript and DOM/SVG plumbing. Does not own visual aesthetics ([[ux]]) or render-pipeline architecture ([[arch]]).

## Decisions
| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-16 | V2 SVG carries animation metadata in `dataset` (cx, cy, wetDropX, wetDropY, gapStartDeg, bodySweepDeg, tailSweepDeg, lobeTStarts). | Lets the quiz consumer reconstruct the brush gesture without duplicating geometry math. | [[arch]] |
| 2026-05-16 | Quiz uses ONE seed for all 5 rounds of a session; only the number changes. | "Same hand drew them" feel — earlier per-round seed produced jarring stylistic jitter between rounds. | [[ux]] |
| 2026-05-16 | Snap-reveal on early guess: `svg.classList.remove('quiz-anim')` + force-finalize the rAF mask sweep. | Glow filter needs to wrap the FULL shape, not a partial bloom; removing the class reverts each animated element to its natural rendered state. | [[ux]] |
| 2026-05-16 | Per-element bloom-and-settle is pure CSS (`@keyframes bloomDrop`/`bloomRing`/`bloomMark`); only the ensō clockwise sweep needs JS rAF. | Keeps the animation pipeline declarative where possible; rAF only where SVG attributes (polygon points) need per-frame updates. | [[arch]] |
| 2026-05-16 | Lobe-start delays computed in JS per render via `syncLobeTimingsToSweep(svg)` and stamped as inline style on each `g.appendage`. | Allows the timing to respond to the actual ensō wobble (different body:tail ratio per seed) and to the user's digitGap slider. Hardcoded `:nth-child` delays would drift. | [[arch]] |
| 2026-05-16 | Soft-edge sweep uses `<mask>` with `feGaussianBlur`-filtered polygon, not `<clipPath>`. | Hard clip produced a visible geometric line where the polygon edge cut the ink halo (see [[dev]] Dead Ends 2026-05-16). The mask's gradient alpha removes the artifact. | [[arch]], [[ux]] |

## Dead Ends
<!-- APPEND ONLY. Never delete. -->
| Date | What was tried | Why it failed / was rejected |
|---|---|---|
| 2026-05-16 | Initial cache-busting fingerprinter (`scripts/fingerprint-urls.py`) treated URL-encoded SVG fragments (`url(%23id)`) as regular asset URLs and appended `?v=token` to them, breaking the stage's noise-filter reference. | Fragment refs inside data URIs are NOT same-origin assets — the `%23` prefix means "encoded #", they need to be skipped. Patched is_external() to skip %23. |
| 2026-05-16 | Left-to-right `clip-path: inset()` reveal as the first quiz draw animation. | Pure rectangular sweep felt mechanical; no relationship to the brush gesture. Replaced with sector-clip rotating clockwise from the gap. |
| 2026-05-16 | Wedge-clip sweep with `ease-out-quart` easing on the polygon arc. | Easing made the relationship between sweep time and angular position non-linear, so syncing lobe start times to body quadrants required inverting the easing function. Switched the sweep to LINEAR — quadrant timing is now `bodyTime / 4`. |
| 2026-05-16 | Hard `<clipPath>` polygon as the sweep mechanism for `g.enso`. | The polygon's straight radial edge cut through the soft ink halo, producing a visible geometric line at the leading edge. User flagged it explicitly. Replaced with `<mask>` whose polygon has `feGaussianBlur` filter; the mask's alpha now fades over a feather radius. |
| 2026-05-16 | First implementation of "Vars" toggle accidentally caused V2 slider drags (on quiz tab) to restart the entire 2s bloom animation each frame. | `render()` was unconditionally adding `.quiz-anim` class on every call. Fixed by routing `render()` through `renderQuizLogogram({ animate: false })` when `state.variant === 'quiz'`. |
| 2026-05-16 | Soft-edge sector mask (feGaussianBlur on the polygon alpha) intended to fix the radial-line artifact AND give an organic edge. | Mathematically broken at the ring's geometry. The wedge interior reaches alpha=1 only at points more than 3σ away from BOTH the leading and trailing radial edges. At ring radius R≈115, the maximum chord between leading and trailing edges is 2R≈230 px. With Smoothness≥40 (3σ≈120 px), the blur fields from both edges always overlap at the ring, so the wedge interior NEVER reaches alpha=1 anywhere on the ring. The whole ring fades in globally — no drawing motion is perceptible. Tested with Smoothness 0, 30, 60, 80, 150 — every value either produces hard edges or global fade. |
| 2026-05-16 | bloomRing CSS animation (global opacity 0→1 + blur 10→0 across the whole ring) ran alongside the wedge mask. | Pre-faded the entire ring at low opacity even before the mask reached each position. User flagged: "breaks the illusion that something is being drawn". Removed. |
| 2026-05-16 | After bloomRing removal, the mask was the ONLY reveal mechanism. Same wedge/blur math problem persisted. | The math constraint isn't about WHAT's animated; it's about the geometry of a sector mask vs. the chord width of the target ring. No tuning of feather/duration/stride combinations solved it. User tested all sliders at 0 and max with no acceptable result. |
| 2026-05-16 | Stroke-dashoffset on each element's actual spine, used as the stroked path inside an SVG `<mask>`. Smoothness applied as CSS `filter: blur()` on the mask path. | Implemented. Status as of this sync: **user reports the problem is still not solved**. Possible further issues (un-diagnosed): the CSS filter:blur on a stroked path also blurs ALONG the stroke direction, so the leading-edge fade leaks both ahead and behind the dash; the mask stroke-width (18% of size = ~86 px) is too wide so "brush position" reads as fuzzy; CSS `filter` on path-inside-mask may not behave consistently across browsers; the dash-grow animation may be too smooth to read as a brush gesture against the slow Speed default. **Animation problem unsolved.** |
| 2026-05-16 (late) | **Canvas-overlay reveal (Approach 2 from outside-help analysis).** `<canvas>` layered over the static SVG; rAF loop walks each spine and deposits soft radial-gradient brush dabs; at end, canvas fades out and SVG fades in. ~8 iterations over hours: removed splash dab, removed halo pass, removed `mix-blend-mode: multiply`, switched per-layer hiding to whole-SVG `style.opacity='0'`, fixed Replay path, killed `.quiz-anim` to stop post-handoff `bloomDrop` "reset", lowered alpha, shortened WET_DELAY. **None of it produced a brush-drawing read.** The dabs accumulate into a static blob shape rather than reading as a brush moving along the path. The visual semantics of "many dabs accumulating in `source-over` composite" doesn't say "brush gesture" to a human eye — it says "soft ink puddle filling in". User reverted to 82072dd. |

## Lessons
<!-- Distilled principles from Dead Ends. Written to be read cold. -->
- Inside HTML/CSS data URIs, URL-encoded fragments (`%23...`) look like asset URLs but aren't — any URL-rewriting tool needs an explicit skip rule for them.
- Hard `<clipPath>` edges always destroy soft content (halos, blurs, glows). When clipping anything with a non-sharp boundary, use a `<mask>` with a feGaussianBlur-filtered shape instead.
- For animations that need to time external work (CSS keyframes) against internal work (rAF), prefer LINEAR easing on the internal driver so the relationship is preserved across speed changes.
- CSS `animation: ...` shorthand with `calc()` expressions referencing CSS custom properties works in current browsers (>=2023). Keep all tunable values as CSS vars and read them once per render where JS is involved.
- Drawing a CLOSED brush-stroke shape (like a hand-drawn ring) progressively is structurally harder than drawing an OPEN path. For a closed shape, any sector/wedge mask cuts across the shape's body with a hard radial edge — and feathering that edge enough to look organic requires a blur radius larger than the shape's chord width, which mathematically destroys the wedge interior's full opacity. The line-drawing community's standard trick (stroke-dashoffset on the path's stroke) works fine for open or stroked paths but is awkward when the artwork is a FILLED outline with a wet halo wider than reasonable mask stroke widths. **As of 2026-05-16 we have not found a technique that gives an organic brush-drawn ring reveal** — see `_index.md` Open Questions.
- When multiple slider combinations produce essentially the same broken result regardless of values, the issue is structural, not parametric. Stop tuning, change the technique.
- Canvas brush-deposition along a path does NOT inherently look like "a brush drawing" — it looks like ink accumulating into a static shape. The brush gesture (a single moving point with a trailing wet edge) is what reads as drawing, not the accumulated coverage. To make canvas read as brush-drawn, you probably need a visible leading-edge indicator (the brush tip itself rendered at the current position), sparser dabs so each is visually distinct, and slower visible motion. Just depositing more and more dabs along the spine produces a filled shape, not a gesture. — from canvas dead end on 2026-05-16.
- When the same `style.opacity='0'` setting reliably hides the SVG (verified via console.log and computed style) but the user still reports seeing the glyph, suspect a SEPARATE visual source — the canvas, a CSS animation firing on a class change, a residual from a previous animation cycle. Don't keep hardening the hide; bisect what's actually on screen.
- CSS classes can have HIDDEN consequences that activate on REMOVAL. `.canvas-driven g.wet-drop { animation: none !important }` suppresses bloomDrop while active; remove the class at the end of an animation and bloomDrop fires for the first time on that element, producing a phantom "new animation" right when you wanted the reveal to end. Either don't add the parent class (`.quiz-anim`) at all, or keep `.canvas-driven` on permanently. — from canvas dead end on 2026-05-16.

## Open Questions
- [ ] Is there a way to feGaussianBlur the mask polygon ONCE and translate it per frame instead of re-rasterizing every frame? — owner: [[dev]] — since: 2026-05-16
- [ ] Should the lobe-stagger `--quiz-mark-stride` adapt to the lobe's own arc length (longer lobes = more stride)? — owner: [[dev]] — since: 2026-05-16
- [ ] **HOW do we organically draw a closed brush-stroke ring in SVG?** All four approaches tried (hard wedge clip, soft-edge wedge mask, global bloomRing, stroke-dashoffset on spine inside mask) have failed to read as "brush drawing the ring" — they either show hard radial artifacts, global fade, or no perceptible drawing motion. Park the problem and revisit with fresh eyes. Possible directions: per-segment path animation (break the ring into ~30 small filled paths, animate each in sequence); SMIL `<animateMotion>` of a small dot along the spine that "deposits" ink as it moves (canvas-style); offline-rendered video frames with the visible-region growing; a different mask geometry entirely (e.g. a moving spotlight following a path with feMorphology-grown alpha). — owner: [[dev]] + [[arch]] — since: 2026-05-16

## Assumptions
- Modern browsers' CSS `filter: blur()` is GPU-accelerated and won't drop frames at 60fps with 18 elements × 3 layers animating — status: untested on phones — since: 2026-05-16
- The dataset attrs on the SVG (cx, gapStartDeg, etc.) won't be needed by consumers other than the quiz, but emitting them is cheap so they stay — status: validated (no consumer impact) — since: 2026-05-16
- `transform-box: fill-box` on a `<g>` returns the union of its children's bboxes (works for scale anchoring) — status: validated in dev — since: 2026-05-16

## Dependencies
Blocked by: (none)
Feeds into: [[ux]] (UI behaviour), [[qa]] (animation under test)

## Session Log
<!-- One line per session, newest first -->
- 2026-05-16 (late) — Canvas-overlay attempt: ~8 iterations over hours tuning splash/halo/blend/timing; the dabs never read as a brush-drawing, just as ink accumulating into a blob shape. Reverted index.html to 82072dd. Stays on the stroke-dashoffset-on-spine architecture; problem remains parked.
- 2026-05-16 (evening) — Replaced wedge-mask with stroke-dashoffset-on-spine inside a stroked SVG mask; ~80 lines of rAF JS deleted; tests still pass — but **the organic ring-draw problem is NOT yet solved**, problem documented + escalated to outside-help query in `_index.md`.
- 2026-05-16 — Soft-edge sweep mask replaces hard clip-path; Feather slider added to Tune panel; tests still green.
