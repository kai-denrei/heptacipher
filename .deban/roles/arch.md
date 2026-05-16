---
role: arch
owner: Gerald (Jelaludo)
status: active
last-updated: 2026-05-16
---

# Architecture

## Scope
Render pipeline architecture: how a number becomes a logogram across the ensō, lobe, brush, and splotch primitives; how the V2 flowing-arc layout differs from V1; how the quiz reveal layers (SVG mask + CSS keyframes + rAF) compose. Owns the WHY of geometry and the contract between renderer and consumer. Does not own concrete implementation details ([[dev]]) or visual feel ([[ux]]).

## Decisions
| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-16 | V2 lobes alternate inside/outside the ensō ring: thousands and tens OUTSIDE, hundreds and units INSIDE. | Doubles the visual address space (in/out × angular position) without changing the encoding alphabet. Reads as a calligraphic flourish around the ring. | [[dev]], [[ux]] |
| 2026-05-16 | V2 has SEPARATE bulge multipliers for inward and outward lobes (LOBE_BULGE_INWARD = 0.32, LOBE_BULGE_OUTWARD = 0.50). | Inward lobes share a finite area (the ring's interior) — they need to be smaller or they crowd the centre / collide with each other. | [[dev]] |
| 2026-05-16 | Three render layers: far halo (heaviest blur, lowest opacity), near halo (light blur, mid opacity), crisp ink (light displacement, high opacity). All three carry the same `<g>` content; halo layers tagged `data-halo="true"` for `sample.js` to skip. | Wet sumi-ink look needs at least two halo passes to read as soaked paper; a single Gaussian halo looks like a blur, not a bleed. | [[dev]] |
| 2026-05-16 | Quiz reveal is composed of THREE coordinated effects: (1) CSS `@keyframes bloomDrop`/`bloomRing`/`bloomMark` for per-element bloom; (2) rAF-driven soft-edge mask for the ensō clockwise sweep; (3) crisp-layer stagger (80ms) behind halo for capillary feel. | A single technique can't deliver both "drawn as a gesture" AND "wet ink emerging from paper" — they're orthogonal. Layering them makes both legible. | [[dev]], [[ux]] |
| 2026-05-16 | Each lobe Nn synced to the moment the sweep enters body quadrant Cn (4 equal quadrants of the body sweep, excluding tail). | The user wants "C1 + N1 appear together, then C2 + N2 …" — sync to quadrant rather than per-lobe geometry simplifies the contract and survives changes to digitGap. | [[dev]], [[ux]] |
| 2026-05-16 | Cache-busting toolkit + service worker coexist via stratified strategies: NetworkFirst on HTML (so cb-bumps win), SWR on cb-fingerprinted JS (new tokens = new cache keys), CacheFirst on icons. | The two systems independently invalidate at different layers — composing them gives layered defense without conflict. | [[devops]] |

## Dead Ends
| Date | What was tried | Why it failed / was rejected |
|---|---|---|
| 2026-05-16 | Initial V2 design had ALL four lobes outside the ring at fixed angular positions matching V1 quadrants. | Lost the "flowing gesture" feel — looked like V1 with bigger lobes. Switched to alternating inside/outside so the body of the ring carries the visual rhythm. |
| 2026-05-16 | First quiz reveal animation was a simple left-to-right `clip-path: inset()` sweep across the entire SVG. | No relationship to the brush gesture, no organic feel. Replaced with sector sweep from the ensō centre rotating clockwise. |
| 2026-05-16 | Sector sweep used `ease-out-quart` for "natural brush acceleration". | When we needed to sync lobes to quadrants, the easing made the angular position non-linear, breaking the simple `bodyTime/4` quadrant math. Reverted to linear sweep; the brush "naturalness" comes from the bloom layers, not the sweep itself. |
| 2026-05-16 | Sector-from-center mask architecture (all variants — hard clip, soft mask, with/without bloomRing). | Structurally wrong for the artwork. A sector mask grows angularly from the ring's geometric center; its leading edge is a radial line through the ring. For ANY closed brush-stroke shape with a wet halo, this approach has an irreducible math conflict: the leading-edge feather must be wide enough to look organic (~3σ = 100+ px at our scale) but the maximum chord between the sector's leading and trailing edges at the ring radius is only ~230 px, so the blur fields overlap and the wedge interior never reaches alpha=1. There is no parameter setting that gives both "soft brush tip" AND "fully revealed wake" with this geometry. We tried four variants over multiple sessions; all fail in the same fundamental way. |
| 2026-05-16 | Stroke-dashoffset on the ensō SPINE, used as the stroked path inside an SVG `<mask>`. Filter:blur on the mask path for soft brush tip. | Implemented to replace the wedge architecture. Status as of this sync: **also fails to read organically**. The geometric path-based reveal solves the wedge math problem but introduces new ones: stroked-mask blur leaks both ahead AND behind the dash; wide mask stroke (to cover halo) makes "brush position" fuzzy; the dash-grow is too uniform to read as a brush gesture. Animation still not solved. |

## Lessons
- When two layers have to stay synchronized (here: rAF clip-sweep + CSS lobe blooms), use the linear easing on whichever layer the other one anchors to. Easing on the anchor breaks the inverse math.
- A finite area (ensō interior) places HARD limits on how much you can scale anything inside it without collision. Always size interior elements as a smaller fraction of the available radius than exterior ones.
- "Wet ink" reads as a multi-layer effect (halo + halo + crisp), not a single Gaussian blur. The eye needs the GRADIENT between halo and crisp to perceive wetness.
- A closed brush-stroke shape (like a ring) with a soft halo cannot be drawn organically by a sector mask from the shape's centroid. The blur radius needed for "organic" exceeds the chord width of the shape; the math kills the wedge interior. Any "draw progressively" reveal for such a shape needs a DIFFERENT mechanism (path-following, per-segment, raster overlay, etc.).
- When the parameter-tuning loop produces the same visual failure for every value of every slider, the bug is in the technique, not the parameters. Stop iterating and rethink.

## Open Questions
- [ ] Should V3 introduce a fifth lobe (or a different placement for digits >9999)? — owner: [[arch]] — since: 2026-05-16
- [ ] Can the wet-drop position be a function of the seed so it lands at a different point on the ring per render? — owner: [[arch]] — since: 2026-05-16
- [ ] **UNSOLVED: how to draw a closed brush-stroke ring (with wet halo) organically in SVG?** Four architectural approaches tried (hard wedge, soft wedge, global bloom, stroke-dashoffset-on-spine) all fail. The right approach is probably structurally different — path-segment animations, canvas-rendered frames with per-frame mask updates, SMIL `<animateMotion>` with deposit-as-you-go, or a totally different rendering pipeline. See `_index.md` Open Questions for the outside-help query. — owner: [[arch]] + [[dev]] — since: 2026-05-16

## Assumptions
- The 4-digit ceiling (0–9999) is fixed by the puzzle game spec — status: untested (no game integration validated yet) — since: 2026-05-16
- The chosen quadrant boundaries (4 equal slices of body sweep) map naturally to the four lobe positions. Confirmed by inspection at default digitGap; may drift if digitGap is very high or very low — status: validated for digitGap∈[0.03, 0.10] — since: 2026-05-16

## Dependencies
Blocked by: (none)
Feeds into: [[dev]] (implements the architecture)

## Session Log
- 2026-05-16 (evening) — Wedge-mask architecture declared structurally broken for the artwork. Stroke-dashoffset-on-spine replacement also fails to read organically. Problem parked + escalated to outside-help query.
- 2026-05-16 — Quadrant-sync model documented; linear-sweep + per-lobe `--lobe-start` arch decision committed; soft-edge mask architecture committed.
