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

## Open Questions (cross-role)
<!-- Unresolved items spanning more than one role -->
- [ ] Has the quiz been play-tested with a human who hasn't seen the code? — owners: [[pm]], [[ux]], [[qa]] — since: 2026-05-16
- [ ] Does the bloom-and-settle reveal interact correctly with `prefers-reduced-motion` on iOS? — owners: [[ux]], [[qa]] — since: 2026-05-16
