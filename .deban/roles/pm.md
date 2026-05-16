---
role: pm
owner: Gerald (Jelaludo)
status: active
last-updated: 2026-05-16
---

# PM

## Scope
Project scope, untested assumptions, milestone tracking, and the surface area between the calligraphy engine and the larger puzzle game it's meant to integrate with. Holds the questions nobody else owns.

## Decisions
| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-16 | Quiz is a 5-round game with fixed V2 render params at MAX ink (bleed 2.5, halo 1.6, wobble 20, detail 0.20). | Sample feature to validate that the logograms are READABLE under heavy ink-on-paper effects — if the player can guess 5/5 even with all wetness cranked, the encoding is robust. | [[ux]], [[qa]] |
| 2026-05-16 | Quiz encoding is locked to morse for now — the prong toggle was removed from the quiz UI. | Morse has the larger visual address space (5 marks vs 4 prongs) and is what the V1 spec emphasised first. Prong can come back in V2 of the quiz. | [[ux]] |

## Dead Ends
| Date | What was tried | Why it failed / was rejected |
|---|---|---|
| (none yet at PM level — the project is too early) | | |

## Lessons
(populate during COMPACT once the project has accumulated enough Dead Ends)

## Open Questions
- [ ] Has any human outside this development session tried to guess the number from an animated logogram? — owner: [[pm]] — since: 2026-05-16
- [ ] Does the puzzle game need a difficulty curve (e.g., easier ink at round 1, max ink at round 5)? — owner: [[pm]] — since: 2026-05-16
- [ ] What does "shipping" mean for this project — npm package, embedded module in the puzzle game repo, or hosted PWA at a known URL? — owner: [[pm]] — since: 2026-05-16
- [ ] Is there an accessibility requirement (screen reader, reduced motion, high-contrast mode)? Reduced-motion is wired in but not tested with actual assistive tech. — owner: [[pm]] — since: 2026-05-16
- [ ] What's the right intuition test: "5/5 = encoding works" or "average 3/5 = engaging difficulty"? — owner: [[pm]] — since: 2026-05-16

## Assumptions
- The puzzle game audience knows morse code well enough to decode dots and dashes — status: untested — since: 2026-05-16
- A 2-second reveal animation is long enough for the player to register the brush gesture but short enough not to feel slow — status: untested — since: 2026-05-16
- 5 rounds per quiz session is the right cadence (not 3, not 10) — status: untested — since: 2026-05-16
- The mobile PWA install path matters for this project (rather than e.g. an embedded iframe in the puzzle game) — status: untested — since: 2026-05-16

## Dependencies
Blocked by: (none — internally led)
Feeds into: all other roles (sets the scope question)

## Session Log
- 2026-05-16 — Initial open questions captured; no PM-level decisions committed yet.
