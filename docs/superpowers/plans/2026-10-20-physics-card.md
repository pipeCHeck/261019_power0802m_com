# Physics card implementation plan

**Goal:** Add the reference's transparent rectangle, title and description as a draggable rigid object with gravity, a solid floor and continuous horizontal wrapping.

**Architecture:** A dependency-free `PhysicsCard` model owns gravity, floor contacts, angle and the grabbed local point. A separate DOM controller renders three periodic copies of the same object, manages pointer capture, and keeps card gestures separate from the existing ball game.

**Tech stack:** Native JavaScript modules, CSS transforms, Pointer Events, Node's test runner.

**Requirements:** User's 2026-10-20 request and attached black-outline reference. Title and description initially use the reference's 가나다라. Preserve the site and ball game. Do not commit, push or deploy.

## Task 1: Physical model

- [x] Write failing tests in `tests/card-physics.test.mjs` for gravity, rotated floor contacts, both horizontal seams, an exact off-center grab, rotation under cursor motion, release momentum, cancellation and resize.
- [x] Implement `public/card-physics.mjs`: `PhysicsCard({width,height})`, `body`, `corners`, `displayX`, `awake`, `beginDrag(x,y)`, `moveDrag(x,y)`, `endDrag({throwing})`, `step(seconds)`, `resize(width,height)`.
- [x] Use small fixed substeps, contact impulses and a pinned pendulum while held; preserve the clicked local point rather than snapping to the center.
- [x] Verify fast throws, long floor settling and finite state at small viewport sizes.

## Task 2: Display and input

- [x] Add `public/card.js`, `public/card.css` and semantic reference text in `public/index.html`.
- [x] Draw the same body at x, x-width and x+width to keep the wrap continuous, including partial crossings.
- [x] Use pointer capture for mouse/touch, retain release momentum, cancel on blur/Escape/pointer cancellation/hidden tab, and pause hidden frames.
- [x] Add keyboard nudges and keep duplicate cards out of the accessibility tree.
- [x] Exclude card pointer-down from the existing ball game. Verify blank-space clicks still start the ball game.

## Task 3: Verify and deliver

- [x] Run model and input regression tests; review floor stability, the wrap seam, resize during drag, interrupted capture, and ball/card gesture isolation.
- [x] Inspect a native render of representative poses if local browser control remains disabled; report the browser verification limit honestly.
- [x] Bump the site version exactly once and verify package, lock and footer match.
- [x] Leave every change uncommitted, as requested.

## Verification notes

- 27 Node tests pass, including card/ball gesture isolation, capture interruptions, exact floor grab and rotated wrap hit testing. Independent code review findings were fixed and re-reviewed.
- Native canvas poses were inspected for reference proportions and periodic geometry. Browser automation is disabled; native render is not a browser screenshot.
- Local server reports listening on 127.0.0.1:5173. Read-only loopback HTTP checks are blocked/time out in the tool environment, so a live browser check remains unverified.
- Version is v0.0.6 across package, package-lock and footer. All changes remain uncommitted; no push or deployment.
