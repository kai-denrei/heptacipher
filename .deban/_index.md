---
project: heptapod-logograms
created: 2026-05-16
status: active
mode: solo
stale_threshold_days: 30
---

# heptapod-logograms — Index

## Brief
Procedural calligraphy engine that turns a 4-digit number (0–9999) into a heptapod-style logogram: an open ensō with four digit-encoding lobes. V1 places lobes radially in NW/NE/SE/SW; V2 flows lobes along the ensō body with wet-ink halo, liquid-edge feDisplacementMap, and alternating inside/outside placement. The demo is a PWA with a Quiz tab that animates each round in ~2 s as if drawn by a brush — wet-drop splash, clockwise body sweep through a soft-edge mask, and per-quadrant lobe blooms synced to the gesture.

## Active Roles
- [[dev]] — owner: Gerald (Jelaludo)
- [[arch]] — owner: Gerald (Jelaludo)
- [[pm]] — owner: Gerald (Jelaludo)
- [[ux]] — owner: Gerald (Jelaludo)
- [[qa]] — owner: Gerald (Jelaludo)
- [[devops]] — owner: Gerald (Jelaludo)

## Key Decisions
<!-- Cross-role summary, maintained by COMPACT -->
- 2026-05-16 — V2 reveal abandons hard clip-path for an feGaussianBlur-softened SVG mask ([[dev]], [[arch]])
- 2026-05-16 — Quiz mode locks render params and seed across rounds; sliders re-overrides via Vars toggle ([[ux]], [[dev]])
- 2026-05-16 — Linear sweep + per-quadrant `--lobe-start` syncs lobe Nn to body quadrant Cn ([[arch]], [[dev]])
- 2026-05-16 (evening) — Wedge-mask architecture declared structurally broken; replaced with stroke-dashoffset on per-element spine inside SVG `<mask>`. **Still doesn't achieve organic brush-drawn feel.** Problem parked. ([[arch]], [[dev]], [[ux]])

## Open Questions (cross-role)
<!-- Unresolved items spanning more than one role -->
- [ ] **UNSOLVED — organic brush-drawn ring reveal.** After four architectural approaches and ~3h of slider tuning across multiple sessions, the ring still does NOT read as "being drawn by a brush". It either fades in globally, shows hard geometric artifacts, or reveals without apparent gesture motion. Parked for fresh-eyes revisit. Outside-help query is at the bottom of this file. — owners: [[dev]], [[arch]], [[ux]] — since: 2026-05-16
- [ ] Has the quiz been play-tested with a human who hasn't seen the code? — owners: [[pm]], [[ux]], [[qa]] — since: 2026-05-16
- [ ] Does the bloom-and-settle reveal interact correctly with `prefers-reduced-motion` on iOS? — owners: [[ux]], [[qa]] — since: 2026-05-16

## Outside-help query (for posting to forums / asking other devs)

> **SVG animation: how do you "draw" a closed brush-stroke ring organically, like a brush stroking onto paper?**
>
> The artwork is an open ensō (calligraphic ring with a gap): a filled SVG `<path>` representing the brush outline (variable width, ~30 px peak), with two stacked `feGaussianBlur` halo layers behind it that bleed the ink ~60 px past the brush body. Ring radius ~115 px in a ~480 px viewBox.
>
> Required reveal behaviour:
> 1. Each point on the ring starts at opacity 0 and transitions gradually to fully visible as the brush "passes" that position — no global pre-fade where the ring is already faintly visible everywhere.
> 2. The brush follows the ring's spine clockwise (the spine is the wobbly polyline used to generate the brush outline).
> 3. The brush's leading edge is soft (~50–100 px transition zone) but must NOT produce hard geometric artifacts (straight radial lines, polygon edges) cutting through the soft halo.
> 4. The animation should read as "an invisible brush is drawing this ring", not "the ring is fading in" or "a wedge is rotating".
> 5. Pure CSS + SVG ideally; modest browser support targets (Chrome/Safari/Firefox 2023+).
>
> Approaches we've tried that all failed:
>
> - **Hard sector clip-path from centre.** The polygon's radial leading edge cuts through the soft halo with a visible straight line — kills the organic feel.
> - **Sector clip with feGaussianBlur on the mask alpha (soft edge).** Mathematically: the wedge interior only reaches alpha = 1 at points more than 3σ away from both leading and trailing radial edges. At ring radius R, the maximum chord between the edges is 2R. For any blur radius wide enough to look organic, the blur fields from both edges overlap at the ring — the wedge interior never reaches alpha = 1 — and the ring just fades in globally.
> - **Global opacity ramp (bloomRing) over the whole ring.** Pre-fades the ring before the wedge reaches each position — explicitly rejected as "the ring shouldn't pre-exist at low opacity".
> - **Stroke-dashoffset animation on the spine, used as a stroked path inside an SVG `<mask>` (with CSS filter:blur for soft brush tip).** The classic SVG line-drawing trick. Mask reveals the brush outline progressively as the dash retracts. But the blur on the stroked mask leaks both ahead AND behind the dash, the wide mask stroke (needed to cover the halo) makes "brush position" fuzzy, and the dash-grow reads as a uniform fill, not a brush gesture.
>
> Question: what technique (or combination) actually achieves the organic brush-drawn ring reveal here? Plausible directions we haven't fully explored: breaking the ring path into ~30 small filled segments and animating each in sequence; SMIL `<animateMotion>` of a small dot along the spine that "deposits" ink (canvas-style); pre-rendered video frames; a moving-spotlight mask with `feMorphology`-grown alpha trailing behind a point; CSS Houdini paint worklet drawing into a 2D context.
