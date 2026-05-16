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

## Lessons
<!-- Distilled principles from Dead Ends. Written to be read cold. -->
- Inside HTML/CSS data URIs, URL-encoded fragments (`%23...`) look like asset URLs but aren't — any URL-rewriting tool needs an explicit skip rule for them.
- Hard `<clipPath>` edges always destroy soft content (halos, blurs, glows). When clipping anything with a non-sharp boundary, use a `<mask>` with a feGaussianBlur-filtered shape instead.
- For animations that need to time external work (CSS keyframes) against internal work (rAF), prefer LINEAR easing on the internal driver so the relationship is preserved across speed changes.
- CSS `animation: ...` shorthand with `calc()` expressions referencing CSS custom properties works in current browsers (>=2023). Keep all tunable values as CSS vars and read them once per render where JS is involved.

## Open Questions
- [ ] Is there a way to feGaussianBlur the mask polygon ONCE and translate it per frame instead of re-rasterizing every frame? — owner: [[dev]] — since: 2026-05-16
- [ ] Should the lobe-stagger `--quiz-mark-stride` adapt to the lobe's own arc length (longer lobes = more stride)? — owner: [[dev]] — since: 2026-05-16

## Assumptions
- Modern browsers' CSS `filter: blur()` is GPU-accelerated and won't drop frames at 60fps with 18 elements × 3 layers animating — status: untested on phones — since: 2026-05-16
- The dataset attrs on the SVG (cx, gapStartDeg, etc.) won't be needed by consumers other than the quiz, but emitting them is cheap so they stay — status: validated (no consumer impact) — since: 2026-05-16
- `transform-box: fill-box` on a `<g>` returns the union of its children's bboxes (works for scale anchoring) — status: validated in dev — since: 2026-05-16

## Dependencies
Blocked by: (none)
Feeds into: [[ux]] (UI behaviour), [[qa]] (animation under test)

## Session Log
<!-- One line per session, newest first -->
- 2026-05-16 — Soft-edge sweep mask replaces hard clip-path; Feather slider added to Tune panel; tests still green.
