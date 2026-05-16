---
role: ux
owner: Gerald (Jelaludo)
status: active
last-updated: 2026-05-16
---

# UX

## Scope
Visual and interaction design of the demo: tab layout, the V1/V2/Quiz mode switch, slider panels, the mobile quiz layout (no-scroll, floating modal, small keypad), the bloom-and-settle reveal feel, and the wet-ink aesthetics generally.

## Decisions
| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-16 | Quiz uses a mobile-first single-page no-scroll layout: tabs at top, stage fills the rest, keypad as a floating translucent modal in the top-left (`position: absolute; backdrop-filter: blur(10px)`). | Phones don't have room for a side panel; the ink is the hero, the keypad must not steal it. Floating modal lets the logogram fill the viewport behind the controls. | [[dev]] |
| 2026-05-16 | Modal contents stacked vertically: round/score → 4-cell input display → 3×4 keypad (36×28 buttons) → feedback line → Replay/Tune/Vars buttons. | Each layer is one concern, no horizontal scrolling. The compact button row at the bottom is a deliberate "tuning surface" only — main game UX is above it. | [[dev]] |
| 2026-05-16 | Correct/wrong glow: yellow `drop-shadow #f5dd4b` for 1.4 s on correct; dark-red `drop-shadow #5a0a0a` + opacity fade for 1.3 s on wrong (the wrong glyph vanishes). | Yellow = "let it linger, you did well"; dark red + vanish = "wrong, don't dwell, move on". | [[pm]] |
| 2026-05-16 | Tune panel uses CSS custom properties (`--quiz-anim-scale`, `--quiz-anim-blur`, `--quiz-anim-overshoot`, `--quiz-anim-stagger`, `--quiz-mark-stride`, `--quiz-sweep-feather`) so dragging a slider retimes/reshapes all animations live without re-rendering the SVG. | Tuning visual feel needs fast iteration loops. Re-rendering 18 elements + 3 SVG filters per drag would feel laggy. | [[dev]] |
| 2026-05-16 | Vars toggle (`Vars ▾`) reveals the V2 ink/shape sliders as a right-side translucent drawer over the stage. While on, quiz renders pull from live state instead of locked `QUIZ_PARAMS`. | Lets the user refine the look without leaving the quiz tab — switching to V2 tab would reset quiz state. | [[dev]] |
| 2026-05-16 | The number/encoding/randomness/overlay fieldsets are hidden in the Vars drawer (only V2 shape and V2 ink show). | Quiz controls number/encoding/seed; surfacing those toggles in the drawer would invite the user to break the quiz's invariants. | [[dev]], [[pm]] |

## Dead Ends
| Date | What was tried | Why it failed / was rejected |
|---|---|---|
| 2026-05-16 | Initial quiz mobile layout used a bottom bar with keypad on the left + info on the right. | Bottom bar ate too much vertical space, reducing the logogram's visible area on small phones. Switched to floating modal in top-left so the stage is full-bleed. |
| 2026-05-16 | Tune panel initially had each slider's label and value on separate rows. | Took 4× the vertical space and made the modal balloon past comfortable height. Compressed to a 3-column grid (label / slider / value). |
| 2026-05-16 | Wet-drop splash anchored at the SVG's origin (default `transform-origin: 0 0`). | Splash visibly scaled from the top-left corner instead of the brush touchdown point. Pinned `transform-origin` to `wetDropX/Y px` in JS so it lands where the brush would have hit. |
| 2026-05-16 | Random center dots inside the ensō (carried over from V1 nostalgia). | User explicitly asked to remove them — they competed for attention with the lobes and weren't part of the V2 design language. Block deleted. |

## Lessons
- A floating modal that's translucent + has `backdrop-filter: blur()` lets you put controls ON TOP of the artwork without occluding it. Used here for the keypad, but it generalises to any review-art interface.
- When animating a scaled element, default `transform-origin` is usually wrong. Either set `transform-box: fill-box; transform-origin: center` (for self-anchoring) or pin to coordinates baked into the SVG dataset (for arbitrary anchor points).
- CSS custom properties + `calc()` make slider-tuned animation pipelines almost free at runtime — the browser interpolates without JS being in the loop.

## Open Questions
- [ ] Should the input display flash / pulse when a digit is typed so the user gets immediate feedback? — owner: [[ux]] — since: 2026-05-16
- [ ] Does the floating modal need a drag handle so the user can move it (e.g., if it covers a lobe they want to read)? — owner: [[ux]] — since: 2026-05-16
- [ ] Should the Replay button also reshuffle the seed, or strictly redraw the same glyph? — owner: [[ux]] — since: 2026-05-16

## Assumptions
- The Tune/Vars panels are dev-only and won't ship to puzzle game players — status: untested — since: 2026-05-16
- The `Tune ▾` glyph is universally read as "expand a settings panel" — status: validated by Western web convention; untested for other locales — since: 2026-05-16
- Players will tap the digit immediately when they recognise the pattern (not wait for full reveal) — the snap-reveal logic assumes this — status: untested — since: 2026-05-16

## Dependencies
Blocked by: [[dev]] (visual ideas need implementation)
Feeds into: [[pm]] (UX shapes player perception)

## Session Log
- 2026-05-16 — Floating modal, Tune panel (6 sliders), Vars drawer all committed. Soft-edge sweep mask resolved the geometric-line artifact at the leading edge.
