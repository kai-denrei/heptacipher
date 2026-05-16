---
role: qa
owner: Gerald (Jelaludo)
status: active
last-updated: 2026-05-16
---

# QA

## Scope
Automated and manual test coverage. The vitest suite at `test/basic.test.js` verifies the structural contract of the V1 and V2 SVG output and seed determinism. Visual / animation behaviour is validated manually in the browser. Owns "does this still work after a change."

## Decisions
| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-16 | `npm test` runs `vitest run --environment happy-dom` (added the flag to package.json default). | `compositeFlow.js` calls `document.createElementNS`; without happy-dom the tests crash with "document is not defined". | [[dev]] |
| 2026-05-16 | Render-pipeline tests verify the V2 SVG structure (4 `g.appendage` with morse/prong classes, wet-drop, ensō, far/near halo + crisp layers, viewBox, dataset.variant) and seed determinism. No tests for animation behaviour. | Animation correctness is visual; a unit test can't tell you whether the bloom feels organic. Manual + browser DevTools timeline is the right tool. | [[dev]], [[ux]] |
| 2026-05-16 | Quiz keypad and bloom/sweep logic are NOT under automated test. | Adding Playwright for animation regression would 5×-10× the test setup; cost-benefit isn't there for a one-developer project. Revisit if the project grows. | [[pm]] |

## Dead Ends
| Date | What was tried | Why it failed / was rejected |
|---|---|---|
| 2026-05-16 | `npm test` first attempt without environment flag — failed with `ReferenceError: document is not defined`. | vitest defaults to `node` environment which doesn't include DOM APIs. Fixed by `--environment happy-dom`. |

## Lessons
- A bare `vitest` default environment hides DOM-dependent code paths until they run. For any SVG/DOM-emitting module, set `--environment happy-dom` (or `jsdom`) explicitly in the package.json default.

## Open Questions
- [ ] Should the quiz auto-test (run all 4 digits 0–9 in each slot) detect when a generated SVG renders an unreadable digit? — owner: [[qa]] — since: 2026-05-16
- [ ] Is there a way to sample the rendered SVG after animation and assert "no element has opacity 0 after t > 2.1s"? Currently no way to catch a stuck animation. — owner: [[qa]] — since: 2026-05-16
- [ ] Should there be a visual regression test (e.g., golden-file SVG snapshot at fixed seed)? — owner: [[qa]] — since: 2026-05-16

## Assumptions
- The 8 existing tests cover enough structural ground that a regression in geometry would fail at least one of them — status: validated for V1/V2 structure; untested for any future variant — since: 2026-05-16
- Browser quirks in `feGaussianBlur` rendering won't break the visual contract across Chrome/Safari/Firefox — status: untested across browsers — since: 2026-05-16

## Dependencies
Blocked by: [[dev]] (new features need tests)
Feeds into: [[pm]] (test signal informs release readiness)

## Session Log
- 2026-05-16 — All 8 vitest tests passing after every refactor in the long session (cache-busting, V2 inside/outside, quiz, mobile PWA, bloom animation, soft-edge mask).
