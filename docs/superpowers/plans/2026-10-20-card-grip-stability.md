# Stable plastic-plate grip

User feedback: v0.0.8 overcorrected resistance; simply holding a corner can produce nearly a full rotation. Desired behavior is an ordinary rigid plastic plate, with direct translation, moderate driven rotation and a stable grip, not water-like global drag.

Probe: stationary lower-edge grip (1,85) swings298degrees, lower corner203degrees, upper corner129degrees. These overshoot their hanging equilibrium because the held rotational joint damps at only .16/s. New capture also inherits free angular velocity without converting angular momentum to the grabbed pivot.

Keep translation/air damping and release momentum unchanged. Add grip-only rotational damping based on the physical pendulum frequency (about80% of critical damping), with a minimum for grabs near the center. At pickup, convert the body's angular/linear momentum about the new pivot and moderate extreme capture spin. Do not impose an angle lock: deliberate gestures can still rotate the plate. Preserve all floor/contact/wrap behavior and shared substeps.

Verify stationary grabs at top/bottom/corner/near-center, spinning pickup, driven motion, precise pinning, release and shape collision regressions. Bump once to v0.0.9. No commit, push, remote build or deployment.

## Verification

- Added stationary-grip and spinning-capture regressions, observed both fail before changing the model. Capture now also sets COM velocity so the grabbed point is immediately stationary, including a down/up between frames; a regression covers this.
- Grip damping is max(2.4,1.6*pendulumFrequency), while translation, air drag and release remain unchanged. Deliberate fast hand motion still passes the existing responsive rotation test.
- 47 tests pass and independent read-only review found no actionable defects. Browser motion feel was not directly verified because browser control is unavailable.
- Version advanced once to v0.0.9; changes remain uncommitted and unpublished.
